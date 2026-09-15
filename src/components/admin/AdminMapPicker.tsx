import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, MapPin, Navigation, ZoomIn, ZoomOut, Compass } from 'lucide-react';
import { playPinTapSound } from '../../utils/sound';

interface AdminMapPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number, addressSuggestion?: string) => void;
  address?: string;
}

export const AdminMapPicker: React.FC<AdminMapPickerProps> = ({
  lat,
  lng,
  onChange,
  address = '',
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: lat || -22.7394,
    lng: lng || -45.5913,
  });

  const MAP_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialLat = lat || -22.7394;
    const initialLng = lng || -45.5913;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [initialLng, initialLat],
      zoom: 14,
      attributionControl: false,
    });

    mapRef.current = map;

    // Create custom marker element
    const el = document.createElement('div');
    el.className = 'admin-picker-pin';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.cursor = 'grab';
    el.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:14px; height:14px; background:#0066ff; border-radius:50%; box-shadow:0 0 0 4px white, 0 4px 12px rgba(0,102,255,0.5);"></div>
        <div style="position:absolute; bottom:-4px; width:6px; height:6px; background:#0066ff; border-radius:50%;"></div>
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
        mapRef.current.flyTo({ center: [lng, lat], zoom: 15 });
      }
    }
  }, [lat, lng]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const query = `${searchQuery}, Campos do Jordão, Brasil`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const resultLat = Number(parseFloat(data[0].lat).toFixed(6));
        const resultLng = Number(parseFloat(data[0].lon).toFixed(6));
        const displayName = data[0].display_name;

        setCurrentCoords({ lat: resultLat, lng: resultLng });
        if (markerRef.current) {
          markerRef.current.setLngLat([resultLng, resultLat]);
        }
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [resultLng, resultLat], zoom: 16 });
        }
        onChange(resultLat, resultLng, displayName);
      } else {
        alert('Endereço não localizado em Campos do Jordão. Clique no mapa para posicionar manualmente.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePresetLocation = (presetLat: number, presetLng: number) => {
    setCurrentCoords({ lat: presetLat, lng: presetLng });
    if (markerRef.current) {
      markerRef.current.setLngLat([presetLng, presetLat]);
    }
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [presetLng, presetLat], zoom: 15 });
    }
    onChange(presetLat, presetLng);
  };

  return (
    <div className="space-y-3">
      {/* Search and Quick Presets */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar rua, praça ou bairro em Campos do Jordão..."
            className="w-full text-xs text-zinc-800 bg-transparent outline-none placeholder-zinc-400"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="text-xs font-black px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
          >
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => handlePresetLocation(-22.7340, -45.5910)}
            className="text-[11px] px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg whitespace-nowrap transition-colors"
          >
            Capivari
          </button>
          <button
            type="button"
            onClick={() => handlePresetLocation(-22.7420, -45.5960)}
            className="text-[11px] px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg whitespace-nowrap transition-colors"
          >
            Abernéssia
          </button>
          <button
            type="button"
            onClick={() => handlePresetLocation(-22.7661, -45.6125)}
            className="text-[11px] px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg whitespace-nowrap transition-colors"
          >
            Gavião Gonzaga
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-inner">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Controls */}
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
                mapRef.current.flyTo({ center: [-45.5913, -22.7394], zoom: 13 });
              }
            }}
            className="w-8 h-8 bg-white/95 hover:bg-white text-zinc-700 rounded-lg shadow-md flex items-center justify-center border border-zinc-200/80 transition-all cursor-pointer"
            title="Recentrar em Campos do Jordão"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Overlay Instruction Banner */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between text-xs text-zinc-600">
          <div className="flex items-center gap-1.5 font-black">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Clique no mapa ou arraste o pino</span>
          </div>
          <div className="font-mono text-[11px] text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
            {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Numerical Coords Inputs for manual verification */}
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
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 focus:outline-none focus:border-blue-500"
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
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
