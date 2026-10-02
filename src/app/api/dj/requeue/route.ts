import { NextResponse } from 'next/server';
import { dbGetSongRequest, dbUpdateSongRequest, dbGetSongRequests } from '@/lib/supabase/admin';

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
    const { trackId } = await req.json();
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    const songReq = await dbGetSongRequest(trackId);
    if (!songReq) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Determine next queue position
    const allRequests = await dbGetSongRequests(songReq.session_id);
    const readyTracks = allRequests.filter((r) => r.status === 'ready' && r.id !== trackId);
    const nextPosition = readyTracks.length + 1;

    // Reset status back to 'ready' to re-enter play queue
    const updated = await dbUpdateSongRequest(trackId, {
      status: 'ready',
      queue_position: nextPosition,
      error_message: null,
    });

    return NextResponse.json({ success: true, track: updated });
  } catch (err: unknown) {
    console.error('Re-queue track error:', err);
    return NextResponse.json({ error: 'Server error re-queuing track' }, { status: 500 });
  }
}
