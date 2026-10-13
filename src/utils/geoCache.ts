/**
 * Geographic Caching and Preloading Utility for Monvian Maps
 * Center: Campos do Jordão [-45.5870, -22.7355]
 * Radius: 40 km
 */

export const CAMPOS_JORDAO_CENTER: [number, number] = [-45.5870, -22.7355]; // [longitude, latitude]
export const DEFAULT_RADIUS_KM = 40;

// In-memory cache for geographic data
const geoMemoryCache = new Map<string, any>();

/**
 * Calculates the great-circle distance between two [longitude, latitude] points in kilometers using Haversine formula.
 */
export function calculateDistanceKm(coord1: [number, number], coord2: [number, number]): number {
  if (!coord1 || !coord2 || coord1.length < 2 || coord2.length < 2) return 0;
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a given coordinate is within the specified radius (default 40 km) from Campos do Jordão.
 */
export function isWithinCamposRadius(center: [number, number], radiusKm: number = DEFAULT_RADIUS_KM): boolean {
  const distance = calculateDistanceKm(center, CAMPOS_JORDAO_CENTER);
  return distance <= radiusKm;
}

/**
 * Retrieves cached geographic data for a key.
 */
export function getCachedGeoData<T>(key: string): T | null {
  if (geoMemoryCache.has(key)) {
    return geoMemoryCache.get(key) as T;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`monvian_geocache_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        geoMemoryCache.set(key, parsed);
        return parsed as T;
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Stores geographic data in memory and persistent storage.
 */
export function setCachedGeoData<T>(key: string, data: T): void {
  geoMemoryCache.set(key, data);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`monvian_geocache_${key}`, JSON.stringify(data));
    } catch (_) {}
  }
}

/**
 * Initializes geographic cache preloading for Campos do Jordão (40 km radius) on app startup.
 */
export function initGeoCachePreload(spotsData: any[]): void {
  if (typeof window === 'undefined') return;
  
  // Cache initial spots within 40km radius
  const validSpots = spotsData.filter(spot => {
    if (typeof spot.lng === 'number' && typeof spot.lat === 'number') {
      return isWithinCamposRadius([spot.lng, spot.lat], DEFAULT_RADIUS_KM);
    }
    if (Array.isArray(spot.coordinates) && spot.coordinates.length >= 2) {
      return isWithinCamposRadius(spot.coordinates as [number, number], DEFAULT_RADIUS_KM);
    }
    return true; // default include if no coords
  });

  setCachedGeoData('campos_spots_40km', validSpots);
  setCachedGeoData('last_loaded_center', CAMPOS_JORDAO_CENTER);
  setCachedGeoData('last_loaded_timestamp', Date.now());
}
