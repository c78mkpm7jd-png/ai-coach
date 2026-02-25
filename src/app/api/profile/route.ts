import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt');
}

// Erstelle Supabase Client mit Service Role Key (umgeht RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function upsertProfile(userId: string, body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    id: body.id ?? userId,
    goal: body.goal,
    age: body.age,
    gender: body.gender,
    height: body.height,
    weight: body.weight,
    activity_level: body.activity_level,
    training_days_per_week: body.training_days_per_week,
    updated_at: (body.updated_at as string) || new Date().toISOString(),
  };
  if (body.checkin_reminder_time !== undefined) {
    payload.checkin_reminder_time = body.checkin_reminder_time as string | null;
  }
  if (body.calorie_target_min !== undefined) payload.calorie_target_min = body.calorie_target_min == null ? null : Number(body.calorie_target_min);
  if (body.calorie_target_max !== undefined) payload.calorie_target_max = body.calorie_target_max == null ? null : Number(body.calorie_target_max);
  if (body.protein_target_min !== undefined) payload.protein_target_min = body.protein_target_min == null ? null : Number(body.protein_target_min);
  if (body.protein_target_max !== undefined) payload.protein_target_max = body.protein_target_max == null ? null : Number(body.protein_target_max);
  if (body.carbs_target_min !== undefined) payload.carbs_target_min = body.carbs_target_min == null ? null : Number(body.carbs_target_min);
  if (body.carbs_target_max !== undefined) payload.carbs_target_max = body.carbs_target_max == null ? null : Number(body.carbs_target_max);
  if (body.fat_target_min !== undefined) payload.fat_target_min = body.fat_target_min == null ? null : Number(body.fat_target_min);
  if (body.fat_target_max !== undefined) payload.fat_target_max = body.fat_target_max == null ? null : Number(body.fat_target_max);
  if (body.coach_voice !== undefined) payload.coach_voice = body.coach_voice == null || body.coach_voice === '' ? 'onyx' : String(body.coach_voice);
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
  return data;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null }, { status: 200 });
      }
      return NextResponse.json(
        { error: 'Fehler beim Laden des Profils', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('❌ API GET:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler', message: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    if (body.id !== userId) {
      return NextResponse.json({ error: 'User ID stimmt nicht überein' }, { status: 403 });
    }

    const data = await upsertProfile(userId, body);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('❌ API POST:', error);
    return NextResponse.json(
      { error: 'Fehler beim Speichern des Profils', message: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    body.id = userId;

    const data = await upsertProfile(userId, body);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('❌ API PUT:', error);
    return NextResponse.json(
      { error: 'Fehler beim Speichern des Profils', message: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/** Onboarding zurücksetzen: Profil löschen (nur für Dev, z. B. ?dev=true auf Profil-Seite). */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ API DELETE profile:', error);
    return NextResponse.json(
      { error: 'Fehler beim Zurücksetzen', message: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/** checkin_reminder_time setzen ODER Ziele & Makros (calorie/protein/carbs/fat_target_min/max) */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const time = body.checkin_reminder_time as string | null | undefined;
    if (time !== undefined) {
      if (time !== null && typeof time !== 'string') {
        return NextResponse.json({ error: 'checkin_reminder_time muss ein Zeit-String (HH:MM) oder null sein' }, { status: 400 });
      }
      updatePayload.checkin_reminder_time = time == null || time === '' ? null : String(time).slice(0, 5);
    }

    const targetFields = [
      'calorie_target_min', 'calorie_target_max',
      'protein_target_min', 'protein_target_max',
      'carbs_target_min', 'carbs_target_max',
      'fat_target_min', 'fat_target_max',
      'coach_voice',
    ] as const;
    for (const key of targetFields) {
      if (body[key] !== undefined) {
        if (key === 'coach_voice') {
          updatePayload[key] = body[key] == null || body[key] === '' ? 'onyx' : String(body[key]);
        } else {
          updatePayload[key] = body[key] == null || body[key] === '' ? null : Number(body[key]);
        }
      }
    }

    if (Object.keys(updatePayload).length <= 1) {
      return NextResponse.json({ error: 'Keine Felder zum Aktualisieren' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ API PATCH:', error);
    return NextResponse.json(
      { error: 'Fehler beim Speichern', message: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}
