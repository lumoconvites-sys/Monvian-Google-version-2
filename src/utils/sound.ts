/**
 * sound.ts
 * Ultra-subtle, warm iOS-style acoustic feedback for Monvian discovery.
 * Designed to be soft, calm, and pleasant (Apple Find My / Apple Maps aesthetic),
 * avoiding high-pitched or repetitive metallic tones.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function isSoundAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('monvian_sound_disabled') === 'true') return false;
    const explicit = localStorage.getItem('monvian_sound_enabled');
    if (explicit !== null) return explicit === 'true';
    return true;
  } catch {
    return true;
  }
}

/**
 * Helper: plays a warm, low-pass filtered sine note with soft attack and natural decay.
 */
function playSoftWarmNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakGain: number = 0.055
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  // Warm low-pass filter to eliminate any harshness
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1100, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.045);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

/**
 * Extremely discreet warm pulse when starting proximity discovery (silent/near-inaudible breath).
 */
export function playPinChargeStartSound() {
  if (!isSoundAllowed()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Single soft low-mid note (F4 ~ 349.23 Hz) at very low volume
    playSoftWarmNote(ctx, 349.23, now, 0.35, 0.03);
  } catch {}
}

/**
 * Calm, pleasant, discreet two-note iOS discovery chime in the warm mid-register.
 * F4 (349.23 Hz) -> C5 (523.25 Hz) — warm perfect fifth, soft and relaxing.
 */
export function playXpRewardSound() {
  if (!isSoundAllowed()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Note 1: Warm F4 (349.23 Hz)
    playSoftWarmNote(ctx, 349.23, now, 0.45, 0.055);
    // Note 2: Soft C5 (523.25 Hz) — gentle ascending fifth
    playSoftWarmNote(ctx, 523.25, now + 0.14, 0.65, 0.065);
  } catch {}
}

/**
 * Gentle three-note warm chord when leveling up (F4 -> A4 -> C5).
 */
export function playLevelUpSound() {
  if (!isSoundAllowed()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [349.23, 440.0, 523.25]; // F4, A4, C5 (Warm F Major triad)
    notes.forEach((freq, idx) => {
      playSoftWarmNote(ctx, freq, now + idx * 0.12, 0.7, 0.06);
    });
  } catch {}
}

export const playPinTapSound = () => {};
export const playSound = () => {};
export default playPinTapSound;
