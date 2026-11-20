import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Users,
  Check,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Zap,
  ArrowUp,
  RefreshCw,
  CheckCircle2,
  Ban,
  UserCheck,
  Eye,
  X,
} from 'lucide-react';

const CARD_SHADOW =
  '0 6px 22px -6px rgba(15, 23, 42, 0.055), 0 1px 4px rgba(15, 23, 42, 0.025)';
const PILL_SHADOW =
  '0 3px 10px -3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)';

const REFERRAL_OPTIONS = [
  { id: 'all', label: 'Todas as Origens' },
  { id: 'direto', label: 'Direto' },
  { id: 'TikTok', label: 'TikTok' },
  { id: 'Instagram', label: 'Instagram' },
  { id: 'Indicação', label: 'Indicação' },
  { id: 'Google', label: 'Google / Pesquisa' },
  { id: 'Outro', label: 'Outro Canal' },
] as const;

const PAGE_BATCH_SIZE = 25;

interface AdminUserAvatarProps {
  user: any;
  sizeClass?: string;
}

const AdminUserAvatar: React.FC<AdminUserAvatarProps> = ({
  user,
  sizeClass = 'w-[52px] h-[52px]',
}) => {
  const [imgError, setImgError] = useState(false);

  const resolvedSrc = useMemo(() => {
    const raw = typeof user?.avatar_url === 'string' ? user.avatar_url.trim() : '';
    if (raw && raw !== '/fotoperfil.png' && raw !== 'null' && raw !== 'undefined') {
      return raw;
    }
    if (
      (user?.role === 'admin' || user?.id === 1) &&
      typeof window !== 'undefined'
    ) {
      const localAvatar = localStorage.getItem('monvian_local_avatar');
      if (localAvatar && localAvatar !== '/fotoperfil.png') {
        return localAvatar;
      }
    }
    return '';
  }, [user?.avatar_url, user?.role, user?.id]);

  if (resolvedSrc && !imgError) {
    return (
      <img
        src={resolvedSrc}
        alt={user?.name || 'Avatar do usuário'}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover bg-[#E8EAEE] ring-1 ring-black/[0.04] shrink-0`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} rounded-full bg-[#E6E8EC] flex items-end justify-center overflow-hidden shrink-0 ring-1 ring-black/[0.03]`}
    >
      <svg
        viewBox="0 0 48 48"
        className="w-[78%] h-[78%] text-[#BFC5D0]"
        fill="currentColor"
      >
        <circle cx="24" cy="17" r="9.5" />
        <path d="M8.5 44.5C9.8 35.6 16.2 30.5 24 30.5C31.8 30.5 38.2 35.6 39.5 44.5H8.5Z" />
      </svg>
    </div>
  );
};

export const AdminUsers: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active?: number;
    banned?: number;
    completedOnboarding: number;
    pendingOnboarding: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'banned'>('all');
  const [selectedOnboarding, setSelectedOnboarding] = useState<'all' | 'completed' | 'pending'>('all');
  const [selectedReferral, setSelectedReferral] = useState<string>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_BATCH_SIZE);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [userToBan, setUserToBan] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchUsers = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        if (data.stats) {
          setStats({
            total: Number(data.stats.total ?? data.users.length),
            active: data.stats.active,
            banned: data.stats.banned,
            completedOnboarding: Number(
              data.stats.completedOnboarding ??
                data.users.filter((u: any) => Number(u.onboarding_completed) === 1).length
            ),
            pendingOnboarding: Number(
              data.stats.pendingOnboarding ??
                data.users.filter((u: any) => Number(u.onboarding_completed) !== 1).length
            ),
          });
        }
      }
    } catch (err) {
      console.error('[AdminUsers] Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  // Reset pagination batch when filters change
  useEffect(() => {
    setVisibleLimit(PAGE_BATCH_SIZE);
  }, [searchQuery, selectedStatus, selectedOnboarding, selectedReferral]);

  // Close origin filter popover on outside click or Escape
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleBan = async () => {
    if (!userToBan) return;
    setIsProcessing(true);
    try {
      const isCurrentlyBanned = Number(userToBan.is_banned) === 1;
      const endpoint = isCurrentlyBanned
        ? `/api/admin/users/${userToBan.id}/unban`
        : `/api/admin/users/${userToBan.id}/ban`;

      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        const nextBannedVal = isCurrentlyBanned ? 0 : 1;
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userToBan.id ? { ...u, is_banned: nextBannedVal } : u
          )
        );
        setSelectedUserDetail((prev: any) =>
          prev && prev.id === userToBan.id ? { ...prev, is_banned: nextBannedVal } : prev
        );
        showToast(data.message || (isCurrentlyBanned ? 'Usuário reativado.' : 'Usuário banido.'));
        setUserToBan(null);
      } else if (data.error) {
        showToast(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return users.filter((u) => {
      const isBanned = Number(u.is_banned) === 1;
      const isCompleted = Number(u.onboarding_completed) === 1;

      if (selectedStatus === 'active' && isBanned) return false;
      if (selectedStatus === 'banned' && !isBanned) return false;

      if (selectedOnboarding === 'completed' && !isCompleted) return false;
      if (selectedOnboarding === 'pending' && isCompleted) return false;

      if (selectedReferral !== 'all') {
        const src = String(u.referral_source || u.campos_relationship || '').trim().toLowerCase();
        if (selectedReferral === 'direto') {
          if (src && !src.includes('direto')) return false;
        } else if (!src.includes(selectedReferral.toLowerCase())) {
          return false;
        }
      }

      if (q) {
        const nameMatch = String(u.name || '').toLowerCase().includes(q);
        const emailMatch = String(u.email || '').toLowerCase().includes(q);
        const whatsappMatch = String(u.whatsapp || '').toLowerCase().includes(q);
        const idMatch = String(u.id || '').toLowerCase().includes(q);
        const usernameMatch = String(u.username || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !whatsappMatch && !idMatch && !usernameMatch) {
          return false;
        }
      }

      return true;
    });
  }, [users, searchQuery, selectedStatus, selectedOnboarding, selectedReferral]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleLimit),
    [filteredUsers, visibleLimit]
  );

  const totalUsersCount = stats?.total ?? users.length;
  const completedOnboardingCount =
    stats?.completedOnboarding ??
    users.filter((u) => Number(u.onboarding_completed) === 1).length;

  const hasActiveFilters =
    selectedStatus !== 'all' ||
    selectedOnboarding !== 'all' ||
    selectedReferral !== 'all' ||
    searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedOnboarding('all');
    setSelectedReferral('all');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getReferralBadgeStyle = (source?: string) => {
    if (!source) return 'bg-[#F3F4F6] text-[#4B5563] border-black/[0.05]';
    const s = source.toLowerCase();
    if (s.includes('tiktok')) return 'bg-rose-50 text-rose-700 border-rose-200/80';
    if (s.includes('instagram')) return 'bg-purple-50 text-purple-700 border-purple-200/80';
    if (s.includes('indica') || s.includes('amigo')) return 'bg-blue-50 text-blue-700 border-blue-200/80';
    if (s.includes('google')) return 'bg-sky-50 text-sky-700 border-sky-200/80';
    return 'bg-[#F3F4F6] text-[#374151] border-black/[0.06]';
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 md:bottom-6 right-4 sm:right-6 z-[300] bg-[#1C1F26] text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-white/10"
          >
            <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean Minimal Title & Subtitle Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pt-0.5">
        <div className="max-w-xl">
          <h1 className="text-[31px] sm:text-[36px] font-bold text-[#181C23] tracking-[-0.035em] leading-[1.08]">
            Usuários &amp; Comunidade
          </h1>
          <p className="text-[14.5px] sm:text-[15.5px] font-normal text-[#6B7280] leading-[1.4] mt-2">
            Gerencie os usuários da plataforma e acompanhe a comunidade.
          </p>
        </div>

        {/* Desktop Refresh & Origin Filter Bar */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <select
            value={selectedReferral}
            onChange={(e) => setSelectedReferral(e.target.value)}
            aria-label="Filtrar por canal de origem"
            className="h-10 px-3.5 bg-white border border-black/[0.06] rounded-full text-[13px] font-medium text-[#232730] focus:outline-none focus:ring-2 focus:ring-[#1C1F26]/15 cursor-pointer"
            style={{ boxShadow: PILL_SHADOW }}
          >
            {REFERRAL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="h-10 inline-flex items-center gap-2 px-4 rounded-full bg-white border border-black/[0.06] text-[13px] font-semibold text-[#181C23] cursor-pointer active:scale-[0.97] transition-all disabled:opacity-60"
            style={{ boxShadow: PILL_SHADOW }}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#374151] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </div>

      {/* Two Side-by-Side Compact KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Total Users */}
        <div
          className="rounded-[22px] bg-white border border-black/[0.04] p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#F2F3F5] flex items-center justify-center shrink-0 text-[#1F242D]">
            <Users className="w-[17px] h-[17px] sm:w-[20px] sm:h-[20px] stroke-[1.9]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[20px] sm:text-[24px] font-bold text-[#181C23] tracking-[-0.03em] leading-none tabular-nums">
                {loading ? '—' : totalUsersCount.toLocaleString('pt-BR')}
              </span>
              <span
                aria-hidden="true"
                className="w-[19px] h-[19px] sm:w-[20px] sm:h-[20px] rounded-full bg-[#E9F5EE] text-[#339362] flex items-center justify-center shrink-0"
              >
                <ArrowUp className="w-3 h-3 stroke-[2.4]" />
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[12.5px] font-medium text-[#6B7280] leading-[1.2] mt-1">
              Usuários cadastrados
            </p>
          </div>
        </div>

        {/* Card 2: Completed Onboarding */}
        <div
          className="rounded-[22px] bg-white border border-black/[0.04] p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#F2F3F5] flex items-center justify-center shrink-0 text-[#1F242D]">
            <Check className="w-[17px] h-[17px] sm:w-[20px] sm:h-[20px] stroke-[2.2]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[20px] sm:text-[24px] font-bold text-[#181C23] tracking-[-0.03em] leading-none tabular-nums">
                {loading ? '—' : completedOnboardingCount.toLocaleString('pt-BR')}
              </span>
              <span
                aria-hidden="true"
                className="w-[19px] h-[19px] sm:w-[20px] sm:h-[20px] rounded-full bg-[#E9F5EE] text-[#339362] flex items-center justify-center shrink-0"
              >
                <ArrowUp className="w-3 h-3 stroke-[2.4]" />
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[12.5px] font-medium text-[#6B7280] leading-[1.2] mt-1">
              Onboarding concluído
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar + Independent Filter Button */}
      <div ref={filterContainerRef} className="relative z-20">
        <div className="flex items-center gap-2.5">
          <div
            className="flex-1 h-[48px] rounded-full bg-white border border-black/[0.045] px-4 flex items-center gap-2.5 transition-shadow focus-within:ring-2 focus-within:ring-[#1C1F26]/10"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <Search className="w-[18px] h-[18px] text-[#374151] shrink-0 stroke-[2]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar usuário…"
              aria-label="Buscar usuário"
              className="w-full bg-transparent border-none outline-none text-[14.5px] text-[#181C23] placeholder:text-[#8E95A2]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#181C23] hover:bg-[#F3F4F6] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-label="Abrir filtros avançados e origem"
            aria-expanded={isFilterOpen}
            className={`relative w-[48px] h-[48px] rounded-full border flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all ${
              isFilterOpen
                ? 'bg-[#1C1F26] text-white border-[#1C1F26]'
                : 'bg-white text-[#1F242D] border-black/[0.045]'
            }`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <SlidersHorizontal className="w-[18px] h-[18px] stroke-[2]" />
            {selectedReferral !== 'all' && !isFilterOpen && (
              <span
                aria-hidden="true"
                className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#1C1F26] ring-2 ring-white"
              />
            )}
          </button>
        </div>

        {/* Independent Origin & Refresh Filter Popover */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 mt-2.5 w-full sm:w-[340px] rounded-[24px] bg-white border border-black/[0.06] p-4 z-30"
              style={{
                boxShadow:
                  '0 18px 40px -12px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold text-[#181C23]">
                  Origem do Cadastro
                </span>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[12px] font-medium text-[#6B7280] hover:text-[#181C23] cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fetchUsers(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[11.5px] font-medium text-[#181C23] cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {REFERRAL_OPTIONS.map((opt) => {
                  const active = selectedReferral === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedReferral(opt.id);
                        setIsFilterOpen(false);
                      }}
                      className={`h-[34px] px-3.5 rounded-full text-[12.5px] font-medium transition-all cursor-pointer active:scale-[0.97] ${
                        active
                          ? 'bg-[#1C1F26] text-white'
                          : 'bg-[#F4F5F7] text-[#374151] hover:bg-[#E8EAEE]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Horizontal Scrollable Status & Onboarding Filter Pills */}
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1"
        role="group"
        aria-label="Filtros de status e onboarding"
      >
        {/* Status Pills */}
        {(
          [
            { id: 'all', label: 'Todos', aria: 'Status: Todos' },
            { id: 'active', label: 'Ativos', aria: 'Status: Ativos' },
            { id: 'banned', label: 'Banidos', aria: 'Status: Banidos' },
          ] as const
        ).map((item) => {
          const isSelected = selectedStatus === item.id;
          return (
            <button
              key={`status-${item.id}`}
              type="button"
              aria-label={item.aria}
              aria-pressed={isSelected}
              onClick={() => setSelectedStatus(item.id)}
              className={`h-[36px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer select-none active:scale-[0.96] ${
                isSelected
                  ? 'bg-[#1C1F26] text-white border border-[#1C1F26]'
                  : 'bg-white text-[#232730] border border-black/[0.04] hover:bg-[#FAFAFB]'
              }`}
              style={!isSelected ? { boxShadow: PILL_SHADOW } : undefined}
            >
              {item.label}
            </button>
          );
        })}

        {/* Subtle Vertical Divider */}
        <span
          aria-hidden="true"
          className="w-px h-5 bg-[#D4D8E0] shrink-0 mx-0.5"
        />

        {/* Onboarding Pills */}
        {(
          [
            { id: 'all', label: 'Todos', aria: 'Onboarding: Todos' },
            { id: 'completed', label: 'Concluídos', aria: 'Onboarding: Concluídos' },
            { id: 'pending', label: 'Pendentes', aria: 'Onboarding: Pendentes' },
          ] as const
        ).map((item) => {
          const isSelected = selectedOnboarding === item.id;
          return (
            <button
              key={`onboarding-${item.id}`}
              type="button"
              aria-label={item.aria}
              aria-pressed={isSelected}
              onClick={() => setSelectedOnboarding(item.id)}
              className={`h-[36px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer select-none active:scale-[0.96] ${
                isSelected
                  ? 'bg-[#1C1F26] text-white border border-[#1C1F26]'
                  : 'bg-white text-[#232730] border border-black/[0.04] hover:bg-[#FAFAFB]'
              }`}
              style={!isSelected ? { boxShadow: PILL_SHADOW } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* MOBILE: Individual User Cards (Replaces horizontal table on mobile) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-[24px] bg-white border border-black/[0.04] p-4 flex items-center gap-3.5 animate-pulse"
                style={{ boxShadow: CARD_SHADOW }}
              >
                <div className="w-[52px] h-[52px] rounded-full bg-[#ECEEF2] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded-full bg-[#ECEEF2]" />
                  <div className="h-3 w-48 rounded-full bg-[#F2F4F7]" />
                  <div className="h-3 w-12 rounded-full bg-[#F2F4F7]" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div
            className="rounded-[24px] bg-white border border-black/[0.04] py-10 px-6 text-center"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <p className="text-[14px] font-semibold text-[#181C23]">
              Nenhum usuário encontrado
            </p>
            <p className="text-[12.5px] text-[#6B7280] mt-1">
              Ajuste a busca ou os filtros aplicados para visualizar os membros.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 h-9 px-4 rounded-full bg-[#1C1F26] text-white text-[12.5px] font-medium cursor-pointer active:scale-[0.97]"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {visibleUsers.map((user) => {
              const isBanned = Number(user.is_banned) === 1;
              const isCompleted = Number(user.onboarding_completed) === 1;
              const rawOrigin = String(user.referral_source || user.campos_relationship || '').trim();
              const isDirectOrigin =
                !rawOrigin || rawOrigin.toLowerCase().includes('direto');

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserDetail(user)}
                  className="w-full text-left rounded-[24px] bg-white border border-black/[0.04] px-4 py-3.5 flex items-center gap-3.5 cursor-pointer active:scale-[0.985] transition-transform"
                  style={{ boxShadow: CARD_SHADOW }}
                >
                  <AdminUserAvatar user={user} sizeClass="w-[52px] h-[52px]" />

                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + Status Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[15.5px] text-[#181C23] tracking-[-0.015em] truncate">
                        {user.name || 'Membro Monvian'}
                      </span>

                      {isBanned ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF1F4] text-[#4B5563] text-[11.5px] font-medium shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
                          Banido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E7F6EC] text-[#1F7A47] text-[11.5px] font-medium shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22A05B]" />
                          Ativo
                        </span>
                      )}
                    </div>

                    {/* Row 2: ID • Email */}
                    <p className="text-[12.5px] text-[#6B7280] truncate mt-0.5 tabular-nums">
                      ID: {user.id} <span aria-hidden="true">•</span>{' '}
                      {user.email || user.whatsapp || 'Sem e-mail'}
                    </p>

                    {/* Row 3: Minimalist Origin & Onboarding Symbols ONLY (no borders, no circles, no text) */}
                    {(isDirectOrigin || isCompleted) && (
                      <div className="mt-2 flex items-center gap-2.5">
                        {isDirectOrigin && (
                          <Zap
                            className="w-[14px] h-[14px] text-[#E5AC22] fill-[#E5AC22] shrink-0"
                            aria-label="Cadastro direto"
                          />
                        )}
                        {isCompleted && (
                          <Check
                            className="w-[14px] h-[14px] text-[#2F3540] stroke-[2.5] shrink-0"
                            aria-label="Onboarding concluído"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-[18px] h-[18px] text-[#374151] shrink-0" />
                </button>
              );
            })}

            {filteredUsers.length > visibleUsers.length && (
              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_BATCH_SIZE)}
                  className="h-10 px-5 rounded-full bg-white border border-black/[0.05] text-[13px] font-medium text-[#181C23] cursor-pointer active:scale-[0.97] transition-transform"
                  style={{ boxShadow: PILL_SHADOW }}
                >
                  Carregar mais ({filteredUsers.length - visibleUsers.length} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* DESKTOP: Preserved Administrative Table */}
      <div
        className="hidden md:block bg-white rounded-[24px] border border-black/[0.05] overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-[#FAFBFD] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                <th className="py-3.5 px-6">Usuário</th>
                <th className="py-3.5 px-6">Origem / Onboarding</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Cadastro</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#6B7280] font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1C1F26]" />
                    Carregando base de usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#6B7280]">
                    Nenhum usuário localizado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => {
                  const isBanned = Number(user.is_banned) === 1;
                  const isCompleted = Number(user.onboarding_completed) === 1;
                  const rawOrigin = String(user.referral_source || user.campos_relationship || '').trim();
                  const isDirectOrigin =
                    !rawOrigin || rawOrigin.toLowerCase().includes('direto');

                  return (
                    <tr key={user.id} className="hover:bg-[#FAFBFD] transition-colors">
                      {/* Column 1: User details */}
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <AdminUserAvatar user={user} sizeClass="w-10 h-10" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#181C23] text-sm truncate">
                                {user.name || 'Membro Monvian'}
                              </span>
                              {user.role === 'admin' && (
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#F2F3F5] text-[#374151]">
                                  Gerente
                                </span>
                              )}
                            </div>
                            <span className="text-[12px] text-[#6B7280] block tabular-nums">
                              ID: {user.id} • {user.email || user.whatsapp || 'Sem e-mail'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Origin & Onboarding */}
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {isDirectOrigin ? (
                            <Zap
                              className="w-4 h-4 text-[#E5AC22] fill-[#E5AC22] shrink-0"
                              aria-label="Origem direta"
                            />
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${getReferralBadgeStyle(
                                rawOrigin
                              )}`}
                            >
                              {rawOrigin}
                            </span>
                          )}
                          {isCompleted ? (
                            <Check
                              className="w-4 h-4 text-[#2F3540] stroke-[2.5] shrink-0"
                              aria-label="Onboarding concluído"
                            />
                          ) : (
                            <span className="text-[11px] font-medium text-[#6B7280]">
                              Passo {user.onboarding_step || 1}/5
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Status Pill */}
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF1F4] text-[#4B5563] text-[12px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
                            Banido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E7F6EC] text-[#1F7A47] text-[12px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22A05B]" />
                            Ativo
                          </span>
                        )}
                      </td>

                      {/* Column 4: Created date */}
                      <td className="py-3.5 px-6 text-[#4B5563] font-medium whitespace-nowrap text-xs tabular-nums">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Column 5: Actions */}
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedUserDetail(user)}
                            className="p-2 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#1F242D] transition-colors cursor-pointer"
                            title="Ver Respostas & Perfil"
                            aria-label="Ver detalhes do usuário"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isBanned ? (
                            <button
                              type="button"
                              onClick={() => setUserToBan(user)}
                              className="px-3.5 py-1.5 rounded-full bg-[#E7F6EC] hover:bg-[#D5EEDF] text-[#1F7A47] text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Desbanir
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUserToBan(user)}
                              className="px-3.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
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

        {filteredUsers.length > visibleUsers.length && (
          <div className="py-3.5 px-6 border-t border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
            <span className="text-xs text-[#6B7280] tabular-nums">
              Exibindo {visibleUsers.length} de {filteredUsers.length} usuários
            </span>
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + PAGE_BATCH_SIZE)}
              className="h-9 px-4 rounded-full bg-white border border-black/[0.06] text-xs font-semibold text-[#181C23] cursor-pointer hover:bg-[#F3F4F6] transition-colors"
            >
              Carregar mais
            </button>
          </div>
        )}
      </div>

      {/* User Preferences Detail Modal */}
      {selectedUserDetail && (
        <div
          className="fixed inset-0 z-[270] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-[2px]"
          onClick={() => setSelectedUserDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 shadow-2xl border border-black/[0.06] max-h-[88dvh] overflow-y-auto"
            style={{
              paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
            }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <AdminUserAvatar user={selectedUserDetail} sizeClass="w-11 h-11" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-bold text-[#181C23] truncate">
                      {selectedUserDetail.name || 'Membro Monvian'}
                    </h3>
                    {selectedUserDetail.role === 'admin' && (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#F2F3F5] text-[#374151] shrink-0">
                        Gerente
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#6B7280] block truncate tabular-nums">
                    ID: {selectedUserDetail.id} • {selectedUserDetail.email || selectedUserDetail.whatsapp}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                aria-label="Fechar detalhes"
                className="w-9 h-9 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#4B5563] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.04] text-xs">
                <span className="font-medium text-[#6B7280]">Status da Conta:</span>
                {Number(selectedUserDetail.is_banned) === 1 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF1F4] text-[#4B5563] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" />
                    Banido
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E7F6EC] text-[#1F7A47] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22A05B]" />
                    Ativo
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.04] text-xs">
                <span className="font-medium text-[#6B7280]">Status do Onboarding:</span>
                {Number(selectedUserDetail.onboarding_completed) === 1 ? (
                  <span className="font-semibold text-[#181C23] inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#2F3540] stroke-[2.5]" />
                    Concluído
                  </span>
                ) : (
                  <span className="font-semibold text-amber-700">
                    Pendente (Passo {selectedUserDetail.onboarding_step || 1} de 5)
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3.5 rounded-2xl border border-black/[0.05] bg-[#FAFAFB] space-y-1">
                  <span className="text-[11px] font-medium text-[#6B7280] block">
                    Origem / Relação com Campos do Jordão
                  </span>
                  <p className="font-semibold text-[#181C23] text-[13px]">
                    {selectedUserDetail.referral_source ||
                      selectedUserDetail.campos_relationship ||
                      'Direto'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-black/[0.05] bg-[#FAFAFB] space-y-1">
                  <span className="text-[11px] font-medium text-[#6B7280] block">
                    Previsão ou Frequência de Visita
                  </span>
                  <p className="font-semibold text-[#181C23] text-[13px]">
                    {selectedUserDetail.travel_frequency ||
                      selectedUserDetail.next_trip_timing ||
                      'Não informado'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-black/[0.05] bg-[#FAFAFB] space-y-1">
                  <span className="text-[11px] font-medium text-[#6B7280] block">
                    Companhia / Estilo de Viagem
                  </span>
                  <p className="font-semibold text-[#181C23] text-[13px]">
                    {selectedUserDetail.travel_style ||
                      selectedUserDetail.travel_company ||
                      'Não informado'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-black/[0.05] bg-[#FAFAFB] space-y-1">
                  <span className="text-[11px] font-medium text-[#6B7280] block">
                    Interesses Principais
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Array.isArray(selectedUserDetail.main_interests) &&
                    selectedUserDetail.main_interests.length > 0 ? (
                      selectedUserDetail.main_interests.map((item: string, i: number) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-full bg-[#ECEEF2] text-[#181C23] font-medium text-[11.5px]"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#6B7280] font-medium">Não informado</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-black/[0.05] bg-[#FAFAFB] space-y-1">
                  <span className="text-[11px] font-medium text-[#6B7280] block">
                    Preferência de Região / Cadastro
                  </span>
                  <p className="font-semibold text-[#181C23] text-[13px]">
                    {selectedUserDetail.preferred_season ||
                      selectedUserDetail.location_preference ||
                      'Não informado'}{' '}
                    • {formatDate(selectedUserDetail.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
              {Number(selectedUserDetail.is_banned) === 1 ? (
                <button
                  type="button"
                  onClick={() => setUserToBan(selectedUserDetail)}
                  className="h-10 px-4 rounded-full bg-[#E7F6EC] hover:bg-[#D5EEDF] text-[#1F7A47] font-semibold text-xs transition-colors cursor-pointer"
                >
                  Desbanir Usuário
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setUserToBan(selectedUserDetail)}
                  className="h-10 px-4 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Banir Usuário
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="h-10 px-5 rounded-full bg-[#1C1F26] hover:bg-[#2C313B] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban / Unban Confirmation Modal */}
      {userToBan && (
        <div
          className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
          onClick={() => setUserToBan(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.06]"
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                Number(userToBan.is_banned) === 1
                  ? 'bg-[#E7F6EC] text-[#1F7A47]'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {Number(userToBan.is_banned) === 1 ? (
                <UserCheck className="w-6 h-6" />
              ) : (
                <Ban className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-lg font-bold text-[#181C23]">
              {Number(userToBan.is_banned) === 1 ? 'Desbanir Usuário' : 'Banir Usuário'}
            </h3>

            <p className="text-xs text-[#6B7280] mt-2 leading-relaxed">
              {Number(userToBan.is_banned) === 1
                ? `Deseja restabelecer o acesso do usuário ${userToBan.name || userToBan.email || userToBan.whatsapp}? Ele poderá entrar novamente no aplicativo.`
                : `Tem certeza que deseja banir o usuário ${userToBan.name || userToBan.email || userToBan.whatsapp}? Suas sessões ativas serão encerradas imediatamente e ele não poderá acessar o Monvian.`}
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUserToBan(null)}
                className="h-10 px-4 rounded-full border border-black/[0.08] text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBan}
                disabled={isProcessing}
                className={`h-10 px-5 rounded-full text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-60 ${
                  Number(userToBan.is_banned) === 1
                    ? 'bg-[#1F7A47] hover:bg-[#19653A]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessing
                  ? 'Processando...'
                  : Number(userToBan.is_banned) === 1
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
