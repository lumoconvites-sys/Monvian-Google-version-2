/**
 * xpService.ts
 * Client service and state manager for Monvian XP & Exploration progression.
 * Handles real-time proximity radar tracking, live distance updates for the
 * floating iOS discovery card, anti-duplicate caching, and server sync.
 */

import { Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { calculateHaversineDistance, calculateBearing, GpsNavState } from './gpsNavigation';
import { getSpotImage } from '../utils/spotImages';
import { getCleanSpotDisplayName } from './geolocationNotifications';
import { playXpRewardSound, playLevelUpSound } from '../utils/sound';
import { triggerHapticFeedback } from '../utils/haptics';

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

function buildMarioYeskMaxState(): XpProfileState {
  const allSpotIds = CAMPOS_SPOTS.map((s) => s.id);
  const count = Math.max(allSpotIds.length, 30);
  const maxXp = Math.max(10000, count * 100);
  const nowIso = new Date().toISOString();

  return {
    userId: '47',
    totalXp: maxXp,
    currentLevel: 5,
    levelTitle: 'Lenda Monvian',
    nextLevelXp: maxXp,
    xpRemaining: 0,
    levelProgressRatio: 1,
    placesDiscoveredCount: count,
    visitedSpotIds: allSpotIds,
    history: CAMPOS_SPOTS.map((s, idx) => ({
      id: `visit_mario_${s.id}_${idx}`,
      spot_id: s.id,
      spot_name: s.name,
      category: s.categoryLabel || s.category,
      xp_awarded: 100,
      visited_at: nowIso,
      distance_meters: 5,
    })),
  };
}

function isCurrentClientMarioYesk(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const rawUser = localStorage.getItem('monvian_user');
    if (!rawUser) {
      // Default user in App.tsx when no localStorage user is set is Mario Yesk (@marioyesk)
      return true;
    }
    const parsed = JSON.parse(rawUser);
    const username = String(parsed?.username || '').trim().toLowerCase().replace(/^@+/, '');
    const email = String(parsed?.email || parsed?.whatsapp || '').trim().toLowerCase();
    const id = String(parsed?.id || '').trim();
    return (
      username === 'marioyesk' ||
      id === '47' ||
      ['marioyesk@gmail.com', 'empresariomario@gmail.com', 'marioempresario@gmail.com'].includes(email)
    );
  } catch {
    return true;
  }
}

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
  private sessionClaimedSpotIds: Set<string> = new Set();
  private currentTrackedSpotId: string | null = null;
  private lastProximityDetail: XpProximityUpdateDetail | null = null;

  constructor() {
    this.loadCachedState();
    if (typeof window !== 'undefined') {
      window.addEventListener('monvian:user_updated', () => {
        this.loadCachedState();
        this.fetchProfile().catch(() => {});
      });
    }
  }

  private getCurrentUserCacheKey(): string {
    if (typeof window === 'undefined') return 'monvian_cached_xp_state_marioyesk';
    try {
      if (isCurrentClientMarioYesk()) {
        return 'monvian_cached_xp_state_marioyesk_v2';
      }
      const rawUser = localStorage.getItem('monvian_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        const key = parsed?.id || parsed?.email || parsed?.username;
        if (key) return `monvian_cached_xp_state_${String(key).toLowerCase()}`;
      }
      const sessionId = localStorage.getItem('monvian_user_session_id');
      if (sessionId) return `monvian_cached_xp_state_${sessionId}`;
    } catch {}
    return 'monvian_cached_xp_state_guest';
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
      try {
        const token =
          localStorage.getItem('monvian_token') ||
          localStorage.getItem('monvian_auth_token') ||
          localStorage.getItem('auth_token') ||
          localStorage.getItem('supabase.auth.token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        if (isCurrentClientMarioYesk()) {
          headers['x-username'] = 'marioyesk';
          headers['x-user-email'] = 'marioyesk@gmail.com';
        } else {
          const rawUser = localStorage.getItem('monvian_user');
          if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.username) headers['x-username'] = String(parsed.username);
            if (parsed?.email) headers['x-user-email'] = String(parsed.email);
          }
        }

        let sessionId = localStorage.getItem('monvian_user_session_id');
        if (!sessionId) {
          sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem('monvian_user_session_id', sessionId);
        }
        headers['x-session-id'] = sessionId;
      } catch {}
    }

    return headers;
  }

  private loadCachedState() {
    if (typeof window === 'undefined') return;
    try {
      if (isCurrentClientMarioYesk()) {
        const marioMax = buildMarioYeskMaxState();
        this.state = marioMax;
        this.knownVisitedSpotIds = new Set(marioMax.visitedSpotIds);
        this.saveCachedState();
        return;
      }

      const cacheKey = this.getCurrentUserCacheKey();
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.state = { ...DEFAULT_XP_STATE, ...parsed };
        this.knownVisitedSpotIds = new Set(this.state.visitedSpotIds || []);
      } else {
        this.state = { ...DEFAULT_XP_STATE };
        this.knownVisitedSpotIds = new Set();
      }
    } catch {}
  }

  private saveCachedState() {
    if (typeof window === 'undefined') return;
    try {
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
          const isMario = isCurrentClientMarioYesk();
          const marioFallback = isMario ? buildMarioYeskMaxState() : null;

          const totalXp = isMario
            ? Math.max(Number(data.totalXp) || 0, marioFallback!.totalXp)
            : Number(data.totalXp) || 0;
          const currentLevel = isMario ? 5 : Number(data.currentLevel) || 1;
          const levelTitle = isMario ? 'Lenda Monvian' : data.levelTitle || 'Explorador';

          this.state = {
            userId: data.userId || this.state.userId,
            totalXp,
            currentLevel,
            levelTitle,
            nextLevelXp: isMario ? totalXp : Number(data.nextLevelXp) || 1000,
            xpRemaining: isMario ? 0 : Number(data.xpRemaining ?? 1000),
            levelProgressRatio: isMario ? 1 : Number(data.levelProgressRatio) || 0,
            placesDiscoveredCount: isMario
              ? Math.max(Number(data.placesDiscoveredCount) || 0, marioFallback!.placesDiscoveredCount)
              : Number(data.placesDiscoveredCount) || 0,
            visitedSpotIds:
              isMario && (!data.visitedSpotIds || data.visitedSpotIds.length === 0)
                ? marioFallback!.visitedSpotIds
                : data.visitedSpotIds || [],
            history:
              isMario && (!data.history || data.history.length === 0)
                ? marioFallback!.history
                : data.history || [],
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
   * Checks whether the user marker ("Eu") and a spot marker visually touch/overlap on screen.
   */
  private checkUserMarkerTouchingSpot(spotId: string): { isTouching: boolean; screenDistPx: number } {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { isTouching: false, screenDistPx: Infinity };
    }
    try {
      const userEl = document.querySelector<HTMLElement>('.monvian-user-location-marker');
      const spotEl = document.querySelector<HTMLElement>(`[data-spot-id="${spotId}"]`);
      if (!userEl || !spotEl) return { isTouching: false, screenDistPx: Infinity };

      const userRect = userEl.getBoundingClientRect();
      const spotRect = spotEl.getBoundingClientRect();
      if (userRect.width === 0 || spotRect.width === 0) {
        return { isTouching: false, screenDistPx: Infinity };
      }

      const ux = userRect.left + userRect.width / 2;
      const uy = userRect.top + userRect.height / 2;
      const sx = spotRect.left + spotRect.width / 2;
      const sy = spotRect.top + spotRect.height / 2;

      const screenDistPx = Math.hypot(ux - sx, uy - sy);
      return {
        isTouching: screenDistPx <= 102,
        screenDistPx,
      };
    } catch {
      return { isTouching: false, screenDistPx: Infinity };
    }
  }

  /**
   * Evaluates current GPS coordinates and screen marker collision against all active spots.
   * Emits real-time proximity updates and immediately triggers the discovery animation
   * and coin counting as soon as the user icon touches a spot icon on the map.
   */
  public async evaluateProximity(gps: GpsNavState, spots: Spot[]): Promise<void> {
    if (!gps || !spots || spots.length === 0) return;

    const coords = gps.interpolatedCoords || gps.coords;
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return;

    const now = Date.now();
    if (now - this.lastProximityUiEmitTime < 220) return;
    this.lastProximityUiEmitTime = now;

    const [userLng, userLat] = coords;
    const isMario = isCurrentClientMarioYesk();

    let closestUnvisited: Spot | null = null;
    let closestDistance = Infinity;
    let touchingSpotOnScreen: Spot | null = null;
    let touchingSpotDistance = Infinity;

    for (const spot of spots) {
      if (!spot || !spot.id || spot.isActive === false) continue;
      // For regular users, skip spots already visited; for @marioyesk (who has explored all spots),
      // skip only spots already triggered in this live session so the radar & coin animation still work on the map.
      if (isMario ? this.sessionClaimedSpotIds.has(spot.id) : this.knownVisitedSpotIds.has(spot.id)) {
        continue;
      }
      if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') continue;

      const dist = calculateHaversineDistance(userLng, userLat, spot.lng, spot.lat);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestUnvisited = spot;
      }

      if (dist <= 650) {
        const { isTouching } = this.checkUserMarkerTouchingSpot(spot.id);
        if (isTouching && dist < touchingSpotDistance) {
          touchingSpotDistance = dist;
          touchingSpotOnScreen = spot;
        }
      }
    }

    const activeTargetSpot = touchingSpotOnScreen || closestUnvisited;
    const activeTargetDistance = touchingSpotOnScreen ? touchingSpotDistance : closestDistance;

    if (activeTargetSpot) {
      this.currentTrackedSpotId = activeTargetSpot.id;
      const cleanName = getCleanSpotDisplayName(activeTargetSpot);
      const spotImg = getSpotImage(activeTargetSpot);
      const bearingDeg = calculateBearing(userLng, userLat, activeTargetSpot.lng, activeTargetSpot.lat);

      const clampedDist = Math.max(40, Math.min(450, activeTargetDistance));
      const progress = touchingSpotOnScreen
        ? 1
        : Number((0.22 + ((450 - clampedDist) / (450 - 40)) * 0.76).toFixed(3));

      const isDiscoveringNow = this.pendingValidations.has(activeTargetSpot.id);
      const proximityDetail: XpProximityUpdateDetail = {
        spot: activeTargetSpot,
        spotId: activeTargetSpot.id,
        spotName: cleanName,
        spotImage: spotImg,
        distanceMeters: Math.max(1, Math.round(activeTargetDistance)),
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

      const shouldTriggerImmediately = Boolean(touchingSpotOnScreen) || activeTargetDistance <= 135;

      if (
        shouldTriggerImmediately &&
        !isDiscoveringNow &&
        now - this.lastValidationCheckTime >= 1600
      ) {
        this.lastValidationCheckTime = now;
        this.validateAndClaimSpot(activeTargetSpot, userLat, userLng, activeTargetDistance, true);
      }
    } else {
      this.currentTrackedSpotId = null;
      this.lastProximityDetail = null;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('monvian:xp_proximity_update', { detail: null })
        );
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
   * Immediately executes the spot discovery animation, bursts & counts the coins (+100 XP),
   * and persists the reward to the backend.
   */
  public async validateAndClaimSpot(
    spot: Spot,
    userLat: number,
    userLng: number,
    approxDistance: number,
    screenTouch: boolean = true
  ): Promise<boolean> {
    const isMario = isCurrentClientMarioYesk();
    if (
      (isMario ? this.sessionClaimedSpotIds.has(spot.id) : this.knownVisitedSpotIds.has(spot.id)) ||
      this.pendingValidations.has(spot.id)
    ) {
      return false;
    }

    this.pendingValidations.add(spot.id);
    this.sessionClaimedSpotIds.add(spot.id);
    const wasAlreadyInVisitedSet = this.knownVisitedSpotIds.has(spot.id);
    this.knownVisitedSpotIds.add(spot.id);

    const cleanName = getCleanSpotDisplayName(spot);
    const spotImg = getSpotImage(spot);

    const prevLevel = this.state.currentLevel;
    const optimisticTotalXp = this.state.totalXp + 100;
    const levelInfo = this.computeClientLevelInfo(optimisticTotalXp);
    const isMaxLevel = levelInfo.level >= 5;
    const leveledUp = levelInfo.level > prevLevel;
    const span = Math.max(1, levelInfo.nextLevelXp - levelInfo.minXp);

    this.state = {
      ...this.state,
      totalXp: optimisticTotalXp,
      currentLevel: levelInfo.level,
      levelTitle: levelInfo.title,
      nextLevelXp: isMaxLevel ? optimisticTotalXp : levelInfo.nextLevelXp,
      xpRemaining: isMaxLevel ? 0 : Math.max(0, levelInfo.nextLevelXp - optimisticTotalXp),
      levelProgressRatio: isMaxLevel ? 1 : Math.min(1, Math.max(0, (optimisticTotalXp - levelInfo.minXp) / span)),
      placesDiscoveredCount: wasAlreadyInVisitedSet
        ? this.state.placesDiscoveredCount
        : this.state.placesDiscoveredCount + 1,
      visitedSpotIds: Array.from(this.knownVisitedSpotIds),
      history: [
        {
          id: `v_${Date.now()}`,
          spot_id: spot.id,
          spot_name: cleanName,
          category: spot.categoryLabel || spot.category,
          xp_awarded: 100,
          visited_at: new Date().toISOString(),
          distance_meters: Math.round(approxDistance),
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
            xpAwarded: 100,
            totalXp: optimisticTotalXp,
            currentLevel: levelInfo.level,
            levelTitle: levelInfo.title,
            leveledUp,
            originX,
            originY,
          },
        })
      );
    }

    try {
      const res = await fetch('/api/xp/validate-visit', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          spotId: spot.id,
          lat: userLat,
          lng: userLng,
          screenTouch,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && typeof data.totalXp === 'number') {
          const syncedTotal = Math.max(this.state.totalXp, data.totalXp);
          const syncedLevel = this.computeClientLevelInfo(syncedTotal);
          const syncedIsMax = syncedLevel.level >= 5;
          const syncedSpan = Math.max(1, syncedLevel.nextLevelXp - syncedLevel.minXp);
          this.state = {
            ...this.state,
            totalXp: syncedTotal,
            currentLevel: syncedLevel.level,
            levelTitle: data.levelTitle || syncedLevel.title,
            nextLevelXp: syncedIsMax ? syncedTotal : Number(data.nextLevelXp || syncedLevel.nextLevelXp),
            xpRemaining: syncedIsMax ? 0 : Math.max(0, Number(data.nextLevelXp || syncedLevel.nextLevelXp) - syncedTotal),
            levelProgressRatio: syncedIsMax ? 1 : Math.min(1, Math.max(0, (syncedTotal - syncedLevel.minXp) / syncedSpan)),
            placesDiscoveredCount: Math.max(
              this.state.placesDiscoveredCount,
              Number(data.placesDiscoveredCount || this.state.placesDiscoveredCount)
            ),
          };
          this.notify();
        }
      }
    } catch (err) {
      console.warn('[XPManager] Background persistence warning:', err);
    } finally {
      this.pendingValidations.delete(spot.id);
    }

    return true;
  }
}

export const monvianXpManager = new MonvianXpManager();
