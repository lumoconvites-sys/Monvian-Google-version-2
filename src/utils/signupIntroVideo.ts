export const SIGNUP_INTRO_VIDEO_SRC =
  '/assets/aistudio/signup_intro_video.mp4';

let sharedVideoEl: HTMLVideoElement | null = null;
let isAudioUnlocked = false;

export function getOrCreateSignupIntroVideo(): HTMLVideoElement {
  if (typeof document === 'undefined') {
    throw new Error('Document is not available');
  }

  if (!sharedVideoEl) {
    const v = document.createElement('video');
    v.src = SIGNUP_INTRO_VIDEO_SRC;
    v.preload = 'auto';
    v.playsInline = true;
    v.controls = false;
    v.loop = false;
    v.muted = false;
    v.volume = 1.0;
    v.disablePictureInPicture = true;
    v.setAttribute('playsinline', 'true');
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('preload', 'auto');
    v.setAttribute('disablePictureInPicture', 'true');
    v.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    v.style.width = '100%';
    v.style.height = '100%';
    v.style.objectFit = 'cover';
    v.style.objectPosition = 'center center';
    v.style.display = 'block';
    v.style.pointerEvents = 'none';
    v.style.userSelect = 'none';
    v.style.backgroundColor = '#FFFFFF';
    v.load();
    sharedVideoEl = v;
  }

  return sharedVideoEl;
}

export function preloadSignupIntroVideo(): void {
  if (typeof document === 'undefined') return;
  try {
    getOrCreateSignupIntroVideo();
  } catch {}
}

/**
 * Must be called synchronously inside the user's "Criar conta" tap/submit handler.
 * Because the first 0.50s of the video audio track is silent, briefly starting and
 * immediately pausing the shared HTMLVideoElement unlocks iOS Safari's gesture
 * requirement for unmuted playback.
 */
export function unlockSignupIntroVideoOnUserGesture(): void {
  if (typeof document === 'undefined' || isAudioUnlocked) return;
  try {
    const v = getOrCreateSignupIntroVideo();
    v.muted = false;
    v.volume = 1.0;
    v.currentTime = 0;

    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isAudioUnlocked = true;
          v.pause();
          v.currentTime = 0;
        })
        .catch(() => {
          try {
            v.pause();
            v.currentTime = 0;
          } catch {}
        });
    }
  } catch {}
}
