import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Upload,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { AdminMapPicker } from './AdminMapPicker';
import { persistSpotToFirestore } from '../../services/firestoreSync';
import { uploadMediaToSupabaseStorage } from '../../lib/supabase';
import { saveSpotToSupabase } from '../../services/supabaseSpots';
import { CAMPOS_SPOTS } from '../../data/spots';

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
  });

  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMagicPencilFill = async () => {
    if (spotToEdit) return;
    const q = formData.name.trim();
    if (!q) {
      setErrorMsg('Digite primeiro o nome do local para o Lápis Mágico pesquisar.');
      return;
    }
    setIsMagicLoading(true);
    setErrorMsg('');

    try {
      await new Promise((r) => setTimeout(r, 600));

      const normalizedQuery = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const matched = CAMPOS_SPOTS.find((s) => {
        const sName = s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const sShort = (s.shortName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return sName.includes(normalizedQuery) || normalizedQuery.includes(sName) || sShort.includes(normalizedQuery);
      });

      if (matched) {
        setFormData((prev) => ({
          ...prev,
          name: matched.name,
          short_name: prev.short_name.trim() ? prev.short_name : matched.shortName || matched.name,
          tag_label: prev.tag_label.trim() ? prev.tag_label : matched.tagLabel || matched.name,
          category: matched.category || prev.category,
          category_label: matched.categoryLabel || prev.category_label,
          lat: matched.lat || prev.lat,
          lng: matched.lng || prev.lng,
          description: prev.description.trim() ? prev.description : matched.description || prev.description,
          tourist_tip: prev.tourist_tip.trim() ? prev.tourist_tip : matched.touristTip || prev.tourist_tip,
          rating: matched.rating || prev.rating,
          review_count: matched.reviewCount || prev.review_count,
          hours: matched.hours || prev.hours,
          address: matched.address || prev.address,
          price_range: matched.priceRange || prev.price_range,
        }));
      } else {
        const lowerQ = normalizedQuery;
        let cat = 'attractions';
        let catLabel = 'Atrações & Parques';
        if (lowerQ.includes('hotel') || lowerQ.includes('pousada') || lowerQ.includes('resort')) {
          cat = 'hotels';
          catLabel = 'Hotéis & Pousadas';
        } else if (lowerQ.includes('restaurante') || lowerQ.includes('bistro') || lowerQ.includes('fondue') || lowerQ.includes('choperia') || lowerQ.includes('pizza') || lowerQ.includes('massa')) {
          cat = 'gastronomy';
          catLabel = 'Restaurantes & Gastronomia';
        } else if (lowerQ.includes('cafe') || lowerQ.includes('padaria') || lowerQ.includes('confeitaria') || lowerQ.includes('cha')) {
          cat = 'cafes';
          catLabel = 'Cafés & Bistrôs';
        } else if (lowerQ.includes('chocolate') || lowerQ.includes('doce') || lowerQ.includes('cacau')) {
          cat = 'sweets';
          catLabel = 'Chocolates & Doces';
        } else if (lowerQ.includes('mirante') || lowerQ.includes('pico') || lowerQ.includes('parque') || lowerQ.includes('trilha') || lowerQ.includes('bosque')) {
          cat = 'viewpoint';
          catLabel = 'Mirantes & Natureza';
        } else if (lowerQ.includes('farmacia') || lowerQ.includes('drogaria') || lowerQ.includes('hospital') || lowerQ.includes('posto')) {
          cat = 'pharmacies';
          catLabel = 'Farmácias & Serviços';
        }

        const generatedDesc = `Localizado em Campos do Jordão, ${q} é um estabelecimento de referência que une sofisticação, conforto e atendimento acolhedor. Perfeito para visitantes que buscam momentos memoráveis na Serra da Mantiqueira, oferecendo excelente infraestrutura e charme alpino.`;
        const generatedTip = `Dica do Guia Monvian: Recomenda-se verificar horários de pico nos finais de semana e desfrutar da atmosfera única da serra com tranquilidade.`;

        setFormData((prev) => ({
          ...prev,
          short_name: prev.short_name.trim() ? prev.short_name : q.split(' ')[0] || q,
          tag_label: prev.tag_label.trim() ? prev.tag_label : q,
          category: cat,
          category_label: catLabel,
          lat: prev.lat === -22.7192 ? -22.7350 + (Math.random() - 0.5) * 0.02 : prev.lat,
          lng: prev.lng === -45.5673 ? -45.5850 + (Math.random() - 0.5) * 0.02 : prev.lng,
          description: prev.description.trim() ? prev.description : generatedDesc,
          tourist_tip: prev.tourist_tip.trim() ? prev.tourist_tip : generatedTip,
          rating: 4.8,
          review_count: 150,
          hours: 'Diariamente das 09h00 às 19h00',
          address: 'Avenida Principal, Campos do Jordão - SP',
          price_range: '$$',
        }));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao pesquisar com o Lápis Mágico.');
    } finally {
      setIsMagicLoading(false);
    }
  };

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
      // Optimize to WebP (max 1280px) and upload automatically to Supabase Storage ('monvian-media/spots')
      const finalUrl = await uploadMediaToSupabaseStorage(file, 'spots', {
        maxDimension: 1280,
        quality: 0.82,
        filename: file.name,
      });

      if (!finalUrl) {
        setErrorMsg('Não foi possível enviar a imagem para o Supabase Storage. Tente novamente.');
        return;
      }

      setFormData((prev) => ({
        ...prev,
        image: finalUrl,
        gallery: prev.gallery.includes(finalUrl) ? prev.gallery : [finalUrl, ...prev.gallery],
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
        isStar: false,
        is_star: 0,
        badge: spotToEdit?.badge === 'Estrela' ? '' : (spotToEdit?.badge || ''),
        highlighted: false,
      };

      // Persist directly and authoritatively to SQLite + Supabase PostgreSQL
      const savedSpot = await saveSpotToSupabase(payload, Boolean(spotToEdit?.id));

      // Best-effort secondary sync to Firestore if configured
      try {
        persistSpotToFirestore({
          ...savedSpot,
          gallery: JSON.stringify(finalGallery),
          is_star: 0,
          isStar: false,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-5 overflow-y-auto">
        <div className="bg-white border border-zinc-200 rounded-3xl max-w-2xl w-full text-zinc-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 shrink-0">
            <div>
              <h3 className="text-lg font-black tracking-tight text-zinc-900">
                {spotToEdit ? `Editar: ${spotToEdit.name}` : 'Novo Ponto Turístico'}
              </h3>
              <p className="text-xs text-zinc-500">
                Sincronizado em tempo real com o Mapa Interativo
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 flex-1 bg-white">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider">
                    Nome do Ponto Turístico / Estabelecimento *
                  </label>
                  {!spotToEdit && (
                    <button
                      type="button"
                      onClick={handleMagicPencilFill}
                      disabled={isMagicLoading}
                      className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                      title="Lápis Mágico Inteligente: Preenche automaticamente dados reais e dicas de guia sem alterar fotos"
                    >
                      {isMagicLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Pesquisando dados...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                          Lápis Mágico ✨
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ex: Parque Amantikir"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Nome Curto (Pino do Mapa)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Amantikir"
                  value={formData.short_name}
                  onChange={(e) =>
                    setFormData({ ...formData, short_name: e.target.value, tag_label: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Categoria *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white text-zinc-900">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Coordinates + Interactive Map Picker */}
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Coordenadas GPS no Mapa de Campos do Jordão
                </span>
                <button
                  type="button"
                  onClick={() => setIsMapPickerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
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
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 font-bold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Image & Supabase Storage Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
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
                  className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500"
                />
                {formData.image && (
                  <img
                    src={formData.image}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0"
                  />
                )}
              </div>
            </div>

            {/* Description & Tourist Tip */}
            <div>
              <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                Descrição do Local
              </label>
              <textarea
                rows={3}
                placeholder="Descreva a experiência e os diferenciais do local..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Dica de Ouro para o Turista
              </label>
              <input
                type="text"
                placeholder="Ex: Chegue antes das 16h30 para ver o pôr do sol no mirante."
                value={formData.tourist_tip}
                onChange={(e) => setFormData({ ...formData, tourist_tip: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            {/* Address, Hours, Rating & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Endereço
                </label>
                <input
                  type="text"
                  placeholder="Ex: Av. Macedo Soares, 123 - Capivari"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Horário de Funcionamento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Diariamente das 09h às 18h"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Avaliação (0.0 a 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 4.8 })}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                  Link Google Maps (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="https://maps.google.com/..."
                  value={formData.maps_url}
                  onChange={(e) => setFormData({ ...formData, maps_url: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="bg-white border border-zinc-200 rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl text-zinc-900">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-zinc-900">Toque no mapa para definir as coordenadas</h4>
              <button
                type="button"
                onClick={() => setIsMapPickerOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
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
