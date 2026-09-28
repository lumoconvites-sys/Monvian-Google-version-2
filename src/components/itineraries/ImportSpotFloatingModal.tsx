import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Star, MapPin, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Spot } from '../../types';

interface ImportSpotFloatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  spots: Spot[];
  importedSpotIds: string[];
  onImportSpot: (spot: Spot) => void;
  theme?: 'dark' | 'light';
  isGoldUser?: boolean;
}

export const ImportSpotFloatingModal: React.FC<ImportSpotFloatingModalProps> = ({
  isOpen,
  onClose,
  spots,
  importedSpotIds,
  onImportSpot,
  theme = 'dark',
  isGoldUser = false,
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

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="import-spot-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none cursor-pointer"
      >
        <motion.div
          key="import-spot-modal-card"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-lg max-h-[85vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl border cursor-auto backdrop-blur-2xl ${
            isLight
              ? 'bg-white/95 border-zinc-200/90 text-zinc-900 shadow-xl'
              : 'bg-[#18191d]/95 border-white/15 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)]'
          }`}
          style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {/* Minimal Top Bar with Search & Close */}
          <div className="p-4 sm:p-5 pb-3 flex items-center gap-3 border-b border-zinc-200/60 dark:border-white/10 shrink-0">
            <div className={`relative flex items-center flex-1 rounded-2xl border px-3.5 py-2.5 transition-all ${
              isLight
                ? 'bg-zinc-100/90 border-zinc-200 text-zinc-900 focus-within:border-blue-500'
                : 'bg-zinc-900/90 border-white/15 text-white focus-within:border-[#F5BE38]/60'
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
              className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </button>
          </div>

          {/* Spots List */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-2.5 no-scrollbar">
            {filteredSpots.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 dark:text-zinc-500">
                <p className="text-sm font-bold">Nenhum ponto encontrado</p>
                <p className="text-xs mt-1">Tente pesquisar com outro termo</p>
              </div>
            ) : (
              filteredSpots.map((spot) => {
                const isImported = importedSpotIds.includes(spot.id);
                const isJustImported = justImportedId === spot.id;

                return (
                  <div
                    key={spot.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                      isLight
                        ? 'bg-zinc-50/80 border-zinc-200/80 hover:bg-zinc-100/90'
                        : 'bg-zinc-900/60 border-white/10 hover:bg-zinc-900/90'
                    }`}
                  >
                    {/* Spot Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-zinc-800 relative border border-white/10">
                        <img
                          src={spot.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=150&q=80'}
                          alt={spot.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=150&q=80';
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold truncate text-zinc-900 dark:text-white leading-tight">
                          {spot.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-1">
                          <span className={`flex items-center gap-0.5 font-bold ${isGoldUser ? 'text-[#F5BE38]' : 'text-blue-500'}`}>
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
                            isGoldUser
                              ? 'bg-metallic-gold text-[#1A1202] border border-[#FFF4A3]/70 hover:opacity-95 shadow-[#E5AC33]/25'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Importar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
