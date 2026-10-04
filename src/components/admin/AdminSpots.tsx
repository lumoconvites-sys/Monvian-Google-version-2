import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Edit,
  ExternalLink,
  Star,
  MapPin,
  Eye,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { AdminSpotModal } from './AdminSpotModal';

export const AdminSpots: React.FC = () => {
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [spotToEdit, setSpotToEdit] = useState<any | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const fetchSpots = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/spots');
      const data = await res.json();
      if (data.success) {
        setSpots(data.spots);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpots();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggleActive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/admin/spots/${id}/toggle-active`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        setSpots((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isActive: data.isActive } : s))
        );
        showToast(data.isActive ? 'Ponto ativado no mapa.' : 'Ponto desativado.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleVerified = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/admin/spots/${id}/toggle-verified`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        setSpots((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isVerified: data.isVerified } : s))
        );
        showToast(data.isVerified ? 'Ponto marcado como verificado.' : 'Verificação removida.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (spot: any) => {
    try {
      // Optimistic UI removal
      setSpots((prev) => prev.filter((s) => s.id !== spot.id));
      const res = await fetch(`/api/admin/spots/${spot.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Ponto turístico excluído com sucesso.');
      } else {
        fetchSpots();
        showToast('Erro ao excluir ponto.');
      }
    } catch (err) {
      console.error(err);
      fetchSpots();
      showToast('Erro ao excluir ponto.');
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
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-black tracking-wider uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            CONSOLE OPERACIONAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Pontos Turísticos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {spots.length} locais cadastrados no banco de dados do Monvian.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#16181d] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                  : 'bg-white dark:bg-[#16181d] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spots Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#16181d] rounded-3xl border border-zinc-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm font-black text-zinc-600 dark:text-zinc-400">Carregando catálogo de pontos...</p>
        </div>
      ) : filteredSpots.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#16181d] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8">
          <Compass className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-black text-zinc-800 dark:text-zinc-200">Nenhum ponto turístico encontrado</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
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
              className="bg-white dark:bg-[#16181d] rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
            >
              {/* Card Image Banner */}
              <div className="relative h-44 w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <img
                  src={spot.image}
                  alt={spot.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Status Switch and Verified Badge on Image */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                  {/* Verified Badge */}
                  {spot.isVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase shadow-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      VERIFICADO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800/80 backdrop-blur-md text-white text-[10px] font-black">
                      PADRÃO
                    </span>
                  )}

                  {/* Active Toggle Switch */}
                  <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full">
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
                  <span className="text-[10px] font-black uppercase tracking-wider text-white bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg">
                    {spot.categoryLabel || spot.category}
                  </span>
                </div>

                {/* Rating on bottom right */}
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 text-white text-xs font-black">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{spot.rating?.toFixed(1) || '4.8'}</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                    {spot.name}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {spot.description || 'Ponto turístico localizado nas montanhas de Campos do Jordão.'}
                  </p>
                </div>

                {/* Address & Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[140px]">
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
                      className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                      title="Editar Ponto"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(spot)}
                      className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
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
          fetchSpots();
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
