import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  Ban,
  Shield,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  Eye,
  Filter,
  Sparkles,
  MapPin,
  Heart,
  Calendar,
  Compass,
  X
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; completedOnboarding: number; pendingOnboarding: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'banned'>('all');
  const [selectedOnboarding, setSelectedOnboarding] = useState<'all' | 'completed' | 'pending'>('all');
  const [selectedReferral, setSelectedReferral] = useState<string>('all');

  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [userToBan, setUserToBan] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedOnboarding !== 'all') params.append('onboarding', selectedOnboarding);
      if (selectedReferral !== 'all') params.append('referral', selectedReferral);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [selectedStatus, selectedOnboarding, selectedReferral]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleBan = async () => {
    if (!userToBan) return;
    setIsProcessing(true);
    try {
      const isCurrentlyBanned = userToBan.is_banned === 1;
      const endpoint = isCurrentlyBanned
        ? `/api/admin/users/${userToBan.id}/unban`
        : `/api/admin/users/${userToBan.id}/ban`;

      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userToBan.id
              ? { ...u, is_banned: isCurrentlyBanned ? 0 : 1 }
              : u
          )
        );
        showToast(data.message);
        setUserToBan(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = u.name && u.name.toLowerCase().includes(q);
    const emailMatch = (u.email && u.email.toLowerCase().includes(q)) || (u.whatsapp && u.whatsapp.toLowerCase().includes(q));
    const idMatch = String(u.id).includes(q);
    return nameMatch || emailMatch || idMatch;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getReferralBadgeStyle = (source?: string) => {
    if (!source) return 'bg-zinc-100 text-zinc-600 border-zinc-200';
    const s = source.toLowerCase();
    if (s.includes('tiktok')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (s.includes('instagram')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (s.includes('indica') || s.includes('amigo')) return 'bg-blue-50 text-blue-600 border-blue-200';
    if (s.includes('google')) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-zinc-700">
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1668FF] shrink-0 shadow-[0_0_10px_rgba(22,104,255,0.4)]" />
            <h1 className="text-[28px] sm:text-[34px] font-bold text-[#0D1526] tracking-[-0.03em] leading-tight">
              Usuários & Comunidade
            </h1>
          </div>
          <p className="text-sm text-[#5B6B85] mt-1 sm:pl-[22px]">
            {stats ? `${stats.total} cadastrados • ${stats.completedOnboarding} completaram onboarding (${stats.pendingOnboarding} pendentes)` : `${users.length} usuários cadastrados.`}
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Atualizar Lista</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, WhatsApp ou ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 py-0.5">
          {[
            { id: 'all', label: 'Todos Status' },
            { id: 'active', label: 'Ativos' },
            { id: 'banned', label: 'Banidos' },
          ].map((tab) => {
            const isSelected = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id as any)}
                className={`h-[34px] px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ease-out cursor-pointer inline-flex items-center select-none active:scale-[0.96] ${
                  isSelected
                    ? 'bg-[#E5E5EA] text-zinc-900 border border-black/[0.06] shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.12)] font-semibold'
                    : 'bg-white text-zinc-700 border border-zinc-200/90 shadow-[0_2px_5px_-1px_rgba(0,0,0,0.07),_0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_3px_8px_-1px_rgba(0,0,0,0.09)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Onboarding Filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 py-0.5">
          {[
            { id: 'all', label: 'Onboarding: Todos' },
            { id: 'completed', label: 'Concluído' },
            { id: 'pending', label: 'Pendente' },
          ].map((tab) => {
            const isSelected = selectedOnboarding === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedOnboarding(tab.id as any)}
                className={`h-[34px] px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ease-out cursor-pointer inline-flex items-center select-none active:scale-[0.96] ${
                  isSelected
                    ? 'bg-[#E5E5EA] text-zinc-900 border border-black/[0.06] shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.12)] font-semibold'
                    : 'bg-white text-zinc-700 border border-zinc-200/90 shadow-[0_2px_5px_-1px_rgba(0,0,0,0.07),_0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_3px_8px_-1px_rgba(0,0,0,0.09)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Referral Source Filter */}
        <select
          value={selectedReferral}
          onChange={(e) => setSelectedReferral(e.target.value)}
          aria-label="Filtrar por canal de origem"
          className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-black text-zinc-700 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="all">Todas as Origens</option>
          <option value="TikTok">TikTok</option>
          <option value="Instagram">Instagram</option>
          <option value="Indicação">Indicação</option>
          <option value="Google">Google / Pesquisa</option>
          <option value="Outro">Outro Canal</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-black text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-6">USUÁRIO</th>
                <th className="py-3.5 px-6">ORIGEM / ONBOARDING</th>
                <th className="py-3.5 px-6">STATUS</th>
                <th className="py-3.5 px-6">CADASTRO</th>
                <th className="py-3.5 px-6 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500 font-black">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Carregando base de usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    Nenhum usuário localizado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isBanned = user.is_banned === 1;
                  const initial = (user.name || user.email || user.whatsapp || 'U').charAt(0).toUpperCase();
                  const isCompleted = user.onboarding_completed;

                  return (
                    <tr key={user.id} className="hover:bg-zinc-50/60 transition-colors">
                      {/* Column 1: User details */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              user.avatar_url && user.avatar_url !== '/fotoperfil.png'
                                ? user.avatar_url
                                : user.role === 'admin' || user.id === 1
                                ? (typeof window !== 'undefined' ? localStorage.getItem('monvian_local_avatar') : null) ||
                                  user.avatar_url ||
                                  '/fotoperfil.png'
                                : user.avatar_url || '/fotoperfil.png'
                            }
                            alt={user.name}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-zinc-200"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-zinc-900 text-xs sm:text-sm">
                                {user.name || 'Membro Monvian'}
                              </span>
                              {user.role === 'admin' && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                                  GERENTE
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-400 block font-mono">
                              ID: {user.id} • {user.email || user.whatsapp || 'Sem e-mail'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Referral Source & Onboarding Badge */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {user.referral_source ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black ${getReferralBadgeStyle(user.referral_source)}`}>
                                {user.referral_source}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">
                                Direto / Antigo
                              </span>
                            )}

                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Concluído
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                Passo {user.onboarding_step || 1}/5
                              </span>
                            )}
                          </div>
                          {user.travel_style && (
                            <span className="text-[11px] text-zinc-500 block">
                              {user.travel_style}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Status Badge Pill */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80 text-[11px] font-black uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            BANIDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200/80 text-[11px] font-black uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            ATIVO
                          </span>
                        )}
                      </td>

                      {/* Column 4: Created at date */}
                      <td className="py-4 px-6 text-zinc-600 font-black whitespace-nowrap text-xs">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Column 5: Actions */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedUserDetail(user)}
                            className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                            title="Ver Respostas & Perfil"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isBanned ? (
                            <button
                              type="button"
                              onClick={() => setUserToBan(user)}
                              className="px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-black transition-colors cursor-pointer"
                            >
                              Desbanir
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUserToBan(user)}
                              className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-black transition-colors cursor-pointer"
                            >
                              Banir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Preferences Detail Modal */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-50 text-blue-600 font-black flex items-center justify-center ring-1 ring-zinc-200 shrink-0">
                  {selectedUserDetail.avatar_url || (selectedUserDetail.role === 'admin' && typeof window !== 'undefined' && localStorage.getItem('monvian_local_avatar')) ? (
                    <img
                      src={
                        selectedUserDetail.avatar_url && selectedUserDetail.avatar_url !== '/fotoperfil.png'
                          ? selectedUserDetail.avatar_url
                          : (typeof window !== 'undefined' ? localStorage.getItem('monvian_local_avatar') : null) ||
                            selectedUserDetail.avatar_url ||
                            '/fotoperfil.png'
                      }
                      alt={selectedUserDetail.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (selectedUserDetail.name || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900">
                    {selectedUserDetail.name || 'Membro Monvian'}
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono">
                    ID: {selectedUserDetail.id} • {selectedUserDetail.email || selectedUserDetail.whatsapp}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-xs">
                <span className="font-black text-zinc-500">Status do Onboarding:</span>
                {selectedUserDetail.onboarding_completed ? (
                  <span className="font-black text-blue-600 bg-blue-100/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Concluído
                  </span>
                ) : (
                  <span className="font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full">
                    Pendente (Passo {selectedUserDetail.onboarding_step || 1} de 5)
                  </span>
                )}
              </div>

              {/* Answers Grid */}
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 space-y-1">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block">
                    1. Como conheceu o Monvian?
                  </span>
                  <p className="font-black text-zinc-800 text-[13px]">
                    {selectedUserDetail.referral_source || 'Não informado / Usuário antigo'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 space-y-1">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block">
                    2. Frequência de Visita a Campos do Jordão
                  </span>
                  <p className="font-black text-zinc-800 text-[13px]">
                    {selectedUserDetail.travel_frequency || 'Não informado'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 space-y-1">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block">
                    3. Estilo de Viagem Favorito
                  </span>
                  <p className="font-black text-zinc-800 text-[13px]">
                    {selectedUserDetail.travel_style || 'Não informado'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 space-y-1">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block">
                    4. O que mais gosta de descobrir
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.isArray(selectedUserDetail.main_interests) && selectedUserDetail.main_interests.length > 0 ? (
                      selectedUserDetail.main_interests.map((item: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-800 font-black text-[11px]">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-500 font-black">Não informado</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 space-y-1">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider block">
                    5. Época Favorita na Serra
                  </span>
                  <p className="font-black text-zinc-800 text-[13px]">
                    {selectedUserDetail.preferred_season || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs transition-colors cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban / Unban Confirmation Modal */}
      {userToBan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                userToBan.is_banned === 1
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {userToBan.is_banned === 1 ? <UserCheck className="w-6 h-6" /> : <Ban className="w-6 h-6" />}
            </div>

            <h3 className="text-lg font-black text-zinc-900">
              {userToBan.is_banned === 1 ? 'Desbanir Usuário' : 'Banir Usuário'}
            </h3>

            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              {userToBan.is_banned === 1
                ? `Deseja restabelecer o acesso do usuário ${userToBan.name || userToBan.email || userToBan.whatsapp}? Ele poderá entrar novamente no aplicativo.`
                : `Tem certeza que deseja banir o usuário ${userToBan.name || userToBan.email || userToBan.whatsapp}? Suas sessões ativas serão encerradas imediatamente e ele não poderá acessar o Monvian.`}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUserToBan(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBan}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-xl text-xs font-black text-white shadow-md transition-all cursor-pointer ${
                  userToBan.is_banned === 1
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                {isProcessing
                  ? 'Processando...'
                  : userToBan.is_banned === 1
                  ? 'Confirmar Desbanimento'
                  : 'Confirmar Banimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

