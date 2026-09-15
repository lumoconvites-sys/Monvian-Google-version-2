import React from 'react';
import { WeatherInfo } from '../types';
import { X, CloudRain, Wind, Droplets, Mountain, Sparkles, Thermometer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WeatherModalProps {
  weather: WeatherInfo;
  isOpen: boolean;
  onClose: () => void;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({
  weather,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      id="weather-modal-backdrop"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0 }}
      className="fixed inset-0 z-45 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        id="weather-modal-card"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white dark:bg-[#1a1c22] text-zinc-900 dark:text-white rounded-3xl border border-zinc-200 dark:border-white/15 p-5 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs font-black text-[#00C896] uppercase tracking-wider mb-2">
          <Mountain className="w-4 h-4" />
          Clima na Serra da Mantiqueira
        </div>

        <h3 className="text-xl font-black text-zinc-900 dark:text-white">Campos do Jordão</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{weather.altitude}</p>

        {/* Current Big Temperature */}
        <div className="flex items-center justify-between my-4 py-3 border-y border-zinc-200 dark:border-white/10">
          <div>
            <div className="text-5xl font-black tracking-tight text-zinc-900 dark:text-white flex items-start">
              {weather.temperature}
              <span className="text-2xl font-black text-[#00C896] ml-1">°C</span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-black mt-1">{weather.condition}</p>
          </div>

          <div className="text-right space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center justify-end gap-1.5 text-zinc-700 dark:text-zinc-300">
              <Thermometer className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              Sensação: <strong className="text-zinc-900 dark:text-white">{weather.thermalSensation}°C</strong>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              Umidade: {weather.humidity}%
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Wind className="w-3.5 h-3.5 text-[#00C896]" />
              Vento: {weather.windSpeed} km/h
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Chuva: {weather.rainChance}%
            </div>
          </div>
        </div>

        {/* Mountain Advice */}
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-300 mb-4 flex items-start gap-2.5 shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-black text-zinc-900 dark:text-white">Dica para o Turista: </span>
            Temperatura amena de serra durante o dia e friozinho rigoroso à noite. Não esqueça um agasalho pesado e aproveite para tomar um chocolate quente ou fondue em Capivari!
          </div>
        </div>

        {/* 5-day forecast */}
        <div>
          <div className="text-[11px] uppercase tracking-wider font-black text-zinc-400 dark:text-white/50 mb-2">
            Previsão para os Próximos Dias
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {weather.forecast.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, type: 'spring', stiffness: 500, damping: 25 }}
                className="p-2 rounded-xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 flex flex-col items-center gap-1 shadow-sm"
              >
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-black">{item.day}</span>
                <span className="text-xs font-black text-zinc-900 dark:text-white">{item.temp}°C</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
