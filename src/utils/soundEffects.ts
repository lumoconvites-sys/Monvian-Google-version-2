/**
 * Zero-latency Web Audio API sound effects engine for Monvian.
 * Pre-fetches and pre-decodes the trimmed click transient into an AudioBuffer
 * so spot marker clicks trigger with 0ms delay on iOS Safari and desktop.
 */

const SPOT_CLICK_SFX_URL = '/assets/aistudio/spot_click_ui_select.wav';
const MAP_LAYER_TOGGLE_SFX_URL = '/assets/aistudio/sfxmint-ui-menu-12_3dc1a42f.mp3';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Spot click SFX state
let decodedSpotClickBuffer: AudioBuffer | null = null;
let spotClickTrimOffsetSec = 0;
let rawAudioBytesPromise: Promise<ArrayBuffer | null> | null = null;
let decodePromise: Promise<AudioBuffer | null> | null = null;
let fallbackAudioEl: HTMLAudioElement | null = null;

// Map layer toggle SFX state
let decodedMapLayerBuffer: AudioBuffer | null = null;
let mapLayerTrimOffsetSec = 0;
let rawMapLayerBytesPromise: Promise<ArrayBuffer | null> | null = null;
let mapLayerDecodePromise: Promise<AudioBuffer | null> | null = null;
let fallbackMapLayerAudioEl: HTMLAudioElement | null = null;

let iosSilentUnlocked = false;
let globalUnlockListenersAttached = false;

const DEFAULT_SFX_GAIN = 0.92;

/**
 * Checks whether "Sons do Aplicativo" is currently enabled in user settings.
 */
export function isAppSoundEnabled(): boolean {
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
 * Persists the "Sons do Aplicativo" preference and immediately mutes/unmutes active audio outputs.
 */
export function setAppSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('monvian_sound_enabled', String(enabled));
    if (enabled) {
      localStorage.removeItem('monvian_sound_disabled');
    } else {
      localStorage.setItem('monvian_sound_disabled', 'true');
    }
  } catch {
    // Ignore storage quota / private-mode restrictions
  }

  if (masterGain && audioCtx) {
    try {
      masterGain.gain.setValueAtTime(enabled ? DEFAULT_SFX_GAIN : 0, audioCtx.currentTime);
    } catch {
      masterGain.gain.value = enabled ? DEFAULT_SFX_GAIN : 0;
    }
  }

  if (!enabled) {
    for (const el of [fallbackAudioEl, fallbackMapLayerAudioEl]) {
      if (el) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {}
      }
    }
  }
}

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
    masterGain.gain.value = isAppSoundEnabled() ? DEFAULT_SFX_GAIN : 0;
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

function ensureMapLayerFallbackAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!fallbackMapLayerAudioEl) {
    try {
      const el = new Audio(MAP_LAYER_TOGGLE_SFX_URL);
      el.preload = 'auto';
      el.volume = 0.92;
      el.load();
      fallbackMapLayerAudioEl = el;
    } catch {
      return null;
    }
  }
  return fallbackMapLayerAudioEl;
}

/**
 * Detects leading encoder silence in decoded PCM samples (common in MP3 files)
 * so playback starts right at the first audible transient with 0ms lag.
 */
function detectLeadingSilenceOffsetSec(buffer: AudioBuffer): number {
  try {
    const threshold = 0.008;
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    let firstAudibleSample = length;

    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < firstAudibleSample; i++) {
        if (Math.abs(data[i]) >= threshold) {
          firstAudibleSample = i;
          break;
        }
      }
    }

    if (firstAudibleSample >= length) return 0;
    // Keep ~0.5ms of pre-attack headroom so the transient never clips
    const headroomSamples = Math.floor(buffer.sampleRate * 0.0005);
    const startSample = Math.max(0, firstAudibleSample - headroomSamples);
    return startSample / buffer.sampleRate;
  } catch {
    return 0;
  }
}

/**
 * Eagerly fetch the trimmed SFX bytes so decoding can happen instantly on first gesture.
 */
