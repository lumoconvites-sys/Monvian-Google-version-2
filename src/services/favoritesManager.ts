import {
  getActiveUserScope,
  getScopedStorageKey,
  purgeLegacyUnscopedActivityKeys,
} from '../utils/userScopedStorage';

// Persistent Favorites & Saved Items Service for Monvian (Strictly Per-Account Isolated)
export interface SavedFavoritesState {
  itineraries: string[];
  spots: string[];
  places: string[]; // Stores "Removidos da lista" IDs (spots or itineraries removed from lists)
}

const STORAGE_KEYS = {
  ITINERARIES: 'monvian_saved_itineraries',
  SPOTS: 'monvian_saved_spots',
  PLACES: 'monvian_removed_items',
};

const EMPTY_FAVORITES: SavedFavoritesState = {
  itineraries: [],
  spots: [],
  places: [],
};

function readStorageList(key: string | null): string[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.filter((item) => typeof item === 'string' && item.trim() !== '')));
    }
  } catch (e) {
    console.warn(`[Favorites] Error reading ${key}:`, e);
  }
  return [];
}

function writeStorageList(key: string | null, list: string[]): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(list))));
  } catch (e) {
    console.warn(`[Favorites] Error writing ${key}:`, e);
  }
}

function buildAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extraHeaders || {}) };
  try {
    const token = localStorage.getItem('monvian_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const rawUser = localStorage.getItem('monvian_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      const cleanEmail = String(parsed?.email || parsed?.whatsapp || '').trim().toLowerCase();
      if (cleanEmail) headers['x-user-email'] = cleanEmail;
    }
  } catch {}
  return headers;
}

