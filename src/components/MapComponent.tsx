import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Spot } from '../types';

interface MapComponentProps {
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  onMapClick?: () => void;
  userCoords?: { lat: number; lng: number } | null;
  theme: 'dark' | 'light';
  visualIcons?: any[];
  userAvatar?: string;
  userName?: string;
  highContrast?: boolean;
  onMapLoad?: () => void;
  onInteractionChange?: (interacting: boolean) => void;
  zoomToUserTrigger?: number;
  onStyleChange?: (style: string) => void;
  is3DMode?: boolean;
  onOrbitChange?: (orbiting: boolean) => void;
  isDetailOpen?: boolean;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  spots,
  selectedSpot,
  onSelectSpot,
  onMapClick,
  theme,
  is3DMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Campos do Jordão Default Coordinates
  const CAMPOS_CENTER: [number, number] = [-45.5908, -22.7394];

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const isDark = theme === 'dark';
    const mapStyle = isDark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: CAMPOS_CENTER,
      zoom: 13,
      pitch: is3DMode ? 45 : 0,
      bearing: is3DMode ? -15 : 0,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('click', () => {
      if (onMapClick) onMapClick();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update pitch when 3D mode changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      pitch: is3DMode ? 50 : 0,
      bearing: is3DMode ? -20 : 0,
      duration: 1000,
    });
  }, [is3DMode]);

  // Update markers when spots or selectedSpot changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    spots.forEach((spot) => {
      if (!spot.lng || !spot.lat) return;

      const el = document.createElement('div');
      const isSelected = selectedSpot?.id === spot.id;

      el.className = `cursor-pointer transition-all duration-300 transform ${
        isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-10'
      }`;

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full border-2 ${
            isSelected
              ? 'bg-blue-500 border-white shadow-[0_0_16px_rgba(59,130,246,0.8)]'
              : 'bg-zinc-900 border-white/80 shadow-md'
          } flex items-center justify-center text-white text-xs font-black overflow-hidden">
            ${
              spot.image
                ? `<img src="${spot.image}" class="w-full h-full object-cover" />`
                : '<span>📍</span>'
            }
          </div>
          <div class="absolute -bottom-1 w-2 h-2 rotate-45 ${
            isSelected ? 'bg-blue-500' : 'bg-zinc-900'
          }"></div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectSpot(spot);
        mapRef.current?.flyTo({
          center: [spot.lng, spot.lat],
          zoom: 15,
          duration: 900,
        });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([spot.lng, spot.lat])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [spots, selectedSpot]);

  // Fly to selected spot
  useEffect(() => {
    if (!mapRef.current || !selectedSpot?.lng || !selectedSpot?.lat) return;
    mapRef.current.flyTo({
      center: [selectedSpot.lng, selectedSpot.lat],
      zoom: 15.5,
      pitch: is3DMode ? 50 : 0,
      duration: 800,
    });
  }, [selectedSpot]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full absolute inset-0 select-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
export default MapComponent;
