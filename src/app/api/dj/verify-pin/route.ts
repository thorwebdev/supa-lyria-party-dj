import { NextResponse } from 'next/server';

const DJ_SECRET_PIN = process.env.DJ_SECRET_PIN || '4242';

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();

    if (!pin || pin.toString().trim() !== DJ_SECRET_PIN.toString().trim()) {
      return NextResponse.json({ success: false, error: 'Invalid DJ PIN' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, message: 'DJ authenticated' });

    // Set secure HTTP-only cookie for session persistence
    response.cookies.set('dj_authorized', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    console.error('DJ PIN verification error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
