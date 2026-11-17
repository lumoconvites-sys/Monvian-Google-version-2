import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Save,
  RotateCcw,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react';
import { PlatanoLeafIcon } from '../platanos/PlatanoLeafIcon';
import { getAuthHeaders, broadcastPlatanosWalletUpdate } from '../../hooks/usePlatanos';

interface AdminPlatanosProps {
  currentUser?: any;
}

export const AdminPlatanos: React.FC<AdminPlatanosProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<
    'packages' | 'itineraries' | 'wallets' | 'orders' | 'transactions' | 'unlocks' | 'audit'
  >('packages');
  const [data, setData] = useState<any>({
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
    packages: [],
    itineraries: [],
    wallets: [],
    transactions: [],
    orders: [],
    unlocks: [],
    auditLogs: [],
  });

  const [pkgEdits, setPkgEdits] = useState<Record<string, { platanos: number; priceReais: string; badge: string }>>({});
  const [itinEdits, setItinEdits] = useState<Record<string, { platanosPrice: number; isPremium: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Manual wallet adjustment modal state
  const [adjustTarget, setAdjustTarget] = useState<{ userId: number; email: string; balance: number } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<string>('15');
  const [adjustReason, setAdjustReason] = useState<string>('Ajuste administrativo');

  const getAdminHeaders = useCallback(() => {
    const base = getAuthHeaders();
    const adminEmail = (currentUser?.email || base['x-user-email'] || 'marioyesk@gmail.com')
      .trim()
      .toLowerCase();
    return {
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
        throw new Error(json.error || 'Erro ao carregar dados administrativos de Plátanos.');
      }
      setData(json);

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
      setFeedback({ type: 'success', text: 'Pacote atualizado com sucesso!' });
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
      setFeedback({ type: 'success', text: 'Preço em Plátanos atualizado!' });
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
          reason: adjustReason || 'Ajuste administrativo',
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
      broadcastPlatanosWalletUpdate();
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const q = searchTerm.trim().toLowerCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#D9A84E]/15 border border-[#D9A84E]/35 flex items-center justify-center shrink-0">
            <PlatanoLeafIcon className="w-9 h-9" variant="gold" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Gestão de Plátanos & Stripe
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Controle de pacotes fechados, preços de roteiros, carteiras, recargas Stripe e auditoria.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold cursor-pointer active:scale-95 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar dados</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-[11px] underline ml-3 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            Em Circulação
          </span>
          <div className="mt-1.5 flex items-center gap-1.5">
            <PlatanoLeafIcon className="w-[30px] h-[30px]" variant="gold" />
            <span className="text-2xl font-black">{data.stats?.totalCirculation || 0}</span>
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {data.stats?.totalWallets || 0} carteiras ativas
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            Total Creditado / Gasto
          </span>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500">
              +{data.stats?.totalCredited || 0}
            </span>
            <span className="text-sm font-bold text-zinc-400">
              / -{data.stats?.totalSpent || 0}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {data.stats?.totalUnlocks || 0} roteiros desbloqueados
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            Receita Confirmada (Stripe)
          </span>
          <div className="mt-1.5">
            <span className="text-2xl font-black text-[#D9A84E]">
              {data.stats?.revenueBRL || 'R$ 0,00'}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {data.stats?.paidOrdersCount || 0} recargas pagas
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
            Segurança & Webhook
          </span>
          <div className="mt-1.5 flex items-center gap-1.5 text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-base font-black">Atômico & Idempotente</span>
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Preços validados no servidor
          </span>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'packages', label: 'Pacotes de Recarga (5)' },
          { id: 'itineraries', label: 'Preços dos Roteiros' },
          { id: 'wallets', label: `Carteiras (${data.wallets?.length || 0})` },
          { id: 'orders', label: `Compras Stripe (${data.orders?.length || 0})` },
          { id: 'transactions', label: `Transações (${data.transactions?.length || 0})` },
          { id: 'unlocks', label: `Desbloqueios (${data.unlocks?.length || 0})` },
          { id: 'audit', label: `Auditoria (${data.auditLogs?.length || 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
              subTab === tab.id
                ? 'bg-[#D9A84E] text-[#141109] border-[#D9A84E]'
                : 'bg-white dark:bg-[#111114] text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. PACKAGES CONFIGURATION */}
      {subTab === 'packages' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {(data.packages || []).map((pkg: any) => {
              const edit = pkgEdits[pkg.id] || {
                platanos: pkg.platanos,
                priceReais: (pkg.priceCents / 100).toFixed(2).replace('.', ','),
                badge: pkg.badge || '',
              };

              return (
                <div
                  key={pkg.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#D9A84E]/15 border border-[#D9A84E]/35 flex items-center justify-center">
                        <PlatanoLeafIcon className="w-6 h-6" variant="gold" />
                      </div>
                      <div>
                        <span className="text-sm font-black block">
                          Pacote {pkg.platanos} Plátanos
                        </span>
                        <span className="text-[11px] text-zinc-400 font-mono">{pkg.id}</span>
                      </div>
                    </div>
                    {pkg.isBestValue && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#D9A84E]/20 text-[#D9A84E] text-[10px] font-bold">
                        Melhor custo-benefício
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10.5px] font-bold text-zinc-400 block mb-1">
                        Plátanos
                      </label>
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
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-zinc-400 block mb-1">
                        Preço (R$)
                      </label>
                      <input
                        type="text"
                        value={edit.priceReais}
                        onChange={(e) =>
                          setPkgEdits((prev) => ({
                            ...prev,
                            [pkg.id]: { ...edit, priceReais: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-zinc-400 block mb-1">
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
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingId === pkg.id}
                      onClick={() => handleSavePackage(pkg.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D9A84E] text-[#141109] text-xs font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingId === pkg.id ? 'Salvando...' : 'Salvar Pacote'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. ITINERARY PRICES */}
      {subTab === 'itineraries' && (
        <div className="space-y-3">
          {(data.itineraries || []).map((itin: any) => {
            const edit = itinEdits[itin.id] || {
              platanosPrice: itin.platanosPrice ?? 15,
              isPremium: Boolean(itin.isPremium),
            };

            return (
              <div
                key={itin.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{itin.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        edit.isPremium
                          ? 'bg-[#D9A84E]/20 text-[#D9A84E]'
                          : 'bg-emerald-500/15 text-emerald-500'
                      }`}
                    >
                      {edit.isPremium ? 'Premium' : 'Livre'}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">{itin.id}</span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={edit.isPremium}
                      onChange={(e) =>
                        setItinEdits((prev) => ({
                          ...prev,
                          [itin.id]: {
                            ...edit,
                            isPremium: e.target.checked,
                            platanosPrice: e.target.checked ? edit.platanosPrice || 15 : 0,
                          },
                        }))
                      }
                      className="rounded"
                    />
                    <span>Premium</span>
                  </label>

                  <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-2.5 py-1.5">
                    <PlatanoLeafIcon className="w-[21px] h-[21px]" variant="gold" />
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
                      className="w-16 bg-transparent text-xs font-bold outline-none"
                    />
                    <span className="text-[11px] text-zinc-400 font-semibold">Plátanos</span>
                  </div>

                  <button
                    type="button"
                    disabled={savingId === itin.id}
                    onClick={() => handleSaveItineraryPrice(itin.id)}
                    className="px-3.5 py-2 rounded-xl bg-[#D9A84E] text-[#141109] text-xs font-bold cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                  >
                    {savingId === itin.id ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search bar for Wallets / Orders / Transactions / Unlocks */}
      {['wallets', 'orders', 'transactions', 'unlocks'].includes(subTab) && (
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por e-mail, usuário, ID ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 text-xs font-medium outline-none"
          />
        </div>
      )}

      {/* 3. WALLETS */}
      {subTab === 'wallets' && (
        <div className="space-y-2.5">
          {(data.wallets || [])
            .filter(
              (w: any) =>
                !q ||
                String(w.user_email || '').toLowerCase().includes(q) ||
                String(w.user_name || '').toLowerCase().includes(q) ||
                String(w.user_id).includes(q)
            )
            .map((w: any) => (
              <div
                key={w.user_id}
                className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">
                      {w.user_name || w.user_email || `Usuário #${w.user_id}`}
                    </span>
                    <span className="text-[11px] text-zinc-400">ID #{w.user_id}</span>
                  </div>
                  <span className="text-xs text-zinc-400 block">{w.user_email}</span>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
                    <span>Creditado: +{w.total_credited}</span>
                    <span>Gasto: -{w.total_spent}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-2 rounded-xl bg-[#D9A84E]/15 border border-[#D9A84E]/35 flex items-center gap-1.5">
                    <PlatanoLeafIcon className="w-6 h-6" variant="gold" />
                    <span className="text-sm font-black">{w.balance} Plátanos</span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setAdjustTarget({
                        userId: w.user_id,
                        email: w.user_email,
                        balance: w.balance,
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/10 text-xs font-bold cursor-pointer hover:opacity-80"
                  >
                    Ajustar saldo
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 4. STRIPE ORDERS */}
      {subTab === 'orders' && (
        <div className="space-y-2.5">
          {(data.orders || [])
            .filter(
              (o: any) =>
                !q ||
                String(o.user_email || '').toLowerCase().includes(q) ||
                String(o.stripe_session_id || '').toLowerCase().includes(q) ||
                String(o.status || '').toLowerCase().includes(q)
            )
            .map((o: any) => (
              <div
                key={o.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black">
                      +{o.platanos_amount} Plátanos (R$ {(Number(o.amount_cents) / 100).toFixed(2).replace('.', ',')})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        o.status === 'paid'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : o.status === 'refunded'
                            ? 'bg-amber-500/15 text-amber-400'
                            : o.status === 'failed'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-zinc-500/15 text-zinc-400'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">
                    Usuário: {o.user_email} (ID #{o.user_id})
                  </p>
                  <p className="text-[10.5px] text-zinc-500 font-mono truncate">
                    Sessão: {o.stripe_session_id}
                    {o.stripe_payment_intent_id ? ` · PI: ${o.stripe_payment_intent_id}` : ''}
                  </p>
                </div>

                {o.status === 'paid' && (
                  <button
                    type="button"
                    disabled={savingId === o.stripe_session_id}
                    onClick={() => handleRefundOrder(o.stripe_session_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Estornar</span>
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      {/* 5. TRANSACTIONS */}
      {subTab === 'transactions' && (
        <div className="space-y-2">
          {(data.transactions || [])
            .filter(
              (t: any) =>
                !q ||
                String(t.user_email || '').toLowerCase().includes(q) ||
                String(t.description || '').toLowerCase().includes(q) ||
                String(t.id || '').toLowerCase().includes(q)
            )
            .map((t: any) => (
              <div
                key={t.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{t.description}</p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {t.user_email} · {t.created_at} · Status: {t.status}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-black block ${
                      t.amount > 0 ? 'text-emerald-400' : t.amount < 0 ? 'text-[#D9A84E]' : 'text-zinc-400'
                    }`}
                  >
                    {t.amount > 0 ? `+${t.amount}` : t.amount} Plátanos
                  </span>
                  <span className="text-[10.5px] text-zinc-500">
                    {t.balance_before} → {t.balance_after}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 6. UNLOCKS */}
      {subTab === 'unlocks' && (
        <div className="space-y-2">
          {(data.unlocks || [])
            .filter(
              (u: any) =>
                !q ||
                String(u.user_email || '').toLowerCase().includes(q) ||
                String(u.itinerary_title || '').toLowerCase().includes(q)
            )
            .map((u: any) => (
              <div
                key={u.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-bold">{u.itinerary_title}</p>
                  <p className="text-[11px] text-zinc-400">
                    {u.user_email} (ID #{u.user_id}) · {u.created_at}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#D9A84E]/15 text-[#D9A84E] text-xs font-bold">
                  {u.platanos_paid} Plátanos
                </span>
              </div>
            ))}
        </div>
      )}

      {/* 7. AUDIT LOGS */}
      {subTab === 'audit' && (
        <div className="space-y-2">
          {(data.auditLogs || []).map((log: any) => (
            <div
              key={log.id}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-white/10 text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#D9A84E]">{log.action}</span>
                <span className="text-[11px] text-zinc-400">{log.created_at}</span>
              </div>
              <p className="text-zinc-400">
                Admin: {log.admin_email} · Alvo: {log.target_type} ({log.target_id})
              </p>
              <pre className="text-[10.5px] text-zinc-500 overflow-x-auto bg-zinc-50 dark:bg-black/40 p-2 rounded-lg">
                {log.details_json}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Manual Wallet Balance Adjustment */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-white/10 p-5 space-y-4">
            <h3 className="text-base font-bold">Ajustar Saldo da Carteira</h3>
            <p className="text-xs text-zinc-400">
              Usuário: <strong>{adjustTarget.email}</strong> (Saldo atual: {adjustTarget.balance} Plátanos)
            </p>
            <div>
              <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                Quantidade a creditar (+) ou debitar (-)
              </label>
              <input
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 text-sm font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                Motivo (registrado na auditoria)
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/10 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdjustWallet}
                className="flex-1 py-2.5 rounded-xl bg-[#D9A84E] text-[#141109] text-xs font-bold cursor-pointer"
              >
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
