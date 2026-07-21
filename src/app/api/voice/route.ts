import { VoiceSignalingServer } from '@/lib/voice/signaling-server';

const voiceSignalingServer = new VoiceSignalingServer();

export function GET(request: Request) {
  const upgradeHeader = request.headers.get('upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected websocket connection', { status: 426 });
  }

  try {
    // @ts-ignore - Next.js types are not up to date with WebSocket
    const { socket: ws, response } = new WebSocket(request);
    
    // Extract user ID from URL parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      ws.close(4000, 'User ID is required');
      return response;
    }

    // Handle the WebSocket connection
    voiceSignalingServer.handleConnection(ws, userId);

    return response;
  } catch (err) {
    console.error('WebSocket connection error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}