/**
 * Zero-latency Web Audio API sound effects engine for Monvian.
 * Pre-fetches and pre-decodes the trimmed click transient into an AudioBuffer
 * so spot marker clicks trigger with 0ms delay on iOS Safari and desktop.
 */

const SPOT_CLICK_SFX_URL = '/assets/aistudio/spot_click_sfx.wav';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let decodedSpotClickBuffer: AudioBuffer | null = null;
let rawAudioBytesPromise: Promise<ArrayBuffer | null> | null = null;
let decodePromise: Promise<AudioBuffer | null> | null = null;
let fallbackAudioEl: HTMLAudioElement | null = null;
let iosSilentUnlocked = false;
let globalUnlockListenersAttached = false;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function ensureAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctx = getAudioContextConstructor();
  if (!Ctx) return null;

  try {
    audioCtx = new Ctx({ latencyHint: 'interactive' });
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.92;
    masterGain.connect(audioCtx.destination);
    return audioCtx;
  } catch {
    return null;
  }
}

function ensureFallbackAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!fallbackAudioEl) {
    try {
      const el = new Audio(SPOT_CLICK_SFX_URL);
      el.preload = 'auto';
      el.volume = 0.92;
      el.load();
      fallbackAudioEl = el;
    } catch {
      return null;
    }
  }
  return fallbackAudioEl;
}

/**
 * Eagerly fetch the trimmed SFX bytes so decoding can happen instantly on first gesture.
 */
export function prefetchSpotClickSound(): void {
  if (typeof window === 'undefined') return;

  ensureFallbackAudio();

  if (!rawAudioBytesPromise) {
    rawAudioBytesPromise = fetch(SPOT_CLICK_SFX_URL, { cache: 'force-cache' })
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((bytes) => {
        // If AudioContext already exists (e.g. desktop Chrome), decode immediately
        if (bytes && audioCtx && !decodedSpotClickBuffer && !decodePromise) {
          void decodeBuffer(audioCtx, bytes);
        }
        return bytes;
      })
      .catch(() => null);
  }

  attachGlobalUnlockListeners();
}

async function decodeBuffer(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer | null> {
  if (decodedSpotClickBuffer) return decodedSpotClickBuffer;
  if (decodePromise) return decodePromise;

  decodePromise = (async () => {
    try {
      // Slice so the cached ArrayBuffer is never detached across retries
      const copy = bytes.slice(0);
      const buffer = await ctx.decodeAudioData(copy);
      decodedSpotClickBuffer = buffer;
      return buffer;
    } catch {
      decodePromise = null;
      return null;
    }
  })();

  return decodePromise;
}

function detachGlobalUnlockListeners(): void {
  if (!globalUnlockListenersAttached || typeof window === 'undefined') return;
  window.removeEventListener('pointerdown', handleGlobalUnlock, true);
  window.removeEventListener('touchstart', handleGlobalUnlock, true);
  window.removeEventListener('mousedown', handleGlobalUnlock, true);
  window.removeEventListener('keydown', handleGlobalUnlock, true);
  globalUnlockListenersAttached = false;
}

function handleGlobalUnlock(): void {
  unlockSpotClickSound();
  if (audioCtx && audioCtx.state === 'running' && decodedSpotClickBuffer && iosSilentUnlocked) {
    detachGlobalUnlockListeners();
  }
}

function attachGlobalUnlockListeners(): void {
  if (globalUnlockListenersAttached || typeof window === 'undefined') return;
  globalUnlockListenersAttached = true;
  window.addEventListener('pointerdown', handleGlobalUnlock, { passive: true, capture: true });
  window.addEventListener('touchstart', handleGlobalUnlock, { passive: true, capture: true });
  window.addEventListener('mousedown', handleGlobalUnlock, { passive: true, capture: true });
  window.addEventListener('keydown', handleGlobalUnlock, { passive: true, capture: true });
}

/**
 * Unlocks AudioContext on user gesture (required by iOS Safari) and warms the decoded AudioBuffer.
 */
export function unlockSpotClickSound(): void {
  if (typeof window === 'undefined') return;

  prefetchSpotClickSound();

  const ctx = ensureAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  if (!iosSilentUnlocked) {
    try {
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
      iosSilentUnlocked = true;
    } catch {
      // Will retry on next gesture
    }
  }

  if (!decodedSpotClickBuffer && rawAudioBytesPromise && !decodePromise) {
    void rawAudioBytesPromise.then((bytes) => {
      if (bytes && audioCtx && !decodedSpotClickBuffer) {
        return decodeBuffer(audioCtx, bytes);
      }
      return null;
    });
  }
}

/**
 * Plays the tourist spot click sound immediately with 0ms latency.
 */
export function playSpotClickSound(): void {
  if (typeof window === 'undefined') return;

  const ctx = ensureAudioContext();
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (decodedSpotClickBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = decodedSpotClickBuffer;
        source.connect(masterGain ?? ctx.destination);
        source.start(0);
        return;
      } catch {
        // Fall through to HTMLAudioElement fallback
      }
    }
  }

  // Fallback only if Web Audio buffer is still decoding on very first instant interaction
  unlockSpotClickSound();
  const fallback = ensureFallbackAudio();
  if (fallback) {
    try {
      fallback.currentTime = 0;
      const playResult = fallback.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {});
      }
    } catch {
      // Ignore autoplay restrictions
    }
  }
}

if (typeof window !== 'undefined') {
  prefetchSpotClickSound();
}
