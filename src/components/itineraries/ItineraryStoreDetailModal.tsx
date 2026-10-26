import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Clock,
  MapPin,
  Compass,
  Lightbulb,
  Lock,
  Crown,
  Heart,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary } from '../../types';
import { PremiumModal } from '../PremiumModal';
import { getSpotImage, getSpotFallbackImage } from '../../utils/spotImages';
import { useFavorites } from '../../hooks/useFavorites';
import { usePlatanos } from '../../hooks/usePlatanos';
import { PlatanoLeafIcon, PlatanoUnlockToast } from '../platanos/PlatanoLeafIcon';
import { PlatanoPurchaseConfirmModal } from '../platanos/PlatanoPurchaseConfirmModal';

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
  onOpenWalletTopUp,
  theme = 'dark',
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [unlockToast, setUnlockToast] = useState<{ visible: boolean; title: string; subtitle?: string }>({
    visible: false,
    title: '',
  });
  const { isItinerarySaved, toggleItinerary } = useFavorites();
  const { getItineraryPlatanoPrice, isItineraryUnlocked } = usePlatanos();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const heroImgRef = useRef<HTMLImageElement | null>(null);

  // Smooth scroll-driven blur & scale effect (native iOS fluid feel)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    if (heroImgRef.current) {
      heroImgRef.current.style.filter = 'none';
      heroImgRef.current.style.transform = 'scale(1.04) translateZ(0)';
      heroImgRef.current.style.webkitTransform = 'scale(1.04) translateZ(0)';
    }
  }, [itinerary?.id, isOpen]);

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
  const isGoldItinerary = Boolean(
    activeItinerary &&
      (activeItinerary.isPremium || (activeItinerary as any).isGold || (activeItinerary as any).is_gold) &&
      activeItinerary.badgeText?.toLowerCase() !== 'livre'
  );
  const isLivreItinerary = !isGoldItinerary;
  const isUnlockedByPlatanos = activeItinerary ? isItineraryUnlocked(activeItinerary.id) : false;
  const isPremiumUser = isUnlockedByPlatanos;
  const platanoPrice = activeItinerary ? getItineraryPlatanoPrice(activeItinerary) : 15;
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
    if (isGoldItinerary && !isUnlockedByPlatanos) {
      setIsConfirmModalOpen(true);
      return;
    }

    try {
      setIsApplying(true);
      await onApplyItinerary(activeItinerary);
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
            key="itinerary-detail-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={`fixed inset-0 z-[200] flex flex-col backdrop-blur-xl ${
            isLight ? 'bg-black/35' : 'bg-black/60'
          }`}
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            willChange: 'opacity',
            transform: 'translate3d(0, 0, 0)',
            WebkitTransform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Fullscreen Translucent Mobile Card Container (120fps GPU Composited) */}
          <motion.div
            key={`itinerary-detail-content-${activeItinerary.id}`}
            initial={{ opacity: 0, scale: 0.94, y: 26 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 32,
              mass: 0.72,
            }}
            className={`relative w-full h-full flex flex-col max-w-xl mx-auto overflow-hidden rounded-t-[26px] ios-page-top-rounded backdrop-blur-2xl ${
              isLight
                ? 'bg-white/88 text-zinc-900'
                : 'bg-[#000000]/82 text-white'
            }`}
            style={{
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform, opacity',
              borderTopLeftRadius: '26px',
              borderTopRightRadius: '26px',
              overflow: 'hidden',
            }}
          >
          {/* Scrollable Body com blur dinâmico ao rolar */}
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overscroll-contain pb-36 rounded-t-[26px]"
            style={{
              WebkitOverflowScrolling: 'touch',
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
              className="sticky top-0 w-full h-72 sm:h-80 shrink-0 overflow-hidden bg-zinc-900 rounded-t-[26px] z-0 pointer-events-none"
            >
              <div className="w-full h-full relative">
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
                  className="w-full h-full object-cover rounded-t-[26px] pointer-events-none transform-gpu"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80';
                  }}
                />
              </div>
              
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
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/90 dark:bg-[#000000]/75 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 text-black dark:text-white flex items-center justify-center shadow-md cursor-pointer transition-opacity active:opacity-80"
                  title="Voltar"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="w-5 h-5 -ml-0.5" />
                </motion.button>

                {/* Direita: Badge Conta Gold / Livre + Botão Curtir Roteiro */}
                <div className="flex items-center gap-2">
                  {isGoldItinerary ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isUnlockedByPlatanos) {
                          setIsConfirmModalOpen(true);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-bold tracking-tight shadow-md border border-[#D9A84E]/50 cursor-pointer transition-transform active:scale-95"
                      title="Roteiro Exclusivo com Plátanos"
                    >
                      <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
                      <span className="tabular-nums">
                        {isUnlockedByPlatanos
                          ? 'Liberado'
                          : `${platanoPrice}`}
                      </span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white text-[9.5px] font-black uppercase tracking-wider shadow-xs border border-white/20">
                      <span>{activeItinerary.badgeText || 'ACESSO LIVRE'}</span>
                    </span>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItinerary(activeItinerary.id);
                    }}
                    className="w-10 h-10 rounded-full bg-white/90 dark:bg-[#000000]/75 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 text-black dark:text-white flex items-center justify-center shadow-md cursor-pointer transition-opacity active:opacity-80"
                    title={isItinerarySaved(activeItinerary.id) ? 'Remover dos salvos' : 'Salvar roteiro'}
                    aria-label={isItinerarySaved(activeItinerary.id) ? 'Remover dos salvos' : 'Salvar roteiro'}
                  >
                    <Heart
                      className={`w-5 h-5 transition-colors ${
                        isItinerarySaved(activeItinerary.id)
                          ? 'fill-rose-500 text-rose-500 stroke-[2]'
                          : 'fill-transparent stroke-[2]'
                      }`}
                    />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* CONTEÚDO PRINCIPAL COMO CARD TRANSLÚCIDO COM BORDAS SUPERIORES ARREDONDADAS */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: 0.015 }}
              style={{
                transform: 'translate3d(0, 0, 0)',
                WebkitTransform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform, opacity',
              }}
              className={`relative -mt-6 z-10 rounded-t-[32px] sm:rounded-t-[36px] px-5 pt-6 pb-6 space-y-4 backdrop-blur-2xl min-h-[calc(100%-15rem)] ${
                isLight
                  ? 'bg-white/92 text-zinc-900 border-t border-black/5 shadow-[0_-8px_32px_rgba(0,0,0,0.08)]'
                  : 'bg-[#000000]/90 text-white border-t border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]'
              }`}
            >
              
              {/* 2. TAGS (MÁXIMO 3, LIMPAS E SEM POLUIÇÃO) */}
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
                  {isGoldItinerary && (
                    <button
                      type="button"
                      onClick={() => setIsPremiumModalOpen(true)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-metallic-gold text-[#1A1202] shadow-sm border border-[#FFF4A3]/70 shrink-0 cursor-pointer transition-transform active:scale-95"
                      title="Roteiro Elite Gold"
                    >
                      <Crown className="w-4 h-4 stroke-[2.4] text-[#1A1202] fill-[#1A1202]/20" />
                    </button>
                  )}
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

              {/* 5. DICAS DO GUIA (COMPACTO E SEM CAIXAS VAZIAS) */}
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
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95 cursor-pointer shrink-0 border ${
                            isSelected
                              ? isGoldItinerary
                                ? 'bg-metallic-gold text-[#1A1202] border-[#FFF4A3]/70 shadow-md shadow-[#E5AC33]/30 font-black'
                                : isLight ? 'bg-black text-white border-black shadow-2xs' : 'bg-white text-black border-white shadow-2xs'
                              : isLight
                              ? 'bg-zinc-100 text-zinc-600 border-zinc-200/80 hover:bg-zinc-200'
                              : 'bg-white/[0.04] text-[#A1A1AA] border-white/10 hover:text-white'
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

              {/* 7. CONTEÚDO DAS PARADAS */}
              <div className="pt-1 space-y-2.5">
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
                    const isBlurred = !isLivreItinerary && !isPremiumUser && idx >= 2;

                    return (
                      <div
                        key={`${activeDayIndex}-${step.id || idx}`}
                        onClick={() => {
                          if (isBlurred) {
                            handleAdd();
                          }
                        }}
                        className={`relative overflow-hidden p-3 rounded-2xl border flex items-center gap-3 transition-transform active:scale-[0.98] ${
                          isBlurred ? 'cursor-pointer' : ''
                        } ${
                          isLight
                            ? 'bg-white/90 border-zinc-200/80 shadow-2xs'
                            : 'bg-white/[0.03] border-white/10'
                        }`}
                      >
                        {/* Conteúdo com efeito embaçado para paradas a partir da terceira */}
                        <div className={`flex items-center gap-3 w-full ${
                          isBlurred ? 'filter blur-[5.5px] select-none pointer-events-none opacity-45 dark:opacity-35' : ''
                        }`}>
                          {/* Número da parada */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                            isGoldItinerary
                              ? 'bg-metallic-gold text-[#1A1202] font-black shadow-xs shadow-[#E5AC33]/25 border border-[#FFF4A3]/60'
                              : isLight ? 'bg-black/10 text-black' : 'bg-white/15 text-white'
                          }`}>
                            {stepNumber}
                          </div>

                          {/* Foto da parada */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-zinc-800 border border-zinc-200/40 dark:border-white/10">
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
                                isGoldItinerary ? 'text-[#E5AC33] dark:text-[#FDE073] drop-shadow-[0_0_6px_rgba(229,172,51,0.3)]' : (isLight ? 'text-black' : 'text-white')
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

                        {/* Selo elegante sobreposto nas paradas embaçadas para gerar curiosidade e exclusividade */}
                        {isBlurred && (
                          <div
                            onClick={() => setIsConfirmModalOpen(true)}
                            className="absolute inset-0 flex items-center justify-center px-4 cursor-pointer"
                          >
                            <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 border shadow-sm backdrop-blur-md transition-transform hover:scale-105 active:scale-95 ${
                              isLight
                                ? 'bg-white/95 border-[#D9A84E]/45 text-zinc-800 shadow-[0_2px_10px_rgba(217,168,78,0.2)]'
                                : 'bg-[#181a20]/95 border-[#D9A84E]/40 text-[#F5D78E] shadow-[0_2px_10px_rgba(0,0,0,0.4)]'
                            }`}>
                              <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
                              <span className="text-[10.5px] font-bold tracking-tight">
                                Liberar com {platanoPrice} Plátanos
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          </div>

          {/* 11. BARRA DE AÇÃO FIXA INFERIOR COM SAFE AREA */}
          <div
            className={`absolute bottom-0 inset-x-0 z-50 px-5 py-3.5 border-t backdrop-blur-2xl ${
              isLight
                ? 'bg-white/85 border-zinc-200/80 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]'
                : 'bg-[#000000]/80 border-white/10 shadow-[0_-8px_24px_rgba(0,0,0,0.5)]'
            }`}
            style={{
              paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 16px), 20px)',
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
            }}
          >
            <div className="max-w-md mx-auto">
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={isApplying}
                onClick={handleAdd}
                className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-lg shadow-[#22c55e]/25 active:opacity-90"
                title="Adicionar roteiro"
                aria-label="Adicionar roteiro"
              >
                {isApplying ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Adicionando...</span>
                  </div>
                ) : (
                  <>
                    <Plus className="w-5 h-5 stroke-[2.6]" />
                    <span>Adicionar</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>

        </motion.div>
      </motion.div>
        )}
      </AnimatePresence>

      {/* Plátanos Purchase Confirmation Modal */}
      <PlatanoPurchaseConfirmModal
        itinerary={activeItinerary}
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onOpenWalletTopUp={() => {
          setIsConfirmModalOpen(false);
          if (onOpenWalletTopUp) {
            onOpenWalletTopUp();
          } else {
            window.dispatchEvent(new CustomEvent('monvian:open_platanos_wallet', { detail: { tab: 'topup' } }));
          }
        }}
        onConfirmSuccess={(unlockedItin, res) => {
          setIsConfirmModalOpen(false);
          setUnlockToast({
            visible: true,
            title: `Roteiro adicionado: ${unlockedItin.title}`,
            subtitle: res.alreadyUnlocked
              ? 'Roteiro já liberado na sua conta'
              : `-${res.charged} Plátanos · Saldo restante: ${res.balanceAfter} Plátanos`,
          });
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

      {/* Monvian Premium Access Modal */}
      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        theme={theme}
      />
    </>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
