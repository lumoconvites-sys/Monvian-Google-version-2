import { useEffect, useState } from 'react';

export interface IOSBrowserDetectionInput {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  isCapacitorNative?: boolean;
}

export interface StandaloneDetectionInput {
  matchMediaStandalone: boolean;
  matchMediaFullscreen?: boolean;
  navigatorStandalone: boolean;
  isAndroidTrustedWebActivity?: boolean;
  isCapacitorNative?: boolean;
}

export interface PwaGateEvaluationInput {
  isAuthenticated: boolean;
  hasPendingPasswordReset: boolean;
  isOnboardingQuestionsOpen: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

export interface PwaRuntimeStatus {
  isIOS: boolean;
  isStandalone: boolean;
}

/**
 * Pure detector for iPhone / iPad / iPod mobile browsers (Safari and iOS webviews).
 * Excludes native Capacitor wrappers since those are already installed native apps.
 */
export function isIOSBrowserEnvironment(input: IOSBrowserDetectionInput): boolean {
  if (input.isCapacitorNative) return false;
  const ua = String(input.userAgent || '').toLowerCase();
  const isClassicIOS = /iphone|ipod|ipad/.test(ua);
  const isIPadOSDesktopUA =
    String(input.platform || '') === 'MacIntel' && Number(input.maxTouchPoints || 0) > 1;
  return Boolean(isClassicIOS || isIPadOSDesktopUA);
}

/**
 * Pure detector for active standalone PWA execution mode.
 * Uses exclusively live runtime environment signals — never localStorage flags.
 */
export function isStandalonePWAEnvironment(input: StandaloneDetectionInput): boolean {
  return Boolean(
    input.isCapacitorNative ||
      input.matchMediaStandalone ||
      input.matchMediaFullscreen ||
      input.navigatorStandalone ||
      input.isAndroidTrustedWebActivity
  );
}

/**
 * Returns true whenever the current runtime is an iOS mobile browser outside standalone PWA mode.
 */
export function shouldRequireIOSPwaInstall(status: PwaRuntimeStatus): boolean {
  return Boolean(status.isIOS && !status.isStandalone);
}

/**
 * Centralized global access gate predicate for Monvian's mandatory iOS PWA installation flow.
 *
 * Rules:
 * - Unauthenticated users (login/signup) or password reset flows are allowed to complete auth.
 * - Newly signed-up users finish their complementary onboarding questions first, then hit this gate
 *   as the final mandatory onboarding step before any internal app view mounts.
 * - Authenticated users on iPhone/iOS Safari (non-standalone) are strictly blocked from accessing
 *   Map, Itineraries, Saved, Profile, and all internal views.
 * - Opening the installed app from the iOS Home Screen (standalone mode) automatically unlocks access.
 * - Revisiting the URL in Safari re-engages the block automatically based solely on live runtime mode.
 */
export function shouldBlockForIOSPwaInstall(input: PwaGateEvaluationInput): boolean {
  if (!input.isAuthenticated) return false;
  if (input.hasPendingPasswordReset) return false;
  if (input.isOnboardingQuestionsOpen) return false;
  if (!input.isIOS) return false;
  if (input.isStandalone) return false;
  return true;
}

function isCapacitorNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  } catch {
    return false;
  }
}

/**
 * Reads live iOS browser & standalone PWA runtime status synchronously.
 * Safe to invoke during initial React state creation to prevent any frame-0 flash.
 */
export function readLivePwaRuntimeStatus(): PwaRuntimeStatus {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isIOS: false, isStandalone: false };
  }

  const isCapacitorNative = isCapacitorNativeRuntime();

  let matchMediaStandalone = false;
  let matchMediaFullscreen = false;
  try {
    matchMediaStandalone = Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
    matchMediaFullscreen = Boolean(window.matchMedia?.('(display-mode: fullscreen)').matches);
  } catch {
    matchMediaStandalone = false;
    matchMediaFullscreen = false;
  }

  const navigatorStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  let isAndroidTrustedWebActivity = false;
  try {
    isAndroidTrustedWebActivity =
      typeof document !== 'undefined' && document.referrer.includes('android-app://');
  } catch {
    isAndroidTrustedWebActivity = false;
  }

  const isIOS = isIOSBrowserEnvironment({
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
    isCapacitorNative,
  });

  const isStandalone = isStandalonePWAEnvironment({
    matchMediaStandalone,
    matchMediaFullscreen,
    navigatorStandalone,
    isAndroidTrustedWebActivity,
    isCapacitorNative,
  });

  return { isIOS, isStandalone };
}

/**
 * Synchronous helper for module-level preload checks.
 */
export function isIOSBrowserRequiringPwaInstallNow(): boolean {
  return shouldRequireIOSPwaInstall(readLivePwaRuntimeStatus());
}

/**
 * Reactive hook that monitors live iOS standalone PWA display-mode transitions
 * with zero flash on initial mount.
 */
