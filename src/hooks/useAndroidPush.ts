'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// PushNotifications and LocalNotifications are only imported on native platforms
let PushNotifications: any = null;
let LocalNotifications: any = null;

/**
 * useAndroidPush
 * --------------
 * Call this hook once in your root layout after the user is authenticated.
 * It will:
 *  1. Request permission from the OS
 *  2. Receive the FCM device token and save it to Firestore (users/{uid}/fcmTokens)
 *  3. Listen for foreground notifications and re-display them as real native banners
 *     via @capacitor/local-notifications (Capacitor suppresses FCM foreground by default)
 *  4. Handle notification tap → navigate to chat / call / story / friends
 */
export function useAndroidPush(uid: string | null | undefined) {
  const saveFcmToken = useCallback(
    async (token: string) => {
      if (!uid || !token) return;
      try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
          fcmToken: token,
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

    const setup = async () => {
      // ── Dynamically import native plugins ─────────────────────────────────
      if (!PushNotifications) {
        const m = await import('@capacitor/push-notifications');
        PushNotifications = m.PushNotifications;
      }
      try {
        if (!LocalNotifications) {
          const m = await import('@capacitor/local-notifications');
          LocalNotifications = m.LocalNotifications;
        }
      } catch (_) {
        console.warn('[PushNotifications] @capacitor/local-notifications not available — foreground push display will be suppressed by OS.');
        LocalNotifications = null;
      }

      // ── 1. Attach listeners FIRST so cold-start events are captured ───────

      // Tap handler — works for both FCM background/killed and local notification taps
      const handleNotificationTap = (data: Record<string, string> | undefined) => {
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
      };

      PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: { notification: { data?: Record<string, string> } }) => {
          handleNotificationTap(action.notification?.data);
        }
      );

      // Tap on local (foreground-re-displayed) notification
      if (LocalNotifications) {
        try {
          LocalNotifications.addListener(
            'localNotificationActionPerformed',
            (action: { notification: { extra?: Record<string, string> } }) => {
              handleNotificationTap(action.notification?.extra);
            }
          );
        } catch (_) {}
      }

      // Foreground FCM handler — re-display as a real native banner
      PushNotifications.addListener(
        'pushNotificationReceived',
        async (notification: { title?: string; body?: string; data?: Record<string, string> }) => {
          const { title, body, data } = notification;
          console.log('[PushNotifications] Foreground notification received:', title, body);

          // Re-display as a local notification so the user actually sees the banner
          if (LocalNotifications && (title || body)) {
            try {
              const notifId = Math.floor(Math.random() * 2147483647);
              const channelId = data?.type === 'call' ? 'calls'
                : data?.type === 'friend_request' || data?.type === 'friend_accept' ? 'friends'
                : 'messages';

              await LocalNotifications.schedule({
                notifications: [
                  {
                    id: notifId,
                    title: title ?? 'New Notification',
                    body: body ?? '',
                    channelId,
                    extra: data ?? {},
                    sound: 'default',
                    smallIcon: 'ic_launcher',
                    iconColor: channelId === 'calls' ? '#10B981'
                      : channelId === 'friends' ? '#10B981'
                      : '#6366F1',
                  },
                ],
              });
            } catch (e) {
              console.warn('[PushNotifications] Could not schedule local notification:', e);
            }
          }

          // Also dispatch custom event for any in-app listeners (e.g., call UI)
          if (typeof window !== 'undefined' && (title || body)) {
            window.dispatchEvent(new CustomEvent('in_app_notification', {
              detail: { title, body, data }
            }));
          }
        }
      );

      PushNotifications.addListener('registration', async (token: { value: string }) => {
        console.log('[PushNotifications] Token received:', token.value.slice(0, 20));
        await saveFcmToken(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[PushNotifications] Registration error:', error);
      });

      // ── 2. Request OS permissions ─────────────────────────────────────────
      const pushPerm = await PushNotifications.requestPermissions();
      if (pushPerm.receive !== 'granted') {
        console.warn('[PushNotifications] Push permission not granted.');
        return;
      }

      if (LocalNotifications) {
        try {
          await LocalNotifications.requestPermissions();
        } catch (_) {}
      }

      // ── 3. Create Notification Channels (Android 8.0+) ────────────────────
      // Channels must be created BEFORE register() so FCM tokens are tied to them.
      const channelDefs = [
        {
          id: 'messages',
          name: 'Messages',
          description: 'New messages from your chats',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: 'calls',
          name: 'Calls',
          description: 'Incoming voice and video calls',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: 'friends',
          name: 'Friend Requests',
          description: 'New friend requests and accepted requests',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: 'stories',
          name: 'Stories',
          description: 'New stories from your friends',
          importance: 3,
          visibility: 1,
          sound: 'default',
          vibration: false,
        },
        {
          id: 'default',
          name: 'General',
          description: 'General notifications and updates',
          importance: 4,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
      ];

      for (const ch of channelDefs) {
        try {
          await PushNotifications.createChannel(ch);
        } catch (err) {
          console.warn(`[PushNotifications] Error creating channel '${ch.id}':`, err);
        }
      }

      // Create the same channels for LocalNotifications so foreground banners respect them
      if (LocalNotifications) {
        for (const ch of channelDefs) {
          try {
            await LocalNotifications.createChannel(ch);
          } catch (_) {}
        }
      }

      // ── 4. Register with FCM ──────────────────────────────────────────────
      await PushNotifications.register();
    };

    setup();

    return () => {
      if (PushNotifications) {
        PushNotifications.removeAllListeners();
      }
      if (LocalNotifications) {
        try { LocalNotifications.removeAllListeners(); } catch (_) {}
      }
    };
  }, [uid, saveFcmToken]);
}
