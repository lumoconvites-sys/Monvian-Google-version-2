import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { animate } from 'motion/react';
import { Spot, MapModeType } from '../types';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
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
  revertSpotZoomTrigger?: number;
  onStyleChange?: (style: any) => void;
  onOrbitChange?: (isOrbiting: boolean) => void;
  snowEnabled?: boolean;
  rainEnabled?: boolean;
  isSpotlightActive?: boolean;
  isFocusMode?: boolean;
  activeTab?: string;
  isGlobeIntroPending?: boolean;
  isGlobeIntroPlaying?: boolean;
  onGlobeIntroComplete?: () => void;
  activeRoute?: ActiveMapRoute | null;
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
  theme: 'dark' | 'light'
): maplibregl.StyleSpecification => {
  const token = getMapboxToken();
  const globeProjection: maplibregl.ProjectionSpecification = { type: 'globe' };
  const spaceSky = getCleanSpaceSky(theme);

  // 1. Satellite Mode
  if (mode === 'satelite') {
    if (token) {
      return {
        version: 8,
        projection: globeProjection,
        sky: spaceSky,
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
              'raster-fade-duration': 240,
            },
          },
        ],
      };
    }

    // High-Resolution Esri World Imagery + Reference Labels (Boundaries, Roads & Places)
    return {
      version: 8,
      projection: globeProjection,
      sky: spaceSky,
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
            'raster-fade-duration': 240,
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
            'raster-fade-duration': 240,
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
      projection: globeProjection,
      sky: spaceSky,
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
            'raster-fade-duration': 240,
          },
        },
      ],
    };
  }

  // Dark mode map fallback (Clean Apple-style dark navigation map)
  if (theme === 'dark') {
    return {
      version: 8,
      projection: globeProjection,
      sky: spaceSky,
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
            'raster-fade-duration': 240,
          },
        },
      ],
    };
  }

  // Esri World Street Map (Light mode)
  return {
    version: 8,
    projection: globeProjection,
    sky: spaceSky,
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
          'raster-fade-duration': 240,
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
      revertSpotZoomTrigger,
      onStyleChange,
      snowEnabled = false,
      rainEnabled = false,
      isSpotlightActive = false,
      isFocusMode = false,
      activeTab,
      isGlobeIntroPending = false,
      isGlobeIntroPlaying = false,
      onGlobeIntroComplete,
      activeRoute = null,
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
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

    const previousCameraStateRef = useRef<{
      center: [number, number];
      zoom: number;
      pitch: number;
      bearing: number;
    } | null>(null);

    const restorePreviousSpotCamera = useCallback(() => {
      if (!mapRef.current || !previousCameraStateRef.current) return false;
      const savedCamera = previousCameraStateRef.current;
      previousCameraStateRef.current = null;
      mapRef.current.easeTo({
        center: savedCamera.center,
        zoom: savedCamera.zoom,
        pitch: savedCamera.pitch,
        bearing: savedCamera.bearing,
        offset: [0, 0],
        duration: 700,
      });
      return true;
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
          previousCameraStateRef.current = null;
          ensureUserMarker(mapRef.current);
          userMarkerRef.current?.setLngLat(targetCoords);

          mapRef.current.resize();
          mapRef.current.easeTo({
            center: targetCoords,
            zoom: targetZoom,
            pitch: is3DModeRef.current ? 60 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
            duration: 700,
          });
        }
      },
      [setFollowMode, ensureUserMarker]
    );

    // Expose map controls for external iOS floating buttons
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        mapRef.current?.zoomIn({ duration: 300 });
      },
      zoomOut: () => {
        mapRef.current?.zoomOut({ duration: 300 });
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
        setFollowMode(false);
        const isMobile = window.innerWidth < 768;
        const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
        mapRef.current.easeTo({
          center: [spot.lng, spot.lat],
          zoom: 15.5,
          pitch: is3DModeRef.current ? 60 : 35,
          bearing: is3DModeRef.current ? -20 : 0,
          offset: [0, verticalOffset],
          duration: 750,
        });
      },
      recenter: () => {
        centerOnUserLocation(true);
      },
    }), [centerOnUserLocation, currentMode, onMapModeChange, onStyleChange, setFollowMode]);

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
        previousCameraStateRef.current = null;
        hasUserMovedMapRef.current = false;
        map.resize();

        const { center: targetCenter, zoom: targetZoom } = getCamposOverviewCamera(map);

        if (animateCamera) {
          map.easeTo({
            center: targetCenter,
            zoom: targetZoom,
            pitch: is3DModeRef.current ? 60 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
            offset: [0, 0],
            duration: 650,
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
      [setFollowMode, getCamposOverviewCamera]
    );

    // Synchronize mode from prop if provided (excluding dark map mode)
    useEffect(() => {
      if (mapMode) {
        const normalized: MapModeType = mapMode === 'satelite' ? 'satelite' : 'explorar';
        if (normalized !== currentMode) {
          setCurrentMode(normalized);
        }
      }
    }, [mapMode]);

    // Initialize or swap map style ONLY when mode or theme genuinely changes
    useEffect(() => {
      if (!mapContainerRef.current) return;

      const styleKey = `${currentMode}:${theme}`;
      const style = getVectorMapStyle(currentMode, theme);

      if (!mapRef.current) {
        prevStyleKeyRef.current = styleKey;
        const startOrbital = isGlobeIntroActiveRef.current;
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: style,
          center: startOrbital ? [-22, -10] : CAMPOS_OVERVIEW_CENTER,
          zoom: startOrbital ? getOrbitalEarthZoom() : CAMPOS_OVERVIEW_ZOOM,
          minZoom: 0.4,
          maxZoom: 20,
          pitch: startOrbital ? 0 : is3DModeRef.current ? 60 : 0,
          bearing: startOrbital ? 0 : is3DModeRef.current ? -20 : 0,
          maxPitch: 75,
          pitchWithRotate: true,
          touchPitch: true,
          attributionControl: false,
          fadeDuration: 0,
          maxTileCacheSize: 150,
          refreshExpiredTiles: false,
          trackResize: false,
        });

        mapRef.current = map;
        ensureUserMarker(map);

        map.on('click', () => {
          if (isGlobeIntroActiveRef.current) return;
          if (selectedSpotRef.current || previousCameraStateRef.current) {
            restorePreviousSpotCamera();
          }
          if (onMapClickRef.current) onMapClickRef.current();
        });

        let lastSpaceActive: boolean | null = null;
        let lastHideUserPin: boolean | null = null;
        let viewportCullRafId: number | null = null;

        const syncViewportMarkerVisibility = () => {
          viewportCullRafId = null;
          const records = markerRecordsRef.current;
          if (!records.length || !mapRef.current) return;

          const z = map.getZoom();
          // Always show all markers during orbital globe / regional zoom or spotlight
          if (z < 9.5 || isGlobeIntroActiveRef.current || isSpotlightActiveRef.current) {
            for (let i = 0; i < records.length; i++) {
              const rec = records[i];
              if (rec.isCulledOffscreen) {
                rec.isCulledOffscreen = false;
                rec.el.style.visibility = '';
              }
            }
            return;
          }

          try {
            const bounds = map.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            const latPad = Math.max(0.015, (ne.lat - sw.lat) * 0.35);
            const lngPad = Math.max(0.015, (ne.lng - sw.lng) * 0.35);
            const minLat = sw.lat - latPad;
            const maxLat = ne.lat + latPad;
            const minLng = sw.lng - lngPad;
            const maxLng = ne.lng + lngPad;
            const activeId = selectedSpotRef.current?.id;

            for (let i = 0; i < records.length; i++) {
              const rec = records[i];
              const inView =
                rec.spotId === activeId ||
                (rec.lat >= minLat && rec.lat <= maxLat && rec.lng >= minLng && rec.lng <= maxLng);
              const shouldCull = !inView;
              if (rec.isCulledOffscreen !== shouldCull) {
                rec.isCulledOffscreen = shouldCull;
                rec.el.style.visibility = shouldCull ? 'hidden' : '';
              }
            }
          } catch {}
        };

        const scheduleViewportMarkerCull = () => {
          if (markerRecordsRef.current.length < 30 || viewportCullRafId !== null) return;
          viewportCullRafId = requestAnimationFrame(syncViewportMarkerVisibility);
        };

        const syncSpaceAndMarkerZoomTier = () => {
          const z = map.getZoom();
          const shouldSpace = Boolean(isGlobeIntroPendingRef.current || z < 7.2);
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
            map.setProjection({ type: 'globe' });
            map.setSky(getCleanSpaceSky(themeRef.current));
          } catch {}
          syncSpotMarkers();
          syncActiveRouteLayers(map);
          ensureUserMarker(map);
          map.resize();
          const currentGpsState = gpsNavigationManager.getState();
          if (currentGpsState.hasRealFix && currentGpsState.status === 'granted') {
            userMarkerRef.current?.setLngLat(currentGpsState.coords);
            latestUserCoordsRef.current = currentGpsState.coords;
          }
          if (isGlobeIntroActiveRef.current) {
            map.jumpTo({
              center: [-22, -10],
              zoom: getOrbitalEarthZoom(),
              pitch: 0,
              bearing: 0,
            });
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
          } else if (!hasUserMovedMapRef.current && !isSpotlightActiveRef.current) {
            frameAllSpotsOverview(map, false);
          }
          syncSpaceAndMarkerZoomTier();
          syncViewportMarkerVisibility();
          if (onMapLoad) onMapLoad();
        });

        map.on('style.load', () => {
          try {
            map.setProjection({ type: 'globe' });
            map.setSky(getCleanSpaceSky(themeRef.current));
          } catch {}
          syncSpotMarkers();
          syncActiveRouteLayers(map);
          ensureUserMarker(map);
          syncSpaceAndMarkerZoomTier();
          syncViewportMarkerVisibility();
        });

        // Mark map as manually moved by user when panning/dragging so camera stops auto-centering
        const onUserManualMoveStart = (e: any) => {
          if (e && e.originalEvent) {
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
          scheduleViewportMarkerCull();
        };

        const onUserZoom = (e: any) => {
          if (e && e.originalEvent) {
            isMapGestureActiveRef.current = true;
            lastMapGestureTimeRef.current = performance.now();
          }
          syncSpaceAndMarkerZoomTier();
          scheduleViewportMarkerCull();
        };

        const onInteractionEnd = (e: any) => {
          if (e && e.originalEvent) {
            lastMapGestureTimeRef.current = performance.now();
          }
          isMapGestureActiveRef.current = false;
          syncSpaceAndMarkerZoomTier();
          syncViewportMarkerVisibility();
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
        map.on('dragend', onInteractionEnd);
        map.on('zoomend', onInteractionEnd);
        map.on('moveend', onInteractionEnd);

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
    }, [currentMode, theme, ensureUserMarker]);

    // Subscribe to Device Compass / 3D Orientation Heading for the Blue Flashlight ("Lanterna Azul") & Compass Icon
    useEffect(() => {
      deviceHeadingManager.start();
      let lastRenderedBeamAngle = -999;
      let lastRenderedCompassAngle = -999;

      const unsubscribeHeading = deviceHeadingManager.subscribe((rawHeading) => {
        if (isNaN(rawHeading)) return;
        // Skip DOM mutations when map tab is hidden in the background
        if (activeTabRef.current && activeTabRef.current !== 'explorar') return;

        if (mapRef.current && (!userMarkerRef.current || !userBeamRef.current)) {
          ensureUserMarker(mapRef.current);
        }

        const mapBearing = mapRef.current?.getBearing() || 0;
        const beamAngle = (rawHeading - mapBearing + 360) % 360;

        if (userBeamRef.current && Math.abs(beamAngle - lastRenderedBeamAngle) >= 0.25) {
          lastRenderedBeamAngle = beamAngle;
          userBeamRef.current.style.transform = `translate3d(-50%, -50%, 0) rotate(${beamAngle.toFixed(1)}deg)`;
        }

        const compassAngle = -rawHeading;
        if (compassIconWrapperRef.current && Math.abs(compassAngle - lastRenderedCompassAngle) >= 0.25) {
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

        if (isExplorarVisible) {
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
        if (!selectedSpotRef.current && !isSpotlightActiveRef.current) {
          frameAllSpotsOverview(mapRef.current, false);
        }
      }
    }, [zoomToUserTrigger, frameAllSpotsOverview]);

    // Whenever returning from another tab to 'explorar', start with the overview showing all spot icons
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
            !isGlobeIntroActiveRef.current
          ) {
            frameAllSpotsOverview(mapRef.current, false);
          }
        }, 100);
        return () => window.clearTimeout(timer);
      }
    }, [activeTab, frameAllSpotsOverview]);

    // Sync space backdrop state whenever intro props change
    useEffect(() => {
      const z = mapRef.current?.getZoom() ?? (isGlobeIntroPending || isGlobeIntroPlaying ? 1.1 : 11.75);
      const shouldSpace = Boolean(isGlobeIntroPending || z < 7.2);
      setIsSpaceBackgroundActive(shouldSpace);

      const userMarkerEl = userMarkerRef.current?.getElement();
      if (userMarkerEl) {
        const hideUserPin = Boolean((isGlobeIntroPending || isGlobeIntroPlaying) && z < 4.5);
        userMarkerEl.style.transition = 'opacity 0.35s ease';
        userMarkerEl.style.opacity = hideUserPin ? '0' : '1';
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
        previousCameraStateRef.current = null;

        markerRecordsRef.current.forEach((rec) => {
          try {
            rec.marker.remove();
          } catch (e) {}
        });
        markerRecordsRef.current = [];
        animatedSpotIdsRef.current.clear();

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

      isTransitioning3DRef.current = true;
      const timer = window.setTimeout(() => {
        isTransitioning3DRef.current = false;
      }, 850);

      map.easeTo({
        pitch: is3DMode ? 60 : 0,
        bearing: is3DMode ? -20 : 0,
        duration: 800,
      });

      return () => {
        window.clearTimeout(timer);
      };
    }, [is3DMode]);

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
      rippleEl: HTMLDivElement;
      secondaryRippleEl: HTMLDivElement;
      imgEl: HTMLImageElement;
      lat: number;
      lng: number;
      imgUrl: string;
      lastSelectedState?: boolean;
      lastHiddenState?: boolean;
      lastZoomTier?: 'orbital' | 'regional' | 'city';
      isCulledOffscreen?: boolean;
    }[]>([]);
    const lastUserHighlightKeyRef = useRef<string>('');
    const animatedSpotIdsRef = useRef<Set<string>>(new Set());
    const activeMarkerAnimationsRef = useRef<WeakMap<HTMLElement, { stop?: () => void }>>(
      new WeakMap()
    );

    const runMotionAnimation = useCallback(
      (
        el: HTMLElement,
        keyframes: Record<string, any>,
        options: Record<string, any>
      ) => {
        const prev = activeMarkerAnimationsRef.current.get(el);
        if (prev?.stop) {
          try {
            prev.stop();
          } catch {}
        }
        try {
          const controls = animate(el, keyframes, options);
          activeMarkerAnimationsRef.current.set(el, controls);
        } catch {}
      },
      []
    );

    const animateMarkerPress = useCallback(
      (badgeEl: HTMLDivElement, isPressed: boolean) => {
        runMotionAnimation(
          badgeEl,
          { scale: isPressed ? 0.92 : 1 },
          {
            duration: isPressed ? 0.08 : 0.16,
            ease: [0.22, 1, 0.36, 1],
          }
        );
      },
      [runMotionAnimation]
    );

    const selectedSpotRef = useRef<Spot | null>(selectedSpot);
    useEffect(() => {
      selectedSpotRef.current = selectedSpot;
    }, [selectedSpot]);

    // Trigger short haptic feedback + Framer Motion scale expansion & dual concentric ripple synchronized with instant click SFX
    const triggerPinTapFeedback = useCallback(
      (
        badgeEl: HTMLDivElement,
        rippleEl: HTMLDivElement,
        secondaryRippleEl?: HTMLDivElement
      ) => {
        triggerHapticFeedback(15);

        // Scale expansion peaked right at the ~95ms click sound transient, then settles crisply
        runMotionAnimation(
          badgeEl,
          { scale: [0.94, 1.24, 1] },
          {
            duration: 0.34,
            times: [0, 0.28, 1],
            ease: [0.22, 1, 0.36, 1],
          }
        );

        // Primary outer ripple wave starting immediately at t=0ms with audio transient
        rippleEl.style.display = 'block';
        runMotionAnimation(
          rippleEl,
          { scale: [0.95, 2.15], opacity: [0.92, 0] },
          {
            duration: 0.45,
            ease: [0.16, 1, 0.3, 1],
          }
        );

        // Secondary crisp inner ripple echo
        if (secondaryRippleEl) {
          secondaryRippleEl.style.display = 'block';
          runMotionAnimation(
            secondaryRippleEl,
            { scale: [0.9, 1.65], opacity: [0.7, 0] },
            {
              duration: 0.36,
              delay: 0.035,
              ease: [0.16, 1, 0.3, 1],
            }
          );
        }
      },
      [runMotionAnimation]
    );

    // Synchronize marker highlights smoothly without touching unchanged DOM nodes
    const syncMarkerHighlight = useCallback((activeSpotId: string | null | undefined) => {
      const focusActive = isFocusModeRef.current;
      const zoomTier = markerZoomTierRef.current;
      const hideForIntroFlight = Boolean(isGlobeIntroActiveRef.current && zoomTier !== 'city');
      const zoomScale =
        zoomTier === 'orbital' ? 0.46 : zoomTier === 'regional' ? 0.68 : 0.96;

      markerRecordsRef.current.forEach((rec) => {
        const isSelected = activeSpotId ? rec.spotId === activeSpotId : false;
        const shouldHideMarker = hideForIntroFlight || (focusActive && !isSelected);

        if (
          rec.lastSelectedState === isSelected &&
          rec.lastHiddenState === shouldHideMarker &&
          rec.lastZoomTier === zoomTier
        ) {
          return;
        }

        const selectionChanged = rec.lastSelectedState !== isSelected;
        rec.lastSelectedState = isSelected;
        rec.lastHiddenState = shouldHideMarker;
        rec.lastZoomTier = zoomTier;

        // Ensure newly selected marker is never culled offscreen
        if (isSelected && rec.isCulledOffscreen) {
          rec.isCulledOffscreen = false;
          rec.el.style.visibility = '';
        }

        rec.containerEl.style.transition =
          'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        rec.containerEl.style.opacity = shouldHideMarker ? '0' : '1';
        rec.containerEl.style.transform = shouldHideMarker
          ? 'scale(0.62)'
          : isSelected
            ? 'scale(1.22)'
            : `scale(${zoomScale})`;
        rec.containerEl.style.zIndex = isSelected ? '50' : '20';
        rec.el.style.pointerEvents = shouldHideMarker ? 'none' : 'auto';

        if (selectionChanged) {
          if (rec.isStar) {
            if (isSelected) {
              rec.pulseScaleWrapEl.classList.add('is-selected');
            } else {
              rec.pulseScaleWrapEl.classList.remove('is-selected');
            }
            rec.badgeEl.style.filter = isSelected
              ? 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.48)) drop-shadow(0 0 12px rgba(255, 214, 10, 0.92))'
              : 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.38)) drop-shadow(0 0 7px rgba(255, 214, 10, 0.45))';
          } else {
            rec.badgeEl.style.border = isSelected
              ? '3px solid #FFFFFF'
              : '2.5px solid #FFFFFF';
            rec.badgeEl.style.boxShadow = isSelected
              ? '0 10px 24px rgba(0, 0, 0, 0.42), 0 3px 8px rgba(0, 0, 0, 0.22), 0 0 0 2px rgba(255, 255, 255, 0.95)'
              : '0 6px 14px rgba(0, 0, 0, 0.34), 0 2px 5px rgba(0, 0, 0, 0.18)';
          }

          if (rec.pulseEl) {
            rec.pulseEl.style.background = rec.isStar
              ? 'radial-gradient(circle, rgba(255, 214, 10, 0.72) 0%, rgba(250, 204, 21, 0.25) 55%, transparent 75%)'
              : 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
            rec.pulseEl.style.display = isSelected ? 'block' : 'none';
          }
        }
      });

      const userHighlightKey = `${focusActive ? 1 : 0}:${zoomTier}`;
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

        // 2. Clean iOS Blue + White circular expansion wave around the discovered spot
        try {
          rec.rippleEl.style.border = '2px solid #007AFF';
          rec.rippleEl.style.background = 'radial-gradient(circle, rgba(0, 122, 255, 0.22) 0%, rgba(0, 122, 255, 0) 70%)';
          rec.rippleEl.style.boxShadow = '0 0 16px rgba(0, 122, 255, 0.55)';
          rec.rippleEl.animate(
            [
              { transform: 'scale(1)', opacity: 0.95 },
              { transform: 'scale(2.45)', opacity: 0 },
            ],
            {
              duration: 780,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }
          );
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

    // Create and update spot markers incrementally (rebuilds a marker immediately if its "Estrela" status changes)
    const syncSpotMarkers = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;

      const currentSelectedId = selectedSpotRef.current?.id;
      const currentSpots = spotsRef.current || [];
      const validSpots = currentSpots.filter(
        (s) => typeof s.lng === 'number' && !isNaN(s.lng) && typeof s.lat === 'number' && !isNaN(s.lat)
      );
      const nextSpotIds = new Set(validSpots.map((s) => s.id));

      // Remove markers whose spots are no longer in the filtered list or belong to a disposed map instance
      markerRecordsRef.current = markerRecordsRef.current.filter((rec) => {
        if (!nextSpotIds.has(rec.spotId) || rec.mapInstance !== map) {
          try {
            rec.marker.remove();
          } catch (e) {}
          return false;
        }
        return true;
      });

      const existingMap = new Map(markerRecordsRef.current.map((rec) => [rec.spotId, rec]));

      const starPath100 = buildRoundedStarPath(50, 51, 47, 22, 0.16, 2);
      const starPath01 = buildRoundedStarPath(0.5, 0.51, 0.47, 0.22, 0.16, 4);
      const starMaskDataUri = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${starPath100}' fill='black'/></svg>")`;

      validSpots.forEach((spot, spotIdx) => {
        const lng = Number(spot.lng);
        const lat = Number(spot.lat);
        const imgUrl = getSpotImage(spot);
        const isStar = isFiveStarSpot(spot);
        const existing = existingMap.get(spot.id);

        if (existing && existing.mapInstance === map) {
          if (existing.isStar !== isStar) {
            // "Estrela" option changed! Remove old marker so it rebuilds immediately as Yellow Star or Circle
            try {
              existing.marker.remove();
            } catch (e) {}
            markerRecordsRef.current = markerRecordsRef.current.filter((r) => r.spotId !== spot.id);
            animatedSpotIdsRef.current.delete(spot.id);
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
            return;
          }
        }

        const isSelected = currentSelectedId === spot.id;

        const el = document.createElement('div');
        el.className = 'monvian-explore-marker group cursor-pointer select-none';
        el.style.touchAction = 'manipulation';
        el.style.contain = 'layout style';
        el.setAttribute('data-spot-id', spot.id);

        const containerEl = document.createElement('div');
        containerEl.style.position = 'relative';
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.alignItems = 'center';
        containerEl.style.justifyContent = 'center';
        containerEl.style.transition =
          'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        containerEl.style.transform = isSelected ? 'scale(1.22)' : 'scale(0.96)';
        containerEl.style.zIndex = isSelected ? '50' : '20';

        animatedSpotIdsRef.current.add(spot.id);

        const markerSize = isStar ? 54 : 42;
        const auraOffset = isStar ? -7 : -13;

        // Glowing circular translucent aura/halo (yellow aura for Star when selected)
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

        // Primary visual expansion ripple around the marker (displayed only on tap)
        const rippleEl = document.createElement('div');
        rippleEl.style.position = 'absolute';
        rippleEl.style.width = `${markerSize}px`;
        rippleEl.style.height = `${markerSize}px`;
        rippleEl.style.top = '0';
        rippleEl.style.left = '0';
        rippleEl.style.borderRadius = '9999px';
        rippleEl.style.pointerEvents = 'none';
        rippleEl.style.zIndex = '-1';
        rippleEl.style.opacity = '0';
        rippleEl.style.display = 'none';
        rippleEl.style.border = isStar
          ? '2px solid rgba(255, 214, 10, 0.95)'
          : '2px solid rgba(255, 255, 255, 0.92)';
        rippleEl.style.backgroundColor = isStar
          ? 'rgba(255, 214, 10, 0.22)'
          : 'rgba(255, 255, 255, 0.18)';
        rippleEl.style.boxShadow = isStar
          ? '0 0 14px rgba(255, 214, 10, 0.55)'
          : '0 0 12px rgba(255, 255, 255, 0.4)';

        // Secondary concentric ripple echo for liquid iOS tactile depth
        const secondaryRippleEl = document.createElement('div');
        secondaryRippleEl.style.position = 'absolute';
        secondaryRippleEl.style.width = `${markerSize}px`;
        secondaryRippleEl.style.height = `${markerSize}px`;
        secondaryRippleEl.style.top = '0';
        secondaryRippleEl.style.left = '0';
        secondaryRippleEl.style.borderRadius = '9999px';
        secondaryRippleEl.style.pointerEvents = 'none';
        secondaryRippleEl.style.zIndex = '-1';
        secondaryRippleEl.style.opacity = '0';
        secondaryRippleEl.style.display = 'none';
        secondaryRippleEl.style.border = isStar
          ? '1.5px solid rgba(255, 214, 10, 0.78)'
          : '1.5px solid rgba(255, 255, 255, 0.72)';

        // Wrapper that carries the continuous 2.5s 1.0 -> 1.06 pulse animation for "Estrela" markers
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
          // FAMOUS YELLOW STAR MARKER ("Estrela"): 5-pointed Yellow Star with the spot's photo in the middle and gentle pulse
          badgeEl.style.filter = isSelected
            ? 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.48)) drop-shadow(0 0 12px rgba(255, 214, 10, 0.92))'
            : 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.38)) drop-shadow(0 0 7px rgba(255, 214, 10, 0.45))';

          const safeId = spot.id.replace(/[^a-zA-Z0-9_-]/g, '');
          const clipId = `monvian-star-clip-${safeId}`;
          const gradId = `monvian-star-grad-${safeId}`;

          // 1. Vibrant Yellow (#FFD60A / #FACC15) 5-pointed star backing & contour + SVG clipPath definition
          const starBgSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          starBgSvg.setAttribute('viewBox', '0 0 100 100');
          starBgSvg.style.position = 'absolute';
          starBgSvg.style.inset = '0';
          starBgSvg.style.width = '100%';
          starBgSvg.style.height = '100%';
          starBgSvg.style.pointerEvents = 'none';
          starBgSvg.innerHTML = `
            <defs>
              <clipPath id="${clipId}" clipPathUnits="objectBoundingBox">
                <path d="${starPath01}" />
              </clipPath>
              <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FFE629" />
                <stop offset="50%" stop-color="#FFD60A" />
                <stop offset="100%" stop-color="#F5B301" />
              </linearGradient>
            </defs>
            <path d="${starPath100}" fill="url(#${gradId})" stroke="#FFD60A" stroke-width="3.2" stroke-linejoin="round" />
          `;

          // 2. Inner establishment photograph in the middle of the Yellow Star (inset by 5px so the yellow star points & frame stand out clearly)
          const photoMaskEl = document.createElement('div');
          photoMaskEl.style.position = 'absolute';
          photoMaskEl.style.inset = '5px';
          photoMaskEl.style.overflow = 'hidden';
          photoMaskEl.style.backgroundColor = '#18181B';
          photoMaskEl.style.clipPath = `url(#${clipId})`;
          (photoMaskEl.style as any).webkitClipPath = `url(#${clipId})`;
          (photoMaskEl.style as any).webkitMaskImage = starMaskDataUri;
          photoMaskEl.style.maskImage = starMaskDataUri;
          (photoMaskEl.style as any).webkitMaskSize = '100% 100%';
          photoMaskEl.style.maskSize = '100% 100%';
          (photoMaskEl.style as any).webkitMaskRepeat = 'no-repeat';
          photoMaskEl.style.maskRepeat = 'no-repeat';
          (photoMaskEl.style as any).webkitMaskPosition = 'center';
          photoMaskEl.style.maskPosition = 'center';

          photoMaskEl.appendChild(imgEl);

          // 3. Crisp inner yellow-gold contour around the photo inside the star
          const starRimSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          starRimSvg.setAttribute('viewBox', '0 0 100 100');
          starRimSvg.style.position = 'absolute';
          starRimSvg.style.inset = '5px';
          starRimSvg.style.width = 'calc(100% - 10px)';
          starRimSvg.style.height = 'calc(100% - 10px)';
          starRimSvg.style.pointerEvents = 'none';
          starRimSvg.innerHTML = `
            <path d="${starPath100}" fill="none" stroke="#FFD60A" stroke-width="2.8" stroke-linejoin="round" />
          `;

          badgeEl.appendChild(starBgSvg);
          badgeEl.appendChild(photoMaskEl);
          badgeEl.appendChild(starRimSvg);
        } else {
          // TRADITIONAL CIRCULAR MARKER
          badgeEl.style.borderRadius = '9999px';
          badgeEl.style.overflow = 'hidden';
          badgeEl.style.backgroundColor = '#18181B';
          badgeEl.style.border = isSelected ? '3px solid #FFFFFF' : '2.5px solid #FFFFFF';
          badgeEl.style.boxShadow = isSelected
            ? '0 10px 24px rgba(0, 0, 0, 0.42), 0 3px 8px rgba(0, 0, 0, 0.22), 0 0 0 2px rgba(255, 255, 255, 0.95)'
            : '0 6px 14px rgba(0, 0, 0, 0.34), 0 2px 5px rgba(0, 0, 0, 0.18)';

          imgEl.style.borderRadius = '9999px';

          const glossEl = document.createElement('div');
          glossEl.style.position = 'absolute';
          glossEl.style.inset = '0';
          glossEl.style.borderRadius = '9999px';
          glossEl.style.pointerEvents = 'none';
          glossEl.style.boxShadow =
            'inset 0 1.5px 3px rgba(255, 255, 255, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.28)';

          badgeEl.appendChild(imgEl);
          badgeEl.appendChild(glossEl);
        }

        pulseScaleWrapEl.appendChild(badgeEl);
        containerEl.appendChild(pulseEl);
        containerEl.appendChild(rippleEl);
        containerEl.appendChild(secondaryRippleEl);
        containerEl.appendChild(pulseScaleWrapEl);
        el.appendChild(containerEl);

        let pointerStartPos: { x: number; y: number } | null = null;
        let pointerMovedDuringTap = false;

        el.onpointerdown = (e) => {
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

        const marker = new maplibregl.Marker({ element: el, opacityWhenCovered: '0' })
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
          rippleEl,
          secondaryRippleEl,
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
            performance.now() - lastMapGestureTimeRef.current < 80
          ) {
            pointerMovedDuringTap = false;
            animateMarkerPress(badgeEl, false);
            return;
          }
          if (!selectedSpotRef.current && !previousCameraStateRef.current && mapRef.current) {
            const currentCenter = mapRef.current.getCenter();
            previousCameraStateRef.current = {
              center: [currentCenter.lng, currentCenter.lat],
              zoom: mapRef.current.getZoom(),
              pitch: mapRef.current.getPitch(),
              bearing: mapRef.current.getBearing(),
            };
          }
          playSpotClickSound();
          triggerPinTapFeedback(badgeEl, rippleEl, secondaryRippleEl);
          setFollowMode(false);
          onSelectSpotRef.current(record.spot);
        };

        markerRecordsRef.current.push(record);
      });

      syncMarkerHighlight(currentSelectedId);
    }, [syncMarkerHighlight, setFollowMode, triggerPinTapFeedback, animateMarkerPress, buildRoundedStarPath, isFiveStarSpot]);

    useEffect(() => {
      spotsRef.current = spots;
      syncSpotMarkers();
      if (
        !hasFramedInitialSpotsRef.current &&
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
          const isMobile = window.innerWidth < 768;
          const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;
          map.easeTo({
            center: [selectedSpotRef.current.lng, selectedSpotRef.current.lat],
            zoom: 15.5,
            pitch: is3DModeRef.current ? 60 : 35,
            bearing: is3DModeRef.current ? -20 : 0,
            offset: [0, verticalOffset],
            duration: 700,
          });
        }
      }
    }, [activeRoute, syncActiveRouteLayers, syncMarkerHighlight, setFollowMode]);

    // Update marker highlight and camera zoom smoothly when a tourist spot is selected, and restore camera when deselected
    useEffect(() => {
      syncMarkerHighlight(selectedSpot?.id);

      if (!mapRef.current) return;

      if (selectedSpot && selectedSpot.lng && selectedSpot.lat) {
        if (activeRouteRef.current?.spotId === selectedSpot.id) {
          return;
        }
        // Save exact camera state (zoom, center, pitch, bearing) before zooming into the tourist spot
        if (!previousCameraStateRef.current) {
          const currentCenter = mapRef.current.getCenter();
          previousCameraStateRef.current = {
            center: [currentCenter.lng, currentCenter.lat],
            zoom: mapRef.current.getZoom(),
            pitch: mapRef.current.getPitch(),
            bearing: mapRef.current.getBearing(),
          };
        }

        setFollowMode(false);
        const isMobile = window.innerWidth < 768;
        const verticalOffset = isMobile ? -Math.round(window.innerHeight * 0.12) : 0;

        mapRef.current.easeTo({
          center: [selectedSpot.lng, selectedSpot.lat],
          zoom: 15.5,
          pitch: is3DModeRef.current ? 60 : 35,
          bearing: is3DModeRef.current ? -20 : 0,
          offset: [0, verticalOffset],
          duration: 700,
        });
      } else if (previousCameraStateRef.current) {
        restorePreviousSpotCamera();
      }
    }, [selectedSpot, isFocusMode, syncMarkerHighlight, setFollowMode, restorePreviousSpotCamera]);

    // Return zoom and camera to the exact zoom/position before clicking the spot when closing or clicking the map
    useEffect(() => {
      if (!revertSpotZoomTrigger || revertSpotZoomTrigger === 0 || !mapRef.current) return;
      restorePreviousSpotCamera();
    }, [revertSpotZoomTrigger, restorePreviousSpotCamera]);

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

        {/* Alpine Snow on the Mountains Relief Atmosphere (Neve nas Montanhas) */}
        {snowEnabled && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-700 select-none"
            style={{
              background:
                theme === 'dark'
                  ? 'radial-gradient(circle at 50% 25%, rgba(186, 230, 253, 0.09) 0%, rgba(147, 197, 253, 0.03) 50%, transparent 80%)'
                  : 'radial-gradient(circle at 50% 25%, rgba(224, 242, 254, 0.22) 0%, rgba(186, 230, 253, 0.08) 50%, transparent 80%)',
            }}
          />
        )}

        {/* Dynamic Rain Atmosphere on Relief (Chuva Dinâmica no Relevo) */}
        {rainEnabled && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-700 select-none"
            style={{
              background:
                theme === 'dark'
                  ? 'linear-gradient(to bottom, rgba(15, 23, 42, 0.15) 0%, transparent 60%)'
                  : 'linear-gradient(to bottom, rgba(100, 116, 139, 0.09) 0%, transparent 60%)',
            }}
          />
        )}

        {/* Floating Right-Side Map Controls (Compass/Location, Layers) */}
        <div
          id="mobile-map-right-controls"
          className={`md:hidden absolute right-3.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isFocusMode || isGlobeIntroPlaying
              ? 'opacity-0 scale-90 pointer-events-none [&_*]:!pointer-events-none'
              : 'opacity-100 scale-100 pointer-events-auto'
          }`}
          style={{
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >

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
