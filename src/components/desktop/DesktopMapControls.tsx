import React from 'react';
import { Layers, Map as MapIcon, Globe, Moon, RotateCcw, Navigation2 } from 'lucide-react';
import { MapModeType } from '../../types';
import { Weather3DIcon } from '../Weather3DIcon';

interface DesktopMapControlsProps {
  currentMode: MapModeType;
  onChangeMode: (mode: MapModeType) => void;
  is3DMode: boolean;
  onToggle3DMode: () => void;
  onRecenter?: () => void;
  realWeather?: {
    temperature: number;
    condition: string;
    weatherCode: number;
    isDay: boolean;
  };
}

export const DesktopMapControls: React.FC<DesktopMapControlsProps> = ({
  currentMode,
  onChangeMode,
  is3DMode,
  onToggle3DMode,
  onRecenter,
  realWeather,
}) => {
  return (
    <div
      className="hidden md:flex items-center gap-2.5 absolute top-5 right-5 z-30 pointer-events-auto select-none"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
      }}
    >
      {/* 1. Weather Info Badge (Apple Glass Pill with 3D Weather Icon) */}
      {realWeather && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/70 backdrop-blur-xl border border-white/10 text-white shadow-lg text-xs font-semibold">
          <Weather3DIcon weatherCode={realWeather.weatherCode} isDay={realWeather.isDay} className="w-7 h-7 -my-1 shrink-0" />
          <span className="text-amber-300 font-bold">{realWeather.temperature}°C</span>
          <span className="text-zinc-300 font-medium truncate max-w-[140px]">
            {realWeather.condition}
          </span>
        </div>
      )}

      {/* 2. Map Mode Segmented Switcher (Explorar / Satélite / Escuro) */}
      <div className="flex items-center p-1 rounded-xl bg-zinc-950/70 backdrop-blur-xl border border-white/10 shadow-lg gap-0.5">
        <button
          type="button"
          onClick={() => onChangeMode('explorar')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMode === 'explorar'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Modo Mapa Urbano"
        >
          <MapIcon className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Mapa</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeMode('satelite')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMode === 'satelite'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Modo Satélite"
        >
          <Globe className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Satélite</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeMode('escuro')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMode === 'escuro'
              ? 'bg-white text-zinc-950 shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Modo Noturno Escuro"
        >
          <Moon className="w-3.5 h-3.5 stroke-[2.2]" />
          <span>Escuro</span>
        </button>
      </div>

      {/* 3. 3D Elevation / Pitch Toggle Button */}
      <button
        type="button"
        onClick={onToggle3DMode}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-lg ${
          is3DMode
            ? 'bg-white text-zinc-950 border-white ring-2 ring-white/20'
            : 'bg-zinc-950/70 backdrop-blur-xl border-white/10 text-white hover:bg-white/10'
        }`}
        title={is3DMode ? 'Alternar para visão 2D plana' : 'Alternar para relevo 3D de montanhas'}
      >
        <Layers className="w-3.5 h-3.5 stroke-[2.4]" />
        <span>3D</span>
      </button>

      {/* 4. Recenter Button */}
      {onRecenter && (
        <button
          type="button"
          onClick={onRecenter}
          className="w-8 h-8 rounded-xl bg-zinc-950/70 backdrop-blur-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer shadow-lg"
          title="Centralizar em Campos do Jordão"
        >
          <Navigation2 className="w-3.5 h-3.5 stroke-[2.2]" />
        </button>
      )}
    </div>
  );
};

export default DesktopMapControls;
