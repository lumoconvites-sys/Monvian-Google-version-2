import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Heart,
  Trash2,
  Check,
  Compass,
  MapPin,
  UtensilsCrossed,
  Sparkles,
  Calendar,
  Star,
  CheckCircle2,
  Circle,
  FolderHeart,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { AppleBackButton } from './ui/AppleBackButton';
import { Spot, Itinerary } from '../types';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries';
import { useFavorites } from '../hooks/useFavorites';
import { getSpotImage } from '../utils/spotImages';
import { fetchItinerariesFromSupabase } from '../services/supabaseItineraries';
import { useIOSBackEntry } from '../services/iosNavigationManager';
import { readScopedJSON } from '../utils/userScopedStorage';

export type SavedCollectionType = 'roteiros' | 'pontos' | 'lugares';

interface SavedViewProps {
  isOpen: boolean;
  isActive?: boolean;
  onClose?: () => void;
  theme?: 'dark' | 'light' | string;
  spots: Spot[];
  onOpenSpot: (spot: Spot) => void;
  onOpenItinerary: (itinerary: Itinerary) => void;
  onNavigateTab: (tab: 'explorar' | 'roteiros' | 'salvos' | 'perfil') => void;
}

interface CollectionCoverCardProps {
  title: string;
  count: number;
  photos: string[];
  isDark: boolean;
  fallbackIcon: React.ReactNode;
  onClick: () => void;
  index?: number;
  shouldAnimate?: boolean;
}

const CELL_CORNER_CLASSES: Record<number, string> = {
  0: 'rounded-tl-[27px]',
  1: 'rounded-tr-[27px]',
  2: 'rounded-bl-[27px]',
  3: 'rounded-br-[27px]',
};

const CELL_CLIP_PATHS: Record<number, string> = {
  0: 'inset(0 round 27px 0 0 0)',
  1: 'inset(0 round 0 27px 0 0)',
  2: 'inset(0 round 0 0 0 27px)',
  3: 'inset(0 round 0 0 27px 0)',
};

const MAX_SAVED_PHOTO_CACHE = 250;
const loadedSavedPhotoCache = new Set<string>();

function cacheSavedPhotoUrl(url: string) {
  if (!url || url.startsWith('data:')) return;
  if (loadedSavedPhotoCache.has(url)) {
    loadedSavedPhotoCache.delete(url);
  } else if (loadedSavedPhotoCache.size >= MAX_SAVED_PHOTO_CACHE) {
    const oldest = loadedSavedPhotoCache.values().next().value;
    if (oldest) loadedSavedPhotoCache.delete(oldest);
  }
  loadedSavedPhotoCache.add(url);
}

