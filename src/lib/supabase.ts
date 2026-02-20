import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt!');
  throw new Error('NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt');
}

if (!supabaseAnonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt!');
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt');
}

// Prüfe ob der Anon Key das neue Format hat
if (!supabaseAnonKey.startsWith('sb_publishable_') && !supabaseAnonKey.startsWith('eyJ')) {
  console.warn('⚠️ ANON Key hat möglicherweise ein unerwartetes Format');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Clerk übernimmt die Auth
    autoRefreshToken: false,
  },
})
