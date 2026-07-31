import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely extracts epoch milliseconds from any timestamp representation
 * (Firestore Timestamp, JS Date, number, string, object with seconds, etc.).
 * Returns 0 if invalid or null/undefined.
 */
export function safeGetMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') {
    try { return ts.toMillis(); } catch { return 0; }
  }
  if (typeof ts.toDate === 'function') {
    try { return ts.toDate().getTime(); } catch { return 0; }
  }
  if (ts instanceof Date) return isNaN(ts.getTime()) ? 0 : ts.getTime();
  if (typeof ts === 'number') return isNaN(ts) ? 0 : ts;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Safely formats a timestamp value into a localized time string (e.g. "10:45 AM").
 * Returns an empty string if invalid or null/undefined.
 */
export function safeFormatTimestamp(ts: any, options?: Intl.DateTimeFormatOptions): string {
  const millis = safeGetMillis(ts);
  if (!millis) return '';
  try {
    return new Date(millis).toLocaleTimeString([], options || { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
