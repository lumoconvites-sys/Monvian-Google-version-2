import React from 'react';
import { Spot } from '../types';
import { Star, X, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface SpotPreviewBannerProps {
  spot: Spot | null;
  onClose: () => void;
  onOpenDetails: (spot: Spot) => void;
}

export const SpotPreviewBanner: React.FC<SpotPreviewBannerProps> = ({
  spot,
  onClose,
  onOpenDetails,
}) => {
  if (!spot) return null;

  return (
    <aside
      id="spot-preview-banner"
      aria-label={`Prévia de ${spot.name}`}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="fixed left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-sm ios-glass rounded-[28px] p-3 sm:p-3.5 flex items-center gap-3 select-none pointer-events-auto"
      style={{
        bottom: 'calc(max(12px, env(safe-area-inset-bottom, 12px)) + 64px)',
      }}
    >
      {/* Left: Spot Squircle Thumbnail */}
      <motion.div 
        whileHover={{ scale: 1.05 }}
        className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-[18px] overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-md cursor-pointer"
        onClick={() => onOpenDetails(spot)}
      >
        <img
          src={spot.image}
          alt={spot.name}
          className="w-full h-full object-cover pointer-events-none"
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
        <h3 className="text-zinc-800 dark:text-white font-black text-[15px] sm:text-[17px] leading-snug truncate">
          {spot.name}
        </h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs truncate mt-0.5 capitalize">
          {spot.categoryLabel || spot.category}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Star className="w-3.5 h-3.5 text-[#facc15] fill-[#facc15] shrink-0" />
          <span className="text-zinc-800 dark:text-white font-black text-xs">
            {spot.rating ? spot.rating.toFixed(1) : '4.5'}
          </span>
        </div>
      </div>

      {/* Right: Ver Local Action */}
      <div className="flex flex-col items-end justify-center self-stretch shrink-0 py-0.5 gap-2">
        <motion.button
          id="btn-open-spot-details"
          whileTap={{ scale: 0.94 }}
          onClick={() => onOpenDetails(spot)}
          className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold text-xs whitespace-nowrap shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>Ver Local</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </aside>
  );
};

