# Supa Lyria Party DJ 🎛️⚡

A futuristic, collaborative AI DJ controller system built for live parties, clubs, and raves.

The DJ controls the continuous audio stream through a cyber-aesthetic master console plugged into the venue sound system. In the crowd, attendees scan a QR code on their mobile phones, submit custom song prompts with personalized shoutout greetings, and include optional Stripe tips (Apple Pay, Google Pay, and cards).

Once the DJ approves a submission, **Google DeepMind Lyria 3.5** generates the full music track, **Gemini 3.8 Flash-Lite TTS** synthesizes the DJ shoutout voiceover, and the attendee's payment is captured. The master DJ audio engine then chains the greeting voiceover seamlessly into the music drop with live audio spectrum visualizers!

---

## ⚡ Quickstart (Instant Local Demo Mode)

You can run the entire app locally right now—**even before configuring external keys**. The system includes built-in fallback audio synthesis and an in-memory party store so you can explore the DJ booth and crowd flow immediately:

```bash
# 1. Clone & install dependencies
npm install

# 2. Launch development server
npm run dev
```

- **Audience Mobile Web App**: [http://localhost:3000](http://localhost:3000)
- **DJ Master Console**: [http://localhost:3000/dj](http://localhost:3000/dj) *(Default Booth PIN: `4242`)*

---

## 🚀 Step 1: Setting Up Your Supabase Project

Supa Lyria Party DJ uses **Supabase** for PostgreSQL data storage, Realtime synchronization between the crowd and the DJ booth, and high-speed audio file hosting.

You can initialize and manage your Supabase database either **programmatically via the Supabase CLI** (recommended) or via the **Web Dashboard**.

---

### Option A: Programmatic Setup via Supabase CLI (Recommended)

The project includes the Supabase CLI pre-configured with `supabase/config.toml` and npm helper scripts.

#### 1. Log in to Supabase CLI
```bash
npm run supabase:login
# Or export SUPABASE_ACCESS_TOKEN=sbp_...
```

#### 2. Link Your Remote Project & Push Database Migrations
Get your **Project Reference ID** from your Supabase Dashboard URL (`https://supabase.com/dashboard/project/<your-project-id>`):

```bash
# Link the project
npx supabase link --project-ref <your-project-id>

# Push the migration directly to your live database
npm run supabase:push
```
This automatically executes [`supabase/migrations/20260930000000_init_party_dj.sql`](./supabase/migrations/20260930000000_init_party_dj.sql), creating the tables, RLS policies, indexes, Realtime replication, and the `tracks` storage bucket!

#### 3. Automatically Generate TypeScript Types
You can generate full TypeScript definitions directly from your live schema:
```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

#### 4. (Optional) Run 100% Locally with Docker
If you have Docker installed and prefer running Supabase on your own machine without creating a cloud project:
```bash
# Starts local Postgres, Storage, Auth, Realtime, and Studio
npm run supabase:start

# View local credentials (API URL, anon key, service_role key)
npm run supabase:status

# When finished:
npm run supabase:stop
```
The local studio is accessible at `http://127.0.0.1:54323`.

---

### Option B: Web Dashboard SQL Editor (Manual 1-Click)

If you prefer not using the CLI:

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard) and create a **New Project**.
2. Open the **SQL Editor** tab from the left sidebar and click **"New query"**.
3. Copy the entire contents of [`supabase/migrations/20260930000000_init_party_dj.sql`](./supabase/migrations/20260930000000_init_party_dj.sql).
4. Paste the SQL into the editor and click **"Run"** (`Cmd/Ctrl + Enter`).

#### What this migration sets up:
- **`public.event_sessions`**: Tracks the active party room and the currently playing track pointer.
- **`public.song_requests`**: Stores song prompts, shoutout greetings, DJ voice personas, queue positions, donation amounts, and audio URLs.
- **Performance Indexes**: Multi-column indexes on `(session_id, status)` and queue order.
- **Row Level Security (RLS)**: Public read/insert policies for attendees and protected updates for DJ actions.
- **Storage Bucket (`tracks`)**: Creates a public CDN bucket for generated audio files with folders `music/` and `greetings/`.
- **Realtime Replication**: Adds tables to `supabase_realtime` publication for instant zero-latency updates.

### 1.3 Copy Your API Credentials
Navigate to **Project Settings** $\rightarrow$ **API**:
- Copy **Project URL** $\rightarrow$ `NEXT_PUBLIC_SUPABASE_URL`
- Copy **Project API keys** $\rightarrow$ `anon` / `public` $\rightarrow$ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **Project API keys** $\rightarrow$ `service_role` (secret) $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY`

---

## 💳 Step 2: Setting Up Stripe (Apple Pay & Google Pay)

The app features a **pre-authorization hold architecture**: when an attendee submits a song request, funds are placed on a temporary authorization hold. The customer is **only charged if and when the DJ approves the track and AI generation succeeds**. If declined, the hold is released immediately.

### 2.1 Get Your Stripe API Keys
1. Log into the [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) (enable **Test mode** for development).
2. Copy your **Publishable key** (`pk_test_...`) $\rightarrow$ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Copy your **Secret key** (`sk_test_...`) $\rightarrow$ `STRIPE_SECRET_KEY`

### 2.2 Enable Apple Pay & Google Pay
1. Go to **Settings** $\rightarrow$ **Payment methods** in Stripe.
2. Ensure **Apple Pay** and **Google Pay** are turned on.
3. For custom production domains, register your domain under **Settings** $\rightarrow$ **Payment method domains**.

### 2.3 Free Party Mode (Disable Payments Globally)
If you want to run a private party or test without Stripe:
```env
NEXT_PUBLIC_ENABLE_PAYMENTS=false
ENABLE_PAYMENTS=false
```
When set to `false`, the donation interface and Stripe sheets are completely hidden, submissions are 100% free, and requests skip payment capture.

### 2.4 (Optional) Stripe CLI for Local Testing
You can monitor authorization holds and captures programmatically with the [Stripe CLI](https://docs.stripe.com/stripe-cli):
```bash
# Login to Stripe account
stripe login

# Real-time event listener for payment intents and captures
stripe listen --events payment_intent.amount_capturable_updated,payment_intent.succeeded
```

---

## 🤖 Step 3: Setting Up Google Gemini API

Google's Gemini API powers three core AI workflows:
1. **Lyria 3.5 (`lyria-3.5`)**: High-fidelity stereo dance track composition from prompt, genre, and BPM signals.
2. **Gemini 3.8 Flash-Lite TTS (`gemini-3.8-flash-lite-tts`)**: Expressive DJ MC voiceover greeting synthesis with selectable voice personas (`Puck`, `Fenrir`, `Aoede`, `Kore`).
3. **Prompt Enhancement (`gemini-3.8-flash`)**: "✨ Enhance with Gemini" button that transforms brief crowd ideas into club prompts.

### 3.1 Get Your API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **"Create API Key"** and copy the key into `GEMINI_API_KEY`.

---

## ⚙️ Step 4: Configuring Environment Variables

Create a file named `.env.local` in your project root (or copy `.env.example`):

```bash
cp .env.example .env.local
```

Fill in your keys:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Google Gemini API
GEMINI_API_KEY=AIzaSy...

# DJ Console Security (PIN to unlock /dj)
DJ_SECRET_PIN=4242

# Global Payments Toggle
NEXT_PUBLIC_ENABLE_PAYMENTS=false
ENABLE_PAYMENTS=false

# Stripe (Required if ENABLE_PAYMENTS=true)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

---

## 🎧 DJ Booth Operation & Venue Guide

### 1. Connecting Master Sound
- Open the DJ console at `/dj` on the laptop or iPad connected to your venue's PA system/speakers via 3.5mm AUX, USB audio interface, or Bluetooth.
- Enter your master PIN (default: `4242`).
- The browser tab running `/dj` is the **exclusive source of master audio** for the room. Audience mobile phones display visualizers and track information without outputting sound.

### 2. Displaying the Venue QR Code
- Click the **"VENUE QR"** button in the top navigation bar of the DJ console.
- Project this onto a club screen/TV or print the link for attendees to scan from their phones.

### 3. Reviewing & Dropping Tracks
1. When an attendee submits a request, it appears in the **"Incoming Audience Requests"** review deck on the left.
2. Review the submitter name, donation amount, prompt, and shoutout.
3. Click **"APPROVE & GENERATE"**:
   - Lyria 3.5 and Gemini TTS generate the audio in parallel.
   - The audio files upload to your Supabase Storage bucket.
   - The Stripe pre-authorization hold is captured.
   - The track moves into the **"Ready Queue"** on the right.
4. When the currently playing track finishes (or if you click **"DROP NOW"** / **"SKIP NEXT"**):
   - The Web Audio engine automatically plays the shoutout voiceover.
   - As the shoutout reaches its climax, the music fades in smoothly and drops the full beat at 100% volume.
   - The live frequency spectrum visualizer pulses in real time.

---

## 🛠️ Tech Stack Architecture

| Layer | Technology |
|---|---|
| **Framework** | Next.js (App Router, React 19, TypeScript) |
| **Styling** | Tailwind CSS v4, Cyber Dark Theme, Custom Neon Glows |
| **Typography** | Outfit, Space Grotesk, JetBrains Mono |
| **Database & Auth** | Supabase (PostgreSQL, RLS, Realtime Sync) |
| **Storage** | Supabase Storage (`tracks` CDN bucket) |
| **AI Models** | Google DeepMind `lyria-3.5`, `gemini-3.8-flash-lite-tts`, `gemini-3.8-flash` |
| **Payments** | Stripe Elements (Apple Pay, Google Pay, manual capture holds) |
| **Audio Engine** | Web Audio API (`AudioContext`, `GainNode`, `AnalyserNode`) |

---

## 🧪 Testing & Verification Commands

```bash
# Run lint check (ESLint)
npm run lint

# Run production build validation
npm run build

# Start production server
npm run start
```
