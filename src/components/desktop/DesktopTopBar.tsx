import React from 'react';
import { Search, SlidersHorizontal, Sun, Moon, Layers } from 'lucide-react';
import { Spot } from '../../types';

interface DesktopTopBarProps {
  spots: Spot[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onSelectSpot: (spot: Spot) => void;
  theme: 'dark' | 'light';
  realWeather: any;
  onOpenWeatherModal: () => void;
  is3DMode: boolean;
  onToggle3DMode: () => void;
  onOpenMapModes: () => void;
}

export const DesktopTopBar: React.FC<DesktopTopBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  theme,
  realWeather,
  is3DMode,
  onToggle3DMode
}) => {
  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'hotels', label: 'Hotéis' },
    { id: 'restaurants', label: 'Restaurantes' },
    { id: 'cafes', label: 'Cafés' },
    { id: 'sweets', label: 'Chocolates' },
    { id: 'attractions', label: 'Atrações' },
    { id: 'pharmacies', label: 'Farmácias' },
  ];

  const isDark = theme === 'dark';

  return (
    <header className="hidden md:flex items-center justify-between absolute top-4 left-72 right-6 z-30 pointer-events-auto">
      {/* Search Input Bar */}
      <div
        className={`flex items-center gap-3 w-80 px-4 py-2.5 rounded-2xl backdrop-blur-xl border shadow-lg text-sm transition-colors ${
          isDark
            ? 'bg-[#1C1C1E]/85 border-white/10 text-white'
            : 'bg-white/85 border-black/[0.08] text-zinc-900'
        }`}
      >
        <Search className={`w-4 h-4 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar em Campos do Jordão..."
          className={`w-full bg-transparent border-none outline-none font-medium ${
            isDark ? 'text-white placeholder-zinc-500' : 'text-zinc-900 placeholder-zinc-400'
          }`}
        />
      </div>

      {/* Categories Pill Scroller */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-2xl backdrop-blur-xl border shadow-lg transition-colors ${
          isDark
            ? 'bg-[#1C1C1E]/85 border-white/10'
            : 'bg-white/85 border-black/[0.08]'
        }`}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? isDark
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-black text-white shadow-sm'
                  : isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-white/5'
                  : 'text-zinc-600 hover:text-black hover:bg-black/5'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Right Controls: Weather & 3D */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl backdrop-blur-xl border shadow-lg transition-colors ${
            isDark
              ? 'bg-[#1C1C1E]/85 border-white/10 text-white'
              : 'bg-white/85 border-black/[0.08] text-zinc-900'
          }`}
        >
          <span className="text-sm font-bold">{realWeather.temperature}°C</span>
          <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{realWeather.condition}</span>
        </div>

        <button
          onClick={onToggle3DMode}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer border ${
            is3DMode
              ? isDark
                ? 'bg-white text-black border-white shadow-lg'
                : 'bg-black text-white border-black shadow-lg'
              : isDark
              ? 'bg-[#1C1C1E]/85 backdrop-blur-xl border-white/10 text-white hover:bg-white/10'
              : 'bg-white/85 backdrop-blur-xl border-black/[0.08] text-zinc-900 hover:bg-black/5'
          }`}
          title="Alternar Relevo 3D"
        >
          <Layers className="w-4 h-4" />
          <span>3D</span>
        </button>
      </div>
    </header>
  );
};
export default DesktopTopBar;
