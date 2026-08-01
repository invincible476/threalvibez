import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const room = req.nextUrl.searchParams.get('room') || 'default-room';
    const username = req.nextUrl.searchParams.get('username') || `user_${Math.random().toString(36).substring(7)}`;
    const identity = req.nextUrl.searchParams.get('identity') || username;

    const apiKey = process.env.LIVEKIT_API_KEY || 'APId25jaZKgoP5t';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'JEJfZvN4S7saeK1Q94DKfLskk10JD0l7V319EanBweiB';
    const wsUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://omegaone-7kb381s3.livekit.cloud';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: identity,
      name: username,
      ttl: '1h',
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token, wsUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}
