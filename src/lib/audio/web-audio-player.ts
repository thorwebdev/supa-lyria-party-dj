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

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.audioCtx.currentTime);

      this.musicGain = this.audioCtx.createGain();
      this.greetingGain = this.audioCtx.createGain();

      // Routing:
      // musicSource -> musicGain -> analyser -> masterGain -> destination
      // greetingSource -> greetingGain -> analyser -> masterGain -> destination
      this.musicGain.connect(this.analyser);
      this.greetingGain.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
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
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.audioCtx.currentTime, 0.05);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private async fetchAndDecode(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load audio from ${url}`);
    const arrayBuffer = await res.arrayBuffer();
    if (!this.audioCtx) throw new Error('AudioContext not ready');
    return await this.audioCtx.decodeAudioData(arrayBuffer);
  }

  /**
   * Chains greeting voiceover smoothly into the music drop:
   * 1. Plays greeting voiceover
   * 2. Starts music in background with volume ducked (15%)
   * 3. At greeting conclusion, ramps music to 100% on the beat drop!
   */
  public async playTrack(
    musicUrl: string,
    greetingUrl?: string | null
  ): Promise<void> {
    this.stop();
    this.initContext();

    if (!this.audioCtx || !this.musicGain || !this.greetingGain) return;

    try {
      console.log('Loading track audio assets...');
      const [musicBuffer, greetingBuffer] = await Promise.all([
        this.fetchAndDecode(musicUrl),
        greetingUrl ? this.fetchAndDecode(greetingUrl).catch(() => null) : Promise.resolve(null),
      ]);

      const now = this.audioCtx.currentTime;
      this.isPlaying = true;
      if (this.onTrackStartedCallback) this.onTrackStartedCallback();

      if (greetingBuffer) {
        // --- Chained Greeting -> Music Drop Sequence ---
        const greetingDuration = greetingBuffer.duration;
        console.log(`Chaining greeting (${greetingDuration.toFixed(1)}s) into music track`);

        // Create sources
        const greetingSource = this.audioCtx.createBufferSource();
        greetingSource.buffer = greetingBuffer;
        greetingSource.connect(this.greetingGain);

        const musicSource = this.audioCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.connect(this.musicGain);

        this.activeGreetingSource = greetingSource;
        this.activeMusicSource = musicSource;

        // Greeting Gain: full volume
        this.greetingGain.gain.setValueAtTime(1.0, now);

        // Music Gain: starts ducked at 0.12, ramps up dynamically right as speech ends
        const dropLeadTime = Math.min(1.0, greetingDuration * 0.4);
        const dropPoint = now + greetingDuration - dropLeadTime;

        this.musicGain.gain.setValueAtTime(0.12, now);
        // Start ramping up just before greeting ends
        this.musicGain.gain.setValueAtTime(0.12, dropPoint);
        this.musicGain.gain.linearRampToValueAtTime(1.0, now + greetingDuration + 0.2);

        // Start greeting now
        greetingSource.start(now);
        // Start music track slightly overlapping with ducked intro
        musicSource.start(now);

        musicSource.onended = () => {
          this.isPlaying = false;
          if (this.onEndedCallback) this.onEndedCallback();
        };
      } else {
        // --- Direct Music Playback ---
        const musicSource = this.audioCtx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.connect(this.musicGain);
        this.activeMusicSource = musicSource;

        this.musicGain.gain.setValueAtTime(1.0, now);
        musicSource.start(now);

        musicSource.onended = () => {
          this.isPlaying = false;
          if (this.onEndedCallback) this.onEndedCallback();
        };
      }
    } catch (err) {
      console.error('Playback failed in DJ engine:', err);
      this.isPlaying = false;
      throw err;
    }
  }

  public pause() {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
      this.isPlaying = false;
    }
  }

  public resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
      this.isPlaying = true;
    }
  }

  public stop() {
    if (this.activeGreetingSource) {
      try {
        this.activeGreetingSource.stop();
        this.activeGreetingSource.disconnect();
      } catch {}
      this.activeGreetingSource = null;
    }

    if (this.activeMusicSource) {
      try {
        this.activeMusicSource.stop();
        this.activeMusicSource.disconnect();
      } catch {}
      this.activeMusicSource = null;
    }

    this.isPlaying = false;
  }
}
