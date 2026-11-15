import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  MapPin,
  Compass,
  Lightbulb,
  Heart,
  Play,
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { Itinerary } from '../../types';
import { getSpotImage, getSpotFallbackImage } from '../../utils/spotImages';
import { useFavorites } from '../../hooks/useFavorites';
import { useIOSBackEntry } from '../../services/iosNavigationManager';
import { AppleBackButton } from '../ui/AppleBackButton';

interface ItineraryStoreDetailModalProps {
  itinerary: Itinerary | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyItinerary: (itinerary: Itinerary) => Promise<void>;
  onOpenWalletTopUp?: () => void;
  theme?: 'dark' | 'light';
}

const TAG_TRANSLATIONS: Record<string, string> = {
  'romantic': 'Romântico',
  'popular': 'Popular',
  'nature': 'Natureza',
  'gastronomy': 'Gastronomia',
  'adventure': 'Aventura',
  '1day': '1 Dia',
  '2days': '2 Dias',
  '3days': '3 Dias',
  '4days': '4 Dias',
  'family': 'Família',
  'sunset': 'Pôr do Sol',
  'shopping': 'Compras',
  'nightlife': 'Noite',
  'parks': 'Parques',
  'cafes': 'Cafés & Bistrôs',
  'sweets': 'Chocolates'
};

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
  // Remove redundant "Dia X • Dia X" or "Dia X: "
  let cleaned = rawTitle
    .replace(new RegExp(`^Dia\\s*${dayNumber}\\s*[:•·-]?\\s*`, 'i'), '')
    .replace(new RegExp(`^Dia\\s*${dayNumber}\\s*[:•·-]?\\s*`, 'i'), '')
    .trim();
  if (cleaned.toLowerCase() === `dia ${dayNumber}`) return '';
  return cleaned;
}

