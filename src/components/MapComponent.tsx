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
      onStyleChange,
    },
    ref
  ) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [currentMode, setCurrentMode] = useState<MapModeType>(mapMode);
    const [isFollowingUser, setIsFollowingUser] = useState<boolean>(true);
    const isFollowingUserRef = useRef<boolean>(true);

    // User location marker & flashlight refs
    const userMarkerRef = useRef<maplibregl.Marker | null>(null);
    const userBeamElRef = useRef<HTMLDivElement | null>(null);
    const userAvatarImgRef = useRef<HTMLImageElement | null>(null);
    const latestUserCoordsRef = useRef<[number, number]>(
      normalizeCoords(userCoords, [-45.587, -22.7355])
    );
    const hasCenteredOnFirstFixRef = useRef<boolean>(false);

    // Campos do Jordão Center Coordinates
    const CAMPOS_CENTER: [number, number] = [-45.5908, -22.7394];

    const setFollowMode = useCallback((follow: boolean) => {
      isFollowingUserRef.current = follow;
      setIsFollowingUser(follow);
    }, []);

    const centerOnUserLocation = useCallback(
      (activateSensors: boolean = true) => {
        if (activateSensors) {
          deviceHeadingManager.requestPermission().catch(() => {});
          deviceHeadingManager.start();
          gpsNavigationManager.start();
        }

        setFollowMode(true);

        const targetCoords =
          gpsNavigationManager.getCurrentInterpolatedCoords() ||
          latestUserCoordsRef.current ||
          CAMPOS_CENTER;

        if (mapRef.current) {
          mapRef.current.easeTo({
            center: targetCoords,
            zoom: Math.max(mapRef.current.getZoom(), 15.6),
            pitch: is3DMode ? 52 : 0,
            bearing: 0,
            duration: 750,
          });
        }
      },
      [is3DMode, setFollowMode]
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
        setCurrentMode(mode);
        if (onMapModeChange) onMapModeChange(mode);
        if (onStyleChange) onStyleChange(mode);
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
          pitch: is3DMode ? 52 : 35,
          bearing: is3DMode ? -15 : 0,
          offset: [0, verticalOffset],
          duration: 750,
        });
      },
      recenter: () => {
        centerOnUserLocation(true);
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
        const initialCoords = normalizeCoords(userCoords, CAMPOS_CENTER);
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: style,
          center: initialCoords,
          zoom: 14.5,
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

        // Pause auto-follow when user manually pans/drags the map
        const onUserDragStart = (e: any) => {
          if (e && e.originalEvent) {
            setFollowMode(false);
          }
          if (onInteractionChange) onInteractionChange(true);
        };

        const onInteractionEnd = () => {
          if (onInteractionChange) onInteractionChange(false);
        };

        map.on('dragstart', onUserDragStart);
        map.on('moveend', onInteractionEnd);

        // Keep deviceHeadingManager aware of map bearing so the flashlight aligns with true heading
        map.on('rotate', () => {
          deviceHeadingManager.setMapBearing(map.getBearing());
        });
        map.on('move', () => {
          deviceHeadingManager.setMapBearing(map.getBearing());
        });
      } else {
        mapRef.current.setStyle(style);
      }
    }, [currentMode, theme]);

    // Create and manage the 3D User Location Marker ("Eu" + Avatar + Rotating Blue Flashlight Cone)
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      if (!userMarkerRef.current) {
        const rootEl = document.createElement('div');
        rootEl.className = 'monvian-user-location-marker select-none';
        rootEl.style.position = 'relative';
        rootEl.style.width = '150px';
        rootEl.style.height = '150px';
        rootEl.style.display = 'flex';
        rootEl.style.alignItems = 'center';
        rootEl.style.justifyContent = 'center';
        rootEl.style.pointerEvents = ' none';
        rootEl.style.zIndex = '40';

        // 1. Rotating Flashlight Beam (Lanterna Azul 3D que acompanha o giro do celular)
        const beamWrapper = document.createElement('div');
        beamWrapper.style.position = 'absolute';
        beamWrapper.style.inset = '0';
        beamWrapper.style.display = 'flex';
        beamWrapper.style.alignItems = 'center';
        beamWrapper.style.justifyContent = 'center';
        beamWrapper.style.pointerEvents = 'none';
        beamWrapper.style.willChange = 'transform';
        beamWrapper.style.transformOrigin = '50% 50%';
        beamWrapper.style.transform = 'rotate(0deg)';
        beamWrapper.style.zIndex = '1';

        beamWrapper.innerHTML = `
          <svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
            <defs>
              <radialGradient id="monvianFlashlightGrad" cx="75" cy="75" r="68" fx="75" fy="75" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#60A5FA" stop-opacity="0.0" />
                <stop offset="26%" stop-color="#3B82F6" stop-opacity="0.58" />
                <stop offset="62%" stop-color="#3B82F6" stop-opacity="0.26" />
                <stop offset="100%" stop-color="#2563EB" stop-opacity="0.0" />
              </radialGradient>
              <radialGradient id="monvianBeaconGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#93C5FD" stop-opacity="1" />
                <stop offset="45%" stop-color="#3B82F6" stop-opacity="0.88" />
                <stop offset="100%" stop-color="#2563EB" stop-opacity="0" />
              </radialGradient>
            </defs>
            <!-- Cone da Lanterna Azul -->
            <path
              d="M 75 75 L 34 10 A 76 76 0 0 1 116 10 Z"
              fill="url(#monvianFlashlightGrad)"
            />
            <!-- Ponto de Luz Azul (Beacon) na borda frontal do círculo -->
            <circle cx="75" cy="46" r="12" fill="url(#monvianBeaconGlow)" />
            <circle cx="75" cy="46" r="4.5" fill="#60A5FA" stroke="#FFFFFF" stroke-width="1.5" />
          </svg>
        `;
        userBeamElRef.current = beamWrapper;
        rootEl.appendChild(beamWrapper);

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
        outerRing.style.background = 'rgba(255, 255, 255, 0.16)';
        outerRing.style.border = '1.5px solid rgba(255, 255, 255, 0.28)';
        outerRing.style.boxShadow =
          '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 18px rgba(59, 130, 246, 0.32)';
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
            if (savedUser?.avatar_url && savedUser.avatar_url.trim().length > 0) return savedUser.avatar_url;
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
        rootEl.appendChild(centerStack);

        centerStack.onclick = (e) => {
          e.stopPropagation();
          centerOnUserLocation(true);
        };

        const initialLngLat = normalizeCoords(userCoords, [-45.587, -22.7355]);
        userMarkerRef.current = new maplibregl.Marker({
          element: rootEl,
          anchor: 'center',
        })
          .setLngLat(initialLngLat)
          .addTo(map);
      }

      return () => {
        if (userMarkerRef.current) {
          userMarkerRef.current.remove();
          userMarkerRef.current = null;
        }
      };
    }, []);

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

        // If device compass hasn't emitted sensor data yet, rotate flashlight with GPS movement heading
        if (!deviceHeadingManager.hasSensorData() && userBeamElRef.current) {
          const mapBearing = mapRef.current?.getBearing() || 0;
          const beamAngle = (navState.heading - mapBearing + 360) % 360;
          userBeamElRef.current.style.transform = `rotate(${beamAngle.toFixed(1)}deg)`;
        }

        // Center camera on first real GPS fix or accompany user when follow mode is active
        if (mapRef.current && navState.status === 'granted') {
          if (!hasCenteredOnFirstFixRef.current) {
            hasCenteredOnFirstFixRef.current = true;
            mapRef.current.easeTo({
              center: coords,
              zoom: Math.max(mapRef.current.getZoom(), 15.2),
              duration: 900,
            });
          } else if (isFollowingUserRef.current && !selectedSpot && navState.isMoving) {
            mapRef.current.easeTo({
              center: coords,
              duration: 300,
              easing: (t) => t,
            });
          }
        }
      });

      return () => {
        unsubscribeGps();
      };
    }, [selectedSpot]);

    // Real-Time 60fps Device Orientation (Phone Rotation -> Flashlight Rotation)
    useEffect(() => {
      deviceHeadingManager.start();

      const unsubscribeHeading = deviceHeadingManager.subscribe((_rawHeading, compensatedHeading) => {
        if (userBeamElRef.current) {
          userBeamElRef.current.style.transform = `rotate(${compensatedHeading.toFixed(1)}deg)`;
        }
      });

      return () => {
        unsubscribeHeading();
      };
    }, []);

    // Trigger zoom to user when requested from parent (e.g. clicking 'Explorar' tab)
    useEffect(() => {
      if (zoomToUserTrigger && zoomToUserTrigger > 0) {
        centerOnUserLocation(true);
      }
    }, [zoomToUserTrigger, centerOnUserLocation]);

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
          rec.pulseEl.style.background =
            'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
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
        pulseEl.style.background =
          'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.22) 55%, transparent 75%)';
        pulseEl.style.display = isSelected ? 'block' : 'none';

        // Pin Circular Badge
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
          setFollowMode(false);
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
          try {
            containerEl.animate(
              [
                { transform: 'scale(0.85)' },
                { transform: 'scale(1.38)', offset: 0.6 },
                { transform: 'scale(1.25)' },
              ],
              {
                duration: 380,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              }
            );
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
    }, [spots, syncMarkerHighlight, is3DMode, onSelectSpot, selectedSpot?.id, setFollowMode]);

    // Update marker highlight and camera zoom when selectedSpot changes
    useEffect(() => {
      syncMarkerHighlight(selectedSpot?.id);

      if (!mapRef.current || !selectedSpot?.lng || !selectedSpot?.lat) return;

      setFollowMode(false);
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
    }, [selectedSpot, syncMarkerHighlight, is3DMode, setFollowMode]);

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
      const next: MapModeType =
        currentMode === 'explorar'
          ? 'satelite'
          : currentMode === 'satelite'
          ? 'escuro'
          : 'explorar';
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
            onClick={() => centerOnUserLocation(true)}
            aria-label="Centralizar na minha localização em tempo real"
            className={`w-12 h-12 rounded-full backdrop-blur-md border shadow-[0_6px_20px_rgba(0,0,0,0.22)] flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
              isFollowingUser
                ? 'bg-white dark:bg-zinc-900/95 border-blue-500/40 dark:border-white/15 ring-2 ring-blue-500/20'
                : 'bg-white/90 dark:bg-zinc-900/90 border-zinc-200/80 dark:border-white/10'
            }`}
          >
            <CompassIcon size={24} />
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
