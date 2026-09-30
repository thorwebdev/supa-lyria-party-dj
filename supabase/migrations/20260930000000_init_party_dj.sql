-- Migration: Init Supa Lyria Party DJ
-- Description: Create event_sessions, song_requests tables, storage bucket, realtime publication, indexes, and RLS policies.

-- 1. Create event_sessions table
create table if not exists public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Main Stage Party',
  is_active boolean not null default true,
  min_donation_cents integer not null default 200,
  current_track_id uuid,
  created_at timestamptz not null default now()
);

-- 2. Create song_requests table
create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.event_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_name text not null,
  user_avatar_url text,
  prompt text not null,
  genres text[] not null default '{}',
  greeting_text text not null,
  voice_persona text not null default 'hype_mc',
  donation_amount_cents integer not null default 0,
  stripe_payment_intent_id text,
  status text not null default 'pending_approval' check (
    status in ('pending_approval', 'generating', 'ready', 'playing', 'played', 'declined', 'failed')
  ),
  music_storage_path text,
  greeting_storage_path text,
  music_url text,
  greeting_url text,
  lyrics text,
  duration_seconds integer default 30,
  queue_position integer,
  error_message text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  played_at timestamptz
);

-- Foreign key back to song_requests for current_track_id
alter table public.event_sessions 
  drop constraint if exists fk_event_sessions_current_track,
  add constraint fk_event_sessions_current_track foreign key (current_track_id) references public.song_requests(id) on delete set null;

-- 3. Indexes for high performance
create index if not exists idx_song_requests_session_status on public.song_requests(session_id, status);
create index if not exists idx_song_requests_queue_pos on public.song_requests(session_id, queue_position) where status = 'ready';
create index if not exists idx_song_requests_user_id on public.song_requests(user_id);
create index if not exists idx_song_requests_created_at on public.song_requests(created_at desc);

-- 4. Enable Row Level Security (RLS)
alter table public.event_sessions enable row level security;
alter table public.song_requests enable row level security;

-- RLS Policies for event_sessions
create policy "Allow public read access to active event sessions"
  on public.event_sessions
  for select
  to anon, authenticated
  using (true);

-- RLS Policies for song_requests
create policy "Allow public read access to song requests"
  on public.song_requests
  for select
  to anon, authenticated
  using (true);

create policy "Allow public insertion of song requests"
  on public.song_requests
  for insert
  to anon, authenticated
  with check (true);

-- 5. Storage bucket setup for audio tracks
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tracks', 'tracks', true, 52428800, array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav'];

-- Allow public read access to tracks bucket
create policy "Allow public read access to tracks"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'tracks');

-- Allow service role full access (default) and public upload if needed
create policy "Allow service role upload to tracks"
  on storage.objects
  for insert
  to service_role
  with check (bucket_id = 'tracks');

-- 6. Enable Realtime Replication
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_sessions') then
    alter publication supabase_realtime add table public.event_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'song_requests') then
    alter publication supabase_realtime add table public.song_requests;
  end if;
end $$;

-- 7. Insert default initial event session if none exists
insert into public.event_sessions (id, title, is_active, min_donation_cents)
values ('00000000-0000-0000-0000-000000000001', 'Neon Cyber Rave DJ Stage', true, 200)
on conflict (id) do nothing;
