import { SongRequest, EventSession } from '@/types';

/**
 * In-memory fallback store for development and demo mode when Supabase is not configured
 */
class InMemoryPartyStore {
  private session: EventSession = {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Neon Cyber Rave DJ Stage',
    is_active: true,
    min_donation_cents: 200,
    current_track_id: null,
    created_at: new Date().toISOString(),
  };

  private requests: Map<string, SongRequest> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Seed with two demo requests for immediate rich visualization
    this.addSeedRequests();
  }

  private addSeedRequests() {
    const seed1: SongRequest = {
      id: 'demo-req-1',
      session_id: this.session.id,
      user_id: 'user-vip-1',
      user_name: 'Alex Cyber',
      user_avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
      prompt: 'Dark euphoric synthwave with heavy analog bassline and soaring neon arpeggios',
      genres: ['Cyberpunk Synthwave'],
      greeting_text: 'Shoutout to the front row crew! Let\'s ignite the rave tonight!',
      voice_persona: 'hype_mc',
      donation_amount_cents: 1000,
      stripe_payment_intent_id: 'pi_demo_1',
      status: 'ready',
      music_url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=cyberpunk-2099-10701.mp3',
      greeting_url: '',
      lyrics: 'Neon lights flashing through the rain / Synthesizers running through my veins / Drop the beat and feel the sound!',
      duration_seconds: 45,
      queue_position: 1,
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      approved_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    };

    const seed2: SongRequest = {
      id: 'demo-req-2',
      session_id: this.session.id,
      user_id: 'user-vip-2',
      user_name: 'Elena Vance',
      user_avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Elena',
      prompt: 'Hypnotic melodic techno with driving kick, rolling percussion and dreamy pads',
      genres: ['Melodic Techno'],
      greeting_text: 'Happy 25th birthday Maya! This one is for you!',
      voice_persona: 'radio_host',
      donation_amount_cents: 500,
      stripe_payment_intent_id: 'pi_demo_2',
      status: 'pending_approval',
      created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    };

    this.requests.set(seed1.id, seed1);
    this.requests.set(seed2.id, seed2);
  }

  public getSession(): EventSession {
    return { ...this.session };
  }

  public updateSession(updates: Partial<EventSession>): EventSession {
    this.session = { ...this.session, ...updates };
    this.notify();
    return { ...this.session };
  }

  public getRequests(): SongRequest[] {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public getRequest(id: string): SongRequest | undefined {
    return this.requests.get(id);
  }

  public insertRequest(req: SongRequest): SongRequest {
    this.requests.set(req.id, req);
    this.notify();
    return req;
  }

  public updateRequest(id: string, updates: Partial<SongRequest>): SongRequest | undefined {
    const existing = this.requests.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.requests.set(id, updated);
    this.notify();
    return updated;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    });
  }
}

// Global singleton across requests in development
const globalForStore = globalThis as unknown as { mockPartyStore?: InMemoryPartyStore };
export const mockPartyStore = globalForStore.mockPartyStore ?? new InMemoryPartyStore();
if (process.env.NODE_ENV !== 'production') globalForStore.mockPartyStore = mockPartyStore;
