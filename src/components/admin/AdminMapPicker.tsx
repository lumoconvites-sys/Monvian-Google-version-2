import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, MapPin, ZoomIn, ZoomOut, Compass, Layers } from 'lucide-react';
import { playPinTapSound } from '../../utils/sound';
import { Spot } from '../../types';

interface AdminMapPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number, addressSuggestion?: string) => void;
  address?: string;
  spots?: Spot[];
}

const SATELLITE_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri &copy; DigitalGlobe, GeoEye, Earthstar Geographics',
    },
    'esri-labels': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 20,
    },
    {
      id: 'esri-labels-layer',
      type: 'raster',
      source: 'esri-labels',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

const STREETS_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
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

export const AdminMapPicker: React.FC<AdminMapPickerProps> = ({
  lat,
  lng,
  onChange,
  spots = [],
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapMode, setMapMode] = useState<'satelite' | 'ruas'>('ruas');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: lat || -22.7192,
    lng: lng || -45.5673,
  });

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialLat = lat || -22.7192;
    const initialLng = lng || -45.5673;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STREETS_MAP_STYLE,
      center: [initialLng, initialLat],
      zoom: 14.5,
      attributionControl: false,
    });

    mapRef.current = map;

    const el = document.createElement('div');
    el.className = 'admin-picker-pin';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.cursor = 'grab';
    el.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:18px; height:18px; background:#007AFF; border-radius:50%; box-shadow:0 0 0 4px white, 0 4px 12px rgba(0,122,255,0.55);"></div>
        <div style="position:absolute; bottom:-4px; width:6px; height:6px; background:#007AFF; border-radius:50%;"></div>
      </div>
    `;

    const marker = new maplibregl.Marker({
      element: el,
      draggable: true,
    })
      .setLngLat([initialLng, initialLat])
      .addTo(map);

    markerRef.current = marker;

    marker.on('dragend', () => {
      playPinTapSound();
      const lngLat = marker.getLngLat();
      const newLat = Number(lngLat.lat.toFixed(6));
      const newLng = Number(lngLat.lng.toFixed(6));
      setCurrentCoords({ lat: newLat, lng: newLng });
      onChange(newLat, newLng);
    });

    map.on('click', (e) => {
      playPinTapSound();
      const newLat = Number(e.lngLat.lat.toFixed(6));
      const newLng = Number(e.lngLat.lng.toFixed(6));
      marker.setLngLat([newLng, newLat]);
      setCurrentCoords({ lat: newLat, lng: newLng });
      onChange(newLat, newLng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync if prop lat/lng change from outside
  useEffect(() => {
    if (lat && lng && (lat !== currentCoords.lat || lng !== currentCoords.lng)) {
      setCurrentCoords({ lat, lng });
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      }
      if (mapRef.current) {
        mapRef.current.flyTo({ center: [lng, lat], zoom: 15.5 });
      }
    }
  }, [lat, lng]);

  const setExplicitMapMode = (mode: 'satelite' | 'ruas') => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(mode === 'satelite' ? SATELLITE_MAP_STYLE : STREETS_MAP_STYLE);
    setMapMode(mode);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = searchQuery.trim();
    if (!raw) return;

    setIsSearching(true);
    try {
      // 1. Check matching spot in Campos do Jordão DB first
      const qLower = raw.toLowerCase();
      const matchedSpot = spots.find(
        (s) =>
          (s.name || '').toLowerCase().includes(qLower) ||
          (s.address || '').toLowerCase().includes(qLower)
      );
      if (matchedSpot && typeof matchedSpot.lat === 'number' && typeof matchedSpot.lng === 'number') {
        const resultLat = Number(matchedSpot.lat.toFixed(6));
        const resultLng = Number(matchedSpot.lng.toFixed(6));
        setCurrentCoords({ lat: resultLat, lng: resultLng });
        markerRef.current?.setLngLat([resultLng, resultLat]);
        mapRef.current?.flyTo({ center: [resultLng, resultLat], zoom: 16 });
        onChange(resultLat, resultLng, matchedSpot.address || `${matchedSpot.name}, Campos do Jordão`);
        setIsSearching(false);
        return;
      }

      // 2. Fallback to Nominatim OpenStreetMap geocoding
      const query = `${raw}, Campos do Jordão, Brasil`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const resultLat = Number(parseFloat(data[0].lat).toFixed(6));
        const resultLng = Number(parseFloat(data[0].lon).toFixed(6));
        const displayName = data[0].display_name;

        setCurrentCoords({ lat: resultLat, lng: resultLng });
        markerRef.current?.setLngLat([resultLng, resultLat]);
        mapRef.current?.flyTo({ center: [resultLng, resultLat], zoom: 16 });
        onChange(resultLat, resultLng, displayName);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePresetLocation = (presetLat: number, presetLng: number, presetAddress?: string) => {
    setCurrentCoords({ lat: presetLat, lng: presetLng });
    markerRef.current?.setLngLat([presetLng, presetLat]);
    mapRef.current?.flyTo({ center: [presetLng, presetLat], zoom: 15.5 });
    onChange(presetLat, presetLng, presetAddress);
  };

  return (
    <div className="space-y-3">
      {/* Search and Quick Presets */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(e);
              }
            }}
            placeholder="Buscar endereço ou estabelecimento em Campos do Jordão..."
            className="w-full text-xs text-zinc-800 bg-transparent outline-none placeholder-zinc-400"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="text-xs font-black px-2.5 py-1 bg-[#007AFF] hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => handlePresetLocation(-22.7192, -45.5673, 'Vila Capivari, Campos do Jordão - SP')}
            className="text-[11px] px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-semibold"
          >
            Capivari
          </button>
          <button
            type="button"
            onClick={() => handlePresetLocation(-22.7420, -45.5960, 'Abernéssia, Campos do Jordão - SP')}
            className="text-[11px] px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-semibold"
          >
            Abernéssia
          </button>
          <button
            type="button"
            onClick={() => handlePresetLocation(-22.7661, -45.6125, 'Gavião Gonzaga, Campos do Jordão - SP')}
            className="text-[11px] px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-semibold"
          >
            Gavião Gonzaga
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-inner">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Mode Segmented Switch (Padrão / Satélite) */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center bg-white/95 p-1 rounded-xl shadow-md border border-zinc-200/80">
          <button
            type="button"
            onClick={() => setExplicitMapMode('ruas')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
              mapMode === 'ruas'
                ? 'bg-[#007AFF] text-white shadow-xs'
                : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Padrão
          </button>
          <button
            type="button"
            onClick={() => setExplicitMapMode('satelite')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 ${
              mapMode === 'satelite'
                ? 'bg-[#007AFF] text-white shadow-xs'
                : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Satélite</span>
          </button>
        </div>

        {/* Zoom & Recenter Controls */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="w-8 h-8 bg-white/95 hover:bg-white text-zinc-700 rounded-lg shadow-md flex items-center justify-center border border-zinc-200/80 transition-all cursor-pointer"
            title="Aproximar"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="w-8 h-8 bg-white/95 hover:bg-white text-zinc-700 rounded-lg shadow-md flex items-center justify-center border border-zinc-200/80 transition-all cursor-pointer"
            title="Afastar"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.flyTo({ center: [-45.5673, -22.7192], zoom: 14 });
              }
            }}
            className="w-8 h-8 bg-white/95 hover:bg-white text-zinc-700 rounded-lg shadow-md flex items-center justify-center border border-zinc-200/80 transition-all cursor-pointer"
            title="Recentrar em Campos do Jordão"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Overlay Instruction Banner */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-white/90 px-3 py-1.5 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between text-xs text-zinc-600">
          <div className="flex items-center gap-1.5 font-black">
            <MapPin className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
            <span>Toque no mapa ou arraste o marcador</span>
          </div>
          <div className="font-mono text-[11px] text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
            {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
          </div>
        </div>
      </div>

      {/* Numerical Coords Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-black text-zinc-500 mb-1">Latitude</label>
          <input
            type="number"
            step="any"
            value={currentCoords.lat}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setCurrentCoords((prev) => ({ ...prev, lat: val }));
              onChange(val, currentCoords.lng);
            }}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 focus:outline-none focus:border-[#007AFF]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-black text-zinc-500 mb-1">Longitude</label>
          <input
            type="number"
            step="any"
            value={currentCoords.lng}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setCurrentCoords((prev) => ({ ...prev, lng: val }));
              onChange(currentCoords.lat, val);
            }}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 focus:outline-none focus:border-[#007AFF]"
          />
        </div>
      </div>
    </div>
  );
};
