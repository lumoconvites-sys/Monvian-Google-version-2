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

  const [checkoutUrl, setCheckoutUrl] = React.useState<string>('');

  const createStripeCheckoutUrl = React.useCallback(async (): Promise<string> => {
    const token = localStorage.getItem('monvian_token') || localStorage.getItem('monvian_auth_token') || '';
    let storedEmail = '';
    let storedUserId = '';
    try {
      const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
      storedEmail = (u.email || u.whatsapp || '').trim();
      storedUserId = u.id ? String(u.id) : '';
    } catch {}

    const referralCode = localStorage.getItem('monvian_referral_code') || '';

    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        email: storedEmail,
        userId: storedUserId,
        referralCode,
        forceCheckout: true
      })
    });

    const data = await res.json();
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Não foi possível iniciar o checkout no Stripe.');
    }
    return data.url as string;
  }, []);

  // Pre-fetch Stripe Checkout URL as soon as modal opens so clicking the button opens instantaneously without iframe white screen
  React.useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setPurchaseNotice('');
      return;
    }
    let cancelled = false;
    createStripeCheckoutUrl()
      .then((url) => {
        if (!cancelled && url) {
          setCheckoutUrl(url);
        }
      })
      .catch((err) => {
        console.warn('Pre-fetch Stripe session warning:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, createStripeCheckoutUrl]);

  const openStripeUrlSafely = (url: string) => {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isInIframe) {
      // Stripe Checkout sets X-Frame-Options: DENY. Navigating inside an iframe causes a blank white screen.
      // Always open in a new top-level browser tab via an anchor element with target="_blank".
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsProcessing(false);
      return;
    }
    window.location.href = url;
  };

  const handleUnlockClick = async (e: React.MouseEvent) => {
    if (isProcessing) return;

    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    // If checkoutUrl is already preloaded and we are in an iframe, let the native <a target="_blank"> open it directly!
    if (checkoutUrl && isInIframe) {
      return;
    }

    e.preventDefault();
    if (checkoutUrl && !isInIframe) {
      setIsProcessing(true);
      window.location.href = checkoutUrl;
      return;
    }

    setIsProcessing(true);
    setPurchaseNotice('');

    try {
      const url = await createStripeCheckoutUrl();
      setCheckoutUrl(url);
      openStripeUrlSafely(url);
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
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 12 }}
          transition={{ type: 'spring', damping: 22, stiffness: 380 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-[370px] sm:max-w-[390px] rounded-[36px] overflow-hidden transition-colors ${
            isLight
              ? 'bg-white text-zinc-900 border border-zinc-200/90 shadow-[0_25px_70px_rgba(0,0,0,0.18)]'
              : 'bg-[#000000] text-white border border-[#262626] shadow-[0_25px_80px_rgba(0,0,0,0.9)]'
          }`}
        >
          {/* Top Banner Image with Smooth Fade to Card Background */}
          <div className="relative w-full h-44 sm:h-48 overflow-hidden bg-black">
            <motion.img
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1.05, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.02 }}
              src="/stripe_gold_banner.jpg"
              alt="Campos do Jordão Monvian Gold"
              className="w-full h-full object-cover object-center"
            />
            {/* Elegant gradient overlay merging into bottom card background */}
            <div className={`absolute inset-0 ${
              isLight
                ? 'bg-gradient-to-b from-black/15 via-white/20 to-white'
                : 'bg-gradient-to-b from-black/25 via-black/40 to-[#000000]'
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
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
            >
              <p className={`text-[10px] font-bold tracking-[0.25em] uppercase mb-1.5 ${
                isLight ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                MONVIAN ELITE GOLD
              </p>

              {/* Title */}
              <h2 className="text-2xl sm:text-[28px] font-black tracking-tight leading-[1.15]">
                <span className={`block ${isLight ? 'text-zinc-900' : 'text-white'}`}>Desbloqueie o</span>
                <span className={`block ${isLight ? 'text-[#C28514]' : 'text-[#E5B045]'}`}>Monvian Elite Gold.</span>
              </h2>

              {/* Description */}
              <p className={`text-xs sm:text-[13px] font-normal leading-relaxed mt-2.5 ${
                isLight ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                Experiências exclusivas, roteiros selecionados e lugares especiais em Campos do Jordão.
              </p>
            </motion.div>

            {/* 4 Clean Benefits List */}
            <div className="my-5 space-y-3.5">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.07 + index * 0.03 }}
                    className="flex items-center gap-3"
                  >
                    <Icon className={`w-5 h-5 stroke-[1.8] shrink-0 ${
                      isLight ? 'text-zinc-800' : 'text-white'
                    }`} />
                    <span className={`text-[13px] sm:text-sm font-medium ${
                      isLight ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>
                      {benefit.text}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Extremely Discreet Divider Line */}
            <div className={`w-full h-px my-4 ${
              isLight ? 'bg-zinc-200/80' : 'bg-[#262626]'
            }`} />

            {/* Price Section */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.18 }}
              className="text-center my-3"
            >
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
            </motion.div>

            {/* Discrete Luxury Action Button */}
            {checkoutUrl && typeof window !== 'undefined' && window.self !== window.top ? (
              <motion.a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.21 }}
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                id="btn-unlock-gold-modal"
                className={`w-full h-13 rounded-full font-semibold text-xs sm:text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors mt-4 no-underline ${
                  isLight
                    ? 'bg-zinc-900 hover:bg-black text-white shadow-lg shadow-black/15 border border-zinc-800'
                    : 'bg-gradient-to-b from-[#2C2D33] to-[#191A1E] hover:from-[#35363D] hover:to-[#222328] text-white border border-white/15 shadow-xl shadow-black/60'
                }`}
              >
                <span>ATIVAR ELITE GOLD</span>
                <ArrowRight className="w-4 h-4 stroke-[2.2]" />
              </motion.a>
            ) : (
              <motion.button
                initial={{ opacity: 0, scale: 0.88, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.21 }}
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                type="button"
                id="btn-unlock-gold-modal"
                disabled={isProcessing}
                onClick={handleUnlockClick}
                className={`w-full h-13 rounded-full font-semibold text-xs sm:text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 mt-4 ${
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
                    <span>ATIVAR ELITE GOLD</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </motion.button>
            )}

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
