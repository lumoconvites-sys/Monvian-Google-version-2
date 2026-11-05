/**
 * xpService.ts
 * Client service and state manager for Monvian XP & Exploration progression.
 * Handles background proximity checks, anti-duplicate caching, server sync,
 * and broadcasts reward events to UI components.
 */

import { Spot } from '../types';
import { calculateHaversineDistance, GpsNavState } from './gpsNavigation';
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

export interface XpRewardEventDetail {
  spotId: string;
  spotName: string;
  xpAwarded: number;
  totalXp: number;
  currentLevel: number;
  levelTitle: string;
  leveledUp?: boolean;
}

type XpSubscriber = (state: XpProfileState) => void;

class MonvianXpManager {
  private state: XpProfileState = {
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

  private subscribers: Set<XpSubscriber> = new Set();
  private pendingValidations: Set<string> = new Set();
  private lastLocationCheckTime: number = 0;
  private knownVisitedSpotIds: Set<string> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    this.loadCachedState();
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
      try {
        const token =
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
      const cached = localStorage.getItem('monvian_cached_xp_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        this.state = { ...this.state, ...parsed };
        this.knownVisitedSpotIds = new Set(this.state.visitedSpotIds || []);
      }
    } catch {}
  }

  private saveCachedState() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('monvian_cached_xp_state', JSON.stringify(this.state));
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
          const oldLevel = this.state.currentLevel;
          this.state = {
            userId: data.userId || this.state.userId,
            totalXp: data.totalXp ?? 0,
            currentLevel: data.currentLevel ?? 1,
            levelTitle: data.levelTitle || 'Explorador',
            nextLevelXp: data.nextLevelXp ?? 1000,
            xpRemaining: data.xpRemaining ?? 1000,
            levelProgressRatio: data.levelProgressRatio ?? 0,
            placesDiscoveredCount: data.placesDiscoveredCount ?? 0,
            visitedSpotIds: data.visitedSpotIds || [],
            history: data.history || [],
          };
          this.knownVisitedSpotIds = new Set(this.state.visitedSpotIds);
          this.isInitialized = true;
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
   * Invoked from MapComponent / App GPS subscription loop at a throttled rate (every 3-5 seconds).
   */
  public async evaluateProximity(gps: GpsNavState, spots: Spot[]): Promise<void> {
    if (!gps || !gps.coords || spots.length === 0) return;
    if (gps.status !== 'granted') return;

    // Throttle checks to once every 3.5 seconds to preserve mobile battery
    const now = Date.now();
    if (now - this.lastLocationCheckTime < 3500) return;
    this.lastLocationCheckTime = now;

    const [userLng, userLat] = gps.coords;
    if (typeof userLng !== 'number' || typeof userLat !== 'number') return;

    // Filter spots within approximately 40m that haven't been visited yet
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
        break; // Only process one discovery at a time for maximum visual clarity
      }
    }
  }

  /**
   * Claims a spot visit via backend validation
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

      const data = await res.json();

      if (res.ok && data.success) {
        // Record as visited
        this.knownVisitedSpotIds.add(spot.id);

        const prevLevel = this.state.currentLevel;
        const newTotalXp = data.totalXp ?? this.state.totalXp + 100;
        const newLevel = data.currentLevel ?? this.state.currentLevel;
        const leveledUp = newLevel > prevLevel;

        this.state = {
          ...this.state,
          totalXp: newTotalXp,
          currentLevel: newLevel,
          levelTitle: data.levelTitle || this.state.levelTitle,
          nextLevelXp: data.nextLevelXp || this.state.nextLevelXp,
          xpRemaining: Math.max(0, (data.nextLevelXp || this.state.nextLevelXp) - newTotalXp),
          placesDiscoveredCount: data.placesDiscoveredCount || this.state.placesDiscoveredCount + 1,
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

        // Recalculate level progress ratio
        const minXpForLevel = this.state.currentLevel === 1 ? 0 : this.state.currentLevel === 2 ? 1000 : 2500;
        const span = Math.max(1, this.state.nextLevelXp - minXpForLevel);
        this.state.levelProgressRatio = Math.min(1, Math.max(0, (this.state.totalXp - minXpForLevel) / span));

        this.notify();

        // 1. Audio feedback
        if (leveledUp) {
          playLevelUpSound();
        } else {
          playXpRewardSound();
        }

        // 2. iOS Haptic feedback
        try {
          triggerHapticFeedback();
        } catch {}

        // 3. Dispatch global reward floating animation event
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
              },
            })
          );
        }

        return true;
      } else if (data.alreadyDiscovered) {
        this.knownVisitedSpotIds.add(spot.id);
        this.state.visitedSpotIds = Array.from(this.knownVisitedSpotIds);
        this.notify();
      }
    } catch (err) {
      console.warn('[XPManager] Validation request error:', err);
    } finally {
      this.pendingValidations.delete(spot.id);
    }

    return false;
  }
}

export const monvianXpManager = new MonvianXpManager();
