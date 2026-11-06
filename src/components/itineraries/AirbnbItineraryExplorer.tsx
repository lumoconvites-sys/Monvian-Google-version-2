import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ArrowLeft,
  Heart,
  Compass,
  X,
  Check,
  ArrowRight,
  MapPin,
  RotateCcw,
  AlertCircle,
  Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, ItineraryCategory } from '../../types';
import { ItineraryStoreDetailModal } from './ItineraryStoreDetailModal';
import { preloadImage } from '../../utils/preloadItineraries';
import {
  fetchItinerariesFromSupabase,
  fetchPaginatedItinerariesFromSupabase,
  fetchItineraryCategoriesFromSupabase,
  subscribeToItinerariesChanges,
  clearItinerariesPageCache,
  matchesItineraryFilter,
} from '../../services/supabaseItineraries';
import { useFavorites } from '../../hooks/useFavorites';
import { DEFAULT_CURATED_ITINERARIES } from '../../data/defaultItineraries';
import { triggerHapticFeedback } from '../../utils/haptics';

// Fast in-memory cache for categories
let memoryCategoriesCache: ItineraryCategory[] | null = null;
const CACHE_KEY_CATS = 'monvian_itinerary_categories_cache_v6';

function getKnownItinerariesPool(): Itinerary[] {
  try {
    const cached =
      localStorage.getItem('monvian_cached_itineraries') ||
      localStorage.getItem('monvian_itineraries_cache');
    if (cached) {
      const parsed: Itinerary[] = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingIds = new Set(parsed.map((i) => i.id));
        const merged = [...parsed];
        for (const def of DEFAULT_CURATED_ITINERARIES) {
          if (!existingIds.has(def.id)) {
            merged.push(def);
          }
        }
        return merged;
      }
    }
  } catch {}
  return DEFAULT_CURATED_ITINERARIES;
}

export function formatItineraryViewsCount(idOrTitle: string): string {
  const hash = (idOrTitle || 'itin')
    .split('')
    .reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1) * 31, 0);
  // deterministic value between 5,000 and 13,000 (5k a 13k plays)
  const views = 5000 + (Math.abs(hash) % 8001);
  if (views >= 10000) {
    const k = (views / 1000).toFixed(1).replace('.0', '');
    return `${k} mil`;
  }
  const k = (views / 1000).toFixed(1).replace('.0', '');
  return `${k} mil`;
}

export function getItinerariesForCategory(
  category: string,
  durationFilter: 'all' | '1day' | 'multiday' | 'free' = 'all',
  searchQuery = ''
): { featured: Itinerary | null; list: Itinerary[] } {
  const pool = getKnownItinerariesPool().filter((i) => i.isActive !== false);
  const matching = pool.filter((i) =>
    matchesItineraryFilter(i, category, durationFilter, searchQuery)
  );

  if (matching.length === 0) {
    return { featured: null, list: [] };
  }

  // Pick the featured banner for this category:
  // For 'all' or 'destaque', prioritize isFeatured || isRecommended
  let featured: Itinerary | null = null;
  if (!searchQuery) {
    const topFeat = matching.find((i) => i.isFeatured || i.isRecommended);
    featured = topFeat || matching[0] || null;
  }

  const list = featured
    ? matching.filter((i) => i.id !== featured!.id)
    : matching;

  return {
    featured,
    list: list.slice(0, 6),
  };
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

/**
 * Computes optimal batch size based on available viewport dimensions
 * so only visible content + a small scroll margin is loaded initially.
 */
function computeOptimalBatchSize(isInitialLoad: boolean): number {
  if (typeof window === 'undefined') return 3;
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Desktop 3-column grid
  if (width >= 1024) {
    return isInitialLoad ? 6 : 6;
  }
  // Tablet 2-column grid
  if (width >= 640) {
    return isInitialLoad ? 4 : 4;
  }
  // Mobile single-column: each card is ~245px tall; header+search+categories+featured ~410px
  if (isInitialLoad) {
    if (height < 740) return 2;
    if (height < 900) return 3;
    return 4;
  }
  return 3;
}

export interface AirbnbItineraryExplorerProps {
  onSelectItinerary: (
    itinerary: Itinerary,
    options?: { fromOnboardingSelection?: boolean }
  ) => Promise<void> | void;
  onOpenMap?: () => void;
  theme?: 'dark' | 'light';
  activeItineraryId?: string | null;
  isOnboardingSelection?: boolean;
  isOnboardingRevealReady?: boolean;
}

interface PhotoCategoryItem {
  id: string;
  name: string;
  image: string;
  fallbackImage: string;
}

// Photographic Category Thumbnail Item (matching reference phone 1)
const CategoryPhotoThumbnail: React.FC<{
  cat: PhotoCategoryItem;
  isSelected: boolean;
  isDark: boolean;
  onClick: (e: React.MouseEvent) => void;
}> = React.memo(({ cat, isSelected, isDark, onClick }) => {
  const [imgSrc, setImgSrc] = useState(cat.image);

  useEffect(() => {
    setImgSrc(cat.image);
  }, [cat.image]);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'pan-x',
      }}
      className="group w-[calc((100%-36px)/4)] shrink-0 snap-start flex flex-col items-center py-2 cursor-pointer select-none focus:outline-none active:scale-95 transition-transform duration-150"
    >
      <div
        className={`flex flex-col items-center transition-all duration-300 ease-out origin-center ${
          isSelected
            ? 'scale-[1.15] opacity-100'
            : 'scale-100 opacity-75 group-hover:opacity-100'
        }`}
      >
        {/* Category Icon without border/background wrapper */}
        <div className="p-[2.5px] rounded-[18px]">
          <div className="w-[64px] h-[64px] sm:w-[68px] sm:h-[68px] rounded-[14px] relative flex items-center justify-center">
            <img
              src={imgSrc}
              alt={cat.name}
              loading="eager"
              decoding="async"
              onError={() => {
                if (imgSrc !== cat.fallbackImage) {
                  setImgSrc(cat.fallbackImage);
                }
              }}
              className="w-full h-full object-contain pointer-events-none select-none drop-shadow-xs"
            />
          </div>
        </div>

        {/* Short Category Label Below */}
        <span
          style={{ paddingLeft: '5px', paddingBottom: '5px', paddingTop: '6px' }}
          className={`mt-1.5 text-[11.5px] tracking-tight leading-tight whitespace-nowrap transition-colors duration-200 ${
            isSelected
              ? isDark
                ? 'font-bold text-white'
                : 'font-bold text-zinc-900'
              : isDark
                ? 'font-medium text-zinc-400 group-hover:text-zinc-200'
                : 'font-medium text-zinc-500 group-hover:text-zinc-800'
          }`}
        >
          {cat.name}
        </span>
      </div>
    </button>
  );
});

