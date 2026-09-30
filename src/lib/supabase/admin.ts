import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './client';
import { mockPartyStore } from './mock-store';
import { SongRequest, EventSession } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isServerSupabaseConfigured = () => {
  return (
    isSupabaseConfigured() &&
    !!serviceRoleKey &&
    !serviceRoleKey.includes('placeholder')
  );
};

export const getAdminClient = () => {
  if (!isServerSupabaseConfigured()) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

/**
 * Data layer abstraction that automatically uses Supabase when configured,
 * and seamlessly falls back to the in-memory store in local dev/demo mode.
 */
export async function dbGetActiveSession(): Promise<EventSession> {
  const supabase = getAdminClient();
  if (!supabase) {
    return mockPartyStore.getSession();
  }

  const { data, error } = await supabase
    .from('event_sessions')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return mockPartyStore.getSession();
  }

  return data as EventSession;
}

export async function dbGetSongRequests(sessionId?: string): Promise<SongRequest[]> {
  const supabase = getAdminClient();
  if (!supabase) {
    return mockPartyStore.getRequests();
  }

  let query = supabase.from('song_requests').select('*');
  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error || !data) {
    return mockPartyStore.getRequests();
  }

  return data as SongRequest[];
}

export async function dbGetSongRequest(id: string): Promise<SongRequest | null> {
  const supabase = getAdminClient();
  if (!supabase) {
    return mockPartyStore.getRequest(id) || null;
  }

  const { data, error } = await supabase
    .from('song_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return mockPartyStore.getRequest(id) || null;
  }

  return data as SongRequest;
}

export async function dbInsertSongRequest(req: SongRequest): Promise<SongRequest> {
  const supabase = getAdminClient();
  if (!supabase) {
    return mockPartyStore.insertRequest(req);
  }

  const { data, error } = await supabase
    .from('song_requests')
    .insert([req])
    .select()
    .single();

  if (error || !data) {
    console.warn('Supabase insert failed, falling back to local store:', error);
    return mockPartyStore.insertRequest(req);
  }

  return data as SongRequest;
}

export async function dbUpdateSongRequest(
  id: string,
  updates: Partial<SongRequest>
): Promise<SongRequest | null> {
  const supabase = getAdminClient();
  if (!supabase) {
    return mockPartyStore.updateRequest(id, updates) || null;
  }

  const { data, error } = await supabase
    .from('song_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.warn('Supabase update failed, falling back to local store:', error);
    return mockPartyStore.updateRequest(id, updates) || null;
  }

  return data as SongRequest;
}

export async function dbUpdateSession(
  id: string,
  updates: Partial<EventSession>
): Promise<EventSession | null> {
  const supabase = getAdminClient();
  if (!supabase) {
    return mockPartyStore.updateSession(updates);
  }

  const { data, error } = await supabase
    .from('event_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return mockPartyStore.updateSession(updates);
  }

  return data as EventSession;
}

export async function uploadAudioToStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string = 'audio/mpeg'
): Promise<string | null> {
  const supabase = getAdminClient();
  if (!supabase) {
    // Return base64 data URI in demo mode
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }

  const { error } = await supabase.storage
    .from('tracks')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('Storage upload error:', error);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }

  const { data: publicUrlData } = supabase.storage
    .from('tracks')
    .getPublicUrl(storagePath);

  return publicUrlData.publicUrl;
}
