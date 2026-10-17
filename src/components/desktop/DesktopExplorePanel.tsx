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
}) => {
  const categoriesRef = useRef<HTMLDivElement | null>(null);

  const activeCategory = selectedCategory || 'all';

  return (
    <div
      className="hidden md:flex flex-col w-[380px] lg:w-[410px] xl:w-[430px] h-full bg-[#0C0D10] border-r border-white/[0.08] z-20 select-none shrink-0 overflow-hidden text-white"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
      }}
    >
      {/* 1. Header & Search Area */}
      <div className="p-4 lg:p-5 pb-3 border-b border-white/[0.08] space-y-3.5 shrink-0 bg-[#0C0D10]">
        {/* Title & Count */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold tracking-tight text-white">
            Explorar
          </h2>
          <span className="text-xs font-semibold text-zinc-400">
            {spots.length} {spots.length === 1 ? 'local' : 'locais'}
          </span>
        </div>

        {/* Apple Style Search Input */}
        <div className="relative flex items-center px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] focus-within:border-white/25 focus-within:bg-white/[0.08] transition-all">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar pontos, restaurantes, hotéis..."
            className="w-full bg-transparent border-none outline-none text-xs lg:text-[13px] text-white placeholder-zinc-500 font-medium ml-2.5"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                  isSelected
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Spots List */}
      <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2 scrollbar-none">
        {spots.length > 0 ? (
          spots.map((spot) => {
            const isSelected = selectedSpot?.id === spot.id;
            const imgUrl = getSpotImage(spot);

            return (
              <div
                key={spot.id}
                onClick={() => onSelectSpot(spot)}
                className={`w-full p-3 rounded-2xl border transition-all duration-150 flex items-center gap-3.5 text-left cursor-pointer group relative ${
                  isSelected
                    ? 'bg-[#181A20] border-white/25 shadow-md ring-1 ring-white/15'
                    : 'bg-[#131418] border-white/[0.05] hover:border-white/[0.12] hover:bg-[#16181D]'
                }`}
              >
                {/* Standardized Thumbnail Image */}
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-zinc-900 border border-white/[0.08] relative">
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
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
                      <Star className="w-2.5 h-2.5 fill-amber-400 stroke-none" />
                      <span>{spot.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Spot Info Column */}
                <div className="flex-1 min-w-0 pr-1">
                  {/* Title & Verified Badge */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[13.5px] font-bold text-white tracking-tight truncate leading-tight">
                      {spot.name}
                    </span>
                    <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                  </div>

                  {/* Category & Address */}
                  <div className="text-xs text-zinc-400 font-medium truncate mb-1.5">
                    <span className="text-zinc-300 font-semibold">{spot.categoryLabel || spot.category}</span>
                    {spot.address && (
                      <>
                        <span className="mx-1 text-zinc-600">·</span>
                        <span className="text-zinc-400 truncate">{spot.address}</span>
                      </>
                    )}
                  </div>

                  {/* Bottom details & action row */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium pt-0.5">
                    <span className="text-zinc-400 truncate max-w-[140px]">
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
                      className="px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] transition-colors cursor-pointer flex items-center gap-0.5"
                      title="Ver detalhes completos"
                    >
                      <span>Detalhes</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-400 mx-auto mb-3">
              <MapPin className="w-5 h-5 stroke-[1.8]" />
            </div>
            <p className="text-sm font-bold text-white">Nenhum local encontrado</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-[240px] mx-auto leading-relaxed">
              Tente alterar os termos da busca ou selecionar outra categoria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopExplorePanel;
