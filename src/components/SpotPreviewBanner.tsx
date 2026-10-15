import React from 'react';
import { motion } from 'motion/react';
import { X, Star, ChevronRight, MapPin } from 'lucide-react';
import { Spot } from '../types';
import { VerifiedBadge } from './ui/VerifiedBadge';

interface SpotPreviewBannerProps {
  spot: Spot;
  onClose: () => void;
  onOpenDetails: (spot: Spot) => void;
}

export const SpotPreviewBanner: React.FC<SpotPreviewBannerProps> = ({
  spot,
  onClose,
  onOpenDetails,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.96 }}
      transition={{ type: 'spring', damping: 28, stiffness: 350 }}
      className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 z-40 bg-zinc-950/90 backdrop-blur-2xl border border-white/15 rounded-3xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] select-none pointer-events-auto"
    >
      <div className="flex items-center gap-3">
        {/* Spot Thumbnail */}
        <div
          onClick={() => onOpenDetails(spot)}
          className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 cursor-pointer bg-zinc-800"
        >
          <img
            src={spot.image || '/loogo.png'}
            alt={spot.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Spot Details */}
        <div
          onClick={() => onOpenDetails(spot)}
          className="flex-1 min-w-0 cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className="text-sm font-black text-white truncate">{spot.name}</h4>
            <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300 truncate">{spot.categoryLabel || spot.category}</span>
            {spot.rating && (
              <span className="flex items-center gap-0.5 text-amber-400 font-bold shrink-0">
                <Star className="w-3 h-3 fill-current" />
                {spot.rating.toFixed(1)}
              </span>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
            {spot.address || 'Campos do Jordão, SP'}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action CTA */}
      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-400">Toque para ver informações</span>
        <button
          onClick={() => onOpenDetails(spot)}
          className="flex items-center gap-1 text-xs font-black text-white hover:underline cursor-pointer"
        >
          Ver Local
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};
export default SpotPreviewBanner;
