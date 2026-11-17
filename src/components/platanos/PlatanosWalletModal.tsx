import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
} from 'motion/react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Crown,
  ChevronRight,
  Shield,
  Lock,
} from 'lucide-react';
import { PlatanoLeafIcon, PLATANO_LEAF_3D_ICON_SRC } from './PlatanoLeafIcon';
import { usePlatanos } from '../../hooks/usePlatanos';
import { PlatanoPackage, PlatanoTransaction } from '../../types';
import { useIOSBackEntry } from '../../services/iosNavigationManager';
import platanosLeafHero3d from '../../assets/images/platanos_leaf_hero_3d_1794936165022.jpg';
import platanosLeafCardGold from '../../assets/images/platanos_leaf_card_gold_1794936165278.jpg';

interface PlatanosWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  initialTab?: 'topup' | 'history';
}

function formatDateTimePtBR(raw?: string): string {
  if (!raw) return '';
  try {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
}

function getStatusLabel(status: PlatanoTransaction['status']): string {
  switch (status) {
    case 'completed':
      return 'Confirmado';
    case 'pending':
      return 'Pendente';
    case 'cancelled':
      return 'Cancelado';
    case 'failed':
      return 'Recusado';
    case 'refunded':
      return 'Reembolsado';
    default:
      return status;
  }
}

function getPackageDescription(platanos: number): string {
  const routesCount = Math.max(1, Math.floor(platanos / 15));
  return routesCount === 1
    ? 'Libera até 1 roteiro premium'
    : `Libera até ${routesCount} roteiros premium`;
}

export const PlatanosWalletModal: React.FC<PlatanosWalletModalProps> = ({
  isOpen,
  onClose,
  theme = 'light',
  initialTab = 'topup',
}) => {
  const isDark = theme === 'dark';
  const { wallet, refreshWallet, startTopUpCheckout } = usePlatanos();
  const [activeTab, setActiveTab] = useState<'topup' | 'history'>(initialTab);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [cardImgFailed, setCardImgFailed] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const dragHeaderRef = useRef<HTMLDivElement | null>(null);
  const sheetDragY = useMotionValue(0);
  const dragScale = useTransform(sheetDragY, [0, 320], [1, 0.965]);
  const backdropDragOpacity = useTransform(sheetDragY, [0, 260], [1, 0.35]);

  // Pre-decode 3D Platanus leaf images so opening hits 120fps with zero decode hitch
  useEffect(() => {
    try {
      [platanosLeafHero3d, platanosLeafCardGold, PLATANO_LEAF_3D_ICON_SRC].forEach((src) => {
        const img = new Image();
        img.src = src;
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {});
        }
      });
    } catch {}
  }, []);

  // iOS Edge-Swipe Back support
  useIOSBackEntry({
    id: 'platanos-wallet-modal',
    enabled: Boolean(isOpen),
    priority: 325,
    label: 'Carteira de Plátanos',
    onPop: onClose,
  });

  useEffect(() => {
    if (!isOpen) return;
    sheetDragY.set(0);
    setActiveTab(initialTab);
    setErrorMessage(null);
    setCheckoutLoadingId(null);
    const timer = setTimeout(() => {
      refreshWallet();
    }, 260);
    return () => clearTimeout(timer);
  }, [isOpen, initialTab, refreshWallet, sheetDragY]);

  useEffect(() => {
    const handleCloseAll = () => onClose();
    window.addEventListener('monvian-close-modals', handleCloseAll);
    return () => window.removeEventListener('monvian-close-modals', handleCloseAll);
  }, [onClose]);

  // Smooth native iOS pull-down-to-dismiss on top header / grabber
  useEffect(() => {
    if (!isOpen) return;
    const headerEl = dragHeaderRef.current;
    if (!headerEl) return;

    let startY = 0;
    let startTime = 0;
    let isDragging = false;
    let currentY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startTime = performance.now();
      isDragging = true;
      currentY = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        if (e.cancelable) e.preventDefault();
        currentY = dy * 0.88;
        sheetDragY.set(currentY);
      }
    };

    const onTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      const elapsed = Math.max(16, performance.now() - startTime);
      const velocity = currentY / elapsed;
      if (currentY > 110 || (currentY > 42 && velocity > 0.42)) {
        onClose();
      } else {
        animate(sheetDragY, 0, {
          type: 'spring',
          stiffness: 440,
          damping: 36,
        });
      }
    };

    headerEl.addEventListener('touchstart', onTouchStart, { passive: true });
    headerEl.addEventListener('touchmove', onTouchMove, { passive: false });
    headerEl.addEventListener('touchend', onTouchEnd, { passive: true });
    headerEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      headerEl.removeEventListener('touchstart', onTouchStart);
      headerEl.removeEventListener('touchmove', onTouchMove);
      headerEl.removeEventListener('touchend', onTouchEnd);
      headerEl.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isOpen, onClose, sheetDragY]);

  const handleCheckout = async (pkg: PlatanoPackage) => {
    try {
      setErrorMessage(null);
      setCheckoutLoadingId(pkg.id);
      await startTopUpCheckout(pkg.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao iniciar pagamento no Stripe.');
      setCheckoutLoadingId(null);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="platanos-wallet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.16 }
              : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
          }
          onClick={onClose}
          className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center sm:p-4"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
            willChange: 'opacity',
          }}
        >
          {/* Dedicated GPU-composited scrim so blur stays stable at 120fps */}
          <motion.div
            aria-hidden="true"
            style={{
              opacity: backdropDragOpacity,
              transform: 'translate3d(0,0,0)',
              WebkitTransform: 'translate3d(0,0,0)',
              willChange: 'opacity',
            }}
            className="absolute inset-0 bg-black/44 backdrop-blur-[6px] pointer-events-none"
          />

          {/* Outer Motion Container: 120fps lightweight spring open & smooth float-down exit */}
          <motion.div
            key="platanos-wallet-sheet"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { y: 116, scale: 0.955, opacity: 0 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { y: 0, scale: 1, opacity: 1 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0, transition: { duration: 0.16 } }
                : {
                    y: 108,
                    scale: 0.96,
                    opacity: 0,
                    transition: {
                      duration: 0.32,
                      ease: [0.32, 0.72, 0, 1],
                    },
                  }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.16 }
                : {
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    mass: 0.82,
                  }
            }
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-[430px] sm:max-w-md flex flex-col transform-gpu"
            style={{
              willChange: 'transform, opacity',
              transformOrigin: 'center bottom',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Inner Drag Layer: isolated MotionValue so swipe-to-dismiss never conflicts with open/exit */}
            <motion.div
              className={`relative w-full max-h-[91dvh] flex flex-col rounded-t-[36px] sm:rounded-[34px] overflow-hidden transform-gpu ${
                isDark
                  ? 'bg-[#0B0B0D] text-[#FFFFFF] border-t sm:border border-white/[0.08] shadow-[0_-14px_48px_rgba(0,0,0,0.72),0_20px_60px_rgba(0,0,0,0.85)]'
                  : 'bg-[#FFFFFF] text-[#000000] shadow-[0_-10px_40px_rgba(0,0,0,0.16),0_18px_50px_rgba(0,0,0,0.18)]'
              }`}
              style={{
                y: sheetDragY,
                scale: dragScale,
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                contain: 'layout style paint',
              }}
            >
            {/* Top Surface with Subtle Radial Warm Depth + 3D Platanus Leaf */}
            <div
              ref={dragHeaderRef}
              className="relative shrink-0 overflow-hidden select-none"
              style={{
                background: isDark
                  ? 'radial-gradient(120% 100% at 84% 32%, #1D1812 0%, #0B0B0D 66%)'
                  : 'radial-gradient(120% 100% at 84% 32%, #FAF5EC 0%, #FFFFFF 64%)',
              }}
            >
              {/* Top Grabber Indicator (No Close X Button) */}
              <div className="relative z-20 pt-2.5 pb-1 flex justify-center">
                <div
                  className={`w-10 h-[4.5px] rounded-full ${
                    isDark ? 'bg-[#3A3A3C]' : 'bg-[#D1D1D6]'
                  }`}
                />
              </div>

              {/* Header + Prominent Balance (Left) & 3D Platanus Leaf (Right) */}
              <div className="relative px-6 pt-2 pb-4 flex items-center justify-between gap-2 min-h-[168px]">
                {/* Left Column: Carteira / Seus Plátanos / Balance */}
                <div className="relative z-10 flex-1 min-w-0 pr-2">
                  <span className="block text-[13px] font-medium tracking-[-0.01em] text-[#8E8E93]">
                    Carteira
                  </span>
                  <h2
                    className={`text-[26px] font-bold tracking-[-0.025em] leading-[1.12] mt-0.5 ${
                      isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                    }`}
                  >
                    Seus Plátanos
                  </h2>

                  <div className="mt-4 flex items-center gap-2.5">
                    <span
                      className={`text-[52px] font-bold tracking-[-0.035em] leading-none tabular-nums ${
                        isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                      }`}
                    >
                      {wallet.balance}
                    </span>
                    <PlatanoLeafIcon
                      className="w-[42px] h-[42px] shrink-0"
                      variant={isDark ? 'light' : 'dark'}
                    />
                  </div>

                  <p
                    className={`mt-1.5 text-[13.5px] font-medium tracking-[-0.01em] ${
                      isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'
                    }`}
                  >
                    {wallet.balance === 1
                      ? 'Plátano disponível'
                      : 'Plátanos disponíveis'}
                  </p>
                </div>

                {/* Right Column: Realistic 3D Platanus Leaf Illustration */}
                <motion.div
                  aria-hidden="true"
                  initial={
                    prefersReducedMotion
                      ? false
                      : { opacity: 0, scale: 0.9, rotate: -5 }
                  }
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.46,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.06,
                  }}
                  style={{ willChange: 'transform, opacity' }}
                  className="relative z-0 w-[144px] h-[144px] sm:w-[162px] sm:h-[162px] shrink-0 -mr-2 pointer-events-none select-none flex items-center justify-center"
                >
                  {isDark ? (
                    <img
                      src={PLATANO_LEAF_3D_ICON_SRC}
                      alt=""
                      draggable={false}
                      decoding="async"
                      className="w-[126px] h-[126px] sm:w-[140px] sm:h-[140px] object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)]"
                    />
                  ) : !heroImgFailed ? (
                    <img
                      src={platanosLeafHero3d}
                      alt=""
                      draggable={false}
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-contain mix-blend-multiply scale-110"
                      style={{
                        WebkitMaskImage:
                          'radial-gradient(circle at center, #000 62%, transparent 96%)',
                        maskImage:
                          'radial-gradient(circle at center, #000 62%, transparent 96%)',
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-[#F5EFE4] flex items-center justify-center">
                      <PlatanoLeafIcon className="w-[72px] h-[72px] text-[#9E6B2B]" />
                    </div>
                  )}
                </motion.div>
              </div>
            </div>

            {/* Translucent Presentation Banner */}
            <div className="px-5 shrink-0">
              <div
                className={`px-4 py-2.5 rounded-[16px] backdrop-blur-md border flex items-center gap-2.5 ${
                  isDark
                    ? 'bg-[#1C1C1E]/90 border-white/[0.06]'
                    : 'bg-[#F2F2F7]/85 border-black/[0.03]'
                }`}
              >
                <Crown
                  className={`w-[17px] h-[17px] stroke-[1.9] shrink-0 ${
                    isDark ? 'text-[#F5F5F7]' : 'text-[#1C1C1E]'
                  }`}
                />
                <span
                  className={`text-[13px] font-medium tracking-[-0.01em] leading-snug ${
                    isDark ? 'text-[#D4D4D8]' : 'text-[#3A3A3C]'
                  }`}
                >
                  Compre Plátanos e desbloqueie roteiros premium!
                </span>
              </div>
            </div>

            {/* Modern Segmented Control Tabs */}
            <div className="px-5 pt-3.5 pb-3 shrink-0">
              <div
                role="tablist"
                aria-label="Opções da carteira"
                className={`p-[3px] rounded-full grid grid-cols-2 relative ${
                  isDark ? 'bg-[#1C1C1E]' : 'bg-[#F2F2F7]'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'topup'}
                  onClick={() => setActiveTab('topup')}
                  className={`relative h-10 rounded-full text-[13.5px] font-semibold tracking-[-0.01em] transition-colors duration-200 cursor-pointer flex items-center justify-center whitespace-nowrap ${
                    activeTab === 'topup'
                      ? isDark
                        ? 'text-[#000000]'
                        : 'text-[#FFFFFF]'
                      : isDark
                        ? 'text-[#8E8E93] hover:text-[#FFFFFF]'
                        : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                  }`}
                >
                  {activeTab === 'topup' && (
                    <motion.span
                      layoutId="platanos-wallet-tab-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 460,
                        damping: 36,
                      }}
                      className={`absolute inset-0 rounded-full ${
                        isDark
                          ? 'bg-[#FFFFFF] shadow-[0_2px_10px_rgba(0,0,0,0.45)]'
                          : 'bg-[#000000] shadow-[0_2px_8px_rgba(0,0,0,0.14)]'
                      }`}
                    />
                  )}
                  <span className="relative z-10">Comprar Plátanos</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'history'}
                  onClick={() => setActiveTab('history')}
                  className={`relative h-10 rounded-full text-[13.5px] font-semibold tracking-[-0.01em] transition-colors duration-200 cursor-pointer flex items-center justify-center whitespace-nowrap tabular-nums ${
                    activeTab === 'history'
                      ? isDark
                        ? 'text-[#000000]'
                        : 'text-[#FFFFFF]'
                      : isDark
                        ? 'text-[#8E8E93] hover:text-[#FFFFFF]'
                        : 'text-[#6E6E73] hover:text-[#1C1C1E]'
                  }`}
                >
                  {activeTab === 'history' && (
                    <motion.span
                      layoutId="platanos-wallet-tab-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 460,
                        damping: 36,
                      }}
                      className={`absolute inset-0 rounded-full ${
                        isDark
                          ? 'bg-[#FFFFFF] shadow-[0_2px_10px_rgba(0,0,0,0.45)]'
                          : 'bg-[#000000] shadow-[0_2px_8px_rgba(0,0,0,0.14)]'
                      }`}
                    />
                  )}
                  <span className="relative z-10">
                    Histórico
                    {wallet.transactions.length > 0
                      ? ` (${wallet.transactions.length})`
                      : ''}
                  </span>
                </button>
              </div>
            </div>

            {/* Error Alert if any */}
            {errorMessage && (
              <div className="px-5 pb-2 shrink-0">
                <div
                  className={`p-3 rounded-2xl border text-xs font-medium flex items-center gap-2 ${
                    isDark
                      ? 'border-white/10 bg-[#1C1C1E] text-[#FFFFFF]'
                      : 'border-[#E5E5EA] bg-[#F5F5F7] text-[#000000]'
                  }`}
                >
                  <AlertCircle
                    className={`w-4 h-4 shrink-0 ${
                      isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'
                    }`}
                  />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Scrollable Body (Packages / History) */}
            <div
              ref={scrollBodyRef}
              className={`flex-1 overflow-y-auto px-5 pt-1 pb-3 overscroll-contain ${
                isDark ? 'bg-[#0E0E11]' : 'bg-[#FAFAFB]'
              }`}
              style={{
                WebkitOverflowScrolling: 'touch',
                background: isDark
                  ? 'linear-gradient(180deg, #0B0B0D 0%, #0E0E11 16%, #101013 100%)'
                  : 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFB 16%, #F8F8FA 100%)',
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {activeTab === 'topup' ? (
                  <motion.div
                    key="wallet-tab-topup"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-3 pb-1"
                  >
                    {wallet.packages.map((pkg) => {
                      const isSpecial200 = Boolean(
                        pkg.isBestValue || pkg.platanos === 200
                      );
                      const isProcessing = checkoutLoadingId === pkg.id;
                      const benefitText = getPackageDescription(pkg.platanos);

                      if (isSpecial200) {
                        return (
                          <div
                            key={pkg.id}
                            className={`relative overflow-hidden rounded-[24px] px-5 py-4 border flex items-center justify-between gap-4 ${
                              isDark
                                ? 'border-[#D4B47C]/25 shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
                                : 'border-[#E8DEC8] shadow-[0_6px_22px_rgba(148,112,56,0.09),0_1px_4px_rgba(0,0,0,0.03)]'
                            }`}
                            style={{
                              background: isDark
                                ? 'linear-gradient(135deg, #161411 0%, #1E1A13 58%, #262016 100%)'
                                : 'linear-gradient(135deg, #FFFFFF 0%, #FAF5EC 58%, #F4E9D4 100%)',
                            }}
                          >
                            {/* Enlarged Subtle 3D Platanus Leaf Backdrop */}
                            {isDark ? (
                              <img
                                src={PLATANO_LEAF_3D_ICON_SRC}
                                alt=""
                                aria-hidden="true"
                                draggable={false}
                                className="absolute -right-6 top-1/2 -translate-y-1/2 w-[148px] h-[148px] object-contain opacity-[0.22] pointer-events-none select-none"
                              />
                            ) : (
                              <>
                                {!cardImgFailed && (
                                  <img
                                    src={platanosLeafCardGold}
                                    alt=""
                                    aria-hidden="true"
                                    draggable={false}
                                    referrerPolicy="no-referrer"
                                    onError={() => setCardImgFailed(true)}
                                    className="absolute inset-0 w-full h-full object-cover object-right opacity-95 pointer-events-none select-none"
                                  />
                                )}
                                {/* Left Readability Scrim */}
                                <div
                                  aria-hidden="true"
                                  className="absolute inset-0 bg-gradient-to-r from-[#FDFBF7]/95 via-[#FCF8F0]/75 to-transparent pointer-events-none"
                                />
                              </>
                            )}

                            <div className="relative z-10 min-w-0">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-[-0.01em] mb-1.5 ${
                                  isDark
                                    ? 'bg-[#D4B47C]/20 text-[#F3D8A8]'
                                    : 'bg-[#EDE0C8]/90 text-[#1C1C1E]'
                                }`}
                              >
                                <Crown className="w-3 h-3 stroke-[2.1] shrink-0" />
                                <span>Melhor valor</span>
                              </span>

                              <h3
                                className={`text-[18.5px] font-bold tracking-[-0.02em] leading-tight tabular-nums ${
                                  isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                                }`}
                              >
                                {pkg.platanos} Plátanos
                              </h3>
                              <p
                                className={`text-[13px] font-normal mt-1 leading-snug ${
                                  isDark ? 'text-[#C7C2B8]' : 'text-[#52525B]'
                                }`}
                              >
                                {benefitText}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={Boolean(checkoutLoadingId)}
                              onClick={() => handleCheckout(pkg)}
                              className={`relative z-10 h-10 px-4 rounded-full active:scale-[0.96] transition-all duration-150 inline-flex items-center justify-center gap-1 text-[14px] font-semibold tracking-[-0.01em] tabular-nums shrink-0 cursor-pointer disabled:opacity-55 ${
                                isDark
                                  ? 'bg-[#FFFFFF] text-[#000000] hover:bg-[#E5E5EA] shadow-[0_4px_14px_rgba(0,0,0,0.45)]'
                                  : 'bg-[#000000] text-[#FFFFFF] hover:bg-[#1C1C1E] shadow-[0_4px_12px_rgba(0,0,0,0.16)]'
                              }`}
                            >
                              <span>
                                {isProcessing ? 'Abrindo...' : pkg.priceBRL}
                              </span>
                              {!isProcessing && (
                                <ChevronRight className="w-3.5 h-3.5 stroke-[2.4] opacity-85" />
                              )}
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={pkg.id}
                          className={`rounded-[24px] px-5 py-4 border flex items-center justify-between gap-4 ${
                            isDark
                              ? 'bg-[#161619] border-white/[0.07] shadow-[0_4px_18px_rgba(0,0,0,0.35)]'
                              : 'bg-[#FFFFFF] border-black/[0.04] shadow-[0_4px_18px_rgba(0,0,0,0.045),0_1px_4px_rgba(0,0,0,0.025)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <h3
                              className={`text-[18px] font-bold tracking-[-0.02em] leading-tight tabular-nums ${
                                isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                              }`}
                            >
                              {pkg.platanos} Plátanos
                            </h3>
                            <p
                              className={`text-[13px] font-normal mt-1 leading-snug ${
                                isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'
                              }`}
                            >
                              {benefitText}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={Boolean(checkoutLoadingId)}
                            onClick={() => handleCheckout(pkg)}
                            className={`h-10 px-4 rounded-full active:scale-[0.96] transition-all duration-150 inline-flex items-center justify-center gap-1 text-[14px] font-semibold tracking-[-0.01em] tabular-nums shrink-0 cursor-pointer disabled:opacity-55 ${
                              isDark
                                ? 'bg-[#FFFFFF] text-[#000000] hover:bg-[#E5E5EA]'
                                : 'bg-[#000000] text-[#FFFFFF] hover:bg-[#1C1C1E]'
                            }`}
                          >
                            <span>
                              {isProcessing ? 'Abrindo...' : pkg.priceBRL}
                            </span>
                            {!isProcessing && (
                              <ChevronRight className="w-3.5 h-3.5 stroke-[2.4] opacity-85" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="wallet-tab-history"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {wallet.transactions.length === 0 ? (
                      <div className="py-14 text-center space-y-1.5">
                        <p
                          className={`text-[15px] font-semibold ${
                            isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                          }`}
                        >
                          Nenhuma movimentação ainda
                        </p>
                        <p className="text-[13px] text-[#8E8E93] max-w-xs mx-auto leading-relaxed">
                          Suas compras de Plátanos e roteiros liberados aparecerão aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 pb-1">
                        {wallet.transactions.map((tx) => {
                          const isCredit = tx.amount > 0;
                          const statusText = getStatusLabel(tx.status);

                          return (
                            <div
                              key={tx.id}
                              className={`rounded-[20px] px-4 py-3.5 border flex items-center justify-between gap-3 ${
                                isDark
                                  ? 'bg-[#161619] border-white/[0.07] shadow-[0_4px_14px_rgba(0,0,0,0.3)]'
                                  : 'bg-[#FFFFFF] border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.035)]'
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                    isDark
                                      ? 'bg-[#262629] text-[#E4E4E7]'
                                      : 'bg-[#F2F2F7] text-[#3A3A3C]'
                                  }`}
                                >
                                  {isCredit ? (
                                    <ArrowDownLeft className="w-4 h-4 stroke-[2]" />
                                  ) : (
                                    <ArrowUpRight className="w-4 h-4 stroke-[2]" />
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p
                                    className={`text-[13.5px] font-semibold leading-snug truncate ${
                                      isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                                    }`}
                                  >
                                    {tx.description}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[11.5px] text-[#8E8E93]">
                                    <span>{formatDateTimePtBR(tx.createdAt)}</span>
                                    <span>·</span>
                                    <span>{statusText}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div
                                  className={`text-[14px] font-bold tabular-nums ${
                                    isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                                  }`}
                                >
                                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                                </div>
                                <span className="text-[11px] font-normal text-[#8E8E93] block tabular-nums">
                                  Saldo: {tx.balanceAfter}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Minimalist Stripe Security Footer */}
            <div
              className={`px-5 pt-2.5 pb-2 shrink-0 border-t flex items-center justify-center gap-1.5 ${
                isDark
                  ? 'bg-[#0B0B0D] border-white/[0.06] text-[#8E8E93]'
                  : 'bg-[#FFFFFF] border-black/[0.04] text-[#71717A]'
              }`}
            >
              <span className="relative inline-flex items-center justify-center w-4 h-4 shrink-0">
                <Shield className="w-4 h-4 stroke-[1.8]" />
                <Lock className="w-2 h-2 stroke-[2.2] absolute" />
              </span>
              <span className="text-[12px] font-medium tracking-[-0.01em]">
                Pagamento seguro processado via Stripe
              </span>
            </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
