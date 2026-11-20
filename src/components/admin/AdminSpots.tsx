import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit,
  Star,
  MapPin,
  RefreshCw,
  Compass,
  AlertCircle
} from 'lucide-react';
import { AdminSpotModal } from './AdminSpotModal';
import {
  fetchSpotsFromSupabase,
  deleteSpotFromSupabase,
  toggleSpotActiveInSupabase,
  subscribeToSpotsChanges
} from '../../services/supabaseSpots';

export const AdminSpots: React.FC = () => {
  const [spots, setSpots] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('monvian_cached_spots');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('monvian_cached_spots');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch {}
    return true;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [spotToEdit, setSpotToEdit] = useState<any | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const fetchSpots = async (isBackground = false) => {
    try {
      if (!isBackground && spots.length === 0) {
        setLoading(true);
      }
      setIsRefreshing(true);
      setError(null);
      const spotsData = await fetchSpotsFromSupabase({ throwOnError: true });
      setSpots(spotsData);
    } catch (err: any) {
      console.error('[AdminSpots] Erro ao carregar pontos do Supabase:', err);
      if (spots.length === 0) {
        setError(err?.message || 'Falha ao conectar com o Supabase PostgreSQL.');
      } else {
        showToast('Aviso: Não foi possível atualizar os pontos com o Supabase.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSpots(spots.length > 0);
    // Realtime subscription to live Supabase updates
    const unsubscribe = subscribeToSpotsChanges(() => {
      fetchSpots(true);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleToggleActive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const spot = spots.find(s => s.id === id);
    if (!spot) return;
    const newStatus = !spot.isActive;
    try {
      await toggleSpotActiveInSupabase(id, newStatus);
      setSpots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: newStatus, is_active: newStatus ? 1 : 0 } : s))
      );
      showToast(newStatus ? 'Ponto ativado no mapa.' : 'Ponto desativado no mapa.');
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao atualizar status do ponto no Supabase.');
    }
  };

  const handleDelete = async (spot: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${spot.name}" do banco de dados?`)) return;
    try {
      await deleteSpotFromSupabase(spot.id);
      setSpots((prev) => prev.filter((s) => s.id !== spot.id));
      showToast('Ponto turístico excluído com sucesso do Supabase.');
    } catch (err: any) {
      console.error(err);
      fetchSpots();
      showToast(err?.message || 'Erro ao excluir ponto no Supabase.');
    }
  };

  const CATEGORY_TABS = [
    { id: 'all', label: 'Todos' },
    { id: 'attractions', label: 'Atrações & Lazer' },
    { id: 'nature', label: 'Natureza & Mirantes' },
    { id: 'gastronomy', label: 'Gastronomia' },
    { id: 'hotels', label: 'Hotéis & Pousadas' },
    { id: 'sweets', label: 'Chocolates & Cafés' },
    { id: 'services', label: 'Comércio & Serviços' },
  ];

  const filteredSpots = spots.filter((spot) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (spot.name && spot.name.toLowerCase().includes(query)) ||
      (spot.description && spot.description.toLowerCase().includes(query)) ||
      (spot.categoryLabel && spot.categoryLabel.toLowerCase().includes(query)) ||
      (spot.category && spot.category.toLowerCase().includes(query)) ||
      (spot.address && spot.address.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (selectedCategory === 'all') return true;

    if (selectedCategory === 'attractions') {
      return ['attractions', 'parks', 'culture', 'lazer'].includes(spot.category);
    }
    if (selectedCategory === 'nature') {
      return ['nature', 'viewpoint'].includes(spot.category);
    }
    if (selectedCategory === 'gastronomy') {
      return ['gastronomy', 'restaurant', 'food'].includes(spot.category);
    }
    if (selectedCategory === 'sweets') {
      return ['sweets', 'chocolate', 'cafes', 'cafe', 'bistro'].includes(spot.category);
    }
    if (selectedCategory === 'hotels') {
      return ['hotels', 'hotel', 'pousada', 'lodging'].includes(spot.category);
    }
    if (selectedCategory === 'services') {
      return ['services', 'pharmacies', 'shops', 'shop', 'comercio'].includes(spot.category);
    }

    return spot.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-zinc-700 animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-blue-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1668FF] shrink-0 shadow-[0_0_10px_rgba(22,104,255,0.4)]" />
            <h1 className="text-[28px] sm:text-[34px] font-bold text-[#0D1526] tracking-[-0.03em] leading-tight">
              Pontos Turísticos
            </h1>
          </div>
          <p className="text-sm text-[#5B6B85] mt-1 sm:pl-[22px]">
            {spots.length} locais cadastrados no banco de dados do Monvian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSpots(false)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer"
            title="Atualizar lista com Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
          <button
            onClick={() => {
              setSpotToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Ponto</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, atrativo ou descrição..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>

        <div className="category-carousel-container flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 py-0.5">
          {CATEGORY_TABS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => {
                  setSelectedCategory(cat.id);
                  (e.currentTarget as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className={`h-[36px] px-3.5 rounded-full text-xs whitespace-nowrap transition-all duration-200 ease-out cursor-pointer inline-flex items-center gap-1.5 select-none active:scale-[0.96] ${
                  isSelected
                    ? 'bg-[#E5E5EA] text-zinc-900 border border-black/[0.06] shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.12)] font-semibold'
                    : 'bg-white text-zinc-700 border border-zinc-200/90 shadow-[0_2px_5px_-1px_rgba(0,0,0,0.07),_0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_3px_8px_-1px_rgba(0,0,0,0.09)]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spots Grid */}
      {loading && spots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-zinc-200">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm font-black text-zinc-600">Carregando catálogo de pontos...</p>
        </div>
      ) : error && spots.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-red-200 p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-base font-black text-zinc-800">Não foi possível carregar os pontos</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {error}
          </p>
          <button
            onClick={() => fetchSpots()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : filteredSpots.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-zinc-200 p-8">
          <Compass className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-black text-zinc-800">Nenhum ponto turístico encontrado</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Tente mudar o termo de busca ou cadastre um novo destino turístico.
          </p>
          <button
            onClick={() => {
              setSpotToEdit(null);
              setIsModalOpen(true);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Ponto</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSpots.map((spot) => (
            <div
              key={spot.id}
              className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
            >
              {/* Card Image Banner */}
              <div className="relative h-44 w-full bg-zinc-100 overflow-hidden">
                <img
                  src={spot.image}
                  alt={spot.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Status Switch and Verified Badge on Image */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-1.5">
                    {spot.isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600/90 text-white text-[10px] font-black uppercase shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                        VERIFICADO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 text-zinc-800 text-[10px] font-black shadow-xs">
                        PADRÃO
                      </span>
                    )}
                  </div>

                  {/* Active Toggle Switch */}
                  <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-full">
                    <span className="text-[10px] font-black text-white uppercase">
                      {spot.isActive ? 'Ativo' : 'Pausado'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleToggleActive(spot.id, e)}
                      className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out ${
                        spot.isActive ? 'bg-blue-600' : 'bg-zinc-500'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-0.5 ${
                          spot.isActive ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Category pill on bottom left of image */}
                <div className="absolute bottom-3 left-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white bg-black/60 px-2.5 py-1 rounded-lg">
                    {spot.categoryLabel || spot.category}
                  </span>
                </div>

                {/* Rating on bottom right */}
                <div className="absolute bottom-3 right-3 bg-black/60 px-2 py-1 rounded-lg flex items-center gap-1 text-white text-xs font-black">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{spot.rating?.toFixed(1) || '4.8'}</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-black text-zinc-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {spot.name}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                    {spot.description || 'Ponto turístico localizado nas montanhas de Campos do Jordão.'}
                  </p>
                </div>

                {/* Address & Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400 truncate max-w-[160px]">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                    <span className="truncate">{spot.address || 'Campos do Jordão'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSpotToEdit(spot);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Editar Ponto"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(spot)}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Excluir Ponto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spot Create / Edit Modal */}
      <AdminSpotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaveSuccess={(savedSpot) => {
          fetchSpots(true);
          if (savedSpot) {
            setSelectedCategory('all');
            setSpots((prev) => {
              const exists = prev.some((s) => s.id === savedSpot.id);
              if (exists) {
                return prev.map((s) => (s.id === savedSpot.id ? savedSpot : s));
              }
              return [savedSpot, ...prev];
            });
          }
          showToast(spotToEdit ? 'Ponto atualizado com sucesso!' : 'Novo ponto cadastrado no app!');
        }}
        spotToEdit={spotToEdit}
      />
    </div>
  );
};
