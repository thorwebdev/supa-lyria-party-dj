'use client';

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Music,
  Radio,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  Flame,
  Volume2,
  ShieldCheck,
  Disc,
} from 'lucide-react';
import {
  SongRequest,
  EventSession,
  GENRE_PRESETS,
  VOICE_PERSONAS,
  VoicePersonaId,
} from '@/types';
import { CyberVisualizer } from '@/components/CyberVisualizer';

export default function AudiencePage() {
  const [, setSession] = useState<EventSession | null>(null);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SongRequest | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);

  // Form State with lazy initializers
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('party_dj_username') || '';
    }
    return '';
  });
  const [prompt, setPrompt] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [greetingText, setGreetingText] = useState('');
  const [voicePersona, setVoicePersona] = useState<VoicePersonaId>('hype_mc');
  const [donationCents, setDonationCents] = useState(200);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'request' | 'my-requests'>('request');

  // Track user's own submitted IDs in localStorage
  const [myRequestIds, setMyRequestIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('party_dj_my_requests');
        return saved ? JSON.parse(saved) : [];
      } catch {}
    }
    return [];
  });

  // Fetch party state periodically
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setRequests(data.requests || []);
        setPaymentsEnabled(data.paymentsEnabled);

        if (data.session?.current_track_id) {
          const active = (data.requests as SongRequest[]).find(
            (r) => r.id === data.session.current_track_id
          );
          setCurrentTrack(active || null);
        } else {
          setCurrentTrack(null);
        }
      }
    } catch (err) {
      console.error('Failed to load audience state:', err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSession();
    }, 0);
    const interval = setInterval(fetchSession, 3000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchSession]);

  // Toggle Genre Preset Chip
  const toggleGenre = (label: string) => {
    if (selectedGenres.includes(label)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== label));
    } else {
      setSelectedGenres([...selectedGenres, label]);
    }
  };

  // Enhance prompt with Gemini
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);

    try {
      const res = await fetch('/api/requests/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, genres: selectedGenres }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.enhancedPrompt) {
          setPrompt(data.enhancedPrompt);
        }
      }
    } catch (err) {
      console.error('Enhancement failed:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Submit request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !greetingText.trim()) return;

    setIsSubmitting(true);

    try {
      if (userName.trim()) {
        localStorage.setItem('party_dj_username', userName.trim());
      }

      const res = await fetch('/api/requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: userName.trim() || 'Anonymous Raver',
          prompt: prompt.trim(),
          genres: selectedGenres,
          greetingText: greetingText.trim(),
          voicePersona,
          donationAmountCents: paymentsEnabled ? donationCents : 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newReq = data.request as SongRequest;

        // Trigger festival celebration confetti!
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00F0FF', '#FF007A', '#7000FF', '#39FF14'],
        });

        // Save to my requests
        const updatedIds = [newReq.id, ...myRequestIds];
        setMyRequestIds(updatedIds);
        localStorage.setItem('party_dj_my_requests', JSON.stringify(updatedIds));

        // Reset form
        setPrompt('');
        setGreetingText('');
        setSelectedGenres([]);
        setActiveTab('my-requests');
        fetchSession();
      } else {
        const data = await res.json();
        alert(`Submission error: ${data.error}`);
      }
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Network error, please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter requests for "My Requests"
  const myRequests = requests.filter((r) => myRequestIds.includes(r.id));
  const readyQueue = requests
    .filter((r) => r.status === 'ready')
    .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto p-4 md:p-6 pb-20">
      {/* Top Header */}
      <header className="flex items-center justify-between py-3 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            <Disc className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <h1 className="text-base font-bold font-mono tracking-tight text-white flex items-center gap-1.5">
              SUPA LYRIA DJ
            </h1>
            <p className="text-[10px] text-zinc-400 font-mono">
              COLLABORATIVE AI PARTY
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/dj"
            className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 transition"
          >
            DJ BOOTH ↗
          </a>
        </div>
      </header>

      {/* Hero Now Playing Banner */}
      <section className="mb-6 p-5 rounded-3xl bg-gradient-to-b from-[#131722]/90 to-[#0A0D14]/90 border border-cyan-500/30 shadow-[0_0_30px_rgba(0,240,255,0.12)] backdrop-blur-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
              NOW PLAYING ON STAGE
            </span>
          </div>
          {currentTrack && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              VOICE: {VOICE_PERSONAS[currentTrack.voice_persona]?.name}
            </span>
          )}
        </div>

        <h2 className="text-lg md:text-xl font-bold text-white mb-2 line-clamp-2">
          {currentTrack ? currentTrack.prompt : 'DJ dropping the next AI club mix...'}
        </h2>

        {currentTrack?.greeting_text && (
          <div className="p-2.5 mb-3 rounded-xl bg-black/40 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2">
            <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="italic">&quot;{currentTrack.greeting_text}&quot;</p>
          </div>
        )}

        {currentTrack && (
          <p className="text-[11px] text-zinc-400 font-mono mb-3">
            Requested by <span className="text-cyan-300 font-bold">{currentTrack.user_name}</span>
          </p>
        )}

        {/* Live Audio Visualizer */}
        <CyberVisualizer isPlaying={!!currentTrack} mode="bars" className="h-20" />

        {/* Up Next Ticker */}
        {readyQueue.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span className="text-zinc-500">UP NEXT:</span>
            <span className="text-zinc-200 truncate ml-2">
              #{readyQueue[0].queue_position} {readyQueue[0].prompt}
            </span>
          </div>
        )}
      </section>

      {/* Tabs: Request Song vs My Requests */}
      <div className="flex rounded-2xl bg-zinc-900/80 p-1 mb-5 border border-zinc-800">
        <button
          onClick={() => setActiveTab('request')}
          className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'request' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-zinc-400 hover:text-white'}`}
        >
          <Music className="w-3.5 h-3.5" />
          SUBMIT PROMPT
        </button>
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-xl transition flex items-center justify-center gap-2 ${activeTab === 'my-requests' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-zinc-400 hover:text-white'}`}
        >
          <Clock className="w-3.5 h-3.5" />
          MY REQUESTS ({myRequests.length})
        </button>
      </div>

      {/* TAB 1: Song Request Form */}
      {activeTab === 'request' ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Submitter Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              YOUR DJ SHOUTOUT NAME
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Alex Cyber or Sarah"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans text-sm transition"
            />
          </div>

          {/* Genre / Vibe Preset Chips */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              PICK VIBE & STYLE (TAP TO ADD)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_PRESETS.map((preset) => {
                const isSelected = selectedGenres.includes(preset.label);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => toggleGenre(preset.label)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition transform active:scale-95 ${isSelected ? 'bg-cyan-400 text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.5)] border border-cyan-300' : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/60'}`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Song Prompt Input with Enhance Button */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-cyan-400" />
                LYRIA 3.5 MUSIC PROMPT
              </label>
              <button
                type="button"
                disabled={isEnhancing || !prompt.trim()}
                onClick={handleEnhancePrompt}
                className="text-[11px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 disabled:opacity-40 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isEnhancing ? 'ENHANCING...' : 'ENHANCE WITH GEMINI'}
              </button>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the track... (e.g. Heavy acid synth lead, bouncy bassline, driving 130 BPM club anthem)"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans text-sm transition"
              required
            />
          </div>

          {/* Greeting Shoutout Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-rose-400" />
              GREETING SHOUTOUT (SPOKEN BY AI VOICE)
            </label>
            <input
              type="text"
              value={greetingText}
              onChange={(e) => setGreetingText(e.target.value)}
              placeholder="e.g. Happy 30th Birthday Sarah! Drop the beat!"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans text-sm transition"
              required
            />
          </div>

          {/* Voice Persona Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              SELECT DJ VOICE PERSONA
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(VOICE_PERSONAS).map((persona) => {
                const isSelected = voicePersona === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setVoicePersona(persona.id)}
                    className={`p-3 rounded-xl border text-left transition ${isSelected ? 'bg-purple-500/20 border-purple-400 shadow-[0_0_15px_rgba(112,0,255,0.3)]' : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'}`}
                  >
                    <p className={`text-xs font-bold font-mono ${isSelected ? 'text-purple-300' : 'text-zinc-200'}`}>
                      {persona.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 line-clamp-1">
                      {persona.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Donation / Pricing Section */}
          <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                DJ DONATION / TIP
              </label>

              {paymentsEnabled ? (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  HOLD ONLY // CHARGED ON APPROVAL
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  FREE PARTY MODE
                </span>
              )}
            </div>

            {paymentsEnabled ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {[200, 500, 1000, 2000].map((cents) => (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => setDonationCents(cents)}
                      className={`flex-1 py-2 rounded-xl font-mono text-xs font-bold transition ${donationCents === cents ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                    >
                      ${(cents / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Supports Apple Pay, Google Pay, and cards. You are never charged if the DJ declines.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 font-mono">
                Donations are currently disabled for this party! Song submissions are 100% free.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !prompt.trim() || !greetingText.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 text-black font-extrabold font-mono text-sm tracking-wider shadow-[0_0_30px_rgba(0,240,255,0.4)] disabled:opacity-40 transition transform active:scale-95 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2 font-mono text-white">
                <Disc className="w-5 h-5 animate-spin" />
                TRANSMITTING TO DJ BOOTH...
              </span>
            ) : (
              <>
                <Send className="w-4 h-4 fill-current" />
                SUBMIT SONG REQUEST {paymentsEnabled && `($${(donationCents / 100).toFixed(2)})`}
              </>
            )}
          </button>
        </form>
      ) : (
        /* TAB 2: My Requests Live Tracker */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono text-white">
              YOUR PARTY SUBMISSIONS
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              {myRequests.length} TOTAL
            </span>
          </div>

          {myRequests.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-black/30 border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs">
              NO REQUESTS SUBMITTED YET // TAP &quot;SUBMIT PROMPT&quot; TO JOIN THE QUEUE
            </div>
          ) : (
            myRequests.map((req) => {
              const statusConfig = {
                pending_approval: {
                  label: 'Pending DJ Review',
                  color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                  icon: Clock,
                  desc: 'Waiting for the DJ to approve your track in the booth.',
                },
                generating: {
                  label: 'Generating Audio (Lyria 3.5)',
                  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
                  icon: Disc,
                  desc: 'AI is composing your song and synthesizing the DJ voiceover!',
                },
                ready: {
                  label: `In Play Queue (#${req.queue_position || 'Next'})`,
                  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
                  icon: Music,
                  desc: 'Track generated! Waiting to drop on the dancefloor.',
                },
                playing: {
                  label: 'Now Dropping Live!',
                  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 animate-pulse',
                  icon: Flame,
                  desc: 'Your track is currently playing on the venue sound system!',
                },
                played: {
                  label: 'Played on Stage',
                  color: 'text-zinc-400 bg-zinc-800 border-zinc-700',
                  icon: CheckCircle2,
                  desc: 'Track successfully rocked the crowd tonight.',
                },
                declined: {
                  label: 'Declined (Hold Released)',
                  color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
                  icon: XCircle,
                  desc: 'DJ declined request. No charges were made.',
                },
                failed: {
                  label: 'Generation Error',
                  color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
                  icon: XCircle,
                  desc: 'Generation failed. Payment hold was released.',
                },
              }[req.status] || {
                label: req.status,
                color: 'text-zinc-400 bg-zinc-800 border-zinc-700',
                icon: Clock,
                desc: '',
              };

              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={req.id}
                  className="p-5 rounded-2xl bg-[#0F121A]/80 border border-zinc-800 hover:border-zinc-700 transition flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-mono border flex items-center gap-1.5 ${statusConfig.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig.label}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-white">&quot;{req.prompt}&quot;</p>
                  
                  {req.greeting_text && (
                    <p className="text-xs text-zinc-400 italic">
                      Shoutout: &quot;{req.greeting_text}&quot;
                    </p>
                  )}

                  <p className="text-xs text-zinc-400 font-mono mt-1">
                    {statusConfig.desc}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
