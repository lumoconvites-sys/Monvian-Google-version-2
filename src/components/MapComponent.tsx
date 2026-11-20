import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Play } from 'lucide-react';
import { Spot, MapModeType, MapWorkflowMode, ItineraryStep } from '../types';
import { getSpotPinThumbnail, getSpotFallbackImage } from '../utils/spotImages';
import { gpsNavigationManager, calculateHaversineDistance } from '../services/gpsNavigation';
import { monvianXpManager } from '../services/xpService';
import { deviceHeadingManager } from '../utils/deviceHeading';
import { triggerHapticFeedback } from '../utils/haptics';
import {
  prefetchSpotClickSound,
  unlockSpotClickSound,
  playSpotClickSound,
} from '../utils/soundEffects';
import { CompassIcon } from './CompassIcon';
import { MapLayerToggleIcon } from './MapLayerToggleIcon';
import { ActiveMapRoute } from '../services/mapboxDirections';
import { fetchSpotsInViewport, GeoBounds } from '../services/supabaseSpots';

export type { MapModeType };

export interface MapComponentHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetNorth: () => void;
  toggleMapMode: () => MapModeType;
  setMapMode: (mode: MapModeType) => void;
  flyToSpot: (spot: Spot) => void;
  recenter: () => void;
  fitItineraryBounds: (steps?: ItineraryStep[], instant?: boolean) => void;
  focusItineraryStep: (step: ItineraryStep, isExpanded?: boolean) => void;
  fitSpotsOverview: () => void;
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
  isSpotlightActive?: boolean;
  isFocusMode?: boolean;
  activeTab?: string;
  isGlobeIntroPending?: boolean;
  isGlobeIntroPlaying?: boolean;
  onGlobeIntroComplete?: () => void;
  activeRoute?: ActiveMapRoute | null;
  isSuspended?: boolean;
  onViewportSpotsLoaded?: (spots: Spot[]) => void;
  workflowMode?: MapWorkflowMode;
  selectedSpotIdsForItinerary?: string[];
  onToggleSelectSpotForItinerary?: (spot: Spot) => void;
  onStartItineraryCreation?: () => void;
  itinerarySteps?: ItineraryStep[];
  activeItineraryStepId?: string | null;
  isItineraryExpanded?: boolean;
  onSelectItineraryStep?: (stepId: string) => void;
  zoomDurationMs?: number;
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

const getCleanSpaceSky = (theme: 'dark' | 'light'): maplibregl.SkySpecification => ({
  'sky-color': [
    'interpolate',
    ['linear'],
    ['zoom'],
    6.5,
    '#000000',
    9.2,
    theme === 'dark' ? '#0b0f17' : '#dce8f5',
  ],
  'horizon-color': [
    'interpolate',
    ['linear'],
    ['zoom'],
    6.5,
    '#000000',
    9.2,
    theme === 'dark' ? '#111827' : '#eef4fa',
  ],
  'fog-color': [
    'interpolate',
    ['linear'],
    ['zoom'],
    6.5,
    '#000000',
    9.2,
    theme === 'dark' ? '#0b0f17' : '#edf2f7',
  ],
  'sky-horizon-blend': ['interpolate', ['linear'], ['zoom'], 6.5, 0, 9.2, 0.55],
  'horizon-fog-blend': 0,
  'fog-ground-blend': 0,
  'atmosphere-blend': 0,
});

const getOrbitalEarthZoom = (): number => {
  if (typeof window === 'undefined') return 1.1;
  const minDim = Math.min(window.innerWidth || 375, window.innerHeight || 667);
  const targetDiameterPx = Math.max(245, Math.min(minDim * 0.76, 610));
  const computed = Math.log2(targetDiameterPx / 162.97);
  return Number(Math.max(0.55, Math.min(2.15, computed)).toFixed(2));
};