interface FeaturedItineraryBannerProps {
  itinerary: Itinerary;
  category: string;
  isDark: boolean;
  isFavorite: boolean;
  stopsCount: number;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onOpenDetail: (itin: Itinerary) => void;
}

const FeaturedItineraryBanner: React.FC<FeaturedItineraryBannerProps> = ({
  itinerary,
  category,
  isDark,
  isFavorite,
  stopsCount,
  onToggleFavorite,
  onOpenDetail,
}) => {
  const [imgSrc, setImgSrc] = useState(itinerary.coverImage);
  const [hatTapCount, setHatTapCount] = useState(0);

  useEffect(() => {
    setImgSrc(itinerary.coverImage);
  }, [itinerary.coverImage]);

  return (
    <div
      className="px-5"
      style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
    >
      <motion.div
        key={`featured-${itinerary.id}-${category}`}
        initial={{ opacity: 0, filter: 'blur(14px)', y: 22, scale: 0.985 }}
        animate={{ opacity: 1, filter: 'blur(0px)', y: 0, scale: 1 }}
        transition={{
          duration: 0.9,
          ease: [0.16, 1, 0.3, 1],
          delay: 0.04,
        }}
        style={{
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          willChange: 'transform, opacity, filter',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
        onClick={() => onOpenDetail(itinerary)}
        className="group relative w-full h-[220px] sm:h-[240px] cursor-pointer select-none"
      >
        {/* Touca de Natal exclusiva do Roteiro em Destaque com animação de entrada e interação ao toque */}
        <motion.img
          key={`hat-${itinerary.id}-${category}-${hatTapCount}`}
          src="/assets/aistudio/IMG_9114_2aef8105.png"
          alt="Gorro de Natal"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            triggerHapticFeedback(15);
            setHatTapCount((prev) => prev + 1);
          }}
          initial={
            hatTapCount === 0
              ? { opacity: 0, x: -16, y: -32, scale: 0.55, rotate: -52 }
              : { opacity: 1, x: 0, y: 0, scale: 1, rotate: -28 }
          }
          animate={
            hatTapCount === 0
              ? {
                  opacity: 1,
                  x: 0,
                  y: [null, 3, -2, 0],
                  scale: [null, 1.08, 0.97, 1],
                  rotate: [null, -20, -32, -28],
                }
              : {
                  opacity: 1,
                  x: [0, -3, 3, -1, 0],
                  y: [0, -10, 2, -3, 0],
                  scale: [1, 1.18, 0.93, 1.05, 1],
                  rotate: [-28, -12, -38, -22, -28],
                }
          }
          transition={
            hatTapCount === 0
              ? {
                  duration: 0.72,
                  delay: 0.16,
                  ease: [0.22, 1, 0.36, 1],
                }
              : {
                  duration: 0.52,
                  ease: [0.22, 1, 0.36, 1],
                }
          }
          whileHover={{ scale: 1.08, rotate: -22 }}
          whileTap={{ scale: 0.9, rotate: -36 }}
          style={{
            transformOrigin: '55% 75%',
            WebkitTapHighlightColor: 'transparent',
          }}
          className="absolute -top-[28px] -left-[10px] w-[70px] h-[60px] object-contain pointer-events-auto cursor-pointer select-none z-30 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
        />

        <div
          className={`relative w-full h-full rounded-[34px] overflow-hidden shadow-md border backdrop-blur-md ${
            isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-200 border-black/5'
          }`}
        >
          <img
            src={imgSrc}
            alt={itinerary.title}
            loading="eager"
            decoding="async"
            onError={() => {
              if (imgSrc !== '/placeholder.jpg') {
                setImgSrc('/placeholder.jpg');
              }
            }}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />

          {/* Discreet Dark Gradient Overlay on Left & Bottom for Text Legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/15 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5 pointer-events-none" />

          {/* Banner Content Aligned Left */}
          <div className="relative z-10 h-full p-5 flex flex-col justify-between items-start">
            {/* Top Row: Highlight Badge + Heart Button */}
            <div className="w-full flex items-center justify-between">
              <span className="ml-[2px] mt-[7px] pt-[10px] text-white font-bold uppercase tracking-widest text-[11px] drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.8)] leading-none">
                {itinerary.isFeatured ? 'Destaque' : 'Recomendado'}
              </span>

              {/* Heart Favorite Button */}
              <button
                type="button"
                onClick={onToggleFavorite}
                className="w-9 h-9 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 cursor-pointer"
                title={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
              >
                <Heart
                  className={`w-8 h-8 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] stroke-none ${
                    isFavorite
                      ? 'fill-rose-500 text-rose-500'
                      : 'fill-white/90 text-white/90'
                  }`}
                />
              </button>
            </div>

            {/* Middle Title & Summary + Bottom CTA Button & 5 Stars */}
            <div className="w-full">
              <div className="max-w-[88%] sm:max-w-[78%]">
                <h2 className="text-[19px] sm:text-[22px] font-bold text-white leading-tight tracking-tight line-clamp-2 drop-shadow-sm">
                  {itinerary.title}
                </h2>
                <p className="text-[11.5px] sm:text-[12.5px] text-white/85 font-medium line-clamp-1 mt-1 drop-shadow-xs">
                  {itinerary.daysCount} {itinerary.daysCount === 1 ? 'dia' : 'dias'}
                  {stopsCount > 0 ? ` · ${stopsCount} paradas` : ''} ·{' '}
                  {itinerary.description}
                </p>
              </div>

              {/* Bottom Row: CTA Button */}
              <div className="mt-3 w-full flex items-center justify-between gap-2">
                <span className="px-4 py-2 rounded-full expo-liquid-glass-btn expo-liquid-glass-clear text-white text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all shrink-0">
                  <span>Ver roteiro</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.4]" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const AirbnbItineraryExplorer: React.FC<AirbnbItineraryExplorerProps> = ({
  onSelectItinerary,
  onOpenMap,
  theme = 'dark',
  activeItineraryId,
  isOnboardingSelection = false,
  isOnboardingRevealReady = true,
}) => {
  const initialItinerariesData = useMemo(() => getItinerariesForCategory('all', 'all', ''), []);
  const [itineraries, setItineraries] = useState<Itinerary[]>(initialItinerariesData.list);
  const [featuredBannerItinerary, setFeaturedBannerItinerary] = useState<Itinerary | null>(initialItinerariesData.featured);
  const [categories, setCategories] = useState<ItineraryCategory[]>(getInitialCategories);
  const [onboardingPool, setOnboardingPool] = useState<Itinerary[]>(() =>
    getKnownItinerariesPool().filter((i) => i.isActive !== false)
  );

  useEffect(() => {
    if (!isOnboardingSelection) return;
    let mounted = true;
    fetchItinerariesFromSupabase()
      .then((fetched) => {
        if (!mounted || !Array.isArray(fetched) || fetched.length === 0) return;
        const activeFetched = fetched.filter((i) => i.isActive !== false);
        const existingIds = new Set(activeFetched.map((i) => i.id));
        const combined = [...activeFetched];
        for (const def of DEFAULT_CURATED_ITINERARIES) {
          if (def.isActive !== false && !existingIds.has(def.id)) {
            combined.push(def);
          }
        }
        setOnboardingPool(combined);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isOnboardingSelection]);

  // Progressive pagination states - starts false because initial cache/defaults are hydrated instantly
  const [loading, setLoading] = useState<boolean>(false);
  const isFirstMountRef = useRef<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [totalMatching, setTotalMatching] = useState<number | undefined>(undefined);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<'all' | '1day' | 'multiday' | 'free'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAllItineraries, setShowAllItineraries] = useState(false);
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { savedItineraries: favorites, toggleItinerary } = useFavorites();

  const [isCategorySwitching, setIsCategorySwitching] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categorySwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination cursor/offset & concurrency refs
  const nextCursorRef = useRef<string | null>(null);
  const nextOffsetRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const queryGenerationRef = useRef<number>(0);
  const featuredIdRef = useRef<string | null>(null);

  // Debounce search input (240ms) to avoid firing DB queries on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 240);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectCategory = useCallback((catId: string) => {
    if (catId === selectedCategory) return;
    if (categorySwitchTimerRef.current) {
      clearTimeout(categorySwitchTimerRef.current);
    }
    setIsCategorySwitching(true);
    setSelectedCategory(catId);

    // INSTANT (0ms) SYNCHRONOUS HYDRATION:
    // Update both featured banner and itineraries immediately for this specific category.
    // This physically prevents any flash of cards or banners from other categories!
    const localData = getItinerariesForCategory(catId, durationFilter, debouncedSearchQuery);
    setFeaturedBannerItinerary(localData.featured);
    featuredIdRef.current = localData.featured?.id || null;
    setItineraries(localData.list);

    categorySwitchTimerRef.current = setTimeout(() => {
      setIsCategorySwitching(false);
    }, 240);
  }, [selectedCategory, durationFilter, debouncedSearchQuery]);

  useEffect(() => {
    return () => {
      if (categorySwitchTimerRef.current) {
        clearTimeout(categorySwitchTimerRef.current);
      }
    };
  }, []);

  // Close all open modals when user clicks any navigation tab
  useEffect(() => {
    const handleCloseAll = () => {
      setIsDetailOpen(false);
      setSelectedItinerary(null);
      setIsFilterOpen(false);
    };
    window.addEventListener('monvian-close-modals', handleCloseAll);
    return () => {
      window.removeEventListener('monvian-close-modals', handleCloseAll);
    };
  }, []);

  // Toggle favorite (synced with global Salvos -> Roteiros salvos)
  const handleToggleFavorite = useCallback((itinId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleItinerary(itinId);
  }, [toggleItinerary]);

  // Load categories once in background
  useEffect(() => {
    let mounted = true;
    fetchItineraryCategoriesFromSupabase()
      .then((catsData) => {
        if (!mounted) return;
        if (Array.isArray(catsData) && catsData.length > 0) {
          setCategories(catsData);
          memoryCategoriesCache = catsData;
          try {
            localStorage.setItem(CACHE_KEY_CATS, JSON.stringify(catsData));
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Load initial page of itineraries whenever filter/category/search changes
  const loadInitialBatch = useCallback(
    async (options?: { silent?: boolean; forceRefresh?: boolean }) => {
      const currentGen = ++queryGenerationRef.current;
      isFetchingRef.current = true;

      if (!options?.silent) {
        setLoading(true);
      }
      setInitialError(null);
      setLoadMoreError(null);
      setLoadingMore(false);

      const initialBatchSize = computeOptimalBatchSize(true);
      const shouldIncludeFeatured = !debouncedSearchQuery;

      try {
        const result = await fetchPaginatedItinerariesFromSupabase({
          limit: initialBatchSize,
          cursor: null,
          offset: 0,
          category: selectedCategory,
          durationFilter,
          searchQuery: debouncedSearchQuery,
          includeFeaturedBanner: shouldIncludeFeatured,
          forceRefresh: options?.forceRefresh,
        });

        // Ignore stale response if user switched category/search while request was in flight
        if (currentGen !== queryGenerationRef.current) return;

        // Double check that featuredItinerary strictly belongs to this selectedCategory
        let validatedFeatured = result.featuredItinerary || null;
        if (
          validatedFeatured &&
          !matchesItineraryFilter(validatedFeatured, selectedCategory, durationFilter, debouncedSearchQuery)
        ) {
          validatedFeatured = null;
        }

        // Strictly filter itineraries to guarantee zero cross-category contamination
        const validatedItineraries = (result.itineraries || []).filter((item) =>
          matchesItineraryFilter(item, selectedCategory, durationFilter, debouncedSearchQuery)
        );

        setFeaturedBannerItinerary(validatedFeatured);
        featuredIdRef.current = validatedFeatured?.id || null;

        if (validatedFeatured?.coverImage) {
          preloadImage(validatedFeatured.coverImage, 'high');
        }

        setItineraries(validatedItineraries);
        setHasMore(result.hasMore);
        setTotalMatching(result.totalMatching);
        nextCursorRef.current = result.nextCursor;
        nextOffsetRef.current = result.nextOffset;
      } catch (err: any) {
        if (currentGen !== queryGenerationRef.current) return;
        console.warn('[Roteiros] Erro ao carregar lote inicial:', err);
        setInitialError('Não foi possível carregar os roteiros. Verifique sua conexão e tente novamente.');
      } finally {
        if (currentGen === queryGenerationRef.current) {
          setLoading(false);
          isFetchingRef.current = false;
        }
      }
    },
    [selectedCategory, durationFilter, debouncedSearchQuery]
  );

  // Trigger initial paginated load when category, duration, or debounced search changes
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      loadInitialBatch({ silent: true });
    } else {
      loadInitialBatch();
    }
  }, [loadInitialBatch]);

  // Subscribe to realtime / admin itinerary updates
  useEffect(() => {
    const unsubscribe = subscribeToItinerariesChanges(() => {
      clearItinerariesPageCache();
      loadInitialBatch({ silent: true, forceRefresh: true });
    });
    return () => unsubscribe();
  }, [loadInitialBatch]);

  // Load next batch of itineraries on scroll (Infinite Scroll)
  const loadMoreItineraries = useCallback(
    async (isManualRetry = false) => {
      if (isFetchingRef.current || loading || loadingMore || !hasMore) return;
      if (loadMoreError && !isManualRetry) return;

      const currentGen = queryGenerationRef.current;
      isFetchingRef.current = true;
      setLoadingMore(true);
      setLoadMoreError(null);

      const nextBatchSize = computeOptimalBatchSize(false);

      try {
        const excludeIds = featuredIdRef.current ? [featuredIdRef.current] : [];
        const result = await fetchPaginatedItinerariesFromSupabase({
          limit: nextBatchSize,
          cursor: nextCursorRef.current,
          offset: nextOffsetRef.current,
          category: selectedCategory,
          durationFilter,
          searchQuery: debouncedSearchQuery,
          excludeIds,
          includeFeaturedBanner: false,
        });

        // Ignore if filter changed while fetching
        if (currentGen !== queryGenerationRef.current) return;

        // Ensure newly fetched items strictly match the selected category
        const strictlyMatchingIncoming = (result.itineraries || []).filter((item) =>
          matchesItineraryFilter(item, selectedCategory, durationFilter, debouncedSearchQuery)
        );

        setItineraries((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          if (featuredIdRef.current) existingIds.add(featuredIdRef.current);
          const uniqueIncoming = strictlyMatchingIncoming.filter(
            (item) => !existingIds.has(item.id)
          );
          return uniqueIncoming.length > 0 ? [...prev, ...uniqueIncoming] : prev;
        });

        setHasMore(result.hasMore && strictlyMatchingIncoming.length > 0);
        nextCursorRef.current = result.nextCursor;
        nextOffsetRef.current = result.nextOffset;
      } catch (err: any) {
        if (currentGen !== queryGenerationRef.current) return;
        console.warn('[Roteiros] Erro ao carregar mais roteiros:', err);
        setLoadMoreError('Falha ao carregar mais roteiros.');
      } finally {
        if (currentGen === queryGenerationRef.current) {
          setLoadingMore(false);
          isFetchingRef.current = false;
        }
      }
    },
    [loading, loadingMore, hasMore, loadMoreError, selectedCategory, durationFilter, debouncedSearchQuery]
  );

  // IntersectionObserver for automatic Infinite Scroll when user nears bottom of loaded list
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const scrollRoot = scrollContainerRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && !isFetchingRef.current && !loadMoreError) {
          loadMoreItineraries(false);
        }
      },
      {
        root: scrollRoot || null,
        rootMargin: '0px 0px 340px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadMoreError, loadMoreItineraries, itineraries.length]);

  // Curated Categories using the original 3D icons at the exact same size as the mini photos
  const photoCategories = useMemo<PhotoCategoryItem[]>(() => {
    const base: PhotoCategoryItem[] = [
      {
        id: 'all',
        name: 'Todos',
        image: '/foguinho.png',
        fallbackImage: '/foguinho.png',
      },
      {
        id: 'destaque',
        name: 'Destaques',
        image: '/star.png',
        fallbackImage: '/star.png',
      },
      {
        id: 'natureza',
        name: 'Natureza',
        image: '/natureza.png',
        fallbackImage: '/natureza.png',
      },
      {
        id: 'romantico',
        name: 'Romântico',
        image: '/romantic.png',
        fallbackImage: '/romantic.png',
      },
      {
        id: 'gastronomia',
        name: 'Gastronomia',
        image: '/gastrom.png',
        fallbackImage: '/gastrom.png',
      },
      {
        id: 'aventura',
        name: 'Aventura',
        image: '/aventure.png',
        fallbackImage: '/aventure.png',
      },
      {
        id: 'familia',
        name: 'Família',
        image: '/family.png',
        fallbackImage: '/family.png',
      },
      {
        id: 'terror',
        name: 'Terror',
        image: '/terror.png',
        fallbackImage: '/terror.png',
      },
    ];

    const aliasMap: Record<string, string> = {
      popular: 'destaque',
      nature: 'natureza',
      romantic: 'romantico',
      casais: 'romantico',
      gastronomy: 'gastronomia',
      adventure: 'aventura',
      family: 'familia',
    };

    const dynamicIconMap: Record<string, string> = {
      cafes: '/cafe.png',
      cafe: '/cafe.png',
      doces: '/doce.png',
      sweets: '/doce.png',
      atracoes: '/atracoes.png',
      attractions: '/atracoes.png',
      parks: '/natureza.png',
      parques: '/natureza.png',
      hotel: '/hotel.png',
      restaurante: '/restaurante.png',
    };

    // Preserve any additional dynamic categories registered in Supabase without duplicating base ones
    const existingIds = new Set(base.map((b) => b.id.toLowerCase()));
    const existingNames = new Set(base.map((b) => b.name.toLowerCase()));

    categories.forEach((dynCat) => {
      const rawId = (dynCat.id || dynCat.name || '').toLowerCase().trim();
      const cleanId = aliasMap[rawId] || rawId;
      const cleanName = (dynCat.name || '').toLowerCase().trim();
      if (cleanId === '1day' || cleanId === '2days') return;
      if (cleanId && !existingIds.has(cleanId) && !existingNames.has(cleanName)) {
        existingIds.add(cleanId);
        if (cleanName) existingNames.add(cleanName);
        const iconPath = dynamicIconMap[cleanId] || '/lugares.png';
        base.push({
          id: cleanId,
          name: dynCat.name,
          image: iconPath,
          fallbackImage: '/foguinho.png',
        });
      }
    });

    return base;
  }, [categories]);

  // Strict Category-Guarded Featured Banner
  const validFeaturedBanner = useMemo(() => {
    if (!featuredBannerItinerary) return null;
    if (debouncedSearchQuery) return null;
    if (!matchesItineraryFilter(featuredBannerItinerary, selectedCategory, durationFilter, debouncedSearchQuery)) {
      return null;
    }
    return featuredBannerItinerary;
  }, [featuredBannerItinerary, selectedCategory, durationFilter, debouncedSearchQuery]);

  // Strict Category-Guarded Discovery Itineraries List for Section 5 ("Roteiros para descobrir")
  const displayItineraries = useMemo<Itinerary[]>(() => {
    return itineraries.filter((i) => {
      // Must strictly match active category filter
      if (!matchesItineraryFilter(i, selectedCategory, durationFilter, debouncedSearchQuery)) {
        return false;
      }
      if (
        validFeaturedBanner &&
        (i.id === validFeaturedBanner.id ||
          i.title.trim().toLowerCase() === validFeaturedBanner.title.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [itineraries, validFeaturedBanner, selectedCategory, durationFilter, debouncedSearchQuery]);

  const handleOpenDetail = useCallback((itin: Itinerary) => {
    setSelectedItinerary(itin);
    setIsDetailOpen(true);
  }, []);

  const handleApplyFromDetail = useCallback(
    async (itin: Itinerary) => {
      setIsDetailOpen(false);
      await onSelectItinerary(itin);
    },
    [onSelectItinerary]
  );

  const isDark = theme === 'dark';

  const featuredStopsCount = useMemo(() => {
    if (!validFeaturedBanner?.days) return 0;
    return validFeaturedBanner.days.reduce(
      (acc, d) => acc + (d.steps?.length || 0),
      0
    );
  }, [validFeaturedBanner]);

  const onboardingAllItineraries = useMemo<Itinerary[]>(() => {
    const map = new Map<string, Itinerary>();
    for (const item of onboardingPool) {
      if (item.isActive !== false && !map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    if (featuredBannerItinerary && featuredBannerItinerary.isActive !== false && !map.has(featuredBannerItinerary.id)) {
      map.set(featuredBannerItinerary.id, featuredBannerItinerary);
    }
    for (const item of itineraries) {
      if (item.isActive !== false && !map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    for (const def of DEFAULT_CURATED_ITINERARIES) {
      if (def.isActive !== false && !map.has(def.id)) {
        map.set(def.id, def);
      }
    }
    return Array.from(map.values());
  }, [onboardingPool, featuredBannerItinerary, itineraries]);

  if (isOnboardingSelection) {
    return (
      <motion.div
        id="onboarding-itinerary-selection-screen"
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={
          isOnboardingRevealReady
            ? { opacity: 1, filter: 'blur(0px)' }
            : { opacity: 0, filter: 'blur(8px)' }
        }
        transition={{
          duration: 0.65,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative w-full h-full overflow-y-auto overscroll-y-contain bg-[#FFFFFF] text-[#111111] select-none"
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div
          className="w-full max-w-2xl mx-auto px-6 pb-20"
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 32px), 48px)',
          }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            animate={
              isOnboardingRevealReady
                ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                : { opacity: 0, y: 8, filter: 'blur(6px)' }
            }
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.04,
            }}
            className="text-center text-[24px] sm:text-[28px] font-bold tracking-[-0.025em] text-[#111111] leading-tight mb-8"
          >
            Selecione o melhor roteiro
          </motion.h1>

          <div className="flex flex-col gap-7">
            {onboardingAllItineraries.map((itin, idx) => (
              <motion.div
                key={itin.id}
                onClick={() => {
                  triggerHapticFeedback(12);
                  onSelectItinerary(itin, { fromOnboardingSelection: true });
                }}
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                animate={
                  isOnboardingRevealReady
                    ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                    : { opacity: 0, y: 12, filter: 'blur(8px)' }
                }
                transition={{
                  duration: 0.65,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.1 + idx * 0.065,
                }}
                whileTap={{ scale: 0.985 }}
                className="group flex flex-col cursor-pointer select-none"
              >
                <div className="relative w-full h-[204px] sm:h-[228px] rounded-[34px] overflow-hidden bg-zinc-100 border border-black/[0.06]">
                  <img
                    src={itin.coverImage}
                    alt={itin.title}
                    width={800}
                    height={456}
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
                    }}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02] pointer-events-none select-none"
                  />
                </div>

                <div className="pt-3 px-1 flex items-center justify-between gap-3">
                  <h2 className="text-[16px] sm:text-[17px] font-semibold tracking-[-0.015em] text-[#111111] leading-snug truncate flex-1">
                    {itin.title}
                  </h2>
                  <div
                    className="flex items-center gap-1 shrink-0 text-[#111111]"
                    title={`${formatItineraryViewsCount(itin.id || itin.title)} visualizações`}
                  >
                    <Play className="w-3 h-3 fill-black text-black" />
                    <span className="text-[12px] font-semibold tracking-tight text-[#111111]">
                      {formatItineraryViewsCount(itin.id || itin.title)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      id="airbnb-itinerary-scroll-container"
      className={`relative w-full h-full overflow-y-auto overscroll-y-contain select-none transition-colors duration-200 rounded-t-[26px] ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-zinc-900'
      }`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        borderTopLeftRadius: '26px',
        borderTopRightRadius: '26px',
      }}
    >
      {/* =====================================================================
          1. CABEÇALHO COMPACTO + 2. BARRA DE PESQUISA + 3. CATEGORIAS FOTOGRÁFICAS
         ===================================================================== */}
      <div
        className={`relative shrink-0 transition-colors rounded-t-[26px] max-w-5xl mx-auto ${
          isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-zinc-900'
        }`}
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
        }}
      >
        {/* 1. CABEÇALHO COMPACTO */}
        <div className="px-5 pb-1 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {showAllItineraries && (
              <button
                type="button"
                onClick={() => setShowAllItineraries(false)}
                className="w-9 h-9 flex items-center justify-center text-white cursor-pointer active:scale-90 transition-transform bg-transparent border-none shadow-none outline-none"
                title="Voltar"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.4] text-white" />
              </button>
            )}
            <h1
              className={`text-[26px] sm:text-[28px] font-bold tracking-tight leading-none ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}
            >
              Roteiros
            </h1>
          </div>

          {/* Right Action: Play button with black background to open map */}
          <div className="flex items-center gap-2">
            {onOpenMap ? (
              <button
                type="button"
                onClick={onOpenMap}
                className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white cursor-pointer active:scale-90 transition-transform border border-white/10 shadow-none outline-none"
                title="Abrir roteiro no mapa"
                aria-label="Abrir roteiro no mapa"
              >
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* 2. BARRA DE PESQUISA */}
        <div className="px-5 pb-1" style={{ color: isDark ? '#ffffff' : '#000000', backgroundColor: isDark ? '#000000' : '#ffffff' }}>
          <div
            onClick={() => {
              setIsSearchFocused(true);
              setTimeout(() => searchInputRef.current?.focus(), 40);
            }}
            style={{ paddingLeft: '24px', marginLeft: '0px', marginTop: '19px', paddingTop: '4px', paddingRight: '10px', marginRight: '3px' }}
            className={`relative flex items-center justify-between w-full min-h-[48px] rounded-full px-4 py-1.5 transition-all expo-liquid-glass-bar cursor-pointer ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}
          >
            {/* Left: Magnifying Glass + Single-Line Text or Active Input */}
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
              <Search
                style={{ color: isDark ? '#a1a1aa' : '#797979' }}
                className={`w-[18px] h-[18px] shrink-0 stroke-[2.2] ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}
              />

              {!isSearchFocused && !searchQuery ? (
                <div className="flex items-center min-w-0 flex-1">
                  <span
                    style={{ color: isDark ? '#ffffff' : '#797979' }}
                    className={`text-[14px] font-semibold leading-tight truncate ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    Buscar roteiros
                  </span>
                </div>
              ) : (
                <div className="flex items-center w-full">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => {
                      if (!searchQuery) setIsSearchFocused(false);
                    }}
                    placeholder="Buscar roteiros, destinos ou experiências..."
                    className={`w-full bg-transparent text-[14px] font-medium outline-none leading-normal ${
                      isDark
                        ? 'text-white placeholder:text-zinc-500'
                        : 'text-zinc-900 placeholder:text-zinc-400'
                    }`}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Right: Clear Search Button when typing */}
            {searchQuery && (
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className={`w-7 h-7 rounded-full expo-liquid-glass-btn flex items-center justify-center transition-colors cursor-pointer ${
                    isDark ? 'text-zinc-300' : 'text-zinc-700'
                  }`}
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.4]" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. CATEGORIAS COM MINIATURAS FOTOGRÁFICAS (Carrossel com apenas 4 visíveis por vez) */}
        <div className="px-5" style={{ paddingLeft: '22px', paddingTop: '2px', paddingRight: '22px', paddingBottom: '4px', backgroundColor: isDark ? '#000000' : '#ffffff' }}>
          <div
            onScroll={(e) => {
              if (e.currentTarget.scrollTop !== 0) {
                e.currentTarget.scrollTop = 0;
              }
            }}
            className="flex items-center gap-3 overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth snap-x snap-mandatory"
            style={{
              touchAction: 'pan-x',
              overscrollBehaviorY: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {photoCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <CategoryPhotoThumbnail
                  key={cat.id}
                  cat={cat}
                  isSelected={isSelected}
                  isDark={isDark}
                  onClick={() => {
                    handleSelectCategory(cat.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          CONTEÚDO PRINCIPAL: BANNER DE DESTAQUE + ROTEIROS PARA DESCOBRIR
         ===================================================================== */}
      <div className="relative pt-3 pb-44 max-w-5xl mx-auto">
        <div
          style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
          className={`space-y-5 transition-all duration-300 ease-out ${
            isCategorySwitching
              ? 'opacity-40 blur-[1.5px] scale-[0.995] pointer-events-none'
              : 'opacity-100 blur-0 scale-100'
          }`}
        >
        {loading && displayItineraries.length === 0 && !validFeaturedBanner ? (
          /* Initial Progressive Loading State with Apple iOS Translucent Glass Frost Effect */
          <motion.div
            initial={{ opacity: 0, filter: 'blur(10px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="px-5 space-y-5"
            aria-busy="true"
            aria-live="polite"
          >
            {!debouncedSearchQuery && (
              <div
                className={`relative w-full h-[192px] sm:h-[216px] rounded-[28px] overflow-hidden backdrop-blur-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.25)] flex flex-col justify-end p-5 transition-colors ${
                  isDark
                    ? 'bg-white/[0.04] border-white/10'
                    : 'bg-black/[0.03] border-black/10'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/[0.03] pointer-events-none" />
                <div className="relative z-10 space-y-2">
                  <div className={`h-4 w-28 rounded-full animate-pulse ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
                  <div className={`h-6 w-3/4 rounded-xl animate-pulse ${isDark ? 'bg-white/20' : 'bg-black/15'}`} />
                  <div className={`h-3.5 w-1/2 rounded-full animate-pulse ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className={`h-4 w-40 rounded-full animate-pulse ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
              <div className="flex flex-col gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1].map((skeletonIdx) => (
                  <div key={skeletonIdx} className="flex flex-col gap-2.5">
                    <div
                      className={`w-full h-[182px] sm:h-[196px] rounded-[26px] overflow-hidden backdrop-blur-xl border shadow-xs flex flex-col justify-end p-4 transition-colors ${
                        isDark
                          ? 'bg-white/[0.03] border-white/[0.08]'
                          : 'bg-black/[0.025] border-black/10'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className={`h-3.5 w-20 rounded-full animate-pulse ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
                        <div className={`h-5 w-4/5 rounded-xl animate-pulse ${isDark ? 'bg-white/20' : 'bg-black/15'}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="py-2 flex items-center justify-center gap-2">
              <div
                className={`w-4 h-4 rounded-full border-2 border-t-transparent animate-spin ${
                  isDark ? 'border-white/70' : 'border-zinc-800'
                }`}
              />
              <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Carregando roteiros...
              </span>
            </div>
          </motion.div>
        ) : initialError && displayItineraries.length === 0 && !validFeaturedBanner ? (
          /* Initial Connection Error State */
          <div
            className={`text-center py-16 px-6 space-y-3 ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            <AlertCircle className="w-10 h-10 mx-auto mb-1 opacity-60 stroke-[1.8]" />
            <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Erro de conexão
            </p>
            <p className="text-xs max-w-xs mx-auto leading-relaxed">
              {initialError}
            </p>
            <button
              type="button"
              onClick={() => loadInitialBatch({ forceRefresh: true })}
              className={`mt-2 px-5 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs border ${
                isDark ? 'bg-white text-black border-transparent' : 'expo-liquid-glass-btn text-black border-black/5 hover:bg-zinc-50'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.2] text-current" />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : displayItineraries.length === 0 && !validFeaturedBanner ? (
          /* Empty State when search or filter matches 0 items */
          <div
            className={`text-center py-16 px-6 space-y-2.5 ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            <Compass className="w-10 h-10 mx-auto mb-1 opacity-50 stroke-[1.8]" />
            <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Nenhum roteiro encontrado
            </p>
            <p className="text-xs max-w-xs mx-auto">
              Não encontramos resultados para os filtros atuais. Tente buscar outro termo ou limpar os filtros.
            </p>
            <button
              type="button"
              onClick={() => {
                handleSelectCategory('all');
                setDurationFilter('all');
                setSearchQuery('');
              }}
              className={`mt-2 px-5 py-2.5 rounded-full text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-xs border ${
                isDark ? 'bg-white text-black border-transparent' : 'expo-liquid-glass-btn text-black border-black/5 hover:bg-zinc-50'
              }`}
            >
              Ver todos os roteiros
            </button>
          </div>
        ) : (
          <motion.div
            key={`itineraries-reveal-${selectedCategory}-${durationFilter}-${debouncedSearchQuery}`}
            initial={{ opacity: 0, filter: 'blur(14px)', y: 14 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{
              duration: 0.85,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              willChange: 'transform, opacity, filter',
            }}
            className="space-y-6"
          >
            {/* 4. ROTEIRO EM DESTAQUE — BANNER */}
            {validFeaturedBanner && (
              <FeaturedItineraryBanner
                itinerary={validFeaturedBanner}
                category={selectedCategory}
                isDark={isDark}
                isFavorite={favorites.includes(validFeaturedBanner.id)}
                stopsCount={featuredStopsCount}
                onToggleFavorite={(e) => handleToggleFavorite(validFeaturedBanner.id, e)}
                onOpenDetail={handleOpenDetail}
              />
            )}

            {/* 5. SEÇÃO DE ROTEIROS ABAIXO DO BANNER ("Roteiros para descobrir") */}
            {displayItineraries.length > 0 && (
              <section className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.75,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.12,
                  }}
                  className="px-5 flex items-center justify-between"
                >
                  <h3
                    className={`text-[18px] sm:text-[19px] font-bold tracking-tight ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    {debouncedSearchQuery
                      ? `Resultados (${totalMatching ?? displayItineraries.length})`
                      : selectedCategory !== 'all'
                        ? `Roteiros · ${photoCategories.find((c) => c.id === selectedCategory)?.name || 'Para descobrir'}`
                        : 'Roteiros para descobrir'}
                  </h3>
                </motion.div>

                {/* 6. CARDS FOTOGRÁFICOS DE ROTEIROS EM LISTA VERTICAL (Deslizar para baixo) */}
                <div className="px-5 flex flex-col gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3" style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}>
                  {displayItineraries.map((itin, idx) => (
                    <HorizontalReferenceItineraryCard
                      key={itin.id}
                      index={idx}
                      itinerary={itin}
                      isFavorite={favorites.includes(itin.id)}
                      onToggleFavorite={(e) => handleToggleFavorite(itin.id, e)}
                      onClick={() => handleOpenDetail(itin)}
                      isActiveRoute={itin.id === activeItineraryId}
                      isDark={isDark}
                    />
                  ))}
                </div>

                {/* 7. INFINITE SCROLL SENTINEL & PROGRESSIVE LOADING FOOTER STATES */}
                <div className="px-5 pt-2">
                  {/* Intersection Observer Sentinel */}
                  {hasMore && !loadMoreError && (
                    <div
                      ref={loadMoreSentinelRef}
                      className="w-full h-3 pointer-events-none"
                      aria-hidden="true"
                    />
                  )}

                  {/* Additional Batch Loading Indicator */}
                  {loadingMore && (
                    <div
                      className="py-4 flex items-center justify-center gap-2.5"
                      role="status"
                      aria-live="polite"
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 border-t-transparent animate-spin ${
                          isDark ? 'border-white/70' : 'border-zinc-800'
                        }`}
                      />
                      <span
                        className={`text-xs font-medium tracking-tight ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        Carregando mais roteiros...
                      </span>
                    </div>
                  )}

                  {/* Pagination Error State (preserves already loaded itineraries) */}
                  {loadMoreError && !loadingMore && (
                    <div
                      className={`my-2 p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-zinc-900/90 border-white/10 text-zinc-300'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span className="text-xs font-medium truncate">
                          {loadMoreError}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadMoreItineraries(true)}
                        className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs border ${
                          isDark
                            ? 'bg-white text-black hover:bg-zinc-200 border-transparent'
                            : 'expo-liquid-glass-btn text-black border-black/5 hover:bg-zinc-50'
                        }`}
                      >
                        <RotateCcw className="w-3 h-3 stroke-[2.2] text-current" />
                        <span>Tentar novamente</span>
                      </button>
                    </div>
                  )}

                </div>
              </section>
            )}
          </motion.div>
        )}
        </div>
      </div>

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
// HORIZONTAL PHOTOGRAPHIC ITINERARY CARD (Matching "This week's picks")
// =====================================================================
interface HorizontalReferenceItineraryCardProps {
  itinerary: Itinerary;
  index?: number;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
  isActiveRoute?: boolean;
  isDark?: boolean;
}

const HorizontalReferenceItineraryCard: React.FC<HorizontalReferenceItineraryCardProps> =
  React.memo(
    ({
      itinerary,
      index = 0,
      isFavorite,
      onToggleFavorite,
      onClick,
      isActiveRoute = false,
      isDark = true,
    }) => {
      // Deterministic rating between 4.88 and 4.98
      const rating = useMemo(() => {
        const hash = (itinerary.id || itinerary.title)
          .split('')
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return (4.88 + (hash % 11) * 0.01).toFixed(2);
      }, [itinerary.id, itinerary.title]);

      const stopsCount = useMemo(() => {
        if (!itinerary.days) return 0;
        return itinerary.days.reduce((acc, d) => acc + (d.steps?.length || 0), 0);
      }, [itinerary.days]);

      const [imageLoaded, setImageLoaded] = useState(false);

      return (
        <motion.div
          onClick={onClick}
          initial={{ opacity: 0, filter: 'blur(16px)', y: 22, scale: 0.985 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0, scale: 1 }}
          transition={{
            duration: 0.85,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.12 + Math.min((index % 6) * 0.09, 0.54),
          }}
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
            willChange: 'transform, opacity, filter',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
          whileTap={{ scale: 0.98 }}
          className="group flex flex-col cursor-pointer select-none"
        >
          {/* 1. HORIZONTAL RECTANGULAR PHOTOGRAPH (Proporção horizontal fiel à referência + Dimensões reservadas) */}
          <div
            className={`relative w-full h-[182px] sm:h-[196px] rounded-[34px] overflow-hidden shadow-xs border backdrop-blur-md ${
              isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-black/5'
            }`}
          >
            {/* Translucent glass shimmer before image resolves */}
            <div
              className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
                imageLoaded ? 'opacity-0' : 'opacity-100'
              } ${isDark ? 'bg-white/[0.04] backdrop-blur-md' : 'bg-black/[0.03] backdrop-blur-sm'}`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-white/[0.02] to-transparent" />
            </div>

            <img
              src={itinerary.coverImage}
              alt={itinerary.title}
              width={800}
              height={392}
              draggable={false}
              loading={index < 2 ? 'eager' : 'lazy'}
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                setImageLoaded(true);
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
              }}
              className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-103 pointer-events-none select-none ${
                imageLoaded ? 'opacity-100 filter-none' : 'opacity-0 filter blur-[8px]'
              }`}
            />

            {/* Active Route Indicator Only (no price badges) */}
            {isActiveRoute && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-zinc-900 text-[11px] font-semibold shadow-xs flex items-center gap-1 z-10">
                <Check className="w-3 h-3 stroke-[2.8] text-emerald-600" />
                <span>Roteiro ativo</span>
              </div>
            )}

            {/* Top-Right Favorite Heart Button on Image */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e);
              }}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 cursor-pointer z-10"
              title={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
            >
              <Heart
                className={`w-8 h-8 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] stroke-none ${
                  isFavorite
                    ? 'fill-rose-500 text-rose-500'
                    : 'fill-white/90 text-white/90'
                }`}
              />
            </button>
          </div>

          {/* 2. CARD DETAILS BELOW IMAGE */}
          <div className="pt-2.5 px-1 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <h4
                className={`text-[15px] font-bold tracking-tight truncate leading-snug flex-1 ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {itinerary.title}
              </h4>
              <div
                className="flex items-center gap-1 shrink-0 text-zinc-900 dark:text-zinc-100"
                title={`${formatItineraryViewsCount(itinerary.id || itinerary.title)} visualizações`}
              >
                <Play className="w-3 h-3 fill-black text-black dark:fill-white dark:text-white" />
                <span className="text-[12px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
                  {formatItineraryViewsCount(itinerary.id || itinerary.title)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p
                className={`text-[12px] font-medium truncate ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {itinerary.daysCount} {itinerary.daysCount === 1 ? 'dia' : 'dias'}
                {stopsCount > 0 ? ` · ${stopsCount} paradas` : ''} ·{' '}
                {itinerary.description || 'Experiência completa em Campos do Jordão'}
              </p>
            </div>
          </div>
        </motion.div>
      );
    }
  );
