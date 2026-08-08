import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  browserLocalPersistence, 
  indexedDBLocalPersistence,
  browserSessionPersistence,
  initializeAuth,
  getAuth,
  Auth,
  setPersistence
} from 'firebase/auth';

let app: FirebaseApp;

// Function to validate Firebase configuration
function validateFirebaseConfig() {
  const requiredConfigs = {
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId
  } as const;

  // Check for missing required values
  const missingKeys = Object.entries(requiredConfigs)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing required Firebase configuration keys: ${missingKeys.join(', ')}`);
  }

  // Validate auth domain format — accepts any valid hostname (firebaseapp.com or custom domain)
  const authDomain = firebaseConfig.authDomain;
  if (!authDomain || !authDomain.includes('.')) {
    throw new Error('Invalid authDomain format. Must be a valid hostname.');
  }
}

// Get Firebase instance for server-side operations
function getServerSideFirebase() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return { 
    app, 
    auth: getAuth(app)
  };
}

// Determine authDomain:
// - On Vercel: use threalvibez.vercel.app so auth is same-origin (bypasses 3rd-party cookie blocks)
// - Locally / fallback: use official firebaseapp.com domain
const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_URL || !!process.env.VERCEL;
const authDomainResolved = isVercel
  ? 'threalvibez.vercel.app'
  : (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'blackvienna-ea6c7.firebaseapp.com');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: authDomainResolved,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
};

// Validate required config values
if (!firebaseConfig.apiKey) {
  throw new Error('Missing required Firebase configuration key: apiKey');
}
if (!firebaseConfig.authDomain) {
  throw new Error('Missing required Firebase configuration key: authDomain');
}
if (!firebaseConfig.projectId) {
  throw new Error('Missing required Firebase configuration key: projectId');
}

// Initialize Firebase early
export async function initializeFirebase() {
  try {
    // Validate environment
    if (typeof window === 'undefined') {
      console.warn('[Firebase Init] Running in server environment, using minimal initialization');
      return getServerSideFirebase();
    }

    // Enhanced config validation
    validateFirebaseConfig();
    
    // Debug: Log Firebase config status
    const configStatus = {
      apiKey: !!firebaseConfig.apiKey,
      authDomain: !!firebaseConfig.authDomain,
      projectId: !!firebaseConfig.projectId,
      storageBucket: !!firebaseConfig.storageBucket,
      messagingSenderId: !!firebaseConfig.messagingSenderId,
      appId: !!firebaseConfig.appId,
      currentDomain: typeof window !== 'undefined' ? window.location.hostname : 'server-side',
      hasAllRequired: !!(
        firebaseConfig.apiKey && 
        firebaseConfig.authDomain && 
        firebaseConfig.projectId && 
        firebaseConfig.storageBucket && 
        firebaseConfig.messagingSenderId && 
        firebaseConfig.appId
      )
    };
    
    console.log('[Firebase Init] Configuration status:', configStatus);
    
    // Initialize or get the Firebase app
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

    let auth: Auth;
    try {
      try {
        auth = getAuth(app);
      } catch {
        auth = initializeAuth(app, {
          persistence: [
            indexedDBLocalPersistence,
            browserLocalPersistence,
            browserSessionPersistence
          ]
        });
      }
    } catch (authError: any) {
      console.error('[Firebase Init] Auth initialization error:', {
        code: authError.code,
        message: authError.message,
        stack: authError.stack
      });
      throw authError;
    }

    return { app, auth };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

function getOrInitAuth(targetApp: FirebaseApp): Auth {
  try {
    return getAuth(targetApp);
  } catch {
    return initializeAuth(targetApp, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence
      ]
    });
  }
}

// Initialize Firebase app synchronously to avoid top-level await bundling issues
export const firebaseApp: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth: Auth = getOrInitAuth(firebaseApp);