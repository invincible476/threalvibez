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
import { doc, setDoc, serverTimestamp, getDoc, getDocFromCache, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
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
    let userDoc: any = null;
    try {
      userDoc = await getDoc(userDocRef);
    } catch (err: any) {
      if (err?.code === 'unavailable' || err?.message?.includes('offline')) {
        userDoc = await getDocFromCache(userDocRef).catch(() => null);
      }
    }

    let photoURL = customData?.photoURL || user.photoURL || '';
    if (photoURL && photoURL.includes('googleusercontent.com')) {
      photoURL = photoURL.replace(/=s\d+-c/, '=s400-c');
    }

    const name = customData?.name || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    const emailPrefix = user.email ? user.email.split('@')[0] : 'user';
    const cleanEmailPrefix = emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanName = (name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const username = customData?.username || cleanName || cleanEmailPrefix || `user_${user.uid.slice(0, 6)}`;

    const initialData = {
      id: user.uid,
      uid: user.uid,
      email: user.email ?? '',
      name,
      displayName: name,
      fullName: name,
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

    if (!userDoc || !userDoc.exists()) {
      await setDoc(userDocRef, {
        ...initialData,
        createdAt: serverTimestamp(),
      }, { merge: true });
    } else {
      const existing = userDoc.data() || {};
      await setDoc(userDocRef, {
        id: user.uid,
        uid: user.uid,
        name: existing.name || name,
        displayName: existing.displayName || existing.name || name,
        fullName: existing.fullName || existing.name || name,
        username: existing.username || username,
        photoURL: photoURL || existing.photoURL || '',
        emailVerified: true,
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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create the user account
      const userCredential = await firebaseCreateUser(auth, email, password);
      
      if (!userCredential?.user) {
        throw new AuthError('Failed to create user account', 'auth/creation-failed');
      }

      // Mark email as verified immediately since user verified 6-digit code before creation
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`emailVerified_${userCredential.user.uid}`, 'true');
        localStorage.setItem(`emailVerified_${userCredential.user.uid}`, 'true');
        sessionStorage.setItem(`lastVerificationCheck_${userCredential.user.uid}`, Date.now().toString());
      }
      
      // Update the user profile
      await updateProfile(userCredential.user, {
        displayName: name
      });
      
      // Create the user document using unified schema
      await this.ensureUserDocument(userCredential.user, { name });
      
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

      // Setup presence system and ensure user document exists
      await this.ensureUserDocument(userCredential.user);
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

      // Initialize Google Auth Provider
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      logDebug('Attempting Google sign-in with popup');
      let result;
      try {
        result = await firebaseSignInPopup(auth, provider);
      } catch (popupError: any) {
        console.error('Popup sign-in failed:', popupError);
        
        // Fallback to redirect if popup was blocked
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.code === 'auth/cancelled-popup-request') {
          sessionStorage.setItem('expectingRedirect', 'true');
          await signInWithRedirect(auth, provider);
          return null;
        }
        
        throw popupError;
      }
      
      if (!result?.user) {
        throw new AuthError('No user returned from Google sign in', 'auth/google-sign-in-failed');
      }

      logDebug('Google sign-in successful, ensuring user document');
      
      // Ensure user document exists with unified schema (Idempotent merge)
      await this.ensureUserDocument(result.user);
      
      // Setup presence system
      await setupPresence(result.user.uid);
      
      return result.user;
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw new AuthError(
        error.message || 'Failed to sign in with Google',
        error.code || 'auth/google-sign-in-failed'
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