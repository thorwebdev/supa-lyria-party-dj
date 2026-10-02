'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, ExternalLink, QrCode, Maximize2, Sparkles, Smartphone } from 'lucide-react';

interface QRCodeStationProps {
  partyTitle?: string;
  className?: string;
  onOpenProjector?: () => void;
}

export const QRCodeStation: React.FC<QRCodeStationProps> = ({
  partyTitle = 'Live Party Stage',
  className = '',
  onOpenProjector,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [partyUrl, setPartyUrl] = useState<string>(() =>
    typeof window !== 'undefined' ? `${window.location.origin}/` : ''
  );
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/`;

      QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#00F5D4',
          light: '#07090E',
        },
      })
        .then((dataUri) => {
          if (isMounted) {
            setPartyUrl(url);
            setQrUrl(dataUri);
          }
        })
        .catch(console.error);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const copyToClipboard = async () => {
    try {
      if (partyUrl) {
        await navigator.clipboard.writeText(partyUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch (err) {
      console.error('Failed to copy party link:', err);
    }
  };

  return (
    <div
      className={`relative cyber-card rounded-3xl p-5 border border-cyan-500/25 shadow-[0_0_35px_rgba(0,240,255,0.08)] flex flex-col items-center text-center overflow-hidden ${className}`}
    >
      {/* Decorative top aura */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-20 bg-cyan-500/15 blur-3xl pointer-events-none rounded-full" />

      {/* Header section with live status badge */}
      <div className="w-full flex items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-left">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.25)]">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                AUDIENCE PORTAL
              </h3>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">ALWAYS VISIBLE BOOTH STATION</p>
          </div>
        </div>

        {onOpenProjector && (
          <button
            onClick={onOpenProjector}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] transition shadow-[0_0_10px_rgba(0,240,255,0.15)]"
            title="Expand to Fullscreen Stage Projector"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PROJECTOR</span>
          </button>
        )}
      </div>

      {/* Scannable QR Code Frame */}
      <div className="relative group my-1">
        {/* Glowing HUD reticles */}
        <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-teal-400/20 via-pink-500/20 to-cyan-400/20 blur-md opacity-60 group-hover:opacity-100 transition duration-500 pointer-events-none" />

        <div className="relative p-3.5 rounded-2xl bg-[#07090E] border-2 border-teal-400/40 shadow-[0_0_30px_rgba(0,245,212,0.2)] transition duration-300 group-hover:border-teal-300 group-hover:shadow-[0_0_40px_rgba(0,245,212,0.35)]">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="Audience Scan QR Code"
              className="w-48 h-48 md:w-52 md:h-52 object-contain rounded-lg"
            />
          ) : (
            <div className="w-48 h-48 md:w-52 md:h-52 flex flex-col items-center justify-center gap-2 bg-[#0B0D13] rounded-lg text-zinc-500 font-mono text-xs">
              <QrCode className="w-8 h-8 animate-pulse text-teal-400" />
              <span>GENERATING QR...</span>
            </div>
          )}

          {/* Center Scan Badge */}
          <div className="absolute inset-x-0 -bottom-3 flex justify-center">
            <span className="px-3 py-0.5 rounded-full bg-[#080A10] border border-teal-400/50 text-teal-300 text-[10px] font-mono tracking-wider font-semibold shadow-md flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-teal-400" />
              SCAN WITH PHONE
            </span>
          </div>
        </div>
      </div>

      {/* Subtext and Instructions */}
      <div className="mt-4 mb-3">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
          {partyTitle}
        </h4>
        <p className="text-[11px] text-zinc-400 font-mono mt-0.5 max-w-[240px]">
          Crowd can scan to submit custom AI music prompts &amp; MC greetings
        </p>
      </div>

      {/* Quick Action Buttons */}
      <div className="w-full flex flex-col gap-2 mt-auto">
        <button
          onClick={copyToClipboard}
          className={`w-full py-2.5 px-3 rounded-xl border text-xs font-mono font-semibold flex items-center justify-center gap-2 transition ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-200 border-zinc-700/80 hover:border-teal-400/40'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>PARTY LINK COPIED!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-teal-400" />
              <span>COPY VENUE LINK</span>
            </>
          )}
        </button>

        <a
          href={partyUrl || '/'}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 font-mono text-[11px] flex items-center justify-center gap-1.5 transition shadow-[0_0_10px_rgba(255,0,127,0.15)]"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>TEST GUEST APP</span>
        </a>
      </div>

      {/* Mini Feature Ticker */}
      <div className="mt-3 pt-2 w-full border-t border-white/5 flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-500">
        <Sparkles className="w-3 h-3 text-pink-400" />
        <span>Powered by Lyria 3.5 &amp; Gemini TTS</span>
      </div>
    </div>
  );
};