const getVectorMapStyle = (
  mode: MapModeType,
  theme: 'dark' | 'light',
  useGlobeProjection: boolean = false
): maplibregl.StyleSpecification => {
  const token = getMapboxToken();
  const mapProjection: maplibregl.ProjectionSpecification = {
    type: useGlobeProjection ? 'globe' : 'mercator',
  };
  const optionalSky = useGlobeProjection ? { sky: getCleanSpaceSky(theme) } : {};

  // 1. Satellite Mode
  if (mode === 'satelite') {
    if (token) {
      return {
        version: 8,
        projection: mapProjection,
        ...optionalSky,
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
              'raster-fade-duration': 0,
            },
          },
        ],
      };
    }

    // High-Resolution Esri World Imagery + Reference Labels (Boundaries, Roads & Places)
    return {
      version: 8,
      projection: mapProjection,
      ...optionalSky,
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
            'raster-fade-duration': 0,
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
            'raster-fade-duration': 0,
          },
        },
      ],
    };
  }

  // 2. Standard Streets / Dark Mode (consistent colors from global 3D Earth view down to Campos do Jordão)
  if (token) {
    const styleId = theme === 'dark' ? 'mapbox/dark-v11' : 'mapbox/streets-v12';
    return {
      version: 8,
      projection: mapProjection,
      ...optionalSky,
      sources: {
        'mapbox-tiles': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/${styleId}/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`,
          ],
          tileSize: 256,
          attribution: '&copy; Mapbox &copy; OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'mapbox-tiles-layer',
          type: 'raster',
          source: 'mapbox-tiles',
          minzoom: 0,
          maxzoom: 22,
          paint: {
            'raster-opacity': 1,
            'raster-saturation': theme === 'light' ? 0.15 : 0,
            'raster-fade-duration': 0,
          },
        },
      ],
    };
  }

  // Dark mode map fallback (Clean Apple-style dark navigation map)
  if (theme === 'dark') {
    return {
      version: 8,
      projection: mapProjection,
      ...optionalSky,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        },
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 20,
          paint: {
            'raster-opacity': 1,
            'raster-fade-duration': 0,
          },
        },
      ],
    };
  }

  // Esri World Street Map (Light mode — native WebGL saturation avoids full-screen CSS filter pass)
  return {
    version: 8,
    projection: mapProjection,
    ...optionalSky,
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
        paint: {
          'raster-opacity': 1,
          'raster-saturation': 0.15,
          'raster-fade-duration': 0,
        },
      },
    ],
  };
};

function normalizeCoords(
  coords?: [number, number] | { lat: number; lng: number } | null,
  fallback: [number, number] = [-45.587, -22.7355]
): [number, number] {
  if (!coords) return fallback;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
      return [lng, lat];
    }
  } else if (typeof coords === 'object' && 'lng' in coords && 'lat' in coords) {
    if (typeof coords.lng === 'number' && typeof coords.lat === 'number') {
      return [coords.lng, coords.lat];
    }
  }
  return fallback;
}

export const MapComponent = memo(
  forwardRef<MapComponentHandle, MapComponentProps>(
    (
    {
      spots,
      selectedSpot,
      onSelectSpot,
      onMapClick,
      userCoords,
      theme,
      visualIcons = [],
      userAvatar,
      userName,
      is3DMode = false,
      isDetailOpen = false,
      mapMode = 'explorar',
      onMapModeChange,
      onMapLoad,
      onInteractionChange,
      zoomToUserTrigger,
      onStyleChange,
      isSpotlightActive = false,
      isFocusMode = false,
      activeTab,
      isGlobeIntroPending = false,
      isGlobeIntroPlaying = false,
      onGlobeIntroComplete,
      activeRoute = null,
      isSuspended = false,
      onViewportSpotsLoaded,
      workflowMode = 'EXPLORE',
      selectedSpotIdsForItinerary = [],
      onToggleSelectSpotForItinerary,
      onStartItineraryCreation,
      itinerarySteps = [],
      activeItineraryStepId = null,
      isItineraryExpanded = false,
      onSelectItineraryStep,
      zoomDurationMs = 780,
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const isSuspendedRef = useRef<boolean>(isSuspended);
    isSuspendedRef.current = isSuspended;
    const workflowModeRef = useRef<MapWorkflowMode>(workflowMode);
    workflowModeRef.current = workflowMode;
    const selectedSpotIdsRef = useRef<string[]>(selectedSpotIdsForItinerary);
    selectedSpotIdsRef.current = selectedSpotIdsForItinerary;
    const onToggleSelectSpotRef = useRef(onToggleSelectSpotForItinerary);
    onToggleSelectSpotRef.current = onToggleSelectSpotForItinerary;
    const onStartItineraryCreationRef = useRef(onStartItineraryCreation);
    onStartItineraryCreationRef.current = onStartItineraryCreation;
    const itineraryStepsRef = useRef<ItineraryStep[]>(itinerarySteps);
    itineraryStepsRef.current = itinerarySteps;
    const activeItineraryStepIdRef = useRef<string | null>(activeItineraryStepId);
    activeItineraryStepIdRef.current = activeItineraryStepId;
    const isItineraryExpandedRef = useRef<boolean>(isItineraryExpanded);
    isItineraryExpandedRef.current = isItineraryExpanded;
    const onSelectItineraryStepRef = useRef(onSelectItineraryStep);
    onSelectItineraryStepRef.current = onSelectItineraryStep;
    const clampedZoomDuration = Math.min(2000, Math.max(200, Math.round(Number(zoomDurationMs) || 780)));
    const zoomDurationMsRef = useRef<number>(clampedZoomDuration);
    zoomDurationMsRef.current = clampedZoomDuration;
    const spotFocusRafRef = useRef<number | null>(null);
    const savedSuspendedCameraRef = useRef<{
      center: [number, number];
      zoom: number;
      pitch: number;
      bearing: number;
    } | null>(null);
    const onViewportSpotsLoadedRef = useRef(onViewportSpotsLoaded);
    onViewportSpotsLoadedRef.current = onViewportSpotsLoaded;
    const syncSpotMarkersRef = useRef<(() => void) | null>(null);
    const viewportSyncRafRef = useRef<number | null>(null);
    const progressiveMountRafRef = useRef<number | null>(null);
    const viewportFetchTimerRef = useRef<number | null>(null);
    const viewportFetchAbortRef = useRef<AbortController | null>(null);
    const isZoomGestureActiveRef = useRef<boolean>(false);
    const isProgrammaticZoomRef = useRef<boolean>(false);
    const programmaticZoomTimerRef = useRef<number | null>(null);
    const lastMarkerSyncCenterRef = useRef<{ lng: number; lat: number } | null>(null);
    const cachedStarPath100Ref = useRef<string | null>(null);
    const [currentMode, setCurrentMode] = useState<MapModeType>(
      mapMode === 'satelite' ? 'satelite' : 'explorar'
    );
    const currentModeRef = useRef<MapModeType>(currentMode);
    currentModeRef.current = currentMode;
    const activeRouteRef = useRef<ActiveMapRoute | null>(activeRoute);
    activeRouteRef.current = activeRoute;
    const lastRouteSpotIdRef = useRef<string | null>(null);
    const lastFittedRouteRevRef = useRef<number>(0);
    const [isFollowingUser, setIsFollowingUser] = useState<boolean>(false);
    const isFollowingUserRef = useRef<boolean>(false);
    const followCameraGraceUntilRef = useRef<number>(0);
    const hasUserMovedMapRef = useRef<boolean>(false);
    const hasFramedInitialSpotsRef = useRef<boolean>(false);
    const [isCompassTracking, setIsCompassTracking] = useState<boolean>(false);
    const isCompassTrackingRef = useRef<boolean>(false);
    const compassIconWrapperRef = useRef<HTMLDivElement | null>(null);
    const is3DModeRef = useRef<boolean>(is3DMode);
    const isTransitioning3DRef = useRef<boolean>(false);
    const isMapGestureActiveRef = useRef<boolean>(false);
    const lastMapGestureTimeRef = useRef<number>(0);
    const lastInteractionStateRef = useRef<boolean>(false);
    const prevStyleKeyRef = useRef<string>('');
    const onSelectSpotRef = useRef(onSelectSpot);
    const onMapClickRef = useRef(onMapClick);
    const onInteractionChangeRef = useRef(onInteractionChange);
    const spotsRef = useRef<Spot[]>(spots);

    useEffect(() => {
      onInteractionChangeRef.current = onInteractionChange;
    }, [onInteractionChange]);

    useEffect(() => {
      spotsRef.current = spots;
    }, [spots]);

    useEffect(() => {
      onSelectSpotRef.current = onSelectSpot;
    }, [onSelectSpot]);

    useEffect(() => {
      onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
      is3DModeRef.current = is3DMode;
    }, [is3DMode]);

    // User location marker refs
    const userMarkerRef = useRef<maplibregl.Marker | null>(null);
    const userMarkerMapRef = useRef<maplibregl.Map | null>(null);
    const userMarkerStackRef = useRef<HTMLDivElement | null>(null);
    const userAvatarImgRef = useRef<HTMLImageElement | null>(null);
    const userBeamRef = useRef<HTMLDivElement | null>(null);
    const isSpotlightActiveRef = useRef<boolean>(isSpotlightActive);
    isSpotlightActiveRef.current = isSpotlightActive;
    const activeTabRef = useRef<string | undefined>(activeTab);
    activeTabRef.current = activeTab;
    const isFocusModeRef = useRef<boolean>(isFocusMode);
    isFocusModeRef.current = isFocusMode;
    const isGlobeIntroPendingRef = useRef<boolean>(isGlobeIntroPending);
    isGlobeIntroPendingRef.current = isGlobeIntroPending;
    const isGlobeIntroPlayingRef = useRef<boolean>(isGlobeIntroPlaying);
    isGlobeIntroPlayingRef.current = isGlobeIntroPlaying;
    const isGlobeIntroActiveRef = useRef<boolean>(Boolean(isGlobeIntroPending || isGlobeIntroPlaying));
    isGlobeIntroActiveRef.current = Boolean(isGlobeIntroPending || isGlobeIntroPlaying);
    const onGlobeIntroCompleteRef = useRef(onGlobeIntroComplete);
    onGlobeIntroCompleteRef.current = onGlobeIntroComplete;
    const [isSpaceBackgroundActive, setIsSpaceBackgroundActive] = useState<boolean>(
      Boolean(isGlobeIntroPending || isGlobeIntroPlaying)
    );
    const hasCompletedGlobeFlightRef = useRef<boolean>(false);
    const markerZoomTierRef = useRef<'orbital' | 'regional' | 'city'>('city');
    const latestUserCoordsRef = useRef<[number, number]>(
      normalizeCoords(userCoords, [-45.5908, -22.7394])
    );
    const hasCenteredOnFirstFixRef = useRef<boolean>(false);
    const lastCenteredSessionIdRef = useRef<number>(-1);
    const prevIs3DModeRef = useRef<boolean>(is3DMode);

    // Campos do Jordão Center & Overview Coordinates (frames all tourist spots across the city)
    const CAMPOS_CENTER: [number, number] = [-45.5908, -22.7394];
    const CAMPOS_OVERVIEW_CENTER: [number, number] = [-45.5765, -22.7385];
    const CAMPOS_OVERVIEW_ZOOM: number = 11.75;

    const setFollowMode = useCallback((follow: boolean) => {
      const unchanged =
        isFollowingUserRef.current === follow &&
        (follow || !isCompassTrackingRef.current);
      if (unchanged) return;
      isFollowingUserRef.current = follow;
      setIsFollowingUser(follow);
      if (!follow) {
        isCompassTrackingRef.current = false;
        setIsCompassTracking(false);
      }
    }, []);
    const setFollowModeRef = useRef(setFollowMode);
    setFollowModeRef.current = setFollowMode;
    const themeRef = useRef(theme);
    themeRef.current = theme;

    const smoothCameraEase = useCallback((t: number): number => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }, []);

    const computeAdaptiveZoomDuration = useCallback(
      (map: maplibregl.Map, targetLng: number, targetLat: number, targetZoom: number, scale: number = 1): number => {
        if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          return 180;
        }
        const base = Math.round(zoomDurationMsRef.current * scale);
        try {
          const currentCenter = map.getCenter();
          const currentZoom = map.getZoom();
          const zoomDelta = Math.abs(targetZoom - currentZoom);
          const distDeg = Math.hypot(targetLng - currentCenter.lng, targetLat - currentCenter.lat);

          // Tiny nudge when camera is already focused nearby
          if (zoomDelta < 0.35 && distDeg < 0.0025) {
            return Math.max(240, Math.round(base * 0.65));
          }
          // Wide jump across multiple zoom levels or across town: give tiles extra room to stream cleanly
          if (zoomDelta >= 2.0 || distDeg >= 0.03) {
            return Math.min(2200, Math.round(base * 1.18));
          }
        } catch {}
        return Math.min(2000, Math.max(220, base));
      },
      []
    );

    const beginProgrammaticCameraAnim = useCallback((map: maplibregl.Map, durationMs: number, stopExisting: boolean = false) => {
      if (viewportSyncRafRef.current !== null) {
        cancelAnimationFrame(viewportSyncRafRef.current);
        viewportSyncRafRef.current = null;
      }
      if (progressiveMountRafRef.current !== null) {
        cancelAnimationFrame(progressiveMountRafRef.current);
        progressiveMountRafRef.current = null;
      }
      if (viewportFetchTimerRef.current !== null) {
        window.clearTimeout(viewportFetchTimerRef.current);
        viewportFetchTimerRef.current = null;
      }
      if (viewportFetchAbortRef.current) {
        viewportFetchAbortRef.current.abort();
        viewportFetchAbortRef.current = null;
      }
      if (programmaticZoomTimerRef.current !== null) {
        window.clearTimeout(programmaticZoomTimerRef.current);
        programmaticZoomTimerRef.current = null;
      }

      if (stopExisting) {
        try {
          map.stop();
        } catch {}
      }

      isProgrammaticZoomRef.current = true;

      if (viewportSyncRafRef.current !== null) {
        cancelAnimationFrame(viewportSyncRafRef.current);
        viewportSyncRafRef.current = null;
      }
      if (progressiveMountRafRef.current !== null) {
        cancelAnimationFrame(progressiveMountRafRef.current);
        progressiveMountRafRef.current = null;
      }

      programmaticZoomTimerRef.current = window.setTimeout(() => {
        programmaticZoomTimerRef.current = null;
        isProgrammaticZoomRef.current = false;
        if (mapRef.current === map && !map.isMoving() && !map.isZooming()) {
          syncSpotMarkersRef.current?.();
        }
      }, durationMs + 140);
    }, []);

    // Ensure the 3D User Location Marker ("Eu" + Avatar + Blue Flashlight Beam) exists and is attached to the active map
    const ensureUserMarker = useCallback(
      (targetMap?: maplibregl.Map | null) => {
        const map = targetMap || mapRef.current;
        if (!map) return;

        if (!userMarkerRef.current || userMarkerMapRef.current !== map) {
          if (userMarkerRef.current) {
            try {
              userMarkerRef.current.remove();
            } catch {}
            userMarkerRef.current = null;
          }

          const rootEl = document.createElement('div');
          rootEl.className = 'monvian-user-location-marker select-none';
          rootEl.style.position = 'relative';
          rootEl.style.display = 'flex';
          rootEl.style.alignItems = 'center';
          rootEl.style.justifyContent = 'center';
          rootEl.style.pointerEvents = 'none';
          rootEl.style.zIndex = '40';

          // 1. Lanterna azul simples de orientação (Apple Maps / iOS Compass Flashlight Beam)
          const beamWrapper = document.createElement('div');
          beamWrapper.className = 'monvian-user-heading-beam';
          beamWrapper.style.position = 'absolute';
          beamWrapper.style.top = '27px'; // Exact center of the 54px outer avatar ring
          beamWrapper.style.left = '50%';
          beamWrapper.style.width = '160px';
          beamWrapper.style.height = '160px';
          const initialHeading = deviceHeadingManager.getCurrentHeading() || 0;
          const initialMapBearing = map.getBearing() || 0;
          const initialBeamAngle = (initialHeading - initialMapBearing + 360) % 360;
          beamWrapper.style.transform = `translate(-50%, -50%) rotate(${initialBeamAngle.toFixed(1)}deg)`;
          beamWrapper.style.transformOrigin = '50% 50%';
          beamWrapper.style.pointerEvents = 'none';
          beamWrapper.style.zIndex = '1';
          beamWrapper.style.willChange = 'transform, opacity';
          beamWrapper.style.transition = 'opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
          beamWrapper.style.opacity = isFocusModeRef.current ? '0' : '1';
          beamWrapper.innerHTML = `
            <svg viewBox="0 0 160 160" width="100%" height="100%" style="overflow: visible;">
              <defs>
                <radialGradient id="monvianAppleFlashlightBeam" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#007AFF" stop-opacity="0.45" />
                  <stop offset="35%" stop-color="#007AFF" stop-opacity="0.25" />
                  <stop offset="70%" stop-color="#007AFF" stop-opacity="0.08" />
                  <stop offset="100%" stop-color="#007AFF" stop-opacity="0" />
                </radialGradient>
              </defs>
              <!-- Lanterna azul simples de orientação (cone frontal projetado a partir do centro) -->
              <path
                d="M 80 80 L 40 10 A 80 80 0 0 1 120 10 Z"
                fill="url(#monvianAppleFlashlightBeam)"
              />
            </svg>
          `;
          userBeamRef.current = beamWrapper;

          // 2. Center 3D Avatar Circle + Outer Translucent Ring + Small Blue Indicator Dot + "Eu" Pill
          const centerStack = document.createElement('div');
          centerStack.style.position = 'relative';
          centerStack.style.display = 'flex';
          centerStack.style.flexDirection = 'column';
          centerStack.style.alignItems = 'center';
          centerStack.style.justifyContent = 'center';
          centerStack.style.zIndex = '2';
          centerStack.style.transition = 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
          centerStack.style.opacity = isFocusModeRef.current ? '0' : '1';
          centerStack.style.transform = isFocusModeRef.current ? 'scale(0.76)' : 'scale(1)';
          centerStack.style.pointerEvents = isFocusModeRef.current ? 'none' : 'auto';
          centerStack.style.cursor = 'pointer';
          userMarkerStackRef.current = centerStack;

          // Outer 3D Ring (Círculo translúcido azul suave ao redor da foto)
          const outerRing = document.createElement('div');
          outerRing.style.position = 'relative';
          outerRing.style.width = '54px';
          outerRing.style.height = '54px';
          outerRing.style.borderRadius = '9999px';
          outerRing.style.background = 'rgba(0, 122, 255, 0.14)';
          outerRing.style.border = '1.5px solid rgba(0, 122, 255, 0.35)';
          outerRing.style.boxShadow =
            '0 6px 20px rgba(0, 0, 0, 0.18), 0 0 16px rgba(0, 122, 255, 0.25)';
          outerRing.style.display = 'flex';
          outerRing.style.alignItems = 'center';
          outerRing.style.justifyContent = 'center';

          // Inner Avatar Circle with White Border
          const innerCircle = document.createElement('div');
          innerCircle.style.width = '44px';
          innerCircle.style.height = '44px';
          innerCircle.style.borderRadius = '9999px';
          innerCircle.style.border = '2.5px solid #FFFFFF';
          innerCircle.style.overflow = 'hidden';
          innerCircle.style.backgroundColor = '#18181B';
          innerCircle.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.28)';

          const getEffectiveAvatar = (av?: string) => {
            if (av && av !== '/fotoperfil.png') return av;
            try {
              const savedUser = JSON.parse(localStorage.getItem('monvian_user') || '{}');
              const email = (savedUser?.email || savedUser?.whatsapp || '').toLowerCase();
              const username = (savedUser?.username || '').toLowerCase();
              const isMario = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(email) || username === 'marioyesk';
              if (savedUser?.avatar_url && savedUser.avatar_url.trim().length > 0) {
                if (savedUser.avatar_url !== '/fotoperfil.png' || isMario) {
                  return savedUser.avatar_url;
                }
              }
              if (isMario) return '/fotoperfil.png';
            } catch {}
            return '/loogo.png';
          };

          const avatarImg = document.createElement('img');
          avatarImg.src = getEffectiveAvatar(userAvatar);
          avatarImg.alt = userName || 'Eu';
          avatarImg.style.width = '100%';
          avatarImg.style.height = '100%';
          avatarImg.style.objectFit = 'cover';
          avatarImg.style.objectPosition = 'center';
          avatarImg.style.display = 'block';
          avatarImg.style.pointerEvents = 'none';
          avatarImg.onerror = () => {
            avatarImg.src = '/loogo.png';
          };
          userAvatarImgRef.current = avatarImg;

          innerCircle.appendChild(avatarImg);
          outerRing.appendChild(innerCircle);

          // "Eu" Pill Badge below the avatar circle
          const euBadge = document.createElement('div');
          euBadge.textContent = 'Eu';
          euBadge.style.marginTop = '-4px';
          euBadge.style.zIndex = '4';
          euBadge.style.padding = '1.5px 10px';
          euBadge.style.borderRadius = '9999px';
          euBadge.style.backgroundColor = 'rgba(18, 18, 22, 0.92)';
          euBadge.style.color = '#FFFFFF';
          euBadge.style.fontSize = '11px';
          euBadge.style.fontWeight = '700';
          euBadge.style.letterSpacing = '-0.01em';
          euBadge.style.lineHeight = '1.25';
          euBadge.style.border = '1px solid rgba(255, 255, 255, 0.16)';
          euBadge.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.35)';

          centerStack.appendChild(outerRing);
          centerStack.appendChild(euBadge);
          rootEl.appendChild(beamWrapper);
          rootEl.appendChild(centerStack);

          centerStack.onclick = (e) => {
            e.stopPropagation();
            if (isGlobeIntroActiveRef.current) return;
            centerOnUserLocation(true, true);
          };

          const initialLngLat =
            gpsNavigationManager.getCurrentInterpolatedCoords() ||
            latestUserCoordsRef.current ||
            CAMPOS_CENTER;

          userMarkerRef.current = new maplibregl.Marker({
            element: rootEl,
            anchor: 'center',
            opacityWhenCovered: '0',
          })
            .setLngLat(initialLngLat)
            .addTo(map);
          userMarkerMapRef.current = map;
        } else {
          const el = userMarkerRef.current.getElement();
          if (el && !el.isConnected) {
            userMarkerRef.current.addTo(map);
          }
        }
      },
      [userAvatar, userName]
    );
    const ensureUserMarkerRef = useRef(ensureUserMarker);
    ensureUserMarkerRef.current = ensureUserMarker;

    const centerOnUserLocation = useCallback(
      (activateSensors: boolean = true, toggleCompassMode: boolean = false, targetZoom: number = 15.6) => {
        if (activateSensors) {
          // Request GPS synchronously inside user gesture tick so iOS Safari never drops transient activation
          if (gpsNavigationManager.getState().status !== 'granted') {
            gpsNavigationManager.requestPermissionAndStartFromGesture();
          } else {
            gpsNavigationManager.refreshPositionNow();
          }
          deviceHeadingManager.requestPermission().catch(() => {});
          deviceHeadingManager.start();
        }

        if (toggleCompassMode) {
          const nextCompass = !isCompassTrackingRef.current;
          isCompassTrackingRef.current = nextCompass;
          setIsCompassTracking(nextCompass);
        }

        const gpsState = gpsNavigationManager.getState();
        hasUserMovedMapRef.current = false;
        if (gpsState.hasRealFix && gpsState.status === 'granted') {
          hasCenteredOnFirstFixRef.current = true;
          lastCenteredSessionIdRef.current = gpsState.sessionId ?? 0;
        } else {
          hasCenteredOnFirstFixRef.current = false;
          lastCenteredSessionIdRef.current = -1;
        }
        setFollowMode(true);
        followCameraGraceUntilRef.current = performance.now() + 750;

        const targetCoords =
          gpsNavigationManager.getCurrentInterpolatedCoords() ||
          latestUserCoordsRef.current ||
          CAMPOS_CENTER;

        if (mapRef.current) {
          const map = mapRef.current;
          ensureUserMarker(map);
          userMarkerRef.current?.setLngLat(targetCoords);

          map.resize();
          const animDuration = computeAdaptiveZoomDuration(map, targetCoords[0], targetCoords[1], targetZoom, 0.95);
          beginProgrammaticCameraAnim(map, animDuration);
          map.easeTo({
            center: targetCoords,
            zoom: targetZoom,
            pitch: is3DModeRef.current ? 60 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
            duration: animDuration,
            easing: smoothCameraEase,
            essential: true,
          });
        }
      },
      [setFollowMode, ensureUserMarker, computeAdaptiveZoomDuration, beginProgrammaticCameraAnim, smoothCameraEase]
    );

    const focusItineraryStepOnMap = useCallback(
      (step: ItineraryStep, expanded?: boolean) => {
        const map = mapRef.current;
        if (!map || !step) return;
        const lat = Number(step.spot?.lat ?? step.lat);
        const lng = Number(step.spot?.lng ?? step.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        setFollowMode(false);
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const isExpandedState = expanded !== undefined ? expanded : isItineraryExpandedRef.current;
        const verticalOffset = isMobile
          ? isExpandedState
            ? -Math.round(window.innerHeight * 0.20)
            : -Math.round(window.innerHeight * 0.08)
          : 0;

        const animDuration = computeAdaptiveZoomDuration(map, lng, lat, 15.1, 0.95);
        beginProgrammaticCameraAnim(map, animDuration);
        map.easeTo({
          center: [lng, lat],
          zoom: 15.1,
          pitch: is3DModeRef.current ? 52 : 42,
          bearing: is3DModeRef.current ? -13 : -8,
          offset: [0, verticalOffset],
          duration: animDuration,
          easing: smoothCameraEase,
          essential: true,
        });
      },
      [setFollowMode, computeAdaptiveZoomDuration, beginProgrammaticCameraAnim, smoothCameraEase]
    );

    const fitItineraryCameraBounds = useCallback(
      (overrideSteps?: ItineraryStep[], instant: boolean = false) => {
        const map = mapRef.current;
        if (!map) return;
        const steps = overrideSteps || itineraryStepsRef.current || [];
        const coords: [number, number][] = [];
        for (let i = 0; i < steps.length; i++) {
          const lat = Number(steps[i].spot?.lat ?? steps[i].lat);
          const lng = Number(steps[i].spot?.lng ?? steps[i].lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            coords.push([lng, lat]);
          }
        }
        if (coords.length === 0) return;

        setFollowMode(false);
        const animDuration = instant ? 0 : Math.min(1800, Math.max(300, Math.round(zoomDurationMsRef.current * 0.95)));
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        if (!instant) {
          beginProgrammaticCameraAnim(map, animDuration);
        }

        if (coords.length === 1) {
          const verticalOffset = isMobile
            ? isItineraryExpandedRef.current
              ? -Math.round(window.innerHeight * 0.22)
              : -Math.round(window.innerHeight * 0.08)
            : 0;
          map.easeTo({
            center: coords[0],
            zoom: 15.1,
            pitch: is3DModeRef.current ? 52 : 42,
            bearing: is3DModeRef.current ? -13 : -8,
            offset: [0, verticalOffset],
            duration: animDuration,
            easing: smoothCameraEase,
            essential: true,
          });
          return;
        }

        const bounds = new maplibregl.LngLatBounds();
        coords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, {
          padding: isMobile
            ? {
                top: 108,
                bottom: Math.round(window.innerHeight * (isItineraryExpandedRef.current ? 0.54 : 0.24)) + 28,
                left: 44,
                right: 72,
              }
            : {
                top: 84,
                bottom: 84,
                left: 450,
                right: 84,
              },
          pitch: is3DModeRef.current ? 50 : 40,
          bearing: is3DModeRef.current ? -13 : -8,
          maxZoom: 14.8,
          duration: animDuration,
          easing: smoothCameraEase,
          essential: true,
        });
      },
      [setFollowMode, beginProgrammaticCameraAnim, smoothCameraEase]
    );

    // Compute exact framing parameters for Campos do Jordão overview
    const getCamposOverviewCamera = useCallback(
      (targetMap?: maplibregl.Map | null): { center: [number, number]; zoom: number } => {
        const map = targetMap || mapRef.current;
        const currentSpots = spotsRef.current || [];
        const camposSpots = currentSpots.filter((s) => {
          const lng = Number(s.lng);
          const lat = Number(s.lat);
          return (
            !isNaN(lng) &&
            !isNaN(lat) &&
            lat >= -22.85 &&
            lat <= -22.62 &&
            lng >= -45.68 &&
            lng <= -45.45
          );
        });

        let targetCenter: [number, number] = CAMPOS_OVERVIEW_CENTER;
        let targetZoom: number = CAMPOS_OVERVIEW_ZOOM;

        if (map && camposSpots.length >= 2) {
          try {
            const bounds = new maplibregl.LngLatBounds();
            camposSpots.forEach((s) => {
              bounds.extend([Number(s.lng), Number(s.lat)]);
            });
            const cam = map.cameraForBounds(bounds, {
              padding: { top: 130, bottom: 145, left: 48, right: 82 },
              maxZoom: 12.1,
            });
            if (cam && cam.center) {
              const c = maplibregl.LngLat.convert(cam.center);
              targetCenter = [c.lng, c.lat];
              targetZoom =
                typeof cam.zoom === 'number'
                  ? Math.min(cam.zoom, 12.1)
                  : CAMPOS_OVERVIEW_ZOOM;
            }
          } catch {}
        }

        return { center: targetCenter, zoom: targetZoom };
      },
      []
    );
    const getCamposOverviewCameraRef = useRef(getCamposOverviewCamera);
    getCamposOverviewCameraRef.current = getCamposOverviewCamera;

    const frameAllSpotsOverview = useCallback(
      (targetMap?: maplibregl.Map | null, animateCamera: boolean = false) => {
        const map = targetMap || mapRef.current;
        if (!map) return;

        setFollowMode(false);
        hasUserMovedMapRef.current = false;
        map.resize();

        const { center: targetCenter, zoom: targetZoom } = getCamposOverviewCamera(map);

        if (animateCamera) {
          const animDuration = computeAdaptiveZoomDuration(map, targetCenter[0], targetCenter[1], targetZoom, 0.9);
          beginProgrammaticCameraAnim(map, animDuration);
          map.easeTo({
            center: targetCenter,
            zoom: targetZoom,
            pitch: is3DModeRef.current ? 60 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
            offset: [0, 0],
            duration: animDuration,
            easing: smoothCameraEase,
            essential: true,
          });
        } else {
          map.jumpTo({
            center: targetCenter,
            zoom: targetZoom,
            pitch: is3DModeRef.current ? 60 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
          });
        }
      },
      [setFollowMode, getCamposOverviewCamera, computeAdaptiveZoomDuration, beginProgrammaticCameraAnim, smoothCameraEase]
    );

    // Expose map controls for external iOS floating buttons
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        const map = mapRef.current;
        if (!map) return;
        const stepDuration = Math.round(Math.min(540, Math.max(220, zoomDurationMsRef.current * 0.48)));
        map.zoomIn({ duration: stepDuration, easing: smoothCameraEase });
      },
      zoomOut: () => {
        const map = mapRef.current;
        if (!map) return;
        const stepDuration = Math.round(Math.min(540, Math.max(220, zoomDurationMsRef.current * 0.48)));
        map.zoomOut({ duration: stepDuration, easing: smoothCameraEase });
      },
      resetNorth: () => {
        centerOnUserLocation(true);
      },
      setMapMode: (mode: MapModeType) => {
        const sanitizedMode: MapModeType = mode === 'satelite' ? 'satelite' : 'explorar';
        setCurrentMode(sanitizedMode);
        if (onMapModeChange) onMapModeChange(sanitizedMode);
        if (onStyleChange) onStyleChange(sanitizedMode);
      },
      getMapMode: () => currentMode,
      toggleMapMode: () => {
        const next: MapModeType = currentMode === 'satelite' ? 'explorar' : 'satelite';
        setCurrentMode(next);
        if (onMapModeChange) onMapModeChange(next);
        if (onStyleChange) onStyleChange(next);
        return next;
      },
      flyToSpot: (spot: Spot) => {
        if (!spot.lng || !spot.lat || !mapRef.current) return;
        const map = mapRef.current;
        setFollowMode(false);
        const isMobile = window.innerWidth < 768;
        const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
        const animDuration = computeAdaptiveZoomDuration(map, spot.lng, spot.lat, 15.5, 1);
        beginProgrammaticCameraAnim(map, animDuration);
        map.easeTo({
          center: [spot.lng, spot.lat],
          zoom: 15.5,
          pitch: is3DModeRef.current ? 55 : 0,
          bearing: is3DModeRef.current ? -20 : 0,
          offset: [0, verticalOffset],
          duration: animDuration,
          easing: smoothCameraEase,
          essential: true,
        });
      },
      recenter: () => {
        centerOnUserLocation(true);
      },
      fitItineraryBounds: (steps?: ItineraryStep[], instant?: boolean) => {
        fitItineraryCameraBounds(steps, Boolean(instant));
      },
      focusItineraryStep: (step: ItineraryStep, expanded?: boolean) => {
        focusItineraryStepOnMap(step, expanded);
      },
      fitSpotsOverview: () => {
        frameAllSpotsOverview(mapRef.current, true);
      },
    }), [centerOnUserLocation, currentMode, onMapModeChange, onStyleChange, setFollowMode, beginProgrammaticCameraAnim, computeAdaptiveZoomDuration, smoothCameraEase, fitItineraryCameraBounds, focusItineraryStepOnMap, frameAllSpotsOverview]);

    // Synchronize mode from prop if provided (excluding dark map mode)
    useEffect(() => {
      if (mapMode) {
        const normalized: MapModeType = mapMode === 'satelite' ? 'satelite' : 'explorar';
        if (normalized !== currentMode) {
          setCurrentMode(normalized);
        }
      }
    }, [mapMode]);

    // Initialize, suspend (release WebGL when another 3D map is active), or swap map style in-place
    useEffect(() => {
      if (isSuspended) {
        if (mapRef.current) {
          try {
            const c = mapRef.current.getCenter();
            savedSuspendedCameraRef.current = {
              center: [c.lng, c.lat],
              zoom: mapRef.current.getZoom(),
              pitch: mapRef.current.getPitch(),
              bearing: mapRef.current.getBearing(),
            };
          } catch {}

          if (userMarkerRef.current) {
            try {
              userMarkerRef.current.remove();
            } catch {}
            userMarkerRef.current = null;
          }
          userMarkerMapRef.current = null;
          userAvatarImgRef.current = null;
          userBeamRef.current = null;

          markerRecordsRef.current.forEach((rec) => {
            try {
              rec.marker.remove();
            } catch {}
          });
          markerRecordsRef.current = [];
          itineraryMarkersRef.current.forEach((rec) => {
            try {
              rec.marker.remove();
            } catch {}
          });
          itineraryMarkersRef.current = [];
          animatedSpotIdsRef.current.clear();

          if (viewportSyncRafRef.current !== null) {
            cancelAnimationFrame(viewportSyncRafRef.current);
            viewportSyncRafRef.current = null;
          }
          if (progressiveMountRafRef.current !== null) {
            cancelAnimationFrame(progressiveMountRafRef.current);
            progressiveMountRafRef.current = null;
          }
          if (programmaticZoomTimerRef.current !== null) {
            window.clearTimeout(programmaticZoomTimerRef.current);
            programmaticZoomTimerRef.current = null;
          }
          isProgrammaticZoomRef.current = false;
          if (viewportFetchTimerRef.current !== null) {
            window.clearTimeout(viewportFetchTimerRef.current);
            viewportFetchTimerRef.current = null;
          }
          if (viewportFetchAbortRef.current) {
            viewportFetchAbortRef.current.abort();
            viewportFetchAbortRef.current = null;
          }

          visualIconMarkersRef.current.forEach((m) => {
            try {
              m.remove();
            } catch {}
          });
          visualIconMarkersRef.current = [];

          try {
            mapRef.current.remove();
          } catch {}
          mapRef.current = null;
          prevStyleKeyRef.current = '';
        }
        return;
      }

      if (!mapContainerRef.current) return;

      const styleKey = `${currentMode}:${theme}`;
      const startOrbital = isGlobeIntroActiveRef.current;
      const style = getVectorMapStyle(currentMode, theme, startOrbital);

      if (!mapRef.current) {
        prevStyleKeyRef.current = styleKey;
        const resumedCam = savedSuspendedCameraRef.current;
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: style,
          center: resumedCam
            ? resumedCam.center
            : startOrbital
              ? [-22, -10]
              : CAMPOS_OVERVIEW_CENTER,
          zoom: resumedCam
            ? resumedCam.zoom
            : startOrbital
              ? getOrbitalEarthZoom()
              : CAMPOS_OVERVIEW_ZOOM,
          minZoom: 0.4,
          maxZoom: 20,
          pitch: resumedCam
            ? resumedCam.pitch
            : startOrbital
              ? 0
              : is3DModeRef.current
                ? 60
                : 0,
          bearing: resumedCam
            ? resumedCam.bearing
            : startOrbital
              ? 0
              : is3DModeRef.current
                ? -20
                : 0,
          maxPitch: 75,
          pitchWithRotate: true,
          touchZoomRotate: true,
          touchPitch: false,
          attributionControl: false,
          fadeDuration: 0,
          crossSourceCollisions: false,
          validateStyle: false,
          cancelPendingTileRequestsWhileZooming: true,
          maxTileCacheZoomLevels: 4,
          pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
          refreshExpiredTiles: false,
          trackResize: false,
        });

        try {
          // Make two-finger pinch-to-zoom and wheel zoom silky smooth on touchscreens and desktop trackpads
          if (typeof (map.touchZoomRotate as any)?.setZoomThreshold === 'function') {
            (map.touchZoomRotate as any).setZoomThreshold(0.06);
          }
          if (typeof (map.scrollZoom as any)?.setWheelZoomRate === 'function') {
            (map.scrollZoom as any).setWheelZoomRate(1 / 420);
          }
          if (typeof (map.scrollZoom as any)?.setZoomRate === 'function') {
            (map.scrollZoom as any).setZoomRate(1 / 120);
          }
        } catch {}

        mapRef.current = map;
        ensureUserMarker(map);

        map.on('click', () => {
          if (isGlobeIntroActiveRef.current) return;
          if (onMapClickRef.current) onMapClickRef.current();
        });

        let lastSpaceActive: boolean | null = null;
        let lastHideUserPin: boolean | null = null;

        const cancelPendingViewportWork = () => {
          if (viewportSyncRafRef.current !== null) {
            cancelAnimationFrame(viewportSyncRafRef.current);
            viewportSyncRafRef.current = null;
          }
          if (progressiveMountRafRef.current !== null) {
            cancelAnimationFrame(progressiveMountRafRef.current);
            progressiveMountRafRef.current = null;
          }
        };

        const cancelPendingViewportFetch = () => {
          if (viewportFetchTimerRef.current !== null) {
            window.clearTimeout(viewportFetchTimerRef.current);
            viewportFetchTimerRef.current = null;
          }
          if (viewportFetchAbortRef.current) {
            viewportFetchAbortRef.current.abort();
            viewportFetchAbortRef.current = null;
          }
        };

        const scheduleViewportMarkerSync = () => {
          // Never mutate marker DOM mid-pinch-zoom or during programmatic spot auto-zoom
          if (isZoomGestureActiveRef.current || isProgrammaticZoomRef.current) return;
          if (viewportSyncRafRef.current !== null) return;
          viewportSyncRafRef.current = requestAnimationFrame(() => {
            viewportSyncRafRef.current = null;
            if (isZoomGestureActiveRef.current || isProgrammaticZoomRef.current) return;
            if (!mapRef.current || mapRef.current !== map) return;
            syncSpotMarkersRef.current?.();
          });
        };

        const scheduleViewportDataFetch = (immediate: boolean = false) => {
          if (isSuspendedRef.current || isGlobeIntroActiveRef.current) return;
          if (!mapRef.current || mapRef.current !== map) return;
          if (map.getZoom() < 8.5) return;

          cancelPendingViewportFetch();

          const runFetch = () => {
            viewportFetchTimerRef.current = null;
            if (isSuspendedRef.current || isGlobeIntroActiveRef.current) return;
            if (!mapRef.current || mapRef.current !== map) return;
            if (map.getZoom() < 8.5) return;

            try {
              const rawBounds = map.getBounds();
              const sw = rawBounds.getSouthWest();
              const ne = rawBounds.getNorthEast();
              const latSpan = Math.max(0.004, ne.lat - sw.lat);
              const lngSpan = Math.max(0.004, ne.lng - sw.lng);
              const latAnticipation = Math.max(0.006, latSpan * 0.25);
              const lngAnticipation = Math.max(0.006, lngSpan * 0.25);

              const fetchBounds: GeoBounds = {
                minLat: sw.lat - latAnticipation,
                maxLat: ne.lat + latAnticipation,
                minLng: sw.lng - lngAnticipation,
                maxLng: ne.lng + lngAnticipation,
              };

              const controller = new AbortController();
              viewportFetchAbortRef.current = controller;

              fetchSpotsInViewport(fetchBounds, { signal: controller.signal })
                .then((regionSpots) => {
                  if (controller.signal.aborted || mapRef.current !== map) return;
                  if (viewportFetchAbortRef.current === controller) {
                    viewportFetchAbortRef.current = null;
                  }
                  if (regionSpots.length > 0 && onViewportSpotsLoadedRef.current) {
                    onViewportSpotsLoadedRef.current(regionSpots);
                  }
                })
                .catch((err: any) => {
                  if (err?.name === 'AbortError') return;
                });
            } catch {}
          };

          if (immediate) {
            runFetch();
          } else {
            viewportFetchTimerRef.current = window.setTimeout(runFetch, 300);
          }
        };

        const syncSpaceAndMarkerZoomTier = () => {
          const z = map.getZoom();
          const shouldSpace = Boolean(
            isGlobeIntroPendingRef.current || (isGlobeIntroPlayingRef.current && z < 7.2)
          );
          if (lastSpaceActive !== shouldSpace) {
            lastSpaceActive = shouldSpace;
            setIsSpaceBackgroundActive(shouldSpace);
          }

          const userMarkerEl = userMarkerRef.current?.getElement();
          if (userMarkerEl) {
            const hideUserPinForOrbitalFlight = Boolean(
              isGlobeIntroActiveRef.current && z < 4.5
            );
            if (lastHideUserPin !== hideUserPinForOrbitalFlight) {
              lastHideUserPin = hideUserPinForOrbitalFlight;
              userMarkerEl.style.transition = 'opacity 0.35s ease';
              userMarkerEl.style.opacity = hideUserPinForOrbitalFlight ? '0' : '1';
            }
          }

          const nextTier: 'orbital' | 'regional' | 'city' =
            z < 4.5 ? 'orbital' : z < 7.5 ? 'regional' : 'city';
          if (markerZoomTierRef.current !== nextTier) {
            markerZoomTierRef.current = nextTier;
            syncMarkerHighlight(selectedSpotRef.current?.id);
          }
        };

        map.on('load', () => {
          try {
            if (isGlobeIntroActiveRef.current) {
              map.setProjection({ type: 'globe' });
              map.setSky(getCleanSpaceSky(themeRef.current));
            } else {
              map.setProjection({ type: 'mercator' });
              map.setSky(undefined);
            }
          } catch {}
          syncSpotMarkers();
          syncActiveRouteLayers(map);
          syncItineraryRouteLayers(map);
          ensureUserMarker(map);
          map.resize();
          const currentGpsState = gpsNavigationManager.getState();
          if (currentGpsState.hasRealFix && currentGpsState.status === 'granted') {
            userMarkerRef.current?.setLngLat(currentGpsState.coords);
            latestUserCoordsRef.current = currentGpsState.coords;
          }
          if (savedSuspendedCameraRef.current) {
            savedSuspendedCameraRef.current = null;
          } else if (isGlobeIntroActiveRef.current) {
            map.jumpTo({
              center: [-22, -10],
              zoom: getOrbitalEarthZoom(),
              pitch: 0,
              bearing: 0,
            });
          } else if (workflowModeRef.current === 'ITINERARY' && itineraryStepsRef.current.length > 0) {
            fitItineraryCameraBounds(itineraryStepsRef.current, true);
          } else if (selectedSpotRef.current && selectedSpotRef.current.lng && selectedSpotRef.current.lat) {
            const isMobile = window.innerWidth < 768;
            const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
            map.easeTo({
              center: [selectedSpotRef.current.lng, selectedSpotRef.current.lat],
              zoom: 15.5,
              pitch: is3DModeRef.current ? 60 : 35,
              bearing: is3DModeRef.current ? -20 : 0,
              offset: [0, verticalOffset],
              duration: 500,
            });
          } else if (!hasUserMovedMapRef.current && !isSpotlightActiveRef.current && workflowModeRef.current === 'EXPLORE') {
            frameAllSpotsOverview(map, false);
          }
          syncSpaceAndMarkerZoomTier();
          syncSpotMarkersRef.current?.();
          scheduleViewportDataFetch(true);
          if (onMapLoad) onMapLoad();
        });

        map.on('style.load', () => {
          try {
            if (isGlobeIntroActiveRef.current) {
              map.setProjection({ type: 'globe' });
              map.setSky(getCleanSpaceSky(themeRef.current));
            } else {
              map.setProjection({ type: 'mercator' });
              map.setSky(undefined);
            }
          } catch {}
          syncSpotMarkersRef.current?.();
          syncActiveRouteLayers(map);
          syncItineraryRouteLayers(map);
          ensureUserMarker(map);
          syncSpaceAndMarkerZoomTier();
        });

        // Mark map as manually moved by user when panning/pinching so camera stays 100% responsive
        const onUserManualMoveStart = (e: any) => {
          cancelPendingViewportFetch();
          cancelPendingViewportWork();
          if (e && e.type === 'zoomstart') {
            isZoomGestureActiveRef.current = true;
          }
          if (e && e.originalEvent) {
            if (programmaticZoomTimerRef.current !== null) {
              window.clearTimeout(programmaticZoomTimerRef.current);
              programmaticZoomTimerRef.current = null;
            }
            isProgrammaticZoomRef.current = false;
            isMapGestureActiveRef.current = true;
            lastMapGestureTimeRef.current = performance.now();
            if (e.type === 'dragstart') {
              if (!hasUserMovedMapRef.current) {
                hasUserMovedMapRef.current = true;
              }
              if (isFollowingUserRef.current) {
                setFollowMode(false);
              }
            }
          }
          if (!lastInteractionStateRef.current) {
            lastInteractionStateRef.current = true;
            if (onInteractionChangeRef.current) onInteractionChangeRef.current(true);
          }
        };

        const onUserDrag = (e: any) => {
          if (e && e.originalEvent) {
            isMapGestureActiveRef.current = true;
            lastMapGestureTimeRef.current = performance.now();
          }
          // Skip DOM sync during active two-finger pinch-zoom or programmatic zoom; during long continuous pans,
          // only sync once the viewport center has shifted significantly (>= 35% of screen span)
          if (isZoomGestureActiveRef.current || isProgrammaticZoomRef.current) return;
          try {
            const c = map.getCenter();
            const last = lastMarkerSyncCenterRef.current;
            if (!last) {
              scheduleViewportMarkerSync();
              return;
            }
            const b = map.getBounds();
            const latThresh = Math.max(0.005, (b.getNorth() - b.getSouth()) * 0.35);
            const lngThresh = Math.max(0.005, (b.getEast() - b.getWest()) * 0.35);
            if (Math.abs(c.lat - last.lat) >= latThresh || Math.abs(c.lng - last.lng) >= lngThresh) {
              scheduleViewportMarkerSync();
            }
          } catch {}
        };

        const onUserZoom = (e: any) => {
          // Ultra-lightweight zoom handler: ZERO DOM mutations or marker creation while zooming!
          isZoomGestureActiveRef.current = true;
          if (e && e.originalEvent) {
            isMapGestureActiveRef.current = true;
            lastMapGestureTimeRef.current = performance.now();
          }
          if (isGlobeIntroActiveRef.current) {
            syncSpaceAndMarkerZoomTier();
          }
        };

        const onZoomEnd = () => {
          isZoomGestureActiveRef.current = false;
        };

        const onMoveEnd = (e: any) => {
          if (e && e.originalEvent) {
            lastMapGestureTimeRef.current = performance.now();
          }
          // Only reconcile once ALL active camera gestures have completely settled (eliminates 3x duplicate runs)
          if (map.isMoving() || map.isZooming()) return;
          if (programmaticZoomTimerRef.current !== null) {
            window.clearTimeout(programmaticZoomTimerRef.current);
            programmaticZoomTimerRef.current = null;
          }
          isProgrammaticZoomRef.current = false;
          isZoomGestureActiveRef.current = false;
          isMapGestureActiveRef.current = false;
          syncSpaceAndMarkerZoomTier();
          scheduleViewportMarkerSync();
          scheduleViewportDataFetch(false);
          if (lastInteractionStateRef.current) {
            lastInteractionStateRef.current = false;
            if (onInteractionChangeRef.current) onInteractionChangeRef.current(false);
          }
        };

        map.on('dragstart', onUserManualMoveStart);
        map.on('zoomstart', onUserManualMoveStart);
        map.on('rotatestart', onUserManualMoveStart);
        map.on('pitchstart', onUserManualMoveStart);
        map.on('drag', onUserDrag);
        map.on('zoom', onUserZoom);
        map.on('zoomend', onZoomEnd);
        map.on('moveend', onMoveEnd);

        // Keep deviceHeadingManager aware of map bearing so the flashlight aligns with true heading
        let lastBearingApplied = -999;
        const syncBeamWithMapBearing = () => {
          const bearing = map.getBearing() || 0;
          if (Math.abs(bearing - lastBearingApplied) < 0.25) return;
          lastBearingApplied = bearing;
          deviceHeadingManager.setMapBearing(bearing);
          if (userBeamRef.current && deviceHeadingManager.hasSensorData()) {
            const rawHeading = deviceHeadingManager.getCurrentHeading();
            const beamAngle = (rawHeading - bearing + 360) % 360;
            userBeamRef.current.style.transform = `translate3d(-50%, -50%, 0) rotate(${beamAngle.toFixed(1)}deg)`;
          }
        };

        deviceHeadingManager.setMapBearing(map.getBearing());
        map.on('rotate', syncBeamWithMapBearing);
      } else if (prevStyleKeyRef.current !== styleKey) {
        prevStyleKeyRef.current = styleKey;
        mapRef.current.setStyle(style);
        ensureUserMarker(mapRef.current);
      } else {
        ensureUserMarker(mapRef.current);
      }
    }, [currentMode, theme, ensureUserMarker, isSuspended]);

    // Subscribe to Device Compass / 3D Orientation Heading for the Blue Flashlight ("Lanterna Azul") & Compass Icon
    useEffect(() => {
      deviceHeadingManager.start();
      let lastRenderedBeamAngle = -999;
      let lastRenderedCompassAngle = -999;

      const unsubscribeHeading = deviceHeadingManager.subscribe((rawHeading) => {
        if (isNaN(rawHeading)) return;
        // Skip DOM mutations when map tab is hidden, suspended, or actively pinching/dragging
        if (
          isSuspendedRef.current ||
          isMapGestureActiveRef.current ||
          isZoomGestureActiveRef.current ||
          (activeTabRef.current && activeTabRef.current !== 'explorar')
        ) {
          return;
        }

        if (mapRef.current && (!userMarkerRef.current || !userBeamRef.current)) {
          ensureUserMarker(mapRef.current);
        }

        const mapBearing = mapRef.current?.getBearing() || 0;
        const beamAngle = (rawHeading - mapBearing + 360) % 360;

        if (userBeamRef.current && Math.abs(beamAngle - lastRenderedBeamAngle) >= 0.4) {
          lastRenderedBeamAngle = beamAngle;
          userBeamRef.current.style.transform = `translate3d(-50%, -50%, 0) rotate(${beamAngle.toFixed(1)}deg)`;
        }

        const compassAngle = -rawHeading;
        if (compassIconWrapperRef.current && Math.abs(compassAngle - lastRenderedCompassAngle) >= 0.4) {
          lastRenderedCompassAngle = compassAngle;
          compassIconWrapperRef.current.style.transform = `rotate(${compassAngle.toFixed(1)}deg)`;
        }
      });
      return () => {
        unsubscribeHeading();
      };
    }, [ensureUserMarker]);

    // Ensure spot click sound is pre-fetched & pre-unlocked whenever the map mounts
    useEffect(() => {
      prefetchSpotClickSound();
    }, []);

    // Keep user avatar updated if userAvatar prop changes or profile photo is updated
    useEffect(() => {
      const updateMarkerAvatar = (av?: string) => {
        if (!userAvatarImgRef.current) return;
        let resolved = av;
        if (!resolved || resolved === '/fotoperfil.png') {
          try {
            const savedUser = JSON.parse(localStorage.getItem('monvian_user') || '{}');
            const email = (savedUser?.email || savedUser?.whatsapp || '').toLowerCase();
            const username = (savedUser?.username || '').toLowerCase();
            const isMario = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(email) || username === 'marioyesk';
            if (savedUser?.avatar_url && savedUser.avatar_url.trim().length > 0) {
              if (savedUser.avatar_url !== '/fotoperfil.png' || isMario) {
                resolved = savedUser.avatar_url;
              }
            } else if (isMario) {
              resolved = '/fotoperfil.png';
            } else {
              resolved = '/loogo.png';
            }
          } catch {}
        }
        if (resolved && userAvatarImgRef.current.src !== resolved) {
          userAvatarImgRef.current.src = resolved;
        }
      };

      updateMarkerAvatar(userAvatar);

      const handleUserUpdated = (e: any) => {
        updateMarkerAvatar(e?.detail?.avatar_url || userAvatar);
      };
      window.addEventListener('monvian:user_updated', handleUserUpdated);
      return () => {
        window.removeEventListener('monvian:user_updated', handleUserUpdated);
      };
    }, [userAvatar]);

    // Sync with userCoords prop if provided externally
    useEffect(() => {
      if (!userCoords) return;
      const normalized = normalizeCoords(userCoords, latestUserCoordsRef.current);
      latestUserCoordsRef.current = normalized;
      userMarkerRef.current?.setLngLat(normalized);
    }, [userCoords]);

    // Real-Time GPS Location Subscription + Camera Accompaniment
    useEffect(() => {
      if (!activeTabRef.current || activeTabRef.current === 'explorar') {
        gpsNavigationManager.start();
      }
      let lastMarkerLng = -999;
      let lastMarkerLat = -999;
      let lastFollowedLng = -999;
      let lastFollowedLat = -999;
      let lastProximityCheckTime = 0;

      const unsubscribeGps = gpsNavigationManager.subscribe((navState) => {
        const coords = navState.interpolatedCoords || navState.coords;
        if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

        latestUserCoordsRef.current = coords;

        const isExplorarVisible = !activeTabRef.current || activeTabRef.current === 'explorar';

        if (isExplorarVisible && !isMapGestureActiveRef.current && !isZoomGestureActiveRef.current) {
          if (mapRef.current && !userMarkerRef.current) {
            ensureUserMarker(mapRef.current);
          }

          // Move the 3D user marker whenever position delta is perceptible
          if (
            userMarkerRef.current &&
            (Math.abs(coords[0] - lastMarkerLng) > 1e-7 || Math.abs(coords[1] - lastMarkerLat) > 1e-7)
          ) {
            lastMarkerLng = coords[0];
            lastMarkerLat = coords[1];
            userMarkerRef.current.setLngLat(coords);
          }

          // Fallback rotation for the blue flashlight from GPS course heading when device compass hasn't fired
          if (
            userBeamRef.current &&
            !deviceHeadingManager.hasSensorData() &&
            typeof navState.heading === 'number' &&
            !isNaN(navState.heading)
          ) {
            const mapBearing = mapRef.current?.getBearing() || 0;
            const comp = (navState.heading - mapBearing + 360) % 360;
            userBeamRef.current.style.transform = `translate3d(-50%, -50%, 0) rotate(${comp.toFixed(1)}deg)`;
          }
        }

        const now = performance.now();

        if (
          mapRef.current &&
          isExplorarVisible &&
          isFollowingUserRef.current &&
          navState.hasRealFix &&
          navState.status === 'granted' &&
          hasCenteredOnFirstFixRef.current &&
          now > followCameraGraceUntilRef.current &&
          !isMapGestureActiveRef.current &&
          !selectedSpotRef.current &&
          !isSpotlightActiveRef.current &&
          !isTransitioning3DRef.current &&
          !mapRef.current.isMoving()
        ) {
          // Continuously pan camera smoothly with interpolated real-time location while driving/walking
          if (
            Math.abs(coords[0] - lastFollowedLng) > 1e-6 ||
            Math.abs(coords[1] - lastFollowedLat) > 1e-6
          ) {
            lastFollowedLng = coords[0];
            lastFollowedLat = coords[1];
            mapRef.current.setCenter(coords);
          }
        }

        // Throttle physical proximity evaluation (~1.2s) and skip during active map drag/zoom gestures
        if (
          !isMapGestureActiveRef.current &&
          now - lastProximityCheckTime > 1200 &&
          navState.hasRealFix &&
          navState.status === 'granted' &&
          spotsRef.current &&
          spotsRef.current.length > 0
        ) {
          lastProximityCheckTime = now;
          monvianXpManager.evaluateProximity(navState, spotsRef.current).catch(() => {});
        }
      });

      return () => {
        unsubscribeGps();
      };
    }, [ensureUserMarker]);

    // Trigger overview framing all spot icons when entering or returning to the map
    useEffect(() => {
      if (isGlobeIntroActiveRef.current) return;
      if (zoomToUserTrigger && zoomToUserTrigger > 0) {
        if (
          !selectedSpotRef.current &&
          !isSpotlightActiveRef.current &&
          workflowModeRef.current === 'EXPLORE'
        ) {
          frameAllSpotsOverview(mapRef.current, false);
        }
      }
    }, [zoomToUserTrigger, frameAllSpotsOverview]);

    // Whenever returning from another tab to 'explorar', start with the overview showing all spot icons (only in EXPLORE mode)
    const prevActiveTabRef = useRef<string | undefined>(activeTab);
    useEffect(() => {
      const prev = prevActiveTabRef.current;
      prevActiveTabRef.current = activeTab;

      if (prev && prev !== 'explorar' && activeTab === 'explorar') {
        const timer = window.setTimeout(() => {
          if (
            mapRef.current &&
            !selectedSpotRef.current &&
            !isSpotlightActiveRef.current &&
            !isGlobeIntroActiveRef.current &&
            workflowModeRef.current === 'EXPLORE'
          ) {
            frameAllSpotsOverview(mapRef.current, false);
          }
        }, 100);
        return () => window.clearTimeout(timer);
      }
    }, [activeTab, frameAllSpotsOverview]);

    // Sync projection (globe during post-signup intro, flat mercator afterwards) and space backdrop
    useEffect(() => {
      const introActive = Boolean(isGlobeIntroPending || isGlobeIntroPlaying);
      const z = mapRef.current?.getZoom() ?? (introActive ? 1.1 : 11.75);
      const shouldSpace = Boolean(isGlobeIntroPending || (isGlobeIntroPlaying && z < 7.2));
      setIsSpaceBackgroundActive(shouldSpace);

      if (mapRef.current) {
        try {
          if (introActive) {
            mapRef.current.setProjection({ type: 'globe' });
            mapRef.current.setSky(getCleanSpaceSky(themeRef.current));
          } else {
            mapRef.current.setProjection({ type: 'mercator' });
            mapRef.current.setSky(undefined);
          }
        } catch {}
      }

      const userMarkerEl = userMarkerRef.current?.getElement();
      if (userMarkerEl) {
        const hideUserPin =
          workflowModeRef.current === 'ITINERARY' || Boolean(introActive && z < 4.5);
        userMarkerEl.style.transition = 'opacity 0.28s ease';
        userMarkerEl.style.opacity = hideUserPin ? '0' : '1';
        userMarkerEl.style.pointerEvents = hideUserPin ? 'none' : 'auto';
      }

      syncMarkerHighlight(selectedSpotRef.current?.id);
    }, [isGlobeIntroPending, isGlobeIntroPlaying]);

    // Choreographed Post-Signup Space-to-Location Cinematic Camera Flight (Stage A -> B -> C -> D)
    // Depends ONLY on isGlobeIntroPlaying so avatar/prop updates never interrupt or cancel mid-flight
    useEffect(() => {
      if (!isGlobeIntroPlaying) {
        hasCompletedGlobeFlightRef.current = false;
        return;
      }
      if (hasCompletedGlobeFlightRef.current) return;

      const map = mapRef.current;
      if (!map) return;

      let cancelled = false;

      const waitNextFrame = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

      const animateCamera = (
        method: 'easeTo' | 'flyTo',
        options: maplibregl.FlyToOptions | maplibregl.EaseToOptions
      ) =>
        new Promise<void>((resolve) => {
          if (cancelled) {
            resolve();
            return;
          }
          let settled = false;
          const durationMs = typeof options.duration === 'number' ? options.duration : 1100;
          const onEnd = () => {
            if (settled) return;
            settled = true;
            map.off('moveend', onEnd);
            window.clearTimeout(timerId);
            resolve();
          };
          const timerId = window.setTimeout(onEnd, durationMs + 160);
          map.on('moveend', onEnd);
          try {
            if (method === 'flyTo') {
              map.flyTo({ ...(options as maplibregl.FlyToOptions), essential: true });
            } else {
              map.easeTo({ ...(options as maplibregl.EaseToOptions), essential: true });
            }
          } catch {
            onEnd();
          }
        });

      const setInteractionsEnabled = (enabled: boolean) => {
        const handlers = [
          map.dragPan,
          map.scrollZoom,
          map.boxZoom,
          map.dragRotate,
          map.keyboard,
          map.doubleClickZoom,
          map.touchZoomRotate,
        ];
        handlers.forEach((h) => {
          try {
            if (enabled) h?.enable();
            else h?.disable();
          } catch {}
        });
      };

      const runChoreographedGlobeFlight = async () => {
        setFollowModeRef.current(false);
        setInteractionsEnabled(false);

        try {
          const prefersReduced = Boolean(
            typeof window !== 'undefined' &&
              window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
          );
          const orbitalZoom = getOrbitalEarthZoom();
          const camposTarget = getCamposOverviewCameraRef.current(map);
          const finalPitch = is3DModeRef.current ? 60 : 0;
          const finalBearing = is3DModeRef.current ? -20 : 0;

          try {
            map.setProjection({ type: 'globe' });
            map.setSky(getCleanSpaceSky(themeRef.current));
          } catch {}

          // Ensure Stage A orbital Earth framing at exact entry, then begin descent immediately
          if (Math.abs(map.getZoom() - orbitalZoom) > 0.35) {
            map.jumpTo({
              center: [-22, -10],
              zoom: orbitalZoom,
              pitch: 0,
              bearing: 0,
            });
          }

          await waitNextFrame();
          if (cancelled) return;

          if (prefersReduced) {
            await animateCamera('easeTo', {
              center: camposTarget.center,
              zoom: camposTarget.zoom,
              pitch: finalPitch,
              bearing: finalBearing,
              duration: 1050,
              easing: (t) => 1 - Math.pow(1 - t, 3),
            });
          } else {
            const smoothEase = (t: number) =>
              t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            // Stage C.1-3: Rotate gently & approach South America immediately
            await animateCamera('easeTo', {
              center: [-58.5, -16.5],
              zoom: Math.max(2.45, orbitalZoom + 1.55),
              pitch: 10,
              bearing: -4,
              duration: 1180,
              easing: smoothEase,
            });
            if (cancelled) return;

            // Stage C.4: Approach Brazil
            await animateCamera('easeTo', {
              center: [-48.6, -18.5],
              zoom: 4.5,
              pitch: 20,
              bearing: -8,
              duration: 1040,
              easing: smoothEase,
            });
            if (cancelled) return;

            // Stage B + C.5-6: Non-blocking check of real device location fix
            const gpsState = gpsNavigationManager.getState();
            const hasRealUserLocation = Boolean(
              gpsState.hasRealFix &&
                gpsState.status === 'granted' &&
                Array.isArray(gpsState.coords) &&
                Number.isFinite(gpsState.coords[0]) &&
                Number.isFinite(gpsState.coords[1])
            );

            if (hasRealUserLocation) {
              const [userLng, userLat] = gpsState.coords;
              latestUserCoordsRef.current = [userLng, userLat];
              ensureUserMarkerRef.current(map);
              userMarkerRef.current?.setLngLat([userLng, userLat]);

              const distKm =
                calculateHaversineDistance(
                  userLng,
                  userLat,
                  camposTarget.center[0],
                  camposTarget.center[1]
                ) / 1000;

              if (distKm > 18) {
                // Pass smoothly through user's identified region, then glide continuously to Campos do Jordão
                const regionalZoom = distKm > 1500 ? 5.8 : distKm > 300 ? 7.8 : 9.4;
                await animateCamera(distKm > 1500 ? 'flyTo' : 'easeTo', {
                  center: [userLng, userLat],
                  zoom: regionalZoom,
                  pitch: 26,
                  bearing: -10,
                  curve: 1.2,
                  duration: distKm > 1500 ? 1280 : 1020,
                  easing: smoothEase,
                });
                if (cancelled) return;

                // Stage D: Smooth continuous glide into Campos do Jordão
                await animateCamera(distKm > 1500 ? 'flyTo' : 'easeTo', {
                  center: camposTarget.center,
                  zoom: camposTarget.zoom,
                  pitch: finalPitch,
                  bearing: finalBearing,
                  curve: 1.15,
                  duration: distKm > 1500 ? 1380 : 1140,
                  easing: smoothEase,
                });
              } else {
                // User is already in Campos do Jordão region: state -> user area -> full spot overview
                await animateCamera('easeTo', {
                  center: [userLng, userLat],
                  zoom: 9.2,
                  pitch: 26,
                  bearing: -12,
                  duration: 920,
                  easing: smoothEase,
                });
                if (cancelled) return;

                await animateCamera('easeTo', {
                  center: camposTarget.center,
                  zoom: camposTarget.zoom,
                  pitch: finalPitch,
                  bearing: finalBearing,
                  duration: 1080,
                  easing: (t) => 1 - Math.pow(1 - t, 3),
                });
              }
            } else {
              // GPS denied or still acquiring: smooth São Paulo state -> Campos do Jordão approach
              await animateCamera('easeTo', {
                center: [-46.6, -23.15],
                zoom: 7.4,
                pitch: 26,
                bearing: -10,
                duration: 960,
                easing: smoothEase,
              });
              if (cancelled) return;

              await animateCamera('easeTo', {
                center: camposTarget.center,
                zoom: camposTarget.zoom,
                pitch: finalPitch,
                bearing: finalBearing,
                duration: 1120,
                easing: (t) => 1 - Math.pow(1 - t, 3),
              });
            }
          }

          if (cancelled) return;

          // Immediately transition from 3D Earth sphere to flat Mercator world upon arrival in Campos do Jordão
          try {
            map.setProjection({ type: 'mercator' });
            map.setSky(undefined);
          } catch {}

          hasCompletedGlobeFlightRef.current = true;
          hasFramedInitialSpotsRef.current = true;
          hasUserMovedMapRef.current = false;
          markerZoomTierRef.current = 'city';
          setIsSpaceBackgroundActive(false);
          const userMarkerEl = userMarkerRef.current?.getElement();
          if (userMarkerEl) {
            userMarkerEl.style.opacity = '1';
          }
          syncMarkerHighlight(selectedSpotRef.current?.id);
          onGlobeIntroCompleteRef.current?.();
        } finally {
          setInteractionsEnabled(true);
        }
      };

      runChoreographedGlobeFlight();

      return () => {
        cancelled = true;
        try {
          map.stop();
        } catch {}
        setInteractionsEnabled(true);
      };
    }, [isGlobeIntroPlaying]);

    // Focus camera on user marker with high spotlight zoom and hide other markers during spotlight presentation
    useEffect(() => {
      if (!isSpotlightActive) {
        markerRecordsRef.current.forEach((rec) => {
          rec.el.style.transition = 'opacity 0.45s ease';
          rec.el.style.opacity = '1';
          rec.el.style.pointerEvents = 'auto';
        });
        const userEl = userMarkerRef.current?.getElement();
        if (userEl) userEl.style.zIndex = '30';
        return;
      }

      if (mapRef.current) {
        const map = mapRef.current;
        const targetCoords =
          gpsNavigationManager.getCurrentInterpolatedCoords() ||
          latestUserCoordsRef.current ||
          CAMPOS_CENTER;
        ensureUserMarker(map);
        userMarkerRef.current?.setLngLat(targetCoords);
        const userEl = userMarkerRef.current?.getElement();
        if (userEl) userEl.style.zIndex = '10000';

        map.easeTo({
          center: targetCoords,
          zoom: 16.5,
          pitch: 0,
          bearing: 0,
          duration: 750,
        });

        markerRecordsRef.current.forEach((rec) => {
          rec.el.style.transition = 'opacity 0.3s ease';
          rec.el.style.opacity = '0';
          rec.el.style.pointerEvents = 'none';
        });
      }
    }, [isSpotlightActive, ensureUserMarker]);

    // Cleanup on unmount: destroy MapLibre instance, markers, and DOM refs completely
    useEffect(() => {
      return () => {
        if (userMarkerRef.current) {
          try {
            userMarkerRef.current.remove();
          } catch (e) {}
          userMarkerRef.current = null;
        }
        userMarkerMapRef.current = null;
        userAvatarImgRef.current = null;
        userBeamRef.current = null;
        compassIconWrapperRef.current = null;

        markerRecordsRef.current.forEach((rec) => {
          try {
            rec.marker.remove();
          } catch (e) {}
        });
        markerRecordsRef.current = [];
        itineraryMarkersRef.current.forEach((rec) => {
          try {
            rec.marker.remove();
          } catch (e) {}
        });
        itineraryMarkersRef.current = [];
        animatedSpotIdsRef.current.clear();

        if (viewportSyncRafRef.current !== null) {
          cancelAnimationFrame(viewportSyncRafRef.current);
          viewportSyncRafRef.current = null;
        }
        if (progressiveMountRafRef.current !== null) {
          cancelAnimationFrame(progressiveMountRafRef.current);
          progressiveMountRafRef.current = null;
        }
        if (programmaticZoomTimerRef.current !== null) {
          window.clearTimeout(programmaticZoomTimerRef.current);
          programmaticZoomTimerRef.current = null;
        }
        isProgrammaticZoomRef.current = false;
        if (viewportFetchTimerRef.current !== null) {
          window.clearTimeout(viewportFetchTimerRef.current);
          viewportFetchTimerRef.current = null;
        }
        if (viewportFetchAbortRef.current) {
          viewportFetchAbortRef.current.abort();
          viewportFetchAbortRef.current = null;
        }

        visualIconMarkersRef.current.forEach((m) => {
          try {
            m.remove();
          } catch (e) {}
        });
        visualIconMarkersRef.current = [];

        if (mapRef.current) {
          try {
            mapRef.current.remove();
          } catch (e) {}
          mapRef.current = null;
        }
      };
    }, []);

    // Update 3D mode pitch/bearing smoothly only when toggled after mount
    useEffect(() => {
      if (prevIs3DModeRef.current === is3DMode) return;
      prevIs3DModeRef.current = is3DMode;
      if (isGlobeIntroActiveRef.current) return;

      const map = mapRef.current;
      if (!map) return;

      const animDuration = Math.min(1400, Math.max(420, Math.round(zoomDurationMsRef.current * 0.95)));
      isTransitioning3DRef.current = true;
      const timer = window.setTimeout(() => {
        isTransitioning3DRef.current = false;
      }, animDuration + 60);

      map.easeTo({
        pitch: is3DMode ? 60 : 0,
        bearing: is3DMode ? -20 : 0,
        duration: animDuration,
        easing: smoothCameraEase,
      });

      return () => {
        window.clearTimeout(timer);
      };
    }, [is3DMode, smoothCameraEase]);

    // Helper: Build a smooth Apple iOS 5-pointed star path with softened vertices
    const buildRoundedStarPath = useCallback(
      (cx: number, cy: number, outerR: number, innerR: number, roundness: number = 0.16, precision: number = 2): string => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? outerR : innerR;
          pts.push({
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
          });
        }

        const fmt = (n: number) => Number(n.toFixed(precision));
        const segments: string[] = [];

        for (let i = 0; i < 10; i++) {
          const prev = pts[(i + 9) % 10];
          const curr = pts[i];
          const next = pts[(i + 1) % 10];
          const t = i % 2 === 0 ? roundness : roundness * 0.85;

          const ax = curr.x + t * (prev.x - curr.x);
          const ay = curr.y + t * (prev.y - curr.y);
          const bx = curr.x + t * (next.x - curr.x);
          const by = curr.y + t * (next.y - curr.y);

          if (i === 0) {
            segments.push(`M ${fmt(ax)} ${fmt(ay)}`);
          } else {
            segments.push(`L ${fmt(ax)} ${fmt(ay)}`);
          }
          segments.push(`Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(bx)} ${fmt(by)}`);
        }
        segments.push('Z');
        return segments.join(' ');
      },
      []
    );

    // Spots marker configuration: all spots render in normal clean circular configuration
    const isFiveStarSpot = useCallback((_spot: Spot): boolean => {
      return false;
    }, []);

    const itineraryMarkersRef = useRef<{
      stepId: string;
      order: number;
      lat: number;
      lng: number;
      isSelected: boolean;
      mapInstance: maplibregl.Map;
      marker: maplibregl.Marker;
      el: HTMLDivElement;
      badgeEl: HTMLDivElement;
    }[]>([]);
    const markerRecordsRef = useRef<{
      spotId: string;
      spot: Spot;
      isStar: boolean;
      mapInstance: maplibregl.Map;
      marker: maplibregl.Marker;
      el: HTMLDivElement;
      containerEl: HTMLDivElement;
      pulseScaleWrapEl: HTMLDivElement;
      badgeEl: HTMLDivElement;
      pulseEl: HTMLDivElement;
      orderBadgeEl: HTMLDivElement;
      imgEl: HTMLImageElement;
      lat: number;
      lng: number;
      imgUrl: string;
      lastSelectedState?: boolean;
      lastHiddenState?: boolean;
      lastZoomTier?: 'orbital' | 'regional' | 'city';
      lastSelectRank?: number;
      lastWorkflowMode?: MapWorkflowMode;
      lastHasAnySelection?: boolean;
    }[]>([]);
    const lastUserHighlightKeyRef = useRef<string>('');
    const animatedSpotIdsRef = useRef<Set<string>>(new Set());
    const activeMarkerAnimationsRef = useRef<WeakMap<HTMLElement, Animation>>(
      new WeakMap()
    );

    const animateMarkerPress = useCallback(
      (badgeEl: HTMLDivElement, isPressed: boolean) => {
        const prev = activeMarkerAnimationsRef.current.get(badgeEl);
        if (prev) {
          try {
            prev.cancel();
          } catch {}
        }
        try {
          const anim = badgeEl.animate(
            [{ transform: isPressed ? 'scale(1)' : 'scale(0.92)' }, { transform: isPressed ? 'scale(0.92)' : 'scale(1)' }],
            {
              duration: isPressed ? 75 : 140,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              fill: 'forwards',
            }
          );
          activeMarkerAnimationsRef.current.set(badgeEl, anim);
        } catch {}
      },
      []
    );

    const selectedSpotRef = useRef<Spot | null>(selectedSpot);
    useEffect(() => {
      selectedSpotRef.current = selectedSpot;
    }, [selectedSpot]);

    // Trigger short haptic feedback + compositor-only ephemeral ripple (zero JS frame contention during zoom)
    const triggerPinTapFeedback = useCallback(
      (
        containerEl: HTMLDivElement,
        badgeEl: HTMLDivElement,
        isStar: boolean
      ) => {
        triggerHapticFeedback(14);

        const prev = activeMarkerAnimationsRef.current.get(badgeEl);
        if (prev) {
          try {
            prev.cancel();
          } catch {}
        }
        try {
          badgeEl.style.transform = 'scale(1)';
        } catch {}

        const markerSize = isStar ? 54 : 42;
        const rippleEl = document.createElement('div');
        rippleEl.style.position = 'absolute';
        rippleEl.style.width = `${markerSize}px`;
        rippleEl.style.height = `${markerSize}px`;
        rippleEl.style.top = '0';
        rippleEl.style.left = '0';
        rippleEl.style.borderRadius = '9999px';
        rippleEl.style.pointerEvents = 'none';
        rippleEl.style.zIndex = '-1';
        rippleEl.style.border = isStar
          ? '2px solid rgba(255, 214, 10, 0.92)'
          : '2px solid rgba(255, 255, 255, 0.9)';
        rippleEl.style.backgroundColor = isStar
          ? 'rgba(255, 214, 10, 0.18)'
          : 'rgba(255, 255, 255, 0.14)';
        containerEl.appendChild(rippleEl);

        try {
          const anim = rippleEl.animate(
            [
              { transform: 'scale(0.95)', opacity: 0.85 },
              { transform: 'scale(1.95)', opacity: 0 },
            ],
            {
              duration: 360,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              fill: 'forwards',
            }
          );
          anim.onfinish = () => {
            try {
              rippleEl.remove();
            } catch {}
          };
        } catch {
          window.setTimeout(() => {
            try {
              rippleEl.remove();
            } catch {}
          }, 380);
        }
      },
      []
    );

    // Synchronize marker highlights smoothly without touching unchanged DOM nodes
    const syncMarkerHighlight = useCallback((activeSpotId: string | null | undefined) => {
      const mode = workflowModeRef.current;
      const focusActive = mode === 'EXPLORE' && isFocusModeRef.current;
      const zoomTier = markerZoomTierRef.current;
      const hideForIntroFlight = Boolean(isGlobeIntroActiveRef.current && zoomTier !== 'city');
      const zoomScale =
        zoomTier === 'orbital' ? 0.46 : zoomTier === 'regional' ? 0.68 : 0.96;

      const selectedList = selectedSpotIdsRef.current || [];
      const selectedRankMap = new Map<string, number>();
      for (let i = 0; i < selectedList.length; i++) {
        selectedRankMap.set(selectedList[i], i + 1);
      }

      const hasAnySelection = mode === 'SELECT' && selectedRankMap.size > 0;

      markerRecordsRef.current.forEach((rec) => {
        const selectRank = mode === 'SELECT' ? (selectedRankMap.get(rec.spotId) || 0) : 0;
        const isSelected =
          mode === 'SELECT'
            ? selectRank > 0
            : activeSpotId
              ? rec.spotId === activeSpotId
              : false;
        const shouldHideMarker =
          mode === 'ITINERARY' ||
          hideForIntroFlight ||
          (focusActive && !isSelected);

        if (
          rec.lastSelectedState === isSelected &&
          rec.lastHiddenState === shouldHideMarker &&
          rec.lastZoomTier === zoomTier &&
          rec.lastSelectRank === selectRank &&
          rec.lastWorkflowMode === mode &&
          rec.lastHasAnySelection === hasAnySelection
        ) {
          return;
        }

        const selectionChanged =
          rec.lastSelectedState !== isSelected ||
          rec.lastSelectRank !== selectRank ||
          rec.lastWorkflowMode !== mode;
        rec.lastSelectedState = isSelected;
        rec.lastHiddenState = shouldHideMarker;
        rec.lastZoomTier = zoomTier;
        rec.lastSelectRank = selectRank;
        rec.lastWorkflowMode = mode;
        rec.lastHasAnySelection = hasAnySelection;

        rec.containerEl.style.transition =
          'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s cubic-bezier(0.22, 1, 0.36, 1)';
        rec.containerEl.style.opacity = shouldHideMarker
          ? '0'
          : mode === 'SELECT' && selectedRankMap.size > 0 && !isSelected
            ? '0.82'
            : '1';
        rec.containerEl.style.transform = shouldHideMarker
          ? 'translate3d(0,0,0) scale(0.62)'
          : isSelected
            ? mode === 'SELECT'
              ? 'translate3d(0,0,0) scale(1.16)'
              : 'translate3d(0,0,0) scale(1.22)'
            : `translate3d(0,0,0) scale(${zoomScale})`;
        rec.containerEl.style.zIndex = isSelected ? '50' : '20';
        rec.el.style.pointerEvents = shouldHideMarker ? 'none' : 'auto';

        if (selectionChanged) {
          if (rec.isStar) {
            if (isSelected) {
              rec.pulseScaleWrapEl.classList.add('is-selected');
            } else {
              rec.pulseScaleWrapEl.classList.remove('is-selected');
            }
          } else if (mode === 'SELECT' && isSelected) {
            rec.badgeEl.style.border = '3px solid #FFFFFF';
            rec.badgeEl.style.boxShadow =
              '0 8px 20px rgba(0, 0, 0, 0.42), 0 0 0 3px rgba(0, 0, 0, 0.85)';
          } else {
            rec.badgeEl.style.border = isSelected
              ? '3px solid #FFFFFF'
              : '2.5px solid #FFFFFF';
            rec.badgeEl.style.boxShadow = isSelected
              ? '0 8px 20px rgba(0, 0, 0, 0.38), 0 0 0 2px rgba(255, 255, 255, 0.92)'
              : '0 4px 10px rgba(0, 0, 0, 0.30)';
          }

          if (rec.pulseEl) {
            rec.pulseEl.style.background = rec.isStar
              ? 'radial-gradient(circle, rgba(255, 214, 10, 0.72) 0%, rgba(250, 204, 21, 0.25) 55%, transparent 75%)'
              : 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
            rec.pulseEl.style.display = isSelected ? 'block' : 'none';
          }

          if (rec.orderBadgeEl) {
            if (mode === 'SELECT' && selectRank > 0) {
              rec.orderBadgeEl.textContent = String(selectRank);
              rec.orderBadgeEl.style.display = 'flex';
            } else {
              rec.orderBadgeEl.style.display = 'none';
            }
          }
        }
      });

      const userHighlightKey = `${focusActive ? 1 : 0}:${zoomTier}:${mode}`;
      if (lastUserHighlightKeyRef.current !== userHighlightKey) {
        lastUserHighlightKeyRef.current = userHighlightKey;
        if (userMarkerStackRef.current) {
          const userZoomScale = zoomTier === 'orbital' ? 0.62 : zoomTier === 'regional' ? 0.82 : 1;
          userMarkerStackRef.current.style.transition =
            'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
          userMarkerStackRef.current.style.opacity = focusActive ? '0' : '1';
          userMarkerStackRef.current.style.transform = focusActive
            ? 'scale(0.76)'
            : `scale(${userZoomScale})`;
          userMarkerStackRef.current.style.pointerEvents = focusActive ? 'none' : 'auto';
        }

        if (userBeamRef.current) {
          userBeamRef.current.style.transition = 'opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
          userBeamRef.current.style.opacity = focusActive || zoomTier !== 'city' ? '0' : '1';
        }
      }
    }, []);

    // Listen for Monvian iOS Minimalist Discovery Indicator & Radar on Tourist Spot Markers
    useEffect(() => {
      let activeProximitySpotId: string | null = null;

      const cleanupSpotDiscoveryNodes = (spotId: string) => {
        const rec = markerRecordsRef.current.find((r) => r.spotId === spotId);
        if (!rec) return;
        const existingRing = rec.containerEl.querySelector('.monvian-xp-charge-ring');
        if (existingRing) {
          existingRing.remove();
        }
        const existingRadar = rec.containerEl.querySelector('.monvian-spot-radar-wrap');
        if (existingRadar) {
          existingRadar.remove();
        }
      };

      const ensureSpotRadarIndicator = (spotId: string, progress: number) => {
        // If target spot changed, clean up previous spot's radar indicator
        if (activeProximitySpotId && activeProximitySpotId !== spotId) {
          cleanupSpotDiscoveryNodes(activeProximitySpotId);
        }
        activeProximitySpotId = spotId;

        const rec = markerRecordsRef.current.find((r) => r.spotId === spotId);
        if (!rec) return;

        let radarWrap = rec.containerEl.querySelector<HTMLDivElement>('.monvian-spot-radar-wrap');
        const radius = 24;
        const circumference = 2 * Math.PI * radius;

        if (!radarWrap) {
          radarWrap = document.createElement('div');
          radarWrap.className = 'monvian-spot-radar-wrap';
          radarWrap.style.position = 'absolute';
          radarWrap.style.width = '56px';
          radarWrap.style.height = '56px';
          radarWrap.style.top = '-7px';
          radarWrap.style.left = '-7px';
          radarWrap.style.pointerEvents = 'none';
          radarWrap.style.zIndex = '55';

          radarWrap.innerHTML = `
            <svg viewBox="0 0 56 56" style="position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible;">
              <circle
                class="monvian-spot-proximity-arc"
                cx="28"
                cy="28"
                r="${radius}"
                fill="none"
                stroke="#007AFF"
                stroke-width="3"
                stroke-linecap="round"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${circumference * (1 - Math.max(0.18, Math.min(1, progress)))}"
                style="transition: stroke-dashoffset 320ms cubic-bezier(0.22, 1, 0.36, 1);"
              />
            </svg>
          `;
          rec.containerEl.appendChild(radarWrap);
        } else {
          const arcEl = radarWrap.querySelector<SVGCircleElement>('.monvian-spot-proximity-arc');
          if (arcEl) {
            const clamped = Math.max(0.18, Math.min(1, progress));
            arcEl.style.strokeDashoffset = `${circumference * (1 - clamped)}`;
          }
        }
      };

      const handleProximityUpdate = (e: any) => {
        const detail = e?.detail;
        if (!detail || !detail.spotId) {
          if (activeProximitySpotId) {
            cleanupSpotDiscoveryNodes(activeProximitySpotId);
            activeProximitySpotId = null;
          }
          return;
        }
        ensureSpotRadarIndicator(detail.spotId, typeof detail.progress === 'number' ? detail.progress : 0.35);
      };

      const handleDiscoveryStart = (e: any) => {
        const detail = e?.detail;
        if (!detail || !detail.spotId) return;
        const rec = markerRecordsRef.current.find((r) => r.spotId === detail.spotId);
        if (!rec) return;

        ensureSpotRadarIndicator(detail.spotId, 0.92);

        const existingRing = rec.containerEl.querySelector('.monvian-xp-charge-ring');
        if (existingRing) existingRing.remove();

        const durationMs = detail.durationMs || 1500;
        rec.containerEl.style.zIndex = '150';

        // Minimalist iOS Blue circular progress ring around the pin (56x56 wrapping the 42x42 marker)
        const ringWrap = document.createElement('div');
        ringWrap.className = 'monvian-xp-charge-ring';
        ringWrap.style.position = 'absolute';
        ringWrap.style.width = '56px';
        ringWrap.style.height = '56px';
        ringWrap.style.top = '-7px';
        ringWrap.style.left = '-7px';
        ringWrap.style.pointerEvents = 'none';
        ringWrap.style.zIndex = '60';

        const radius = 24;
        const circumference = 2 * Math.PI * radius;

        ringWrap.innerHTML = `
          <svg viewBox="0 0 56 56" style="width:100%;height:100%;transform:rotate(-90deg);overflow:visible;">
            <circle
              class="xp-ring-progress-circle"
              cx="28"
              cy="28"
              r="${radius}"
              fill="none"
              stroke="#007AFF"
              stroke-width="3"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
            />
          </svg>
        `;

        rec.containerEl.appendChild(ringWrap);

        const circleEl = ringWrap.querySelector<SVGCircleElement>('.xp-ring-progress-circle');
        if (circleEl) {
          try {
            circleEl.animate(
              [
                { strokeDashoffset: `${circumference}` },
                { strokeDashoffset: '0' },
              ],
              {
                duration: durationMs,
                easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
                fill: 'forwards',
              }
            );
          } catch {}
        }

        // Smooth, subtle iOS elevation scale on the pin
        try {
          rec.pulseScaleWrapEl.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.08)', offset: 0.6 },
              { transform: 'scale(1.10)' },
            ],
            {
              duration: durationMs,
              easing: 'ease-in-out',
              fill: 'forwards',
            }
          );
        } catch {}
      };

      const handleDiscoveryCancel = (e: any) => {
        const spotId = e?.detail?.spotId;
        if (!spotId) return;
        const rec = markerRecordsRef.current.find((r) => r.spotId === spotId);
        if (!rec) return;
        const existingRing = rec.containerEl.querySelector('.monvian-xp-charge-ring');
        if (existingRing) existingRing.remove();
      };

      const handleXpAwarded = (e: any) => {
        const detail = e?.detail;
        if (!detail || !detail.spotId) return;
        const rec = markerRecordsRef.current.find((r) => r.spotId === detail.spotId);
        if (!rec) return;

        cleanupSpotDiscoveryNodes(detail.spotId);
        rec.containerEl.style.zIndex = '180';

        // 1. Immediate elastic vertical jump + scale pulse on the discovered spot pin
        try {
          rec.pulseScaleWrapEl.animate(
            [
              { transform: 'translateY(0px) scale(1.06)' },
              { transform: 'translateY(-26px) scale(1.28)', offset: 0.36 },
              { transform: 'translateY(3px) scale(0.94)', offset: 0.72 },
              { transform: 'translateY(-5px) scale(1.04)', offset: 0.88 },
              { transform: 'translateY(0px) scale(1)' },
            ],
            {
              duration: 720,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              fill: 'forwards',
            }
          );
        } catch {}

        // 2. Clean ephemeral iOS Blue expansion wave around the discovered spot
        try {
          const waveSize = rec.isStar ? 54 : 42;
          const xpWave = document.createElement('div');
          xpWave.style.position = 'absolute';
          xpWave.style.width = `${waveSize}px`;
          xpWave.style.height = `${waveSize}px`;
          xpWave.style.top = '0';
          xpWave.style.left = '0';
          xpWave.style.borderRadius = '9999px';
          xpWave.style.pointerEvents = 'none';
          xpWave.style.zIndex = '-1';
          xpWave.style.border = '2px solid #007AFF';
          xpWave.style.background = 'radial-gradient(circle, rgba(0, 122, 255, 0.22) 0%, rgba(0, 122, 255, 0) 70%)';
          rec.containerEl.appendChild(xpWave);
          xpWave.animate(
            [
              { transform: 'scale(1)', opacity: 0.95 },
              { transform: 'scale(2.45)', opacity: 0 },
            ],
            {
              duration: 780,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }
          );
          window.setTimeout(() => {
            try {
              xpWave.remove();
            } catch {}
          }, 820);
        } catch {}
      };

      window.addEventListener('monvian:xp_proximity_update', handleProximityUpdate);
      window.addEventListener('monvian:xp_discovery_start', handleDiscoveryStart);
      window.addEventListener('monvian:xp_discovery_cancel', handleDiscoveryCancel);
      window.addEventListener('monvian:xp_awarded', handleXpAwarded);
      return () => {
        window.removeEventListener('monvian:xp_proximity_update', handleProximityUpdate);
        window.removeEventListener('monvian:xp_discovery_start', handleDiscoveryStart);
        window.removeEventListener('monvian:xp_discovery_cancel', handleDiscoveryCancel);
        window.removeEventListener('monvian:xp_awarded', handleXpAwarded);
      };
    }, []);

    // Synchronize GeoJSON polyline connecting stops in ITINERARY mode
    const syncItineraryRouteLayers = useCallback((targetMap?: maplibregl.Map | null) => {
      const map = targetMap || mapRef.current;
      if (!map) return;

      const ROUTE_SOURCE_ID = 'monvian-itinerary-route-source';
      const GLOW_LAYER_ID = 'monvian-itinerary-route-glow';
      const CASING_LAYER_ID = 'monvian-itinerary-route-casing';
      const LINE_LAYER_ID = 'monvian-itinerary-route-line';

      const isItinMode = workflowModeRef.current === 'ITINERARY';
      const steps = itineraryStepsRef.current || [];

      const coords: [number, number][] = [];
      if (isItinMode) {
        for (let i = 0; i < steps.length; i++) {
          const lat = Number(steps[i].spot?.lat ?? steps[i].lat);
          const lng = Number(steps[i].spot?.lng ?? steps[i].lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            coords.push([lng, lat]);
          }
        }
      }

      const routeGeoJson: any = {
        type: 'FeatureCollection',
        features:
          coords.length >= 2
            ? [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: coords,
                  },
                },
              ]
            : [],
      };

      const ensureItineraryLayers = () => {
        if (!map.getSource(ROUTE_SOURCE_ID)) {
          map.addSource(ROUTE_SOURCE_ID, {
            type: 'geojson',
            data: routeGeoJson,
          });
        } else {
          (map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(routeGeoJson);
        }

        const glowColor = '#FFFFFF';
        const lineColor = '#FFFFFF';
        const casingColor = 'rgba(0, 0, 0, 0.28)';

        if (!map.getLayer(GLOW_LAYER_ID)) {
          map.addLayer({
            id: GLOW_LAYER_ID,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': glowColor,
              'line-width': 11,
              'line-opacity': 0.24,
              'line-blur': 4,
            },
          });
        } else {
          map.setPaintProperty(GLOW_LAYER_ID, 'line-color', glowColor);
        }

        if (!map.getLayer(CASING_LAYER_ID)) {
          map.addLayer({
            id: CASING_LAYER_ID,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': casingColor,
              'line-width': 6.5,
              'line-opacity': 0.9,
            },
          });
        } else {
          map.setPaintProperty(CASING_LAYER_ID, 'line-color', casingColor);
        }

        if (!map.getLayer(LINE_LAYER_ID)) {
          map.addLayer({
            id: LINE_LAYER_ID,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': lineColor,
              'line-width': 3.5,
              'line-opacity': 1,
            },
          });
        } else {
          map.setPaintProperty(LINE_LAYER_ID, 'line-color', lineColor);
        }
      };

      try {
        if (map.isStyleLoaded()) {
          ensureItineraryLayers();
        } else if (map.getSource(ROUTE_SOURCE_ID)) {
          (map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(routeGeoJson);
        }
      } catch {}
    }, []);

    // True Viewport-Based Marker Virtualization + Unified Workflow Modes:
    // - EXPLORE & SELECT: viewport-filtered circular photo pins directly on map (zero numbered cluster circles)
    // - ITINERARY: clears unrelated explore pins and renders ONLY numbered stop markers (01, 02...) + GeoJSON polyline
    const syncSpotMarkers = useCallback((onlySpotId?: string | null) => {
      const map = mapRef.current;
      if (!map) return;

      const mode = workflowModeRef.current;
      const zoom = map.getZoom();

      const clearAllExploreMarkers = () => {
        if (markerRecordsRef.current.length > 0) {
          markerRecordsRef.current.forEach((rec) => {
            try {
              rec.marker.remove();
            } catch {}
          });
          markerRecordsRef.current = [];
        }
      };

      const clearAllItineraryMarkers = () => {
        if (itineraryMarkersRef.current.length > 0) {
          itineraryMarkersRef.current.forEach((rec) => {
            try {
              rec.marker.remove();
            } catch {}
          });
          itineraryMarkersRef.current = [];
        }
      };

      if (!onlySpotId && progressiveMountRafRef.current !== null) {
        cancelAnimationFrame(progressiveMountRafRef.current);
        progressiveMountRafRef.current = null;
      }

      // Never run full DOM creation/teardown while fingers are pinching or auto-zoom camera is animating
      if (!onlySpotId && (isZoomGestureActiveRef.current || isProgrammaticZoomRef.current)) return;

      // Do not mount city markers while camera is in orbital Earth space during intro flight
      if (isGlobeIntroActiveRef.current && zoom < 5.5) {
        clearAllExploreMarkers();
        clearAllItineraryMarkers();
        return;
      }

      // ================================================================
      // MODE 3: ITINERARY MODE — Only sequential numbered stops & polyline
      // ================================================================
      if (mode === 'ITINERARY') {
        clearAllExploreMarkers();

        const userMarkerEl = userMarkerRef.current?.getElement();
        if (userMarkerEl) {
          userMarkerEl.style.opacity = '0';
          userMarkerEl.style.pointerEvents = 'none';
        }

        const steps = itineraryStepsRef.current || [];
        const activeId = activeItineraryStepIdRef.current;

        clearAllItineraryMarkers();

        steps.forEach((step, idx) => {
          const lat = Number(step.spot?.lat ?? step.lat);
          const lng = Number(step.spot?.lng ?? step.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          const isSelected = activeId ? step.id === activeId : idx === 0;
          const el = document.createElement('div');
          el.className = 'monvian-itinerary-stop-marker cursor-pointer select-none';
          el.style.touchAction = 'none';
          el.style.contain = 'layout style';
          el.style.zIndex = isSelected ? '60' : '30';

          const wrapEl = document.createElement('div');
          wrapEl.style.display = 'flex';
          wrapEl.style.flexDirection = 'column';
          wrapEl.style.alignItems = 'center';
          wrapEl.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
          wrapEl.style.transform = isSelected ? 'scale(1.1)' : 'scale(1)';

          const badgeEl = document.createElement('div');
          badgeEl.style.width = isSelected ? '38px' : '32px';
          badgeEl.style.height = isSelected ? '38px' : '32px';
          badgeEl.style.borderRadius = '9999px';
          badgeEl.style.display = 'flex';
          badgeEl.style.alignItems = 'center';
          badgeEl.style.justifyContent = 'center';
          badgeEl.style.fontWeight = '800';
          badgeEl.style.fontSize = isSelected ? '13.5px' : '11.5px';
          badgeEl.style.letterSpacing = '-0.02em';
          badgeEl.style.fontFamily =
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';

          badgeEl.style.background = '#FFFFFF';
          badgeEl.style.color = '#111111';
          badgeEl.style.border = isSelected
            ? '1px solid rgba(0, 0, 0, 0.08)'
            : '1px solid rgba(0, 0, 0, 0.06)';
          badgeEl.style.boxShadow = isSelected
            ? '0 8px 22px rgba(0, 0, 0, 0.16), 0 0 0 6px rgba(255, 255, 255, 0.48)'
            : '0 4px 12px rgba(0, 0, 0, 0.12)';
          badgeEl.textContent = String(idx + 1).padStart(2, '0');

          const tipEl = document.createElement('div');
          tipEl.style.width = '0';
          tipEl.style.height = '0';
          tipEl.style.borderLeft = '5px solid transparent';
          tipEl.style.borderRight = '5px solid transparent';
          tipEl.style.borderTop = '6px solid #FFFFFF';
          tipEl.style.marginTop = '-1px';
          tipEl.style.filter = 'drop-shadow(0 2px 3px rgba(0,0,0,0.12))';

          wrapEl.appendChild(badgeEl);
          wrapEl.appendChild(tipEl);
          el.appendChild(wrapEl);

          el.onclick = (e) => {
            e.stopPropagation();
            if (isMapGestureActiveRef.current || isZoomGestureActiveRef.current) return;
            unlockSpotClickSound();
            playSpotClickSound();
            triggerHapticFeedback(14);
            if (onSelectItineraryStepRef.current) {
              onSelectItineraryStepRef.current(step.id);
            }
            focusItineraryStepOnMap(step);
          };

          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(map);

          itineraryMarkersRef.current.push({
            stepId: step.id,
            order: idx + 1,
            lat,
            lng,
            isSelected,
            mapInstance: map,
            marker,
            el,
            badgeEl,
          });
        });

        syncItineraryRouteLayers(map);
        return;
      }

      // ================================================================
      // MODES 1 & 2: EXPLORE & SELECT — Viewport virtualization (Direct circular photo pins)
      // ================================================================
      const userMarkerEl = userMarkerRef.current?.getElement();
      if (userMarkerEl && !isGlobeIntroActiveRef.current) {
        userMarkerEl.style.opacity = '1';
        userMarkerEl.style.pointerEvents = 'auto';
      }
      clearAllItineraryMarkers();
      syncItineraryRouteLayers(map);

      const currentSelectedId = mode === 'EXPLORE' ? selectedSpotRef.current?.id || null : null;
      const currentRouteSpotId = mode === 'EXPLORE' ? activeRouteRef.current?.spotId || null : null;
      const selectedSet = new Set(mode === 'SELECT' ? selectedSpotIdsRef.current || [] : []);
      const currentSpots = spotsRef.current || [];

      const isProtectedSpot = (spotId: string): boolean =>
        spotId === currentSelectedId ||
        spotId === currentRouteSpotId ||
        selectedSet.has(spotId);

      const validSpots = currentSpots.filter(
        (s) =>
          typeof s.lng === 'number' &&
          !isNaN(s.lng) &&
          typeof s.lat === 'number' &&
          !isNaN(s.lat)
      );
      const validSpotsById = new Map<string, Spot>();
      for (let i = 0; i < validSpots.length; i++) {
        validSpotsById.set(validSpots[i].id, validSpots[i]);
      }

      let enterBounds: GeoBounds | null = null;
      let exitBounds: GeoBounds | null = null;

      if (!onlySpotId) {
        try {
          const rawBounds = map.getBounds();
          const sw = rawBounds.getSouthWest();
          const ne = rawBounds.getNorthEast();
          const latSpan = Math.max(0.004, ne.lat - sw.lat);
          const lngSpan = Math.max(0.004, ne.lng - sw.lng);

          // Enter margin (~25%, min 0.006 deg): pre-mounts pins slightly before entering screen
          const enterLatPad = Math.max(0.006, latSpan * 0.25);
          const enterLngPad = Math.max(0.006, lngSpan * 0.25);
          enterBounds = {
            minLat: sw.lat - enterLatPad,
            maxLat: ne.lat + enterLatPad,
            minLng: sw.lng - enterLngPad,
            maxLng: ne.lng + enterLngPad,
          };

          // Exit margin (~48%, min 0.014 deg): hysteresis buffer prevents edge thrashing while panning
          const exitLatPad = Math.max(0.014, latSpan * 0.48);
          const exitLngPad = Math.max(0.014, lngSpan * 0.48);
          exitBounds = {
            minLat: sw.lat - exitLatPad,
            maxLat: ne.lat + exitLatPad,
            minLng: sw.lng - exitLngPad,
            maxLng: ne.lng + exitLngPad,
          };
        } catch {
          enterBounds = null;
          exitBounds = null;
        }
      }

      const isInsideGeoBounds = (lat: number, lng: number, b: GeoBounds | null): boolean => {
        if (!b) return true;
        return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
      };

      // Step 1: Unmount markers removed or exited extended viewport buffer (skipped during single-pin mount)
      if (!onlySpotId) {
        markerRecordsRef.current = markerRecordsRef.current.filter((rec) => {
          const latestSpot = validSpotsById.get(rec.spotId);
          if (!latestSpot || rec.mapInstance !== map) {
            try {
              rec.marker.remove();
            } catch {}
            return false;
          }
          const lat = Number(latestSpot.lat);
          const lng = Number(latestSpot.lng);
          if (!isProtectedSpot(rec.spotId) && !isInsideGeoBounds(lat, lng, exitBounds)) {
            try {
              rec.marker.remove();
            } catch {}
            return false;
          }
          return true;
        });

        try {
          const c = map.getCenter();
          lastMarkerSyncCenterRef.current = { lng: c.lng, lat: c.lat };
        } catch {}
      }

      const existingMap = new Map(markerRecordsRef.current.map((rec) => [rec.spotId, rec]));

      if (!cachedStarPath100Ref.current) {
        cachedStarPath100Ref.current = buildRoundedStarPath(50, 51, 47, 22, 0.16, 2);
      }
      const starPath100 = cachedStarPath100Ref.current;
      const starClipPolygon =
        'polygon(50% 4%, 64% 34%, 97% 38%, 72% 60%, 79% 93%, 50% 76%, 21% 93%, 28% 60%, 3% 38%, 36% 34%)';

      const pendingToMount: Spot[] = [];

      // Step 2: Update already-mounted pins in-place and queue newly entering viewport pins
      if (onlySpotId) {
        if (!existingMap.has(onlySpotId)) {
          const singleSpot = validSpotsById.get(onlySpotId);
          if (singleSpot) {
            pendingToMount.push(singleSpot);
          }
        }
      } else {
        for (let i = 0; i < validSpots.length; i++) {
          const spot = validSpots[i];
          const lng = Number(spot.lng);
          const lat = Number(spot.lat);
          const existing = existingMap.get(spot.id);
          const protectedPin = isProtectedSpot(spot.id);

          if (existing && existing.mapInstance === map) {
            const imgUrl = getSpotPinThumbnail(spot);
            const isStar = isFiveStarSpot(spot);
            if (existing.isStar !== isStar) {
              try {
                existing.marker.remove();
              } catch {}
              markerRecordsRef.current = markerRecordsRef.current.filter((r) => r.spotId !== spot.id);
              animatedSpotIdsRef.current.delete(spot.id);
              pendingToMount.push(spot);
            } else {
              existing.spot = spot;
              if (!existing.el.isConnected) {
                existing.marker.addTo(map);
              }
              if (existing.lng !== lng || existing.lat !== lat) {
                existing.marker.setLngLat([lng, lat]);
                existing.lng = lng;
                existing.lat = lat;
              }
              if (existing.imgUrl !== imgUrl) {
                existing.imgEl.src = imgUrl;
                existing.imgUrl = imgUrl;
              }
            }
          } else if (protectedPin || isInsideGeoBounds(lat, lng, enterBounds)) {
            pendingToMount.push(spot);
          }
        }
      }

      const mountSpotPin = (spot: Spot) => {
        const lng = Number(spot.lng);
        const lat = Number(spot.lat);
        const imgUrl = getSpotPinThumbnail(spot);
        const isStar = isFiveStarSpot(spot);
        const isSelected =
          workflowModeRef.current === 'SELECT'
            ? selectedSet.has(spot.id)
            : currentSelectedId === spot.id;

        const el = document.createElement('div');
        el.className = 'monvian-explore-marker group cursor-pointer select-none';
        el.style.touchAction = 'none';
        el.style.contain = 'layout style';
        el.setAttribute('data-spot-id', spot.id);

        const containerEl = document.createElement('div');
        containerEl.style.position = 'relative';
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.alignItems = 'center';
        containerEl.style.justifyContent = 'center';
        containerEl.style.transform = isSelected ? 'scale(1.18)' : 'scale(0.96)';
        containerEl.style.zIndex = isSelected ? '50' : '20';

        animatedSpotIdsRef.current.add(spot.id);

        const markerSize = isStar ? 54 : 42;
        const auraOffset = isStar ? -7 : -13;

        const pulseEl = document.createElement('div');
        pulseEl.style.position = 'absolute';
        pulseEl.style.width = '68px';
        pulseEl.style.height = '68px';
        pulseEl.style.borderRadius = '9999px';
        pulseEl.style.top = `${auraOffset}px`;
        pulseEl.style.left = `${auraOffset}px`;
        pulseEl.style.pointerEvents = 'none';
        pulseEl.style.zIndex = '-1';
        pulseEl.style.background = isStar
          ? 'radial-gradient(circle, rgba(255, 214, 10, 0.72) 0%, rgba(250, 204, 21, 0.25) 55%, transparent 75%)'
          : 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
        pulseEl.style.display = isSelected ? 'block' : 'none';

        const pulseScaleWrapEl = document.createElement('div');
        pulseScaleWrapEl.style.position = 'relative';
        pulseScaleWrapEl.style.display = 'flex';
        pulseScaleWrapEl.style.alignItems = 'center';
        pulseScaleWrapEl.style.justifyContent = 'center';
        if (isStar) {
          pulseScaleWrapEl.className = isSelected
            ? 'monvian-star-pulse is-selected'
            : 'monvian-star-pulse';
        }

        const badgeEl = document.createElement('div');
        badgeEl.style.position = 'relative';
        badgeEl.style.width = `${markerSize}px`;
        badgeEl.style.height = `${markerSize}px`;
        badgeEl.style.display = 'flex';
        badgeEl.style.alignItems = 'center';
        badgeEl.style.justifyContent = 'center';

        const imgEl = document.createElement('img');
        imgEl.src = imgUrl;
        imgEl.alt = spot.name || 'Ponto Turístico';
        imgEl.loading = 'lazy';
        imgEl.decoding = 'async';
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        imgEl.style.objectFit = 'cover';
        imgEl.style.objectPosition = 'center';
        imgEl.style.display = 'block';
        imgEl.style.pointerEvents = 'none';
        imgEl.referrerPolicy = 'no-referrer';
        imgEl.onerror = () => {
          imgEl.src = getSpotFallbackImage(spot.name, spot.category);
        };

        if (isStar) {
          const starBgSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          starBgSvg.setAttribute('viewBox', '0 0 100 104');
          starBgSvg.style.position = 'absolute';
          starBgSvg.style.inset = '0';
          starBgSvg.style.width = '100%';
          starBgSvg.style.height = '100%';
          starBgSvg.style.overflow = 'visible';
          starBgSvg.style.pointerEvents = 'none';
          starBgSvg.innerHTML = `<path d="${starPath100}" transform="translate(0 4)" fill="rgba(0,0,0,0.28)" /><path d="${starPath100}" fill="#FFD60A" stroke="#F5B301" stroke-width="3" stroke-linejoin="round" />`;

          const photoMaskEl = document.createElement('div');
          photoMaskEl.style.position = 'absolute';
          photoMaskEl.style.inset = '5px';
          photoMaskEl.style.overflow = 'hidden';
          photoMaskEl.style.backgroundColor = '#18181B';
          photoMaskEl.style.clipPath = starClipPolygon;
          (photoMaskEl.style as any).webkitClipPath = starClipPolygon;
          photoMaskEl.appendChild(imgEl);

          badgeEl.appendChild(starBgSvg);
          badgeEl.appendChild(photoMaskEl);
        } else {
          badgeEl.style.borderRadius = '9999px';
          badgeEl.style.overflow = 'hidden';
          badgeEl.style.backgroundColor = '#18181B';
          badgeEl.style.border = isSelected ? '3px solid #FFFFFF' : '2.5px solid #FFFFFF';
          badgeEl.style.boxShadow = isSelected
            ? '0 8px 20px rgba(0, 0, 0, 0.38), 0 0 0 2px rgba(255, 255, 255, 0.92)'
            : '0 4px 10px rgba(0, 0, 0, 0.30)';
          imgEl.style.borderRadius = '9999px';
          badgeEl.appendChild(imgEl);
        }

        // Order badge pill shown ONLY in SELECT mode for picked spots
        const orderBadgeEl = document.createElement('div');
        orderBadgeEl.style.position = 'absolute';
        orderBadgeEl.style.top = '-5px';
        orderBadgeEl.style.right = '-5px';
        orderBadgeEl.style.width = '19px';
        orderBadgeEl.style.height = '19px';
        orderBadgeEl.style.borderRadius = '9999px';
        orderBadgeEl.style.background = '#FFFFFF';
        orderBadgeEl.style.color = '#000000';
        orderBadgeEl.style.border = '2px solid #000000';
        orderBadgeEl.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.35)';
        orderBadgeEl.style.fontSize = '10px';
        orderBadgeEl.style.fontWeight = '900';
        orderBadgeEl.style.alignItems = 'center';
        orderBadgeEl.style.justifyContent = 'center';
        orderBadgeEl.style.pointerEvents = 'none';
        orderBadgeEl.style.zIndex = '5';
        orderBadgeEl.style.display = 'none';

        pulseScaleWrapEl.appendChild(badgeEl);
        pulseScaleWrapEl.appendChild(orderBadgeEl);
        containerEl.appendChild(pulseEl);
        containerEl.appendChild(pulseScaleWrapEl);
        el.appendChild(containerEl);

        let pointerStartPos: { x: number; y: number } | null = null;
        let pointerMovedDuringTap = false;

        el.onpointerdown = (e) => {
          if (!e.isPrimary || isZoomGestureActiveRef.current) return;
          pointerStartPos = { x: e.clientX, y: e.clientY };
          pointerMovedDuringTap = false;
          unlockSpotClickSound();
          animateMarkerPress(badgeEl, true);
        };

        el.onpointermove = (e) => {
          if (!pointerStartPos) return;
          const dx = e.clientX - pointerStartPos.x;
          const dy = e.clientY - pointerStartPos.y;
          if (dx * dx + dy * dy > 64 && !pointerMovedDuringTap) {
            pointerMovedDuringTap = true;
            animateMarkerPress(badgeEl, false);
          }
        };

        el.onpointercancel = () => {
          pointerStartPos = null;
          animateMarkerPress(badgeEl, false);
        };

        el.onpointerleave = () => {
          if (pointerStartPos && !pointerMovedDuringTap) {
            animateMarkerPress(badgeEl, false);
          }
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        const record = {
          spotId: spot.id,
          spot,
          isStar,
          mapInstance: map,
          marker,
          el,
          containerEl,
          pulseScaleWrapEl,
          badgeEl,
          pulseEl,
          orderBadgeEl,
          imgEl,
          lat,
          lng,
          imgUrl,
        };

        el.onclick = (e) => {
          e.stopPropagation();
          pointerStartPos = null;
          if (
            pointerMovedDuringTap ||
            isMapGestureActiveRef.current ||
            isZoomGestureActiveRef.current ||
            performance.now() - lastMapGestureTimeRef.current < 80
          ) {
            pointerMovedDuringTap = false;
            animateMarkerPress(badgeEl, false);
            return;
          }

          if (workflowModeRef.current === 'SELECT') {
            playSpotClickSound();
            triggerPinTapFeedback(containerEl, badgeEl, isStar);
            onToggleSelectSpotRef.current?.(record.spot);
            return;
          }

          playSpotClickSound();
          triggerPinTapFeedback(containerEl, badgeEl, isStar);
          setFollowMode(false);
          onSelectSpotRef.current(record.spot);
        };

        markerRecordsRef.current.push(record);
      };

      // Step 3: Progressive frame-budgeted mounting (max 6 new pins/frame, O(1) duplicate guard)
      const MAX_MOUNTS_PER_FRAME = 6;
      if (pendingToMount.length <= MAX_MOUNTS_PER_FRAME) {
        for (let i = 0; i < pendingToMount.length; i++) {
          mountSpotPin(pendingToMount[i]);
        }
        syncMarkerHighlight(currentSelectedId);
      } else {
        const center = lastMarkerSyncCenterRef.current;
        if (center) {
          pendingToMount.sort((a, b) => {
            const ap = isProtectedSpot(a.id) ? -1 : 0;
            const bp = isProtectedSpot(b.id) ? -1 : 0;
            if (ap !== bp) return ap - bp;
            const da = (a.lat - center.lat) ** 2 + (a.lng - center.lng) ** 2;
            const db = (b.lat - center.lat) ** 2 + (b.lng - center.lng) ** 2;
            return da - db;
          });
        }

        const mountedIds = new Set(markerRecordsRef.current.map((r) => r.spotId));
        let cursor = 0;
        const mountBatch = () => {
          progressiveMountRafRef.current = null;
          if (
            !mapRef.current ||
            mapRef.current !== map ||
            isZoomGestureActiveRef.current ||
            isProgrammaticZoomRef.current ||
            workflowModeRef.current === 'ITINERARY'
          ) {
            return;
          }
          const end = Math.min(cursor + MAX_MOUNTS_PER_FRAME, pendingToMount.length);
          for (; cursor < end; cursor++) {
            const candidate = pendingToMount[cursor];
            if (!mountedIds.has(candidate.id)) {
              mountedIds.add(candidate.id);
              mountSpotPin(candidate);
            }
          }
          syncMarkerHighlight(selectedSpotRef.current?.id || null);
          if (cursor < pendingToMount.length) {
            progressiveMountRafRef.current = requestAnimationFrame(mountBatch);
          }
        };

        mountBatch();
      }
    }, [
      syncMarkerHighlight,
      syncItineraryRouteLayers,
      focusItineraryStepOnMap,
      setFollowMode,
      triggerPinTapFeedback,
      animateMarkerPress,
      buildRoundedStarPath,
      isFiveStarSpot,
    ]);

    useEffect(() => {
      syncSpotMarkersRef.current = syncSpotMarkers;
    }, [syncSpotMarkers]);

    useEffect(() => {
      if (isGlobeIntroPending || isGlobeIntroPlaying || isSuspended) return;
      const map = mapRef.current;
      if (!map) return;
      syncSpotMarkers();
      if (workflowModeRef.current !== 'ITINERARY' && map.getZoom() >= 8.5) {
        try {
          const rawBounds = map.getBounds();
          const sw = rawBounds.getSouthWest();
          const ne = rawBounds.getNorthEast();
          const latPad = Math.max(0.006, (ne.lat - sw.lat) * 0.25);
          const lngPad = Math.max(0.006, (ne.lng - sw.lng) * 0.25);
          const controller = new AbortController();
          if (viewportFetchAbortRef.current) {
            viewportFetchAbortRef.current.abort();
          }
          viewportFetchAbortRef.current = controller;
          fetchSpotsInViewport(
            {
              minLat: sw.lat - latPad,
              maxLat: ne.lat + latPad,
              minLng: sw.lng - lngPad,
              maxLng: ne.lng + lngPad,
            },
            { signal: controller.signal }
          )
            .then((regionSpots) => {
              if (controller.signal.aborted) return;
              if (viewportFetchAbortRef.current === controller) {
                viewportFetchAbortRef.current = null;
              }
              if (regionSpots.length > 0 && onViewportSpotsLoadedRef.current) {
                onViewportSpotsLoadedRef.current(regionSpots);
              }
            })
            .catch(() => {});
        } catch {}
      }
    }, [isGlobeIntroPending, isGlobeIntroPlaying, isSuspended, syncSpotMarkers]);

    // Keep workflow mode, selected itinerary points, and itinerary stops synchronized cleanly on the single map
    const prevWorkflowModeRef = useRef<MapWorkflowMode>(workflowMode);
    useEffect(() => {
      const prevMode = prevWorkflowModeRef.current;
      prevWorkflowModeRef.current = workflowMode;
      syncSpotMarkers();
      syncMarkerHighlight(selectedSpotRef.current?.id);
      syncItineraryRouteLayers(mapRef.current);

      if (workflowMode === 'ITINERARY' && prevMode !== 'ITINERARY' && itinerarySteps.length > 0) {
        fitItineraryCameraBounds(itinerarySteps, false);
      }
    }, [
      workflowMode,
      selectedSpotIdsForItinerary,
      itinerarySteps,
      activeItineraryStepId,
      syncSpotMarkers,
      syncMarkerHighlight,
      syncItineraryRouteLayers,
      fitItineraryCameraBounds,
    ]);

    useEffect(() => {
      spotsRef.current = spots;
      if (!isZoomGestureActiveRef.current && !isProgrammaticZoomRef.current) {
        syncSpotMarkers();
      }
      if (
        !hasFramedInitialSpotsRef.current &&
        workflowModeRef.current === 'EXPLORE' &&
        spots &&
        spots.length > 0 &&
        mapRef.current &&
        !selectedSpotRef.current &&
        !hasUserMovedMapRef.current &&
        !isSpotlightActiveRef.current &&
        !isGlobeIntroActiveRef.current
      ) {
        hasFramedInitialSpotsRef.current = true;
        frameAllSpotsOverview(mapRef.current, false);
      }
    }, [spots, syncSpotMarkers, frameAllSpotsOverview]);

    // Dedicated Mapbox GeoJSON Route & Endpoint Layer Synchronization (Zero map rebuilds)
    const syncActiveRouteLayers = useCallback((targetMap?: maplibregl.Map | null) => {
      const map = targetMap || mapRef.current;
      if (!map) return;

      const ROUTE_SOURCE_ID = 'monvian-active-route-source';
      const ENDPOINTS_SOURCE_ID = 'monvian-active-route-endpoints';
      const GLOW_LAYER_ID = 'monvian-active-route-glow';
      const CASING_LAYER_ID = 'monvian-active-route-casing';
      const LINE_LAYER_ID = 'monvian-active-route-line';
      const ENDPOINTS_HALO_LAYER_ID = 'monvian-active-route-endpoints-halo';
      const ENDPOINTS_DOT_LAYER_ID = 'monvian-active-route-endpoints-dot';

      const route = activeRouteRef.current;
      const hasValidCoords = Boolean(
        route &&
          route.geometry &&
          route.geometry.type === 'LineString' &&
          Array.isArray(route.geometry.coordinates) &&
          route.geometry.coordinates.length >= 2
      );

      const routeFeatureCollection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: hasValidCoords && route
          ? [
              {
                type: 'Feature',
                properties: {
                  spotId: route.spotId,
                },
                geometry: route.geometry,
              },
            ]
          : [],
      };

      const endpointsFeatureCollection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: hasValidCoords && route
          ? [
              {
                type: 'Feature',
                properties: { role: 'origin' },
                geometry: {
                  type: 'Point',
                  coordinates:
                    route.originSnapped || route.geometry.coordinates[0],
                },
              },
              {
                type: 'Feature',
                properties: { role: 'destination' },
                geometry: {
                  type: 'Point',
                  coordinates:
                    route.destinationSnapped ||
                    route.geometry.coordinates[route.geometry.coordinates.length - 1],
                },
              },
            ]
          : [],
      };

      const isDarkOrSat = themeRef.current === 'dark' || currentModeRef.current === 'satelite';
      const casingColor = isDarkOrSat ? 'rgba(8, 16, 30, 0.94)' : '#FFFFFF';

      try {
        const existingRouteSource = map.getSource(ROUTE_SOURCE_ID) as
          | maplibregl.GeoJSONSource
          | undefined;
        const existingEndpointsSource = map.getSource(ENDPOINTS_SOURCE_ID) as
          | maplibregl.GeoJSONSource
          | undefined;

        if (existingRouteSource && existingEndpointsSource) {
          existingRouteSource.setData(routeFeatureCollection);
          existingEndpointsSource.setData(endpointsFeatureCollection);
          if (map.getLayer(CASING_LAYER_ID)) {
            map.setPaintProperty(CASING_LAYER_ID, 'line-color', casingColor);
          }
          return;
        }

        if (!map.isStyleLoaded()) return;

        if (!existingRouteSource) {
          map.addSource(ROUTE_SOURCE_ID, {
            type: 'geojson',
            data: routeFeatureCollection,
          });
        }

        if (!existingEndpointsSource) {
          map.addSource(ENDPOINTS_SOURCE_ID, {
            type: 'geojson',
            data: endpointsFeatureCollection,
          });
        }

        if (!map.getLayer(GLOW_LAYER_ID)) {
          map.addLayer({
            id: GLOW_LAYER_ID,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#007AFF',
              'line-width': 14,
              'line-opacity': 0.24,
              'line-blur': 6,
            },
          });
        }

        if (!map.getLayer(CASING_LAYER_ID)) {
          map.addLayer({
            id: CASING_LAYER_ID,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': casingColor,
              'line-width': 8.5,
              'line-opacity': 0.96,
            },
          });
        }

        if (!map.getLayer(LINE_LAYER_ID)) {
          map.addLayer({
            id: LINE_LAYER_ID,
            type: 'line',
            source: ROUTE_SOURCE_ID,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#007AFF',
              'line-width': 5,
              'line-opacity': 1,
            },
          });
        }

        if (!map.getLayer(ENDPOINTS_HALO_LAYER_ID)) {
          map.addLayer({
            id: ENDPOINTS_HALO_LAYER_ID,
            type: 'circle',
            source: ENDPOINTS_SOURCE_ID,
            paint: {
              'circle-radius': ['match', ['get', 'role'], 'destination', 10, 8],
              'circle-color': '#FFFFFF',
              'circle-opacity': 0.96,
              'circle-blur': 0.05,
            },
          });
        }

        if (!map.getLayer(ENDPOINTS_DOT_LAYER_ID)) {
          map.addLayer({
            id: ENDPOINTS_DOT_LAYER_ID,
            type: 'circle',
            source: ENDPOINTS_SOURCE_ID,
            paint: {
              'circle-radius': ['match', ['get', 'role'], 'destination', 6.5, 5],
              'circle-color': ['match', ['get', 'role'], 'destination', '#34C759', '#007AFF'],
              'circle-opacity': 1,
            },
          });
        }
      } catch (err) {
        console.warn('[MapComponent] Failed to sync active route layers:', err);
      }
    }, []);

    // Render active Mapbox route and fit camera bounds cleanly when route is activated or deactivated
    useEffect(() => {
      activeRouteRef.current = activeRoute ?? null;
      const map = mapRef.current;
      if (!map) return;

      syncActiveRouteLayers(map);
      syncMarkerHighlight(selectedSpotRef.current?.id);

      if (activeRoute && activeRoute.geometry?.coordinates?.length >= 2) {
        const shouldFit =
          lastRouteSpotIdRef.current !== activeRoute.spotId ||
          lastFittedRouteRevRef.current !== activeRoute.fitRevision;

        if (shouldFit) {
          lastRouteSpotIdRef.current = activeRoute.spotId;
          lastFittedRouteRevRef.current = activeRoute.fitRevision;
          setFollowMode(false);

          try {
            const bounds = new maplibregl.LngLatBounds();
            activeRoute.geometry.coordinates.forEach((coord) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                bounds.extend([Number(coord[0]), Number(coord[1])]);
              }
            });
            bounds.extend(activeRoute.origin);
            bounds.extend(activeRoute.destination);

            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            const span = Math.abs(ne.lng - sw.lng) + Math.abs(ne.lat - sw.lat);

            if (span < 0.00025) {
              const isMobile = window.innerWidth < 768;
              const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
              map.easeTo({
                center: activeRoute.destination,
                zoom: 16.2,
                pitch: 0,
                bearing: 0,
                offset: [0, verticalOffset],
                duration: 800,
              });
            } else {
              const isMobile = window.innerWidth < 768;
              map.fitBounds(bounds, {
                padding: isMobile
                  ? { top: 112, bottom: 215, left: 48, right: 72 }
                  : { top: 96, bottom: 96, left: 440, right: 96 },
                pitch: 0,
                bearing: 0,
                maxZoom: 16.2,
                duration: 850,
              });
            }
          } catch (err) {
            console.warn('[MapComponent] Failed to fit route bounds:', err);
          }
        }
      } else if (lastRouteSpotIdRef.current !== null) {
        lastRouteSpotIdRef.current = null;
        lastFittedRouteRevRef.current = 0;

        // If user toggled the route off while the spot card is still open, return smoothly to spot camera
        if (selectedSpotRef.current && selectedSpotRef.current.lng && selectedSpotRef.current.lat) {
          const targetSpot = selectedSpotRef.current;
          const isMobile = window.innerWidth < 768;
          const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
          const animDuration = computeAdaptiveZoomDuration(map, targetSpot.lng, targetSpot.lat, 15.5, 1);
          beginProgrammaticCameraAnim(map, animDuration);
          map.easeTo({
            center: [targetSpot.lng, targetSpot.lat],
            zoom: 15.5,
            pitch: is3DModeRef.current ? 55 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
            offset: [0, verticalOffset],
            duration: animDuration,
            easing: smoothCameraEase,
            essential: true,
          });
        }
      }
    }, [activeRoute, syncActiveRouteLayers, syncMarkerHighlight, setFollowMode, beginProgrammaticCameraAnim, computeAdaptiveZoomDuration, smoothCameraEase]);

    // Update marker highlight and smoothly glide camera zoom when a tourist spot is selected
    useEffect(() => {
      if (spotFocusRafRef.current !== null) {
        cancelAnimationFrame(spotFocusRafRef.current);
        spotFocusRafRef.current = null;
      }

      // Avoid heavy full-viewport DOM churn synchronously on click/exit; only mount the 1 target pin if not mounted yet
      if (selectedSpot?.id && !markerRecordsRef.current.some((r) => r.spotId === selectedSpot.id)) {
        syncSpotMarkers(selectedSpot.id);
      }
      syncMarkerHighlight(selectedSpot?.id);

      const map = mapRef.current;
      if (!map || workflowModeRef.current !== 'EXPLORE') return;

      if (selectedSpot && selectedSpot.lng && selectedSpot.lat) {
        if (activeRouteRef.current?.spotId === selectedSpot.id) {
          return;
        }

        const targetSpot = selectedSpot;
        setFollowMode(false);

        // Start camera animation on the next RAF so React card mount & marker highlight commit without frame-0 contention
        spotFocusRafRef.current = requestAnimationFrame(() => {
          spotFocusRafRef.current = null;
          if (!mapRef.current || mapRef.current !== map || workflowModeRef.current !== 'EXPLORE') return;
          const isMobile = window.innerWidth < 768;
          const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
          const animDuration = computeAdaptiveZoomDuration(map, targetSpot.lng, targetSpot.lat, 15.5, 1);
          beginProgrammaticCameraAnim(map, animDuration);

          map.easeTo({
            center: [targetSpot.lng, targetSpot.lat],
            zoom: 15.5,
            pitch: is3DModeRef.current ? 55 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
            offset: [0, verticalOffset],
            duration: animDuration,
            easing: smoothCameraEase,
            essential: true,
          });
        });
      }

      return () => {
        if (spotFocusRafRef.current !== null) {
          cancelAnimationFrame(spotFocusRafRef.current);
          spotFocusRafRef.current = null;
        }
      };
    }, [
      selectedSpot,
      isFocusMode,
      syncSpotMarkers,
      syncMarkerHighlight,
      setFollowMode,
      beginProgrammaticCameraAnim,
      computeAdaptiveZoomDuration,
      smoothCameraEase,
    ]);

    // Render static visual map icons
    const visualIconMarkersRef = useRef<maplibregl.Marker[]>([]);

    // Clear any legacy visual icon markers once cleanly (feature intentionally disabled on main map)
    useEffect(() => {
      if (visualIconMarkersRef.current.length > 0) {
        visualIconMarkersRef.current.forEach((m) => {
          try {
            m.remove();
          } catch {}
        });
        visualIconMarkersRef.current = [];
      }
    }, []);

    // Keep MapLibre canvas synchronized with container dimensions using RAF-debounced ResizeObserver
    useEffect(() => {
      const container = mapContainerRef.current;
      if (!container) return;

      let resizeRafId: number | null = null;
      let lastWidth = 0;
      let lastHeight = 0;

      const performResize = (force: boolean = false) => {
        resizeRafId = null;
        if (!container || !mapRef.current) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        if (!force && w === lastWidth && h === lastHeight) return;
        lastWidth = w;
        lastHeight = h;
        try {
          mapRef.current.resize();
        } catch {}
      };

      const scheduleResize = () => {
        if (resizeRafId !== null) return;
        resizeRafId = requestAnimationFrame(() => performResize(false));
      };

      performResize(true);
      const t1 = window.setTimeout(() => performResize(true), 120);

      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          scheduleResize();
        });
        observer.observe(container);
      }

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          scheduleResize();
        }
      };

      window.addEventListener('resize', scheduleResize, { passive: true });
      window.addEventListener('orientationchange', scheduleResize, { passive: true });
      window.addEventListener('monvian:viewport-stabilized', scheduleResize as EventListener, { passive: true });
      document.addEventListener('visibilitychange', handleVisibility, { passive: true });

      return () => {
        if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
        window.clearTimeout(t1);
        observer?.disconnect();
        window.removeEventListener('resize', scheduleResize);
        window.removeEventListener('orientationchange', scheduleResize);
        window.removeEventListener('monvian:viewport-stabilized', scheduleResize as EventListener);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }, []);

    const handleCycleMapStyle = () => {
      const next: MapModeType = currentMode === 'satelite' ? 'explorar' : 'satelite';
      setCurrentMode(next);
      if (onMapModeChange) onMapModeChange(next);
      if (onStyleChange) onStyleChange(next);
    };

    return (
      <div
        className={`w-full h-full relative inset-0 select-none overflow-hidden ${
          isSpaceBackgroundActive ? 'monvian-globe-space-active' : ''
        }`}
        style={{
          backgroundColor: isSpaceBackgroundActive ? '#000000' : undefined,
        }}
      >
        <div
          ref={mapContainerRef}
          className="w-full h-full absolute inset-0 select-none"
          style={{
            backgroundColor: isSpaceBackgroundActive ? '#000000' : undefined,
          }}
        />

        {/* Floating Right-Side Map Controls (Play Itinerary, Compass/Location, Layers) */}
        <div
          id="mobile-map-right-controls"
          className={`md:hidden absolute right-3.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isFocusMode || isGlobeIntroPlaying || workflowMode === 'ITINERARY'
              ? 'opacity-0 scale-90 pointer-events-none [&_*]:!pointer-events-none'
              : 'opacity-100 scale-100 pointer-events-auto'
          }`}
          style={{
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >
          {/* PLAY — Create Custom Itinerary Directly on Map */}
          {workflowMode === 'EXPLORE' && onStartItineraryCreation && (
            <button
              id="btn-play-itinerary"
              type="button"
              onClick={() => {
                unlockSpotClickSound();
                playSpotClickSound();
                triggerHapticFeedback(14);
                onStartItineraryCreation();
              }}
              aria-label="Criar roteiro no mapa"
              title="Criar roteiro no mapa"
              className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center active:scale-90 transition-all duration-200 cursor-pointer shrink-0 ${
                currentMode === 'satelite' || theme === 'dark' ? 'text-white' : 'text-black'
              }`}
              style={{ color: currentMode === 'satelite' || theme === 'dark' ? '#FFFFFF' : '#000000' }}
            >
              <Play
                className="relative z-10 w-[23px] h-[23px] sm:w-[25px] sm:h-[25px] ml-0.5 fill-current"
                style={{ color: currentMode === 'satelite' || theme === 'dark' ? '#FFFFFF' : '#000000' }}
              />
            </button>
          )}

          {/* My Real-Time Location & Compass Orientation Button */}
          <button
            type="button"
            onClick={() => centerOnUserLocation(true, true)}
            aria-label="Centralizar na minha localização e ativar bússola em tempo real"
            className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center active:scale-90 transition-all duration-200 cursor-pointer shrink-0 ${
              currentMode === 'satelite' || theme === 'dark' ? 'text-white' : 'text-black'
            } ${
              isCompassTracking
                ? 'ring-2 ring-[#007AFF]/70'
                : isFollowingUser
                  ? 'ring-2 ring-[#007AFF]/35'
                  : ''
            }`}
            style={{ color: currentMode === 'satelite' || theme === 'dark' ? '#FFFFFF' : '#000000' }}
          >
            <div
              ref={compassIconWrapperRef}
              className="relative z-10 flex items-center justify-center will-change-transform"
              style={{ color: currentMode === 'satelite' || theme === 'dark' ? '#FFFFFF' : '#000000' }}
            >
              <CompassIcon
                size={28}
                className="w-[26px] h-[26px] sm:w-[29px] sm:h-[29px]"
                style={{ color: currentMode === 'satelite' || theme === 'dark' ? '#FFFFFF' : '#000000' }}
              />
            </div>
          </button>

          {/* Map Layers Toggle */}
          <button
            type="button"
            onClick={handleCycleMapStyle}
            aria-label="Alternar camada do mapa"
            title={currentMode === 'satelite' ? 'Alternar para mapa padrão' : 'Alternar para satélite'}
            className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center active:scale-90 transition-all duration-200 cursor-pointer shrink-0 ${
              currentMode === 'satelite' || theme === 'dark' ? 'text-white' : 'text-black'
            }`}
            style={{ color: currentMode === 'satelite' || theme === 'dark' ? '#FFFFFF' : '#000000' }}
          >
            <MapLayerToggleIcon
              className="relative z-10 w-[28px] h-[28px] sm:w-[31px] sm:h-[31px]"
              style={{ color: currentMode === 'satelite' || theme === 'dark' ? '#FFFFFF' : '#000000' }}
            />
          </button>
        </div>
      </div>
    );
  }
)
);
