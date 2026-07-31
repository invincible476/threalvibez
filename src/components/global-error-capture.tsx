'use client';

import { useEffect } from 'react';

/**
 * GlobalErrorCapture - mounts a window.onerror + unhandledrejection listener
 * that logs errors to the console with full context.
 * This captures crashes that escape React's error boundary system
 * (e.g., errors in Firestore onSnapshot callbacks, async event handlers, etc.)
 */
export function GlobalErrorCapture() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[GlobalErrorCapture] window.onerror caught:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      console.error('[GlobalErrorCapture] Unhandled Promise Rejection:', {
        reason,
        message: reason?.message,
        stack: reason?.stack,
        type: typeof reason,
        stringified: String(reason),
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
