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
  FolderHeart,
  ChevronRight
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
  onNavigateTab: (tab: 'explorar' | 'roteiros' | 'salvos' | 'perfil') => void;
}

interface CollectionCoverCardProps {
  title: string;
  count: number;
  photos: string[];
  isDark: boolean;
  fallbackIcon: React.ReactNode;
  onClick: () => void;
}

const CollectionCoverCard: React.FC<CollectionCoverCardProps> = ({
  title,
  count,
  photos,
  isDark,
  fallbackIcon,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="flex flex-col cursor-pointer group active:scale-[0.97] transition-all select-none"
    >
      <div
        className={`w-full aspect-square rounded-[28px] overflow-hidden p-0 border transition-all grid grid-cols-2 grid-rows-2 gap-[2px] shadow-sm ${
          isDark
            ? 'bg-[#18181A] border-white/10 group-hover:border-white/20'
            : 'bg-[#E5E5EA] border-black/5 group-hover:border-black/10'
        }`}
      >
        {[0, 1, 2, 3].map((idx) => {
          const photo = photos[idx];
          if (photo) {
            return (
              <div key={idx} className="w-full h-full overflow-hidden bg-zinc-900">
                <img
                  src={photo}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            );
          }
          return (
            <div
              key={idx}
              className={`w-full h-full flex items-center justify-center ${
                isDark ? 'bg-[#222226]' : 'bg-[#D6D6DC]'
              }`}
            >
              {idx === 0 && (!photos || photos.length === 0) ? (
                <div className="opacity-40">{fallbackIcon}</div>
              ) : null}
            </div>
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
    </div>
  );
};

export const SavedView: React.FC<SavedViewProps> = ({
  isOpen,
  theme = 'dark',
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

  const currentItems = useMemo(() => {
    if (activeCollection === 'roteiros') return resolvedItineraries;
    if (activeCollection === 'pontos') return resolvedTouristSpots;
    if (activeCollection === 'lugares') return resolvedPlaces;
    return [];
  }, [activeCollection, resolvedItineraries, resolvedTouristSpots, resolvedPlaces]);

  const handleToggleSelectAll = () => {
    const allIds = currentItems.map((item: any) => item.id);
    if (selectedForRemoval.size === allIds.length) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(allIds));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="saved-view-root"
          className={`fixed inset-0 w-full h-full z-45 flex flex-col transition-colors duration-200 select-none overflow-hidden ${
            isDark ? 'bg-black text-white' : 'bg-[#F2F2F7] text-zinc-900'
          }`}
          style={{
            fontFamily: "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
            isolation: 'isolate',
          }}
        >
          <BlurIn>
            <AnimatePresence mode="wait">
              {!activeCollection ? (
                /* MAIN OVERVIEW: 2x2 COLLECTIONS GRID */
                <div
                  key="saved-overview"
                  className="flex-1 flex flex-col w-full h-full overflow-y-auto overscroll-y-contain"
                  style={{
                    paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 20px), 24px)',
                    paddingBottom: 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 92px)',
                  }}
                >
                  <header className="px-6 pb-6 pt-3 shrink-0">
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
                        title="Roteiros salvos"
                        count={resolvedItineraries.length}
                        photos={itineraryPhotos}
                        isDark={isDark}
                        fallbackIcon={<Compass className="w-10 h-10 text-zinc-400 stroke-[1.5]" />}
                        onClick={() => handleOpenCollection('roteiros')}
                      />
                      <CollectionCoverCard
                        title="Pontos turísticos"
                        count={resolvedTouristSpots.length}
                        photos={touristSpotPhotos}
                        isDark={isDark}
                        fallbackIcon={<MapPin className="w-10 h-10 text-zinc-400 stroke-[1.5]" />}
                        onClick={() => handleOpenCollection('pontos')}
                      />
                      <CollectionCoverCard
                        title="Lugares & Gastronomia"
                        count={resolvedPlaces.length}
                        photos={placePhotos}
                        isDark={isDark}
                        fallbackIcon={<UtensilsCrossed className="w-10 h-10 text-zinc-400 stroke-[1.5]" />}
                        onClick={() => handleOpenCollection('lugares')}
                      />
                    </div>
                  </main>
                </div>
              ) : (
                /* COLLECTION DRILL-DOWN LIST VIEW */
                <motion.div
                  key={`saved-detail-${activeCollection}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="flex-1 flex flex-col w-full h-full overflow-hidden"
                  style={{
                    paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
                    paddingBottom: isEditing
                      ? 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 140px)'
                      : 'calc(max(24px, env(safe-area-inset-bottom, 0px)) + 92px)',
                  }}
                >
                  {/* Top Bar */}
                  <header className="px-5 sm:px-6 pb-4 pt-1 flex items-center justify-between gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={handleBackToMain}
                      className={`w-10 h-10 rounded-full border flex items-center justify-center active:scale-95 transition-all shadow-xs cursor-pointer ${
                        isDark
                          ? 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
                          : 'bg-white border-black/10 text-zinc-900 hover:bg-zinc-50'
                      }`}
                      title="Voltar"
                    >
                      <ChevronLeft className="w-5 h-5 -translate-x-0.5" />
                    </button>

                    <div className="flex-1 min-w-0 px-2 text-center">
                      <h2 className="text-xl font-bold tracking-tight truncate">
                        {activeCollection === 'roteiros'
                          ? 'Roteiros salvos'
                          : activeCollection === 'pontos'
                          ? 'Pontos turísticos'
                          : 'Lugares & Gastronomia'}
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
                            ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                            : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300'
                        }`}
                      >
                        {isEditing ? 'Concluir' : 'Editar'}
                      </button>
                    ) : (
                      <div className="w-10" />
                    )}
                  </header>

                  {/* List Content */}
                  <div className="flex-1 overflow-y-auto px-5 sm:px-6 overscroll-y-contain pt-1 max-w-2xl mx-auto w-full">
                    {currentItems.length === 0 ? (
                      /* Empty State */
                      <div className="py-20 flex flex-col items-center justify-center text-center px-4">
                        <div
                          className={`w-18 h-18 rounded-full flex items-center justify-center mb-4 ${
                            isDark ? 'bg-zinc-900 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                          }`}
                        >
                          {activeCollection === 'roteiros' ? (
                            <Compass className="w-8 h-8 stroke-[1.5]" />
                          ) : activeCollection === 'pontos' ? (
                            <MapPin className="w-8 h-8 stroke-[1.5]" />
                          ) : (
                            <UtensilsCrossed className="w-8 h-8 stroke-[1.5]" />
                          )}
                        </div>
                        <h3 className="text-lg font-bold">Nenhum item salvo</h3>
                        <p className="text-sm text-zinc-500 max-w-xs mt-1">
                          {activeCollection === 'roteiros'
                            ? 'Explore roteiros selecionados de Campos do Jordão e guarde os que mais gostar.'
                            : 'Toque no ícone de coração nos locais do mapa para adicioná-los aos seus salvos.'}
                        </p>
                        <button
                          onClick={() => {
                            if (activeCollection === 'roteiros') {
                              onNavigateTab('roteiros');
                            } else {
                              onNavigateTab('explorar');
                            }
                          }}
                          className="mt-6 px-5 py-2.5 rounded-full bg-blue-600 text-white text-xs font-bold active:scale-95 transition-all shadow-md cursor-pointer"
                        >
                          {activeCollection === 'roteiros' ? 'Explorar Roteiros' : 'Explorar no Mapa'}
                        </button>
                      </div>
                    ) : (
                      /* Active List */
                      <div className="space-y-3 pb-8">
                        {activeCollection === 'roteiros'
                          ? (currentItems as Itinerary[]).map((itinerary) => {
                              const isSelected = selectedForRemoval.has(itinerary.id);
                              return (
                                <div
                                  key={itinerary.id}
                                  onClick={() => {
                                    if (isEditing) {
                                      handleToggleSelect(itinerary.id);
                                    } else {
                                      onOpenItinerary(itinerary);
                                    }
                                  }}
                                  className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer active:scale-[0.98] ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-500/10'
                                      : isDark
                                      ? 'bg-zinc-900/80 border-white/10 hover:bg-zinc-800/80'
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
                                  <img
                                    src={itinerary.coverImage}
                                    alt={itinerary.title}
                                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-[15px] font-bold truncate">
                                      {itinerary.title}
                                    </h4>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                                      {(itinerary as any).duration || `${itinerary.daysCount || itinerary.days?.length || 1} dias`} · {itinerary.categories?.[0] || 'Campos do Jordão'}
                                    </p>
                                  </div>
                                  {!isEditing && (
                                    <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                                  )}
                                </div>
                              );
                            })
                          : (currentItems as Spot[]).map((spot) => {
                              const isSelected = selectedForRemoval.has(spot.id);
                              return (
                                <div
                                  key={spot.id}
                                  onClick={() => {
                                    if (isEditing) {
                                      handleToggleSelect(spot.id);
                                    } else {
                                      onOpenSpot(spot);
                                    }
                                  }}
                                  className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer active:scale-[0.98] ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-500/10'
                                      : isDark
                                      ? 'bg-zinc-900/80 border-white/10 hover:bg-zinc-800/80'
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
                                  <img
                                    src={getSpotImage(spot)}
                                    alt={spot.name}
                                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                                  />
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
                                  {!isEditing && (
                                    <ChevronRight className="w-5 h-5 text-zinc-400 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                      </div>
                    )}
                  </div>

                  {/* Batch Edit Action Footer */}
                  {isEditing && currentItems.length > 0 && (
                    <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-950/90 dark:bg-zinc-900/95 backdrop-blur-xl border border-white/15 shadow-2xl">
                      <button
                        onClick={handleToggleSelectAll}
                        className="text-xs font-bold text-zinc-300 hover:text-white px-2 py-1 cursor-pointer"
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
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
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
          </BlurIn>
        </div>
      )}
    </AnimatePresence>
  );
};