export const ItineraryStoreDetailModal: React.FC<ItineraryStoreDetailModalProps> = ({
  itinerary,
  isOpen,
  onClose,
  onApplyItinerary,
  theme = 'dark',
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const { isItinerarySaved, toggleItinerary } = useFavorites();
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

  // Smooth scroll-driven blur & scale effect (native iOS fluid feel)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const rawScrollTop = e.currentTarget.scrollTop;
    const scrollTop = rawScrollTop < 0 ? 0 : rawScrollTop;
    if (!heroImgRef.current) return;

    // As user scrolls down and the card climbs over the sticky hero photo:
    // progress smoothly scales from 0 (top) to 1 (when card has covered 220px).
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    if (heroImgRef.current) {
      heroImgRef.current.style.filter = 'none';
      heroImgRef.current.style.transform = 'scale(1.04) translateZ(0)';
      heroImgRef.current.style.webkitTransform = 'scale(1.04) translateZ(0)';
    }
  }, [itinerary?.id, isOpen, pullDownY]);

  // Smooth native iOS pull-down-to-dismiss gesture when scrolled to top (prevents white overscroll gap)
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
      // Leave left-edge zone free for iOS edge-swipe back navigation
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

  const isLight = theme === 'light';
  const totalStops = activeItinerary
    ? activeItinerary.placesCount ||
      activeItinerary.days.reduce((acc, d) => acc + d.steps.length, 0)
    : 0;
  const currentDay = activeItinerary
    ? activeItinerary.days[activeDayIndex] || activeItinerary.days[0]
    : undefined;

  // Limit visible tags to max 3
  const visibleTags = (activeItinerary?.categories || [])
    .filter(cat => isValidContent(cat))
    .slice(0, 3)
    .map(cat => TAG_TRANSLATIONS[cat.toLowerCase()] || cat.toUpperCase());

  const handleAdd = async () => {
    if (!activeItinerary) return;

    try {
      setIsApplying(true);
      await onApplyItinerary(activeItinerary);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsApplying(false);
    }
  };

  const daySubtitle = currentDay ? cleanDayTitle(currentDay.title || '', currentDay.dayNumber || activeDayIndex + 1) : '';

  const modalContent = (
    <>
      <AnimatePresence>
        {isOpen && activeItinerary && (
          <motion.div
            id="itinerary-store-detail-backdrop"
            key="itinerary-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClose}
            className="fixed inset-0 z-[200] flex flex-col"
            style={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              willChange: 'opacity',
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
          {/* Fullscreen Smooth GPU-Composited Page Container */}
          <motion.div
            id="itinerary-store-detail-card"
            key={`itinerary-detail-content-${activeItinerary.id}`}
            initial={{ opacity: 0, y: 38, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 26, scale: 0.99 }}
            transition={{
              duration: 0.86,
              ease: [0.16, 1, 0.3, 1],
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full h-full flex flex-col max-w-xl mx-auto overflow-hidden bg-transparent"
            style={{
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform, opacity',
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
              isLight ? 'text-zinc-900' : 'text-white'
            }`}
          >
          {/* Scrollable Body com blur dinâmico ao rolar */}
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
            
            {/* 1. HERO / FOTO DE CAPA (FOTO FIXA NO TOPO - STICKY HERO COM BLUR DINÂMICO) */}
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
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                style={{ willChange: 'transform, opacity' }}
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
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80';
                  }}
                />
              </motion.div>
              
              {/* Degradê sutil na parte inferior para legibilidade */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent pointer-events-none" />

              {/* Header Minimalista Sobre a Foto com Safe Area */}
              <div
                className="absolute top-0 inset-x-0 px-4 flex items-center justify-between z-10 pointer-events-auto"
                style={{
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 14px)'
                }}
              >
                {/* Botão Voltar */}
                <AppleBackButton
                  theme="overlay"
                  onClick={onClose}
                  title="Voltar"
                  aria-label="Voltar"
                />

                {/* Direita: Botão Curtir Roteiro */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItinerary(activeItinerary.id);
                    }}
                    className="w-10 h-10 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-90 bg-transparent border-none shadow-none outline-none"
                    title={isItinerarySaved(activeItinerary.id) ? 'Remover dos salvos' : 'Salvar roteiro'}
                    aria-label={isItinerarySaved(activeItinerary.id) ? 'Remover dos salvos' : 'Salvar roteiro'}
                  >
                    <Heart
                      className={`w-8 h-8 transition-all stroke-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${
                        isItinerarySaved(activeItinerary.id)
                          ? 'fill-rose-500 text-rose-500'
                          : 'fill-white/90 text-white/90'
                      }`}
                    />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* CONTEÚDO PRINCIPAL COM ENTRADA SUAVE E LEVE */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.88, ease: [0.16, 1, 0.3, 1], delay: 0.14 }}
              style={{
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform, opacity',
                backgroundColor: isLight ? '#ffffff' : undefined,
              }}
              className={`relative -mt-6 z-10 min-h-[calc(var(--app-height,100dvh)-220px)] rounded-t-[32px] sm:rounded-t-[36px] px-5 pt-6 pb-0 space-y-4 ${
                isLight
                  ? 'bg-[#ffffff] text-zinc-900 border-t border-black/5 shadow-[0_-8px_32px_rgba(0,0,0,0.08)]'
                  : 'bg-[#000000] text-white border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]'
              }`}
            >
              
              {/* 2. TAGS (MÁXIMO 3, LIMPAS E SEM POLUIÇÃO) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
                className="space-y-3.5"
              >
              {visibleTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {visibleTags.map((tag, idx) => (
                    <React.Fragment key={idx}>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        isLight ? 'text-zinc-500' : 'text-zinc-400'
                      }`}>
                        {tag}
                      </span>
                      {idx < visibleTags.length - 1 && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600">·</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* 3. TÍTULO E DESCRIÇÃO CURTA */}
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${
                    isLight ? 'text-zinc-900' : 'text-white'
                  }`}>
                    {activeItinerary.title}
                  </h1>
                </div>

                {isValidContent(activeItinerary.description) && (
                  <p className={`text-xs sm:text-sm leading-relaxed font-normal ${
                    isLight ? 'text-zinc-600' : 'text-zinc-400'
                  }`}>
                    {activeItinerary.description}
                  </p>
                )}
              </div>

              {/* 4. INFORMAÇÕES PRINCIPAIS (LINHA ÚNICA, MINIMALISTA) */}
              <div
                className={`flex items-center gap-2 py-2.5 border-y text-xs font-semibold ${
                  isLight ? 'border-zinc-100 text-zinc-600' : 'border-white/10 text-zinc-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-black' : 'text-white'}`} />
                  <span>{activeItinerary.daysCount} {activeItinerary.daysCount === 1 ? 'dia' : 'dias'}</span>
                </span>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-black' : 'text-white'}`} />
                  <span>{totalStops} {totalStops === 1 ? 'parada' : 'paradas'}</span>
                </span>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-1.5">
                  <Compass className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-black' : 'text-white'}`} />
                  <span>Ritmo otimizado</span>
                </span>
              </div>
              </motion.div>

              {/* 5. DICAS DO GUIA (COMPACTO E SEM CAIXAS VAZIAS) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1], delay: 0.30 }}
                className="space-y-4"
              >
              {isValidContent(activeItinerary.tips || activeItinerary.notes) && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
                    isLight
                      ? 'bg-zinc-50/80 border-zinc-200/70 text-zinc-800'
                      : 'bg-white/[0.03] border-white/10 text-zinc-200'
                  }`}
                >
                  <Lightbulb className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-black' : 'text-white'}`} />
                  <div className="space-y-0.5 text-xs">
                    <span className="font-bold block text-zinc-900 dark:text-white">
                      Dicas do guia
                    </span>
                    <p className={`leading-relaxed ${
                      isLight ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                      {activeItinerary.tips || activeItinerary.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* 6. DIAS DO ROTEIRO (NAVEGAÇÃO SIMPLES) */}
              <div className="pt-2 space-y-2">
                {activeItinerary.days.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {activeItinerary.days.map((d, idx) => {
                      const isSelected = activeDayIndex === idx;
                      return (
                        <button
                          key={d.id || idx}
                          type="button"
                          onClick={() => setActiveDayIndex(idx)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95 cursor-pointer shrink-0 ${
                            isSelected
                              ? isLight ? 'expo-liquid-glass-btn text-black font-extrabold border border-black/15 shadow-sm' : 'bg-white text-black border border-white shadow-2xs'
                              : isLight
                              ? 'expo-liquid-glass-btn text-zinc-600 hover:text-black opacity-80'
                              : 'expo-liquid-glass-btn text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          Dia {d.dayNumber || idx + 1}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Subtítulo ou resumo do dia selecionado */}
                {daySubtitle && (
                  <p className={`text-xs font-bold ${
                    isLight ? 'text-zinc-800' : 'text-zinc-300'
                  }`}>
                    {daySubtitle}
                  </p>
                )}
                {isValidContent(currentDay?.summary) && (
                  <p className={`text-xs ${
                    isLight ? 'text-zinc-500' : 'text-zinc-400'
                  }`}>
                    {currentDay.summary}
                  </p>
                )}
              </div>
              </motion.div>

              {/* 7. CONTEÚDO DAS PARADAS */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.80, ease: [0.16, 1, 0.3, 1], delay: 0.36 }}
                className="pt-1 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${
                    isLight ? 'text-zinc-500' : 'text-zinc-400'
                  }`}>
                    Paradas ({currentDay?.steps.length || 0})
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {currentDay?.steps.map((step, idx) => {
                    const stepNumber = String(idx + 1).padStart(2, '0');
                    const spot = step.spot;
                    const spotName = step.customName || spot?.name || 'Ponto Turístico';
                    const spotCategory = spot?.categoryLabel || spot?.category || 'Atração';
                    const spotImg = getSpotImage({
                      id: spot?.id,
                      name: spotName,
                      category: spotCategory,
                      image: step.customImage || spot?.image || activeItinerary.coverImage,
                    });
                    const descriptionText = step.customDescription || step.notes || spot?.description || spot?.touristTip;

                    return (
                      <div
                        key={`${activeDayIndex}-${step.id || idx}`}
                        className={`relative overflow-hidden p-3 rounded-2xl border flex items-center gap-3 transition-transform active:scale-[0.98] ${
                          isLight
                            ? 'bg-white/90 border-zinc-200/80 shadow-2xs'
                            : 'bg-white/[0.03] border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {/* Número da parada */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                            isLight ? 'bg-black/10 text-black' : 'bg-white/15 text-white'
                          }`}>
                            {stepNumber}
                          </div>

                          {/* Foto da parada */}
                          <div className="w-14 h-14 rounded-[15px] overflow-hidden shrink-0 bg-zinc-800 border border-zinc-200/40 dark:border-white/10">
                            <img
                              src={spotImg}
                              alt={spotName}
                              decoding="async"
                              className="w-full h-full object-cover"
                              loading="eager"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getSpotFallbackImage(spotName, spotCategory);
                              }}
                            />
                          </div>

                          {/* Informações da parada */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                                isLight ? 'text-black' : 'text-white'
                              }`}>
                                {spotCategory}
                              </span>
                              {isValidContent(step.suggestedTime) && (
                                <span className={`text-[11px] font-medium shrink-0 ${
                                  isLight ? 'text-zinc-400' : 'text-zinc-500'
                                }`}>
                                  {step.suggestedTime}
                                </span>
                              )}
                            </div>

                            <h4 className={`text-xs sm:text-sm font-black truncate mt-0.5 ${
                              isLight ? 'text-zinc-900' : 'text-white'
                            }`}>
                              {spotName}
                            </h4>

                            {isValidContent(descriptionText) && (
                              <p className={`text-[11px] leading-tight line-clamp-1 mt-0.5 ${
                                isLight ? 'text-zinc-500' : 'text-zinc-400'
                              }`}>
                                {descriptionText}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Espaçamento justo para que a última parada fique alinhada perfeitamente acima do botão Play flutuante, sem espaços desnecessários */}
                <div
                  aria-hidden="true"
                  className="w-full shrink-0 select-none pointer-events-none"
                  style={{
                    height: 'max(calc(env(safe-area-inset-bottom, 0px) + 72px), 76px)',
                  }}
                />
              </motion.div>

            </motion.div>
          </div>

          {/* 11. BOTÃO DE AÇÃO FLUTUANTE (100% FLUTUANTE, SEM PLACA BRANCA OU CONTAINER RETANGULAR ATRÁS) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1], delay: 0.38 }}
            className="absolute bottom-0 inset-x-0 z-30 px-5 flex justify-center pointer-events-none select-none bg-transparent border-none shadow-none"
            style={{
              paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 16px), 20px)',
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              willChange: 'transform, opacity',
            }}
          >
            <div className="w-full max-w-md pointer-events-auto">
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={isApplying}
                onClick={handleAdd}
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
                  backgroundColor: isLight
                    ? 'rgba(255, 255, 255, 0.82)'
                    : 'rgba(28, 28, 30, 0.82)',
                  backdropFilter: 'blur(24px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                  border: isLight
                    ? '1px solid rgba(255, 255, 255, 0.85)'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow:
                    '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                }}
                className="w-full h-12 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-transform cursor-pointer disabled:opacity-60 text-black dark:text-white active:scale-95"
                title="Iniciar roteiro"
                aria-label="Iniciar roteiro"
              >
                {isApplying ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Iniciando...</span>
                  </div>
                ) : (
                  <Play className="w-5 h-5 fill-current text-current ml-0.5" />
                )}
              </motion.button>
            </div>
          </motion.div>

        </motion.div>
        </motion.div>
      </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
