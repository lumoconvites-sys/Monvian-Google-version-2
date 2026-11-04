/**
 * Global and reusable Haptic Feedback utility for Monvian.
 * Uses native navigator.vibrate(15) on compatible devices while respecting
 * iOS Safari limitations and preventing duplicate vibrations during rapid map updates.
 */

let lastHapticTimestamp = 0;
const MIN_HAPTIC_INTERVAL_MS = 100;

export function triggerHapticFeedback(duration: number = 15): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastHapticTimestamp < MIN_HAPTIC_INTERVAL_MS) {
    return false;
  }

  lastHapticTimestamp = now;

  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(duration);
    }
  } catch {
    // Gracefully ignore on browsers/devices with restricted vibration APIs (e.g., iOS Safari)
  }

  return false;
}

declare global {
  interface Window {
    triggerHapticFeedback?: (duration?: number) => boolean;
  }
}

if (typeof window !== 'undefined') {
  window.triggerHapticFeedback = triggerHapticFeedback;
}

export default triggerHapticFeedback;
