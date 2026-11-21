import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Compass,
  Plus,
  Search,
  MapPin,
  Calendar,
  Clock,
  Trash2,
  Edit,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Tag,
  Star,
  ShoppingBag,
  X,
  RefreshCw,
} from 'lucide-react';
import { Itinerary, ItineraryCategory, ItineraryStatus } from '../../types';
import { PlatanoLeafIcon } from '../platanos/PlatanoLeafIcon';
import { AdminItineraryModal } from './AdminItineraryModal';
import { AdminItineraryCategoryModal } from './AdminItineraryCategoryModal';
import {
  fetchItinerariesFromSupabase,
  fetchItineraryCategoriesFromSupabase,
  deleteItineraryFromSupabase,
  toggleItineraryStatusInSupabase,
  toggleItineraryFeaturedInSupabase,
  toggleItineraryPremiumInSupabase,
  subscribeToItinerariesChanges,
} from '../../services/supabaseItineraries';

const CARD_SHADOW =
  '0 6px 22px -6px rgba(15, 23, 42, 0.055), 0 1px 4px rgba(15, 23, 42, 0.025)';
const PILL_SHADOW =
  '0 3px 10px -3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)';

export const AdminItineraries: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [activeAdminTab, setActiveAdminTab] = useState<'itineraries' | 'categories' | 'featured'>(
    'itineraries'
  );
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [categories, setCategories] = useState<ItineraryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'hidden'>('all');
  const [daysFilter, setDaysFilter] = useState<number | 'all'>('all');

  // Modal States
  const [isItineraryModalOpen, setIsItineraryModalOpen] = useState(false);
  const [itineraryToEdit, setItineraryToEdit] = useState<Itinerary | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ItineraryCategory | null>(null);

  // Native iOS Delete Confirmation Modal State (replaces window.confirm)
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'itinerary' | 'category';
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [itinsData, catsData] = await Promise.all([
        fetchItinerariesFromSupabase({ all: true, throwOnError: false }),
        fetchItineraryCategoriesFromSupabase(),
      ]);

      if (Array.isArray(itinsData)) {
        setItineraries(itinsData);
      }
      if (Array.isArray(catsData)) {
        setCategories(catsData);
      }
    } catch (err: any) {
      showToast('Erro ao carregar dados: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const unsubscribe = subscribeToItinerariesChanges(() => {
      fetchData(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenCreateItinerary = () => {
    setItineraryToEdit(null);
    setIsItineraryModalOpen(true);
  };

  const handleOpenEditItinerary = (itinerary: Itinerary) => {
    setItineraryToEdit(itinerary);
    setIsItineraryModalOpen(true);
  };

  const handleOpenCreateCategory = () => {
    setCategoryToEdit(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ItineraryCategory) => {
    setCategoryToEdit(cat);
    setIsCategoryModalOpen(true);
  };

  const handleDuplicate = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/admin/itineraries/${id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Roteiro "${title}" duplicado.`);
        fetchData(false);
      } else {
        showToast(data.error || 'Erro ao duplicar roteiro', 'error');
      }
    } catch (e: any) {
      showToast('Erro ao duplicar: ' + e.message, 'error');
    }
  };

  const handleToggleFeatured = async (id: string) => {
    const current = itineraries.find((it) => it.id === id);
    const nextFeatured = !current?.isFeatured;
    try {
      await toggleItineraryFeaturedInSupabase(id, nextFeatured);
      setItineraries((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, isFeatured: nextFeatured, isRecommended: nextFeatured } : it
        )
      );
      showToast(
        nextFeatured ? 'Roteiro destacado na Loja.' : 'Roteiro removido dos destaques.'
      );
    } catch (e: any) {
      showToast('Erro ao alterar destaque: ' + e.message, 'error');
    }
  };

  const handleTogglePremium = async (id: string) => {
    const current = itineraries.find((it) => it.id === id);
    const nextPremium = !current?.isPremium;
    try {
      await toggleItineraryPremiumInSupabase(id, nextPremium);
      setItineraries((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                isPremium: nextPremium,
                platanosPrice: nextPremium ? 15 : 0,
                price: nextPremium ? '15 Plátanos' : 'Grátis',
                badgeText: nextPremium ? '15 Plátanos' : 'Grátis',
                showBadge: nextPremium,
              }
            : it
        )
      );
      showToast(
        nextPremium
          ? 'Acesso alterado para Pago (15 Plátanos).'
          : 'Acesso alterado para Grátis.'
      );
    } catch (e: any) {
      showToast('Erro ao alterar acesso: ' + e.message, 'error');
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: ItineraryStatus) => {
    try {
      await toggleItineraryStatusInSupabase(id, newStatus);
      setItineraries((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: newStatus, isActive: newStatus === 'published' } : it
        )
      );
      showToast(
        `Status atualizado para ${
          newStatus === 'published'
            ? 'Publicado'
            : newStatus === 'draft'
              ? 'Rascunho'
              : 'Oculto'
        }.`
      );
    } catch (e: any) {
      showToast('Erro ao alterar status: ' + e.message, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      if (pendingDelete.type === 'itinerary') {
        await deleteItineraryFromSupabase(pendingDelete.id);
        setItineraries((prev) => prev.filter((it) => it.id !== pendingDelete.id));
        showToast(`Roteiro "${pendingDelete.title}" excluído.`);
      } else {
        const res = await fetch(`/api/admin/itinerary-categories/${pendingDelete.id}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          setCategories((prev) => prev.filter((c) => c.id !== pendingDelete.id));
          showToast(`Categoria "${pendingDelete.title}" excluída.`);
        } else {
          showToast(data.error || 'Erro ao excluir categoria', 'error');
        }
      }
      setPendingDelete(null);
    } catch (e: any) {
      showToast('Erro ao excluir: ' + e.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleCategoryActive = async (cat: ItineraryCategory) => {
    try {
      const nextActive = !cat.isActive;
      const res = await fetch(`/api/admin/itinerary-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, isActive: nextActive } : c))
        );
        showToast(
          nextActive ? `Categoria "${cat.name}" ativada.` : `Categoria "${cat.name}" desativada.`
        );
      }
    } catch (e: any) {
      showToast('Erro: ' + e.message, 'error');
    }
  };

  // Filtered itineraries
  const filteredItineraries = itineraries.filter((it) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      it.title.toLowerCase().includes(q) ||
      (it.description || '').toLowerCase().includes(q) ||
      (it.price || '').toLowerCase().includes(q) ||
      (it.categories || []).some((c) => c.toLowerCase().includes(q));

    const currentStatus = it.status || (it.isActive ? 'published' : 'draft');
    const matchesStatus = statusFilter === 'all' ? true : currentStatus === statusFilter;

    const matchesDays =
      daysFilter === 'all'
        ? true
        : daysFilter === 3
          ? it.daysCount >= 3
          : it.daysCount === daysFilter;

    return matchesSearch && matchesStatus && matchesDays;
  });

  // Metrics
  const totalItineraries = itineraries.length;
  const publishedItineraries = itineraries.filter(
    (it) => it.status === 'published' || (!it.status && it.isActive)
  ).length;
  const draftItineraries = itineraries.filter(
    (it) => it.status === 'draft' || it.status === 'hidden' || (!it.status && !it.isActive)
  ).length;
  const featuredCount = itineraries.filter((it) => it.isFeatured || it.isRecommended).length;
  const activeCategoriesCount = categories.filter((c) => c.isActive).length;

  const sectionTabs: Array<{
    id: 'itineraries' | 'categories' | 'featured';
    label: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'itineraries',
      label: 'Roteiros',
      count: totalItineraries,
      icon: <ShoppingBag className="w-[15px] h-[15px] stroke-[2]" />,
    },
    {
      id: 'categories',
      label: 'Categorias',
      count: categories.length,
      icon: <Tag className="w-[15px] h-[15px] stroke-[2]" />,
    },
    {
      id: 'featured',
      label: 'Destaques',
      count: featuredCount,
      icon: <Sparkles className="w-[15px] h-[15px] stroke-[2]" />,
    },
  ];

  return (
    <div
      className="space-y-4 sm:space-y-5"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Toast Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className={`fixed bottom-24 md:bottom-6 right-4 sm:right-6 z-[9998] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-[12.5px] font-semibold border ${
              toast.type === 'success'
                ? 'bg-[#111318] text-white border-white/10'
                : 'bg-[#B91C1C] text-white border-red-400/20'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean Minimal Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3.5 pt-0.5">
        <div className="max-w-xl">
          <h1 className="text-[30px] sm:text-[34px] font-bold text-[#181C23] tracking-[-0.035em] leading-[1.08]">
            Loja de Roteiros
          </h1>
          <p className="text-[14px] sm:text-[15px] font-normal text-[#6B7280] leading-[1.4] mt-1.5">
            Gerencie roteiros turísticos, acessos, paradas e destaques da loja.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            aria-label="Atualizar lista de roteiros"
            className="h-[42px] w-[42px] sm:w-auto sm:px-4 rounded-full bg-white border border-black/[0.06] text-[13px] font-semibold text-[#181C23] inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all disabled:opacity-60"
            style={{ boxShadow: PILL_SHADOW }}
          >
            <RefreshCw className={`w-4 h-4 text-[#374151] ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </span>
          </button>

          {activeAdminTab === 'categories' ? (
            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="h-[42px] px-4 sm:px-5 rounded-full bg-[#111318] hover:bg-[#1F232B] active:scale-[0.98] text-white font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 shadow-[0_6px_18px_-4px_rgba(17,19,24,0.32)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.4]" />
              <span>Criar Categoria</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenCreateItinerary}
              className="h-[42px] px-4 sm:px-5 rounded-full bg-[#111318] hover:bg-[#1F232B] active:scale-[0.98] text-white font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 shadow-[0_6px_18px_-4px_rgba(17,19,24,0.32)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.4]" />
              <span>Criar Roteiro</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact KPI Metrics Row (2x2 mobile, 4 cols desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className="rounded-[22px] bg-white border border-black/[0.04] p-3.5 flex items-center gap-3"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="w-10 h-10 rounded-full bg-[#E7F6EC] text-[#15803D] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-[18px] h-[18px] stroke-[2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[21px] sm:text-[23px] font-bold text-[#181C23] tracking-[-0.03em] leading-none tabular-nums">
              {loading ? '—' : publishedItineraries}
            </span>
            <span className="block text-[12px] text-[#6B7280] font-medium mt-1 truncate">
              Publicados
            </span>
          </div>
        </div>

        <div
          className="rounded-[22px] bg-white border border-black/[0.04] p-3.5 flex items-center gap-3"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="w-10 h-10 rounded-full bg-[#F2F3F5] text-[#374151] flex items-center justify-center shrink-0">
            <Clock className="w-[18px] h-[18px] stroke-[2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[21px] sm:text-[23px] font-bold text-[#181C23] tracking-[-0.03em] leading-none tabular-nums">
              {loading ? '—' : draftItineraries}
            </span>
            <span className="block text-[12px] text-[#6B7280] font-medium mt-1 truncate">
              Rascunhos / Ocultos
            </span>
          </div>
        </div>

        <div
          className="rounded-[22px] bg-white border border-black/[0.04] p-3.5 flex items-center gap-3"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="w-10 h-10 rounded-full bg-[#EFF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
            <Sparkles className="w-[18px] h-[18px] stroke-[2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[21px] sm:text-[23px] font-bold text-[#181C23] tracking-[-0.03em] leading-none tabular-nums">
              {loading ? '—' : featuredCount}
            </span>
            <span className="block text-[12px] text-[#6B7280] font-medium mt-1 truncate">
              Em destaque
            </span>
          </div>
        </div>

        <div
          className="rounded-[22px] bg-white border border-black/[0.04] p-3.5 flex items-center gap-3"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="w-10 h-10 rounded-full bg-[#F2F3F5] text-[#374151] flex items-center justify-center shrink-0">
            <Tag className="w-[18px] h-[18px] stroke-[2]" />
          </div>
          <div className="min-w-0">
            <span className="block text-[21px] sm:text-[23px] font-bold text-[#181C23] tracking-[-0.03em] leading-none tabular-nums">
              {loading ? '—' : activeCategoriesCount}
            </span>
            <span className="block text-[12px] text-[#6B7280] font-medium mt-1 truncate">
              Categorias ativas
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Section Tabs (Matching AdminItineraryModal style) */}
      <div className="border-b border-black/[0.06]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {sectionTabs.map((tab) => {
            const isSelected = activeAdminTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveAdminTab(tab.id)}
                className={`relative px-3.5 py-3 text-[13.5px] font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected ? 'text-[#111827]' : 'text-[#858585] hover:text-[#374151]'
                }`}
              >
                <span className={isSelected ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}>{tab.icon}</span>
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-bold leading-none tabular-nums ${
                    isSelected
                      ? 'bg-[#2563EB]/12 text-[#2563EB]'
                      : 'bg-[#ECEEF2] text-[#4B5563]'
                  }`}
                >
                  {tab.count}
                </span>
                {isSelected && (
                  <motion.span
                    layoutId="admin-itineraries-section-tab-line"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[#2563EB]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          TAB 1: ROTEIROS DA LOJA
         ==================================================================== */}
      {activeAdminTab === 'itineraries' && (
        <div className="space-y-4">
          {/* Compact Search & Filter Row */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Pill Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar roteiro por nome, preço ou categoria..."
                  className="w-full h-[44px] pl-10 pr-9 bg-white border border-black/[0.06] rounded-full text-[13.5px] text-[#111827] font-medium placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/12 transition-all"
                  style={{ boxShadow: PILL_SHADOW }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpar pesquisa"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F2F3F5] text-[#4B5563] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { label: 'Todos', value: 'all' as const },
                  { label: 'Publicados', value: 'published' as const },
                  { label: 'Rascunhos', value: 'draft' as const },
                  { label: 'Ocultos', value: 'hidden' as const },
                ].map((s) => {
                  const isSelected = statusFilter === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatusFilter(s.value)}
                      className={`h-[36px] px-3.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-[0.97] border ${
                        isSelected
                          ? 'bg-[#111318] text-white border-[#111318]'
                          : 'bg-white text-[#4B5563] border-black/[0.06] hover:border-black/[0.14]'
                      }`}
                      style={isSelected ? undefined : { boxShadow: PILL_SHADOW }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact Duration Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[12px] text-[#858585] font-medium mr-1 shrink-0">
                Duração:
              </span>
              {[
                { label: 'Todas', value: 'all' as const },
                { label: '1 Dia', value: 1 },
                { label: '2 Dias', value: 2 },
                { label: '3+ Dias', value: 3 },
              ].map((item, idx) => {
                const isSelected = daysFilter === item.value;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDaysFilter(item.value)}
                    className={`h-[30px] px-3 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-[#2563EB]/10 text-[#1D4ED8] border-[#2563EB]'
                        : 'bg-white text-[#4B5563] border-black/[0.06] hover:border-black/[0.14]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Itinerary Cards Grid */}
          {loading ? (
            <div className="py-16 text-center flex flex-col items-center gap-2.5">
              <RefreshCw className="w-6 h-6 text-[#2563EB] animate-spin" />
              <p className="text-[13px] text-[#6B7280] font-medium">Carregando roteiros...</p>
            </div>
          ) : filteredItineraries.length === 0 ? (
            <div
              className="py-14 px-6 text-center rounded-[26px] bg-white border border-dashed border-[#D8DCE3] flex flex-col items-center gap-2.5"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <span className="w-12 h-12 rounded-full bg-[#F2F3F5] text-[#6B7280] flex items-center justify-center">
                <Compass className="w-6 h-6 stroke-[1.8]" />
              </span>
              <h3 className="text-[15.5px] font-bold text-[#111827]">
                Nenhum roteiro encontrado
              </h3>
              <p className="text-[13px] text-[#6B7280] max-w-sm">
                Crie um novo roteiro ou ajuste os filtros para visualizar a loja.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateItinerary}
                className="mt-2 h-[42px] px-5 rounded-full bg-[#111318] hover:bg-[#1F232B] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.4]" />
                <span>Criar Roteiro</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItineraries.map((it) => {
                const placesCount =
                  it.placesCount ||
                  it.days?.reduce((acc, d) => acc + (d.steps?.length || 0), 0) ||
                  0;
                const itStatus = it.status || (it.isActive ? 'published' : 'draft');
                const isFeaturedActive = Boolean(it.isFeatured || it.isRecommended);
                const isPaid = Boolean(it.isPremium);

                return (
                  <div
                    key={it.id}
                    className="rounded-[24px] bg-white border border-black/[0.05] overflow-hidden flex flex-col justify-between transition-all hover:shadow-[0_12px_30px_-8px_rgba(15,23,42,0.10)]"
                    style={{ boxShadow: CARD_SHADOW }}
                  >
                    <div>
                      {/* Clean Cover Photo Header */}
                      <div
                        onClick={() => handleOpenEditItinerary(it)}
                        className="relative aspect-[16/10] w-full bg-[#F2F3F5] overflow-hidden cursor-pointer group"
                      >
                        <img
                          src={it.coverImage}
                          alt={it.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15" />

                        {/* Top Row: Duration/Stops + Featured Star */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/55 backdrop-blur-md text-white inline-flex items-center gap-1.5 tabular-nums">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {it.daysCount} {it.daysCount === 1 ? 'dia' : 'dias'}
                            </span>
                            <span className="text-white/50">·</span>
                            <MapPin className="w-3 h-3" />
                            <span>
                              {placesCount} {placesCount === 1 ? 'parada' : 'paradas'}
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFeatured(it.id);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                              isFeaturedActive
                                ? 'bg-white text-[#111827] shadow-md'
                                : 'bg-black/45 backdrop-blur-md text-white/85 hover:bg-black/65'
                            }`}
                            title={
                              isFeaturedActive
                                ? 'Remover dos destaques da loja'
                                : 'Destacar na loja'
                            }
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isFeaturedActive ? 'fill-[#F59E0B] text-[#F59E0B]' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Bottom-Right Access Pill (Clickable quick toggle Grátis / 15 Plátanos) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePremium(it.id);
                          }}
                          title="Alternar entre Grátis e 15 Plátanos"
                          className={`absolute bottom-3 right-3 px-2.5 py-1 rounded-full backdrop-blur-md text-[11px] font-semibold inline-flex items-center gap-1 transition-transform active:scale-95 cursor-pointer ${
                            isPaid
                              ? 'bg-[#111318]/85 text-white'
                              : 'bg-[#E7F6EC]/95 text-[#15803D]'
                          }`}
                        >
                          {isPaid && (
                            <PlatanoLeafIcon className="w-3.5 h-3.5" variant="monochrome" />
                          )}
                          <span>{isPaid ? '15 Plátanos' : 'Grátis'}</span>
                        </button>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            onClick={() => handleOpenEditItinerary(it)}
                            className="text-[15.5px] font-bold text-[#111827] tracking-[-0.015em] leading-snug line-clamp-1 cursor-pointer hover:text-[#2563EB] transition-colors"
                          >
                            {it.title}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0 ${
                              itStatus === 'published'
                                ? 'bg-[#E7F6EC] text-[#15803D]'
                                : itStatus === 'draft'
                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                  : 'bg-[#F2F3F5] text-[#4B5563]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                itStatus === 'published'
                                  ? 'bg-[#22C55E]'
                                  : itStatus === 'draft'
                                    ? 'bg-[#D97706]'
                                    : 'bg-[#6B7280]'
                              }`}
                            />
                            {itStatus === 'published'
                              ? 'Publicado'
                              : itStatus === 'draft'
                                ? 'Rascunho'
                                : 'Oculto'}
                          </span>
                        </div>

                        <p className="text-[12.5px] text-[#6B7280] line-clamp-2 leading-relaxed">
                          {it.description || 'Roteiro turístico exclusivo em Campos do Jordão.'}
                        </p>

                        {Array.isArray(it.categories) && it.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {it.categories.slice(0, 3).map((cId, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F2F3F5] text-[#374151]"
                              >
                                {cId}
                              </span>
                            ))}
                            {it.categories.length > 3 && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F2F3F5] text-[#6B7280]">
                                +{it.categories.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Clean Compact Actions Footer */}
                    <div className="px-4 py-3 border-t border-[#F2F3F5] flex items-center justify-between gap-2">
                      <select
                        value={itStatus}
                        onChange={(e) =>
                          handleQuickStatusChange(it.id, e.target.value as ItineraryStatus)
                        }
                        aria-label={`Status do roteiro ${it.title}`}
                        className="h-8 px-3 rounded-full bg-[#F5F6F8] hover:bg-[#ECEEF2] text-[#111827] text-[12px] font-semibold border border-black/[0.04] outline-none cursor-pointer transition-colors"
                      >
                        <option value="published">Publicado</option>
                        <option value="draft">Rascunho</option>
                        <option value="hidden">Oculto</option>
                      </select>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(it.id, it.title)}
                          className="w-8 h-8 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#4B5563] hover:text-[#111827] flex items-center justify-center transition-colors cursor-pointer"
                          title="Duplicar roteiro"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditItinerary(it)}
                          className="h-8 px-3 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#111827] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Editar roteiro"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({ type: 'itinerary', id: it.id, title: it.title })
                          }
                          className="w-8 h-8 rounded-full bg-[#FCECEC] hover:bg-[#FADADA] text-[#B91C1C] flex items-center justify-center transition-colors cursor-pointer"
                          title="Excluir roteiro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 2: CATEGORIAS DA LOJA
         ==================================================================== */}
      {activeAdminTab === 'categories' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-[#6B7280] font-medium">
              Filtros exibidos horizontalmente na Loja de Roteiros.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="h-9 px-4 rounded-full bg-[#111318] hover:bg-[#1F232B] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>Nova Categoria</span>
            </button>
          </div>

          <div
            className="rounded-[24px] bg-white border border-black/[0.05] overflow-hidden divide-y divide-[#F0F1F4]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            {categories.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#6B7280]">
                Nenhuma categoria cadastrada.
              </div>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-[#FAFAFB] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#F2F3F5] text-[#111827] flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14.5px] font-bold text-[#111827] truncate">
                          {cat.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                            cat.isActive
                              ? 'bg-[#E7F6EC] text-[#15803D]'
                              : 'bg-[#F2F3F5] text-[#6B7280]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cat.isActive ? 'bg-[#22C55E]' : 'bg-[#9CA3AF]'
                            }`}
                          />
                          {cat.isActive ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors cursor-pointer ${
                        cat.isActive
                          ? 'bg-[#F2F3F5] text-[#4B5563] hover:bg-[#E5E7EB]'
                          : 'bg-[#E7F6EC] text-[#15803D] hover:bg-[#D5EEDF]'
                      }`}
                    >
                      {cat.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCategory(cat)}
                      className="w-8 h-8 rounded-full bg-[#F5F6F8] hover:bg-[#EAECEF] text-[#4B5563] hover:text-[#111827] flex items-center justify-center cursor-pointer transition-colors"
                      title="Editar categoria"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({ type: 'category', id: cat.id, title: cat.name })
                      }
                      className="w-8 h-8 rounded-full bg-[#FCECEC] hover:bg-[#FADADA] text-[#B91C1C] flex items-center justify-center cursor-pointer transition-colors"
                      title="Excluir categoria"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: DESTAQUES DA LOJA
         ==================================================================== */}
      {activeAdminTab === 'featured' && (
        <div className="space-y-3.5">
          <p className="text-[13px] text-[#6B7280] font-medium">
            Ative os roteiros que aparecem no topo da loja em &quot;Roteiros em destaque&quot;.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itineraries.map((it) => {
              const isFeat = Boolean(it.isFeatured || it.isRecommended);
              const placesCount =
                it.placesCount ||
                it.days?.reduce((acc, d) => acc + (d.steps?.length || 0), 0) ||
                0;

              return (
                <div
                  key={it.id}
                  className={`p-3 rounded-[20px] border transition-all flex items-center justify-between gap-3 ${
                    isFeat
                      ? 'bg-white border-[#2563EB]/45 ring-1 ring-[#2563EB]/12'
                      : 'bg-white border-black/[0.05] opacity-80'
                  }`}
                  style={{ boxShadow: CARD_SHADOW }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={it.coverImage}
                      alt={it.title}
                      loading="lazy"
                      className="w-12 h-12 rounded-[14px] object-cover shrink-0 bg-[#F2F3F5] border border-black/[0.04]"
                    />
                    <div className="min-w-0">
                      <h4 className="text-[13.5px] font-bold text-[#111827] truncate">
                        {it.title}
                      </h4>
                      <p className="text-[11.5px] text-[#6B7280] font-medium mt-0.5 tabular-nums">
                        {it.daysCount} {it.daysCount === 1 ? 'dia' : 'dias'} · {placesCount}{' '}
                        {placesCount === 1 ? 'parada' : 'paradas'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isFeat}
                    onClick={() => handleToggleFeatured(it.id)}
                    aria-label={isFeat ? 'Remover destaque' : 'Destacar roteiro'}
                    className={`w-[46px] h-[27px] rounded-full transition-colors duration-200 relative shrink-0 cursor-pointer ${
                      isFeat ? 'bg-[#22C55E]' : 'bg-[#E2E5EA]'
                    }`}
                  >
                    <span
                      className={`block w-[21px] h-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 ${
                        isFeat ? 'translate-x-[22px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CRUD Modals */}
      <AdminItineraryModal
        isOpen={isItineraryModalOpen}
        onClose={() => setIsItineraryModalOpen(false)}
        onSaved={() => fetchData(false)}
        itineraryToEdit={itineraryToEdit}
        categories={categories}
      />

      <AdminItineraryCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaved={() => fetchData(false)}
        categoryToEdit={categoryToEdit}
      />

      {/* Native iOS Portalized Delete Confirmation Modal */}
      {typeof document !== 'undefined' &&
        pendingDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[6px]"
            onClick={() => {
              if (!isDeleting) setPendingDelete(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.06]"
            >
              <div className="w-11 h-11 rounded-full bg-[#FCECEC] text-[#B91C1C] flex items-center justify-center mb-4">
                <Trash2 className="w-5 h-5 stroke-[2]" />
              </div>

              <h3 className="text-[18px] font-bold text-[#111827] tracking-[-0.02em]">
                {pendingDelete.type === 'itinerary' ? 'Excluir Roteiro' : 'Excluir Categoria'}
              </h3>

              <p className="text-[13px] text-[#6B7280] mt-2 leading-relaxed">
                Tem certeza que deseja excluir permanentemente{' '}
                <span className="font-semibold text-[#111827]">&quot;{pendingDelete.title}&quot;</span>?
                Esta ação não pode ser desfeita.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setPendingDelete(null)}
                  className="h-[46px] px-4 rounded-full bg-[#F2F3F5] hover:bg-[#E5E7EB] text-[13.5px] font-semibold text-[#111827] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="h-[46px] px-4 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] text-[13.5px] font-semibold text-white transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
