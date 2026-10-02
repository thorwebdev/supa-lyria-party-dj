'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getStripeClient } from '@/lib/stripe/client';
import { type Stripe, type StripeElements } from '@stripe/stripe-js';
import { ShieldCheck, X, AlertCircle, Loader2, Sparkles, CreditCard, Lock } from 'lucide-react';

interface PaymentHoldModalProps {
  isOpen: boolean;
  amountCents: number;
  userName: string;
  prompt: string;
  onSuccess: (paymentIntentId: string) => Promise<void> | void;
  onClose: () => void;
}

export function PaymentHoldModal({
  isOpen,
  amountCents,
  userName,
  prompt,
  onSuccess,
  onClose,
}: PaymentHoldModalProps) {
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [loadingElements, setLoadingElements] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  const paymentElementContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);

  // Initialize Payment Intent hold when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    const initHold = async () => {
      setLoadingIntent(true);
      setErrorMessage(null);

      try {
        const res = await fetch('/api/payments/create-hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountCents,
            userName,
            prompt,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to initialize payment hold');
        }

        const data = await res.json();
        if (isCancelled) return;

        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setIsMock(Boolean(data.isMock));
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('Error creating payment hold:', err);
          setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to payment server');
        }
      } finally {
        if (!isCancelled) {
          setLoadingIntent(false);
        }
      }
    };

    initHold();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, amountCents, userName, prompt]);

  // Mount Stripe Elements when clientSecret is ready
  useEffect(() => {
    if (!isOpen || !clientSecret || isMock || !paymentElementContainerRef.current) {
      return;
    }

    let destroyed = false;

    const mountStripe = async () => {
      setLoadingElements(true);
      try {
        const stripe = await getStripeClient();
        if (!stripe) {
          throw new Error('Stripe publishable key is not configured');
        }
        stripeRef.current = stripe;

        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#00F5D4',
              colorBackground: '#0b101b',
              colorText: '#F8FAFC',
              colorDanger: '#FF007F',
              fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
              borderRadius: '10px',
              spacingUnit: '4px',
            },
            rules: {
              '.Input': {
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: 'none',
              },
              '.Input:focus': {
                border: '1px solid #00F5D4',
                boxShadow: '0 0 10px rgba(0, 245, 212, 0.3)',
              },
              '.Label': {
                color: '#94A3B8',
                fontWeight: '500',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              },
              '.Tab': {
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              },
              '.Tab--selected': {
                borderColor: '#00F5D4',
                backgroundColor: 'rgba(0, 245, 212, 0.08)',
              },
            },
          },
        });
        elementsRef.current = elements;

        const paymentElement = elements.create('payment', {
          layout: 'tabs',
        });

        if (paymentElementContainerRef.current && !destroyed) {
          paymentElementContainerRef.current.innerHTML = '';
          paymentElement.mount(paymentElementContainerRef.current);

          paymentElement.on('ready', () => {
            if (!destroyed) setLoadingElements(false);
          });

          paymentElement.on('change', (event) => {
            if (event.complete) {
              setErrorMessage(null);
            }
          });
        }
      } catch (err: unknown) {
        if (!destroyed) {
          console.error('Failed to mount Stripe Elements:', err);
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load payment form');
          setLoadingElements(false);
        }
      }
    };

    mountStripe();

    return () => {
      destroyed = true;
      if (elementsRef.current) {
        elementsRef.current = null;
      }
    };
  }, [isOpen, clientSecret, isMock]);

  // Handle confirmation
  const handleAuthorize = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      // In mock mode, simulate immediate pre-auth hold confirmation
      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await onSuccess(paymentIntentId || 'pi_mock_authorized');
        return;
      }

      const stripe = stripeRef.current;
      const elements = elementsRef.current;

      if (!stripe || !elements || !clientSecret) {
        throw new Error('Payment components not initialized');
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        setErrorMessage(error.message || 'Payment pre-authorization failed. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Check for valid held status
      if (
        paymentIntent &&
        (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')
      ) {
        await onSuccess(paymentIntent.id);
      } else {
        throw new Error(`Unexpected payment authorization status: ${paymentIntent?.status}`);
      }
    } catch (err: unknown) {
      console.error('Authorize error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Payment authorization failed');
      setIsProcessing(false);
    }
  };

  // Handle user cancelling out of the modal
  const handleCancel = async () => {
    if (paymentIntentId && !isMock) {
      try {
        fetch('/api/payments/cancel-hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId }),
        }).catch(() => {});
      } catch {}
    }
    setClientSecret(null);
    setPaymentIntentId(null);
    setErrorMessage(null);
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg cyber-card-glow rounded-2xl p-6 sm:p-7 shadow-[0_0_60px_rgba(0,245,212,0.2)] border border-[#00F5D4]/40 hud-corners-turquoise overflow-hidden">
        {/* Glow ambient background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00F5D4]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#FF007F]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00F5D4]/10 border border-[#00F5D4]/30 flex items-center justify-center text-[#00F5D4] shadow-[0_0_15px_rgba(0,245,212,0.3)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="payment-modal-title" className="text-lg font-black tracking-wide text-white font-mono flex items-center gap-2">
                DJ TIP PRE-AUTHORIZATION
              </h3>
              <p className="text-xs text-slate-400">
                Hold placed on card • Charged <span className="text-[#00F5D4] font-semibold">ONLY</span> if DJ accepts
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isProcessing}
            aria-label="Close payment modal"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Request Details Pill */}
        <div className="my-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between relative z-10">
          <div className="overflow-hidden pr-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#00F5D4]" />
              Song Request
            </div>
            <p className="text-sm font-medium text-slate-200 truncate mt-0.5">
              &quot;{prompt}&quot;
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              Hold Amount
            </div>
            <div className="text-xl font-black text-[#00F5D4] font-mono tracking-tight drop-shadow-[0_0_8px_rgba(0,245,212,0.5)]">
              ${(amountCents / 100).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Explanatory Banner */}
        <div className="mb-4 p-3 rounded-lg bg-[#00F5D4]/10 border border-[#00F5D4]/25 text-xs text-[#00F5D4] flex items-center gap-2.5 relative z-10">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            <strong>Zero risk:</strong> Your payment method is authorized, but funds are <strong>never charged</strong> if the DJ declines or skips the track.
          </span>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2 relative z-10 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Loading Spinner for Intent */}
        {loadingIntent && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 relative z-10">
            <Loader2 className="w-8 h-8 animate-spin text-[#00F5D4]" />
            <span className="text-xs font-mono uppercase tracking-wider">Securing authorization tunnel...</span>
          </div>
        )}

        {/* Mock Mode Notice */}
        {!loadingIntent && isMock && (
          <div className="mb-4 p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 text-xs text-purple-200 relative z-10">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-purple-300 mb-1">
              <CreditCard className="w-4 h-4" />
              Sandbox / Mock Stripe Mode
            </div>
            <p className="text-purple-300/80 leading-relaxed">
              No live Stripe credentials configured. Click below to simulate a successful pre-authorization hold test!
            </p>
          </div>
        )}

        {/* Stripe Elements Container */}
        {!loadingIntent && !isMock && (
          <div className="relative z-10 my-2 min-h-[160px]">
            {loadingElements && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 bg-[#07090e]/80 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin text-[#00F5D4]" />
                <span className="text-[11px] font-mono tracking-wider text-slate-400">Loading secure payment portal...</span>
              </div>
            )}
            <div ref={paymentElementContainerRef} id="payment-element" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-end gap-3 relative z-10">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAuthorize}
            disabled={loadingIntent || loadingElements || isProcessing}
            className="px-6 py-2.5 rounded-xl font-bold font-mono text-xs uppercase tracking-wider text-black bg-[#00F5D4] hover:bg-[#00F5D4]/90 shadow-[0_0_20px_rgba(0,245,212,0.4)] hover:shadow-[0_0_25px_rgba(0,245,212,0.6)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authorizing Hold...
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                Authorize ${(amountCents / 100).toFixed(2)} Hold
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
