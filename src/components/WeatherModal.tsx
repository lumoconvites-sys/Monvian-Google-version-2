import React from 'react';
import { WeatherInfo } from '../types';
import { CloudRain, Wind, Droplets, Thermometer, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Weather3DIcon } from './Weather3DIcon';
const weatherBlueHourImg = '/weather_blue_hour.jpg';

interface WeatherModalProps {
  weather: WeatherInfo;
  isOpen: boolean;
  onClose: () => void;
  weatherCode?: number;
  isDay?: boolean;
  theme?: 'dark' | 'light';
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  weather,
  isOpen,
  onClose,
  weatherCode = 2,
  isDay = true,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="weather-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={onClose}
        >
          {/* Main Weather Card with 220ms Fade + Scale Entry Animation and 4px Hover Elevation */}
          <motion.div
            id="weather-modal-card"
            initial={{ opacity: 0, scale: 0.88, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 10 }}
            whileHover={{ y: -4 }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 22,
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              willChange: 'transform, opacity, box-shadow',
            }}
            className="group relative w-full max-w-[370px] rounded-[30px] p-5 sm:p-6 select-none overflow-hidden border border-white/40 dark:border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.12)] hover:shadow-[0_28px_70px_rgba(0,0,0,0.18)] hover:border-white/60 transition-all duration-[220ms] ease-out cursor-default"
          >
            {/* 1. Internal Landscape Photo Background with Gaussian Blur (24px - 32px) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <img
                src={weatherBlueHourImg}
                alt="Clima de serra em Campos do Jordão"
                className="w-full h-full object-cover scale-125 filter blur-[28px] brightness-[0.92] contrast-[1.08] transition-transform duration-700 group-hover:scale-130"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/weather_blue_hour.jpg';
                }}
              />
              {/* 2. Frosted Glass Overlay (70% - 80% opacity) for crystal-clear readability */}
              <div
                className={`absolute inset-0 transition-colors duration-[220ms] ${
                  isDark
                    ? 'bg-[#0b1329]/75 group-hover:bg-[#0b1329]/70 backdrop-blur-md'
                    : 'bg-white/78 group-hover:bg-white/72 backdrop-blur-md'
                }`}
              />
              {/* Subtle top ambient specular gradient */}
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
            </div>

            {/* Card Content Layer */}
            <div className="relative z-10">
              {/* Header: Campos do Jordão & Altitude + Close Button */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3
                    className={`text-[13px] font-bold tracking-wider uppercase leading-tight ${
                      isDark ? 'text-white' : 'text-[#1A1A1A]'
                    }`}
                  >
                    Campos do Jordão
                  </h3>
                  <p
                    className={`text-[11px] font-medium tracking-tight mt-0.5 ${
                      isDark ? 'text-zinc-300' : 'text-[#6B7280]'
                    }`}
                  >
                    1.628m • Altitude Média
                  </p>
                </div>

                {/* Subtle Glass Close Pill */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar previsão do tempo"
                  className="p-1.5 rounded-full bg-white/40 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 border border-white/50 dark:border-white/15 text-[#1A1A1A] dark:text-white transition-all duration-[220ms] active:scale-95 cursor-pointer shadow-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Weather Main Block: 3D Icon + Dominant Temperature & Condition vs Right-aligned Metrics */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.03 }}
                className="flex items-center justify-between gap-3 mb-5"
              >
                {/* Left Column: 3D Icon + Dominant Green Temperature + Condition */}
                <div className="flex flex-col items-start min-w-0">
                  <div className="flex items-center gap-2">
                    <Weather3DIcon
                      weatherCode={weatherCode}
                      isDay={isDay}
                      className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 -my-1 drop-shadow-md"
                    />
                    {/* Temperature as Dominant Element with #34C759 Apple Green Accent */}
                    <span
                      className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none text-[#34C759] drop-shadow-[0_2px_10px_rgba(52,199,89,0.25)]"
                    >
                      {weather.temperature}°
                    </span>
                  </div>
                  <p
                    className={`text-xs font-semibold mt-2 tracking-tight pl-1 line-clamp-1 ${
                      isDark ? 'text-zinc-200' : 'text-[#1A1A1A]'
                    }`}
                  >
                    {weather.condition}
                  </p>
                </div>

                {/* Right Column: 4 Clean Metrics with Low-opacity Divider */}
                <div
                  className={`space-y-1.5 text-[11px] shrink-0 border-l pl-3.5 ${
                    isDark
                      ? 'border-white/15 text-zinc-300'
                      : 'border-zinc-900/10 text-[#6B7280]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <Thermometer className="w-3 h-3 text-[#34C759] opacity-90 shrink-0" />
                      Sensação
                    </span>
                    <span
                      className={`font-bold tracking-tight ${
                        isDark ? 'text-white' : 'text-[#1A1A1A]'
                      }`}
                    >
                      {weather.thermalSensation ?? weather.temperature - 2}°C
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <Droplets className="w-3 h-3 text-[#34C759] opacity-90 shrink-0" />
                      Umidade
                    </span>
                    <span
                      className={`font-bold tracking-tight ${
                        isDark ? 'text-white' : 'text-[#1A1A1A]'
                      }`}
                    >
                      {weather.humidity}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-3 h-3 text-[#34C759] opacity-90 shrink-0" />
                      Vento
                    </span>
                    <span
                      className={`font-bold tracking-tight ${
                        isDark ? 'text-white' : 'text-[#1A1A1A]'
                      }`}
                    >
                      {weather.windSpeed} km/h
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <CloudRain className="w-3 h-3 text-[#34C759] opacity-90 shrink-0" />
                      Chuva
                    </span>
                    <span
                      className={`font-bold tracking-tight ${
                        isDark ? 'text-white' : 'text-[#1A1A1A]'
                      }`}
                    >
                      {weather.rainChance}%
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* "Dica para o Turista": Card Within a Card with Translucent White Glass & Soft Blur */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.06 }}
                className={`rounded-2xl p-3.5 mb-5 border transition-colors duration-[220ms] ${
                  isDark
                    ? 'bg-white/[0.08] border-white/15 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)]'
                    : 'bg-white/65 hover:bg-white/80 border-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.04)]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                  <h4
                    className={`text-xs font-bold tracking-tight ${
                      isDark ? 'text-white' : 'text-[#1A1A1A]'
                    }`}
                  >
                    Dica para o Turista
                  </h4>
                </div>
                <p
                  className={`text-[11px] mt-1.5 leading-relaxed font-normal ${
                    isDark ? 'text-zinc-300' : 'text-[#6B7280]'
                  }`}
                >
                  Temperatura amena de serra durante o dia e friozinho rigoroso à noite.
                </p>
              </motion.div>

              {/* "Próximos Dias": Glass Button Cards for each day */}
              <div>
                <div
                  className={`text-[10px] uppercase tracking-wider font-bold mb-2.5 ${
                    isDark ? 'text-zinc-300' : 'text-[#6B7280]'
                  }`}
                >
                  Próximos Dias
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {weather.forecast.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.09 + idx * 0.03 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.94 }}
                      className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-center transition-colors duration-[220ms] cursor-pointer ${
                        isDark
                          ? 'bg-white/[0.08] hover:bg-white/[0.16] border-white/15 backdrop-blur-md text-white'
                          : 'bg-white/60 hover:bg-white/90 border-white/60 backdrop-blur-md shadow-xs text-[#1A1A1A]'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          isDark ? 'text-zinc-300' : 'text-[#6B7280]'
                        }`}
                      >
                        {item.day}
                      </span>
                      <span
                        className={`text-sm font-bold tracking-tight mt-1 ${
                          isDark ? 'text-white' : 'text-[#1A1A1A]'
                        }`}
                      >
                        {item.temp}°
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

