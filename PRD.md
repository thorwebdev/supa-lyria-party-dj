# Product Requirements Document (PRD)
## Supa Lyria Party DJ — Collaborative AI DJ System

---

## 1. Executive Summary

**Supa Lyria Party DJ** is a futuristic, collaborative web application that turns any venue into an interactive AI-driven music experience. A DJ controls the continuous audio stream through a cyber-aesthetic master console plugged into the sound system. In the crowd, partygoers scan a QR code on their phones, log in with Google, and submit custom song prompts with personalized shoutout greetings and Stripe donations (supporting Apple Pay & Google Pay).

The DJ curates incoming requests in real-time. Once the DJ approves a submission, Google DeepMind's **Lyria 3.5** generates the full music track while **Gemini 3.8 Flash-Lite TTS** synthesizes the voice greeting. The audience member's payment authorization is captured only upon successful generation. The master DJ audio engine then chains the greeting voiceover seamlessly into the music track's drop in a continuous party queue.

---

## 2. Core Architecture & System Flow

```
[ Audience Phone ]                    [ Supabase ]                      [ DJ Master Console ]
       |                                   |                                     |
 1. Scan QR / Login (Google)               |                                     |
 2. Craft Prompt & Greeting                |                                     |
 3. Authorize Donation (Stripe Hold)       |                                     |
 4. Insert Request ----------------------> | (status: 'pending_approval')        |
                                           | --- Realtime Notification --------> |
                                           |                               5. Review Request
                                           |                                  [Approve] or [Decline]
                                           | <--- Update ('approved') ---------- |
                                           |                                     |
                                   6. Background Worker / Edge API               |
                                      - Generate Music (Lyria 3.5)               |
                                      - Generate Voiceover (Gemini TTS)          |
                                      - Store files in Supabase Storage          |
                                      - Capture Stripe PaymentIntent             |
                                      - Update status: 'ready'                   |
                                           |                                     |
                                           | --- Realtime Update --------------> |
                                           |                               7. Add to Play Queue
                                           |                               8. Master Web Audio Engine
                                           |                                  plays Voiceover -> Music Drop
                                           | <--- Now Playing broadcast -------- |
 9. Live Party Feed / Visualizer <-------- |
```

---

## 3. User Roles & Experiences

### 3.1. DJ (Master Operator)
- **Access Route**: `/dj` protected by a configurable **DJ Secret PIN / Key** stored in environment variables.
- **Master Audio Engine**: The browser running the DJ console is the sole source of master venue audio (connected via 3.5mm/USB/Bluetooth to PA system/speakers).
- **Control Layout**:
  - **Live Player Deck**: Continuous stream player featuring active track title, submitter credit, live audio waveform visualizer (Web Audio API `AnalyserNode`), play/pause, volume fader, and skip controls.
  - **Incoming Request Deck**: Review queue displaying submitter avatar/name, prompt, genre pills, greeting text, and donation amount with one-click **[Approve & Generate]** and **[Decline]** actions.
  - **Ready / Play Queue**: Drag-and-drop sortable queue of generated tracks waiting to drop next. Includes audio preview (pre-cueing) before queuing.
  - **Venue QR Code Modal**: Quick display and projection view of the event QR code for audience onboarding.

### 3.2. Audience (Partygoers)
- **Access Route**: `/` (Mobile-optimized responsive web app accessed via venue QR code).
- **Authentication**: Lightweight Google OAuth sign-in powered by Supabase Auth.
- **Guided Hybrid Prompting**:
  - **Text Prompt**: Natural language description (e.g., *"Dark melodic synthwave with driving 80s bassline"*).
  - **Vibe & Genre Pills**: Quick-tap chips for immediate inspiration (e.g., *House, Techno, Synthwave, Afrobeat, Drum & Bass, Nu-Disco, 124 BPM, 128 BPM, Euphoric, Dark*).
  - **"Enhance with Gemini"**: One-click AI prompt expansion that crafts rich, rhythmically coherent musical prompts from brief user ideas.
  - **Greeting / Shoutout**: Text field for personal message (e.g., *"Big shoutout to Sarah celebrating her 30th birthday tonight!"*) with selectable DJ voice personas (e.g., *Hype MC, Deep Radio, Cyber DJ*).
  - **Donation Slider / Input**: Configurable minimum donation (default: $2.00) with quick bump buttons ($5, $10, $20) and custom input.
  - **Payment**: Seamless checkout using Stripe Elements supporting Apple Pay, Google Pay, and credit/debit cards.
