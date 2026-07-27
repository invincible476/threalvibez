import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);

  // Skip logging internal Next.js static asset requests
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg')
  ) {
    return response;
  }

  const duration = Date.now() - start;
  const accessLog = {
    timestamp: new Date().toISOString(),
    requestId,
    method: request.method,
    path: pathname,
    query: request.nextUrl.search,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1',
    userAgent: request.headers.get('user-agent') || 'unknown',
    durationMs: duration,
  };

  // Structured logging for server access
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[ACCESS] ${request.method} ${pathname} ${duration}ms - ReqId: ${requestId}`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files and _next resources.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
