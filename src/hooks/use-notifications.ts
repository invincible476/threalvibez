'use client';
import { useEffect, useRef, useCallback } from 'react';
import { Conversation, User } from '@/lib/types';
import { useAppearance } from '@/components/providers/appearance-provider';
import { createToneAudio } from '@/lib/sound';
import { safeGetMillis } from '@/lib/utils';
import { safeShowNotification } from '@/lib/notification-utils';

interface UseNotificationsProps {
  conversations: Conversation[];
  usersCache: Map<string, User>;
  currentUser?: User;
  activeChatId?: string;
}

export function useNotifications({
  conversations,
  usersCache,
  currentUser,
  activeChatId,
}: UseNotificationsProps): void {
  const { notificationSound, areNotificationsMuted } = useAppearance();
  const previousConversations = useRef<Map<string, number>>(new Map());
  const isFirstRun = useRef(true);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) {
      console.warn('Notification permission request failed:', e);
    }
  }, []);

  const playSound = useCallback(() => {
    if (areNotificationsMuted || typeof window === 'undefined') return;
    
    try {
      if (notificationSound === 'default') {
        const { audio, source } = createToneAudio();
        audio.start(0);
        setTimeout(() => {
          try {
            source.stop();
          } catch (e) {}
        }, 200);
      } else if (notificationSound.startsWith('data:audio')) {
        const audio = new Audio(notificationSound);
        audio.play().catch(error => {
          console.error("Error playing custom notification sound:", error);
        });
      }
    } catch (error) {
      console.error("Error handling notification sound:", error);
    }
  }, [areNotificationsMuted, notificationSound]);

  const showNotification = useCallback((sender: User, messageText: string, conversationId: string) => {
    const isMuted = currentUser?.mutedConversations?.includes(conversationId);
    
    // Do not show notification or play sound if the tab is visible AND the active chat is the one receiving the message
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && activeChatId === conversationId) return;
    if (isMuted) return;
    
    playSound();

    const title = `New message from ${sender?.name || 'User'}`;
    const options = {
      body: messageText || '',
      icon: sender?.photoURL || '/icons/icon-192x192.png',
      tag: `vibez-message-${conversationId}`,
      renotify: true,
    } as any as NotificationOptions;

    // Use the mobile-safe dispatcher — routes through ServiceWorkerRegistration on mobile
    // (avoids the Illegal constructor TypeError on Android Chrome / iOS WebViews)
    // and falls back to the Notification constructor on desktop. All errors are silently caught.
    safeShowNotification(title, options).catch(() => {});

  }, [playSound, currentUser, activeChatId]);

  useEffect(() => {
    if (!currentUser || !Array.isArray(conversations) || conversations.length === 0) {
      return;
    }

    const currentConvoState = new Map<string, number>();
    conversations.forEach((convo) => {
      if (convo?.lastMessage) {
        const timestamp = safeGetMillis(convo.lastMessage.timestamp || (convo.lastMessage as any)?.createdAt);
        if (timestamp > 0) {
          currentConvoState.set(convo.id, timestamp);
        }
      }
    });

    // On the first run, just populate the previous state and do nothing.
    if (isFirstRun.current) {
      previousConversations.current = currentConvoState;
      isFirstRun.current = false;
      return;
    }

    conversations.forEach((convo) => {
      if (!convo?.id) return;
      const newTimestamp = currentConvoState.get(convo.id) || 0;
      const oldTimestamp = previousConversations.current.get(convo.id);
      const lastMsg = convo.lastMessage;

      if (newTimestamp > 0 && oldTimestamp !== undefined && newTimestamp > oldTimestamp && lastMsg && lastMsg.senderId !== currentUser.uid) {
        const sender = usersCache.get(lastMsg.senderId);
        if (sender) {
          showNotification(sender, lastMsg.text, convo.id);
        }
      }
    });

    previousConversations.current = currentConvoState;

  }, [conversations, currentUser, usersCache, showNotification]);
}
