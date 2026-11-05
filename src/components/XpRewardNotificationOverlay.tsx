import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Sparkles, MapPin } from 'lucide-react';
import { XpRewardEventDetail } from '../services/xpService';

export const XpRewardNotificationOverlay: React.FC = () => {
  const [currentReward, setCurrentReward] = useState<XpRewardEventDetail | null>(null);

  useEffect(() => {
    const handleReward = (e: CustomEvent<XpRewardEventDetail>) => {
      const detail = e.detail;
      if (!detail) return;

      setCurrentReward(detail);

      // Auto-hide after 3.8 seconds
      const timer = setTimeout(() => {
        setCurrentReward((prev) => (prev?.spotId === detail.spotId ? null : prev));
      }, 3800);

      return () => clearTimeout(timer);
    };

    window.addEventListener('monvian:xp_awarded' as any, handleReward);
    return () => {
      window.removeEventListener('monvian:xp_awarded' as any, handleReward);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none z-[120] flex flex-col items-center px-4 pt-[max(env(safe-area-inset-top,16px),16px)]">
      <AnimatePresence>
        {currentReward && (
          <motion.div
            key={currentReward.spotId + currentReward.totalXp}
            initial={{ opacity: 0, y: -24, scale: 0.88, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, scale: 0.92, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="w-full max-w-[340px] pointer-events-auto"
          >
            {/* iOS Dynamic Island / Native Capsule Pill */}
            <div className="relative rounded-full bg-[#111113] text-white px-4 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.38)] border border-white/15 flex items-center justify-between gap-3 overflow-hidden select-none">
              {/* Subtle animated sweep highlight */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/15 to-transparent pointer-events-none"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />

              {/* Left: Icon & Discovery message */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm relative">
                  <Zap className="w-5 h-5 text-white fill-white" />
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ scale: [1, 1.3, 1], rotate: [0, 15, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  </motion.div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-bold text-white tracking-tight">
                      Lugar descoberto!
                    </span>
                  </div>
                  <p className="text-[11.5px] text-zinc-300 font-medium truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                    <span>{currentReward.spotName}</span>
                  </p>
                </div>
              </div>

              {/* Right: +100 XP badge */}
              <div className="shrink-0 flex flex-col items-end">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [0.8, 1.2, 1] }}
                  transition={{ duration: 0.4 }}
                  className="px-2.5 py-1 rounded-full bg-blue-500 text-white font-black text-[13px] tracking-tight shadow-sm"
                >
                  +{currentReward.xpAwarded} XP
                </motion.div>
                {currentReward.leveledUp && (
                  <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider mt-0.5 animate-pulse">
                    Subiu de nível!
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
