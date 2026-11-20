/**
 * gpsNavigation.ts
 * Centralized high-performance GPS navigation and location session engine for Monvian.
 * Implements automatic boot-time GPS session reset, single-observer concurrency control,
 * stale/inaccurate coordinate filtering, 60fps marker interpolation, and automatic recovery.
 */

import { saveUserPermissionsToDatabase, syncPermissionsFromDatabase } from './firestoreSync.ts';

export interface GpsRawFix {
  lng: number;
  lat: number;
  speed: number; // km/h
  heading: number | null; // degrees 0-360
  accuracy: number; // meters
  timestamp: number;
}

export interface GpsNavState {
  coords: [number, number]; // [lng, lat]
  interpolatedCoords: [number, number]; // [lng, lat] at 60fps
  speed: number; // km/h (smoothed)
  instantSpeed: number; // km/h
  heading: number; // degrees 0-360 (smoothed)
  accuracy: number;
  isCarMode: boolean; // true when speed > 15 km/h (with hysteresis)
  isMoving: boolean; // speed > 3 km/h
  status: 'locating' | 'granted' | 'denied' | 'prompt';
  lastFixTime: number;
  hasRealFix?: boolean;
  fixRevision?: number;
  sessionId?: number;
}

const DEFAULT_CAMPOS_COORDS: [number, number] = [-45.5908, -22.7394];
const COORDS_META_STORAGE_KEY = 'monvian_last_coords_meta';
const MAX_SAVED_COORDS_AGE_MS = 10 * 60 * 1000; // 10 minutes max for initial fallback cache
const MAX_ACCEPTABLE_ACCURACY_METERS = 2500;
const CONTROLLED_REINIT_DELAY_MS = 180; // Short controlled interval during logo loading screen
const DEFERRED_RETRY_INTERVAL_MS = 3500; // Retry interval if GPS is temporarily unavailable
const WATCHDOG_INTERVAL_MS = 2200; // Continuous watchdog interval to keep moving location alive
const MAX_CAR_EXTRAPOLATION_MS = 2200; // Dead-reckoning cap between fixes when driving fast

// Convert degrees to radians and vice versa
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Calculates distance in meters between two coordinates via Haversine formula
 */
export function calculateHaversineDistance(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates initial bearing from (lng1, lat1) to (lng2, lat2) in degrees [0, 360)
 */
export function calculateBearing(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Calculates shortest angular distance difference [-180, 180]
 */
export function angleDiff(target: number, source: number): number {
  return ((target - source + 540) % 360) - 180;
}

/**
 * Smoothly interpolates angles along the shortest circular arc
 */
export function lerpAngle(from: number, to: number, t: number): number {
  const diff = angleDiff(to, from);
  return (from + diff * t + 360) % 360;
}

/**
 * Project a coordinate forward by distance (meters) along a heading (degrees)
 */
export function projectCoordinate(
  lng: number,
  lat: number,
  distanceMeters: number,
  headingDeg: number
): [number, number] {
  const R = 6371000;
  const dByR = distanceMeters / R;
  const radHeading = toRad(headingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(dByR) + Math.cos(φ1) * Math.sin(dByR) * Math.cos(radHeading)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(radHeading) * Math.sin(dByR) * Math.cos(φ1),
      Math.cos(dByR) - Math.sin(φ1) * Math.sin(φ2)
    );

  return [toDeg(λ2), toDeg(φ2)];
}

type NavListener = (state: GpsNavState) => void;

function isValidCoordinatePair(lng: unknown, lat: unknown): boolean {
  if (typeof lng !== 'number' || typeof lat !== 'number') return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}

/**
 * Returns saved coordinates ONLY if they have verified recent metadata.
 * Discards old or unverified cached coordinates so stale positions never mislead the user on startup.
 */
function getFreshSavedInitialCoords(): [number, number] {
  if (typeof window === 'undefined') return [...DEFAULT_CAMPOS_COORDS];
  try {
    const rawMeta = localStorage.getItem(COORDS_META_STORAGE_KEY);
    if (rawMeta) {
      const parsed = JSON.parse(rawMeta);
      const age = Date.now() - Number(parsed?.timestamp || 0);
      const accuracy = Number(parsed?.accuracy || 9999);
      if (
        Array.isArray(parsed?.coords) &&
        parsed.coords.length === 2 &&
        isValidCoordinatePair(parsed.coords[0], parsed.coords[1]) &&
        age >= 0 &&
        age <= MAX_SAVED_COORDS_AGE_MS &&
        accuracy <= 500
      ) {
        return [parsed.coords[0], parsed.coords[1]];
      }
    }
  } catch {}
  return [...DEFAULT_CAMPOS_COORDS];
}

function isLocationPreviouslyGranted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (
      localStorage.getItem('monvian_location_permission_granted') === 'true' ||
      document.cookie.includes('monvian_location_granted=true')
    ) {
      return true;
    }
    const savedUser = JSON.parse(localStorage.getItem('monvian_user') || '{}');
    if (savedUser?.location_permission_granted === 1) {
      return true;
    }
  } catch {}
  return false;
}

