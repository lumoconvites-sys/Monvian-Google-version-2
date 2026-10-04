import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Sparkles, CheckCircle2 } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface GoldSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  onExplore?: () => void;
}

export const GoldSuccessModal: React.FC<GoldSuccessModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  onExplore,
}) => {
  const isLight = theme === 'light';

  if (!isOpen) return null;

  const handleExploreClick = () => {
    onClose();
    if (onExplore) {
      onExplore();
    }
  };

  const content = (
    <AnimatePresence>
      <motion.div
        key="gold-success-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md select-none"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
      >
        <motion.div
          key="gold-success-card"
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-sm sm:max-w-md rounded-[32px] p-6 sm:p-8 shadow-2xl text-center overflow-hidden border ${
            isLight
              ? 'bg-white text-zinc-900 border-zinc-200/90 shadow-[0_25px_60px_rgba(0,0,0,0.18)]'
              : 'bg-[#16171b] text-white border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.8)]'
          }`}
        >
          {/* Glowing celebratory background gradient */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#E5AC33]/25 rounded-full blur-3xl pointer-events-none" />

          {/* Central 3D Crown & Check Icon */}
          <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-metallic-gold p-[2px] shadow-xl shadow-[#E5AC33]/30 mb-5 flex items-center justify-center">
            <div className="w-full h-full rounded-[22px] bg-[#1a1405] dark:bg-[#151106] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#FFF4A3]/30 via-transparent to-transparent pointer-events-none" />
              <Crown className="w-10 h-10 sm:w-12 sm:h-12 text-[#F5BE38] stroke-[2.2] drop-shadow-[0_2px_10px_rgba(245,190,56,0.6)]" />
              <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-[#34C759] border-2 border-black flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white stroke-[2.8]" />
              </div>
            </div>
          </div>

          {/* Top Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-metallic-gold-badge border text-[11px] font-black uppercase tracking-widest shadow-xs mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#F5BE38] stroke-[2.4]" />
            <span className="text-[#C28514] dark:text-[#FDE073]">CONTA GOLD ATIVADA</span>
          </div>

          {/* Main Title */}
          <h2 className="text-2xl sm:text-[28px] font-black tracking-tight leading-tight text-zinc-900 dark:text-white">
            Sua Conta Gold foi ativada!
          </h2>

          {/* Description */}
          <p
            className={`text-sm sm:text-base leading-relaxed mt-3 px-2 font-normal ${
              isLight ? 'text-zinc-600' : 'text-zinc-300'
            }`}
          >
            Agora você tem acesso completo aos roteiros, experiências e conteúdos exclusivos do Monvian.
          </p>

          {/* Benefit highlights pills */}
          <div className="my-6 grid grid-cols-2 gap-2 text-left">
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
              <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 block">Roteiros</span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">100% Liberados</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
              <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 block">Acesso</span>
              <span className="text-xs font-bold text-[#E5AC33] dark:text-[#FDE073]">Permanente</span>
            </div>
          </div>

          {/* Action Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            id="btn-explore-gold-success"
            onClick={handleExploreClick}
            className="w-full h-13 rounded-2xl bg-metallic-gold text-[#1A1202] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#E5AC33]/30 active:opacity-90 cursor-pointer transition-all hover:brightness-105"
          >
            <Crown className="w-4 h-4 text-[#1A1202] stroke-[2.4]" />
            <span>EXPLORAR CONTA GOLD</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
};
