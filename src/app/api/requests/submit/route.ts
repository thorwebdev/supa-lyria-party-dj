import { NextResponse } from 'next/server';
import { dbGetActiveSession, dbInsertSongRequest } from '@/lib/supabase/admin';
import { isPaymentsEnabled, createPaymentHold } from '@/lib/stripe/server';
import { SongRequest, VoicePersonaId } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userName,
      userAvatarUrl,
      prompt,
      genres = [],
      greetingText,
      voicePersona = 'hype_mc',
      donationAmountCents = 0,
      userId = null,
    } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Song prompt is required' }, { status: 400 });
    }

    if (!greetingText || typeof greetingText !== 'string' || greetingText.trim().length === 0) {
      return NextResponse.json({ error: 'Greeting / shoutout text is required' }, { status: 400 });
    }

    const session = await dbGetActiveSession();
    const paymentsActive = isPaymentsEnabled();

    let clientSecret: string | null = null;
    let paymentIntentId: string | null = null;

    const actualDonation = paymentsActive ? Math.max(0, parseInt(donationAmountCents, 10) || 0) : 0;

    if (paymentsActive && actualDonation > 0) {
      const hold = await createPaymentHold(actualDonation, {
        userName: userName || 'Guest',
        prompt: prompt.slice(0, 200),
      });
      clientSecret = hold.clientSecret;
      paymentIntentId = hold.paymentIntentId;
    }

    const songReq: SongRequest = {
      id: crypto.randomUUID(),
      session_id: session.id,
      user_id: userId,
      user_name: userName?.trim() || 'Anonymous Raver',
      user_avatar_url: userAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName || 'Raver')}`,
      prompt: prompt.trim(),
      genres: Array.isArray(genres) ? genres : [],
      greeting_text: greetingText.trim(),
      voice_persona: voicePersona as VoicePersonaId,
      donation_amount_cents: actualDonation,
      stripe_payment_intent_id: paymentIntentId,
      status: 'pending_approval',
      created_at: new Date().toISOString(),
    };

    const inserted = await dbInsertSongRequest(songReq);

    return NextResponse.json({
      request: inserted,
      clientSecret,
      paymentsActive,
    });
  } catch (err: unknown) {
    console.error('Request submission failed:', err);
    return NextResponse.json({ error: 'Failed to submit song request' }, { status: 500 });
  }
}
