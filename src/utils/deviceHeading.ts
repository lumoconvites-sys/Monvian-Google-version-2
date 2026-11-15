/**
 * Apple Maps style Device Heading & Orientation Tracker
 * Captures iOS CoreLocation webkitCompassHeading and W3C 3D tilt-compensated
 * orientation matrix with smooth 60fps circular interpolation, 359°-0° boundary
 * wrapping, and iOS 13+ per-session user-gesture permission activation.
 */

import { saveUserPermissionsToDatabase } from '../services/firestoreSync';

export interface DeviceHeadingListener {
  (heading: number, mapCompensatedHeading: number): void;
}

class DeviceHeadingManager {
  private currentHeading: number = 0;
  private targetHeading: number = 0;
  private mapBearing: number = 0;
  private isListening: boolean = false;
  private hasReceivedSensorData: boolean = false;
  private sessionPermissionGranted: boolean = false;
  private animFrameId: number | null = null;
  private listeners: Set<DeviceHeadingListener> = new Set();
  private gestureArmed: boolean = false;
  private requestPromise: Promise<boolean> | null = null;
  private lastAbsoluteTimestamp: number = 0;
  private lastWebkitCompass: number = -1;
  private lastWebkitCompassMoveTime: number = 0;
  private imuCompassOffset: number = 0;
  private hasImuOffset: boolean = false;
  private lastAnimTime: number = 0;

  constructor() {
    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleAbsoluteOrientation = this.handleAbsoluteOrientation.bind(this);
    this.handleGestureActivation = this.handleGestureActivation.bind(this);
    this.animationLoop = this.animationLoop.bind(this);
    this.requestPermission = this.requestPermission.bind(this);
    this.silentWakeup = this.silentWakeup.bind(this);

    if (!this.isPermissionRequired()) {
      this.sessionPermissionGranted = true;
    }
  }

  public getCurrentHeading(): number {
    return this.currentHeading;
  }

  public getTargetHeading(): number {
    return this.targetHeading;
  }

  public hasSensorData(): boolean {
    return this.hasReceivedSensorData;
  }

  public setMapBearing(bearing: number) {
    this.mapBearing = typeof bearing === 'number' && !isNaN(bearing) ? bearing : 0;
  }

