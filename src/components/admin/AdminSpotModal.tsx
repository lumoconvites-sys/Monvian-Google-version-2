import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  Clock,
  Star,
  Sparkles,
  Globe,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';
import { AdminMapPicker } from './AdminMapPicker';
import { persistSpotToFirestore } from '../../services/firestoreSync';
import { uploadMediaToSupabaseStorage } from '../../lib/supabase';
import { saveSpotToSupabase } from '../../services/supabaseSpots';

export interface AdminSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  spotToEdit?: any;
  onSaveSuccess?: (savedSpot: any) => void;
}

const CATEGORIES = [
  { id: 'attractions', label: 'Atrações & Parques' },
  { id: 'gastronomy', label: 'Restaurantes & Gastronomia' },
  { id: 'hotels', label: 'Hotéis & Pousadas' },
  { id: 'cafes', label: 'Cafés & Bistrôs' },
  { id: 'sweets', label: 'Chocolates & Doces' },
  { id: 'viewpoint', label: 'Mirantes & Natureza' },
  { id: 'pharmacies', label: 'Farmácias & Serviços' },
];

export const AdminSpotModal: React.FC<AdminSpotModalProps> = ({
  isOpen,
  onClose,
  spotToEdit,
  onSaveSuccess,
}) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    short_name: '',
    tag_label: '',
    category: 'attractions',
    category_label: 'Atrações & Parques',
    lat: -22.7192,
    lng: -45.5673,
    image: '',
    gallery: [] as string[],
    description: '',
    tourist_tip: '',
    rating: 4.8,
    review_count: 120,
    hours: '09:00 às 18:00',
    address: 'Campos do Jordão, SP',
    price_range: '$$',
    price: 'Entrada Franca',
    maps_url: '',
    is_active: 1,
    is_star: 0,
  });

  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (spotToEdit) {
      let parsedGallery: string[] = [];
      if (Array.isArray(spotToEdit.gallery)) {
        parsedGallery = spotToEdit.gallery;
      } else if (typeof spotToEdit.gallery === 'string' && spotToEdit.gallery.trim()) {
        try {
          const g = JSON.parse(spotToEdit.gallery);
          if (Array.isArray(g)) parsedGallery = g;
        } catch {
          parsedGallery = spotToEdit.gallery.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      const editIsStar =
        spotToEdit.is_star !== undefined && spotToEdit.is_star !== null
          ? Number(spotToEdit.is_star) === 1 || spotToEdit.is_star === true
          : spotToEdit.isStar !== undefined
            ? Boolean(spotToEdit.isStar)
            : spotToEdit.badge === 'Estrela';

      setFormData({
        id: spotToEdit.id || '',
        name: spotToEdit.name || '',
        short_name: spotToEdit.short_name || spotToEdit.shortName || spotToEdit.name || '',
        tag_label: spotToEdit.tag_label || spotToEdit.tagLabel || spotToEdit.shortName || spotToEdit.name || '',
        category: spotToEdit.category || 'attractions',
        category_label:
          spotToEdit.category_label ||
          spotToEdit.categoryLabel ||
          CATEGORIES.find((c) => c.id === spotToEdit.category)?.label ||
          'Atrações & Parques',
        lat: Number(spotToEdit.lat ?? -22.7192),
        lng: Number(spotToEdit.lng ?? -45.5673),
        image: spotToEdit.image || '',
        gallery: parsedGallery,
        description: spotToEdit.description || '',
        tourist_tip: spotToEdit.tourist_tip || spotToEdit.touristTip || '',
        rating: Number(spotToEdit.rating ?? 4.8),
        review_count: Number(spotToEdit.review_count ?? spotToEdit.reviewCount ?? 120),
        hours: spotToEdit.hours || '09:00 às 18:00',
        address: spotToEdit.address || 'Campos do Jordão, SP',
        price_range: spotToEdit.price_range || spotToEdit.priceRange || '$$',
        price: spotToEdit.price || 'Entrada Franca',
        maps_url: spotToEdit.maps_url || spotToEdit.mapsUrl || '',
        is_active: spotToEdit.is_active !== undefined ? Number(spotToEdit.is_active) : spotToEdit.isActive === false ? 0 : 1,
        is_star: editIsStar ? 1 : 0,
      });
    } else {
      setFormData({
        id: '',
        name: '',
        short_name: '',
        tag_label: '',
        category: 'attractions',
        category_label: 'Atrações & Parques',
        lat: -22.7192,
        lng: -45.5673,
        image: '',
        gallery: [],
        description: '',
        tourist_tip: '',
        rating: 4.8,
        review_count: 120,
        hours: '09:00 às 18:00',
        address: 'Campos do Jordão, SP',
        price_range: '$$',
        price: 'Entrada Franca',
        maps_url: '',
        is_active: 1,
        is_star: 0,
      });
    }
  }, [spotToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (catId: string) => {
    const found = CATEGORIES.find((c) => c.id === catId);
    setFormData((prev) => ({
      ...prev,
      category: catId,
      category_label: found ? found.label : catId,
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setErrorMsg('');

    try {
      // 1. Compress image via canvas first so fallback or upload is fast
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_W = 1200;
            let w = img.width;
            let h = img.height;
            if (w > MAX_W) {
              h = Math.round((h * MAX_W) / w);
              w = MAX_W;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            } else {
              resolve(ev.target?.result as string);
            }
          };
          img.onerror = reject;
          img.src = ev.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Upload to Supabase Storage bucket ('monvian-media') or backend '/api/admin/upload'
      let finalUrl = await uploadMediaToSupabaseStorage(file, 'spots');
      if (!finalUrl) {
        try {
          const token = localStorage.getItem('monvian_token');
          const res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              imageBase64: base64DataUrl,
              folder: 'spots',
              filename: file.name,
            }),
          });
          const data = await res.json();
          if (data.success && data.url) {
            finalUrl = data.url;
          }
        } catch {}
      }

      const resolvedImage = finalUrl || base64DataUrl;
      setFormData((prev) => ({
        ...prev,
        image: resolvedImage,
        gallery: prev.gallery.includes(resolvedImage) ? prev.gallery : [resolvedImage, ...prev.gallery],
      }));
    } catch {
      setErrorMsg('Não foi possível processar a imagem selecionada.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Informe o nome do ponto turístico.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const spotId =
        spotToEdit?.id ||
        formData.id ||
        `spot-${formData.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;

      const finalGallery =
        formData.gallery.length > 0
          ? formData.gallery
          : formData.image
            ? [formData.image]
            : [];

      const isStarBool = formData.is_star === 1;

      const payload = {
        ...formData,
        id: spotId,
        name: formData.name.trim(),
        short_name: (formData.short_name || formData.name).trim(),
        shortName: (formData.short_name || formData.name).trim(),
        tag_label: (formData.tag_label || formData.short_name || formData.name).trim(),
        tagLabel: (formData.tag_label || formData.short_name || formData.name).trim(),
        category_label: formData.category_label,
        categoryLabel: formData.category_label,
        lat: Number(formData.lat),
        lng: Number(formData.lng),
        gallery: finalGallery,
        touristTip: formData.tourist_tip,
        reviewCount: Number(formData.review_count),
        priceRange: formData.price_range,
        mapsUrl: formData.maps_url,
        isActive: formData.is_active === 1,
        isStar: isStarBool,
        is_star: isStarBool ? 1 : 0,
        badge: isStarBool ? 'Estrela' : '',
        highlighted: isStarBool,
      };

      // Persist directly and authoritatively to SQLite + Supabase PostgreSQL
      const savedSpot = await saveSpotToSupabase(payload, Boolean(spotToEdit?.id));

      // Best-effort secondary sync to Firestore if configured
      try {
        persistSpotToFirestore({
          ...savedSpot,
          gallery: JSON.stringify(finalGallery),
          is_star: isStarBool ? 1 : 0,
          isStar: isStarBool,
        }).catch(() => {});
      } catch {}

      onSaveSuccess?.(savedSpot);
      onClose();
    } catch (err: any) {
      console.error('Error saving spot:', err);
      setErrorMsg(err.message || 'Erro ao salvar ponto turístico.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
        <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-2xl w-full text-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-950/60 shrink-0">
            <div>
              <h3 className="text-lg font-black tracking-tight">
                {spotToEdit ? `Editar: ${spotToEdit.name}` : 'Novo Ponto Turístico'}
              </h3>
              <p className="text-xs text-zinc-400">
                Sincronizado em tempo real com o Mapa Interativo
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
                {errorMsg}
              </div>
            )}

            {/* Opção "Estrela" — Ponto Mais Famoso no Mapa (Estrela Amarela Pulsante com Foto) */}
            <div
              onClick={() =>
                setFormData((prev) => ({ ...prev, is_star: prev.is_star === 1 ? 0 : 1 }))
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFormData((prev) => ({ ...prev, is_star: prev.is_star === 1 ? 0 : 1 }));
                }
              }}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between gap-4 ${
                formData.is_star === 1
                  ? 'bg-[#FFD60A]/12 border-[#FFD60A] shadow-[0_0_24px_rgba(255,214,10,0.18)]'
                  : 'bg-zinc-950/90 border-white/10 hover:border-white/25'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                    formData.is_star === 1
                      ? 'bg-[#FFD60A] text-black shadow-[0_0_16px_rgba(255,214,10,0.65)] monvian-star-pulse'
                      : 'bg-zinc-900 border border-white/10 text-zinc-400'
                  }`}
                >
                  <Star
                    className={`w-6 h-6 ${
                      formData.is_star === 1 ? 'fill-black text-black' : 'text-zinc-400'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white tracking-tight">
                      Estrela
                    </span>
                    {formData.is_star === 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FFD60A] text-black text-[10px] font-black uppercase tracking-wider">
                        Ativado no Mapa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                    Destacar como ponto famoso: aparece automaticamente como uma estrela amarela pulsante com a foto no meio no mapa.
                  </p>
                </div>
              </div>

              {/* iOS-style switch */}
              <div
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  formData.is_star === 1 ? 'bg-[#FFD60A]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                    formData.is_star === 1 ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nome do Ponto Turístico / Estabelecimento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Parque Amantikir"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nome Curto (Pino do Mapa)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Amantikir"
                  value={formData.short_name}
                  onChange={(e) =>
                    setFormData({ ...formData, short_name: e.target.value, tag_label: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Categoria *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Coordinates + Interactive Map Picker */}
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  Coordenadas GPS no Mapa de Campos do Jordão
                </span>
                <button
                  type="button"
                  onClick={() => setIsMapPickerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  Selecionar no Mapa
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 font-bold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 font-bold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>

            {/* Image & Supabase Storage Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Foto Principal (URL ou Upload Supabase Storage)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Enviar Foto
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="https://... ou envie do dispositivo"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="flex-1 px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
                {formData.image && (
                  <img
                    src={formData.image}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                )}
              </div>
            </div>

            {/* Description & Tourist Tip */}
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Descrição do Local
              </label>
              <textarea
                rows={3}
                placeholder="Descreva a experiência e os diferenciais do local..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Dica de Ouro para o Turista
              </label>
              <input
                type="text"
                placeholder="Ex: Chegue antes das 16h30 para ver o pôr do sol no mirante."
                value={formData.tourist_tip}
                onChange={(e) => setFormData({ ...formData, tourist_tip: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Address, Hours, Rating & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Endereço
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Macedo Soares, 123 - Capivari"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Horário de Funcionamento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Diariamente das 09h às 18h"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Avaliação (0.0 a 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 4.8 })}
                  className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Link Google Maps (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="https://maps.google.com/..."
                  value={formData.maps_url}
                  onChange={(e) => setFormData({ ...formData, maps_url: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-950 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando no Supabase...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Salvar Ponto Turístico
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {isMapPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-900 border border-white/15 rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white">Toque no mapa para definir as coordenadas</h4>
              <button
                type="button"
                onClick={() => setIsMapPickerOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
              >
                Concluir
              </button>
            </div>
            <AdminMapPicker
              lat={formData.lat}
              lng={formData.lng}
              onChange={(lat, lng) => {
                setFormData((prev) => ({ ...prev, lat, lng }));
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AdminSpotModal;
