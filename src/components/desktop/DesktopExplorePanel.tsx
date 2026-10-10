import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Spot } from '../../types';
import { Star, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import { getSpotImage, getSpotFallbackImage } from '../../utils/spotImages';

interface DesktopExplorePanelProps {
  spots: Spot[];
  selectedSpot: Spot | null;
  onSelectSpot: (spot: Spot) => void;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  theme: 'dark' | 'light';
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const DesktopExplorePanel: React.FC<DesktopExplorePanelProps> = ({
  spots,
  selectedSpot,
  onSelectSpot,
  selectedCategory,
  onSelectCategory,
  isOpen,
  onToggleOpen,
}) => {
  const isCategoryFiltered = selectedCategory && selectedCategory !== 'all';

  return (
    <>
      {/* Toggle Collapse/Expand Button (Clean iOS glass circular button) */}
      <button
        type="button"
        onClick={onToggleOpen}
        className={`hidden md:flex items-center justify-center w-9 h-9 rounded-full border shadow-xl z-30 pointer-events-auto cursor-pointer transition-all duration-300 absolute top-20 ${
          isOpen ? 'left-[344px] lg:left-[408px]' : 'left-6'
        } ios-glass-btn border-white/20 dark:border-white/15 text-zinc-700 dark:text-white`}
        title={isOpen ? 'Ocultar lista de pontos' : 'Mostrar lista de pontos'}
      >
        {isOpen ? <ChevronLeft className="w-4 h-4 stroke-[2.4]" /> : <ChevronRight className="w-4 h-4 stroke-[2.4]" />}
      </button>

      {/* Main Explore Panel with exact mobile iOS Glass styling */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:flex flex-col absolute top-20 bottom-6 left-6 w-80 lg:w-96 z-20 rounded-[28px] overflow-hidden ios-glass border border-white/20 dark:border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.85)] select-none transition-colors pointer-events-auto text-zinc-900 dark:text-white"
          >
            {/* Panel Header */}
            <div className="p-4 lg:p-5 pb-3 border-b border-black/10 dark:border-white/10 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base lg:text-lg font-black tracking-tight text-zinc-900 dark:text-white font-['Inter']">
                    Pontos Turísticos
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                    {spots.length} {spots.length === 1 ? 'local encontrado' : 'locais encontrados'}
                  </p>
                </div>

                {isCategoryFiltered && (
                  <button
                    type="button"
                    onClick={() => onSelectCategory('all')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-black/5 dark:bg-white/10 transition-colors cursor-pointer"
                    title="Remover filtro"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>
            </div>

            {/* Spots List with Independent Scroll and Mobile Card Glass Styling */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2 scrollbar-none">
              {spots.length > 0 ? (
                spots.map((spot) => {
                  const isSelected = selectedSpot?.id === spot.id;
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => onSelectSpot(spot)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left cursor-pointer transition-all duration-200 group relative ${
                        isSelected
                          ? 'bg-white/20 dark:bg-white/15 border border-white/30 dark:border-white/20 shadow-md font-bold'
                          : 'hover:bg-zinc-900/5 dark:hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {/* Thumbnail Image */}
                      <img
                        src={getSpotImage(spot)}
                        alt={spot.name}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-black/5 dark:border-white/10 shadow-xs group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                        }}
                      />

                      {/* Spot Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[13.5px] font-bold truncate text-zinc-900 dark:text-white">
                            {spot.name}
                          </span>
                          <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                          {spot.rating && (
                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black shrink-0 ml-auto">
                              <Star className="w-2.5 h-2.5 fill-current" />
                              <span>{spot.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[130px]">
                            {spot.categoryLabel}
                          </span>
                          {spot.address && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-600 shrink-0">•</span>
                              <span className="truncate">{spot.address}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-0.5" />
                    </button>
                  );
                })
              ) : (
                <div className="py-12 px-4 text-center text-xs text-zinc-400 font-medium">
                  Nenhum ponto encontrado com o filtro atual.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
