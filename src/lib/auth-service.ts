import { 
  createUserWithEmailAndPassword as firebaseCreateUser,
  signInWithEmailAndPassword as firebaseSignIn,
  signInWithPopup as firebaseSignInPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  updateProfile,
  signOut as firebaseSignOut,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  deleteUser
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth as firebaseAuth, db } from './firebase';
import { setupPresence, setOfflineStatus } from './presence-final';
import { getHighQualityGooglePhotoUrl } from '@/utils/avatar';

// Ensure auth is defined
const auth = firebaseAuth!;

// Set up session-only persistence by default
setPersistence(auth, browserSessionPersistence).catch(error => {
  console.error('Failed to set persistence:', error);
});

// Set up auth state monitoring with debouncing
let authStatePromise: Promise<void> | null = null;
let authStateTimeout: NodeJS.Timeout;
const waitForAuthState = () => {
  if (!authStatePromise) {
    authStatePromise = new Promise((resolve) => {
      if (authStateTimeout) clearTimeout(authStateTimeout);
      authStateTimeout = setTimeout(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe();
          resolve();
        });
      }, 100); // Debounce auth state changes
    });
  }
  return authStatePromise;
};

export class AuthError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
    this.details = details;
  }

  static fromFirebaseError(error: any): AuthError {
    const details = {
      original: {
        code: error.code,
        message: error.message,
        stack: error.stack
      },
      context: {
        timestamp: new Date().toISOString(),
        authInitialized: !!auth,
        hasCurrentUser: !!auth?.currentUser
      }
    };

    return new AuthError(
      error.message || 'An authentication error occurred',
      error.code || 'auth/unknown',
      details
    );
  }
}

// Enhanced debug logging
const logDebug = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const context = {
    message,
    data: data || null,
    auth: {
      initialized: !!auth,
      hasUser: !!auth?.currentUser,
      config: auth?.config || 'unknown'
    },
    runtime: {
      timestamp,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      platform: typeof window !== 'undefined' ? window.navigator.platform : 'server'
    }
  };
  console.log(`[Auth Service] ${message}`, context);
};

