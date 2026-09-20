import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  MapPin,
  Eye,
  EyeOff,
  SlidersHorizontal,
  RefreshCw,
  Layers,
  Compass,
  AlertTriangle
} from 'lucide-react';
import { MAP_VISUAL_ICON_CATEGORIES, MapVisualIconMeta } from '../../utils/mapVisualIcons';
import { AdminVisualIconModal } from './AdminVisualIconModal';

interface MapVisualIconItem {
  id: string;
  category: string;
  icon: string;
  latitude: number;
  longitude: number;
  color?: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export const AdminMapIcons: React.FC = () => {
  const [icons, setIcons] = useState<MapVisualIconItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [iconToEdit, setIconToEdit] = useState<MapVisualIconItem | null>(null);

  // Delete State
  const [iconToDelete, setIconToDelete] = useState<MapVisualIconItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const fetchIcons = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/map-visual-icons');
      const data = await res.json();
      if (data.success) {
        setIcons(data.icons || []);
      }
    } catch (err) {
      console.error('Error fetching visual icons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIcons();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleActive = async (item: MapVisualIconItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/admin/map-visual-icons/${item.id}/toggle-active`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (data.success) {
        setIcons((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, is_active: data.is_active } : i))
        );
        showToast(data.message || (data.is_active ? 'Ícone ativado no mapa.' : 'Ícone desativado.'));
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao alternar status do ícone.');
    }
  };

  const confirmDelete = async () => {
    if (!iconToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/map-visual-icons/${iconToDelete.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setIcons((prev) => prev.filter((i) => i.id !== iconToDelete.id));
        showToast('Ícone removido com sucesso.');
        setIconToDelete(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir ícone.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Category filter groups requested by user:
  // Todos, Postos, Farmácias, Picos, Hospitais, Estacionamentos, Mercados, Mirantes, Outros
  const filterTabs = [
    { key: 'all', label: 'Todos' },
    { key: 'gas_station', label: 'Postos' },
    { key: 'pharmacy', label: 'Farmácias' },
    { key: 'mountain_peak', label: 'Picos' },
    { key: 'hospital', label: 'Hospitais' },
    { key: 'parking', label: 'Estacionamentos' },
    { key: 'market', label: 'Mercados' },
    { key: 'viewpoint', label: 'Mirantes' },
    { key: 'other', label: 'Outros' }
  ];

  const filteredIcons = icons.filter((item) => {
    // Search filter
    const meta = MAP_VISUAL_ICON_CATEGORIES[item.category];
    const categoryLabel = meta?.label || item.category;
    const matchesSearch =
      categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${item.latitude}, ${item.longitude}`.includes(searchQuery);

    // Category filter
    let matchesCategory = true;
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'other') {
        const standardKeys = ['gas_station', 'pharmacy', 'mountain_peak', 'hospital', 'parking', 'market', 'viewpoint'];
        matchesCategory = !standardKeys.includes(item.category);
      } else {
        matchesCategory = item.category === selectedFilter;
      }
    }

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = item.is_active === 1;
    if (statusFilter === 'inactive') matchesStatus = item.is_active === 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalActive = icons.filter((i) => i.is_active === 1).length;
  const totalInactive = icons.length - totalActive;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-zinc-700 animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-[#00C896]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-black tracking-wider uppercase mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>CAMADA CARTOGRÁFICA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Ícones do mapa
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Marcadores visuais rápidos e informativos para o mapa oficial (não interativos, leves e dinâmicos).
          </p>
        </div>

        <button
          onClick={() => {
            setIconToEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Adicionar ícone</span>
        </button>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total de Marcadores</div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{icons.length}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Ativos no Mapa</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{totalActive}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Desativados</div>
          <div className="text-2xl font-black text-zinc-400 mt-1">{totalInactive}</div>
        </div>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por categoria ou coordenadas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-600 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Inativos
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {filterTabs.map((tab) => {
            const isSelected = selectedFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List / Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
          <span className="text-xs text-zinc-500 font-bold">Carregando marcadores do mapa...</span>
        </div>
      ) : filteredIcons.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center">
          <Layers className="w-10 h-10 text-zinc-400 mb-2 opacity-60" />
          <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Nenhum ícone encontrado</h3>
          <p className="text-xs text-zinc-500 max-w-sm mt-1">
            {searchQuery || selectedFilter !== 'all'
              ? 'Tente alterar os filtros de categoria ou termo de busca.'
              : 'Clique em "+ Adicionar ícone" para cadastrar seu primeiro marcador visual.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
            {filteredIcons.map((item) => {
              const meta: MapVisualIconMeta =
                MAP_VISUAL_ICON_CATEGORIES[item.category] || MAP_VISUAL_ICON_CATEGORIES.gas_station;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  {/* Icon Badge & Category Name */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Visual Badge Preview */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border border-white/80 shadow-md"
                      style={{ backgroundColor: item.color || meta.bgColor }}
                      dangerouslySetInnerHTML={{
                        __html: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none">${meta.svgInner}</svg>`
                      }}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-zinc-900 dark:text-white truncate">
                          {meta.label}
                        </span>
                        {item.is_active === 1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Inativo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span>Localização: cadastrada</span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          ({item.latitude.toFixed(4)}, {item.longitude.toFixed(4)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Toggle Active Switch */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleActive(item, e)}
                      title={item.is_active === 1 ? 'Desativar do mapa' : 'Ativar no mapa'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        item.is_active === 1
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      {item.is_active === 1 ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ativo</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Inativo</span>
                        </>
                      )}
                    </button>

                    {/* Edit Position / Icon */}
                    <button
                      type="button"
                      onClick={() => {
                        setIconToEdit(item);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-colors"
                      title="Editar posição ou alterar ícone"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setIconToDelete(item)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Excluir ícone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <AdminVisualIconModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIconToEdit(null);
        }}
        iconToEdit={iconToEdit}
        onSuccess={(saved) => {
          fetchIcons();
          showToast(iconToEdit ? 'Ícone atualizado com sucesso!' : 'Ícone adicionado ao mapa!');
        }}
      />

      {/* Delete Confirmation Dialog */}
      {iconToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-zinc-100">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Excluir Ícone do Mapa</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tem certeza que deseja remover este marcador permanente da camada visual do mapa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIconToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-black text-white transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
