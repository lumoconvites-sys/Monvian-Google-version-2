import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Spot, SpotCategory } from '../types';
import { Layers, Plus, Minus } from 'lucide-react';
import { CompassIcon } from './CompassIcon';
import { motion, AnimatePresence } from 'motion/react';
import { playPinTapSound } from '../utils/sound';

interface MapComponentProps {
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot | null) => void;
  userCoords: [number, number];
  theme: 'dark' | 'light';
  userAvatar?: string;
  userName?: string;
  highContrast?: boolean;
  onMapLoad?: () => void;
  onMapClick?: () => void;
}

export type MapModeType = 'explorar' | 'carro' | 'transporte' | 'satelite';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();

// High-fidelity standard and Mapbox-powered styles for all 4 modes
const createStyle = (type: MapModeType, theme: 'dark' | 'light' = 'dark'): maplibregl.StyleSpecification | string => {
  if (MAPBOX_TOKEN) {
    let tilePath = theme === 'light' ? 'light-v11' : 'dark-v11';
    if (type === 'satelite') tilePath = 'satellite-streets-v12';
    if (type === 'carro') tilePath = theme === 'light' ? 'navigation-day-v1' : 'navigation-night-v1';
    if (type === 'transporte') tilePath = 'streets-v12';
    if (type === 'explorar') tilePath = theme === 'light' ? 'light-v11' : 'dark-v11';

    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'mapbox-tiles': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/${tilePath}/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
          ],
          tileSize: 256,
          attribution: '&copy; Mapbox &copy; OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'mapbox-layer',
          type: 'raster',
          source: 'mapbox-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }

  // Fallbacks if no token
  if (type === 'satelite') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        },
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };
  }

  if (type === 'carro') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'carto-navigation': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        },
      },
      layers: [
        {
          id: 'carto-navigation-layer',
          type: 'raster',
          source: 'carto-navigation',
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    };
  }

  if (type === 'transporte') {
    return {
      version: 8,
      projection: { type: 'globe' } as any,
      sources: {
        'osm-transport': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm-transport-layer',
          type: 'raster',
          source: 'osm-transport',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };
  }

  // Explorar / Default theme based (Vector dark style matching user screenshot)
  if (theme === 'dark') {
    return 'https://tiles.openfreemap.org/styles/dark';
  }

  return 'https://tiles.openfreemap.org/styles/bright';
};

// Beautiful vector thumbnail graphics matching reference screenshot exactly
const ExplorarThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    <rect width="100" height="100" fill="#2a303d" />
    {/* Dark road */}
    <path d="M 32 -10 L 110 110" stroke="#1f242e" strokeWidth="26" strokeLinecap="square" />
    <path d="M 32 -10 L 110 110" stroke="#333b4b" strokeWidth="22" strokeLinecap="square" />
    {/* Secondary road */}
    <path d="M -10 36 L 70 88" stroke="#333b4b" strokeWidth="14" strokeLinecap="square" />
    {/* Crosswalk stripes */}
    <line x1="42" y1="20" x2="55" y2="28" stroke="#5d687c" strokeWidth="2" strokeDasharray="2 2" />
    {/* Buildings */}
    <rect x="52" y="4" width="16" height="12" rx="2.5" fill="#3b4455" />
    <rect x="74" y="16" width="18" height="14" rx="2.5" fill="#3b4455" />
    <rect x="8" y="58" width="18" height="14" rx="2.5" fill="#3b4455" />
    <rect x="18" y="78" width="20" height="16" rx="2.5" fill="#3b4455" />
    {/* Green area */}
    <path d="M 58 48 L 78 72 L 68 84 Z" fill="#1e3d30" opacity="0.9" />
    {/* Colored Exploration Dots */}
    <circle cx="58" cy="10" r="3" fill="#f59e0b" />
    <circle cx="76" cy="22" r="2.8" fill="#ef4444" />
    <circle cx="14" cy="48" r="3.2" fill="#f97316" />
    <circle cx="48" cy="74" r="3" fill="#f59e0b" />
    <circle cx="62" cy="88" r="2.8" fill="#f97316" />
  </svg>
);

const DeCarroThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    <rect width="100" height="100" fill="#2a303d" />
    {/* Dark road */}
    <path d="M 32 -10 L 110 110" stroke="#1f242e" strokeWidth="26" strokeLinecap="square" />
    <path d="M 32 -10 L 110 110" stroke="#333b4b" strokeWidth="22" strokeLinecap="square" />
    {/* Secondary road */}
    <path d="M -10 36 L 70 88" stroke="#333b4b" strokeWidth="14" strokeLinecap="square" />
    {/* Buildings */}
    <rect x="52" y="4" width="16" height="12" rx="2.5" fill="#3b4455" />
    <rect x="74" y="16" width="18" height="14" rx="2.5" fill="#3b4455" />
    <rect x="8" y="58" width="18" height="14" rx="2.5" fill="#3b4455" />
    <rect x="18" y="78" width="20" height="16" rx="2.5" fill="#3b4455" />
    {/* Green park wedge */}
    <path d="M 58 48 L 78 72 L 68 84 Z" fill="#1e3d30" opacity="0.9" />
    {/* Red/Yellow Traffic Congestion Line */}
    <path d="M 32 -10 L 48 16" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
    <path d="M 48 16 L 110 110" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
    {/* Warning Triangle */}
    <g transform="translate(48, 38) scale(0.9)">
      <polygon points="12,0 24,20 0,20" fill="#facc15" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="12" y1="6" x2="12" y2="13" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill="#000000" />
    </g>
  </svg>
);

const TransporteThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    <rect width="100" height="100" fill="#2a303d" />
    {/* Background street structure */}
    <path d="M 32 -10 L 110 110" stroke="#333b4b" strokeWidth="20" strokeLinecap="square" />
    <path d="M -10 36 L 70 88" stroke="#333b4b" strokeWidth="12" strokeLinecap="square" />
    {/* Buildings */}
    <rect x="52" y="4" width="16" height="12" rx="2.5" fill="#3b4455" />
    <rect x="74" y="16" width="18" height="14" rx="2.5" fill="#3b4455" />
    <rect x="8" y="58" width="18" height="14" rx="2.5" fill="#3b4455" />
    <rect x="18" y="78" width="20" height="16" rx="2.5" fill="#3b4455" />
    {/* Multicolored transit curves crossing */}
    {/* Yellow Line */}
    <path d="M -10 24 Q 45 32 110 -5" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
    {/* Red Line */}
    <path d="M -10 30 Q 50 40 110 8" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
    {/* Blue Line */}
    <path d="M -10 36 Q 55 48 110 20" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
    {/* Orange Line plunging right */}
    <path d="M 64 28 Q 72 58 108 100" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
    {/* Blue Line sweeping down */}
    <path d="M -10 42 Q 40 55 88 110" fill="none" stroke="#00C896" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

const SateliteThumbnail = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
    {/* Realistic aerial base */}
    <rect width="100" height="100" fill="#7a8c6a" />
    {/* Forest and grass terrain */}
    <path d="M 0 0 L 100 0 L 100 45 Q 60 70 0 40 Z" fill="#657c52" />
    <path d="M 60 80 Q 90 60 100 70 L 100 100 L 40 100 Z" fill="#586e48" />
    <path d="M 80 15 Q 95 10 100 40 L 75 35 Z" fill="#3f5431" />
    {/* Asphalt road */}
    <path d="M 15 -10 L 95 110" stroke="#9da6aa" strokeWidth="22" strokeLinecap="square" />
    <path d="M -10 40 L 45 10" stroke="#9da6aa" strokeWidth="12" strokeLinecap="square" />
    {/* Road crosswalk stripes */}
    <line x1="28" y1="18" x2="38" y2="24" stroke="#ffffff" strokeWidth="1.8" strokeDasharray="1.5 1.5" />
    {/* Railway tracks on the right */}
    <path d="M 78 -10 L 108 80" stroke="#79756b" strokeWidth="6" strokeLinecap="square" />
    <path d="M 78 -10 L 108 80" stroke="#44413c" strokeWidth="1.5" strokeDasharray="2 2" />
    {/* Roofed Houses/Buildings */}
    <rect x="58" y="14" width="16" height="12" rx="1.5" fill="#d9cdb8" stroke="#8a7c66" strokeWidth="0.8" />
    <rect x="52" y="24" width="18" height="14" rx="1.5" fill="#c4b59d" stroke="#786c58" strokeWidth="0.8" />
    <rect x="18" y="70" width="14" height="12" rx="1.5" fill="#e8ded0" stroke="#9a8e7a" strokeWidth="0.8" />
    {/* Tree clusters */}
    <circle cx="86" cy="22" r="6" fill="#354929" />
    <circle cx="92" cy="28" r="5" fill="#2d3f22" />
    <circle cx="88" cy="34" r="5.5" fill="#354929" />
  </svg>
);

