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
  SlidersHorizontal,
  Mic,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { VerifiedBadge } from './ui/VerifiedBadge';
import { AppleBackButton } from './ui/AppleBackButton';
import { useIOSBackEntry } from '../services/iosNavigationManager';
import {
  readUserSearchCategoryFilter,
  writeUserSearchCategoryFilter,
  readUserSearchQuery,
  writeUserSearchQuery,
} from '../utils/userScopedStorage';

interface SearchFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  spots: Spot[];
  onSelectSpot: (spot: Spot) => void;
  theme?: 'dark' | 'light';
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
    id: 'farmacias',
    name: 'Farmácias',
    countLabel: '10 opções disponíveis',
    countNumber: 10,
    image: '/medicacao.png',
    matchCategories: ['pharmacies', 'services'],
    keywords: ['farmácia', 'drogaria', 'remédio', 'medicamento', 'saúde', '24h'],
  },
];

export const SearchFilterDrawer: React.FC<SearchFilterDrawerProps> = React.memo(({
  isOpen,
  onClose,
  spots,
  onSelectSpot,
  theme = 'dark',
}) => {
  const shouldAnimateEntrance = true;
  const [searchQuery, setSearchQuery] = useState(() => readUserSearchQuery());
  const [selectedCategory, setSelectedCategory] = useState<CategoryConfig | null>(() => {
    const savedId = readUserSearchCategoryFilter();
    return savedId ? SEARCH_CATEGORIES.find((c) => c.id === savedId) || null : null;
  });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    writeUserSearchQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    writeUserSearchCategoryFilter(selectedCategory?.id || null);
  }, [selectedCategory]);

  useEffect(() => {
    const handleLoggedOut = () => {
      setSearchQuery('');
      setSelectedCategory(null);
    };
    const handleAccountSwitched = (e: Event) => {
      const nextUser = (e as CustomEvent)?.detail || null;
      setSearchQuery(readUserSearchQuery(nextUser));
      const savedId = readUserSearchCategoryFilter(nextUser);
      setSelectedCategory(savedId ? SEARCH_CATEGORIES.find((c) => c.id === savedId) || null : null);
    };
    window.addEventListener('monvian:user_logged_out', handleLoggedOut);
    window.addEventListener('monvian:account_switched', handleAccountSwitched);
    return () => {
      window.removeEventListener('monvian:user_logged_out', handleLoggedOut);
      window.removeEventListener('monvian:account_switched', handleAccountSwitched);
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }
    try {
      try {
        recognitionRef.current?.abort?.();
      } catch {}
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'pt-BR';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
      };
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Register iOS Edge-Swipe Back Navigation when a category is selected inside Buscar
  useIOSBackEntry({
    id: `search-category:${selectedCategory?.id || 'none'}`,
    enabled: Boolean(isOpen && selectedCategory),
    priority: 125,
    label: selectedCategory?.name || 'Categoria',
    foregroundSelector: '#search-filter-panel',
    backgroundSelector: '#app-map-layer',
    onPop: () => setSelectedCategory(null),
  });

  // Focus input when opened on main search view
  useEffect(() => {
    if (isOpen && !selectedCategory) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, selectedCategory]);

  // Pre-normalize spot text fields once when spots array changes
  const indexedSpots = useMemo(() => {
    return spots.map((spot) => ({
      spot,
      catSearch: `${spot.name} ${spot.description} ${spot.categoryLabel}`.toLowerCase(),
      fullSearch: `${spot.name} ${spot.description} ${spot.categoryLabel} ${spot.tagLabel} ${spot.address}`.toLowerCase(),
    }));
  }, [spots]);

  // Calculate spots matching either search query or active category
  const filteredSpots = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const out: Spot[] = [];

    for (let i = 0; i < indexedSpots.length; i++) {
      const item = indexedSpots[i];
      if (selectedCategory) {
        const matchesCat =
          selectedCategory.matchCategories.includes(item.spot.category) ||
          selectedCategory.keywords.some((kw) => item.catSearch.includes(kw));
        if (!matchesCat) continue;
      }
      if (q && !item.fullSearch.includes(q)) continue;
      out.push(item.spot);
    }
    return out;
  }, [indexedSpots, searchQuery, selectedCategory]);

  const isDark = theme === 'dark';

  return (
    <AnimatePresence initial={shouldAnimateEntrance}>
      {isOpen && (
        <motion.div
          id="search-filter-overlay"
          initial={shouldAnimateEntrance ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            shouldAnimateEntrance
              ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
              : { duration: 0 }
          }
          onClick={onClose}
          className={`fixed inset-0 z-[55] flex flex-col justify-end md:justify-center md:items-center md:p-6 select-none overflow-hidden transition-colors duration-200 ${
            isDark ? 'bg-[#000000] md:bg-black/50' : 'bg-[#ffffff] md:bg-black/50'
          }`}
          style={{
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
            maxHeight: 'var(--app-height, 100dvh)',
            contain: 'layout paint size',
          }}
        >
          <motion.div
            id="search-filter-panel"
            initial={shouldAnimateEntrance ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={
              shouldAnimateEntrance
                ? { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0 }
            }
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full h-full md:h-[88vh] md:max-w-2xl rounded-none md:rounded-[30px] overflow-hidden flex flex-col justify-between shadow-2xl transition-colors duration-200 md:border ios-pushed-page ${
              isDark
                ? 'bg-[#000000] text-white md:border-white/10'
                : 'bg-[#ffffff] text-zinc-950 md:border-black/10'
            }`}
            style={{
              fontFamily: "'Inter', sans-serif",
              overflow: 'hidden',
              willChange: 'opacity, transform',
            }}
          >
      {/* Main Content Area (single scroll container so scrolled items glide behind sticky translucent header) */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto overscroll-contain w-full flex flex-col transition-colors ${
          isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-zinc-950'
        }`}
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 24px) + 90px)',
        }}
      >
      {/* Top Header Bar */}
      <div
        className={`sticky top-0 z-20 w-full pb-2 shrink-0 transition-colors ${
          isDark ? 'text-white' : 'text-zinc-950'
        }`}
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.40)',
        }}
      >
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedCategory ? (
            <AppleBackButton
              id="btn-back-categories"
              theme={isDark ? 'dark' : 'light'}
              onClick={() => setSelectedCategory(null)}
              title="Voltar às categorias"
              aria-label="Voltar às categorias"
              className="mr-1"
            />
          ) : null}

          <motion.h1
            initial={{ opacity: 0, scale: 0.88, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.02 }}
            className={`text-2xl sm:text-[28px] font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
            {selectedCategory ? selectedCategory.name : 'Buscar'}
          </motion.h1>
        </div>
        </div>
      </div>

      <div className="px-5 sm:px-7 max-w-3xl mx-auto w-full flex-1 flex flex-col">
        {/* Barra de busca exibida apenas na tela inicial de categorias ou busca por texto */}
        {!selectedCategory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.05 }}
            className="mt-1 mb-4"
          >
            <div
              style={{ height: '52px' }}
              className="w-full relative flex items-center rounded-full px-4 expo-liquid-glass-bar transition-colors duration-150"
            >
              <Search className={`w-[18px] h-[18px] shrink-0 mr-2.5 stroke-[2] ${
                isDark ? 'text-[#8e8e93]' : 'text-zinc-500'
              }`} />
              <input
                ref={searchInputRef}
                id="search-by-name-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pelo nome..."
                className={`flex-1 bg-transparent text-[15px] font-normal focus:outline-none ${
                  isDark
                    ? 'text-white placeholder-[#8e8e93]'
                    : 'text-zinc-950 placeholder-zinc-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  id="btn-clear-search"
                  onClick={() => setSearchQuery('')}
                  className={`w-5 h-5 rounded-full expo-liquid-glass-btn flex items-center justify-center ml-2 cursor-pointer active:scale-90 transition-colors ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={`p-1.5 rounded-full ml-1 transition-all cursor-pointer active:scale-95 ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : isDark
                      ? 'text-[#8e8e93] hover:text-white'
                      : 'text-zinc-500 hover:text-zinc-950'
                }`}
                title="Busca por voz"
              >
                <Mic style={{ width: '22px', height: '22px' }} />
              </button>
            </div>
          </motion.div>
        )}

        {/* VIEW 1: Categorias Principais (quando nenhuma categoria ou busca foi acionada) */}
        {!searchQuery && !selectedCategory && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-6">
            {SEARCH_CATEGORIES.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <motion.button
                  key={cat.id}
                  id={`cat-card-${cat.id}`}
                  initial={shouldAnimateEntrance ? { opacity: 0, scale: 0.88, y: 12 } : false}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={
                    shouldAnimateEntrance
                      ? {
                          type: 'spring',
                          stiffness: 380,
                          damping: 22,
                          delay: idx * 0.035,
                        }
                      : { duration: 0 }
                  }
                  whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                  whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full p-4 rounded-[24px] border transition-colors flex items-center justify-between text-left cursor-pointer group shadow-xs ${
                    isDark
                      ? 'bg-[#1C1C1E] hover:bg-[#252528] border-white/10'
                      : 'bg-[#fefefe] hover:bg-[#E5E5EA]/80 border-black/5'
                  }`}
                >
                  {/* Left: Rounded Square Icon Box OR Floating Image Asset + Titles */}
                  <div className="flex items-center gap-4 min-w-0">
                    {cat.image ? (
                      <div className="w-[50px] h-[50px] shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <motion.img
                          initial={shouldAnimateEntrance ? { opacity: 0, scale: 0.88, y: 8 } : false}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={
                            shouldAnimateEntrance
                              ? {
                                  type: 'spring',
                                  stiffness: 380,
                                  damping: 22,
                                  delay: idx * 0.035,
                                }
                              : { duration: 0 }
                          }
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-contain filter drop-shadow-md select-none"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.src.endsWith('.png.png') && target.src.endsWith('.png')) {
                              target.src = target.src + '.png';
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border group-hover:scale-105 transition-transform ${
                        isDark
                          ? 'bg-white/5 text-white border-white/10'
                          : 'bg-white text-zinc-900 border-black/5'
                      }`}>
                        {Icon && <Icon className="w-5 h-5 stroke-[1.8]" />}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className={`text-[15px] sm:text-base font-bold tracking-tight leading-tight transition-colors ${
                        isDark ? 'text-white' : 'text-zinc-950'
                      }`}>
                        {cat.name}
                      </h3>
                      <p className={`text-xs font-medium mt-0.5 leading-snug ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}>
                        {cat.countLabel}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* VIEW 2: Lista de Locais da Categoria Selecionada ou Busca por Nome */}
        {(searchQuery || selectedCategory) && (
          <div className="pt-2 pb-6">
            {/* Se estiver buscando por texto no topo, mostra contador discreto; na categoria limpa não polui a tela */}
            {searchQuery && !selectedCategory && (
              <div className={`flex items-center justify-between px-1 text-xs mb-2 ${
                isDark ? 'text-zinc-400' : 'text-zinc-500'
              }`}>
                <span>
                  {filteredSpots.length}{' '}
                  {filteredSpots.length === 1 ? 'local encontrado' : 'locais encontrados'}
                </span>
              </div>
            )}

            {filteredSpots.length === 0 ? (
              <div 
                className="py-14 text-center text-zinc-500 text-sm flex flex-col items-center justify-center"
              >
                <SlidersHorizontal className={`w-8 h-8 mb-2 stroke-[1.5] ${
                  isDark ? 'text-zinc-600' : 'text-zinc-400'
                }`} />
                <p className={`font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Nenhum local encontrado em Campos do Jordão.
                </p>
                <p className="text-xs text-zinc-500 mt-1">Toque na seta para voltar às categorias.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSpots.map((spot, idx) => (
                  <motion.div
                    key={spot.id}
                    id={`spot-result-${spot.id}`}
                    initial={shouldAnimateEntrance ? { opacity: 0, scale: 0.88, y: 12 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={
                      shouldAnimateEntrance
                        ? {
                            type: 'spring',
                            stiffness: 380,
                            damping: 22,
                            delay: Math.min(idx * 0.035, 0.35),
                          }
                        : { duration: 0 }
                    }
                    whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                    whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                    onClick={() => {
                      onSelectSpot(spot);
                      onClose();
                    }}
                    className={`w-full p-4 sm:p-4.5 rounded-[24px] border transition-colors flex items-center justify-between text-left cursor-pointer group shadow-xs ${
                      isDark
                        ? 'bg-[#1C1C1E] hover:bg-[#252528] border-white/10'
                        : 'bg-[#fefefe] hover:bg-[#E5E5EA]/80 border-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-4 sm:gap-4.5 min-w-0 flex-1">
                      {/* Thumbnail do local (68px, cantos arredondados modernos 20px) */}
                      <div className={`w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-[20px] overflow-hidden shrink-0 border ${
                        isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-200 border-black/5'
                      }`}>
                        <motion.img
                          initial={shouldAnimateEntrance ? { opacity: 0, scale: 0.88, y: 8 } : false}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={
                            shouldAnimateEntrance
                              ? {
                                  type: 'spring',
                                  stiffness: 380,
                                  damping: 22,
                                  delay: Math.min(idx * 0.035, 0.35),
                                }
                              : { duration: 0 }
                          }
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

                      {/* Informações: Título, Categoria e Linha com Estrela Dourada + Cidade */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-[16px] sm:text-[17px] font-bold tracking-tight truncate transition-colors ${
                            isDark ? 'text-white' : 'text-zinc-950'
                          }`}>
                            {spot.name}
                          </h4>
                          <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                        </div>
                        <p className={`text-[13px] font-medium truncate mt-0.5 ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          {spot.categoryLabel}
                        </p>
                        <div className={`flex items-center gap-2 text-[12.5px] mt-1.5 ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}>
                          <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
                            {spot.rating || 4.8}
                          </span>
                          <span>•</span>
                          <span className="truncate">{spot.address ? spot.address.split(',')[0] : 'Campos do Jordão'}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
});
