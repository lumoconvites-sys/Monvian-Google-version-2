// Persistent Favorites & Saved Items Service for Monvian (Airbnb-style Wishlists)
export interface SavedFavoritesState {
  itineraries: string[];
  spots: string[];
  places: string[]; // Stores "Removidos da lista" IDs (spots or itineraries removed from lists)
}

const STORAGE_KEYS = {
  ITINERARIES: 'monvian_saved_itineraries',
  LEGACY_ITINERARY_FAVS: 'monvian_itinerary_favs',
  SPOTS: 'monvian_saved_spots',
  PLACES: 'monvian_removed_items',
  LEGACY_PLACES: 'monvian_saved_places',
  LEGACY_FAVORITES: 'monvian_favorites',
};

const DEFAULT_INITIAL_FAVORITES: SavedFavoritesState = {
  itineraries: ['roteiro-classico-2-dias'],
  spots: ['itapeva', 'amantikir'],
  places: [],
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
    const savedItins = readStorageList(STORAGE_KEYS.ITINERARIES, DEFAULT_INITIAL_FAVORITES.itineraries);
    const legacyItinFavs = readStorageList(STORAGE_KEYS.LEGACY_ITINERARY_FAVS, []);
    const mergedItineraries = Array.from(new Set([...legacyItinFavs, ...savedItins]));

    const spots = readStorageList(STORAGE_KEYS.SPOTS, DEFAULT_INITIAL_FAVORITES.spots);
    const removedItems = readStorageList(STORAGE_KEYS.PLACES, DEFAULT_INITIAL_FAVORITES.places);

    // Persist merged itineraries if legacy favs existed
    if (legacyItinFavs.length > 0) {
      writeStorageList(STORAGE_KEYS.ITINERARIES, mergedItineraries);
      writeStorageList(STORAGE_KEYS.LEGACY_ITINERARY_FAVS, mergedItineraries);
    }

    return {
      itineraries: mergedItineraries,
      spots: Array.from(new Set(spots)),
      places: Array.from(new Set(removedItems)),
    };
  }

  private handleStorageEvent = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEYS.ITINERARIES ||
      e.key === STORAGE_KEYS.LEGACY_ITINERARY_FAVS ||
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
    writeStorageList(STORAGE_KEYS.LEGACY_FAVORITES, this.state.spots);
    writeStorageList(STORAGE_KEYS.LEGACY_ITINERARY_FAVS, this.state.itineraries);
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
    return [...this.state.spots];
  }

  public toggleFavorite(id: string): boolean {
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
    return this.isSpotSaved(id);
  }

  public addRemovedItem(id: string): void {
    if (!id) return;
    if (!this.state.places.includes(id)) {
      this.state.places = [id, ...this.state.places];
      this.persistLocal();
      this.notify();
      this.syncToServer('place', id, true);
    }
  }

  public toggleItinerary(id: string): boolean {
    const exists = this.state.itineraries.includes(id);
    if (exists) {
      this.state.itineraries = this.state.itineraries.filter((item) => item !== id);
      if (!this.state.places.includes(id)) {
        this.state.places = [id, ...this.state.places];
      }
    } else {
      this.state.itineraries = [id, ...this.state.itineraries];
      this.state.places = this.state.places.filter((item) => item !== id);
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
      if (!this.state.places.includes(id)) {
        this.state.places = [id, ...this.state.places];
      }
    } else {
      this.state.spots = [id, ...this.state.spots];
      this.state.places = this.state.places.filter((item) => item !== id);
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

          this.state.itineraries = Array.from(new Set([...this.state.itineraries, ...sItin]));
          this.state.spots = Array.from(new Set([...this.state.spots, ...sSpots]));

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
