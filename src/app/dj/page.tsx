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
  QrCode,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Headphones,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { SongRequest, EventSession, VOICE_PERSONAS } from '@/types';
import { DJWebAudioEngine } from '@/lib/audio/web-audio-player';
import { CyberVisualizer } from '@/components/CyberVisualizer';
import { QRCodeModal } from '@/components/QRCodeModal';

export default function DJConsolePage() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Party data state
  const [session, setSession] = useState<EventSession | null>(null);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SongRequest | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const audioEngineRef = useRef<DJWebAudioEngine | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

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
  const playTrackOnMaster = useCallback(async (track: SongRequest) => {
    if (!audioEngineRef.current || !track.music_url) return;

    try {
      setCurrentTrack(track);
      setIsPlaying(true);

      // Notify backend that track started playing
      await fetch('/api/dj/playback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dj-pin': pin,
        },
        body: JSON.stringify({ action: 'start', trackId: track.id }),
      });

      // Start Web Audio playback with chained greeting ducking into music
      await audioEngineRef.current.playTrack(track.music_url, track.greeting_url);
    } catch (err) {
      console.error('Failed to start master playback:', err);
      setIsPlaying(false);
    }
  }, [pin]);

  // Auto-progress when a track ends
  const handleTrackFinished = useCallback(async () => {
    if (!currentTrack) return;

    try {
      await fetch('/api/dj/playback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dj-pin': pin,
        },
        body: JSON.stringify({ action: 'finish', trackId: currentTrack.id }),
      });

      // Find next ready track
      const readyQueue = requests
        .filter((r) => r.status === 'ready' && r.id !== currentTrack.id)
        .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

      if (readyQueue.length > 0) {
        await playTrackOnMaster(readyQueue[0]);
      } else {
        setCurrentTrack(null);
      }
      fetchData();
    } catch (err) {
      console.error('Error handling track finish:', err);
    }
  }, [currentTrack, pin, requests, playTrackOnMaster, fetchData]);

  // Initialize Audio Engine
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
      handleTrackFinished();
    });

    return () => {
      clearTimeout(timer);
      engine.stop();
    };
  }, [handleTrackFinished]);

  useEffect(() => {
    if (isAuthenticated) {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      const interval = setInterval(fetchData, 3000);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [isAuthenticated, fetchData]);

  // Handle PIN authentication
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      if (res.ok) {
        await fetchData();
      } else {
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
      const res = await fetch('/api/dj/decline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-dj-pin': pin,
        },
        body: JSON.stringify({ requestId: request.id }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Decline failed:', err);
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

  // Audio preview for DJ
  const togglePreview = (track: SongRequest) => {
    if (previewTrackId === track.id) {
      previewAudioRef.current?.pause();
      setPreviewTrackId(null);
    } else if (track.music_url) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(track.music_url);
      audio.volume = 0.5;
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
    fetchData();
  };

  // Filter queues
  const incomingRequests = requests.filter(
    (r) => r.status === 'pending_approval' || r.status === 'generating'
  );
  const readyQueue = requests
    .filter((r) => r.status === 'ready')
    .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

  const totalDonationCents = requests
    .filter((r) => r.status !== 'declined' && r.status !== 'failed')
    .reduce((acc, curr) => acc + (curr.donation_amount_cents || 0), 0);

  // 1. PIN Lock Screen
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#0F121A]/90 border border-cyan-500/30 shadow-[0_0_60px_rgba(0,240,255,0.15)] text-center backdrop-blur-2xl">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2 font-mono">
            DJ MASTER CONSOLE
          </h1>
          <p className="text-xs text-zinc-400 mb-8 font-mono">
            SECURE ACCESS PORTAL // ENTER BOOTH PIN
          </p>

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div>
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="ENTER PIN (Default: 4242)"
                autoFocus
                className="w-full px-5 py-4 text-center text-2xl tracking-[0.4em] font-mono rounded-2xl bg-black/60 border border-zinc-700 text-cyan-400 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition"
              />
            </div>

            {authError && (
              <p className="text-xs font-mono text-rose-400 bg-rose-500/10 py-2 px-3 rounded-lg border border-rose-500/20">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifying || !pin}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold tracking-wider font-mono text-sm shadow-[0_0_30px_rgba(0,240,255,0.4)] disabled:opacity-50 transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  AUTHENTICATE CONSOLE
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-[11px] text-zinc-500 font-mono">
            TIP: Configure <span className="text-zinc-400">DJ_SECRET_PIN</span> in .env.local
          </div>
        </div>
      </main>
    );
  }

  // 2. Main DJ Controller Console
  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Top Bar Navigation & Venue Stats */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#0F121A]/80 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
          <div>
            <h1 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
              SUPA LYRIA DJ CONSOLE
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                MASTER AUDIO BOOTH
              </span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              {session?.title || 'Main Stage Party'} {'//'} Connected to Venue Sound System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Donation counter */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs">
            <DollarSign className="w-4 h-4" />
            <span>${(totalDonationCents / 100).toFixed(2)} TIPS</span>
          </div>

          {/* QR Code button */}
          <button
            onClick={() => setIsQrOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-mono text-xs transition"
          >
            <QrCode className="w-4 h-4" />
            <span>VENUE QR</span>
          </button>

          {/* Master Volume Slider */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-800">
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition">
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
              className="w-20 md:w-28 accent-cyan-400 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
            />
          </div>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="p-2 text-zinc-400 hover:text-rose-400 rounded-xl hover:bg-zinc-800/60 transition"
            title="Lock Console"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Master Playing Deck */}
      <section className="relative p-6 rounded-3xl bg-gradient-to-b from-[#131722]/90 to-[#0A0D14]/90 border border-cyan-500/30 shadow-[0_0_40px_rgba(0,240,255,0.1)] backdrop-blur-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Track metadata */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase ${isPlaying ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse' : 'bg-zinc-800 text-zinc-400'}`}>
                {isPlaying ? '● LIVE ON STAGE' : 'DECK IDLE'}
              </span>
              {currentTrack?.voice_persona && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  VOICE: {VOICE_PERSONAS[currentTrack.voice_persona]?.name}
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              {currentTrack ? currentTrack.prompt : 'Awaiting Next Track Drop'}
            </h2>

            {currentTrack?.greeting_text && (
              <div className="p-3 rounded-xl bg-black/40 border border-zinc-800/80 text-xs text-zinc-300">
                <span className="font-mono text-cyan-400 font-semibold">GREETING SHOUTOUT: </span>
                &quot;{currentTrack.greeting_text}&quot;
              </div>
            )}

            {currentTrack && (
              <div className="flex items-center gap-3 pt-1 text-xs text-zinc-400 font-mono">
                <img
                  src={currentTrack.user_avatar_url || ''}
                  alt={currentTrack.user_name}
                  className="w-6 h-6 rounded-full border border-cyan-500/40"
                />
                <span>Requested by <strong className="text-white">{currentTrack.user_name}</strong></span>
                {currentTrack.donation_amount_cents > 0 && (
                  <span className="text-emerald-400 font-bold">
                    +${(currentTrack.donation_amount_cents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {/* Playback action buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                disabled={!currentTrack}
                onClick={() => {
                  if (isPlaying) {
                    audioEngineRef.current?.pause();
                    setIsPlaying(false);
                  } else {
                    audioEngineRef.current?.resume();
                    setIsPlaying(true);
                  }
                }}
                className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold font-mono text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-40 transition active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                {isPlaying ? 'PAUSE MASTER' : 'RESUME MASTER'}
              </button>

              <button
                disabled={readyQueue.length === 0}
                onClick={handleTrackFinished}
                className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs flex items-center gap-2 border border-zinc-700 disabled:opacity-40 transition"
              >
                <SkipForward className="w-4 h-4" />
                SKIP NEXT
              </button>
            </div>
          </div>

          {/* Visualizer Canvas */}
          <div className="lg:col-span-7 h-48 md:h-56">
            <CyberVisualizer
              analyser={analyser}
              isPlaying={isPlaying}
              mode="bars"
              className="w-full h-full"
            />
          </div>
        </div>
      </section>

      {/* Dual Bottom Decks: Review Deck vs Play Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Incoming Audience Submissions (Review Deck) */}
        <section className="flex flex-col gap-4 p-5 rounded-3xl bg-[#0F121A]/70 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold font-mono text-white text-base">
                INCOMING AUDIENCE REQUESTS
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {incomingRequests.length} PENDING
            </span>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto max-h-[550px] pr-1">
            {incomingRequests.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-black/30 border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs">
                NO PENDING REQUESTS // AUDIENCE CAN SCAN QR TO SUBMIT
              </div>
            ) : (
              incomingRequests.map((req) => {
                const isGenerating = req.status === 'generating';
                const isLoading = actionLoadingId === req.id;

                return (
                  <div
                    key={req.id}
                    className={`p-4 rounded-2xl bg-black/40 border transition ${isGenerating ? 'border-purple-500/50 shadow-[0_0_20px_rgba(112,0,255,0.2)]' : 'border-zinc-800 hover:border-zinc-700'}`}
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
                            {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {req.donation_amount_cents > 0 ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          +${(req.donation_amount_cents / 100).toFixed(2)} TIP
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                          FREE
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-zinc-100 mb-1">&quot;{req.prompt}&quot;</p>
                    
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
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {isGenerating || isLoading ? (
                        <div className="w-full py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono text-xs flex items-center justify-center gap-2 animate-pulse">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>GENERATING WITH LYRIA 3.5 & TTS...</span>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(req)}
                            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold font-mono text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            APPROVE & GENERATE
                          </button>
                          <button
                            onClick={() => handleDecline(req)}
                            className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-zinc-700 font-mono text-xs flex items-center gap-1 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            DECLINE
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

        {/* Column 2: Ready / Play Queue */}
        <section className="flex flex-col gap-4 p-5 rounded-3xl bg-[#0F121A]/70 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold font-mono text-white text-base">
                UP NEXT / READY QUEUE
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {readyQueue.length} READY
            </span>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto max-h-[550px] pr-1">
            {readyQueue.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-black/30 border border-dashed border-zinc-800 text-zinc-500 font-mono text-xs">
                PLAY QUEUE EMPTY // APPROVE REQUESTS TO QUEUE TRACKS
              </div>
            ) : (
              readyQueue.map((track, idx) => (
                <div
                  key={track.id}
                  className="p-4 rounded-2xl bg-black/40 border border-zinc-800 hover:border-cyan-500/40 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-mono font-bold text-xs text-cyan-400">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white line-clamp-1">{track.prompt}</p>
                      <p className="text-[11px] text-zinc-400 font-mono flex items-center gap-2">
                        <span>by {track.user_name}</span>
                        {track.greeting_text && <span className="text-zinc-600">• Greeting Ready</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* DJ Preview Button */}
                    <button
                      onClick={() => togglePreview(track)}
                      className={`p-2 rounded-lg border font-mono text-xs transition ${previewTrackId === track.id ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700'}`}
                      title="Preview in Booth"
                    >
                      <Headphones className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Up/Down buttons */}
                    <button
                      disabled={idx === 0}
                      onClick={() => moveQueue(track.id, 'up')}
                      className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={idx === readyQueue.length - 1}
                      onClick={() => moveQueue(track.id, 'down')}
                      className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 transition"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Instant Drop / Play Now */}
                    <button
                      onClick={() => playTrackOnMaster(track)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      DROP NOW
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* QR Code Modal for Venue Projection */}
      <QRCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        partyTitle={session?.title || 'Main Stage Party'}
      />
    </main>
  );
}
