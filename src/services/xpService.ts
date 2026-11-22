/**
 * xpService.ts
 * Client service and state manager for Monvian XP & Exploration progression.
 * Handles real-time proximity radar tracking, live distance updates for the
 * floating iOS discovery card, anti-duplicate caching, and server sync.
 */

import { Spot } from '../types';
import { calculateHaversineDistance, calculateBearing, GpsNavState } from './gpsNavigation';
import { getSpotImage } from '../utils/spotImages';
import { getCleanSpotDisplayName } from './geolocationNotifications';
import { playXpRewardSound, playLevelUpSound } from '../utils/sound';
import { triggerHapticFeedback } from '../utils/haptics';
import { getActiveUserScope, readScopedString, writeScopedString } from '../utils/userScopedStorage';

export interface XpProfileState {
  userId: string;
  totalXp: number;
  currentLevel: number;
  levelTitle: string;
  nextLevelXp: number;
  xpRemaining: number;
  levelProgressRatio: number;
  placesDiscoveredCount: number;
  visitedSpotIds: string[];
  history: Array<{
    id: string;
    spot_id: string;
    spot_name: string;
    category?: string;
    xp_awarded: number;
    visited_at: string;
    distance_meters?: number;
  }>;
}

export interface XpProximityUpdateDetail {
  spot: Spot;
  spotId: string;
  spotName: string;
  spotImage: string;
  distanceMeters: number;
  progress: number; // 0.15 to 1.0 as user approaches
  bearingDeg: number;
  status: 'approaching' | 'discovering' | 'discovered';
}

export interface XpDiscoveryStartDetail {
  spotId: string;
  spotName: string;
  durationMs: number;
}

export interface XpRewardEventDetail {
  spotId: string;
  spotName: string;
  spotImage?: string;
  xpAwarded: number;
  totalXp: number;
  currentLevel: number;
  levelTitle: string;
  leveledUp?: boolean;
  originX?: number;
  originY?: number;
}

type XpSubscriber = (state: XpProfileState) => void;

// Maximum physical distance (in meters) from the registered spot coordinates to count a visit & award coins/XP
const MAX_PHYSICAL_VISIT_DISTANCE_METERS = 50;
// Maximum distance (in meters) to show the "approaching" radar card when walking physically near a spot
const MAX_APPROACHING_RADAR_METERS = 200;
// Maximum acceptable GPS horizontal accuracy (in meters) to trust a physical check-in
const MAX_TRUSTED_GPS_ACCURACY_METERS = 100;

const DEFAULT_XP_STATE: XpProfileState = {
  userId: '',
  totalXp: 0,
  currentLevel: 1,
  levelTitle: 'Explorador',
  nextLevelXp: 1000,
  xpRemaining: 1000,
  levelProgressRatio: 0,
  placesDiscoveredCount: 0,
  visitedSpotIds: [],
  history: [],
};

class MonvianXpManager {
  private state: XpProfileState = { ...DEFAULT_XP_STATE };
  private subscribers: Set<XpSubscriber> = new Set();
  private pendingValidations: Set<string> = new Set();
  private lastProximityUiEmitTime: number = 0;
  private lastValidationCheckTime: number = 0;
  private knownVisitedSpotIds: Set<string> = new Set();
  private currentTrackedSpotId: string | null = null;
  private lastProximityDetail: XpProximityUpdateDetail | null = null;

