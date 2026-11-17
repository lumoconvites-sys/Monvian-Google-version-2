import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  MapPin,
  Check,
  Sparkles,
  Info,
  Compass,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  EyeOff,
  Lightbulb,
  Search,
  Upload,
  Camera,
  Link as LinkIcon,
  RefreshCw,
  Layers,
  Layout,
  Tag,
  DollarSign,
  Calendar,
  Sparkle,
  Sun,
  Moon,
  Crown,
  Lock,
  ArrowRight
} from 'lucide-react';
import { fetchSpotsFromSupabase } from '../../services/supabaseSpots';
import { saveItineraryToSupabase } from '../../services/supabaseItineraries';
import { Spot, Itinerary, ItineraryCategory, ItineraryStatus } from '../../types';

interface AdminItineraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  itineraryToEdit?: Itinerary | null;
  categories: ItineraryCategory[];
}

const COVER_PRESETS = [
  { label: 'Jardins Amantikir', url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80' },
  { label: 'Serra da Mantiqueira', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80' },
  { label: 'Montanhas & Mirante', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80' },
  { label: 'Vila Capivari Inverno', url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80' },
  { label: 'Fondue & Gastronomia', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80' },
  { label: 'Trilha & Bosque de Pinhos', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=80' },
];

export const AdminItineraryModal: React.FC<AdminItineraryModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  itineraryToEdit,
  categories
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'cover' | 'builder' | 'appearance'>('info');
  const [availableSpots, setAvailableSpots] = useState<Spot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);

  // Spot picker search & category filter in Builder
  const [spotSearchQuery, setSpotSearchQuery] = useState('');
  const [spotCategoryFilter, setSpotCategoryFilter] = useState('all');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tips, setTips] = useState('');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0].url);
  const [daysCount, setDaysCount] = useState(2);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [price, setPrice] = useState('Grátis');
  const [status, setStatus] = useState<ItineraryStatus>('published');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPremium, setIsPremium] = useState(false); // false = Grátis, true = Elite Gold
  const [badgeText, setBadgeText] = useState('ELITE GOLD');
  const [showPrice, setShowPrice] = useState(true);
  const [showStopsCount, setShowStopsCount] = useState(true);
  const [showBadge, setShowBadge] = useState(true);

  // Upload States for Cover
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Preview Mode inside Admin Modal
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');

  // Days and Steps state
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [days, setDays] = useState<Array<{
    dayNumber: number;
    title: string;
    summary: string;
    steps: Array<{
      spotId: string;
      stepOrder: number;
      suggestedTime: string;
      durationMinutes: number;
      notes: string;
      customName?: string;
      customDescription?: string;
      customTip?: string;
      customImage?: string;
    }>;
  }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Spot photo upload tracking for steps
  const [uploadingStepIdx, setUploadingStepIdx] = useState<{ dayIdx: number; stepIdx: number } | null>(null);
  const stepFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch spots for selector
  useEffect(() => {
    if (!isOpen) return;
    const fetchSpots = async () => {
      try {
        setLoadingSpots(true);
        const spots = await fetchSpotsFromSupabase();
        if (Array.isArray(spots)) {
          setAvailableSpots(spots);
        }
      } catch (e) {
        console.error('Error fetching spots in AdminItineraryModal:', e);
      } finally {
        setLoadingSpots(false);
      }
    };
    fetchSpots();
  }, [isOpen]);

  // Populate data when editing or creating
  useEffect(() => {
    if (!isOpen) return;

    if (itineraryToEdit) {
      setTitle(itineraryToEdit.title || '');
      setDescription(itineraryToEdit.description || '');
      setTips(itineraryToEdit.tips || itineraryToEdit.notes || '');
      setCoverImage(itineraryToEdit.coverImage || COVER_PRESETS[0].url);
      setDaysCount(itineraryToEdit.daysCount || 1);
      setSelectedCategories(itineraryToEdit.categories || []);
      
      const hasGold = Boolean(itineraryToEdit.isPremium || (itineraryToEdit as any).isGold || (itineraryToEdit as any).is_gold);
      setIsPremium(hasGold);
      setPrice(itineraryToEdit.price || (hasGold ? '15 Plátanos' : 'Grátis'));
      setStatus(itineraryToEdit.status || (itineraryToEdit.isActive !== false ? 'published' : 'draft'));
      setIsFeatured(Boolean(itineraryToEdit.isFeatured || itineraryToEdit.isRecommended));
      setBadgeText(itineraryToEdit.badgeText || (hasGold ? '15 Plátanos' : ''));
      setShowPrice(itineraryToEdit.showPrice !== false);
      setShowStopsCount(itineraryToEdit.showStopsCount !== false);
      setShowBadge(itineraryToEdit.showBadge !== false);

      if (Array.isArray(itineraryToEdit.days) && itineraryToEdit.days.length > 0) {
        setDays(
          itineraryToEdit.days.map((d, dIdx) => ({
            dayNumber: d.dayNumber || dIdx + 1,
            title: d.title || `Dia ${dIdx + 1}`,
            summary: d.summary || '',
            steps: (d.steps || []).map((s, sIdx) => ({
              spotId: s.spotId || s.spot?.id || '',
              stepOrder: s.stepOrder || sIdx + 1,
              suggestedTime: s.suggestedTime || '09:30',
              durationMinutes: s.durationMinutes || 90,
              notes: s.notes || '',
              customName: s.customName || s.spot?.name || '',
              customDescription: s.customDescription || s.spot?.description || '',
              customTip: s.customTip || '',
              customImage: s.customImage || s.spot?.image || ''
            }))
          }))
        );
      } else {
        initializeDays(itineraryToEdit.daysCount || 1);
      }
    } else {
      // Reset for creating new
      setTitle('');
      setDescription('');
      setTips('');
      setCoverImage(COVER_PRESETS[0].url);
      setDaysCount(2);
      setSelectedCategories([]);
      setPrice('Grátis');
      setStatus('published');
      setIsFeatured(false);
      setIsPremium(false);
      setBadgeText('');
      setShowPrice(true);
      setShowStopsCount(true);
      setShowBadge(true);
      initializeDays(2);
    }
    setErrorMsg('');
    setActiveTab('info');
    setActiveDayIdx(0);
    setSpotSearchQuery('');
    setSpotCategoryFilter('all');
  }, [isOpen, itineraryToEdit]);

  const initializeDays = (count: number) => {
    const newDays = [];
    for (let i = 1; i <= count; i++) {
      newDays.push({
        dayNumber: i,
        title: `Dia ${i}: Experiências e Paradas`,
        summary: '',
        steps: []
      });
    }
    setDays(newDays);
  };

  const handleDaysCountChange = (newCount: number) => {
    setDaysCount(newCount);
    if (newCount > days.length) {
      const added: typeof days = [];
      for (let i = days.length + 1; i <= newCount; i++) {
        added.push({
          dayNumber: i,
          title: `Dia ${i}: Experiências e Paradas`,
          summary: '',
          steps: []
        });
      }
      setDays([...days, ...added]);
    } else if (newCount < days.length) {
      setDays(days.slice(0, newCount));
      if (activeDayIdx >= newCount) {
        setActiveDayIdx(newCount - 1);
      }
    }
  };

  const toggleCategory = (catId: string) => {
    if (selectedCategories.includes(catId)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
  };

  // Image upload and client-side compression
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
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
        img.onerror = () => reject(new Error('Falha ao processar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleCoverFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setCoverUploadError('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).');
      return;
    }
    setIsUploadingCover(true);
    setCoverUploadError('');
    try {
      const compressedDataUrl = await compressImage(file);
      setCoverImage(compressedDataUrl);
    } catch (err: any) {
      setCoverUploadError(err.message || 'Erro ao carregar imagem');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleStepCustomImageUpload = async (file: File) => {
    if (!uploadingStepIdx) return;
    if (!file.type.startsWith('image/')) return;

    try {
      const compressedDataUrl = await compressImage(file);
      updateStepField(uploadingStepIdx.dayIdx, uploadingStepIdx.stepIdx, 'customImage', compressedDataUrl);
    } catch (err) {
      console.error('Error uploading step image:', err);
    } finally {
      setUploadingStepIdx(null);
    }
  };

  // Add a specific spot from the catalog directly to active day
  const addSpotToActiveDay = (spot: Spot) => {
    const currentSteps = days[activeDayIdx]?.steps || [];
    const newStep = {
      spotId: spot.id,
      stepOrder: currentSteps.length + 1,
      suggestedTime: currentSteps.length === 0 ? '09:00' : '11:00',
      durationMinutes: 60,
      notes: '',
      customName: spot.name,
      customDescription: spot.description || '',
      customTip: '',
      customImage: spot.image || '',
    };

    setDays(prev => {
      const copy = [...prev];
      if (!copy[activeDayIdx]) return prev;
      copy[activeDayIdx] = {
        ...copy[activeDayIdx],
        steps: [...copy[activeDayIdx].steps, newStep]
      };
      return copy;
    });
  };

  const removeStepFromDay = (dayIndex: number, stepIndex: number) => {
    setDays(prev => {
      const copy = [...prev];
      const updatedSteps = copy[dayIndex].steps
        .filter((_, idx) => idx !== stepIndex)
        .map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
      copy[dayIndex] = { ...copy[dayIndex], steps: updatedSteps };
      return copy;
    });
  };

  const moveStep = (dayIndex: number, stepIndex: number, direction: 'up' | 'down') => {
    setDays(prev => {
      const copy = [...prev];
      const steps = [...copy[dayIndex].steps];
      const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;

      if (targetIndex < 0 || targetIndex >= steps.length) return prev;

      const temp = steps[stepIndex];
      steps[stepIndex] = steps[targetIndex];
      steps[targetIndex] = temp;

      // Reorder numbers
      const reindexed = steps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
      copy[dayIndex] = { ...copy[dayIndex], steps: reindexed };
      return copy;
    });
  };

  const updateStepField = (dayIndex: number, stepIndex: number, field: string, value: any) => {
    setDays(prev => {
      const copy = [...prev];
      const targetDay = { ...copy[dayIndex] };
      const steps = [...targetDay.steps];
      steps[stepIndex] = { ...steps[stepIndex], [field]: value };

      if (field === 'spotId') {
        const found = availableSpots.find(s => s.id === value);
        if (found) {
          steps[stepIndex].customName = found.name;
          steps[stepIndex].customImage = found.image;
        }
      }

      targetDay.steps = steps;
      copy[dayIndex] = targetDay;
      return copy;
    });
  };

  // Filter available spots in the builder tab
  const filteredSpotsForBuilder = useMemo(() => {
    let result = availableSpots;
    if (spotCategoryFilter !== 'all') {
      result = result.filter(s => (s.category || '').toLowerCase() === spotCategoryFilter.toLowerCase());
    }
    const q = spotSearchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.categoryLabel || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [availableSpots, spotCategoryFilter, spotSearchQuery]);

  // Unique categories for spot filter pills
  const spotCategories = useMemo(() => {
    const set = new Set<string>();
    availableSpots.forEach(s => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [availableSpots]);

  const handleSaveWithStatus = async (chosenStatus: ItineraryStatus) => {
    if (!title.trim()) {
      setErrorMsg('Por favor, informe o título do roteiro.');
      setActiveTab('info');
      return;
    }

    const totalSteps = days.reduce((acc, d) => acc + d.steps.length, 0);
    if (totalSteps === 0) {
      setErrorMsg('Adicione pelo menos uma parada ao roteiro na aba "3. Paradas do Roteiro".');
      setActiveTab('builder');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = {
      title: title.trim(),
      description: description.trim(),
      tips: tips.trim(),
      coverImage: coverImage.trim() || (itineraryToEdit ? itineraryToEdit.coverImage : COVER_PRESETS[0].url),
      daysCount,
      categories: selectedCategories,
      price: isPremium ? '15 Plátanos' : 'Grátis',
      platanosPrice: isPremium ? 15 : 0,
      status: chosenStatus,
      isActive: chosenStatus === 'published',
      isFeatured,
      isRecommended: isFeatured,
      isPremium,
      badgeText: isPremium ? '15 Plátanos' : '',
      showPrice: true,
      showStopsCount,
      showBadge: isPremium,
      notes: tips.trim(),
      days
    };

    try {
      const fullPayload = {
        ...payload,
        id: itineraryToEdit?.id
      };

      // 1. Persist directly and authoritatively to Supabase PostgreSQL (Single Source of Truth)
      await saveItineraryToSupabase(fullPayload, Boolean(itineraryToEdit?.id));

      try {
        window.dispatchEvent(new CustomEvent('monvian:itineraries_updated', { detail: { updatedItineraryId: itineraryToEdit?.id } }));
      } catch (e) {}

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving itinerary to Supabase:', err);
      setErrorMsg(err.message || 'Erro ao salvar roteiro no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalPlaces = days.reduce((acc, d) => acc + d.steps.length, 0);
  const currentDay = days[activeDayIdx] || days[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        
        {/* 1. Top Modal Header */}
        <div className="px-5 py-3.5 sm:py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-[#17191e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 bg-[#FFFFFF]/15 text-[#FFFFFF] border-[#FFFFFF]/30">
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                  {itineraryToEdit ? 'Configurações do Roteiro' : 'Novo Roteiro Turístico'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  status === 'published'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : status === 'draft'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30'
                }`}>
                  {status === 'published' ? 'Publicado' : status === 'draft' ? 'Rascunho' : 'Oculto'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                {totalPlaces} {totalPlaces === 1 ? 'parada' : 'paradas'} · {daysCount} {daysCount === 1 ? 'dia' : 'dias'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Tab Navigation */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 pt-1.5 bg-zinc-50/70 dark:bg-[#15171c] shrink-0 gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
              activeTab === 'info'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>1. Informações & Acesso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cover')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
              activeTab === 'cover'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>2. Foto de Capa</span>
            {coverImage && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'builder'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Paradas do Roteiro</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-white/20 text-zinc-900 dark:text-white font-black">
              {totalPlaces}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
              activeTab === 'appearance'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>4. Destaque na Loja</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: INFORMATIONS & ACCESS TYPE */}
          {activeTab === 'info' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* 1. Nome do Roteiro */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Nome do Roteiro *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Essência de Campos: O Clássico em 2 Dias"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white font-bold focus:outline-hidden focus:border-[#FFFFFF] shadow-2xs"
                />
              </div>

              {/* Status de Publicação */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-2">
                  Status de Publicação
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStatus('published')}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                      status === 'published'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181a20] text-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${status === 'published' ? 'text-emerald-500' : 'text-zinc-400'}`} />
                    <div>
                      <span className="block text-xs font-black">Publicado</span>
                      <span className="text-[11px] leading-tight opacity-80 block mt-0.5">Visível para os turistas na loja</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('draft')}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                      status === 'draft'
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 ring-2 ring-amber-500/20 shadow-2xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181a20] text-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${status === 'draft' ? 'text-amber-500' : 'text-zinc-400'}`} />
                    <div>
                      <span className="block text-xs font-black">Rascunho</span>
                      <span className="text-[11px] leading-tight opacity-80 block mt-0.5">Em edição (não aparece na loja)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('hidden')}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                      status === 'hidden'
                        ? 'border-zinc-500 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 ring-2 ring-zinc-500/20 shadow-2xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181a20] text-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    <EyeOff className={`w-4 h-4 shrink-0 mt-0.5 ${status === 'hidden' ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    <div>
                      <span className="block text-xs font-black">Oculto</span>
                      <span className="text-[11px] leading-tight opacity-80 block mt-0.5">Desativado / Arquivado</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Acesso & Monetização (Grátis vs 15 Plátanos) */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-2">
                  Tipo de Acesso (Plátanos)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPremium(false);
                      setPrice('Grátis');
                    }}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                      !isPremium
                        ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white ring-2 ring-black/10 dark:ring-white/20 shadow-2xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181a20] text-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${!isPremium ? 'text-emerald-500' : 'text-zinc-400'}`} />
                    <div>
                      <span className="block text-xs font-black">Grátis</span>
                      <span className="text-[11px] leading-tight opacity-80 block mt-0.5">
                        Acesso livre para todos os viajantes
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPremium(true);
                      setPrice('15 Plátanos');
                    }}
                    className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                      isPremium
                        ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white ring-2 ring-black/10 dark:ring-white/20 shadow-2xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181a20] text-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${isPremium ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`} />
                    <div>
                      <span className="block text-xs font-black">Pago · 15 Plátanos</span>
                      <span className="text-[11px] leading-tight opacity-80 block mt-0.5">
                        Desbloqueado com 15 Plátanos (R$ 29,90 via Stripe)
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Duração & Categorias */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Duração em Dias
                  </label>
                  <select
                    value={daysCount}
                    onChange={e => handleDaysCountChange(Number(e.target.value))}
                    className="w-full px-3.5 py-3 bg-zinc-50 dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white font-bold focus:outline-hidden focus:border-[#FFFFFF]"
                  >
                    <option value={1}>1 Dia (Bate e Volta / Expresso)</option>
                    <option value={2}>2 Dias (Fim de Semana)</option>
                    <option value={3}>3 Dias (Feriado Prolongado)</option>
                    <option value={4}>4 Dias (Experiência Completa)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Categorias do Roteiro (Filtros na Loja)
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1 pb-1">
                    {categories.map(cat => {
                      const selected = selectedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`h-[32px] px-3.5 rounded-full text-xs transition-all duration-200 ease-out flex items-center gap-1.5 cursor-pointer select-none active:scale-[0.96] ${
                            selected
                              ? 'bg-[#E5E5EA] dark:bg-white/20 text-zinc-900 dark:text-white border border-black/[0.06] dark:border-white/20 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.12)] font-semibold'
                              : 'bg-white dark:bg-[#1C1C1E] text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-white/10 shadow-[0_2px_5px_-1px_rgba(0,0,0,0.07),_0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_3px_8px_-1px_rgba(0,0,0,0.09)]'
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Descrição Completa do Roteiro
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Apresente os pontos fortes deste roteiro, o clima da experiência e o que os turistas irão desfrutar..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white font-medium focus:outline-hidden focus:border-[#FFFFFF] resize-none shadow-2xs"
                />
              </div>

              {/* Dicas */}
              <div>
                <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-[#FFFFFF]" />
                  <span>Dicas Exclusivas do Guia Local</span>
                </label>
                <textarea
                  rows={2}
                  value={tips}
                  onChange={e => setTips(e.target.value)}
                  placeholder="Dicas de vestimenta, horários de pico, reservas recomendadas, melhores mirantes..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white font-medium focus:outline-hidden focus:border-[#FFFFFF] resize-none shadow-2xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: FOTO DE CAPA */}
          {activeTab === 'cover' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-[#15171c] border border-zinc-200/90 dark:border-zinc-800/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-zinc-100 dark:border-zinc-800/60 pb-3.5">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tracking-tight">
                      Foto de capa
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                      Escolha uma imagem de alta qualidade para representar este roteiro.
                    </p>
                  </div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium shrink-0">
                    16:9 ou 4:3 recomendado
                  </span>
                </div>

                <input
                  type="file"
                  ref={coverFileInputRef}
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverFileUpload(file);
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDraggingCover(true);
                  }}
                  onDragLeave={() => setIsDraggingCover(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDraggingCover(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleCoverFileUpload(file);
                  }}
                  className={`border border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all flex flex-col items-center justify-center gap-2.5 ${
                    isDraggingCover
                      ? 'border-[#FFFFFF] bg-[#FFFFFF]/10'
                      : 'border-zinc-300/80 dark:border-zinc-700/80 bg-zinc-50/70 dark:bg-zinc-900/40 hover:border-[#FFFFFF] hover:bg-zinc-100/70 dark:hover:bg-zinc-900/70'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#FFFFFF]/10 text-[#FFFFFF] flex items-center justify-center shrink-0">
                    {isUploadingCover ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                      Arraste uma foto ou faça upload do seu computador
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      PNG, JPG ou WEBP até 10MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    disabled={isUploadingCover}
                    className="mt-1 px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer shadow-2xs"
                  >
                    {isUploadingCover ? 'Processando...' : 'Selecionar do Computador'}
                  </button>
                </div>

                {coverUploadError && (
                  <p className="text-xs text-red-500 font-semibold">{coverUploadError}</p>
                )}

                {/* Cover Preview & Presets */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                      Imagens Sugeridas de Campos do Jordão
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCoverUrlInput(!showCoverUrlInput)}
                      className="text-xs text-[#FFFFFF] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>{showCoverUrlInput ? 'Ocultar URL web' : 'Inserir URL web'}</span>
                    </button>
                  </div>

                  {showCoverUrlInput && (
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={coverImage}
                        onChange={e => setCoverImage(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="flex-1 px-3.5 py-2.5 bg-zinc-50 dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white font-medium focus:outline-hidden focus:border-[#FFFFFF]"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {COVER_PRESETS.map((preset, idx) => {
                      const isSelected = coverImage === preset.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCoverImage(preset.url)}
                          className={`text-left p-2.5 rounded-2xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#FFFFFF] bg-[#FFFFFF]/10 ring-2 ring-[#FFFFFF]'
                              : 'border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <img src={preset.url} alt={preset.label} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                          <div className="overflow-hidden min-w-0">
                            <span className={`text-xs font-bold block truncate ${
                              isSelected ? 'text-[#FFFFFF]' : 'text-zinc-800 dark:text-zinc-200'
                            }`}>
                              {preset.label}
                            </span>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Campos do Jordão</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: PARADAS DO ROTEIRO (SELEÇÃO EM LISTA INTUITIVA) */}
          {activeTab === 'builder' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Day selection tabs */}
              {days.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {days.map((d, dIdx) => (
                    <button
                      key={dIdx}
                      type="button"
                      onClick={() => setActiveDayIdx(dIdx)}
                      className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 border ${
                        activeDayIdx === dIdx
                          ? 'bg-[#FFFFFF] text-white border-blue-500 shadow-sm'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      Dia {d.dayNumber} ({d.steps.length} paradas)
                    </button>
                  ))}
                </div>
              )}

              {/* Day Details Bar */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-0.5">
                    Título do Dia {activeDayIdx + 1}
                  </label>
                  <input
                    type="text"
                    value={currentDay?.title || ''}
                    onChange={e => {
                      const copy = [...days];
                      copy[activeDayIdx] = { ...copy[activeDayIdx], title: e.target.value };
                      setDays(copy);
                    }}
                    placeholder={`Dia ${activeDayIdx + 1}: O Clássico de Capivari`}
                    className="w-full bg-transparent text-sm font-black text-zinc-900 dark:text-white outline-none"
                  />
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-[#FFFFFF]">
                    {currentDay?.steps.length || 0} {currentDay?.steps.length === 1 ? 'local adicionado' : 'locais adicionados'}
                  </span>
                </div>
              </div>

              {/* Hidden file input for step photo uploads */}
              <input
                type="file"
                ref={stepFileInputRef}
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleStepCustomImageUpload(file);
                }}
                className="hidden"
              />

              {/* TWO COLUMNS: CURRENT STOPS (LEFT) & SPOT CATALOG SELECTOR (RIGHT) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* LEFT COLUMN: Current Stops List */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#FFFFFF]" />
                      <span>Roteiro do Dia {activeDayIdx + 1} ({currentDay?.steps.length || 0})</span>
                    </h3>
                  </div>

                  {currentDay?.steps.length === 0 ? (
                    <div className="p-8 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 text-center space-y-2.5 bg-zinc-50/50 dark:bg-zinc-900/30">
                      <MapPin className="w-8 h-8 text-zinc-400 mx-auto" />
                      <p className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                        Nenhuma parada no Dia {activeDayIdx + 1} ainda.
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Selecione os pontos turísticos na lista ao lado para adicionar a este dia.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 no-scrollbar">
                      {currentDay?.steps.map((step, sIdx) => {
                        const stepNumber = String(sIdx + 1).padStart(2, '0');
                        const spotData = availableSpots.find(s => s.id === step.spotId);
                        const stepPhoto = step.customImage || spotData?.image;
                        const stepName = step.customName || spotData?.name || 'Local Turístico';

                        return (
                          <div
                            key={sIdx}
                            className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 space-y-2.5 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="w-6 h-6 rounded-full bg-[#FFFFFF] text-white font-black text-[11px] flex items-center justify-center shrink-0">
                                  {stepNumber}
                                </span>
                                
                                {stepPhoto ? (
                                  <img
                                    src={stepPhoto}
                                    alt={stepName}
                                    className="w-10 h-10 rounded-xl object-cover border border-zinc-300 dark:border-zinc-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                                    <Camera className="w-4 h-4" />
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate">
                                    {stepName}
                                  </h4>
                                  <span className="text-[10.5px] text-zinc-500 font-semibold block truncate">
                                    {spotData?.categoryLabel || spotData?.category || 'Atração'}
                                  </span>
                                </div>
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={sIdx === 0}
                                  onClick={() => moveStep(activeDayIdx, sIdx, 'up')}
                                  className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-20 hover:bg-zinc-200 cursor-pointer shadow-2xs"
                                  title="Subir"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={sIdx === (currentDay?.steps.length || 0) - 1}
                                  onClick={() => moveStep(activeDayIdx, sIdx, 'down')}
                                  className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-20 hover:bg-zinc-200 cursor-pointer shadow-2xs"
                                  title="Descer"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeStepFromDay(activeDayIdx, sIdx)}
                                  className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 hover:bg-red-200 cursor-pointer ml-1"
                                  title="Remover"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Timing inputs */}
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-400 mb-0.5">
                                  Horário Sugerido
                                </label>
                                <input
                                  type="text"
                                  value={step.suggestedTime}
                                  onChange={e => updateStepField(activeDayIdx, sIdx, 'suggestedTime', e.target.value)}
                                  placeholder="09:30"
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-zinc-400 mb-0.5">
                                  Duração Estimada (min)
                                </label>
                                <input
                                  type="number"
                                  value={step.durationMinutes}
                                  onChange={e => updateStepField(activeDayIdx, sIdx, 'durationMinutes', Number(e.target.value))}
                                  placeholder="60"
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: SEARCHABLE SPOT CATALOG */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-[#FFFFFF]" />
                      <span>Locais Turísticos Disponíveis ({filteredSpotsForBuilder.length})</span>
                    </h3>
                  </div>

                  {/* Search and Filters */}
                  <div className="space-y-2 bg-zinc-50 dark:bg-[#181a20] p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={spotSearchQuery}
                        onChange={e => setSpotSearchQuery(e.target.value)}
                        placeholder="Buscar local por nome..."
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-[#FFFFFF]"
                      />
                      {spotSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setSpotSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Category pills */}
                    <div className="category-carousel-container flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          setSpotCategoryFilter('all');
                          (e.currentTarget as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                        }}
                        className={`h-[28px] px-3 rounded-full text-[11px] font-medium shrink-0 transition-all duration-200 ease-out cursor-pointer select-none active:scale-[0.96] ${
                          spotCategoryFilter === 'all'
                            ? 'bg-[#E5E5EA] dark:bg-white/20 text-zinc-900 dark:text-white border border-black/[0.06] dark:border-white/20 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.1)] font-semibold'
                            : 'bg-white dark:bg-[#1C1C1E] text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-white/10 shadow-[0_1.5px_4px_rgba(0,0,0,0.06)]'
                        }`}
                      >
                        Todos
                      </button>
                      {spotCategories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={(e) => {
                            setSpotCategoryFilter(cat);
                            (e.currentTarget as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                          }}
                          className={`h-[28px] px-3 rounded-full text-[11px] font-medium shrink-0 capitalize transition-all duration-200 ease-out cursor-pointer select-none active:scale-[0.96] ${
                            spotCategoryFilter === cat
                              ? 'bg-[#E5E5EA] dark:bg-white/20 text-zinc-900 dark:text-white border border-black/[0.06] dark:border-white/20 shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.1)] font-semibold'
                              : 'bg-white dark:bg-[#1C1C1E] text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-white/10 shadow-[0_1.5px_4px_rgba(0,0,0,0.06)]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Spot items list */}
                  <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1 no-scrollbar">
                    {loadingSpots ? (
                      <div className="py-12 text-center text-xs text-zinc-400">
                        Carregando locais turísticos...
                      </div>
                    ) : filteredSpotsForBuilder.length === 0 ? (
                      <div className="py-12 text-center text-xs text-zinc-400">
                        Nenhum local turístico encontrado.
                      </div>
                    ) : (
                      filteredSpotsForBuilder.map(spot => {
                        const countInCurrentDay = (currentDay?.steps || []).filter(s => s.spotId === spot.id).length;

                        return (
                          <div
                            key={spot.id}
                            className="p-2.5 rounded-2xl bg-white dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img
                                src={spot.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=300&q=80'}
                                alt={spot.name}
                                className="w-11 h-11 rounded-xl object-cover shrink-0 border border-black/5 dark:border-white/10"
                                loading="lazy"
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate">
                                  {spot.name}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-bold text-zinc-500 capitalize">
                                    {spot.categoryLabel || spot.category || 'Ponto Turístico'}
                                  </span>
                                  {spot.priceRange && (
                                    <>
                                      <span className="text-[10px] text-zinc-400">·</span>
                                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        {spot.priceRange}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => addSpotToActiveDay(spot)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-2xs ${
                                countInCurrentDay > 0
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-zinc-900 text-white hover:bg-black group-hover:scale-102'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                              <span>{countInCurrentDay > 0 ? `Adicionado (${countInCurrentDay})` : 'Adicionar'}</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 4: DESTAQUE NA LOJA & LIVE PREVIEW */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column: Settings */}
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                      Destaque na Loja
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          Roteiro em Destaque
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Aparece no topo em "Roteiros em destaque"
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFeatured(!isFeatured)}
                        className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
                          isFeatured ? 'bg-[#FFFFFF]' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                            isFeatured ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                      Visibilidade dos Dados
                    </h3>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Mostrar Contagem de Paradas</span>
                      <input
                        type="checkbox"
                        checked={showStopsCount}
                        onChange={e => setShowStopsCount(e.target.checked)}
                        className="w-4 h-4 accent-[#FFFFFF] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Card Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                      Pré-visualização do Card na Loja
                    </span>
                    <div className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-800 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setPreviewTheme('dark')}
                        className={`p-1 rounded text-xs font-bold ${previewTheme === 'dark' ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-500'}`}
                        title="Modo Escuro"
                      >
                        <Moon className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTheme('light')}
                        className={`p-1 rounded text-xs font-bold ${previewTheme === 'light' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'}`}
                        title="Modo Claro"
                      >
                        <Sun className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Simulated Card in Shop */}
                  <div className={`p-4 rounded-3xl border transition-colors ${
                    previewTheme === 'light'
                      ? 'bg-[#f4f4f6] border-zinc-300 text-zinc-900'
                      : 'bg-[#000000] border-zinc-800 text-white'
                  }`}>
                    <div className={`rounded-2xl p-3.5 border transition-all ${
                      previewTheme === 'light'
                        ? 'bg-white border-zinc-200 shadow-sm text-zinc-900'
                        : 'bg-[#121418] border-white/10 text-white'
                    }`}>
                      <div className="aspect-16/9 rounded-xl overflow-hidden relative mb-2.5 bg-zinc-800">
                        {coverImage ? (
                          <img src={coverImage} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                            Sem imagem
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>{daysCount} {daysCount === 1 ? 'dia' : 'dias'} · {totalPlaces} {totalPlaces === 1 ? 'parada' : 'paradas'}</span>
                        </div>
                        <h4 className="text-sm font-black tracking-tight line-clamp-1">
                          {title || 'Título do Roteiro'}
                        </h4>
                        <p className="text-xs text-zinc-500 line-clamp-2">
                          {description || 'Descrição do roteiro que será exibida para os viajantes...'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* 10. Modal Footer Buttons */}
        <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/90 dark:bg-[#17191e] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSaveWithStatus('draft')}
              className="h-11 px-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center shadow-2xs"
            >
              Salvar como Rascunho
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSaveWithStatus('published')}
              className="h-11 px-5 rounded-2xl bg-zinc-900 text-white text-xs font-black hover:bg-black transition-colors cursor-pointer disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{itineraryToEdit ? 'Atualizar Roteiro' : 'Publicar Roteiro'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
