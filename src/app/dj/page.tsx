'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Radio,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Music,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Headphones,
  RefreshCw,
  Zap,
  Sliders,
  Flame,
  Layers,
  Sparkles,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { SongRequest, EventSession, VOICE_PERSONAS } from '@/types';
import { DJWebAudioEngine } from '@/lib/audio/web-audio-player';
import { CyberVisualizer } from '@/components/CyberVisualizer';
import { QRCodeStation } from '@/components/QRCodeStation';
import { StageProjectorModal } from '@/components/StageProjectorModal';

import { createClient } from '@/lib/supabase/client';

export default function DJConsolePage() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Party data state
  const [session, setSession] = useState<EventSession | null>(null);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SongRequest | null>(null);
  const [isProjectorOpen, setIsProjectorOpen] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [visualizerMode, setVisualizerMode] = useState<'bars' | 'wave'>('bars');
  const [queueTab, setQueueTab] = useState<'ready' | 'played'>('ready');

  const audioEngineRef = useRef<DJWebAudioEngine | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stable references for audio callbacks to prevent engine recreation and race conditions
  const currentTrackRef = useRef<SongRequest | null>(null);
  const requestsRef = useRef<SongRequest[]>(requests);
  const handleTrackFinishedRef = useRef<() => void>(() => {});


  // Fetch session & queue data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setRequests(data.requests || []);

        // Find current playing track
        if (data.session?.current_track_id) {
          const active = (data.requests as SongRequest[]).find(
            (r) => r.id === data.session.current_track_id
          );
          if (active) setCurrentTrack(active);
        }
      }
    } catch (err) {
      console.error('Failed to fetch DJ session:', err);
    }
  }, []);

  // Play a specific track on the master audio deck
  const playTrackOnMaster = useCallback(
    async (track: SongRequest) => {
      // 1. Immediately unlock and resume AudioContext within user gesture
      audioEngineRef.current?.unlock();

      // 2. Stop any headphone preview that might be playing
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        setPreviewTrackId(null);
      }

      if (!audioEngineRef.current || !track.music_url) {
        console.warn('Cannot play track: engine or music_url missing', {
          hasEngine: !!audioEngineRef.current,
          musicUrl: track.music_url,
        });
        return;
      }

      try {
        console.log(`Starting master audio playback for track ${track.id}: "${track.prompt}"`);
        setCurrentTrack(track);
        setIsPlaying(true);

        // Notify backend that track started playing in parallel without delaying audio startup
        const notifyBackendPromise = fetch('/api/dj/playback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-dj-pin': pin,
          },
          body: JSON.stringify({ action: 'start', trackId: track.id }),
        }).catch((err) => console.error('Failed to notify backend playback start:', err));

        // Start Web Audio playback with chained greeting ducking into music
        await audioEngineRef.current.playTrack(track.music_url, track.greeting_url);
        await notifyBackendPromise;
      } catch (err) {
        console.error('Failed to start master playback:', err);
        setIsPlaying(false);
      }
    },
    [pin]
  );

  // Auto-progress when a track ends naturally
  const handleTrackFinished = useCallback(async () => {
    const active = currentTrackRef.current;
    if (!active) return;

    console.log(`Track finished: ${active.id}`);
    try {
      await fetch('/api/dj/playback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dj-pin': pin,
        },
        body: JSON.stringify({ action: 'finish', trackId: active.id }),
      });

      // Find next ready track
      const readyQueue = requestsRef.current
        .filter((r) => r.status === 'ready' && r.id !== active.id)
        .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

      if (readyQueue.length > 0) {
        console.log(`Auto-progressing to next track: ${readyQueue[0].id}`);
        await playTrackOnMaster(readyQueue[0]);
      } else {
        console.log('Queue empty, deck idle');
        setCurrentTrack(null);
      }
    } catch (err) {
      console.error('Error handling track finish:', err);
    }
  }, [pin, playTrackOnMaster]);

  // Synchronize refs in an effect to keep audio callbacks up to date without recreating audio engine
  useEffect(() => {
    currentTrackRef.current = currentTrack;
    requestsRef.current = requests;
    handleTrackFinishedRef.current = handleTrackFinished;
  }, [currentTrack, requests, handleTrackFinished]);

  // Initialize Audio Engine ONCE on mount (NEVER recreate during playback!)
  useEffect(() => {
    const engine = new DJWebAudioEngine();
    audioEngineRef.current = engine;
    const timer = setTimeout(() => {
      setAnalyser(engine.getAnalyser());
    }, 0);

    engine.setOnTrackStarted(() => {
      setIsPlaying(true);
      setAnalyser(engine.getAnalyser());
    });

    engine.setOnEnded(() => {
      setIsPlaying(false);
      handleTrackFinishedRef.current();
    });

    return () => {
      clearTimeout(timer);
      engine.stop();
    };
  }, []);

  // Supabase Realtime client subscription - 100% push-driven over WebSockets
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch once on mount/login
    const initialTimer = setTimeout(() => {
      fetchData();
    }, 0);

    // Subscribe to Supabase Realtime for instant event-driven push updates
    const supabase = createClient();
    const channel = supabase
      .channel('dj-console-realtime')
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
      .subscribe((status) => {
        console.log('Supabase Realtime connected (DJ Console):', status);
      });

    return () => {
      clearTimeout(initialTimer);
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchData]);

  // Handle PIN authentication
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    audioEngineRef.current?.unlock();
    setIsVerifying(true);
    setAuthError('');

    try {
      const res = await fetch('/api/dj/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error || 'Invalid DJ PIN');
      }
    } catch {
      setAuthError('Connection error, try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // DJ Approves a request -> Triggers Lyria 3.5 & TTS generation & captures Stripe hold
  const handleApprove = async (request: SongRequest) => {
    setActionLoadingId(request.id);
    try {
      const res = await fetch('/api/dj/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dj-pin': pin,
        },
        body: JSON.stringify({ requestId: request.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Approval failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // DJ Declines a request -> Cancels Stripe hold
  const handleDecline = async (request: SongRequest) => {
    setActionLoadingId(request.id);
    try {
      await fetch('/api/dj/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dj-pin': pin,
        },
        body: JSON.stringify({ requestId: request.id }),
      });
    } catch (err) {
      console.error('Decline failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Re-queue a previously played track back into the ready queue
  const handleRequeue = async (track: SongRequest) => {
    setActionLoadingId(track.id);
    try {
      const res = await fetch('/api/dj/requeue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dj-pin': pin,
        },
        body: JSON.stringify({ trackId: track.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to re-queue: ${data.error}`);
      }
    } catch (err) {
      console.error('Re-queue failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Volume controls
  const handleVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    setIsMuted(vol === 0);
    audioEngineRef.current?.setMasterVolume(vol);
  };

  const toggleMute = () => {
    if (isMuted) {
      handleVolumeChange(masterVolume || 0.85);
    } else {
      audioEngineRef.current?.setMasterVolume(0);
      setIsMuted(true);
    }
  };

  // Audio preview for DJ headphones
  const togglePreview = (track: SongRequest) => {
    if (previewTrackId === track.id) {
      previewAudioRef.current?.pause();
      setPreviewTrackId(null);
    } else if (track.music_url) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(track.music_url);
      audio.volume = 0.6;
      audio.play();
      audio.onended = () => setPreviewTrackId(null);
      previewAudioRef.current = audio;
      setPreviewTrackId(track.id);
    }
  };

  // Move track up/down in queue
  const moveQueue = async (trackId: string, direction: 'up' | 'down') => {
    const readyTracks = requests
      .filter((r) => r.status === 'ready')
      .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

    const index = readyTracks.findIndex((r) => r.id === trackId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === readyTracks.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = readyTracks[index];
    readyTracks[index] = readyTracks[swapIndex];
    readyTracks[swapIndex] = temp;

    const orderedIds = readyTracks.map((r) => r.id);
    await fetch('/api/dj/reorder-queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dj-pin': pin,
      },
      body: JSON.stringify({ orderedIds }),
    });
  };

  // Filter queues
  const incomingRequests = requests.filter(
    (r) => r.status === 'pending_approval' || r.status === 'generating'
  );
  const readyQueue = requests
    .filter((r) => r.status === 'ready')
    .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

  const playedHistory = requests
    .filter((r) => r.status === 'played')
    .sort(
      (a, b) =>
        new Date(b.played_at || b.created_at).getTime() -
        new Date(a.played_at || a.created_at).getTime()
    );

  const totalDonationCents = requests
    .filter((r) => r.status !== 'declined' && r.status !== 'failed')
    .reduce((acc, curr) => acc + (curr.donation_amount_cents || 0), 0);

  // 1. Sleek Cyber PIN Lock Screen
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="relative w-full max-w-md p-8 md:p-10 rounded-3xl cyber-card-glow border border-cyan-500/40 text-center">
          {/* Top illuminated icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_30px_rgba(0,240,255,0.3)] animate-pulse">
            <Lock className="w-10 h-10" />
          </div>

          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[11px] font-mono tracking-widest uppercase text-cyan-400 font-bold">
              AUDIO ENGINE MASTER
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 font-mono">
            DJ BOOTH CONSOLE
          </h1>
          <p className="text-xs text-zinc-400 mb-8 font-mono">
            AUTHORIZE HARDWARE SOUND SYSTEM ACCESS
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="ENTER PIN"
                autoFocus
                className="w-full px-5 py-4 text-center text-2xl tracking-[0.4em] font-mono rounded-2xl bg-[#07090E] border border-cyan-500/30 text-cyan-400 placeholder:text-zinc-700 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 shadow-inner transition"
              />
            </div>

            {authError && (
              <p className="text-xs font-mono text-rose-400 bg-rose-500/10 py-2.5 px-4 rounded-xl border border-rose-500/30">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifying || !pin}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 hover:from-cyan-300 hover:via-teal-300 hover:to-blue-400 text-black font-extrabold tracking-wider font-mono text-sm shadow-[0_0_35px_rgba(0,240,255,0.4)] disabled:opacity-40 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  CONNECT MASTER SOUND
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-zinc-500 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Default Demo PIN: 4242</span>
          </div>
        </div>
      </main>
    );
  }

  // 2. Main DJ Controller Console
  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Top Bar Navigation, Hardware Telemetry & Venue Stats */}
      <header className="cyber-card rounded-3xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-400 via-cyan-400 to-pink-500 flex items-center justify-center text-black font-bold shadow-[0_0_20px_rgba(0,245,212,0.35)]">
              <Sliders className="w-5 h-5 text-black" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0B0D13] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold font-mono tracking-tight text-white">
                SUPA LYRIA DJ CONSOLE
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-400/15 border border-teal-400/30 text-teal-300 font-semibold hidden sm:inline">
                MAIN BOOTH
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">● ONLINE</span>
              <span>•</span>
              <span>{session?.title || 'Main Stage Party'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          {/* Donation counter */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="font-bold">${(totalDonationCents / 100).toFixed(2)}</span>
            <span className="text-amber-500/80 text-[10px]">TIPS</span>
          </div>

          {/* Up next count badge */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-300 font-mono text-xs shadow-[0_0_12px_rgba(255,0,127,0.15)]">
            <Layers className="w-3.5 h-3.5 text-pink-400" />
            <span>{readyQueue.length} QUEUED</span>
          </div>

          {/* Master Volume Slider with dB visual level */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#07090E] border border-zinc-800">
            <button
              onClick={toggleMute}
              className="text-zinc-400 hover:text-cyan-400 transition"
              title={isMuted ? 'Unmute' : 'Mute Master Audio'}
            >
              {isMuted || masterVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={isMuted ? 0 : masterVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-24 md:w-28 accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              title="Master Sound Level"
            />
            <span className="text-[10px] font-mono text-zinc-500 w-7 text-right">
              {isMuted ? '0%' : `${Math.round(masterVolume * 100)}%`}
            </span>
          </div>

          {/* Stage Projector View Button */}
          <button
            onClick={() => setIsProjectorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-mono text-xs transition shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            title="Launch Fullscreen Stage Projector for Venue Display"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">STAGE PROJECTOR</span>
          </button>

          {/* Lock Console */}
          <button
            onClick={() => setIsAuthenticated(false)}
            className="p-2.5 text-zinc-400 hover:text-rose-400 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
            title="Lock Console"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Grid: Left Decks (8 cols) + Right ALWAYS-VISIBLE QR STATION (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section (8 cols): Hero Deck + Dual Curation/Queue Decks */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Master Live Playing Deck */}
          <section className="relative p-6 md:p-7 rounded-3xl cyber-card-glow border border-cyan-500/35 overflow-hidden">
            {/* Ambient neon radial */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Track metadata & controls */}
              <div className="md:col-span-6 flex flex-col gap-3">
                <div className="flex items-center flex-wrap gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase flex items-center gap-1.5 ${
                      isPlaying
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.25)] animate-pulse'
                        : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-zinc-500'
                      }`}
                    />
                    {isPlaying ? 'LIVE ON MASTER DECK' : 'DECK STANDBY'}
                  </span>

                  {currentTrack?.voice_persona && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-pink-500/20 text-pink-300 border border-pink-500/30">
                      VOICE: {VOICE_PERSONAS[currentTrack.voice_persona]?.name}
                    </span>
                  )}
                </div>

                <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight font-display">
                  {currentTrack ? currentTrack.prompt : 'Drop Your First AI Music Track'}
                </h2>

                {currentTrack?.greeting_text && (
                  <div className="p-3.5 rounded-2xl bg-[#07090E]/90 border border-cyan-500/25 text-xs text-zinc-200 flex items-start gap-2.5 shadow-sm">
                    <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-cyan-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                        MC GREETING INTRO:
                      </span>
                      <p className="italic">&quot;{currentTrack.greeting_text}&quot;</p>
                    </div>
                  </div>
                )}

                {currentTrack && (
                  <div className="flex items-center gap-3 pt-1 text-xs text-zinc-400 font-mono">
                    <img
                      src={currentTrack.user_avatar_url || ''}
                      alt={currentTrack.user_name}
                      className="w-7 h-7 rounded-full border border-cyan-500/40"
                    />
                    <span>
                      Requested by <strong className="text-white">{currentTrack.user_name}</strong>
                    </span>
                    {currentTrack.donation_amount_cents > 0 && (
                      <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                        +${(currentTrack.donation_amount_cents / 100).toFixed(2)} TIP
                      </span>
                    )}
                  </div>
                )}

                {/* Master Playback transport buttons */}
                <div className="flex items-center gap-3 pt-3">
                  <button
                    disabled={!currentTrack && readyQueue.length === 0}
                    onClick={() => {
                      audioEngineRef.current?.unlock();
                      if (isPlaying) {
                        audioEngineRef.current?.pause();
                        setIsPlaying(false);
                      } else if (currentTrack) {
                        audioEngineRef.current?.resume();
                        setIsPlaying(true);
                      } else if (readyQueue.length > 0) {
                        playTrackOnMaster(readyQueue[0]);
                      }
                    }}
                    className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-[#00F5D4] to-[#00d0b5] hover:brightness-110 text-black font-extrabold font-mono text-xs flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,245,212,0.35)] disabled:opacity-40 transition transform active:scale-95"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>PAUSE MASTER</span>
                      </>
                    ) : currentTrack ? (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>RESUME MASTER</span>
                      </>
                    ) : readyQueue.length > 0 ? (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>START MASTER (DROP NEXT)</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>QUEUE EMPTY</span>
                      </>
                    )}
                  </button>

                  <button
                    disabled={readyQueue.length === 0 && !currentTrack}
                    onClick={() => {
                      audioEngineRef.current?.unlock();
                      handleTrackFinished();
                    }}
                    className="py-3 px-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 text-white font-mono text-xs flex items-center gap-2 border border-zinc-700/80 disabled:opacity-40 transition active:scale-95"
                    title="Skip to Next Queued Track"
                  >
                    <SkipForward className="w-4 h-4 text-[#00F5D4]" />
                    <span>SKIP NEXT</span>
                  </button>
                </div>
              </div>

              {/* Live Audio Visualizer Canvas */}
              <div className="md:col-span-6 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                    <Flame className="w-3.5 h-3.5" />
                    VENUE SPECTRUM ANALYZER
                  </span>
                  <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setVisualizerMode('bars')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        visualizerMode === 'bars'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      BARS
                    </button>
                    <button
                      onClick={() => setVisualizerMode('wave')}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        visualizerMode === 'wave'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      WAVE
                    </button>
                  </div>
                </div>

                <div className="h-44 md:h-52 w-full rounded-2xl overflow-hidden border border-cyan-500/20 shadow-inner">
                  <CyberVisualizer
                    analyser={analyser}
                    isPlaying={isPlaying}
                    mode={visualizerMode}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Dual Bottom Decks: Review Deck vs Play Queue */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Incoming Audience Submissions (Review Deck) */}
            <section className="cyber-card rounded-3xl p-5 border border-white/10 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold font-mono text-white text-sm">
                    INCOMING AUDIENCE REQUESTS
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {incomingRequests.length} PENDING
                </span>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-1">
                {incomingRequests.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-black/30 border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs flex flex-col items-center gap-2">
                    <Music className="w-8 h-8 text-zinc-700" />
                    <span>NO PENDING REQUESTS</span>
                    <span className="text-[10px] text-zinc-600">
                      Crowd can scan the venue QR station to submit songs
                    </span>
                  </div>
                ) : (
                  incomingRequests.map((req) => {
                    const isGenerating = req.status === 'generating';
                    const isLoading = actionLoadingId === req.id;

                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl bg-[#07090E]/90 border transition ${
                          isGenerating
                            ? 'border-pink-500/60 shadow-[0_0_20px_rgba(255,0,127,0.25)]'
                            : 'border-zinc-800/90 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={req.user_avatar_url || ''}
                              alt={req.user_name}
                              className="w-7 h-7 rounded-full border border-zinc-700"
                            />
                            <div>
                              <p className="text-xs font-bold text-white">{req.user_name}</p>
                              <p className="text-[10px] text-zinc-500 font-mono">
                                {new Date(req.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>

                          {req.donation_amount_cents > 0 ? (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              +${(req.donation_amount_cents / 100).toFixed(2)} TIP
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800/80 text-zinc-400">
                              FREE
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-zinc-100 mb-1 leading-snug">
                          &quot;{req.prompt}&quot;
                        </p>

                        {req.greeting_text && (
                          <p className="text-xs text-zinc-400 mb-2 italic">
                            Shoutout: &quot;{req.greeting_text}&quot;
                          </p>
                        )}

                        {req.genres?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {req.genres.map((g) => (
                              <span
                                key={g}
                                className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-teal-400/10 text-teal-300 border border-teal-400/20"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {isGenerating || isLoading ? (
                            <div className="w-full py-2.5 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-300 font-mono text-xs flex items-center justify-center gap-2 animate-pulse">
                              <RefreshCw className="w-4 h-4 animate-spin text-pink-400" />
                              <span>GENERATING WITH LYRIA 3.5 &amp; TTS...</span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApprove(req)}
                                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold font-mono text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>APPROVE &amp; DROP</span>
                              </button>
                              <button
                                onClick={() => handleDecline(req)}
                                className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-zinc-800 font-mono text-xs flex items-center gap-1 transition"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>DECLINE</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Column 2: Ready Queue / Played History */}
            <section className="cyber-card rounded-3xl p-5 border border-white/10 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10">
                  <button
                    onClick={() => setQueueTab('ready')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition ${
                      queueTab === 'ready'
                        ? 'bg-teal-400/20 text-[#00F5D4] border border-teal-400/40 shadow-[0_0_12px_rgba(0,245,212,0.25)]'
                        : 'text-zinc-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5 text-[#00F5D4]" />
                    <span>UP NEXT ({readyQueue.length})</span>
                  </button>

                  <button
                    onClick={() => setQueueTab('played')}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition ${
                      queueTab === 'played'
                        ? 'bg-pink-500/20 text-[#FF007F] border border-pink-500/40 shadow-[0_0_12px_rgba(255,0,127,0.25)]'
                        : 'text-zinc-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#FF007F]" />
                    <span>PLAYED ({playedHistory.length})</span>
                  </button>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                    queueTab === 'ready'
                      ? 'bg-teal-400/15 text-teal-300 border-teal-400/30'
                      : 'bg-pink-500/15 text-pink-300 border-pink-500/30'
                  }`}
                >
                  {queueTab === 'ready' ? `${readyQueue.length} READY` : `${playedHistory.length} PLAYED`}
                </span>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-1">
                {queueTab === 'ready' ? (
                  readyQueue.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-black/30 border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs flex flex-col items-center gap-2">
                      <Music className="w-8 h-8 text-zinc-700" />
                      <span>QUEUE IS CURRENTLY EMPTY</span>
                      <span className="text-[10px] text-zinc-600">
                        Approved tracks will appear here ready to drop
                      </span>
                    </div>
                  ) : (
                    readyQueue.map((track, idx) => (
                      <div
                        key={track.id}
                        className="p-3.5 rounded-2xl bg-[#07090E]/90 border border-zinc-800/90 hover:border-teal-400/40 transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-xl bg-zinc-800/90 border border-zinc-700 flex items-center justify-center font-mono font-bold text-xs text-teal-400 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{track.prompt}</p>
                            <p className="text-[10px] text-zinc-400 font-mono flex items-center gap-2 truncate">
                              <span>by {track.user_name}</span>
                              {track.greeting_text && (
                                <span className="text-pink-400">• MC Greeting Ready</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* DJ Preview Button */}
                          <button
                            onClick={() => togglePreview(track)}
                            className={`p-2 rounded-xl border font-mono text-xs transition ${
                              previewTrackId === track.id
                                ? 'bg-teal-400 text-black border-teal-300 shadow-[0_0_12px_rgba(0,245,212,0.4)]'
                                : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
                            }`}
                            title="Pre-cue in DJ Headphones"
                          >
                            <Headphones className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Up/Down buttons */}
                          <button
                            disabled={idx === 0}
                            onClick={() => moveQueue(track.id, 'up')}
                            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 transition"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            disabled={idx === readyQueue.length - 1}
                            onClick={() => moveQueue(track.id, 'down')}
                            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 transition"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {/* Instant Drop / Play Now */}
                          <button
                            onClick={() => {
                              audioEngineRef.current?.unlock();
                              playTrackOnMaster(track);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-teal-400/20 hover:bg-teal-400/30 border border-teal-400/40 text-teal-300 font-mono text-xs flex items-center gap-1.5 transition active:scale-95 shadow-[0_0_10px_rgba(0,245,212,0.15)]"
                          >
                            <Zap className="w-3.5 h-3.5 text-teal-400" />
                            <span>DROP</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  playedHistory.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-black/30 border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs flex flex-col items-center gap-2">
                      <RotateCcw className="w-8 h-8 text-zinc-700" />
                      <span>NO TRACKS PLAYED YET</span>
                      <span className="text-[10px] text-zinc-600">
                        Tracks that finish playing will appear here ready to re-queue
                      </span>
                    </div>
                  ) : (
                    playedHistory.map((track) => (
                      <div
                        key={track.id}
                        className="p-3.5 rounded-2xl bg-[#07090E]/90 border border-zinc-800/90 hover:border-pink-500/40 transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center font-mono font-bold text-xs text-[#FF007F] shrink-0">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{track.prompt}</p>
                            <p className="text-[10px] text-zinc-400 font-mono flex items-center gap-2 truncate">
                              <span>by {track.user_name}</span>
                              {track.played_at && (
                                <span className="text-zinc-500">
                                  • {new Date(track.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {track.donation_amount_cents > 0 && (
                                <span className="text-emerald-400 font-bold">
                                  • +${(track.donation_amount_cents / 100).toFixed(2)}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* DJ Preview Button */}
                          <button
                            onClick={() => togglePreview(track)}
                            className={`p-2 rounded-xl border font-mono text-xs transition ${
                              previewTrackId === track.id
                                ? 'bg-teal-400 text-black border-teal-300 shadow-[0_0_12px_rgba(0,245,212,0.4)]'
                                : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
                            }`}
                            title="Pre-cue in DJ Headphones"
                          >
                            <Headphones className="w-3.5 h-3.5" />
                          </button>

                          {/* Re-Queue Button */}
                          <button
                            disabled={actionLoadingId === track.id}
                            onClick={() => handleRequeue(track)}
                            className="px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 font-mono text-xs flex items-center gap-1.5 transition active:scale-95 shadow-[0_0_12px_rgba(255,0,127,0.2)] disabled:opacity-50"
                            title="Add back into Up Next Queue"
                          >
                            <RotateCcw
                              className={`w-3.5 h-3.5 text-[#FF007F] ${
                                actionLoadingId === track.id ? 'animate-spin' : ''
                              }`}
                            />
                            <span>RE-QUEUE</span>
                          </button>

                          {/* Instant Drop Again */}
                          <button
                            onClick={() => {
                              audioEngineRef.current?.unlock();
                              playTrackOnMaster(track);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-400/20 hover:bg-teal-400/30 border border-teal-400/40 text-teal-300 font-mono text-xs flex items-center gap-1 transition active:scale-95 shadow-[0_0_10px_rgba(0,245,212,0.15)]"
                            title="Drop immediately on Master Deck"
                          >
                            <Zap className="w-3.5 h-3.5 text-teal-400" />
                            <span>DROP</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Right Section (4 cols): ALWAYS-VISIBLE VENUE QR STATION & HUD Telemetry */}
        <div className="lg:col-span-4 flex flex-col gap-6 sticky top-6">
          {/* ALWAYS VISIBLE VENUE QR CODE STATION */}
          <QRCodeStation
            partyTitle={session?.title || 'Main Stage Party'}
            onOpenProjector={() => setIsProjectorOpen(true)}
          />

          {/* Hardware & Generation Telemetry Card */}
          <div className="cyber-card rounded-3xl p-5 border border-white/10 flex flex-col gap-3">
            <h4 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              AI BOOTH SPECS
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 rounded-2xl bg-[#07090E] border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">MUSIC ENGINE</span>
                <span className="text-teal-400 font-bold">Lyria 3.5</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#07090E] border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">MC VOICEOVER</span>
                <span className="text-pink-400 font-bold">Gemini TTS</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#07090E] border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">MASTER ENGINE</span>
                <span className="text-emerald-400 font-bold">Web Audio 48kHz</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#07090E] border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">PAYMENT CAPTURE</span>
                <span className="text-amber-400 font-bold">Manual On-Gen</span>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-zinc-500 font-mono leading-relaxed">
              💡 Tip: Click <strong className="text-cyan-300">STAGE PROJECTOR</strong> above or on the QR station to project full-screen visuals on the venue wall!
            </div>
          </div>
        </div>
      </div>

      {/* Stage Projector Modal for venue wall / secondary screen */}
      <StageProjectorModal
        isOpen={isProjectorOpen}
        onClose={() => setIsProjectorOpen(false)}
        partyTitle={session?.title || 'Main Stage Party'}
        currentTrack={currentTrack}
        analyser={analyser}
        isPlaying={isPlaying}
      />
    </main>
  );
}
