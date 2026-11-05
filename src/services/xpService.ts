/**
 * xpService.ts
 * Client service and state manager for Monvian XP & Exploration progression.
 * Handles background proximity checks, 1.5s pin progress ring choreography,
 * anti-duplicate caching, server sync, and broadcasts reward events to UI components.
 */

import { Spot } from '../types';
import { calculateHaversineDistance, GpsNavState } from './gpsNavigation';
import { playXpRewardSound, playLevelUpSound, playPinChargeStartSound } from '../utils/sound';
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

export interface XpDiscoveryStartDetail {
  spotId: string;
  spotName: string;
  durationMs: number;
}

export interface XpRewardEventDetail {
  spotId: string;
  spotName: string;
  xpAwarded: number;
  totalXp: number;
  currentLevel: number;
  levelTitle: string;
  leveledUp?: boolean;
  originX?: number;
  originY?: number;
}

type XpSubscriber = (state: XpProfileState) => void;

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
  private lastLocationCheckTime: number = 0;
  private knownVisitedSpotIds: Set<string> = new Set();

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
    if (typeof window === 'undefined') return 'monvian_cached_xp_state_guest';
    try {
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
          this.state = {
            userId: data.userId || this.state.userId,
            totalXp: Number(data.totalXp) || 0,
            currentLevel: Number(data.currentLevel) || 1,
            levelTitle: data.levelTitle || 'Explorador',
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
   * Check proximity of GPS coordinates against all active spots.
   * Invoked from MapComponent / App GPS subscription loop at a throttled rate (every 3.5 seconds).
   */
  public async evaluateProximity(gps: GpsNavState, spots: Spot[]): Promise<void> {
    if (!gps || !gps.coords || spots.length === 0) return;
    if (gps.status !== 'granted') return;

    const now = Date.now();
    if (now - this.lastLocationCheckTime < 3500) return;
    this.lastLocationCheckTime = now;

    const [userLng, userLat] = gps.coords;
    if (typeof userLng !== 'number' || typeof userLat !== 'number') return;

    for (const spot of spots) {
      if (!spot || !spot.id) continue;
      if (this.knownVisitedSpotIds.has(spot.id)) continue;
      if (this.pendingValidations.has(spot.id)) continue;

      const spotLat = spot.lat;
      const spotLng = spot.lng;
      if (typeof spotLat !== 'number' || typeof spotLng !== 'number') continue;

      const distanceMeters = calculateHaversineDistance(userLng, userLat, spotLng, spotLat);

      // Proximity threshold: approximately 40 meters
      if (distanceMeters <= 45) {
        this.validateAndClaimSpot(spot, userLat, userLng, distanceMeters);
        break; // Process one discovery at a time for clear pin choreography
      }
    }
  }

  /**
   * Resolves the current screen coordinates (x, y) of a spot marker on the map.
   */
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

  /**
   * Claims a spot visit via 1.5s pin progress ring + backend validation + pin jump & coin burst
   */
  public async validateAndClaimSpot(
    spot: Spot,
    userLat: number,
    userLng: number,
    approxDistance: number
  ): Promise<boolean> {
    if (this.knownVisitedSpotIds.has(spot.id) || this.pendingValidations.has(spot.id)) {
      return false;
    }

    this.pendingValidations.add(spot.id);
    const ringDurationMs = 1500;

    // 1. Start the 1.5s circular progress ring animation around the pin on the map
    if (typeof window !== 'undefined') {
      playPinChargeStartSound();
      try {
        triggerHapticFeedback(10);
      } catch {}
      window.dispatchEvent(
        new CustomEvent<XpDiscoveryStartDetail>('monvian:xp_discovery_start', {
          detail: {
            spotId: spot.id,
            spotName: spot.name,
            durationMs: ringDurationMs,
          },
        })
      );
    }

    try {
      const validationPromise = fetch('/api/xp/validate-visit', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          spotId: spot.id,
          lat: userLat,
          lng: userLng,
        }),
      }).then(async (res) => ({ ok: res.ok, data: await res.json() }));

      const ringDelayPromise = new Promise<void>((resolve) =>
        setTimeout(resolve, ringDurationMs)
      );

      const [{ ok, data }] = await Promise.all([validationPromise, ringDelayPromise]);

      if (ok && data.success) {
        // Record as visited
        this.knownVisitedSpotIds.add(spot.id);

        const prevLevel = this.state.currentLevel;
        const newTotalXp = Number(data.totalXp ?? this.state.totalXp + 100);
        const newLevel = Number(data.currentLevel ?? this.state.currentLevel);
        const leveledUp = newLevel > prevLevel;

        this.state = {
          ...this.state,
          totalXp: newTotalXp,
          currentLevel: newLevel,
          levelTitle: data.levelTitle || this.state.levelTitle,
          nextLevelXp: Number(data.nextLevelXp || this.state.nextLevelXp),
          xpRemaining: Math.max(0, Number(data.nextLevelXp || this.state.nextLevelXp) - newTotalXp),
          placesDiscoveredCount: Number(data.placesDiscoveredCount || this.state.placesDiscoveredCount + 1),
          visitedSpotIds: Array.from(this.knownVisitedSpotIds),
          history: [
            {
              id: `v_${Date.now()}`,
              spot_id: spot.id,
              spot_name: spot.name,
              category: spot.categoryLabel || spot.category,
              xp_awarded: 100,
              visited_at: new Date().toISOString(),
              distance_meters: data.distanceMeters || Math.round(approxDistance),
            },
            ...this.state.history,
          ],
        };

        const minXpForLevel =
          this.state.currentLevel === 1
            ? 0
            : this.state.currentLevel === 2
            ? 1000
            : this.state.currentLevel === 3
            ? 2500
            : this.state.currentLevel === 4
            ? 5000
            : 10000;
        const span = Math.max(1, this.state.nextLevelXp - minXpForLevel);
        this.state.levelProgressRatio = Math.min(1, Math.max(0, (this.state.totalXp - minXpForLevel) / span));

        this.notify();

        // 2. Cascading metallic coin audio + achievement chime
        if (leveledUp) {
          playLevelUpSound();
        } else {
          playXpRewardSound();
        }

        // 3. iOS Haptic pulse
        try {
          triggerHapticFeedback(25);
        } catch {}

        // 4. Get pin screen coordinates and dispatch pin jump + coin burst choreography
        const { originX, originY } = this.getSpotMarkerScreenPosition(spot.id);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent<XpRewardEventDetail>('monvian:xp_awarded', {
              detail: {
                spotId: spot.id,
                spotName: spot.name,
                xpAwarded: 100,
                totalXp: newTotalXp,
                currentLevel: newLevel,
                levelTitle: this.state.levelTitle,
                leveledUp,
                originX,
                originY,
              },
            })
          );
        }

        return true;
      } else {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('monvian:xp_discovery_cancel', {
              detail: { spotId: spot.id },
            })
          );
        }
        if (data?.alreadyDiscovered) {
          this.knownVisitedSpotIds.add(spot.id);
          this.state.visitedSpotIds = Array.from(this.knownVisitedSpotIds);
          this.notify();
        }
      }
    } catch (err) {
      console.warn('[XPManager] Validation request error:', err);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('monvian:xp_discovery_cancel', {
            detail: { spotId: spot.id },
          })
        );
      }
    } finally {
      this.pendingValidations.delete(spot.id);
    }

    return false;
  }
}

export const monvianXpManager = new MonvianXpManager();
