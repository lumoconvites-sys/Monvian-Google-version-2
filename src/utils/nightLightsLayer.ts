import * as maplibregl from 'maplibre-gl';
import { generateNightLightsGeoJSON } from './nightLightsData';

const NIGHT_LIGHTS_SOURCE_ID = 'monvian-night-lights-source';
const LAYER_AMBIENT_GLOW = 'monvian-night-lights-glow';
const LAYER_CORE_POINTS = 'monvian-night-lights-core';
const LAYER_FINE_POINTS = 'monvian-night-lights-fine';

// Cached GeoJSON to avoid regenerating features on every map style switch
let cachedGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> | null = null;

function getNightLightsData() {
  if (!cachedGeoJSON) {
    cachedGeoJSON = generateNightLightsGeoJSON();
  }
  return cachedGeoJSON;
}

/**
 * Inserts the authentic geographic night lights layer into a MapLibre Map instance.
 * Renders high-performance WebGL points directly into the map canvas with dynamic zoom scaling.
 */
export function setupNightLights(map: maplibregl.Map, theme: 'dark' | 'light' = 'dark') {
  if (!map || !map.getStyle()) return;

  // Remove existing layers if present
  removeNightLights(map);

  // Night lights are only rendered in night/dark mode
  if (theme !== 'dark') return;

  const data = getNightLightsData();

  try {
    if (!map.getSource(NIGHT_LIGHTS_SOURCE_ID)) {
      map.addSource(NIGHT_LIGHTS_SOURCE_ID, {
        type: 'geojson',
        data,
      });
    }

    // 1. Soft Ambient City Glow Layer (Atmospheric optical halo over urban clusters)
    if (!map.getLayer(LAYER_AMBIENT_GLOW)) {
      map.addLayer({
        id: LAYER_AMBIENT_GLOW,
        type: 'circle',
        source: NIGHT_LIGHTS_SOURCE_ID,
        paint: {
          // Soft wide halo radius smoothly scaling with zoom
          'circle-radius': [
            'interpolate',
            ['exponential', 1.4],
            ['zoom'],
            2, 3.5,
            6, 7.0,
            10, 14.0,
            13, 20.0,
            15, 24.0,
          ],
          'circle-color': [
            'match',
            ['get', 'colorType'],
            'warm_gold', '#FFD269',
            'soft_amber', '#FFA940',
            'warm_white', '#FFF1B8',
            'incandescent', '#FFE58F',
            '#FFD269',
          ],
          'circle-blur': 0.85,
          // Fade out smoothly at street zoom (z > 14.5) to keep cartography pristine
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, ['*', ['get', 'intensity'], 0.22],
            6, ['*', ['get', 'intensity'], 0.26],
            10, ['*', ['get', 'intensity'], 0.24],
            13, ['*', ['get', 'intensity'], 0.14],
            14.5, ['*', ['get', 'intensity'], 0.05],
            15.5, 0.0,
          ],
        },
      });
    }

    // 2. Core Geographic Night Lights (Discrete golden points on urban centers)
    if (!map.getLayer(LAYER_CORE_POINTS)) {
      map.addLayer({
        id: LAYER_CORE_POINTS,
        type: 'circle',
        source: NIGHT_LIGHTS_SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, ['*', ['get', 'size'], 0.85],
            6, ['*', ['get', 'size'], 1.4],
            10, ['*', ['get', 'size'], 2.0],
            12.5, ['*', ['get', 'size'], 2.6],
            14.2, ['*', ['get', 'size'], 1.8],
            15.5, ['*', ['get', 'size'], 1.0],
          ],
          'circle-color': [
            'match',
            ['get', 'colorType'],
            'warm_gold', '#FFE082',
            'soft_amber', '#FFC107',
            'warm_white', '#FFF8E1',
            'incandescent', '#FFECB3',
            '#FFE082',
          ],
          'circle-blur': 0.22,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            2, ['*', ['get', 'intensity'], 0.75],
            5, ['*', ['get', 'intensity'], 0.90],
            10, ['*', ['get', 'intensity'], 0.92],
            12.5, ['*', ['get', 'intensity'], 0.75],
            14.5, ['*', ['get', 'intensity'], 0.25],
            15.5, 0.0,
          ],
        },
      });
    }

    // 3. Fine Neighborhood & Corridors (Revealed on intermediate zoom levels)
    if (!map.getLayer(LAYER_FINE_POINTS)) {
      map.addLayer({
        id: LAYER_FINE_POINTS,
        type: 'circle',
        source: NIGHT_LIGHTS_SOURCE_ID,
        filter: ['in', ['get', 'category'], ['literal', ['neighborhood', 'artery', 'rural_cluster']]],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, ['*', ['get', 'size'], 0.7],
            11, ['*', ['get', 'size'], 1.5],
            13, ['*', ['get', 'size'], 2.2],
            14.5, ['*', ['get', 'size'], 1.4],
            15.5, ['*', ['get', 'size'], 0.8],
          ],
          'circle-color': [
            'match',
            ['get', 'colorType'],
            'warm_gold', '#FFF2B2',
            'soft_amber', '#FFD56B',
            'warm_white', '#FFFFFF',
            'incandescent', '#FFE7A0',
            '#FFF2B2',
          ],
          'circle-blur': 0.15,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7.5, 0.0,
            9.0, ['*', ['get', 'intensity'], 0.45],
            11.5, ['*', ['get', 'intensity'], 0.88],
            13.5, ['*', ['get', 'intensity'], 0.70],
            14.8, ['*', ['get', 'intensity'], 0.18],
            15.8, 0.0,
          ],
        },
      });
    }
  } catch (err) {
    console.warn('[Monvian] Night lights layer setup note:', err);
  }
}

/**
 * Cleanly removes all night light layers and source from the map instance.
 */
export function removeNightLights(map: maplibregl.Map) {
  if (!map || !map.getStyle()) return;

  try {
    if (map.getLayer(LAYER_FINE_POINTS)) {
      map.removeLayer(LAYER_FINE_POINTS);
    }
    if (map.getLayer(LAYER_CORE_POINTS)) {
      map.removeLayer(LAYER_CORE_POINTS);
    }
    if (map.getLayer(LAYER_AMBIENT_GLOW)) {
      map.removeLayer(LAYER_AMBIENT_GLOW);
    }
    if (map.getSource(NIGHT_LIGHTS_SOURCE_ID)) {
      map.removeSource(NIGHT_LIGHTS_SOURCE_ID);
    }
  } catch (err) {
    // Ignore teardown errors during style transitions
  }
}
