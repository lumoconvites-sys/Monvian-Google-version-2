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
  onConfirmSuccess: (itinerary: Itinerary, result: { charged: number; balanceAfter: number; alreadyUnlocked: boolean }) => void;
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
    // Defer background wallet check until after the sheet slide-up animation finishes
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
          className="fixed inset-0 z-[340] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-md px-0 sm:px-4"
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            willChange: 'opacity',
            transform: 'translate3d(0,0,0)',
            WebkitTransform: 'translate3d(0,0,0)',
          }}
        >
          <motion.div
            key={`platano-confirm-sheet-${activeItinerary.id}`}
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.72 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-t-[28px] sm:rounded-[26px] p-5 border backdrop-blur-2xl transform-gpu ${
              isDark
                ? 'bg-[#101013]/88 text-white border-white/10 shadow-[0_-10px_36px_rgba(0,0,0,0.75)]'
                : 'bg-white/90 text-zinc-900 border-zinc-200/90 shadow-xl'
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
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#D9A84E]/15 border border-[#D9A84E]/35 flex items-center justify-center shrink-0">
                  <PlatanoLeafIcon className="w-4 h-4" variant="gold" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D9A84E] block">
                    {alreadyUnlocked ? 'Roteiro liberado' : 'Adicionar Roteiro'}
                  </span>
                  <h3 className="text-[16px] font-bold tracking-tight leading-snug line-clamp-2">
                    {activeItinerary.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer ${
                  isDark
                    ? 'bg-white/10 text-zinc-400 hover:text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'
                }`}
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            {/* Balance Calculation Summary Card */}
            <div
              className={`mt-4 p-4 rounded-2xl border space-y-2.5 ${
                isDark
                  ? 'bg-[#17171B] border-white/10'
                  : 'bg-zinc-50 border-zinc-200/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-zinc-400 font-medium' : 'text-zinc-500 font-medium'}>
                  Preço do roteiro
                </span>
                <span className="font-bold flex items-center gap-1 tabular-nums">
                  <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
                  {alreadyUnlocked ? '0 (Já adquirido)' : `${price}`}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-zinc-400 font-medium' : 'text-zinc-500 font-medium'}>
                  Seu saldo atual
                </span>
                <span className="font-semibold flex items-center gap-1 tabular-nums">
                  <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
                  {currentBalance}
                </span>
              </div>

              <div
                className={`pt-2 border-t flex items-center justify-between text-xs ${
                  isDark ? 'border-white/10' : 'border-zinc-200/80'
                }`}
              >
                <span className="font-semibold">
                  {hasEnoughBalance ? 'Saldo após a compra' : 'Faltam para liberar'}
                </span>
                {hasEnoughBalance ? (
                  <span className="font-bold text-[#D9A84E] flex items-center gap-1 tabular-nums">
                    <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
                    {projectedBalance}
                  </span>
                ) : (
                  <span className="font-bold text-amber-400 flex items-center gap-1 tabular-nums">
                    <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
                    {price - currentBalance}
                  </span>
                )}
              </div>
            </div>

            {!hasEnoughBalance && (
              <p
                className={`mt-3 text-xs leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                Seu saldo é insuficiente para adicionar este roteiro. Recarregue sua carteira para liberar o roteiro completo.
              </p>
            )}

            {errorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex items-center gap-2.5">
              {hasEnoughBalance ? (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={onClose}
                    className={`flex-1 h-11 rounded-2xl text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/10 text-zinc-300 hover:bg-white/15'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirm}
                    className="flex-1 h-11 rounded-2xl bg-[#D9A84E] hover:bg-[#e2b45c] text-[#141109] text-xs font-bold tracking-tight flex items-center justify-center gap-1.5 transition-transform duration-150 cursor-pointer active:scale-97 disabled:opacity-60"
                  >
                    {submitting ? (
                      <span>Confirmando...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
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
                    className={`flex-1 h-11 rounded-2xl text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/10 text-zinc-300 hover:bg-white/15'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
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
                    className="flex-1 h-11 rounded-2xl bg-[#D9A84E] hover:bg-[#e2b45c] text-[#141109] text-xs font-bold tracking-tight flex items-center justify-center gap-1.5 transition-transform duration-150 cursor-pointer active:scale-97"
                  >
                    <PlatanoLeafIcon className="w-3.5 h-3.5" variant="dark" />
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
