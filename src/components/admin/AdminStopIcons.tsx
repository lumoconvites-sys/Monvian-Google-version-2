import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  MapPin,
  Pencil,
  Trash2,
  RefreshCw,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { MapVisualIcon } from '../../types';
import {
  getCategoryDisplayLabel,
  resolveLucideIconName,
  sanitizeHexColor,
} from '../../utils/mapVisualIcons';
import {
  fetchCloudMapVisualIcons,
  subscribeToMapVisualIcons,
  persistMapVisualIconToFirestore,
  deleteMapVisualIconFromFirestore,
} from '../../services/firestoreSync';
import { IOSSwitch } from '../IOSSwitch';
import { AdminStopIconModal, LucideSymbolGlyph } from './AdminStopIconModal';
import { ADMIN_CARD_STYLE, ADMIN_MOTION_EASE } from './adminTheme';

interface AdminStopIconsProps {
  currentUser?: any;
}

function getAdminAuthHeaders(currentUser?: any): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem('monvian_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const storedUserRaw = localStorage.getItem('monvian_user');
    const storedEmail = storedUserRaw ? JSON.parse(storedUserRaw)?.email : '';
    const email = currentUser?.email || storedEmail || '';
    if (email) headers['x-user-email'] = email;
  } catch {}
  return headers;
}