const TranslucentSavedPhoto: React.FC<{
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  isDark?: boolean;
}> = React.memo(({ src, alt = '', className = '', style, isDark = false }) => {
  const [loaded, setLoaded] = useState<boolean>(() => loadedSavedPhotoCache.has(src));
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (loadedSavedPhotoCache.has(src)) {
      setLoaded(true);
      return;
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      cacheSavedPhotoUrl(src);
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  const handleLoad = () => {
    if (src) cacheSavedPhotoUrl(src);
    setLoaded(true);
  };

  return (
    <>
      {!loaded && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${
            isDark ? 'bg-white/[0.08]' : 'bg-zinc-200/75'
          }`}
          style={style}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        loading="eager"
        onLoad={handleLoad}
        onError={handleLoad}
        className={`${className} transition-opacity duration-200 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          ...style,
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      />
    </>
  );
});

const CollectionCoverCard: React.FC<CollectionCoverCardProps> = React.memo(({
  title,
  count,
  photos,
  isDark,
  fallbackIcon,
  onClick,
  index = 0,
  shouldAnimate = true,
}) => {
  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldAnimate
          ? {
              duration: 0.22,
              ease: [0.22, 1, 0.36, 1],
              delay: index * 0.025,
            }
          : { duration: 0 }
      }
      onClick={onClick}
      className="flex flex-col cursor-pointer group select-none active:scale-[0.97] transition-transform duration-150 ease-out transform-gpu"
    >
      <div
        className={`relative w-full aspect-square rounded-[28px] overflow-hidden p-0 border transition-colors grid grid-cols-2 grid-rows-2 gap-[2px] shadow-xs ${
          isDark
            ? 'bg-[#1C1C1E] border-white/10 group-hover:border-white/25'
            : 'bg-[#E5E5EA] border-black/5 group-hover:border-black/10'
        }`}
        style={{
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {[0, 1, 2, 3].map((idx) => {
          const photo = photos[idx];
          const cornerClass = CELL_CORNER_CLASSES[idx] || '';
          if (photo) {
            return (
              <div
                key={idx}
                className={`relative w-full h-full overflow-hidden ${cornerClass} ${
                  isDark ? 'bg-[#0a0a0c]' : 'bg-[#fefefe] md:bg-[#fafafc]'
                }`}
              >
                <TranslucentSavedPhoto
                  src={photo}
                  alt=""
                  isDark={isDark}
                  className={`block w-full h-full object-cover object-center ${cornerClass} ${
                    isDark ? 'bg-[#0a0a0c]' : 'bg-[#fefefe] md:bg-[#fafafc]'
                  }`}
                />
              </div>
            );
          }
          return (
            <div
              key={idx}
              className={`relative w-full h-full overflow-hidden ${cornerClass} flex items-center justify-center ${
                isDark ? 'bg-[#0a0a0c]' : 'bg-[#fefefe] md:bg-[#fafafc]'
              }`}
            />
          );
        })}
      </div>
      <div className="pt-2.5 px-1">
        <h3 className={`text-[16px] font-bold tracking-tight truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          {title}
        </h3>
        <p className="text-[13px] font-medium text-zinc-500 mt-0.5">
          {count} {count === 1 ? 'item salvo' : 'itens salvos'}
        </p>
      </div>
    </motion.div>
  );
});

let cachedActiveSavedCollection: SavedCollectionType | null = null;
let hasPlayedSavedEntranceAnimation = false;
if (typeof window !== 'undefined') {
  const resetSavedViewCaches = () => {
    cachedActiveSavedCollection = null;
    hasPlayedSavedEntranceAnimation = false;
  };
  window.addEventListener('monvian:user_logged_out', resetSavedViewCaches);
  window.addEventListener('monvian:account_switched', resetSavedViewCaches);
}

export const SavedView: React.FC<SavedViewProps> = React.memo(({
  isOpen,
  isActive = true,
  theme = 'dark',
  spots,
  onOpenSpot,
  onOpenItinerary,
  onNavigateTab,
}) => {
  const isDark = theme === 'dark';
  const isViewActive = Boolean(isOpen && isActive);
  const [shouldAnimateEntrance] = useState(() => !hasPlayedSavedEntranceAnimation);

  useEffect(() => {
    if (isViewActive) {
      hasPlayedSavedEntranceAnimation = true;
    }
  }, [isViewActive]);

  const {
    savedItineraries,
    savedSpots,
    savedPlaces,
    toggleItinerary,
    toggleSpot,
    removeBatch,
  } = useFavorites();

  const [activeCollection, setActiveCollection] = useState<SavedCollectionType | null>(
    () => cachedActiveSavedCollection
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());

  useEffect(() => {
    cachedActiveSavedCollection = activeCollection;
  }, [activeCollection]);

  useEffect(() => {
    const handleAccountReset = () => {
      setActiveCollection(null);
      setIsEditing(false);
      setSelectedForRemoval(new Set());
    };
    window.addEventListener('monvian:user_logged_out', handleAccountReset);
    window.addEventListener('monvian:account_switched', handleAccountReset);
    return () => {
      window.removeEventListener('monvian:user_logged_out', handleAccountReset);
      window.removeEventListener('monvian:account_switched', handleAccountReset);
    };
  }, []);

  const [cachedStoreItineraries, setCachedStoreItineraries] = useState<Itinerary[]>(() => {
    try {
      const raw = localStorage.getItem('monvian_itineraries_store_cache_v6');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_CURATED_ITINERARIES;
  });

  useEffect(() => {
    if (!isViewActive) return;
    let isMounted = true;
    try {
      const raw = localStorage.getItem('monvian_itineraries_store_cache_v6');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCachedStoreItineraries(parsed);
        }
      }
    } catch {}

    fetchItinerariesFromSupabase()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setCachedStoreItineraries(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isViewActive]);

  const findItineraryById = (id: string): Itinerary | null => {
    const fromStore = cachedStoreItineraries.find((it) => it.id === id);
    if (fromStore) return fromStore;
    const fromCurated = DEFAULT_CURATED_ITINERARIES.find((it) => it.id === id);
    if (fromCurated) return fromCurated;
    try {
      const custom = readScopedJSON<Itinerary | null>(`monvian_user_itinerary_${id}`, null);
      if (custom) return custom;
      const active = readScopedJSON<Itinerary | null>('monvian_active_itinerary', null);
      if (active && active.id === id) return active;
    } catch {}
    return null;
  };

  const resolvedItineraries = useMemo(() => {
    const list: Itinerary[] = [];
    for (const id of savedItineraries) {
      const found = findItineraryById(id);
      if (found) {
        list.push(found);
      }
    }
    return list;
  }, [savedItineraries, cachedStoreItineraries]);

  const resolvedTouristSpots = useMemo(() => {
    return savedSpots
      .map((id) => spots.find((s) => s.id === id))
      .filter((s): s is Spot => Boolean(s));
  }, [savedSpots, spots]);

  // "Removidos da lista" can contain removed tourist spots or removed itineraries
  const resolvedPlaces = useMemo(() => {
    const items: Array<{ itemType: 'spot'; data: Spot } | { itemType: 'itinerary'; data: Itinerary }> = [];
    for (const id of savedPlaces) {
      const foundSpot = spots.find((s) => s.id === id);
      if (foundSpot) {
        items.push({ itemType: 'spot', data: foundSpot });
        continue;
      }
      const foundItin = findItineraryById(id);
      if (foundItin) {
        items.push({ itemType: 'itinerary', data: foundItin });
      }
    }
    return items;
  }, [savedPlaces, spots, cachedStoreItineraries]);

  const itineraryPhotos = useMemo(() => {
    return resolvedItineraries
      .map((it) => it.coverImage)
      .filter(Boolean)
      .slice(0, 4);
  }, [resolvedItineraries]);

  const touristSpotPhotos = useMemo(() => {
    return resolvedTouristSpots
      .map((s) => getSpotImage(s))
      .filter(Boolean)
      .slice(0, 4);
  }, [resolvedTouristSpots]);

  const placePhotos = useMemo(() => {
    return resolvedPlaces
      .map((entry) =>
        entry.itemType === 'spot' ? getSpotImage(entry.data) : entry.data.coverImage
      )
      .filter(Boolean)
      .slice(0, 4);
  }, [resolvedPlaces]);

  // Pre-warm cover images in background so entering Salvos/Curtidos has zero decode lag
  useEffect(() => {
    const allCoverUrls = [...itineraryPhotos, ...touristSpotPhotos, ...placePhotos];
    allCoverUrls.forEach((url) => {
      if (!url || loadedSavedPhotoCache.has(url)) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        cacheSavedPhotoUrl(url);
      };
      img.src = url;
    });
  }, [itineraryPhotos, touristSpotPhotos, placePhotos]);

  const handleOpenCollection = (col: SavedCollectionType) => {
    setActiveCollection(col);
    setIsEditing(false);
    setSelectedForRemoval(new Set());
  };

  const handleBackToMain = () => {
    setActiveCollection(null);
    setIsEditing(false);
    setSelectedForRemoval(new Set());
  };

  // Register iOS Edge-Swipe Back Navigation when viewing a Saved collection
  useIOSBackEntry({
    id: `saved-collection:${activeCollection || 'none'}`,
    enabled: Boolean(isViewActive && activeCollection),
    priority: 120,
    label:
      activeCollection === 'roteiros'
        ? 'Roteiros salvos'
        : activeCollection === 'pontos'
          ? 'Pontos turísticos'
          : 'Removidos da lista',
    foregroundSelector: '#saved-collection-detail-view',
    backgroundSelector: '#saved-overview-layer',
    onPop: handleBackToMain,
  });

  const handleToggleSelect = (id: string) => {
    setSelectedForRemoval((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExecuteBatchRemoval = () => {
    if (selectedForRemoval.size === 0 || !activeCollection) return;

    if (activeCollection === 'roteiros') {
      const items = Array.from(selectedForRemoval).map((id) => ({
        type: 'itinerary' as const,
        id,
      }));
      removeBatch(items);
    } else if (activeCollection === 'pontos') {
      const items = Array.from(selectedForRemoval).map((id) => ({
        type: 'spot' as const,
        id,
      }));
      removeBatch(items);
    } else if (activeCollection === 'lugares') {
      const items = Array.from(selectedForRemoval).map((id) => ({
        type: 'place' as const,
        id,
      }));
      removeBatch(items);
    }

    setSelectedForRemoval(new Set());
    setIsEditing(false);
  };

  const currentItems = useMemo(() => {
    if (activeCollection === 'roteiros') return resolvedItineraries;
    if (activeCollection === 'pontos') return resolvedTouristSpots;
    if (activeCollection === 'lugares') return resolvedPlaces;
    return [];
  }, [activeCollection, resolvedItineraries, resolvedTouristSpots, resolvedPlaces]);

  const handleToggleSelectAll = () => {
    const allIds = currentItems.map((item: any) => item.data ? item.data.id : item.id);
    if (selectedForRemoval.size === allIds.length) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(allIds));
    }
  };

  return (
    <AnimatePresence initial={shouldAnimateEntrance}>
      {isOpen && (
        <motion.div
          id="saved-view-root"
          initial={shouldAnimateEntrance ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={
            shouldAnimateEntrance
              ? { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
              : { duration: 0 }
          }
          className={`fixed inset-0 md:left-[var(--desktop-sidebar-width,72px)] w-full md:w-auto h-full z-45 flex flex-col select-none overflow-hidden transform-gpu ios-pushed-page ${
            isDark ? 'bg-black text-white' : 'bg-[#ffffff] text-zinc-900'
          }`}
          style={{
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
            fontFamily: "'Inter', sans-serif",
            backgroundColor: isDark ? '#000000' : '#ffffff',
            willChange: 'opacity, transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <div className={`relative w-full h-full ${isDark ? 'bg-black' : 'bg-[#ffffff]'}`}>
            {/* MAIN OVERVIEW: 2x2 COLLECTIONS GRID (Kept mounted underneath for iOS parallax back-swipe) */}
            <div
              id="saved-overview-layer"
              className={`flex-1 flex flex-col w-full h-full overflow-y-auto overscroll-y-contain ${
                isDark ? 'bg-black' : 'bg-[#ffffff]'
              }`}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                paddingBottom: 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 116px)',
                willChange: 'transform',
              }}
            >
              <header
                className={`sticky top-0 z-20 w-full px-6 pb-6 shrink-0 border-b ${
                  isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'
                }`}
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 32px), 36px)',
                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.94)' : 'rgba(255, 255, 255, 0.95)',
                }}
              >
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Salvos
                </h1>
                <p className="text-sm text-zinc-500 font-medium mt-1">
                  Suas coleções e lugares marcados em Campos do Jordão
                </p>
              </header>

              <main className="px-6 flex-1 max-w-2xl mx-auto w-full">
                <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                  <CollectionCoverCard
                    index={0}
                    shouldAnimate={shouldAnimateEntrance}
                    title="Roteiros salvos"
                    count={resolvedItineraries.length}
                    photos={itineraryPhotos}
                    isDark={isDark}
                    fallbackIcon={<Compass className="w-10 h-10 text-zinc-400 stroke-[1.5]" />}
                    onClick={() => handleOpenCollection('roteiros')}
                  />
                  <CollectionCoverCard
                    index={1}
                    shouldAnimate={shouldAnimateEntrance}
                    title="Pontos turísticos"
                    count={resolvedTouristSpots.length}
                    photos={touristSpotPhotos}
                    isDark={isDark}
                    fallbackIcon={<MapPin className="w-10 h-10 text-zinc-400 stroke-[1.5]" />}
                    onClick={() => handleOpenCollection('pontos')}
                  />
                </div>
              </main>
            </div>

            <AnimatePresence initial={false}>
              {activeCollection && (
                /* COLLECTION DRILL-DOWN LIST VIEW */
                <motion.div
                  id="saved-collection-detail-view"
                  key={`saved-detail-${activeCollection}`}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                  className={`absolute inset-0 z-20 flex-1 flex flex-col w-full h-full overflow-hidden ${
                    isDark ? 'bg-black' : 'bg-[#ffffff]'
                  }`}
                  style={{
                    backgroundColor: isDark ? '#000000' : '#ffffff',
                    willChange: 'transform, opacity',
                  }}
                >
                  <div
                    className="flex-1 w-full h-full overflow-y-auto overscroll-y-contain flex flex-col"
                    style={{
                      WebkitOverflowScrolling: 'touch',
                      paddingBottom: isEditing
                        ? 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 140px)'
                        : 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 92px)',
                    }}
                  >
                  {/* Top Bar */}
                  <header
                    className="sticky top-0 z-20 w-full px-5 sm:px-6 pb-4 flex items-center justify-between gap-3 shrink-0"
                    style={{
                      paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 20px)',
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.40)',
                    }}
                  >
                    <AppleBackButton
                      theme={isDark ? 'dark' : 'light'}
                      onClick={handleBackToMain}
                      title="Voltar"
                      aria-label="Voltar"
                    />

                    <div className="flex-1 min-w-0 px-2 text-center">
                      <h2 className="text-xl font-bold tracking-tight truncate">
                        {activeCollection === 'roteiros'
                          ? 'Roteiros salvos'
                          : activeCollection === 'pontos'
                          ? 'Pontos turísticos'
                          : 'Removidos da lista'}
                      </h2>
                    </div>

                    {currentItems.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing((prev) => !prev);
                          setSelectedForRemoval(new Set());
                        }}
                        className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-tight transition-all active:scale-95 cursor-pointer ${
                          isEditing
                            ? 'bg-blue-600 text-white font-bold'
                            : isDark
                            ? 'bg-[#1C1C1E] border border-white/10 text-zinc-100 hover:border-white/25'
                            : 'bg-zinc-200/80 text-zinc-900 hover:bg-zinc-300'
                        }`}
                      >
                        {isEditing ? 'Concluir' : 'Editar'}
                      </button>
                    ) : (
                      <div className="w-10" />
                    )}
                  </header>

                  {/* List Content */}
                  <div className="flex-1 px-5 sm:px-6 pt-1 max-w-2xl mx-auto w-full">
                    {currentItems.length === 0 ? (
                      /* Empty State */
                      <div className="py-28 flex flex-col items-center justify-center text-center px-6">
                        <div className="relative mb-5 flex flex-col items-center">
                          <div
                            className="w-14 h-14 flex items-center justify-center text-zinc-950 dark:text-white transform-gpu"
                            style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.14))' }}
                          >
                            {activeCollection === 'roteiros' ? (
                              <Compass className="w-11 h-11 stroke-[1.6]" />
                            ) : activeCollection === 'pontos' ? (
                              <MapPin className="w-11 h-11 stroke-[1.6]" />
                            ) : (
                              <Trash2 className="w-11 h-11 stroke-[1.6]" />
                            )}
                          </div>
                          {/* Subtle elliptical ground shadow */}
                          <div className="w-12 h-1.5 rounded-full bg-black/10 dark:bg-white/15 blur-[2px] mt-2.5" />
                        </div>
                        <h3 className="text-[19px] font-semibold text-zinc-950 dark:text-white tracking-tight">
                          {activeCollection === 'lugares' ? 'Nenhum item removido' : 'Nenhum item salvo'}
                        </h3>
                        <p className="text-[14px] text-zinc-500 dark:text-zinc-400 max-w-[280px] mt-2 leading-relaxed font-normal">
                          {activeCollection === 'roteiros'
                            ? 'Explore roteiros selecionados de Campos do Jordão e curta os que mais gostar.'
                            : activeCollection === 'pontos'
                            ? 'Toque no ícone de coração nos pontos turísticos do mapa para adicioná-los aqui.'
                            : 'Itens removidos de roteiros ou descurtidos aparecerão nesta lista.'}
                        </p>
                      </div>
                    ) : (
                      /* Active List */
                      <div className="space-y-3 pb-8">
                        {activeCollection === 'roteiros'
                          ? (currentItems as Itinerary[]).map((itinerary, idx) => {
                              const isSelected = selectedForRemoval.has(itinerary.id);
                              return (
                                <motion.div
                                  key={itinerary.id}
                                  initial={shouldAnimateEntrance ? { opacity: 0, y: 6 } : false}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={
                                    shouldAnimateEntrance
                                      ? {
                                          duration: 0.18,
                                          ease: [0.22, 1, 0.36, 1],
                                          delay: Math.min(idx * 0.02, 0.2),
                                        }
                                      : { duration: 0 }
                                  }
                                  onClick={() => {
                                    if (isEditing) {
                                      handleToggleSelect(itinerary.id);
                                    } else {
                                      onOpenItinerary(itinerary);
                                    }
                                  }}
                                  className={`p-3.5 rounded-2xl border transition-all duration-150 active:scale-[0.98] transform-gpu flex items-center gap-3.5 cursor-pointer ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-500/10'
                                      : isDark
                                      ? 'bg-[#1C1C1E] border-white/10 hover:border-white/25'
                                      : 'bg-white border-black/5 hover:bg-zinc-50'
                                  }`}
                                >
                                  {isEditing && (
                                    <div className="shrink-0 text-blue-500">
                                      {isSelected ? (
                                        <CheckCircle2 className="w-5 h-5 fill-blue-500 text-white" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-zinc-400" />
                                      )}
                                    </div>
                                  )}
                                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative transform-gpu">
                                    <TranslucentSavedPhoto
                                      src={itinerary.coverImage}
                                      alt={itinerary.title}
                                      isDark={isDark}
                                      className="block w-full h-full rounded-xl object-cover object-center"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[15px] font-bold truncate">
                                      {itinerary.title}
                                    </h4>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                                      {(itinerary as any).duration || `${itinerary.daysCount || itinerary.days?.length || 1} dias`} · {itinerary.categories?.[0] || 'Campos do Jordão'}
                                    </p>
                                  </div>
                                </motion.div>
                              );
                            })
                          : activeCollection === 'pontos'
                          ? (currentItems as Spot[]).map((spot, idx) => {
                              const isSelected = selectedForRemoval.has(spot.id);
                              return (
                                <motion.div
                                  key={spot.id}
                                  initial={shouldAnimateEntrance ? { opacity: 0, y: 6 } : false}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={
                                    shouldAnimateEntrance
                                      ? {
                                          duration: 0.18,
                                          ease: [0.22, 1, 0.36, 1],
                                          delay: Math.min(idx * 0.02, 0.2),
                                        }
                                      : { duration: 0 }
                                  }
                                  onClick={() => {
                                    if (isEditing) {
                                      handleToggleSelect(spot.id);
                                    } else {
                                      onOpenSpot(spot);
                                    }
                                  }}
                                  className={`p-3.5 rounded-2xl border transition-all duration-150 active:scale-[0.98] transform-gpu flex items-center gap-3.5 cursor-pointer ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-500/10'
                                      : isDark
                                      ? 'bg-[#1C1C1E] border-white/10 hover:border-white/25'
                                      : 'bg-white border-black/5 hover:bg-zinc-50'
                                  }`}
                                >
                                  {isEditing && (
                                    <div className="shrink-0 text-blue-500">
                                      {isSelected ? (
                                        <CheckCircle2 className="w-5 h-5 fill-blue-500 text-white" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-zinc-400" />
                                      )}
                                    </div>
                                  )}
                                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative transform-gpu">
                                    <TranslucentSavedPhoto
                                      src={getSpotImage(spot)}
                                      alt={spot.name}
                                      isDark={isDark}
                                      className="block w-full h-full rounded-xl object-cover object-center"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[15px] font-bold truncate">
                                      {spot.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                      <span>{spot.categoryLabel || spot.category}</span>
                                      {spot.rating && (
                                        <>
                                          <span>·</span>
                                          <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                                            <Star className="w-3 h-3 fill-amber-500" />
                                            {spot.rating}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                          : (currentItems as Array<{ itemType: 'spot'; data: Spot } | { itemType: 'itinerary'; data: Itinerary }>).map((entry, idx) => {
                              const itemId = entry.data.id;
                              const isSelected = selectedForRemoval.has(itemId);
                              const isSpotEntry = entry.itemType === 'spot';
                              const imgSrc = isSpotEntry
                                ? getSpotImage(entry.data)
                                : entry.data.coverImage;
                              const title = isSpotEntry ? entry.data.name : entry.data.title;
                              const subtitle = isSpotEntry
                                ? entry.data.categoryLabel || entry.data.category
                                : `${entry.data.daysCount || entry.data.days?.length || 1} dias · Roteiro`;

                              return (
                                <motion.div
                                  key={itemId}
                                  initial={shouldAnimateEntrance ? { opacity: 0, y: 6 } : false}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={
                                    shouldAnimateEntrance
                                      ? {
                                          duration: 0.18,
                                          ease: [0.22, 1, 0.36, 1],
                                          delay: Math.min(idx * 0.02, 0.2),
                                        }
                                      : { duration: 0 }
                                  }
                                  onClick={() => {
                                    if (isEditing) {
                                      handleToggleSelect(itemId);
                                    } else if (isSpotEntry) {
                                      onOpenSpot(entry.data);
                                    } else {
                                      onOpenItinerary(entry.data);
                                    }
                                  }}
                                  className={`p-3.5 rounded-2xl border transition-all duration-150 active:scale-[0.98] transform-gpu flex items-center gap-3.5 cursor-pointer ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-500/10'
                                      : isDark
                                      ? 'bg-[#1C1C1E] border-white/10 hover:border-white/25'
                                      : 'bg-white border-black/5 hover:bg-zinc-50'
                                  }`}
                                >
                                  {isEditing && (
                                    <div className="shrink-0 text-blue-500">
                                      {isSelected ? (
                                        <CheckCircle2 className="w-5 h-5 fill-blue-500 text-white" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-zinc-400" />
                                      )}
                                    </div>
                                  )}
                                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative transform-gpu">
                                    <TranslucentSavedPhoto
                                      src={imgSrc}
                                      alt={title}
                                      isDark={isDark}
                                      className="block w-full h-full rounded-xl object-cover object-center"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[15px] font-bold truncate">
                                      {title}
                                    </h4>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                                      {subtitle}
                                    </p>
                                  </div>
                                  {!isEditing && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isSpotEntry) {
                                          toggleSpot(itemId);
                                        } else {
                                          toggleItinerary(itemId);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
                                        isDark
                                          ? 'bg-white/10 hover:bg-white/20 text-white'
                                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'
                                      }`}
                                      title="Restaurar para salvos"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Restaurar</span>
                                    </button>
                                  )}
                                </motion.div>
                              );
                            })}
                      </div>
                    )}
                  </div>
                  </div>

                  {/* Batch Edit Action Footer */}
                  {isEditing && currentItems.length > 0 && (
                    <div
                      className={`fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-2xl ${
                        isDark
                          ? 'bg-[#1C1C1E] border-white/10'
                          : 'bg-white border-black/10'
                      }`}
                    >
                      <button
                        onClick={handleToggleSelectAll}
                        className={`text-xs font-bold px-2 py-1 cursor-pointer ${
                          isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-black'
                        }`}
                      >
                        {selectedForRemoval.size === currentItems.length
                          ? 'Desmarcar todos'
                          : 'Selecionar todos'}
                      </button>
                      <button
                        disabled={selectedForRemoval.size === 0}
                        onClick={handleExecuteBatchRemoval}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          selectedForRemoval.size > 0
                            ? 'bg-rose-600 text-white active:scale-95 shadow-md'
                            : isDark
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover ({selectedForRemoval.size})</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
