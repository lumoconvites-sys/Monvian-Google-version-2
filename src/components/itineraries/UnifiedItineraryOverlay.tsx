import React, { useState, useRef, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Compass,
  Edit3,
  Layers,
  MapPin,
  Notebook,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Store,
  Trash2,
  Clock,
} from 'lucide-react';
import { Itinerary, ItineraryStep, MapModeType, Spot } from '../../types';
import { AppleBackButton } from '../ui/AppleBackButton';
import { LazyImage } from '../ui/LazyImage';
import { RoundedNavigationIcon } from '../RoundedNavigationIcon';
import { getSpotCardThumbnail, getSpotFallbackImage } from '../../utils/spotImages';
import { formatEstimatedDuration } from '../../utils/itineraryHelpers';
import { ItineraryEditModal } from './ItineraryEditModal';
import { TripNotesModal } from './TripNotesModal';
import { ImportSpotFloatingModal } from './ImportSpotFloatingModal';
import { PlusActionMenuModal } from './PlusActionMenuModal';

const OPEN_OFFSET_LEFT = -84;
const SPRING_IOS = { type: 'spring' as const, stiffness: 440, damping: 36, mass: 0.8 };
const SPRING_DRAWER = { type: 'spring' as const, damping: 28, stiffness: 340, mass: 0.8 };

const getShortDisplayTitle = (title: string): string => {
  if (!title) return 'Meu Roteiro';
  const cleaned = title.replace(/\s*\([^)]*\)/g, '').trim();
  if (cleaned.length <= 22) return cleaned;
  return cleaned.slice(0, 20).trim() + '...';
};

const openDirectionsMap = (
  spotTarget?: Spot | { name?: string; address?: string; lat?: number; lng?: number; mapsUrl?: string }
) => {
  if (!spotTarget) return;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const destination =
    spotTarget.lat && spotTarget.lng
      ? `${spotTarget.lat},${spotTarget.lng}`
      : encodeURIComponent(
          spotTarget.address
            ? `${spotTarget.name}, ${spotTarget.address}`
            : `${spotTarget.name} Campos do Jordão`
        );

  if (isIOS) {
    window.open(`https://maps.apple.com/?daddr=${destination}&dirflg=d`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  }
};

/* ============================================================================
 * 1. MODE 2 — SELECT MODE OVERLAY (Pin Selection directly on active map)
 * ============================================================================ */

interface SelectModeOverlayProps {
  selectedCount: number;
  isDark: boolean;
  isSatellite: boolean;
  onCancel: () => void;
  onClearSelection: () => void;
  onContinue: () => void;
}

export const SelectModeOverlay: React.FC<SelectModeOverlayProps> = memo(
  ({ selectedCount, isDark, isSatellite, onCancel, onClearSelection, onContinue }) => {
    const useLightOnDark = isDark || isSatellite;

    return (
      <div className="fixed inset-0 md:left-[var(--desktop-sidebar-width,72px)] z-[45] pointer-events-none select-none flex flex-col justify-between">
        {/* Discreet Top Bar */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="w-full px-4 sm:px-6 flex items-center justify-between gap-2 pointer-events-none"
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 24px)',
          }}
        >
          <div className="pointer-events-auto shrink-0">
            <AppleBackButton
              theme="glass"
              size="explore"
              onClick={onCancel}
              className={useLightOnDark ? '!text-white' : '!text-black'}
              style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
              title="Cancelar seleção"
              aria-label="Cancelar seleção"
            />
          </div>

          <div
            className={`pointer-events-auto h-11 px-4 rounded-full ios26-liquid-glass flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm ${
              useLightOnDark ? 'text-white' : 'text-black'
            }`}
            style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              {selectedCount === 0
                ? 'Toque nos pins do mapa'
                : `${selectedCount} ${selectedCount === 1 ? 'ponto selecionado' : 'pontos selecionados'}`}
            </span>
          </div>

          <div className="pointer-events-auto shrink-0 w-[53px] flex justify-end">
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className={`h-11 px-3.5 rounded-full ios26-liquid-glass flex items-center justify-center gap-1 text-xs font-bold active:scale-95 transition-transform cursor-pointer ${
                  useLightOnDark ? 'text-white' : 'text-black'
                }`}
                style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
                title="Limpar seleção"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Bottom Floating "CONTINUAR" CTA above BottomNavigation */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex justify-center px-4 pb-[94px] md:pb-8 pointer-events-none"
        >
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={onContinue}
            className={`pointer-events-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-black tracking-tight shadow-[0_12px_32px_rgba(0,0,0,0.28)] border transition-all duration-200 ${
              selectedCount > 0
                ? isDark
                  ? 'bg-white text-black border-white hover:bg-zinc-200 active:scale-95 cursor-pointer'
                  : 'bg-[#000000] text-white border-[#000000] hover:bg-[#171717] active:scale-95 cursor-pointer'
                : isDark
                  ? 'bg-[#171717]/90 text-[#858585] border-white/10 cursor-not-allowed'
                  : 'bg-white/90 text-[#858585] border-black/10 cursor-not-allowed'
            }`}
          >
            <span>
              {selectedCount > 0
                ? `Continuar (${selectedCount})`
                : 'Selecione 1 ou mais pontos'}
            </span>
            {selectedCount > 0 && <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
          </button>
        </motion.div>
      </div>
    );
  }
);

