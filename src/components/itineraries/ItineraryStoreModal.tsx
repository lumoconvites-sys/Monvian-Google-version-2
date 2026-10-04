import React, { useState, useEffect, useMemo } from 'react';
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

  // Filtered itineraries based on search query
  const filteredItineraries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return itineraries;
    return itineraries.filter(itin => {
      const matchesTitle = itin.title.toLowerCase().includes(q);
      const matchesDesc = itin.description?.toLowerCase().includes(q);
      const matchesCat = (itin.categories || []).some(c => c.toLowerCase().includes(q));
      const matchesSpots = (itin.days || []).some(d => (d.steps || []).some(s => s.spot?.name?.toLowerCase().includes(q)));
      return matchesTitle || matchesDesc || matchesCat || matchesSpots;
    });
  }, [itineraries, searchQuery]);

  // Single featured itinerary for the hero card (when not searching)
  const singleFeaturedItinerary = useMemo(() => {
    if (searchQuery.trim()) return null;
    const featured = itineraries.find(i => i.isFeatured || i.isRecommended);
    return featured || itineraries[0] || null;
  }, [itineraries, searchQuery]);

  // Other itineraries for the main list
  const otherItineraries = useMemo(() => {
    if (!searchQuery.trim() && singleFeaturedItinerary) {
      return filteredItineraries.filter(i => i.id !== singleFeaturedItinerary.id);
    }
    return filteredItineraries;
  }, [filteredItineraries, searchQuery, singleFeaturedItinerary]);

  const handleOpenDetail = (itin: Itinerary) => {
    setSelectedItinerary(itin);
    setIsDetailOpen(true);
  };

  const handleApplyFromDetail = async (itin: Itinerary) => {
    await onApplyItinerary(itin);
    setIsDetailOpen(false);
    onClose();
  };

  return createPortal(
    <>
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="itinerary-store-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-[3px] flex items-center justify-center p-4 sm:p-6 select-none cursor-pointer"
            style={{ willChange: 'opacity' }}
          >
            <motion.div
              key="itinerary-store-card"
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-lg max-h-[85vh] rounded-[36px] overflow-hidden flex flex-col shadow-2xl border cursor-auto ${
                isLight
                  ? 'bg-white/80 border-white/70 text-zinc-900 shadow-[0_25px_70px_rgba(0,0,0,0.16)] ring-1 ring-black/5'
                  : 'bg-[#1c1c1e]/80 border-white/20 text-white shadow-[0_30px_90px_rgba(0,0,0,0.9)] ring-1 ring-white/10'
              }`}
              style={{
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                WebkitBackdropFilter: 'blur(25px) saturate(180%)',
                backdropFilter: 'blur(25px) saturate(180%)',
                willChange: 'transform, opacity',
                transform: 'translateZ(0)',
              }}
            >
          {/* Minimal Top Bar with Search & Close matching Foto 2 */}
          <div className="p-4 sm:p-5 pb-3 flex items-center gap-3 border-b border-black/[0.06] dark:border-white/10 shrink-0">
            <div className={`relative flex items-center flex-1 rounded-2xl border px-3.5 py-2.5 transition-all ${
              isLight
                ? 'bg-black/[0.04] border-black/5 text-zinc-900 focus-within:border-blue-500'
                : 'bg-white/[0.08] border-white/15 text-white focus-within:border-[#F5BE38]/60'
            }`}>
              <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar roteiro..."
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                autoFocus={false}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 no-scrollbar">
            {loading && itineraries.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3">
                <div className="w-7 h-7 rounded-full border-2 border-[#007AFF] border-t-transparent animate-spin" />
                <p className="text-xs font-semibold text-zinc-400">Carregando roteiros...</p>
              </div>
            ) : filteredItineraries.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 space-y-1">
                <Compass className="w-8 h-8 mx-auto mb-2 opacity-50 stroke-[1.8]" />
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Nenhum roteiro encontrado</p>
                <p className="text-xs">Tente buscar por outro nome ou termo</p>
              </div>
            ) : (
              <>
                {/* Featured Itinerary Card (Clean Hero) */}
                {singleFeaturedItinerary && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
                      Roteiro em destaque
                    </h3>

                    {(() => {
                      const itin = singleFeaturedItinerary;
                      const stopsCount = itin.placesCount || (itin.days || []).reduce((acc, d) => acc + (d.steps || []).length, 0);

                      return (
                        <motion.div
                          whileTap={{ scale: 0.985 }}
                          whileHover={{ scale: 1.008 }}
                          onClick={() => handleOpenDetail(itin)}
                          className={`gold-featured-card-wrapper w-full cursor-pointer group ${isLight ? 'light' : ''}`}
                        >
                          <div className="gold-sheen-overlay" />
                          <div className={`gold-featured-card-inner p-4 flex flex-col space-y-3 ${isLight ? 'light' : ''}`}>
                            {/* Image */}
                            <div className={`relative w-full aspect-[16/9] rounded-2xl overflow-hidden shrink-0 border ${
                              isLight ? 'bg-zinc-100 border-[#F5BE38]/40 shadow-xs' : 'bg-zinc-900 border-[#F5BE38]/40 shadow-inner'
                            }`}>
                              <img
                                src={itin.coverImage}
                                alt={itin.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                              {/* Badge CONTA GOLD Metallic */}
                              <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-[#FFF4A3]/70 flex items-center gap-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
                                <Crown className="w-3.5 h-3.5 text-[#F5BE38] stroke-[2.5]" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-metallic-gold">
                                  {itin.badgeText && itin.badgeText.toUpperCase() !== 'PREMIUM' ? itin.badgeText : 'CONTA GOLD'}
                                </span>
                              </div>
                            </div>

                            {/* Info */}
                            <div className="space-y-1.5 px-0.5">
                              <h4 className={`text-base sm:text-lg font-black tracking-tight leading-snug line-clamp-1 transition-colors ${
                                isLight ? 'text-zinc-900' : 'text-white'
                              }`}>
                                {itin.title}
                              </h4>
                              <p className={`text-xs font-semibold ${
                                isLight ? 'text-zinc-500' : 'text-zinc-400'
                              }`}>
                                {itin.daysCount} {itin.daysCount === 1 ? 'dia' : 'dias'} • {stopsCount} {stopsCount === 1 ? 'parada' : 'paradas'}
                              </p>
                              {itin.description && (
                                <p className={`text-xs line-clamp-2 leading-relaxed font-medium ${
                                  isLight ? 'text-zinc-600' : 'text-zinc-300'
                                }`}>
                                  {itin.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </div>
                )}

                {/* All / Other Itineraries (Clean Free Cards) */}
                <div className="space-y-2 pt-1">
                  {singleFeaturedItinerary && otherItineraries.length > 0 && (
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
                      Todos os roteiros
                    </h3>
                  )}

                  <div className="space-y-2.5">
                    {otherItineraries.map((itin) => {
                      const stopsCount = itin.placesCount || (itin.days || []).reduce((acc, d) => acc + (d.steps || []).length, 0);

                      return (
                        <motion.div
                          key={itin.id}
                          whileTap={{ scale: 0.985 }}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => handleOpenDetail(itin)}
                          className={`w-full p-3.5 rounded-2xl cursor-pointer flex gap-3.5 items-center justify-between text-left transition-all duration-200 group ${
                            isLight
                              ? 'bg-white border border-black/[0.07] hover:border-black/20 shadow-xs'
                              : 'bg-white/[0.06] border border-white/10 hover:border-white/20 shadow-xs'
                          }`}
                        >
                          {/* Image */}
                          <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden shrink-0 relative border shadow-xs ${
                            isLight ? 'bg-zinc-100 border-black/5' : 'bg-zinc-900 border-white/10'
                          }`}>
                            <img
                              src={itin.coverImage}
                              alt={itin.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 py-0.5">
                            <h4 className={`text-sm font-black tracking-tight truncate leading-tight transition-colors ${
                              isLight ? 'text-zinc-900' : 'text-white'
                            }`}>
                              {itin.title}
                            </h4>
                            <p className={`text-xs font-semibold mt-0.5 ${
                              isLight ? 'text-zinc-500' : 'text-zinc-400'
                            }`}>
                              {itin.daysCount} {itin.daysCount === 1 ? 'dia' : 'dias'} • {stopsCount} {stopsCount === 1 ? 'parada' : 'paradas'}
                            </p>
                            {itin.description && (
                              <p className={`text-xs line-clamp-1 mt-0.5 font-medium ${
                                isLight ? 'text-zinc-600' : 'text-zinc-300'
                              }`}>
                                {itin.description}
                              </p>
                            )}
                          </div>

                          {/* Arrow */}
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all shrink-0 ml-1 ${
                            isLight
                              ? 'bg-black/5 border-black/5 text-zinc-600 group-hover:bg-black/10 group-hover:text-zinc-900'
                              : 'bg-white/10 border-white/10 text-zinc-300 group-hover:bg-white/20 group-hover:text-white'
                          }`}>
                            <ChevronRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
        )}
      </AnimatePresence>

      {/* Itinerary Details Modal */}
      <ItineraryStoreDetailModal
        itinerary={selectedItinerary}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onApplyItinerary={handleApplyFromDetail}
        theme={theme}
      />
    </>,
    document.body
  );
};
