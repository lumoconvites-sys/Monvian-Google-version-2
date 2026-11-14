import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo, useReducedMotion } from 'motion/react';
import {
  Star,
  Clock,
  Navigation,
  Check,
  X,
} from 'lucide-react';
import { Itinerary, ItineraryStep, Spot } from '../types';
import { VerifiedBadge } from './ui/VerifiedBadge';
import { NavRoteirosIcon } from './NavIcons';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { triggerHapticFeedback } from '../utils/haptics';

interface SpotPreviewBannerProps {
  spot: Spot;
  userCoords?: [number, number] | null;
  viewMode?: 'card' | 'bar';
  onViewModeChange?: (mode: 'card' | 'bar') => void;
  onClose: () => void;
  onOpenDetails: (spot: Spot) => void;
  onOpenItineraryTab?: () => void;
  theme?: 'dark' | 'light';
}

function isSpotInsideItinerary(itinerary: Itinerary | null | undefined, spotId: string): boolean {
  if (!itinerary || !Array.isArray(itinerary.days)) return false;
  return itinerary.days.some(
    (day) =>
      Array.isArray(day.steps) &&
      day.steps.some((step) => step.spotId === spotId || step.spot?.id === spotId)
  );
}

function readStoredActiveItinerary(): Itinerary | null {
  try {
    const raw = localStorage.getItem('monvian_active_itinerary');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
      return parsed as Itinerary;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

function getOrCreateItinerarySessionId(): string {
  try {
    let sid = localStorage.getItem('monvian_itinerary_session');
    if (!sid) {
      sid = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('monvian_itinerary_session', sid);
    }
    return sid;
  } catch {
    return 'session-' + Date.now();
  }
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
  onOpenItineraryTab,
  theme = 'light',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);
  const [internalViewMode, setInternalViewMode] = useState<'card' | 'bar'>('card');
  const [isInItinerary, setIsInItinerary] = useState<boolean>(() =>
    isSpotInsideItinerary(readStoredActiveItinerary(), spot.id)
  );
  const didDragRef = useRef(false);
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
      setIsInItinerary(isSpotInsideItinerary(readStoredActiveItinerary(), spot.id));
      setInternalViewMode('card');
      if (onViewModeChange) {
        onViewModeChange('card');
      }
    }
  }, [spot.id, onViewModeChange]);

  useEffect(() => {
    const syncItineraryMembership = () => {
      setIsInItinerary(isSpotInsideItinerary(readStoredActiveItinerary(), spot.id));
    };
    const handleLoggedOut = () => {
      setIsInItinerary(false);
    };
    window.addEventListener('monvian:itinerary_applied', syncItineraryMembership);
    window.addEventListener('monvian:user_logged_out', handleLoggedOut);
    return () => {
      window.removeEventListener('monvian:itinerary_applied', syncItineraryMembership);
      window.removeEventListener('monvian:user_logged_out', handleLoggedOut);
    };
  }, [spot.id]);

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

  const handleAddOrCreateItinerary = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHapticFeedback(15);

    const existing = readStoredActiveItinerary();

    if (existing && isSpotInsideItinerary(existing, spot.id)) {
      setIsInItinerary(true);
      onOpenItineraryTab?.();
      return;
    }

    const currentSteps = existing?.days?.[0]?.steps || [];
    const nextOrder = currentSteps.length + 1;
    const lastTime = currentSteps[currentSteps.length - 1]?.suggestedTime || '09:30';
    const [hStr, mStr] = lastTime.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const nextHour = Number.isFinite(h) ? (h + 1) % 24 : 10;
    const formattedTime = `${String(nextHour).padStart(2, '0')}:${String(
      Number.isFinite(m) ? m : 30
    ).padStart(2, '0')}`;

    const resolvedImage = getSpotImage(spot);
    const newStep: ItineraryStep = {
      id: `step-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      spotId: spot.id,
      title: spot.name,
      spotName: spot.name,
      category: spot.categoryLabel || spot.category || 'Atração',
      categoryLabel: spot.categoryLabel || 'Atração / Turística',
      description: spot.description || spot.address || '',
      suggestedTime: currentSteps.length === 0 ? '09:30' : formattedTime,
      durationMinutes: 90,
      travelTimeFromPrev: '15 min até o próximo ponto',
      image: resolvedImage,
      lat: spot.lat,
      lng: spot.lng,
      stepOrder: nextOrder,
      spot: { ...spot, image: spot.image || resolvedImage },
    };

    const sessionId = getOrCreateItinerarySessionId();

    if (existing) {
      const updatedDays = existing.days.map((day, idx) =>
        idx === 0
          ? {
              ...day,
              steps: [...(day.steps || []), newStep],
            }
          : day
      );

      const updated: Itinerary = {
        ...existing,
        days: updatedDays,
      };

      try {
        localStorage.setItem('monvian_active_itinerary', JSON.stringify(updated));
        localStorage.setItem('monvian_itinerary_view_mode', 'map');
        localStorage.setItem('monvian_itinerary_expanded', 'true');
      } catch {
        // Ignore storage errors
      }

      window.dispatchEvent(new CustomEvent('monvian:itinerary_applied', { detail: updated }));

      if (existing.id) {
        fetch(`/api/user-itineraries/${existing.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
          },
          body: JSON.stringify(updated),
        }).catch(() => {});
      }
    } else {
      const tempId = `user-itin-${Date.now()}`;
      const created: Itinerary = {
        id: tempId,
        title: 'Meu Roteiro em Campos',
        description: 'Roteiro personalizado de Campos do Jordão',
        coverImage: resolvedImage,
        daysCount: 1,
        categories: ['Roteiro'],
        isActive: true,
        isRecommended: false,
        usageCount: 1,
        days: [
          {
            id: 'day-1',
            title: 'Dia 1',
            dayNumber: 1,
            theme: 'Dia 1',
            steps: [newStep],
          },
        ],
      };

      try {
        localStorage.setItem('monvian_active_itinerary', JSON.stringify(created));
        localStorage.setItem('monvian_itinerary_view_mode', 'map');
        localStorage.setItem('monvian_itinerary_expanded', 'true');
      } catch {
        // Ignore storage errors
      }

      window.dispatchEvent(new CustomEvent('monvian:itinerary_applied', { detail: created }));

      fetch('/api/user-itineraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          title: created.title,
          description: created.description,
          coverImage: created.coverImage,
          daysCount: created.daysCount,
          days: created.days,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.id) {
            const latest = readStoredActiveItinerary();
            if (latest && latest.id === tempId) {
              const synced: Itinerary = { ...latest, id: data.id };
              try {
                localStorage.setItem('monvian_active_itinerary', JSON.stringify(synced));
              } catch {}
            }
          }
        })
        .catch(() => {});
    }

    setIsInItinerary(true);
  };

  const handleCardDragStart = () => {
    didDragRef.current = true;
  };

  const handleCardDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 120);

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
      className="md:hidden fixed inset-x-0 bottom-[82px] sm:bottom-[84px] z-[245] flex justify-center px-3.5 sm:px-4 pointer-events-none select-none"
      style={{
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
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
            onDragStart={handleCardDragStart}
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
            onClick={(e) => {
              e.stopPropagation();
              if (didDragRef.current) return;
              onOpenDetails(spot);
            }}
            style={{
              touchAction: 'none',
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
            }}
            className={`relative w-full max-w-[396px] rounded-[34px] pointer-events-auto cursor-pointer ${
              isDark
                ? 'bg-[#141416] text-white border border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.65)]'
                : 'bg-[#FFFFFF] text-[#000000] border border-black/[0.04] shadow-[0_12px_38px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.04)]'
            }`}
          >
            {/* Top Drag Handle */}
            <div className="flex items-center justify-center pt-2.5 pb-0.5">
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
                    isDark ? 'bg-zinc-700' : 'bg-[#C7C7CC]'
                  }`}
                />
              </button>
            </div>

            {/* Card Inner Content */}
            <div className="px-[18px] pb-[18px] pt-2 flex flex-col gap-3.5">
              {/* Header: Square Photo (Left) + Name, Verification, Rating & City (Right) */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-[96px] h-[96px] min-[380px]:w-[108px] min-[380px]:h-[108px] sm:w-[115px] sm:h-[115px] rounded-[20px] overflow-hidden shrink-0 border ${
                    isDark
                      ? 'bg-zinc-900 border-white/10'
                      : 'bg-zinc-100 border-black/[0.05]'
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
                      className={`text-[18px] min-[380px]:text-[20px] font-bold tracking-[-0.022em] truncate leading-tight ${
                        isDark ? 'text-white' : 'text-[#000000]'
                      }`}
                    >
                      {spot.name}
                    </h3>
                    {isVerified && (
                      <VerifiedBadge className="w-[18px] h-[18px] shrink-0" />
                    )}
                  </div>

                  {/* Rating Star + Score + City & State */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-[13px] sm:text-[13.5px] leading-tight min-w-0">
                    <div className="flex items-center gap-1 shrink-0 font-semibold">
                      <Star className="w-[14px] h-[14px] fill-[#FFCC00] text-[#FFCC00]" />
                      <span className={isDark ? 'text-[#FFD60A]' : 'text-[#E09F00]'}>
                        {ratingValue.toFixed(1)}
                      </span>
                    </div>
                    <span className={isDark ? 'text-zinc-600' : 'text-[#AEAEB2]'}>•</span>
                    <span
                      className={`truncate font-normal ${
                        isDark ? 'text-zinc-400' : 'text-[#6E6E73]'
                      }`}
                    >
                      {cityState}
                    </span>
                  </div>
                </div>
              </div>

              {/* Concise 2-Line Description */}
              <p
                className={`text-[13.5px] sm:text-[14px] leading-[1.42] tracking-[-0.01em] line-clamp-2 ${
                  isDark ? 'text-zinc-300' : 'text-[#48484A]'
                }`}
              >
                {spot.description ||
                  'Um dos destinos mais apreciados de Campos do Jordão para explorar e aproveitar com tranquilidade.'}
              </p>

              {/* 3 Compact Horizontal Pill Buttons */}
              <div className="relative grid grid-cols-3 gap-2.5 pt-0.5">
                {/* Button 1 — Rotas (Solid Black Pill) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDirections(e);
                  }}
                  aria-label={`Traçar rota para ${spot.name}`}
                  className={`h-[44px] px-3 rounded-full flex items-center justify-center gap-1.5 transition-transform active:scale-[0.97] cursor-pointer ${
                    isDark
                      ? 'bg-white text-black hover:bg-zinc-200'
                      : 'bg-[#000000] text-white hover:bg-[#1C1C1E]'
                  }`}
                >
                  <Navigation className="w-[15px] h-[15px] fill-current stroke-[1.8] shrink-0" />
                  <span className="text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                    Rotas
                  </span>
                </button>

                {/* Button 2 — Travel Time (Light Gray Pill) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(spot);
                  }}
                  aria-label={`Tempo estimado de deslocamento: ${durationLabel}`}
                  className={`h-[44px] px-3 rounded-full flex items-center justify-center gap-1.5 transition-transform active:scale-[0.97] cursor-pointer ${
                    isDark
                      ? 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]'
                      : 'bg-[#F2F2F5] text-[#000000] hover:bg-[#E7E7EC]'
                  }`}
                >
                  <Clock className="w-[15.5px] h-[15.5px] stroke-[2] shrink-0" />
                  <span className="text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap tabular-nums">
                    {durationLabel}
                  </span>
                </button>

                {/* Button 3 — Roteiro (Light Gray Pill) */}
                <button
                  type="button"
                  onClick={handleAddOrCreateItinerary}
                  aria-label={
                    isInItinerary
                      ? `${spot.name} adicionado ao roteiro`
                      : `Adicionar ${spot.name} ao roteiro`
                  }
                  className={`h-[44px] px-2.5 rounded-full flex items-center justify-center gap-1 transition-transform active:scale-[0.97] cursor-pointer ${
                    isDark
                      ? 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]'
                      : 'bg-[#F2F2F5] text-[#000000] hover:bg-[#E7E7EC]'
                  }`}
                >
                  {isInItinerary ? (
                    <>
                      <Check className="w-[14.5px] h-[14.5px] stroke-[2.5] text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-[12.5px] min-[390px]:text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                        No roteiro
                      </span>
                    </>
                  ) : (
                    <>
                      <NavRoteirosIcon size={15} className="shrink-0" />
                      <span className="text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                        Roteiro
                      </span>
                    </>
                  )}
                </button>
              </div>
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
