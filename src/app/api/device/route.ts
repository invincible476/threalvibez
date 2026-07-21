import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { getAdminAuth } from '@/lib/firebase-admin';

const zRegisterDeviceRequest = z.object({
  authToken: z.string(), // Firebase ID token
  deviceType: z.enum(['web', 'mobile', 'desktop']).default('web'),
});

// Generate a secure device ID
function generateSecureDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Rate limiting for device registration
const deviceRateLimitStore = new Map<string, { count: number; resetTime: number }>();

function isDeviceRegistrationRateLimited(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxRequests = 3; // Max 3 device registrations per 5 minutes

  const record = deviceRateLimitStore.get(identifier);
  if (!record || now > record.resetTime) {
    deviceRateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}

// Get device info from request headers
function getDeviceInfo(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  // Basic device type detection
  let deviceType: 'web' | 'mobile' | 'desktop' = 'web';
  if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
    deviceType = 'mobile';
  } else if (/Electron/.test(userAgent)) {
    deviceType = 'desktop';
  }

  return {
    userAgent,
    clientIP,
    deviceType,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const parseResult = zRegisterDeviceRequest.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { authToken } = parseResult.data;
    const deviceInfo = getDeviceInfo(request);

    // SECURE TOKEN VERIFICATION - Firebase Admin SDK REQUIRED
    let userId: string;
    let userEmail: string | undefined;
    
    try {
      // Check if Firebase Admin SDK is properly configured
      const hasServiceAccountKey = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const isDevelopment = process.env.NODE_ENV === 'development';
      const allowDevFallback = process.env.ALLOW_DEV_TOKEN_FALLBACK === 'true';
      
      // In production, Firebase service account is MANDATORY
      if (!hasServiceAccountKey && (!isDevelopment || !allowDevFallback)) {
        console.error('🚨 SECURITY ERROR: Firebase service account not configured for secure environment');
        throw new Error('Server configuration error - authentication not properly initialized');
      }
      
      if (hasServiceAccountKey) {
        // SECURE: Use Firebase Admin SDK token verification
        console.log('Using Firebase Admin SDK for secure token verification');
        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(authToken);
        userId = decodedToken.uid;
        userEmail = decodedToken.email;
        
        if (!userId) {
          throw new Error('No user ID in verified token');
        }
      } else if (isDevelopment && allowDevFallback) {
        // DEVELOPMENT ONLY: Minimal fallback with explicit opt-in
        console.warn('⚠️  DEVELOPMENT MODE: Using minimal token validation (EXPLICIT_DEV_FALLBACK_ENABLED)');
        console.warn('⚠️  This configuration is INSECURE and must not be used in production');
        
        // Basic token structure validation
        if (!authToken || typeof authToken !== 'string' || authToken.split('.').length !== 3) {
          throw new Error('Invalid token format');
        }
        
        // Parse token payload (DEVELOPMENT ONLY)
        const payload = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString());
        userId = payload.user_id || payload.sub || payload.uid;
        userEmail = payload.email;
        
        if (!userId) {
          throw new Error('No user ID in token payload');
        }
        
        // Basic expiration check
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          throw new Error('Token has expired');
        }
        
        console.warn(`⚠️  DEV FALLBACK: Processing device registration for user ${userId}`);
      } else {
        // Fail-safe: No fallback allowed
        throw new Error('Firebase Admin SDK not properly configured');
      }
    } catch (error: any) {
      console.error('Token verification error:', error);
      
      // Provide specific error messages for different failure types
      let errorMessage = 'Invalid authentication token';
      let statusCode = 401;
      
      if (error.code === 'auth/id-token-expired') {
        errorMessage = 'Authentication token has expired';
      } else if (error.code === 'auth/id-token-revoked') {
        errorMessage = 'Authentication token has been revoked';
      } else if (error.code === 'auth/invalid-id-token') {
        errorMessage = 'Invalid authentication token format';
      } else if (error.message?.includes('expired')) {
        errorMessage = 'Authentication token has expired';
      } else if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
        errorMessage = 'Server configuration error';
        statusCode = 500;
        console.error('Firebase Admin SDK not properly configured for production');
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      );
    }

    // Rate limiting per user and IP
    const userKey = `user:${userId}`;
    const ipKey = `ip:${deviceInfo.clientIP}`;
    
    if (isDeviceRegistrationRateLimited(userKey) || isDeviceRegistrationRateLimited(ipKey)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Check for existing device ID from secure cookie
    const existingDeviceId = request.cookies.get('deviceId')?.value;
    const deviceId = existingDeviceId || generateSecureDeviceId();
    const isNewDevice = !existingDeviceId;
    
    // Log device registration (include email if available)
    console.log('Device registration request for user:', userId, userEmail ? `(${userEmail})` : '');
    console.log('Device info:', deviceInfo);
    console.log(isNewDevice ? 'Registering new device:' : 'Updating existing device:', deviceId);
    
    // Security audit log for production
    if (process.env.NODE_ENV === 'production') {
      console.log(`SECURITY_AUDIT: Device registration - User: ${userId}, IP: ${deviceInfo.clientIP}, UserAgent: ${deviceInfo.userAgent}`);
    }

    // Create secure device cookie and return success
    const response = NextResponse.json({
      success: true,
      deviceId: deviceId,
      message: isNewDevice ? 'Device registered successfully' : 'Device updated successfully',
    });

    // Set secure cookie with device ID
    response.cookies.set('deviceId', deviceId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: '/',
    });

    return response;
  } catch (error: any) {
    // Handle AbortError (user-initiated cancellations) quietly
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.debug('Device registration request was cancelled by user');
      return NextResponse.json(
        { success: false, error: 'Request cancelled' },
        { status: 499 } // Client closed request
      );
    }
    
    console.error('Device registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Device registration failed' },
      { status: 500 }
    );
  }
}