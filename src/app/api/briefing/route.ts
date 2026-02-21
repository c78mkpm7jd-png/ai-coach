import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase Umgebungsvariablen fehlen')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// BMR nach Mifflin-St Jeor (kcal/Tag)
function bmr(weightKg: number, heightCm: number, age: number, isFemale: boolean): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return base + (isFemale ? -161 : 5)
}

// Aktivitätsmultiplikator
const activityMultiplier: Record<string, number> = {
  sitzend: 1.2,
  'leicht-aktiv': 1.375,
  aktiv: 1.55,
}

// TDEE und Ziel-Kalorien je nach Ziel
function getTargetCalories(tdee: number, goal: string): number {
  switch (goal) {
    case 'lean-bulk':
      return Math.round(tdee + 250)
    case 'cut':
      return Math.round(tdee - 500)
    case 'recomp':
    case 'maintain':
    default:
      return Math.round(tdee)
  }
}

// Makros: Protein je nach Krafttraining erhöht, mehr Carbs nach Ausdauer, Fett ~0.9g/kg
function getMacros(
  targetCalories: number,
  weightKg: number,
  goal: string,
  options: {
    recentWasStrength?: boolean
    recentWasLongCardio?: boolean
  } = {}
): { calories: number; protein: number; carbs: number; fat: number } {
  const proteinMultiplier = options.recentWasStrength ? 2.2 : 2
  const protein = Math.round(weightKg * proteinMultiplier)
  const fatG = Math.round(weightKg * 0.9)
  const fatCal = fatG * 9
  const proteinCal = protein * 4
  let carbCal = Math.max(0, targetCalories - proteinCal - fatCal)
  if (options.recentWasLongCardio) {
    carbCal += 30 * 4 // +30g Carbs nach langer Ausdauer
  }
  const carbs = Math.round(carbCal / 4)
  return {
    calories: targetCalories,
    protein,
    carbs,
    fat: fatG,
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY nicht konfiguriert' },
        { status: 500 }
      )
    }

    const [profileRes, checkinsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin
        .from('daily_checkins')
        .select('created_at, weight_kg, hunger_level, energy_level, trained, activity_type, activity_duration_min, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(7),
    ])

    const profile = profileRes.data
    const checkins = checkinsRes.data ?? []

    if (!profile) {
      return NextResponse.json(
        { error: 'Profil nicht gefunden. Bitte Onboarding abschließen.' },
        { status: 404 }
      )
    }

    const weight = Number(profile.weight) || 70
    const height = Number(profile.height) || 175
    const age = Number(profile.age) || 30
    const gender = String(profile.gender || 'm')
    const activityLevel = String(profile.activity_level || 'sitzend')
    const goal = String(profile.goal || 'maintain')

    // TDEE: Wenn Gesamtverbrauch (Garmin) in Check-ins eingetragen wurde, diesen nutzen; sonst aus Profil berechnen
    const garminBurnList = (checkins as { activity_calories_burned?: number | null }[])
      .map((c) => c.activity_calories_burned)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    const hasGarminTdee = garminBurnList.length > 0
    const tdee = hasGarminTdee
      ? Math.round(
          garminBurnList.reduce((a, b) => a + b, 0) / garminBurnList.length
        )
      : (() => {
          const bmrVal = bmr(weight, height, age, gender === 'w')
          const multiplier = activityMultiplier[activityLevel] ?? 1.2
          return Math.round(bmrVal * multiplier)
        })()

    // Ziel-Kalorien: Bulk/Cut/Recomp auf TDEE addieren oder subtrahieren
    const targetCalories = getTargetCalories(tdee, goal)

    // Letzte Aktivität: mehr Protein nach Krafttraining, mehr Carbs nach langer Ausdauer
    const lastWithActivity = (checkins as { activity_type?: string; activity_duration_min?: number | null }[]).find(
      (c) => c.activity_type && c.activity_type !== 'ruhetag'
    )
    const recentWasStrength = lastWithActivity?.activity_type === 'krafttraining'
    const cardioTypes = ['laufen', 'radfahren', 'schwimmen', 'hiit']
    const recentWasLongCardio =
      lastWithActivity &&
      cardioTypes.includes(String(lastWithActivity.activity_type)) &&
      (lastWithActivity.activity_duration_min ?? 0) >= 45

    const macros = getMacros(targetCalories, weight, goal, {
      recentWasStrength,
      recentWasLongCardio,
    })

    const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date())
    const trainingDaysPerWeek = Number(profile.training_days_per_week) || 4

    type CheckinRow = {
      created_at: string
      weight_kg: number
      hunger_level: number
      energy_level: number
      trained: boolean
      activity_type?: string
      activity_duration_min?: number | null
      activity_calories_burned?: number | null
      calories_intake?: number | null
      protein_intake?: number | null
      carbs_intake?: number | null
      fat_intake?: number | null
    }

    const checkinsSummary = (checkins as CheckinRow[])
      .map((c) => {
        const act =
          c.activity_type && c.activity_type !== 'ruhetag'
            ? `, ${c.activity_type}${c.activity_duration_min != null ? ` ${c.activity_duration_min} min` : ''}${c.activity_calories_burned != null ? `, ${c.activity_calories_burned} kcal verbr.` : ''}`
            : ''
        const nutrition =
          c.calories_intake != null || c.protein_intake != null
            ? ` | Ernährung: ${c.calories_intake ?? '–'} kcal, ${c.protein_intake ?? '–'} g Protein, ${c.carbs_intake ?? '–'} g Carbs, ${c.fat_intake ?? '–'} g Fett`
            : ''
        return `- ${c.created_at.slice(0, 10)}: Gewicht ${c.weight_kg} kg, Hunger ${c.hunger_level}/5, Energie ${c.energy_level}/5, Training ${c.trained ? 'Ja' : 'Nein'}${act}${nutrition}`
      })
      .join('\n')

    const lastCheckin = (checkins as CheckinRow[])[0]
    const proteinTarget = Math.round(weight * 2)
    const calorieTarget = targetCalories
    const nutritionHint =
      lastCheckin && (lastCheckin.calories_intake != null || lastCheckin.protein_intake != null)
        ? `
Optional für Personalisierung: Letzter Check-in – ${lastCheckin.calories_intake ?? '–'} kcal, ${lastCheckin.protein_intake ?? '–'} g Protein. Ziel: ca. ${calorieTarget} kcal, mind. ${proteinTarget} g Protein. Wenn du einen personalisierten Tipp wählst (z. B. Protein-Lücke oder Kalorien-Anpassung), formuliere ihn spezifisch und nicht generisch. Ansonsten wähle einen starken allgemeinen Tipp aus den genannten Bereichen.`
        : ''

    const openai = new OpenAI({ apiKey: openaiKey })

    const systemPrompt = `Du bist ein freundlicher, prägnanter Fitness- und Ernährungscoach. Antworte ausschließlich auf Deutsch.
Deine Antwort muss valides JSON sein mit exakt diesen Feldern (kein anderer Text):
- "greeting": eine kurze persönliche Begrüßung (1 Satz)
- "trainingDay": Name des heutigen Trainingstags (z.B. "Oberkörper", "Beine", "Push", "Pull", "Ganzkörper") passend zu ${trainingDaysPerWeek} Trainingstagen pro Woche. Heute ist ${weekday}.
- "trainingSubtext": ein kurzer Satz Fokus/Hinweis für das heutige Training
- "coachTipTitle": eine kurze, prägnante Überschrift für den Coach-Tipp (mit Anführungszeichen)
- "coachTipBody": Der Coach-Tipp ist eine Mischung aus (1) personalisierten Hinweisen basierend auf den Nutzerdaten (wenn vorhanden und relevant) und (2) hochwertigen, wenig bekannten Insights. Quellen für allgemeine Tipps: wenig bekannte Trainingsoptimierungen, Ernährungswissenschaft (spezifisch, evidenzbasiert), Regeneration und Schlafqualität, mentale Stärke und Performance, Supplement-Timing und Wirkung. WICHTIG: Keine 0815-Tipps wie "trink mehr Wasser" oder "schlaf gut". Nur spezifische, umsetzbare Insights, die der Nutzer wahrscheinlich noch nicht kennt. Maximal 3 Sätze, präzise und sofort umsetzbar. Jeden Tag ein anderer Schwerpunkt – abwechslungsreich halten.`

    const todayISO = new Date().toISOString().slice(0, 10)
    const userPrompt = `Heute: ${todayISO} (${weekday}). Profil: Ziel ${goal}, ${age} Jahre, ${gender === 'm' ? 'männlich' : 'weiblich'}, ${height} cm, ${weight} kg, Aktivität ${activityLevel}, ${trainingDaysPerWeek}x Training pro Woche. Tagesziel: ca. ${calorieTarget} kcal, Protein mind. ${proteinTarget} g.

Letzte Check-ins (mit Ernährungsdaten wo erfasst):
${checkinsSummary || 'Noch keine Check-ins.'}
${nutritionHint}

Generiere das JSON für das Daily Briefing. Wähle für coachTipTitle und coachTipBody einen anderen Schwerpunkt als an typischen "Motivations-Tagen" – abwechslungsreich und inhaltlich wertvoll.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: 'Keine Antwort von der KI' },
        { status: 500 }
      )
    }

    let aiData: {
      greeting?: string
      trainingDay?: string
      trainingSubtext?: string
      coachTipTitle?: string
      coachTipBody?: string
    }
    try {
      aiData = JSON.parse(content)
    } catch {
      aiData = {
        greeting: 'Willkommen zurück.',
        trainingDay: 'Oberkörper',
        trainingSubtext: 'Fokus auf saubere Ausführung.',
        coachTipTitle: '"Gewinn den Tag mit den ersten 2 Sätzen."',
        coachTipBody: 'Konzentriere dich auf die ersten Sätze jeder Hauptübung – sauber und kontrolliert.',
      }
    }

    return NextResponse.json({
      macros: {
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      },
      greeting: aiData.greeting ?? 'Willkommen zurück.',
      trainingDay: aiData.trainingDay ?? 'Oberkörper',
      trainingSubtext: aiData.trainingSubtext ?? 'Fokus auf saubere Ausführung.',
      coachTipTitle: (aiData.coachTipTitle ?? '').replace(/^["']|["']$/g, ''),
      coachTipBody: aiData.coachTipBody ?? '',
    })
  } catch (err) {
    console.error('❌ API briefing:', err)
    return NextResponse.json(
      {
        error: 'Briefing konnte nicht geladen werden',
        message: err instanceof Error ? err.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    )
  }
}
