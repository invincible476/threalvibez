
import { getApps, initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let firebaseAdmin: any;

// Initialize Firebase Admin with strict security requirements
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowDevFallback = process.env.ALLOW_DEV_TOKEN_FALLBACK === 'true';
    
    // Validate required environment variables
    if (!projectId) {
      throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is required');
    }
    
    // In production or secure environments, service account is MANDATORY
    if (!serviceAccount && (!isDevelopment || !allowDevFallback)) {
      console.error('🚨 SECURITY ERROR: Firebase service account not configured for secure environment');
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required for secure Firebase Admin initialization');
    }
    
    try {
      if (serviceAccount) {
        // SECURE: Use proper service account credentials
        const serviceAccountKey = JSON.parse(serviceAccount) as ServiceAccount;
        firebaseAdmin = initializeApp({
          credential: cert(serviceAccountKey),
          projectId: projectId,
        });
        console.log('Firebase Admin initialized with secure service account credentials');
      } else if (isDevelopment && allowDevFallback) {
        // DEVELOPMENT ONLY: Limited functionality fallback with explicit opt-in
        console.warn('⚠️  DEVELOPMENT MODE: Firebase Admin initialized without service account (EXPLICIT_DEV_FALLBACK_ENABLED)');
        console.warn('⚠️  This configuration provides LIMITED functionality and must not be used in production');
        firebaseAdmin = initializeApp({
          projectId: projectId,
        });
      } else {
        // Fail-safe: No insecure fallbacks allowed
        throw new Error('Firebase Admin requires proper service account configuration');
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      throw new Error(`Firebase Admin initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return firebaseAdmin;
}

export function getAdminFirestore() {
  try {
    const app = initializeFirebaseAdmin();
    return getFirestore(app);
  } catch (error) {
    console.error('Error getting Firestore admin:', error);
    throw new Error('Firebase Admin not properly configured');
  }
}

export function getAdminAuth() {
  try {
    const app = initializeFirebaseAdmin();
    return getAuth(app);
  } catch (error) {
    console.error('Error getting Auth admin:', error);
    throw new Error('Firebase Admin not properly configured');
  }
}
