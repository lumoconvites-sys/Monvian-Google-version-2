import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Spot } from '../types';
import { getSpotImage } from '../utils/spotImages';

export type MapModeType = 'explorar' | 'satelite' | 'escuro';

export interface MapComponentHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetNorth: () => void;
  toggleMapMode: () => MapModeType;
  setMapMode: (mode: MapModeType) => void;
  flyToSpot: (spot: Spot) => void;
  recenter: () => void;
}

interface MapComponentProps {
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  onMapClick?: () => void;
  userCoords?: [number, number] | { lat: number; lng: number } | null;
  theme: 'dark' | 'light';
  visualIcons?: any[];
  userAvatar?: string;
  userName?: string;
  highContrast?: boolean;
  onMapLoad?: () => void;
  is3DMode?: boolean;
  isDetailOpen?: boolean;
  mapMode?: MapModeType;
  onMapModeChange?: (mode: MapModeType) => void;
  onInteractionChange?: (isInteracting: boolean) => void;
  zoomToUserTrigger?: number;
  onStyleChange?: (style: any) => void;
  onOrbitChange?: (isOrbiting: boolean) => void;
}

const getMapboxToken = (): string => {
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

const getVectorMapStyle = (
  mode: MapModeType,
  theme: 'dark' | 'light'
): maplibregl.StyleSpecification => {
  const token = getMapboxToken();

  // 1. Satellite Mode
  if (mode === 'satelite') {
    if (token) {
      return {
        version: 8,
        projection: { type: 'globe' } as any,
        sources: {
          'mapbox-sat': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
            ],
            tileSize: 256,
            attribution: '&copy; Mapbox &copy; OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'mapbox-sat-layer',
            type: 'raster',
            source: 'mapbox-sat',
            minzoom: 0,
            maxzoom: 22,
            paint: {
              'raster-brightness-min': 0.18,
              'raster-brightness-max': 1.0,
              'raster-contrast': 0.15,
              'raster-saturation': 0.2,
            },
          },
        ],
      };
    }

    // High-Resolution Esri World Imagery + Reference Labels (Boundaries, Roads & Places)
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'esri-sat': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar',
        },
        'esri-ref': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri',
        },
      },
      layers: [
        {
          id: 'esri-sat-layer',
          type: 'raster',
          source: 'esri-sat',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-brightness-min': 0.2,
            'raster-brightness-max': 1.0,
            'raster-contrast': 0.15,
            'raster-saturation': 0.22,
          },
        },
        {
          id: 'esri-ref-layer',
          type: 'raster',
          source: 'esri-ref',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-opacity': 0.95,
          },
        },
      ],
    };
  }

  // 2. Dark Mode
  const effectiveTheme = mode === 'escuro' ? 'dark' : theme;
  if (effectiveTheme === 'dark') {
    if (token) {
      return {
        version: 8,
        projection: { type: 'globe' } as any,
        sources: {
          'mapbox-dark': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
            ],
            tileSize: 256,
            attribution: '&copy; Mapbox &copy; OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'mapbox-dark-layer',
            type: 'raster',
            source: 'mapbox-dark',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      };
    }

    // CARTO Dark Matter Retina @2x
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
            'https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          attribution: '&copy; CARTO &copy; OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    };
  }

  // 3. Light / Standard Streets Mode (Exact visual match to Image 2!)
  if (token) {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'mapbox-streets': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
          ],
          tileSize: 256,
          attribution: '&copy; Mapbox &copy; OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'mapbox-streets-layer',
          type: 'raster',
          source: 'mapbox-streets',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }

  // CARTO Voyager Retina @2x (Apple Maps Style with pastel green parks, crisp roads & POIs)
  return {
    version: 8,
    projection: { type: 'globe' } as any,
    sources: {
      'carto-voyager': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'carto-voyager-layer',
        type: 'raster',
        source: 'carto-voyager',
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
};

export const MapComponent = forwardRef<MapComponentHandle, MapComponentProps>(
  (
    {
      spots,
      selectedSpot,
      onSelectSpot,
      onMapClick,
      theme,
      is3DMode = false,
      mapMode = 'explorar',
      onMapModeChange,
      onMapLoad,
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    const [currentMode, setCurrentMode] = useState<MapModeType>(mapMode);

    // Campos do Jordão Center Coordinates
    const CAMPOS_CENTER: [number, number] = [-45.5908, -22.7394];

    // Expose map controls for external iOS floating buttons
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        mapRef.current?.zoomIn({ duration: 300 });
      },
      zoomOut: () => {
        mapRef.current?.zoomOut({ duration: 300 });
      },
      resetNorth: () => {
        mapRef.current?.easeTo({
          bearing: 0,
          pitch: 0,
          duration: 600,
        });
      },
      setMapMode: (mode: MapModeType) => {
        setCurrentMode(mode);
        if (onMapModeChange) onMapModeChange(mode);
      },
      getMapMode: () => currentMode,
      toggleMapMode: () => {
        const next: MapModeType =
          currentMode === 'explorar'
            ? 'satelite'
            : currentMode === 'satelite'
            ? 'escuro'
            : 'explorar';
        setCurrentMode(next);
        if (onMapModeChange) onMapModeChange(next);
        return next;
      },
      flyToSpot: (spot: Spot) => {
        if (!spot.lng || !spot.lat || !mapRef.current) return;
        mapRef.current.flyTo({
          center: [spot.lng, spot.lat],
          zoom: 15.5,
          pitch: is3DMode ? 50 : 0,
          duration: 900,
        });
      },
      recenter: () => {
        mapRef.current?.flyTo({
          center: CAMPOS_CENTER,
          zoom: 13,
          bearing: 0,
          pitch: is3DMode ? 45 : 0,
          duration: 800,
        });
      },
    }));

    // Synchronize mode from prop if provided
    useEffect(() => {
      if (mapMode && mapMode !== currentMode) {
        setCurrentMode(mapMode);
      }
    }, [mapMode]);

    // Initialize or swap map style
    useEffect(() => {
      if (!mapContainerRef.current) return;

      const style = getVectorMapStyle(currentMode, theme);

      if (!mapRef.current) {
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: style,
          center: CAMPOS_CENTER,
          zoom: 13,
          pitch: is3DMode ? 50 : 0,
          bearing: is3DMode ? -20 : 0,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on('click', () => {
          if (onMapClick) onMapClick();
        });

        map.on('load', () => {
          if (onMapLoad) onMapLoad();
        });
      } else {
        mapRef.current.setStyle(style);
      }
    }, [currentMode, theme]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }, []);

    // Update 3D mode pitch/bearing smoothly
    useEffect(() => {
      if (!mapRef.current) return;
      mapRef.current.easeTo({
        pitch: is3DMode ? 50 : 0,
        bearing: is3DMode ? -20 : 0,
        duration: 900,
      });
    }, [is3DMode]);

    // Update spot markers on the map
    useEffect(() => {
      if (!mapRef.current) return;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      spots.forEach((spot) => {
        if (!spot.lng || !spot.lat) return;

        const isSelected = selectedSpot?.id === spot.id;
        const imgUrl = getSpotImage(spot);

        const el = document.createElement('div');
        el.className = `cursor-pointer transition-all duration-300 transform select-none ${
          isSelected ? 'scale-125 z-40' : 'hover:scale-110 z-20'
        }`;

        // Circular Apple Maps photo marker with border and pin tail (as in Image 2)
        el.innerHTML = `
          <div class="relative flex flex-col items-center group">
            <div class="w-10 h-10 rounded-full border-2 ${
              isSelected
                ? 'border-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.85)] ring-2 ring-blue-400/50'
                : 'border-white dark:border-zinc-800 shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
            } bg-zinc-900 overflow-hidden flex items-center justify-center transition-transform">
              ${
                imgUrl
                  ? `<img src="${imgUrl}" alt="${spot.name}" class="w-full h-full object-cover pointer-events-none" />`
                  : `<span class="text-sm">📍</span>`
              }
            </div>
            <div class="w-2 h-2 -mt-1 rotate-45 ${
              isSelected ? 'bg-blue-500' : 'bg-white dark:bg-zinc-800'
            } shadow-xs"></div>
          </div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectSpot(spot);
          mapRef.current?.flyTo({
            center: [spot.lng, spot.lat],
            zoom: 15.5,
            duration: 800,
          });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([spot.lng, spot.lat])
          .addTo(mapRef.current!);

        markersRef.current.push(marker);
      });
    }, [spots, selectedSpot]);

    // Fly to spot when selected
    useEffect(() => {
      if (!mapRef.current || !selectedSpot?.lng || !selectedSpot?.lat) return;
      mapRef.current.flyTo({
        center: [selectedSpot.lng, selectedSpot.lat],
        zoom: 15.5,
        pitch: is3DMode ? 50 : 0,
        duration: 800,
      });
    }, [selectedSpot]);

    return (
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute inset-0 select-none"
      />
    );
  }
);
