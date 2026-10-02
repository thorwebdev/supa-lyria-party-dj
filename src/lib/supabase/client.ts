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

let clientInstance: ReturnType<typeof createSupabaseClient> | null = null;

export const createClient = () => {
  if (typeof window !== 'undefined' && clientInstance) {
    return clientInstance;
  }

  if (!isSupabaseConfigured()) {
    // Return dummy client if not configured; API routes and hooks fall back gracefully
    const mockClient = createSupabaseClient('https://mock.supabase.co', 'mock-anon-key', {
      auth: { persistSession: false },
    });
    if (typeof window !== 'undefined') clientInstance = mockClient;
    return mockClient;
  }

  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  if (typeof window !== 'undefined') clientInstance = client;
  return client;
};