const MODES_CONFIG: {
  id: MapModeType;
  name: string;
  thumbnail: React.ComponentType;
}[] = [
  { id: 'explorar', name: 'Explorar', thumbnail: ExplorarThumbnail },
  { id: 'carro', name: 'De Carro', thumbnail: DeCarroThumbnail },
  { id: 'transporte', name: 'Transporte Público', thumbnail: TransporteThumbnail },
  { id: 'satelite', name: 'Satélite', thumbnail: SateliteThumbnail },
];

interface SpotMarkerRecord {
  marker: maplibregl.Marker;
  circleEl: HTMLDivElement;
}

export const MapComponentInner: React.FC<MapComponentProps> = ({
  spots,
  selectedSpot,
  onSelectSpot,
  userCoords,
  theme,
  userAvatar,
  userName,
  highContrast = false,
  onMapLoad,
  onMapClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userAvatarRef = useRef<string>('');
  const spotMarkersRef = useRef<Map<string, SpotMarkerRecord>>(new Map());
  const onSelectSpotRef = useRef(onSelectSpot);

  useEffect(() => {
    onSelectSpotRef.current = onSelectSpot;
  }, [onSelectSpot]);

  const onMapLoadRef = useRef(onMapLoad);
  useEffect(() => {
    onMapLoadRef.current = onMapLoad;
  }, [onMapLoad]);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const [currentStyle, setCurrentStyle] = useState<MapModeType>('explorar');
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [compassRotation, setCompassRotation] = useState<number>(0);
  const hasCenteredInitiallyRef = useRef<boolean>(false);
  const lastCameraState = useRef<any>(null);

  // Restore camera when spot is deselected
  useEffect(() => {
    if (!selectedSpot && lastCameraState.current) {
      const map = mapRef.current;
      if (map) {
        map.flyTo({
          center: lastCameraState.current.center,
          zoom: lastCameraState.current.zoom,
          pitch: lastCameraState.current.pitch,
          bearing: lastCameraState.current.bearing,
          speed: 1.2,
          essential: true,
        });
      }
      lastCameraState.current = null; // Clear it
    }
  }, [selectedSpot]);

  // Sync highContrast class on container if needed
  useEffect(() => {
    if (mapContainerRef.current) {
      mapContainerRef.current.classList.toggle('high-contrast-map', highContrast);
    }
  }, [highContrast]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter = userCoords && !isNaN(userCoords[0]) ? userCoords : [-45.5870, -22.7420];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createStyle(currentStyle, theme),
      center: initialCenter,
      zoom: 14.8,
      pitch: 58,
      bearing: 0,
      projection: { type: 'globe' },
      attributionControl: false,
    } as any);

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      map.resize();
      if ('setProjection' in map && typeof (map as any).setProjection === 'function') {
        try {
          (map as any).setProjection({ type: 'globe' });
        } catch (e) {
          // Fallback if not supported on runtime version
        }
      }
      map.setPadding({ top: 90, right: 30, bottom: 200, left: 30 });
      if (onMapLoadRef.current) {
        onMapLoadRef.current();
      }
    });

    // Dismiss all cards, previews and opened overlays on map touch/click/drag
    const dismissAllOverlays = () => {
      setShowStyleMenu(false);
      onSelectSpotRef.current(null);
      if (onMapClickRef.current) {
        onMapClickRef.current();
      }
    };

    map.on('click', () => {
      dismissAllOverlays();
    });

    // Fade in/out spot markers during map drag/move
    let isInteracting = false;
    let interactionTimeout: NodeJS.Timeout | null = null;

    const setInteracting = (active: boolean) => {
      if (interactionTimeout) {
        clearTimeout(interactionTimeout);
        interactionTimeout = null;
      }

      if (active) {
        isInteracting = true;
        mapContainerRef.current?.classList.add('map-panning-active');
      } else {
        interactionTimeout = setTimeout(() => {
          if (!map.isMoving()) {
            isInteracting = false;
            mapContainerRef.current?.classList.remove('map-panning-active');
          }
        }, 120);
      }
    };

    map.on('movestart', () => setInteracting(true));
    map.on('moveend', () => setInteracting(false));
    map.on('dragstart', () => {
      setInteracting(true);
      dismissAllOverlays();
    });
    map.on('dragend', () => setInteracting(false));
    map.on('zoomstart', () => setInteracting(true));
    map.on('zoomend', () => setInteracting(false));

    const canvas = map.getCanvas();
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      setInteracting(true);
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      setInteracting(false);
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const distX = Math.abs(touch.clientX - touchStartX);
        const distY = Math.abs(touch.clientY - touchStartY);
        const elapsed = Date.now() - touchStartTime;
        // Clean tap gesture on the map canvas
        if (elapsed < 450 && distX < 15 && distY < 15) {
          dismissAllOverlays();
        }
      }
    };

    const handleMouseDown = () => setInteracting(true);
    const handleMouseUp = () => setInteracting(false);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    // Handle container resize
    const handleResize = () => {
      map.resize();
    };
    window.addEventListener('resize', handleResize);

    // Also observe the map container element directly to handle dynamic safe area or viewport shifts
    let resizeObserver: ResizeObserver | null = null;
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    mapRef.current = map;

    return () => {
      if (interactionTimeout) clearTimeout(interactionTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar estilo quando o modo ou tema mudar (Suave, mantém localização, zoom e centro intactos)
  const handleSelectMode = (mode: MapModeType) => {
    setCurrentStyle(mode);
    const map = mapRef.current;
    if (map) {
      map.setStyle(createStyle(mode, theme));
    }
    setShowStyleMenu(false);
  };

  // Observar mudança de tema para atualizar o mapa automaticamente
  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      map.setStyle(createStyle(currentStyle, theme));
    }
  }, [theme]);

  // Helper to update selection visual state without recreating DOM or reloading images
  const updateMarkerSelection = (record: SpotMarkerRecord, isSelected: boolean) => {
    if (isSelected) {
      record.circleEl.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-[#00C896] ring-2 ring-[#00C896]/70 bg-zinc-900 shrink-0';
    } else {
      record.circleEl.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white hover:border-[#00C896] bg-zinc-900 shrink-0';
    }
  };

  // Render Spots Markers with smart reconciliation (never destroy or recreate existing DOM/images)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentSpotIds = new Set(spots.map((s) => s.id));

    // Remove only markers that are no longer present in the spots list
    spotMarkersRef.current.forEach((record, spotId) => {
      if (!currentSpotIds.has(spotId)) {
        record.marker.remove();
        spotMarkersRef.current.delete(spotId);
      }
    });

    // Add only new markers (keep existing ones completely untouched)
    spots.forEach((spot) => {
      const existing = spotMarkersRef.current.get(spot.id);
      if (existing) {
        // Spot already exists! Keep the DOM and <img> completely untouched.
        // Only update position if coordinates changed
        const currentLngLat = existing.marker.getLngLat();
        if (Math.abs(currentLngLat.lng - spot.lng) > 0.00001 || Math.abs(currentLngLat.lat - spot.lat) > 0.00001) {
          existing.marker.setLngLat([spot.lng, spot.lat]);
        }
        return;
      }

      const el = document.createElement('div');
      el.id = `spot-marker-${spot.id}`;
      el.className = 'spot-marker-container flex flex-col items-center cursor-pointer select-none z-10';

      const circleDiv = document.createElement('div');
      circleDiv.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white hover:border-[#00C896] bg-zinc-900 shrink-0';

      const img = document.createElement('img');
      img.src = spot.image;
      img.alt = spot.name;
      img.className = 'w-full h-full object-cover pointer-events-none';
      img.loading = 'eager';
      img.onerror = () => {
        img.src = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=150&q=80';
      };
      circleDiv.appendChild(img);

      el.appendChild(circleDiv);

      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });

      el.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        playPinTapSound();
        circleDiv.classList.remove('pin-tap-anim');
        void circleDiv.offsetWidth;
        circleDiv.classList.add('pin-tap-anim');

        if (!lastCameraState.current) {
          lastCameraState.current = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          };
        }
        onSelectSpotRef.current(spot);
        map.flyTo({
          center: [spot.lng, spot.lat],
          zoom: 15.2,
          speed: 1.2,
        });
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map);

      const record: SpotMarkerRecord = {
        marker,
        circleEl: circleDiv,
      };

      spotMarkersRef.current.set(spot.id, record);
    });
  }, [spots]);

  // Synchronize selection styling without re-creating any DOM or images
  useEffect(() => {
    spotMarkersRef.current.forEach((record, spotId) => {
      updateMarkerSelection(record, spotId === selectedSpot?.id);
    });
  }, [selectedSpot?.id]);

  // Render user "Você" Marker on Map (Persistent, only moves coordinates, never reloads image)
  const defaultAvatar = userAvatar || '/fotoperfil.png';

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userCoords || isNaN(userCoords[0])) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(userCoords);
      if (userAvatarRef.current !== defaultAvatar) {
        userAvatarRef.current = defaultAvatar;
        const existingImg = document.getElementById('user-voce-marker-img') as HTMLImageElement;
        if (existingImg) {
          existingImg.src = defaultAvatar;
        }
      }
      return;
    }

    userAvatarRef.current = defaultAvatar;
    const userEl = document.createElement('div');
    userEl.id = 'user-voce-marker';
    userEl.className = 'flex flex-col items-center cursor-pointer select-none z-20';

    const userCircle = document.createElement('div');
    userCircle.className = 'relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-white ring-2 ring-[#00C896] bg-zinc-900 shadow-md';

    const userImg = document.createElement('img');
    userImg.id = 'user-voce-marker-img';
    userImg.src = defaultAvatar;
    userImg.alt = userName || 'Você';
    userImg.className = 'w-full h-full object-cover pointer-events-none';
    userCircle.appendChild(userImg);

    userEl.appendChild(userCircle);

    userEl.addEventListener('click', () => {
      playPinTapSound();
      userCircle.classList.remove('pin-tap-anim');
      void userCircle.offsetWidth;
      userCircle.classList.add('pin-tap-anim');
      map.flyTo({
        center: userCoords,
        zoom: 15.5,
        speed: 1.2,
      });
    });

    const uMarker = new maplibregl.Marker({
      element: userEl,
      anchor: 'center',
    })
      .setLngLat(userCoords)
      .addTo(map);

    userMarkerRef.current = uMarker;
  }, [userCoords, defaultAvatar, userName]);

  // When userCoords updates, smooth flyTo coordinates on initial fix
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasCenteredInitiallyRef.current && userCoords && !isNaN(userCoords[0])) {
      hasCenteredInitiallyRef.current = true;
      map.flyTo({
        center: userCoords,
        zoom: 14.8,
        pitch: 58,
        bearing: 0,
        speed: 1.2,
        essential: true,
      });
    }
  }, [userCoords]);

  // Controls Handlers
  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 });
  };

  const handleCenterUser = () => {
    setCompassRotation((prev) => prev + 360);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: userCoords,
        zoom: 15.2,
        speed: 1.2,
        essential: true,
      });
    }
  };

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden bg-zinc-50 dark:bg-[#111315]"
    >
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" tabIndex={0} />

      {/* Floating Map Controls on Right Side (Always floats above map and spot icons, identical to top filter bar) */}
      <aside
        aria-label="Controles do mapa"
        className="absolute right-4 top-1/2 -translate-y-[calc(50%+16px)] z-30 flex flex-col gap-2.5 pointer-events-auto select-none"
        style={{
          right: 'max(16px, env(safe-area-inset-right, 0px))',
          zIndex: 35,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Zoom In (+) */}
        <button
          id="btn-map-zoom-in"
          onClick={handleZoomIn}
          className="w-12 h-12 rounded-full bg-white/95 dark:bg-[#1b1c20]/90 hover:bg-zinc-100 dark:hover:bg-[#282a30] active:scale-95 text-zinc-900 dark:text-white/95 shadow-2xl border border-zinc-200 dark:border-white/10 backdrop-blur-md flex items-center justify-center transition-all focus:outline-none cursor-pointer"
          title="Aproximar mapa"
        >
          <Plus className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Zoom Out (-) */}
        <button
          id="btn-map-zoom-out"
          onClick={handleZoomOut}
          className="w-12 h-12 rounded-full bg-white/95 dark:bg-[#1b1c20]/90 hover:bg-zinc-100 dark:hover:bg-[#282a30] active:scale-95 text-zinc-900 dark:text-white/95 shadow-2xl border border-zinc-200 dark:border-white/10 backdrop-blur-md flex items-center justify-center transition-all focus:outline-none cursor-pointer"
          title="Afastar mapa"
        >
          <Minus className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Center on "Você" / My Location (Compass Icon) */}
        <button
          id="btn-map-locate-me"
          onClick={handleCenterUser}
          className="w-12 h-12 sm:w-13 sm:h-13 rounded-[18px] sm:rounded-[20px] bg-white/95 dark:bg-[#16171a]/95 hover:bg-zinc-100 dark:hover:bg-[#1f2128] active:scale-95 shadow-xl border border-zinc-200/80 dark:border-white/15 backdrop-blur-xl flex items-center justify-center transition-all duration-300 focus:outline-none cursor-pointer group"
          title="Centralizar Bússola"
        >
          <motion.div
            animate={{ rotate: compassRotation }}
            transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center pointer-events-none"
          >
            <CompassIcon size={32} className="w-full h-full" />
          </motion.div>
        </button>

        {/* Layers / Styles Switcher Button */}
        <button
          id="btn-map-layer-switch"
          onClick={() => setShowStyleMenu(true)}
          className="w-12 h-12 rounded-full bg-white/95 dark:bg-[#1b1c20]/90 hover:bg-zinc-100 dark:hover:bg-[#282a30] active:scale-95 text-zinc-900 dark:text-white/95 shadow-2xl border border-zinc-200 dark:border-white/10 backdrop-blur-md flex items-center justify-center transition-all focus:outline-none cursor-pointer"
          title="Modos do Mapa"
        >
          <Layers className="w-5 h-5 stroke-[2]" />
        </button>
      </aside>

      {/* NEW Apple Maps Style "Modos do Mapa" Modal (Matches Reference Image 2) */}
      <AnimatePresence>
        {showStyleMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
            {/* Soft Backdrop to dismiss */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowStyleMenu(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Modal Card */}
              <motion.div
              id="map-modes-modal"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className="relative w-full max-w-[440px] bg-white/95 dark:bg-[#141922]/95 backdrop-blur-2xl border border-zinc-200 dark:border-white/15 rounded-[28px] sm:rounded-[32px] p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.2)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.8)] text-zinc-900 dark:text-white select-none overflow-hidden z-10"
              style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}
            >
              {/* Header: Title Centered */}
              <div className="relative flex items-center justify-center mb-5 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-center">
                  Modos do Mapa
                </h2>
              </div>

              {/* 4 Options Grid */}
              <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
                {MODES_CONFIG.map((mode) => {
                  const isSelected = currentStyle === mode.id;
                  const ThumbnailComponent = mode.thumbnail;

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => handleSelectMode(mode.id)}
                      className="flex flex-col items-center group cursor-pointer focus:outline-none"
                    >
                      {/* Thumbnail Container */}
                      <div
                        className={`relative w-full aspect-square rounded-[18px] sm:rounded-[22px] overflow-hidden transition-all duration-150 p-0.5 ${
                          isSelected
                            ? 'ring-[3px] ring-[#0084ff] shadow-[0_0_18px_rgba(0,132,255,0.7)] scale-[1.03] border-transparent'
                            : 'border border-zinc-200 dark:border-white/10 group-hover:border-zinc-300 dark:group-hover:border-white/30 opacity-80 group-hover:opacity-100 group-hover:scale-[1.01]'
                        }`}
                      >
                        <div className="w-full h-full rounded-[15px] sm:rounded-[19px] overflow-hidden bg-zinc-200 dark:bg-zinc-900">
                          <ThumbnailComponent />
                        </div>
                      </div>

                      {/* Mode Label */}
                      <span
                        className={`text-[11px] sm:text-[13px] text-center mt-2.5 leading-tight font-black transition-colors ${
                          isSelected ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white'
                        }`}
                      >
                        {mode.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Attribution / Footer Text */}
              <div className="mt-6 text-center">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-black tracking-tight">
                  © OpenStreetMap e outros provedores de dados
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const MapComponent = React.memo(MapComponentInner);

