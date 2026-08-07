import { db } from './firebase';
import { firebaseApp } from './firebase-init';
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { doc, setDoc, serverTimestamp as firestoreServerTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const rtdb = getDatabase(firebaseApp);

export async function setupPresence(userId: string) {
  if (!userId) return () => {};

  const userDocRef = doc(db, 'users', userId);
  const userStatusRef = ref(rtdb, `/status/${userId}`);
  const connectedRef = ref(rtdb, '.info/connected');

  let unsubscribeConnected: (() => void) | null = null;
  let capacitorAppListener: any = null;

  const updateStatus = async (statusState: 'online' | 'away' | 'offline') => {
    try {
      const rtPayload = {
        state: statusState,
        lastChanged: rtServerTimestamp(),
      };

      // 1. Update Firebase Realtime Database
      await set(userStatusRef, rtPayload).catch(() => {});

      // 2. Update Firestore user document
      await setDoc(userDocRef, {
        status: statusState,
        lastSeen: firestoreServerTimestamp(),
      }, { merge: true }).catch(() => {});
    } catch (err) {
      console.warn('[Presence] Error updating status:', err);
    }
  };

  // ── 1. Listen for Realtime Database Connection State (.info/connected) ──────
  unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() === false) {
      return;
    }

    // Configure server-side onDisconnect trigger
    try {
      await onDisconnect(userStatusRef).set({
        state: 'offline',
        lastChanged: rtServerTimestamp(),
      });

      // Set online when connected
      await updateStatus('online');
    } catch (err) {
      console.warn('[Presence] Error configuring onDisconnect:', err);
    }
  });

  // ── 2. Handle Browser Tab Visibility Change ────────────────────────────────
  const handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      updateStatus('away');
    } else if (document.visibilityState === 'visible') {
      updateStatus('online');
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // ── 3. Handle Native Android App Lifecycle (App Background / Foreground) ────
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then((m) => {
      m.App.addListener('appStateChange', ({ isActive }) => {
        console.log('[Presence Android] App state changed, isActive:', isActive);
        if (isActive) {
          updateStatus('online');
        } else {
          updateStatus('away');
        }
      }).then(l => {
        capacitorAppListener = l;
      }).catch(console.warn);
    }).catch(console.warn);
  }

  // ── 4. Handle Window Unload / Close ─────────────────────────────────────────
  const handleUnload = () => {
    updateStatus('offline');
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
  }

  // ── 5. Cleanup Function ─────────────────────────────────────────────────────
  return () => {
    if (unsubscribeConnected) unsubscribeConnected();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    }
    if (capacitorAppListener && typeof capacitorAppListener.remove === 'function') {
      capacitorAppListener.remove();
    }
    updateStatus('offline');
  };
}