class FavoritesManager {
  private state: SavedFavoritesState;
  private activeScope: string | null = null;
  private listeners: Set<() => void> = new Set();
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Remove legacy global device-wide favorite keys so accounts never mix
      purgeLegacyUnscopedActivityKeys();
    }
    this.activeScope = getActiveUserScope();
    this.state = this.loadLocalState(this.activeScope);

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
      window.addEventListener('monvian:user_logged_out', this.handleLogoutEvent);
      window.addEventListener('monvian:account_switched', this.handleAccountSwitchedEvent as EventListener);
    }
  }

  private loadLocalState(scope: string | null): SavedFavoritesState {
    if (!scope) {
      return { itineraries: [], spots: [], places: [] };
    }
    const itinKey = `${STORAGE_KEYS.ITINERARIES}__acct_${scope}`;
    const spotKey = `${STORAGE_KEYS.SPOTS}__acct_${scope}`;
    const placeKey = `${STORAGE_KEYS.PLACES}__acct_${scope}`;

    return {
      itineraries: readStorageList(itinKey),
      spots: readStorageList(spotKey),
      places: readStorageList(placeKey),
    };
  }

  private handleStorageEvent = (e: StorageEvent) => {
    const scope = getActiveUserScope();
    if (!scope) return;
    if (
      e.key &&
      e.key.endsWith(`__acct_${scope}`) &&
      (e.key.startsWith(STORAGE_KEYS.ITINERARIES) ||
        e.key.startsWith(STORAGE_KEYS.SPOTS) ||
        e.key.startsWith(STORAGE_KEYS.PLACES))
    ) {
      this.activeScope = scope;
      this.state = this.loadLocalState(scope);
      this.notify();
    }
  };

  private handleLogoutEvent = () => {
    this.reset();
  };

  private handleAccountSwitchedEvent = (e: CustomEvent<any>) => {
    this.setActiveAccount(e?.detail || null);
  };

  public reset(): void {
    purgeLegacyUnscopedActivityKeys();
    this.activeScope = null;
    this.isSyncing = false;
    this.state = { ...EMPTY_FAVORITES, itineraries: [], spots: [], places: [] };
    this.notify();
  }

  public setActiveAccount(user: any | null): void {
    purgeLegacyUnscopedActivityKeys();
    if (!user) {
      this.reset();
      return;
    }
    const nextScope = getActiveUserScope(user);
    const scopeChanged = nextScope !== this.activeScope;
    this.activeScope = nextScope;
    if (scopeChanged) {
      this.isSyncing = false;
    }
    this.state = this.loadLocalState(nextScope);
    this.notify();
    void this.syncWithServer(true);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[Favorites] Listener error:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('monvian:favorites_changed', {
          detail: { ...this.state },
        })
      );
    }
  }

  private persistLocal() {
    const scope = this.activeScope || getActiveUserScope();
    if (!scope) return;
    this.activeScope = scope;
    writeStorageList(getScopedStorageKey(STORAGE_KEYS.ITINERARIES) || `${STORAGE_KEYS.ITINERARIES}__acct_${scope}`, this.state.itineraries);
    writeStorageList(getScopedStorageKey(STORAGE_KEYS.SPOTS) || `${STORAGE_KEYS.SPOTS}__acct_${scope}`, this.state.spots);
    writeStorageList(getScopedStorageKey(STORAGE_KEYS.PLACES) || `${STORAGE_KEYS.PLACES}__acct_${scope}`, this.state.places);
  }

  private ensureScopeMatchesCurrentUser() {
    const currentScope = getActiveUserScope();
    if (currentScope !== this.activeScope) {
      this.activeScope = currentScope;
      this.state = this.loadLocalState(currentScope);
    }
  }

  public getState(): SavedFavoritesState {
    this.ensureScopeMatchesCurrentUser();
    return {
      itineraries: [...this.state.itineraries],
      spots: [...this.state.spots],
      places: [...this.state.places],
    };
  }

  public getFavorites(): string[] {
    this.ensureScopeMatchesCurrentUser();
    return [...this.state.spots];
  }

  public toggleFavorite(id: string): boolean {
    return this.toggleSpot(id);
  }

  public isItinerarySaved(id: string): boolean {
    this.ensureScopeMatchesCurrentUser();
    return this.state.itineraries.includes(id);
  }

  public isSpotSaved(id: string): boolean {
    this.ensureScopeMatchesCurrentUser();
    return this.state.spots.includes(id);
  }

  public isPlaceSaved(id: string): boolean {
    this.ensureScopeMatchesCurrentUser();
    return this.state.places.includes(id);
  }

  public isSaved(type: 'itinerary' | 'spot' | 'place', id: string): boolean {
    if (type === 'itinerary') return this.isItinerarySaved(id);
    if (type === 'spot') return this.isSpotSaved(id);
    if (type === 'place') return this.isPlaceSaved(id);
    return false;
  }

  public isSpotOrPlaceSaved(id: string): boolean {
    return this.isSpotSaved(id);
  }

  public addRemovedItem(id: string): void {
    this.ensureScopeMatchesCurrentUser();
    if (!id || !this.activeScope) return;
    if (!this.state.places.includes(id)) {
      this.state.places = [id, ...this.state.places];
      this.persistLocal();
      this.notify();
      this.syncToServer('place', id, true);
    }
  }

  public toggleItinerary(id: string): boolean {
    this.ensureScopeMatchesCurrentUser();
    if (!id || !this.activeScope) return false;
    const exists = this.state.itineraries.includes(id);
    const wasInPlaces = this.state.places.includes(id);
    if (exists) {
      this.state.itineraries = this.state.itineraries.filter((item) => item !== id);
      if (!wasInPlaces) {
        this.state.places = [id, ...this.state.places];
      }
    } else {
      this.state.itineraries = [id, ...this.state.itineraries];
      this.state.places = this.state.places.filter((item) => item !== id);
    }
    this.persistLocal();
    this.notify();
    this.syncToServer('itinerary', id, !exists);
    if (exists && !wasInPlaces) {
      this.syncToServer('place', id, true);
    } else if (!exists && wasInPlaces) {
      this.syncToServer('place', id, false);
    }
    return !exists;
  }

  public toggleSpot(id: string): boolean {
    this.ensureScopeMatchesCurrentUser();
    if (!id || !this.activeScope) return false;
    const exists = this.state.spots.includes(id);
    const wasInPlaces = this.state.places.includes(id);
    if (exists) {
      this.state.spots = this.state.spots.filter((item) => item !== id);
      if (!wasInPlaces) {
        this.state.places = [id, ...this.state.places];
      }
    } else {
      this.state.spots = [id, ...this.state.spots];
      this.state.places = this.state.places.filter((item) => item !== id);
    }
    this.persistLocal();
    this.notify();
    this.syncToServer('spot', id, !exists);
    if (exists && !wasInPlaces) {
      this.syncToServer('place', id, true);
    } else if (!exists && wasInPlaces) {
      this.syncToServer('place', id, false);
    }
    return !exists;
  }

  public togglePlace(id: string): boolean {
    this.ensureScopeMatchesCurrentUser();
    if (!id || !this.activeScope) return false;
    const exists = this.state.places.includes(id);
    if (exists) {
      this.state.places = this.state.places.filter((item) => item !== id);
    } else {
      this.state.places = [id, ...this.state.places];
    }
    this.persistLocal();
    this.notify();
    this.syncToServer('place', id, !exists);
    return !exists;
  }

  public toggleItem(type: 'itinerary' | 'spot' | 'place', id: string): boolean {
    if (type === 'itinerary') return this.toggleItinerary(id);
    if (type === 'spot') return this.toggleSpot(id);
    return this.togglePlace(id);
  }

  public removeBatch(items: Array<{ type: 'itinerary' | 'spot' | 'place'; id: string }>): void {
    this.ensureScopeMatchesCurrentUser();
    if (!items || items.length === 0 || !this.activeScope) return;

    const itineraryIdsToRemove = new Set(
      items.filter((i) => i.type === 'itinerary').map((i) => i.id)
    );
    const spotIdsToRemove = new Set(
      items.filter((i) => i.type === 'spot').map((i) => i.id)
    );
    const placeIdsToRemove = new Set(
      items.filter((i) => i.type === 'place').map((i) => i.id)
    );

    if (itineraryIdsToRemove.size > 0) {
      this.state.itineraries = this.state.itineraries.filter((id) => !itineraryIdsToRemove.has(id));
      itineraryIdsToRemove.forEach((id) => {
        if (!this.state.places.includes(id)) {
          this.state.places = [id, ...this.state.places];
        }
      });
    }

    if (spotIdsToRemove.size > 0) {
      this.state.spots = this.state.spots.filter((id) => !spotIdsToRemove.has(id));
      spotIdsToRemove.forEach((id) => {
        if (!this.state.places.includes(id)) {
          this.state.places = [id, ...this.state.places];
        }
      });
    }

    if (placeIdsToRemove.size > 0) {
      this.state.places = this.state.places.filter((id) => !placeIdsToRemove.has(id));
    }

    this.persistLocal();
    this.notify();
    this.syncBatchRemoveToServer(items);
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public async syncWithServer(forceReplace = true): Promise<void> {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('monvian_token');
    const requestScope = getActiveUserScope();
    if (!token || !requestScope) return;
    if (this.isSyncing && !forceReplace) return;

    this.isSyncing = true;
    try {
      const res = await fetch('/api/user/favorites', {
        headers: buildAuthHeaders(),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        // Verify active account did not switch while request was in flight
        const latestScope = getActiveUserScope();
        if (!latestScope || latestScope !== requestScope) return;

        if (data.success && data.favorites) {
          const sItin: string[] = Array.isArray(data.favorites.itineraries)
            ? Array.from(new Set<string>(data.favorites.itineraries.filter((x: unknown): x is string => typeof x === 'string')))
            : [];
          const sSpots: string[] = Array.isArray(data.favorites.spots)
            ? Array.from(new Set<string>(data.favorites.spots.filter((x: unknown): x is string => typeof x === 'string')))
            : [];
          const sPlaces: string[] = Array.isArray(data.favorites.places)
            ? Array.from(new Set<string>(data.favorites.places.filter((x: unknown): x is string => typeof x === 'string')))
            : [];

          this.activeScope = latestScope;
          if (forceReplace) {
            this.state = {
              itineraries: sItin,
              spots: sSpots,
              places: sPlaces,
            };
          } else {
            this.state = {
              itineraries: Array.from(new Set([...this.state.itineraries, ...sItin])),
              spots: Array.from(new Set([...this.state.spots, ...sSpots])),
              places: Array.from(new Set([...this.state.places, ...sPlaces])),
            };
          }

          this.persistLocal();
          this.notify();
        }
      }
    } catch (err) {
      console.warn('[Favorites] Offline or server sync notice:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncToServer(type: 'itinerary' | 'spot' | 'place', id: string, isSaved: boolean) {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('monvian_token');
    if (!token || !getActiveUserScope()) return;

    try {
      await fetch('/api/user/favorites/toggle', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ item_type: type, item_id: id, is_saved: isSaved }),
      });
    } catch {
      // Offline fallback: changes already safely preserved in account-scoped localStorage
    }
  }

  private async syncBatchRemoveToServer(items: Array<{ type: string; id: string }>) {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('monvian_token');
    if (!token || !getActiveUserScope()) return;

    try {
      await fetch('/api/user/favorites/remove-batch', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ items }),
      });
    } catch {}
  }
}

export const favoritesManager = new FavoritesManager();
