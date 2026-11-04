import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
} from 'lucide-react';
import { PlatanoLeafIcon } from './PlatanoLeafIcon';
import { usePlatanos } from '../../hooks/usePlatanos';
import { PlatanoPackage, PlatanoTransaction } from '../../types';

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
  theme = 'dark',
  initialTab = 'topup',
}) => {
  const { wallet, refreshWallet, startTopUpCheckout } = usePlatanos();
  const [activeTab, setActiveTab] = useState<'topup' | 'history'>(initialTab);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setErrorMessage(null);
    const timer = setTimeout(() => {
      refreshWallet();
    }, 260);
    return () => clearTimeout(timer);
  }, [isOpen, initialTab, refreshWallet]);

  useEffect(() => {
    const handleCloseAll = () => onClose();
    window.addEventListener('monvian-close-modals', handleCloseAll);
    return () => window.removeEventListener('monvian-close-modals', handleCloseAll);
  }, [onClose]);

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

  const unlockedCount = wallet.unlockedItineraryIds.length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="platanos-wallet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={onClose}
          className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-[2px]"
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
            willChange: 'opacity',
          }}
        >
          <motion.div
            key="platanos-wallet-sheet"
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{
              duration: 0.24,
              ease: [0.32, 0.72, 0, 1],
            }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-md max-h-[88dvh] flex flex-col rounded-t-[28px] sm:rounded-[28px] overflow-hidden border-t sm:border transform-gpu ${
              isDark
                ? 'bg-[#000000] text-[#FFFFFF] border-[#262626]'
                : 'bg-[#FFFFFF] text-[#000000] border-[#E5E5EA]'
            }`}
            style={{
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
              willChange: 'transform',
              transform: 'translate3d(0,0,0)',
              WebkitTransform: 'translate3d(0,0,0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Grabber Indicator (iPhone Sheet) */}
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <div
                className={`w-9 h-1 rounded-full ${
                  isDark ? 'bg-[#262626]' : 'bg-[#E5E5EA]'
                }`}
              />
            </div>

            {/* Minimalist Header: Carteira / Seus Plátanos + Discreet Close Button */}
            <div className="px-6 pt-2 pb-4 flex items-start justify-between shrink-0">
              <div>
                <span className="text-[12px] font-medium tracking-tight text-[#8E8E93] block">
                  Carteira
                </span>
                <h2 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight mt-0.5">
                  Seus Plátanos
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#111111] text-[#8E8E93] hover:text-[#FFFFFF]'
                    : 'bg-[#F5F5F7] text-[#8E8E93] hover:text-[#000000]'
                }`}
                aria-label="Fechar carteira"
              >
                <X className="w-4 h-4 stroke-[2]" />
              </button>
            </div>

            {/* Prominent Real Balance (No Heavy Bordered Card) + Unlocked Premium Itineraries */}
            <div className="px-6 pb-5 shrink-0">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[40px] font-bold tracking-[-0.03em] leading-none tabular-nums">
                  {wallet.balance}
                </span>
                <div className="flex items-center gap-1.5 text-[#8E8E93]">
                  <PlatanoLeafIcon className="w-4 h-4 shrink-0" variant="monochrome" />
                  <span className="text-[15px] font-medium tracking-tight">
                    {wallet.balance === 1 ? 'Plátano disponível' : 'Plátanos disponíveis'}
                  </span>
                </div>
              </div>
              <p className="mt-1.5 text-[13px] font-normal text-[#8E8E93] tabular-nums">
                {unlockedCount}{' '}
                {unlockedCount === 1
                  ? 'roteiro premium liberado'
                  : 'roteiros premium liberados'}
              </p>
            </div>

            {/* Compact Text Tabs with Discreet Bottom Line */}
            <div
              className={`px-6 border-b flex items-center gap-6 shrink-0 ${
                isDark ? 'border-[#262626]' : 'border-[#E5E5EA]'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTab('topup')}
                className={`relative pb-3 text-[14px] font-medium tracking-tight transition-colors cursor-pointer ${
                  activeTab === 'topup'
                    ? isDark
                      ? 'text-[#FFFFFF]'
                      : 'text-[#000000]'
                    : 'text-[#8E8E93]'
                }`}
              >
                Comprar Plátanos
                {activeTab === 'topup' && (
                  <span
                    className={`absolute bottom-0 inset-x-0 h-[1.5px] rounded-full ${
                      isDark ? 'bg-[#FFFFFF]' : 'bg-[#000000]'
                    }`}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`relative pb-3 text-[14px] font-medium tracking-tight transition-colors cursor-pointer tabular-nums ${
                  activeTab === 'history'
                    ? isDark
                      ? 'text-[#FFFFFF]'
                      : 'text-[#000000]'
                    : 'text-[#8E8E93]'
                }`}
              >
                Histórico
                {wallet.transactions.length > 0 ? ` (${wallet.transactions.length})` : ''}
                {activeTab === 'history' && (
                  <span
                    className={`absolute bottom-0 inset-x-0 h-[1.5px] rounded-full ${
                      isDark ? 'bg-[#FFFFFF]' : 'bg-[#000000]'
                    }`}
                  />
                )}
              </button>
            </div>

            {/* Error Alert if any */}
            {errorMessage && (
              <div className="px-6 pt-3 shrink-0">
                <div
                  className={`p-3 rounded-xl border text-xs font-normal flex items-center gap-2 ${
                    isDark
                      ? 'bg-[#111111] border-[#262626] text-[#FFFFFF]'
                      : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#000000]'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#8E8E93]" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Scrollable Body */}
            <div
              className="flex-1 overflow-y-auto px-6 pb-4 overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {activeTab === 'topup' ? (
                <div>
                  {/* Uniform Vertical List of the 5 Packages */}
                  <div
                    className={`divide-y ${
                      isDark ? 'divide-[#262626]' : 'divide-[#E5E5EA]'
                    }`}
                  >
                    {wallet.packages.map((pkg) => {
                      const isBest = Boolean(pkg.isBestValue || pkg.platanos === 200);
                      const isProcessing = checkoutLoadingId === pkg.id;

                      return (
                        <div
                          key={pkg.id}
                          className="py-4 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[16px] font-semibold tracking-tight tabular-nums">
                                {pkg.platanos} Plátanos
                              </span>
                              {isBest && (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium tracking-tight border ${
                                    isDark
                                      ? 'bg-[#111111] text-[#8E8E93] border-[#262626]'
                                      : 'bg-[#F5F5F7] text-[#8E8E93] border-[#E5E5EA]'
                                  }`}
                                >
                                  Melhor valor
                                </span>
                              )}
                            </div>
                            <span className="text-[13px] font-normal text-[#8E8E93] block mt-0.5">
                              {getPackageDescription(pkg.platanos)}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={Boolean(checkoutLoadingId)}
                            onClick={() => handleCheckout(pkg)}
                            className={`h-9 px-4 rounded-full text-[13px] font-semibold tracking-tight tabular-nums shrink-0 transition-transform duration-150 cursor-pointer active:scale-95 disabled:opacity-50 ${
                              isDark
                                ? 'bg-[#FFFFFF] text-[#000000] hover:bg-white/90'
                                : 'bg-[#000000] text-[#FFFFFF] hover:bg-black/90'
                            }`}
                          >
                            {isProcessing ? 'Abrindo...' : pkg.priceBRL}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <p className="pt-4 text-center text-[11.5px] font-normal text-[#8E8E93]">
                    Pagamento seguro processado via Stripe · O saldo não expira
                  </p>
                </div>
              ) : wallet.transactions.length === 0 ? (
                <div className="py-14 text-center space-y-1.5">
                  <p className="text-[14px] font-medium">Nenhuma movimentação ainda</p>
                  <p className="text-[12.5px] text-[#8E8E93] max-w-xs mx-auto">
                    Suas compras de Plátanos e roteiros liberados aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div
                  className={`divide-y ${
                    isDark ? 'divide-[#262626]' : 'divide-[#E5E5EA]'
                  }`}
                >
                  {wallet.transactions.map((tx) => {
                    const isCredit = tx.amount > 0;
                    const statusText = getStatusLabel(tx.status);

                    return (
                      <div
                        key={tx.id}
                        className="py-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                              isDark
                                ? 'bg-[#111111] border-[#262626] text-[#8E8E93]'
                                : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#8E8E93]'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2]" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2]" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium leading-snug truncate">
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
                          <div className="text-[13.5px] font-semibold tabular-nums">
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
