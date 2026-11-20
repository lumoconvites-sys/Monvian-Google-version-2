import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

let workerConfigured = false;

export function ensureMaplibreWorkerConfigured(): void {
  if (workerConfigured || typeof window === 'undefined') return;
  workerConfigured = true;
  if (typeof maplibregl.setWorkerUrl === 'function' && maplibreWorkerUrl) {
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
  }
}

ensureMaplibreWorkerConfigured();