- **Live Party Screen**:
  - **Now Playing**: Live visualizer syncing to the venue vibe, displaying current track info, AI prompt, and audience shoutout.
  - **Up Next**: Real-time ticker of approved upcoming tracks.
  - **My Requests Tracker**: Real-time status tracker for the user's submissions:
    - `Authorizing` $\rightarrow$ `Pending DJ Review` $\rightarrow$ `Generating Audio` $\rightarrow$ `In Play Queue (#X)` $\rightarrow$ `Now Playing` $\rightarrow$ `Completed` (or `Declined / Released`).

---

## 4. Payment & Financial Workflow (Stripe)

1. **Authorization on Submission**:
   - When an attendee submits a song request, the backend creates a Stripe `PaymentIntent` with `capture_method: 'manual'`.
   - The user authorizes the payment via Apple Pay, Google Pay, or card. The funds are placed on a pre-authorization hold.
2. **Capture on Generation Success**:
   - The charge is **NOT** captured upon DJ approval alone.
   - When the DJ clicks **Approve**, the generation pipeline initiates. Only after both `lyria-3.5` and `gemini-3.8-flash-lite-tts` succeed and files are saved to Supabase Storage does the backend call `stripe.paymentIntents.capture()`.
3. **Cancellation & Release**:
   - If the DJ **Declines** the request, or if generation fails permanently, the authorization hold is immediately cancelled via `stripe.paymentIntents.cancel()`. The attendee is never charged.
4. **Global Toggle via Environment Variable (`ENABLE_PAYMENTS`)**:
   - Payments can be globally toggled off by setting `NEXT_PUBLIC_ENABLE_PAYMENTS=false` (and `ENABLE_PAYMENTS=false`).
   - **When disabled ("Free Party Mode")**:
     - The donation UI and Stripe Elements are completely hidden on the audience submission screen.
     - Submissions bypass Stripe entirely; requests are created with `donation_amount_cents = 0` and `stripe_payment_intent_id = null`.
     - Upon DJ approval, generation triggers immediately without any payment capture calls.
     - Allows frictionless testing, private events, or parties where song requests are free.

---

## 5. AI Audio Generation & Assembly Pipeline

### 5.1. Music Generation (`lyria-3.5`)
- Model: Google DeepMind `lyria-3.5` via Gemini API.
- Input: Assembled musical prompt containing user prompt, selected genre/vibe pills, and BPM guidance.
- Output: High-fidelity stereo audio stream/file.
- Persistence: Uploaded to Supabase Storage bucket (`tracks/music/{request_id}.mp3`).

### 5.2. Voiceover Synthesis (`gemini-3.8-flash-lite-tts`)
- Model: `gemini-3.8-flash-lite-tts` via Gemini API.
- Input: Audience greeting message styled for DJ MC delivery.
- Voice selection: Selectable DJ persona voice presets (e.g., energetic club host, smooth late-night selector, robotic synth voice).
- Output: Clear vocal speech audio file.
- Persistence: Uploaded to Supabase Storage bucket (`tracks/greetings/{request_id}.mp3`).

### 5.3. Client-Side Web Audio Chained Playback
- Master audio output engine is built with the **Web Audio API** (`AudioContext`, `GainNode`, `AnalyserNode`).
- **Sequential Playback with Intro Ducking**:
  1. The greeting voiceover track begins playback.
  2. As the greeting approaches its conclusion, the Lyria music track starts fading in (intro swell).
  3. When the greeting finishes, the music volume cuts to full 100% on the beat drop.
  4. Avoids complex server-side ffmpeg transcoding overhead and ensures immediate real-time response.

---

## 6. Technical Stack & Architecture

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js (App Router, React 19, TypeScript) | Full-stack server and client architecture |
| **Styling & UI** | Tailwind CSS + shadcn/ui | Modern, cyber/futuristic type-centric UI design |
| **Database & Auth** | Supabase (PostgreSQL + Supabase Auth) | Relational data, Google OAuth, RLS security policies |
| **Storage** | Supabase Storage | High-speed CDN bucket for generated audio files |
| **Realtime Sync** | Supabase Realtime (Postgres Changes) | Instant live updates across DJ console and audience phones |
| **AI Models** | Google Gemini API (`lyria-3.5`, `gemini-3.8-flash-lite-tts`, Gemini 2.5 Flash for prompt enhancement) | Audio generation, vocal synthesis, and prompt enhancement |
| **Payments** | Stripe (`@stripe/stripe-js`, `stripe` node SDK) | Apple Pay, Google Pay, manual capture payment authorizations (toggleable) |
| **Audio Engine** | Web Audio API (`AudioContext`, Canvas Visualizer) | Client-side chained playback, smooth transitions, frequency visualizer |

