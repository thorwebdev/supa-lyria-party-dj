export type SongStatus =
  | 'pending_approval'
  | 'generating'
  | 'ready'
  | 'playing'
  | 'played'
  | 'declined'
  | 'failed';

export type VoicePersonaId = 'hype_mc' | 'radio_host' | 'cyber_synth' | 'smooth_selector';

export interface VoicePersona {
  id: VoicePersonaId;
  name: string;
  description: string;
  geminiVoice: string; // Puck, Fenrir, Aoede, Kore
  styleHint: string;
}

export const VOICE_PERSONAS: Record<VoicePersonaId, VoicePersona> = {
  hype_mc: {
    id: 'hype_mc',
    name: 'Hype MC',
    description: 'High energy festival host hyping up the crowd',
    geminiVoice: 'Puck',
    styleHint: 'energetic, loud, charismatic festival DJ hype host, hyping up the crowd on the mic',
  },
  radio_host: {
    id: 'radio_host',
    name: 'Club Radio',
    description: 'Smooth late-night FM DJ with warm bass tones',
    geminiVoice: 'Fenrir',
    styleHint: 'warm, resonant, deep-voiced late night electronic radio DJ host',
  },
  cyber_synth: {
    id: 'cyber_synth',
    name: 'Cyber Android',
    description: 'Futuristic AI synth vocal with glitchy robotic charm',
    geminiVoice: 'Aoede',
    styleHint: 'crisp, futuristic, slightly robotic AI club companion',
  },
  smooth_selector: {
    id: 'smooth_selector',
    name: 'Velvet Lounge',
    description: 'Chilled, sophisticated underground selector',
    geminiVoice: 'Kore',
    styleHint: 'relaxed, ultra-chill, velvety underground techno club selector',
  },
};

export interface EventSession {
  id: string;
  title: string;
  is_active: boolean;
  min_donation_cents: number;
  current_track_id?: string | null;
  created_at: string;
}

export interface SongRequest {
  id: string;
  session_id: string;
  user_id?: string | null;
  user_name: string;
  user_avatar_url?: string | null;
  prompt: string;
  genres: string[];
  greeting_text: string;
  voice_persona: VoicePersonaId;
  donation_amount_cents: number;
  stripe_payment_intent_id?: string | null;
  status: SongStatus;
  music_storage_path?: string | null;
  greeting_storage_path?: string | null;
  music_url?: string | null;
  greeting_url?: string | null;
  lyrics?: string | null;
  duration_seconds?: number;
  queue_position?: number | null;
  error_message?: string | null;
  created_at: string;
  approved_at?: string | null;
  played_at?: string | null;
}

export const GENRE_PRESETS = [
  { label: 'Cyberpunk Synthwave', vibe: '128 BPM, analog arps, retrofuturistic, neon night drive' },
  { label: 'Melodic Techno', vibe: '124 BPM, deep bass, hypnotic leads, afterhours warehouse' },
  { label: 'Futuristic House', vibe: '126 BPM, bouncy groove, vocal chops, festival mainstage' },
  { label: 'Liquid Drum & Bass', vibe: '174 BPM, rolling breaks, lush atmospheric chords' },
  { label: 'Afro House', vibe: '122 BPM, tribal percussion, warm organic marimbas' },
  { label: 'Hardstyle Rave', vibe: '150 BPM, distorted kicks, euphoric anthem melody' },
  { label: 'Nu-Disco Funk', vibe: '118 BPM, slap bass, disco strings, glitter ball euphoria' },
  { label: 'Trap EDM Drop', vibe: '140 BPM, heavy 808 sub, brass stabs, festival hype' },
];
