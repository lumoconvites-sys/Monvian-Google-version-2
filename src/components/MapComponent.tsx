import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Spot, SpotCategory } from '../types';
import { Layers, Plus, Minus, Crosshair, MapPin, Sparkles, Compass, Utensils, Mountain, Trees, Landmark } from 'lucide-react';

interface MapComponentProps {
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot | null) => void;
  userCoords: [number, number];
}

type MapStyleType = 'dark' | 'satellite' | 'terrain';

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();

// High-fidelity standard and Mapbox-powered styles
const createStyle = (type: MapStyleType): maplibregl.StyleSpecification => {
  if (MAPBOX_TOKEN) {
    let tilePath = 'dark-v11';
    if (type === 'satellite') tilePath = 'satellite-streets-v12';
    if (type === 'terrain') tilePath = 'outdoors-v12';

    return {
      version: 8,
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
  if (type === 'satellite') {
    return {
      version: 8,
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

  if (type === 'terrain') {
    return {
      version: 8,
      sources: {
        'carto-voyager': {
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
          id: 'carto-voyager-layer',
          type: 'raster',
          source: 'carto-voyager',
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    };
  }

  // Dark (default)
  return {
    version: 8,
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
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
};

const STYLES_META: Record<MapStyleType, { name: string }> = {
  dark: { name: 'Mantiqueira Escuro' },
  satellite: { name: 'Satélite Realista' },
  terrain: { name: 'Relevo & Montanhas' },
};

const CAMPOS_CENTER: [number, number] = [-45.5800, -22.7350];

const getCategoryColor = (category: SpotCategory): string => {
  switch (category) {
    case 'gastronomy':
      return '#f59e0b'; // Amber
    case 'nature':
    case 'parks':
      return '#10b981'; // Emerald
    case 'viewpoint':
      return '#a855f7'; // Purple
    case 'culture':
      return '#06b6d4'; // Cyan
    case 'services':
    default:
      return '#ec4899'; // Pink
  }
};

export const MapComponent: React.FC<MapComponentProps> = ({
  spots,
  selectedSpot,
  onSelectSpot,
  userCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const spotMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const [currentStyle, setCurrentStyle] = useState<MapStyleType>('dark');
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const hasCenteredInitiallyRef = useRef<boolean>(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter = userCoords && !isNaN(userCoords[0]) ? userCoords : CAMPOS_CENTER;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createStyle(currentStyle),
      center: initialCenter,
      zoom: 13.5,
      pitch: 15,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      map.resize();
    });

    // Handle container resize
    const handleResize = () => {
      map.resize();
    };
    window.addEventListener('resize', handleResize);

    mapRef.current = map;

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update style when changed
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(createStyle(currentStyle));
  }, [currentStyle]);

  // Render Spots Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing spot markers
    spotMarkersRef.current.forEach((marker) => marker.remove());
    spotMarkersRef.current.clear();

    spots.forEach((spot) => {
      const isSelected = selectedSpot?.id === spot.id;
      const accentColor = getCategoryColor(spot.category);

      const el = document.createElement('div');
      el.id = `spot-marker-${spot.id}`;
      el.className = 'cursor-pointer select-none group transition-all duration-200';

      el.innerHTML = `
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#121316]/90 hover:bg-[#1a1c22] border ${
          isSelected ? 'border-[#00ff88] ring-2 ring-[#00ff88]/50 scale-110 shadow-[0_0_16px_rgba(0,255,136,0.6)]' : 'border-white/20 hover:border-white/40 shadow-lg'
        } backdrop-blur-md transition-all">
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${accentColor}; box-shadow: 0 0 6px ${accentColor};"></span>
          <span class="text-[11px] font-semibold text-white tracking-tight whitespace-nowrap">
            ${spot.tagLabel || spot.shortName || spot.name}
          </span>
          ${spot.badge ? `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-white/15 text-white/90 uppercase tracking-tighter ml-0.5">${spot.badge}</span>` : ''}
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectSpot(spot);
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

      spotMarkersRef.current.set(spot.id, marker);
    });
  }, [spots, selectedSpot, onSelectSpot]);

  // Render user "Você" Marker on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const userEl = document.createElement('div');
    userEl.id = 'user-voce-marker';
    userEl.className = 'flex flex-col items-center cursor-pointer select-none z-40 transition-transform duration-200 hover:scale-110';

    const userCircle = document.createElement('div');
    userCircle.className = 'relative w-12 h-12 rounded-full overflow-hidden border-2 border-white ring-3 ring-[#00ff88] ring-offset-2 ring-offset-black/60 shadow-[0_0_22px_rgba(0,255,136,0.7)] bg-zinc-900';

    const userImg = document.createElement('img');
    userImg.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    userImg.alt = 'Você';
    userImg.className = 'w-full h-full object-cover';
    userCircle.appendChild(userImg);

    // Glowing green pill with "você" text
    const userPill = document.createElement('div');
    userPill.className = 'mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-black bg-[#00ff88] shadow-[0_2px_10px_rgba(0,255,136,0.5)] border border-[#00ff88] tracking-tight uppercase';
    userPill.textContent = 'você';

    userEl.appendChild(userCircle);
    userEl.appendChild(userPill);

    userEl.addEventListener('click', () => {
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
  }, [userCoords]);

  // When userCoords updates, smooth flyTo coordinates on initial fix
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasCenteredInitiallyRef.current && userCoords && !isNaN(userCoords[0])) {
      hasCenteredInitiallyRef.current = true;
      map.flyTo({
        center: userCoords,
        zoom: 14.8,
        speed: 1.4,
        curve: 1.2,
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
    <div className="relative w-full h-full overflow-hidden bg-[#111315]">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" tabIndex={0} />

      {/* Floating Map Controls on Right Side */}
      <aside aria-label="Controles do mapa" className="absolute right-4 top-1/2 -translate-y-1/2 z-25 flex flex-col gap-2.5">
        {/* Zoom In (+) */}
        <button
          id="btn-map-zoom-in"
          onClick={handleZoomIn}
          className="w-12 h-12 rounded-full bg-[#1b1c20]/90 hover:bg-[#282a30] active:scale-95 text-white/95 shadow-2xl border border-white/10 backdrop-blur-md flex items-center justify-center transition-all focus:outline-none cursor-pointer"
          title="Aproximar mapa"
        >
          <Plus className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Zoom Out (-) */}
        <button
          id="btn-map-zoom-out"
          onClick={handleZoomOut}
          className="w-12 h-12 rounded-full bg-[#1b1c20]/90 hover:bg-[#282a30] active:scale-95 text-white/95 shadow-2xl border border-white/10 backdrop-blur-md flex items-center justify-center transition-all focus:outline-none cursor-pointer"
          title="Afastar mapa"
        >
          <Minus className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Center on "Você" / My Location */}
        <button
          id="btn-map-locate-me"
          onClick={handleCenterUser}
          className="w-12 h-12 rounded-full bg-[#1b1c20]/90 hover:bg-[#282a30] active:scale-95 text-[#00ff88] hover:text-[#33ff9f] shadow-2xl border border-white/10 backdrop-blur-md flex items-center justify-center transition-all focus:outline-none cursor-pointer"
          title="Centralizar em Você"
        >
          <Crosshair className="w-6 h-6 stroke-[2]" />
        </button>

        {/* Layers / Styles Switcher */}
        <div className="relative">
          <button
            id="btn-map-layer-switch"
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            className="w-12 h-12 rounded-full bg-[#1b1c20]/90 hover:bg-[#282a30] active:scale-95 text-white/95 shadow-2xl border border-white/10 backdrop-blur-md flex items-center justify-center transition-all focus:outline-none cursor-pointer"
            title="Estilos de mapa"
          >
            <Layers className="w-5 h-5 stroke-[2]" />
          </button>

          {showStyleMenu && (
            <div
              id="map-style-dropdown"
              className="absolute right-14 bottom-0 w-52 py-2 bg-[#1b1c20]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl z-50 text-xs text-white animate-in fade-in slide-in-from-right-2"
            >
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-white/40 tracking-wider">
                Tema do Mapa
              </div>
              {(Object.keys(STYLES_META) as MapStyleType[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setCurrentStyle(key);
                    setShowStyleMenu(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                    currentStyle === key ? 'text-[#00ff88] font-bold bg-white/5' : 'text-white/80'
                  }`}
                >
                  <span>{STYLES_META[key].name}</span>
                  {currentStyle === key && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
