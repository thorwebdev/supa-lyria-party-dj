import { NextResponse } from 'next/server';
import { createPaymentHold, isPaymentsEnabled } from '@/lib/stripe/server';

export async function POST(req: Request) {
  try {
    if (!isPaymentsEnabled()) {
      return NextResponse.json({ error: 'Payments are not enabled' }, { status: 400 });
    }

    const body = await req.json();
    const { amountCents, userName, prompt } = body;

    const donation = parseInt(amountCents, 10);
    if (isNaN(donation) || donation <= 0) {
      return NextResponse.json({ error: 'Invalid donation amount' }, { status: 400 });
    }

    const { clientSecret, paymentIntentId } = await createPaymentHold(donation, {
      userName: (userName || 'Anonymous Raver').slice(0, 50),
      prompt: (prompt || '').slice(0, 200),
    });

    const isMock = !paymentIntentId || paymentIntentId.startsWith('pi_mock_');

    return NextResponse.json({
      clientSecret,
      paymentIntentId,
      isMock,
    });
  } catch (err: unknown) {
    console.error('Failed to create payment hold:', err);
    return NextResponse.json({ error: 'Could not initialize payment hold' }, { status: 500 });
  }
}
