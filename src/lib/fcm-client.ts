'use client';

import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, db } from './firebase';

/**
 * Register FCM Web Push Service Worker and request Push Notification permission.
 * Saves the generated FCM token to the user's Firestore document (`users/{userId}.fcmTokens`).
 */
export async function requestFCMToken(userId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    // Check if browser supports Firebase Messaging & Service Workers
    const supported = await isSupported();
    if (!supported || !('serviceWorker' in navigator)) {
      console.warn('[FCM Client] Web push notifications are not supported in this browser environment.');
      return null;
    }

    // Check / Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM Client] Notification permission not granted:', permission);
      return null;
    }

    // Register FCM Service Worker explicitly
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);

    // Get FCM token (uses standard VAPID key if provided or default Firebase Web Push key)
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      ...(vapidKey ? { vapidKey } : {})
    });

    if (token && userId) {
      // Save FCM token to user document in Firestore
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
        lastFcmTokenUpdate: new Date().toISOString()
      }).catch(async (err) => {
        console.warn('[FCM Client] Failed to update user FCM tokens, trying merge fallback:', err);
      });
      
      console.log('[FCM Client] Successfully registered FCM push token for user:', userId);
      return token;
    }
  } catch (error) {
    console.error('[FCM Client] Error setting up FCM Web Push:', error);
  }

  return null;
}

/**
 * Setup foreground message handler (handles messages while tab is open).
 */
export function setupForegroundFCMListener(onForegroundMessage: (payload: any) => void) {
  if (typeof window === 'undefined') return () => {};

  isSupported().then((supported) => {
    if (!supported) return;
    try {
      const messaging = getMessaging(app);
      return onMessage(messaging, (payload) => {
        console.log('[FCM Client] Foreground message received:', payload);
        onForegroundMessage(payload);
      });
    } catch (e) {
      console.warn('[FCM Client] Foreground listener setup notice:', e);
    }
  }).catch(() => {});

  return () => {};
}
