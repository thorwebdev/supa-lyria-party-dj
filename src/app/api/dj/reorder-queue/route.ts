import { NextResponse } from 'next/server';
import { dbUpdateSongRequest } from '@/lib/supabase/admin';

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
    const { orderedIds } = await req.json();
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        dbUpdateSongRequest(id, { queue_position: index + 1 })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Queue reorder error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
