import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isIOSBrowserEnvironment,
  isStandalonePWAEnvironment,
  shouldBlockForIOSPwaInstall,
  shouldRequireIOSPwaInstall,
} from './pwaGate.ts';

const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1';

const DESKTOP_MAC_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

test('detects iPhone Safari and iPadOS desktop-UA Safari as iOS browser environments', () => {
  assert.equal(
    isIOSBrowserEnvironment({
      userAgent: IPHONE_SAFARI_UA,
      platform: 'iPhone',
      maxTouchPoints: 5,
      isCapacitorNative: false,
    }),
    true
  );

  assert.equal(
    isIOSBrowserEnvironment({
      userAgent: DESKTOP_MAC_SAFARI_UA,
      platform: 'MacIntel',
      maxTouchPoints: 5,
      isCapacitorNative: false,
    }),
    true
  );

  assert.equal(
    isIOSBrowserEnvironment({
      userAgent: DESKTOP_MAC_SAFARI_UA,
      platform: 'MacIntel',
      maxTouchPoints: 0,
      isCapacitorNative: false,
    }),
    false
  );

  assert.equal(
    isIOSBrowserEnvironment({
      userAgent: ANDROID_CHROME_UA,
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
      isCapacitorNative: false,
    }),
    false
  );
});

test('never classifies native Capacitor iOS runtime as a non-installed iOS browser', () => {
  assert.equal(
    isIOSBrowserEnvironment({
      userAgent: IPHONE_SAFARI_UA,
      platform: 'iPhone',
      maxTouchPoints: 5,
      isCapacitorNative: true,
    }),
    false
  );

  assert.equal(
    isStandalonePWAEnvironment({
      matchMediaStandalone: false,
      navigatorStandalone: false,
      isCapacitorNative: true,
    }),
    true
  );
});

test('detects iOS standalone mode via either matchMedia(display-mode: standalone) or navigator.standalone', () => {
  assert.equal(
    isStandalonePWAEnvironment({
      matchMediaStandalone: false,
      navigatorStandalone: false,
    }),
    false
  );

  assert.equal(
    isStandalonePWAEnvironment({
      matchMediaStandalone: true,
      navigatorStandalone: false,
    }),
    true
  );

  assert.equal(
    isStandalonePWAEnvironment({
      matchMediaStandalone: false,
      navigatorStandalone: true,
    }),
    true
  );
});

test('Scenario 1: newly registered authenticated user on iPhone Safari is blocked after onboarding questions finish', () => {
  // While completing complementary signup questions, let OnboardingFlow run first
  assert.equal(
    shouldBlockForIOSPwaInstall({
      isAuthenticated: true,
      hasPendingPasswordReset: false,
      isOnboardingQuestionsOpen: true,
      isIOS: true,
      isStandalone: false,
    }),
    false
  );

  // Immediately upon completing registration/onboarding questions, block internal app access
  assert.equal(
    shouldBlockForIOSPwaInstall({
      isAuthenticated: true,
      hasPendingPasswordReset: false,
      isOnboardingQuestionsOpen: false,
      isIOS: true,
      isStandalone: false,
    }),
    true
  );
});

test('Scenario 2: opening installed Monvian from iPhone Home Screen unlocks automatically', () => {
  assert.equal(
    shouldBlockForIOSPwaInstall({
      isAuthenticated: true,
      hasPendingPasswordReset: false,
      isOnboardingQuestionsOpen: false,
      isIOS: true,
      isStandalone: true,
    }),
    false
  );
  assert.equal(shouldRequireIOSPwaInstall({ isIOS: true, isStandalone: true }), false);
});

test('Scenario 3: returning to Safari outside standalone re-engages the mandatory install gate', () => {
  // Re-evaluating with isStandalone=false always re-blocks (no localStorage bypass)
  assert.equal(
    shouldBlockForIOSPwaInstall({
      isAuthenticated: true,
      hasPendingPasswordReset: false,
      isOnboardingQuestionsOpen: false,
      isIOS: true,
      isStandalone: false,
    }),
    true
  );
  assert.equal(shouldRequireIOSPwaInstall({ isIOS: true, isStandalone: false }), true);
});

test('allows unauthenticated auth screen, password resets, and non-iOS desktop sessions cleanly', () => {
  assert.equal(
    shouldBlockForIOSPwaInstall({
      isAuthenticated: false,
      hasPendingPasswordReset: false,
      isOnboardingQuestionsOpen: false,
      isIOS: true,
      isStandalone: false,
    }),
    false
  );

  assert.equal(
    shouldBlockForIOSPwaInstall({
      isAuthenticated: true,
      hasPendingPasswordReset: true,
      isOnboardingQuestionsOpen: false,
      isIOS: true,
      isStandalone: false,
    }),
    false
  );

  assert.equal(
    shouldBlockForIOSPwaInstall({
      isAuthenticated: true,
      hasPendingPasswordReset: false,
      isOnboardingQuestionsOpen: false,
      isIOS: false,
      isStandalone: false,
    }),
    false
  );
});
