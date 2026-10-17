import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Spot, MapModeType } from '../types';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { generateMarkerHtml } from '../utils/mapVisualIcons';

export type { MapModeType };

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

    // Esri World Dark Gray Base
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'esri-dark': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri &copy; OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'esri-dark-layer',
          type: 'raster',
          source: 'esri-dark',
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    };
  }

  // 3. Light / Standard Streets Mode
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

  // Esri World Street Map (Apple-style Streets & POIs, watermark-free)
  return {
    version: 8,
    projection: { type: 'globe' } as any,
    sources: {
      'esri-street': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '&copy; Esri &copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'esri-street-layer',
        type: 'raster',
        source: 'esri-street',
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
      visualIcons = [],
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
        const isMobile = window.innerWidth < 768;
        const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
        mapRef.current.easeTo({
          center: [spot.lng, spot.lat],
          zoom: 15.5,
          pitch: is3DMode ? 52 : 35,
          bearing: is3DMode ? -15 : 0,
          offset: [0, verticalOffset],
          duration: 750,
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

    const markerRecordsRef = useRef<{
      spotId: string;
      marker: maplibregl.Marker;
      el: HTMLDivElement;
      containerEl: HTMLDivElement;
      badgeEl: HTMLDivElement;
      arrowEl: HTMLDivElement;
      pulseEl: HTMLDivElement;
    }[]>([]);

    // Synchronize marker highlights smoothly
    const syncMarkerHighlight = useCallback((activeSpotId: string | null | undefined) => {
      markerRecordsRef.current.forEach((rec) => {
        const isSelected = activeSpotId ? rec.spotId === activeSpotId : false;
        rec.containerEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        rec.containerEl.style.transform = isSelected ? 'scale(1.25)' : 'scale(0.96)';
        rec.containerEl.style.zIndex = isSelected ? '50' : '20';

        // Pin com borda branca e sombra suave igual a segunda foto (IMG_8419.png)
        rec.badgeEl.style.border = isSelected
          ? '3px solid #FFFFFF'
          : '2.5px solid #FFFFFF';
        rec.badgeEl.style.boxShadow = isSelected
          ? '0 6px 22px rgba(0, 0, 0, 0.45), 0 0 0 2px rgba(255, 255, 255, 0.95)'
          : '0 3px 10px rgba(0, 0, 0, 0.35)';

        rec.arrowEl.style.background = '#FFFFFF';
        rec.arrowEl.style.borderRight = isSelected
          ? '3px solid #FFFFFF'
          : '2.5px solid #FFFFFF';
        rec.arrowEl.style.borderBottom = isSelected
          ? '3px solid #FFFFFF'
          : '2.5px solid #FFFFFF';

        if (rec.pulseEl) {
          rec.pulseEl.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
          rec.pulseEl.style.display = isSelected ? 'block' : 'none';
        }
      });
    }, []);

    // Update spot markers on the map
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      // Clear existing markers
      markerRecordsRef.current.forEach((rec) => {
        try {
          rec.marker.remove();
        } catch (e) {}
      });
      markerRecordsRef.current = [];

      spots.forEach((spot, spotIdx) => {
        if (!spot.lng || !spot.lat) return;

        const isSelected = selectedSpot?.id === spot.id;
        const imgUrl = getSpotImage(spot);

        const el = document.createElement('div');
        el.className = 'monvian-explore-marker group cursor-pointer select-none';

        const containerEl = document.createElement('div');
        containerEl.style.position = 'relative';
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.alignItems = 'center';
        containerEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        containerEl.style.transform = isSelected ? 'scale(1.25)' : 'scale(0.96)';
        containerEl.style.zIndex = isSelected ? '50' : '20';

        // Spring entrance animation when appearing on map
        try {
          containerEl.animate([
            { transform: 'scale(0) translateY(12px)', opacity: 0 },
            { transform: 'scale(1.2) translateY(-2px)', opacity: 1, offset: 0.68 },
            { transform: isSelected ? 'scale(1.25) translateY(0px)' : 'scale(0.96) translateY(0px)', opacity: 1 }
          ], {
            duration: 420 + (spotIdx % 10) * 35,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            fill: 'both'
          });
        } catch (e) {}

        // Glowing circular translucent aura/halo (white aura)
        const pulseEl = document.createElement('div');
        pulseEl.style.position = 'absolute';
        pulseEl.style.width = '68px';
        pulseEl.style.height = '68px';
        pulseEl.style.borderRadius = '9999px';
        pulseEl.style.top = '-14px';
        pulseEl.style.left = '-14px';
        pulseEl.style.pointerEvents = 'none';
        pulseEl.style.zIndex = '-1';
        pulseEl.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
        pulseEl.style.display = isSelected ? 'block' : 'none';

        // Pin Circular Badge (Círculo arredondado com borda branca e foto do ponto turístico perfeitamente enquadrada)
        const badgeEl = document.createElement('div');
        badgeEl.style.width = '42px';
        badgeEl.style.height = '42px';
        badgeEl.style.borderRadius = '9999px';
        badgeEl.style.overflow = 'hidden';
        badgeEl.style.display = 'flex';
        badgeEl.style.alignItems = 'center';
        badgeEl.style.justifyContent = 'center';
        badgeEl.style.backgroundColor = '#18181B';
        badgeEl.style.border = isSelected ? '3px solid #FFFFFF' : '2.5px solid #FFFFFF';
        badgeEl.style.boxShadow = isSelected
          ? '0 6px 22px rgba(0, 0, 0, 0.45), 0 0 0 2px rgba(255, 255, 255, 0.95)'
          : '0 3px 10px rgba(0, 0, 0, 0.35)';

        // Foto do ponto turístico cadastrado
        const imgEl = document.createElement('img');
        imgEl.src = imgUrl;
        imgEl.alt = spot.name || 'Ponto Turístico';
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        imgEl.style.objectFit = 'cover';
        imgEl.style.objectPosition = 'center';
        imgEl.style.borderRadius = '9999px';
        imgEl.style.display = 'block';
        imgEl.style.pointerEvents = 'none';
        imgEl.referrerPolicy = 'no-referrer';
        imgEl.onerror = () => {
          imgEl.src = getSpotFallbackImage(spot.name, spot.category);
        };
        badgeEl.appendChild(imgEl);

        // Pin downward arrow pointer
        const arrowEl = document.createElement('div');
        arrowEl.style.width = '7px';
        arrowEl.style.height = '7px';
        arrowEl.style.transform = 'rotate(45deg)';
        arrowEl.style.marginTop = '-3.5px';
        arrowEl.style.background = '#FFFFFF';
        arrowEl.style.borderRight = isSelected ? '3px solid #FFFFFF' : '2.5px solid #FFFFFF';
        arrowEl.style.borderBottom = isSelected ? '3px solid #FFFFFF' : '2.5px solid #FFFFFF';
        arrowEl.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

        containerEl.appendChild(pulseEl);
        containerEl.appendChild(badgeEl);
        containerEl.appendChild(arrowEl);
        el.appendChild(containerEl);

        const animateToSpot = (targetSpot: Spot) => {
          onSelectSpot(targetSpot);
          if (mapRef.current && targetSpot.lng && targetSpot.lat) {
            const isMobile = window.innerWidth < 768;
            const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
            mapRef.current.easeTo({
              center: [targetSpot.lng, targetSpot.lat],
              zoom: 15.5,
              pitch: is3DMode ? 52 : 35,
              bearing: is3DMode ? -15 : 0,
              offset: [0, verticalOffset],
              duration: 700,
            });
          }
        };

        el.onclick = (e) => {
          e.stopPropagation();
          // Native spring scale bounce feedback on click
          try {
            containerEl.animate([
              { transform: 'scale(0.85)' },
              { transform: 'scale(1.38)', offset: 0.6 },
              { transform: 'scale(1.25)' }
            ], {
              duration: 380,
              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            });
          } catch (err) {}
          animateToSpot(spot);
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([spot.lng, spot.lat])
          .addTo(map);

        markerRecordsRef.current.push({
          spotId: spot.id,
          marker,
          el,
          containerEl,
          badgeEl,
          arrowEl,
          pulseEl,
        });
      });

      syncMarkerHighlight(selectedSpot?.id);
    }, [spots, syncMarkerHighlight]);

    // Update marker highlight and camera zoom when selectedSpot changes
    useEffect(() => {
      syncMarkerHighlight(selectedSpot?.id);

      if (!mapRef.current || !selectedSpot?.lng || !selectedSpot?.lat) return;

      const isMobile = window.innerWidth < 768;
      const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;

      mapRef.current.easeTo({
        center: [selectedSpot.lng, selectedSpot.lat],
        zoom: 15.5,
        pitch: is3DMode ? 52 : 35,
        bearing: is3DMode ? -15 : 0,
        offset: [0, verticalOffset],
        duration: 750,
      });
    }, [selectedSpot, syncMarkerHighlight, is3DMode]);

    // Render static visual map icons (Gas stations, Churches, Hospitals, Parks, etc.) with spring pop animations
    const visualIconMarkersRef = useRef<maplibregl.Marker[]>([]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      // Clear previous visual icon markers
      visualIconMarkersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch (e) {}
      });
      visualIconMarkersRef.current = [];

      if (!visualIcons || !Array.isArray(visualIcons) || visualIcons.length === 0) return;

      visualIcons.forEach((item, iconIdx) => {
        if (!item.latitude || !item.longitude) return;
        if (item.is_active === 0 || item.is_active === false) return;

        const el = document.createElement('div');
        el.className = 'monvian-visual-icon-pin select-none z-10';
        el.style.pointerEvents = 'auto';
        el.style.userSelect = 'none';
        el.style.webkitUserSelect = 'none';
        el.style.cursor = 'pointer';

        el.innerHTML = generateMarkerHtml(item.category, 26, item.color);

        // Spring scale pop-in animation on entrance
        try {
          el.animate([
            { transform: 'scale(0)', opacity: 0 },
            { transform: 'scale(1.28)', opacity: 1, offset: 0.68 },
            { transform: 'scale(1)', opacity: 1 }
          ], {
            duration: 380 + (iconIdx % 12) * 30,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            fill: 'both'
          });
        } catch (e) {}

        // Spring scale bounce feedback on tap/click
        el.onclick = (e) => {
          e.stopPropagation();
          try {
            el.animate([
              { transform: 'scale(0.82)' },
              { transform: 'scale(1.35)', offset: 0.6 },
              { transform: 'scale(1)' }
            ], {
              duration: 360,
              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            });
          } catch (err) {}
        };

        const marker = new maplibregl.Marker({
          element: el,
        })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map);

        visualIconMarkersRef.current.push(marker);
      });
    }, [visualIcons]);

    return (
      <div
        ref={mapContainerRef}
        className="w-full h-full absolute inset-0 select-none"
      />
    );
  }
);
