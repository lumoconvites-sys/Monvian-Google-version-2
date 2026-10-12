import { useState, useEffect } from 'react';
import { favoritesManager, SavedFavoritesState } from '../services/favoritesManager';

export function useFavorites() {
  const [state, setState] = useState<SavedFavoritesState>(() => favoritesManager.getState());

  useEffect(() => {
    // Initial sync with server if logged in
    favoritesManager.syncWithServer();

    const unsubscribe = favoritesManager.subscribe(() => {
      setState(favoritesManager.getState());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    savedItineraries: state.itineraries,
    savedSpots: state.spots,
    savedPlaces: state.places,
    isItinerarySaved: (id: string) => favoritesManager.isItinerarySaved(id),
    isSpotSaved: (id: string) => favoritesManager.isSpotSaved(id),
    isPlaceSaved: (id: string) => favoritesManager.isPlaceSaved(id),
    isSaved: (type: 'itinerary' | 'spot' | 'place', id: string) => favoritesManager.isSaved(type, id),
    isSpotOrPlaceSaved: (id: string) => favoritesManager.isSpotOrPlaceSaved(id),
    toggleItinerary: (id: string) => favoritesManager.toggleItinerary(id),
    toggleSpot: (id: string) => favoritesManager.toggleSpot(id),
    togglePlace: (id: string) => favoritesManager.togglePlace(id),
    toggleItem: (type: 'itinerary' | 'spot' | 'place', id: string) => favoritesManager.toggleItem(type, id),
    removeBatch: (items: Array<{ type: 'itinerary' | 'spot' | 'place'; id: string }>) => favoritesManager.removeBatch(items),
  };
}
