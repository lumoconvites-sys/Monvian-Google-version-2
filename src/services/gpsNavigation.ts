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
const DEFERRED_RETRY_INTERVAL_MS = 9000; // Retry interval if GPS is temporarily unavailable

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

  constructor() {
    if (typeof window !== 'undefined') {
      // Automatically re-verify and refresh location when app returns to foreground if needed
      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'visible' && this.isRunning) {
            const ageSinceLastFix = Date.now() - (this.state.lastFixTime || 0);
            if (!this.state.hasRealFix || ageSinceLastFix > 45000) {
              this.requestImmediatePositionUpdate(this.sessionId);
            }
          }
        },
        { passive: true }
      );
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
      const token = localStorage.getItem('monvian_token');
      const savedUser = localStorage.getItem('monvian_user');
      if (!token || !savedUser) return;
    } catch {}

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
    this.scheduleDeferredRetry(activeSessionId);
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

    // Never request browser geolocation when user is not logged in
    try {
      const token = localStorage.getItem('monvian_token');
      const savedUser = localStorage.getItem('monvian_user');
      if (!token || !savedUser) {
        return;
      }
    } catch {}

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

    // Reset session fix markers so stale coordinates never masquerade as a live fix
    this.prevRawFix = null;
    this.lastAcceptedDeviceTimestamp = 0;
    this.state.hasRealFix = false;
    this.state.status = 'locating';
    this.notify();

    // Demand-driven animation loop starts automatically when a GPS fix triggers interpolation

    // Preserve existing permissions in background without blocking or overwriting coordinates
    syncPermissionsFromDatabase()
      .then((dbSync) => {
        if (activeSessionId !== this.sessionId) return;
        if (dbSync.locationGranted) {
          this.hasPersistedPermission = true;
        }
      })
      .catch(() => {});

    // Step 3: Immediately register the GPS observer + request fresh fix
    this.registerFreshGpsSession(activeSessionId);
  }

  /**
   * Starts GPS tracking if not already running or resetting.
   * Reuses the centralized session without creating duplicate watchers.
   */
  public start(): void {
    if (typeof window === 'undefined') return;

    try {
      const token = localStorage.getItem('monvian_token');
      const savedUser = localStorage.getItem('monvian_user');
      if (!token || !savedUser) return;
    } catch {}

    if (!this.hasBootResetExecuted) {
      this.resetSessionOnBoot();
      return;
    }

    if (this.isRunning && (this.watchId !== null || this.isResetting)) {
      // If already running but we don't have a real fix yet, trigger a non-blocking refresh
      if (!this.state.hasRealFix) {
        this.requestImmediatePositionUpdate(this.sessionId);
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
              saveUserPermissionsToDatabase({ locationGranted: true }).catch(() => {});
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
   * Requests an immediate fresh position (maximumAge: 0) with fallback if high-accuracy times out
   */
  private requestImmediatePositionUpdate(targetSessionId: number): void {
    if (targetSessionId !== this.sessionId || !('geolocation' in navigator)) return;

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.handleRawFix(pos, targetSessionId);
        },
        (err) => {
          if (targetSessionId !== this.sessionId) return;
          if (err.code === 1) {
            // PERMISSION_DENIED
            this.state.status = 'denied';
            this.notify();
            return;
          }
          // If high-accuracy timed out or position unavailable indoors, try balanced accuracy once
          try {
            navigator.geolocation.getCurrentPosition(
              (fallbackPos) => {
                this.handleRawFix(fallbackPos, targetSessionId);
              },
              () => {
                this.scheduleDeferredRetry(targetSessionId);
              },
              {
                enableHighAccuracy: false,
                maximumAge: 15000,
                timeout: 8000,
              }
            );
          } catch {}
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 8000,
        }
      );
    } catch {}
  }

  /**
   * Ensures at most one watchPosition observer is registered at any time
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
            this.scheduleDeferredRetry(targetSessionId);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 12000,
        }
      );
    } catch (e) {
      console.warn('Failed to start watchPosition:', e);
      this.scheduleDeferredRetry(targetSessionId);
    }
  }

  /**
   * If GPS is unavailable or slow during startup, keeps the app functional and retries later
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

      if (!this.state.hasRealFix) {
        this.requestImmediatePositionUpdate(targetSessionId);
        if (this.watchId === null) {
          this.attachSingleWatcher(targetSessionId);
        }
        this.scheduleDeferredRetry(targetSessionId);
      }
    }, DEFERRED_RETRY_INTERVAL_MS);
  }

  /**
   * Validates incoming GPS fix and discards stale, out-of-order, or inaccurate coordinates
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

    // 1. Never allow an older device timestamp to overwrite a newer accepted fix
    if (this.lastAcceptedDeviceTimestamp > 0 && fixTimestamp < this.lastAcceptedDeviceTimestamp) {
      return false;
    }

    // 2. If we already have a reliable real fix in this session, reject sudden low-accuracy regressions
    if (this.prevRawFix) {
      const prevAcc = this.prevRawFix.accuracy || 20;
      if (prevAcc <= 80 && accuracy > Math.max(300, prevAcc * 4)) {
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

    if (!this.hasPersistedPermission) {
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

      if (dt > 0.1 && dt < 15) {
        const rawSpeedMps = distance / dt;
        calculatedSpeedKmH = rawSpeedMps * 3.6;

        if (distance > 2) {
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
    if (pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0) {
      instantSpeed = pos.coords.speed * 3.6;
    } else {
      instantSpeed = calculatedSpeedKmH;
    }

    if (instantSpeed > 220) {
      instantSpeed = this.state.speed;
    }

    const alpha = 0.35;
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

    // On first valid fix of the session or large position correction (> 100m),
    // snap immediately to the fresh coordinate so old/fallback coords never linger
    if (isFirstFixOfSession || distanceFromCurrentInterpolated > 100) {
      this.startPoint = [rawLng, rawLat];
      this.targetPoint = [rawLng, rawLat];
      this.currentInterpolated = [rawLng, rawLat];
      this.state.interpolatedCoords = [rawLng, rawLat];
    } else {
      this.startPoint = [...this.currentInterpolated];
      this.targetPoint = [rawLng, rawLat];
    }

    this.targetHeading = targetHeading;
    this.expectedDuration = Math.max(400, Math.min(2000, dt * 1000));
    this.segmentStartTime = nowTime;

    this.state.coords = [rawLng, rawLat];
    this.state.instantSpeed = Math.round(instantSpeed * 10) / 10;
    this.state.speed = Math.round(smoothedSpeed * 10) / 10;
    this.state.isCarMode = false;
    this.state.isMoving = smoothedSpeed > 3.0;

    this.prevRawFix = {
      lng: rawLng,
      lat: rawLat,
      speed: instantSpeed,
      heading: targetHeading,
      accuracy,
      timestamp: Date.now(),
    };

    this.notify();

    const needsPosInterpolation =
      Math.abs(this.targetPoint[0] - this.currentInterpolated[0]) > 1e-7 ||
      Math.abs(this.targetPoint[1] - this.currentInterpolated[1]) > 1e-7;
    const needsHeadingInterpolation =
      Math.abs(angleDiff(this.targetHeading, this.currentHeading)) > 0.25;
    if (needsPosInterpolation || needsHeadingInterpolation || (this.state.isMoving && this.state.speed > 4)) {
      if (this.animFrameId === null) {
        this.startAnimationLoop();
      }
    }
  }

  /**
   * Demand-driven 60fps RequestAnimationFrame Animation Loop
   * Interpolates smoothly while moving/converging and sleeps automatically when settled.
   */
  private startAnimationLoop(): void {
    const frame = (now: number) => {
      if (!this.isRunning) {
        this.animFrameId = null;
        return;
      }

      const elapsed = now - this.segmentStartTime;
      const duration = this.expectedDuration || 1000;
      const fraction = Math.min(1.0, elapsed / duration);

      // Smooth cubic ease-out for interpolation between fixes
      const ease = 1 - Math.pow(1 - fraction, 3);

      let currentLng = this.startPoint[0] + (this.targetPoint[0] - this.startPoint[0]) * ease;
      let currentLat = this.startPoint[1] + (this.targetPoint[1] - this.startPoint[1]) * ease;

      // Dead-reckoning extrapolation when moving (capped at 1.5s past segment end)
      const isExtrapolating =
        elapsed > duration && elapsed <= duration + 1550 && this.state.isMoving && this.state.speed > 4;
      if (elapsed > duration && this.state.isMoving && this.state.speed > 4) {
        const extraTimeSec = Math.min(1.5, (elapsed - duration) / 1000);
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

      const angleDiffVal = Math.abs(angleDiff(this.targetHeading, this.currentHeading));
      if (angleDiffVal > 0.25) {
        let angleEase = 0.08;
        if (angleDiffVal > 45) {
          angleEase = 0.14;
        } else if (angleDiffVal < 5) {
          angleEase = 0.05;
        }
        this.currentHeading = lerpAngle(this.currentHeading, this.targetHeading, angleEase);
      } else {
        this.currentHeading = this.targetHeading;
      }

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

      const stillInterpolating = fraction < 1.0 || isExtrapolating || angleDiffVal > 0.25;
      if (stillInterpolating && this.isRunning) {
        this.animFrameId = requestAnimationFrame(frame);
      } else {
        this.animFrameId = null;
      }
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
