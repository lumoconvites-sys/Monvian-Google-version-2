import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
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

function getStatusBadge(status: PlatanoTransaction['status'], isDark: boolean) {
  switch (status) {
    case 'completed':
      return {
        label: 'Confirmado',
        icon: CheckCircle2,
        className: isDark
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'pending':
      return {
        label: 'Pendente',
        icon: Clock,
        className: isDark
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
          : 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'cancelled':
      return {
        label: 'Cancelado',
        icon: XCircle,
        className: isDark
          ? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25'
          : 'bg-zinc-100 text-zinc-600 border-zinc-200',
      };
    case 'failed':
      return {
        label: 'Recusado',
        icon: AlertCircle,
        className: isDark
          ? 'bg-rose-500/15 text-rose-400 border-rose-500/25'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'refunded':
      return {
        label: 'Reembolsado',
        icon: RotateCcw,
        className: isDark
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
          : 'bg-amber-50 text-amber-700 border-amber-200',
      };
    default:
      return {
        label: status,
        icon: Clock,
        className: isDark
          ? 'bg-white/10 text-zinc-300 border-white/15'
          : 'bg-zinc-100 text-zinc-700 border-zinc-200',
      };
  }
}

export const PlatanosWalletModal: React.FC<PlatanosWalletModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  initialTab = 'topup',
}) => {
  const { wallet, refreshWallet, startTopUpCheckout } = usePlatanos();
  const [activeTab, setActiveTab] = useState<'topup' | 'history'>(initialTab);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('pkg_200');
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setErrorMessage(null);
    // Defer background revalidation until after the iOS sheet entrance animation completes
    const timer = setTimeout(() => {
      refreshWallet();
    }, 280);
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
          className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center bg-black/65"
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
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
            className={`relative w-full max-w-md max-h-[90dvh] flex flex-col rounded-t-[28px] sm:rounded-[28px] overflow-hidden border transform-gpu ${
              isDark
                ? 'bg-[#0B0B0D] text-white border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.75)]'
                : 'bg-white text-zinc-900 border-zinc-200/90 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]'
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
                  isDark ? 'bg-white/20' : 'bg-zinc-300'
                }`}
              />
            </div>

            {/* Top Header */}
            <div className="px-5 pt-2 pb-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#D9A84E]/15 border border-[#D9A84E]/35 flex items-center justify-center">
                  <PlatanoLeafIcon className="w-4 h-4" variant="gold" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold tracking-tight leading-tight">
                    Carteira de Plátanos
                  </h2>
                  <p
                    className={`text-[11.5px] font-medium ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    Moeda oficial para roteiros exclusivos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/10 text-zinc-300 hover:bg-white/15'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
                aria-label="Fechar carteira"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>

            {/* Balance Card */}
            <div className="px-5 pb-3 shrink-0">
              <div
                className={`p-4 rounded-[22px] border flex items-center justify-between ${
                  isDark
                    ? 'bg-[#141417] border-white/10'
                    : 'bg-zinc-50 border-zinc-200/80'
                }`}
              >
                <div>
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider block ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    Saldo disponível
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <PlatanoLeafIcon className="w-6 h-6 shrink-0" variant="gold" />
                    <span className="text-[26px] font-bold tracking-tight leading-none tabular-nums">
                      {wallet.balance}
                    </span>
                  </div>
                </div>

                {activeTab === 'history' ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('topup')}
                    className="px-3.5 py-2 rounded-full bg-[#D9A84E] text-[#141109] text-xs font-bold tracking-tight cursor-pointer active:scale-95 transition-transform"
                  >
                    Recarregar
                  </button>
                ) : (
                  <div className="text-right">
                    <span
                      className={`text-[11px] font-medium block ${
                        isDark ? 'text-zinc-400' : 'text-zinc-500'
                      }`}
                    >
                      Roteiros liberados
                    </span>
                    <span className="text-sm font-bold text-[#D9A84E] tabular-nums">
                      {wallet.unlockedItineraryIds.length}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Segmented Control (Recarregar / Histórico) */}
            <div className="px-5 pb-3 shrink-0">
              <div
                className={`grid grid-cols-2 p-1 rounded-2xl border ${
                  isDark
                    ? 'bg-[#141417] border-white/10'
                    : 'bg-zinc-100 border-zinc-200/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('topup')}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'topup'
                      ? isDark
                        ? 'bg-[#222227] text-white shadow-xs'
                        : 'bg-white text-zinc-900 shadow-xs'
                      : isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Recarregar Plátanos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'history'
                      ? isDark
                        ? 'bg-[#222227] text-white shadow-xs'
                        : 'bg-white text-zinc-900 shadow-xs'
                      : isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  Histórico ({wallet.transactions.length})
                </button>
              </div>
            </div>

            {/* Error Alert if any */}
            {errorMessage && (
              <div className="px-5 pb-3 shrink-0">
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Scrollable Body */}
            <div
              className="flex-1 overflow-y-auto px-5 pb-4 space-y-2.5 overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {activeTab === 'topup' ? (
                <>
                  <p
                    className={`text-xs font-medium pb-1 ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    Escolha um pacote fechado para adicionar Plátanos à sua carteira. O saldo não expira.
                  </p>

                  {wallet.packages.map((pkg) => {
                    const isBest = Boolean(pkg.isBestValue || pkg.platanos === 200);
                    const isSelected = selectedPkgId === pkg.id;
                    const isProcessing = checkoutLoadingId === pkg.id;

                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`relative p-3.5 rounded-[20px] border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isBest
                            ? isDark
                              ? 'bg-[#171612] border-[#D9A84E]/55'
                              : 'bg-[#FAF6EC] border-[#D9A84E]/60'
                            : isSelected
                              ? isDark
                                ? 'bg-[#18181C] border-white/25'
                                : 'bg-zinc-50 border-zinc-400'
                              : isDark
                                ? 'bg-[#141417] border-white/10 hover:border-white/20'
                                : 'bg-white border-zinc-200/90 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                              isBest
                                ? 'bg-[#D9A84E]/20 border-[#D9A84E]/45'
                                : isDark
                                  ? 'bg-white/5 border-white/10'
                                  : 'bg-zinc-100 border-zinc-200/80'
                            }`}
                          >
                            <PlatanoLeafIcon className="w-5 h-5" variant="gold" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[15px] font-bold tracking-tight tabular-nums">
                                {pkg.platanos}
                              </span>
                              {(pkg.badge || isBest) && (
                                <span className="px-2 py-0.5 rounded-full bg-[#D9A84E]/20 border border-[#D9A84E]/40 text-[#D9A84E] text-[10px] font-bold tracking-tight">
                                  {pkg.badge || 'Melhor custo-benefício'}
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[11.5px] font-medium block ${
                                isDark ? 'text-zinc-400' : 'text-zinc-500'
                              }`}
                            >
                              Libera até {Math.floor(pkg.platanos / 15)}{' '}
                              {Math.floor(pkg.platanos / 15) === 1
                                ? 'roteiro premium'
                                : 'roteiros premium'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={Boolean(checkoutLoadingId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckout(pkg);
                          }}
                          className={`px-4 py-2 rounded-full text-xs font-bold tracking-tight shrink-0 transition-transform duration-150 cursor-pointer active:scale-95 disabled:opacity-60 ${
                            isBest
                              ? 'bg-[#D9A84E] text-[#141109] hover:bg-[#e3b55a]'
                              : isDark
                                ? 'bg-white text-zinc-900 hover:bg-zinc-200'
                                : 'bg-zinc-900 text-white hover:bg-zinc-800'
                          }`}
                        >
                          {isProcessing ? 'Abrindo...' : pkg.priceBRL}
                        </button>
                      </div>
                    );
                  })}

                  <div
                    className={`pt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium ${
                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#D9A84E]" />
                    <span>Pagamento seguro processado pelo Stripe</span>
                  </div>
                </>
              ) : wallet.transactions.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-11 h-11 rounded-full bg-[#D9A84E]/10 border border-[#D9A84E]/25 flex items-center justify-center mx-auto">
                    <PlatanoLeafIcon className="w-5 h-5" variant="gold" />
                  </div>
                  <p className="text-sm font-semibold">Nenhuma movimentação ainda</p>
                  <p
                    className={`text-xs max-w-xs mx-auto ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    Suas recargas de Plátanos e roteiros adicionados aparecerão aqui em tempo real.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {wallet.transactions.map((tx) => {
                    const isCredit = tx.amount > 0;
                    const isZeroStatus = tx.amount === 0;
                    const badge = getStatusBadge(tx.status, isDark);
                    const StatusIcon = badge.icon;

                    return (
                      <div
                        key={tx.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          isDark
                            ? 'bg-[#141417] border-white/10'
                            : 'bg-zinc-50 border-zinc-200/80'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              isZeroStatus
                                ? isDark
                                  ? 'bg-white/5 text-zinc-400'
                                  : 'bg-zinc-200/70 text-zinc-600'
                                : isCredit
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-[#D9A84E]/15 text-[#D9A84E]'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold leading-snug truncate">
                              {tx.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span
                                className={`text-[10.5px] font-medium ${
                                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                                }`}
                              >
                                {formatDateTimePtBR(tx.createdAt)}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${badge.className}`}
                              >
                                <StatusIcon className="w-2.5 h-2.5" />
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs font-bold flex items-center justify-end gap-1 tabular-nums ${
                              isZeroStatus
                                ? isDark
                                  ? 'text-zinc-400'
                                  : 'text-zinc-500'
                                : isCredit
                                  ? 'text-emerald-400'
                                  : isDark
                                    ? 'text-white'
                                    : 'text-zinc-900'
                            }`}
                          >
                            <span>
                              {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                            </span>
                            <PlatanoLeafIcon className="w-3.5 h-3.5" variant="gold" />
                          </div>
                          <span
                            className={`text-[10px] font-medium block mt-0.5 tabular-nums ${
                              isDark ? 'text-zinc-500' : 'text-zinc-400'
                            }`}
                          >
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
