import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Heart,
  Star,
  Crown,
  Compass,
  Flame,
  TreePine,
  Utensils,
  Users,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, ItineraryCategory } from '../../types';
import { ItineraryStoreDetailModal } from './ItineraryStoreDetailModal';
import { DEFAULT_CURATED_ITINERARIES } from '../../data/defaultItineraries';
import { preloadImage, extractAllItineraryImageUrls } from '../../utils/preloadItineraries';

// Fast in-memory cache for instant hydration
let memoryItinerariesCache: Itinerary[] | null = null;
let memoryCategoriesCache: ItineraryCategory[] | null = null;

const CACHE_KEY_ITINS = 'monvian_itineraries_store_cache_v5';
const CACHE_KEY_CATS = 'monvian_itinerary_categories_cache_v5';

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
  return DEFAULT_CURATED_ITINERARIES;
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

export interface AirbnbItineraryExplorerProps {
  onSelectItinerary: (itinerary: Itinerary) => Promise<void> | void;
  onOpenMap?: () => void;
  theme?: 'dark' | 'light';
  activeItineraryId?: string | null;
}

export const AirbnbItineraryExplorer: React.FC<AirbnbItineraryExplorerProps> = ({
  onSelectItinerary,
  onOpenMap,
  theme = 'dark',
  activeItineraryId,
}) => {
  const [itineraries, setItineraries] = useState<Itinerary[]>(getInitialItineraries);
  const [categories, setCategories] = useState<ItineraryCategory[]>(getInitialCategories);
  const [loading, setLoading] = useState<boolean>(() => itineraries.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('monvian_itinerary_favs') || '[]');
    } catch {
      return [];
    }
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [scrollPositions, setScrollPositions] = useState<Record<string, { canLeft: boolean; canRight: boolean }>>({});

  const updateScrollState = useCallback((sectionId: string) => {
    const el = carouselRefs.current[sectionId];
    if (!el) return;
    const canLeft = el.scrollLeft > 8;
    const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 8;
    setScrollPositions((prev) => {
      if (prev[sectionId]?.canLeft === canLeft && prev[sectionId]?.canRight === canRight) {
        return prev;
      }
      return { ...prev, [sectionId]: { canLeft, canRight } };
    });
  }, []);

  const scrollCarousel = (sectionId: string, direction: 'left' | 'right') => {
    const el = carouselRefs.current[sectionId];
    if (!el) return;
    const amount = el.clientWidth;
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
    setTimeout(() => updateScrollState(sectionId), 350);
  };

  // Toggle favorite
  const handleToggleFavorite = (itinId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(itinId)
        ? prev.filter((id) => id !== itinId)
        : [...prev, itinId];
      try {
        localStorage.setItem('monvian_itinerary_favs', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Load store data with instant cache and background revalidation
  const loadStoreData = async (silent = false) => {
    try {
      if (!silent && itineraries.length === 0) {
        setLoading(true);
      }
      const [itinsRes, catsRes] = await Promise.all([
        fetch('/api/itineraries').catch(() => null),
        fetch('/api/itinerary-categories').catch(() => null),
      ]);

      if (itinsRes && itinsRes.ok) {
        try {
          const itinsData = await itinsRes.json();
          if (itinsData.success && Array.isArray(itinsData.itineraries) && itinsData.itineraries.length > 0) {
            setItineraries(itinsData.itineraries);
            memoryItinerariesCache = itinsData.itineraries;
            try {
              localStorage.setItem(CACHE_KEY_ITINS, JSON.stringify(itinsData.itineraries));
            } catch (e) {}

            // Proactively preload all fresh images into browser memory cache
            const freshImageUrls = extractAllItineraryImageUrls(itinsData.itineraries);
            freshImageUrls.forEach((u) => preloadImage(u, 'high'));
          }
        } catch (e) {}
      }

      if (catsRes && catsRes.ok) {
        try {
          const catsData = await catsRes.json();
          if (catsData.success && Array.isArray(catsData.categories) && catsData.categories.length > 0) {
            setCategories(catsData.categories);
            memoryCategoriesCache = catsData.categories;
            try {
              localStorage.setItem(CACHE_KEY_CATS, JSON.stringify(catsData.categories));
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Network issue fetching store data, using curated local data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasCached = itineraries.length > 0;
    loadStoreData(hasCached);
  }, []);

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

  // Curated Categories with emojis 2x larger
  const curatedCategories = useMemo(() => {
    return [
      { id: 'all', name: 'Todos', emoji: '✨' },
      { id: 'destaque', name: 'Destaques', emoji: '🔥' },
      { id: 'natureza', name: 'Natureza', emoji: '🌲' },
      { id: 'romantico', name: 'Românticos', emoji: '❤️' },
      { id: 'gastronomia', name: 'Gastronomia', emoji: '🍽️' },
      { id: 'familia', name: 'Família', emoji: '👨‍👩‍👧' },
      { id: 'aventura', name: 'Aventura', emoji: '🧭' },
    ];
  }, []);

  // Real-time filtering
  const filteredItineraries = useMemo(() => {
    let result = itineraries;

    // 1. Category Filter
    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter((itin) => {
        const cat = selectedCategory.toLowerCase();
        if (cat === 'destaque') return itin.isFeatured || itin.isRecommended;

        const itinCats = (itin.categories || []).map((c) => c.toLowerCase());
        if (cat === 'romantico') {
          return itinCats.some((c) =>
            ['romantic', 'romântico', 'casais', 'romance', 'sunset', 'culture'].includes(c)
          );
        }
        if (cat === 'gastronomia') {
          return itinCats.some((c) =>
            ['gastronomy', 'gastronomia', 'sweets', 'cafes'].includes(c)
          );
        }
        if (cat === 'natureza') {
          return itinCats.some((c) =>
            ['nature', 'natureza', 'parks', 'ecotourism', 'ecoturismo', 'trilhas'].includes(c)
          );
        }
        if (cat === 'familia') {
          return itinCats.some((c) =>
            ['family', 'família', 'familia', 'parks'].includes(c)
          );
        }
        if (cat === 'aventura') {
          return itinCats.some((c) =>
            ['adventure', 'aventura', 'nature', 'trilhas'].includes(c)
          );
        }
        return itinCats.includes(cat);
      });
    }

    // 2. Search Query Filter
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((itin) => {
        const matchesTitle = itin.title.toLowerCase().includes(q);
        const matchesDesc = itin.description?.toLowerCase().includes(q);
        const matchesCat = (itin.categories || []).some((c) => c.toLowerCase().includes(q));
        const matchesSpots = (itin.days || []).some((d) =>
          (d.steps || []).some(
            (s) =>
              s.spot?.name?.toLowerCase().includes(q) ||
              s.spotName?.toLowerCase().includes(q)
          )
        );
        return matchesTitle || matchesDesc || matchesCat || matchesSpots;
      });
    }

    return result;
  }, [itineraries, selectedCategory, searchQuery]);

  // Curated Horizontal Discovery Sections (Exact Airbnb Layout)
  const sections = useMemo(() => {
    if (searchQuery.trim() || selectedCategory !== 'all') {
      return [];
    }

    const featured = itineraries.filter((i) => i.isFeatured || i.isRecommended);
    const romantic = itineraries.filter((i) =>
      (i.categories || []).some((c) =>
        ['romantic', 'romântico', 'casais', 'sunset', 'culture'].includes(c.toLowerCase())
      )
    );
    const gastronomy = itineraries.filter((i) =>
      (i.categories || []).some((c) =>
        ['gastronomy', 'gastronomia', 'sweets', 'cafes'].includes(c.toLowerCase())
      )
    );
    const nature = itineraries.filter((i) =>
      (i.categories || []).some((c) =>
        ['nature', 'natureza', 'adventure', 'parks', 'ecoturismo'].includes(c.toLowerCase())
      )
    );
    const family = itineraries.filter((i) =>
      (i.categories || []).some((c) =>
        ['family', 'família', 'familia', 'parks'].includes(c.toLowerCase())
      )
    );
    const dayTrips = itineraries.filter((i) => i.daysCount === 1);

    const list: Array<{ id: string; title: string; items: Itinerary[] }> = [];

    if (featured.length > 0) {
      list.push({
        id: 'destaque',
        title: 'Roteiros em destaque',
        items: featured,
      });
    }

    if (romantic.length > 0) {
      list.push({
        id: 'romantico',
        title: 'Experiências para casais',
        items: romantic,
      });
    }

    if (gastronomy.length > 0) {
      list.push({
        id: 'gastronomia',
        title: 'Tour Gastronômico & Chocolates',
        items: gastronomy,
      });
    }

    if (nature.length > 0) {
      list.push({
        id: 'natureza',
        title: 'Natureza & Ecoturismo',
        items: nature,
      });
    }

    if (family.length > 0) {
      list.push({
        id: 'familia',
        title: 'Para toda a família',
        items: family,
      });
    }

    if (dayTrips.length > 0) {
      list.push({
        id: '1dia',
        title: 'Bate-e-Volta em 1 Dia',
        items: dayTrips,
      });
    }

    // Always include all itineraries at bottom
    list.push({
      id: 'todos',
      title: 'Todos os roteiros',
      items: itineraries,
    });

    return list;
  }, [itineraries, searchQuery, selectedCategory]);

  const handleOpenDetail = (itin: Itinerary) => {
    setSelectedItinerary(itin);
    setIsDetailOpen(true);
  };

  const handleApplyFromDetail = async (itin: Itinerary) => {
    setIsDetailOpen(false);
    await onSelectItinerary(itin);
  };

  const activeExpandedSectionData = useMemo(() => {
    if (!expandedSection) return null;
    return sections.find((s) => s.id === expandedSection) || null;
  }, [expandedSection, sections]);

  const isDark = theme === 'dark';

  return (
    <div
      className={`relative w-full h-full overflow-y-auto overscroll-contain select-none transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#F8F9FA] text-zinc-900'
      }`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}
    >
      {/* ========================================================
          1. TOP STICKY HEADER: PURE WHITE CAPSULE SEARCH BAR + HORIZONTAL SCROLLING CATEGORIES
         ======================================================== */}
      <div
        className={`sticky top-0 z-30 shrink-0 backdrop-blur-md transition-colors ${
          isDark
            ? 'bg-[#000000]/95'
            : 'bg-[#F8F9FA]/95'
        }`}
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 10px), 16px)',
        }}
      >
        {/* 1.1 BARRA DE PESQUISA: Cápsula Minimalista Centralizada */}
        <div className="pb-2.5 px-4">
          <div className="flex items-center gap-2 max-w-xl mx-auto w-full">
            {expandedSection ? (
              <button
                type="button"
                onClick={() => setExpandedSection(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 border ${
                  isDark
                    ? 'border-white/15 bg-white/10 hover:bg-white/15 text-white'
                    : 'border-black/10 bg-black/5 hover:bg-black/10 text-black'
                }`}
                title="Voltar às seções"
                aria-label="Voltar às seções"
              >
                <ChevronLeft
                  className={`w-5 h-5 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                />
              </button>
            ) : (activeItineraryId && onOpenMap) ? (
              <button
                type="button"
                onClick={onOpenMap}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 border ${
                  isDark
                    ? 'border-white/15 bg-white/10 hover:bg-white/15 text-white'
                    : 'border-black/10 bg-black/5 hover:bg-black/10 text-black'
                }`}
                title="Voltar ao mapa do roteiro"
                aria-label="Voltar ao mapa do roteiro"
              >
                <ChevronLeft
                  className={`w-5 h-5 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                />
              </button>
            ) : null}

            {/* Capsule Search Bar (52px height, dark on dark mode, white on light mode, centered search & text identical to IMG_8236) */}
            <div
              onClick={() => {
                setIsSearchFocused(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className={`relative flex items-center justify-center flex-1 h-[52px] rounded-full px-4 transition-all border cursor-pointer select-none ${
                isDark
                  ? 'bg-zinc-900 text-white border-white/[0.05] hover:border-white/10'
                  : 'bg-white text-zinc-900 border-black/10 hover:border-black/20'
              }`}
            >
              {/* Centered magnifying glass + text right next to each other, identical to IMG_8236 */}
              {!isSearchFocused && !searchQuery ? (
                <div className="flex items-center justify-center gap-2 pointer-events-none select-none w-full">
                  <Search
                    className={`w-4 h-4 shrink-0 stroke-[2.2] ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  />
                  <span
                    className={`text-[15px] font-medium tracking-tight ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    Busque um roteiro
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 w-full h-full px-2">
                  <Search
                    className={`w-4 h-4 shrink-0 stroke-[2.2] ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => {
                      if (!searchQuery) setIsSearchFocused(false);
                    }}
                    placeholder="Busque um roteiro"
                    className={`w-full bg-transparent text-[15px] font-medium outline-none leading-normal ${
                      isDark
                        ? 'text-white placeholder:text-zinc-400'
                        : 'text-zinc-900 placeholder:text-zinc-500'
                    }`}
                    autoFocus
                  />
                </div>
              )}

              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className={`absolute right-3.5 p-1 rounded-full transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-zinc-300'
                      : 'bg-black/5 hover:bg-black/15 text-zinc-700'
                  }`}
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>

            {(isSearchFocused || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchFocused(false);
                  searchInputRef.current?.blur();
                }}
                className={`text-[13px] font-semibold px-1.5 shrink-0 transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* 1.2 CATEGORIAS: Imediatamente abaixo da pesquisa, linha horizontal única com rolagem */}
        {!expandedSection && (
          <div className="pt-0.5 pb-2.5">
            <div className="category-carousel-container flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap px-4 py-1">
              {curatedCategories.map((cat) => {
                const isSelected = selectedCategory === cat.id;

                return (
                  <motion.button
                    key={cat.id}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    onClick={(e) => {
                      setSelectedCategory(cat.id);
                      setExpandedSection(null);
                      (e.currentTarget as HTMLElement)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center',
                      });
                    }}
                    className={`h-[38px] sm:h-[40px] px-3.5 sm:px-4 rounded-full shrink-0 inline-flex items-center justify-center gap-2 cursor-pointer select-none text-center transition-all duration-200 ease-out ${
                      isSelected
                        ? isDark
                          ? 'bg-white/20 text-white font-medium border border-white/20 shadow-[inset_0_1.5px_2.5px_rgba(255,255,255,0.15)]'
                          : 'bg-[#E5E5EA] text-zinc-900 font-medium border border-black/[0.06] shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.12),_0_1px_1px_rgba(255,255,255,0.7)]'
                        : isDark
                          ? 'bg-[#1C1C1E] text-zinc-200 border border-white/10 shadow-[0_2px_6px_rgba(0,0,0,0.45)] hover:bg-[#252528]'
                          : 'bg-white text-zinc-800 border border-zinc-200/90 shadow-[0_2px_5px_-1px_rgba(0,0,0,0.07),_0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_3px_8px_-1px_rgba(0,0,0,0.09)]'
                    }`}
                  >
                    <span className="text-[17px] sm:text-[18px] shrink-0 leading-none select-none flex items-center justify-center">
                      {cat.emoji}
                    </span>
                    <span className="text-[13.5px] font-medium tracking-tight whitespace-nowrap leading-none">
                      {cat.name}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          2. SCROLLABLE MAIN BODY: COMPACT HORIZONTAL SECTIONS (AIRBNB FIDELITY)
         ======================================================== */}
      <div className="py-4 space-y-6 pb-32">
        {loading && itineraries.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${
              isDark ? 'border-white/70' : 'border-zinc-800'
            }`} />
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Carregando roteiros...
            </p>
          </div>
        ) : expandedSection && activeExpandedSectionData ? (
          /* Expanded Grid View - Reusing the exact same card component */
          <div className="space-y-4 px-6 sm:px-7">
            <div>
              <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}>
                {activeExpandedSectionData.title}
              </h2>
              <p className={`text-[13px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {activeExpandedSectionData.items.length}{' '}
                {activeExpandedSectionData.items.length === 1 ? 'roteiro' : 'roteiros'}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5 pt-1">
              {activeExpandedSectionData.items.map((itin) => (
                <AirbnbItineraryCardItem
                  key={itin.id}
                  itinerary={itin}
                  isFavorite={favorites.includes(itin.id)}
                  onToggleFavorite={(e) => handleToggleFavorite(itin.id, e)}
                  onClick={() => handleOpenDetail(itin)}
                  isActiveRoute={itin.id === activeItineraryId}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>
        ) : searchQuery.trim() ? (
          /* Search Results View */
          filteredItineraries.length === 0 ? (
            <div className={`text-center py-20 px-6 space-y-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              <Compass className="w-10 h-10 mx-auto mb-2 opacity-50 stroke-[1.8]" />
              <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Nenhum roteiro encontrado
              </p>
              <p className={`text-xs max-w-xs mx-auto ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Não encontramos resultados para "{searchQuery}". Tente pesquisar por clássico, aventura, fondue ou romance.
              </p>
            </div>
          ) : (
            <div className="space-y-4 px-6 sm:px-7">
              <div className="flex items-center justify-between">
                <p className={`text-[13px] font-semibold uppercase tracking-wider ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}>
                  Resultados ({filteredItineraries.length})
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`text-xs font-semibold underline cursor-pointer ${
                    isDark ? 'text-white/80 hover:text-white' : 'text-zinc-700 hover:text-black'
                  }`}
                >
                  Limpar busca
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5">
                {filteredItineraries.map((itin) => (
                  <AirbnbItineraryCardItem
                    key={itin.id}
                    itinerary={itin}
                    isFavorite={favorites.includes(itin.id)}
                    onToggleFavorite={(e) => handleToggleFavorite(itin.id, e)}
                    onClick={() => handleOpenDetail(itin)}
                    isActiveRoute={itin.id === activeItineraryId}
                    isDark={isDark}
                  />
                ))}
              </div>
            </div>
          )
        ) : selectedCategory !== 'all' ? (
          /* Filtered Category Carousel (2 cards per line, horizontal scroll) */
          filteredItineraries.length === 0 ? (
            <div className={`text-center py-20 px-6 space-y-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              <Compass className="w-10 h-10 mx-auto mb-2 opacity-50 stroke-[1.8]" />
              <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Nenhum roteiro nesta categoria
              </p>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`text-xs font-semibold underline cursor-pointer pt-1 ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                Ver todos os roteiros
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-4">
                <div>
                  <h3 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {curatedCategories.find((c) => c.id === selectedCategory)?.name || 'Roteiros'}
                  </h3>
                  <p className={`text-[13px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {filteredItineraries.length}{' '}
                    {filteredItineraries.length === 1 ? 'roteiro disponível' : 'roteiros disponíveis'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {filteredItineraries.length > 2 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => scrollCarousel(selectedCategory, 'left')}
                        disabled={!scrollPositions[selectedCategory]?.canLeft}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          scrollPositions[selectedCategory]?.canLeft
                            ? isDark
                              ? 'bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer'
                              : 'bg-zinc-200 text-black hover:bg-zinc-300 cursor-pointer'
                            : 'opacity-20 cursor-not-allowed text-zinc-500'
                        }`}
                        aria-label="Roteiro anterior"
                      >
                        <ChevronLeft
                          className={`w-4 h-4 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                          style={{ color: isDark ? '#ffffff' : '#000000' }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollCarousel(selectedCategory, 'right')}
                        disabled={scrollPositions[selectedCategory]?.canRight === false}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          scrollPositions[selectedCategory]?.canRight !== false
                            ? isDark
                              ? 'bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer'
                              : 'bg-zinc-200 text-black hover:bg-zinc-300 cursor-pointer'
                            : 'opacity-20 cursor-not-allowed text-zinc-500'
                        }`}
                        aria-label="Próximo roteiro"
                      >
                        <ChevronRight
                          className={`w-4 h-4 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                          style={{ color: isDark ? '#ffffff' : '#000000' }}
                        />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`text-xs font-semibold underline cursor-pointer ${
                      isDark ? 'text-white/80 hover:text-white' : 'text-zinc-700 hover:text-black'
                    }`}
                  >
                    Mostrar todos
                  </button>
                </div>
              </div>

              {/* Horizontal Carousel: Exactly TWO cards visible per line (+3% width & photo size) */}
              <div className="w-full">
                <div
                  ref={(el) => {
                    carouselRefs.current[selectedCategory] = el;
                  }}
                  onScroll={() => updateScrollState(selectedCategory)}
                  className="flex gap-3 overflow-x-auto no-scrollbar pb-1 scroll-smooth"
                  style={{
                    touchAction: 'pan-x pan-y',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {filteredItineraries.map((itin) => (
                    <div
                      key={itin.id}
                      className="shrink-0"
                      style={{
                        width: 'calc((100% - 12px) / 2)',
                        minWidth: 'calc((100% - 12px) / 2)',
                        touchAction: 'pan-x pan-y',
                      }}
                    >
                      <AirbnbItineraryCardItem
                        itinerary={itin}
                        isFavorite={favorites.includes(itin.id)}
                        onToggleFavorite={(e) => handleToggleFavorite(itin.id, e)}
                        onClick={() => handleOpenDetail(itin)}
                        isActiveRoute={itin.id === activeItineraryId}
                        isDark={isDark}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          /* Default Airbnb Sections with Standard Horizontal Carousels: EXACTLY TWO CARDS PER LINE */
          sections.map((section) => (
            <section key={section.id} className="space-y-2.5">
              {/* Section Header: Title & Navigation Controls */}
              <div className="flex items-center justify-between px-4">
                <h3 className={`text-[17px] sm:text-[18px] font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}>
                  {section.title}
                </h3>
                {section.items.length > 2 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollCarousel(section.id, 'left')}
                      disabled={!scrollPositions[section.id]?.canLeft}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        scrollPositions[section.id]?.canLeft
                          ? isDark
                            ? 'bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer'
                            : 'bg-zinc-200 text-black hover:bg-zinc-300 cursor-pointer'
                          : 'opacity-20 cursor-not-allowed text-zinc-500'
                      }`}
                      aria-label="Roteiro anterior"
                    >
                      <ChevronLeft
                        className={`w-4 h-4 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCarousel(section.id, 'right')}
                      disabled={scrollPositions[section.id]?.canRight === false}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        scrollPositions[section.id]?.canRight !== false
                          ? isDark
                            ? 'bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer'
                            : 'bg-zinc-200 text-black hover:bg-zinc-300 cursor-pointer'
                          : 'opacity-20 cursor-not-allowed text-zinc-500'
                      }`}
                      aria-label="Próximo roteiro"
                    >
                      <ChevronRight
                        className={`w-4 h-4 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Horizontal Carousel: EXACTLY TWO cards visible per line, third card 100% off-screen */}
              <div className="w-full">
                <div
                  ref={(el) => {
                    carouselRefs.current[section.id] = el;
                  }}
                  onScroll={() => updateScrollState(section.id)}
                  className="flex gap-3 overflow-x-auto no-scrollbar pb-1 scroll-smooth px-6 sm:px-7"
                  style={{
                    touchAction: 'pan-x pan-y',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {section.items.map((itin) => (
                    <div
                      key={itin.id}
                      className="shrink-0"
                      style={{
                        width: 'calc((100% - 12px) / 2)',
                        minWidth: 'calc((100% - 12px) / 2)',
                        touchAction: 'pan-x pan-y',
                      }}
                    >
                      <AirbnbItineraryCardItem
                        itinerary={itin}
                        isFavorite={favorites.includes(itin.id)}
                        onToggleFavorite={(e) => handleToggleFavorite(itin.id, e)}
                        onClick={() => handleOpenDetail(itin)}
                        isActiveRoute={itin.id === activeItineraryId}
                        isDark={isDark}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))
        )}
      </div>

      {/* Note: The floating map button has been removed as requested. The map opens when the user chooses an itinerary. */}

      {/* Itinerary Details Modal */}
      <ItineraryStoreDetailModal
        itinerary={selectedItinerary}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onApplyItinerary={handleApplyFromDetail}
        theme={theme}
      />
    </div>
  );
};

// =====================================================================
// SINGLE REUSABLE AIRBNB ITINERARY CARD COMPONENT FOR ALL SECTIONS
// Proportions strictly matching Image 2 reference:
// - 1:1 aspect-ratio square photo (aspect-square)
// - 20-24px rounded corners directly on image (rounded-[22px])
// - Heart icon at top-right
// - Small discreet badge at top-left
// - Pagination dots at bottom center
// - Information compactly arranged below the image:
//   Line 1: Title (15-17px, semibold) + Rating (★ 4.9x)
//   Line 2: Days · Stops (13-14px)
//   Line 3: Short description (up to 2 lines)
//   Line 4: Price / Access / Elite indication (13.5-14px)
// =====================================================================
interface AirbnbItineraryCardItemProps {
  itinerary: Itinerary;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
  isActiveRoute?: boolean;
  isDark?: boolean;
}

const AirbnbItineraryCardItem: React.FC<AirbnbItineraryCardItemProps> = ({
  itinerary,
  isFavorite,
  onToggleFavorite,
  onClick,
  isActiveRoute = false,
  isDark = true,
}) => {
  const isEliteGold = Boolean(itinerary.isPremium || (itinerary as any).isGold);

  // Deterministic mock rating between 4.88 and 4.98
  const rating = useMemo(() => {
    const hash = (itinerary.id || itinerary.title)
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (4.88 + (hash % 11) * 0.01).toFixed(2);
  }, [itinerary.id, itinerary.title]);

  return (
    <div
      onClick={onClick}
      style={{ touchAction: 'pan-x pan-y' }}
      className="group flex flex-col cursor-pointer select-none transition-transform duration-200 active:scale-[0.98]"
    >
      {/* 1. PHOTOGRAPH: +3% Size with 23px Rounded Corners Directly on Image */}
      <div 
        style={{ touchAction: 'pan-x pan-y' }}
        className={`relative w-full aspect-[1.05/1.12] rounded-[23px] overflow-hidden shadow-xs shrink-0 ${
          isDark ? 'bg-zinc-900' : 'bg-zinc-100'
        }`}
      >
        <img
          src={itinerary.coverImage}
          alt={itinerary.title}
          draggable={false}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 pointer-events-none select-none"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
          }}
        />

        {/* Top-Right Heart Button */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className="absolute top-2.5 right-2.5 w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-90 cursor-pointer z-10"
          title={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        >
          <Heart
            className={`w-6 h-6 ${
              isFavorite
                ? 'fill-rose-500 text-rose-500 stroke-[2]'
                : 'fill-black/35 text-white stroke-[2]'
            }`}
          />
        </button>

        {/* Top-Left Discreet Badge */}
        {isActiveRoute ? (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white text-zinc-950 text-[9px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1">
            <Check className="w-2.5 h-2.5 stroke-[3] text-zinc-950" />
            <span>ATIVO</span>
          </div>
        ) : isEliteGold ? (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/95 text-zinc-900 text-[9.5px] font-bold shadow-xs flex items-center gap-1">
            <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
            <span>Elite Gold</span>
          </div>
        ) : itinerary.isFeatured || (itinerary.badgeText && itinerary.badgeText.toLowerCase() === 'destaque') ? (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/95 text-zinc-900 text-[9.5px] font-bold shadow-xs">
            Livre
          </div>
        ) : null}

        {/* Pagination Dots at Bottom Center */}
        <div className="absolute bottom-2 inset-x-0 flex justify-center items-center gap-1 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
          <div className="w-1 h-1 rounded-full bg-white/60 shadow-xs" />
          <div className="w-1 h-1 rounded-full bg-white/40 shadow-xs" />
        </div>
      </div>

      {/* 2. INFORMAÇÕES DIRETAMENTE ABAIXO DA IMAGEM (Apenas Nome, Estrelas e Preço/Elite) */}
      <div className="pt-2 px-0.5 flex flex-col">
        {/* Linha 1: Nome do Roteiro à Esquerda + Símbolo e Quantidade de Estrelas à Direita */}
        <div className="flex items-start justify-between gap-1.5">
          <h4 className={`text-[14px] sm:text-[15px] font-semibold tracking-tight truncate leading-tight flex-1 min-w-0 transition-colors ${
            isDark ? 'text-white group-hover:text-zinc-200' : 'text-zinc-900 group-hover:text-zinc-700'
          }`}>
            {itinerary.title}
          </h4>
          <div className={`flex items-center gap-1 shrink-0 text-[12px] sm:text-[12.5px] font-semibold ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            <Star className={`w-3.5 h-3.5 shrink-0 ${
              isDark ? 'fill-white text-white' : 'fill-zinc-900 text-zinc-900'
            }`} />
            <span>{rating}</span>
          </div>
        </div>

        {/* Linha 2: Preço / Acesso Livre ou Elite Gold */}
        <p className={`text-[12.5px] sm:text-[13px] font-semibold mt-1 leading-tight flex items-center gap-1.5 ${
          isDark ? 'text-white' : 'text-zinc-900'
        }`}>
          {isEliteGold ? (
            <span className={isDark ? 'text-white font-semibold' : 'text-zinc-900 font-semibold'}>
              Incluso no Elite
            </span>
          ) : (
            <>
              <span className={isDark ? 'text-white font-semibold' : 'text-zinc-900 font-semibold'}>
                R$ 0
              </span>
              <span className={`text-[11.5px] sm:text-[12px] font-normal ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                acesso livre
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
