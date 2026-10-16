// Persistent Favorites & Saved Items Service for Monvian (Airbnb-style Wishlists)
export interface SavedFavoritesState {
  itineraries: string[];
  spots: string[];
  places: string[];
}

const STORAGE_KEYS = {
  ITINERARIES: 'monvian_saved_itineraries',
  SPOTS: 'monvian_saved_spots',
  PLACES: 'monvian_saved_places',
  LEGACY_FAVORITES: 'monvian_favorites',
};

const DEFAULT_INITIAL_FAVORITES: SavedFavoritesState = {
  itineraries: ['roteiro-classico-2-dias'],
  spots: ['itapeva', 'amantikir'],
  places: ['baden-baden'],
};

function readStorageList(key: string, defaultFallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultFallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.warn(`[Favorites] Error reading ${key}:`, e);
  }
  return defaultFallback;
}

function writeStorageList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn(`[Favorites] Error writing ${key}:`, e);
  }
}

class FavoritesManager {
  private state: SavedFavoritesState;
  private listeners: Set<() => void> = new Set();
  private isSyncing = false;

  constructor() {
    this.state = this.loadLocalState();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  private loadLocalState(): SavedFavoritesState {
    const itineraries = readStorageList(STORAGE_KEYS.ITINERARIES, DEFAULT_INITIAL_FAVORITES.itineraries);
    const spots = readStorageList(STORAGE_KEYS.SPOTS, DEFAULT_INITIAL_FAVORITES.spots);
    const places = readStorageList(STORAGE_KEYS.PLACES, DEFAULT_INITIAL_FAVORITES.places);

    return {
      itineraries: Array.from(new Set(itineraries)),
      spots: Array.from(new Set(spots)),
      places: Array.from(new Set(places)),
    };
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEYS.ITINERARIES ||
      e.key === STORAGE_KEYS.SPOTS ||
      e.key === STORAGE_KEYS.PLACES
    ) {
      this.state = this.loadLocalState();
      this.notify();
    }
  };

  private notify() {
    this.syncLegacyStorage();
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

  private syncLegacyStorage() {
    // Keep legacy single favorites array in sync for backward compatibility
    const combined = Array.from(new Set([...this.state.spots, ...this.state.places]));
    writeStorageList(STORAGE_KEYS.LEGACY_FAVORITES, combined);
  }

  private persistLocal() {
    writeStorageList(STORAGE_KEYS.ITINERARIES, this.state.itineraries);
    writeStorageList(STORAGE_KEYS.SPOTS, this.state.spots);
    writeStorageList(STORAGE_KEYS.PLACES, this.state.places);
    this.syncLegacyStorage();
  }

  public getState(): SavedFavoritesState {
    return {
      itineraries: [...this.state.itineraries],
      spots: [...this.state.spots],
      places: [...this.state.places],
    };
  }

  public getFavorites(): string[] {
    return Array.from(new Set([...this.state.spots, ...this.state.places]));
  }

  public toggleFavorite(id: string): boolean {
    if (this.state.places.includes(id)) {
      return this.togglePlace(id);
    }
    return this.toggleSpot(id);
  }

  public isItinerarySaved(id: string): boolean {
    return this.state.itineraries.includes(id);
  }

  public isSpotSaved(id: string): boolean {
    return this.state.spots.includes(id);
  }

  public isPlaceSaved(id: string): boolean {
    return this.state.places.includes(id);
  }

  public isSaved(type: 'itinerary' | 'spot' | 'place', id: string): boolean {
    if (type === 'itinerary') return this.isItinerarySaved(id);
    if (type === 'spot') return this.isSpotSaved(id);
    if (type === 'place') return this.isPlaceSaved(id);
    return false;
  }

  public isSpotOrPlaceSaved(id: string): boolean {
    return this.isSpotSaved(id) || this.isPlaceSaved(id);
  }

  public toggleItinerary(id: string): boolean {
    const exists = this.state.itineraries.includes(id);
    if (exists) {
      this.state.itineraries = this.state.itineraries.filter((item) => item !== id);
    } else {
      this.state.itineraries = [id, ...this.state.itineraries];
    }
    this.persistLocal();
    this.notify();
    this.syncToServer('itinerary', id, !exists);
    return !exists;
  }

  public toggleSpot(id: string): boolean {
    const exists = this.state.spots.includes(id);
    if (exists) {
      this.state.spots = this.state.spots.filter((item) => item !== id);
    } else {
      this.state.spots = [id, ...this.state.spots];
    }
    this.persistLocal();
    this.notify();
    this.syncToServer('spot', id, !exists);
    return !exists;
  }

  public togglePlace(id: string): boolean {
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
    if (!items || items.length === 0) return;

    const itineraryIdsToRemove = new Set(
      items.filter((i) => i.type === 'itinerary').map((i) => i.id)
    );
    const spotIdsToRemove = new Set(
      items.filter((i) => i.type === 'spot').map((i) => i.id)
    );
    const placeIdsToRemove = new Set(
      items.filter((i) => i.type === 'place').map((i) => i.id)
    );

    this.state.itineraries = this.state.itineraries.filter((id) => !itineraryIdsToRemove.has(id));
    this.state.spots = this.state.spots.filter((id) => !spotIdsToRemove.has(id));
    this.state.places = this.state.places.filter((id) => !placeIdsToRemove.has(id));

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

  public async syncWithServer(): Promise<void> {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('monvian_token');
    if (!token || this.isSyncing) return;

    this.isSyncing = true;
    try {
      const res = await fetch('/api/user/favorites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.favorites) {
          const sItin = Array.isArray(data.favorites.itineraries) ? data.favorites.itineraries : [];
          const sSpots = Array.isArray(data.favorites.spots) ? data.favorites.spots : [];
          const sPlaces = Array.isArray(data.favorites.places) ? data.favorites.places : [];

          // Merge server with local without duplicate IDs
          this.state.itineraries = Array.from(new Set([...this.state.itineraries, ...sItin]));
          this.state.spots = Array.from(new Set([...this.state.spots, ...sSpots]));
          this.state.places = Array.from(new Set([...this.state.places, ...sPlaces]));

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
    if (!token) return;

    try {
      await fetch('/api/user/favorites/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ item_type: type, item_id: id, is_saved: isSaved }),
      });
    } catch (e) {
      // Offline fallback: changes already safely preserved in localStorage
    }
  }

  private async syncBatchRemoveToServer(items: Array<{ type: string; id: string }>) {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('monvian_token');
    if (!token) return;

    try {
      await fetch('/api/user/favorites/remove-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items }),
      });
    } catch (e) {}
  }
}

export const favoritesManager = new FavoritesManager();
