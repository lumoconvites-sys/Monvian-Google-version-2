import { gpsNavigationManager } from './gpsNavigation';

export interface ActiveMapRoute {
  spotId: string;
  spotName: string;
  origin: [number, number]; // [lng, lat] user GPS
  originSnapped: [number, number]; // [lng, lat] nearest road access
  destination: [number, number]; // [lng, lat] establishment
  destinationSnapped: [number, number]; // [lng, lat] nearest road access
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  provider?: 'mapbox' | 'osrm';
  updatedAt: number;
  fitRevision: number;
}

export class RouteError extends Error {
  code: string;
  constructor(message: string, code: string = 'ROUTE_ERROR') {
    super(message);
    this.name = 'RouteError';
    this.code = code;
  }
}

export const getClientMapboxToken = (): string => {
  try {
    return (
      (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string) ||
      localStorage.getItem('monvian_mapbox_token') ||
      ''
    ).trim();
  } catch {
    return '';
  }
};

/**
 * Synchronously starts/checks GPS in the caller's click gesture tick and resolves
 * once a real device fix is available, or rejects with an informative message.
 */
export function acquireUserGpsForRoute(timeoutMs: number = 8000): Promise<[number, number]> {
  const current = gpsNavigationManager.getState();

  if (
    current.hasRealFix &&
    current.status === 'granted' &&
    Array.isArray(current.coords) &&
    Number.isFinite(current.coords[0]) &&
    Number.isFinite(current.coords[1])
  ) {
    // Refresh quietly if the last fix is > 5 seconds old while returning immediately
    if (Date.now() - (current.lastFixTime || 0) > 5000) {
      gpsNavigationManager.refreshPositionNow();
    }
    const coords = gpsNavigationManager.getCurrentInterpolatedCoords() || current.coords;
    return Promise.resolve([coords[0], coords[1]]);
  }

  // Trigger OS/browser geolocation synchronously inside the user tap gesture
  gpsNavigationManager.requestPermissionAndStartFromGesture();

  return new Promise<[number, number]>((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    let timerId: number | null = null;

    const cleanup = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch {}
        unsubscribe = null;
      }
    };

    timerId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new RouteError(
          'Não foi possível obter sua localização GPS no momento.',
          'GPS_TIMEOUT'
        )
      );
    }, timeoutMs);

    unsubscribe = gpsNavigationManager.subscribe((navState) => {
      if (settled) return;

      if (navState.status === 'denied') {
        settled = true;
        cleanup();
        reject(
          new RouteError(
            'Ative a permissão de localização para traçar a rota.',
            'PERMISSION_DENIED'
          )
        );
        return;
      }

      if (
        navState.hasRealFix &&
        navState.status === 'granted' &&
        Array.isArray(navState.coords) &&
        Number.isFinite(navState.coords[0]) &&
        Number.isFinite(navState.coords[1])
      ) {
        settled = true;
        cleanup();
        resolve([navState.coords[0], navState.coords[1]]);
      }
    });
  });
}

export async function fetchRealRoadRoute(params: {
  spotId: string;
  spotName: string;
  origin: [number, number];
  destination: [number, number];
  fitRevision?: number;
  signal?: AbortSignal;
}): Promise<ActiveMapRoute> {
  const { spotId, spotName, origin, destination, fitRevision = 1, signal } = params;
  const clientToken = getClientMapboxToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (clientToken) {
    headers['x-mapbox-token'] = clientToken;
  }

  let res: Response;
  try {
    res = await fetch('/api/mapbox/directions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        origin,
        destination,
        profile: 'driving',
      }),
      signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    throw new RouteError(
      'Não foi possível conectar ao serviço de rotas. Tente novamente.',
      'NETWORK_ERROR'
    );
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new RouteError('Resposta inválida do serviço de rotas.', 'INVALID_RESPONSE');
  }

  if (!res.ok || !data?.success || !data?.geometry?.coordinates?.length) {
    throw new RouteError(
      data?.error || 'Não há rota viária disponível para este destino.',
      data?.code || 'NO_ROUTE'
    );
  }

  return {
    spotId,
    spotName,
    origin,
    originSnapped:
      Array.isArray(data.originSnapped) && data.originSnapped.length === 2
        ? [Number(data.originSnapped[0]), Number(data.originSnapped[1])]
        : origin,
    destination,
    destinationSnapped:
      Array.isArray(data.destinationSnapped) && data.destinationSnapped.length === 2
        ? [Number(data.destinationSnapped[0]), Number(data.destinationSnapped[1])]
        : destination,
    geometry: data.geometry as GeoJSON.LineString,
    distanceMeters: Number(data.distanceMeters) || 0,
    durationSeconds: Number(data.durationSeconds) || 0,
    provider: data.provider === 'mapbox' ? 'mapbox' : 'osrm',
    updatedAt: Date.now(),
    fitRevision,
  };
}
