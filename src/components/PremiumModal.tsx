import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, User, Star, Infinity, ArrowRight } from 'lucide-react';
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
    { icon: MapPin, text: 'Roteiros exclusivos' },
    { icon: User, text: 'Lugares selecionados por guias' },
    { icon: Star, text: 'Experiências e recomendações especiais' },
    { icon: Infinity, text: 'Acesso vitalício' },
  ];

  const handleUnlockClick = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setPurchaseNotice('');

    try {
      const token = localStorage.getItem('monvian_token');
      if (!token) {
        setIsProcessing(false);
        setPurchaseNotice('Faça login ou crie sua conta para adquirir a Conta Gold.');
        return;
      }

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (data.alreadyGold) {
        setIsProcessing(false);
        setPurchaseNotice('Sua conta já possui a Conta Gold ativa permanentemente!');
        if (onUnlock) onUnlock();
        return;
      }

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Não foi possível iniciar o checkout.');
      }

      // Redirect user directly to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Stripe checkout initiation error:', err);
      setIsProcessing(false);
      setPurchaseNotice(err.message || 'Erro ao conectar ao Stripe. Tente novamente.');
    }
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
        className={`fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md select-none ${
          isLight ? 'bg-black/40' : 'bg-black/80'
        }`}
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
      >
        <motion.div
          key="monvian-premium-card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-[370px] sm:max-w-[390px] rounded-[36px] overflow-hidden transition-colors ${
            isLight
              ? 'bg-white text-zinc-900 border border-zinc-200/90 shadow-[0_25px_70px_rgba(0,0,0,0.18)]'
              : 'bg-[#0C0D10] text-white border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.9)]'
          }`}
        >
          {/* Top Banner Image with Smooth Fade to Card Background */}
          <div className="relative w-full h-44 sm:h-48 overflow-hidden bg-black">
            <img
              src="/stripe_gold_banner.jpg"
              alt="Campos do Jordão Monvian Gold"
              className="w-full h-full object-cover object-center scale-105"
            />
            {/* Elegant gradient overlay merging into bottom card background */}
            <div className={`absolute inset-0 ${
              isLight
                ? 'bg-gradient-to-b from-black/15 via-white/20 to-white'
                : 'bg-gradient-to-b from-black/25 via-black/40 to-[#0C0D10]'
            }`} />

            {/* Close Button [ × ] */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className={`absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer z-20 ${
                isLight
                  ? 'bg-black/20 hover:bg-black/30 text-white border border-white/30'
                  : 'bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/15'
              }`}
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Modal Content Body */}
          <div className="px-6 pb-6 pt-1">
            {/* Small uppercase tag */}
            <p className={`text-[10px] font-bold tracking-[0.25em] uppercase mb-1.5 ${
              isLight ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              MONVIAN GOLD
            </p>

            {/* Title */}
            <h2 className="text-2xl sm:text-[28px] font-black tracking-tight leading-[1.15]">
              <span className={`block ${isLight ? 'text-zinc-900' : 'text-white'}`}>Desbloqueie o</span>
              <span className={`block ${isLight ? 'text-[#C28514]' : 'text-[#E5B045]'}`}>Monvian Gold.</span>
            </h2>

            {/* Description */}
            <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mt-2.5 ${
              isLight ? 'text-zinc-600' : 'text-zinc-400'
            }`}>
              Experiências exclusivas, roteiros selecionados e lugares especiais em Campos do Jordão.
            </p>

            {/* 4 Clean Benefits List */}
            <div className="my-5 space-y-3.5">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 stroke-[1.8] shrink-0 ${
                      isLight ? 'text-zinc-800' : 'text-white'
                    }`} />
                    <span className={`text-[13px] sm:text-sm font-medium ${
                      isLight ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>
                      {benefit.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Extremely Discreet Divider Line */}
            <div className={`w-full h-px my-4 ${
              isLight ? 'bg-zinc-200/80' : 'bg-white/[0.08]'
            }`} />

            {/* Price Section */}
            <div className="text-center my-3">
              <div className={`flex items-baseline justify-center gap-1.5 ${
                isLight ? 'text-zinc-900' : 'text-white'
              }`}>
                <span className={`text-base sm:text-lg font-bold ${
                  isLight ? 'text-zinc-500' : 'text-zinc-300'
                }`}>R$</span>
                <span className="text-3xl sm:text-4xl font-black tracking-tight">19.90</span>
              </div>
              <p className={`text-[9px] sm:text-[10px] font-medium tracking-[0.2em] uppercase mt-1 ${
                isLight ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                PAGAMENTO ÚNICO · ACESSO VITALÍCIO
              </p>
            </div>

            {/* Discrete Luxury Action Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              id="btn-unlock-gold-modal"
              disabled={isProcessing}
              onClick={handleUnlockClick}
              className={`w-full h-13 rounded-full font-semibold text-xs sm:text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 mt-4 ${
                isLight
                  ? 'bg-zinc-900 hover:bg-black text-white shadow-lg shadow-black/15 border border-zinc-800'
                  : 'bg-gradient-to-b from-[#2C2D33] to-[#191A1E] hover:from-[#35363D] hover:to-[#222328] text-white border border-white/15 shadow-xl shadow-black/60'
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center gap-2 text-white">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processando...</span>
                </div>
              ) : (
                <>
                  <span>ATIVAR GOLD</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                </>
              )}
            </motion.button>

            {purchaseNotice && (
              <p className="text-[11px] font-medium text-center text-amber-500 dark:text-amber-400 mt-2.5 px-2 animate-fadeIn">
                {purchaseNotice}
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