  constructor() {
    this.loadCachedState();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('monvian:user_updated', () => {
        this.loadCachedState();
        this.fetchProfile().catch(() => {});
      });
      window.addEventListener('monvian:account_switched', () => {
        this.pendingValidations.clear();
        this.currentTrackedSpotId = null;
        this.lastProximityDetail = null;
        this.loadCachedState();
        this.subscribers.forEach((cb) => cb(this.state));
        this.fetchProfile().catch(() => {});
      });
      window.addEventListener('monvian:user_logged_out', () => {
        this.reset();
      });
    }
  }

  public reset(): void {
    this.pendingValidations.clear();
    this.currentTrackedSpotId = null;
    this.lastProximityDetail = null;
    this.knownVisitedSpotIds = new Set();
    this.state = { ...DEFAULT_XP_STATE, visitedSpotIds: [], history: [] };
    this.subscribers.forEach((cb) => cb(this.state));
  }

  private getCurrentUserCacheKey(): string {
    const scope = getActiveUserScope();
    if (scope) {
      return `monvian_cached_xp_state_v3_${scope}`;
    }
    return 'monvian_cached_xp_state_v3_guest';
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof localStorage !== 'undefined') {
      try {
        const token =
          localStorage.getItem('monvian_token') ||
          localStorage.getItem('monvian_auth_token') ||
          localStorage.getItem('auth_token') ||
          localStorage.getItem('supabase.auth.token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const rawUser = localStorage.getItem('monvian_user');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          if (parsed?.username) headers['x-username'] = String(parsed.username);
          if (parsed?.email) headers['x-user-email'] = String(parsed.email);
        }

        let sessionId = readScopedString('monvian_user_session_id');
        if (!sessionId) {
          sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          writeScopedString('monvian_user_session_id', sessionId);
        }
        headers['x-session-id'] = sessionId;
      } catch {}
    }

    return headers;
  }

  private loadCachedState() {
    if (typeof localStorage === 'undefined') return;
    try {
      const scope = getActiveUserScope();
      if (!scope) {
        this.state = { ...DEFAULT_XP_STATE, visitedSpotIds: [], history: [] };
        this.knownVisitedSpotIds = new Set();
        return;
      }
      const cacheKey = this.getCurrentUserCacheKey();
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.state = { ...DEFAULT_XP_STATE, ...parsed };
        this.knownVisitedSpotIds = new Set(this.state.visitedSpotIds || []);
      } else {
        this.state = { ...DEFAULT_XP_STATE, visitedSpotIds: [], history: [] };
        this.knownVisitedSpotIds = new Set();
      }
    } catch {}
  }

  private saveCachedState() {
    if (typeof localStorage === 'undefined') return;
    try {
      const scope = getActiveUserScope();
      if (!scope) return;
      const cacheKey = this.getCurrentUserCacheKey();
      localStorage.setItem(cacheKey, JSON.stringify(this.state));
    } catch {}
  }

  public getState(): XpProfileState {
    return this.state;
  }

  public getTrackedSpotId(): string | null {
    return this.currentTrackedSpotId;
  }

  public getLastProximity(): XpProximityUpdateDetail | null {
    return this.lastProximityDetail;
  }

  public subscribe(cb: XpSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.state);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notify() {
    this.saveCachedState();
    this.subscribers.forEach((cb) => cb(this.state));
  }

  public async fetchProfile(): Promise<XpProfileState> {
    try {
      const res = await fetch('/api/xp/profile', {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const totalXp = Number(data.totalXp) || 0;
          const currentLevel = Number(data.currentLevel) || 1;
          const levelTitle = data.levelTitle || 'Explorador';

          this.state = {
            userId: data.userId || this.state.userId,
            totalXp,
            currentLevel,
            levelTitle,
            nextLevelXp: Number(data.nextLevelXp) || 1000,
            xpRemaining: Number(data.xpRemaining ?? 1000),
            levelProgressRatio: Number(data.levelProgressRatio) || 0,
            placesDiscoveredCount: Number(data.placesDiscoveredCount) || 0,
            visitedSpotIds: data.visitedSpotIds || [],
            history: data.history || [],
          };
          this.knownVisitedSpotIds = new Set(this.state.visitedSpotIds);
          this.notify();
        }
      }
    } catch (err) {
      console.warn('[XPManager] Error fetching profile:', err);
    }
    return this.state;
  }

  /**
   * Evaluates real physical GPS coordinates against all registered tourist spots.
   * Coins and XP are ONLY counted when the user has a verified real GPS fix and is physically
   * at the registered tourist spot location (<= 50 meters).
   */
  public async evaluateProximity(gps: GpsNavState, spots: Spot[]): Promise<void> {
    if (!gps || !spots || spots.length === 0) return;

    // Strictly require a real, live GPS fix from the user's device (never award on fallback or map pan)
    if (
      !gps.hasRealFix ||
      gps.status !== 'granted' ||
      typeof gps.accuracy !== 'number' ||
      gps.accuracy > MAX_TRUSTED_GPS_ACCURACY_METERS
    ) {
      if (this.currentTrackedSpotId !== null || this.lastProximityDetail !== null) {
        this.currentTrackedSpotId = null;
        this.lastProximityDetail = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('monvian:xp_proximity_update', { detail: null })
          );
        }
      }
      return;
    }

    const coords = gps.coords;
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return;

    const now = Date.now();
    if (now - this.lastProximityUiEmitTime < 400) return;
    this.lastProximityUiEmitTime = now;

    const [userLng, userLat] = coords;

    let closestUnvisited: Spot | null = null;
    let closestDistance = Infinity;

    for (const spot of spots) {
      if (!spot || !spot.id || spot.isActive === false) continue;
      if (this.knownVisitedSpotIds.has(spot.id)) {
        continue;
      }
      if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') continue;

      const dist = calculateHaversineDistance(userLng, userLat, spot.lng, spot.lat);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestUnvisited = spot;
      }
    }

    // Only track and show proximity radar if the user is physically within 200m of an unvisited spot
    if (closestUnvisited && closestDistance <= MAX_APPROACHING_RADAR_METERS) {
      this.currentTrackedSpotId = closestUnvisited.id;
      const cleanName = getCleanSpotDisplayName(closestUnvisited);
      const spotImg = getSpotImage(closestUnvisited);
      const bearingDeg = calculateBearing(
        userLng,
        userLat,
        closestUnvisited.lng,
        closestUnvisited.lat
      );

      const clampedDist = Math.max(
        MAX_PHYSICAL_VISIT_DISTANCE_METERS,
        Math.min(MAX_APPROACHING_RADAR_METERS, closestDistance)
      );
      const progress =
        closestDistance <= MAX_PHYSICAL_VISIT_DISTANCE_METERS
          ? 1
          : Number(
              (
                0.2 +
                ((MAX_APPROACHING_RADAR_METERS - clampedDist) /
                  (MAX_APPROACHING_RADAR_METERS - MAX_PHYSICAL_VISIT_DISTANCE_METERS)) *
                  0.8
              ).toFixed(3)
            );

      const isDiscoveringNow = this.pendingValidations.has(closestUnvisited.id);
      const proximityDetail: XpProximityUpdateDetail = {
        spot: closestUnvisited,
        spotId: closestUnvisited.id,
        spotName: cleanName,
        spotImage: spotImg,
        distanceMeters: Math.max(1, Math.round(closestDistance)),
        progress: isDiscoveringNow ? 1 : progress,
        bearingDeg,
        status: isDiscoveringNow ? 'discovering' : 'approaching',
      };
      this.lastProximityDetail = proximityDetail;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<XpProximityUpdateDetail>('monvian:xp_proximity_update', {
            detail: proximityDetail,
          })
        );
      }

      // Strictly trigger XP and coins ONLY when physically at the registered tourist spot (<= 50 meters)
      if (
        closestDistance <= MAX_PHYSICAL_VISIT_DISTANCE_METERS &&
        !isDiscoveringNow &&
        now - this.lastValidationCheckTime >= 2500
      ) {
        this.lastValidationCheckTime = now;
        await this.validateAndClaimSpot(closestUnvisited, userLat, userLng, closestDistance);
      }
    } else {
      if (this.currentTrackedSpotId !== null || this.lastProximityDetail !== null) {
        this.currentTrackedSpotId = null;
        this.lastProximityDetail = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('monvian:xp_proximity_update', { detail: null })
          );
        }
      }
    }
  }

  private getSpotMarkerScreenPosition(spotId: string): { originX: number; originY: number } {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { originX: 195, originY: 320 };
    }
    try {
      const markerEl = document.querySelector<HTMLElement>(`[data-spot-id="${spotId}"]`);
      if (markerEl) {
        const rect = markerEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            originX: rect.left + rect.width / 2,
            originY: rect.top + rect.height / 2,
          };
        }
      }
    } catch {}
    return {
      originX: window.innerWidth / 2,
      originY: window.innerHeight * 0.42,
    };
  }

  private computeClientLevelInfo(totalXp: number): { level: number; title: string; minXp: number; nextLevelXp: number } {
    if (totalXp >= 10000) return { level: 5, title: 'Lenda Monvian', minXp: 10000, nextLevelXp: Math.max(10000, totalXp) };
    if (totalXp >= 5000) return { level: 4, title: 'Elite Monvian', minXp: 5000, nextLevelXp: 10000 };
    if (totalXp >= 2500) return { level: 3, title: 'Desbravador', minXp: 2500, nextLevelXp: 5000 };
    if (totalXp >= 1000) return { level: 2, title: 'Aventureiro', minXp: 1000, nextLevelXp: 2500 };
    return { level: 1, title: 'Explorador', minXp: 0, nextLevelXp: 1000 };
  }

  /**
   * Validates physical GPS presence at the registered spot with the backend first,
   * and ONLY awards coins + 100 XP when the user is confirmed to be at the spot location (<= 50m).
   */
  public async validateAndClaimSpot(
    spot: Spot,
    userLat: number,
    userLng: number,
    approxDistance: number
  ): Promise<boolean> {
    if (
      approxDistance > MAX_PHYSICAL_VISIT_DISTANCE_METERS ||
      this.knownVisitedSpotIds.has(spot.id) ||
      this.pendingValidations.has(spot.id)
    ) {
      return false;
    }

    this.pendingValidations.add(spot.id);

    try {
      const res = await fetch('/api/xp/validate-visit', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          spotId: spot.id,
          lat: userLat,
          lng: userLng,
        }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      if (!data || !data.success) {
        if (data?.alreadyDiscovered) {
          this.knownVisitedSpotIds.add(spot.id);
        }
        return false;
      }

      // Backend confirmed the user is physically at the registered tourist spot!
      this.knownVisitedSpotIds.add(spot.id);
      const cleanName = getCleanSpotDisplayName(spot);
      const spotImg = getSpotImage(spot);

      const prevLevel = this.state.currentLevel;
      const syncedTotal = typeof data.totalXp === 'number' ? data.totalXp : this.state.totalXp + 100;
      const levelInfo = this.computeClientLevelInfo(syncedTotal);
      const isMaxLevel = levelInfo.level >= 5;
      const leveledUp = levelInfo.level > prevLevel;
      const span = Math.max(1, levelInfo.nextLevelXp - levelInfo.minXp);

      this.state = {
        ...this.state,
        totalXp: syncedTotal,
        currentLevel: levelInfo.level,
        levelTitle: data.levelTitle || levelInfo.title,
        nextLevelXp: isMaxLevel ? syncedTotal : Number(data.nextLevelXp || levelInfo.nextLevelXp),
        xpRemaining: isMaxLevel
          ? 0
          : Math.max(0, Number(data.nextLevelXp || levelInfo.nextLevelXp) - syncedTotal),
        levelProgressRatio: isMaxLevel
          ? 1
          : Math.min(1, Math.max(0, (syncedTotal - levelInfo.minXp) / span)),
        placesDiscoveredCount: Number(
          data.placesDiscoveredCount || this.state.placesDiscoveredCount + 1
        ),
        visitedSpotIds: Array.from(this.knownVisitedSpotIds),
        history: [
          {
            id: `v_${Date.now()}`,
            spot_id: spot.id,
            spot_name: cleanName,
            category: spot.categoryLabel || spot.category,
            xp_awarded: Number(data.xpAwarded) || 100,
            visited_at: new Date().toISOString(),
            distance_meters: Math.round(Number(data.distanceMeters ?? approxDistance)),
          },
          ...this.state.history.filter((h) => h.spot_id !== spot.id),
        ],
      };

      this.notify();

      if (typeof window !== 'undefined') {
        if (leveledUp) {
          playLevelUpSound();
        } else {
          playXpRewardSound();
        }

        try {
          triggerHapticFeedback(20);
        } catch {}

        const { originX, originY } = this.getSpotMarkerScreenPosition(spot.id);

        window.dispatchEvent(
          new CustomEvent<XpRewardEventDetail>('monvian:xp_awarded', {
            detail: {
              spotId: spot.id,
              spotName: cleanName,
              spotImage: spotImg,
              xpAwarded: Number(data.xpAwarded) || 100,
              totalXp: syncedTotal,
              currentLevel: levelInfo.level,
              levelTitle: levelInfo.title,
              leveledUp,
              originX,
              originY,
            },
          })
        );
      }

      return true;
    } catch (err) {
      console.warn('[XPManager] Physical visit validation error:', err);
      return false;
    } finally {
      this.pendingValidations.delete(spot.id);
    }
  }
}

export const monvianXpManager = new MonvianXpManager();

