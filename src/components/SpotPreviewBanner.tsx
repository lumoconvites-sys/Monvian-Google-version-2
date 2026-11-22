import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo, useReducedMotion } from 'motion/react';
import { Star, Route, Loader2 } from 'lucide-react';
import { Spot } from '../types';
import { VerifiedBadge } from './ui/VerifiedBadge';
import { getSpotPinThumbnail, getSpotFallbackImage } from '../utils/spotImages';
import { triggerHapticFeedback } from '../utils/haptics';

interface SpotPreviewBannerProps {
  spot: Spot;
  userCoords?: [number, number] | null;
  viewMode?: 'card' | 'bar';
  onViewModeChange?: (mode: 'card' | 'bar') => void;
  onClose: () => void;
  onOpenDetails: (spot: Spot) => void;
  onOpenItineraryTab?: () => void;
  onToggleRoute?: (spot: Spot) => void;
  isRouteActive?: boolean;
  isRouteLoading?: boolean;
  routeError?: string | null;
  theme?: 'dark' | 'light';
  isSatellite?: boolean;
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
  onClose,
  onOpenDetails,
  onToggleRoute,
  isRouteActive = false,
  isRouteLoading = false,
  routeError = null,
  theme = 'light',
}) => {
  const useWhiteText = theme === 'dark';
  const shouldReduceMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);
  const didDragRef = useRef(false);
  const prevSpotIdRef = useRef<string>(spot.id);

  useEffect(() => {
    if (prevSpotIdRef.current !== spot.id) {
      prevSpotIdRef.current = spot.id;
      setImgError(false);
    }
  }, [spot.id]);

  const spotImage = useMemo(() => {
    if (imgError) {
      return getSpotFallbackImage(spot.name || '', spot.category || 'attractions');
    }
    return getSpotPinThumbnail(spot);
  }, [imgError, spot]);

  const cityState = useMemo(() => resolveCityState(spot.address), [spot.address]);
  const ratingValue =
    typeof spot.rating === 'number' && spot.rating > 0 ? spot.rating : 4.5;
  const isVerified =
    spot.isVerified !== false &&
    spot.is_verified !== 0 &&
    spot.is_verified !== false;

  const handleDragStart = () => {
    didDragRef.current = true;
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 120);

    const offsetY = info.offset.y;
    const velocityY = info.velocity.y;

    // Swipe UP -> open full spot details page
    if (offsetY < -28 || velocityY < -220) {
      onOpenDetails(spot);
      return;
    }

    // Swipe DOWN -> dismiss card
    if (offsetY > 36 || velocityY > 240) {
      onClose();
    }
  };

  return (
    <motion.div
      id="spot-preview-banner-card"
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.14 }
          : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
      }
      className="md:hidden fixed inset-x-0 bottom-[82px] sm:bottom-[84px] z-[245] flex flex-col items-center gap-2 px-4 pointer-events-none select-none"
      style={{
        paddingLeft: '16px',
        paddingRight: '16px',
        willChange: 'transform, opacity',
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Discreet informative message when route is unavailable or permission needed */}
      <AnimatePresence>
        {routeError && (
          <motion.div
            key="spot-route-error-pill"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`px-3.5 py-1.5 rounded-full ios26-liquid-glass text-[12px] font-medium tracking-tight text-center max-w-[320px] shadow-sm ${
              useWhiteText ? 'text-[#FFFFFF]' : 'text-[#000000]'
            }`}
          >
            <span className="relative z-10">{routeError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        key={`spot-preview-compact-${spot.id}`}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.35, bottom: 0.45 }}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
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
        className={`w-full max-w-[346px] sm:max-w-[366px] min-h-[76px] px-3.5 py-2.5 rounded-[30px] ios26-liquid-glass flex items-center gap-3 pointer-events-auto cursor-pointer ${
          useWhiteText ? 'text-[#FFFFFF]' : 'text-[#000000]'
        }`}
      >
        {/* 1. Circular Establishment Photo (Left) */}
        <div className={`relative z-10 w-[56px] h-[56px] rounded-full overflow-hidden shrink-0 border ${
          useWhiteText ? 'border-white/25 bg-zinc-800/80' : 'border-white/50 bg-zinc-100/70'
        }`}>
          <img
            src={spotImage}
            alt={spot.name}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        </div>

        {/* 2. Establishment Name, Verified Badge, Star Rating & Location (Center) */}
        <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className={`text-[17px] min-[380px]:text-[18px] font-bold tracking-[-0.022em] truncate leading-tight ${
              useWhiteText ? 'text-[#FFFFFF]' : 'text-[#000000]'
            }`}>
              {spot.name}
            </h3>
            {isVerified && (
              <VerifiedBadge className="w-[18px] h-[18px] shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-[13px] sm:text-[13.5px] leading-tight min-w-0">
            <div className="flex items-center gap-1 shrink-0 font-semibold">
              <Star className="w-[14px] h-[14px] fill-[#FFCC00] text-[#FFCC00]" />
              <span className={`font-bold ${useWhiteText ? 'text-[#FFD60A]' : 'text-[#C78500]'}`}>
                {ratingValue.toFixed(1)}
              </span>
            </div>
            <span className={useWhiteText ? 'text-white/70' : 'text-black/45'}>•</span>
            <span className={`truncate font-medium ${useWhiteText ? 'text-white/95' : 'text-black/75'}`}>
              {cityState}
            </span>
          </div>
        </div>


      </motion.div>
    </motion.div>
  );
};

export default SpotPreviewBanner;

