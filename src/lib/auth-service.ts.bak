import { 
  createUserWithEmailAndPassword as firebaseCreateUser,
  signInWithEmailAndPassword as firebaseSignIn,
  signInWithPopup as firebaseSignInPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  updateProfile,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { auth as firebaseAuth, db } from './firebase';
import { setupPresence, setOfflineStatus } from './presence-final';

// Ensure auth is defined
const auth = firebaseAuth!;

export class AuthError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

// Debug function
const logDebug = (message: string, data?: any) => {
  console.log(`[Auth Service] ${message}`, data || '');
};

export const authService = {
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
      
      // Create the user document
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        name,
        photoURL: null,
        status: 'online',
        about: '',
        devices: [],
        background: 'default',
        useCustomBackground: false,
        friends: [],
        friendRequestsSent: [],
        friendRequestsReceived: [],
        blockedUsers: [],
        mutedConversations: [],
        emailVerified: true,
        verifiedAt: new Date(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
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
        // Clear any persisted auth data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lastLogin');
          localStorage.removeItem('sessionUser');
          // Clear IndexedDB auth data
          try {
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
              if (db.name?.includes('firebase') && db.name) {
                await window.indexedDB.deleteDatabase(db.name);
              }
            }
          } catch (e) {
            console.warn('Failed to clear IndexedDB:', e);
          }
        }
        // Wait for auth state to clear
        await new Promise(resolve => setTimeout(resolve, 1000));
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

      // Clear any existing auth state first
      if (auth.currentUser) {
        logDebug('Clearing existing auth state');
        await auth.signOut();
      }

      // Clear any persisted auth data regardless of current user
      if (typeof window !== 'undefined') {
        try {
          // Clear local storage
          localStorage.removeItem('lastLogin');
          localStorage.removeItem('sessionUser');
          localStorage.removeItem('firebase:host:*');
          
          // Clear session storage
          sessionStorage.clear();
          
          // Clear IndexedDB
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            if (db.name?.includes('firebase') && db.name) {
              await window.indexedDB.deleteDatabase(db.name);
            }
          }

          // Clear cookies related to Firebase auth
          document.cookie.split(';').forEach(c => {
            if (c.includes('firebase')) {
              document.cookie = c
                .replace(/^ +/, '')
                .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
            }
          });
        } catch (e) {
          console.warn('Failed to clear some browser data:', e);
        }
      }

      // Wait for cleanup to take effect
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Initialize Google Auth Provider with error handling
      logDebug('Initializing Google Auth Provider');
      const provider = new GoogleAuthProvider();
      
      // Configure provider settings
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters for better UX
      provider.setCustomParameters({
        prompt: 'select_account',
        auth_type: 'reauthenticate',
        include_granted_scopes: 'true'
      });
      
      logDebug('Google Auth Provider configured');
      
      // Attempt sign in with popup with improved error handling
      logDebug('Attempting Google sign-in with popup');
      let result;
      try {
        result = await firebaseSignInPopup(auth, provider);
      } catch (popupError: any) {
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
        
        userDoc = await getDoc(doc(db, 'users', result.user.uid));
        
        if (!userDoc.exists()) {
          // Get fresh user data
          const freshUserData = await getDoc(doc(db, 'users', result.user.uid));
          if (!freshUserData.exists()) {
            // Create new user document
            await setDoc(doc(db, 'users', result.user.uid), {
              uid: result.user.uid,
              email: result.user.email ?? '',
              name: result.user.displayName ?? (result.user.email ? result.user.email.split('@')[0] : 'User'),
              photoURL: result.user.photoURL ?? '',
              status: 'online',
              about: '',
              devices: [],
              background: 'default',
              useCustomBackground: false,
              friends: [],
            friendRequestsSent: [],
            friendRequestsReceived: [],
            blockedUsers: [],
            mutedConversations: [],
            emailVerified: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Update online status
          await setupPresence(result.user.uid);
        }
        
        return result.user;
      } catch (error: any) {
        logDebug('Google sign-in error:', { code: error.code, message: error.message });
        
        // Handle specific error cases
        let errorMessage = 'Failed to sign in with Google';
        let errorCode = error.code || 'auth/unknown';
        
        switch (error.code) {
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

        throw new AuthError(
          error.message || errorMessage,
          errorCode
        );
      }
    } catch (error: any) {
      logDebug('Google sign-in error:', { code: error.code, message: error.message });
      throw new AuthError(
        error.message || 'Failed to sign in with Google',
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
        await updateDoc(doc(db, 'users', user.uid), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });
      }
      await firebaseSignOut(firebaseAuth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new AuthError(
        error.message || 'Failed to sign out',
        error.code || 'auth/unknown'
      );
    }
  }
};