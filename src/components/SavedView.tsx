import React, { useState, useMemo } from 'react';
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
  FolderHeart
} from 'lucide-react';
import { Spot, Itinerary } from '../types';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries';
import { useFavorites } from '../hooks/useFavorites';
import { getSpotImage } from '../utils/spotImages';
import { BlurIn } from './ui/BlurIn';

export type SavedCollectionType = 'roteiros' | 'pontos' | 'lugares';

interface SavedViewProps {
  isOpen: boolean;
  onClose?: () => void;
  theme?: 'dark' | 'light' | string;
  spots: Spot[];
  onOpenSpot: (spot: Spot) => void;
  onOpenItinerary: (itinerary: Itinerary) => void;
  onNavigateTab: (tab: 'explorar' | 'roteiros' | 'buscar') => void;
}

const TOURIST_SPOT_CATEGORIES = new Set([
  'attractions',
  'viewpoint',
  'parks',
  'nature',
  'culture',
  'monument',
  'trail',
]);

export const SavedView: React.FC<SavedViewProps> = ({
  isOpen,
  theme = 'light',
  spots,
  onOpenSpot,
  onOpenItinerary,
  onNavigateTab,
}) => {
  const isDark = theme === 'dark';
  const {
    savedItineraries,
    savedSpots,
    savedPlaces,
    toggleItinerary,
    toggleSpot,
    togglePlace,
    removeBatch,
  } = useFavorites();

  const [activeCollection, setActiveCollection] = useState<SavedCollectionType | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());

  const resolvedItineraries = useMemo(() => {
    const list: Itinerary[] = [];
    for (const id of savedItineraries) {
      const found = DEFAULT_CURATED_ITINERARIES.find((it) => it.id === id);
      if (found) {
        list.push(found);
      } else {
        try {
          const rawCustom = localStorage.getItem(`monvian_user_itinerary_${id}`);
          if (rawCustom) list.push(JSON.parse(rawCustom));
        } catch (e) {}
      }
    }
    return list;
  }, [savedItineraries]);

  const resolvedTouristSpots = useMemo(() => {
    return savedSpots
      .map((id) => spots.find((s) => s.id === id))
      .filter((s): s is Spot => Boolean(s));
  }, [savedSpots, spots]);

  const resolvedPlaces = useMemo(() => {
    return savedPlaces
      .map((id) => spots.find((s) => s.id === id))
      .filter((s): s is Spot => Boolean(s));
  }, [savedPlaces, spots]);

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
      .map((s) => getSpotImage(s))
      .filter(Boolean)
      .slice(0, 4);
  }, [resolvedPlaces]);

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

  const handleToggleSelectAll = (totalIds: string[]) => {
    if (selectedForRemoval.size === totalIds.length) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(totalIds));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <div
        id="saved-view-root"
        className={`fixed inset-0 w-full h-full z-45 flex flex-col transition-colors duration-200 select-none overflow-hidden rounded-t-[26px] ios-page-top-rounded ${
          isDark ? 'bg-black text-white' : 'bg-white text-zinc-900'
        }`}
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
          overflow: 'hidden',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          isolation: 'isolate',
        }}
      >
        <BlurIn>
          <AnimatePresence mode="wait">
            {!activeCollection ? (
              <div
                key="saved-overview"
                className="flex-1 flex flex-col w-full h-full overflow-y-auto overscroll-y-contain rounded-t-[26px]"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 20px), 24px)',
                  paddingBottom: 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 84px)',
                  borderTopLeftRadius: '26px',
                  borderTopRightRadius: '26px',
                }}
              >
                <header className="px-6 pb-6 pt-2 shrink-0">
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                    Favoritos
                  </h1>
                </header>
                <main className="px-6 flex-1 max-w-lg mx-auto w-full">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                    <CollectionCoverCard
                      title="Roteiros salvos"
                      count={resolvedItineraries.length}
                      photos={itineraryPhotos}
                      isDark={isDark}
                      fallbackIcon={<Compass className="w-8 h-8 text-black dark:text-white stroke-[1.5]" />}
                      onClick={() => handleOpenCollection('roteiros')}
                    />
                    <CollectionCoverCard
                      title="Pontos turísticos salvos"
                      count={resolvedTouristSpots.length}
                      photos={touristSpotPhotos}
                      isDark={isDark}
                      fallbackIcon={<MapPin className="w-8 h-8 text-black dark:text-white stroke-[1.5]" />}
                      onClick={() => handleOpenCollection('pontos')}
                    />
                    <CollectionCoverCard
                      title="Lugares salvos"
                      count={resolvedPlaces.length}
                      photos={placePhotos}
                      isDark={isDark}
                      fallbackIcon={<UtensilsCrossed className="w-8 h-8 text-black dark:text-white stroke-[1.5]" />}
                      onClick={() => handleOpenCollection('lugares')}
                    />
                  </div>
                </main>
              </div>
            ) : (
              <motion.div
                key={`saved-detail-${activeCollection}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex-1 flex flex-col w-full h-full overflow-hidden rounded-t-[26px]"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                  paddingBottom: isEditing
                    ? 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 140px)'
                    : 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 84px)',
                  borderTopLeftRadius: '26px',
                  borderTopRightRadius: '26px',
                }}
              >
                <header className="px-5 sm:px-6 pb-4 pt-1 flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleBackToMain}
                    className="w-10 h-10 rounded-full border border-zinc-200 dark:border-white/15 bg-white dark:bg-zinc-800/90 text-zinc-900 dark:text-white flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5 -translate-x-0.5" />
                  </button>
                  <div className="flex-1 min-w-0 px-2 text-center">
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate text-zinc-950 dark:text-white">
                      {activeCollection === 'roteiros' ? 'Roteiros salvos' : activeCollection === 'pontos' ? 'Pontos turísticos salvos' : 'Lugares salvos'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing((prev) => !prev);
                      setSelectedForRemoval(new Set());
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-tight transition-all active:scale-95 cursor-pointer shadow-2xs ${
                      isEditing ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {isEditing ? 'Concluir' : 'Editar'}
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 overscroll-y-contain pt-2">
                    {/* ... content ... */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </BlurIn>
      </div>
      )}
    </AnimatePresence>
  );
};
// ... rest of the code ...