/* ============================================================================
 * 2. SWIPEABLE STOP CARD (Photo, Name, Category, Description, Duration, Reorder, Remove)
 * ============================================================================ */

interface SwipeableStopCardProps {
  step: ItineraryStep;
  idx: number;
  totalSteps: number;
  isSelected: boolean;
  isDark: boolean;
  isPremium?: boolean;
  onSelect: (step: ItineraryStep) => void;
  onDelete: (stepId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

const SwipeableStopCard: React.FC<SwipeableStopCardProps> = ({
  step,
  idx,
  totalSteps,
  isSelected,
  isDark,
  isPremium = false,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const x = useMotionValue(0);
  const spot = step.spot;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const wasOpenAtStartRef = useRef(false);

  const trashOpacity = useTransform(x, [0, -20, -75], [0, 0.45, 1]);
  const trashScale = useTransform(x, [0, -35, -84, -160], [0.75, 0.9, 1, 1.2]);
  const bgOpacity = useTransform(x, [0, -12, -60], [0, 0.7, 1]);

  const estimatedDurationText = formatEstimatedDuration(spot?.durationMinutes);
  const shortDescText =
    (spot as { shortDescription?: string } | undefined)?.shortDescription ||
    spot?.description ||
    '';

  const handleDragStart = () => {
    wasOpenAtStartRef.current = isOpenRef.current;
  };

  const handleDragEnd = (_e: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const cardWidth = containerRef.current?.offsetWidth || 320;
    const currentX = x.get();
    const velocityX = info.velocity.x;
    const wasOpen = wasOpenAtStartRef.current;

    if (currentX > 0) {
      animate(x, 0, SPRING_IOS);
      setIsOpen(false);
      return;
    }

    if (currentX <= -(cardWidth * 0.65)) {
      onDelete(step.id);
      return;
    }

    if (wasOpen) {
      const isUndoing =
        info.offset.x > cardWidth * 0.35 ||
        info.offset.x > 32 ||
        currentX > -46 ||
        velocityX > 180;
      animate(x, isUndoing ? 0 : OPEN_OFFSET_LEFT, SPRING_IOS);
      setIsOpen(!isUndoing);
      return;
    }

    if (currentX < -36 || info.offset.x < -36 || velocityX < -220) {
      animate(x, OPEN_OFFSET_LEFT, SPRING_IOS);
      setIsOpen(true);
    } else {
      animate(x, 0, SPRING_IOS);
      setIsOpen(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.18 }}
      className="relative w-full rounded-[24px] overflow-hidden select-none touch-pan-y"
    >
      {/* Background Swipe-to-Delete Reveal */}
      <motion.div
        style={{ opacity: bgOpacity }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(step.id);
        }}
        className={`absolute inset-0 rounded-[24px] flex items-center justify-end px-5 z-0 cursor-pointer ${
          isDark ? 'bg-[#171717] border border-white/10' : 'bg-[#F2F2F2] border border-zinc-200'
        }`}
        aria-label="Excluir ponto turístico"
      >
        <motion.div
          style={{ opacity: trashOpacity, scale: trashScale }}
          className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500"
        >
          <Trash2 className="w-4 h-4 stroke-[2.2]" />
        </motion.div>
      </motion.div>

      {/* Foreground Draggable Stop Card */}
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: -160, right: 0 }}
        dragElastic={0.08}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{
          x,
          backgroundColor: isDark ? '#171717' : '#FFFFFF',
          color: isDark ? '#FFFFFF' : '#000000',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpenRef.current) {
            animate(x, 0, SPRING_IOS);
            setIsOpen(false);
            return;
          }
          if (Math.abs(x.get()) < 6) {
            onSelect(step);
          }
        }}
        className={`relative z-10 py-2.5 px-3.5 rounded-[24px] flex items-center justify-between gap-2.5 cursor-pointer transition-colors border ${
          isDark
            ? isSelected
              ? 'border-white/45 ring-1 ring-white/20'
              : 'border-white/10 hover:border-white/25'
            : isSelected
              ? 'border-black/30 ring-2 ring-black/10 shadow-sm'
              : 'border-zinc-200/80 hover:border-zinc-300 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={`w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${
              isSelected
                ? isPremium
                  ? 'bg-metallic-gold text-[#1A1202] shadow-sm'
                  : isDark
                    ? 'bg-white text-black'
                    : 'bg-black text-white'
                : isPremium
                  ? 'bg-[#1C1C1E] text-[#F5BE38] border border-[#E5AC33]/50'
                  : isDark
                    ? 'bg-white text-black'
                    : 'bg-black text-white'
            }`}
          >
            {String(idx + 1).padStart(2, '0')}
          </span>

          {spot && (
            <div className="w-12 h-12 rounded-[14px] overflow-hidden shrink-0 bg-zinc-800 relative">
              <LazyImage
                src={getSpotCardThumbnail(spot)}
                alt={spot.name}
                className="w-full h-full object-cover pointer-events-none"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                }}
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#858585] leading-none">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{step.suggestedTime || '09:30'}</span>
              <span>·</span>
              <span>{estimatedDurationText}</span>
              <span>·</span>
              <span className="uppercase truncate">{spot?.categoryLabel || 'Local'}</span>
            </div>

            <h4
              className="text-[13.5px] font-black uppercase truncate leading-tight my-1"
              style={{ color: isDark ? '#FFFFFF' : '#000000' }}
            >
              {spot?.shortName || spot?.name || `Ponto ${idx + 1}`}
            </h4>

            <p className="text-[10.5px] text-[#858585] truncate leading-none">
              {shortDescText ||
                (step.durationToNextMin
                  ? `${step.durationToNextMin} min até a próxima parada`
                  : 'Local planejado do roteiro')}
            </p>
          </div>
        </div>

        {/* Right Controls: Reorder Up/Down, Play Maps, Delete */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {totalSteps > 1 && (
            <div className="flex flex-col gap-0.5 mr-0.5">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => onMoveUp(idx)}
                className={`w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
                  idx === 0
                    ? 'opacity-25 cursor-not-allowed'
                    : isDark
                      ? 'hover:bg-white/10 text-zinc-300 cursor-pointer'
                      : 'hover:bg-black/5 text-zinc-700 cursor-pointer'
                }`}
                title="Mover para cima"
                aria-label="Mover para cima"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={idx === totalSteps - 1}
                onClick={() => onMoveDown(idx)}
                className={`w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
                  idx === totalSteps - 1
                    ? 'opacity-25 cursor-not-allowed'
                    : isDark
                      ? 'hover:bg-white/10 text-zinc-300 cursor-pointer'
                      : 'hover:bg-black/5 text-zinc-700 cursor-pointer'
                }`}
                title="Mover para baixo"
                aria-label="Mover para baixo"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => openDirectionsMap(spot)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-xs ${
              isDark
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-[#F2F2F2] text-black hover:bg-zinc-200'
            }`}
            title="Abrir rota no Maps"
            aria-label="Abrir rota no Maps"
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </button>

          {totalSteps > 1 && (
            <button
              type="button"
              onClick={() => onDelete(step.id)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#858585] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Remover ponto"
              aria-label="Remover ponto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ============================================================================
 * 3. MODE 3 — UNIFIED ITINERARY OVERLAY (Runs directly atop the single map)
 * ============================================================================ */

interface UnifiedItineraryOverlayProps {
  itinerary: Itinerary;
  allSpots: Spot[];
  activeDayIndex: number;
  onChangeDayIndex: (idx: number) => void;
  activeStepId: string | null;
  onSelectStep: (step: ItineraryStep) => void;
  isExpanded: boolean;
  onChangeExpanded: (expanded: boolean) => void;
  theme: 'dark' | 'light';
  mapStyle: MapModeType;
  onToggleMapStyle: () => void;
  isUserGold: boolean;
  onExitToExplore: () => void;
  onOpenStore: () => void;
  onSelectMoreSpotsOnMap: () => void;
  onCenterRoute: () => void;
  onUpdateItinerary: (updated: Itinerary) => void;
  onDeleteItinerary: () => void;
  onDeleteStep: (stepId: string) => void;
  onMoveStep: (index: number, direction: 'up' | 'down') => void;
  onImportSpot: (spot: Spot) => void;
  onRenameTitle: (title: string) => void;
  tripNoteText: string;
  onSaveTripNote: (text: string) => void;
}

export const UnifiedItineraryOverlay: React.FC<UnifiedItineraryOverlayProps> = memo(
  ({
    itinerary,
    allSpots,
    activeDayIndex,
    onChangeDayIndex,
    activeStepId,
    onSelectStep,
    isExpanded,
    onChangeExpanded,
    theme,
    mapStyle,
    onToggleMapStyle,
    isUserGold,
    onExitToExplore,
    onOpenStore,
    onSelectMoreSpotsOnMap,
    onCenterRoute,
    onUpdateItinerary,
    onDeleteItinerary,
    onDeleteStep,
    onMoveStep,
    onImportSpot,
    onRenameTitle,
    tripNoteText,
    onSaveTripNote,
  }) => {
    const isDark = theme === 'dark';
    const isSatelliteMap = mapStyle === 'satelite';
    const useLightOnDark = isSatelliteMap || isDark;

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(itinerary.title || 'Meu Roteiro');

    const activeDay = itinerary.days[activeDayIndex] || itinerary.days[0];
    const activeSteps = activeDay?.steps || [];
    const currentSelectedStep =
      activeSteps.find((s) => s.id === activeStepId) || activeSteps[0] || null;
    const isPremiumItinerary = Boolean(itinerary.isPremium);
    const activeStepSpotIds = activeSteps
      .map((s) => s.spot?.id || s.spotId)
      .filter(Boolean) as string[];

    const totalEstimatedMin = activeSteps.reduce(
      (sum, st) => sum + (Number(st.spot?.durationMinutes) || 60),
      0
    );

    const submitTitleRename = () => {
      const clean = editedTitle.trim();
      if (clean && clean !== itinerary.title) {
        onRenameTitle(clean);
      }
      setIsEditingTitle(false);
    };

    return (
      <div className="fixed inset-0 md:left-[var(--desktop-sidebar-width,72px)] z-[42] pointer-events-none select-none overflow-hidden">
        {/* 1. MOBILE TOP HEADER OVERLAY */}
        <div
          className="md:hidden absolute top-0 left-0 right-0 z-30 pointer-events-none flex items-center justify-between gap-2 px-4 sm:px-6"
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 28px)',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            <AppleBackButton
              theme="glass"
              size="explore"
              onClick={onExitToExplore}
              className={useLightOnDark ? '!text-white' : '!text-black'}
              style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
              title="Voltar para Explorar"
              aria-label="Voltar para Explorar"
            />
          </div>

          {/* Dynamic Island Title Pill */}
          <div
            className={`h-12 px-4 sm:px-5 rounded-full pointer-events-auto ios26-liquid-glass flex items-center gap-2.5 text-xs sm:text-sm font-bold max-w-[calc(100vw-148px)] transition-all duration-200 ${
              useLightOnDark ? 'text-white' : 'text-black'
            }`}
            style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
          >
            <RoundedNavigationIcon
              isGold={isPremiumItinerary}
              className="relative z-10 w-[24px] h-[24px] shrink-0"
              style={{
                color: isPremiumItinerary
                  ? undefined
                  : useLightOnDark
                    ? '#FFFFFF'
                    : '#000000',
              }}
              size={24}
            />

            {isEditingTitle ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitTitleRename();
                }}
                className="relative z-10 flex items-center gap-1.5 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  autoFocus
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={submitTitleRename}
                  className={`w-28 sm:w-40 px-2 py-0.5 rounded-xl font-black text-xs outline-none border ${
                    isDark
                      ? 'bg-[#171717] border-white/30 text-white'
                      : 'bg-[#F2F2F2] border-zinc-300 text-black'
                  }`}
                  placeholder="Nome do roteiro..."
                />
                <button
                  type="submit"
                  className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shrink-0 cursor-pointer"
                  title="Salvar"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </form>
            ) : (
              <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                <span
                  onClick={() => {
                    setEditedTitle(itinerary.title || 'Meu Roteiro');
                    setIsEditingTitle(true);
                  }}
                  className="font-black text-sm tracking-tight truncate max-w-[140px] cursor-pointer"
                  title="Toque para editar o nome"
                >
                  {getShortDisplayTitle(itinerary.title || 'Meu Roteiro')}
                </span>
                {isPremiumItinerary && (
                  <span className="px-2 py-0.5 rounded-full bg-metallic-gold-badge border text-[#C28514] dark:text-[#FDE073] text-[9px] font-black uppercase tracking-wider shrink-0">
                    GOLD
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className={`w-[53px] h-[53px] sm:w-[58px] sm:h-[58px] rounded-full ios26-liquid-glass flex items-center justify-center pointer-events-auto transition-all duration-200 active:scale-90 cursor-pointer shrink-0 ${
              useLightOnDark ? 'text-white' : 'text-black'
            }`}
            style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
            title="Opções do roteiro"
            aria-label="Opções do roteiro"
          >
            <SlidersHorizontal
              className="relative z-10 w-6 h-6 stroke-[2]"
              style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
            />
          </button>
        </div>

        {/* 2. MOBILE FLOATING MAP ACTIONS (Center route, Layers, Add Spot, Store) */}
        <div
          className="md:hidden absolute right-3.5 sm:right-6 z-40 pointer-events-auto transition-all duration-300 flex flex-col items-center gap-3"
          style={{
            bottom:
              activeSteps.length > 0 && isExpanded
                ? 'calc(54vh + 16px)'
                : 'calc(max(185px, calc(env(safe-area-inset-bottom, 0px) + 165px)))',
          }}
        >
          <button
            type="button"
            onClick={onCenterRoute}
            className={`w-[50px] h-[50px] rounded-full ios26-liquid-glass flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
              useLightOnDark ? 'text-white' : 'text-black'
            }`}
            style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
            title="Enquadrar rota"
            aria-label="Enquadrar rota"
          >
            <Compass className="relative z-10 w-6 h-6 stroke-[2]" />
          </button>

          <button
            type="button"
            onClick={onToggleMapStyle}
            className={`w-[50px] h-[50px] rounded-full ios26-liquid-glass flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
              useLightOnDark ? 'text-white' : 'text-black'
            }`}
            style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
            title="Alternar camada do mapa"
            aria-label="Alternar camada do mapa"
          >
            <Layers className="relative z-10 w-6 h-6 stroke-[2]" />
          </button>

          <button
            type="button"
            onClick={onSelectMoreSpotsOnMap}
            className={`w-[50px] h-[50px] rounded-full ios26-liquid-glass flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
              useLightOnDark ? 'text-white' : 'text-black'
            }`}
            style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
            title="Selecionar mais pontos no mapa"
            aria-label="Selecionar mais pontos no mapa"
          >
            <Plus className="relative z-10 w-6 h-6 stroke-[2.2]" />
          </button>

          <button
            type="button"
            onClick={onOpenStore}
            className={`w-[50px] h-[50px] rounded-full ios26-liquid-glass flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
              useLightOnDark ? 'text-white' : 'text-black'
            }`}
            style={{ color: useLightOnDark ? '#FFFFFF' : '#000000' }}
            title="Loja de Roteiros"
            aria-label="Loja de Roteiros"
          >
            <Store className="relative z-10 w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* 3. DESKTOP LEFT SIDE PANEL */}
        <aside
          aria-label="Roteiro de Viagem"
          className={`hidden md:flex flex-col absolute top-5 bottom-5 left-5 w-96 lg:w-[420px] z-30 rounded-[28px] overflow-hidden border shadow-[0_12px_40px_rgba(0,0,0,0.14)] pointer-events-auto select-none ${
            isDark
              ? 'bg-[#000000] border-[#262626] text-white'
              : 'bg-[#FFFFFF] border-zinc-200/80 text-[#000000]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            <div
              className={`sticky top-0 z-20 p-4 lg:p-5 pb-3 border-b shrink-0 ${
                isDark ? 'bg-[#000000] border-[#262626]' : 'bg-[#FFFFFF] border-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <RoundedNavigationIcon
                    isGold={isPremiumItinerary}
                    className={`w-6 h-6 shrink-0 ${
                      isPremiumItinerary ? '' : isDark ? 'text-white' : 'text-black'
                    }`}
                    size={24}
                  />
                  <h2 className="text-base font-black uppercase tracking-tight truncate">
                    {getShortDisplayTitle(itinerary.title || 'Meu Roteiro')}
                  </h2>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onExitToExplore}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#171717] hover:bg-white/15 text-white'
                        : 'bg-[#F2F2F2] hover:bg-zinc-200 text-black'
                    }`}
                  >
                    Explorar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                      isDark ? 'bg-[#171717] hover:bg-white/15 text-white' : 'bg-[#F2F2F2] hover:bg-zinc-200 text-black'
                    }`}
                    title="Editar roteiro"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNotesModalOpen(true)}
                    className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                      isDark ? 'bg-[#171717] hover:bg-white/15 text-white' : 'bg-[#F2F2F2] hover:bg-zinc-200 text-black'
                    }`}
                    title="Anotações"
                  >
                    <Notebook className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#858585] font-semibold">
                <span>
                  {activeSteps.length} {activeSteps.length === 1 ? 'parada' : 'paradas'} ·{' '}
                  {formatEstimatedDuration(totalEstimatedMin)}
                </span>
                {itinerary.days.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {itinerary.days.map((day, dIdx) => (
                      <button
                        type="button"
                        key={day.dayNumber}
                        onClick={() => onChangeDayIndex(dIdx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          activeDayIndex === dIdx
                            ? isDark
                              ? 'bg-white text-black'
                              : 'bg-black text-white'
                            : isDark
                              ? 'bg-[#171717] text-[#858585] hover:text-white'
                              : 'bg-[#F2F2F2] text-[#858585] hover:text-black'
                        }`}
                      >
                        Dia {day.dayNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 space-y-2.5">
              <AnimatePresence mode="popLayout">
                {activeSteps.map((step, idx) => (
                  <SwipeableStopCard
                    key={step.id}
                    step={step}
                    idx={idx}
                    totalSteps={activeSteps.length}
                    isSelected={step.id === currentSelectedStep?.id}
                    isDark={isDark}
                    isPremium={isPremiumItinerary}
                    onSelect={onSelectStep}
                    onDelete={onDeleteStep}
                    onMoveUp={(i) => onMoveStep(i, 'up')}
                    onMoveDown={(i) => onMoveStep(i, 'down')}
                  />
                ))}
              </AnimatePresence>

              <div className="pt-2 pb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onSelectMoreSpotsOnMap}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#171717] border-white/10 text-white hover:border-white/30'
                      : 'bg-[#F2F2F2] border-zinc-200 text-black hover:bg-zinc-200'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Editar no Mapa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#171717] border-white/10 text-white hover:border-white/30'
                      : 'bg-[#F2F2F2] border-zinc-200 text-black hover:bg-zinc-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buscar Ponto</span>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* 4. MOBILE COLLAPSED FLOATING STOP CARD & EXPANDABLE DRAWER */}
        <AnimatePresence mode="wait">
          {!isExpanded || activeSteps.length === 0 ? (
            <motion.div
              key="unified-itinerary-collapsed-card"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={SPRING_DRAWER}
              className="md:hidden fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none select-none"
              style={{ bottom: '84px' }}
            >
              {activeSteps.length === 0 ? (
                <button
                  type="button"
                  onClick={onSelectMoreSpotsOnMap}
                  style={{
                    backgroundColor: isDark ? '#171717' : '#FFFFFF',
                  }}
                  className={`w-full max-w-[338px] py-3 px-4 rounded-[28px] flex items-center justify-center gap-3 border pointer-events-auto cursor-pointer shadow-[0_8px_24px_rgba(0,0,0,0.16)] active:scale-95 transition-transform ${
                    isDark ? 'border-white/15 text-white' : 'border-zinc-200/80 text-black'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black dark:bg-white text-white dark:text-black">
                    <Plus className="w-4 h-4 stroke-[2.4]" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider">
                    Selecionar Pontos no Mapa
                  </span>
                </button>
              ) : currentSelectedStep ? (
                <motion.div
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0.2, bottom: 0.05 }}
                  onDragEnd={(_e, info) => {
                    if (info.offset.y < -28 || info.velocity.y < -120) {
                      onChangeExpanded(true);
                    }
                  }}
                  onClick={() => onChangeExpanded(true)}
                  style={{
                    backgroundColor: isDark ? '#171717' : '#FFFFFF',
                  }}
                  className={`w-full max-w-[342px] py-2.5 px-3.5 rounded-[28px] flex items-center justify-between gap-3 border pointer-events-auto cursor-pointer shadow-[0_8px_28px_rgba(0,0,0,0.16)] ${
                    isDark ? 'border-white/15 text-white' : 'border-zinc-200/80 text-black'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${
                        isPremiumItinerary
                          ? 'bg-metallic-gold text-[#1A1202]'
                          : isDark
                            ? 'bg-white text-black'
                            : 'bg-black text-white'
                      }`}
                    >
                      {String(
                        Math.max(
                          1,
                          activeSteps.findIndex((s) => s.id === currentSelectedStep.id) + 1
                        )
                      ).padStart(2, '0')}
                    </span>

                    {currentSelectedStep.spot && (
                      <div className="w-12 h-12 rounded-[14px] overflow-hidden shrink-0 bg-zinc-800">
                        <LazyImage
                          src={getSpotCardThumbnail(currentSelectedStep.spot)}
                          alt={currentSelectedStep.spot.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getSpotFallbackImage(
                              currentSelectedStep.spot?.name || '',
                              currentSelectedStep.spot?.category || 'attractions'
                            );
                          }}
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#858585] leading-none">
                        <span>{currentSelectedStep.suggestedTime || '09:30'}</span>
                        <span>·</span>
                        <span>{formatEstimatedDuration(currentSelectedStep.spot?.durationMinutes)}</span>
                        <span>·</span>
                        <span className="truncate uppercase">
                          {currentSelectedStep.spot?.categoryLabel || 'Local'}
                        </span>
                      </div>
                      <h4 className="text-[14px] font-black uppercase truncate leading-tight my-1">
                        {currentSelectedStep.spot?.name}
                      </h4>
                      <p className="text-[10.5px] font-semibold text-[#858585] truncate leading-none">
                        Toque para ver todas as {activeSteps.length} paradas
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="unified-itinerary-expanded-drawer"
              initial={{ opacity: 0, y: 120 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 120 }}
              transition={SPRING_DRAWER}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.3 }}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 48 || info.velocity.y > 140) {
                  onChangeExpanded(false);
                }
              }}
              className={`md:hidden absolute inset-x-0 bottom-0 z-40 max-w-3xl mx-auto rounded-t-[32px] overflow-hidden flex flex-col pointer-events-auto border-t shadow-[0_-10px_34px_rgba(0,0,0,0.18)] ${
                isDark
                  ? 'bg-[#000000] border-white/10 text-white'
                  : 'bg-[#FFFFFF] border-black/[0.06] text-black'
              }`}
              style={{
                backgroundColor: isDark ? '#000000' : '#FFFFFF',
                maxHeight: '52vh',
                height: '52vh',
                paddingBottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              {/* Drag Handle */}
              <div
                onClick={() => onChangeExpanded(false)}
                className="w-full pt-3 pb-1.5 flex items-center justify-center touch-none shrink-0 cursor-grab active:cursor-grabbing"
              >
                <div className="w-10 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              </div>

              {/* Scrollable Sequential Stops List */}
              <div
                className="flex-1 overflow-y-auto px-4 sm:px-5 py-1.5 space-y-2"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {itinerary.days.length > 1 && (
                  <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar">
                    {itinerary.days.map((day, dIdx) => (
                      <button
                        type="button"
                        key={day.dayNumber}
                        onClick={() => onChangeDayIndex(dIdx)}
                        className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
                          activeDayIndex === dIdx
                            ? isDark
                              ? 'bg-white text-black'
                              : 'bg-black text-white'
                            : isDark
                              ? 'bg-[#171717] text-[#858585] border border-white/10'
                              : 'bg-[#F2F2F2] text-[#858585]'
                        }`}
                      >
                        Dia {day.dayNumber}
                      </button>
                    ))}
                  </div>
                )}

                <AnimatePresence mode="popLayout">
                  {activeSteps.map((step, idx) => (
                    <SwipeableStopCard
                      key={step.id}
                      step={step}
                      idx={idx}
                      totalSteps={activeSteps.length}
                      isSelected={step.id === currentSelectedStep?.id}
                      isDark={isDark}
                      isPremium={isPremiumItinerary}
                      onSelect={onSelectStep}
                      onDelete={onDeleteStep}
                      onMoveUp={(i) => onMoveStep(i, 'up')}
                      onMoveDown={(i) => onMoveStep(i, 'down')}
                    />
                  ))}
                </AnimatePresence>

                <div className="pt-2 pb-6 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={onSelectMoreSpotsOnMap}
                    className={`px-4 py-2.5 rounded-full flex items-center gap-1.5 text-xs font-bold border cursor-pointer active:scale-95 transition-transform ${
                      isDark
                        ? 'bg-[#171717] border-white/15 text-white'
                        : 'bg-[#F2F2F2] border-zinc-200 text-black'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Selecionar no Mapa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className={`px-4 py-2.5 rounded-full flex items-center gap-1.5 text-xs font-bold border cursor-pointer active:scale-95 transition-transform ${
                      isDark
                        ? 'bg-[#171717] border-white/15 text-white'
                        : 'bg-[#F2F2F2] border-zinc-200 text-black'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buscar Ponto</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        {isEditModalOpen && (
          <ItineraryEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            itinerary={itinerary}
            onSave={onUpdateItinerary}
            onDeleteItinerary={onDeleteItinerary}
            onCreateNewItinerary={onSelectMoreSpotsOnMap}
            theme={theme}
            isPremium={isPremiumItinerary}
          />
        )}

        <AnimatePresence>
          {isNotesModalOpen && (
            <TripNotesModal
              isOpen={isNotesModalOpen}
              onClose={() => setIsNotesModalOpen(false)}
              tripNoteText={tripNoteText}
              onSave={onSaveTripNote}
              theme={theme}
            />
          )}
        </AnimatePresence>

        <PlusActionMenuModal
          isOpen={isPlusMenuOpen}
          onClose={() => setIsPlusMenuOpen(false)}
          onCreateNewItinerary={onOpenStore}
          onAddSpot={() => setIsImportModalOpen(true)}
          theme={theme}
          isGoldUser={isUserGold}
        />

        <ImportSpotFloatingModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          spots={allSpots}
          importedSpotIds={activeStepSpotIds}
          onImportSpot={onImportSpot}
          theme={theme}
          isGoldUser={isUserGold}
        />
      </div>
    );
  }
);
