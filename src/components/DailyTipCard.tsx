import React, { useEffect, useState, useRef } from 'react';
import { Spot } from '../types';
import { Compass, ArrowRight, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DailyTipCardProps {
  spot: Spot | null;
  popularCategoryLabel: string;
  isVisible: boolean;
  onClose: () => void;
  onSelectSpot: (spot: Spot) => void;
  durationMs?: number;
}

export const DailyTipCard: React.FC<DailyTipCardProps> = ({
  spot,
  popularCategoryLabel,
  isVisible,
  onClose,
  onSelectSpot,
  durationMs = 8000,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(durationMs);

  useEffect(() => {
    if (!isVisible || !spot) return;

    setProgress(100);
    remainingTimeRef.current = durationMs;
    startTimeRef.current = Date.now();

    const interval = 50;
    const timer = setInterval(() => {
      if (!isPaused) {
        remainingTimeRef.current -= interval;
        const pct = Math.max(0, (remainingTimeRef.current / durationMs) * 100);
        setProgress(pct);

        if (remainingTimeRef.current <= 0) {
          clearInterval(timer);
          onClose();
        }
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isVisible, spot, isPaused, durationMs, onClose]);

  if (!spot) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id="daily-tip-container"
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          className="fixed left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-md pointer-events-auto select-none"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 72px), 84px)',
          }}
        >
          <div
            onClick={() => onSelectSpot(spot)}
            className="group relative overflow-hidden rounded-[28px] bg-white/95 dark:bg-[#181a1e]/95 backdrop-blur-2xl border border-zinc-200/90 dark:border-white/15 p-4 sm:p-4.5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] transition-all cursor-pointer hover:border-white/40"
          >
            {/* Header: Tag + Popularity indicator */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-zinc-900 dark:text-white text-[11px] font-black uppercase tracking-wider">
                <Compass className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                <span>Dica do Dia</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Em alta: <strong className="text-zinc-800 dark:text-zinc-200">{popularCategoryLabel}</strong></span>
              </div>
            </div>

            {/* Main content body */}
            <div className="flex items-start gap-3.5">
              {/* Spot Thumbnail */}
              <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-white/10">
                <img
                  src={spot.image}
                  alt={spot.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-1 left-1.5 text-[10px] font-black text-white flex items-center gap-0.5">
                  <span>★</span>
                  <span>{spot.rating}</span>
                </div>
              </div>

              {/* Spot Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white leading-tight truncate">
                  {spot.name}
                </h2>
                <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 mb-1.5">
                  {spot.categoryLabel} · {spot.visitorsToday || 150} viajantes hoje
                </p>

                {/* Tourist Tip Snippet */}
                <div className="rounded-xl bg-zinc-100/90 dark:bg-white/5 px-2.5 py-1.5 border border-zinc-200/50 dark:border-white/5">
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium line-clamp-2 leading-relaxed italic">
                    "{spot.touristTip || spot.description}"
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-100 dark:border-white/10">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Toque para explorar no mapa</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="px-3 py-1 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Dispensar
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSpot(spot);
                  }}
                  className="px-3.5 py-1 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 text-xs font-black flex items-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <span>Ver Local</span>
                  <ArrowRight className="w-3 h-3 text-zinc-950" />
                </button>
              </div>
            </div>

            {/* Sleek auto-hide progress bar (Pure White) */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-100 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-[width] duration-75 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
