import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, Check } from 'lucide-react';
import { Itinerary } from '../../types';
import { PlatanoLeafIcon } from './PlatanoLeafIcon';
import { usePlatanos } from '../../hooks/usePlatanos';

interface PlatanoPurchaseConfirmModalProps {
  itinerary: Itinerary | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSuccess: (
    itinerary: Itinerary,
    result: { charged: number; balanceAfter: number; alreadyUnlocked: boolean }
  ) => void;
  onOpenWalletTopUp: () => void;
  theme?: 'dark' | 'light';
}

export const PlatanoPurchaseConfirmModal: React.FC<PlatanoPurchaseConfirmModalProps> = ({
  itinerary,
  isOpen,
  onClose,
  onConfirmSuccess,
  onOpenWalletTopUp,
  theme = 'dark',
}) => {
  const { wallet, getItineraryPlatanoPrice, isItineraryUnlocked, purchaseItinerary, refreshWallet } =
    usePlatanos();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastItineraryRef = useRef<Itinerary | null>(itinerary);
  if (itinerary) {
    lastItineraryRef.current = itinerary;
  }
  const activeItinerary = itinerary || lastItineraryRef.current;

  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSubmitting(false);
    const timer = setTimeout(() => {
      refreshWallet();
    }, 260);
    return () => clearTimeout(timer);
  }, [isOpen, activeItinerary?.id, refreshWallet]);

  if (typeof document === 'undefined') return null;

  const alreadyUnlocked = activeItinerary ? isItineraryUnlocked(activeItinerary.id) : false;
  const price = alreadyUnlocked || !activeItinerary ? 0 : getItineraryPlatanoPrice(activeItinerary);
  const currentBalance = wallet.balance;
  const hasEnoughBalance = alreadyUnlocked || currentBalance >= price;
  const projectedBalance = alreadyUnlocked
    ? currentBalance
    : Math.max(0, currentBalance - price);

  const handleConfirm = async () => {
    if (submitting || !activeItinerary) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await purchaseItinerary(activeItinerary.id, activeItinerary.title);
      onConfirmSuccess(activeItinerary, {
        charged: res.charged,
        balanceAfter: res.balanceAfter,
        alreadyUnlocked: res.alreadyUnlocked,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível concluir a operação.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && activeItinerary && (
        <motion.div
          key="platano-confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-[340] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-[2px] px-0 sm:px-4"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
            willChange: 'opacity',
            transform: 'translate3d(0,0,0)',
            WebkitTransform: 'translate3d(0,0,0)',
          }}
        >
          <motion.div
            key={`platano-confirm-sheet-${activeItinerary.id}`}
            initial={{ opacity: 0, y: 36, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.72 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-t-[28px] sm:rounded-[26px] p-6 border-t sm:border transform-gpu ${
              isDark
                ? 'bg-[#000000] text-[#FFFFFF] border-[#262626]'
                : 'bg-[#FFFFFF] text-[#000000] border-[#E5E5EA]'
            }`}
            style={{
              paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 18px), 22px)',
              willChange: 'transform, opacity',
              transform: 'translate3d(0,0,0)',
              WebkitTransform: 'translate3d(0,0,0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[12px] font-medium tracking-tight text-[#8E8E93] block">
                  {alreadyUnlocked ? 'Roteiro liberado' : 'Liberar roteiro premium'}
                </span>
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] leading-snug line-clamp-2 mt-0.5">
                  {activeItinerary.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#111111] text-[#8E8E93] hover:text-[#FFFFFF]'
                    : 'bg-[#F5F5F7] text-[#8E8E93] hover:text-[#000000]'
                }`}
                aria-label="Fechar"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            {/* Balance Calculation Summary */}
            <div
              className={`mt-5 p-4 rounded-2xl border space-y-2.5 ${
                isDark
                  ? 'bg-[#111111] border-[#262626]'
                  : 'bg-[#F5F5F7] border-[#E5E5EA]'
              }`}
            >
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#8E8E93]">Custo do roteiro</span>
                <span className="font-semibold flex items-center gap-1 tabular-nums">
                  <PlatanoLeafIcon className="w-[21px] h-[21px]" variant="monochrome" />
                  {alreadyUnlocked ? '0 (Já adquirido)' : `${price} Plátanos`}
                </span>
              </div>

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#8E8E93]">Seu saldo atual</span>
                <span className="font-medium flex items-center gap-1 tabular-nums">
                  <PlatanoLeafIcon className="w-[21px] h-[21px]" variant="monochrome" />
                  {currentBalance} Plátanos
                </span>
              </div>

              <div
                className={`pt-2.5 border-t flex items-center justify-between text-[13px] ${
                  isDark ? 'border-[#262626]' : 'border-[#E5E5EA]'
                }`}
              >
                <span className="text-[#8E8E93]">
                  {hasEnoughBalance ? 'Saldo após liberar' : 'Faltam para liberar'}
                </span>
                <span className="font-semibold flex items-center gap-1 tabular-nums">
                  <PlatanoLeafIcon className="w-[21px] h-[21px]" variant="monochrome" />
                  {hasEnoughBalance
                    ? `${projectedBalance} Plátanos`
                    : `${price - currentBalance} Plátanos`}
                </span>
              </div>
            </div>

            {!hasEnoughBalance && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#8E8E93]">
                Seu saldo é insuficiente para liberar este roteiro. Adicione Plátanos à sua carteira para continuar.
              </p>
            )}

            {errorMsg && (
              <div
                className={`mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  isDark
                    ? 'bg-[#111111] border-[#262626] text-[#FFFFFF]'
                    : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#000000]'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-[#8E8E93]" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-5 flex items-center gap-2.5">
              {hasEnoughBalance ? (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={onClose}
                    className={`flex-1 h-11 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#111111] text-[#8E8E93] hover:text-[#FFFFFF]'
                        : 'bg-[#F5F5F7] text-[#8E8E93] hover:text-[#000000]'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirm}
                    className={`flex-1 h-11 rounded-full text-[13px] font-semibold tracking-tight flex items-center justify-center gap-1.5 transition-transform duration-150 cursor-pointer active:scale-97 disabled:opacity-50 ${
                      isDark
                        ? 'bg-[#FFFFFF] text-[#000000] hover:bg-white/90'
                        : 'bg-[#000000] text-[#FFFFFF] hover:bg-black/90'
                    }`}
                  >
                    {submitting ? (
                      <span>Confirmando...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Confirmar</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`flex-1 h-11 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#111111] text-[#8E8E93] hover:text-[#FFFFFF]'
                        : 'bg-[#F5F5F7] text-[#8E8E93] hover:text-[#000000]'
                    }`}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenWalletTopUp();
                    }}
                    className={`flex-1 h-11 rounded-full text-[13px] font-semibold tracking-tight flex items-center justify-center gap-1.5 transition-transform duration-150 cursor-pointer active:scale-97 ${
                      isDark
                        ? 'bg-[#FFFFFF] text-[#000000] hover:bg-white/90'
                        : 'bg-[#000000] text-[#FFFFFF] hover:bg-black/90'
                    }`}
                  >
                    <PlatanoLeafIcon className="w-[21px] h-[21px]" variant="monochrome" />
                    <span>Comprar Plátanos</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
