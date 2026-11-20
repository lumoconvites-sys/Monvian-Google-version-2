import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  MapPin,
  ChevronRight,
  Play,
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { Itinerary } from '../../types';
import { getSpotImage, getSpotFallbackImage } from '../../utils/spotImages';
import { useIOSBackEntry } from '../../services/iosNavigationManager';
import { AppleBackButton } from '../ui/AppleBackButton';
import { PlatanoLeafIcon } from '../platanos/PlatanoLeafIcon';

interface ItineraryStoreDetailModalProps {
  itinerary: Itinerary | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyItinerary: (itinerary: Itinerary) => Promise<void>;
  onOpenWalletTopUp?: () => void;
  platanoPrice?: number;
  isUnlocked?: boolean;
  theme?: 'dark' | 'light';
}

function isValidContent(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return (
    trimmed.length > 0 &&
    trimmed !== '.' &&
    trimmed !== '-' &&
    trimmed !== 'undefined' &&
    trimmed !== 'null'
  );
}

function cleanDayTitle(rawTitle: string, dayNumber: number): string {
  if (!isValidContent(rawTitle)) return '';
  const cleaned = rawTitle
    .replace(new RegExp(`^Dia\\s*${dayNumber}\\s*[:•·-]?\\s*`, 'i'), '')
    .replace(new RegExp(`^Dia\\s*${dayNumber}\\s*[:•·-]?\\s*`, 'i'), '')
    .trim();
  if (cleaned.toLowerCase() === `dia ${dayNumber}`) return '';
  return cleaned;
}

