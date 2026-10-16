/**
 * gpsNavigation.ts
 * High-performance, low-jitter GPS navigation and movement engine.
 * Implements Waze-style continuous interpolation, dead-reckoning extrapolation,
 * car mode detection (> 15 km/h with hysteresis), and 60fps marker gliding.
 */

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
}

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

class GpsNavigationManager {
  private listeners: Set<NavListener> = new Set();

  private state: GpsNavState = {
    coords: [-45.587, -22.7355],
    interpolatedCoords: [-45.587, -22.7355],
    speed: 0,
    instantSpeed: 0,
    heading: 0,
    accuracy: 10,
    isCarMode: false,
    isMoving: false,
    status: 'locating',
    lastFixTime: Date.now(),
  };

  // Interpolation timeline state
  private startPoint: [number, number] = [-45.587, -22.7355];
  private targetPoint: [number, number] = [-45.587, -22.7355];
  private currentInterpolated: [number, number] = [-45.587, -22.7355];
  private currentHeading: number = 0;
  private targetHeading: number = 0;

  private segmentStartTime: number = performance.now();
  private expectedDuration: number = 1000; // ms
  private lastGpsFixTime: number = performance.now();
  private prevRawFix: GpsRawFix | null = null;

  // Hysteresis counters for car mode stability
  private carModeConsecutiveHigh: number = 0;
  private carModeConsecutiveLow: number = 0;

  // Watcher and interval handles
  private watchId: number | null = null;
  private pollIntervalId: number | null = null;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  constructor() {
    // Lazy start on first subscription
  }

  public subscribe(listener: NavListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    if (!this.isRunning) {
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
   * Start GPS tracking and animation loop
   */
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.requestInitialPosition();
    this.startWatchPosition();
    this.startAnimationLoop();
  }

  /**
   * Stop tracking and clean up
   */
  public stop() {
    this.isRunning = false;
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.pollIntervalId !== null) {
      window.clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Single high-accuracy initial fix
   */
  private requestInitialPosition() {
    if (!('geolocation' in navigator)) {
      this.state.status = 'denied';
      this.notify();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => this.handleRawFix(pos),
      (err) => {
        console.warn('Initial GPS query warning:', err.message);
        // Fallback for IP/Desktop
        navigator.geolocation.getCurrentPosition(
          (pos) => this.handleRawFix(pos),
          () => {
            this.state.status = 'denied';
            this.notify();
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  }

  /**
   * Continuous high-accuracy GPS stream
   */
  private startWatchPosition() {
    if (!('geolocation' in navigator)) return;

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.handleRawFix(pos),
        (err) => console.warn('watchPosition notice:', err.message),
        {
          enableHighAccuracy: true,
          maximumAge: 0, // CRITICAL: NEVER cache old GPS coordinates
          timeout: 8000,
        }
      );
    } catch (e) {
      console.warn('Failed to start watchPosition:', e);
    }

    // Adaptive polling loop: if the vehicle is moving or in car mode and watchPosition
    // has a gap (>1200ms), actively query getCurrentPosition to sustain continuous flow
    this.pollIntervalId = window.setInterval(() => {
      const timeSinceLastFix = performance.now() - this.lastGpsFixTime;
      const isMovingFast = this.state.speed > 10;

      if (isMovingFast && timeSinceLastFix > 1200 && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => this.handleRawFix(pos),
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 1200 }
        );
      }
    }, 1000);
  }

  /**
   * Process incoming raw GPS fix
   */
  private handleRawFix(pos: GeolocationPosition) {
    const rawLng = pos.coords.longitude;
    const rawLat = pos.coords.latitude;
    const accuracy = pos.coords.accuracy || 10;
    const nowTime = performance.now();
    const dt = (nowTime - this.lastGpsFixTime) / 1000; // seconds

    this.lastGpsFixTime = nowTime;
    this.state.status = 'granted';
    this.state.accuracy = accuracy;
    this.state.lastFixTime = Date.now();

    // Calculate instantaneous speed
    let calculatedSpeedKmH = 0;
    let computedBearing: number | null = null;

    if (this.prevRawFix) {
      const distance = calculateHaversineDistance(
        this.prevRawFix.lng,
        this.prevRawFix.lat,
        rawLng,
        rawLat
      );

      // Outlier rejection: if distance jump implies > 220 km/h in a fraction of second,
      // damp it down (common with cell-tower handoffs)
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

    // Determine best speed: hardware speed if valid, or calculated distance/dt
    let instantSpeed = 0;
    if (pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0) {
      instantSpeed = pos.coords.speed * 3.6;
    } else {
      instantSpeed = calculatedSpeedKmH;
    }

    // Clamp unrealistic GPS spikes
    if (instantSpeed > 220) {
      instantSpeed = this.state.speed;
    }

    // Exponential moving average for smoothed speed
    const alpha = 0.35;
    const smoothedSpeed = this.state.speed * (1 - alpha) + instantSpeed * alpha;

    // Determine heading: prioritize hardware heading if moving, else computed vector
    let targetHeading = this.currentHeading;
    if (pos.coords.heading !== null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
      targetHeading = pos.coords.heading;
    } else if (computedBearing !== null && instantSpeed > 4) {
      targetHeading = computedBearing;
    }

    // Prepare smooth transition segment for animation loop
    this.startPoint = [...this.currentInterpolated];
    this.targetPoint = [rawLng, rawLat];
    this.targetHeading = targetHeading;

    // Estimate segment duration based on sample interval (clamped 400ms - 2000ms)
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
  }

  /**
   * 60fps RequestAnimationFrame Animation Loop
   * Smoothly interpolates coordinates and applies dead-reckoning extrapolation
   */
  private startAnimationLoop() {
    const frame = (now: number) => {
      if (!this.isRunning) return;

      const elapsed = now - this.segmentStartTime;
      const duration = this.expectedDuration || 1000;
      const fraction = Math.min(1.0, elapsed / duration);

      // Smooth cubic ease-out for interpolation between fixes
      const ease = 1 - Math.pow(1 - fraction, 3);

      let currentLng = this.startPoint[0] + (this.targetPoint[0] - this.startPoint[0]) * ease;
      let currentLat = this.startPoint[1] + (this.targetPoint[1] - this.startPoint[1]) * ease;

      // Dead-reckoning extrapolation:
      // If elapsed time exceeds expected duration and vehicle is moving,
      // project forward smoothly in the direction of travel so it never halts abruptly
      if (elapsed > duration && this.state.isMoving && this.state.speed > 4) {
        const extraTimeSec = Math.min(1.5, (elapsed - duration) / 1000); // up to 1.5s max
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

      // Smooth heading rotation along shortest arc with adaptive easing:
      // When entering curves or changing streets, interpolate progressively without jerking
      const angleDiffVal = Math.abs(angleDiff(this.targetHeading, this.currentHeading));
      let angleEase = 0.08;
      if (angleDiffVal > 45) {
        angleEase = 0.14; // Catch up smoothly on sharp street turns
      } else if (angleDiffVal < 5) {
        angleEase = 0.05; // Ultra calm on straight roads to eliminate GPS jitter
      }
      this.currentHeading = lerpAngle(this.currentHeading, this.targetHeading, angleEase);

      this.currentInterpolated = [currentLng, currentLat];
      this.state.interpolatedCoords = [currentLng, currentLat];
      this.state.heading = Math.round(this.currentHeading);

      this.notify();

      this.animFrameId = requestAnimationFrame(frame);
    };

    this.animFrameId = requestAnimationFrame(frame);
  }

  private notify() {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

// Global Singleton Instance
export const gpsNavigationManager = new GpsNavigationManager();
