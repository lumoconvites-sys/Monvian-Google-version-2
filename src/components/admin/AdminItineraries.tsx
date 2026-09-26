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
  Tag
} from 'lucide-react';
import { Itinerary, ItineraryCategory } from '../../types';
import { AdminItineraryModal } from './AdminItineraryModal';

export const AdminItineraries: React.FC = () => {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [categories, setCategories] = useState<ItineraryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [daysFilter, setDaysFilter] = useState<number | 'all'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itineraryToEdit, setItineraryToEdit] = useState<Itinerary | null>(null);

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
      showToast('Erro ao carregar roteiros: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setItineraryToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (itinerary: Itinerary) => {
    setItineraryToEdit(itinerary);
    setIsModalOpen(true);
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

  const handleToggleStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/itineraries/${id}/toggle-status`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (data.success) {
        setItineraries(prev =>
          prev.map(it => (it.id === id ? { ...it, isActive: data.isActive } : it))
        );
        showToast(data.isActive ? 'Roteiro ativado com sucesso!' : 'Roteiro desativado.');
      } else {
        showToast(data.error || 'Erro ao alterar status', 'error');
      }
    } catch (e: any) {
      showToast('Erro ao alterar status: ' + e.message, 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
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

  // Filtered list
  const filteredItineraries = itineraries.filter(it => {
    const matchesSearch =
      it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? it.isActive
        : !it.isActive;

    const matchesDays =
      daysFilter === 'all' ? true : it.daysCount === daysFilter;

    return matchesSearch && matchesStatus && matchesDays;
  });

  // Analytics Metrics
  const totalItineraries = itineraries.length;
  const activeItineraries = itineraries.filter(it => it.isActive).length;
  const totalUsersUsed = itineraries.reduce((acc, it) => acc + (it.usageCount || 0), 0);
  const avgPlacesPerItinerary = totalItineraries > 0
    ? Math.round(itineraries.reduce((acc, it) => acc + (it.placesCount || 0), 0) / totalItineraries)
    : 0;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
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
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Gestão de Roteiros
          </h1>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-400 font-medium">
            Gerencie os roteiros turísticos oficiais de Campos do Jordão disponibilizados aos turistas.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-xs hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Roteiro</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Roteiros Ativos
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-white">
              {activeItineraries}
            </span>
            <span className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">
              de {totalItineraries} cadastrados
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Turistas que Utilizaram
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-white">
              {totalUsersUsed.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">
              usos totais
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Média de Lugares / Roteiro
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-white">
              {avgPlacesPerItinerary}
            </span>
            <span className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">
              pontos por viagem
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Categorias de Turismo
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 dark:text-white">
              {categories.length}
            </span>
            <span className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">
              estilos cadastrados
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#121418] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-700 dark:text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar roteiro por nome, descrição ou categoria..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-zinc-500 placeholder:text-zinc-700 dark:placeholder:text-zinc-400"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === 'active'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Ativos ({activeItineraries})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Inativos ({totalItineraries - activeItineraries})
            </button>
          </div>
        </div>

        {/* Duration filters */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 overflow-x-auto text-xs">
          <span className="text-zinc-700 dark:text-zinc-400 font-medium shrink-0">Duração:</span>
          {[
            { label: 'Todas as durações', value: 'all' as const },
            { label: '1 Dia', value: 1 },
            { label: '2 Dias', value: 2 },
            { label: '3 Dias', value: 3 },
            { label: '4+ Dias', value: 4 },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => setDaysFilter(item.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
                daysFilter === item.value
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white font-bold'
                  : 'text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Itineraries List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white rounded-full animate-spin mb-3" />
          <p className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">Carregando roteiros turísticos...</p>
        </div>
      ) : filteredItineraries.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl bg-white dark:bg-[#121418] p-6">
          <Compass className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
            Nenhum roteiro encontrado
          </h3>
          <p className="text-xs text-zinc-700 dark:text-zinc-400 font-medium max-w-sm mx-auto mb-4">
            {searchQuery
              ? 'Nenhum resultado corresponde à sua busca ou filtro selecionado.'
              : 'Nenhum roteiro cadastrado no banco de dados. Crie o primeiro roteiro turístico para a cidade!'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Roteiro Agora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItineraries.map(it => {
            const placesCount = it.placesCount || (it.days?.reduce((acc, d) => acc + (d.steps?.length || 0), 0)) || 0;

            return (
              <div
                key={it.id}
                className="bg-white dark:bg-[#121418] border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Cover Image & Badges */}
                  <div className="relative aspect-16/9 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <img
                      src={it.coverImage || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80'}
                      alt={it.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Top badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-300" />
                        <span>{it.daysCount} {it.daysCount === 1 ? 'Dia' : 'Dias'}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {it.isRecommended && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-zinc-900 shadow-xs">
                            ★ Destaque
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            it.isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-600 text-zinc-200'
                          }`}
                        >
                          {it.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Stats over cover image */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-[11px]">
                      <div className="flex items-center gap-1 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-zinc-300" />
                        <span>{placesCount} {placesCount === 1 ? 'lugar' : 'lugares'}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold">
                        <Users className="w-3.5 h-3.5 text-zinc-300" />
                        <span>{(it.usageCount || 0).toLocaleString()} usuários</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2.5">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white line-clamp-1">
                      {it.title}
                    </h3>
                    <p className="text-xs text-zinc-700 dark:text-zinc-400 font-medium line-clamp-2 leading-relaxed">
                      {it.description || 'Roteiro turístico em Campos do Jordão.'}
                    </p>

                    {/* Categories badges */}
                    {Array.isArray(it.categories) && it.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {it.categories.slice(0, 3).map((catId, cIdx) => {
                          const catObj = categories.find(c => c.id === catId);
                          return (
                            <span
                              key={cIdx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            >
                              {catObj?.name || catId}
                            </span>
                          );
                        })}
                        {it.categories.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400">
                            +{it.categories.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-[#15171d]">
                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleStatus(it.id)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      it.isActive
                        ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                    }`}
                  >
                    {it.isActive ? 'Desativar' : 'Ativar'}
                  </button>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicate(it.id, it.title)}
                      className="p-1.5 text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Duplicar roteiro"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(it)}
                      className="p-1.5 text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Editar roteiro"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(it.id, it.title)}
                      className="p-1.5 text-zinc-700 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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

      {/* Modal CRUD */}
      <AdminItineraryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchData}
        itineraryToEdit={itineraryToEdit}
        categories={categories}
      />
    </div>
  );
};
