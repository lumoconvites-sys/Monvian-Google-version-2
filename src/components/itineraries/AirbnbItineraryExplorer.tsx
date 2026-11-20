import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Heart,
  X,
  Check,
  ArrowRight,
  MapPin,
  RotateCcw,
  AlertCircle,
  Play,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, ItineraryCategory } from '../../types';
import { ItineraryStoreDetailModal } from './ItineraryStoreDetailModal';
import { preloadImage } from '../../utils/preloadItineraries';
import { AppleBackButton } from '../ui/AppleBackButton';
import {
  fetchItinerariesFromSupabase,
  fetchPaginatedItinerariesFromSupabase,
  fetchItineraryCategoriesFromSupabase,
  subscribeToItinerariesChanges,
  clearItinerariesPageCache,
  matchesItineraryFilter,
} from '../../services/supabaseItineraries';
import { useFavorites } from '../../hooks/useFavorites';
import { usePlatanos } from '../../hooks/usePlatanos';
import { PlatanosWalletModal } from '../platanos/PlatanosWalletModal';
import { PlatanoPurchaseConfirmModal } from '../platanos/PlatanoPurchaseConfirmModal';
import { PlatanoLeafIcon, PlatanoUnlockToast } from '../platanos/PlatanoLeafIcon';
import { DEFAULT_CURATED_ITINERARIES } from '../../data/defaultItineraries';
import { triggerHapticFeedback } from '../../utils/haptics';
import { useIOSBackEntry } from '../../services/iosNavigationManager';

// Fast in-memory cache for categories
let memoryCategoriesCache: ItineraryCategory[] | null = null;
const CACHE_KEY_CATS = 'monvian_itinerary_categories_cache_v6';
let hasPlayedExplorerEntranceAnimation = false;
const loadedItineraryCoverCache = new Set<string>();

if (typeof window !== 'undefined') {
  window.addEventListener('monvian:user_logged_out', () => {
    hasPlayedExplorerEntranceAnimation = false;
  });
}

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

import { formatItineraryViewsCount, recordItineraryPlayView, useItineraryViews } from '../../services/itineraryViewsService';

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

  // Todos os roteiros são apresentados como roteiros normais (mesma forma, cantos arredondados, sem botões)
  return {
    featured: null,
    list: matching.slice(0, 6),
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
  onCreateManualItinerary?: () => void;
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
  shouldAnimate?: boolean;
}

