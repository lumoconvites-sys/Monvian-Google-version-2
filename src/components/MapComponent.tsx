import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, Layers } from 'lucide-react';
import { Spot, MapModeType } from '../types';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { generateMarkerHtml, MAP_VISUAL_ICON_CATEGORIES } from '../utils/mapVisualIcons';
import { gpsNavigationManager } from '../services/gpsNavigation';
import { monvianXpManager } from '../services/xpService';
import { deviceHeadingManager } from '../utils/deviceHeading';
import { triggerHapticFeedback } from '../utils/haptics';
import { CompassIcon } from './CompassIcon';

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

  // 2. Standard Streets / Dark Mode
  if (token) {
    const styleId = theme === 'dark' ? 'mapbox/dark-v11' : 'mapbox/streets-v12';
    return {
      version: 8,
      projection: { type: 'globe' } as any,
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
        },
      ],
    };
  }

  // Dark mode map fallback (Clean Apple-style dark navigation map)
  if (theme === 'dark') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
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
        },
      ],
    };
  }

  // Esri World Street Map (Light mode)
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

export const MapComponent = forwardRef<MapComponentHandle, MapComponentProps>(
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
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [currentMode, setCurrentMode] = useState<MapModeType>(
      mapMode === 'satelite' ? 'satelite' : 'explorar'
    );
    const [isFollowingUser, setIsFollowingUser] = useState<boolean>(false);
    const isFollowingUserRef = useRef<boolean>(false);
    const hasUserMovedMapRef = useRef<boolean>(false);
    const [isCompassTracking, setIsCompassTracking] = useState<boolean>(false);
    const isCompassTrackingRef = useRef<boolean>(false);
    const compassIconWrapperRef = useRef<HTMLDivElement | null>(null);
    const is3DModeRef = useRef<boolean>(is3DMode);
    const isTransitioning3DRef = useRef<boolean>(false);
    const isMapGestureActiveRef = useRef<boolean>(false);
    const lastMapGestureTimeRef = useRef<number>(0);
    const onSelectSpotRef = useRef(onSelectSpot);
    const onMapClickRef = useRef(onMapClick);
    const spotsRef = useRef<Spot[]>(spots);

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
    const userAvatarImgRef = useRef<HTMLImageElement | null>(null);
    const userBeamRef = useRef<HTMLDivElement | null>(null);
    const latestUserCoordsRef = useRef<[number, number]>(
      normalizeCoords(userCoords, [-45.5908, -22.7394])
    );
    const hasCenteredOnFirstFixRef = useRef<boolean>(false);
    const lastCenteredSessionIdRef = useRef<number>(-1);
    const lastCenteredFixRevisionRef = useRef<number>(0);

    // Campos do Jordão Center Coordinates
    const CAMPOS_CENTER: [number, number] = [-45.5908, -22.7394];

    const setFollowMode = useCallback((follow: boolean) => {
      isFollowingUserRef.current = follow;
      setIsFollowingUser(follow);
      if (!follow) {
        isCompassTrackingRef.current = false;
        setIsCompassTracking(false);
      }
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

          // 1. Directional Blue Flashlight Cone ("Lanterna Azul" - Apple Maps iOS Compass Beam)
          const beamWrapper = document.createElement('div');
          beamWrapper.className = 'monvian-user-heading-beam';
          beamWrapper.style.position = 'absolute';
          beamWrapper.style.top = '27px'; // Exact center of the 54px outer avatar ring
          beamWrapper.style.left = '50%';
          beamWrapper.style.width = '196px';
          beamWrapper.style.height = '196px';
          const initialHeading = deviceHeadingManager.getCurrentHeading() || 0;
          const initialMapBearing = map.getBearing() || 0;
          const initialBeamAngle = (initialHeading - initialMapBearing + 360) % 360;
          beamWrapper.style.transform = `translate(-50%, -50%) rotate(${initialBeamAngle.toFixed(1)}deg)`;
          beamWrapper.style.transformOrigin = '50% 50%';
          beamWrapper.style.pointerEvents = 'none';
          beamWrapper.style.zIndex = '1';
          beamWrapper.style.willChange = 'transform';
          beamWrapper.innerHTML = `
            <svg viewBox="0 0 200 200" width="100%" height="100%" style="overflow: visible; filter: drop-shadow(0 0 12px rgba(0, 122, 255, 0.45));">
              <defs>
                <linearGradient id="monvianBlueFlashlightGrad" x1="100" y1="100" x2="100" y2="4" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#007AFF" stop-opacity="0.86" />
                  <stop offset="28%" stop-color="#0A84FF" stop-opacity="0.56" />
                  <stop offset="68%" stop-color="#38BDF8" stop-opacity="0.22" />
                  <stop offset="100%" stop-color="#38BDF8" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="monvianBlueFlashlightCore" x1="100" y1="100" x2="100" y2="16" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#60A5FA" stop-opacity="0.72" />
                  <stop offset="55%" stop-color="#007AFF" stop-opacity="0.32" />
                  <stop offset="100%" stop-color="#007AFF" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path d="M 100 100 L 36 10 A 110 110 0 0 1 164 10 Z" fill="url(#monvianBlueFlashlightGrad)" />
              <path d="M 100 100 L 60 18 A 92 92 0 0 1 140 18 Z" fill="url(#monvianBlueFlashlightCore)" />
              <path d="M 100 63 L 92 75 L 108 75 Z" fill="#FFFFFF" fill-opacity="0.95" />
            </svg>
          `;
          userBeamRef.current = beamWrapper;

          // 2. Center 3D Avatar Circle + Outer Translucent Ring + "Eu" Pill
          const centerStack = document.createElement('div');
          centerStack.style.position = 'relative';
          centerStack.style.display = 'flex';
          centerStack.style.flexDirection = 'column';
          centerStack.style.alignItems = 'center';
          centerStack.style.justifyContent = 'center';
          centerStack.style.zIndex = '2';
          centerStack.style.pointerEvents = 'auto';
          centerStack.style.cursor = 'pointer';

          // Outer 3D Ring (Círculo 3D translúcido ao redor da foto)
          const outerRing = document.createElement('div');
          outerRing.style.position = 'relative';
          outerRing.style.width = '54px';
          outerRing.style.height = '54px';
          outerRing.style.borderRadius = '9999px';
          outerRing.style.background = 'rgba(0, 122, 255, 0.20)';
          outerRing.style.border = '1.5px solid rgba(59, 130, 246, 0.45)';
          outerRing.style.boxShadow =
            '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 122, 255, 0.42)';
          outerRing.style.display = 'flex';
          outerRing.style.alignItems = 'center';
          outerRing.style.justifyContent = 'center';
          outerRing.style.backdropFilter = 'blur(4px)';

          // Inner Avatar Circle with White Border
          const innerCircle = document.createElement('div');
          innerCircle.style.width = '44px';
          innerCircle.style.height = '44px';
          innerCircle.style.borderRadius = '9999px';
          innerCircle.style.border = '2.5px solid #FFFFFF';
          innerCircle.style.overflow = 'hidden';
          innerCircle.style.backgroundColor = '#18181B';
          innerCircle.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';

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
            avatarImg.src =
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
          };
          userAvatarImgRef.current = avatarImg;

          innerCircle.appendChild(avatarImg);
          outerRing.appendChild(innerCircle);

          // "Eu" Pill Badge below the avatar
          const euBadge = document.createElement('div');
          euBadge.textContent = 'Eu';
          euBadge.style.marginTop = '-4px';
          euBadge.style.padding = '1.5px 10px';
          euBadge.style.borderRadius = '9999px';
          euBadge.style.backgroundColor = 'rgba(10, 10, 14, 0.92)';
          euBadge.style.color = '#FFFFFF';
          euBadge.style.fontSize = '11px';
          euBadge.style.fontWeight = '800';
          euBadge.style.letterSpacing = '0.01em';
          euBadge.style.lineHeight = '1.25';
          euBadge.style.border = '1px solid rgba(255, 255, 255, 0.16)';
          euBadge.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.5)';

          centerStack.appendChild(outerRing);
          centerStack.appendChild(euBadge);
          rootEl.appendChild(beamWrapper);
          rootEl.appendChild(centerStack);

          centerStack.onclick = (e) => {
            e.stopPropagation();
            centerOnUserLocation(true, true);
          };

          const initialLngLat =
            gpsNavigationManager.getCurrentInterpolatedCoords() ||
            latestUserCoordsRef.current ||
            normalizeCoords(userCoords, CAMPOS_CENTER);

          userMarkerRef.current = new maplibregl.Marker({
            element: rootEl,
            anchor: 'center',
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
      [userAvatar, userName, userCoords]
    );

    const centerOnUserLocation = useCallback(
      (activateSensors: boolean = true, toggleCompassMode: boolean = false) => {
        if (activateSensors) {
          deviceHeadingManager
            .requestPermission()
            .then(() => {
              if (gpsNavigationManager.getState().status !== 'granted') {
                gpsNavigationManager.requestPermissionAndStartFromGesture();
              }
            })
            .catch(() => {});
          deviceHeadingManager.start();
          if (!deviceHeadingManager.isPermissionRequired()) {
            gpsNavigationManager.requestPermissionAndStartFromGesture();
          }
        }

        if (toggleCompassMode) {
          const nextCompass = !isCompassTrackingRef.current;
          isCompassTrackingRef.current = nextCompass;
          setIsCompassTracking(nextCompass);
        }

        setFollowMode(true);

        const targetCoords =
          gpsNavigationManager.getCurrentInterpolatedCoords() ||
          latestUserCoordsRef.current ||
          CAMPOS_CENTER;

        if (mapRef.current) {
          ensureUserMarker(mapRef.current);
          userMarkerRef.current?.setLngLat(targetCoords);

          mapRef.current.easeTo({
            center: targetCoords,
            zoom: Math.max(mapRef.current.getZoom(), 15.6),
            pitch: is3DModeRef.current ? 60 : 0,
            bearing: is3DModeRef.current ? -20 : 0,
            duration: 650,
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
    }));

    // Synchronize mode from prop if provided (excluding dark map mode)
    useEffect(() => {
      if (mapMode) {
        const normalized: MapModeType = mapMode === 'satelite' ? 'satelite' : 'explorar';
        if (normalized !== currentMode) {
          setCurrentMode(normalized);
        }
      }
    }, [mapMode]);

    // Initialize or swap map style
    useEffect(() => {
      if (!mapContainerRef.current) return;

      const style = getVectorMapStyle(currentMode, theme);

      if (!mapRef.current) {
        const initialCoords = normalizeCoords(userCoords, CAMPOS_CENTER);
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: style,
          center: initialCoords,
          zoom: 14.5,
          pitch: is3DModeRef.current ? 60 : 0,
          bearing: is3DModeRef.current ? -20 : 0,
          maxPitch: 75,
          pitchWithRotate: true,
          touchPitch: true,
          attributionControl: false,
        });

        mapRef.current = map;
        ensureUserMarker(map);

        map.on('click', () => {
          if (onMapClickRef.current) onMapClickRef.current();
        });

        map.on('load', () => {
          syncSpotMarkers();
          ensureUserMarker(map);
          const currentGpsState = gpsNavigationManager.getState();
          if (currentGpsState.hasRealFix && currentGpsState.status === 'granted') {
            userMarkerRef.current?.setLngLat(currentGpsState.coords);
            if (!selectedSpotRef.current && !hasUserMovedMapRef.current && !hasCenteredOnFirstFixRef.current) {
              hasCenteredOnFirstFixRef.current = true;
              map.easeTo({
                center: currentGpsState.coords,
                zoom: 14.8,
                duration: 650,
              });
            }
          }
          if (onMapLoad) onMapLoad();
        });

        map.on('style.load', () => {
          syncSpotMarkers();
          ensureUserMarker(map);
        });

        // Mark map as manually moved by user when panning/zooming so camera never snaps back automatically
        const onUserManualMoveStart = (e: any) => {
          if (e && e.originalEvent) {
            isMapGestureActiveRef.current = true;
            lastMapGestureTimeRef.current = performance.now();
            hasUserMovedMapRef.current = true;
            setFollowMode(false);
          }
          if (onInteractionChange) onInteractionChange(true);
        };

        const onUserManualMove = (e: any) => {
          if (e && e.originalEvent) {
            isMapGestureActiveRef.current = true;
            lastMapGestureTimeRef.current = performance.now();
          }
        };

        const onInteractionEnd = (e: any) => {
          if (e && e.originalEvent) {
            lastMapGestureTimeRef.current = performance.now();
          }
          isMapGestureActiveRef.current = false;
          if (onInteractionChange) onInteractionChange(false);
        };

        map.on('dragstart', onUserManualMoveStart);
        map.on('zoomstart', onUserManualMoveStart);
        map.on('rotatestart', onUserManualMoveStart);
        map.on('pitchstart', onUserManualMoveStart);
        map.on('drag', onUserManualMove);
        map.on('zoom', onUserManualMove);
        map.on('dragend', onInteractionEnd);
        map.on('zoomend', onInteractionEnd);
        map.on('moveend', onInteractionEnd);

        // Keep deviceHeadingManager aware of map bearing so the flashlight aligns with true heading
        const syncBeamWithMapBearing = () => {
          const bearing = map.getBearing() || 0;
          deviceHeadingManager.setMapBearing(bearing);
          if (userBeamRef.current && deviceHeadingManager.hasSensorData()) {
            const rawHeading = deviceHeadingManager.getCurrentHeading();
            const beamAngle = (rawHeading - bearing + 360) % 360;
            userBeamRef.current.style.transform = `translate(-50%, -50%) rotate(${beamAngle.toFixed(1)}deg)`;
          }
        };

        deviceHeadingManager.setMapBearing(map.getBearing());
        map.on('rotate', syncBeamWithMapBearing);
        map.on('move', syncBeamWithMapBearing);
      } else {
        mapRef.current.setStyle(style);
        ensureUserMarker(mapRef.current);
      }
    }, [currentMode, theme, ensureUserMarker]);

    // Subscribe to 60fps Device Compass / 3D Orientation Heading for the Blue Flashlight ("Lanterna Azul") & Compass Icon
    useEffect(() => {
      deviceHeadingManager.start();
      const unsubscribeHeading = deviceHeadingManager.subscribe((rawHeading) => {
        if (isNaN(rawHeading)) return;

        if (mapRef.current && (!userMarkerRef.current || !userBeamRef.current)) {
          ensureUserMarker(mapRef.current);
        }

        const mapBearing = mapRef.current?.getBearing() || 0;
        const beamAngle = (rawHeading - mapBearing + 360) % 360;

        if (userBeamRef.current) {
          userBeamRef.current.style.transform = `translate(-50%, -50%) rotate(${beamAngle.toFixed(1)}deg)`;
        }

        if (compassIconWrapperRef.current) {
          compassIconWrapperRef.current.style.transform = `rotate(${(-rawHeading).toFixed(1)}deg)`;
        }
      });
      return () => {
        unsubscribeHeading();
      };
    }, [ensureUserMarker]);

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

    // Real-Time 60fps GPS Location Subscription + Camera Accompaniment
    useEffect(() => {
      gpsNavigationManager.start();

      const unsubscribeGps = gpsNavigationManager.subscribe((navState) => {
        const coords = navState.interpolatedCoords || navState.coords;
        if (!coords || isNaN(coords[0]) || isNaN(coords[1])) return;

        latestUserCoordsRef.current = coords;

        // Move the 3D user marker in real time at 60fps
        if (userMarkerRef.current) {
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
          userBeamRef.current.style.transform = `translate(-50%, -50%) rotate(${comp.toFixed(1)}deg)`;
        }

        // Only position camera on the very first initial GPS fix at boot if user hasn't touched the map
        if (
          mapRef.current &&
          navState.hasRealFix &&
          navState.status === 'granted' &&
          !hasCenteredOnFirstFixRef.current &&
          !hasUserMovedMapRef.current &&
          !selectedSpotRef.current &&
          !isTransitioning3DRef.current
        ) {
          hasCenteredOnFirstFixRef.current = true;
          mapRef.current.easeTo({
            center: navState.coords,
            zoom: 14.8,
            pitch: is3DModeRef.current ? 60 : 0,
            duration: 750,
          });
        }

        // Check physical proximity against spots for Monvian XP exploration rewards (<= 40m)
        if (spotsRef.current && spotsRef.current.length > 0) {
          monvianXpManager.evaluateProximity(navState, spotsRef.current).catch(() => {});
        }
      });

      return () => {
        unsubscribeGps();
      };
    }, []);

    // Trigger zoom to user only when explicitly requested
    useEffect(() => {
      if (zoomToUserTrigger && zoomToUserTrigger > 0) {
        centerOnUserLocation(false, false);
      }
    }, [zoomToUserTrigger, centerOnUserLocation]);

    // Focus camera on user marker with high spotlight zoom and hide other markers during spotlight presentation
    useEffect(() => {
      if (!isSpotlightActive) {
        const markers = document.querySelectorAll<HTMLElement>('.monvian-explore-marker');
        markers.forEach((m) => {
          m.style.transition = 'opacity 0.45s ease';
          m.style.opacity = '1';
          m.style.pointerEvents = 'auto';
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

        const markers = document.querySelectorAll<HTMLElement>('.monvian-explore-marker');
        markers.forEach((m) => {
          m.style.transition = 'opacity 0.3s ease';
          m.style.opacity = '0';
          m.style.pointerEvents = 'none';
        });
      }
    }, [isSpotlightActive, ensureUserMarker]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (userMarkerRef.current) {
          try {
            userMarkerRef.current.remove();
          } catch (e) {}
          userMarkerRef.current = null;
        }
        userMarkerMapRef.current = null;
        userBeamRef.current = null;
        markerRecordsRef.current.forEach((rec) => {
          try {
            rec.marker.remove();
          } catch (e) {}
        });
        markerRecordsRef.current = [];
        animatedSpotIdsRef.current.clear();
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }, []);

    // Update 3D mode pitch/bearing smoothly without interrupting or refreshing markers
    useEffect(() => {
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
      imgEl: HTMLImageElement;
      lat: number;
      lng: number;
      imgUrl: string;
    }[]>([]);
    const animatedSpotIdsRef = useRef<Set<string>>(new Set());

    const selectedSpotRef = useRef<Spot | null>(selectedSpot);
    useEffect(() => {
      selectedSpotRef.current = selectedSpot;
    }, [selectedSpot]);

    // Trigger short haptic feedback + subtle scale micro-animation & expanding ring on pin tap
    const triggerPinTapFeedback = useCallback(
      (badgeEl: HTMLDivElement, rippleEl: HTMLDivElement) => {
        triggerHapticFeedback(15);

        try {
          badgeEl.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.14)', offset: 0.38 },
              { transform: 'scale(1)' },
            ],
            {
              duration: 320,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }
          );
        } catch {}

        try {
          rippleEl.animate(
            [
              { transform: 'scale(1)', opacity: 0.85 },
              { transform: 'scale(1.65)', opacity: 0 },
            ],
            {
              duration: 420,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }
          );
        } catch {}
      },
      []
    );

    // Synchronize marker highlights smoothly without destroying DOM nodes
    const syncMarkerHighlight = useCallback((activeSpotId: string | null | undefined) => {
      markerRecordsRef.current.forEach((rec) => {
        const isSelected = activeSpotId ? rec.spotId === activeSpotId : false;
        rec.containerEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        rec.containerEl.style.transform = isSelected ? 'scale(1.22)' : 'scale(0.96)';
        rec.containerEl.style.zIndex = isSelected ? '50' : '20';

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
      });
    }, []);

    // Listen for Monvian XP Discovery choreography: 1.5s progress ring around pin -> elastic pin jump
    useEffect(() => {
      const cleanupRing = (spotId: string) => {
        const rec = markerRecordsRef.current.find((r) => r.spotId === spotId);
        if (!rec) return;
        const existingRing = rec.containerEl.querySelector('.monvian-xp-charge-ring');
        if (existingRing) {
          existingRing.remove();
        }
      };

      const handleDiscoveryStart = (e: any) => {
        const detail = e?.detail;
        if (!detail || !detail.spotId) return;
        const rec = markerRecordsRef.current.find((r) => r.spotId === detail.spotId);
        if (!rec) return;

        cleanupRing(detail.spotId);

        const durationMs = detail.durationMs || 1500;
        rec.containerEl.style.zIndex = '150';

        // Create circular SVG progress ring around the pin (58x58 wrapping the 42x42 marker)
        const ringWrap = document.createElement('div');
        ringWrap.className = 'monvian-xp-charge-ring';
        ringWrap.style.position = 'absolute';
        ringWrap.style.width = '58px';
        ringWrap.style.height = '58px';
        ringWrap.style.top = '-8px';
        ringWrap.style.left = '-8px';
        ringWrap.style.pointerEvents = 'none';
        ringWrap.style.zIndex = '60';

        const radius = 25;
        const circumference = 2 * Math.PI * radius;

        ringWrap.innerHTML = `
          <svg viewBox="0 0 58 58" style="width:100%;height:100%;transform:rotate(-90deg);overflow:visible;">
            <defs>
              <linearGradient id="xp-ring-grad-${detail.spotId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FDE047" />
                <stop offset="50%" stop-color="#F59E0B" />
                <stop offset="100%" stop-color="#0066FF" />
              </linearGradient>
            </defs>
            <circle
              cx="29"
              cy="29"
              r="${radius}"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              stroke-width="3.5"
            />
            <circle
              class="xp-ring-progress-circle"
              cx="29"
              cy="29"
              r="${radius}"
              fill="none"
              stroke="url(#xp-ring-grad-${detail.spotId})"
              stroke-width="4"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
              style="filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.85));"
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

        // Subtle charging scale pulse on the pin itself
        try {
          rec.pulseScaleWrapEl.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.12)', offset: 0.5 },
              { transform: 'scale(1.16)' },
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
        cleanupRing(spotId);
      };

      const handleXpAwarded = (e: any) => {
        const detail = e?.detail;
        if (!detail || !detail.spotId) return;
        const rec = markerRecordsRef.current.find((r) => r.spotId === detail.spotId);
        if (!rec) return;

        cleanupRing(detail.spotId);
        rec.containerEl.style.zIndex = '180';

        // 1. Elastic vertical jump of the pin on the map
        try {
          rec.pulseScaleWrapEl.animate(
            [
              { transform: 'translateY(0px) scale(1.12)' },
              { transform: 'translateY(-30px) scale(1.36)', offset: 0.34 },
              { transform: 'translateY(4px) scale(0.92)', offset: 0.68 },
              { transform: 'translateY(-7px) scale(1.06)', offset: 0.86 },
              { transform: 'translateY(0px) scale(1)' },
            ],
            {
              duration: 720,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              fill: 'forwards',
            }
          );
        } catch {}

        // 2. Golden halo burst on the jumping pin
        try {
          rec.rippleEl.style.border = '2.5px solid #F59E0B';
          rec.rippleEl.style.boxShadow = '0 0 18px rgba(245, 158, 11, 0.9)';
          rec.rippleEl.animate(
            [
              { transform: 'scale(1)', opacity: 1 },
              { transform: 'scale(2.35)', opacity: 0 },
            ],
            {
              duration: 650,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }
          );
        } catch {}
      };

      window.addEventListener('monvian:xp_discovery_start', handleDiscoveryStart);
      window.addEventListener('monvian:xp_discovery_cancel', handleDiscoveryCancel);
      window.addEventListener('monvian:xp_awarded', handleXpAwarded);
      return () => {
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
        el.setAttribute('data-spot-id', spot.id);

        const containerEl = document.createElement('div');
        containerEl.style.position = 'relative';
        containerEl.style.display = 'flex';
        containerEl.style.flexDirection = 'column';
        containerEl.style.alignItems = 'center';
        containerEl.style.justifyContent = 'center';
        containerEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        containerEl.style.transform = isSelected ? 'scale(1.22)' : 'scale(0.96)';
        containerEl.style.zIndex = isSelected ? '50' : '20';

        // Spring entrance animation ONLY the very first time a spot marker is created (or when toggling star status)
        if (!animatedSpotIdsRef.current.has(spot.id)) {
          animatedSpotIdsRef.current.add(spot.id);
          try {
            containerEl.animate(
              [
                { transform: 'scale(0) translateY(12px)', opacity: 0 },
                { transform: 'scale(1.18) translateY(-2px)', opacity: 1, offset: 0.68 },
                {
                  transform: isSelected
                    ? 'scale(1.22) translateY(0px)'
                    : 'scale(0.96) translateY(0px)',
                  opacity: 1,
                },
              ],
              {
                duration: 420 + (spotIdx % 10) * 35,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                fill: 'both',
              }
            );
          } catch (e) {}
        }

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

        // Discrete visual expansion ring around the marker (triggered on tap)
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
        rippleEl.style.border = isStar
          ? '1.5px solid rgba(255, 214, 10, 0.9)'
          : '1.5px solid rgba(255, 255, 255, 0.8)';
        rippleEl.style.boxShadow = isStar
          ? '0 0 12px rgba(255, 214, 10, 0.55)'
          : '0 0 10px rgba(255, 255, 255, 0.35)';

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
        containerEl.appendChild(pulseScaleWrapEl);
        el.appendChild(containerEl);

        let pointerStartPos: { x: number; y: number } | null = null;
        let pointerMovedDuringTap = false;

        el.onpointerdown = (e) => {
          pointerStartPos = { x: e.clientX, y: e.clientY };
          pointerMovedDuringTap = false;
        };

        el.onpointermove = (e) => {
          if (!pointerStartPos) return;
          const dx = e.clientX - pointerStartPos.x;
          const dy = e.clientY - pointerStartPos.y;
          if (dx * dx + dy * dy > 64) {
            pointerMovedDuringTap = true;
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
          rippleEl,
          imgEl,
          lat,
          lng,
          imgUrl,
        };

        el.onclick = (e) => {
          e.stopPropagation();
          if (
            pointerMovedDuringTap ||
            isMapGestureActiveRef.current ||
            performance.now() - lastMapGestureTimeRef.current < 80
          ) {
            pointerMovedDuringTap = false;
            return;
          }
          triggerPinTapFeedback(badgeEl, rippleEl);
          setFollowMode(false);
          onSelectSpotRef.current(record.spot);
        };

        markerRecordsRef.current.push(record);
      });

      syncMarkerHighlight(currentSelectedId);
    }, [syncMarkerHighlight, setFollowMode, triggerPinTapFeedback, buildRoundedStarPath, isFiveStarSpot]);

    useEffect(() => {
      spotsRef.current = spots;
      syncSpotMarkers();
    }, [spots, syncSpotMarkers]);

    const previousCameraStateRef = useRef<{
      center: [number, number];
      zoom: number;
      pitch: number;
      bearing: number;
    } | null>(null);

    // Update marker highlight and camera zoom smoothly when a tourist spot is selected
    useEffect(() => {
      syncMarkerHighlight(selectedSpot?.id);

      if (!mapRef.current) return;

      if (selectedSpot && selectedSpot.lng && selectedSpot.lat) {
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
      }
    }, [selectedSpot, syncMarkerHighlight, setFollowMode]);

    // Return zoom and camera to the exact zoom/position before clicking the spot when closing or clicking the map
    useEffect(() => {
      if (!revertSpotZoomTrigger || revertSpotZoomTrigger === 0 || !mapRef.current) return;

      const savedCamera = previousCameraStateRef.current;
      previousCameraStateRef.current = null;

      if (savedCamera) {
        mapRef.current.easeTo({
          center: savedCamera.center,
          zoom: savedCamera.zoom,
          pitch: savedCamera.pitch,
          bearing: savedCamera.bearing,
          offset: [0, 0],
          duration: 700,
        });
      } else {
        mapRef.current.easeTo({
          zoom: mapRef.current.getZoom(),
          pitch: is3DModeRef.current ? 60 : 0,
          bearing: is3DModeRef.current ? -20 : 0,
          offset: [0, 0],
          duration: 700,
        });
      }
    }, [revertSpotZoomTrigger]);

    // Render static visual map icons
    const visualIconMarkersRef = useRef<maplibregl.Marker[]>([]);

    const renderVisualIcons = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;

      visualIconMarkersRef.current.forEach((m) => {
        try {
          m.remove();
        } catch (e) {}
      });
      visualIconMarkersRef.current = [];
      return;

      visualIcons.forEach((item, iconIdx) => {
        const latNum = Number(item.latitude);
        const lngNum = Number(item.longitude);
        if (isNaN(latNum) || isNaN(lngNum)) return;
        if (item.is_active === 0 || item.is_active === false) return;

        const el = document.createElement('div');
        el.className = 'monvian-visual-icon-pin select-none z-10';
        el.style.pointerEvents = 'auto';
        el.style.userSelect = 'none';
        el.style.webkitUserSelect = 'none';
        el.style.cursor = 'pointer';

        el.innerHTML = generateMarkerHtml(item.category, 26, item.color);

        try {
          el.animate(
            [
              { transform: 'scale(0)', opacity: 0 },
              { transform: 'scale(1.28)', opacity: 1, offset: 0.68 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            {
              duration: 380 + (iconIdx % 12) * 30,
              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              fill: 'both',
            }
          );
        } catch (e) {}

        el.onclick = (e) => {
          e.stopPropagation();
          try {
            el.animate(
              [
                { transform: 'scale(0.82)' },
                { transform: 'scale(1.35)', offset: 0.6 },
                { transform: 'scale(1)' },
              ],
              {
                duration: 360,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              }
            );
          } catch (err) {}

          const meta = MAP_VISUAL_ICON_CATEGORIES[item.category];
          const label = meta?.label || 'Ponto de Referência';
          try {
            new maplibregl.Popup({ offset: 25, closeButton: true })
              .setLngLat([lngNum, latNum])
              .setHTML(`<div style="padding: 6px 10px; font-weight: bold; font-size: 13px; color: #111; font-family: sans-serif;">📍 ${label}</div>`)
              .addTo(map);
          } catch (err) {}
        };

        const marker = new maplibregl.Marker({
          element: el,
        })
          .setLngLat([lngNum, latNum])
          .addTo(map);

        visualIconMarkersRef.current.push(marker);
      });
    }, [visualIcons]);

    useEffect(() => {
      renderVisualIcons();
      const map = mapRef.current;
      if (map) {
        map.on('style.load', renderVisualIcons);
        map.on('load', renderVisualIcons);
      }
      return () => {
        if (map) {
          map.off('style.load', renderVisualIcons);
          map.off('load', renderVisualIcons);
        }
      };
    }, [renderVisualIcons]);

    const handleCycleMapStyle = () => {
      const next: MapModeType = currentMode === 'satelite' ? 'explorar' : 'satelite';
      setCurrentMode(next);
      if (onMapModeChange) onMapModeChange(next);
      if (onStyleChange) onStyleChange(next);
    };

    return (
      <div className="w-full h-full relative inset-0 select-none overflow-hidden">
        <div
          ref={mapContainerRef}
          className="w-full h-full absolute inset-0 select-none"
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

        {/* Floating Right-Side Map Controls (+, -, Compass/Location, Layers) */}
        <div
          className="md:hidden absolute right-3.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3 pointer-events-auto"
          style={{
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >
          {/* Zoom In (+) */}
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
            aria-label="Aproximar mapa"
            className="w-12 h-12 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.22)] flex items-center justify-center text-zinc-800 dark:text-white active:scale-90 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Zoom Out (-) */}
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
            aria-label="Afastar mapa"
            className="w-12 h-12 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.22)] flex items-center justify-center text-zinc-800 dark:text-white active:scale-90 transition-all cursor-pointer"
          >
            <Minus className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* My Real-Time Location & Compass Orientation Button */}
          <button
            type="button"
            onClick={() => centerOnUserLocation(true, true)}
            aria-label="Centralizar na minha localização e ativar bússola em tempo real"
            className={`w-12 h-12 rounded-full backdrop-blur-md border shadow-[0_6px_20px_rgba(0,0,0,0.22)] flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
              isCompassTracking
                ? 'bg-blue-500 text-white border-blue-400 ring-2 ring-blue-500/35'
                : isFollowingUser
                  ? 'bg-white dark:bg-zinc-900/95 border-blue-500/40 dark:border-white/15 ring-2 ring-blue-500/20'
                  : 'bg-white/90 dark:bg-zinc-900/90 border-zinc-200/80 dark:border-white/10'
            }`}
          >
            <div
              ref={compassIconWrapperRef}
              className="flex items-center justify-center will-change-transform"
            >
              <CompassIcon
                size={24}
                className={isCompassTracking ? '[&_path]:!fill-white [&_path]:!text-white' : ''}
              />
            </div>
          </button>

          {/* Map Layers Toggle */}
          <button
            type="button"
            onClick={handleCycleMapStyle}
            aria-label="Alternar camada do mapa"
            className="w-12 h-12 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.22)] flex items-center justify-center text-zinc-800 dark:text-white active:scale-90 transition-all cursor-pointer"
          >
            <Layers className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      </div>
    );
  }
);
