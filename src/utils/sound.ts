/**
 * sound.ts
 * iOS-style Web Audio synthesizer for Monvian interactive feedback.
 * Plays metallic coin cascade and harmonic achievement chimes respecting user mute preferences.
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
 * Subtle rising harmonic tone played while the 1.5s progress ring charges around a map pin.
 */
export function playPinChargeStartSound() {
  if (!isSoundAllowed()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 1.35); // G5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.45);
  } catch {}
}

/**
 * Helper to synthesize a single crisp metallic coin clink at a scheduled offset.
 */
function scheduleMetallicCoinClink(ctx: AudioContext, startTime: number, baseFreq: number, volume: number = 0.14) {
  // Primary metallic bell partial
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(baseFreq, startTime);
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.015, startTime + 0.04);

  gain1.gain.setValueAtTime(0.001, startTime);
  gain1.gain.exponentialRampToValueAtTime(volume, startTime + 0.008);
  gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(startTime);
  osc1.stop(startTime + 0.24);

  // High metallic overtone (inharmonic ratio ~2.41x for realistic gold coin ring)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(baseFreq * 2.41, startTime);

  gain2.gain.setValueAtTime(0.001, startTime);
  gain2.gain.exponentialRampToValueAtTime(volume * 0.55, startTime + 0.005);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(startTime);
  osc2.stop(startTime + 0.13);
}

/**
 * Cascading metallic coin burst sound followed by a warm iOS achievement chime
 * when the pin jumps and coins fly to the Profile icon.
 */
export function playXpRewardSound() {
  if (!isSoundAllowed()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Pin jump pop (low-mid warm thump + upward pitch)
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(240, now);
    popOsc.frequency.exponentialRampToValueAtTime(620, now + 0.11);
    popGain.gain.setValueAtTime(0.001, now);
    popGain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.14);

    // 2. Cascading metallic coins (7 rapid shimmering coin clinks as they burst and land)
    const coinFrequencies = [1975.5, 2217.4, 2489.0, 2637.0, 2959.9, 3135.9, 3520.0];
    coinFrequencies.forEach((freq, idx) => {
      const offset = 0.06 + idx * 0.068;
      scheduleMetallicCoinClink(ctx, now + offset, freq, 0.13);
    });

    // 3. Final Achievement Chime when coins reach the Profile icon (~0.58s in)
    const chimeStart = now + 0.56;
    const chimeNotes = [
      { freq: 1318.5, delay: 0, dur: 0.45, vol: 0.16 }, // E6
      { freq: 1661.2, delay: 0.07, dur: 0.5, vol: 0.16 }, // G#6
      { freq: 1975.5, delay: 0.14, dur: 0.65, vol: 0.2 }, // B6
      { freq: 2637.0, delay: 0.22, dur: 0.8, vol: 0.22 }, // E7
    ];

    chimeNotes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = chimeStart + n.delay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(n.vol, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + n.dur + 0.05);
    });
  } catch {
    // Graceful fallback if device audio is restricted
  }
}

/**
 * Level up fanfare: metallic coin cascade + 4-note ascending chord with warm shimmer
 */
export function playLevelUpSound() {
  if (!isSoundAllowed()) return;
  try {
    playXpRewardSound();
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.85;
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
