import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Trash2,
  Edit,
  CheckCircle2,
  Upload,
  Eye,
  EyeOff,
  DollarSign,
  Link2,
  X,
} from 'lucide-react';
import { AdminMapPicker } from './AdminMapPicker';
import { Spot } from '../../types';

function getAdminAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('monvian_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const rawUser = localStorage.getItem('monvian_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      const email = (parsed?.email || parsed?.whatsapp || 'marioyesk@gmail.com').trim();
      headers['x-user-email'] = email;
    } else {
      headers['x-user-email'] = 'marioyesk@gmail.com';
    }
  } catch {
    headers['x-user-email'] = 'marioyesk@gmail.com';
  }
  return headers;
}

export const AdminEvents: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<any | null>(null);

  // Form states matching the specification
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('19:30');
  const [endTime, setEndTime] = useState('23:00');
  const [costPrice, setCostPrice] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [linkedSpotId, setLinkedSpotId] = useState<string>('');
  const [address, setAddress] = useState('Vila Capivari, Campos do Jordão - SP');
  const [lat, setLat] = useState(-22.7192);
  const [lng, setLng] = useState(-45.5673);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEventsAndSpots = async () => {
    try {
      setLoading(true);
      const [eventsRes, spotsRes] = await Promise.all([
        fetch('/api/admin/events', { headers: getAdminAuthHeaders() }),
        fetch('/api/spots'),
      ]);
      const eventsData = await eventsRes.json();
      if (eventsData.success && Array.isArray(eventsData.events)) {
        setEvents(eventsData.events);
      }
      const spotsData = await spotsRes.json();
      if (Array.isArray(spotsData)) {
        setSpots(spotsData);
      } else if (spotsData?.spots && Array.isArray(spotsData.spots)) {
        setSpots(spotsData.spots);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventsAndSpots();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const broadcastEventsUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('monvian:events_updated'));
    }
  };

  const handleOpenCreate = () => {
    setEventToEdit(null);
    setName('');
    setImage('https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=900&q=80');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setStartTime('19:30');
    setEndTime('23:00');
    setCostPrice('R$ 0,00');
    setStatus('published');
    setLinkedSpotId('');
    setAddress('Vila Capivari, Campos do Jordão - SP');
    setLat(-22.7192);
    setLng(-45.5673);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (evt: any) => {
    setEventToEdit(evt);
    setName(evt.name || '');
    setImage(evt.image || '');
    setDescription(evt.description || '');
    setDate(evt.date || '');
    setStartTime(evt.start_time || '19:30');
    setEndTime(evt.end_time || '23:00');
    setCostPrice(evt.cost_price || '');
    setStatus(evt.status === 'draft' ? 'draft' : 'published');
    setLinkedSpotId(evt.linked_spot_id || '');
    setAddress(evt.address || 'Campos do Jordão, SP');
    setLat(Number(evt.lat) || -22.7192);
    setLng(Number(evt.lng) || -45.5673);
    setIsModalOpen(true);
  };

  const handleLinkedSpotChange = (spotId: string) => {
    setLinkedSpotId(spotId);
    if (!spotId) return;
    const found = spots.find((s) => String(s.id) === String(spotId));
    if (found) {
      if (typeof found.lat === 'number' && typeof found.lng === 'number') {
        setLat(Number(found.lat.toFixed(6)));
        setLng(Number(found.lng.toFixed(6)));
      }
      if (found.address) {
        setAddress(found.address);
      } else {
        setAddress(`${found.name} — Campos do Jordão, SP`);
      }
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: getAdminAuthHeaders(),
            body: JSON.stringify({
              imageBase64: base64,
              folder: 'events',
              filename: file.name,
            }),
          });
          const data = await res.json();
          if (data.success && data.url) {
            setImage(data.url);
            showToast('Foto de capa enviada com sucesso!');
          } else {
            setImage(base64);
          }
        } catch {
          setImage(base64);
        } finally {
          setIsUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingImage(false);
    }
  };

  const handleToggleStatus = async (evt: any) => {
    const nextStatus = evt.status === 'published' ? 'draft' : 'published';
    try {
      const res = await fetch(`/api/admin/events/${evt.id}/status`, {
        method: 'PATCH',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setEvents((prev) =>
          prev.map((item) => (item.id === evt.id ? { ...item, status: nextStatus } : item))
        );
        broadcastEventsUpdated();
        showToast(nextStatus === 'published' ? 'Evento publicado no mapa!' : 'Evento movido para rascunho.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        broadcastEventsUpdated();
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
      const formattedTime =
        startTime && endTime ? `${startTime} às ${endTime}` : startTime || '';

      const payload = {
        name: name.trim(),
        image: image.trim(),
        description: description.trim(),
        date: date.trim(),
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        time: formattedTime,
        cost_price: costPrice.trim(),
        status,
        linked_spot_id: linkedSpotId || '',
        address: address.trim(),
        lat: Number(lat),
        lng: Number(lng),
      };

      const url = eventToEdit ? `/api/admin/events/${eventToEdit.id}` : '/api/admin/events';
      const method = eventToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAdminAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        await fetchEventsAndSpots();
        broadcastEventsUpdated();
        showToast(eventToEdit ? 'Evento atualizado com sucesso!' : 'Evento criado com sucesso!');
        setIsModalOpen(false);
      } else {
        showToast(data.error || 'Erro ao salvar evento.');
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
          <CheckCircle2 className="w-4 h-4 text-[#007AFF]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#007AFF] text-xs font-black tracking-wider uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-[#007AFF]"></span>
            GESTÃO DE EVENTOS
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Eventos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Gerencie eventos em andamento ou próximos de acontecer integrados ao mapa de Campos do Jordão.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white text-xs sm:text-sm font-black rounded-2xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Criar evento</span>
        </button>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="py-12 text-center text-xs font-semibold text-zinc-400">
          Carregando eventos cadastrados...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white dark:bg-[#121418] rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-10 text-center space-y-3">
          <Calendar className="w-8 h-8 text-zinc-400 mx-auto" />
          <div className="text-sm font-black text-zinc-800 dark:text-zinc-200">
            Nenhum evento cadastrado
          </div>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Clique em &ldquo;Criar evento&rdquo; para publicar um novo evento no card flutuante da página principal do mapa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {events.map((evt) => {
            const isPublished = evt.status === 'published' || evt.status === 'active';
            return (
              <div
                key={evt.id}
                className="bg-white dark:bg-[#121418] rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col group"
              >
                <div className="relative h-48 w-full bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={
                      evt.image ||
                      'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=900&q=80'
                    }
                    alt={evt.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md ${
                        isPublished
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-zinc-900/75 text-zinc-200'
                      }`}
                    >
                      {isPublished ? 'Publicado' : 'Rascunho'}
                    </span>
                    {evt.cost_price && (
                      <span className="bg-black/65 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                        {evt.cost_price}
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(evt)}
                      title={isPublished ? 'Despublicar evento' : 'Publicar evento'}
                      className="px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-zinc-800/95 hover:bg-white text-zinc-800 dark:text-zinc-200 text-[11px] font-black shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {isPublished ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Despublicar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-[#007AFF]" />
                          <span>Publicar</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(evt)}
                      className="p-2 rounded-xl bg-white/95 dark:bg-zinc-800/95 hover:bg-white text-zinc-700 dark:text-zinc-200 shadow-sm transition-all cursor-pointer"
                      title="Editar evento"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(evt.id)}
                      className="p-2 rounded-xl bg-white/95 dark:bg-zinc-800/95 hover:bg-white text-rose-600 shadow-sm transition-all cursor-pointer"
                      title="Excluir evento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
                      {evt.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {evt.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                      <span>
                        {evt.date || 'Data ativa'} •{' '}
                        {evt.start_time && evt.end_time
                          ? `${evt.start_time} às ${evt.end_time}`
                          : evt.start_time || evt.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#007AFF] shrink-0" />
                      <span className="truncate">
                        {evt.linked_spot_name
                          ? `${evt.linked_spot_name} (${evt.address})`
                          : evt.address}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Criar / Editar Evento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl my-auto bg-white dark:bg-[#16181d] rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                {eventToEdit ? 'Editar evento' : 'Criar evento'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              {/* Nome do evento */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                  Nome do evento *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Jazz & Vinho no Capivari"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                />
              </div>

              {/* Foto de capa com upload de imagem */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                  Foto de capa
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 shrink-0 bg-zinc-100 dark:bg-zinc-800">
                    {image ? (
                      <img src={image} alt="Preview" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="URL da foto ou envie um arquivo..."
                      className="flex-1 px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-black text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingImage ? 'Enviando...' : 'Upload de imagem'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Descrição do evento */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                  Descrição do evento
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição curta e objetiva exibida no card flutuante..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                />
              </div>

              {/* Data, Horário de início e Horário de término */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                    Data do evento
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                    Horário de início
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                    Horário de término
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Preço de custo em reais (R$) e Status (Publicado / Rascunho) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                    Preço de custo em reais (R$)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="Ex: R$ 80,00 ou Entrada Franca"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                    Status do evento
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value === 'draft' ? 'draft' : 'published')}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-900 dark:text-white"
                  >
                    <option value="published">Publicado (Visível no Mapa)</option>
                    <option value="draft">Rascunho (Oculto)</option>
                  </select>
                </div>
              </div>

              {/* Ponto turístico vinculado */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                  Ponto turístico vinculado (opcional)
                </label>
                <div className="relative">
                  <Link2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={linkedSpotId}
                    onChange={(e) => handleLinkedSpotChange(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                  >
                    <option value="">Localização independente no mapa</option>
                    {spots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.categoryLabel || s.category})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Ao selecionar um ponto turístico existente, o mapa carrega automaticamente a localização oficial desse ponto.
                </p>
              </div>

              {/* Endereço textual */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                  Endereço ou referência
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Macedo Soares, 499 - Vila Capivari"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white"
                />
              </div>

              {/* Seleção de localização no mapa (Padrão & Satélite) */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1">
                  Localização exata no mapa de Campos do Jordão
                </label>
                <AdminMapPicker
                  lat={lat}
                  lng={lng}
                  address={address}
                  spots={spots}
                  onChange={(newLat, newLng, suggestedAddress) => {
                    setLat(newLat);
                    setLng(newLng);
                    if (suggestedAddress) {
                      setAddress(suggestedAddress);
                    }
                  }}
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-black text-zinc-600 dark:text-zinc-400 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-black text-white bg-[#007AFF] hover:bg-blue-600 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
