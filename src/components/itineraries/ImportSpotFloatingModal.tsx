import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Star, MapPin, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Spot } from '../../types';
import { getSpotImage, getSpotFallbackImage } from '../../utils/spotImages';

interface ImportSpotFloatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  spots: Spot[];
  importedSpotIds: string[];
  onImportSpot: (spot: Spot) => void;
  theme?: 'dark' | 'light';
}

export const ImportSpotFloatingModal: React.FC<ImportSpotFloatingModalProps> = ({
  isOpen,
  onClose,
  spots,
  importedSpotIds,
  onImportSpot,
  theme = 'dark',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [justImportedId, setJustImportedId] = useState<string | null>(null);

  const isLight = theme === 'light';

  // Filter spots by search query
  const filteredSpots = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return spots;
    return spots.filter((spot) =>
      spot.name.toLowerCase().includes(q) ||
      (spot.categoryLabel || '').toLowerCase().includes(q) ||
      (spot.description || '').toLowerCase().includes(q)
    );
  }, [spots, searchQuery]);

  const handleImport = (spot: Spot) => {
    onImportSpot(spot);
    setJustImportedId(spot.id);
    setTimeout(() => {
      setJustImportedId(null);
    }, 1800);
  };

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="import-spot-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClose}
          className="fixed inset-0 z-[120] bg-black/55-[3px] flex items-center justify-center p-4 sm:p-6 select-none cursor-pointer"
          style={{ willChange: 'opacity' }}
        >
          <motion.div
            key="import-spot-modal-card"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-lg max-h-[85vh] rounded-[36px] overflow-hidden flex flex-col shadow-2xl border cursor-auto ${
              isLight
                ? 'bg-white/80 border-white/70 text-zinc-900 shadow-[0_25px_70px_rgba(0,0,0,0.16)] ring-1 ring-black/5'
                : 'bg-[#000000] border-[#262626] text-white shadow-[0_30px_90px_rgba(0,0,0,0.9)]'
            }`}
            style={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
            }}
          >
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
          {/* Minimal Top Bar with Search & Close */}
          <div
            className="sticky top-0 z-20 p-4 sm:p-5 pb-3 flex items-center gap-3 border-b border-black/[0.06] dark:border-[#262626]/70 shrink-0"
            style={{
              backgroundColor: isLight ? 'rgba(255, 255, 255, 0.40)' : 'rgba(0, 0, 0, 0.40)',
            }}
          >
            <div className={`relative flex items-center flex-1 rounded-2xl border px-3.5 py-2.5 transition-all ${
              isLight
                ? 'bg-black/[0.04] border-black/5 text-zinc-900 focus-within:border-black/30'
                : 'bg-[#000000]/70 border-[#262626] text-white focus-within:border-white/40'
            }`}>
              <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ponto turístico..."
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </button>
          </div>

          {/* Spots List */}
          <div className="px-4 sm:px-5 py-4 space-y-2.5">
            {filteredSpots.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 dark:text-zinc-500">
                <p className="text-sm font-bold">Nenhum ponto encontrado</p>
                <p className="text-xs mt-1">Tente pesquisar com outro termo</p>
              </div>
            ) : (
              filteredSpots.map((spot, idx) => {
                const isImported = importedSpotIds.includes(spot.id);
                const isJustImported = justImportedId === spot.id;

                return (
                  <motion.div
                    key={spot.id}
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 22,
                      delay: Math.min(idx * 0.035, 0.35),
                    }}
                    whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                    whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-colors ${
                      isLight
                        ? 'bg-white/60 border-black/5 hover:bg-white/85 shadow-sm'
                        : 'bg-[#1C1C1E] border-white/10 hover:border-white/25'
                    }`}
                  >
                    {/* Spot Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        style={{
                          overflow: 'clip',
                          clipPath: 'inset(0 round 16px)',
                          WebkitClipPath: 'inset(0 round 16px)',
                          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                          isolation: 'isolate',
                          transform: 'translateZ(0)',
                          WebkitTransform: 'translateZ(0)',
                        }}
                        className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-zinc-800 relative border border-white/10"
                      >
                        <motion.img
                          initial={{ opacity: 0, scale: 1, y: 0 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{
                            duration: 0.22,
                            ease: [0.22, 1, 0.36, 1],
                            delay: Math.min(idx * 0.035, 0.35),
                          }}
                          style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'translateZ(0)',
                          }}
                          src={getSpotImage(spot)}
                          alt={spot.name}
                          className="w-full h-full object-cover rounded-[inherit]"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold truncate text-zinc-900 dark:text-white leading-tight">
                          {spot.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                          <span className={`flex items-center gap-0.5 font-bold ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                            <Star className="w-3 h-3 fill-current" />
                            {spot.rating}
                          </span>
                          <span>•</span>
                          <span className="truncate">{spot.categoryLabel || 'Atração'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Import Button */}
                    <div className="shrink-0">
                      {isJustImported ? (
                        <div className="px-3 py-1.5 rounded-xl bg-green-500/20 text-green-500 border border-green-500/40 text-xs font-extrabold flex items-center gap-1 shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Importado!</span>
                        </div>
                      ) : isImported ? (
                        <button
                          type="button"
                          onClick={() => handleImport(spot)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-200/70 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-white/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="Importar novamente para o roteiro"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Adicionar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleImport(spot)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                            isLight
                              ? 'bg-black hover:bg-zinc-800 text-white'
                              : 'bg-white hover:bg-zinc-200 text-black shadow-white/20'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Importar</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
