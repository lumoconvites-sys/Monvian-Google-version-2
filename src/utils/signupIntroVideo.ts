export const SIGNUP_INTRO_VIDEO_SRC = '';

export function getOrCreateSignupIntroVideo(): HTMLVideoElement {
  return document.createElement('video');
}

export function preloadSignupIntroVideo(): void {}

export function unlockSignupIntroVideoOnUserGesture(): void {}
