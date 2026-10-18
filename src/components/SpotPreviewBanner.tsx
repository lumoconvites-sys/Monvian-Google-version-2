import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Star, ChevronRight } from 'lucide-react';
import { Spot } from '../types';
import { VerifiedBadge } from './ui/VerifiedBadge';

interface SpotPreviewBannerProps {
  spot: Spot;
  onClose: () => void;
  onOpenDetails: (spot: Spot) => void;
  theme?: 'dark' | 'light';
}

export const SpotPreviewBanner: React.FC<SpotPreviewBannerProps> = ({
  spot,
  onClose,
  onOpenDetails,
  theme = 'dark',
}) => {
  const [imgError, setImgError] = useState(false);
  const isDark = theme === 'dark';

  const spotImage = !imgError && spot.image ? spot.image : '/loogo.png';
  const categoryOrAddress = spot.address || spot.categoryLabel || spot.category || 'Campos do Jordão';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
      whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
      onClick={() => onOpenDetails(spot)}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
      }}
      className={`fixed bottom-[88px] left-3.5 right-3.5 sm:left-auto sm:right-6 sm:w-[380px] z-40 h-[80px] px-3.5 py-3 rounded-[24px] border backdrop-blur-2xl shadow-lg flex items-center justify-between gap-3 select-none cursor-pointer pointer-events-auto transition-colors ${
        isDark
          ? 'bg-[#1C1C1E]/85 border-white/10 text-white shadow-[0_16px_40px_rgba(0,0,0,0.5)]'
          : 'bg-white/90 border-black/10 text-zinc-950 shadow-[0_12px_32px_rgba(0,0,0,0.12)]'
      }`}
    >
      {/* 1. Circular Photo (44px) */}
      <div className="w-[44px] h-[44px] rounded-full overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-800 border border-black/5 dark:border-white/10 shadow-2xs">
        <motion.img
          initial={{ opacity: 0, scale: 0.88, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.03 }}
          src={spotImage}
          alt={spot.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 2. Main Details Column */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Row 1: Name + Verified Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className={`text-[14px] font-semibold tracking-tight truncate leading-tight ${
            isDark ? 'text-white' : 'text-zinc-950'
          }`}>
            {spot.name}
          </h4>
          <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
        </div>

        {/* Row 2: Rating with Star + Short Location */}
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 min-w-0 leading-tight">
          {spot.rating ? (
            <div className="flex items-center gap-0.5 text-amber-500 dark:text-amber-400 font-semibold shrink-0">
              <Star className="w-3 h-3 fill-current" />
              <span>{spot.rating.toFixed(1)}</span>
            </div>
          ) : null}

          {spot.rating ? <span className="text-zinc-300 dark:text-zinc-600 shrink-0">•</span> : null}

          <span className="truncate">
            {categoryOrAddress}
          </span>
        </div>
      </div>

      {/* 3. Right Side Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <ChevronRight className={`w-4 h-4 transition-transform ${
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        }`} />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Fechar"
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isDark
              ? 'bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white'
              : 'bg-black/5 hover:bg-black/10 text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <X className="w-4 h-4 stroke-[1.8]" />
        </button>
      </div>
    </motion.div>
  );
};

export default SpotPreviewBanner;
