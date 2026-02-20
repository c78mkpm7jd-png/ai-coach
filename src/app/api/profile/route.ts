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
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: body.id ?? userId,
      goal: body.goal,
      age: body.age,
      gender: body.gender,
      height: body.height,
      weight: body.weight,
      activity_level: body.activity_level,
      training_days_per_week: body.training_days_per_week,
      updated_at: (body.updated_at as string) || new Date().toISOString(),
    }, {
      onConflict: 'id'
    });

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