  public isPermissionRequired(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    );
  }

  /**
   * Returns true ONLY if sensor permission is active in the current page runtime session
   * or if the device does not require iOS explicit permission.
   */
  public isPermissionHandled(): boolean {
    if (typeof window === 'undefined') return true;
    if (!this.isPermissionRequired()) return true;
    return this.hasReceivedSensorData || this.sessionPermissionGranted;
  }

  public markPermissionHandled() {
    this.sessionPermissionGranted = true;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('monvian_compass_permission_handled', 'true');
        localStorage.setItem('monvian_motion_permission_granted', 'true');
        document.cookie = 'monvian_motion_granted=true; max-age=315360000; path=/; SameSite=Lax';
      } catch {}
      saveUserPermissionsToDatabase({ motionGranted: true }).catch(() => {});
    }
  }

  public subscribe(listener: DeviceHeadingListener): () => void {
    this.listeners.add(listener);
    this.start();
    listener(this.currentHeading, this.getCompensatedHeading());

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  public start() {
    if (typeof window === 'undefined') return;

    if (!this.isListening) {
      this.isListening = true;
      this.attachListeners();
    }

    if (this.isPermissionRequired() && !this.hasReceivedSensorData) {
      this.armGestureActivationListeners();
    }
  }

  private armGestureActivationListeners() {
    if (typeof window === 'undefined' || this.gestureArmed) return;
    this.gestureArmed = true;

    // On iOS Safari/WebKit, 'click' is the guaranteed transient user-activation event.
    // Do NOT register 'pointerup' or 'touchend' before 'click', because an early non-activated
    // touchend during slight finger movement will reject and consume the gesture window.
    window.addEventListener('click', this.handleGestureActivation, { capture: true });
  }

  private removeGestureActivationListeners() {
    if (typeof window === 'undefined' || !this.gestureArmed) return;
    this.gestureArmed = false;

    window.removeEventListener('click', this.handleGestureActivation, true);
  }

  private handleGestureActivation() {
    if (this.hasReceivedSensorData && this.sessionPermissionGranted) {
      this.removeGestureActivationListeners();
      return;
    }
    this.requestPermission().catch(() => {});
  }

  private attachListeners() {
    if (typeof window === 'undefined') return;

    try {
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', this.handleAbsoluteOrientation as any, true);
      }
      window.addEventListener('deviceorientation', this.handleOrientation as any, true);
    } catch {
      // Ignored
    }
  }

  private detachListeners() {
    if (typeof window === 'undefined') return;

    try {
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', this.handleAbsoluteOrientation as any, true);
      }
      window.removeEventListener('deviceorientation', this.handleOrientation as any, true);
    } catch {
      // Ignored
    }
  }

  /**
   * Removes and re-registers orientation listeners.
   * Required on iOS WebKit when listeners were initially added prior to requestPermission() resolving 'granted'.
   */
  private reattachListeners() {
    this.detachListeners();
    this.attachListeners();
  }

  public async silentWakeup(): Promise<void> {
    this.start();
  }

  public requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return Promise.resolve(false);

    this.isListening = true;

    if (this.hasReceivedSensorData && this.sessionPermissionGranted) {
      this.removeGestureActivationListeners();
      return Promise.resolve(true);
    }

    if (!this.isPermissionRequired()) {
      this.sessionPermissionGranted = true;
      this.reattachListeners();
      return Promise.resolve(true);
    }

    if (this.requestPromise) {
      return this.requestPromise;
    }

    // Call DeviceOrientationEvent.requestPermission() synchronously at the top of the click handler
    this.requestPromise = (async () => {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (!this.isListening) {
          return false;
        }
        if (res === 'granted') {
          this.sessionPermissionGranted = true;
          this.markPermissionHandled();
          this.removeGestureActivationListeners();
          this.reattachListeners();
          return true;
        }
      } catch (err) {
        console.warn('DeviceOrientation permission request deferred:', err);
      } finally {
        this.requestPromise = null;
      }
      return false;
    })();

    return this.requestPromise;
  }

  public stop() {
    if (typeof window === 'undefined') return;
    this.isListening = false;
    this.detachListeners();
    this.removeGestureActivationListeners();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private getScreenOrientationAngle(): number {
    if (typeof window === 'undefined') return 0;
    if (
      window.screen &&
      window.screen.orientation &&
      typeof window.screen.orientation.angle === 'number'
    ) {
      return window.screen.orientation.angle || 0;
    }
    if (typeof (window as any).orientation === 'number') {
      return (window as any).orientation || 0;
    }
    return 0;
  }

  private handleAbsoluteOrientation(event: DeviceOrientationEvent) {
    this.processOrientationEvent(event, true);
  }

  private handleOrientation(event: DeviceOrientationEvent) {
    this.processOrientationEvent(event, false);
  }

  /**
   * Computes true 3D tilt-compensated compass heading [0, 360) from W3C Euler angles (alpha, beta, gamma).
   * Projects the device's horizontal right-edge axis (+X_device, 1st column of R = Rz(alpha)*Rx(beta)*Ry(gamma))
   * onto the Earth (East, North) plane.
   *
   * Unlike raw (360 - alpha) which suffers from severe Euler gimbal lock when the phone is held
   * upright in the user's hand (beta = 45°..90°), and unlike the camera-normal vector (-Z_device)
   * which vanishes when the phone is held flat (beta = 0°), +X_device remains horizontal across
   * all portrait tilt angles from 0° (flat) to 90°+ (vertical) with zero gimbal lock or 180° flips.
   */
  private computeTiltCompensatedHeading(
    alpha: number,
    beta: number | null,
    gamma: number | null
  ): number {
    const b = typeof beta === 'number' && !isNaN(beta) ? beta : 0;
    const g = typeof gamma === 'number' && !isNaN(gamma) ? gamma : 0;

    const radA = (alpha * Math.PI) / 180;
    const radB = (b * Math.PI) / 180;
    const radG = (g * Math.PI) / 180;

    const cA = Math.cos(radA);
    const sA = Math.sin(radA);
    const sB = Math.sin(radB);
    const cG = Math.cos(radG);
    const sG = Math.sin(radG);

    // 1st column of W3C rotation matrix R: Earth (East, North) coordinates of +X_device (right side of phone)
    const eastX = cA * cG - sA * sB * sG;
    const northX = sA * cG + cA * sB * sG;

    // Forward direction is 90° counter-clockwise from +X_device:
    // forwardEast = -northX, forwardNorth = eastX
    const forwardEast = -northX;
    const forwardNorth = eastX;

    const heading = Math.atan2(forwardEast, forwardNorth) * (180 / Math.PI);
    return ((heading % 360) + 360) % 360;
  }

  private processOrientationEvent(event: DeviceOrientationEvent, isAbsoluteEvent: boolean) {
    if (!event) return;

    const now = performance.now();
    const screenAngle = this.getScreenOrientationAngle();
    let heading: number | null = null;

    const rawWebkitCompass = (event as any).webkitCompassHeading;
    const webkitAccuracy = (event as any).webkitCompassAccuracy;
    const hasValidWebkitCompass =
      typeof rawWebkitCompass === 'number' && !isNaN(rawWebkitCompass) && rawWebkitCompass >= 0;
    const hasValidAlpha = typeof event.alpha === 'number' && !isNaN(event.alpha);

    // 1. iOS Safari / WebKit: Use Apple's hardware-fused 3D tilt-compensated webkitCompassHeading
    if (hasValidWebkitCompass) {
      const compassHeading = (rawWebkitCompass + screenAngle + 360) % 360;
      const compassChanged =
        this.lastWebkitCompass < 0 || Math.abs(rawWebkitCompass - this.lastWebkitCompass) > 0.01;

      if (compassChanged) {
        this.lastWebkitCompass = rawWebkitCompass;
        this.lastWebkitCompassMoveTime = now;
      }

      const isCompassCalibrated =
        rawWebkitCompass > 0 || (typeof webkitAccuracy === 'number' && webkitAccuracy >= 0);

      if (hasValidAlpha) {
        const imuHeading =
          (this.computeTiltCompensatedHeading(event.alpha as number, event.beta, event.gamma) +
            screenAngle +
            360) %
          360;

        if (isCompassCalibrated && (compassChanged || now - this.lastWebkitCompassMoveTime < 350)) {
          // Anchor 3D IMU offset to Apple's true magnetic compass heading
          this.imuCompassOffset = (compassHeading - imuHeading + 360) % 360;
          this.hasImuOffset = true;
          heading = compassHeading;
        } else {
          // Indoor fallback when magnetometer is uncalibrated or momentarily static:
          // use 3D tilt-compensated IMU heading anchored to the last valid compass offset
          heading = this.hasImuOffset
            ? (imuHeading + this.imuCompassOffset + 360) % 360
            : imuHeading;
        }
      } else {
        heading = compassHeading;
      }
    }
    // 2. Android / Standard W3C DeviceOrientation (deviceorientationabsolute preferred)
    else if (hasValidAlpha) {
      if (isAbsoluteEvent || event.absolute === true) {
        this.lastAbsoluteTimestamp = now;
        const rawTiltHeading = this.computeTiltCompensatedHeading(
          event.alpha as number,
          event.beta,
          event.gamma
        );
        heading = (rawTiltHeading + screenAngle + 360) % 360;
      } else if (now - this.lastAbsoluteTimestamp > 1000) {
        const rawTiltHeading = this.computeTiltCompensatedHeading(
          event.alpha as number,
          event.beta,
          event.gamma
        );
        heading = (rawTiltHeading + screenAngle + 360) % 360;
      }
    }

    if (heading !== null && !isNaN(heading)) {
      this.applyNewHeading(heading);
    }
  }

  private applyNewHeading(heading: number) {
    const normalizedHeading = ((heading % 360) + 360) % 360;

    if (!this.hasReceivedSensorData) {
      this.hasReceivedSensorData = true;
      this.sessionPermissionGranted = true;
      this.currentHeading = normalizedHeading;
      this.targetHeading = normalizedHeading;
      this.markPermissionHandled();
      this.removeGestureActivationListeners();
      this.emitToListeners();
      return;
    }

    let diff = normalizedHeading - this.targetHeading;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    if (Math.abs(diff) < 0.12) return;

    this.targetHeading = normalizedHeading;

    if (this.isListening && !this.animFrameId) {
      this.lastAnimTime = 0;
      this.animFrameId = requestAnimationFrame(this.animationLoop);
    }
  }

  private emitToListeners() {
    const compensated = this.getCompensatedHeading();
    this.listeners.forEach((listener) => {
      listener(this.currentHeading, compensated);
    });
  }

  private animationLoop(timestamp?: number) {
    if (!this.isListening || !this.hasReceivedSensorData) {
      this.animFrameId = null;
      return;
    }

    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    const dt = this.lastAnimTime ? Math.min((now - this.lastAnimTime) / 1000, 0.08) : 0.016;
    this.lastAnimTime = now;

    // Shortest angular difference between current and target heading [-180, 180]
    let diff = this.targetHeading - this.currentHeading;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;

    const absDiff = Math.abs(diff);

    if (absDiff > 0.15) {
      // High-responsiveness Apple Maps style exponential smoothing
      const lambda = absDiff > 12 ? 28 : absDiff > 2 ? 22 : 16;
      const factor = Math.min(1, 1 - Math.exp(-lambda * dt));
      this.currentHeading = (this.currentHeading + diff * factor + 360) % 360;
      this.emitToListeners();
      this.animFrameId = requestAnimationFrame(this.animationLoop);
    } else {
      if (this.currentHeading !== this.targetHeading) {
        this.currentHeading = this.targetHeading;
        this.emitToListeners();
      }
      this.animFrameId = null;
    }
  }

  private getCompensatedHeading(): number {
    return (this.currentHeading - this.mapBearing + 360) % 360;
  }
}

export const deviceHeadingManager = new DeviceHeadingManager();
