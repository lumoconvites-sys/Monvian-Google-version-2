import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Spot, SpotCategory } from '../types';
import {
  Search,
  X,
  ChevronRight,
  Building2,
  UtensilsCrossed,
  Coffee,
  Cake,
  Mountain,
  Calendar,
  Cross,
  Star,
  MapPin,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { VerifiedBadge } from './ui/VerifiedBadge';

interface SearchFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  spots: Spot[];
  onSelectSpot: (spot: Spot) => void;
}

interface CategoryConfig {
  id: string;
  name: string;
  countLabel: string;
  countNumber: number;
  icon?: React.ComponentType<{ className?: string }>;
  image?: string;
  matchCategories: SpotCategory[];
  keywords: string[];
}

const SEARCH_CATEGORIES: CategoryConfig[] = [
  {
    id: 'hoteis',
    name: 'Hotéis',
    countLabel: '30 opções disponíveis',
    countNumber: 30,
    image: '/hotel.png',
    matchCategories: ['hotels'],
    keywords: ['hotel', 'pousada', 'chalé', 'hospedagem', 'resort', 'quarto'],
  },
  {
    id: 'restaurantes',
    name: 'Restaurantes',
    countLabel: '20 opções disponíveis',
    countNumber: 20,
    image: '/restaurante.png',
    matchCategories: ['gastronomy', 'restaurants'],
    keywords: ['restaurante', 'fondue', 'cervejaria', 'carne', 'almoço', 'jantar', 'bistrô', 'truta', 'baden'],
  },
  {
    id: 'cafes',
    name: 'Cafés',
    countLabel: '15 opções disponíveis',
    countNumber: 15,
    image: '/cafe.png',
    matchCategories: ['cafes'],
    keywords: ['café', 'coffee', 'bistrô', 'chá', 'croissant', 'padaria'],
  },
  {
    id: 'doces',
    name: 'Doces',
    countLabel: '12 opções disponíveis',
    countNumber: 12,
    image: '/doce.png',
    matchCategories: ['sweets'],
    keywords: ['doce', 'chocolate', 'araucária', 'trufa', 'bombom', 'sobremesa', 'waffle'],
  },
  {
    id: 'atracoes',
    name: 'Atrações',
    countLabel: '20 opções disponíveis',
    countNumber: 20,
    image: '/atracoes.png',
    matchCategories: ['attractions', 'viewpoint', 'parks', 'nature', 'culture'],
    keywords: ['parque', 'mirante', 'teleférico', 'amantikir', 'itapeva', 'bosque', 'passeio', 'trilha', 'palácio'],
  },
  {
    id: 'programacao',
    name: 'Programação',
    countLabel: 'Eventos e shows',
    countNumber: 8,
    image: '/programacao.png',
    matchCategories: ['events', 'culture'],
    keywords: ['evento', 'show', 'festival', 'música', 'concerto', 'festa', 'auditório', 'inverno'],
  },
  {
    id: 'farmacias',
    name: 'Farmácias',
    countLabel: '10 opções disponíveis',
    countNumber: 10,
    image: '/medicacao.png',
    matchCategories: ['pharmacies', 'services'],
    keywords: ['farmácia', 'drogaria', 'remédio', 'medicamento', 'saúde', '24h'],
  },
];

