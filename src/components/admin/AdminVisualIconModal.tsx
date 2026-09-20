import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Check, MapPin, ZoomIn, ZoomOut, Palette, RotateCcw } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_VISUAL_ICON_CATEGORIES, MapVisualIconMeta, generateMarkerHtml } from '../../utils/mapVisualIcons';
import { playPinTapSound } from '../../utils/sound';

interface AdminVisualIconModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedIcon: any) => void;
  iconToEdit?: any | null;
}

const PRESET_COLORS = [
  { label: 'Azul Apple', hex: '#007AFF' },
  { label: 'Índigo', hex: '#5856D6' },
  { label: 'Roxo', hex: '#AF52DE' },
  { label: 'Rosa', hex: '#FF2D55' },
  { label: 'Vermelho', hex: '#FF3B30' },
  { label: 'Laranja', hex: '#FF9500' },
  { label: 'Âmbar', hex: '#F59E0B' },
  { label: 'Verde', hex: '#34C759' },
  { label: 'Menta', hex: '#00C7BE' },
  { label: 'Ciano', hex: '#32ADE6' },
  { label: 'Grafite', hex: '#64748B' },
  { label: 'Preto / Noite', hex: '#1E293B' },
];

export const AdminVisualIconModal: React.FC<AdminVisualIconModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  iconToEdit
}) => {
  const [category, setCategory] = useState<string>('gas_station');
  const [customColor, setCustomColor] = useState<string>('');
  const [lat, setLat] = useState<number>(-22.7394);
  const [lng, setLng] = useState<number>(-45.5913);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  const currentMeta: MapVisualIconMeta =
    MAP_VISUAL_ICON_CATEGORIES[category] || MAP_VISUAL_ICON_CATEGORIES.gas_station;
  const effectiveColor = customColor || currentMeta.bgColor;

  // Initialize or reset form state
  useEffect(() => {
    if (isOpen) {
      if (iconToEdit) {
        setCategory(iconToEdit.category || 'gas_station');
        setCustomColor(iconToEdit.color || '');
        setLat(iconToEdit.latitude || -22.7394);
        setLng(iconToEdit.longitude || -45.5913);
        setIsActive(iconToEdit.is_active === 1);
      } else {
        setCategory('gas_station');
        setCustomColor('');
        setLat(-22.7394);
        setLng(-45.5913);
        setIsActive(true);
      }
      setSearchQuery('');
      setSearchFeedback(null);
    }
  }, [isOpen, iconToEdit]);

  // MapLibre base map setup
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

  // Helper to build DOM element for draggable marker
  const createMarkerElement = (catKey: string, color?: string) => {
    const el = document.createElement('div');
    el.className = 'admin-visual-icon-pin';
    el.style.width = '34px';
    el.style.height = '34px';
    el.style.cursor = 'grab';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.innerHTML = generateMarkerHtml(catKey, 34, color);
    return el;
  };

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !mapContainer.current) return;

    let mapInstance: maplibregl.Map | null = null;

    const timer = setTimeout(() => {
      if (!mapContainer.current) return;

      const initialLat = iconToEdit ? iconToEdit.latitude : -22.7394;
      const initialLng = iconToEdit ? iconToEdit.longitude : -45.5913;
      const initialColor = iconToEdit?.color || undefined;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: [initialLng, initialLat],
        zoom: 14.5,
        attributionControl: false,
      });

      mapRef.current = map;
      mapInstance = map;

      const markerEl = createMarkerElement(iconToEdit?.category || 'gas_station', initialColor);
      const marker = new maplibregl.Marker({
        element: markerEl,
        draggable: true,
      })
        .setLngLat([initialLng, initialLat])
        .addTo(map);

      markerRef.current = marker;

      marker.on('dragend', () => {
        playPinTapSound();
        const lngLat = marker.getLngLat();
        setLat(Number(lngLat.lat.toFixed(6)));
        setLng(Number(lngLat.lng.toFixed(6)));
      });

      // Click anywhere on map to reposition marker
      map.on('click', (e) => {
        const { lng: clickLng, lat: clickLat } = e.lngLat;
        const newLat = Number(clickLat.toFixed(6));
        const newLng = Number(clickLng.toFixed(6));
        setLat(newLat);
        setLng(newLng);
        marker.setLngLat([newLng, newLat]);
        playPinTapSound();
      });

      map.on('load', () => {
        map.resize();
      });
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [isOpen]);

  // Update marker element appearance when category or color changes
  useEffect(() => {
    if (markerRef.current) {
      const el = markerRef.current.getElement();
      if (el) {
        el.innerHTML = generateMarkerHtml(category, 34, effectiveColor);
      }
    }
  }, [category, effectiveColor]);

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchFeedback(null);
    try {
      const q = encodeURIComponent(`${searchQuery.trim()}, Campos do Jordão, SP, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
      const data = await res.json();

      if (data && data.length > 0) {
        const foundLat = Number(parseFloat(data[0].lat).toFixed(6));
        const foundLng = Number(parseFloat(data[0].lon).toFixed(6));

        setLat(foundLat);
        setLng(foundLng);

        if (mapRef.current && markerRef.current) {
          markerRef.current.setLngLat([foundLng, foundLat]);
          mapRef.current.flyTo({
            center: [foundLng, foundLat],
            zoom: 16,
            essential: true,
          });
          playPinTapSound();
        }
        setSearchFeedback('Localização encontrada com sucesso!');
        setTimeout(() => setSearchFeedback(null), 3000);
      } else {
        setSearchFeedback('Endereço não localizado. Tente clicar diretamente no mapa.');
      }
    } catch (err) {
      setSearchFeedback('Erro na busca. Clique diretamente no mapa.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      const payload = {
        category,
        icon: category,
        latitude: lat,
        longitude: lng,
        color: customColor || null,
        is_active: isActive ? 1 : 0
      };

      const url = iconToEdit
        ? `/api/admin/map-visual-icons/${iconToEdit.id}`
        : `/api/admin/map-visual-icons`;
      const method = iconToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        onSuccess(data.icon);
        onClose();
      } else {
        alert(data.error || 'Erro ao salvar ícone.');
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro ao salvar ícone: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl my-auto bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh] text-zinc-900">
        
        {/* Header no Padrão Admin (Branco / Zinc-50) */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/70">
          <div className="flex items-center gap-3">
            {/* Live Interactive Preview Badge */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-colors duration-200 shrink-0"
              style={{ backgroundColor: effectiveColor }}
              dangerouslySetInnerHTML={{
                __html: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none">${currentMeta.svgInner}</svg>`
              }}
            />
            <div>
              <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase">
                {iconToEdit ? 'Edição Oficial' : 'Novo Cadastro Visual'}
              </span>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">
                {iconToEdit ? 'Editar Marcador do Mapa' : 'Novo Marcador Visual'}
              </h2>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Ponto de referência visual no mapa — sem cards e 100% leve
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body with Clean White Theme */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          
          {/* Section 1: Categories */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-black">1</span>
                Categoria do Marcador
              </h3>
              <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-2.5 py-0.5 rounded-full">
                {currentMeta.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Object.entries(MAP_VISUAL_ICON_CATEGORIES).map(([key, item]) => {
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCategory(key);
                      playPinTapSound();
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl text-left transition-all active:scale-[0.98] cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-2 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-zinc-50 hover:bg-zinc-100/90 border border-zinc-200/90 text-zinc-700'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white shadow-xs"
                      style={{ backgroundColor: isSelected ? effectiveColor : item.bgColor }}
                      dangerouslySetInnerHTML={{
                        __html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none">${item.svgInner}</svg>`
                      }}
                    />
                    <span className="text-xs font-bold truncate">
                      {item.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Color Customization (Any Color Option) */}
          <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-black">2</span>
                Cor do Marcador
              </h3>

              <div className="flex items-center gap-2">
                {/* Current Hex Badge */}
                <span className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-xs font-mono font-bold text-zinc-800 shadow-xs">
                  {effectiveColor.toUpperCase()}
                </span>

                {/* Reset to Default Color Button */}
                {customColor && (
                  <button
                    type="button"
                    onClick={() => setCustomColor('')}
                    title="Restaurar cor padrão da categoria"
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Padrão</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-zinc-500 font-medium">
              Escolha uma cor predefinida ou selecione qualquer cor personalizada para destacar o ícone no mapa.
            </p>

            {/* Swatches List + Custom Color Picker */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {PRESET_COLORS.map((preset) => {
                const isSelected = effectiveColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setCustomColor(preset.hex)}
                    title={preset.label}
                    className={`w-7 h-7 rounded-full transition-transform active:scale-95 cursor-pointer relative flex items-center justify-center border border-black/10 shadow-xs ${
                      isSelected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white scale-110' : 'hover:scale-105 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}

              {/* Free Custom Color Picker (Choose any color) */}
              <div className="relative group ml-1">
                <button
                  type="button"
                  onClick={() => colorPickerRef.current?.click()}
                  title="Escolher qualquer cor personalizada"
                  className="w-7 h-7 rounded-full flex items-center justify-center border border-zinc-300 shadow-xs cursor-pointer transition-transform hover:scale-110 active:scale-95 overflow-hidden"
                  style={{
                    background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                  }}
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white/90 flex items-center justify-center shadow-xs">
                    <span className="text-[10px] font-black text-zinc-800 leading-none">+</span>
                  </div>
                </button>
                <input
                  ref={colorPickerRef}
                  type="color"
                  value={effectiveColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
                />
              </div>

              {/* Direct Hex Input */}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-zinc-400 font-mono font-bold">#</span>
                <input
                  type="text"
                  maxLength={7}
                  value={effectiveColor.replace('#', '')}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (/^[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setCustomColor('#' + val);
                    }
                  }}
                  placeholder="007AFF"
                  className="w-20 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Position on Map */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-black">3</span>
                Localização no Mapa
              </h3>
              <span className="text-xs text-zinc-500 font-medium">
                Arraste o pin ou clique no mapa
              </span>
            </div>

            {/* Address Search Bar */}
            <form onSubmit={handleSearchLocation} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar rua, bairro ou ponto de referência..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-xs font-bold text-white rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {searchFeedback && (
              <p className={`text-xs font-medium ${searchFeedback.includes('Erro') || searchFeedback.includes('não') ? 'text-amber-600' : 'text-emerald-600'}`}>
                {searchFeedback}
              </p>
            )}

            {/* Interactive Map Container */}
            <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-zinc-200 shadow-inner">
              <div ref={mapContainer} className="w-full h-full" />
              
              {/* Coordinates Pill */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-200 text-[11px] text-zinc-700 font-mono shadow-sm flex items-center gap-1.5 pointer-events-none">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              </div>

              {/* Map Zoom Controls */}
              <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 z-10">
                <button
                  type="button"
                  onClick={() => mapRef.current?.zoomIn()}
                  aria-label="Aumentar zoom"
                  className="w-8 h-8 rounded-xl bg-white/95 text-zinc-700 hover:bg-white border border-zinc-200 flex items-center justify-center shadow-md transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mapRef.current?.zoomOut()}
                  aria-label="Diminuir zoom"
                  className="w-8 h-8 rounded-xl bg-white/95 text-zinc-700 hover:bg-white border border-zinc-200 flex items-center justify-center shadow-md transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Active Switch */}
          <div className="flex items-center justify-between p-4 bg-zinc-50/80 border border-zinc-200 rounded-2xl">
            <div>
              <div className="text-xs font-black text-zinc-900">Exibir no mapa público</div>
              <div className="text-xs text-zinc-500 font-medium mt-0.5">
                {isActive ? 'Visível para todos os visitantes do aplicativo' : 'Oculto temporariamente do mapa'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                isActive ? 'bg-emerald-500' : 'bg-zinc-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

        </div>

        {/* Footer Actions no Padrão Admin */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/70 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-xs font-black text-zinc-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-xs font-black text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar Localização'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
