import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, PanInfo, useReducedMotion } from 'motion/react';
import { Star } from 'lucide-react';
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
  onOpenItineraryTab?: () => void;
  theme?: 'dark' | 'light';
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
  theme = 'light',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);
  const didDragRef = useRef(false);
  const prevSpotIdRef = useRef<string>(spot.id);
  const isDark = theme === 'dark';

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
    return getSpotImage(spot);
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
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 36 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 36 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.15 }
          : { type: 'spring', stiffness: 360, damping: 32, mass: 0.88 }
      }
      className="md:hidden fixed inset-x-0 bottom-[82px] sm:bottom-[84px] z-[245] flex justify-center px-4 pointer-events-none select-none"
      style={{
        paddingLeft: '16px',
        paddingRight: '16px',
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
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
        className={`w-full max-w-[326px] sm:max-w-[342px] min-h-[76px] px-3.5 py-2.5 rounded-[30px] flex items-center gap-3 pointer-events-auto cursor-pointer ${
          isDark
            ? 'bg-[#141416] text-white border border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.65)]'
            : 'bg-[#FFFFFF] text-[#000000] border border-black/[0.04] shadow-[0_12px_38px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.04)]'
        }`}
      >
        {/* 1. Circular Establishment Photo (Left) */}
        <div
          className={`w-[56px] h-[56px] rounded-full overflow-hidden shrink-0 border ${
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

        {/* 2. Establishment Name, Verified Badge, Star Rating & Location (Right) */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={`text-[17px] min-[380px]:text-[18px] font-bold tracking-[-0.022em] truncate leading-tight ${
                isDark ? 'text-white' : 'text-[#000000]'
              }`}
            >
              {spot.name}
            </h3>
            {isVerified && (
              <VerifiedBadge className="w-[18px] h-[18px] shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-[13px] sm:text-[13.5px] leading-tight min-w-0">
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
      </motion.div>
    </motion.div>
  );
};

export default SpotPreviewBanner;

