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

  // Validate auth domain format
  const authDomain = firebaseConfig.authDomain;
  if (!authDomain || !authDomain.includes('.') || !authDomain.includes('firebaseapp.com')) {
    throw new Error('Invalid authDomain format. Must be a valid Firebase domain');
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

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
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
      if (getApps().length) {
        // Use getAuth for existing app
        auth = getAuth(app);
      } else {
        // Initialize new auth with persistence
        auth = initializeAuth(app, {
          persistence: [
            indexedDBLocalPersistence,
            browserLocalPersistence,
            browserSessionPersistence
          ]
        });

        // Ensure persistence is set
        await setPersistence(auth, browserLocalPersistence);
      }

      // Validate auth configuration
      if (!auth.config.authDomain) {
        throw new Error('Auth domain is not configured. Check NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
      }

      // Validate current domain matches auth domain or is localhost
      const currentDomain = window.location.hostname;
      if (currentDomain !== 'localhost' && 
          !auth.config.authDomain.includes(currentDomain)) {
        console.warn(`[Firebase Init] Domain mismatch - current: ${currentDomain}, auth: ${auth.config.authDomain}`);
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

// Initialize with retry mechanism
async function initializeWithRetry(maxRetries = 3): Promise<{ app: FirebaseApp, auth: Auth }> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return initializeFirebase();
    } catch (error) {
      lastError = error;
      console.warn(`Firebase initialization attempt ${i + 1} failed:`, error);
      // Clear any stale initialization data
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        try {
          indexedDB.deleteDatabase('firebaseLocalStorageDb');
        } catch (e) {
          console.warn('Failed to clear IndexedDB:', e);
        }
      }
    }
  }
  throw lastError;
}

// Initialize Firebase instance
const instance = await initializeWithRetry();
export const firebaseApp = instance.app;
export const firebaseAuth = instance.auth;