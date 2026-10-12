import React, { useState, useEffect, useRef } from 'react';
import { 
  X, MapPin, Upload, Image as ImageIcon, Check, Sparkles, AlertCircle, 
  Star, Trash2, Camera, RefreshCw, ChevronDown, ChevronUp, Link as LinkIcon 
} from 'lucide-react';
import { AdminMapPicker } from './AdminMapPicker';

interface AdminSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (savedSpot?: any) => void;
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
  const [rating, setRating] = useState<number>(4.8);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Itinerary settings
  const [availableForItinerary, setAvailableForItinerary] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState('');

  // Image Upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvancedImage, setShowAdvancedImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setRating(spotToEdit.rating !== undefined && spotToEdit.rating !== null && !isNaN(Number(spotToEdit.rating)) ? Number(spotToEdit.rating) : 4.8);
      setAvailableForItinerary(spotToEdit.availableForItinerary !== undefined ? Boolean(spotToEdit.availableForItinerary) : true);
      setDurationMinutes(spotToEdit.durationMinutes !== undefined ? Number(spotToEdit.durationMinutes) : 90);
      setTags(Array.isArray(spotToEdit.tags) ? spotToEdit.tags.join(', ') : (spotToEdit.tags || ''));
      setPrice(spotToEdit.price || '');
    } else {
      setName('');
      setCategory('attractions');
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
      setRating(4.8);
      setAvailableForItinerary(true);
      setDurationMinutes(90);
      setTags('');
      setPrice('');
    }
    setUploadError('');
    setErrorMsg('');
  }, [spotToEdit, isOpen, mode]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).');
      return;
    }

    setIsUploadingImage(true);
    setUploadError('');

    try {
      // Compress client-side with canvas for fast upload & crisp quality
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 1600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(e.target?.result as string);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.88);
            resolve(compressed);
          };
          img.onerror = () => reject(new Error('Erro ao carregar imagem'));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;
      // Immediately set the base64 preview so the user sees their selected photo
      setImage(base64Image);

      // Send to server upload endpoint for storage
      const res = await fetch('/api/admin/upload-spot-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          fileName: name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : file.name.split('.')[0]
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setImage(data.url);
      }
    } catch (err: any) {
      console.error(err);
      setUploadError('Erro ao enviar imagem. Tente novamente.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do local.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const categoryObj = CATEGORIES.find(c => c.id === category);
    const parsedRating = Math.max(1.0, Math.min(5.0, Number(rating) || 4.8));

    const payload = {
      name: name.trim(),
      category,
      categoryLabel: categoryObj?.label || category,
      description: description.trim(),
      touristTip: touristTip.trim(),
      image: image.trim() || (isEditing ? spotToEdit.image : PRESET_IMAGES[0].url),
      gallery: [image.trim() || (isEditing ? spotToEdit.image : PRESET_IMAGES[0].url)],
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
      badge: badge.trim(),
      rating: parsedRating,
      availableForItinerary: Boolean(availableForItinerary),
      durationMinutes: Number(durationMinutes) || 90,
      tags: tags.trim(),
      price: price.trim()
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

      const savedSpot = data.spot || {
        ...payload,
        id: data.id || (spotToEdit && spotToEdit.id) || `spot-${Date.now()}`
      };

      // Realtime map sync: update local cache and dispatch event
      try {
        const cached = localStorage.getItem('monvian_cached_spots');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            const exists = list.some((s: any) => s.id === savedSpot.id);
            const next = exists ? list.map((s: any) => s.id === savedSpot.id ? savedSpot : s) : [savedSpot, ...list];
            localStorage.setItem('monvian_cached_spots', JSON.stringify(next));
          }
        }
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('monvian:spots_updated', { detail: savedSpot }));

      onSaveSuccess(savedSpot);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar no banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-auto bg-white dark:bg-[#16181d] rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div>
            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              {isEditing ? 'Edição Oficial' : 'Novo Cadastro'}
            </span>
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">
              {isEditing ? `Editar: ${spotToEdit.name}` : mode === 'service' ? 'Cadastrar Novo Local ou Serviço' : 'Cadastrar Novo Ponto Turístico'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body with Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-black">1</span>
              Informações Principais
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Nome do Ponto / Estabelecimento *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Parque Capivari, Restaurante Baden..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Categoria *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
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
              <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                Descrição Completa
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva a atração, história, atrativos e o que o visitante encontrará..."
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                Dica do Guia / Dica Turística
              </label>
              <input
                type="text"
                value={touristTip}
                onChange={(e) => setTouristTip(e.target.value)}
                placeholder="Ex: O melhor horário para fotos no mirante é no entardecer."
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
              />
            </div>
          </div>

          {/* Section 2: Photo Upload (Instead of URL) */}
          <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-black">2</span>
                Foto do Ponto Turístico
              </h3>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Upload direto de imagem</span>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Image Upload Area or Active Preview */}
            {image ? (
              <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-900 shadow-sm group">
                <div className="h-56 sm:h-64 w-full relative">
                  <img
                    src={image}
                    alt="Foto do ponto turístico"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />

                  {/* Top Bar Controls */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black shadow-md">
                      <Check className="w-3.5 h-3.5" />
                      Foto Carregada
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-zinc-800/95 hover:bg-white text-zinc-900 dark:text-white text-xs font-black shadow-md backdrop-blur-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                      >
                        {isUploadingImage ? (
                          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <span>{isUploadingImage ? 'Enviando...' : 'Trocar Foto'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImage('')}
                        className="p-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white shadow-md backdrop-blur-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                        title="Remover foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Image Info */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                    <span className="font-medium truncate max-w-[70%] opacity-90">
                      {image.startsWith('/uploads/') ? 'Salva no servidor' : image.startsWith('data:') ? 'Foto otimizada pronta para salvar' : 'Imagem vinculada'}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-black text-blue-300 hover:text-white underline cursor-pointer"
                    >
                      Substituir foto
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-7 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 scale-[1.01]'
                    : 'border-zinc-300 dark:border-zinc-700 hover:border-blue-500 bg-zinc-50/70 dark:bg-zinc-900/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60'
                }`}
              >
                {isUploadingImage ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">Otimizando e enviando foto em alta qualidade...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-xs">
                      <Upload className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-black text-zinc-900 dark:text-white">
                      Clique para fazer upload da foto ou arraste o arquivo aqui
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                      Selecione imagens do seu dispositivo (JPG, PNG, WEBP). O sistema otimiza a foto automaticamente sem perda de nitidez.
                    </p>
                    <button
                      type="button"
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all pointer-events-none flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Selecionar Foto do Aparelho</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Collapsible secondary option: URL or presets */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedImage(!showAdvancedImage)}
                className="text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Opções adicionais (Colar URL ou selecionar foto padrão)</span>
                {showAdvancedImage ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvancedImage && (
                <div className="mt-3 p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[11px] font-black text-zinc-600 dark:text-zinc-300 mb-1">
                      URL Direta da Imagem (Opcional)
                    </label>
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <span className="block text-[11px] font-black text-zinc-600 dark:text-zinc-300 mb-1.5">Ou escolher imagem modelo de Campos do Jordão:</span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PRESET_IMAGES.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setImage(p.url)}
                          className={`relative h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                            image === p.url ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-700 opacity-70 hover:opacity-100'
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
              )}
            </div>
          </div>

          {/* Section 3: Interactive Location & Map Picker */}
          <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-black">3</span>
                Localização no Mapa Interativo
              </h3>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Sincroniza automaticamente com o mapa do Monvian</span>
            </div>

            <div>
              <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                Endereço por Extenso
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. José de Oliveira Damas, 500 - Vila Capivari"
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500"
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

          {/* Section 4: Rating (Editable Stars) & Details */}
          <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-center font-black">4</span>
              Avaliação (Estrelas), Horários e Status
            </h3>

            {/* EDITABLE STARS / RATING CARD */}
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Número de Estrelas / Avaliação Oficial *</span>
                </label>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-400/20 rounded-full border border-amber-300/60 dark:border-amber-700/60">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200">{rating.toFixed(1)} / 5.0</span>
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 ml-1">
                    {rating >= 4.9 ? 'Excepcional' : rating >= 4.7 ? 'Excelente' : rating >= 4.4 ? 'Muito Bom' : rating >= 4.0 ? 'Bom' : 'Regular'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {/* Interactive 5 stars with hover */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((starNum) => {
                    const activeRating = hoverRating !== null ? hoverRating : rating;
                    const isFilled = activeRating >= starNum;
                    const isHalf = !isFilled && activeRating >= starNum - 0.5;

                    return (
                      <button
                        key={starNum}
                        type="button"
                        onMouseEnter={() => setHoverRating(starNum)}
                        onMouseLeave={() => setHoverRating(null)}
                        onClick={() => setRating(starNum)}
                        className="p-1 hover:scale-125 active:scale-95 transition-all cursor-pointer focus:outline-none"
                        title={`Clique para definir ${starNum} estrelas`}
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            isFilled
                              ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                              : isHalf
                              ? 'text-amber-400 fill-amber-400/40'
                              : 'text-zinc-300 dark:text-zinc-600'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Numeric input with precision */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Nota precisa:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={rating}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setRating(Math.max(1.0, Math.min(5.0, Number(val.toFixed(1)))));
                      }
                    }}
                    className="w-20 px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-black text-zinc-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-xs"
                  />
                </div>
              </div>

              {/* Quick shortcut chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mr-1">Atalhos rápidos:</span>
                {[5.0, 4.9, 4.8, 4.7, 4.5, 4.0].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      rating === r
                        ? 'bg-amber-500 text-white shadow-xs scale-105'
                        : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-amber-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    ★ {r.toFixed(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Horário de Funcionamento
                </label>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="Ex: 09h às 18h"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Faixa de Preço
                </label>
                <select
                  value={priceRange}
                  onChange={(e: any) => setPriceRange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Grátis">Grátis (Sem custo)</option>
                  <option value="$">$ (Econômico)</option>
                  <option value="$$">$$ (Médio)</option>
                  <option value="$$$">$$$ (Sofisticado)</option>
                  <option value="$$$$">$$$$ (Premium / Luxo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Selo Especial / Badge (Opcional)
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="Ex: Imperdível, Charmosa"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(12) 3663-0000"
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Site Oficial / Link
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">Ativo no Mapa</span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>

              <label className="p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">Verificado</span>
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>

              <label className="p-3 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">Destaque Especial</span>
                <input
                  type="checkbox"
                  checked={highlighted}
                  onChange={(e) => setHighlighted(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>
            </div>

            {/* Roteiros & Itinerários settings */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                    Sistema de Roteiros
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Parâmetros para sugestão e inclusão em roteiros turísticos
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Disponível em Roteiros</span>
                  <input
                    type="checkbox"
                    checked={availableForItinerary}
                    onChange={(e) => setAvailableForItinerary(e.target.checked)}
                    className="w-4 h-4 accent-zinc-900 dark:accent-white rounded"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Tempo Médio (minutos)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="480"
                    step="15"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Preço / Ingresso
                  </label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: Grátis ou R$ 40"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Tags de Roteiro
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Ex: mirante, fotos, casal"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-black text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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

