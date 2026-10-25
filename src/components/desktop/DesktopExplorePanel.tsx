import React, { useRef } from 'react';
import { Spot } from '../../types';
import { Star, Search, X, ChevronRight, MapPin, SlidersHorizontal, Info } from 'lucide-react';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { getSpotImage, getSpotFallbackImage } from '../../utils/spotImages';

interface DesktopExplorePanelProps {
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  onOpenSpotDetails: (spot: Spot) => void;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  theme?: 'dark' | 'light';
}

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'hotels', label: 'Hotéis' },
  { id: 'restaurants', label: 'Restaurantes' },
  { id: 'cafes', label: 'Cafés' },
  { id: 'sweets', label: 'Chocolates' },
  { id: 'attractions', label: 'Atrações' },
  { id: 'pharmacies', label: 'Farmácias' },
];

export const DesktopExplorePanel: React.FC<DesktopExplorePanelProps> = ({
  spots,
  selectedSpot,
  onSelectSpot,
  onOpenSpotDetails,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  theme = 'light',
}) => {
  const categoriesRef = useRef<HTMLDivElement | null>(null);
  const isDark = theme === 'dark';

  const activeCategory = selectedCategory || 'all';

  return (
    <div
      className={`hidden md:flex flex-col w-[380px] lg:w-[410px] xl:w-[430px] h-full border-r z-20 select-none shrink-0 overflow-hidden ${
        isDark ? 'bg-[#000000] border-[#262626] text-white' : 'bg-white border-zinc-200 text-zinc-900'
      }`}
      style={{
        fontFamily: "'Inter', sans-serif",
        backgroundColor: isDark ? '#000000' : '#ffffff',
      }}
    >
      {/* 1. Header & Search Area */}
      <div
        className={`p-4 lg:p-5 pb-3 border-b space-y-3.5 shrink-0 ${
          isDark ? 'bg-[#000000] border-[#262626]' : 'bg-white border-zinc-200'
        }`}
        style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
      >
        {/* Title & Count */}
        <div className="flex items-baseline justify-between">
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ color: isDark ? '#FFFFFF' : '#424242' }}
          >
            Explorar
          </h2>
          <span className="text-xs font-semibold text-zinc-500">
            {spots.length} {spots.length === 1 ? 'local' : 'locais'}
          </span>
        </div>

        {/* Search Input */}
        <div
          className={`relative flex items-center px-3.5 py-2.5 rounded-xl border transition-all ${
            isDark
              ? 'bg-[#000000] border-[#262626] focus-within:border-white/40'
              : 'bg-[#f5f5f5] border-zinc-200 focus-within:border-zinc-400'
          }`}
        >
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar pontos, restaurantes, hotéis..."
            className="w-full bg-transparent border-none outline-none text-xs lg:text-[13px] placeholder-zinc-400 font-medium ml-2.5"
            style={{ color: isDark ? '#FFFFFF' : '#3a3838' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. Horizontal Categories Scroller */}
        <div
          ref={categoriesRef}
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 no-scrollbar"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id === 'all' ? 'all' : cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 ${
                  isDark
                    ? isSelected
                      ? 'bg-white text-black shadow-xs'
                      : 'bg-[#000000] text-[#A1A1AA] border border-[#262626] hover:text-white'
                    : isSelected
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Spots List */}
      <div
        className={`flex-1 overflow-y-auto p-3 lg:p-4 space-y-2.5 scrollbar-none ${
          isDark ? 'bg-[#000000]' : 'bg-white'
        }`}
        style={{ backgroundColor: isDark ? '#000000' : '#ffffff', color: '#ffffff' }}
      >
        {spots.length > 0 ? (
          spots.map((spot) => {
            const isSelected = selectedSpot?.id === spot.id;
            const imgUrl = getSpotImage(spot);

            return (
              <div
                key={spot.id}
                onClick={() => onSelectSpot(spot)}
                className={`w-full p-3 rounded-2xl border transition-all duration-150 flex items-center gap-3.5 text-left cursor-pointer group relative ${
                  isDark
                    ? isSelected
                      ? 'bg-[#000000] border-amber-500/80 ring-1 ring-amber-500/30 shadow-sm'
                      : 'bg-[#000000] border-[#262626] hover:border-white/30'
                    : isSelected
                    ? 'bg-[#ffffff] border-amber-500/80 ring-2 ring-amber-500/30 shadow-sm'
                    : 'bg-[#f5f5f5] border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-100/90'
                }`}
                style={{ backgroundColor: isDark ? '#000000' : (isSelected ? '#ffffff' : '#f5f5f5') }}
              >
                {/* Standardized Thumbnail Image */}
                <div className={`w-20 h-20 rounded-xl overflow-hidden shrink-0 relative border ${
                  isDark ? 'bg-zinc-900 border-[#262626]' : 'bg-zinc-200 border-zinc-200'
                }`}>
                  <img
                    src={imgUrl}
                    alt={spot.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                    }}
                    loading="lazy"
                  />
                  {spot.rating && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
                      <Star className="w-2.5 h-2.5 fill-amber-400 stroke-none" />
                      <span>{spot.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Spot Info Column */}
                <div className="flex-1 min-w-0 pr-1">
                  {/* Title & Verified Badge */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="text-[13.5px] font-bold tracking-tight truncate leading-tight"
                      style={{ color: isDark ? '#FFFFFF' : '#3a3838' }}
                    >
                      {spot.name}
                    </span>
                    <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                  </div>

                  {/* Category & Address */}
                  <div className="text-xs font-medium truncate mb-1.5" style={{ color: isDark ? '#A1A1AA' : '#828282' }}>
                    <span className="font-semibold" style={{ color: isDark ? '#A1A1AA' : '#828282' }}>
                      {spot.categoryLabel || spot.category}
                    </span>
                    {spot.address && (
                      <>
                        <span className="mx-1 text-zinc-400">·</span>
                        <span className="truncate" style={{ color: isDark ? '#A1A1AA' : '#828282' }}>
                          {spot.address}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Bottom details & action row */}
                  <div className="flex items-center justify-between text-[11px] font-medium pt-0.5" style={{ color: isDark ? '#A1A1AA' : '#828282' }}>
                    <span className="truncate max-w-[140px]" style={{ color: isDark ? '#A1A1AA' : '#828282' }}>
                      {spot.priceRange ? `${spot.priceRange} · ` : ''}
                      {spot.hours ? spot.hours : 'Aberto hoje'}
                    </span>

                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpot(spot);
                        onOpenSpotDetails(spot);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-0.5 shadow-2xs ${
                        isDark
                          ? 'bg-[#000000] border-[#262626] hover:border-white/30'
                          : 'bg-white border-zinc-200/90 hover:bg-zinc-100'
                      }`}
                      title="Ver detalhes completos"
                    >
                      <span style={{ color: isDark ? '#FFFFFF' : '#515151' }}>Detalhes</span>
                      <ChevronRight className="w-3 h-3" style={{ color: isDark ? '#FFFFFF' : '#515151' }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 px-4 text-center">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-zinc-500 mx-auto mb-3 ${
              isDark ? 'bg-[#000000] border-[#262626]' : 'bg-zinc-100 border-zinc-200'
            }`}>
              <MapPin className="w-5 h-5 stroke-[1.8]" />
            </div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-800'}`}>Nenhum local encontrado</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
              Tente alterar os termos da busca ou selecionar outra categoria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopExplorePanel;
