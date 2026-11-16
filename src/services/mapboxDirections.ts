import { gpsNavigationManager } from './gpsNavigation';

export interface ActiveMapRoute {
  spotId: string;
  spotName: string;
  origin: [number, number]; // [lng, lat]
  destination: [number, number]; // [lng, lat]
  originSnapped?: [number, number];
  destinationSnapped?: [number, number];
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  fitRevision: number;
  updatedAt: number;
}

export interface FetchRealRoadRouteParams {
  spotId: string;
  spotName: string;
  origin: [number, number];
  destination: [number, number];
  fitRevision: number;
  signal?: AbortSignal;
}

function getMapboxAccessToken(): string {
  try {
    const envToken = (import.meta as any).env?.VITE_MAPBOX_ACCESS_TOKEN;
    if (typeof envToken === 'string' && envToken.trim().startsWith('pk.')) {
      return envToken.trim();
    }
  } catch {}

  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('monvian_mapbox_token');
      if (stored && stored.trim().startsWith('pk.')) {
        return stored.trim();
      }
    }
  } catch {}

  return '';
}

function haversineMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function acquireUserGpsForRoute(
  timeoutMs: number = 8000
): Promise<[number, number]> {
  const navState = gpsNavigationManager.getState();
  if (
    navState.hasRealFix &&
    Array.isArray(navState.coords) &&
    Number.isFinite(navState.coords[0]) &&
    Number.isFinite(navState.coords[1])
  ) {
    return [navState.coords[0], navState.coords[1]];
  }

  try {
    gpsNavigationManager.requestPermissionAndStartFromGesture();
  } catch {}

  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 15000,
        });
      });
      const lng = Number(pos.coords.longitude);
      const lat = Number(pos.coords.latitude);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return [lng, lat];
      }
    } catch {}
  }

  const fallback = gpsNavigationManager.getState().coords;
  if (
    Array.isArray(fallback) &&
    Number.isFinite(fallback[0]) &&
    Number.isFinite(fallback[1])
  ) {
    return [fallback[0], fallback[1]];
  }

  // Campos do Jordão Capivari center fallback
  return [-45.5914, -22.7192];
}

export async function fetchRealRoadRoute(
  params: FetchRealRoadRouteParams
): Promise<ActiveMapRoute> {
  const { spotId, spotName, origin, destination, fitRevision, signal } = params;
  const [oLng, oLat] = origin;
  const [dLng, dLat] = destination;

  const mapboxToken = getMapboxAccessToken();

  // 1. Try Mapbox Directions API if access token is configured
  if (mapboxToken) {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${oLng},${oLat};${dLng},${dLat}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(
        mapboxToken
      )}`;
      const res = await fetch(url, { signal });
      if (res.ok) {
        const data = await res.json();
        const route = data?.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          const waypoints = data?.waypoints;
          const originSnapped: [number, number] =
            Array.isArray(waypoints?.[0]?.location) &&
            waypoints[0].location.length >= 2
              ? [Number(waypoints[0].location[0]), Number(waypoints[0].location[1])]
              : [Number(coords[0][0]), Number(coords[0][1])];
          const destSnapped: [number, number] =
            Array.isArray(waypoints?.[1]?.location) &&
            waypoints[1].location.length >= 2
              ? [Number(waypoints[1].location[0]), Number(waypoints[1].location[1])]
              : [
                  Number(coords[coords.length - 1][0]),
                  Number(coords[coords.length - 1][1]),
                ];

          return {
            spotId,
            spotName,
            origin,
            destination,
            originSnapped,
            destinationSnapped: destSnapped,
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            distanceMeters: Number(route.distance) || haversineMeters(oLng, oLat, dLng, dLat),
            durationSeconds: Number(route.duration) || 180,
            fitRevision,
            updatedAt: Date.now(),
          };
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        throw err;
      }
    }
  }

  // 2. Fallback to OSRM public road routing service (real street geometry)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, { signal });
    if (res.ok) {
      const data = await res.json();
      const route = data?.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const waypoints = data?.waypoints;
        const originSnapped: [number, number] =
          Array.isArray(waypoints?.[0]?.location) &&
          waypoints[0].location.length >= 2
            ? [Number(waypoints[0].location[0]), Number(waypoints[0].location[1])]
            : [Number(coords[0][0]), Number(coords[0][1])];
        const destSnapped: [number, number] =
          Array.isArray(waypoints?.[1]?.location) &&
          waypoints[1].location.length >= 2
            ? [Number(waypoints[1].location[0]), Number(waypoints[1].location[1])]
            : [
                Number(coords[coords.length - 1][0]),
                Number(coords[coords.length - 1][1]),
              ];

        return {
          spotId,
          spotName,
          origin,
          destination,
          originSnapped,
          destinationSnapped: destSnapped,
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
          distanceMeters: Number(route.distance) || haversineMeters(oLng, oLat, dLng, dLat),
          durationSeconds: Number(route.duration) || 180,
          fitRevision,
          updatedAt: Date.now(),
        };
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      throw err;
    }
  }

  // 3. Graceful direct line fallback if offline
  const dist = haversineMeters(oLng, oLat, dLng, dLat);
  return {
    spotId,
    spotName,
    origin,
    destination,
    originSnapped: origin,
    destinationSnapped: destination,
    geometry: {
      type: 'LineString',
      coordinates: [origin, destination],
    },
    distanceMeters: dist,
    durationSeconds: Math.max(60, Math.round(dist / 8.5)),
    fitRevision,
    updatedAt: Date.now(),
  };
}