export const authService = {
  /**
   * Ensure user document exists with unified schema
   */
  /**
   * Check if a username is available in Firestore
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    if (!username || username.trim().length < 3) return false;
    try {
      const normalized = username.trim().toLowerCase();
      const q = query(collection(db, 'users'), where('username', '==', normalized));
      const snapshot = await getDocs(q);
      return snapshot.empty;
    } catch {
      return true; // Fallback gracefully if query is unindexed
    }
  },

  /**
   * Ensure user document exists with unified schema (Idempotent merge)
   */
  async ensureUserDocument(user: any, customData?: { name?: string; username?: string; photoURL?: string }) {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    let photoURL = customData?.photoURL || user.photoURL || '';
    if (photoURL && photoURL.includes('googleusercontent.com')) {
      photoURL = photoURL.replace(/=s\d+-c/, '=s400-c');
    }

    const name = customData?.name || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    const username = customData?.username || name.toLowerCase().replace(/[^a-z0-9_]/g, '');

    const initialData = {
      uid: user.uid,
      email: user.email ?? '',
      name,
      username,
      photoURL,
      status: 'online',
      about: '',
      devices: [],
      background: 'black',
      useCustomBackground: true,
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      blockedUsers: [],
      mutedConversations: [],
      emailVerified: user.emailVerified ?? true,
      updatedAt: serverTimestamp(),
    };

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        ...initialData,
        createdAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(userDocRef, {
        name,
        photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    return userDoc;
  },

  /**
   * Create a new user account
   */
  async createAccount(email: string, password: string, name?: string) {
    try {
      // Clear any existing sessions
      await auth.signOut();
      
      // Wait for auth state to clear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create the user account
      const userCredential = await firebaseCreateUser(auth, email, password);
      
      if (!userCredential?.user) {
        throw new AuthError('Failed to create user account', 'auth/creation-failed');
      }
      
      // Update the user profile
      await updateProfile(userCredential.user, {
        displayName: name
      });
      
      // Create the user document using unified schema
      await this.ensureUserDocument(userCredential.user, { name });

      // Mark email as verified in local storage since user passed 6-digit code before creation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`emailVerified_${userCredential.user.uid}`, 'true');
        localStorage.setItem(`emailVerified_${userCredential.user.uid}`, 'true');
        sessionStorage.setItem(`lastVerificationCheck_${userCredential.user.uid}`, Date.now().toString());
      }
      
      // Force token refresh
      await userCredential.user.getIdToken(true);
      
      return userCredential.user;
    } catch (error: any) {
      console.error('Account creation error:', error);
      throw new AuthError(
        error.message || 'Failed to create account',
        error.code || 'auth/unknown'
      );
    }
  },

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string) {
    try {
      // Clear any existing corrupted auth state
      if (auth.currentUser) {
        await auth.signOut();
        // Clear any persisted session markers safely without wiping IndexedDB
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastLogin');
          localStorage.removeItem('sessionUser');
        }
        // Wait for auth state to clear
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Attempt sign in
      const userCredential = await firebaseSignIn(auth, email, password);
      
      if (!userCredential?.user) {
        throw new AuthError('Failed to sign in', 'auth/sign-in-failed');
      }

      // Setup presence system
      await setupPresence(userCredential.user.uid);

      return userCredential.user;
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new AuthError(
        error.message || 'Failed to sign in',
        error.code || 'auth/unknown'
      );
    }
  },

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      logDebug('Starting Google sign-in process');
      console.log('Firebase auth state:', {
        isInitialized: !!auth,
        hasCurrentUser: !!auth.currentUser,
        hasConfig: !!auth.config,
        currentURL: typeof window !== 'undefined' ? window.location.href : 'not-browser',
        currentHostname: typeof window !== 'undefined' ? window.location.hostname : 'not-browser'
      });

      // Check if we're returning from a redirect
      const isReturningFromRedirect = typeof window !== 'undefined' && sessionStorage.getItem('expectingRedirect') === 'true';
      if (isReturningFromRedirect) {
        logDebug('Detected return from redirect flow');
        sessionStorage.removeItem('expectingRedirect');
      }

      // Clear any existing auth state first
      if (auth.currentUser) {
        logDebug('Clearing existing auth state');
        await auth.signOut();
      }

      // Log Firebase config status
      console.log('Firebase config:', {
        hasAuth: !!auth,
        authDomain: auth.config.authDomain,
        apiKey: auth.config.apiKey
      });

      // Clear any persisted auth session markers safely without wiping IndexedDB
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('lastLogin');
          localStorage.removeItem('sessionUser');
          sessionStorage.clear();
        } catch (e) {
          console.warn('Failed to clear some browser data:', e);
        }
      }

      // Wait for cleanup to take effect
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Initialize Google Auth Provider with error handling
      logDebug('Initializing Google Auth Provider');
      const provider = new GoogleAuthProvider();
      
      // Configure provider settings with more detailed logging
      logDebug('Configuring Google Auth Provider scopes and settings');
      provider.addScope('profile');
      provider.addScope('email');
      
      // Log the current authentication configuration
      console.log('Current auth configuration:', {
        currentAuthDomain: auth.config.authDomain,
        providerData: auth.currentUser?.providerData || [],
        currentUser: auth.currentUser ? {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          emailVerified: auth.currentUser.emailVerified
        } : null
      });
      
      // Set custom parameters for better UX
      // Ensure we're using the correct auth domain
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
      if (!auth.config.authDomain) {
        throw new Error('Firebase auth domain is not configured');
      }
      
      // Log domain verification
      console.log('Domain verification:', {
        currentDomain,
        authDomain: auth.config.authDomain,
        isLocalhost: currentDomain === 'localhost',
        isDomainMatching: auth.config.authDomain.includes(currentDomain)
      });
      
      provider.setCustomParameters({
        prompt: 'select_account',
        auth_type: 'reauthenticate',
        include_granted_scopes: 'true',
        login_hint: '',  // Clear any previous login hints
        domain_hint: currentDomain // Help with domain matching
      });
      
      logDebug('Google Auth Provider configured');
      
      // Attempt sign in with popup with improved error handling
      logDebug('Attempting Google sign-in with popup');
      let result;
      try {
        logDebug('Attempting popup sign-in with Google provider');
        console.log('Pre-sign-in state:', {
          hasExistingUser: !!auth.currentUser,
          isPopupOpen: false, // Firebase doesn't expose this
          localStorageAvailable: typeof window !== 'undefined' && !!window.localStorage,
          indexedDBAvailable: typeof window !== 'undefined' && !!window.indexedDB
        });
        
        result = await firebaseSignInPopup(auth, provider);
        
        console.log('Popup sign-in result:', {
          success: !!result,
          hasUser: !!result?.user,
          errorCode: result?.user ? null : 'no_user',
          hasIdToken: !!(result?.user && await result.user.getIdToken().catch(() => null)),
          emailVerified: result?.user?.emailVerified,
          providerData: result?.user?.providerData
        });
      } catch (popupError: any) {
        const errorDetails = {
          code: popupError.code,
          message: popupError.message,
          name: popupError.name,
          stack: popupError.stack?.split('\n')[0], // Just the first line to avoid clutter
          hasAuthDomain: !!auth.config.authDomain,
          isRedirectError: popupError.code?.includes('redirect'),
          isAuthError: popupError instanceof Error && popupError.message?.includes('auth')
        };
        
        console.error('Popup sign-in failed:', errorDetails);
        logDebug('Popup sign-in failed, trying redirect...', popupError);
        
        // If popup fails, try redirect method
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.code === 'auth/cancelled-popup-request') {
          
          // Store a flag that we're expecting a redirect
          sessionStorage.setItem('expectingRedirect', 'true');
          
          // Attempt redirect sign in
          await signInWithRedirect(auth, provider);
          return null; // Function will return here, user will be redirected
        }
        
        throw popupError;
      }
      
      if (!result?.user) {
        logDebug('No user returned from Google sign-in');
        throw new AuthError('No user returned from Google sign in', 'auth/google-sign-in-failed');
      }

      logDebug('Google sign-in successful, validating session');
      
      // Validate the authentication result with retries
      let token = null;
      let retries = 3;
      while (retries > 0) {
        try {
          token = await result.user.getIdToken(true);
          if (token) break;
          retries--;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          logDebug('Token fetch failed, retries left:', retries);
          retries--;
          if (retries === 0) throw e;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!token) {
        logDebug('Failed to obtain valid token after retries');
        throw new AuthError('Session validation failed', 'auth/invalid-session');
      }

      logDebug('Session validated, checking user document');
      
      // Check if user document exists with retry
      let userDoc;
      try {
        // Force token refresh before accessing Firestore
        await result.user.getIdToken(true);
        
        // Ensure user document exists with unified schema
        await this.ensureUserDocument(result.user);
        
        // Update online status
        await setupPresence(result.user.uid);
        
        return result.user;
      } catch (error: any) {
        logDebug('Google sign-in error:', { code: error.code, message: error.message });
        
        // Handle specific error cases
        let errorMessage = 'Failed to sign in with Google';
        let errorCode = error.code || 'auth/unknown';
        
        switch (error.code) {
          case 'auth/api-key-not-valid':
          case 'auth/invalid-api-key':
            errorMessage = 'Firebase API key is invalid or truncated. Please update NEXT_PUBLIC_FIREBASE_API_KEY in .env.';
            break;
          case 'auth/popup-blocked':
            errorMessage = 'Sign-in popup was blocked. Please allow popups for this site and try again.';
            break;
          case 'auth/popup-closed-by-user':
            errorMessage = 'Sign-in was cancelled. Please try again and complete the Google sign-in.';
            break;
          case 'auth/cancelled-popup-request':
            errorMessage = 'Only one sign-in window can be open at a time. Please try again.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'The sign-in credential was invalid. Please try again.';
            // Try to clear corrupted credentials
            if (typeof window !== 'undefined') {
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch (e) {
                console.warn('Failed to clear storage:', e);
              }
            }
            break;
        }

        // Clean up any pending auth state
        try {
          await auth.signOut();
        } catch (e) {
          console.warn('Failed to clean up auth state:', e);
        }

        throw new AuthError(errorMessage, errorCode);
      }
    } catch (error: any) {
      logDebug('Google sign-in error:', { code: error.code, message: error.message });
      let friendlyMessage = error.message || 'Failed to sign in with Google';
      if (error.code === 'auth/api-key-not-valid' || error.message?.includes('api-key-not-valid')) {
        friendlyMessage = 'Firebase API key is invalid or truncated. Please set a valid NEXT_PUBLIC_FIREBASE_API_KEY in .env.';
      }
      throw new AuthError(
        friendlyMessage,
        error.code || 'auth/unknown'
      );
    }
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    try {
      const user = auth.currentUser;
      if (user) {
        // Update user status in Firestore
        await updateDoc(doc(db, 'users', user.uid), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });

        // Clear presence
        await setOfflineStatus(user.uid);

        // Clear local storage and session storage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastLogin');
          localStorage.removeItem('sessionUser');
          sessionStorage.clear();
        }
      }

      // Sign out from Firebase
      await firebaseSignOut(firebaseAuth);

      // Force a page reload to clear any remaining state
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new AuthError(
        error.message || 'Failed to sign out',
        error.code || 'auth/unknown'
      );
    }
  }
};