const RitmoOtimizadoIcon: React.FC<{ className?: string }> = ({
  className = 'w-[15px] h-[15px]',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
    <path d="M13 7.5 9.5 12h3.5l-1 4.5 3.5-4.5H12l1-4.5Z" fill="currentColor" stroke="none" />
  </svg>
);

export const ItineraryStoreDetailModal: React.FC<ItineraryStoreDetailModalProps> = ({
  itinerary,
  isOpen,
  onClose,
  onApplyItinerary,
  platanoPrice = 0,
  isUnlocked = true,
  theme = 'light',
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const heroImgRef = useRef<HTMLImageElement | null>(null);
  const pullDownY = useMotionValue(0);
  const pullDownScale = useTransform(pullDownY, [0, 380], [1, 0.94]);
  const pullDownRadius = useTransform(pullDownY, [0, 100], [30, 32]);
  const pullBackdropOpacity = useTransform(pullDownY, [0, 340], [1, 0.12]);

  // Register iOS Edge-Swipe Back Navigation for Itinerary Detail Modal
  useIOSBackEntry({
    id: `itinerary-store-detail:${itinerary?.id || 'active'}`,
    enabled: Boolean(isOpen && itinerary),
    priority: 245,
    label: itinerary?.title || 'Detalhes do Roteiro',
    foregroundSelector: '#itinerary-store-detail-card',
    backgroundSelector: '#itinerary-explore-layer',
    getBackdropEl: () => document.getElementById('itinerary-store-detail-backdrop'),
    onPop: onClose,
  });

  // Smooth scroll-driven blur & scale effect on sticky cover image as card slides up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const rawScrollTop = e.currentTarget.scrollTop;
    const scrollTop = rawScrollTop < 0 ? 0 : rawScrollTop;
    if (!heroImgRef.current) return;

    const progress = Math.min(1, Math.max(0, scrollTop / 220));
    const blurPx = progress * 16;
    const scale = 1.04 + progress * 0.04;
    const brightness = 1 - progress * 0.12;

    if (progress <= 0.002) {
      heroImgRef.current.style.filter = 'none';
      heroImgRef.current.style.transform = 'scale(1.04) translateZ(0)';
      heroImgRef.current.style.webkitTransform = 'scale(1.04) translateZ(0)';
    } else {
      heroImgRef.current.style.filter = `blur(${blurPx.toFixed(1)}px) brightness(${brightness.toFixed(2)})`;
      heroImgRef.current.style.transform = `scale(${scale.toFixed(3)}) translateZ(0)`;
      heroImgRef.current.style.webkitTransform = `scale(${scale.toFixed(3)}) translateZ(0)`;
    }
  };

  useEffect(() => {
    pullDownY.set(0);
    setActiveDayIndex(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    if (heroImgRef.current) {
      heroImgRef.current.style.filter = 'none';
      heroImgRef.current.style.transform = 'scale(1.04) translateZ(0)';
      heroImgRef.current.style.webkitTransform = 'scale(1.04) translateZ(0)';
    }
  }, [itinerary?.id, isOpen, pullDownY]);

  // Smooth native iOS pull-down-to-dismiss gesture when scrolled to top
  useEffect(() => {
    if (!isOpen || !itinerary) return;
    const container = sheetRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isCandidate = false;
    let isPulling = false;
    let currentDragY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX < 28) {
        isCandidate = false;
        isPulling = false;
        return;
      }
      const scrollTop = scrollRef.current ? scrollRef.current.scrollTop : 0;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      isCandidate = scrollTop <= 2;
      isPulling = false;
      currentDragY = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isCandidate || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!isPulling) {
        if (dy > 4 && dy > Math.abs(dx) * 1.1) {
          isPulling = true;
        } else if (Math.abs(dx) > 10 || dy < -6) {
          isCandidate = false;
          return;
        } else {
          return;
        }
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      currentDragY = Math.max(0, dy * 0.9);
      pullDownY.set(currentDragY);
    };

    const onTouchEnd = () => {
      if (!isPulling) {
        isCandidate = false;
        return;
      }
      const elapsed = Math.max(16, performance.now() - startTime);
      const velocityY = currentDragY / elapsed;

      isCandidate = false;
      isPulling = false;

      if (currentDragY > 90 || (currentDragY > 36 && velocityY > 0.38)) {
        onClose();
      } else {
        animate(pullDownY, 0, {
          type: 'spring',
          stiffness: 420,
          damping: 36,
        });
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isOpen, itinerary?.id, onClose, pullDownY]);

  // Immediately close modal when user clicks any option on the navigation bar
  useEffect(() => {
    const handleCloseAll = () => {
      onClose();
    };
    window.addEventListener('monvian-close-modals', handleCloseAll);
    return () => window.removeEventListener('monvian-close-modals', handleCloseAll);
  }, [onClose]);

  const lastItineraryRef = useRef<Itinerary | null>(itinerary);
  if (itinerary) {
    lastItineraryRef.current = itinerary;
  }
  const activeItinerary = itinerary || lastItineraryRef.current;

  const isLight = theme !== 'dark';
  const totalStops = activeItinerary
    ? activeItinerary.placesCount ||
      activeItinerary.days.reduce((acc, d) => acc + d.steps.length, 0)
    : 0;
  const currentDay = activeItinerary
    ? activeItinerary.days[activeDayIndex] || activeItinerary.days[0]
    : undefined;

  const requiresPurchase = platanoPrice > 0 && !isUnlocked;

  const handleAdd = async () => {
    if (!activeItinerary) return;

    try {
      setIsApplying(true);
      await onApplyItinerary(activeItinerary);
      if (!requiresPurchase) {
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsApplying(false);
    }
  };

  const daySubtitle = currentDay
    ? cleanDayTitle(currentDay.title || '', currentDay.dayNumber || activeDayIndex + 1)
    : '';
  const sectionTitle = daySubtitle || 'Experiências e Paradas';

  const hasSwitchedDayRef = useRef(false);
  useEffect(() => {
    hasSwitchedDayRef.current = false;
  }, [itinerary?.id, isOpen]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && activeItinerary && (
        <motion.div
          id="itinerary-store-detail-backdrop"
          key="itinerary-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex flex-col"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Dim scrim that fades dynamically when pulling card down to reveal previous page */}
          <motion.div
            aria-hidden="true"
            style={{ opacity: pullBackdropOpacity }}
            className={`absolute inset-0 pointer-events-none ${
              isLight ? 'bg-black/28' : 'bg-black/50'
            }`}
          />

          {/* Fullscreen Smooth GPU-Composited Page Container (Pure transform slide avoids blur-layer stutter) */}
          <motion.div
            id="itinerary-store-detail-card"
            key={`itinerary-detail-content-${activeItinerary.id}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              stiffness: 360,
              damping: 34,
              mass: 0.82,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full h-full flex flex-col max-w-xl mx-auto overflow-hidden bg-transparent"
            style={{
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform',
            }}
          >
            <motion.div
              ref={sheetRef}
              style={{
                y: pullDownY,
                scale: pullDownScale,
                borderTopLeftRadius: pullDownRadius,
                borderTopRightRadius: pullDownRadius,
                willChange: 'transform',
              }}
              className={`relative w-full h-full flex flex-col overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.20)] ${
                isLight ? 'bg-[#FFFFFF] text-[#111111]' : 'bg-[#000000] text-[#FFFFFF]'
              }`}
            >
              {/* Scrollable Body com blur dinâmico na foto de capa ao rolar */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overscroll-none rounded-t-[30px]"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehaviorY: 'none',
                  transform: 'translate3d(0, 0, 0)',
                  WebkitTransform: 'translate3d(0, 0, 0)',
                }}
              >
                {/* 1. HERO / FOTO DE CAPA FIXA NO TOPO COM BLUR DINÂMICO AO SUBIR O CARD */}
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    overflow: 'clip',
                    isolation: 'isolate',
                    transform: 'translate3d(0, 0, 0)',
                    WebkitTransform: 'translate3d(0, 0, 0)',
                  }}
                  className="sticky top-0 w-full h-72 sm:h-80 shrink-0 overflow-hidden bg-zinc-900 rounded-t-[30px] z-0 pointer-events-none"
                >
                  <motion.div
                    initial={{ scale: 1.12 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
                    style={{ willChange: 'transform' }}
                    className="w-full h-full relative"
                  >
                    <img
                      ref={heroImgRef}
                      src={activeItinerary.coverImage}
                      alt={activeItinerary.title}
                      decoding="async"
                      style={{
                        filter: 'none',
                        transform: 'scale(1.04) translate3d(0, 0, 0)',
                        WebkitTransform: 'scale(1.04) translate3d(0, 0, 0)',
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                      className="w-full h-full object-cover rounded-t-[30px] pointer-events-none transform-gpu"
                      referrerPolicy="no-referrer"
                      loading="eager"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80';
                      }}
                    />
                  </motion.div>

                  {/* Degradê sutil para legibilidade dos controles translúcidos sobre a foto */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent pointer-events-none" />

                  {/* Header Translúcido Sobre a Foto com Safe Area */}
                  <div
                    className="absolute top-0 inset-x-0 px-4 flex items-center justify-between z-10 pointer-events-auto"
                    style={{
                      paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 14px)',
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.78, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 460, damping: 28, delay: 0.1 }}
                    >
                      <AppleBackButton
                        theme="overlay"
                        onClick={onClose}
                        title="Voltar"
                        aria-label="Voltar"
                        className="w-9 h-9"
                      />
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.78, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 460, damping: 28, delay: 0.14 }}
                      className="flex items-center gap-2"
                    >
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        type="button"
                        disabled={isApplying}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdd();
                        }}
                        className={`apple-back-btn apple-back-btn-overlay h-9 ${
                          requiresPurchase ? 'px-3 gap-1.5' : 'w-9 justify-center'
                        } rounded-full flex items-center shrink-0 select-none cursor-pointer transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          isApplying
                            ? 'Iniciando...'
                            : requiresPurchase
                              ? `Liberar por ${platanoPrice} Plátanos`
                              : 'Iniciar roteiro'
                        }
                        aria-label={
                          isApplying
                            ? 'Iniciando...'
                            : requiresPurchase
                              ? `Liberar por ${platanoPrice} Plátanos`
                              : 'Iniciar roteiro'
                        }
                      >
                        {isApplying ? (
                          <div className="w-[16px] h-[16px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : requiresPurchase ? (
                          <>
                            <PlatanoLeafIcon
                              className="relative z-10 w-[22px] h-[22px] shrink-0 pointer-events-none"
                              variant="monochrome"
                            />
                            <span className="relative z-10 text-[12px] font-semibold tracking-tight tabular-nums pointer-events-none">
                              {platanoPrice}
                            </span>
                          </>
                        ) : (
                          <Play className="relative z-10 w-[16px] h-[16px] fill-current text-current translate-x-[1px] pointer-events-none" />
                        )}
                      </motion.button>
                    </motion.div>
                  </div>
                </div>

                {/* 2. CARD PRINCIPAL DESLIZANTE (Sistema translúcido ao subir sobre a foto + conteúdo dinâmico sem travamentos) */}
                <div
                  style={{
                    transform: 'translate3d(0, 0, 0)',
                    WebkitTransform: 'translate3d(0, 0, 0)',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 28px), 34px)',
                  }}
                  className={`relative -mt-6 z-10 min-h-[calc(var(--app-height,100dvh)-220px)] rounded-t-[32px] sm:rounded-t-[36px] px-5 pt-6 backdrop-blur-xl ${
                    isLight
                      ? 'bg-[#FFFFFF]/92 text-[#111111] border-t border-white/70 shadow-[0_-8px_32px_rgba(0,0,0,0.08)]'
                      : 'bg-[#000000]/92 text-[#FFFFFF] border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  {/* TÍTULO GRANDE COM QUEBRA NATURAL */}
                  <motion.h1
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.08 }}
                    className={`text-[30px] sm:text-[32px] font-bold tracking-[-0.025em] leading-[1.12] ${
                      isLight ? 'text-[#0B0B0C]' : 'text-[#FFFFFF]'
                    }`}
                  >
                    {activeItinerary.title}
                  </motion.h1>

                  {/* INFORMAÇÕES DO ROTEIRO (Alinhadas à esquerda, proporção fiel à referência) */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.12 }}
                    className="mt-4 flex flex-col items-start gap-2"
                  >
                    {/* Linha 1: 2 dias · 5 paradas · Grátis */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className={`h-[32px] px-3 rounded-full border flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0 tabular-nums ${
                          isLight
                            ? 'bg-[#FFFFFF] border-[#E7E7EA] text-[#1C1C1E]'
                            : 'bg-[#171717] border-white/10 text-[#F4F4F5]'
                        }`}
                      >
                        <Clock className="w-[15px] h-[15px] shrink-0" strokeWidth={1.9} />
                        <span>{`${activeItinerary.daysCount} ${activeItinerary.daysCount === 1 ? 'dia' : 'dias'}`}</span>
                      </div>

                      <div
                        className={`h-[32px] px-3 rounded-full border flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0 tabular-nums ${
                          isLight
                            ? 'bg-[#FFFFFF] border-[#E7E7EA] text-[#1C1C1E]'
                            : 'bg-[#171717] border-white/10 text-[#F4F4F5]'
                        }`}
                      >
                        <MapPin className="w-[15px] h-[15px] shrink-0" strokeWidth={1.9} />
                        <span>{`${totalStops} ${totalStops === 1 ? 'parada' : 'paradas'}`}</span>
                      </div>

                      <div
                        className={`h-[32px] px-3 rounded-full border flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0 tabular-nums ${
                          isLight
                            ? 'bg-[#FFFFFF] border-[#E7E7EA] text-[#1C1C1E]'
                            : 'bg-[#171717] border-white/10 text-[#F4F4F5]'
                        }`}
                      >
                        <PlatanoLeafIcon className="w-[18px] h-[18px] shrink-0" variant="monochrome" />
                        <span>
                          {platanoPrice > 0
                            ? isUnlocked
                              ? 'Liberado'
                              : `${platanoPrice} Plátanos`
                            : 'Grátis'}
                        </span>
                      </div>
                    </div>

                    {/* Linha 2: Ritmo otimizado */}
                    <div
                      className={`h-[32px] px-3 rounded-full border inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap shrink-0 ${
                        isLight
                          ? 'bg-[#FFFFFF] border-[#E7E7EA] text-[#1C1C1E]'
                          : 'bg-[#171717] border-white/10 text-[#F4F4F5]'
                      }`}
                    >
                      <RitmoOtimizadoIcon className="w-[15px] h-[15px] shrink-0" />
                      <span>Ritmo otimizado</span>
                    </div>
                  </motion.div>

                  {/* SELETOR DE DIAS (Lado a lado com indicador animado e resposta tátil) */}
                  {activeItinerary.days.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.15 }}
                      className="mt-5 flex items-center gap-2.5 overflow-x-auto no-scrollbar"
                    >
                      {activeItinerary.days.map((d, idx) => {
                        const isSelected = activeDayIndex === idx;
                        return (
                          <motion.button
                            key={d.id || idx}
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => {
                              hasSwitchedDayRef.current = true;
                              setActiveDayIndex(idx);
                            }}
                            className={`relative h-[38px] min-w-[96px] px-6 rounded-full text-[14px] font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap overflow-hidden ${
                              isSelected
                                ? isLight
                                  ? 'text-[#FFFFFF]'
                                  : 'text-[#000000]'
                                : isLight
                                  ? 'bg-[#F1F2F4] text-[#52525B] hover:bg-[#E7E8EC]'
                                  : 'bg-[#171717] text-[#A1A1AA] hover:text-white'
                            }`}
                          >
                            {isSelected && (
                              <motion.span
                                layoutId="itinerary-active-day-pill"
                                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                                className={`absolute inset-0 rounded-full ${
                                  isLight ? 'bg-[#0B0B0C]' : 'bg-[#FFFFFF]'
                                }`}
                              />
                            )}
                            <span className="relative z-10">{`Dia ${d.dayNumber || idx + 1}`}</span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* CABEÇALHO DA LISTA + CARTÕES DAS PARADAS */}
                  <div className="mt-6">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 30, delay: 0.16 }}
                      className="flex items-center justify-between gap-2"
                    >
                      <h2
                        className={`text-[18px] font-bold tracking-[-0.015em] ${
                          isLight ? 'text-[#0B0B0C]' : 'text-[#FFFFFF]'
                        }`}
                      >
                        {sectionTitle}
                      </h2>
                      <span
                        className={`text-[14px] font-medium tabular-nums shrink-0 ${
                          isLight ? 'text-[#6B7280]' : 'text-[#A1A1AA]'
                        }`}
                      >
                        {`(${currentDay?.steps.length || 0})`}
                      </span>
                    </motion.div>

                    <div className="mt-3.5 space-y-3">
                      {currentDay?.steps.map((step, idx) => {
                        const stepNumber = String(idx + 1).padStart(2, '0');
                        const spot = step.spot;
                        const spotName =
                          step.customName || spot?.name || step.spotName || 'Ponto Turístico';
                        const spotCategory =
                          spot?.categoryLabel ||
                          step.categoryLabel ||
                          spot?.category ||
                          step.category ||
                          'Atração';
                        const spotImg = getSpotImage({
                          id: spot?.id,
                          name: spotName,
                          category: spotCategory,
                          image: step.customImage || spot?.image || activeItinerary.coverImage,
                        });
                        const locationText = isValidContent(spot?.address)
                          ? spot?.address
                          : isValidContent(step.customDescription)
                            ? step.customDescription
                            : isValidContent(step.notes)
                              ? step.notes
                              : isValidContent(spot?.description)
                                ? spot?.description
                                : spot?.touristTip;

                        return (
                          <motion.div
                            key={`${activeDayIndex}-${step.id || idx}`}
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 400,
                              damping: 30,
                              delay:
                                (hasSwitchedDayRef.current ? 0.02 : 0.14) +
                                Math.min(idx, 5) * 0.035,
                            }}
                            whileTap={{ scale: 0.975 }}
                            className={`rounded-[24px] px-3.5 py-3 border flex items-center gap-3 cursor-pointer ${
                              isLight
                                ? 'bg-[#FFFFFF] border-black/[0.04] shadow-[0_4px_18px_rgba(0,0,0,0.045)]'
                                : 'bg-[#171717] border-white/10'
                            }`}
                          >
                            {/* Numeração à esquerda */}
                            <div
                              className={`w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 text-[12px] font-semibold tabular-nums ${
                                isLight
                                  ? 'bg-[#F2F2F4] text-[#18181B]'
                                  : 'bg-white/15 text-[#FFFFFF]'
                              }`}
                            >
                              {stepNumber}
                            </div>

                            {/* Imagem quadrada arredondada */}
                            <div
                              className={`w-[68px] h-[68px] rounded-[16px] overflow-hidden shrink-0 ${
                                isLight ? 'bg-[#F3F4F6]' : 'bg-zinc-800'
                              }`}
                            >
                              <img
                                src={spotImg}
                                alt={spotName}
                                decoding="async"
                                className="w-full h-full object-cover"
                                loading="eager"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = getSpotFallbackImage(
                                    spotName,
                                    spotCategory
                                  );
                                }}
                              />
                            </div>

                            {/* Informações no centro */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <span
                                className={`text-[10.5px] font-medium uppercase tracking-[0.04em] truncate leading-tight ${
                                  isLight ? 'text-[#71717A]' : 'text-[#A1A1AA]'
                                }`}
                              >
                                {spotCategory}
                              </span>

                              <h4
                                className={`text-[15.5px] font-bold tracking-[-0.015em] truncate leading-snug mt-0.5 ${
                                  isLight ? 'text-[#111111]' : 'text-[#FFFFFF]'
                                }`}
                              >
                                {spotName}
                              </h4>

                              {isValidContent(locationText) && (
                                <div className="flex items-center gap-1 mt-0.5 min-w-0">
                                  <MapPin
                                    className={`w-3 h-3 shrink-0 ${
                                      isLight ? 'text-[#71717A]' : 'text-[#A1A1AA]'
                                    }`}
                                    strokeWidth={1.8}
                                  />
                                  <span
                                    className={`text-[12px] font-normal truncate leading-tight ${
                                      isLight ? 'text-[#71717A]' : 'text-[#A1A1AA]'
                                    }`}
                                  >
                                    {locationText}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Horário e seta à direita */}
                            <div className="self-stretch flex flex-col items-end justify-between shrink-0 pl-1 py-0.5">
                              {isValidContent(step.suggestedTime) ? (
                                <span
                                  className={`text-[13px] font-medium tabular-nums leading-tight ${
                                    isLight ? 'text-[#1C1C1E]' : 'text-[#D4D4D8]'
                                  }`}
                                >
                                  {step.suggestedTime}
                                </span>
                              ) : (
                                <span />
                              )}
                              <ChevronRight
                                className={`w-[18px] h-[18px] my-auto ${
                                  isLight ? 'text-[#3F3F46]' : 'text-[#A1A1AA]'
                                }`}
                                strokeWidth={2}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
