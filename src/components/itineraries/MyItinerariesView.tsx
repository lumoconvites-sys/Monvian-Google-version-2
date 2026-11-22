import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Map as MapIcon,
  MoreHorizontal,
  ChevronRight,
  Plus,
  ShoppingBag,
  Pencil,
  Trash2,
  Compass,
  Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, Spot, SpotCategory } from '../../types';
import { AppleBackButton } from '../ui/AppleBackButton';
import { usePlatanos } from '../../hooks/usePlatanos';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEFAULT_CURATED_ITINERARIES } from '../../data/defaultItineraries';
import { CAMPOS_SPOTS } from '../../data/spots';
import {
  deleteUserItineraryFromBackend,
  fetchUserCreatedItinerariesFromBackend,
  getOrCreateItinerarySessionId,
  loadUserCreatedItinerariesFromStorage,
  normalizeItineraryLivreFlags,
  removeUserCreatedItineraryFromStorage,
} from '../../utils/itineraryHelpers';
import foldedMap3dIcon from '../../assets/images/folded_map_pin_3d.png';

interface MyItinerariesViewProps {
  user: any;
  spots: Spot[];
  isDark: boolean;
  onBack: () => void;
  onStartCreateNewItinerary: () => void;
  onPlayItineraryOnMap: (itinerary: Itinerary) => void;
  onEditItinerary: (itinerary: Itinerary) => void;
  onDeletedItinerary?: (itineraryId: string) => void;
}

const DEFAULT_FALLBACK_COVER =
  'https://images.unsplash.com/photo-1542332213-31f87348057f?auto=format&fit=crop&w=1200&q=85';

