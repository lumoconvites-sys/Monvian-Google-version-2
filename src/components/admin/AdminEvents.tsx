import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Search,
  MapPin,
  Clock,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { AdminMapPicker } from './AdminMapPicker';

export const AdminEvents: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('Música & Cultura');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('Campos do Jordão, SP');
  const [lat, setLat] = useState(-22.7345);
  const [lng, setLng] = useState(-45.5912);
  const [status, setStatus] = useState('active');
  const [highlighted, setHighlighted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenCreate = () => {
    setEventToEdit(null);
    setName('');
    setDescription('');
    setImage('https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80');
    setCategory('Música & Cultura');
    setDate('Julho de 2026');
    setTime('19h00');
    setAddress('Praça São Benedito - Vila Capivari');
    setLat(-22.7345);
    setLng(-45.5912);
    setStatus('active');
    setHighlighted(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (evt: any) => {
    setEventToEdit(evt);
    setName(evt.name || '');
    setDescription(evt.description || '');
    setImage(evt.image || '');
    setCategory(evt.category || 'Música & Cultura');
    setDate(evt.date || '');
    setTime(evt.time || '');
    setAddress(evt.address || '');
    setLat(evt.lat || -22.7345);
    setLng(evt.lng || -45.5912);
    setStatus(evt.status || 'active');
    setHighlighted(Boolean(evt.highlighted));
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este evento?')) return;
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        showToast('Evento excluído do mapa.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        description,
        image,
        category,
        date,
        time,
        address,
        lat,
        lng,
        status,
        highlighted: highlighted ? 1 : 0
      };

      const url = eventToEdit ? `/api/admin/events/${eventToEdit.id}` : '/api/admin/events';
      const method = eventToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        fetchEvents();
        showToast(eventToEdit ? 'Evento atualizado!' : 'Novo evento cadastrado no mapa!');
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-zinc-700">
          <CheckCircle2 className="w-4 h-4 text-[#00C896]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-black tracking-wider uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            CONSOLE OPERACIONAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            Eventos no Mapa
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Festivais, feiras gastronômicas e apresentações culturais na serra.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Novo Evento</span>
        </button>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="bg-white rounded-3xl border border-zinc-200/90 shadow-xs overflow-hidden flex flex-col group"
          >
            <div className="relative h-48 w-full bg-zinc-100">
              <img src={evt.image} alt={evt.name} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
                {evt.category}
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(evt)}
                  className="p-2 rounded-xl bg-white/90 hover:bg-white text-zinc-700 shadow-sm transition-all cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(evt.id)}
                  className="p-2 rounded-xl bg-white/90 hover:bg-white text-rose-600 shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="text-base font-black text-zinc-900 group-hover:text-blue-600 transition-colors">
                  {evt.name}
                </h3>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                  {evt.description}
                </p>
              </div>

              <div className="pt-3 border-t border-zinc-100 space-y-1.5 text-xs text-zinc-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>{evt.date} • {evt.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="truncate">{evt.address}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl my-auto bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-zinc-900">
                {eventToEdit ? 'Editar Evento' : 'Cadastrar Evento no Mapa'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-zinc-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1">Nome do Evento *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">Data</label>
                  <input
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    placeholder="Ex: Julho de 2026"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-700 mb-1">Horário</label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="Ex: 19h às 22h"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1">URL da Imagem</label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1">Localização no Mapa</label>
                <AdminMapPicker
                  lat={lat}
                  lng={lng}
                  address={address}
                  onChange={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-black text-zinc-600 rounded-xl border border-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-black text-white bg-blue-600 rounded-xl shadow-md"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
