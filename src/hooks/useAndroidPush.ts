'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// PushNotifications is only imported on native platforms
let PushNotifications: any = null;
if (Capacitor.isNativePlatform()) {
  import('@capacitor/push-notifications').then((m) => {
    PushNotifications = m.PushNotifications;
  });
}

/**
 * useAndroidPush
 * --------------
 * Call this hook once in your root layout after the user is authenticated.
 * It will:
 *  1. Request permission from the OS
 *  2. Receive the FCM device token and save it to Firestore (users/{uid}/fcmTokens)
 *  3. Listen for foreground notifications and show them as native banners
 *  4. Handle notification tap → navigate to chat / call / story
 */
export function useAndroidPush(uid: string | null | undefined) {
  const saveFcmToken = useCallback(
    async (token: string) => {
      if (!uid || !token) return;
      try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
          platform: 'android',
        });
        console.log('[PushNotifications] FCM token saved to Firestore:', token.slice(0, 20) + '...');
      } catch (e) {
        console.error('[PushNotifications] Failed to save FCM token:', e);
      }
    },
    [uid]
  );

  useEffect(() => {
    if (!uid) return;
    if (!Capacitor.isNativePlatform()) return; // Web uses service worker instead

    // Wait for the dynamic import to finish
    const setup = async () => {
      if (!PushNotifications) {
        const m = await import('@capacitor/push-notifications');
        PushNotifications = m.PushNotifications;
      }

      // ── 1. Attach listeners FIRST (including tap action) so cold-start events are captured ──
      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: { notification: { data?: Record<string, string> } }) => {
          const data = action.notification?.data;
          if (!data) return;

          const { type, chatId, callId, roomId, storyId } = data;
          console.log('[PushNotifications] Notification tapped, type:', type, 'data:', data);

          const isMessage = type === 'message' || (!type && !!chatId);
          if (isMessage && chatId) {
            (window as any).pendingNotificationChatId = chatId;
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('pendingNotificationChatId', chatId);
            }
            if (typeof (window as any).openNotificationChat === 'function') {
              (window as any).openNotificationChat(chatId);
            } else {
              window.history.replaceState({}, '', `/?chatId=${chatId}`);
            }
          } else if (type === 'call' && callId) {
            if (typeof (window as any).openNotificationCall === 'function') {
              (window as any).openNotificationCall(callId, roomId);
            } else {
              window.history.replaceState({}, '', `/?call=${callId}&room=${roomId ?? ''}`);
            }
          } else if (type === 'story' && storyId) {
            window.location.href = `/stories?storyId=${storyId}`;
          } else if (type === 'friend_request' || type === 'friend_accept') {
            window.location.href = `/friends`;
          }
        }
      );

      PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: { title?: string; body?: string; data?: Record<string, string> }) => {
          const { title, body, data } = notification;
          console.log('[PushNotifications] Foreground notification:', title, body, data);
        }
      );

      PushNotifications.addListener('registration', async (token: { value: string }) => {
        console.log('[PushNotifications] Token received:', token.value.slice(0, 20));
        await saveFcmToken(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[PushNotifications] Registration error:', error);
      });

      // ── 2. Request OS permission ──────────────────────────────────────────
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.warn('[PushNotifications] Permission not granted.');
        return;
      }

      // ── 3. Register with FCM ──────────────────────────────────────────────
      await PushNotifications.register();
    };

    setup();

    return () => {
      if (PushNotifications) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [uid, saveFcmToken]);
}
