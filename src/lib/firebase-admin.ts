
import { getApps, initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

let firebaseAdmin: any;

// Initialize Firebase Admin with strict security requirements and dev/placeholder fallback
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'blackvienna-ea6c7';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowDevFallback = process.env.ALLOW_DEV_TOKEN_FALLBACK === 'true';

    let credential: any = undefined;

    if (serviceAccount) {
      try {
        let rawJson = serviceAccount.trim();
        // Handle Base64 encoded JSON strings commonly used in Vercel
        if (!rawJson.startsWith('{') && (rawJson.startsWith('ey') || rawJson.startsWith('ew'))) {
          try {
            rawJson = Buffer.from(rawJson, 'base64').toString('utf8');
          } catch (e) {
            // Keep original string if base64 decoding fails
          }
        }

        const serviceAccountKey = JSON.parse(rawJson) as ServiceAccount & { private_key?: string };
        
        // Normalize escaped newlines (\\n -> \n) frequently caused by Vercel environment variable formatting
        if (serviceAccountKey.private_key) {
          serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
        }
        if (serviceAccountKey.privateKey) {
          serviceAccountKey.privateKey = serviceAccountKey.privateKey.replace(/\\n/g, '\n');
        }

        const keyString = serviceAccountKey.privateKey || serviceAccountKey.private_key || '';

        // Verify key is a valid PEM private key and not a placeholder
        if (
          keyString &&
          !keyString.includes('YOUR_PRIVATE_KEY') &&
          keyString.includes('BEGIN PRIVATE KEY')
        ) {
          credential = cert({
            ...serviceAccountKey,
            privateKey: keyString,
          });
          console.log('[Firebase Admin] Successfully initialized with valid Service Account credentials.');
        } else {
          console.warn('⚠️ [Firebase Admin] Service Account key contains a placeholder ("YOUR_PRIVATE_KEY"). Initializing without cert credentials.');
        }
      } catch (certError) {
        console.warn('⚠️ [Firebase Admin] Service account cert parsing error, initializing dev fallback:', certError instanceof Error ? certError.message : String(certError));
      }
    } else {
      console.warn('⚠️ [Firebase Admin] No FIREBASE_SERVICE_ACCOUNT_KEY provided. Initializing fallback app.');
    }

    try {
      firebaseAdmin = initializeApp({
        ...(credential ? { credential } : {}),
        projectId: projectId,
      });
    } catch (error) {
      console.error('[Firebase Admin] Initialization error:', error);
      firebaseAdmin = getApps()[0];
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

export function getAdminMessaging() {
  try {
    const app = initializeFirebaseAdmin();
    return getMessaging(app);
  } catch (error) {
    console.error('Error getting Messaging admin:', error);
    throw new Error('Firebase Admin messaging not properly configured');
  }
}