export const SearchFilterDrawer: React.FC<SearchFilterDrawerProps> = ({
  isOpen,
  onClose,
  spots,
  onSelectSpot,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryConfig | null>(null);

  const isGoldUser = Boolean(
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
        const cleanEmail = (u.email || u.whatsapp || '').trim().toLowerCase();
        const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail);
        return isGoldAdmin || Boolean(u.isGold || u.is_gold === 1 || u.isPremium || u.is_premium === 1);
      } catch {
        return false;
      }
    })()
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Focus input when opened or reset
  useEffect(() => {
    if (isOpen && !selectedCategory) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, selectedCategory]);

  // Reset category on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory(null);
    }
  }, [isOpen]);

  // Calculate spots matching either search query or active category
  const filteredSpots = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return spots.filter((spot) => {
      // If a category card is clicked:
      if (selectedCategory) {
        const matchesCat =
          selectedCategory.matchCategories.includes(spot.category) ||
          selectedCategory.keywords.some((kw) =>
            spot.name.toLowerCase().includes(kw) ||
            spot.description.toLowerCase().includes(kw) ||
            spot.categoryLabel.toLowerCase().includes(kw)
          );

        if (!matchesCat) return false;
      }

      // If user typed in search query
      if (q) {
        return (
          spot.name.toLowerCase().includes(q) ||
          spot.description.toLowerCase().includes(q) ||
          spot.categoryLabel.toLowerCase().includes(q) ||
          spot.tagLabel.toLowerCase().includes(q) ||
          spot.address.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [spots, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div
      id="search-filter-overlay"
      onClick={onClose}
      className="fixed inset-0 z-45 flex flex-col justify-end md:justify-center md:items-center md:p-6 select-none overflow-hidden transition-colors duration-300 md:bg-black/50 md:backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-full md:h-[88vh] md:max-w-2xl bg-zinc-50 dark:bg-[#000000] md:dark:ios-glass text-zinc-900 dark:text-white rounded-none md:rounded-[32px] overflow-hidden flex flex-col justify-between shadow-2xl md:border md:border-black/10 md:dark:border-white/15"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
      {/* Top Header Bar identical to screenshot */}
      <div
        className="px-5 sm:px-6 pb-3 flex items-center justify-between z-10 shrink-0"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 24px)',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center gap-3">
          {selectedCategory ? (
            <button
              id="btn-back-categories"
              onClick={() => setSelectedCategory(null)}
              className="w-10 h-10 rounded-full bg-zinc-200/80 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-900 dark:text-white flex items-center justify-center transition-all cursor-pointer mr-1 active:scale-95"
              title="Voltar às categorias"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
          ) : null}

          <h1 className="text-2xl sm:text-[28px] font-extrabold text-zinc-900 dark:text-[#F5F2EA] tracking-tight">
            {selectedCategory ? selectedCategory.name : 'Buscar'}
          </h1>
        </div>

        {/* Desktop Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-zinc-200/80 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-900 dark:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Fechar busca"
          aria-label="Fechar busca"
        >
          <X className="w-4 h-4 stroke-[2.2]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto px-5 sm:px-8 max-w-3xl mx-auto w-full"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 90px)',
        }}
      >
        {/* Search Bar matching screenshot */}
        <div className="mt-2 mb-5">
          <div className="relative flex items-center bg-white dark:bg-[#131417] border border-zinc-200 dark:border-white/10 rounded-full px-4 py-3.5 shadow-xl focus-within:border-zinc-300 dark:focus-within:border-white/25 transition-all">
            <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-3 stroke-[2.2]" />
            <input
              ref={searchInputRef}
              id="search-by-name-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar pelo nome..."
              className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                id="btn-clear-search"
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-500 dark:text-zinc-400 flex items-center justify-center ml-2 cursor-pointer active:scale-90"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* VIEW 1: Main Category Cards List (Responsive Grid on Desktop) */}
        {!searchQuery && !selectedCategory && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SEARCH_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  id={`cat-card-${cat.id}`}
                  onClick={() => setSelectedCategory(cat)}
                  className="w-full p-4 rounded-3xl bg-white dark:bg-[#141518] hover:bg-zinc-50 dark:hover:bg-[#1a1c21] border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/15 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  {/* Left: Rounded Square Icon Box OR Floating Image Asset + Titles */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {cat.image ? (
                      <div className="w-14 h-14 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-contain filter drop-shadow-sm select-none"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.src.endsWith('.png.png') && target.src.endsWith('.png')) {
                              target.src = target.src + '.png';
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-[#202227] flex items-center justify-center text-zinc-700 dark:text-white shrink-0 shadow-xs border border-zinc-200/50 dark:border-white/5 group-hover:scale-105 transition-transform">
                        {Icon && <Icon className="w-5 h-5 stroke-[1.8]" />}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight leading-tight group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-zinc-400 font-black mt-0.5 tracking-tight">
                        {cat.countLabel}
                      </p>
                    </div>
                  </div>

                  {/* Right: Thin Chevron Arrow */}
                  <div className="text-zinc-500 group-hover:text-zinc-300 transition-colors shrink-0 ml-2">
                    <ChevronRight className="w-5 h-5 stroke-[2]" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* VIEW 2: Spots List (when a category is tapped or user searches by name) */}
        {(searchQuery || selectedCategory) && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>
                {filteredSpots.length}{' '}
                {filteredSpots.length === 1 ? 'local encontrado' : 'locais encontrados'}
              </span>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs text-zinc-700 dark:text-white hover:underline cursor-pointer font-bold"
                >
                  Ver todas categorias
                </button>
              )}
            </div>

            {filteredSpots.length === 0 ? (
              <div 
                className="py-14 text-center text-zinc-500 text-sm flex flex-col items-center justify-center"
              >
                <SlidersHorizontal className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mb-2 stroke-[1.5]" />
                <p className="text-zinc-600 dark:text-zinc-400 font-bold">Nenhum local encontrado em Campos do Jordão.</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Tente outro nome ou volte às categorias.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSpots.map((spot) => (
                  <div
                    key={spot.id}
                    id={`spot-result-${spot.id}`}
                    onClick={() => {
                      onSelectSpot(spot);
                      onClose();
                    }}
                    className="w-full p-3.5 rounded-3xl bg-white dark:bg-[#141518] hover:bg-zinc-50 dark:hover:bg-[#1a1c21] border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-between text-left cursor-pointer group shadow-sm hover:shadow-md dark:shadow-md active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-white/10 shadow-inner">
                        <img
                          src={getSpotImage(spot)}
                          alt={spot.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className={`text-sm font-extrabold text-zinc-900 dark:text-[#F5F2EA] tracking-tight truncate transition-colors ${
                            isGoldUser ? 'group-hover:text-[#F5BE38]' : 'group-hover:text-[#FFFFFF]'
                          }`}>
                            {spot.name}
                          </h4>
                          <VerifiedBadge />
                        </div>

                        <p className="text-xs text-[#9A9894] font-semibold truncate mt-0.5">
                          {spot.categoryLabel}
                        </p>

                        <div className="flex items-center gap-2 text-[11px] text-[#9A9894] mt-1">
                          <span className={`flex items-center gap-0.5 font-bold ${isGoldUser ? 'text-[#F5BE38]' : 'text-[#FFFFFF]'}`}>
                            <Star className={`w-3 h-3 ${isGoldUser ? 'fill-[#F5BE38] text-[#F5BE38]' : 'fill-[#FFFFFF] text-[#FFFFFF]'}`} />
                            {spot.rating}
                          </span>
                          <span>•</span>
                          <span className="truncate flex items-center gap-1 text-[#9A9894] font-semibold">
                            <MapPin className={`w-3 h-3 shrink-0 ${isGoldUser ? 'text-[#F5BE38]' : 'text-zinc-600 dark:text-white'}`} />
                            <span className="truncate">{spot.address.split(',')[0]}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors shrink-0 ml-2">
                      <ChevronRight className="w-4 h-4 stroke-[2]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
};
