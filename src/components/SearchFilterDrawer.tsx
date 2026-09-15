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
  icon: React.ComponentType<{ className?: string }>;
  matchCategories: SpotCategory[];
  keywords: string[];
}

const SEARCH_CATEGORIES: CategoryConfig[] = [
  {
    id: 'hoteis',
    name: 'Hotéis',
    countLabel: '30 opções disponíveis',
    countNumber: 30,
    icon: Building2,
    matchCategories: ['hotels'],
    keywords: ['hotel', 'pousada', 'chalé', 'hospedagem', 'resort', 'quarto'],
  },
  {
    id: 'restaurantes',
    name: 'Restaurantes',
    countLabel: '20 opções disponíveis',
    countNumber: 20,
    icon: UtensilsCrossed,
    matchCategories: ['gastronomy', 'restaurants'],
    keywords: ['restaurante', 'fondue', 'cervejaria', 'carne', 'almoço', 'jantar', 'bistrô', 'truta', 'baden'],
  },
  {
    id: 'cafes',
    name: 'Cafés',
    countLabel: '15 opções disponíveis',
    countNumber: 15,
    icon: Coffee,
    matchCategories: ['cafes'],
    keywords: ['café', 'coffee', 'bistrô', 'chá', 'croissant', 'padaria'],
  },
  {
    id: 'doces',
    name: 'Doces',
    countLabel: '12 opções disponíveis',
    countNumber: 12,
    icon: Cake,
    matchCategories: ['sweets'],
    keywords: ['doce', 'chocolate', 'araucária', 'trufa', 'bombom', 'sobremesa', 'waffle'],
  },
  {
    id: 'atracoes',
    name: 'Atrações',
    countLabel: '20 opções disponíveis',
    countNumber: 20,
    icon: Mountain,
    matchCategories: ['attractions', 'viewpoint', 'parks', 'nature', 'culture'],
    keywords: ['parque', 'mirante', 'teleférico', 'amantikir', 'itapeva', 'bosque', 'passeio', 'trilha', 'palácio'],
  },
  {
    id: 'programacao',
    name: 'Programação',
    countLabel: 'Eventos e shows',
    countNumber: 8,
    icon: Calendar,
    matchCategories: ['events', 'culture'],
    keywords: ['evento', 'show', 'festival', 'música', 'concerto', 'festa', 'auditório', 'inverno'],
  },
  {
    id: 'farmacias',
    name: 'Farmácias',
    countLabel: '10 opções disponíveis',
    countNumber: 10,
    icon: Cross,
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
    <motion.div
      id="search-filter-overlay"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0 }}
      className="absolute inset-0 z-45 bg-zinc-50 dark:bg-[#111315] text-zinc-900 dark:text-white flex flex-col justify-between overflow-hidden"
      style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Header Bar identical to screenshot */}
      <div
        className="px-5 sm:px-6 pb-3 flex items-center justify-between z-10 shrink-0"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 14px), 24px)',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center gap-3">
          {selectedCategory ? (
            <motion.button
              whileTap={{ scale: 0.85 }}
              id="btn-back-categories"
              onClick={() => setSelectedCategory(null)}
              className="w-10 h-10 rounded-full bg-zinc-200/80 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-900 dark:text-white flex items-center justify-center transition-colors cursor-pointer mr-1"
              title="Voltar às categorias"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </motion.button>
          ) : null}

          <h1 className="text-2xl sm:text-[28px] font-black text-zinc-900 dark:text-white tracking-tight">
            {selectedCategory ? selectedCategory.name : 'Explorar'}
          </h1>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto px-5 sm:px-6 max-w-md mx-auto w-full"
        style={{
          paddingBottom: 'calc(max(16px, calc(env(safe-area-inset-bottom, 0px) + 6px)) + 80px)',
        }}
      >
        {/* Search Bar matching screenshot */}
        <div className="mt-2 mb-4">
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
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                id="btn-clear-search"
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-500 dark:text-zinc-400 flex items-center justify-center ml-2 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </motion.button>
            )}
          </div>
        </div>

        {/* VIEW 1: Main Category Cards List (Exact Match to Screenshot) */}
        {!searchQuery && !selectedCategory && (
          <div className="flex flex-col gap-2.5">
            {SEARCH_CATEGORIES.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <motion.button
                  key={cat.id}
                  id={`cat-card-${cat.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, type: 'spring', stiffness: 500, damping: 30 }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedCategory(cat)}
                  className="w-full p-4 rounded-3xl bg-white dark:bg-[#141518] hover:bg-zinc-50 dark:hover:bg-[#1a1c21] border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/15 transition-colors flex items-center justify-between text-left cursor-pointer group shadow-sm"
                >
                  {/* Left: Rounded Square Icon Box + Titles */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-[#202227] flex items-center justify-center text-zinc-600 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors shrink-0">
                      <Icon className="w-5 h-5 stroke-[1.8]" />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight leading-tight group-hover:text-zinc-900 dark:group-hover:text-white">
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
                </motion.button>
              );
            })}
          </div>
        )}

        {/* VIEW 2: Spots List (when a category is tapped or user searches by name) */}
        {(searchQuery || selectedCategory) && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {filteredSpots.length}{' '}
                {filteredSpots.length === 1 ? 'local encontrado' : 'locais encontrados'}
              </span>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs text-[#00C896] hover:underline cursor-pointer"
                >
                  Ver todas categorias
                </button>
              )}
            </div>

            {filteredSpots.length === 0 ? (
              <motion.div 
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-14 text-center text-zinc-500 text-sm flex flex-col items-center justify-center"
              >
                <SlidersHorizontal className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mb-2 stroke-[1.5]" />
                <p className="text-zinc-600 dark:text-zinc-400">Nenhum local encontrado em Campos do Jordão.</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Tente outro nome ou volte às categorias.</p>
              </motion.div>
            ) : (
              filteredSpots.map((spot, index) => (
                <motion.div
                  key={spot.id}
                  id={`spot-result-${spot.id}`}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0 }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => {
                    onSelectSpot(spot);
                    onClose();
                  }}
                  className="w-full p-3.5 rounded-3xl bg-white dark:bg-[#141518] hover:bg-zinc-50 dark:hover:bg-[#1a1c21] border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20 transition-colors flex items-center justify-between text-left cursor-pointer group shadow-sm dark:shadow-md"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-white/10 shadow-inner">
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight truncate group-hover:text-[#00C896] transition-colors">
                          {spot.name}
                        </h4>
                      </div>

                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-black truncate mt-0.5">
                        {spot.categoryLabel}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        <span className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400 font-black">
                          <Star className="w-3 h-3 fill-amber-500 dark:fill-amber-400" />
                          {spot.rating}
                        </span>
                        <span>•</span>
                        <span className="truncate flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                          <MapPin className="w-3 h-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
                          <span className="truncate">{spot.address.split(',')[0]}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors shrink-0 ml-2">
                    <ChevronRight className="w-4 h-4 stroke-[2]" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
