'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

interface BackButtonOptions {
  selectedChat: any;
  setSelectedChat: (chat: any) => void;
}

export function useAndroidBackButton({
  selectedChat,
  setSelectedChat,
}: BackButtonOptions) {
  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let AppPlugin: any = null;
    let listenerHandle: any = null;

    const setupListener = async () => {
      try {
        const m = await import('@capacitor/app');
        AppPlugin = m.App;

        listenerHandle = await AppPlugin.addListener('backButton', () => {
          console.log('[Android BackButton] Hardware/Gesture Back pressed');

          // ── 1. Check for open Radix sheets, dialogs, full-screen modals, or image lightboxes ──
          if (typeof document !== 'undefined') {
            const openOverlays = Array.from(document.querySelectorAll(
              '[role="dialog"][data-state="open"], [data-state="open"][class*="fixed"], .fixed.inset-0'
            ));

            if (openOverlays.length > 0) {
              console.log('[Android BackButton] Intercepted: closing open modal/sheet/overlay');
              const topOverlay = openOverlays[openOverlays.length - 1];

              // Try clicking close button inside the overlay
              const closeBtn = topOverlay.querySelector('button[aria-label="Close"], button.close, [data-radix-collection-item], button[title="Close"]');
              if (closeBtn instanceof HTMLElement) {
                closeBtn.click();
              } else {
                // Synthesize ESC key event to trigger Radix / Dialog close handlers
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              }
              return;
            }
          }

          // ── 2. Check for active open chat room ──
          if (selectedChatRef.current) {
            console.log('[Android BackButton] Intercepted: closing active chat room');
            setSelectedChat(null);
            return;
          }

          // ── 3. Check for sub-routes (/settings, /stories, /friends, etc.) ──
          if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            console.log('[Android BackButton] Intercepted: navigating back to root from', window.location.pathname);
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = '/';
            }
            return;
          }

          // ── 4. On root chat list page: minimize app smoothly to background ──
          console.log('[Android BackButton] On root screen: minimizing app to background');
          if (AppPlugin && typeof AppPlugin.minimizeApp === 'function') {
            AppPlugin.minimizeApp();
          }
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
  }, [setSelectedChat]);
}
