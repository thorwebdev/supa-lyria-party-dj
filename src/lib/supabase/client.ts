import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return (
    !!supabaseUrl &&
    !supabaseUrl.includes('placeholder') &&
    !!supabaseAnonKey &&
    !supabaseAnonKey.includes('placeholder')
  );
};

export const createClient = () => {
  if (!isSupabaseConfigured()) {
    // Return dummy client if not configured; API routes and hooks fall back gracefully
    return createSupabaseClient('https://mock.supabase.co', 'mock-anon-key', {
      auth: { persistSession: false },
    });
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
};
