import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Save,
  RotateCcw,
  ShieldCheck,
  Search,
  CheckCircle2,
  Leaf,
  CreditCard,
  ShoppingCart,
  Package,
  MapPin,
  Wallet,
  ArrowLeftRight,
  LockOpen,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  X,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { getAuthHeaders, broadcastPlatanosWalletUpdate } from '../../hooks/usePlatanos';
import {
  ADMIN_CARD_STYLE,
  ADMIN_MOTION_EASE,
  ADMIN_SHADOWS,
  type AdminChartRange,
} from './adminTheme';
import {
  FinancialMiniSparkline,
  FinancialPerformanceChart,
  StripeRevenueChart,
  type FinancialPerfPoint,
  type StripeRevenuePoint,
} from './AdminFinanceCharts';

interface AdminPlatanosProps {
  currentUser?: any;
}

type FinanceSubTab =
  | 'packages'
  | 'itineraries'
  | 'wallets'
  | 'orders'
  | 'transactions'
  | 'unlocks'
  | 'audit';

type WalletBalanceFilter = 'all' | 'positive' | 'zero';
type OrderStatusFilter = 'all' | 'paid' | 'pending' | 'cancelled' | 'refunded' | 'failed';
type TxPeriodFilter = 'all' | '7d' | '30d' | '90d';
type TxTypeFilter = 'all' | 'credit_purchase' | 'debit_itinerary' | 'admin_adjustment' | 'refund_debit';
type TxStatusFilter = 'all' | 'completed' | 'pending' | 'failed_cancelled' | 'refunded';

interface FinanceOverviewData {
  stats: {
    totalCirculation: number;
    totalCredited: number;
    totalSpent: number;
    totalWallets: number;
    revenueCents: number;
    revenueBRL: string;
    paidOrdersCount: number;
    totalUnlocks: number;
  };
  analytics?: {
    performanceByRange: Record<AdminChartRange, FinancialPerfPoint[]>;
    stripeRevenueByRange: Record<AdminChartRange, StripeRevenuePoint[]>;
    sparklines: {
      circulation: number[];
      credited: number[];
      spent: number[];
      revenue: number[];
    };
    deltas: {
      circulationPct: number | null;
      creditedPct: number | null;
      spentPct: number | null;
      revenuePct: number | null;
    };
  };
  packages: any[];
  itineraries: any[];
  wallets: any[];
  transactions: any[];
  orders: any[];
  unlocks: any[];
  auditLogs: any[];
}

const EMPTY_PERF_SERIES: Record<AdminChartRange, FinancialPerfPoint[]> = {
  '7d': [],
  '30d': [],
  '90d': [],
};

const EMPTY_REV_SERIES: Record<AdminChartRange, StripeRevenuePoint[]> = {
  '7d': [],
  '30d': [],
  '90d': [],
};

function parseSqlDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const normalized = String(raw).includes('T') ? String(raw) : String(raw).replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  const fallback = new Date(String(raw));
  return isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateTimePTBR(raw?: string | null): string {
  const d = parseSqlDate(raw);
  if (!d) return raw || '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAuditDetails(rawJson?: string | null): Array<{ key: string; value: string }> {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return [{ key: 'detalhe', value: String(rawJson) }];
    }
    const sensitivePattern = /(token|secret|password|passwd|apikey|api_key|authorization|cookie|private)/i;
    return Object.entries(parsed)
      .filter(([k]) => !sensitivePattern.test(k))
      .map(([k, v]) => ({
        key: k,
        value: typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '—'),
      }));
  } catch {
    return [{ key: 'detalhe', value: String(rawJson) }];
  }
}

function formatOrderStatus(status?: string): { label: string; className: string } {
  const s = String(status || '').toLowerCase();
  if (s === 'paid' || s === 'completed' || s === 'succeeded') {
    return {
      label: 'Confirmado',
      className: 'bg-[#E7F9EF] text-[#0B7A40] border border-[#0FA958]/20',
    };
  }
  if (s === 'refunded') {
    return {
      label: 'Reembolsado',
      className: 'bg-[#EBF2FF] text-[#1668FF] border border-[#1668FF]/20',
    };
  }
  if (s === 'failed' || s === 'error') {
    return {
      label: 'Falhou',
      className: 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20',
    };
  }
  if (s === 'cancelled' || s === 'canceled' || s === 'expired') {
    return {
      label: 'Cancelado',
      className: 'bg-[#F1F5F9] text-[#475569] border border-slate-200',
    };
  }
  return {
    label: 'Pendente',
    className: 'bg-[#F1F5F9] text-[#475569] border border-slate-200',
  };
}

function formatTxTypeLabel(type?: string): string {
  switch (String(type || '')) {
    case 'credit_purchase':
      return 'Recarga Stripe';
    case 'debit_itinerary':
      return 'Desbloqueio de roteiro';
    case 'admin_adjustment':
      return 'Ajuste administrativo';
    case 'refund_debit':
      return 'Estorno';
    default:
      return type || 'Movimentação';
  }
}

function formatAuditActionLabel(action?: string): string {
  switch (String(action || '')) {
    case 'UPDATE_PACKAGE':
      return 'Atualização de pacote';
    case 'UPDATE_ITINERARY_PRICE':
      return 'Preço de roteiro';
    case 'MANUAL_WALLET_ADJUSTMENT':
      return 'Ajuste manual de carteira';
    case 'REFUND_ORDER':
      return 'Estorno Stripe';
    default:
      return action || 'Operação';
  }
}

