'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Sparkles, Radio, Smartphone, Disc, Volume2 } from 'lucide-react';
import { SongRequest, VOICE_PERSONAS } from '@/types';
import { CyberVisualizer } from '@/components/CyberVisualizer';

interface StageProjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyTitle: string;
  currentTrack: SongRequest | null;
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export const StageProjectorModal: React.FC<StageProjectorModalProps> = ({
  isOpen,
  onClose,
  partyTitle,
  currentTrack,
  analyser,
  isPlaying,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [partyUrl, setPartyUrl] = useState<string>(() =>
    typeof window !== 'undefined' ? `${window.location.origin}/` : ''
  );

  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined' && isOpen) {
      const url = `${window.location.origin}/`;

      QRCode.toDataURL(url, {
        width: 500,
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
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#080A10]/95 backdrop-blur-2xl flex flex-col p-6 md:p-10 animate-in fade-in duration-300">
      {/* Background ambient neon glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Top stage header */}
      <header className="relative z-10 flex items-center justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 via-cyan-400 to-pink-500 flex items-center justify-center text-black font-bold shadow-[0_0_20px_rgba(0,245,212,0.4)]">
            <Disc className="w-6 h-6 animate-spin text-black" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
              <h1 className="text-xl md:text-2xl font-bold font-mono tracking-tight text-white">
                {partyTitle}
              </h1>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              COLLABORATIVE AI PARTY // POWERED BY GOOGLE LYRIA 3.5 &amp; GEMINI TTS
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-3 text-zinc-400 hover:text-white rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
          title="Exit Projector Mode (Esc)"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      {/* Main projection content */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-6">
        {/* Left: Huge Now Playing Stage Display */}
        <div className="lg:col-span-7 flex flex-col justify-center gap-6">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest bg-teal-400/20 text-teal-300 border border-teal-400/40 animate-pulse">
              ● NOW PLAYING ON VENUE SOUNDSYSTEM
            </span>
            {currentTrack?.voice_persona && (
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-pink-500/20 text-pink-300 border border-pink-500/40">
                VOICE: {VOICE_PERSONAS[currentTrack.voice_persona]?.name}
              </span>
            )}
          </div>

          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight font-display">
            {currentTrack ? currentTrack.prompt : 'Drop Your Custom Song Prompt!'}
          </h2>

          {currentTrack?.greeting_text && (
            <div className="p-5 rounded-2xl bg-black/60 border border-teal-400/30 shadow-[0_0_30px_rgba(0,245,212,0.15)] flex items-start gap-4">
              <Radio className="w-6 h-6 text-teal-400 shrink-0 mt-1" />
              <div>
                <p className="text-xs font-mono text-teal-400 font-bold uppercase tracking-wider mb-1">
                  OFFICIAL DJ SHOUTOUT
                </p>
                <p className="text-lg md:text-xl text-zinc-100 font-medium italic">
                  &quot;{currentTrack.greeting_text}&quot;
                </p>
              </div>
            </div>
          )}

          {currentTrack && (
            <div className="flex items-center gap-3 text-sm text-zinc-400 font-mono">
              <img
                src={currentTrack.user_avatar_url || ''}
                alt={currentTrack.user_name}
                className="w-8 h-8 rounded-full border border-teal-400/50"
              />
              <span>
                Requested by <strong className="text-white">{currentTrack.user_name}</strong>
              </span>
            </div>
          )}

          {/* Large Live Audio Visualizer */}
          <div className="h-44 md:h-56 w-full rounded-2xl overflow-hidden border border-teal-400/30 shadow-[0_0_35px_rgba(0,245,212,0.15)]">
            <CyberVisualizer analyser={analyser} isPlaying={isPlaying} mode="bars" className="w-full h-full" />
          </div>
        </div>

        {/* Right: Giant QR Code Station for Crowd Scanning */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative p-8 rounded-3xl bg-[#0D101A]/90 border-2 border-teal-400/50 shadow-[0_0_60px_rgba(0,245,212,0.25)] flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-4 text-teal-300">
              <Smartphone className="w-6 h-6 text-teal-400 animate-bounce" />
              <span className="text-lg font-mono font-bold tracking-widest uppercase">
                SCAN WITH PHONE CAMERA
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#07090E] border-2 border-teal-400 shadow-[0_0_30px_rgba(0,245,212,0.4)]">
              {qrUrl ? (
                <img src={qrUrl} alt="Stage QR Code" className="w-72 h-72 md:w-80 md:h-80 object-contain rounded-xl" />
              ) : (
                <div className="w-72 h-72 flex items-center justify-center text-teal-400 font-mono">
                  Loading QR...
                </div>
              )}
            </div>

            <div className="mt-5 text-center">
              <p className="text-base font-bold text-white font-mono">{partyUrl}</p>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                Pick music styles, write personal greetings, &amp; hear your song on the main stage
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer ticker */}
      <footer className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>Real-time Neural Audio Synthesis with Google Lyria 3.5</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <Volume2 className="w-4 h-4 text-pink-400" />
          <span>Press ESC to exit projector mode</span>
        </div>
      </footer>
    </div>
  );
};
