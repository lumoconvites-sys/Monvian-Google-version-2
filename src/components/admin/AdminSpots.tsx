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

  // Delete State
  const [spotToDelete, setSpotToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const confirmDelete = async () => {
    if (!spotToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/spots/${spotToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSpots((prev) => prev.filter((s) => s.id !== spotToDelete.id));
        showToast('Ponto turístico excluído com sucesso.');
        setSpotToDelete(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSpots = spots.filter((spot) => {
    const matchesSearch =
      spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (spot.description && spot.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (spot.categoryLabel && spot.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' || spot.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
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
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            CONSOLE OPERACIONAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            Pontos Turísticos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
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
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'attractions', label: 'Atrações' },
            { id: 'nature', label: 'Natureza' },
            { id: 'viewpoint', label: 'Mirantes' },
            { id: 'gastronomy', label: 'Gastronomia' },
            { id: 'parks', label: 'Parques' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spots Grid (Matching screenshot 2 layout) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-zinc-200">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-sm font-black text-zinc-600">Carregando catálogo de pontos...</p>
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
                  {/* Verified Badge */}
                  {spot.isVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00C896]/90 backdrop-blur-md text-white text-[10px] font-black uppercase shadow-sm">
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
                        spot.isActive ? 'bg-[#00C896]' : 'bg-zinc-500'
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
                  <h3 className="text-base font-black text-zinc-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {spot.name}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                    {spot.description || 'Ponto turístico localizado nas montanhas de Campos do Jordão.'}
                  </p>
                </div>

                {/* Address & Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400 truncate max-w-[140px]">
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
                      onClick={() => setSpotToDelete(spot)}
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
        onSaveSuccess={() => {
          fetchSpots();
          showToast(spotToEdit ? 'Ponto atualizado com sucesso!' : 'Novo ponto cadastrado no app!');
        }}
        spotToEdit={spotToEdit}
      />

      {/* Delete Confirmation Modal */}
      {spotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-zinc-900">Excluir Ponto Turístico</h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Tem certeza que deseja excluir o local <strong className="text-zinc-800">{spotToDelete.name}</strong>?
              Esta ação removerá o ponto permanentemente do banco de dados e do mapa do aplicativo.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSpotToDelete(null)}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-black text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
