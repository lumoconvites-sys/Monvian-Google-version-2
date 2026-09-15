import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface WeatherOverlayProps {
  locationName?: string;
  temperature?: number;
  condition?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({
  locationName = 'Campos do Jordão',
  temperature = 20,
  condition = 'Parcialmente nublado',
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setIsFadingOut(false);

    // Loading skeleton transition to real weather data
    const loadTimer = setTimeout(() => {
      setLoading(false);
    }, 600);

    // Start graceful fade-out slightly before 3 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2600);

    // Disappear completely at 3 seconds
    const dismissTimer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="weather-ios-overlay"
      onClick={onClose}
      className={`absolute top-0 left-0 right-0 z-50 pointer-events-auto select-none transition-all duration-400 ease-out cursor-pointer ${
        isFadingOut
          ? 'opacity-0 -translate-y-2'
          : 'opacity-100 translate-y-0 animate-in fade-in slide-in-from-top-3'
      } bg-gradient-to-b from-white/95 via-white/85 to-transparent dark:from-[#0a0a0c]/95 dark:via-[#0a0a0c]/85 dark:to-transparent`}
    >
      <div
        className="max-w-md mx-auto px-6 pb-12 flex flex-col items-start text-left"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
        }}
      >
        {loading ? (
          /* Loading effect with pulse */
          <div className="flex flex-col gap-3 animate-pulse py-1 w-full">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-ping" />
              <span className="text-zinc-500 dark:text-white/60 text-xs font-black">Carregando clima em tempo real...</span>
            </div>
            <div className="h-7 w-48 bg-zinc-200 dark:bg-white/15 rounded-lg" />
            <div className="flex items-center gap-4 my-1">
              <div className="h-20 w-32 bg-zinc-200 dark:bg-white/15 rounded-2xl" />
              <div className="h-14 w-14 bg-zinc-200 dark:bg-white/15 rounded-full" />
            </div>
            <div className="h-5 w-40 bg-zinc-200 dark:bg-white/15 rounded-lg" />
          </div>
        ) : (
          /* Exact recreation from screenshot */
          <div className="flex flex-col items-start animate-in fade-in duration-300">
            {/* Title: Campos do Jordão */}
            <h2 className="text-2xl sm:text-[26px] font-black text-zinc-900 dark:text-white tracking-tight drop-shadow-sm">
              {locationName}
            </h2>

            {/* Temperature 20° + Dynamic Animated Weather Sun Icon */}
            <div className="flex items-center gap-3.5 my-1">
              <span className="text-[76px] sm:text-[88px] font-light text-zinc-900 dark:text-white tracking-tighter leading-none flex items-start">
                {temperature}
                <motion.span 
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="text-3xl sm:text-4xl font-black text-amber-500 ml-1 inline-block"
                >
                  °
                </motion.span>
              </span>

              {/* Dynamic Animated Sun & Ray Icon */}
              <div className="relative text-zinc-900 dark:text-white flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
                  className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center"
                >
                  <svg
                    className="w-full h-full text-amber-500 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" className="fill-amber-400/30 text-amber-500" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </motion.div>
              </div>
            </div>

            {/* Condition: Parcialmente nublado */}
            <p className="text-lg sm:text-[19px] font-black text-zinc-600 dark:text-white/95 tracking-tight">
              {condition}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
