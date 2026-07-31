'use client';

/**
 * safeShowNotification — mobile-safe browser notification dispatcher.
 *
 * On Android Chrome and iOS WebViews, calling `new Notification(...)` directly
 * from a web page context throws:
 *   TypeError: Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead.
 *
 * This function silently handles both paths:
 *   - Method A (preferred for mobile): routes through the active Service Worker registration.
 *   - Method B (desktop fallback): uses the Notification constructor.
 *
 * A failure in either path is silently caught so notification errors NEVER propagate
 * into the React render tree and crash the UI.
 */
export const safeShowNotification = async (
  title: string,
  options?: NotificationOptions
): Promise<void> => {
  // Guard: must be in a browser context
  if (typeof window === 'undefined') return;

  // Guard: browser must support the Notification API
  if (!('Notification' in window)) return;

  // Guard: user must have granted permission
  if (Notification.permission !== 'granted') return;

  try {
    // Method A: Mobile Chrome / Android WebViews — mandatory for these platforms.
    // navigator.serviceWorker.ready resolves when an active SW is controlling the page.
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, options);
          return;
        }
      } catch (swErr) {
        // Service Worker not ready or showNotification unavailable — fall through to Method B
        console.warn('[safeShowNotification] ServiceWorker path unavailable, trying direct constructor:', swErr);
      }
    }

    // Method B: Desktop browser fallback.
    // Wrapped in its own try-catch so an Illegal constructor error on mobile
    // never propagates out of this function.
    new Notification(title, options);
  } catch (err) {
    // Silent catch — notification failures must NEVER crash the React UI.
    console.warn('[safeShowNotification] Browser notification failed gracefully:', err);
  }
};
