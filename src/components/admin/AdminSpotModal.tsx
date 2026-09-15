import React, { useState, useEffect } from 'react';
import { X, MapPin, Upload, Image as ImageIcon, Check, Sparkles, AlertCircle } from 'lucide-react';
import { AdminMapPicker } from './AdminMapPicker';

interface AdminSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  spotToEdit?: any | null;
  mode?: 'spot' | 'service';
}

const CATEGORIES = [
  { id: 'attractions', label: 'Atração / Turístico' },
  { id: 'gastronomy', label: 'Restaurante / Gastronomia' },
  { id: 'hotels', label: 'Hotel / Pousada' },
  { id: 'cafes', label: 'Café & Bistrô' },
  { id: 'sweets', label: 'Chocolateria & Doces' },
  { id: 'nature', label: 'Natureza & Trilhas' },
  { id: 'viewpoint', label: 'Mirante & Pôr do Sol' },
  { id: 'parks', label: 'Parques & Lazer' },
  { id: 'pharmacies', label: 'Farmácia & Saúde' },
  { id: 'services', label: 'Serviços & Comércio' },
  { id: 'culture', label: 'Cultura & Museu' },
];

const PRESET_IMAGES = [
  { label: 'Parque / Natureza', url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80' },
  { label: 'Mirante / Montanha', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80' },
  { label: 'Restaurante / Fondue', url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80' },
  { label: 'Café & Chocolate', url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80' },
  { label: 'Hotel & Chalé', url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80' },
  { label: 'Arquitetura Europeia', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80' },
];

export const AdminSpotModal: React.FC<AdminSpotModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
  spotToEdit,
  mode = 'spot'
}) => {
  const isEditing = Boolean(spotToEdit);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('attractions');
  const [description, setDescription] = useState('');
  const [touristTip, setTouristTip] = useState('');
  const [image, setImage] = useState('');
  const [address, setAddress] = useState('Campos do Jordão, SP');
  const [hours, setHours] = useState('Todos os dias das 09h às 18h');
  const [priceRange, setPriceRange] = useState<'Grátis' | '$' | '$$' | '$$$' | '$$$$'>('$$');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [lat, setLat] = useState(-22.7394);
  const [lng, setLng] = useState(-45.5913);
  const [isActive, setIsActive] = useState(true);
  const [isVerified, setIsVerified] = useState(true);
  const [highlighted, setHighlighted] = useState(false);
  const [badge, setBadge] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (spotToEdit) {
      setName(spotToEdit.name || '');
      setCategory(spotToEdit.category || 'attractions');
      setDescription(spotToEdit.description || '');
      setTouristTip(spotToEdit.touristTip || '');
      setImage(spotToEdit.image || '');
      setAddress(spotToEdit.address || 'Campos do Jordão, SP');
      setHours(spotToEdit.hours || 'Todos os dias das 09h às 18h');
      setPriceRange(spotToEdit.priceRange || '$$');
      setWebsite(spotToEdit.website || '');
      setPhone(spotToEdit.phone || '');
      setLat(spotToEdit.lat || -22.7394);
      setLng(spotToEdit.lng || -45.5913);
      setIsActive(spotToEdit.isActive !== undefined ? spotToEdit.isActive : true);
      setIsVerified(spotToEdit.isVerified !== undefined ? spotToEdit.isVerified : true);
      setHighlighted(Boolean(spotToEdit.highlighted));
      setBadge(spotToEdit.badge || '');
    } else {
      setName('');
      setCategory(mode === 'service' ? 'hotels' : 'attractions');
      setDescription('');
      setTouristTip('');
      setImage(PRESET_IMAGES[0].url);
      setAddress('Campos do Jordão, SP');
      setHours('Todos os dias das 09h às 18h');
      setPriceRange('$$');
      setWebsite('');
      setPhone('');
      setLat(-22.7340);
      setLng(-45.5910);
      setIsActive(true);
      setIsVerified(true);
      setHighlighted(false);
      setBadge('');
    }
    setErrorMsg('');
  }, [spotToEdit, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do local.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const categoryObj = CATEGORIES.find(c => c.id === category);
    const payload = {
      name: name.trim(),
      category,
      categoryLabel: categoryObj?.label || category,
      description: description.trim(),
      touristTip: touristTip.trim(),
      image: image.trim() || PRESET_IMAGES[0].url,
      gallery: [image.trim() || PRESET_IMAGES[0].url],
      address: address.trim(),
      hours: hours.trim(),
      priceRange,
      website: website.trim(),
      phone: phone.trim(),
      lat,
      lng,
      isActive,
      isVerified,
      highlighted,
      badge: badge.trim()
    };

    try {
      const url = isEditing ? `/api/admin/spots/${spotToEdit.id}` : '/api/admin/spots';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar informações.');
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar no banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-auto bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-zinc-50/50">
          <div>
            <span className="text-[11px] font-black text-blue-600 tracking-wider uppercase">
              {isEditing ? 'Edição Oficial' : 'Novo Cadastro'}
            </span>
            <h2 className="text-xl font-black text-zinc-900">
              {isEditing ? `Editar: ${spotToEdit.name}` : mode === 'service' ? 'Cadastrar Novo Local ou Serviço' : 'Cadastrar Novo Ponto Turístico'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body with Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-zinc-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-black">1</span>
              Informações Principais
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1.5">
                  Nome do Ponto / Estabelecimento *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Parque Capivari, Restaurante Baden..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1.5">
                  Categoria *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-1.5">
                Descrição Completa
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva a atração, história, atrativos e o que o visitante encontrará..."
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-1.5">
                Dica do Guia / Dica Turística
              </label>
              <input
                type="text"
                value={touristTip}
                onChange={(e) => setTouristTip(e.target.value)}
                placeholder="Ex: O melhor horário para fotos no mirante é no entardecer."
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Section 2: Image & Gallery */}
          <div className="space-y-4 pt-2 border-t border-zinc-100">
            <h3 className="text-sm font-black text-zinc-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-black">2</span>
              Imagem do Local
            </h3>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-1.5">
                URL da Imagem Principal
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick preset selector */}
            <div>
              <span className="block text-[11px] font-black text-zinc-500 mb-1.5">Ou escolha uma imagem padrão de Campos do Jordão:</span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_IMAGES.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImage(p.url)}
                    className={`relative h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      image === p.url ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-zinc-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5 truncate px-1">
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Interactive Location & Map Picker */}
          <div className="space-y-4 pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-black">3</span>
                Localização no Mapa Interativo
              </h3>
              <span className="text-[11px] text-zinc-500">Sincroniza automaticamente com o mapa do Monvian</span>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 mb-1.5">
                Endereço por Extenso
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. José de Oliveira Damas, 500 - Vila Capivari"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Real Map Coordinate Picker */}
            <AdminMapPicker
              lat={lat}
              lng={lng}
              address={address}
              onChange={(newLat, newLng, addressSuggestion) => {
                setLat(newLat);
                setLng(newLng);
                if (addressSuggestion && (!address || address === 'Campos do Jordão, SP')) {
                  setAddress(addressSuggestion.split(',').slice(0, 3).join(', '));
                }
              }}
            />
          </div>

          {/* Section 4: Details & Settings */}
          <div className="space-y-4 pt-2 border-t border-zinc-100">
            <h3 className="text-sm font-black text-zinc-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-black">4</span>
              Horários, Contatos e Status
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1.5">
                  Horário de Funcionamento
                </label>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="Ex: 09h às 18h"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1.5">
                  Faixa de Preço
                </label>
                <select
                  value={priceRange}
                  onChange={(e: any) => setPriceRange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="Grátis">Grátis (Sem custo)</option>
                  <option value="$">$ (Econômico)</option>
                  <option value="$$">$$ (Médio)</option>
                  <option value="$$$">$$$ (Sofisticado)</option>
                  <option value="$$$$">$$$$ (Premium / Luxo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1.5">
                  Selo Especial / Badge (Opcional)
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="Ex: Imperdível, Charmosa"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1.5">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(12) 3663-0000"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 mb-1.5">
                  Site Oficial / Link
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-zinc-100 transition-colors">
                <span className="text-xs font-black text-zinc-800">Ativo no Mapa</span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#00C896] rounded"
                />
              </label>

              <label className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-zinc-100 transition-colors">
                <span className="text-xs font-black text-zinc-800">Verificado</span>
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="w-4 h-4 accent-[#00C896] rounded"
                />
              </label>

              <label className="p-3 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-zinc-100 transition-colors">
                <span className="text-xs font-black text-zinc-800">Destaque Especial</span>
                <input
                  type="checkbox"
                  checked={highlighted}
                  onChange={(e) => setHighlighted(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Salvando no banco...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar e Publicar'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
