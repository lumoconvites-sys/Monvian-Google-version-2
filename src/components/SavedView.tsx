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

// Helpers to classify spots into "Pontos turísticos" and "Lugares / Estabelecimentos"
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

  // Real persistent favorites state
  const {
    savedItineraries,
    savedSpots,
    savedPlaces,
    toggleItinerary,
    toggleSpot,
    togglePlace,
    removeBatch,
  } = useFavorites();

  // Active view: either main overview with 3 collections or internal collection list
  const [activeCollection, setActiveCollection] = useState<SavedCollectionType | null>(null);

  // Edit / batch deletion mode for internal collection view
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedForRemoval, setSelectedForRemoval] = useState<Set<string>>(new Set());

  // 1. Resolve saved Itineraries list
  const resolvedItineraries = useMemo(() => {
    // Look up saved itineraries in DEFAULT_CURATED_ITINERARIES and any custom ones
    const list: Itinerary[] = [];
    for (const id of savedItineraries) {
      const found = DEFAULT_CURATED_ITINERARIES.find((it) => it.id === id);
      if (found) {
        list.push(found);
      } else {
        // Fallback for custom user itinerary if present
        try {
          const rawCustom = localStorage.getItem(`monvian_user_itinerary_${id}`);
          if (rawCustom) list.push(JSON.parse(rawCustom));
        } catch (e) {}
      }
    }
    return list;
  }, [savedItineraries]);

  // 2. Resolve saved Tourist Spots list
  const resolvedTouristSpots = useMemo(() => {
    return savedSpots
      .map((id) => spots.find((s) => s.id === id))
      .filter((s): s is Spot => Boolean(s));
  }, [savedSpots, spots]);

  // 3. Resolve saved Places / Establishments list
  const resolvedPlaces = useMemo(() => {
    return savedPlaces
      .map((id) => spots.find((s) => s.id === id))
      .filter((s): s is Spot => Boolean(s));
  }, [savedPlaces, spots]);

  // Photos for Collection 1 (Roteiros)
  const itineraryPhotos = useMemo(() => {
    return resolvedItineraries
      .map((it) => it.coverImage)
      .filter(Boolean)
      .slice(0, 4);
  }, [resolvedItineraries]);

  // Photos for Collection 2 (Pontos Turísticos)
  const touristSpotPhotos = useMemo(() => {
    return resolvedTouristSpots
      .map((s) => getSpotImage(s))
      .filter(Boolean)
      .slice(0, 4);
  }, [resolvedTouristSpots]);

  // Photos for Collection 3 (Lugares)
  const placePhotos = useMemo(() => {
    return resolvedPlaces
      .map((s) => getSpotImage(s))
      .filter(Boolean)
      .slice(0, 4);
  }, [resolvedPlaces]);

  if (!isOpen) return null;

  // Handle entering collection view
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

  // Toggle item selection in edit mode
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

  // Execute batch removal
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

  // Select all or deselect all
  const handleToggleSelectAll = (totalIds: string[]) => {
    if (selectedForRemoval.size === totalIds.length) {
      setSelectedForRemoval(new Set());
    } else {
      setSelectedForRemoval(new Set(totalIds));
    }
  };

  return (
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
      <AnimatePresence mode="wait">
        {!activeCollection ? (
          // ==========================================
          // 1. TELA PRINCIPAL: AS 3 COLEÇÕES AIRBNB
          // ==========================================
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
            {/* Header Title Airbnb style */}
            <header className="px-6 pb-6 pt-2 shrink-0">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                Favoritos
              </h1>
            </header>

            {/* List of 3 Collections in a 2-Column Grid */}
            <main className="px-6 flex-1 max-w-lg mx-auto w-full">
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                 {/* Coleção 1: Roteiros salvos */}
                <CollectionCoverCard
                  title="Roteiros salvos"
                  count={resolvedItineraries.length}
                  photos={itineraryPhotos}
                  isDark={isDark}
                  fallbackIcon={<Compass className="w-8 h-8 text-black dark:text-white stroke-[1.5]" />}
                  onClick={() => handleOpenCollection('roteiros')}
                />

                {/* Coleção 2: Pontos turísticos salvos */}
                <CollectionCoverCard
                  title="Pontos turísticos salvos"
                  count={resolvedTouristSpots.length}
                  photos={touristSpotPhotos}
                  isDark={isDark}
                  fallbackIcon={<MapPin className="w-8 h-8 text-black dark:text-white stroke-[1.5]" />}
                  onClick={() => handleOpenCollection('pontos')}
                />

                {/* Coleção 3: Lugares salvos */}
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
          // ==========================================
          // 2. DETALHE DA COLEÇÃO SELECIONADA
          // ==========================================
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
            {/* Header: Botão Voltar Circular + Título Grande + Botão "Editar" Airbnb */}
            <header className="px-5 sm:px-6 pb-4 pt-1 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleBackToMain}
                className="w-10 h-10 rounded-full border border-zinc-200 dark:border-white/15 bg-white dark:bg-zinc-800/90 text-zinc-900 dark:text-white flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                title="Voltar para coleções"
                aria-label="Voltar para todas as coleções"
              >
                <ChevronLeft className="w-5 h-5 -translate-x-0.5" />
              </button>

              <div className="flex-1 min-w-0 px-2 text-center">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate text-zinc-950 dark:text-white">
                  {activeCollection === 'roteiros'
                    ? 'Roteiros salvos'
                    : activeCollection === 'pontos'
                    ? 'Pontos turísticos salvos'
                    : 'Lugares salvos'}
                </h2>
              </div>

              {/* Botão "Editar" estilo Airbnb (pílula cinza-claro) */}
              <button
                type="button"
                onClick={() => {
                  setIsEditing((prev) => !prev);
                  setSelectedForRemoval(new Set());
                }}
                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-tight transition-all active:scale-95 cursor-pointer shadow-2xs ${
                  isEditing
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {isEditing ? 'Concluir' : 'Editar'}
              </button>
            </header>

            {/* Conteúdo da Coleção */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 overscroll-y-contain pt-2">
              {/* Coleção 1: ROTEIROS */}
              {activeCollection === 'roteiros' && (
                <>
                  {resolvedItineraries.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 pb-8 max-w-xl mx-auto">
                      {resolvedItineraries.map((itinerary) => {
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
                            className="group flex flex-col cursor-pointer active:scale-[0.98] transition-transform select-none"
                          >
                            {/* Card Image Thumbnail */}
                            <div className="relative aspect-[1.05/1] w-full rounded-[22px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-white/10 shadow-xs">
                              <img
                                src={itinerary.coverImage}
                                alt={itinerary.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                                loading="lazy"
                              />

                              {/* Heart Button (when not editing) */}
                              {!isEditing ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItinerary(itinerary.id);
                                  }}
                                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-rose-500 fill-rose-500 active:scale-85 transition-transform"
                                  title="Remover dos salvos"
                                >
                                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                                </button>
                              ) : (
                                /* Checkbox overlay in edit mode */
                                <div className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-white flex items-center justify-center shadow-md">
                                  {isSelected && (
                                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-white dark:text-zinc-900 stroke-[3]" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Titles below photo */}
                            <div className="mt-2.5 px-0.5">
                              <h3 className="font-semibold text-sm sm:text-base text-zinc-950 dark:text-white line-clamp-1 leading-snug">
                                {itinerary.title}
                              </h3>
                              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium line-clamp-1 mt-0.5">
                                {itinerary.daysCount} {itinerary.daysCount === 1 ? 'dia' : 'dias'} • {itinerary.badgeText || 'Roteiro curado'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyCollectionState
                      message="Seus roteiros salvos aparecerão aqui."
                      actionLabel="Explorar roteiros"
                      onAction={() => onNavigateTab('roteiros')}
                      icon={<Compass className="w-10 h-10 text-zinc-400" />}
                    />
                  )}
                </>
              )}

              {/* Coleção 2: PONTOS TURÍSTICOS */}
              {activeCollection === 'pontos' && (
                <>
                  {resolvedTouristSpots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 pb-8 max-w-xl mx-auto">
                      {resolvedTouristSpots.map((spot) => {
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
                            className="group flex flex-col cursor-pointer active:scale-[0.98] transition-transform select-none"
                          >
                            {/* Card Image Thumbnail */}
                            <div className="relative aspect-square w-full rounded-[22px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-white/10 shadow-xs">
                              <img
                                src={getSpotImage(spot)}
                                alt={spot.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                                loading="lazy"
                              />

                              {/* Heart Button */}
                              {!isEditing ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSpot(spot.id);
                                  }}
                                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-rose-500 fill-rose-500 active:scale-85 transition-transform"
                                  title="Remover dos salvos"
                                >
                                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                                </button>
                              ) : (
                                <div className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-white flex items-center justify-center shadow-md">
                                  {isSelected && (
                                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-white dark:text-zinc-900 stroke-[3]" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Titles below photo */}
                            <div className="mt-2.5 px-0.5">
                              <h3 className="font-semibold text-sm sm:text-base text-zinc-950 dark:text-white line-clamp-1 leading-snug">
                                {spot.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium line-clamp-1 mt-0.5">
                                {spot.rating ? `★ ${spot.rating.toFixed(1)} • ` : ''}
                                {spot.categoryLabel || 'Atração turística'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyCollectionState
                      message="Seus pontos turísticos favoritos aparecerão aqui."
                      actionLabel="Explorar pontos turísticos"
                      onAction={() => onNavigateTab('explorar')}
                      icon={<MapPin className="w-10 h-10 text-zinc-400" />}
                    />
                  )}
                </>
              )}

              {/* Coleção 3: LUGARES */}
              {activeCollection === 'lugares' && (
                <>
                  {resolvedPlaces.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 pb-8 max-w-xl mx-auto">
                      {resolvedPlaces.map((place) => {
                        const isSelected = selectedForRemoval.has(place.id);
                        return (
                          <div
                            key={place.id}
                            onClick={() => {
                              if (isEditing) {
                                handleToggleSelect(place.id);
                              } else {
                                onOpenSpot(place);
                              }
                            }}
                            className="group flex flex-col cursor-pointer active:scale-[0.98] transition-transform select-none"
                          >
                            {/* Card Image Thumbnail */}
                            <div className="relative aspect-square w-full rounded-[22px] overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-white/10 shadow-xs">
                              <img
                                src={getSpotImage(place)}
                                alt={place.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                                loading="lazy"
                              />

                              {/* Heart Button */}
                              {!isEditing ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePlace(place.id);
                                  }}
                                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-rose-500 fill-rose-500 active:scale-85 transition-transform"
                                  title="Remover dos salvos"
                                >
                                  <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                                </button>
                              ) : (
                                <div className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-white flex items-center justify-center shadow-md">
                                  {isSelected && (
                                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-white dark:text-zinc-900 stroke-[3]" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Titles below photo */}
                            <div className="mt-2.5 px-0.5">
                              <h3 className="font-semibold text-sm sm:text-base text-zinc-950 dark:text-white line-clamp-1 leading-snug">
                                {place.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium line-clamp-1 mt-0.5">
                                {place.rating ? `★ ${place.rating.toFixed(1)} • ` : ''}
                                {place.categoryLabel || place.address || 'Campos do Jordão'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyCollectionState
                      message="Seus lugares favoritos aparecerão aqui."
                      actionLabel="Explorar lugares"
                      onAction={() => onNavigateTab('buscar')}
                      icon={<UtensilsCrossed className="w-10 h-10 text-zinc-400" />}
                    />
                  )}
                </>
              )}
            </div>

            {/* Floating Batch Edit Action Dock (when in edit mode) */}
            <AnimatePresence>
              {isEditing && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50 p-3 rounded-3xl bg-zinc-950/95 dark:bg-zinc-900/95 text-white backdrop-blur-xl border border-white/15 shadow-2xl flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const allIds =
                        activeCollection === 'roteiros'
                          ? resolvedItineraries.map((i) => i.id)
                          : activeCollection === 'pontos'
                          ? resolvedTouristSpots.map((s) => s.id)
                          : resolvedPlaces.map((p) => p.id);
                      handleToggleSelectAll(allIds);
                    }}
                    className="px-3.5 py-2 rounded-full text-xs font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {selectedForRemoval.size > 0 ? 'Desmarcar todos' : 'Selecionar tudo'}
                  </button>

                  <button
                    type="button"
                    disabled={selectedForRemoval.size === 0}
                    onClick={handleExecuteBatchRemoval}
                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      selectedForRemoval.size > 0
                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg active:scale-95'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover ({selectedForRemoval.size})</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// CARD DE CAPA DA COLEÇÃO (GRADE 2x2 AIRBNB)
// ==========================================
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
    <article
      onClick={onClick}
      className="group cursor-pointer select-none transition-transform w-full max-w-[170px] sm:max-w-[187px]"
    >
      {/* 2x2 Image Grid Container */}
      <div className="w-full aspect-square rounded-[24px] overflow-hidden bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-white/10 shadow-xs relative">
        {count === 0 ? (
          // Empty placeholder state
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-50 dark:bg-zinc-900/40">
            <div className="mb-3">
              {fallbackIcon}
            </div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              Nenhum item salvo
            </p>
          </div>
        ) : (
          // 2x2 Grid of Photos (Airbnb composition)
          <div className="grid grid-cols-2 grid-rows-2 gap-[2px] w-full h-full bg-white dark:bg-black">
            {[0, 1, 2, 3].map((idx) => {
              const photo = photos[idx];
              return (
                <div
                  key={idx}
                  className="w-full h-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 relative"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-100/80 dark:bg-zinc-800/50 flex items-center justify-center" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Title & Subtitle ("Hoje" matching reference image) */}
      <div className="mt-2.5 px-0.5 text-left">
        <h2 className="text-[15px] sm:text-[16px] font-bold tracking-tight text-zinc-950 dark:text-white leading-tight">
          {title}
        </h2>
        <p className="text-[12px] sm:text-[13px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
          Hoje
        </p>
      </div>
    </article>
  );
};

// ==========================================
// ESTADO VAZIO MINIMALISTA CONTEXTUAL
// ==========================================
interface EmptyCollectionStateProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
  icon: React.ReactNode;
}

const EmptyCollectionState: React.FC<EmptyCollectionStateProps> = ({
  message,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="py-20 px-6 text-center flex flex-col items-center justify-center max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-[240px] leading-relaxed">
        {message}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 px-5 py-2.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs sm:text-sm font-bold tracking-tight shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer"
      >
        {actionLabel}
      </button>
    </div>
  );
};
