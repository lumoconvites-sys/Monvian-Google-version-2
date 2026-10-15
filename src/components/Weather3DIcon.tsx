import React from 'react';
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow } from 'lucide-react';

interface Weather3DIconProps {
  weatherCode?: number;
  isDay?: boolean;
  className?: string;
}

export const Weather3DIcon: React.FC<Weather3DIconProps> = ({
  weatherCode = 1,
  isDay = true,
  className = 'w-12 h-12'
}) => {
  // Clear sky
  if (weatherCode === 0) {
    return isDay ? (
      <div className={`relative flex items-center justify-center text-amber-400 drop-shadow-[0_4px_12px_rgba(251,191,36,0.5)] ${className}`}>
        <Sun className="w-full h-full fill-amber-400 stroke-amber-300 stroke-[1.5]" />
      </div>
    ) : (
      <div className={`relative flex items-center justify-center text-indigo-200 drop-shadow-[0_4px_12px_rgba(199,210,254,0.4)] ${className}`}>
        <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-300 to-indigo-100 flex items-center justify-center">
          <div className="w-3/4 h-3/4 rounded-full bg-black/20" />
        </div>
      </div>
    );
  }

  // Mainly clear / partly cloudy
  if (weatherCode <= 3) {
    return (
      <div className={`relative flex items-center justify-center text-amber-300 drop-shadow-[0_4px_12px_rgba(251,191,36,0.4)] ${className}`}>
        <CloudSun className="w-full h-full stroke-[1.5]" />
      </div>
    );
  }

  // Rain
  if (weatherCode >= 50 && weatherCode <= 67) {
    return (
      <div className={`relative flex items-center justify-center text-blue-400 drop-shadow-[0_4px_12px_rgba(96,165,250,0.4)] ${className}`}>
        <CloudRain className="w-full h-full stroke-[1.5]" />
      </div>
    );
  }

  // Snow
  if (weatherCode >= 70 && weatherCode <= 77) {
    return (
      <div className={`relative flex items-center justify-center text-cyan-200 drop-shadow-[0_4px_12px_rgba(165,243,252,0.4)] ${className}`}>
        <CloudSnow className="w-full h-full stroke-[1.5]" />
      </div>
    );
  }

  // Default cloudy
  return (
    <div className={`relative flex items-center justify-center text-zinc-300 drop-shadow-[0_4px_12px_rgba(255,255,255,0.25)] ${className}`}>
      <Cloud className="w-full h-full fill-zinc-300/40 stroke-zinc-200 stroke-[1.5]" />
    </div>
  );
};
export default Weather3DIcon;
