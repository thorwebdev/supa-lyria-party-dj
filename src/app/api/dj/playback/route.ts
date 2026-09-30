import { NextResponse } from 'next/server';
import { dbUpdateSession, dbUpdateSongRequest, dbGetActiveSession } from '@/lib/supabase/admin';

const DJ_SECRET_PIN = process.env.DJ_SECRET_PIN || '4242';

function isAuthorizedDJ(req: Request): boolean {
  const pinHeader = req.headers.get('x-dj-pin');
  if (pinHeader && pinHeader === DJ_SECRET_PIN) return true;

  const cookieHeader = req.headers.get('cookie') || '';
  if (cookieHeader.includes('dj_authorized=true')) return true;

  return false;
}

export async function POST(req: Request) {
  if (!isAuthorizedDJ(req)) {
    return NextResponse.json({ error: 'Unauthorized DJ action' }, { status: 401 });
  }

  try {
    const { action, trackId } = await req.json();
    const session = await dbGetActiveSession();

    if (action === 'start') {
      if (!trackId) {
        return NextResponse.json({ error: 'trackId is required to start playback' }, { status: 400 });
      }

      // If there was an old playing track, mark it played
      if (session.current_track_id && session.current_track_id !== trackId) {
        await dbUpdateSongRequest(session.current_track_id, {
          status: 'played',
          played_at: new Date().toISOString(),
        });
      }

      await dbUpdateSongRequest(trackId, {
        status: 'playing',
        played_at: new Date().toISOString(),
      });

      await dbUpdateSession(session.id, {
        current_track_id: trackId,
      });

      return NextResponse.json({ success: true, current_track_id: trackId });
    }

    if (action === 'finish') {
      if (session.current_track_id) {
        await dbUpdateSongRequest(session.current_track_id, {
          status: 'played',
          played_at: new Date().toISOString(),
        });
        await dbUpdateSession(session.id, {
          current_track_id: null,
        });
      }
      return NextResponse.json({ success: true, current_track_id: null });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Playback state endpoint error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
