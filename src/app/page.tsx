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
  ArrowRight,
  Headphones,
  Sliders,
} from 'lucide-react';
import {
  SongRequest,
  EventSession,
  GENRE_PRESETS,
  VOICE_PERSONAS,
  VoicePersonaId,
} from '@/types';
import { CyberVisualizer } from '@/components/CyberVisualizer';

import { createClient } from '@/lib/supabase/client';

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

  // Fetch party state
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

  // Supabase Realtime client subscription - 100% push-driven over WebSockets
  useEffect(() => {
    // Initial fetch once on mount
    const initialTimer = setTimeout(() => {
      fetchSession();
    }, 0);

    // Subscribe to Supabase Realtime for instant event-driven push updates
    const supabase = createClient();
    const channel = supabase
      .channel('audience-party-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'song_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReq = payload.new as SongRequest;
            setRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as SongRequest;
            setRequests((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setCurrentTrack((curr) => (curr?.id === updated.id ? updated : curr));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) {
              setRequests((prev) => prev.filter((r) => r.id !== oldId));
              setCurrentTrack((curr) => (curr?.id === oldId ? null : curr));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_sessions' },
        (payload) => {
          if (payload.new) {
            const updatedSession = payload.new as EventSession;
            setSession(updatedSession);
            if (updatedSession.current_track_id) {
              setRequests((prev) => {
                const active = prev.find((r) => r.id === updatedSession.current_track_id);
                if (active) setCurrentTrack(active);
                return prev;
              });
            } else {
              setCurrentTrack(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(initialTimer);
      supabase.removeChannel(channel);
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
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00F5D4', '#FF007F', '#00F0FF', '#FF1493'],
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
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto p-4 md:p-6 pb-24">
      {/* Top Header */}
      <header className="flex items-center justify-between py-3 mb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 via-cyan-400 to-pink-500 flex items-center justify-center text-black font-bold shadow-[0_0_20px_rgba(0,245,212,0.4)]">
              <Disc className="w-5 h-5 animate-spin text-black" style={{ animationDuration: '6s' }} />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#080A10] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold font-mono tracking-tight text-white">
                SUPA LYRIA DJ
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-400/15 border border-teal-400/30 text-teal-300 font-semibold">
                PARTY STAGE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              COLLABORATIVE NEURAL DANCEFLOOR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/dj"
            className="text-xs font-mono text-teal-300 hover:text-white px-3 py-1.5 rounded-xl bg-teal-400/10 border border-teal-400/30 shadow-[0_0_12px_rgba(0,245,212,0.15)] transition flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>DJ BOOTH</span>
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Hero Now Playing Banner */}
      <section className="mb-6 p-5 md:p-6 rounded-3xl cyber-card-glow border border-teal-400/30 relative overflow-hidden">
        {/* Glow orb */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-300">
              NOW DROPPING ON STAGE
            </span>
          </div>
          {currentTrack?.voice_persona && (
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
              VOICE: {VOICE_PERSONAS[currentTrack.voice_persona]?.name}
            </span>
          )}
        </div>

        <h2 className="text-lg md:text-xl font-bold text-white mb-2 line-clamp-2 font-display leading-snug">
          {currentTrack ? currentTrack.prompt : 'DJ dropping the next AI club mix...'}
        </h2>

        {currentTrack?.greeting_text && (
          <div className="p-3 mb-3 rounded-2xl bg-[#07090E]/90 border border-cyan-500/25 text-xs text-zinc-200 flex items-start gap-2.5 shadow-sm">
            <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-mono text-cyan-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                OFFICIAL MC GREETING:
              </span>
              <p className="italic">&quot;{currentTrack.greeting_text}&quot;</p>
            </div>
          </div>
        )}

        {currentTrack && (
          <p className="text-xs text-zinc-400 font-mono mb-3">
            Requested by <span className="text-cyan-300 font-bold">{currentTrack.user_name}</span>
          </p>
        )}

        {/* Live Audio Visualizer Canvas */}
        <div className="h-20 w-full rounded-xl overflow-hidden border border-cyan-500/20 mb-2">
          <CyberVisualizer isPlaying={!!currentTrack} mode="bars" className="w-full h-full" />
        </div>

        {/* Up Next Ticker */}
        {readyQueue.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="text-zinc-500 font-semibold">UP NEXT:</span>
            <span className="text-cyan-300 truncate ml-2">
              #{readyQueue[0].queue_position} {readyQueue[0].prompt}
            </span>
          </div>
        )}
      </section>

      {/* Tabs: Request Song vs My Requests */}
      <div className="flex rounded-2xl bg-[#0D101A] p-1.5 mb-6 border border-white/10 shadow-inner">
        <button
          onClick={() => setActiveTab('request')}
          className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'request'
              ? 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>REQUEST A TRACK</span>
        </button>
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`flex-1 py-2.5 text-xs font-mono font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'my-requests'
              ? 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>MY SUBMISSIONS ({myRequests.length})</span>
        </button>
      </div>

      {/* TAB 1: Song Request Form */}
      {activeTab === 'request' ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Submitter Name */}
          <div className="cyber-card rounded-2xl p-4 border border-white/10 flex flex-col gap-2">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>YOUR NAME / DJ SHOUTOUT NAME</span>
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Alex Rave or Cyber Sarah"
              className="w-full px-4 py-3 rounded-xl bg-[#07090E] border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans text-sm transition"
            />
          </div>

          {/* Genre / Vibe Preset Chips */}
          <div className="cyber-card rounded-2xl p-4 border border-white/10 flex flex-col gap-2.5">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>SELECT MUSIC GENRES &amp; VIBES (TAP TO ADD)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRE_PRESETS.map((preset) => {
                const isSelected = selectedGenres.includes(preset.label);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => toggleGenre(preset.label)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition transform active:scale-95 ${
                      isSelected
                        ? 'bg-cyan-400 text-black font-bold shadow-[0_0_15px_rgba(0,240,255,0.45)] border border-cyan-300'
                        : 'bg-[#07090E] hover:bg-zinc-800/80 text-zinc-300 border border-zinc-800'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Song Prompt Input with Enhance Button */}
          <div className="cyber-card rounded-2xl p-4 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-cyan-400" />
                <span>LYRIA 3.5 MUSIC PROMPT</span>
              </label>
              <button
                type="button"
                disabled={isEnhancing || !prompt.trim()}
                onClick={handleEnhancePrompt}
                className="text-[11px] font-mono text-pink-300 hover:text-white flex items-center gap-1.5 px-3 py-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 shadow-[0_0_15px_rgba(255,0,127,0.25)] disabled:opacity-40 transition active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span>{isEnhancing ? 'ENHANCING...' : 'ENHANCE WITH GEMINI'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the track... (e.g. Heavy acid synth lead, bouncy bassline, driving 130 BPM club anthem)"
              className="w-full px-4 py-3 rounded-xl bg-[#07090E] border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 font-sans text-sm transition"
              required
            />
          </div>

          {/* Greeting Shoutout Input */}
          <div className="cyber-card rounded-2xl p-4 border border-white/10 flex flex-col gap-2">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-pink-400" />
              <span>GREETING SHOUTOUT (SPOKEN BY AI DJ)</span>
            </label>
            <input
              type="text"
              value={greetingText}
              onChange={(e) => setGreetingText(e.target.value)}
              placeholder="e.g. Shoutout to Sarah celebrating her 30th birthday! Let's dance!"
              className="w-full px-4 py-3 rounded-xl bg-[#07090E] border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 font-sans text-sm transition"
              required
            />
            <p className="text-[10px] text-zinc-500 font-mono">
              The AI DJ voice will introduce your track over the sound system right before the beat drops!
            </p>
          </div>

          {/* Voice Persona Selector */}
          <div className="cyber-card rounded-2xl p-4 border border-white/10 flex flex-col gap-2.5">
            <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-pink-400" />
              <span>SELECT AI DJ VOICE PERSONA</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {Object.values(VOICE_PERSONAS).map((persona) => {
                const isSelected = voicePersona === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => setVoicePersona(persona.id)}
                    className={`p-3.5 rounded-2xl border text-left transition transform active:scale-95 ${
                      isSelected
                        ? 'bg-pink-500/20 border-pink-400 shadow-[0_0_20px_rgba(255,0,127,0.35)]'
                        : 'bg-[#07090E] border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <p
                      className={`text-xs font-bold font-mono ${
                        isSelected ? 'text-pink-300' : 'text-zinc-200'
                      }`}
                    >
                      {persona.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                      {persona.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Donation / Pricing Section */}
          <div className="cyber-card rounded-2xl p-4 border border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-semibold text-zinc-300 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>DJ BOOTH TIP / DONATION</span>
              </label>

              {paymentsEnabled ? (
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  HOLD ONLY // NEVER CHARGED IF DECLINED
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                  FREE PARTY MODE
                </span>
              )}
            </div>

            {paymentsEnabled ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  {[200, 500, 1000, 2000].map((cents) => (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => setDonationCents(cents)}
                      className={`flex-1 py-2.5 rounded-xl font-mono text-xs font-bold transition ${
                        donationCents === cents
                          ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.45)]'
                          : 'bg-[#07090E] text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                      }`}
                    >
                      ${(cents / 100).toFixed(0)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Supports Apple Pay, Google Pay, and cards. You are charged only if the DJ drops your song.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 font-mono">
                Tips are currently disabled for this party! Submissions are 100% free tonight.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !prompt.trim() || !greetingText.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-400 via-cyan-400 to-pink-500 hover:from-teal-300 hover:via-cyan-300 hover:to-pink-400 text-black font-extrabold font-mono text-sm tracking-wider shadow-[0_0_35px_rgba(0,245,212,0.4)] disabled:opacity-40 transition transform active:scale-95 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2 font-mono text-white">
                <Disc className="w-5 h-5 animate-spin" />
                <span>TRANSMITTING TO DJ BOOTH...</span>
              </span>
            ) : (
              <>
                <Send className="w-4 h-4 fill-current" />
                <span>
                  SUBMIT SONG REQUEST {paymentsEnabled && `($${(donationCents / 100).toFixed(2)})`}
                </span>
              </>
            )}
          </button>
        </form>
      ) : (
        /* TAB 2: My Requests Live Tracker */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono text-white">
              YOUR DANCEFLOOR SUBMISSIONS
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              {myRequests.length} TOTAL
            </span>
          </div>

          {myRequests.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#0D101A]/60 border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs flex flex-col items-center gap-2">
              <Headphones className="w-8 h-8 text-zinc-700" />
              <span>NO REQUESTS SUBMITTED YET</span>
              <span className="text-[10px] text-zinc-600">
                Tap &quot;REQUEST A TRACK&quot; to join the party queue
              </span>
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
                  color: 'text-pink-400 bg-pink-500/15 border-pink-500/30',
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
                  className="p-5 rounded-3xl cyber-card border border-zinc-800/90 hover:border-zinc-700 transition flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono border flex items-center gap-1.5 ${statusConfig.color}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusConfig.label}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(req.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-white leading-snug">
                    &quot;{req.prompt}&quot;
                  </p>

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
