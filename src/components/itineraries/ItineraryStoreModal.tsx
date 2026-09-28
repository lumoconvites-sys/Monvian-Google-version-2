import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Compass,
  ChevronRight,
  Crown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, ItineraryCategory } from '../../types';
import { ItineraryStoreDetailModal } from './ItineraryStoreDetailModal';

// Fast In-Memory Cache for Instant 0ms Store Hydration
let memoryItinerariesCache: Itinerary[] | null = null;
let memoryCategoriesCache: ItineraryCategory[] | null = null;

const CACHE_KEY_ITINS = 'monvian_itineraries_store_cache_v2';
const CACHE_KEY_CATS = 'monvian_itinerary_categories_cache_v2';

function getInitialItineraries(): Itinerary[] {
  if (memoryItinerariesCache && memoryItinerariesCache.length > 0) {
    return memoryItinerariesCache;
  }
  try {
    const stored = localStorage.getItem(CACHE_KEY_ITINS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryItinerariesCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return [];
}

function getInitialCategories(): ItineraryCategory[] {
  if (memoryCategoriesCache && memoryCategoriesCache.length > 0) {
    return memoryCategoriesCache;
  }
  try {
    const stored = localStorage.getItem(CACHE_KEY_CATS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCategoriesCache = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return [];
}

interface ItineraryStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyItinerary: (itinerary: Itinerary) => Promise<void>;
  theme?: 'dark' | 'light';
}

export const ItineraryStoreModal: React.FC<ItineraryStoreModalProps> = ({
  isOpen,
  onClose,
  onApplyItinerary,
  theme = 'dark',
}) => {
  const [itineraries, setItineraries] = useState<Itinerary[]>(getInitialItineraries);
  const [categories, setCategories] = useState<ItineraryCategory[]>(getInitialCategories);
  const [loading, setLoading] = useState<boolean>(() => itineraries.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const isLight = theme === 'light';

  // Load itineraries and categories with instant cache & silent background revalidation
  const loadStoreData = async (silent = false) => {
    try {
      if (!silent && itineraries.length === 0) {
        setLoading(true);
      }
      const [itinsRes, catsRes] = await Promise.all([
        fetch('/api/itineraries'),
        fetch('/api/itinerary-categories')
      ]);

      const itinsData = await itinsRes.json();
      const catsData = await catsRes.json();

      if (itinsData.success && Array.isArray(itinsData.itineraries)) {
        setItineraries(itinsData.itineraries);
        memoryItinerariesCache = itinsData.itineraries;
        try {
          localStorage.setItem(CACHE_KEY_ITINS, JSON.stringify(itinsData.itineraries));
        } catch (e) {}
      }
      if (catsData.success && Array.isArray(catsData.categories)) {
        setCategories(catsData.categories);
        memoryCategoriesCache = catsData.categories;
        try {
          localStorage.setItem(CACHE_KEY_CATS, JSON.stringify(catsData.categories));
        } catch (e) {}
      }
    } catch (e) {
      console.error('Error loading store data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const hasCached = itineraries.length > 0;
      loadStoreData(hasCached);
    }
  }, [isOpen]);

  // Listen for admin real-time broadcasts
  useEffect(() => {
    const handleBroadcastUpdate = () => {
      loadStoreData(true);
    };
    window.addEventListener('monvian:itineraries-updated', handleBroadcastUpdate);
    return () => {
      window.removeEventListener('monvian:itineraries-updated', handleBroadcastUpdate);
    };
  }, []);

  // Filter tabs: Todos, Mais procurados, Natureza, Casais + extras
  const filterTabs = useMemo(() => {
    const base: { id: string; name: string }[] = [
      { id: 'all', name: 'Todos' },
      { id: 'popular', name: 'Mais procurados' },
      { id: 'nature', name: 'Natureza' },
      { id: 'romantic', name: 'Casais' },
    ];

    // Append any extra category from DB if not already represented
    for (const cat of categories) {
      const lowerId = cat.id.toLowerCase();
      const lowerName = cat.name.toLowerCase();
      const isAlready =
        lowerId === 'all' ||
        lowerId === 'popular' ||
        lowerId === 'nature' ||
        lowerId === 'romantic' ||
        lowerName.includes('mais procurad') ||
        lowerName.includes('natureza') ||
        lowerName.includes('casais') ||
        lowerName.includes('casal');

      if (!isAlready) {
        base.push({ id: cat.id, name: cat.name });
      }
    }
    return base;
  }, [categories]);

  // Featured itineraries (isFeatured / isRecommended)
  const featuredItineraries = useMemo(() => {
    return itineraries.filter(i => i.isFeatured || i.isRecommended);
  }, [itineraries]);

  // Filtered itineraries based on search & category
  const filteredItineraries = useMemo(() => {
    return itineraries.filter(itin => {
      // 1. Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = itin.title.toLowerCase().includes(q);
        const matchesDesc = itin.description?.toLowerCase().includes(q);
        const matchesCat = itin.categories.some(c => c.toLowerCase().includes(q));
        const matchesSpots = itin.days.some(d => d.steps.some(s => s.spot?.name.toLowerCase().includes(q)));
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesSpots) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'popular' || selectedCategory === 'mais-procurados') {
          return itin.isFeatured || itin.isRecommended;
        }
        if (selectedCategory === 'nature' || selectedCategory === 'natureza') {
          return itin.categories.some(c => {
            const lc = c.toLowerCase();
            return lc.includes('nature') || lc.includes('natureza') || lc.includes('parque') || lc.includes('ar');
          });
        }
        if (selectedCategory === 'romantic' || selectedCategory === 'casais' || selectedCategory === 'casal') {
          return itin.categories.some(c => {
            const lc = c.toLowerCase();
            return lc.includes('romantic') || lc.includes('românt') || lc.includes('romant') || lc.includes('casal') || lc.includes('casais');
          });
        }
        if (selectedCategory === '1day' || selectedCategory === '1-dia' || selectedCategory === '1dia') {
          return itin.daysCount === 1;
        }
        if (selectedCategory === '2days' || selectedCategory === '2-dias' || selectedCategory === '2dias') {
          return itin.daysCount === 2;
        }
        const matchesCategory = itin.categories.includes(selectedCategory) ||
          itin.categories.some(c => c.toLowerCase().includes(selectedCategory.toLowerCase()));
        if (!matchesCategory) return false;
      }

      return true;
    });
  }, [itineraries, searchQuery, selectedCategory]);

  // Single featured itinerary for the hero card (strictly 1 single item)
  const singleFeaturedItinerary = useMemo(() => {
    if (featuredItineraries.length > 0) return featuredItineraries[0];
    if (itineraries.length > 0) return itineraries[0];
    return null;
  }, [featuredItineraries, itineraries]);

  // Items for the "Todos os roteiros" section
  const otherItineraries = useMemo(() => {
    // When in initial view (all + no search query), avoid duplicating the single featured hero card
    if (selectedCategory === 'all' && !searchQuery && singleFeaturedItinerary) {
      return filteredItineraries.filter(i => i.id !== singleFeaturedItinerary.id);
    }
    return filteredItineraries;
  }, [filteredItineraries, selectedCategory, searchQuery, singleFeaturedItinerary]);

  const handleOpenDetail = (itin: Itinerary) => {
    setSelectedItinerary(itin);
    setIsDetailOpen(true);
  };

  const handleApplyFromDetail = async (itin: Itinerary) => {
    await onApplyItinerary(itin);
    setIsDetailOpen(false);
    onClose();
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="itinerary-store-modal"
          initial={{ x: '100%' }}
          animate={{ x: '0%' }}
          exit={{ x: '100%' }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 32,
            mass: 0.8
          }}
          className={`fixed inset-0 z-[190] w-full h-full flex flex-col overflow-hidden transition-colors duration-200 ${
            isLight
              ? 'bg-[#ffffff] text-zinc-900'
              : 'bg-[#0e0f12] text-white'
          }`}
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Manrope', sans-serif",
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            backdropFilter: 'blur(30px) saturate(180%)',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: 'transform, opacity'
          }}
        >
          {/* 1. CABEÇALHO COM ESTILO CONSISTENTE DE "EXPLORAR" */}
          <div
            className={`relative px-5 pb-3.5 shrink-0 border-b z-20 transition-colors duration-200 ${
              isLight
                ? 'bg-white/80 border-zinc-200/70 text-zinc-900'
                : 'bg-black/60 border-white/10 text-white'
            }`}
            style={{
              paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 22px)',
              WebkitBackdropFilter: 'blur(20px)',
              backdropFilter: 'blur(20px)'
            }}
          >
            {/* Título grande, preto e forte à esquerda com botão discreto à direita */}
            <div className="flex items-center justify-between mb-3.5">
              <h1 className={`text-2xl sm:text-[28px] font-black tracking-tight leading-none ${
                isLight ? 'text-zinc-900' : 'text-white'
              }`}>
                Roteiros
              </h1>

              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onClose}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  isLight
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200/80 text-zinc-600 hover:text-zinc-900'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-400 hover:text-white'
                }`}
                title="Fechar"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </motion.button>
            </div>

            {/* 2. CAMPO DE BUSCA COMPATÍVEL COM "EXPLORAR" */}
            <div className="relative">
              <div className={`flex items-center border rounded-full px-4 h-11 transition-all ${
                isLight
                  ? 'bg-zinc-100/90 border-zinc-200/70 focus-within:border-zinc-300 focus-within:bg-white text-zinc-900'
                  : 'bg-white/5 border-white/10 focus-within:border-white/20 text-white'
              }`}>
                <Search className={`w-4 h-4 mr-2.5 shrink-0 stroke-[2] ${
                  isLight ? 'text-zinc-400' : 'text-zinc-500'
                }`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar roteiros..."
                  className={`w-full bg-transparent text-sm font-medium focus:outline-none ${
                    isLight ? 'text-zinc-900 placeholder-zinc-400' : 'text-white placeholder-zinc-500'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs cursor-pointer ${
                      isLight ? 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300' : 'bg-white/10 text-zinc-400 hover:bg-white/20'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. FILTROS HORIZONTAIS COMPACTOS E REFINADOS */}
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {filterTabs.map((tab) => {
                const isSelected = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-[#007AFF] text-white border-transparent shadow-xs'
                        : isLight
                        ? 'bg-zinc-100/90 text-zinc-600 border-zinc-200/70 hover:bg-zinc-200/80 hover:text-zinc-900'
                        : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTEÚDO PRINCIPAL COM SCROLL SUAVE E ESPAÇAMENTO */}
          <div className="flex-1 overflow-y-auto px-5 pt-5 pb-36 space-y-6">
            {loading && itineraries.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
                <p className={`text-xs font-medium ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Carregando roteiros...
                </p>
              </div>
            ) : (
              <>
                {/* 4. SEÇÃO "ROTEIRO EM DESTAQUE" (EXATAMENTE UM ÚNICO CARD CENTRALIZADO) */}
                {selectedCategory === 'all' && !searchQuery && singleFeaturedItinerary && (
                  <div className="space-y-3">
                    <h2 className={`text-sm sm:text-base font-bold tracking-tight px-0.5 ${
                      isLight ? 'text-zinc-900' : 'text-white'
                    }`}>
                      Roteiro em destaque
                    </h2>

                    {/* Card Único Perfeitamente Centralizado com Margem Lateral Confortável */}
                    <div className="w-full flex justify-center">
                      {(() => {
                        const itin = singleFeaturedItinerary;
                        const stopsCount = itin.placesCount || itin.days.reduce((acc, d) => acc + d.steps.length, 0);

                        return (
                          <motion.div
                            key={itin.id}
                            whileTap={{ scale: 0.98 }}
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 28
                            }}
                            onClick={() => handleOpenDetail(itin)}
                            className={`w-full max-w-[340px] sm:max-w-[356px] p-4 rounded-3xl border transition-all cursor-pointer flex flex-col space-y-3 ${
                              isLight
                                ? 'bg-white border-zinc-200/70 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-zinc-300'
                                : 'bg-[#141518] border-white/10 hover:border-white/20 shadow-md'
                            }`}
                          >
                            {/* [ IMAGEM GRANDE ] */}
                            <div className={`relative w-full aspect-[16/10] rounded-2xl overflow-hidden shrink-0 ${
                              isLight ? 'bg-zinc-100' : 'bg-zinc-900'
                            }`}>
                              <img
                                src={itin.coverImage}
                                alt={itin.title}
                                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                                loading="lazy"
                              />
                            </div>

                            {/* Informações internas organizadas */}
                            <div className="space-y-1.5 px-0.5">
                              {/* CONTA GOLD */}
                              {itin.isPremium && (
                                <div className="flex items-center">
                                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#C28514] dark:text-[#FDE073] flex items-center gap-1">
                                    <Crown className="w-3 h-3 stroke-[2.3] text-[#F5BE38]" />
                                    {itin.badgeText && itin.badgeText.toUpperCase() !== 'PREMIUM' ? itin.badgeText : 'CONTA GOLD'}
                                  </span>
                                </div>
                              )}

                              {/* Título grande e forte */}
                              <h3 className={`text-base sm:text-lg font-black tracking-tight leading-snug line-clamp-2 ${
                                isLight ? 'text-zinc-900' : 'text-white'
                              }`}>
                                {itin.title}
                              </h3>

                              {/* Duração • Paradas */}
                              <p className={`text-xs font-semibold ${
                                isLight ? 'text-zinc-500' : 'text-zinc-400'
                              }`}>
                                {itin.daysCount} {itin.daysCount === 1 ? 'dia' : 'dias'}  •  {stopsCount} {stopsCount === 1 ? 'parada' : 'paradas'}
                              </p>

                              {/* Descrição curta */}
                              <p className={`text-xs font-normal line-clamp-2 leading-relaxed ${
                                isLight ? 'text-zinc-600' : 'text-zinc-400'
                              }`}>
                                {itin.description}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 5. SEÇÃO "TODOS OS ROTEIROS" */}
                <div className="space-y-3">
                  <div className="px-0.5">
                    <h2 className={`text-sm sm:text-base font-bold tracking-tight ${
                      isLight ? 'text-zinc-900' : 'text-white'
                    }`}>
                      Todos os roteiros
                    </h2>
                  </div>

                  {otherItineraries.length === 0 ? (
                    <div className={`p-8 rounded-2xl border text-center space-y-2 ${
                      isLight
                        ? 'bg-white border-zinc-200/70 text-zinc-900'
                        : 'bg-[#141518] border-white/10 text-white'
                    }`}>
                      <Compass className={`w-8 h-8 mx-auto mb-1 ${
                        isLight ? 'text-zinc-400' : 'text-zinc-600'
                      }`} />
                      <p className="text-sm font-bold">Nenhum roteiro encontrado</p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Tente buscar por outro termo ou selecione a categoria "Todos".
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {otherItineraries.map((itin) => {
                        const stopsCount = itin.placesCount || itin.days.reduce((acc, d) => acc + d.steps.length, 0);

                        return (
                          <motion.div
                            key={itin.id}
                            whileTap={{ scale: 0.98 }}
                            transition={{
                              type: 'spring',
                              stiffness: 450,
                              damping: 28
                            }}
                            onClick={() => handleOpenDetail(itin)}
                            className={`w-full p-3 rounded-2xl border transition-all cursor-pointer flex gap-3.5 items-center justify-between text-left group ${
                              isLight
                                ? 'bg-white border-zinc-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-zinc-300'
                                : 'bg-[#141518] border-white/10 hover:border-white/20'
                            }`}
                          >
                            {/* [ FOTO ] */}
                            <div className={`w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden shrink-0 ${
                              isLight ? 'bg-zinc-100' : 'bg-zinc-900'
                            }`}>
                              <img
                                src={itin.coverImage}
                                alt={itin.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            </div>

                            {/* CONTEÚDO CENTRAL */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div>
                                <h3 className={`text-sm sm:text-[15px] font-black tracking-tight truncate leading-tight ${
                                  isLight ? 'text-zinc-900' : 'text-white'
                                }`}>
                                  {itin.title}
                                </h3>
                                <p className={`text-[11px] font-semibold mt-0.5 ${
                                  isLight ? 'text-zinc-500' : 'text-zinc-400'
                                }`}>
                                  {itin.daysCount} {itin.daysCount === 1 ? 'dia' : 'dias'}  •  {stopsCount} {stopsCount === 1 ? 'parada' : 'paradas'}
                                </p>
                                <p className={`text-xs font-normal line-clamp-1 mt-1 leading-snug ${
                                  isLight ? 'text-zinc-600' : 'text-zinc-400'
                                }`}>
                                  {itin.description}
                                </p>
                              </div>

                              <div className="pt-1.5 flex items-center justify-between">
                                {itin.isPremium ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-[#C28514] dark:text-[#FDE073] flex items-center gap-1">
                                    <Crown className="w-2.5 h-2.5 stroke-[2.3] text-[#F5BE38]" />
                                    {itin.badgeText && itin.badgeText.toUpperCase() !== 'PREMIUM' ? itin.badgeText : 'CONTA GOLD'}
                                  </span>
                                ) : (
                                  <span className={`text-xs font-semibold ${
                                    isLight ? 'text-zinc-400' : 'text-zinc-500'
                                  }`}>
                                    Disponível
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Seta discreta à direita indicando que o card é clicável */}
                            <div className="shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300 transition-colors pl-1">
                              <ChevronRight className="w-4 h-4 stroke-[2]" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Itinerary Details Modal */}
          <ItineraryStoreDetailModal
            itinerary={selectedItinerary}
            isOpen={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
            onApplyItinerary={handleApplyFromDetail}
            theme={theme}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
