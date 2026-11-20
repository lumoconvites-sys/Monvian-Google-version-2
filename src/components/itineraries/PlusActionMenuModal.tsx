import React from 'react';
import { createPortal } from 'react-dom';
import { X, PlusCircle, Compass, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlusActionMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNewItinerary: () => void;
  onAddSpot: () => void;
  theme?: 'dark' | 'light';
  isGoldUser?: boolean;
}

export const PlusActionMenuModal: React.FC<PlusActionMenuModalProps> = ({
  isOpen,
  onClose,
  onCreateNewItinerary,
  onAddSpot,
  theme = 'dark',
  isGoldUser = false,
}) => {
  const isLight = theme === 'light';

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="plus-action-menu-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={onClose}
          className="fixed inset-0 z-[115] bg-black/45-[2px] flex items-end sm:items-center justify-center p-4 sm:p-6 select-none cursor-pointer"
          style={{ willChange: 'opacity' }}
        >
          <motion.div
            key="plus-action-menu-card"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-sm rounded-[32px] p-5 overflow-hidden flex flex-col gap-3 shadow-2xl border cursor-auto ${
              isLight
                ? 'bg-white/80 border-white/60 text-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.16)] ring-1 ring-black/5'
                : 'bg-[#1c1c1e]/80 border-white/15 text-white shadow-[0_25px_70px_rgba(0,0,0,0.85)] ring-1 ring-white/10'
            }`}
            style={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
            }}
          >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                O que deseja fazer?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                Escolha uma ação para o seu roteiro
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
              title="Fechar"
            >
              <X className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </button>
          </div>

          {/* Action Option 1: Criar Novo Roteiro (Entra na Loja) */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              onClose();
              onCreateNewItinerary();
            }}
            className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer group ${
              isLight
                ? 'bg-white/60 hover:bg-white/85 border-black/5 hover:border-black/10 shadow-sm'
                : 'bg-[#2C2C2E]/75 hover:bg-[#2C2C2E] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isGoldUser
                  ? 'bg-metallic-gold text-[#1A1202] border border-[#FFF4A3]/70'
                  : isLight
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-black'
              }`}>
                <Compass className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-black block tracking-tight">
                  Criar Novo Roteiro
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold block truncate mt-0.5">
                  Navegar na loja de roteiros prontos
                </span>
              </div>
            </div>
          </motion.button>

          {/* Action Option 2: Adicionar Novo Local (Abre Card Flutuante de Pontos) */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              onClose();
              onAddSpot();
            }}
            className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer group ${
              isLight
                ? 'bg-white/60 hover:bg-white/85 border-black/5 hover:border-black/10 shadow-sm'
                : 'bg-[#2C2C2E]/75 hover:bg-[#2C2C2E] border-white/10 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isGoldUser
                  ? 'bg-[#F5BE38]/20 text-[#F5BE38] border border-[#F5BE38]/40'
                  : isLight
                  ? 'bg-zinc-100 text-zinc-900 border border-black/10'
                  : 'bg-white/10 text-white border border-white/20'
              }`}>
                <PlusCircle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-black block tracking-tight">
                  Adicionar Novo Local
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold block truncate mt-0.5">
                  Importar pontos turísticos para o card
                </span>
              </div>
            </div>
          </motion.button>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
