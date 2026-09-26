import React from 'react';
import { Spot } from '../types';
import { Star, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

const VerifiedBadge = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white shrink-0" aria-label="Verificado">
    <path d="M12 2L15.09 5.09L19.18 5.18L19.27 9.27L22.36 12.36L19.27 15.45L19.18 19.54L15.09 19.63L12 22.72L8.91 19.63L4.82 19.54L4.73 15.45L1.64 12.36L4.73 9.27L4.82 5.18L8.91 5.09L12 2Z" fill="currentColor"/>
    <path d="M10 16L6 12L7.41 10.59L10 13.17L16.59 6.58L18 8L10 16Z" fill="black"/>
  </svg>
);

interface SpotPreviewBannerProps {
  spot: Spot | null;
  onClose: () => void;
  onOpenDetails: (spot) => void;
}

export const SpotPreviewBanner: React.FC<SpotPreviewBannerProps> = ({
  spot,
  onOpenDetails,
}) => {
  if (!spot) return null;

  return (
    <motion.aside
      id="spot-preview-banner"
      aria-label={`Prévia de ${spot.name}`}
      initial={{ opacity: 0, scale: 0.86, y: 22 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 16 }}
      transition={{
        type: 'spring',
        damping: 26,
        stiffness: 340,
        mass: 0.75,
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm ios-glass rounded-[28px] p-3 sm:p-3.5 flex items-center gap-3 select-none pointer-events-auto shadow-2xl border border-white/20 dark:border-white/10 origin-bottom transform-gpu"
      style={{
        bottom: 'calc(max(12px, env(safe-area-inset-bottom, 12px)) + 64px)',
        willChange: 'transform, opacity',
      }}
    >
      {/* Left: Spot Squircle Thumbnail */}
      <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-[18px] overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-md cursor-pointer"
        onClick={() => onOpenDetails(spot)}
      >
        <img
          src={spot.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=200&q=80'}
          alt={spot.name}
          className="w-full h-full object-cover pointer-events-none"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=200&q=80';
          }}
        />
      </motion.div>

      {/* Center: Spot Details */}
      <div 
        className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer"
        onClick={() => onOpenDetails(spot)}
      >
        <h3 className="text-zinc-900 dark:text-[#F5F2EA] font-extrabold text-[15px] sm:text-[17px] leading-snug truncate flex items-center gap-1.5 min-w-0 tracking-tight">
          <span className="truncate">{spot.name}</span>
          <VerifiedBadge />
        </h3>
        <p className="text-[#9A9894] text-xs truncate mt-0.5 capitalize font-semibold">
          {spot.categoryLabel || spot.category}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Star className="w-3.5 h-3.5 text-[#007AFF] fill-[#007AFF] shrink-0" />
          <span className="text-zinc-800 dark:text-[#F5F2EA] font-bold text-xs">
            {spot.rating ? spot.rating.toFixed(1) : '4.5'}
          </span>
        </div>
      </div>

      {/* Right: Ver Local Action (No X button) */}
      <div className="flex flex-col items-end justify-center self-stretch shrink-0 py-0.5 gap-2">
        <motion.button
          id="btn-open-spot-details"
          whileTap={{ scale: 0.94 }}
          onClick={() => onOpenDetails(spot)}
          className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold text-xs whitespace-nowrap shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:opacity-90"
        >
          <span>Ver Local</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </motion.aside>
  );
};

