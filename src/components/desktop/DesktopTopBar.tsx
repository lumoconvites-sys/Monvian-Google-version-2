import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, SlidersHorizontal, RotateCcw, Star, ChevronRight } from 'lucide-react';
import { Spot } from '../../types';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { getSpotImage, getSpotFallbackImage } from '../../utils/spotImages';

export const DESKTOP_CATEGORIES = [
  { id: 'hotels', label: 'Hotéis e Pousadas', image: '/hotel.png' },
  { id: 'restaurants', label: 'Restaurantes', image: '/restaurante.png' },
  { id: 'cafes', label: 'Cafés', image: '/cafe.png' },
  { id: 'sweets', label: 'Chocolates & Doces', image: '/doce.png' },
  { id: 'attractions', label: 'Atrações & Parques', image: '/atracoes.png' },
  { id: 'pharmacies', label: 'Farmácias', image: '/medicacao.png' },
];

interface DesktopTopBarProps {
  spots: Spot[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  onSelectSpot: (spot: Spot) => void;
  theme: 'dark' | 'light';
  realWeather: {
    temperature: number;
    condition: string;
    weatherCode: number;
    isDay: boolean;
  };
  onOpenWeatherModal: () => void;
  onOpenMapModes?: () => void;
  is3DMode?: boolean;
  onToggle3DMode?: () => void;
}

export const DesktopTopBar: React.FC<DesktopTopBarProps> = ({
  spots,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  onSelectSpot,
  is3DMode,
  onToggle3DMode,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const filterContainerRef = useRef<HTMLDivElement | null>(null);

  // Filtered spots for instant search dropdown
  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return spots.filter((s) => {
      const matchName = s.name.toLowerCase().includes(q);
      const matchCat = s.categoryLabel?.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const matchAddress = s.address?.toLowerCase().includes(q);
      return matchName || matchCat || matchAddress;
    }).slice(0, 6);
  }, [searchQuery, spots]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isFilterActive = Boolean(selectedCategory && selectedCategory !== 'all');

  return (
    <div
      aria-label="Barra superior flutuante"
      className="hidden md:flex items-center gap-2.5 absolute top-5 left-6 z-30 pointer-events-none select-none max-w-lg w-full"
    >
      {/* 1. Compact Search Container with exact mobile iOS Glass styling */}
      <div
        ref={searchContainerRef}
        className="relative flex-1 pointer-events-auto"
      >
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full ios-glass border border-white/20 dark:border-white/15 transition-all shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
        >
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-400 shrink-0 stroke-[2.2]" />
          <input
            id="desktop-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setIsSearchFocused(true);
            }}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="O que você quer encontrar?"
            className="flex-1 bg-transparent text-[13.5px] font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none min-w-0"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setIsSearchFocused(false);
              }}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-200 cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Instant Search Results Dropdown with exact mobile iOS Glass styling */}
        <AnimatePresence>
          {isSearchFocused && searchQuery.trim().length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 rounded-[24px] ios-glass border border-white/20 dark:border-white/15 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden z-50 text-zinc-900 dark:text-white"
            >
              {searchResults.length > 0 ? (
                <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-none">
                  {searchResults.map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => {
                        onSelectSpot(spot);
                        setIsSearchFocused(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-zinc-900/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all text-left cursor-pointer group"
                    >
                      <img
                        src={getSpotImage(spot)}
                        alt={spot.name}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-black/5 dark:border-white/10 shadow-xs"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[13.5px] font-bold text-zinc-900 dark:text-white truncate">
                            {spot.name}
                          </span>
                          <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                          {spot.rating && (
                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black shrink-0 ml-auto">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              <span>{spot.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                            {spot.categoryLabel}
                          </span>
                          {spot.address && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-600 shrink-0">•</span>
                              <span className="truncate">{spot.address}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-0.5" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-zinc-400 font-medium">
                  Nenhum local encontrado para "{searchQuery}"
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. 3D View Toggle Button (Activates mountain elevation terrain & 3D tilt) */}
      <div className="pointer-events-auto shrink-0">
        <button
          id="desktop-btn-3d-toggle"
          type="button"
          onClick={onToggle3DMode}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer group shrink-0 ${
            is3DMode
              ? 'ios-glass-btn ring-2 ring-blue-500/80 bg-blue-500/25 text-blue-400 border border-blue-400/40 shadow-[0_0_18px_rgba(59,130,246,0.5)]'
              : 'ios-glass-btn text-zinc-700 dark:text-white border border-white/20 dark:border-white/15'
          }`}
          title={is3DMode ? 'Alternar para visão 2D Plana' : 'Alternar para visão 3D com Relevo e Montanhas'}
        >
          <div className="relative flex items-center justify-center font-black text-xs tracking-tighter group-hover:scale-110 transition-transform">
            <span>3D</span>
          </div>
        </button>
      </div>

      {/* 3. Category Filter Button (Matches mobile's btn-category-icon-toggle with SlidersHorizontal) */}
      <div ref={filterContainerRef} className="relative pointer-events-auto shrink-0">
        <button
          id="desktop-btn-category-icon-toggle"
          type="button"
          onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer group shrink-0 ${
            isFilterActive || isFilterDropdownOpen
              ? 'ios-glass-btn ring-2 ring-white/40 dark:ring-white/35 bg-white/25 dark:bg-white/20 text-zinc-900 dark:text-white border border-white/20 dark:border-white/15'
              : 'ios-glass-btn text-zinc-700 dark:text-white border border-white/20 dark:border-white/15'
          }`}
          title={isFilterActive ? 'Filtro ativo - Clique para alterar ou limpar' : 'Filtrar por Categoria'}
        >
          <div className="relative w-5 h-5 flex items-center justify-center text-current group-hover:scale-110 transition-transform duration-300">
            <SlidersHorizontal className="w-5 h-5 stroke-[2.2]" />
          </div>
          {isFilterActive && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] ring-1 ring-black/40" />
          )}
        </button>

        {/* Category Dropdown (Exact replica of mobile category dropdown) */}
        <AnimatePresence>
          {isFilterDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -6 }}
              transition={{ type: 'spring', damping: 25, stiffness: 420 }}
              className="absolute left-0 top-14 w-64 p-2.5 rounded-[26px] ios-glass border border-white/20 dark:border-white/15 z-[60] space-y-1 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.85)] pointer-events-auto"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-900/10 dark:border-white/10">
                <span className="text-[11px] font-black text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">
                  Categorias
                </span>
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCategory('all');
                      setIsFilterDropdownOpen(false);
                    }}
                    className="text-[11px] font-black text-zinc-700 dark:text-white hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpar
                  </button>
                )}
              </div>

              {DESKTOP_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectCategory(isSelected ? 'all' : cat.id);
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-2xl active:scale-[0.98] text-xs font-black flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer group ${
                      isSelected
                        ? 'bg-white/20 text-zinc-950 dark:text-white font-extrabold'
                        : 'hover:bg-zinc-900/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <img
                          src={cat.image}
                          alt={cat.label}
                          className="w-full h-full object-contain select-none"
                        />
                      </div>
                      <span className="truncate">{cat.label}</span>
                    </div>

                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
