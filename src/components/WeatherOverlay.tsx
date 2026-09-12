import React, { useState, useEffect } from 'react';

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
      className={`fixed top-0 left-0 right-0 z-50 pointer-events-auto select-none transition-all duration-400 ease-out cursor-pointer ${
        isFadingOut
          ? 'opacity-0 -translate-y-2'
          : 'opacity-100 translate-y-0 animate-in fade-in slide-in-from-top-3'
      }`}
      style={{
        background: 'linear-gradient(to bottom, rgba(10, 10, 12, 0.96) 0%, rgba(10, 10, 12, 0.85) 65%, rgba(10, 10, 12, 0) 100%)',
      }}
    >
      <div className="max-w-md mx-auto px-6 pt-7 sm:pt-9 pb-12 flex flex-col items-start text-left">
        {loading ? (
          /* Loading effect with pulse */
          <div className="flex flex-col gap-3 animate-pulse py-1 w-full">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <span className="text-white/60 text-xs font-medium">Carregando clima em tempo real...</span>
            </div>
            <div className="h-7 w-48 bg-white/15 rounded-lg" />
            <div className="flex items-center gap-4 my-1">
              <div className="h-20 w-32 bg-white/15 rounded-2xl" />
              <div className="h-14 w-14 bg-white/15 rounded-full" />
            </div>
            <div className="h-5 w-40 bg-white/15 rounded-lg" />
          </div>
        ) : (
          /* Exact recreation from screenshot */
          <div className="flex flex-col items-start animate-in fade-in duration-300">
            {/* Title: Campos do Jordão */}
            <h2 className="text-2xl sm:text-[26px] font-semibold text-white tracking-tight drop-shadow-sm">
              {locationName}
            </h2>

            {/* Temperature 20° + Sun Behind Cloud Icon */}
            <div className="flex items-center gap-3.5 my-1">
              <span className="text-[76px] sm:text-[88px] font-light text-white tracking-tighter leading-none">
                {temperature}°
              </span>

              {/* Exact SVG recreation of the sun behind cloud icon from the screenshot */}
              <div className="relative text-white flex items-center justify-center">
                <svg
                  className="w-14 h-14 sm:w-16 sm:h-16 text-sky-200"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Sun rays & ring behind */}
                  <path
                    d="M34 16A8 8 0 0 0 26.5 10"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line x1="33" y1="6" x2="33" y2="3" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="41" y1="12" x2="44" y2="11" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="41" y1="21" x2="44" y2="22" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="24" y1="6" x2="22" y2="3" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Cloud foreground */}
                  <path
                    d="M17 38H33C37.4183 38 41 34.4183 41 30C41 25.8648 37.8631 22.4632 33.8242 22.0464C32.7483 16.8967 28.2198 13 22.8 13C16.8353 13 12 17.8353 12 23.8C12 24.5369 12.0739 25.2562 12.2152 25.9507C8.74977 26.8528 6.2 30.0094 6.2 33.8C6.2 36.1196 7.12187 38 9 38H17Z"
                    stroke="#bfe3f7"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Condition: Parcialmente nublado */}
            <p className="text-lg sm:text-[19px] font-normal text-white/95 tracking-tight">
              {condition}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
