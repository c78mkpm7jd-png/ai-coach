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

// TDEE und Ziel-Kalorien je nach Ziel: Bulk +300, Cut -400, Recomp/Maintain = TDEE
function getTargetCalories(tdee: number, goal: string): number {
  switch (goal) {
    case 'lean-bulk':
      return Math.round(tdee + 300)
    case 'cut':
      return Math.round(tdee - 400)
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

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const only = searchParams.get('only') as 'tip' | 'analysis' | null
    const refreshTip = searchParams.get('refresh') === '1'
    const today = new Date().toISOString().slice(0, 10)

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

    // TDEE: Wenn Gesamtverbrauch in einem Check-in eingetragen wurde, diesen direkt als TDEE nutzen (kein Profil-TDEE); sonst aus Profil berechnen
    const checkinsWithBurn = checkins as { activity_calories_burned?: number | null }[]
    const latestBurn = checkinsWithBurn.find((c) => typeof c.activity_calories_burned === 'number' && c.activity_calories_burned > 0)
    const hasGarminTdee = latestBurn != null
    const tdee = hasGarminTdee
      ? Math.round(Number(latestBurn.activity_calories_burned))
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

    const hasCheckins = checkins.length >= 1
    const openai = new OpenAI({ apiKey: openaiKey })

    const defaultTip = {
      greeting: 'Willkommen zurück.',
      trainingDay: 'Oberkörper',
      trainingSubtext: 'Fokus auf saubere Ausführung.',
      coachTipTitle: 'Gewinn den Tag mit den ersten 2 Sätzen.',
      coachTipPreview: 'Die ersten Sätze jeder Übung entscheiden.',
      coachTipBody: 'Konzentriere dich auf die ersten Sätze jeder Hauptübung – sauber und kontrolliert.',
    }

    let greeting = defaultTip.greeting
    let trainingDay = defaultTip.trainingDay
    let trainingSubtext = defaultTip.trainingSubtext
    let coachTipTitle = defaultTip.coachTipTitle
    let coachTipBody = defaultTip.coachTipBody
    let coachTipPreviewRes = defaultTip.coachTipPreview
    let analysisTitle: string | null = null
    let analysisBody: string | null = null
    let analysisPreviewRes: string | null = null

    // 1. Tipp des Tages: ein Mal pro User/Tag (preview + full zusammen). Aus Cache oder einmal generieren.
    if (only !== 'analysis') {
      if (!refreshTip) {
        const { data: cached } = await supabaseAdmin
          .from('daily_tips')
          .select('coach_tip_title, coach_tip_preview, coach_tip_body')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle()
        if (cached?.coach_tip_title) {
          coachTipTitle = cached.coach_tip_title
          coachTipBody = cached.coach_tip_body
          if (cached.coach_tip_preview) coachTipPreviewRes = cached.coach_tip_preview
        }
      }
      if (!coachTipPreviewRes || coachTipPreviewRes === defaultTip.coachTipPreview) {
        const tipSystemPrompt = `Du bist ein prägnanter Fitness- und Ernährungscoach. Antworte ausschließlich auf Deutsch.
Deine Antwort muss valides JSON sein mit exakt diesen Feldern (kein anderer Text):
- "greeting": eine kurze persönliche Begrüßung (1 Satz)
- "trainingDay": Name des heutigen Trainingstags (z.B. "Oberkörper", "Beine", "Push", "Pull", "Ganzkörper") passend zu ${trainingDaysPerWeek} Trainingstagen pro Woche. Heute ist ${weekday}.
- "trainingSubtext": ein kurzer Satz Fokus/Hinweis für das heutige Training
- "coachTipTitle": eine kurze, prägnante Überschrift für den Tipp (mit Anführungszeichen)
- "coachTipPreview": Genau EIN Satz Zusammenfassung des Tipps (max. 15 Wörter). Muss dasselbe Thema wie coachTipBody behandeln. Wird auf der Dashboard-Card angezeigt.
- "coachTipBody": Der vollständige Tipp zum GLEICHEN Thema wie coachTipPreview: spezifische, wenig bekannte Insights aus Training, Ernährung, Regeneration, Schlaf, mentaler Stärke oder Supplementen. KEINE 0815-Tipps. Exakt 3–4 Sätze, sofort umsetzbar. Wird auf der Detailseite angezeigt. preview und body gehören zusammen.`

        const tipUserPrompt = `Heute ist ${weekday}. Generiere EINEN Coach-Tipp. Gib preview (1 Satz) und full (3–4 Sätze) zum selben Thema. Dann das JSON für Begrüßung, Trainingstag und diesen einen Tipp.`

        const tipCompletion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: tipSystemPrompt },
            { role: 'user', content: tipUserPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        })

        const tipContent = tipCompletion.choices[0]?.message?.content
        if (tipContent) {
          try {
            const parsed = JSON.parse(tipContent) as Record<string, unknown>
            greeting = (parsed.greeting as string) ?? defaultTip.greeting
            trainingDay = (parsed.trainingDay as string) ?? defaultTip.trainingDay
            trainingSubtext = (parsed.trainingSubtext as string) ?? defaultTip.trainingSubtext
            coachTipTitle = ((parsed.coachTipTitle as string) ?? defaultTip.coachTipTitle).replace(/^["']|["']$/g, '')
            coachTipBody = (parsed.coachTipBody as string) ?? defaultTip.coachTipBody
            const coachTipPreview = (parsed.coachTipPreview as string)?.trim()
            if (coachTipPreview) coachTipPreviewRes = coachTipPreview
            await supabaseAdmin.from('daily_tips').upsert(
              {
                user_id: userId,
                date: today,
                coach_tip_title: coachTipTitle,
                coach_tip_preview: coachTipPreviewRes || defaultTip.coachTipPreview,
                coach_tip_body: coachTipBody,
              },
              { onConflict: 'user_id,date' }
            )
          } catch {
            // keep defaults
          }
        }
      }
    }

    // 2. Check-In Analyse (nur Nutzerdaten) – nur wenn mind. 1 Check-in und nicht only=tip
    if (only !== 'tip' && hasCheckins) {
      const calorieTarget = targetCalories
      const proteinTarget = Math.round(weight * 2)
      const analysisSystemPrompt = `Du bist ein datenorientierter Fitness- und Ernährungscoach. Antworte ausschließlich auf Deutsch.
Deine Antwort muss valides JSON sein mit exakt diesen Feldern (kein anderer Text):
- "analysisTitle": eine kurze, prägnante Überschrift der Analyse (mit Anführungszeichen)
- "analysisPreview": Genau EIN spannender Satz basierend auf den Daten, der neugierig macht (max. 15 Wörter). Wird nur auf der Dashboard-Card angezeigt. Kein Spoiler der vollen Analyse.
- "analysisBody": Die vollständige datenbasierte Analyse: NUR basierend auf den Check-in-Daten. Kalorien, Makros, Verbrauch, Aktivität. Konkrete, umsetzbare Empfehlungen. Exakt 3–4 Sätze. Wird nur auf der Detailseite angezeigt.`

      const analysisUserPrompt = `Profil-Ziel: ${goal}. Tagesziel: ca. ${calorieTarget} kcal, mind. ${proteinTarget} g Protein. Makros-Ziel: ${macros.protein} g Protein, ${macros.carbs} g Carbs, ${macros.fat} g Fett.

Letzte Check-ins (alle eingetragenen Daten):
${checkinsSummary}

Analysiere ausschließlich diese Daten und gib konkrete Handlungsempfehlungen.`

      const analysisCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: analysisSystemPrompt },
          { role: 'user', content: analysisUserPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      })

      const analysisContent = analysisCompletion.choices[0]?.message?.content
      if (analysisContent) {
        try {
          const parsed = JSON.parse(analysisContent) as Record<string, unknown>
          analysisTitle = ((parsed.analysisTitle as string) ?? '').replace(/^["']|["']$/g, '')
          analysisBody = (parsed.analysisBody as string) ?? ''
          const ap = (parsed.analysisPreview as string)?.trim()
          if (ap) analysisPreviewRes = ap
        } catch {
          // leave null
        }
      }
    }

    const tipOfDay = {
      preview: coachTipPreviewRes || '',
      full: coachTipBody,
    }
    const analysis =
      hasCheckins && (analysisPreviewRes != null || analysisBody != null)
        ? { preview: analysisPreviewRes || '', full: analysisBody || '' }
        : null

    return NextResponse.json({
      macros: {
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      },
      greeting,
      trainingDay,
      trainingSubtext,
      tipOfDay,
      analysis,
      hasCheckins,
      // Legacy
      coachTipTitle,
      coachTipBody,
      coachTipPreview: coachTipPreviewRes || null,
      analysisTitle,
      analysisBody,
      analysisPreview: analysisPreviewRes,
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
