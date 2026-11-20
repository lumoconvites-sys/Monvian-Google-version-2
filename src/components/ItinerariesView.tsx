import React, { useState, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';
import { Itinerary, Spot, SpotCategory } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries';
import { AirbnbItineraryExplorer } from './itineraries/AirbnbItineraryExplorer';
import { recordItineraryPlayView } from '../services/itineraryViewsService';
import {
  getOrCreateItinerarySessionId,
  normalizeItineraryLivreFlags,
  saveActiveItineraryToStorage,
} from '../utils/itineraryHelpers';

interface ItinerariesViewProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  spots?: Spot[];
  activeItinerary?: Itinerary | null;
  isOnboardingSelection?: boolean;
  isOnboardingRevealReady?: boolean;
  onCompleteOnboardingSelection?: (selectedItins: Itinerary[], chosenInvestment: string) => void;
  onOpenItineraryOnMap?: (itinerary: Itinerary) => void;
  onStartManualSelectionOnMap?: () => void;
}

export const ItinerariesView: React.FC<ItinerariesViewProps> = memo(
  ({
    isOpen,
    onClose,
    theme = 'light',
    spots = CAMPOS_SPOTS,
    activeItinerary = null,
    isOnboardingSelection = false,
    isOnboardingRevealReady = true,
    onCompleteOnboardingSelection,
    onOpenItineraryOnMap,
    onStartManualSelectionOnMap,
  }) => {
    const isDark = theme === 'dark';
    const [storeToast, setStoreToast] = useState<string | null>(null);
    const toastTimerRef = useRef<number | null>(null);

    const showToast = useCallback((message: string) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      setStoreToast(message);
      toastTimerRef.current = window.setTimeout(() => {
        setStoreToast(null);
        toastTimerRef.current = null;
      }, 2600);
    }, []);

    const handleApplyStoreItinerary = useCallback(
      (
        storeItin: Itinerary,
        options?: { fromOnboardingSelection?: boolean }
      ) => {
        recordItineraryPlayView(storeItin);
        const userItinId = `user-itin-${Date.now()}`;
        const availableSpots = spots && spots.length > 0 ? spots : CAMPOS_SPOTS;

        const hasValidSourceDays =
          Array.isArray(storeItin.days) &&
          storeItin.days.some((d) => Array.isArray(d.steps) && d.steps.length > 0);
        const fallbackTemplate =
          DEFAULT_CURATED_ITINERARIES.find(
            (def) =>
              def.id === storeItin.id ||
              def.title.trim().toLowerCase() === (storeItin.title || '').trim().toLowerCase()
          ) || DEFAULT_CURATED_ITINERARIES[0];
        const sourceDays = hasValidSourceDays ? storeItin.days : fallbackTemplate?.days || [];

        const clonedDays = sourceDays.map((d, dIdx) => ({
          id: `${userItinId}-d-${dIdx + 1}`,
          itineraryId: userItinId,
          dayNumber: d.dayNumber || dIdx + 1,
          title: d.title || `Dia ${dIdx + 1}`,
          summary: d.summary || '',
          steps: (d.steps || []).map((s, sIdx) => {
            const foundSpot = s.spot || availableSpots.find((sp) => sp.id === s.spotId);
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
                  name: s.customName || s.spotName || `Parada ${sIdx + 1}`,
                  shortName: s.customName || s.spotName || `Parada ${sIdx + 1}`,
                  lat,
                  lng,
                  image: s.customImage || '',
                  category: 'attractions' as SpotCategory,
                  categoryLabel: 'Ponto Turístico',
                } as Spot);

            return {
              ...s,
              id: `${userItinId}-d-${dIdx + 1}-s-${sIdx + 1}`,
              itineraryId: userItinId,
              dayId: `${userItinId}-d-${dIdx + 1}`,
              dayNumber: d.dayNumber || dIdx + 1,
              stepOrder: sIdx + 1,
              spot: spotWithCoords,
              lat,
              lng,
            };
          }),
        }));

        const optimisticItinerary = normalizeItineraryLivreFlags({
          ...storeItin,
          id: userItinId,
          days: clonedDays,
        });

        saveActiveItineraryToStorage(optimisticItinerary);

        const sessionId = getOrCreateItinerarySessionId();
        fetch(`/api/itineraries/${storeItin.id}/clone-to-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
          },
          body: JSON.stringify({ sessionId, itinerary: optimisticItinerary }),
        }).catch(() => {});

        if (options?.fromOnboardingSelection) {
          onCompleteOnboardingSelection?.([optimisticItinerary], 'Prefiro não informar');
          return;
        }

        showToast('Roteiro carregado no mapa!');
        onOpenItineraryOnMap?.(optimisticItinerary);
      },
      [spots, onCompleteOnboardingSelection, onOpenItineraryOnMap, showToast]
    );

    const handleOpenUnifiedMap = useCallback(() => {
      if (activeItinerary && Array.isArray(activeItinerary.days) && activeItinerary.days.length > 0) {
        onOpenItineraryOnMap?.(activeItinerary);
        return;
      }
      if (onStartManualSelectionOnMap) {
        onStartManualSelectionOnMap();
        return;
      }
      onClose();
    }, [activeItinerary, onOpenItineraryOnMap, onStartManualSelectionOnMap, onClose]);

    if (!isOpen) return null;

    return (
      <div
        id="itineraries-root-container"
        className="fixed inset-0 z-40 w-full h-full overflow-hidden select-none ios-pushed-page"
        style={{
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: 'var(--app-height, 100dvh)',
          minHeight: 'var(--app-height, 100dvh)',
        }}
      >
        <div
          id="itinerary-explore-layer"
          className={`fixed inset-0 ${
            isOnboardingSelection
              ? 'md:left-0 bg-[#FFFFFF]'
              : `md:left-[var(--desktop-sidebar-width,72px)] ${isDark ? 'bg-[#000000]' : 'bg-white'}`
          } z-40 w-full md:w-auto h-full overflow-hidden transition-[left,opacity] duration-200 ease-in-out select-none ios-pushed-page`}
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
            overflow: 'hidden',
            isolation: 'isolate',
          }}
        >
          <AirbnbItineraryExplorer
            onSelectItinerary={handleApplyStoreItinerary}
            onCreateManualItinerary={
              isOnboardingSelection ? undefined : onStartManualSelectionOnMap
            }
            onOpenMap={handleOpenUnifiedMap}
            theme={isOnboardingSelection ? 'light' : theme}
            activeItineraryId={activeItinerary?.id}
            isOnboardingSelection={isOnboardingSelection}
            isOnboardingRevealReady={isOnboardingRevealReady}
          />

          <AnimatePresence>
            {storeToast && !isOnboardingSelection && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                className="fixed top-20 inset-x-0 mx-auto z-70 w-fit px-5 py-2.5 rounded-full bg-zinc-900/90 text-white border border-white/15 shadow-2xl flex items-center gap-2 text-xs font-black"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span>{storeToast}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);
