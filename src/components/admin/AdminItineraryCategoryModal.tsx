import React, { useState, useEffect } from 'react';
import { X, Check, Tag, Compass, Sparkles, Trees, Heart, UtensilsCrossed, Coffee, Calendar, CalendarDays, Users } from 'lucide-react';
import { ItineraryCategory } from '../../types';

interface AdminItineraryCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categoryToEdit?: ItineraryCategory | null;
}

const AVAILABLE_ICONS = [
  { label: 'Bússola', value: 'Compass' },
  { label: 'Brilho / Destaque', value: 'Sparkles' },
  { label: 'Natureza / Árvores', value: 'Trees' },
  { label: 'Romântico / Coração', value: 'Heart' },
  { label: 'Gastronomia / Garfo & Faca', value: 'UtensilsCrossed' },
  { label: 'Café / Xícara', value: 'Coffee' },
  { label: 'Calendário (1 dia)', value: 'Calendar' },
  { label: 'Calendário (2+ dias)', value: 'CalendarDays' },
  { label: 'Família / Pessoas', value: 'Users' }
];

export const AdminItineraryCategoryModal: React.FC<AdminItineraryCategoryModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  categoryToEdit
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Compass');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (categoryToEdit) {
      setName(categoryToEdit.name || '');
      setIcon(categoryToEdit.icon || 'Compass');
      setDescription(categoryToEdit.description || '');
      setSortOrder(categoryToEdit.sortOrder || 0);
      setIsActive(categoryToEdit.isActive !== false);
    } else {
      setName('');
      setIcon('Compass');
      setDescription('');
      setSortOrder(0);
      setIsActive(true);
    }
    setErrorMsg('');
  }, [isOpen, categoryToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome da categoria');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const url = categoryToEdit
        ? `/api/admin/itinerary-categories/${categoryToEdit.id}`
        : '/api/admin/itinerary-categories';
      const method = categoryToEdit ? 'PUT' : 'POST';

      const token = localStorage.getItem('monvian_auth_token') || localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: name.trim(),
          icon,
          description: description.trim(),
          sortOrder: Number(sortOrder) || 0,
          isActive
        })
      });

      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setErrorMsg(data.error || 'Erro ao salvar categoria');
      }
    } catch (e: any) {
      setErrorMsg('Erro: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-[#17191e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#007AFF]/15 text-[#007AFF] flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
              {categoryToEdit ? 'Editar Categoria da Loja' : 'Nova Categoria de Roteiro'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
              Nome da Categoria *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Aventura, Casais, 1 dia..."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#007AFF]"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
              Ícone da Categoria
            </label>
            <select
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#007AFF]"
            >
              {AVAILABLE_ICONS.map(i => (
                <option key={i.value} value={i.value}>
                  {i.label} ({i.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
              Ordem de Exibição
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(Number(e.target.value))}
              placeholder="0, 1, 2..."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#007AFF]"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Breve resumo da categoria..."
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#007AFF]"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Categoria Ativa na Loja</span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-[#007AFF] cursor-pointer"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#007AFF] text-white text-xs font-black hover:bg-blue-600 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Categoria'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
