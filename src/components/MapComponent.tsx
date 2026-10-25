import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, Layers } from 'lucide-react';
import { Spot, MapModeType } from '../types';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { generateMarkerHtml, MAP_VISUAL_ICON_CATEGORIES } from '../utils/mapVisualIcons';
import { gpsNavigationManager } from '../services/gpsNavigation';
import { deviceHeadingManager } from '../utils/deviceHeading';
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
              const localAv = localStorage.getItem('monvian_local_avatar');
              if (localAv && localAv.trim().length > 0) return localAv;
              const savedUser = JSON.parse(localStorage.getItem('monvian_user') || '{}');
              if (savedUser?.avatar_url && savedUser.avatar_url.trim().length > 0)
                return savedUser.avatar_url;
            } catch {}
            return av || '/fotoperfil.png';
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
            hasUserMovedMapRef.current = true;
            setFollowMode(false);
            if (selectedSpotRef.current) {
              previousCameraStateRef.current = null;
            }
          }
          if (onInteractionChange) onInteractionChange(true);
        };

        const onInteractionEnd = () => {
          if (onInteractionChange) onInteractionChange(false);
        };

        map.on('dragstart', onUserManualMoveStart);
        map.on('zoomstart', onUserManualMoveStart);
        map.on('rotatestart', onUserManualMoveStart);
        map.on('pitchstart', onUserManualMoveStart);
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
            const localAv = localStorage.getItem('monvian_local_avatar');
            if (localAv && localAv.trim().length > 0) resolved = localAv;
            else {
              const savedUser = JSON.parse(localStorage.getItem('monvian_user') || '{}');
              if (savedUser?.avatar_url && savedUser.avatar_url.trim().length > 0) {
                resolved = savedUser.avatar_url;
              }
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
            bearing: is3DModeRef.current ? -20 : 0,
            duration: 750,
          });
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

    const markerRecordsRef = useRef<{
      spotId: string;
      mapInstance: maplibregl.Map;
      marker: maplibregl.Marker;
      el: HTMLDivElement;
      containerEl: HTMLDivElement;
      badgeEl: HTMLDivElement;
      pulseEl: HTMLDivElement;
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

    // Synchronize marker highlights smoothly without destroying DOM nodes
    const syncMarkerHighlight = useCallback((activeSpotId: string | null | undefined) => {
      markerRecordsRef.current.forEach((rec) => {
        const isSelected = activeSpotId ? rec.spotId === activeSpotId : false;
        rec.containerEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        rec.containerEl.style.transform = isSelected ? 'scale(1.25)' : 'scale(0.96)';
        rec.containerEl.style.zIndex = isSelected ? '50' : '20';

        rec.badgeEl.style.border = isSelected
          ? '3px solid #FFFFFF'
          : '2.5px solid #FFFFFF';
        rec.badgeEl.style.boxShadow = isSelected
          ? '0 10px 24px rgba(0, 0, 0, 0.42), 0 3px 8px rgba(0, 0, 0, 0.22), 0 0 0 2px rgba(255, 255, 255, 0.95)'
          : '0 6px 14px rgba(0, 0, 0, 0.34), 0 2px 5px rgba(0, 0, 0, 0.18)';

        if (rec.pulseEl) {
          rec.pulseEl.style.background =
            'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
          rec.pulseEl.style.display = isSelected ? 'block' : 'none';
        }
      });
    }, []);

    // Create and update spot markers incrementally (NEVER destroy/recreate existing markers on 3D toggle or selection)
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

      validSpots.forEach((spot, spotIdx) => {
        const lng = Number(spot.lng);
        const lat = Number(spot.lat);
        const imgUrl = getSpotImage(spot);
        const existing = existingMap.get(spot.id);

        if (existing && existing.mapInstance === map) {
          // Ensure marker element is connected to the active map DOM
          if (!existing.el.isConnected) {
            existing.marker.addTo(map);
          }
          // Update coordinates or image in-place without recreating or re-animating the marker
          if (existing.lng !== lng || existing.lat !== lat) {
            existing.marker.setLngLat([lng, lat]);
            existing.lng = lng;
            existing.lat = lat;
          }
          if (existing.imgUrl !== imgUrl) {
            existing.imgEl.src = imgUrl;
            existing.imgUrl = imgUrl;
          }
          existing.el.onclick = (e) => {
            e.stopPropagation();
            setFollowMode(false);
            onSelectSpotRef.current(spot);
          };
          return;
        }

        const isSelected = currentSelectedId === spot.id;

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

        // Spring entrance animation ONLY the very first time a spot marker is created
        if (!animatedSpotIdsRef.current.has(spot.id)) {
          animatedSpotIdsRef.current.add(spot.id);
          try {
            containerEl.animate(
              [
                { transform: 'scale(0) translateY(12px)', opacity: 0 },
                { transform: 'scale(1.2) translateY(-2px)', opacity: 1, offset: 0.68 },
                {
                  transform: isSelected
                    ? 'scale(1.25) translateY(0px)'
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

        // Glowing circular translucent aura/halo (white aura)
        const pulseEl = document.createElement('div');
        pulseEl.style.position = 'absolute';
        pulseEl.style.width = '68px';
        pulseEl.style.height = '68px';
        pulseEl.style.borderRadius = '9999px';
        pulseEl.style.top = '-13px';
        pulseEl.style.left = '-13px';
        pulseEl.style.pointerEvents = 'none';
        pulseEl.style.zIndex = '-1';
        pulseEl.style.background =
          'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
        pulseEl.style.display = isSelected ? 'block' : 'none';

        // Pure Rounded 3D Circular Badge (no bottom square pointer)
        const badgeEl = document.createElement('div');
        badgeEl.style.position = 'relative';
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
          ? '0 10px 24px rgba(0, 0, 0, 0.42), 0 3px 8px rgba(0, 0, 0, 0.22), 0 0 0 2px rgba(255, 255, 255, 0.95)'
          : '0 6px 14px rgba(0, 0, 0, 0.34), 0 2px 5px rgba(0, 0, 0, 0.18)';

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

        // Subtle 3D spherical inner rim / highlight overlay
        const glossEl = document.createElement('div');
        glossEl.style.position = 'absolute';
        glossEl.style.inset = '0';
        glossEl.style.borderRadius = '9999px';
        glossEl.style.pointerEvents = 'none';
        glossEl.style.boxShadow =
          'inset 0 1.5px 3px rgba(255, 255, 255, 0.45), inset 0 -2px 4px rgba(0, 0, 0, 0.28)';

        badgeEl.appendChild(imgEl);
        badgeEl.appendChild(glossEl);

        containerEl.appendChild(pulseEl);
        containerEl.appendChild(badgeEl);
        el.appendChild(containerEl);

        el.onclick = (e) => {
          e.stopPropagation();
          setFollowMode(false);
          onSelectSpotRef.current(spot);
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        markerRecordsRef.current.push({
          spotId: spot.id,
          mapInstance: map,
          marker,
          el,
          containerEl,
          badgeEl,
          pulseEl,
          imgEl,
          lat,
          lng,
          imgUrl,
        });
      });

      syncMarkerHighlight(currentSelectedId);
    }, [syncMarkerHighlight, setFollowMode]);

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
        // Save camera position before zooming into the tourist spot
        if (!previousCameraStateRef.current) {
          const currentCenter = mapRef.current.getCenter();
          previousCameraStateRef.current = {
            center: [currentCenter.lng, currentCenter.lat],
            zoom: Math.min(mapRef.current.getZoom(), 14.5),
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

    // Return zoom and camera to the user's original focus when the user clicks 'X' or clicks anywhere on the map while viewing a tourist spot
    useEffect(() => {
      if (!revertSpotZoomTrigger || revertSpotZoomTrigger === 0 || !mapRef.current) return;

      previousCameraStateRef.current = null;

      const targetCoords =
        gpsNavigationManager.getCurrentInterpolatedCoords() ||
        latestUserCoordsRef.current ||
        CAMPOS_CENTER;

      ensureUserMarker(mapRef.current);
      userMarkerRef.current?.setLngLat(targetCoords);

      mapRef.current.easeTo({
        center: targetCoords,
        zoom: 14.5,
        pitch: is3DModeRef.current ? 60 : 0,
        bearing: is3DModeRef.current ? -20 : 0,
        offset: [0, 0],
        duration: 700,
      });
    }, [revertSpotZoomTrigger, ensureUserMarker]);

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