export const MyItinerariesView: React.FC<MyItinerariesViewProps> = ({
  user,
  spots,
  isDark,
  onBack,
  onStartCreateNewItinerary,
  onPlayItineraryOnMap,
  onEditItinerary,
  onDeletedItinerary,
}) => {
  const { wallet } = usePlatanos();
  const { tr } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<'mine' | 'purchased'>('mine');

  // 1. User-created itineraries ("Meus roteiros")
  const [myItineraries, setMyItineraries] = useState<Itinerary[]>(() =>
    loadUserCreatedItinerariesFromStorage(user)
  );

  // 2. Store itineraries catalog for matching purchased itineraries ("Adquiridos")
  const [storeCatalog, setStoreCatalog] = useState<Itinerary[]>(() => DEFAULT_CURATED_ITINERARIES);

  // Options menu & delete confirmation state
  const [openMenuItineraryId, setOpenMenuItineraryId] = useState<string | null>(null);
  const [confirmDeleteItinerary, setConfirmDeleteItinerary] = useState<Itinerary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const refreshMyItineraries = useCallback(async () => {
    const localList = loadUserCreatedItinerariesFromStorage(user);
    setMyItineraries((prev) =>
      JSON.stringify(prev) === JSON.stringify(localList) ? prev : localList
    );
    try {
      const synced = await fetchUserCreatedItinerariesFromBackend(user);
      setMyItineraries((prev) =>
        JSON.stringify(prev) === JSON.stringify(synced) ? prev : synced
      );
    } catch {
      // Keep local list on transient failure
    }
  }, [user]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('monvian:my_itineraries_active', { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent('monvian:my_itineraries_active', { detail: false }));
    };
  }, []);

  useEffect(() => {
    void refreshMyItineraries();
    const handleUpdated = () => {
      const next = loadUserCreatedItinerariesFromStorage(user);
      setMyItineraries((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    };
    window.addEventListener('monvian:user_itineraries_updated', handleUpdated);
    return () => {
      window.removeEventListener('monvian:user_itineraries_updated', handleUpdated);
    };
  }, [refreshMyItineraries, user]);

  // Fetch store itineraries catalog so "Adquiridos" always displays real purchased store itineraries
  useEffect(() => {
    let cancelled = false;
    fetch('/api/itineraries')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.itineraries) && data.itineraries.length > 0) {
          const byId = new Map<string, Itinerary>();
          for (const item of DEFAULT_CURATED_ITINERARIES) {
            byId.set(item.id, item);
          }
          for (const item of data.itineraries) {
            if (item && item.id) {
              byId.set(item.id, item);
            }
          }
          const nextCatalog = Array.from(byId.values());
          setStoreCatalog((prev) =>
            JSON.stringify(prev) === JSON.stringify(nextCatalog) ? prev : nextCatalog
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter purchased itineraries strictly by wallet.unlockedItineraryIds
  const purchasedItineraries = useMemo(() => {
    const unlockedIds = new Set(wallet.unlockedItineraryIds || []);
    if (unlockedIds.size === 0) return [];
    return storeCatalog.filter((itin) => unlockedIds.has(itin.id));
  }, [storeCatalog, wallet.unlockedItineraryIds]);

  const prepareItineraryForMapPlay = useCallback(
    (itin: Itinerary): Itinerary => {
      const availableSpots = spots && spots.length > 0 ? spots : CAMPOS_SPOTS;
      const hasValidDays =
        Array.isArray(itin.days) &&
        itin.days.some((d) => Array.isArray(d.steps) && d.steps.length > 0);

      const fallbackTemplate =
        DEFAULT_CURATED_ITINERARIES.find(
          (def) =>
            def.id === itin.id ||
            def.title.trim().toLowerCase() === (itin.title || '').trim().toLowerCase()
        ) || null;

      const sourceDays = hasValidDays
        ? itin.days
        : fallbackTemplate?.days || [];

      const enrichedDays = sourceDays.map((d, dIdx) => ({
        ...d,
        id: d.id || `${itin.id}-d-${dIdx + 1}`,
        itineraryId: itin.id,
        dayNumber: d.dayNumber || dIdx + 1,
        title: d.title || `Dia ${dIdx + 1}`,
        steps: (d.steps || []).map((s, sIdx) => {
          const foundSpot =
            s.spot ||
            availableSpots.find(
              (sp) =>
                sp.id === s.spotId ||
                sp.name.trim().toLowerCase() ===
                  String(s.spotName || s.customName || s.title || '')
                    .trim()
                    .toLowerCase()
            );
          const lat =
            foundSpot && typeof foundSpot.lat === 'number'
              ? foundSpot.lat
              : typeof s.lat === 'number'
                ? s.lat
                : -22.7335 + sIdx * 0.004;
          const lng =
            foundSpot && typeof foundSpot.lng === 'number'
              ? foundSpot.lng
              : typeof s.lng === 'number'
                ? s.lng
                : -45.5921 + sIdx * 0.003;

          const spotWithCoords: Spot = foundSpot
            ? ({ ...foundSpot, lat, lng } as Spot)
            : ({
                id: s.spotId || `spot-${sIdx + 1}`,
                name: s.customName || s.spotName || s.title || `Parada ${sIdx + 1}`,
                shortName: s.customName || s.spotName || s.title || `Parada ${sIdx + 1}`,
                lat,
                lng,
                image: s.customImage || s.image || itin.coverImage || DEFAULT_FALLBACK_COVER,
                category: 'attractions' as SpotCategory,
                categoryLabel: s.categoryLabel || s.category || 'Ponto Turístico',
              } as Spot);

          return {
            ...s,
            id: s.id || `${itin.id}-d-${dIdx + 1}-s-${sIdx + 1}`,
            itineraryId: itin.id,
            dayId: d.id || `${itin.id}-d-${dIdx + 1}`,
            dayNumber: d.dayNumber || dIdx + 1,
            stepOrder: sIdx + 1,
            spotId: spotWithCoords.id,
            spotName: spotWithCoords.name,
            spot: spotWithCoords,
            lat,
            lng,
          };
        }),
      }));

      return normalizeItineraryLivreFlags({
        ...itin,
        days: enrichedDays,
      });
    },
    [spots]
  );

  const handleCardClick = (itin: Itinerary) => {
    if (openMenuItineraryId) {
      setOpenMenuItineraryId(null);
      return;
    }
    const prepared = prepareItineraryForMapPlay(itin);
    onPlayItineraryOnMap(prepared);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteItinerary || isDeleting) return;
    setIsDeleting(true);
    const targetId = confirmDeleteItinerary.id;
    try {
      const updated = removeUserCreatedItineraryFromStorage(targetId, user);
      setMyItineraries(updated);
      const sessionId = getOrCreateItinerarySessionId(user);
      await deleteUserItineraryFromBackend(targetId, sessionId, user);
      onDeletedItinerary?.(targetId);
    } finally {
      setIsDeleting(false);
      setConfirmDeleteItinerary(null);
    }
  };

  const displayedItineraries = activeCategory === 'mine' ? myItineraries : purchasedItineraries;

  return (
    <div
      className={`relative flex-1 flex flex-col w-full min-h-full select-none ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#FFFFFF] text-zinc-950'
      }`}
      onClick={() => {
        if (openMenuItineraryId) setOpenMenuItineraryId(null);
      }}
    >
      {/* Top Navigation Bar: Back button + Centered Title "Meus roteiros" + Top-Right "+" Create Button */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 24 }}
        className={`sticky top-0 z-30 w-full pb-3 transition-colors ${
          isDark ? 'bg-black/85 text-white' : 'bg-white/90 text-zinc-950'
        } backdrop-blur-xl`}
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 18px)',
        }}
      >
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between px-1">
          <AppleBackButton
            theme={isDark ? 'dark' : 'light'}
            onClick={onBack}
            title={tr('Voltar')}
            aria-label={tr('Voltar para Perfil')}
          />
          <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-center">
            {tr('Meus roteiros')}
          </h1>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartCreateNewItinerary();
            }}
            title={tr('Criar novo roteiro')}
            aria-label={tr('Criar novo roteiro')}
            className={`apple-back-btn ${
              isDark ? 'apple-back-btn-dark' : 'apple-back-btn-light'
            } w-11 h-11 rounded-full flex items-center justify-center shrink-0 select-none cursor-pointer transition-transform duration-150 active:scale-[0.91] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]`}
          >
            <Plus className="relative z-10 w-[23px] h-[23px] pointer-events-none" strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>

      {/* Main Scrollable Content */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col space-y-5 pt-2 pb-36">
        {/* Itinerary Cards List */}
        <div className="space-y-5">
          {displayedItineraries.length === 0 ? (
            <motion.div
              key={`empty-${activeCategory}`}
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
              className={`w-full rounded-[28px] p-8 sm:p-10 text-center border flex flex-col items-center justify-center ${
                isDark
                  ? 'bg-[#1C1C1E]/70 border-white/10'
                  : 'bg-[#F9F9FB] border-black/[0.04]'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center mb-3.5">
                <img
                  src={foldedMap3dIcon}
                  alt={tr('Roteiros')}
                  className={`w-full h-full object-contain ${
                    isDark ? 'rounded-xl' : 'mix-blend-multiply'
                  }`}
                />
              </div>
              {activeCategory === 'mine' ? (
                <>
                  <h3
                    className={`text-[17px] font-bold tracking-tight ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    {tr('Nenhum roteiro criado ainda')}
                  </h3>
                  <p
                    className={`text-[13.5px] font-medium mt-1 max-w-xs leading-relaxed ${
                      isDark ? 'text-zinc-400' : 'text-[#8E8E93]'
                    }`}
                  >
                    {tr(
                      'Toque no botão “+” no canto superior direito para escolher seus pontos favoritos diretamente no mapa de Campos do Jordão.'
                    )}
                  </p>
                </>
              ) : (
                <>
                  <h3
                    className={`text-[17px] font-bold tracking-tight ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    {tr('Nenhum roteiro adquirido na loja')}
                  </h3>
                  <p
                    className={`text-[13.5px] font-medium mt-1 max-w-xs leading-relaxed ${
                      isDark ? 'text-zinc-400' : 'text-[#8E8E93]'
                    }`}
                  >
                    {tr(
                      'Os roteiros premium desbloqueados na loja do Monvian aparecerão automaticamente aqui.'
                    )}
                  </p>
                </>
              )}
            </motion.div>
          ) : (
            displayedItineraries.map((itin, idx) => {
              const firstStepSpotImg =
                itin.days?.[0]?.steps?.[0]?.spot?.image ||
                itin.days?.[0]?.steps?.[0]?.image ||
                itin.days?.[0]?.steps?.[0]?.customImage;
              const coverUrl =
                itin.coverImage && itin.coverImage.trim().length > 0
                  ? itin.coverImage
                  : firstStepSpotImg || DEFAULT_FALLBACK_COVER;
              const isMenuOpen = openMenuItineraryId === itin.id;

              return (
                <motion.div
                  key={`${activeCategory}-${itin.id}`}
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 22,
                    delay: Math.min(0.03 + idx * 0.05, 0.28),
                  }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => handleCardClick(itin)}
                  className={`group relative w-full rounded-[28px] overflow-hidden border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.45)]'
                      : 'bg-white border-black/[0.06] shadow-[0_8px_28px_rgba(0,0,0,0.06)]'
                  }`}
                >
                  {/* Cover Photo Area */}
                  <div className="relative w-full h-[196px] sm:h-[224px] overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                    <img
                      src={coverUrl}
                      alt={itin.title}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_FALLBACK_COVER;
                      }}
                    />

                    {/* Subtle top & bottom gradient for icon legibility */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/25 pointer-events-none" />

                    {/* Top-Right Three Dots Button (...) */}
                    {activeCategory === 'mine' && (
                      <div className="absolute top-3.5 right-3.5 z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuItineraryId((prev) => (prev === itin.id ? null : itin.id));
                          }}
                          className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md text-white flex items-center justify-center shadow-md transition-all active:scale-90 cursor-pointer"
                          title={tr('Opções do roteiro')}
                          aria-label={tr('Opções do roteiro')}
                        >
                          <MoreHorizontal className="w-5 h-5 stroke-[2.4]" />
                        </button>

                        {/* Floating iOS Action Menu */}
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.92, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.92, y: -4 }}
                              transition={{ duration: 0.15 }}
                              onClick={(e) => e.stopPropagation()}
                              className={`absolute right-0 mt-2 w-48 rounded-2xl overflow-hidden border shadow-2xl backdrop-blur-xl z-30 ${
                                isDark
                                  ? 'bg-[#2C2C2E]/95 border-white/15 text-white divide-y divide-white/10'
                                  : 'bg-white/95 border-black/10 text-zinc-950 divide-y divide-black/[0.06]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuItineraryId(null);
                                  const prepared = prepareItineraryForMapPlay(itin);
                                  onPlayItineraryOnMap(prepared);
                                }}
                                className="w-full px-4 py-3 text-left text-[14px] font-semibold flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                <span>{tr('Abrir no mapa')}</span>
                                <Compass className="w-4 h-4 stroke-[2]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuItineraryId(null);
                                  const prepared = prepareItineraryForMapPlay(itin);
                                  onEditItinerary(prepared);
                                }}
                                className="w-full px-4 py-3 text-left text-[14px] font-semibold flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                <span>{tr('Editar roteiro')}</span>
                                <Pencil className="w-4 h-4 stroke-[2]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuItineraryId(null);
                                  setConfirmDeleteItinerary(itin);
                                }}
                                className="w-full px-4 py-3 text-left text-[14px] font-semibold text-red-500 flex items-center justify-between hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                <span>{tr('Excluir roteiro')}</span>
                                <Trash2 className="w-4 h-4 stroke-[2]" />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Centered Translucent Play Button -> Opens Itinerary on Map */}
                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuItineraryId(null);
                          const prepared = prepareItineraryForMapPlay(itin);
                          onPlayItineraryOnMap(prepared);
                        }}
                        className="pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md border border-white/25 text-white shadow-[0_8px_24px_rgba(0,0,0,0.32)] flex items-center justify-center transition-all duration-200 group-hover:scale-105 active:scale-95 cursor-pointer"
                        title={tr('Reproduzir roteiro no mapa')}
                        aria-label={tr('Reproduzir roteiro no mapa')}
                      >
                        <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white text-white ml-0.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Footer: 3D Icon + Itinerary Name + Right Arrow */}
                  <div className="px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={foldedMap3dIcon}
                          alt=""
                          className={`w-full h-full object-contain ${
                            isDark ? 'rounded-lg' : 'mix-blend-multiply'
                          }`}
                          draggable={false}
                        />
                      </div>
                      <h3
                        className={`text-[17px] sm:text-[18px] font-bold tracking-tight truncate ${
                          isDark ? 'text-white' : 'text-zinc-950'
                        }`}
                      >
                        {tr(itin.title || 'Meu Roteiro')}
                      </h3>
                    </div>

                    <ChevronRight
                      className={`w-5 h-5 shrink-0 stroke-[2.3] transition-transform group-hover:translate-x-0.5 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}
                    />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Floating Segmented Pill Selector: "Meus roteiros" | "Adquiridos" (Positioned at the bottom bar location) */}
      <div
        className="fixed inset-x-0 bottom-0 z-[260] px-5 pointer-events-none flex justify-center"
        style={{
          bottom: 0,
          paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24, delay: 0.08 }}
          className={`w-full max-w-md rounded-full p-1.5 grid grid-cols-2 gap-1 pointer-events-auto border backdrop-blur-2xl ${
            isDark
              ? 'bg-[#1C1C1E]/95 border-white/10 shadow-[0_10px_32px_rgba(0,0,0,0.65)]'
              : 'bg-[#FFFFFF] border-black/[0.05] shadow-[0_10px_32px_rgba(0,0,0,0.09)]'
          }`}
          style={isDark ? undefined : { backgroundColor: '#ffffff' }}
        >
          <button
            type="button"
            onClick={() => setActiveCategory('mine')}
            className={`py-3 px-4 rounded-full flex items-center justify-center gap-2 text-[14.5px] tracking-tight transition-all cursor-pointer ${
              activeCategory === 'mine'
                ? isDark
                  ? 'bg-[#2C2C2E] text-white font-bold shadow-sm'
                  : 'bg-white text-zinc-950 font-bold shadow-sm'
                : isDark
                  ? 'text-zinc-400 hover:text-white font-semibold'
                  : 'text-[#8E8E93] hover:text-zinc-900 font-semibold'
            }`}
          >
            <MapIcon className="w-[18px] h-[18px] stroke-[2.2]" />
            <span>{tr('Meus roteiros')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('purchased')}
            className={`py-3 px-4 rounded-full flex items-center justify-center gap-2 text-[14.5px] tracking-tight transition-all cursor-pointer ${
              activeCategory === 'purchased'
                ? isDark
                  ? 'bg-[#2C2C2E] text-white font-bold shadow-sm'
                  : 'bg-white text-zinc-950 font-bold shadow-sm'
                : isDark
                  ? 'text-zinc-400 hover:text-white font-semibold'
                  : 'text-[#8E8E93] hover:text-zinc-900 font-semibold'
            }`}
          >
            <ShoppingBag className="w-[18px] h-[18px] stroke-[2.2]" />
            <span>{tr('Adquiridos')}</span>
          </button>
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {confirmDeleteItinerary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isDeleting && setConfirmDeleteItinerary(null)}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-5"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-[28px] p-6 text-center border shadow-2xl ${
                isDark
                  ? 'bg-[#1C1C1E] border-white/10 text-white'
                  : 'bg-white border-black/10 text-zinc-950'
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h3 className="text-[19px] font-bold tracking-tight">
                {tr('Excluir roteiro?')}
              </h3>
              <p
                className={`text-[13.5px] font-medium mt-1.5 leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {tr('Tem certeza que deseja excluir')}{' '}
                <strong className={isDark ? 'text-white' : 'text-zinc-900'}>
                  {confirmDeleteItinerary.title}
                </strong>
                {tr('? Esta ação não pode ser desfeita.')}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDeleteItinerary(null)}
                  className={`py-3 rounded-2xl text-[14px] font-bold transition-all cursor-pointer active:scale-95 ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/15 text-white'
                      : 'bg-[#F2F2F7] hover:bg-zinc-200 text-zinc-800'
                  }`}
                >
                  {tr('Cancelar')}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-[14px] font-bold transition-all cursor-pointer active:scale-95 shadow-md"
                >
                  {isDeleting ? tr('Excluindo…') : tr('Excluir')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