export const AdminPlatanos: React.FC<AdminPlatanosProps> = ({ currentUser }) => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [subTab, setSubTab] = useState<FinanceSubTab>('packages');

  const [perfRange, setPerfRange] = useState<AdminChartRange>('7d');
  const [revRange, setRevRange] = useState<AdminChartRange>('7d');

  const [data, setData] = useState<FinanceOverviewData>({
    stats: {
      totalCirculation: 0,
      totalCredited: 0,
      totalSpent: 0,
      totalWallets: 0,
      revenueCents: 0,
      revenueBRL: 'R$ 0,00',
      paidOrdersCount: 0,
      totalUnlocks: 0,
    },
    analytics: {
      performanceByRange: EMPTY_PERF_SERIES,
      stripeRevenueByRange: EMPTY_REV_SERIES,
      sparklines: {
        circulation: [0, 0, 0, 0, 0, 0, 0],
        credited: [0, 0, 0, 0, 0, 0, 0],
        spent: [0, 0, 0, 0, 0, 0, 0],
        revenue: [0, 0, 0, 0, 0, 0, 0],
      },
      deltas: {
        circulationPct: null,
        creditedPct: null,
        spentPct: null,
        revenuePct: null,
      },
    },
    packages: [],
    itineraries: [],
    wallets: [],
    transactions: [],
    orders: [],
    unlocks: [],
    auditLogs: [],
  });

  const [pkgEdits, setPkgEdits] = useState<
    Record<string, { platanos: number; priceReais: string; badge: string }>
  >({});
  const [itinEdits, setItinEdits] = useState<
    Record<string, { platanosPrice: number; isPremium: boolean }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters per tab
  const [searchTerm, setSearchTerm] = useState('');
  const [walletFilter, setWalletFilter] = useState<WalletBalanceFilter>('all');
  const [expandedWalletId, setExpandedWalletId] = useState<number | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('all');
  const [txPeriodFilter, setTxPeriodFilter] = useState<TxPeriodFilter>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<TxTypeFilter>('all');
  const [txStatusFilter, setTxStatusFilter] = useState<TxStatusFilter>('all');

  // Manual wallet adjustment modal state
  const [adjustTarget, setAdjustTarget] = useState<{
    userId: number;
    name: string;
    email: string;
    balance: number;
  } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>('15');
  const [adjustReason, setAdjustReason] = useState<string>('Ajuste administrativo');

  // Refund confirmation modal state (no window.confirm)
  const [refundTarget, setRefundTarget] = useState<{
    sessionId: string;
    userEmail: string;
    platanosAmount: number;
    amountCents: number;
  } | null>(null);

  const getAdminHeaders = useCallback(() => {
    const base = getAuthHeaders();
    const adminEmail = (currentUser?.email || base['x-user-email'] || 'marioyesk@gmail.com')
      .trim()
      .toLowerCase();
    return {
      'Content-Type': 'application/json',
      ...base,
      'x-user-email': adminEmail,
    };
  }, [currentUser]);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/platanos/overview', {
        headers: getAdminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao carregar dados financeiros do Monvian.');
      }
      setData(json);
      setHasLoadedOnce(true);

      const initialPkgEdits: Record<string, { platanos: number; priceReais: string; badge: string }> = {};
      (json.packages || []).forEach((p: any) => {
        initialPkgEdits[p.id] = {
          platanos: Number(p.platanos),
          priceReais: (Number(p.priceCents) / 100).toFixed(2).replace('.', ','),
          badge: p.badge || '',
        };
      });
      setPkgEdits(initialPkgEdits);

      const initialItinEdits: Record<string, { platanosPrice: number; isPremium: boolean }> = {};
      (json.itineraries || []).forEach((it: any) => {
        initialItinEdits[it.id] = {
          platanosPrice: Number(it.platanosPrice ?? 15),
          isPremium: Boolean(it.isPremium),
        };
      });
      setItinEdits(initialItinEdits);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSavePackage = async (pkgId: string) => {
    const edit = pkgEdits[pkgId];
    if (!edit) return;

    const cleanReais = edit.priceReais.replace('R$', '').trim().replace(',', '.');
    const priceCents = Math.round(parseFloat(cleanReais) * 100);
    if (isNaN(priceCents) || priceCents < 100) {
      setFeedback({ type: 'error', text: 'Informe um valor válido em reais (mínimo R$ 1,00).' });
      return;
    }

    if (!Number.isInteger(Number(edit.platanos)) || Number(edit.platanos) <= 0) {
      setFeedback({ type: 'error', text: 'Informe uma quantidade inteira positiva de Plátanos.' });
      return;
    }

    try {
      setSavingId(pkgId);
      setFeedback(null);
      const res = await fetch(`/api/admin/platanos/packages/${pkgId}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          platanos: Number(edit.platanos),
          priceCents,
          badge: edit.badge,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar pacote.');
      setFeedback({ type: 'success', text: 'Pacote de recarga atualizado com sucesso!' });
      broadcastPlatanosWalletUpdate();
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveItineraryPrice = async (itinId: string) => {
    const edit = itinEdits[itinId];
    if (!edit) return;

    try {
      setSavingId(itinId);
      setFeedback(null);
      const res = await fetch(`/api/admin/platanos/itineraries/${itinId}/price`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          platanosPrice: edit.isPremium ? Number(edit.platanosPrice) : 0,
          isPremium: edit.isPremium,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao atualizar preço do roteiro.');
      setFeedback({ type: 'success', text: 'Preço em Plátanos atualizado com sucesso!' });
      broadcastPlatanosWalletUpdate();
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const handleAdjustWallet = async () => {
    if (!adjustTarget) return;
    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) {
      setFeedback({ type: 'error', text: 'Informe um valor inteiro diferente de zero.' });
      return;
    }

    try {
      setSavingId(`wallet_${adjustTarget.userId}`);
      setFeedback(null);
      const res = await fetch(`/api/admin/platanos/wallets/${adjustTarget.userId}/adjust`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          delta,
          reason: adjustReason.trim() || 'Ajuste administrativo',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao ajustar carteira.');
      setFeedback({
        type: 'success',
        text: `Saldo ajustado com sucesso (${json.balanceBefore} → ${json.balanceAfter} Plátanos).`,
      });
      setAdjustTarget(null);
      broadcastPlatanosWalletUpdate();
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const handleRefundOrder = async (sessionId: string) => {
    try {
      setSavingId(sessionId);
      setFeedback(null);
      const res = await fetch(`/api/admin/platanos/orders/${encodeURIComponent(sessionId)}/refund`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao estornar pedido.');
      setFeedback({
        type: 'success',
        text: `Pedido estornado com sucesso. Novo saldo do usuário: ${json.balanceAfter} Plátanos.`,
      });
      setRefundTarget(null);
      broadcastPlatanosWalletUpdate();
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const q = searchTerm.trim().toLowerCase();

  // Filtered datasets
  const filteredItineraries = useMemo(() => {
    return (data.itineraries || []).filter(
      (it: any) =>
        !q ||
        String(it.title || '').toLowerCase().includes(q) ||
        String(it.id || '').toLowerCase().includes(q)
    );
  }, [data.itineraries, q]);

  const filteredWallets = useMemo(() => {
    return (data.wallets || []).filter((w: any) => {
      const bal = Number(w.balance) || 0;
      if (walletFilter === 'positive' && bal <= 0) return false;
      if (walletFilter === 'zero' && bal > 0) return false;
      if (!q) return true;
      return (
        String(w.user_email || '').toLowerCase().includes(q) ||
        String(w.user_name || '').toLowerCase().includes(q) ||
        String(w.user_id).includes(q)
      );
    });
  }, [data.wallets, walletFilter, q]);

  const filteredOrders = useMemo(() => {
    return (data.orders || []).filter((o: any) => {
      const st = String(o.status || '').toLowerCase();
      if (orderStatusFilter !== 'all') {
        if (orderStatusFilter === 'cancelled') {
          if (!['cancelled', 'canceled', 'expired'].includes(st)) return false;
        } else if (st !== orderStatusFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        String(o.user_email || '').toLowerCase().includes(q) ||
        String(o.user_name || '').toLowerCase().includes(q) ||
        String(o.stripe_session_id || '').toLowerCase().includes(q) ||
        String(o.package_id || '').toLowerCase().includes(q) ||
        st.includes(q)
      );
    });
  }, [data.orders, orderStatusFilter, q]);

  const filteredTransactions = useMemo(() => {
    const now = Date.now();
    const periodMsMap: Record<Exclude<TxPeriodFilter, 'all'>, number> = {
      '7d': 7 * 86400000,
      '30d': 30 * 86400000,
      '90d': 90 * 86400000,
    };

    return (data.transactions || []).filter((t: any) => {
      if (txPeriodFilter !== 'all') {
        const dt = parseSqlDate(t.created_at);
        if (!dt || now - dt.getTime() > periodMsMap[txPeriodFilter]) return false;
      }
      if (txTypeFilter !== 'all' && String(t.type || '') !== txTypeFilter) {
        return false;
      }
      if (txStatusFilter !== 'all') {
        const st = String(t.status || '').toLowerCase();
        if (txStatusFilter === 'failed_cancelled') {
          if (!['failed', 'cancelled', 'canceled', 'error'].includes(st)) return false;
        } else if (st !== txStatusFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        String(t.user_email || '').toLowerCase().includes(q) ||
        String(t.user_name || '').toLowerCase().includes(q) ||
        String(t.description || '').toLowerCase().includes(q) ||
        String(t.id || '').toLowerCase().includes(q)
      );
    });
  }, [data.transactions, txPeriodFilter, txTypeFilter, txStatusFilter, q]);

  const filteredUnlocks = useMemo(() => {
    return (data.unlocks || []).filter(
      (u: any) =>
        !q ||
        String(u.user_email || '').toLowerCase().includes(q) ||
        String(u.user_name || '').toLowerCase().includes(q) ||
        String(u.itinerary_title || '').toLowerCase().includes(q) ||
        String(u.itinerary_id || '').toLowerCase().includes(q)
    );
  }, [data.unlocks, q]);

  const filteredAuditLogs = useMemo(() => {
    return (data.auditLogs || []).filter(
      (log: any) =>
        !q ||
        String(log.admin_email || '').toLowerCase().includes(q) ||
        String(log.action || '').toLowerCase().includes(q) ||
        String(log.target_type || '').toLowerCase().includes(q) ||
        String(log.target_id || '').toLowerCase().includes(q)
    );
  }, [data.auditLogs, q]);

  const sparklines = data.analytics?.sparklines || {
    circulation: [0, 0, 0, 0, 0, 0, 0],
    credited: [0, 0, 0, 0, 0, 0, 0],
    spent: [0, 0, 0, 0, 0, 0, 0],
    revenue: [0, 0, 0, 0, 0, 0, 0],
  };

  const deltas = data.analytics?.deltas || {
    circulationPct: null,
    creditedPct: null,
    spentPct: null,
    revenuePct: null,
  };

  const kpiCards = [
    {
      id: 'circulation',
      label: 'Plátanos em circulação',
      value: (data.stats?.totalCirculation ?? 0).toLocaleString('pt-BR'),
      subMeta: `${data.stats?.totalWallets ?? 0} ${(data.stats?.totalWallets ?? 0) === 1 ? 'carteira ativa' : 'carteiras ativas'}`,
      delta: deltas.circulationPct,
      icon: Leaf,
      iconBg: 'bg-[#E7F9EF]',
      iconColor: 'text-[#0FA958]',
      sparkColor: '#0FA958',
      sparkValues: sparklines.circulation,
    },
    {
      id: 'credited',
      label: 'Total creditado',
      value: `${(data.stats?.totalCredited ?? 0).toLocaleString('pt-BR')} Plát.`,
      subMeta: `${data.stats?.paidOrdersCount ?? 0} ${(data.stats?.paidOrdersCount ?? 0) === 1 ? 'recarga paga' : 'recargas pagas'}`,
      delta: deltas.creditedPct,
      icon: CreditCard,
      iconBg: 'bg-[#EBF2FF]',
      iconColor: 'text-[#1668FF]',
      sparkColor: '#1668FF',
      sparkValues: sparklines.credited,
    },
    {
      id: 'spent',
      label: 'Total gasto',
      value: `${(data.stats?.totalSpent ?? 0).toLocaleString('pt-BR')} Plát.`,
      subMeta: `${data.stats?.totalUnlocks ?? 0} ${(data.stats?.totalUnlocks ?? 0) === 1 ? 'roteiro liberado' : 'roteiros liberados'}`,
      delta: deltas.spentPct,
      icon: ShoppingCart,
      iconBg: 'bg-[#F3EEFF]',
      iconColor: 'text-[#7C3AED]',
      sparkColor: '#8B5CF6',
      sparkValues: sparklines.spent,
    },
    {
      id: 'revenue',
      label: 'Receita confirmada',
      value: data.stats?.revenueBRL || 'R$ 0,00',
      subMeta: 'Pagamentos confirmados Stripe',
      delta: deltas.revenuePct,
      icon: CheckCircle2,
      iconBg: 'bg-[#E7F9EF]',
      iconColor: 'text-[#0FA958]',
      sparkColor: '#0FA958',
      sparkValues: sparklines.revenue,
    },
  ];

  const tabs: Array<{
    id: FinanceSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'packages', label: 'Pacotes de Recarga', icon: Package, count: data.packages?.length },
    { id: 'itineraries', label: 'Preços dos Roteiros', icon: MapPin, count: data.itineraries?.length },
    { id: 'wallets', label: 'Carteiras', icon: Wallet, count: data.wallets?.length },
    { id: 'orders', label: 'Compras Stripe', icon: CreditCard, count: data.orders?.length },
    { id: 'transactions', label: 'Transações', icon: ArrowLeftRight, count: data.transactions?.length },
    { id: 'unlocks', label: 'Desbloqueios', icon: LockOpen, count: data.unlocks?.length },
    { id: 'audit', label: 'Auditoria', icon: ShieldCheck, count: data.auditLogs?.length },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-[18px] flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(145deg, #E2FBE9 0%, #C6F6D5 100%)',
              border: '1px solid rgba(15, 169, 88, 0.16)',
              boxShadow:
                '0 10px 24px -8px rgba(15, 169, 88, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
            }}
          >
            <Leaf className="w-7 h-7 text-[#0FA958] fill-[#0FA958]/20 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight text-[#0D1526] leading-tight">
              Gestão Financeira
            </h1>
            <p className="text-[13.5px] sm:text-[14.5px] text-[#5A6A85] font-medium mt-0.5 leading-snug">
              Gerencie créditos, pacotes, pagamentos e movimentações financeiras do Monvian.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-full bg-white text-[#0D1526] text-[13px] font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-70 self-start sm:self-auto shrink-0"
          style={{
            border: '1px solid rgba(226, 232, 240, 0.9)',
            boxShadow: ADMIN_SHADOWS.floatingPill,
          }}
        >
          <RefreshCw
            className={`w-4 h-4 text-[#0D1526] stroke-[2.1] ${loading ? 'animate-spin' : ''}`}
          />
          <span>Atualizar dados</span>
        </button>
      </div>

      {/* FEEDBACK BANNER */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: ADMIN_MOTION_EASE }}
            className={`px-4 py-3 rounded-2xl border text-[13px] font-semibold flex items-center justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-[#E7F9EF] border-[#0FA958]/25 text-[#0B7A40]'
                : 'bg-[#FEF2F2] border-[#DC2626]/25 text-[#B91C1C]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1 rounded-lg hover:bg-black/5 transition-colors cursor-pointer shrink-0"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 4 EQUAL-HEIGHT FINANCIAL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          const hasDelta = card.delta !== null && card.delta !== undefined;
          const isPositive = (card.delta ?? 0) >= 0;

          return (
            <motion.div
              key={card.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: index * 0.04, ease: ADMIN_MOTION_EASE }}
              className="rounded-[24px] p-5 flex flex-col justify-between min-h-[146px] transition-all duration-200 hover:-translate-y-0.5"
              style={ADMIN_CARD_STYLE}
            >
              {/* Top label + tinted icon badge */}
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl ${card.iconBg} ${card.iconColor} flex items-center justify-center shrink-0`}
                >
                  <Icon className="w-[18px] h-[18px] stroke-[2.2]" />
                </div>
                <span className="text-[13.5px] font-semibold text-[#334155] leading-snug truncate">
                  {card.label}
                </span>
              </div>

              {/* Main Value + Sparkline */}
              <div className="mt-4 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  {loading && !hasLoadedOnce ? (
                    <div className="h-8 w-24 rounded-lg bg-[#EEF2F8] animate-pulse" />
                  ) : (
                    <div className="text-[24px] sm:text-[26px] font-extrabold tracking-tight text-[#0D1526] leading-none truncate">
                      {card.value}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-1.5 min-h-[18px]">
                    {hasDelta ? (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[12px] font-bold ${
                          isPositive ? 'text-[#0FA958]' : 'text-[#DC2626]'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        {isPositive ? `+${card.delta}%` : `${card.delta}%`}
                      </span>
                    ) : (
                      <span className="text-[11.5px] font-medium text-[#7B8AA3] truncate">
                        {card.subMeta}
                      </span>
                    )}
                  </div>
                </div>

                <FinancialMiniSparkline
                  values={card.sparkValues}
                  color={card.sparkColor}
                  gradientId={`kpiSpark_${card.id}`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 3. 2 ANALYTICAL CHARTS SIDE BY SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <FinancialPerformanceChart
          seriesByRange={data.analytics?.performanceByRange || EMPTY_PERF_SERIES}
          range={perfRange}
          onRangeChange={setPerfRange}
          loading={loading && !hasLoadedOnce}
        />
        <StripeRevenueChart
          seriesByRange={data.analytics?.stripeRevenueByRange || EMPTY_REV_SERIES}
          range={revRange}
          onRangeChange={setRevRange}
          loading={loading && !hasLoadedOnce}
        />
      </div>

      {/* 4. CENTRAL DE GERENCIAMENTO (7 TACTILE TABS + ACTIVE PANEL) */}
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.14, ease: ADMIN_MOTION_EASE }}
        className="rounded-[26px] overflow-hidden"
        style={ADMIN_CARD_STYLE}
      >
        {/* Tabs Navigation Strip */}
        <div className="px-4 sm:px-6 pt-4 border-b border-slate-200/75 bg-white">
          <div
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0"
            role="tablist"
            aria-label="Central de gerenciamento financeiro"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSubTab(tab.id);
                    setSearchTerm('');
                  }}
                  className={`relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 mb-2.5 rounded-2xl text-[13px] font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-[0.98] shrink-0 ${
                    active
                      ? 'text-[#1668FF]'
                      : 'text-[#334155] hover:text-[#0D1526] bg-[#F7F9FD] hover:bg-[#EFF4FC] border border-slate-200/70'
                  }`}
                  style={
                    active
                      ? {
                          background: 'linear-gradient(180deg, #F2F7FF 0%, #E1EDFF 100%)',
                          border: '1px solid rgba(22, 104, 255, 0.22)',
                          boxShadow:
                            '0 8px 18px -8px rgba(22, 104, 255, 0.34), inset 0 1px 0 rgba(255,255,255,0.9)',
                        }
                      : undefined
                  }
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#1668FF]' : 'text-[#5A6A85]'
                    }`}
                  />
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.id !== 'packages' && (
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                        active
                          ? 'bg-[#1668FF]/12 text-[#1668FF]'
                          : 'bg-slate-200/70 text-[#5A6A85]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {active && (
                    <span
                      className="absolute left-2 right-2 -bottom-[11px] h-[3px] rounded-full bg-[#1668FF]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Content */}
        <div className="p-4 sm:p-6 bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={subTab}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: ADMIN_MOTION_EASE }}
            >
              {/* TAB 1: PACOTES DE RECARGA (IDENTIDADE VERDE) */}
              {subTab === 'packages' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
                  {(data.packages || []).map((pkg: any) => {
                    const edit = pkgEdits[pkg.id] || {
                      platanos: Number(pkg.platanos),
                      priceReais: (Number(pkg.priceCents) / 100).toFixed(2).replace('.', ','),
                      badge: pkg.badge || '',
                    };
                    const isSaving = savingId === pkg.id;

                    return (
                      <div
                        key={pkg.id}
                        className="relative overflow-hidden rounded-[22px] p-5 bg-white border border-slate-200/80 transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                          boxShadow:
                            '0 10px 26px -14px rgba(15, 23, 42, 0.1), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
                        }}
                      >
                        {/* Translucent Emerald Corner Wash */}
                        <div
                          className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full"
                          style={{
                            background:
                              'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0.06) 48%, rgba(255, 255, 255, 0) 76%)',
                          }}
                          aria-hidden="true"
                        />

                        <div className="relative z-10 flex flex-col gap-5">
                          {/* Package Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div
                                className="w-12 h-12 rounded-[15px] flex items-center justify-center shrink-0"
                                style={{
                                  background: 'linear-gradient(145deg, #E3FBEB 0%, #C6F6D5 100%)',
                                  border: '1px solid rgba(15, 169, 88, 0.18)',
                                }}
                              >
                                <Leaf className="w-6 h-6 text-[#0FA958] fill-[#0FA958]/20 stroke-[2.2]" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-[16px] font-bold text-[#0D1526] leading-tight truncate">
                                  Pacote {pkg.platanos} Plátanos
                                </h3>
                                <span className="text-[12px] text-[#7B8AA3] font-mono block mt-0.5">
                                  {pkg.id}
                                </span>
                              </div>
                            </div>

                            {pkg.isBestValue && (
                              <span className="px-2.5 py-1 rounded-full bg-[#E7F9EF] border border-[#0FA958]/20 text-[#0B7A40] text-[11px] font-bold shrink-0">
                                Melhor custo-benefício
                              </span>
                            )}
                          </div>

                          {/* Inputs & Save Action Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-[1.05fr_1fr_1.1fr_auto] gap-3 sm:gap-3.5 items-end pt-1">
                            {/* Plátanos */}
                            <div className="sm:pr-3 sm:border-r sm:border-slate-200/80">
                              <label className="text-[11px] font-semibold text-[#7B8AA3] block mb-1">
                                Plátanos
                              </label>
                              <div className="flex items-baseline gap-1.5 bg-[#F8FAFD] border border-slate-200/80 focus-within:border-[#0FA958] focus-within:bg-white rounded-xl px-2.5 py-1.5 transition-colors">
                                <input
                                  type="number"
                                  min={1}
                                  value={edit.platanos}
                                  onChange={(e) =>
                                    setPkgEdits((prev) => ({
                                      ...prev,
                                      [pkg.id]: { ...edit, platanos: Number(e.target.value) },
                                    }))
                                  }
                                  className="w-14 bg-transparent text-[15px] font-extrabold text-[#0D1526] outline-none"
                                />
                                <span className="text-[12px] font-bold text-[#334155]">Plátanos</span>
                              </div>
                            </div>

                            {/* Preço (R$) */}
                            <div className="sm:pr-3 sm:border-r sm:border-slate-200/80">
                              <label className="text-[11px] font-semibold text-[#7B8AA3] block mb-1">
                                Preço (R$)
                              </label>
                              <div className="flex items-center gap-1 bg-[#F8FAFD] border border-slate-200/80 focus-within:border-[#1668FF] focus-within:bg-white rounded-xl px-2.5 py-1.5 transition-colors">
                                <input
                                  type="text"
                                  value={edit.priceReais}
                                  onChange={(e) =>
                                    setPkgEdits((prev) => ({
                                      ...prev,
                                      [pkg.id]: { ...edit, priceReais: e.target.value },
                                    }))
                                  }
                                  className="w-full bg-transparent text-[15px] font-extrabold text-[#0D1526] outline-none"
                                />
                              </div>
                            </div>

                            {/* Destaque / Selo */}
                            <div>
                              <label className="text-[11px] font-semibold text-[#7B8AA3] block mb-1">
                                Destaque / Selo
                              </label>
                              <input
                                type="text"
                                placeholder="Opcional"
                                value={edit.badge}
                                onChange={(e) =>
                                  setPkgEdits((prev) => ({
                                    ...prev,
                                    [pkg.id]: { ...edit, badge: e.target.value },
                                  }))
                                }
                                className="w-full px-3 py-2 rounded-xl bg-[#EBF3FF] border border-[#1668FF]/18 focus:border-[#1668FF] focus:bg-white text-[12.5px] font-semibold text-[#1668FF] placeholder-[#4B85F5]/75 outline-none transition-colors"
                              />
                            </div>

                            {/* Salvar Pacote CTA */}
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSavePackage(pkg.id)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-[12.5px] font-bold cursor-pointer transition-all duration-200 active:scale-[0.97] disabled:opacity-60 whitespace-nowrap"
                              style={{
                                background: 'linear-gradient(180deg, #12B76A 0%, #0E9F58 100%)',
                                boxShadow:
                                  '0 8px 18px -6px rgba(15, 169, 88, 0.5), inset 0 1px 0 rgba(255,255,255,0.28)',
                              }}
                            >
                              <Save className="w-3.5 h-3.5 stroke-[2.2]" />
                              <span>{isSaving ? 'Salvando...' : 'Salvar Pacote'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: PREÇOS DOS ROTEIROS */}
              {subTab === 'itineraries' && (
                <div className="space-y-4">
                  <div className="relative max-w-md">
                    <Search className="w-4 h-4 text-[#7B8AA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar roteiro por nome ou ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8FAFD] border border-slate-200/85 focus:border-[#1668FF] focus:bg-white text-[13px] font-medium text-[#0D1526] placeholder-[#8B99B0] outline-none transition-colors"
                    />
                  </div>

                  {filteredItineraries.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#F8FAFD] border border-slate-200/70">
                      <p className="text-[13.5px] font-semibold text-[#334155]">
                        Nenhum roteiro encontrado
                      </p>
                      <p className="text-[12px] text-[#7B8AA3] mt-1">
                        Ajuste sua busca ou cadastre roteiros na aba Roteiros.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredItineraries.map((itin: any) => {
                        const edit = itinEdits[itin.id] || {
                          platanosPrice: itin.platanosPrice ?? 15,
                          isPremium: Boolean(itin.isPremium),
                        };
                        const isSaving = savingId === itin.id;

                        return (
                          <div
                            key={itin.id}
                            className="p-4 rounded-[20px] bg-[#FAFBFD] hover:bg-white border border-slate-200/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[14.5px] font-bold text-[#0D1526] truncate">
                                  {itin.title}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    edit.isPremium
                                      ? 'bg-[#EBF2FF] text-[#1668FF] border border-[#1668FF]/20'
                                      : 'bg-[#E7F9EF] text-[#0B7A40] border border-[#0FA958]/20'
                                  }`}
                                >
                                  {edit.isPremium ? 'Premium' : 'Gratuito'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11.5px] text-[#7B8AA3]">
                                <span className="font-mono">{itin.id}</span>
                                {typeof itin.usageCount === 'number' && (
                                  <span>{itin.usageCount} acessos</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                              {/* Tactile Premium Switch */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={edit.isPremium}
                                onClick={() =>
                                  setItinEdits((prev) => ({
                                    ...prev,
                                    [itin.id]: {
                                      ...edit,
                                      isPremium: !edit.isPremium,
                                      platanosPrice: !edit.isPremium ? edit.platanosPrice || 15 : 0,
                                    },
                                  }))
                                }
                                className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/85 cursor-pointer"
                              >
                                <span
                                  className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
                                    edit.isPremium ? 'bg-[#1668FF]' : 'bg-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                                      edit.isPremium ? 'translate-x-4' : 'translate-x-0'
                                    }`}
                                  />
                                </span>
                                <span className="text-[12px] font-semibold text-[#334155]">
                                  Premium
                                </span>
                              </button>

                              {/* Price Input */}
                              <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${
                                  edit.isPremium
                                    ? 'bg-white border-slate-200 focus-within:border-[#0FA958]'
                                    : 'bg-slate-100/80 border-slate-200/60 opacity-60'
                                }`}
                              >
                                <Leaf className="w-4 h-4 text-[#0FA958] shrink-0" />
                                <input
                                  type="number"
                                  min={0}
                                  disabled={!edit.isPremium}
                                  value={edit.isPremium ? edit.platanosPrice : 0}
                                  onChange={(e) =>
                                    setItinEdits((prev) => ({
                                      ...prev,
                                      [itin.id]: { ...edit, platanosPrice: Number(e.target.value) },
                                    }))
                                  }
                                  className="w-16 bg-transparent text-[13.5px] font-bold text-[#0D1526] outline-none"
                                />
                                <span className="text-[11.5px] font-semibold text-[#7B8AA3]">
                                  Plátanos
                                </span>
                              </div>

                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleSaveItineraryPrice(itin.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[12.5px] font-bold cursor-pointer active:scale-[0.97] transition-all disabled:opacity-50"
                                style={{
                                  background: 'linear-gradient(180deg, #12B76A 0%, #0E9F58 100%)',
                                  boxShadow: '0 6px 14px -6px rgba(15, 169, 88, 0.45)',
                                }}
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CARTEIRAS */}
              {subTab === 'wallets' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-[#7B8AA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar carteira por nome, e-mail ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8FAFD] border border-slate-200/85 focus:border-[#1668FF] focus:bg-white text-[13px] font-medium text-[#0D1526] placeholder-[#8B99B0] outline-none transition-colors"
                      />
                    </div>

                    <div className="inline-flex items-center p-1 rounded-full bg-[#F1F5FB] border border-slate-200/75 self-start sm:self-auto">
                      {[
                        { id: 'all', label: 'Todas' },
                        { id: 'positive', label: 'Com saldo' },
                        { id: 'zero', label: 'Zeradas' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setWalletFilter(opt.id as WalletBalanceFilter)}
                          className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
                            walletFilter === opt.id
                              ? 'bg-[#1668FF] text-white shadow-xs'
                              : 'text-[#475569] hover:text-[#0D1526]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredWallets.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#F8FAFD] border border-slate-200/70">
                      <p className="text-[13.5px] font-semibold text-[#334155]">
                        Nenhuma carteira encontrada
                      </p>
                      <p className="text-[12px] text-[#7B8AA3] mt-1">
                        Altere o filtro ou aguarde a criação de novas carteiras de usuários.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredWallets.map((w: any) => {
                        const isExpanded = expandedWalletId === w.user_id;
                        const recentMovements = (data.transactions || [])
                          .filter((tx: any) => Number(tx.user_id) === Number(w.user_id))
                          .slice(0, 5);

                        return (
                          <div
                            key={w.user_id}
                            className="rounded-[20px] bg-[#FAFBFD] border border-slate-200/80 overflow-hidden transition-all"
                          >
                            <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[14.5px] font-bold text-[#0D1526] truncate">
                                    {w.user_name || w.user_email || `Usuário #${w.user_id}`}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-[#475569] text-[10.5px] font-bold">
                                    ID #{w.user_id}
                                  </span>
                                </div>
                                <span className="text-[12.5px] text-[#5A6A85] block mt-0.5 truncate">
                                  {w.user_email || 'Sem e-mail registrado'}
                                </span>
                                <div className="flex flex-wrap items-center gap-4 mt-2 text-[12px]">
                                  <span className="font-semibold text-[#0FA958]">
                                    Creditado: +{(Number(w.total_credited) || 0).toLocaleString('pt-BR')}
                                  </span>
                                  <span className="font-semibold text-[#7C3AED]">
                                    Utilizado: -{(Number(w.total_spent) || 0).toLocaleString('pt-BR')}
                                  </span>
                                  {w.updated_at && (
                                    <span className="text-[#7B8AA3]">
                                      Atualizado em {formatDateTimePTBR(w.updated_at)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                <div className="px-3.5 py-2 rounded-xl bg-[#E7F9EF] border border-[#0FA958]/20 flex items-center gap-1.5">
                                  <Leaf className="w-4 h-4 text-[#0FA958]" />
                                  <span className="text-[13.5px] font-extrabold text-[#0B7A40]">
                                    {(Number(w.balance) || 0).toLocaleString('pt-BR')} Plátanos
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedWalletId(isExpanded ? null : w.user_id)
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[#334155] hover:text-[#0D1526] text-[12px] font-semibold cursor-pointer transition-colors"
                                >
                                  <span>Movimentações</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setAdjustTarget({
                                      userId: w.user_id,
                                      name: w.user_name || w.user_email || `Usuário #${w.user_id}`,
                                      email: w.user_email || '',
                                      balance: Number(w.balance) || 0,
                                    })
                                  }
                                  className="px-3.5 py-2 rounded-xl bg-[#1668FF] hover:bg-[#0F5AE6] text-white text-[12px] font-bold cursor-pointer active:scale-[0.97] transition-all shadow-[0_6px_14px_-6px_rgba(22,104,255,0.45)]"
                                >
                                  Ajustar saldo
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="px-4 pb-4 pt-3 border-t border-slate-200/75 bg-white">
                                <p className="text-[11.5px] font-bold uppercase tracking-wider text-[#7B8AA3] mb-2.5">
                                  Últimas movimentações ({recentMovements.length})
                                </p>
                                {recentMovements.length === 0 ? (
                                  <p className="text-[12px] text-[#7B8AA3]">
                                    Nenhuma movimentação registrada para esta carteira.
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {recentMovements.map((tx: any) => (
                                      <div
                                        key={tx.id}
                                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#F8FAFD] border border-slate-200/60 text-[12px]"
                                      >
                                        <div className="min-w-0">
                                          <p className="font-semibold text-[#0D1526] truncate">
                                            {tx.description || formatTxTypeLabel(tx.type)}
                                          </p>
                                          <p className="text-[11px] text-[#7B8AA3]">
                                            {formatDateTimePTBR(tx.created_at)}
                                          </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span
                                            className={`font-bold block ${
                                              Number(tx.amount) >= 0
                                                ? 'text-[#0FA958]'
                                                : 'text-[#7C3AED]'
                                            }`}
                                          >
                                            {Number(tx.amount) > 0 ? `+${tx.amount}` : tx.amount} Plát.
                                          </span>
                                          <span className="text-[10.5px] text-[#7B8AA3]">
                                            {tx.balance_before} → {tx.balance_after}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: COMPRAS STRIPE */}
              {subTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-[#7B8AA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por usuário, pacote ou sessão Stripe..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8FAFD] border border-slate-200/85 focus:border-[#1668FF] focus:bg-white text-[13px] font-medium text-[#0D1526] placeholder-[#8B99B0] outline-none transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { id: 'all', label: 'Todos' },
                        { id: 'paid', label: 'Confirmado' },
                        { id: 'pending', label: 'Pendente' },
                        { id: 'cancelled', label: 'Cancelado' },
                        { id: 'refunded', label: 'Reembolsado' },
                        { id: 'failed', label: 'Falhou' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setOrderStatusFilter(opt.id as OrderStatusFilter)}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer border ${
                            orderStatusFilter === opt.id
                              ? 'bg-[#1668FF] text-white border-[#1668FF] shadow-xs'
                              : 'bg-[#F8FAFD] text-[#475569] border-slate-200/80 hover:text-[#0D1526]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#F8FAFD] border border-slate-200/70">
                      <p className="text-[13.5px] font-semibold text-[#334155]">
                        Nenhuma compra Stripe encontrada
                      </p>
                      <p className="text-[12px] text-[#7B8AA3] mt-1">
                        Os pagamentos realizados via Stripe Checkout aparecerão automaticamente aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredOrders.map((o: any) => {
                        const badge = formatOrderStatus(o.status);
                        const amountBRL = (Number(o.amount_cents || 0) / 100)
                          .toFixed(2)
                          .replace('.', ',');

                        return (
                          <div
                            key={o.id}
                            className="p-4 rounded-[20px] bg-[#FAFBFD] hover:bg-white border border-slate-200/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="text-[14.5px] font-extrabold text-[#0D1526]">
                                  R$ {amountBRL}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-[#E7F9EF] text-[#0B7A40] text-[11.5px] font-bold">
                                  +{o.platanos_amount} Plátanos
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                                {o.package_id && (
                                  <span className="text-[11px] font-mono text-[#7B8AA3]">
                                    {o.package_id}
                                  </span>
                                )}
                              </div>

                              <p className="text-[12.5px] text-[#334155] font-medium truncate">
                                {o.user_name ? `${o.user_name} · ` : ''}
                                {o.user_email} (ID #{o.user_id})
                              </p>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#7B8AA3]">
                                <span>{formatDateTimePTBR(o.created_at)}</span>
                                <span className="font-mono truncate max-w-[300px]">
                                  Sessão: {o.stripe_session_id}
                                </span>
                              </div>
                            </div>

                            {o.status === 'paid' && (
                              <button
                                type="button"
                                disabled={savingId === o.stripe_session_id}
                                onClick={() =>
                                  setRefundTarget({
                                    sessionId: o.stripe_session_id,
                                    userEmail: o.user_email || `Usuário #${o.user_id}`,
                                    platanosAmount: Number(o.platanos_amount) || 0,
                                    amountCents: Number(o.amount_cents) || 0,
                                  })
                                }
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#DC2626]/40 text-[#475569] hover:text-[#DC2626] text-[12px] font-bold cursor-pointer transition-colors shrink-0 self-start lg:self-auto"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>
                                  {savingId === o.stripe_session_id ? 'Estornando...' : 'Estornar'}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: TRANSAÇÕES */}
              {subTab === 'transactions' && (
                <div className="space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-[#7B8AA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filtrar por e-mail, usuário, descrição ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8FAFD] border border-slate-200/85 focus:border-[#1668FF] focus:bg-white text-[13px] font-medium text-[#0D1526] placeholder-[#8B99B0] outline-none transition-colors"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFD] border border-slate-200/85 text-[12px]">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#7B8AA3]" />
                        <select
                          aria-label="Filtrar período"
                          value={txPeriodFilter}
                          onChange={(e) => setTxPeriodFilter(e.target.value as TxPeriodFilter)}
                          className="bg-transparent font-semibold text-[#334155] outline-none cursor-pointer"
                        >
                          <option value="all">Período: Todos</option>
                          <option value="7d">Últimos 7 dias</option>
                          <option value="30d">Últimos 30 dias</option>
                          <option value="90d">Últimos 90 dias</option>
                        </select>
                      </div>

                      <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#F8FAFD] border border-slate-200/85 text-[12px]">
                        <select
                          aria-label="Filtrar tipo de movimentação"
                          value={txTypeFilter}
                          onChange={(e) => setTxTypeFilter(e.target.value as TxTypeFilter)}
                          className="bg-transparent font-semibold text-[#334155] outline-none cursor-pointer"
                        >
                          <option value="all">Tipo: Todos</option>
                          <option value="credit_purchase">Recargas</option>
                          <option value="debit_itinerary">Consumos</option>
                          <option value="admin_adjustment">Ajustes</option>
                          <option value="refund_debit">Estornos</option>
                        </select>
                      </div>

                      <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[#F8FAFD] border border-slate-200/85 text-[12px]">
                        <select
                          aria-label="Filtrar status"
                          value={txStatusFilter}
                          onChange={(e) => setTxStatusFilter(e.target.value as TxStatusFilter)}
                          className="bg-transparent font-semibold text-[#334155] outline-none cursor-pointer"
                        >
                          <option value="all">Status: Todos</option>
                          <option value="completed">Concluído</option>
                          <option value="pending">Pendente</option>
                          <option value="refunded">Reembolsado</option>
                          <option value="failed_cancelled">Falhou / Cancelado</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {filteredTransactions.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#F8FAFD] border border-slate-200/70">
                      <p className="text-[13.5px] font-semibold text-[#334155]">
                        Nenhuma transação encontrada para os filtros selecionados
                      </p>
                      <p className="text-[12px] text-[#7B8AA3] mt-1">
                        Todas as movimentações de crédito, consumo e ajuste aparecem aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredTransactions.map((t: any) => {
                        const amount = Number(t.amount) || 0;
                        const isCredit = amount > 0;
                        const stBadge = formatOrderStatus(t.status);

                        return (
                          <div
                            key={t.id}
                            className="p-4 rounded-[18px] bg-[#FAFBFD] hover:bg-white border border-slate-200/80 transition-all flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                  isCredit
                                    ? 'bg-[#E7F9EF] text-[#0FA958]'
                                    : 'bg-[#F3EEFF] text-[#7C3AED]'
                                }`}
                              >
                                {isCredit ? (
                                  <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                                ) : (
                                  <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[13.5px] font-bold text-[#0D1526] truncate">
                                    {t.description || formatTxTypeLabel(t.type)}
                                  </p>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${stBadge.className}`}
                                  >
                                    {stBadge.label}
                                  </span>
                                </div>
                                <p className="text-[12px] text-[#7B8AA3] truncate mt-0.5">
                                  {t.user_email || `Usuário #${t.user_id}`} · {formatTxTypeLabel(t.type)} ·{' '}
                                  {formatDateTimePTBR(t.created_at)}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`text-[14px] font-extrabold block ${
                                  isCredit
                                    ? 'text-[#0FA958]'
                                    : amount < 0
                                      ? 'text-[#7C3AED]'
                                      : 'text-[#475569]'
                                }`}
                              >
                                {isCredit ? `+${amount}` : amount} Plátanos
                              </span>
                              <span className="text-[11px] font-medium text-[#7B8AA3]">
                                Saldo: {t.balance_before} → {t.balance_after}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: DESBLOQUEIOS */}
              {subTab === 'unlocks' && (
                <div className="space-y-4">
                  <div className="relative max-w-md">
                    <Search className="w-4 h-4 text-[#7B8AA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar desbloqueio por usuário ou roteiro..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8FAFD] border border-slate-200/85 focus:border-[#1668FF] focus:bg-white text-[13px] font-medium text-[#0D1526] placeholder-[#8B99B0] outline-none transition-colors"
                    />
                  </div>

                  {filteredUnlocks.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#F8FAFD] border border-slate-200/70">
                      <p className="text-[13.5px] font-semibold text-[#334155]">
                        Nenhum desbloqueio registrado ainda
                      </p>
                      <p className="text-[12px] text-[#7B8AA3] mt-1">
                        Quando usuários desbloquearem roteiros usando Plátanos, os registros aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredUnlocks.map((u: any) => (
                        <div
                          key={u.id}
                          className="p-4 rounded-[18px] bg-[#FAFBFD] hover:bg-white border border-slate-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
                              <LockOpen className="w-4 h-4 stroke-[2.2]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-bold text-[#0D1526] truncate">
                                {u.itinerary_title || u.itinerary_id}
                              </p>
                              <p className="text-[12px] text-[#7B8AA3] truncate">
                                {u.user_email || `Usuário #${u.user_id}`} (ID #{u.user_id}) ·{' '}
                                {formatDateTimePTBR(u.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E7F9EF] border border-[#0FA958]/20 text-[#0B7A40] text-[12px] font-bold">
                              <Leaf className="w-3.5 h-3.5 text-[#0FA958]" />
                              {u.platanos_paid} Plátanos
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-[#EBF2FF] text-[#1668FF] text-[11px] font-bold">
                              Desbloqueado
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: AUDITORIA */}
              {subTab === 'audit' && (
                <div className="space-y-4">
                  <div className="relative max-w-md">
                    <Search className="w-4 h-4 text-[#7B8AA3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por administrador, operação ou alvo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#F8FAFD] border border-slate-200/85 focus:border-[#1668FF] focus:bg-white text-[13px] font-medium text-[#0D1526] placeholder-[#8B99B0] outline-none transition-colors"
                    />
                  </div>

                  {filteredAuditLogs.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-[#F8FAFD] border border-slate-200/70">
                      <p className="text-[13.5px] font-semibold text-[#334155]">
                        Nenhum evento de auditoria encontrado
                      </p>
                      <p className="text-[12px] text-[#7B8AA3] mt-1">
                        Alterações de pacotes, preços, ajustes de carteira e estornos são registrados automaticamente.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAuditLogs.map((log: any) => {
                        const details = formatAuditDetails(log.details_json);

                        return (
                          <div
                            key={log.id}
                            className="p-4 rounded-[18px] bg-[#FAFBFD] border border-slate-200/80 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 rounded-full bg-[#EBF2FF] border border-[#1668FF]/20 text-[#1668FF] text-[11.5px] font-bold">
                                  {formatAuditActionLabel(log.action)}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-[#E7F9EF] text-[#0B7A40] text-[10.5px] font-bold">
                                  Registrado
                                </span>
                              </div>
                              <span className="text-[11.5px] font-medium text-[#7B8AA3]">
                                {formatDateTimePTBR(log.created_at)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[#334155]">
                              <span>
                                <strong className="text-[#0D1526]">Responsável:</strong>{' '}
                                {log.admin_email || 'Administrador'}
                              </span>
                              <span>
                                <strong className="text-[#0D1526]">Alvo:</strong> {log.target_type}{' '}
                                <span className="font-mono text-[11.5px] text-[#5A6A85]">
                                  ({log.target_id})
                                </span>
                              </span>
                            </div>

                            {details.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {details.map((d) => (
                                  <span
                                    key={d.key}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-[11px] text-[#475569] font-mono"
                                  >
                                    <span className="text-[#7B8AA3]">{d.key}:</span> {d.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>

      {/* MODAL: MANUAL WALLET BALANCE ADJUSTMENT */}
      <AnimatePresence>
        {adjustTarget && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1526]/40 backdrop-blur-xs p-4"
            onClick={() => setAdjustTarget(null)}
          >
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: ADMIN_MOTION_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[26px] bg-white p-6 space-y-5"
              style={{
                border: '1px solid rgba(226, 232, 240, 0.9)',
                boxShadow: ADMIN_SHADOWS.popover,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E7F9EF] text-[#0FA958] flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-extrabold text-[#0D1526]">
                      Ajustar Saldo da Carteira
                    </h3>
                    <p className="text-[12px] text-[#5A6A85] mt-0.5">{adjustTarget.email || adjustTarget.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="p-1.5 rounded-xl text-[#7B8AA3] hover:text-[#0D1526] hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F4F7FC] border border-slate-200/75 flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-[#475569]">Saldo atual</span>
                <span className="inline-flex items-center gap-1.5 text-[14px] font-extrabold text-[#0B7A40]">
                  <Leaf className="w-4 h-4 text-[#0FA958]" />
                  {adjustTarget.balance} Plátanos
                </span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-[12px] font-semibold text-[#475569] block mb-1.5">
                    Quantidade a creditar (+) ou debitar (-)
                  </label>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFD] border border-slate-200 focus:border-[#1668FF] focus:bg-white text-[14px] font-bold text-[#0D1526] outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[#475569] block mb-1.5">
                    Motivo (registrado na auditoria)
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFD] border border-slate-200 focus:border-[#1668FF] focus:bg-white text-[13px] font-medium text-[#0D1526] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#F1F5FB] hover:bg-[#E5ECF7] text-[#334155] text-[13px] font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingId === `wallet_${adjustTarget.userId}`}
                  onClick={handleAdjustWallet}
                  className="flex-1 py-2.5 rounded-xl text-white text-[13px] font-bold cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(180deg, #12B76A 0%, #0E9F58 100%)',
                    boxShadow: '0 8px 18px -6px rgba(15, 169, 88, 0.48)',
                  }}
                >
                  {savingId === `wallet_${adjustTarget.userId}`
                    ? 'Aplicando...'
                    : 'Confirmar Ajuste'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: CONFIRM STRIPE REFUND */}
      <AnimatePresence>
        {refundTarget && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1526]/40 backdrop-blur-xs p-4"
            onClick={() => setRefundTarget(null)}
          >
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: ADMIN_MOTION_EASE }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[26px] bg-white p-6 space-y-4"
              style={{
                border: '1px solid rgba(226, 232, 240, 0.9)',
                boxShadow: ADMIN_SHADOWS.popover,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-extrabold text-[#0D1526]">
                      Confirmar Estorno
                    </h3>
                    <p className="text-[12px] text-[#5A6A85] mt-0.5">{refundTarget.userEmail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRefundTarget(null)}
                  className="p-1.5 rounded-xl text-[#7B8AA3] hover:text-[#0D1526] hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] text-[#475569] leading-relaxed">
                O pedido no valor de{' '}
                <strong className="text-[#0D1526]">
                  R$ {(refundTarget.amountCents / 100).toFixed(2).replace('.', ',')}
                </strong>{' '}
                será estornado e <strong className="text-[#0D1526]">{refundTarget.platanosAmount} Plátanos</strong>{' '}
                serão debitados da carteira correspondente, com registro na auditoria.
              </p>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#F1F5FB] hover:bg-[#E5ECF7] text-[#334155] text-[13px] font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingId === refundTarget.sessionId}
                  onClick={() => handleRefundOrder(refundTarget.sessionId)}
                  className="flex-1 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-bold cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {savingId === refundTarget.sessionId ? 'Estornando...' : 'Confirmar Estorno'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
