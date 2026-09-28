import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crown } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  onUnlock?: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  onUnlock,
}) => {
  const isLight = theme === 'light';
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [purchaseNotice, setPurchaseNotice] = React.useState('');

  const benefits = [
    'Todos os roteiros exclusivos',
    'Roteiros para casal, família e fim de semana',
    'Pontos turísticos selecionados por guias',
    'Mais lugares disponíveis no mapa',
    'Recomendações e experiências especiais',
    'Acesso permanente',
  ];

  const handleUnlockClick = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setPurchaseNotice('');
    
    setTimeout(() => {
      setIsProcessing(false);
      setPurchaseNotice('Pagamentos indisponíveis no momento. Tente novamente mais tarde.');
    }, 700);
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        key="monvian-premium-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs select-none"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
      >
        <motion.div
          key="monvian-premium-card"
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-sm sm:max-w-md rounded-[32px] p-6 sm:p-7 shadow-2xl transition-colors duration-200 overflow-hidden border ${
            isLight
              ? 'bg-white text-zinc-900 border-zinc-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.14)]'
              : 'bg-[#18191d] text-white border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.7)]'
          }`}
        >
          {/* Subtle metallic gold glow behind header in dark mode */}
          {!isLight && (
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#E5AC33]/15 rounded-full blur-3xl pointer-events-none" />
          )}

          {/* Close button [ × ] */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={`absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer z-20 ${
              isLight
                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                : 'bg-white/10 hover:bg-white/15 text-zinc-300'
            }`}
          >
            <X className="w-4 h-4 stroke-[2.4]" />
          </button>

          {/* Header Badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-metallic-gold-badge border text-[10px] sm:text-[11px] font-black uppercase tracking-widest shadow-xs">
              <Crown className="w-3.5 h-3.5 text-[#F5BE38] stroke-[2.3]" />
              <span className="text-[#C28514] dark:text-[#FDE073]">CONTA GOLD</span>
            </span>
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight pr-6">
            Tenha acesso completo com a Conta Gold
          </h2>

          {/* Description */}
          <p
            className={`text-xs sm:text-[13px] leading-relaxed mt-2 ${
              isLight ? 'text-zinc-600' : 'text-zinc-400'
            }`}
          >
            Desbloqueie todos os roteiros e conteúdos exclusivos para aproveitar Campos do Jordão da melhor forma.
          </p>

          {/* Benefits List */}
          <div className="my-5 space-y-2.5">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-metallic-gold-icon border flex items-center justify-center text-[#F5BE38] shrink-0 mt-0.5 shadow-2xs">
                  <Check className="w-2.5 h-2.5 stroke-[3.5] text-[#F5BE38]" />
                </div>
                <span
                  className={`text-xs sm:text-[13px] font-medium leading-tight ${
                    isLight ? 'text-zinc-800' : 'text-zinc-200'
                  }`}
                >
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          {/* Price Block */}
          <div
            className={`p-4 rounded-2xl border text-center transition-colors mb-5 ${
              isLight
                ? 'bg-[#E5AC33]/[0.06] border-[#E5AC33]/40'
                : 'bg-[#E5AC33]/[0.06] border-[#E5AC33]/30'
            }`}
          >
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-[#E5AC33] dark:text-[#FDE073]">
              R$ 29,90
            </div>
            <p
              className={`text-[11px] sm:text-xs font-semibold mt-0.5 ${
                isLight ? 'text-zinc-600' : 'text-zinc-400'
              }`}
            >
              Pagamento único · acesso permanente
            </p>
          </div>

          {/* Unlock Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={isProcessing}
            onClick={handleUnlockClick}
            className="w-full h-12 rounded-2xl bg-metallic-gold text-[#1A1202] font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#E5AC33]/30 active:opacity-90 cursor-pointer transition-all disabled:opacity-70"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2 text-[#1A1202]">
                <div className="w-4 h-4 border-2 border-[#1A1202] border-t-transparent rounded-full animate-spin" />
                <span>Processando...</span>
              </div>
            ) : (
              <>
                <Crown className="w-4 h-4 text-[#1A1202] stroke-[2.4]" />
                <span>Desbloquear Conta Gold</span>
              </>
            )}
          </motion.button>

          {purchaseNotice && (
            <p className="text-[11px] font-bold text-center text-amber-500 dark:text-[#FDE073] mt-2.5 px-2 animate-fadeIn">
              {purchaseNotice}
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
