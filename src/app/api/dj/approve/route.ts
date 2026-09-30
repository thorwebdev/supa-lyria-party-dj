import { NextResponse } from 'next/server';
import {
  dbGetSongRequest,
  dbUpdateSongRequest,
  dbGetSongRequests,
  uploadAudioToStorage,
} from '@/lib/supabase/admin';
import { generateLyriaMusic, generateGreetingTTS } from '@/lib/gemini/client';
import { capturePaymentHold, cancelPaymentHold } from '@/lib/stripe/server';

const DJ_SECRET_PIN = process.env.DJ_SECRET_PIN || '4242';

function isAuthorizedDJ(req: Request): boolean {
  const pinHeader = req.headers.get('x-dj-pin');
  if (pinHeader && pinHeader === DJ_SECRET_PIN) return true;

  const cookieHeader = req.headers.get('cookie') || '';
  if (cookieHeader.includes('dj_authorized=true')) return true;

  return false;
}

export async function POST(req: Request) {
  if (!isAuthorizedDJ(req)) {
    return NextResponse.json({ error: 'Unauthorized DJ action' }, { status: 401 });
  }

  try {
    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }

    const songReq = await dbGetSongRequest(requestId);
    if (!songReq) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (songReq.status !== 'pending_approval' && songReq.status !== 'failed') {
      return NextResponse.json({ error: `Cannot approve request with status: ${songReq.status}` }, { status: 400 });
    }

    // 1. Set status to generating
    await dbUpdateSongRequest(requestId, { status: 'generating', error_message: null });

    try {
      console.log(`Starting AI audio generation for request ${requestId}...`);

      // 2. Parallel generation: Greeting TTS (Gemini 3.8 Flash-Lite TTS) + Music (Lyria 3.5)
      const [ttsResult, musicResult] = await Promise.all([
        generateGreetingTTS(songReq.greeting_text, songReq.voice_persona),
        generateLyriaMusic(songReq.prompt, songReq.genres),
      ]);

      // 3. Upload to Supabase Storage
      const greetingPath = `greetings/${requestId}.wav`;
      const musicPath = `music/${requestId}.mp3`;

      const [greetingUrl, musicUrl] = await Promise.all([
        uploadAudioToStorage(ttsResult.audioBuffer, greetingPath, ttsResult.contentType),
        uploadAudioToStorage(musicResult.audioBuffer, musicPath, musicResult.contentType),
      ]);

      // 4. Capture Stripe Payment Hold (only after generation successfully completes!)
      if (songReq.stripe_payment_intent_id) {
        const captured = await capturePaymentHold(songReq.stripe_payment_intent_id);
        if (!captured) {
          console.warn(`Payment capture failed for intent ${songReq.stripe_payment_intent_id}`);
        }
      }

      // 5. Determine queue position
      const allRequests = await dbGetSongRequests(songReq.session_id);
      const readyTracks = allRequests.filter((r) => r.status === 'ready');
      const nextPosition = readyTracks.length + 1;

      // 6. Update database record to 'ready'
      const updated = await dbUpdateSongRequest(requestId, {
        status: 'ready',
        music_storage_path: musicPath,
        greeting_storage_path: greetingPath,
        music_url: musicUrl,
        greeting_url: greetingUrl,
        lyrics: musicResult.lyrics,
        queue_position: nextPosition,
        approved_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, track: updated });
    } catch (genError: unknown) {
      console.error('Generation pipeline failed:', genError);

      // On failure, release payment hold so the crowd member is never charged!
      if (songReq.stripe_payment_intent_id) {
        await cancelPaymentHold(songReq.stripe_payment_intent_id);
      }

      const errorMessage = genError instanceof Error ? genError.message : 'Audio generation failed';
      await dbUpdateSongRequest(requestId, {
        status: 'failed',
        error_message: errorMessage,
      });

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error('Approve endpoint error:', err);
    return NextResponse.json({ error: 'Server error processing approval' }, { status: 500 });
  }
}
