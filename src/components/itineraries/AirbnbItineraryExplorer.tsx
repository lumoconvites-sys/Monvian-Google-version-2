import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  Heart,
  Star,
  Compass,
  X,
  Check,
  SlidersHorizontal,
  ArrowRight,
  MapPin,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, ItineraryCategory } from '../../types';
import { ItineraryStoreDetailModal } from './ItineraryStoreDetailModal';
import { PremiumModal } from '../PremiumModal';
import { DEFAULT_CURATED_ITINERARIES } from '../../data/defaultItineraries';
import { preloadImage, extractAllItineraryImageUrls } from '../../utils/preloadItineraries';
import {
  fetchItinerariesFromSupabase,
  fetchItineraryCategoriesFromSupabase,
  subscribeToItinerariesChanges,
} from '../../services/supabaseItineraries';
import { useFavorites } from '../../hooks/useFavorites';
import { usePlatanos } from '../../hooks/usePlatanos';
import { PlatanoLeafIcon, PlatanoUnlockToast } from '../platanos/PlatanoLeafIcon';
import { PlatanosWalletModal } from '../platanos/PlatanosWalletModal';
import { PlatanoPurchaseConfirmModal } from '../platanos/PlatanoPurchaseConfirmModal';

// Fast in-memory cache for instant hydration
let memoryItinerariesCache: Itinerary[] | null = null;
let memoryCategoriesCache: ItineraryCategory[] | null = null;

