import React, { useState, useEffect } from 'react';
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
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  ChevronRight,
  Tag,
  Star,
  EyeOff,
  ShoppingBag,
  Layers
} from 'lucide-react';
import { Itinerary, ItineraryCategory, ItineraryStatus } from '../../types';
import { AdminItineraryModal } from './AdminItineraryModal';
import { AdminItineraryCategoryModal } from './AdminItineraryCategoryModal';

export const AdminItineraries: React.FC = () => {
  const [activeAdminTab, setActiveAdminTab] = useState<'itineraries' | 'categories' | 'featured'>('itineraries');
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [categories, setCategories] = useState<ItineraryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'hidden'>('all');
  const [daysFilter, setDaysFilter] = useState<number | 'all'>('all');

  // Modal States
  const [isItineraryModalOpen, setIsItineraryModalOpen] = useState(false);
  const [itineraryToEdit, setItineraryToEdit] = useState<Itinerary | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ItineraryCategory | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itinRes, catRes] = await Promise.all([
        fetch('/api/itineraries?all=true'),
        fetch('/api/itinerary-categories?all=true')
      ]);

      const itinData = await itinRes.json();
      const catData = await catRes.json();

      if (itinData.success && Array.isArray(itinData.itineraries)) {
        setItineraries(itinData.itineraries);
      }
      if (catData.success && Array.isArray(catData.categories)) {
        setCategories(catData.categories);
      }
    } catch (err: any) {
      showToast('Erro ao carregar dados: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Roteiro "${title}" duplicado com sucesso!`);
        fetchData();
      } else {
        showToast(data.error || 'Erro ao duplicar roteiro', 'error');
      }
    } catch (e: any) {
      showToast('Erro ao duplicar: ' + e.message, 'error');
    }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/itineraries/${id}/featured`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (data.success) {
        setItineraries(prev =>
          prev.map(it => (it.id === id ? { ...it, isFeatured: data.isFeatured, isRecommended: data.isFeatured } : it))
        );
        showToast(data.isFeatured ? 'Roteiro adicionado aos destaques da Loja!' : 'Roteiro removido dos destaques.');
      } else {
        showToast(data.error || 'Erro ao alterar destaque', 'error');
      }
    } catch (e: any) {
      showToast('Erro: ' + e.message, 'error');
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: ItineraryStatus) => {
    try {
      const res = await fetch(`/api/admin/itineraries/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setItineraries(prev =>
          prev.map(it => (it.id === id ? { ...it, status: newStatus, isActive: newStatus === 'published' } : it))
        );
        showToast(`Status alterado para ${newStatus === 'published' ? 'Publicado' : newStatus === 'draft' ? 'Rascunho' : 'Oculto'}`);
      }
    } catch (e: any) {
      showToast('Erro ao alterar status: ' + e.message, 'error');
    }
  };

  const handleDeleteItinerary = async (id: string, title: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o roteiro "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/itineraries/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setItineraries(prev => prev.filter(it => it.id !== id));
        showToast(`Roteiro "${title}" excluído.`);
      } else {
        showToast(data.error || 'Erro ao excluir roteiro', 'error');
      }
    } catch (e: any) {
      showToast('Erro ao excluir: ' + e.message, 'error');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Excluir a categoria "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/itinerary-categories/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => prev.filter(c => c.id !== id));
        showToast(`Categoria "${name}" excluída.`);
      } else {
        showToast(data.error || 'Erro ao excluir categoria', 'error');
      }
    } catch (e: any) {
      showToast('Erro: ' + e.message, 'error');
    }
  };

  const handleToggleCategoryActive = async (cat: ItineraryCategory) => {
    try {
      const nextActive = !cat.isActive;
      const res = await fetch(`/api/admin/itinerary-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive })
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev =>
          prev.map(c => (c.id === cat.id ? { ...c, isActive: nextActive } : c))
        );
        showToast(nextActive ? `Categoria "${cat.name}" ativada.` : `Categoria "${cat.name}" desativada.`);
      }
    } catch (e: any) {
      showToast('Erro: ' + e.message, 'error');
    }
  };

  // Filtered itineraries
  const filteredItineraries = itineraries.filter(it => {
    const matchesSearch =
      it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const currentStatus = it.status || (it.isActive ? 'published' : 'draft');
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : currentStatus === statusFilter;

    const matchesDays =
      daysFilter === 'all' ? true : it.daysCount === daysFilter;

    return matchesSearch && matchesStatus && matchesDays;
  });

  // Featured list
  const featuredItineraries = itineraries.filter(it => it.isFeatured || it.isRecommended);

  // Metrics
  const totalItineraries = itineraries.length;
  const publishedItineraries = itineraries.filter(it => (it.status === 'published' || (!it.status && it.isActive))).length;
  const draftItineraries = itineraries.filter(it => it.status === 'draft' || (!it.status && !it.isActive)).length;
  const featuredCount = featuredItineraries.length;

  return (
    <div className="space-y-6" style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Toast Feedback */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold ${
              toast.type === 'success'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border border-white/10'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#007AFF]" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Loja de Roteiros
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#007AFF]/15 text-[#007AFF] text-[10px] font-black uppercase tracking-wider border border-[#007AFF]/25">
              Administração
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-semibold mt-0.5">
            Gerencie os roteiros turísticos, preços, paradas organizadas e categorias da loja do Monvian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeAdminTab === 'categories' ? (
            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#007AFF] hover:bg-blue-600 text-white font-black text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Criar Categoria</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenCreateItinerary}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#007AFF] hover:bg-blue-600 text-white font-black text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Criar Roteiro</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveAdminTab('itineraries')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeAdminTab === 'itineraries'
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Roteiros da Loja ({totalItineraries})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('categories')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeAdminTab === 'categories'
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Categorias da Loja ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('featured')}
          className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeAdminTab === 'featured'
              ? 'border-[#007AFF] text-[#007AFF]'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Destaques da Loja ({featuredCount})</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Roteiros Publicados
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {publishedItineraries}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">
              na loja ativa
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Rascunhos / Ocultos
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-500">
              {draftItineraries}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">
              em edição
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Roteiros em Destaque
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#007AFF]">
              {featuredCount}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">
              no carrossel
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Categorias Ativas
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-white">
              {categories.filter(c => c.isActive).length}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">
              de {categories.length} totais
            </span>
          </div>
        </div>
      </div>

      {/* TAB 1: ROTEIROS DA LOJA */}
      {activeAdminTab === 'itineraries' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar roteiro por nome, preço ou categoria..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white font-semibold focus:outline-hidden focus:border-[#007AFF]"
                />
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {[
                  { label: 'Todos', value: 'all' as const },
                  { label: 'Publicados', value: 'published' as const },
                  { label: 'Rascunhos', value: 'draft' as const },
                  { label: 'Ocultos', value: 'hidden' as const },
                ].map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatusFilter(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      statusFilter === s.value
                        ? 'bg-[#007AFF] text-white shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Days Filters */}
            <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 overflow-x-auto text-xs">
              <span className="text-zinc-500 font-bold shrink-0">Duração:</span>
              {[
                { label: 'Todas as durações', value: 'all' as const },
                { label: '1 Dia', value: 1 },
                { label: '2 Dias', value: 2 },
                { label: '3+ Dias', value: 3 },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setDaysFilter(item.value)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 cursor-pointer transition-colors ${
                    daysFilter === item.value
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Itineraries */}
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-zinc-500 font-bold">Carregando roteiros...</p>
            </div>
          ) : filteredItineraries.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl bg-white dark:bg-[#121418] p-6 space-y-3">
              <Compass className="w-10 h-10 text-zinc-400 mx-auto" />
              <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                Nenhum roteiro encontrado
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium">
                Crie um novo roteiro para abastecer a Loja de Roteiros Turísticos.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateItinerary}
                className="px-4 py-2 rounded-xl bg-[#007AFF] text-white text-xs font-black shadow-md cursor-pointer hover:bg-blue-600"
              >
                + Criar Roteiro Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItineraries.map(it => {
                const placesCount = it.placesCount || it.days?.reduce((acc, d) => acc + (d.steps?.length || 0), 0) || 0;
                const itStatus = it.status || (it.isActive ? 'published' : 'draft');
                const isFeaturedActive = it.isFeatured || it.isRecommended;

                return (
                  <div
                    key={it.id}
                    className="bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Image & Overlay Badges */}
                      <div className="relative aspect-16/9 w-full bg-zinc-900 overflow-hidden">
                        <img
                          src={it.coverImage}
                          alt={it.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-black/70 backdrop-blur-md text-white border border-white/10 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#007AFF]" />
                            <span>{it.daysCount} {it.daysCount === 1 ? 'Dia' : 'Dias'}</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Star featured toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleFeatured(it.id)}
                              className={`p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                                isFeaturedActive
                                  ? 'bg-amber-400 text-zinc-900 shadow-md'
                                  : 'bg-black/60 text-white/70 hover:text-white'
                              }`}
                              title={isFeaturedActive ? 'Remover dos destaques da loja' : 'Destacar na loja'}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFeaturedActive ? 'fill-current' : ''}`} />
                            </button>

                            {/* Status badge */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                itStatus === 'published'
                                  ? 'bg-emerald-500 text-white'
                                  : itStatus === 'draft'
                                  ? 'bg-amber-500 text-zinc-900'
                                  : 'bg-zinc-600 text-white'
                              }`}
                            >
                              {itStatus === 'published' ? 'Publicado' : itStatus === 'draft' ? 'Rascunho' : 'Oculto'}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Info on Image */}
                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px] font-bold">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#007AFF]" />
                            <span>{placesCount} {placesCount === 1 ? 'parada' : 'paradas'}</span>
                          </div>

                          <div className="px-2 py-0.5 rounded-md bg-[#007AFF] text-white font-black text-xs shadow-xs">
                            {it.price || 'R$ 14,90'}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2">
                        <h3 className="font-black text-sm text-zinc-900 dark:text-white line-clamp-1">
                          {it.title}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium line-clamp-2 leading-relaxed">
                          {it.description || 'Roteiro turístico exclusivo em Campos do Jordão.'}
                        </p>

                        {/* Category Tags */}
                        {Array.isArray(it.categories) && it.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {it.categories.map((cId, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              >
                                {cId}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-[#15171d]">
                      {/* Status Selector dropdown */}
                      <select
                        value={itStatus}
                        onChange={e => handleQuickStatusChange(it.id, e.target.value as ItineraryStatus)}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-none cursor-pointer"
                      >
                        <option value="published">Publicado</option>
                        <option value="draft">Rascunho</option>
                        <option value="hidden">Oculto</option>
                      </select>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(it.id, it.title)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Duplicar roteiro"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditItinerary(it)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Editar roteiro"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItinerary(it.id, it.title)}
                          className="p-1.5 text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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

      {/* TAB 2: CATEGORIAS DA LOJA */}
      {activeAdminTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 font-semibold">
              Filtros e categorias exibidos horizontalmente na Loja de Roteiros.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateCategory}
              className="px-3.5 py-1.5 rounded-xl bg-[#007AFF] text-white text-xs font-black flex items-center gap-1.5 shadow-sm hover:bg-blue-600 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Nova Categoria</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#007AFF]/15 text-[#007AFF] flex items-center justify-center font-bold">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-zinc-900 dark:text-white">
                          {cat.name}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400">
                          (id: {cat.id})
                        </span>
                        {cat.isActive ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                            Ativa na Loja
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-500/15 text-zinc-500 text-[10px] font-bold">
                            Inativa
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 font-medium">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryActive(cat)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        cat.isActive
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                          : 'bg-emerald-500/20 text-emerald-600'
                      }`}
                    >
                      {cat.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCategory(cat)}
                      className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      title="Editar categoria"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-2 text-zinc-500 hover:text-red-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      title="Excluir categoria"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DESTAQUES DA LOJA */}
      {activeAdminTab === 'featured' && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 font-semibold">
            Roteiros que aparecem no carrossel de topo "Roteiros em destaque" na Loja de Roteiros. Toque na estrela para destacar ou remover.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {itineraries.map(it => {
              const isFeat = it.isFeatured || it.isRecommended;

              return (
                <div
                  key={it.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isFeat
                      ? 'bg-white dark:bg-[#121418] border-[#007AFF] shadow-sm'
                      : 'bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={it.coverImage}
                      alt={it.title}
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate">
                        {it.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-bold">
                        {it.price || 'R$ 14,90'} · {it.daysCount} {it.daysCount === 1 ? 'dia' : 'dias'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(it.id)}
                    className={`p-2 rounded-xl cursor-pointer transition-colors ${
                      isFeat
                        ? 'bg-amber-400 text-zinc-900'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                    title={isFeat ? 'Remover destaque' : 'Destacar roteiro'}
                  >
                    <Star className={`w-4 h-4 ${isFeat ? 'fill-current' : ''}`} />
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
        onSaved={fetchData}
        itineraryToEdit={itineraryToEdit}
        categories={categories}
      />

      <AdminItineraryCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaved={fetchData}
        categoryToEdit={categoryToEdit}
      />
    </div>
  );
};