class GpsNavigationManager {
  private listeners: Set<NavListener> = new Set();

  private state: GpsNavState = {
    coords: getFreshSavedInitialCoords(),
    interpolatedCoords: getFreshSavedInitialCoords(),
    speed: 0,
    instantSpeed: 0,
    heading: 0,
    accuracy: 15,
    isCarMode: false,
    isMoving: false,
    status: 'locating',
    lastFixTime: 0,
    hasRealFix: false,
    fixRevision: 0,
    sessionId: 0,
  };

  // Interpolation timeline state
  private startPoint: [number, number] = getFreshSavedInitialCoords();
  private targetPoint: [number, number] = getFreshSavedInitialCoords();
  private currentInterpolated: [number, number] = getFreshSavedInitialCoords();
  private currentHeading: number = 0;
  private targetHeading: number = 0;

  private segmentStartTime: number = performance.now();
  private expectedDuration: number = 1000; // ms
  private lastGpsFixTime: number = performance.now();
  private prevRawFix: GpsRawFix | null = null;
  private lastAcceptedDeviceTimestamp: number = 0;

  // Session & Watcher concurrency handles
  private sessionId: number = 0;
  private watchId: number | null = null;
  private reinitTimerId: number | null = null;
  private retryTimerId: number | null = null;
  private pollIntervalId: number | null = null;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private isResetting: boolean = false;
  private hasBootResetExecuted: boolean = false;
  private hasPersistedPermission: boolean = isLocationPreviouslyGranted();
  private isImmediateRequestInFlight: boolean = false;
  private lastImmediateRequestAt: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      // Automatically re-verify and refresh location immediately when app returns to foreground
      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'visible' && this.isRunning) {
            const ageSinceLastFix = Date.now() - (this.state.lastFixTime || 0);
            if (!this.state.hasRealFix || ageSinceLastFix > 2000) {
              this.requestImmediatePositionUpdate(this.sessionId);
            }
            if (this.watchId === null || ageSinceLastFix > 5000) {
              this.attachSingleWatcher(this.sessionId);
            }
          }
        },
        { passive: true }
      );

      window.addEventListener(
        'online',
        () => {
          if (this.isRunning) {
            this.requestImmediatePositionUpdate(this.sessionId);
            if (this.watchId === null) {
              this.attachSingleWatcher(this.sessionId);
            }
          }
        },
        { passive: true }
      );
    }
  }

  private hasAuthToken(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(localStorage.getItem('monvian_token') && localStorage.getItem('monvian_user'));
    } catch {
      return false;
    }
  }

  public subscribe(listener: NavListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    if (!this.hasBootResetExecuted) {
      this.resetSessionOnBoot();
    } else if (!this.isRunning) {
      this.start();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  public getState(): GpsNavState {
    return { ...this.state };
  }

  public getCurrentInterpolatedCoords(): [number, number] {
    return [...this.currentInterpolated];
  }

  public getCurrentHeading(): number {
    return this.currentHeading;
  }

  public isCarMode(): boolean {
    return this.state.isCarMode;
  }

  /**
   * Executes automatic GPS session reset during the app loading screen with the logo.
   * Ensures every new app launch performs a clean teardown and fresh observer registration.
   */
  public resetSessionOnBoot(): void {
    if (typeof window === 'undefined') return;
    if (this.hasBootResetExecuted && this.isResetting) return;
    this.hasBootResetExecuted = true;
    this.resetSession();
  }

  /**
   * Synchronously requests geolocation inside a direct user gesture (tap/click).
   * Critical on iOS Safari / WebKit where setTimeout or awaiting Permissions API loses user activation.
   */
  public requestPermissionAndStartFromGesture(): void {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    try {
      localStorage.setItem('monvian_location_perm', 'true');
      localStorage.setItem('monvian_location_permission_granted', 'true');
    } catch {}

    this.teardownActiveTracking();

    const activeSessionId = ++this.sessionId;
    this.state.sessionId = activeSessionId;
    this.isRunning = true;
    this.isResetting = false;
    this.hasBootResetExecuted = true;
    this.isImmediateRequestInFlight = false;

    this.prevRawFix = null;
    this.lastAcceptedDeviceTimestamp = 0;
    this.state.hasRealFix = false;
    this.state.status = 'locating';
    this.notify();

    if (this.animFrameId === null) {
      this.startAnimationLoop();
    }

    // Call getCurrentPosition & watchPosition synchronously in the same user-gesture tick
    this.requestImmediatePositionUpdate(activeSessionId);
    this.attachSingleWatcher(activeSessionId);
    this.startWatchdog(activeSessionId);
    this.scheduleDeferredRetry(activeSessionId);
  }

  /**
   * Requests an immediate fresh fix without tearing down smooth ongoing tracking.
   */
  public refreshPositionNow(): void {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    if (!this.isRunning) {
      this.requestPermissionAndStartFromGesture();
      return;
    }
    if (this.state.status === 'denied') {
      this.requestPermissionAndStartFromGesture();
      return;
    }
    this.requestImmediatePositionUpdate(this.sessionId);
    if (this.watchId === null) {
      this.attachSingleWatcher(this.sessionId);
    }
  }

  /**
   * Full GPS Session Reset Procedure:
   * 1. Checks location service availability & preserved permissions.
   * 2. Temporarily stops active tracking, removes previous observer, and cancels pending updates.
   * 3. Re-registers the GPS observer, requesting a fresh fix immediately.
   * 4. Immediately updates global state, marker, and map camera on valid fix without blocking app load.
   */
  public resetSession(): void {
    if (typeof window === 'undefined') return;

    // Step 1: Check state of the location service used by the app
    if (!('geolocation' in navigator)) {
      this.state.status = 'denied';
      this.notify();
      return;
    }

    // Step 2: Temporarily stop active tracking, remove previous watcher, cancel pending updates
    this.teardownActiveTracking();

    const activeSessionId = ++this.sessionId;
    this.state.sessionId = activeSessionId;
    this.isRunning = true;
    this.isResetting = false;
    this.isImmediateRequestInFlight = false;

    // Reset session fix markers so stale coordinates never masquerade as a live fix
    this.prevRawFix = null;
    this.lastAcceptedDeviceTimestamp = 0;
    this.state.hasRealFix = false;
    this.state.status = 'locating';
    this.notify();

    if (this.animFrameId === null) {
      this.startAnimationLoop();
    }

    // Preserve existing permissions in background only when logged in
    if (this.hasAuthToken()) {
      syncPermissionsFromDatabase()
        .then((dbSync) => {
          if (activeSessionId !== this.sessionId) return;
          if (dbSync.locationGranted) {
            this.hasPersistedPermission = true;
          }
        })
        .catch(() => {});
    }

    // Step 3: Immediately register the GPS observer + request fresh fix
    this.registerFreshGpsSession(activeSessionId);
  }

  /**
   * Starts GPS tracking if not already running or resetting.
   * Reuses the centralized session without creating duplicate watchers.
   */
  public start(): void {
    if (typeof window === 'undefined') return;

    if (!this.hasBootResetExecuted) {
      this.resetSessionOnBoot();
      return;
    }

    if (this.isRunning && (this.watchId !== null || this.isResetting)) {
      const age = Date.now() - (this.state.lastFixTime || 0);
      if (!this.state.hasRealFix || age > 3000) {
        this.requestImmediatePositionUpdate(this.sessionId);
      }
      if (this.pollIntervalId === null) {
        this.startWatchdog(this.sessionId);
      }
      return;
    }

    this.resetSession();
  }

  /**
   * Stops tracking and cleans up all observers and timers
   */
  public stop(): void {
    this.isRunning = false;
    this.isResetting = false;
    this.sessionId++;
    this.teardownActiveTracking();

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Removes active geolocation observer and cancels any pending timers
   */
  private teardownActiveTracking(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        navigator.geolocation.clearWatch(this.watchId);
      } catch {}
      this.watchId = null;
    }

    if (this.reinitTimerId !== null) {
      window.clearTimeout(this.reinitTimerId);
      this.reinitTimerId = null;
    }

    if (this.retryTimerId !== null) {
      window.clearTimeout(this.retryTimerId);
      this.retryTimerId = null;
    }

    if (this.pollIntervalId !== null) {
      window.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Registers the single GPS observer and requests an immediate fresh position from the device
   */
  private registerFreshGpsSession(targetSessionId: number): void {
    if (targetSessionId !== this.sessionId || !this.isRunning) return;
    if (!('geolocation' in navigator)) return;

    // Request an immediate fresh position from hardware/OS synchronously first
    this.requestImmediatePositionUpdate(targetSessionId);

    // Register the single continuous GPS observer synchronously
    this.attachSingleWatcher(targetSessionId);

    // Keep continuous watchdog alive so fast driving / cellular handovers never stall
    this.startWatchdog(targetSessionId);

    // Schedule non-blocking fallback retry in case GPS signal is temporarily unavailable at startup
    this.scheduleDeferredRetry(targetSessionId);

    // Attach permission change listener in background if supported
    if (typeof navigator.permissions?.query === 'function') {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permStatus) => {
          if (targetSessionId !== this.sessionId) return;
          if (permStatus.state === 'granted') {
            this.hasPersistedPermission = true;
          }
          permStatus.onchange = () => {
            if (targetSessionId !== this.sessionId) return;
            if (permStatus.state === 'granted') {
              this.hasPersistedPermission = true;
              if (this.hasAuthToken()) {
                saveUserPermissionsToDatabase({ locationGranted: true }).catch(() => {});
              }
              this.requestImmediatePositionUpdate(this.sessionId);
              this.attachSingleWatcher(this.sessionId);
            } else if (permStatus.state === 'denied') {
              this.state.status = 'denied';
              this.notify();
            }
          };
        })
        .catch(() => {});
    }
  }

  /**
   * Continuous watchdog: polls fresh coordinates if watchPosition silently stalls while moving
   * and re-attaches dropped OS watchers automatically.
   */
  private startWatchdog(targetSessionId: number): void {
    if (typeof window === 'undefined') return;
    if (this.pollIntervalId !== null) {
      window.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    this.pollIntervalId = window.setInterval(() => {
      if (targetSessionId !== this.sessionId || !this.isRunning) {
        if (this.pollIntervalId !== null) {
          window.clearInterval(this.pollIntervalId);
          this.pollIntervalId = null;
        }
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      if (this.state.status === 'denied') {
        if (typeof navigator.permissions?.query === 'function') {
          navigator.permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((permStatus) => {
              if (targetSessionId !== this.sessionId || !this.isRunning) return;
              if (permStatus.state === 'granted' || permStatus.state === 'prompt') {
                this.state.status = 'locating';
                this.notify();
                this.requestImmediatePositionUpdate(targetSessionId);
                this.attachSingleWatcher(targetSessionId);
              }
            })
            .catch(() => {});
        }
        return;
      }

      const ageSinceLastFix = Date.now() - (this.state.lastFixTime || 0);
      if (!this.state.hasRealFix || ageSinceLastFix > 2200) {
        this.requestImmediatePositionUpdate(targetSessionId);
      }

      if (this.watchId === null || (this.state.hasRealFix && ageSinceLastFix > 7000)) {
        this.attachSingleWatcher(targetSessionId);
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  /**
   * Requests an immediate fresh position (maximumAge: 0) with balanced-accuracy fallback
   */
  private requestImmediatePositionUpdate(targetSessionId: number): void {
    if (targetSessionId !== this.sessionId || !('geolocation' in navigator)) return;

    const nowMs = Date.now();
    if (this.isImmediateRequestInFlight && nowMs - this.lastImmediateRequestAt < 6500) {
      return;
    }

    this.isImmediateRequestInFlight = true;
    this.lastImmediateRequestAt = nowMs;

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.isImmediateRequestInFlight = false;
          this.handleRawFix(pos, targetSessionId);
        },
        (err) => {
          if (targetSessionId !== this.sessionId) {
            this.isImmediateRequestInFlight = false;
            return;
          }
          if (err.code === 1) {
            this.isImmediateRequestInFlight = false;
            // PERMISSION_DENIED
            this.state.status = 'denied';
            this.notify();
            return;
          }
          // If high-accuracy timed out or position unavailable, try balanced accuracy once
          try {
            navigator.geolocation.getCurrentPosition(
              (fallbackPos) => {
                this.isImmediateRequestInFlight = false;
                this.handleRawFix(fallbackPos, targetSessionId);
              },
              () => {
                this.isImmediateRequestInFlight = false;
                this.scheduleDeferredRetry(targetSessionId);
              },
              {
                enableHighAccuracy: false,
                maximumAge: 3000,
                timeout: 5000,
              }
            );
          } catch {
            this.isImmediateRequestInFlight = false;
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 6000,
        }
      );
    } catch {
      this.isImmediateRequestInFlight = false;
    }
  }

  /**
   * Ensures at most one continuous watchPosition observer is registered at any time
   */
  private attachSingleWatcher(targetSessionId: number): void {
    if (targetSessionId !== this.sessionId || !('geolocation' in navigator)) return;

    // Prevent duplicate watchers
    if (this.watchId !== null) {
      try {
        navigator.geolocation.clearWatch(this.watchId);
      } catch {}
      this.watchId = null;
    }

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.handleRawFix(pos, targetSessionId);
        },
        (err) => {
          if (targetSessionId !== this.sessionId) return;
          if (err.code === 1) {
            this.state.status = 'denied';
            this.notify();
          } else {
            // Clear stalled handle so watchdog/retry cleanly re-subscribes without losing tracking mid-drive
            if (this.watchId !== null) {
              try {
                navigator.geolocation.clearWatch(this.watchId);
              } catch {}
              this.watchId = null;
            }
            this.scheduleDeferredRetry(targetSessionId);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
    } catch (e) {
      console.warn('Failed to start watchPosition:', e);
      this.scheduleDeferredRetry(targetSessionId);
    }
  }

  /**
   * Keeps GPS alive across temporary signal drops / tunnels and re-attaches watcher cleanly
   */
  private scheduleDeferredRetry(targetSessionId: number): void {
    if (targetSessionId !== this.sessionId || !this.isRunning) return;
    if (this.retryTimerId !== null) {
      window.clearTimeout(this.retryTimerId);
      this.retryTimerId = null;
    }

    this.retryTimerId = window.setTimeout(() => {
      this.retryTimerId = null;
      if (targetSessionId !== this.sessionId || !this.isRunning) return;
      if (this.state.status === 'denied') return;

      const ageSinceLastFix = Date.now() - (this.state.lastFixTime || 0);
      if (!this.state.hasRealFix || ageSinceLastFix > 3000) {
        this.requestImmediatePositionUpdate(targetSessionId);
      }
      if (this.watchId === null) {
        this.attachSingleWatcher(targetSessionId);
      }
      if (!this.state.hasRealFix || this.watchId === null) {
        this.scheduleDeferredRetry(targetSessionId);
      }
    }, DEFERRED_RETRY_INTERVAL_MS);
  }

  /**
   * Validates incoming GPS fix and discards invalid, severely out-of-order, or transient coarse jumps
   * without ever permanently freezing location when accuracy degrades during fast driving.
   */
  private isValidAndFreshFix(pos: GeolocationPosition, targetSessionId: number): boolean {
    if (targetSessionId !== this.sessionId || !this.isRunning) return false;
    if (!pos || !pos.coords) return false;

    const rawLng = pos.coords.longitude;
    const rawLat = pos.coords.latitude;
    const accuracy = typeof pos.coords.accuracy === 'number' && pos.coords.accuracy > 0 ? pos.coords.accuracy : 15;
    const fixTimestamp = typeof pos.timestamp === 'number' && pos.timestamp > 0 ? pos.timestamp : Date.now();

    if (!isValidCoordinatePair(rawLng, rawLat)) return false;

    // Always accept the very first valid coordinate fix of the session so user location works immediately
    if (!this.state.hasRealFix) {
      return true;
    }

    if (accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      return false;
    }

    // Reject clearly older fixes while allowing minor clock jitter between getCurrentPosition & watchPosition
    if (this.lastAcceptedDeviceTimestamp > 0 && fixTimestamp < this.lastAcceptedDeviceTimestamp - 1500) {
      return false;
    }

    // Only reject sudden extreme low-accuracy cell spikes briefly (< 5s since last fix) so driving handovers never lock location
    const msSinceLastAccepted = Date.now() - (this.state.lastFixTime || 0);
    if (this.prevRawFix && msSinceLastAccepted < 5000) {
      const prevAcc = this.prevRawFix.accuracy || 20;
      if (prevAcc <= 80 && accuracy > Math.max(800, prevAcc * 10)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Processes a validated GPS fix and immediately updates state, marker, and persistence
   */
  private handleRawFix(pos: GeolocationPosition, targetSessionId: number): void {
    if (!this.isValidAndFreshFix(pos, targetSessionId)) return;

    const rawLng = pos.coords.longitude;
    const rawLat = pos.coords.latitude;
    const accuracy = typeof pos.coords.accuracy === 'number' && pos.coords.accuracy > 0 ? pos.coords.accuracy : 10;
    const fixTimestamp = typeof pos.timestamp === 'number' && pos.timestamp > 0 ? pos.timestamp : Date.now();
    const nowTime = performance.now();
    const dt = (nowTime - this.lastGpsFixTime) / 1000; // seconds

    const isFirstFixOfSession = !this.state.hasRealFix;

    this.lastGpsFixTime = nowTime;
    this.lastAcceptedDeviceTimestamp = fixTimestamp;
    this.state.status = 'granted';
    this.state.accuracy = accuracy;
    this.state.lastFixTime = Date.now();
    this.state.hasRealFix = true;
    this.state.fixRevision = (this.state.fixRevision || 0) + 1;

    // Clear deferred retry timer once a valid real fix is acquired
    if (this.retryTimerId !== null) {
      window.clearTimeout(this.retryTimerId);
      this.retryTimerId = null;
    }

    try {
      localStorage.setItem('monvian_last_coords', JSON.stringify([rawLng, rawLat]));
      localStorage.setItem(
        COORDS_META_STORAGE_KEY,
        JSON.stringify({
          coords: [rawLng, rawLat],
          timestamp: Date.now(),
          accuracy,
        })
      );
    } catch {}

    if (!this.hasPersistedPermission && this.hasAuthToken()) {
      this.hasPersistedPermission = true;
      saveUserPermissionsToDatabase({
        locationGranted: true,
        coords: [rawLng, rawLat],
      }).catch(() => {});
    }

    // Calculate instantaneous speed and bearing
    let calculatedSpeedKmH = 0;
    let computedBearing: number | null = null;

    if (this.prevRawFix && !isFirstFixOfSession) {
      const distance = calculateHaversineDistance(
        this.prevRawFix.lng,
        this.prevRawFix.lat,
        rawLng,
        rawLat
      );

      if (dt > 0.1 && dt < 30) {
        const rawSpeedMps = distance / dt;
        calculatedSpeedKmH = rawSpeedMps * 3.6;

        if (distance > 1.5) {
          computedBearing = calculateBearing(
            this.prevRawFix.lng,
            this.prevRawFix.lat,
            rawLng,
            rawLat
          );
        }
      }
    }

    let instantSpeed = 0;
    const hasNativeSpeed =
      pos.coords.speed !== null &&
      typeof pos.coords.speed === 'number' &&
      !isNaN(pos.coords.speed) &&
      pos.coords.speed >= 0;

    if (hasNativeSpeed) {
      const nativeSpeedKmH = pos.coords.speed! * 3.6;
      // Some mobile webviews report native speed as 0 intermittently while moving; fall back to distance/dt
      instantSpeed =
        nativeSpeedKmH < 1 && calculatedSpeedKmH > 5 && accuracy <= 150
          ? calculatedSpeedKmH
          : nativeSpeedKmH;
    } else {
      instantSpeed = calculatedSpeedKmH;
    }

    if (instantSpeed > 240) {
      instantSpeed = this.state.speed;
    }

    const alpha = instantSpeed > 15 ? 0.5 : 0.35;
    const smoothedSpeed = isFirstFixOfSession
      ? instantSpeed
      : this.state.speed * (1 - alpha) + instantSpeed * alpha;

    let targetHeading = this.currentHeading;
    if (pos.coords.heading !== null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
      targetHeading = pos.coords.heading;
    } else if (computedBearing !== null && instantSpeed > 4) {
      targetHeading = computedBearing;
    }

    const distanceFromCurrentInterpolated = calculateHaversineDistance(
      this.currentInterpolated[0],
      this.currentInterpolated[1],
      rawLng,
      rawLat
    );

    // On first valid fix of the session or very large relocation (> 1.5km),
    // snap immediately; otherwise smoothly interpolate even at highway driving speeds
    if (isFirstFixOfSession || distanceFromCurrentInterpolated > 1500) {
      this.startPoint = [rawLng, rawLat];
      this.targetPoint = [rawLng, rawLat];
      this.currentInterpolated = [rawLng, rawLat];
      this.state.interpolatedCoords = [rawLng, rawLat];
    } else {
      this.startPoint = [...this.currentInterpolated];
      this.targetPoint = [rawLng, rawLat];
    }

    this.targetHeading = targetHeading;
    this.expectedDuration = Math.max(250, Math.min(1200, dt * 1000));
    this.segmentStartTime = nowTime;

    this.state.coords = [rawLng, rawLat];
    this.state.instantSpeed = Math.round(instantSpeed * 10) / 10;
    this.state.speed = Math.round(smoothedSpeed * 10) / 10;
    this.state.isCarMode = smoothedSpeed > 15 || (this.state.isCarMode && smoothedSpeed > 8);
    this.state.isMoving = smoothedSpeed > 2.5;

    this.prevRawFix = {
      lng: rawLng,
      lat: rawLat,
      speed: instantSpeed,
      heading: targetHeading,
      accuracy,
      timestamp: Date.now(),
    };

    this.notify();

    if (this.isRunning && this.animFrameId === null) {
      this.startAnimationLoop();
    }
  }

  /**
   * 60fps RequestAnimationFrame Animation Loop
   * Smoothly interpolates coordinates and applies dead-reckoning extrapolation,
   * automatically sleeping when interpolation settles to save CPU/GPU budget for the map.
   */
  private startAnimationLoop(): void {
    if (this.animFrameId !== null) return;

    let lastFrameTime = 0;

    const frame = (now: number) => {
      if (!this.isRunning) {
        this.animFrameId = null;
        return;
      }

      // Sleep rAF loop when app tab is backgrounded to preserve battery/CPU
      if (typeof document !== 'undefined' && document.hidden) {
        this.animFrameId = null;
        return;
      }

      const dtSec = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.08) : 0.0167;
      lastFrameTime = now;

      const elapsed = now - this.segmentStartTime;
      const duration = this.expectedDuration || 800;
      const fraction = Math.min(1.0, elapsed / duration);

      // Keep constant velocity when driving fast (> 8 km/h); ease-out gently when walking/stopping
      const ease =
        this.state.isMoving && this.state.speed > 8
          ? fraction
          : 1 - Math.pow(1 - fraction, 3);

      let currentLng = this.startPoint[0] + (this.targetPoint[0] - this.startPoint[0]) * ease;
      let currentLat = this.startPoint[1] + (this.targetPoint[1] - this.startPoint[1]) * ease;

      const isExtrapolating =
        elapsed > duration &&
        elapsed - duration < MAX_CAR_EXTRAPOLATION_MS &&
        this.state.isMoving &&
        this.state.speed > 4;

      // Dead-reckoning extrapolation when moving between GPS fixes
      if (isExtrapolating) {
        const extraTimeSec = Math.min(
          MAX_CAR_EXTRAPOLATION_MS / 1000,
          (elapsed - duration) / 1000
        );
        if (extraTimeSec > 0) {
          const speedMps = this.state.speed / 3.6;
          const projectedDist = speedMps * extraTimeSec;
          const [pLng, pLat] = projectCoordinate(
            this.targetPoint[0],
            this.targetPoint[1],
            projectedDist,
            this.targetHeading
          );
          currentLng = pLng;
          currentLat = pLat;
        }
      }

      // Frame-rate independent exponential smoothing for 60Hz & 120Hz consistency
      const angleDiffVal = Math.abs(angleDiff(this.targetHeading, this.currentHeading));
      const lambda = angleDiffVal > 45 ? 9.0 : angleDiffVal < 5 ? 3.2 : 5.0;
      const angleEase = Math.min(1, 1 - Math.exp(-lambda * dtSec));
      this.currentHeading =
        angleDiffVal < 0.35
          ? this.targetHeading
          : lerpAngle(this.currentHeading, this.targetHeading, angleEase);

      const prevLng = this.currentInterpolated[0];
      const prevLat = this.currentInterpolated[1];
      const prevHeading = this.state.heading;
      const newHeading = Math.round(this.currentHeading);

      const posChanged =
        Math.abs(currentLng - prevLng) > 1e-7 ||
        Math.abs(currentLat - prevLat) > 1e-7;
      const headingChanged = newHeading !== prevHeading;

      this.currentInterpolated = [currentLng, currentLat];
      this.state.interpolatedCoords = [currentLng, currentLat];
      this.state.heading = newHeading;

      if (posChanged || headingChanged) {
        this.notify();
      }

      const settled =
        fraction >= 1.0 &&
        !isExtrapolating &&
        Math.abs(angleDiff(this.targetHeading, this.currentHeading)) < 0.5;

      if (settled) {
        this.animFrameId = null;
        return;
      }

      this.animFrameId = requestAnimationFrame(frame);
    };

    this.animFrameId = requestAnimationFrame(frame);
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

// Global Singleton Instance
export const gpsNavigationManager = new GpsNavigationManager();