const CACHE_KEY_ITINS = 'monvian_itineraries_store_cache_v6';
const CACHE_KEY_CATS = 'monvian_itinerary_categories_cache_v6';

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
  const [durationFilter, setDurationFilter] = useState<'all' | '1day' | 'multiday' | 'free'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAllItineraries, setShowAllItineraries] = useState(false);
  const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'topup' | 'history'>('topup');
  const [confirmPurchaseItin, setConfirmPurchaseItin] = useState<Itinerary | null>(null);
  const [unlockToast, setUnlockToast] = useState<{ visible: boolean; title: string; subtitle?: string }>({
    visible: false,
    title: '',
  });
  const { savedItineraries: favorites, toggleItinerary } = useFavorites();
  const {
    wallet,
    getItineraryPlatanoPrice,
    isItineraryUnlocked,
  } = usePlatanos();

  const [isCategorySwitching, setIsCategorySwitching] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const categorySwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelectCategory = useCallback((catId: string) => {
    if (categorySwitchTimerRef.current) {
      clearTimeout(categorySwitchTimerRef.current);
    }
    setIsCategorySwitching(true);
    setSelectedCategory(catId);
    categorySwitchTimerRef.current = setTimeout(() => {
      setIsCategorySwitching(false);
    }, 320);
  }, []);

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
      setIsPremiumModalOpen(false);
      setIsFilterOpen(false);
      setIsWalletModalOpen(false);
      setConfirmPurchaseItin(null);
    };
    const handleOpenWalletEvent = (e: Event) => {
      const custom = e as CustomEvent<{ tab?: 'topup' | 'history' }>;
      setWalletInitialTab(custom.detail?.tab || 'topup');
      setIsWalletModalOpen(true);
    };
    window.addEventListener('monvian-close-modals', handleCloseAll);
    window.addEventListener('monvian:open_platanos_wallet', handleOpenWalletEvent);
    return () => {
      window.removeEventListener('monvian-close-modals', handleCloseAll);
      window.removeEventListener('monvian:open_platanos_wallet', handleOpenWalletEvent);
    };
  }, []);

  // Toggle favorite (synced with global Salvos -> Roteiros salvos)
  const handleToggleFavorite = useCallback((itinId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleItinerary(itinId);
  }, [toggleItinerary]);

  // Load store data with instant cache and background revalidation
  const loadStoreData = async (silent = false) => {
    try {
      if (!silent && itineraries.length === 0) {
        setLoading(true);
      }

      const [itinsData, catsData] = await Promise.all([
        fetchItinerariesFromSupabase().catch(() => null),
        fetchItineraryCategoriesFromSupabase().catch(() => null),
      ]);

      if (Array.isArray(itinsData) && itinsData.length > 0) {
        setItineraries(itinsData);
        memoryItinerariesCache = itinsData;
        try {
          localStorage.setItem(CACHE_KEY_ITINS, JSON.stringify(itinsData));
        } catch (e) {}

        const freshImageUrls = extractAllItineraryImageUrls(itinsData);
        freshImageUrls.forEach((u) => preloadImage(u, 'high'));
      }

      if (Array.isArray(catsData) && catsData.length > 0) {
        setCategories(catsData);
        memoryCategoriesCache = catsData;
        try {
          localStorage.setItem(CACHE_KEY_CATS, JSON.stringify(catsData));
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

    const unsubscribe = subscribeToItinerariesChanges(() => {
      loadStoreData(true);
    });
    return () => unsubscribe();
  }, []);

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

  // Real-time filtering
  const filteredItineraries = useMemo(() => {
    let result = itineraries;

    const normalizeToken = (val: string) =>
      val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // 1. Category Filter
    if (selectedCategory && selectedCategory !== 'all') {
      const cat = normalizeToken(selectedCategory);

      result = result.filter((itin) => {
        if (cat === 'destaque') {
          return Boolean(itin.isFeatured || itin.isRecommended);
        }

        const itinCats = (itin.categories || []).map(normalizeToken);
        const normTitle = normalizeToken(itin.title || '');

        if (cat === 'natureza' || cat === 'nature') {
          return (
            itinCats.some((c) =>
              ['nature', 'natureza', 'ecotourism', 'ecoturismo'].includes(c)
            ) || normTitle.includes('natureza')
          );
        }

        if (cat === 'romantico' || cat === 'romantic') {
          return (
            itinCats.some((c) =>
              ['romantic', 'romantico', 'casais', 'casal', 'romance'].includes(c)
            ) ||
            normTitle.includes('romantic') ||
            normTitle.includes('casal') ||
            normTitle.includes('casais')
          );
        }

        if (cat === 'gastronomia' || cat === 'gastronomy') {
          return (
            itinCats.some((c) =>
              ['gastronomy', 'gastronomia', 'sweets', 'cafes', 'culinaria', 'fondue'].includes(c)
            ) ||
            normTitle.includes('gastronom') ||
            normTitle.includes('fondue')
          );
        }

        if (cat === 'aventura' || cat === 'adventure') {
          return (
            itinCats.some((c) =>
              ['adventure', 'aventura', 'trilhas', 'radical', 'esportes'].includes(c)
            ) ||
            normTitle.includes('aventur') ||
            normTitle.includes('trilha')
          );
        }

        if (cat === 'familia' || cat === 'family') {
          return (
            itinCats.some((c) =>
              ['family', 'familia', 'kids', 'criancas'].includes(c)
            ) || normTitle.includes('familia')
          );
        }

        if (cat === 'terror') {
          return (
            itinCats.some((c) =>
              ['terror', 'assombrado', 'misterio', 'sobrenatural'].includes(c)
            ) || normTitle.includes('terror')
          );
        }

        return itinCats.includes(cat) || normTitle.includes(cat);
      });
    }

    // 2. Duration / Type Filter
    if (durationFilter === '1day') {
      result = result.filter((itin) => itin.daysCount === 1);
    } else if (durationFilter === 'multiday') {
      result = result.filter((itin) => (itin.daysCount || 1) >= 2);
    } else if (durationFilter === 'free') {
      result = result.filter(
        (itin) =>
          !itin.isPremium ||
          itin.badgeText?.toLowerCase() === 'livre' ||
          itin.price === 'R$ 0' ||
          itin.price === 'Grátis'
      );
    }

    // 3. Search Query Filter
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
  }, [itineraries, selectedCategory, durationFilter, searchQuery]);

  // Featured Itinerary for Main Banner (Section 4 of spec)
  // Shown on 'all' (Todos) and 'destaque' (Destaques)
  const featuredBannerItinerary = useMemo<Itinerary | null>(() => {
    if (selectedCategory !== 'all' && selectedCategory !== 'destaque') {
      return null;
    }
    if (filteredItineraries.length > 0) {
      return filteredItineraries.find((i) => i.isFeatured || i.isRecommended) || null;
    }
    return null;
  }, [filteredItineraries, selectedCategory]);

  // Discovery Itineraries List for Section 5 ("Roteiros para descobrir")
  // Excludes only the single itinerary already shown in the top featured banner so all other itineraries appear
  const discoveryItineraries = useMemo<Itinerary[]>(() => {
    return filteredItineraries.filter((i) => {
      if (
        featuredBannerItinerary &&
        (i.id === featuredBannerItinerary.id ||
          i.title.trim().toLowerCase() === featuredBannerItinerary.title.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [filteredItineraries, featuredBannerItinerary]);

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
    if (!featuredBannerItinerary?.days) return 0;
    return featuredBannerItinerary.days.reduce(
      (acc, d) => acc + (d.steps?.length || 0),
      0
    );
  }, [featuredBannerItinerary]);

  return (
    <div
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
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 border ${
                  isDark
                    ? 'bg-[#161618] border-white/10 text-white hover:border-white/25'
                    : 'bg-white border-zinc-200/90 text-zinc-900 hover:bg-zinc-100'
                }`}
                title="Voltar"
                aria-label="Voltar"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
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

          {/* Right Action: Compact Plátanos Balance + Active Map Route if any */}
          <div className="flex items-center gap-2">
            {activeItineraryId && onOpenMap ? (
              <button
                type="button"
                onClick={onOpenMap}
                className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer border shadow-2xs ${
                  isDark
                    ? 'bg-[#161618] border-white/15 text-white hover:bg-white/10'
                    : 'bg-white border-zinc-200/90 text-zinc-900 hover:bg-zinc-50'
                }`}
                title="Voltar ao mapa do roteiro ativo"
                aria-label="Voltar ao mapa do roteiro ativo"
              >
                <MapPin className="w-3.5 h-3.5 stroke-[2.2]" />
                <span className="hidden sm:inline">Meu roteiro</span>
              </button>
            ) : null}

            <button
              type="button"
              id="btn-platanos-wallet-header"
              onClick={() => {
                setWalletInitialTab('topup');
                setIsWalletModalOpen(true);
              }}
              className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-transform duration-150 cursor-pointer border active:scale-95 ${
                isDark
                  ? 'bg-[#141417] border-[#D9A84E]/35 text-white hover:border-[#D9A84E]/60 shadow-[0_2px_10px_rgba(0,0,0,0.35)]'
                  : 'bg-white border-[#D9A84E]/45 text-zinc-900 hover:bg-zinc-50 shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
              }`}
              title="Abrir carteira de Plátanos"
              aria-label="Abrir carteira de Plátanos"
            >
              <PlatanoLeafIcon className="w-4 h-4 shrink-0" variant="gold" />
              <span className="font-bold tracking-tight tabular-nums">
                {wallet.balance}
              </span>
            </button>
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
            className={`relative flex items-center justify-between w-full min-h-[48px] rounded-full px-4 py-1.5 transition-all border cursor-pointer ${
              isDark
                ? 'bg-[#151518] text-white border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.35)]'
                : 'bg-white text-zinc-900 border-zinc-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.04)]'
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
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-zinc-300'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
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
      <div className="relative pt-1 pb-44 max-w-5xl mx-auto">
        <div
          style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
          className={`space-y-5 transition-all duration-300 ease-out ${
            isCategorySwitching
              ? 'opacity-40 blur-[1.5px] scale-[0.995] pointer-events-none'
              : 'opacity-100 blur-0 scale-100'
          }`}
        >
        {loading && itineraries.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div
              className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${
                isDark ? 'border-white/70' : 'border-zinc-800'
              }`}
            />
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Carregando roteiros...
            </p>
          </div>
        ) : filteredItineraries.length === 0 ? (
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
              className={`mt-2 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer ${
                isDark ? 'bg-white text-black' : 'bg-zinc-900 text-white'
              }`}
            >
              Ver todos os roteiros
            </button>
          </div>
        ) : (
          <>
            {/* 4. ROTEIRO EM DESTAQUE — BANNER PRINCIPAL (Fidelidade ao card "The Marble Suite, Leeds") */}
            {featuredBannerItinerary && !searchQuery.trim() && (
              <div className="px-5" style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}>
                <motion.div
                  key={`featured-${featuredBannerItinerary.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => handleOpenDetail(featuredBannerItinerary)}
                  className={`group relative w-full h-[192px] sm:h-[216px] rounded-[24px] overflow-hidden cursor-pointer select-none shadow-sm border ${
                    isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-200 border-black/5'
                  }`}
                >
                  {/* Full-bleed Photograph */}
                  <img
                    src={featuredBannerItinerary.coverImage}
                    alt={featuredBannerItinerary.title}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80';
                    }}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-103 pointer-events-none"
                  />

                  {/* Discreet Dark Gradient Overlay on Left & Bottom for Text Legibility */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent pointer-events-none" />

                  {/* Banner Content Aligned Left */}
                  <div className="relative z-10 h-full p-5 flex flex-col justify-between items-start">
                    {/* Top Row: Highlight Badge + Heart Button */}
                    <div className="w-full flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-md bg-black/35 backdrop-blur-xs border border-white/15 text-white/95 text-[9.5px] font-bold uppercase tracking-widest leading-none">
                        ROTEIRO EM DESTAQUE
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(featuredBannerItinerary.id, e)}
                        className="w-8 h-8 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 cursor-pointer"
                        title={favorites.includes(featuredBannerItinerary.id) ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                        aria-label={favorites.includes(featuredBannerItinerary.id) ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                      >
                        <Heart
                          className={`w-7 h-7 transition-colors drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${
                            favorites.includes(featuredBannerItinerary.id)
                              ? 'fill-rose-500 text-rose-500 stroke-[2]'
                              : 'fill-black/30 text-white stroke-[2]'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Middle Title & Summary + Bottom CTA Button */}
                    <div className="w-full max-w-[88%] sm:max-w-[78%]">
                      <h2 className="text-[19px] sm:text-[22px] font-bold text-white leading-tight tracking-tight line-clamp-2">
                        {featuredBannerItinerary.title}
                      </h2>
                      <p className="text-[11.5px] sm:text-[12.5px] text-white/85 font-medium line-clamp-1 mt-1">
                        {featuredBannerItinerary.daysCount}{' '}
                        {featuredBannerItinerary.daysCount === 1 ? 'dia' : 'dias'}
                        {featuredStopsCount > 0 ? ` · ${featuredStopsCount} paradas` : ''} ·{' '}
                        {featuredBannerItinerary.description}
                      </p>

                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(featuredBannerItinerary);
                          }}
                          className="px-4 py-2 rounded-full bg-white text-zinc-900 text-[12px] font-semibold inline-flex items-center gap-1.5 shadow-sm hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer"
                        >
                          <span>Ver roteiro</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.4]" />
                        </button>

                        {featuredBannerItinerary.isPremium &&
                          featuredBannerItinerary.badgeText?.toLowerCase() !== 'livre' &&
                          !isItineraryUnlocked(featuredBannerItinerary.id) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmPurchaseItin(featuredBannerItinerary);
                              }}
                              className="w-9 h-9 rounded-full bg-black/65 backdrop-blur-md border border-[#D9A84E]/40 text-white flex items-center justify-center hover:bg-black/80 active:scale-95 transition-all cursor-pointer shadow-md"
                              title="Adicionar roteiro"
                              aria-label="Adicionar roteiro"
                            >
                              <Plus className="w-4 h-4 stroke-[2.6] text-[#D9A84E]" />
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* 5. SEÇÃO DE ROTEIROS ABAIXO DO BANNER ("Roteiros para descobrir") */}
            {(searchQuery.trim() ? filteredItineraries : discoveryItineraries).length > 0 && (
              <section className="space-y-3">
                <div className="px-5 flex items-center justify-between">
                  <h3
                    className={`text-[18px] sm:text-[19px] font-bold tracking-tight ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    {searchQuery.trim()
                      ? `Resultados (${filteredItineraries.length})`
                      : selectedCategory !== 'all'
                        ? `Roteiros · ${photoCategories.find((c) => c.id === selectedCategory)?.name || 'Para descobrir'}`
                        : 'Roteiros para descobrir'}
                  </h3>
                </div>

                {/* 6. CARDS FOTOGRÁFICOS DE ROTEIROS EM LISTA VERTICAL (Deslizar para baixo) */}
                <div className="px-5 flex flex-col gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3" style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}>
                  {(searchQuery.trim() ? filteredItineraries : discoveryItineraries).map(
                    (itin, idx) => (
                      <HorizontalReferenceItineraryCard
                        key={itin.id}
                        index={idx}
                        itinerary={itin}
                        isFavorite={favorites.includes(itin.id)}
                        onToggleFavorite={(e) => handleToggleFavorite(itin.id, e)}
                        onClick={() => handleOpenDetail(itin)}
                        onQuickAdd={
                          itin.isPremium && itin.badgeText?.toLowerCase() !== 'livre'
                            ? () => {
                                if (isItineraryUnlocked(itin.id)) {
                                  handleOpenDetail(itin);
                                } else {
                                  setConfirmPurchaseItin(itin);
                                }
                              }
                            : undefined
                        }
                        platanoPrice={getItineraryPlatanoPrice(itin)}
                        isUnlocked={isItineraryUnlocked(itin.id)}
                        isActiveRoute={itin.id === activeItineraryId}
                        isDark={isDark}
                      />
                    )
                  )}
                </div>
              </section>
            )}
          </>
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
          setIsWalletModalOpen(true);
        }}
        theme={theme}
      />

      {/* Plátanos Wallet Modal */}
      <PlatanosWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        theme={theme}
        initialTab={walletInitialTab}
      />

      {/* Plátanos Purchase Confirmation Modal */}
      <PlatanoPurchaseConfirmModal
        itinerary={confirmPurchaseItin}
        isOpen={Boolean(confirmPurchaseItin)}
        onClose={() => setConfirmPurchaseItin(null)}
        onOpenWalletTopUp={() => {
          setWalletInitialTab('topup');
          setIsWalletModalOpen(true);
        }}
        onConfirmSuccess={(unlockedItin, res) => {
          setConfirmPurchaseItin(null);
          setUnlockToast({
            visible: true,
            title: `Roteiro liberado: ${unlockedItin.title}`,
            subtitle: res.alreadyUnlocked
              ? 'Este roteiro já faz parte da sua coleção'
              : `-${res.charged} Plátanos · Saldo atual: ${res.balanceAfter} Plátanos`,
          });
          setSelectedItinerary(unlockedItin);
          setIsDetailOpen(true);
        }}
        theme={theme}
      />

      {/* Leaf Unlock Animation Toast */}
      <PlatanoUnlockToast
        visible={unlockToast.visible}
        title={unlockToast.title}
        subtitle={unlockToast.subtitle}
        theme={theme}
        onDone={() => setUnlockToast((prev) => ({ ...prev, visible: false }))}
      />

      {/* Monvian Elite Gold Banner / Stripe Paywall Modal */}
      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        theme={theme}
        onUnlock={() => {
          setIsPremiumModalOpen(false);
          if (selectedItinerary) {
            setIsDetailOpen(true);
          }
        }}
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
  onQuickAdd?: () => void;
  platanoPrice?: number;
  isUnlocked?: boolean;
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
      onQuickAdd,
      platanoPrice = 15,
      isUnlocked = false,
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

      const isPremiumCard = Boolean(
        itinerary.isPremium && itinerary.badgeText?.toLowerCase() !== 'livre'
      );

      const badgeLabel = useMemo(() => {
        if (isActiveRoute) return 'Roteiro ativo';
        if (isUnlocked) return 'Adquirido';
        if (itinerary.badgeText && itinerary.badgeText.trim()) return itinerary.badgeText;
        if (itinerary.isFeatured || itinerary.isRecommended) return 'Favorito dos viajantes';
        return 'Recomendado';
      }, [isActiveRoute, isUnlocked, itinerary.badgeText, itinerary.isFeatured, itinerary.isRecommended]);

      const [imageLoaded, setImageLoaded] = useState(false);

      return (
        <motion.div
          onClick={onClick}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.2,
            ease: [0.22, 1, 0.36, 1],
            delay: Math.min((index % 6) * 0.03, 0.12),
          }}
          whileTap={{ scale: 0.98 }}
          className="group flex flex-col cursor-pointer select-none"
        >
          {/* 1. HORIZONTAL RECTANGULAR PHOTOGRAPH (Proporção horizontal fiel à referência) */}
          <div
            className={`relative w-full h-[182px] sm:h-[196px] rounded-[22px] overflow-hidden shadow-xs border ${
              isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-black/5'
            }`}
          >
            {!imageLoaded && (
              <div
                className={`absolute inset-0 animate-pulse ${
                  isDark ? 'bg-white/5' : 'bg-zinc-200'
                }`}
              />
            )}

            <img
              src={itinerary.coverImage}
              alt={itinerary.title}
              draggable={false}
              loading={index < 3 ? 'eager' : 'lazy'}
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                setImageLoaded(true);
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
              }}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103 pointer-events-none select-none"
            />

            {/* Top-Left Pill Badge on Image */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-zinc-900 text-[11px] font-semibold shadow-xs flex items-center gap-1 z-10">
              {isActiveRoute || isUnlocked ? (
                <Check className="w-3 h-3 stroke-[2.8] text-emerald-600" />
              ) : isPremiumCard ? (
                <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
              ) : (
                <Star className="w-3 h-3 fill-zinc-900 text-zinc-900" />
              )}
              <span className="tabular-nums">
                {isPremiumCard && !isUnlocked && !isActiveRoute
                  ? `${platanoPrice}`
                  : badgeLabel}
              </span>
            </div>

            {/* Top-Right Favorite Heart Button on Image */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(e);
              }}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 cursor-pointer z-10"
              title={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
            >
              <Heart
                className={`w-7 h-7 transition-colors drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${
                  isFavorite
                    ? 'fill-rose-500 text-rose-500 stroke-[2]'
                    : 'fill-black/30 text-white stroke-[2]'
                }`}
              />
            </button>
          </div>

          {/* 2. CARD DETAILS BELOW IMAGE */}
          <div className="pt-2.5 px-1 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <h4
                className={`text-[15px] font-bold tracking-tight truncate leading-snug ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {itinerary.title}
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`flex items-center gap-1 text-[12.5px] font-semibold ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{rating}</span>
                </div>
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

              {/* Minimalist "+" button on each premium itinerary */}
              {isPremiumCard && onQuickAdd && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd();
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 border shadow-2xs ${
                    isUnlocked
                      ? isDark
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isDark
                        ? 'bg-[#141417] border-[#D9A84E]/40 text-[#D9A84E] hover:border-[#D9A84E]'
                        : 'bg-zinc-900 border-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                  title={isUnlocked ? 'Abrir roteiro' : 'Adicionar roteiro'}
                  aria-label={isUnlocked ? 'Abrir roteiro' : 'Adicionar roteiro'}
                >
                  {isUnlocked ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      );
    }
  );