export const AdminStopIcons: React.FC<AdminStopIconsProps> = ({ currentUser }) => {
  const [icons, setIcons] = useState<MapVisualIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iconToEdit, setIconToEdit] = useState<MapVisualIcon | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const authHeaders = useMemo(() => getAdminAuthHeaders(currentUser), [currentUser]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const loadIcons = useCallback(
    async (background = false) => {
      try {
        if (!background) setLoading(true);
        setIsRefreshing(true);

        const res = await fetch('/api/admin/map-visual-icons', {
          headers: authHeaders,
        });
        const data = await res.json();
        if (res.ok && data?.success && Array.isArray(data.icons)) {
          setIcons(data.icons);
          return;
        }
      } catch {}

      try {
        const cloud = await fetchCloudMapVisualIcons();
        if (Array.isArray(cloud)) {
          setIcons(cloud as MapVisualIcon[]);
        }
      } catch {} finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [authHeaders]
  );

  useEffect(() => {
    let active = true;
    loadIcons(false).finally(() => {
      if (active) {
        setLoading(false);
        setIsRefreshing(false);
      }
    });

    const unsub = subscribeToMapVisualIcons((cloudIcons) => {
      if (!active) return;
      setIcons((prev) => {
        if (cloudIcons.length === 0 && prev.length > 0) return prev;
        return cloudIcons as MapVisualIcon[];
      });
    });

    return () => {
      active = false;
      unsub();
    };
  }, [loadIcons]);

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    icons.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [icons]);

  const filteredIcons = useMemo(() => {
    const q = searchQuery
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    return icons.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const nameStr = (item.name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const catLabel = getCategoryDisplayLabel(item.category)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const iconStr = (item.icon || '').toLowerCase();
      return nameStr.includes(q) || catLabel.includes(q) || iconStr.includes(q);
    });
  }, [icons, searchQuery, selectedCategory]);

  const activeCount = useMemo(
    () => icons.filter((i) => Number(i.is_active ?? 1) === 1).length,
    [icons]
  );

  const handleToggleActive = async (item: MapVisualIcon) => {
    const nextActive = Number(item.is_active ?? 1) === 1 ? 0 : 1;
    const optimistic: MapVisualIcon = { ...item, is_active: nextActive };

    // Optimistic update both in Admin list AND live on the main map immediately
    setIcons((prev) => prev.map((i) => (i.id === item.id ? optimistic : i)));
    window.dispatchEvent(
      new CustomEvent('monvian:visual_icons_updated', {
        detail: { action: 'upsert', icon: optimistic },
      })
    );

    try {
      const res = await fetch(
        `/api/admin/map-visual-icons/${encodeURIComponent(item.id)}/toggle-active`,
        {
          method: 'PATCH',
          headers: authHeaders,
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Falha ao atualizar status.');
      }
      persistMapVisualIconToFirestore(data.icon || optimistic).catch(() => {});
      showToast(
        nextActive === 1 ? 'Marcador ativado no mapa principal.' : 'Marcador ocultado do mapa.'
      );
    } catch (err: any) {
      // Revert optimistic update on failure
      setIcons((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      window.dispatchEvent(
        new CustomEvent('monvian:visual_icons_updated', {
          detail: { action: 'upsert', icon: item },
        })
      );
      showToast(err?.message || 'Erro ao alterar visibilidade.');
    }
  };

  const handleDelete = async (item: MapVisualIcon) => {
    setBusyId(item.id);
    setConfirmDeleteId(null);

    const prevIcons = icons;
    setIcons((prev) => prev.filter((i) => i.id !== item.id));
    window.dispatchEvent(
      new CustomEvent('monvian:visual_icons_updated', {
        detail: { action: 'delete', id: item.id },
      })
    );

    try {
      const res = await fetch(
        `/api/admin/map-visual-icons/${encodeURIComponent(item.id)}`,
        {
          method: 'DELETE',
          headers: authHeaders,
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Erro ao excluir ícone.');
      }
      deleteMapVisualIconFromFirestore(item.id).catch(() => {});
      showToast('Ícone removido do mapa com sucesso.');
    } catch (err: any) {
      setIcons(prevIcons);
      window.dispatchEvent(
        new CustomEvent('monvian:visual_icons_updated', {
          detail: { action: 'upsert', icon: item },
        })
      );
      showToast(err?.message || 'Não foi possível excluir o ícone.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaved = (savedIcon: MapVisualIcon, isNew: boolean) => {
    setIcons((prev) => {
      const exists = prev.some((i) => i.id === savedIcon.id);
      if (exists) {
        return prev.map((i) => (i.id === savedIcon.id ? savedIcon : i));
      }
      return [savedIcon, ...prev];
    });
    showToast(
      isNew
        ? 'Novo ícone publicado imediatamente no mapa!'
        : 'Ícone atualizado em tempo real no mapa!'
    );
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header Card (Clean Apple/Monvian Admin aesthetic matching reference) */}
      <section
        className="rounded-[26px] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={ADMIN_CARD_STYLE}
      >
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-[18px] bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[21px] sm:text-[24px] font-bold tracking-[-0.03em] text-[#0D1526] leading-tight">
              Ícones de Pontos de Parada
            </h1>
            <p className="text-[13.5px] text-[#64748B] mt-0.5 leading-snug">
              Gerencie os ícones auxiliares de utilidades e serviços exibidos no mapa principal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadIcons(true)}
            disabled={isRefreshing}
            title="Atualizar lista"
            className="w-11 h-11 rounded-[16px] bg-[#F4F7FC] hover:bg-[#EBF2FF] text-[#475569] hover:text-[#1668FF] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${isRefreshing ? 'animate-spin text-[#1668FF]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setIconToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[16px] bg-[#1668FF] hover:bg-[#0F5AE6] active:scale-[0.98] text-white text-[14px] font-bold tracking-[-0.01em] transition-all cursor-pointer"
            style={{ boxShadow: '0 10px 22px -6px rgba(22, 104, 255, 0.42)' }}
          >
            <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
            <span>Adicionar Novo Ícone</span>
          </button>
        </div>
      </section>

      {/* Compact Stats + Search & Category Filter Bar */}
      <section
        className="rounded-[24px] p-4 sm:p-5 space-y-4"
        style={ADMIN_CARD_STYLE}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, categoria ou símbolo..."
              className="w-full pl-10 pr-9 py-2.5 rounded-[14px] bg-[#F4F7FC] border border-slate-200/80 text-[14px] text-[#0D1526] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#1668FF] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Compact Metric Pills */}
          <div className="flex items-center gap-2 text-[12.5px] font-semibold shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-[#F4F7FC] text-[#334155] tabular-nums">
              Total: {icons.length}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 tabular-nums">
              <Eye className="w-3.5 h-3.5" />
              {activeCount} ativos
            </span>
            {icons.length - activeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 tabular-nums">
                <EyeOff className="w-3.5 h-3.5" />
                {icons.length - activeCount} ocultos
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Category Filter Chips */}
        {existingCategories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#1668FF] text-white shadow-xs'
                  : 'bg-[#F4F7FC] text-[#475569] hover:bg-[#EBF2FF] hover:text-[#1668FF]'
              }`}
            >
              Todas ({icons.length})
            </button>
            {existingCategories.map((cat) => {
              const count = icons.filter((i) => i.category === cat).length;
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[#1668FF] text-white shadow-xs'
                      : 'bg-[#F4F7FC] text-[#475569] hover:bg-[#EBF2FF] hover:text-[#1668FF]'
                  }`}
                >
                  {getCategoryDisplayLabel(cat)} ({count})
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Registered Stop Icons List */}
      {loading ? (
        <div
          className="rounded-[24px] p-12 flex flex-col items-center justify-center text-slate-400 gap-3"
          style={ADMIN_CARD_STYLE}
        >
          <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-[#1668FF] animate-spin" />
          <span className="text-[13.5px] font-medium">Carregando ícones de parada...</span>
        </div>
      ) : filteredIcons.length === 0 ? (
        <div
          className="rounded-[24px] p-10 sm:p-12 flex flex-col items-center justify-center text-center"
          style={ADMIN_CARD_STYLE}
        >
          <div className="w-14 h-14 rounded-[20px] bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center mb-3.5">
            <MapPin className="w-7 h-7" />
          </div>
          <h3 className="text-[17px] font-bold text-[#0D1526]">
            {icons.length === 0
              ? 'Nenhum ícone de ponto de parada cadastrado'
              : 'Nenhum marcador encontrado para esta busca'}
          </h3>
          <p className="text-[13.5px] text-[#64748B] max-w-sm mt-1">
            {icons.length === 0
              ? 'Adicione postos, farmácias, estacionamentos, hospitais e outras utilidades para exibição imediata no mapa.'
              : 'Tente buscar por outro nome ou limpe o filtro de categoria.'}
          </p>
          {icons.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setIconToEdit(null);
                setIsModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-[#1668FF] hover:bg-[#0F5AE6] text-white text-[13.5px] font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Ícone</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredIcons.map((item) => {
            const isItemActive = Number(item.is_active ?? 1) === 1;
            const bgColor = sanitizeHexColor(item.color, item.category);
            const resolvedIcon = resolveLucideIconName(item.icon, item.category);
            const displayName = item.name?.trim() || getCategoryDisplayLabel(item.category);
            const catLabel = getCategoryDisplayLabel(item.category);
            const isConfirmingDelete = confirmDeleteId === item.id;

            return (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: ADMIN_MOTION_EASE }}
                className={`rounded-[22px] p-4 flex flex-col justify-between gap-3.5 transition-opacity ${
                  isItemActive ? 'opacity-100' : 'opacity-70'
                }`}
                style={ADMIN_CARD_STYLE}
              >
                {/* Top Row: Circular Symbol Preview + Name + Category + Switch */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: bgColor,
                        border: '2px solid #FFFFFF',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.18)',
                      }}
                    >
                      <LucideSymbolGlyph
                        name={resolvedIcon}
                        size={20}
                        color="#FFFFFF"
                        strokeWidth={2.25}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-[#0D1526] tracking-[-0.015em] truncate">
                        {displayName}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F4F7FC] text-[#475569] text-[11.5px] font-semibold truncate max-w-[155px]">
                          {catLabel}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: bgColor }}
                          title={bgColor}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <IOSSwitch
                      checked={isItemActive}
                      onChange={() => handleToggleActive(item)}
                    />
                  </div>
                </div>

                {/* Bottom Row: Coordinates + Edit / Delete Actions */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-mono text-slate-500 min-w-0 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#1668FF] shrink-0" />
                    <span className="truncate">
                      {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}
                    </span>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11.5px] font-bold transition-colors cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11.5px] font-semibold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIconToEdit(item);
                          setIsModalOpen(true);
                        }}
                        aria-label={`Editar ${displayName}`}
                        className="w-8 h-8 rounded-xl bg-[#F4F7FC] hover:bg-[#EBF2FF] text-[#475569] hover:text-[#1668FF] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label={`Excluir ${displayName}`}
                        className="w-8 h-8 rounded-xl bg-[#F4F7FC] hover:bg-rose-50 text-[#475569] hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AdminStopIconModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIconToEdit(null);
        }}
        iconToEdit={iconToEdit}
        existingCategories={existingCategories}
        onSaved={handleSaved}
        authHeaders={authHeaders}
      />

      {/* Subtle Floating Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[350] px-4 py-2.5 rounded-full bg-[#0D1526] text-white text-[13px] font-semibold shadow-xl flex items-center gap-2 whitespace-nowrap"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
