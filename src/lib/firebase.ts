import { getStorage } from 'firebase/storage';
import { setDoc } from 'firebase/firestore';
import { firebaseApp, firebaseAuth } from './firebase-init';

// Export initialized auth
export const auth = firebaseAuth;
export const app = firebaseApp;

// Log initialization status
console.log('Firebase initialization status:', {
  appInitialized: !!app,
  authInitialized: !!auth
});

// Configure auth for Replit domains
if (typeof window !== 'undefined') {
  const currentDomain = window.location.hostname;
  console.log('Current domain:', currentDomain);
  console.log('Current origin:', window.location.origin);

  // Add current domain to authorized domains for development
  if (currentDomain.includes('.replit.dev') || currentDomain.includes('.repl.co')) {
    // Replit domains are automatically handled by Firebase
    console.log('Running on Replit domain, auth should work automatically');
  }
}

// Initialize Firestore with offline persistence
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager, Firestore } from 'firebase/firestore';

// Initialize Firestore only if it hasn't been initialized yet
let db: Firestore;
try {
  // Try to get existing Firestore instance
  db = getFirestore(app);
} catch (e) {
  // If no instance exists, initialize with modern persistent cache settings
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager({ forceOwnership: true })
    })
  });
}

// Handle user online presence
import { ref, onDisconnect, set, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { doc, updateDoc, serverTimestamp as firestoreServerTimestamp, onSnapshot } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Initialize Realtime Database for presence
const rtdb = getDatabase(app);

// Function to handle user presence
export const setupPresence = (uid: string) => {
  if (!uid) return;

  // Firestore reference
  const userDocRef = doc(db, 'users', uid);
  
  // Realtime Database reference for presence
  const userStatusRef = ref(rtdb, `/status/${uid}`);
  
  // Create presence system
  const updatePresence = async (isOnline: boolean) => {
    try {
      const status = {
        state: isOnline ? 'online' : 'offline',
        lastChanged: rtServerTimestamp(),
      };
      
      // Update realtime database
      await set(userStatusRef, status);
      
      // Update Firestore safely (merge in case user document is still being created)
      await setDoc(userDocRef, {
        status: status.state,
        lastSeen: firestoreServerTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  // Set up disconnect hook
  onDisconnect(userStatusRef)
    .set({
      state: 'offline',
      lastChanged: rtServerTimestamp(),
    })
    .then(() => {
      // Set initial online status
      updatePresence(true);
    });

  // Handle visibility change
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      updatePresence(document.visibilityState === 'visible');
    });
  }
};

export { db };

// Initialize Firebase Storage
export const storage = getStorage(app);

// Export Firestore functions
export { setDoc };

// Add error handler for unhandled Firestore errors and offline glitches
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || event.reason?.code || '';
    if (msg.includes('ERR_BLOCKED_BY_CLIENT')) {
      console.warn('Firestore request was blocked by a browser extension or ad blocker.');
      event.preventDefault();
    } else if (msg.includes('offline') || msg === 'unavailable' || msg.includes('Failed to get document')) {
      console.warn('Firestore request deferred due to temporary offline or network transition.');
      event.preventDefault();
    }
  });
}