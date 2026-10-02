import { NextResponse } from 'next/server';
import { cancelPaymentHold, isPaymentsEnabled } from '@/lib/stripe/server';

export async function POST(req: Request) {
  try {
    if (!isPaymentsEnabled()) {
      return NextResponse.json({ success: true });
    }

    const { paymentIntentId } = await req.json();
    if (paymentIntentId) {
      await cancelPaymentHold(paymentIntentId);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Failed to cancel payment hold:', err);
    return NextResponse.json({ error: 'Failed to cancel hold' }, { status: 500 });
  }
}
