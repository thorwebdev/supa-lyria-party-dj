/**
 * Master Web Audio Engine for Supa Lyria Party DJ
 * Provides chained greeting ducking, seamless beat drop transitions, and live FFT frequency analysis.
 */
export class DJWebAudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private greetingGain: GainNode | null = null;

  private activeMusicSource: AudioBufferSourceNode | null = null;
  private activeGreetingSource: AudioBufferSourceNode | null = null;

  private isPlaying: boolean = false;
  private currentVolume: number = 0.85;

  private onEndedCallback: (() => void) | null = null;
  private onTrackStartedCallback: (() => void) | null = null;

  constructor() {
    // Initialized lazily on first user interaction to comply with browser autoplay policies
  }

  /**
   * Synchronously initialize the AudioContext graph and resume suspended state.
   * MUST be invoked directly in a user click/gesture handler for autoplay compliance.
   */
  public unlock(): void {
    this.initContextSync();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch((err) => {
        console.warn('[AudioEngine] unlock resume error:', err);
      });
    }
  }

  private initContextSync(): void {
    if (typeof window === 'undefined') return;

    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);

      this.musicGain = this.audioCtx.createGain();
      this.greetingGain = this.audioCtx.createGain();

      // Audio Graph Routing:
      // musicSource -> musicGain -> analyser -> masterGain -> destination
      // greetingSource -> greetingGain -> analyser -> masterGain -> destination
      this.musicGain.connect(this.analyser);
      this.greetingGain.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch((err) => {
        console.warn('[AudioEngine] resume warning:', err);
      });
    }
  }

  public setOnEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }

  public setOnTrackStarted(cb: () => void) {
    this.onTrackStartedCallback = cb;
  }

  public setMasterVolume(volume: number) {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);
      } catch {
        this.masterGain.gain.value = this.currentVolume;
      }
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private async fetchAndDecode(url: string): Promise<AudioBuffer> {
    this.initContextSync();
    if (!this.audioCtx) throw new Error('AudioContext not ready');

    console.log(`[AudioEngine] Fetching audio from ${url.startsWith('data:') ? 'base64 data URI' : url.substring(0, 100)}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load audio from ${url} (HTTP ${res.status})`);
    const arrayBuffer = await res.arrayBuffer();

    return new Promise<AudioBuffer>((resolve, reject) => {
      this.audioCtx!.decodeAudioData(
        arrayBuffer,
        (buffer) => resolve(buffer),
        (err) => reject(err || new Error('Audio decode failure'))
      );
    });
  }

  /**
   * Chains greeting voiceover smoothly into the music drop:
   * 1. Plays greeting voiceover at full volume
   * 2. Starts music in background with volume ducked (15%)
   * 3. At greeting conclusion, ramps music to 100% on the beat drop!
   */
  public async playTrack(
    musicUrl: string,
    greetingUrl?: string | null
  ): Promise<void> {
    this.stop();
    this.initContextSync();

    if (!this.audioCtx || !this.musicGain || !this.greetingGain) {
      throw new Error('Audio engine not properly initialized');
    }

    try {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      console.log('[AudioEngine] Decoding track audio assets...');
      const [musicBuffer, greetingBuffer] = await Promise.all([
        this.fetchAndDecode(musicUrl),
        greetingUrl
          ? this.fetchAndDecode(greetingUrl).catch((err) => {
              console.warn('[AudioEngine] Failed to decode greeting, playing music directly:', err);
              return null;
            })
          : Promise.resolve(null),
      ]);

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      this.isPlaying = true;
      if (this.onTrackStartedCallback) this.onTrackStartedCallback();

      if (greetingBuffer && greetingBuffer.duration > 0.5) {
        // --- Chained Greeting -> Music Drop Sequence ---
        const greetingDuration = greetingBuffer.duration;
        console.log(
          `[AudioEngine] Chaining greeting (${greetingDuration.toFixed(1)}s) into music track (${musicBuffer.duration.toFixed(1)}s)`
        );

        const greetingSource = this.audioCtx.createBufferSource();
        greetingSource.buffer = greetingBuffer;
        greetingSource.connect(this.greetingGain);

        const musicSource = this.audioCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.connect(this.musicGain);

        this.activeGreetingSource = greetingSource;
        this.activeMusicSource = musicSource;

        // Cancel previous automation curves
        this.greetingGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.cancelScheduledValues(now);

        // Greeting Gain: full volume
        this.greetingGain.gain.setValueAtTime(1.0, now);

        // Music Gain: starts ducked at 0.15, ramps up to 1.0 right as speech concludes
        const dropLeadTime = Math.min(1.0, greetingDuration * 0.4);
        const dropPoint = now + Math.max(0, greetingDuration - dropLeadTime);

        this.musicGain.gain.setValueAtTime(0.15, now);
        this.musicGain.gain.setValueAtTime(0.15, dropPoint);
        this.musicGain.gain.linearRampToValueAtTime(1.0, now + greetingDuration + 0.2);

        // Start greeting immediately
        greetingSource.start(now);
        // Start music track overlapping in background
        musicSource.start(now);

        greetingSource.onended = () => {
          if (this.activeGreetingSource === greetingSource) {
            this.activeGreetingSource = null;
            // Ensure music gain is fully restored
            if (this.musicGain && this.audioCtx) {
              try {
                this.musicGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
                this.musicGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
              } catch {}
            }
          }
        };

        musicSource.onended = () => {
          // Only fire onEnded if this source is still the active one (not stopped manually)
          if (this.activeMusicSource === musicSource) {
            this.activeMusicSource = null;
            this.isPlaying = false;
            console.log('[AudioEngine] Master track playback completed naturally');
            if (this.onEndedCallback) this.onEndedCallback();
          }
        };
      } else {
        // --- Direct Music Playback ---
        console.log(`[AudioEngine] Direct music playback (${musicBuffer.duration.toFixed(1)}s)`);
        const musicSource = this.audioCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.connect(this.musicGain);
        this.activeMusicSource = musicSource;

        this.musicGain.gain.cancelScheduledValues(now);
        this.musicGain.gain.setValueAtTime(1.0, now);
        musicSource.start(now);

        musicSource.onended = () => {
          if (this.activeMusicSource === musicSource) {
            this.activeMusicSource = null;
            this.isPlaying = false;
            console.log('[AudioEngine] Master track playback completed naturally');
            if (this.onEndedCallback) this.onEndedCallback();
          }
        };
      }
    } catch (err) {
      console.error('[AudioEngine] Playback failed in DJ engine:', err);
      this.isPlaying = false;
      throw err;
    }
  }

  public pause() {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend().catch((e) => console.warn('Pause error:', e));
      this.isPlaying = false;
    }
  }

  public resume() {
    this.unlock();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch((e) => console.warn('Resume error:', e));
      this.isPlaying = true;
    }
  }

  public stop() {
    if (this.activeGreetingSource) {
      try {
        this.activeGreetingSource.onended = null;
        this.activeGreetingSource.stop();
        this.activeGreetingSource.disconnect();
      } catch {}
      this.activeGreetingSource = null;
    }

    if (this.activeMusicSource) {
      try {
        this.activeMusicSource.onended = null;
        this.activeMusicSource.stop();
        this.activeMusicSource.disconnect();
      } catch {}
      this.activeMusicSource = null;
    }

    this.isPlaying = false;
  }
}