export function prefetchSpotClickSound(): void {
  if (typeof window === 'undefined') return;

  ensureFallbackAudio();

  if (!rawAudioBytesPromise) {
    rawAudioBytesPromise = fetch(SPOT_CLICK_SFX_URL)
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

/**
 * Eagerly fetch and pre-decode the map layer toggle SFX so taps play with 0ms latency.
 */
export function prefetchMapLayerToggleSound(): void {
  if (typeof window === 'undefined') return;

  ensureMapLayerFallbackAudio();

  if (!rawMapLayerBytesPromise) {
    rawMapLayerBytesPromise = fetch(MAP_LAYER_TOGGLE_SFX_URL, { cache: 'force-cache' })
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((bytes) => {
        if (bytes && audioCtx && !decodedMapLayerBuffer && !mapLayerDecodePromise) {
          void decodeMapLayerBuffer(audioCtx, bytes);
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
      spotClickTrimOffsetSec = detectLeadingSilenceOffsetSec(buffer);
      decodedSpotClickBuffer = buffer;
      return buffer;
    } catch {
      decodePromise = null;
      return null;
    }
  })();

  return decodePromise;
}

async function decodeMapLayerBuffer(
  ctx: AudioContext,
  bytes: ArrayBuffer
): Promise<AudioBuffer | null> {
  if (decodedMapLayerBuffer) return decodedMapLayerBuffer;
  if (mapLayerDecodePromise) return mapLayerDecodePromise;

  mapLayerDecodePromise = (async () => {
    try {
      const copy = bytes.slice(0);
      const buffer = await ctx.decodeAudioData(copy);
      mapLayerTrimOffsetSec = detectLeadingSilenceOffsetSec(buffer);
      decodedMapLayerBuffer = buffer;
      return buffer;
    } catch {
      mapLayerDecodePromise = null;
      return null;
    }
  })();

  return mapLayerDecodePromise;
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
  if (
    audioCtx &&
    audioCtx.state === 'running' &&
    decodedSpotClickBuffer &&
    decodedMapLayerBuffer &&
    iosSilentUnlocked
  ) {
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
 * Unlocks AudioContext on user gesture (required by iOS Safari) and warms the decoded AudioBuffers.
 */
export function unlockSpotClickSound(): void {
  if (typeof window === 'undefined') return;

  prefetchSpotClickSound();
  prefetchMapLayerToggleSound();

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

  if (!decodedMapLayerBuffer && rawMapLayerBytesPromise && !mapLayerDecodePromise) {
    void rawMapLayerBytesPromise.then((bytes) => {
      if (bytes && audioCtx && !decodedMapLayerBuffer) {
        return decodeMapLayerBuffer(audioCtx, bytes);
      }
      return null;
    });
  }
}

/**
 * Plays the tourist spot click sound immediately with 0ms latency (only when app sounds are enabled).
 */
export function playSpotClickSound(): void {
  if (typeof window === 'undefined' || !isAppSoundEnabled()) return;

  const ctx = ensureAudioContext();
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (masterGain && masterGain.gain.value === 0) {
      masterGain.gain.value = DEFAULT_SFX_GAIN;
    }

    if (decodedSpotClickBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = decodedSpotClickBuffer;
        source.connect(masterGain ?? ctx.destination);
        source.start(0, spotClickTrimOffsetSec);
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
      fallback.currentTime = spotClickTrimOffsetSec || 0;
      const playResult = fallback.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {});
      }
    } catch {
      // Ignore autoplay restrictions
    }
  }
}

/**
 * Plays the map layer toggle touch SFX immediately with 0ms latency (only when app sounds are enabled).
 */
export function playMapLayerToggleSound(): void {
  if (typeof window === 'undefined' || !isAppSoundEnabled()) return;

  const ctx = ensureAudioContext();
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (masterGain && masterGain.gain.value === 0) {
      masterGain.gain.value = DEFAULT_SFX_GAIN;
    }

    if (decodedMapLayerBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = decodedMapLayerBuffer;
        source.connect(masterGain ?? ctx.destination);
        source.start(0, mapLayerTrimOffsetSec);
        return;
      } catch {
        // Fall through to HTMLAudioElement fallback
      }
    }
  }

  // Fallback only if Web Audio buffer is still decoding on very first instant interaction
  unlockSpotClickSound();
  const fallback = ensureMapLayerFallbackAudio();
  if (fallback) {
    try {
      fallback.currentTime = mapLayerTrimOffsetSec || 0;
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
  prefetchMapLayerToggleSound();
}
