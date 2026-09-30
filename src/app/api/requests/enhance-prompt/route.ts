import { NextResponse } from 'next/server';
import { enhancePrompt } from '@/lib/gemini/client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, genres } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const enhanced = await enhancePrompt(prompt.trim(), Array.isArray(genres) ? genres : []);
    return NextResponse.json({ enhancedPrompt: enhanced });
  } catch (err: unknown) {
    console.error('Enhance prompt error:', err);
    return NextResponse.json({ error: 'Failed to enhance prompt' }, { status: 500 });
  }
}
