/**
 * Apple Maps style Device Heading & Orientation Tracker
 * Captures gyroscope, magnetometer, and deviceorientation with smooth interpolation,
 * 359°-0° boundary wrapping, continuous persistent session wake-up, and MapLibre bearing compensation.
 */

export interface DeviceHeadingListener {
  (heading: number, mapCompensatedHeading: number): void;
}

class DeviceHeadingManager {
  private currentHeading: number = 0;
  private targetHeading: number = 0;
  private mapBearing: number = 0;
  private isListening: boolean = false;
  private hasReceivedSensorData: boolean = false;
  private animFrameId: number | null = null;
  private listeners: Set<DeviceHeadingListener> = new Set();
  private gestureArmed: boolean = false;
  private permissionGranted: boolean = false;

  constructor() {
    this.handleOrientation = this.handleOrientation.bind(this);
    this.animationLoop = this.animationLoop.bind(this);
    this.requestPermission = this.requestPermission.bind(this);
    this.silentWakeup = this.silentWakeup.bind(this);
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
    this.mapBearing = bearing;
  }

  public isPermissionRequired(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    );
  }

  public isPermissionHandled(): boolean {
    if (typeof window === 'undefined') return true;
    if (!this.isPermissionRequired()) return true;
    return localStorage.getItem('monvian_compass_permission_handled') === 'true';
  }

  public markPermissionHandled() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('monvian_compass_permission_handled', 'true');
    }
  }

  public subscribe(listener: DeviceHeadingListener): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.start();
    }
    // Immediately emit current heading
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

      // Arm global gestures on window and document to continuously ensure sensors are active
      if (!this.gestureArmed) {
        this.gestureArmed = true;
        const triggerSensorActivation = () => {
          if (!this.permissionGranted) {
            this.requestPermission();
          }
        };

        window.addEventListener('click', triggerSensorActivation, { capture: true, passive: true });
        window.addEventListener('touchend', triggerSensorActivation, { capture: true, passive: true });
        window.addEventListener('pointerup', triggerSensorActivation, { capture: true, passive: true });
        document.addEventListener('touchstart', triggerSensorActivation, { capture: true, passive: true });
      }

      // Try immediate wakeup in case permission is already cached by the browser
      this.silentWakeup();

      // Start smoothing animation loop
      if (!this.animFrameId) {
        this.animFrameId = requestAnimationFrame(this.animationLoop);
      }
    }
  }

  private attachListeners() {
    if (typeof window === 'undefined') return;

    try {
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', this.handleOrientation as any, { capture: true, passive: true });
      }
      window.addEventListener('deviceorientation', this.handleOrientation as any, { capture: true, passive: true });
      document.addEventListener('deviceorientation', this.handleOrientation as any, { capture: true, passive: true });
    } catch {
      // Ignored
    }
  }

  public async silentWakeup(): Promise<void> {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          this.permissionGranted = true;
          this.attachListeners();
        }
      } catch {
        // Ignored
      }
    } else {
      this.attachListeners();
    }
  }

  public async requestPermission(): Promise<boolean> {
    this.markPermissionHandled();
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          this.permissionGranted = true;
          this.attachListeners();
          return true;
        }
      } catch (err) {
        console.warn('Device orientation permission status:', err);
      }
      return false;
    }
    this.permissionGranted = true;
    this.attachListeners();
    return true;
  }

  public stop() {
    if (typeof window === 'undefined') return;
    this.isListening = false;
    try {
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', this.handleOrientation as any, true);
      }
      window.removeEventListener('deviceorientation', this.handleOrientation as any, true);
      document.removeEventListener('deviceorientation', this.handleOrientation as any, true);
    } catch {
      // Ignored
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private handleOrientation(event: DeviceOrientationEvent) {
    let heading: number | null = null;

    // 1. iOS Safari native webkitCompassHeading (0 = True/Magnetic North, clockwise)
    if (typeof (event as any).webkitCompassHeading === 'number') {
      const compassHeading = (event as any).webkitCompassHeading;
      if (!isNaN(compassHeading) && compassHeading >= 0) {
        heading = compassHeading;
      }
    } 
    // 2. Android Chrome / Standard absolute alpha
    else if (event.alpha !== null && !isNaN(event.alpha)) {
      const screenAngle =
        typeof window !== 'undefined' && window.screen && window.screen.orientation
          ? window.screen.orientation.angle || 0
          : typeof window.orientation === 'number'
          ? window.orientation
          : 0;
      heading = (360 - event.alpha + screenAngle + 360) % 360;
    }
    // 3. Fallback Euler angles if alpha/beta/gamma available
    else if (event.beta !== null && event.gamma !== null && event.alpha !== null) {
      const screenAngle =
        typeof window !== 'undefined' && window.screen && window.screen.orientation
          ? window.screen.orientation.angle || 0
          : typeof window.orientation === 'number'
          ? window.orientation
          : 0;
      heading = (this.computeEulerHeading(event.alpha, event.beta, event.gamma) + screenAngle + 360) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
      const normalizedHeading = (heading + 360) % 360;

      if (!this.hasReceivedSensorData) {
        this.hasReceivedSensorData = true;
        this.currentHeading = normalizedHeading;
      }

      this.targetHeading = normalizedHeading;
    }
  }

  private computeEulerHeading(alpha: number, beta: number, gamma: number): number {
    const _x = (beta * Math.PI) / 180;
    const _y = (gamma * Math.PI) / 180;
    const _z = (alpha * Math.PI) / 180;

    const cX = Math.cos(_x);
    const cY = Math.cos(_y);
    const cZ = Math.cos(_z);
    const sX = Math.sin(_x);
    const sY = Math.sin(_y);
    const sZ = Math.sin(_z);

    const Vx = -cZ * sY - sZ * sX * cY;
    const Vy = -sZ * sY + cZ * sX * cY;

    let heading = Math.atan2(Vx, Vy) * (180 / Math.PI);
    if (heading < 0) heading += 360;
    return heading;
  }

  private lastAnimTime: number = 0;

  private animationLoop(timestamp?: number) {
    if (!this.isListening) return;

    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    const dt = this.lastAnimTime ? Math.min((now - this.lastAnimTime) / 1000, 0.08) : 0.016;
    this.lastAnimTime = now;

    // Shortest angular difference between current and target heading [-180, 180]
    let diff = this.targetHeading - this.currentHeading;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;

    const absDiff = Math.abs(diff);

    if (absDiff > 0.03) {
      // Dynamic Apple-style exponential smoothing
      // If large angle jump (sudden turn or device shake), respond quickly (~20 rad/s)
      // If small angle change, smooth out sensor noise smoothly (~12 rad/s)
      const lambda = absDiff > 15 ? 22 : absDiff > 2 ? 16 : 10;
      const factor = 1 - Math.exp(-lambda * dt);
      this.currentHeading = (this.currentHeading + diff * factor + 360) % 360;
    } else {
      this.currentHeading = this.targetHeading;
    }

    const compensated = this.getCompensatedHeading();

    this.listeners.forEach((listener) => {
      listener(this.currentHeading, compensated);
    });

    this.animFrameId = requestAnimationFrame(this.animationLoop);
  }

  private getCompensatedHeading(): number {
    return (this.currentHeading - this.mapBearing + 360) % 360;
  }
}

export const deviceHeadingManager = new DeviceHeadingManager();
