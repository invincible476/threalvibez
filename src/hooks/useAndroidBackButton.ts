'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

interface BackButtonOptions {
  selectedChat: any;
  setSelectedChat: (chat: any) => void;
  selectedStory?: any;
  setSelectedStory?: (story: any) => void;
}

export function useAndroidBackButton({
  selectedChat,
  setSelectedChat,
  selectedStory,
  setSelectedStory,
}: BackButtonOptions) {
  const selectedChatRef = useRef(selectedChat);
  const selectedStoryRef = useRef(selectedStory);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    selectedStoryRef.current = selectedStory;
  }, [selectedChat, selectedStory]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let AppPlugin: any = null;
    let listenerHandle: any = null;

    const setupListener = async () => {
      try {
        const m = await import('@capacitor/app');
        AppPlugin = m.App;

        listenerHandle = await AppPlugin.addListener('backButton', () => {
          console.log('[Android BackButton] Back button pressed');

          // 1. If currently inside a chat → return to chat list
          if (selectedChatRef.current) {
            console.log('[Android BackButton] Closing active chat');
            setSelectedChat(null);
            return;
          }

          // 2. If viewing a story → close story viewer
          if (selectedStoryRef.current && setSelectedStory) {
            console.log('[Android BackButton] Closing story viewer');
            setSelectedStory(null);
            return;
          }

          // 3. If on main chat list → minimize app gracefully (does NOT terminate app)
          console.log('[Android BackButton] Minimizing app to background');
          AppPlugin.minimizeApp();
        });
      } catch (err) {
        console.error('[Android BackButton] Error setting up listener:', err);
      }
    };

    setupListener();

    return () => {
      if (listenerHandle && typeof listenerHandle.remove === 'function') {
        listenerHandle.remove();
      }
    };
  }, [setSelectedChat, setSelectedStory]);
}
