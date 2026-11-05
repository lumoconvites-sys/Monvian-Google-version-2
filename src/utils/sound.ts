/**
  * sound.ts
  * iOS-style Web Audio synthesizer for Monvian interactive feedback.
  * Plays subtle, pleasant, harmonic micro-tones respecting user mute preferences.
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
    return true; // enabled by default
  } catch {
    return true;
  }
}

/**
 * Short, pleasant, harmonic celebration chime when +100 XP is awarded upon discovering a location.
 * Two soft ascending bells (E6 -> A6) with gentle decay.
 */
export function playXpRewardSound() {
  if (!isSoundAllowed()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First harmonic bell note (E6 ~ 1318.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.5, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Second chime note (A6 ~ 1760 Hz, +5 semitones higher, octave harmonic)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1760.0, now + 0.1);
    gain2.gain.setValueAtTime(0.001, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.7);

    // Soft sparkle harmonic (C#7 ~ 2217 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(2217.4, now + 0.18);
    gain3.gain.setValueAtTime(0.001, now + 0.18);
    gain3.gain.exponentialRampToValueAtTime(0.12, now + 0.22);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.18);
    osc3.stop(now + 0.6);
  } catch (err) {
    // Graceful fallback if device audio is restricted
  }
}

/**
 * Level up fanfare: 3-note ascending chord with warm shimmer
 */
export function playLevelUpSound() {
  if (!isSoundAllowed()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  } catch {}
}

export const playPinTapSound = () => {};
export const playSound = () => {};
export default playPinTapSound;