---

## 7. Database Schema & Supabase Configuration

### 7.1. Tables

#### `public.event_sessions`
Represents the active party session.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `title` (text, not null)
- `is_active` (boolean, default true)
- `min_donation_cents` (integer, default 200)
- `current_track_id` (uuid, references `song_requests(id)`, nullable)
- `created_at` (timestamptz, default `now()`)

#### `public.song_requests`
Stores every song prompt and submission.
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `session_id` (uuid, references `event_sessions(id)`, not null)
- `user_id` (uuid, references `auth.users(id)`, not null)
- `user_name` (text, not null)
- `user_avatar_url` (text, nullable)
- `prompt` (text, not null)
- `genres` (text[], default '{}')
- `greeting_text` (text, not null)
- `voice_persona` (text, default 'hype_mc')
- `donation_amount_cents` (integer, default 0)
- `stripe_payment_intent_id` (text, nullable)
- `status` (text, check in: `'pending_approval'`, `'generating'`, `'ready'`, `'playing'`, `'played'`, `'declined'`, `'failed'`)
- `music_storage_path` (text, nullable)
- `greeting_storage_path` (text, nullable)
- `queue_position` (integer, nullable)
- `created_at` (timestamptz, default `now()`)
- `approved_at` (timestamptz, nullable)
- `played_at` (timestamptz, nullable)

### 7.2. Storage Buckets
- `tracks`: Public or signed URL bucket with folders `music/` and `greetings/`.

### 7.3. Realtime Enablement
- Enable Supabase Realtime for table `song_requests` and `event_sessions` for instant live sync.

---

## 8. Security & Moderation

1. **DJ Protection**:
   - DJ operations (approving requests, skipping tracks, capturing payments) require the secret DJ PIN passed in an HTTP header (`x-dj-pin`) or session cookie verified server-side against `DJ_SECRET_PIN`.
2. **Content Moderation**:
   - Prompts and greeting texts are analyzed via Gemini safety attributes upon submission to prevent abusive, hateful, or explicit content from reaching the DJ screen or sound system.
3. **Database RLS**:
   - Attendees can only view public request metadata and their own payment information.
   - Updates to `status` and `queue_position` can only be performed by service role / DJ endpoint.

---

## 9. Design & Aesthetic Guidelines

- **Theme**: Cyber-club futuristic dark mode (`#0B0D13` background, electric neon accents `#00F0FF` cyan, `#FF007A` magenta, and `#7000FF` ultraviolet).
- **Typography**: Space Grotesk / Outfit for bold, modern headings; JetBrains Mono for technical DJ BPM/status metrics; Inter for legibility.
- **Motion & Visuals**: Fluid dynamic waveform visualizer responding to Web Audio frequencies, glowing glassmorphic panels, and smooth micro-transitions.
- **Mobile First for Audience**: One-handed ergonomic card interface with large thumb targets for swift submissions in a bustling venue.

---

## 10. Environment Variables Reference

| Variable Name | Client / Server | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Yes | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Yes | Supabase Anon Key for client queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes | Supabase Service Role Key for privileged DJ and background tasks |
| `GEMINI_API_KEY` | Server only | Yes | Google Gemini API key for `lyria-3.5`, `gemini-3.8-flash-lite-tts`, and enhancement |
| `DJ_SECRET_PIN` | Server only | Yes | Secret master PIN to unlock the `/dj` controller console (e.g. `4242`) |
| `NEXT_PUBLIC_ENABLE_PAYMENTS` | Client & Server | No (Default `true`) | Global toggle for payments (`true` or `false`). When `false`, requests are free and Stripe is bypassed. |
| `ENABLE_PAYMENTS` | Server only | No (Default `true`) | Server-side verification for `NEXT_PUBLIC_ENABLE_PAYMENTS` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client & Server | If payments enabled | Stripe publishable key for Stripe Elements |
| `STRIPE_SECRET_KEY` | Server only | If payments enabled | Stripe secret key for PaymentIntent create/capture/cancel |
| `STRIPE_WEBHOOK_SECRET` | Server only | Optional | Stripe webhook signing secret |

