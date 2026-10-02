import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

export const isPaymentsEnabled = () => {
  const envFlag = process.env.NEXT_PUBLIC_ENABLE_PAYMENTS || process.env.ENABLE_PAYMENTS;
  if (envFlag === 'false' || envFlag === '0') {
    return false;
  }
  return true;
};

export const isStripeConfigured = () => {
  return (
    isPaymentsEnabled() &&
    !!stripeSecretKey &&
    !stripeSecretKey.includes('placeholder') &&
    stripeSecretKey.startsWith('sk_')
  );
};

export const getStripe = () => {
  if (!isStripeConfigured()) return null;
  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia' as unknown as Stripe.LatestApiVersion,
  });
};

/**
 * Creates a pre-authorization hold on the customer's card / Apple Pay / Google Pay.
 * Funds are NOT captured until DJ approves and AI generation succeeds.
 */
export async function createPaymentHold(
  amountCents: number,
  metadata: Record<string, string>
): Promise<{ clientSecret: string | null; paymentIntentId: string | null }> {
  if (!isPaymentsEnabled()) {
    return { clientSecret: null, paymentIntentId: null };
  }

  const stripe = getStripe();
  if (!stripe) {
    // Return mock payment intent for testing
    const mockId = `pi_mock_${Date.now()}`;
    return {
      clientSecret: `${mockId}_secret_test`,
      paymentIntentId: mockId,
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.max(50, amountCents), // Stripe minimum is $0.50
      currency: 'usd',
      capture_method: 'manual', // Hold funds until approved & generated
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (err) {
    console.error('Failed to create Stripe PaymentIntent hold:', err);
    throw err;
  }
}

/**
 * Capture pre-authorized funds once AI generation succeeds
 */
export async function capturePaymentHold(paymentIntentId: string): Promise<boolean> {
  if (!paymentIntentId || paymentIntentId.startsWith('pi_mock_')) {
    return true;
  }

  const stripe = getStripe();
  if (!stripe) return true;

  try {
    const captured = await stripe.paymentIntents.capture(paymentIntentId);
    return captured.status === 'succeeded';
  } catch (err) {
    console.error(`Failed to capture PaymentIntent ${paymentIntentId}:`, err);
    return false;
  }
}

/**
 * Release/cancel pre-authorized hold when DJ declines or generation fails
 */
export async function cancelPaymentHold(paymentIntentId: string): Promise<boolean> {
  if (!paymentIntentId || paymentIntentId.startsWith('pi_mock_')) {
    return true;
  }

  const stripe = getStripe();
  if (!stripe) return true;

  try {
    const cancelled = await stripe.paymentIntents.cancel(paymentIntentId);
    return cancelled.status === 'canceled';
  } catch (err) {
    console.error(`Failed to cancel PaymentIntent ${paymentIntentId}:`, err);
    return false;
  }
}

/**
 * Verify that a pre-authorization hold is active and in 'requires_capture' state
 */
export async function verifyPaymentHold(paymentIntentId: string): Promise<boolean> {
  if (!paymentIntentId) return false;
  if (paymentIntentId.startsWith('pi_mock_')) {
    return true;
  }

  const stripe = getStripe();
  if (!stripe) return true;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded';
  } catch (err) {
    console.error(`Failed to verify PaymentIntent ${paymentIntentId}:`, err);
    return false;
  }
}