const FeaturedItineraryBanner: React.FC<FeaturedItineraryBannerProps> = ({
  itinerary,
  category,
  isDark,
  isFavorite,
  stopsCount,
  onToggleFavorite,
  onOpenDetail,
  shouldAnimate = true,
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
        initial={shouldAnimate ? { opacity: 0, y: 24, scale: 0.985 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          shouldAnimate
            ? {
                duration: 0.95,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.05,
              }
            : { duration: 0 }
        }
        style={{
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
        onClick={() => onOpenDetail(itinerary)}
        className="group relative w-full h-[220px] sm:h-[240px] cursor-pointer select-none"
      >
        {/* Touca de Natal exclusiva do Roteiro em Destaque com animação de entrada e interação ao toque */}
        <motion.img
          key={`hat-${itinerary.id}-${category}-${hatTapCount}`}
          src="https://gxyqrwebnkbgxqrfdvuj.supabase.co/storage/v1/object/public/monvian-media/app-assets/itinerary-explorer-icon-5dc56fd5b017766c.webp"
          alt="Gorro de Natal"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            triggerHapticFeedback(15);
            setHatTapCount((prev) => prev + 1);
          }}
          initial={
            hatTapCount === 0
              ? shouldAnimate
                ? { opacity: 0, x: -16, y: -32, scale: 0.55, rotate: -52 }
                : false
              : { opacity: 1, x: 0, y: 0, scale: 1, rotate: -28 }
          }
          animate={
            hatTapCount === 0
              ? shouldAnimate
                ? {
                    opacity: 1,
                    x: 0,
                    y: [null, 3, -2, 0],
                    scale: [null, 1.08, 0.97, 1],
                    rotate: [null, -20, -32, -28],
                  }
                : { opacity: 1, x: 0, y: 0, scale: 1, rotate: -28 }
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
              ? shouldAnimate
                ? {
                    duration: 0.72,
                    delay: 0.16,
                    ease: [0.22, 1, 0.36, 1],
                  }
                : { duration: 0 }
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
          className={`relative w-full h-full rounded-[34px] overflow-hidden shadow-md border ${
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
                  <span>{`${itinerary.daysCount} ${itinerary.daysCount === 1 ? 'dia' : 'dias'}`}</span>
                  {stopsCount > 0 && (
                    <>
                      <span>{' · '}</span>
                      <span>{`${stopsCount} ${stopsCount === 1 ? 'parada' : 'paradas'}`}</span>
                    </>
                  )}
                  <span>{' · '}</span>
                  <span>{itinerary.description}</span>
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

let cachedExplorerFilters = {
  searchQuery: '',
  selectedCategory: 'all',
  durationFilter: 'all' as 'all' | '1day' | 'multiday' | 'free',
  showAllItineraries: false,
};

if (typeof window !== 'undefined') {
  window.addEventListener('monvian:user_logged_out', () => {
    cachedExplorerFilters = {
      searchQuery: '',
      selectedCategory: 'all',
      durationFilter: 'all',
      showAllItineraries: false,
    };
  });
}

export const AirbnbItineraryExplorer: React.FC<AirbnbItineraryExplorerProps> = ({
  onSelectItinerary,
  onOpenMap,
  onCreateManualItinerary,
  theme = 'dark',
  activeItineraryId,
  isOnboardingSelection = false,
  isOnboardingRevealReady = true,
}) => {
  const [shouldAnimateEntrance] = useState(() => !hasPlayedExplorerEntranceAnimation);
  useEffect(() => {
    hasPlayedExplorerEntranceAnimation = true;
  }, []);

  const initialItinerariesData = useMemo(
    () =>
      getItinerariesForCategory(
        cachedExplorerFilters.selectedCategory,
        cachedExplorerFilters.durationFilter,
        cachedExplorerFilters.searchQuery.trim()
      ),
    []
  );
  const [itineraries, setItineraries] = useState<Itinerary[]>(initialItinerariesData.list);
  const [featuredBannerItinerary, setFeaturedBannerItinerary] = useState<Itinerary | null>(null);
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

  const [searchQuery, setSearchQuery] = useState(() => cachedExplorerFilters.searchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() =>
    cachedExplorerFilters.searchQuery.trim()
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => cachedExplorerFilters.selectedCategory
  );
  const [durationFilter, setDurationFilter] = useState<'all' | '1day' | 'multiday' | 'free'>(
    () => cachedExplorerFilters.durationFilter
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAllItineraries, setShowAllItineraries] = useState(
    () => cachedExplorerFilters.showAllItineraries
  );
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'topup' | 'history'>('topup');
  const [purchaseTargetItinerary, setPurchaseTargetItinerary] = useState<Itinerary | null>(null);
  const [unlockToast, setUnlockToast] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
  }>({ visible: false, title: '' });
  const { savedItineraries: favorites, toggleItinerary } = useFavorites();
  const { wallet, getItineraryPlatanoPrice, isItineraryUnlocked } = usePlatanos();

  useEffect(() => {
    cachedExplorerFilters = {
      searchQuery,
      selectedCategory,
      durationFilter,
      showAllItineraries,
    };
  }, [searchQuery, selectedCategory, durationFilter, showAllItineraries]);

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
    setFeaturedBannerItinerary(null);
    featuredIdRef.current = null;
    setItineraries(localData.list);

    categorySwitchTimerRef.current = setTimeout(() => {
      setIsCategorySwitching(false);
    }, 240);
  }, [selectedCategory, durationFilter, debouncedSearchQuery]);

  useEffect(() => {
    return () => {
      queryGenerationRef.current += 1;
      isFetchingRef.current = false;
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
      setIsWalletOpen(false);
      setPurchaseTargetItinerary(null);
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
      const shouldIncludeFeatured = false;

      try {
        const result = await fetchPaginatedItinerariesFromSupabase({
          limit: initialBatchSize,
          cursor: null,
          offset: 0,
          category: selectedCategory,
          durationFilter,
          searchQuery: debouncedSearchQuery,
          includeFeaturedBanner: false,
          forceRefresh: options?.forceRefresh,
        });

        // Ignore stale response if user switched category/search while request was in flight
        if (currentGen !== queryGenerationRef.current) return;

        // Strictly filter itineraries to guarantee zero cross-category contamination
        const validatedItineraries = (result.itineraries || []).filter((item) =>
          matchesItineraryFilter(item, selectedCategory, durationFilter, debouncedSearchQuery)
        );

        setFeaturedBannerItinerary(null);
        featuredIdRef.current = null;

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

  // Roteiros são exibidos uniformemente como cards normais (mesma forma, cantos arredondados, sem botões)
  const validFeaturedBanner = null;

  // Strict Category-Guarded Discovery Itineraries List
  const displayItineraries = useMemo<Itinerary[]>(() => {
    return itineraries.filter((i) => {
      // Must strictly match active category filter
      if (!matchesItineraryFilter(i, selectedCategory, durationFilter, debouncedSearchQuery)) {
        return false;
      }
      return true;
    });
  }, [itineraries, selectedCategory, durationFilter, debouncedSearchQuery]);

  const handleOpenDetail = useCallback((itin: Itinerary) => {
    setSelectedItinerary(itin);
    setIsDetailOpen(true);
  }, []);

  // Register iOS Edge-Swipe Back Navigation when viewing "Todos os roteiros" subview
  useIOSBackEntry({
    id: 'itinerary-explorer:show-all',
    enabled: Boolean(showAllItineraries),
    priority: 115,
    label: 'Todos os Roteiros',
    foregroundSelector: '#airbnb-itinerary-scroll-container',
    backgroundSelector: '#app-map-layer',
    onPop: () => setShowAllItineraries(false),
  });

  const attemptActivateItinerary = useCallback(
    async (itin: Itinerary) => {
      const price = getItineraryPlatanoPrice(itin);
      const unlocked = isItineraryUnlocked(itin.id, itin);
      if (price > 0 && !unlocked) {
        setPurchaseTargetItinerary(itin);
        return;
      }
      setIsDetailOpen(false);
      await onSelectItinerary(itin);
    },
    [getItineraryPlatanoPrice, isItineraryUnlocked, onSelectItinerary]
  );

  const handleApplyFromDetail = useCallback(
    async (itin: Itinerary) => {
      await attemptActivateItinerary(itin);
    },
    [attemptActivateItinerary]
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

  return (
    <div
      ref={scrollContainerRef}
      id="airbnb-itinerary-scroll-container"
      className={`relative w-full h-full min-h-dvh overflow-y-auto overscroll-y-contain select-none transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-zinc-900'
      }`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
      }}
    >
      {/* =====================================================================
          1. CABEÇALHO COMPACTO + 2. BARRA DE PESQUISA + 3. CATEGORIAS FOTOGRÁFICAS
         ===================================================================== */}
      <div
        className={`relative shrink-0 transition-colors max-w-5xl mx-auto ${
          isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-zinc-900'
        }`}
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
        }}
      >
        {/* 1. CABEÇALHO COMPACTO */}
        <div className="px-5 pb-1 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {showAllItineraries && (
              <AppleBackButton
                theme={isDark ? 'dark' : 'light'}
                onClick={() => setShowAllItineraries(false)}
                title="Voltar"
                aria-label="Voltar"
              />
            )}
            <h1
              className={`text-[26px] sm:text-[28px] font-bold tracking-tight leading-none ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}
            >
              Roteiros
            </h1>
          </div>

          {/* Right Action: Plátanos Wallet Balance + Play / Create button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setWalletInitialTab('topup');
                setIsWalletOpen(true);
              }}
              className={`h-9 px-3 rounded-full border-0 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold tracking-tight tabular-nums shrink-0 cursor-pointer active:scale-95 transition-all outline-none ${
                isDark
                  ? 'bg-[#1C1C1E] text-white hover:bg-[#2C2C2E]'
                  : 'bg-[#F5F5F7] text-zinc-900 hover:bg-[#E5E5EA]'
              }`}
              title="Sua carteira de Plátanos"
              aria-label="Sua carteira de Plátanos"
            >
              <PlatanoLeafIcon className="w-6 h-6 shrink-0" variant="monochrome" />
              <span>{wallet.balance}</span>
            </button>

            {activeItineraryId && onOpenMap ? (
              <button
                type="button"
                onClick={onOpenMap}
                className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white cursor-pointer active:scale-90 transition-transform border border-white/10 shadow-none outline-none"
                title="Abrir roteiro no mapa"
                aria-label="Abrir roteiro no mapa"
              >
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
              </button>
            ) : onCreateManualItinerary ? (
              <button
                type="button"
                onClick={onCreateManualItinerary}
                className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 cursor-pointer active:scale-90 transition-all outline-none ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/15 text-white hover:bg-[#2C2C2E]'
                    : 'bg-[#fefefe] border-white text-black'
                }`}
                style={
                  isDark
                    ? {
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      }
                    : {
                        boxShadow:
                          '0 8px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 2px 0 rgba(255,255,255,1)',
                        borderBottom: '4px solid #e4e4e7',
                      }
                }
                title="Criar roteiro manualmente no mapa"
                aria-label="Criar roteiro manualmente no mapa"
              >
                <Plus
                  className={`w-[18px] h-[18px] shrink-0 ${isDark ? 'text-white' : 'text-black'}`}
                  strokeWidth={2.2}
                />
              </button>
            ) : onOpenMap ? (
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
          className={`space-y-5 transition-opacity duration-500 ease-out ${
            isCategorySwitching
              ? 'opacity-45 pointer-events-none'
              : 'opacity-100'
          }`}
        >
        {loading && displayItineraries.length === 0 && !validFeaturedBanner ? (
          /* Initial Progressive Loading State */
          <motion.div
            initial={shouldAnimateEntrance ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldAnimateEntrance
                ? { duration: 0.65, ease: [0.16, 1, 0.3, 1] }
                : { duration: 0 }
            }
            className="px-5 space-y-5"
            aria-busy="true"
            aria-live="polite"
          >
            {!debouncedSearchQuery && (
              <div
                className={`relative w-full h-[192px] sm:h-[216px] rounded-[28px] overflow-hidden border shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col justify-end p-5 transition-colors ${
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
                      className={`w-full h-[182px] sm:h-[196px] rounded-[26px] overflow-hidden border shadow-xs flex flex-col justify-end p-4 transition-colors ${
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
            className={`w-full min-h-[calc(var(--app-height,100dvh)-380px)] flex items-center justify-center ${
              isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
            }`}
            aria-label="Nenhum roteiro encontrado"
          >
            <svg
              width="38"
              height="38"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke={isDark ? '#636366' : '#AEAEB2'}
                strokeWidth="1.4"
              />
              <path
                d="M9.6 9.35C9.88 8.12 10.92 7.35 12.16 7.35C13.55 7.35 14.62 8.24 14.62 9.52C14.62 10.52 14.04 11.14 13.08 11.72C12.34 12.17 12.02 12.64 12.02 13.42V13.9"
                stroke={isDark ? '#636366' : '#AEAEB2'}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12.02" cy="16.85" r="0.85" fill={isDark ? '#636366' : '#AEAEB2'} />
            </svg>
          </div>
        ) : (
          <motion.div
            key={`itineraries-reveal-${selectedCategory}-${durationFilter}-${debouncedSearchQuery}`}
            initial={shouldAnimateEntrance ? { opacity: 0, y: 18 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              shouldAnimateEntrance
                ? {
                    duration: 0.90,
                    ease: [0.16, 1, 0.3, 1],
                  }
                : { duration: 0 }
            }
            style={{
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              willChange: 'transform, opacity',
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
                shouldAnimate={shouldAnimateEntrance}
              />
            )}

            {/* 5. SEÇÃO DE ROTEIROS ABAIXO DO BANNER ("Roteiros para descobrir") */}
            {displayItineraries.length > 0 && (
              <section className="space-y-3">
                <motion.div
                  initial={shouldAnimateEntrance ? { opacity: 0, y: 14 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldAnimateEntrance
                      ? {
                          duration: 0.85,
                          ease: [0.16, 1, 0.3, 1],
                          delay: 0.14,
                        }
                      : { duration: 0 }
                  }
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
                      shouldAnimate={shouldAnimateEntrance}
                      itinerary={itin}
                      isFavorite={favorites.includes(itin.id)}
                      onToggleFavorite={(e) => handleToggleFavorite(itin.id, e)}
                      onClick={() => handleOpenDetail(itin)}
                      onDirectPlay={() => attemptActivateItinerary(itin)}
                      isActiveRoute={itin.id === activeItineraryId}
                      platanoPrice={getItineraryPlatanoPrice(itin)}
                      isUnlocked={isItineraryUnlocked(itin.id, itin)}
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
        onOpenWalletTopUp={() => {
          setWalletInitialTab('topup');
          setIsWalletOpen(true);
        }}
        platanoPrice={selectedItinerary ? getItineraryPlatanoPrice(selectedItinerary) : 0}
        isUnlocked={selectedItinerary ? isItineraryUnlocked(selectedItinerary.id, selectedItinerary) : true}
        theme={theme}
      />

      {/* Plátanos Purchase Confirmation Sheet */}
      <PlatanoPurchaseConfirmModal
        itinerary={purchaseTargetItinerary}
        isOpen={Boolean(purchaseTargetItinerary)}
        onClose={() => setPurchaseTargetItinerary(null)}
        onConfirmSuccess={async (purchasedItin, result) => {
          setPurchaseTargetItinerary(null);
          setIsDetailOpen(false);
          setUnlockToast({
            visible: true,
            title: result.alreadyUnlocked ? 'Roteiro já liberado' : 'Roteiro liberado',
            subtitle: `${purchasedItin.title} · Saldo: ${result.balanceAfter} Plátanos`,
          });
          await onSelectItinerary(purchasedItin);
        }}
        onOpenWalletTopUp={() => {
          setWalletInitialTab('topup');
          setIsWalletOpen(true);
        }}
        theme={theme}
      />

      {/* Plátanos Wallet & Stripe Packages Modal */}
      <PlatanosWalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        theme={theme}
        initialTab={walletInitialTab}
      />

      {/* Monochrome Unlock Confirmation Toast */}
      <PlatanoUnlockToast
        visible={unlockToast.visible}
        title={unlockToast.title}
        subtitle={unlockToast.subtitle}
        theme={theme}
        onDone={() => setUnlockToast((prev) => ({ ...prev, visible: false }))}
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
  shouldAnimate?: boolean;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
  onDirectPlay?: () => void;
  isActiveRoute?: boolean;
  platanoPrice?: number;
  isUnlocked?: boolean;
  isDark?: boolean;
}

const HorizontalReferenceItineraryCard: React.FC<HorizontalReferenceItineraryCardProps> =
  React.memo(
    ({
      itinerary,
      index = 0,
      shouldAnimate = true,
      isFavorite,
      onToggleFavorite,
      onClick,
      onDirectPlay,
      isActiveRoute = false,
      platanoPrice = 0,
      isUnlocked = true,
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

      const [imageLoaded, setImageLoaded] = useState(() =>
        loadedItineraryCoverCache.has(itinerary.coverImage)
      );

      return (
        <motion.div
          onClick={onClick}
          initial={shouldAnimate ? { opacity: 0, y: 22, scale: 0.985 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            shouldAnimate
              ? {
                  duration: 0.92,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.14 + Math.min((index % 6) * 0.08, 0.48),
                }
              : { duration: 0 }
          }
          style={{
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
          whileTap={{ scale: 0.98 }}
          className="group flex flex-col cursor-pointer select-none"
        >
          {/* 1. HORIZONTAL RECTANGULAR PHOTOGRAPH (Proporção horizontal fiel à referência + Dimensões reservadas) */}
          <div
            className={`relative w-full h-[182px] sm:h-[196px] rounded-[34px] overflow-hidden shadow-xs border ${
              isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-black/5'
            }`}
          >
            {/* Subtle shimmer before image resolves */}
            <div
              className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
                imageLoaded ? 'opacity-0' : 'opacity-100'
              } ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}`}
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
              onLoad={() => {
                if (itinerary.coverImage) loadedItineraryCoverCache.add(itinerary.coverImage);
                setImageLoaded(true);
              }}
              onError={(e) => {
                if (itinerary.coverImage) loadedItineraryCoverCache.add(itinerary.coverImage);
                setImageLoaded(true);
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
              }}
              className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-103 pointer-events-none select-none ${
                imageLoaded ? 'opacity-100 filter-none' : 'opacity-0 filter blur-[8px]'
              }`}
            />

            {/* Active Route or Plátanos Cost Indicator */}
            {isActiveRoute ? (
              <div className="absolute top-3 left-3 px-3.5 py-1.5 rounded-full bg-white text-[#000000] border border-white text-[13px] font-bold tracking-[-0.01em] shadow-[0_10px_30px_rgba(0,0,0,0.22)] flex items-center gap-2 z-10">
                <Check className="w-4 h-4 stroke-[3.2] text-black drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.35)]" />
                <span>Roteiro ativo</span>
              </div>
            ) : platanoPrice > 0 ? (
              <div className="absolute top-3 left-3 z-10">
                {isUnlocked ? (
                  <div className="px-3.5 py-1.5 rounded-full bg-white text-[#000000] border border-white text-[13px] font-bold tracking-[-0.01em] shadow-[0_10px_30px_rgba(0,0,0,0.22)] flex items-center gap-2">
                    <Check className="w-4 h-4 stroke-[3.2] text-black drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.35)]" />
                    <span>Liberado</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-full bg-black/70 text-white border border-white/15 text-[11px] font-semibold flex items-center gap-1.5 tabular-nums">
                    <PlatanoLeafIcon className="w-[21px] h-[21px] shrink-0" variant="light" />
                    <span>{platanoPrice} Plátanos</span>
                  </div>
                )}
              </div>
            ) : null}

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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHapticFeedback(14);
                  recordItineraryPlayView(itinerary);
                  if (onDirectPlay) {
                    onDirectPlay();
                  } else {
                    onClick();
                  }
                }}
                className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 transition-all text-zinc-900 dark:text-zinc-100 cursor-pointer tabular-nums"
                title={platanoPrice > 0 && !isUnlocked ? `Liberar por ${platanoPrice} Plátanos` : 'Abrir roteiro no mapa'}
                aria-label={platanoPrice > 0 && !isUnlocked ? `Liberar por ${platanoPrice} Plátanos` : 'Abrir roteiro no mapa'}
              >
                {platanoPrice > 0 && !isUnlocked ? (
                  <>
                    <PlatanoLeafIcon className="w-[21px] h-[21px] shrink-0" variant="monochrome" />
                    <span className="text-[12px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
                      {platanoPrice}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-black text-black dark:fill-white dark:text-white" />
                    <span className="text-[12px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
                      {formatItineraryViewsCount(itinerary.id || itinerary.title)}
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p
                className={`text-[12px] font-medium truncate ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                <span>{`${itinerary.daysCount} ${itinerary.daysCount === 1 ? 'dia' : 'dias'}`}</span>
                {stopsCount > 0 && (
                  <>
                    <span>{' · '}</span>
                    <span>{`${stopsCount} ${stopsCount === 1 ? 'parada' : 'paradas'}`}</span>
                  </>
                )}
                <span>{' · '}</span>
                <span>{itinerary.description || 'Experiência completa em Campos do Jordão'}</span>
              </p>
            </div>
          </div>
        </motion.div>
      );
    }
  );
