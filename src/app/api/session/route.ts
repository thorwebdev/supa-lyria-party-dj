import { NextResponse } from 'next/server';
import { dbGetActiveSession, dbGetSongRequests } from '@/lib/supabase/admin';
import { isPaymentsEnabled } from '@/lib/stripe/server';

export async function GET() {
  try {
    const session = await dbGetActiveSession();
    const requests = await dbGetSongRequests(session.id);

    return NextResponse.json({
      session,
      requests,
      paymentsEnabled: isPaymentsEnabled(),
    });
  } catch (err: unknown) {
    console.error('Failed to load session:', err);
    return NextResponse.json({ error: 'Failed to load party session' }, { status: 500 });
  }
}
