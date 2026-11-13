import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo, useReducedMotion } from 'motion/react';
import {
  Star,
  Clock,
  Navigation,
  Share,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { Spot } from '../types';
import { VerifiedBadge } from './ui/VerifiedBadge';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';

interface SpotPreviewBannerProps {
  spot: Spot;
  userCoords?: [number, number] | null;
  viewMode?: 'card' | 'bar';
  onViewModeChange?: (mode: 'card' | 'bar') => void;
  onClose: () => void;
  onOpenDetails: (spot: Spot) => void;
  theme?: 'dark' | 'light';
}

function calculateHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatTravelEstimate(
  userCoords: [number, number] | null | undefined,
  spotLat?: number,
  spotLng?: number
): string {
  if (
    !userCoords ||
    userCoords.length < 2 ||
    !Number.isFinite(userCoords[0]) ||
    !Number.isFinite(userCoords[1]) ||
    !Number.isFinite(spotLat) ||
    !Number.isFinite(spotLng)
  ) {
    return '10 min';
  }

  const straightKm = calculateHaversineKm(
    userCoords[1],
    userCoords[0],
    spotLat as number,
    spotLng as number
  );
  const roadKm = straightKm * 1.3;

  let minutes: number;
  if (roadKm < 0.45) {
    minutes = Math.max(1, Math.round((roadKm / 4.5) * 60));
  } else {
    minutes = Math.max(2, Math.round((roadKm / 28) * 60));
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }
  if (minutes < 600) {
    const hrs = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `${hrs}h ${String(rem).padStart(2, '0')}m` : `${hrs}h`;
  }
  return '+10h';
}

function resolveCityState(address?: string): string {
  if (!address) return 'Campos do Jordão, SP';
  const normalized = address.toLowerCase();
  if (
    normalized.includes('santo antônio do pinhal') ||
    normalized.includes('santo antonio do pinhal')
  ) {
    return 'Santo Antônio do Pinhal, SP';
  }
  if (
    normalized.includes('são bento do sapucaí') ||
    normalized.includes('sao bento do sapucai')
  ) {
    return 'São Bento do Sapucaí, SP';
  }
  return 'Campos do Jordão, SP';
}

export const SpotPreviewBanner: React.FC<SpotPreviewBannerProps> = ({
  spot,
  userCoords,
  viewMode: controlledViewMode,
  onViewModeChange,
  onClose,
  onOpenDetails,
  theme = 'light',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);
  const [internalViewMode, setInternalViewMode] = useState<'card' | 'bar'>('card');
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const prevSpotIdRef = useRef<string>(spot.id);
  const isDark = theme === 'dark';

  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (mode: 'card' | 'bar') => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  useEffect(() => {
    if (prevSpotIdRef.current !== spot.id) {
      prevSpotIdRef.current = spot.id;
      setImgError(false);
      setIsCopied(false);
      setInternalViewMode('card');
      if (onViewModeChange) {
        onViewModeChange('card');
      }
    }
  }, [spot.id, onViewModeChange]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const spotImage = useMemo(() => {
    if (imgError) {
      return getSpotFallbackImage(spot.name || '', spot.category || 'attractions');
    }
    return getSpotImage(spot);
  }, [imgError, spot]);

  const durationLabel = useMemo(
    () => formatTravelEstimate(userCoords, spot.lat, spot.lng),
    [userCoords, spot.lat, spot.lng]
  );

  const cityState = useMemo(() => resolveCityState(spot.address), [spot.address]);
  const categoryOrAddress =
    spot.address || spot.categoryLabel || spot.category || 'Campos do Jordão';
  const ratingValue =
    typeof spot.rating === 'number' && spot.rating > 0 ? spot.rating : 4.5;
  const isVerified =
    spot.isVerified !== false &&
    spot.is_verified !== 0 &&
    spot.is_verified !== false;

  const handleOpenDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const destination =
      spot.lat && spot.lng
        ? `${spot.lat},${spot.lng}`
        : encodeURIComponent(
            spot.address ? `${spot.name}, ${spot.address}` : `${spot.name} Campos do Jordão`
          );

    const url = isIOS
      ? `https://maps.apple.com/?daddr=${destination}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareTitle = spot.name;
    const shareText = `Confira ${spot.name} em ${cityState}`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${shareTitle} — ${shareUrl}`);
        setIsCopied(true);
        if (copiedTimerRef.current !== null) {
          window.clearTimeout(copiedTimerRef.current);
        }
        copiedTimerRef.current = window.setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      } catch {
        // Ignore clipboard errors gracefully
      }
    }
  };

  const handleCardDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const offsetY = info.offset.y;
    const velocityY = info.velocity.y;

    // Swipe UP -> open full spot page with smooth transition
    if (offsetY < -42 || velocityY < -280) {
      onOpenDetails(spot);
      return;
    }

    // Swipe DOWN -> collapse into compact bar as before
    if (offsetY > 44 || velocityY > 280) {
      setViewMode('bar');
    }
  };

  const handleBarDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const offsetY = info.offset.y;
    const velocityY = info.velocity.y;

    // Swipe UP from compact bar -> restore full card
    if (offsetY < -28 || velocityY < -220) {
      setViewMode('card');
      return;
    }

    // Swipe DOWN from compact bar -> dismiss completely
    if (offsetY > 40 || velocityY > 260) {
      onClose();
    }
  };

  return (
    <motion.div
      id="spot-preview-banner-card"
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 44 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 44 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.15 }
          : { type: 'spring', stiffness: 360, damping: 32, mass: 0.88 }
      }
      className="md:hidden fixed inset-x-0 z-[245] flex justify-center px-2.5 sm:px-3.5 pointer-events-none select-none"
      style={{
        bottom: '84px',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {viewMode === 'card' ? (
          <motion.div
            key="spot-preview-full-card"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.36, bottom: 0.48 }}
            dragMomentum={false}
            onDragEnd={handleCardDragEnd}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 18, scale: 0.97 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 22, scale: 0.96 }
            }
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              touchAction: 'none',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
            }}
            className={`relative w-full max-w-[440px] rounded-[32px] pointer-events-auto overflow-hidden ${
              isDark
                ? 'bg-[#000000] text-white border border-[#262626] shadow-[0_14px_38px_rgba(0,0,0,0.72)]'
                : 'bg-[#FFFFFF] text-zinc-950 border border-black/[0.06] shadow-[0_10px_34px_rgba(0,0,0,0.11),0_2px_8px_rgba(0,0,0,0.04)]'
            }`}
          >
            {/* Minimalist Top Drag Handle */}
            <div className="flex items-center justify-center pt-2.5 pb-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('bar');
                }}
                aria-label="Recolher para barra compacta"
                className="py-1.5 px-10 -my-1 cursor-grab active:cursor-grabbing flex items-center justify-center focus:outline-none"
              >
                <span
                  className={`w-10 h-[4px] rounded-full transition-colors ${
                    isDark ? 'bg-zinc-700' : 'bg-zinc-300'
                  }`}
                />
              </button>
            </div>

            {/* Card Content */}
            <div className="px-4 pb-4 pt-1.5 flex flex-col gap-3.5">
              {/* Header: Square Photo + Clean Metadata */}
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-[78px] h-[78px] sm:w-[82px] sm:h-[82px] rounded-[20px] overflow-hidden shrink-0 border ${
                    isDark
                      ? 'bg-zinc-900 border-white/10'
                      : 'bg-zinc-100 border-black/[0.06]'
                  }`}
                >
                  <img
                    src={spotImage}
                    alt={spot.name}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {/* Establishment Name + Verified Badge */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3
                      className={`text-[18px] sm:text-[19px] font-bold tracking-[-0.02em] truncate leading-tight ${
                        isDark ? 'text-white' : 'text-zinc-950'
                      }`}
                    >
                      {spot.name}
                    </h3>
                    {isVerified && (
                      <VerifiedBadge className="w-[17px] h-[17px] shrink-0" />
                    )}
                  </div>

                  {/* Rating Star + Score + City & State */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-[13px] leading-tight min-w-0">
                    <div className="flex items-center gap-1 shrink-0 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>
                        {ratingValue.toFixed(1)}
                      </span>
                    </div>
                    <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>•</span>
                    <span
                      className={`truncate font-normal ${
                        isDark ? 'text-zinc-400' : 'text-zinc-600'
                      }`}
                    >
                      {cityState}
                    </span>
                  </div>
                </div>
              </div>

              {/* Concise Description */}
              <p
                className={`text-[13.5px] sm:text-[14px] leading-[1.45] tracking-[-0.01em] line-clamp-2 ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}
              >
                {spot.description ||
                  'Um dos destinos mais apreciados de Campos do Jordão para explorar e aproveitar com tranquilidade.'}
              </p>

              {/* 3 Horizontal Quick Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Estimated Travel Time */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(spot);
                  }}
                  aria-label={`Tempo estimado: ${durationLabel} de você`}
                  className={`h-[54px] px-2 rounded-[18px] border flex items-center justify-center gap-2 transition-transform active:scale-[0.97] cursor-pointer ${
                    isDark
                      ? 'bg-[#141416] border-[#262626] text-white'
                      : 'bg-white border-black/[0.07] text-zinc-950 shadow-[0_2px_10px_rgba(0,0,0,0.04)]'
                  }`}
                >
                  <Clock className="w-[18px] h-[18px] stroke-[2] shrink-0" />
                  <div className="flex flex-col items-start leading-tight text-left min-w-0">
                    <span className="text-[12.5px] font-semibold tracking-tight truncate">
                      {durationLabel}
                    </span>
                    <span
                      className={`text-[10.5px] font-normal truncate ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}
                    >
                      de você
                    </span>
                  </div>
                </button>

                {/* 2. Directions / Routes */}
                <button
                  type="button"
                  onClick={handleOpenDirections}
                  aria-label={`Traçar rota para ${spot.name}`}
                  className={`h-[54px] px-2 rounded-[18px] border flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-[0.97] cursor-pointer ${
                    isDark
                      ? 'bg-[#141416] border-[#262626] text-[#0A84FF]'
                      : 'bg-white border-black/[0.07] text-[#007AFF] shadow-[0_2px_10px_rgba(0,0,0,0.04)]'
                  }`}
                >
                  <Navigation className="w-[17px] h-[17px] stroke-[2]" />
                  <span className="text-[12px] font-medium tracking-tight leading-tight">
                    Rotas
                  </span>
                </button>

                {/* 3. Share */}
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label={`Compartilhar ${spot.name}`}
                  className={`h-[54px] px-2 rounded-[18px] border flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-[0.97] cursor-pointer ${
                    isDark
                      ? 'bg-[#141416] border-[#262626] text-white'
                      : 'bg-white border-black/[0.07] text-zinc-950 shadow-[0_2px_10px_rgba(0,0,0,0.04)]'
                  }`}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-[17px] h-[17px] stroke-[2.2] text-emerald-500" />
                      <span className="text-[12px] font-medium tracking-tight leading-tight text-emerald-500">
                        Copiado
                      </span>
                    </>
                  ) : (
                    <>
                      <Share className="w-[17px] h-[17px] stroke-[2]" />
                      <span className="text-[12px] font-medium tracking-tight leading-tight">
                        Compartilhar
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Bottom Wide CTA Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetails(spot);
                }}
                className={`w-full h-[46px] rounded-[18px] flex items-center justify-center gap-1.5 font-semibold text-[15px] tracking-[-0.01em] transition-all active:scale-[0.985] cursor-pointer ${
                  isDark
                    ? 'bg-[#1C1C1E] hover:bg-[#252528] text-white'
                    : 'bg-[#F2F2F5] hover:bg-[#E7E7EC] text-zinc-950'
                }`}
              >
                <span>Ver detalhes</span>
                <ChevronRight className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="spot-preview-compact-bar"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.35, bottom: 0.45 }}
            dragMomentum={false}
            onDragEnd={handleBarDragEnd}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 14, scale: 0.96 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 14, scale: 0.96 }
            }
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(spot);
            }}
            style={{
              touchAction: 'none',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
            }}
            className={`w-full max-w-[326px] sm:max-w-[342px] h-[72px] px-3.5 py-2.5 rounded-[28px] expo-liquid-glass-bar flex items-center justify-between gap-3 select-none cursor-pointer pointer-events-auto ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
            {/* 1. Circular Photo (44px) */}
            <div className="w-[44px] h-[44px] rounded-full overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-800 border border-black/5 dark:border-white/10 shadow-2xs">
              <img
                src={spotImage}
                alt={spot.name}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            </div>

            {/* 2. Main Details Column */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <h4
                  className={`text-[14px] font-semibold tracking-tight truncate leading-tight ${
                    isDark ? 'text-white' : 'text-zinc-950'
                  }`}
                >
                  {spot.name}
                </h4>
                {isVerified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
              </div>

              <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 min-w-0 leading-tight">
                {spot.rating ? (
                  <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400 font-semibold shrink-0">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{spot.rating.toFixed(1)}</span>
                  </div>
                ) : null}

                {spot.rating ? (
                  <span className="text-zinc-300 dark:text-zinc-600 shrink-0">•</span>
                ) : null}

                <span className="truncate">{categoryOrAddress}</span>
              </div>
            </div>

            {/* 3. Right Side Controls */}
            <div className="flex items-center gap-1.5 shrink-0">

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Fechar"
                className={`w-7 h-7 rounded-full expo-liquid-glass-btn flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? 'text-white' : 'text-black'
                }`}
                style={{ color: isDark ? '#FFFFFF' : '#000000' }}
              >
                <X
                  className="w-4 h-4 stroke-[2]"
                  style={{ color: isDark ? '#FFFFFF' : '#000000' }}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SpotPreviewBanner;