export function useIOSPwaGateStatus(): PwaRuntimeStatus {
  const [status, setStatus] = useState<PwaRuntimeStatus>(() => readLivePwaRuntimeStatus());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshStatus = () => {
      const next = readLivePwaRuntimeStatus();
      setStatus((prev) =>
        prev.isIOS === next.isIOS && prev.isStandalone === next.isStandalone ? prev : next
      );
    };

    refreshStatus();

    const standaloneMql = window.matchMedia?.('(display-mode: standalone)');
    const fullscreenMql = window.matchMedia?.('(display-mode: fullscreen)');

    const bindMediaListener = (mql: MediaQueryList | undefined) => {
      if (!mql) return () => {};
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', refreshStatus);
        return () => mql.removeEventListener('change', refreshStatus);
      }
      if (typeof mql.addListener === 'function') {
        mql.addListener(refreshStatus);
        return () => mql.removeListener(refreshStatus);
      }
      return () => {};
    };

    const unbindStandalone = bindMediaListener(standaloneMql);
    const unbindFullscreen = bindMediaListener(fullscreenMql);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshStatus();
      }
    };

    window.addEventListener('pageshow', refreshStatus);
    window.addEventListener('focus', refreshStatus);
    window.addEventListener('resize', refreshStatus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unbindStandalone();
      unbindFullscreen();
      window.removeEventListener('pageshow', refreshStatus);
      window.removeEventListener('focus', refreshStatus);
      window.removeEventListener('resize', refreshStatus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return status;
}

export interface PostInstallExperienceInput {
  isAuthenticated: boolean;
  requiresIOSPwaInstall: boolean;
  needsSmartOnboarding: boolean;
  isNewAccount?: boolean;
  welcomeCardSeenInDb: boolean;
  globeIntroSeenInDb: boolean;
  mapTutorialStatusInDb?: string | null;
  localWelcomePending: boolean;
  localWelcomeSeen: boolean;
  localGlobePending: boolean;
  localGlobeSeen: boolean;
}

export interface PostInstallExperienceDecision {
  showFirstSignupWelcome: boolean;
  isGlobeIntroPending: boolean;
  isGlobeIntroPlaying: boolean;
  globeIntroSource: 'post-signup' | 'app-open';
}

/**
 * Pure decision engine for Monvian's post-signup cinematic welcome, 3D globe flight,
 * and interactive map onboarding tutorial.
 *
 * Critically handles iOS Home Screen PWA storage isolation:
 * When a new user completes signup + onboarding in Safari, Safari's localStorage is NOT
 * shared with the newly installed Home Screen PWA. Therefore, once the user opens the
 * installed PWA (requiresIOSPwaInstall === false), we rely on authoritative database flags
 * (`welcome_card_seen !== 1`, `globe_intro_seen !== 1`, `map_tutorial_status === 'pending'`)
 * in addition to localStorage hints so the full Welcome -> Globe Flight -> Step-by-step Tutorial
 * sequence ALWAYS plays after installation, and never runs prematurely inside Safari.
 */
export function resolvePostInstallExperienceState(
  input: PostInstallExperienceInput
): PostInstallExperienceDecision {
  if (!input.isAuthenticated) {
    return {
      showFirstSignupWelcome: false,
      isGlobeIntroPending: false,
      isGlobeIntroPlaying: false,
      globeIntroSource: 'app-open',
    };
  }

  const normalizedTutorial = String(input.mapTutorialStatusInDb || '').trim().toLowerCase();
  const isTutorialPendingInDb = normalizedTutorial === 'pending';

  const needsWelcomeCard = Boolean(
    !input.needsSmartOnboarding &&
      !input.welcomeCardSeenInDb &&
      !input.localWelcomeSeen &&
      (input.localWelcomePending || isTutorialPendingInDb || Boolean(input.isNewAccount))
  );

  const needsPostSignupGlobe = Boolean(
    input.needsSmartOnboarding ||
      needsWelcomeCard ||
      (!input.globeIntroSeenInDb &&
        !input.localGlobeSeen &&
        (input.localGlobePending || isTutorialPendingInDb || Boolean(input.isNewAccount)))
  );

  // While user is still on iOS Safari outside standalone mode, defer ALL post-install animations/tutorials
  if (input.requiresIOSPwaInstall) {
    return {
      showFirstSignupWelcome: false,
      isGlobeIntroPending: needsPostSignupGlobe,
      isGlobeIntroPlaying: false,
      globeIntroSource: needsPostSignupGlobe ? 'post-signup' : 'app-open',
    };
  }

  // Still completing the 3-step complementary onboarding questionnaire
  if (input.needsSmartOnboarding) {
    return {
      showFirstSignupWelcome: false,
      isGlobeIntroPending: true,
      isGlobeIntroPlaying: false,
      globeIntroSource: 'post-signup',
    };
  }

  // Installed PWA / Desktop: show Welcome Screen first, holding the 3D globe flight until user taps "Começar"
  if (needsWelcomeCard) {
    return {
      showFirstSignupWelcome: true,
      isGlobeIntroPending: true,
      isGlobeIntroPlaying: false,
      globeIntroSource: 'post-signup',
    };
  }

  // Welcome card already dismissed, but post-signup globe flight is still pending
  if (needsPostSignupGlobe) {
    return {
      showFirstSignupWelcome: false,
      isGlobeIntroPending: false,
      isGlobeIntroPlaying: true,
      globeIntroSource: 'post-signup',
    };
  }

  // Returning user who already finished welcome, post-signup globe intro, and tutorial
  return {
    showFirstSignupWelcome: false,
    isGlobeIntroPending: false,
    isGlobeIntroPlaying: true,
    globeIntroSource: 'app-open',
  };
}

