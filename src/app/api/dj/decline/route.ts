import { NextResponse } from 'next/server';
import { dbGetSongRequest, dbUpdateSongRequest } from '@/lib/supabase/admin';
import { cancelPaymentHold } from '@/lib/stripe/server';

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
    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    const songReq = await dbGetSongRequest(requestId);
    if (!songReq) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Cancel Stripe payment authorization immediately
    if (songReq.stripe_payment_intent_id) {
      await cancelPaymentHold(songReq.stripe_payment_intent_id);
    }

    const updated = await dbUpdateSongRequest(requestId, {
      status: 'declined',
    });

    return NextResponse.json({ success: true, track: updated });
  } catch (err: unknown) {
    console.error('Decline endpoint error:', err);
    return NextResponse.json({ error: 'Server error processing decline' }, { status: 500 });
  }
}
