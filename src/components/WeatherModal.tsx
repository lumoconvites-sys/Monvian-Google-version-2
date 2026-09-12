import React from 'react';
import { WeatherInfo } from '../types';
import { X, CloudRain, Wind, Droplets, Mountain, Sparkles, Thermometer } from 'lucide-react';

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
    <div
      id="weather-modal-backdrop"
      className="fixed inset-0 z-45 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="weather-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-[#1a1c22] text-white rounded-3xl border border-white/15 p-5 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          id="btn-close-weather"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
          <Mountain className="w-4 h-4" />
          Clima na Serra da Mantiqueira
        </div>

        <h3 className="text-xl font-bold text-white">Campos do Jordão</h3>
        <p className="text-xs text-zinc-400">{weather.altitude}</p>

        {/* Current Big Temperature */}
        <div className="flex items-center justify-between my-4 py-3 border-y border-white/10">
          <div>
            <div className="text-5xl font-black tracking-tight text-white flex items-start">
              {weather.temperature}
              <span className="text-2xl font-normal text-emerald-400 ml-1">°C</span>
            </div>
            <p className="text-xs text-zinc-300 font-medium mt-1">{weather.condition}</p>
          </div>

          <div className="text-right space-y-1 text-xs text-zinc-400">
            <div className="flex items-center justify-end gap-1.5 text-zinc-300">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              Sensação: <strong className="text-white">{weather.thermalSensation}°C</strong>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              Umidade: {weather.humidity}%
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
              Vento: {weather.windSpeed} km/h
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
              Chuva: {weather.rainChance}%
            </div>
          </div>
        </div>

        {/* Mountain Advice */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-zinc-300 mb-4 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Dica para o Turista: </span>
            Temperatura amena de serra durante o dia e friozinho rigoroso à noite. Não esqueça um agasalho pesado e aproveite para tomar um chocolate quente ou fondue em Capivari!
          </div>
        </div>

        {/* 5-day forecast */}
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-white/50 mb-2">
            Previsão para os Próximos Dias
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {weather.forecast.map((item, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xl bg-black/40 border border-white/5 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-zinc-400 font-medium">{item.day}</span>
                <span className="text-xs font-bold text-white">{item.temp}°C</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
