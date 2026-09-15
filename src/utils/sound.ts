/**
 * Sound synthesis utility for Monvian interactive map pins and UI elements.
 * Uses native Web Audio API for zero-latency, offline-compatible tactile feedback.
 * Generates an ultra-subtle, airy micro-tap inspired by modern high-end mobile UI.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Checks whether pin sound effects are enabled in user settings.
 * Defaults to true.
 */
export function isPinSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('monvian_pin_sound');
  return stored === null ? true : stored === 'true';
}

/**
 * Updates the sound effects preference.
 */
export function setPinSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('monvian_pin_sound', String(enabled));
}

/**
 * Synthesizes a subtle, soft and discreet tactile micro-tap.
 * Designed to be pleasing, featherweight, and never annoying or repetitive.
 */
export function playPinTapSound(volumeMultiplier: number = 1): void {
  if (!isPinSoundEnabled()) return;

  try {
    // 1. Featherlight haptic feedback on compatible devices (subtle 6ms tick)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(6);
      } catch (_) {}
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Ultra-short, smooth sine pulse (warm & discreet, no cartoony pitch drop)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    // Gentle acoustic frequency (820Hz to 760Hz over 32ms gives a smooth wooden feel)
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.032);

    // Soft low-pass filter to remove any high-pitch sharpness
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(0.7, now);

    // Featherlight volume envelope: 1.5ms attack, 30ms soft natural decay
    const peakVolume = Math.max(0.005, Math.min(0.2, 0.055 * volumeMultiplier));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakVolume, now + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.034);

    // Connect nodes: osc -> filter -> gain -> destination
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Fire and cleanly release resources
    osc.start(now);
    osc.stop(now + 0.036);
  } catch (err) {
    // Fails safely without interrupting app execution
    console.debug('Pin tap sound error:', err);
  }
}
