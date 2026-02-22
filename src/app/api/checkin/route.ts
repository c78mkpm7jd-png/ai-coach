import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') ?? '7', 10) || 7))

    const { data, error } = await supabaseAdmin
      .from('daily_checkins')
      .select('id, created_at, weight_kg, hunger_level, energy_level, trained, activity_type, activity_duration_min, activity_calories_burned, calories_intake, protein_intake, carbs_intake, fat_intake')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ API checkin GET:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Check-ins', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data ?? [] }, { status: 200 })
  } catch (err) {
    console.error('❌ API checkin GET:', err)
    return NextResponse.json(
      { error: 'Interner Serverfehler', message: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    if (!dateStr) {
      return NextResponse.json({ error: 'Query-Parameter date (YYYY-MM-DD) erforderlich' }, { status: 400 })
    }

    const dateStart = `${dateStr}T00:00:00.000Z`
    const [y, m, d] = dateStr.split('-').map(Number)
    const dateEnd = new Date(Date.UTC(y, m - 1, d + 1)).toISOString()

    const { data, error } = await supabaseAdmin
      .from('daily_checkins')
      .delete()
      .eq('user_id', userId)
      .gte('created_at', dateStart)
      .lt('created_at', dateEnd)
      .select('id')

    if (error) {
      console.error('❌ API checkin DELETE:', error)
      return NextResponse.json(
        { error: 'Fehler beim Löschen des Check-ins', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, deleted: data?.length ?? 0 }, { status: 200 })
  } catch (err) {
    console.error('❌ API checkin DELETE:', err)
    return NextResponse.json(
      { error: 'Interner Serverfehler', message: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await request.json()
    const {
      weight_kg,
      hunger_level,
      energy_level,
      trained,
      activity_type,
      activity_duration_min,
      activity_calories_burned,
      calories_intake,
      protein_intake,
      carbs_intake,
      fat_intake,
    } = body

    if (weight_kg == null || hunger_level == null || energy_level == null || trained == null) {
      return NextResponse.json(
        { error: 'Fehlende Felder: weight_kg, hunger_level, energy_level, trained erforderlich' },
        { status: 400 }
      )
    }

    const trainedBoolean = String(trained).toLowerCase() !== 'nein'
    const activityType = activity_type != null ? String(activity_type) : 'ruhetag'
    const durationMin =
      activity_duration_min != null && activity_duration_min !== ''
        ? Number(activity_duration_min)
        : null
    const caloriesBurned =
      activity_calories_burned != null && activity_calories_burned !== ''
        ? Number(activity_calories_burned)
        : null

    const toInt = (v: unknown) =>
      v != null && v !== '' ? Number(v) : null

    const { data, error } = await supabaseAdmin.from('daily_checkins').insert({
      user_id: userId,
      weight_kg: Number(weight_kg),
      hunger_level: Number(hunger_level),
      energy_level: Number(energy_level),
      trained: trainedBoolean,
      activity_type: activityType,
      activity_duration_min: durationMin,
      activity_calories_burned: caloriesBurned,
      calories_intake: toInt(calories_intake),
      protein_intake: toInt(protein_intake),
      carbs_intake: toInt(carbs_intake),
      fat_intake: toInt(fat_intake),
    })

    if (error) {
      console.error('❌ API checkin:', error)
      return NextResponse.json(
        { error: 'Fehler beim Speichern des Check-ins', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (err) {
    console.error('❌ API checkin:', err)
    return NextResponse.json(
      { error: 'Interner Serverfehler', message: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
