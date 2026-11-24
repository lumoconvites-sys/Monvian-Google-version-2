import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion, useDragControls } from 'motion/react';
import { uploadMediaToSupabaseStorage } from '../../lib/supabase';
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
  Calendar,
  Megaphone,
  FileText,
} from 'lucide-react';
import { PlatanoLeafIcon } from '../platanos/PlatanoLeafIcon';
import { fetchSpotsFromSupabase } from '../../services/supabaseSpots';
import {
  saveItineraryToSupabase,
  STORE_SECTION_OPTIONS,
  extractStoreSectionsFromItinerary,
  buildCategoriesForStoreSections,
  type StoreSectionId,
} from '../../services/supabaseItineraries';
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

type StepTabId = 'info' | 'cover' | 'builder' | 'appearance';

interface SectionHeadingProps {
  icon: React.ReactNode;
  title: string;
  rightSlot?: React.ReactNode;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, title, rightSlot }) => (
  <div className="flex items-center justify-between gap-2 mb-2.5">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-8 h-8 rounded-full bg-[#F2F3F5] text-[#111827] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="text-[14.5px] font-bold text-[#111827] tracking-[-0.015em] truncate">
        {title}
      </span>
    </div>
    {rightSlot && <div className="shrink-0">{rightSlot}</div>}
  </div>
);

interface IOSToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}

const IOSToggle: React.FC<IOSToggleProps> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`w-[46px] h-[27px] rounded-full transition-colors duration-200 relative shrink-0 cursor-pointer ${
      checked ? 'bg-[#22C55E]' : 'bg-[#E2E5EA]'
    }`}
  >
    <span
      className={`block w-[21px] h-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 ${
        checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

const INPUT_BASE_CLASS =
  'w-full px-4 bg-[#F7F8FA] border border-[#E6E8EC] rounded-[18px] text-[14.5px] text-[#111827] font-medium placeholder:text-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/12 transition-all';

export const AdminItineraryModal: React.FC<AdminItineraryModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  itineraryToEdit,
  categories,
}) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const sheetDragControls = useDragControls();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<StepTabId>('info');
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
  const [selectedStoreSections, setSelectedStoreSections] = useState<StoreSectionId[]>(['all']);
  const [price, setPrice] = useState('Grátis');
  const [status, setStatus] = useState<ItineraryStatus>('published');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPremium, setIsPremium] = useState(false); // false = Grátis, true = Pago (15 Plátanos)
  const [badgeText, setBadgeText] = useState('');
  const [showPrice, setShowPrice] = useState(true);
  const [showStopsCount, setShowStopsCount] = useState(true);
  const [showBadge, setShowBadge] = useState(true);

  // Upload States for Cover
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Days and Steps state
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [days, setDays] = useState<
    Array<{
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
    }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Spot photo upload tracking for steps
  const [uploadingStepIdx, setUploadingStepIdx] = useState<{ dayIdx: number; stepIdx: number } | null>(null);
  const stepFileInputRef = useRef<HTMLInputElement>(null);

  // Lock background body scroll & support Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  // Reset scroll to top when switching steps
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

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
      const extractedSections = extractStoreSectionsFromItinerary(itineraryToEdit);
      setSelectedStoreSections(extractedSections);

      const hasPaidAccess = Boolean(itineraryToEdit.isPremium);
      setIsPremium(hasPaidAccess);
      setPrice(itineraryToEdit.price || (hasPaidAccess ? '15 Plátanos' : 'Grátis'));
      setStatus(itineraryToEdit.status || (itineraryToEdit.isActive !== false ? 'published' : 'draft'));
      setIsFeatured(extractedSections.includes('destaque') || Boolean(itineraryToEdit.isFeatured || itineraryToEdit.isRecommended));
      setBadgeText(itineraryToEdit.badgeText || (hasPaidAccess ? '15 Plátanos' : ''));
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
              customImage: s.customImage || s.spot?.image || '',
            })),
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
      setSelectedStoreSections(['all']);
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
    setCoverUploadError('');
    setShowCoverUrlInput(false);
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
        steps: [],
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
          steps: [],
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

  // Automated WebP optimization + upload to Supabase Storage ('monvian-media/itineraries')
  const handleCoverFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setCoverUploadError('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WEBP).');
      return;
    }
    setIsUploadingCover(true);
    setCoverUploadError('');
    try {
      const publicUrl = await uploadMediaToSupabaseStorage(file, 'itineraries', {
        maxDimension: 1280,
        quality: 0.82,
        filename: file.name,
      });
      if (!publicUrl) {
        throw new Error('Não foi possível enviar a imagem para o Supabase Storage. Tente novamente.');
      }
      setCoverImage(publicUrl);
    } catch (err: any) {
      setCoverUploadError(err.message || 'Erro ao carregar imagem');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleStepCustomImageUpload = async (file: File) => {
    if (!uploadingStepIdx) return;
    if (!file.type.startsWith('image/')) return;

    const target = { ...uploadingStepIdx };
    try {
      const publicUrl = await uploadMediaToSupabaseStorage(file, 'itineraries', {
        maxDimension: 1280,
        quality: 0.82,
        filename: file.name,
      });
      if (!publicUrl) {
        setCoverUploadError('Não foi possível enviar a imagem da etapa para o Supabase Storage.');
        return;
      }
      updateStepField(target.dayIdx, target.stepIdx, 'customImage', publicUrl);
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

    setDays((prev) => {
      const copy = [...prev];
      if (!copy[activeDayIdx]) return prev;
      copy[activeDayIdx] = {
        ...copy[activeDayIdx],
        steps: [...copy[activeDayIdx].steps, newStep],
      };
      return copy;
    });
  };

  const removeStepFromDay = (dayIndex: number, stepIndex: number) => {
    setDays((prev) => {
      const copy = [...prev];
      const updatedSteps = copy[dayIndex].steps
        .filter((_, idx) => idx !== stepIndex)
        .map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
      copy[dayIndex] = { ...copy[dayIndex], steps: updatedSteps };
      return copy;
    });
  };

  const moveStep = (dayIndex: number, stepIndex: number, direction: 'up' | 'down') => {
    setDays((prev) => {
      const copy = [...prev];
      const steps = [...copy[dayIndex].steps];
      const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;

      if (targetIndex < 0 || targetIndex >= steps.length) return prev;

      const temp = steps[stepIndex];
      steps[stepIndex] = steps[targetIndex];
      steps[targetIndex] = temp;

      const reindexed = steps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
      copy[dayIndex] = { ...copy[dayIndex], steps: reindexed };
      return copy;
    });
  };

  const updateStepField = (dayIndex: number, stepIndex: number, field: string, value: any) => {
    setDays((prev) => {
      const copy = [...prev];
      const targetDay = { ...copy[dayIndex] };
      const steps = [...targetDay.steps];
      steps[stepIndex] = { ...steps[stepIndex], [field]: value };

      if (field === 'spotId') {
        const found = availableSpots.find((s) => s.id === value);
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
      result = result.filter(
        (s) => (s.category || '').toLowerCase() === spotCategoryFilter.toLowerCase()
      );
    }
    const q = spotSearchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (s) =>
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
    availableSpots.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [availableSpots]);

  const toggleStoreSection = (sectionId: StoreSectionId) => {
    setSelectedStoreSections((prev) => {
      const exists = prev.includes(sectionId);
      // Keep at least one location selected so the itinerary always lives somewhere in the store
      if (exists && prev.length === 1) {
        return prev;
      }
      const next = exists ? prev.filter((id) => id !== sectionId) : [...prev, sectionId];
      if (sectionId === 'destaque') {
        setIsFeatured(!exists);
      }
      return next;
    });
  };

  const handleToggleFeatured = (nextFeatured: boolean) => {
    setIsFeatured(nextFeatured);
    setSelectedStoreSections((prev) => {
      if (nextFeatured) {
        return prev.includes('destaque') ? prev : [...prev, 'destaque'];
      }
      const filtered = prev.filter((id) => id !== 'destaque');
      return filtered.length > 0 ? filtered : ['all'];
    });
  };

  const handleSaveWithStatus = async (chosenStatus: ItineraryStatus) => {
    if (!title.trim()) {
      setErrorMsg('Por favor, informe o nome do roteiro.');
      setActiveTab('info');
      return;
    }

    if (selectedStoreSections.length === 0) {
      setErrorMsg('Selecione pelo menos um local na Loja de Roteiros.');
      setActiveTab('info');
      return;
    }

    const totalSteps = days.reduce((acc, d) => acc + d.steps.length, 0);
    if (totalSteps === 0) {
      setErrorMsg('Adicione pelo menos uma parada na etapa "Paradas do roteiro".');
      setActiveTab('builder');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const finalCategories = buildCategoriesForStoreSections(selectedStoreSections, selectedCategories);
    const finalIsFeatured = selectedStoreSections.includes('destaque');

    const payload = {
      title: title.trim(),
      description: description.trim(),
      tips: tips.trim(),
      coverImage: coverImage.trim() || (itineraryToEdit ? itineraryToEdit.coverImage : COVER_PRESETS[0].url),
      daysCount,
      categories: finalCategories,
      price: isPremium ? '15 Plátanos' : 'Grátis',
      platanosPrice: isPremium ? 15 : 0,
      status: chosenStatus,
      isActive: chosenStatus === 'published',
      isFeatured: finalIsFeatured,
      isRecommended: finalIsFeatured,
      isPremium,
      badgeText: isPremium ? '15 Plátanos' : badgeText || '',
      showPrice: showPrice !== false,
      showStopsCount,
      showBadge: isPremium && showBadge !== false,
      notes: tips.trim(),
      days,
    };

    try {
      const fullPayload = {
        ...payload,
        id: itineraryToEdit?.id,
      };

      // 1. Persist directly and authoritatively to Supabase PostgreSQL (Single Source of Truth)
      await saveItineraryToSupabase(fullPayload, Boolean(itineraryToEdit?.id));

      try {
        window.dispatchEvent(
          new CustomEvent('monvian:itineraries_updated', {
            detail: { updatedItineraryId: itineraryToEdit?.id },
          })
        );
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

  if (typeof document === 'undefined') return null;

  const totalPlaces = days.reduce((acc, d) => acc + d.steps.length, 0);
  const currentDay = days[activeDayIdx] || days[0];

  const primaryActionStatus: ItineraryStatus = status === 'hidden' ? 'hidden' : 'published';
  const primaryActionLabel =
    status === 'hidden'
      ? 'Salvar oculto'
      : itineraryToEdit
        ? 'Atualizar roteiro'
        : 'Publicar roteiro';

  const tabs: Array<{
    id: StepTabId;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }> = [
    {
      id: 'info',
      label: 'Informações e acesso',
      icon: <Info className="w-[15px] h-[15px] stroke-[2]" />,
    },
    {
      id: 'cover',
      label: 'Foto de capa',
      icon: <ImageIcon className="w-[15px] h-[15px] stroke-[2]" />,
      badge: coverImage ? (
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
      ) : null,
    },
    {
      id: 'builder',
      label: 'Paradas do roteiro',
      icon: <Layers className="w-[15px] h-[15px] stroke-[2]" />,
      badge: (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-bold leading-none tabular-nums ${
            activeTab === 'builder'
              ? 'bg-[#2563EB]/12 text-[#2563EB]'
              : 'bg-[#F0F1F4] text-[#4B5563]'
          }`}
        >
          {totalPlaces}
        </span>
      ),
    },
    {
      id: 'appearance',
      label: 'Destaque na loja',
      icon: <Layout className="w-[15px] h-[15px] stroke-[2]" />,
    },
  ];

  const headerTitle =
    title.trim() || (itineraryToEdit ? 'Editar Roteiro' : 'Novo Roteiro Turístico');

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="admin-itinerary-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.22, ease: 'easeOut' }}
          onClick={() => {
            if (!isSubmitting) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={headerTitle}
          className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[8px] sm:p-4"
        >
          <motion.div
            key="admin-itinerary-sheet"
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={
              prefersReducedMotion
                ? { duration: 0.12 }
                : { type: 'spring', stiffness: 360, damping: 36, mass: 0.9 }
            }
            drag={prefersReducedMotion ? false : 'y'}
            dragControls={sheetDragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.03, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (!isSubmitting && (info.offset.y > 120 || info.velocity.y > 550)) {
                onClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-[700px] lg:max-w-[860px] h-[94dvh] sm:h-[90dvh] sm:max-h-[860px] bg-[#FFFFFF] rounded-t-[34px] sm:rounded-[32px] shadow-[0_-14px_44px_rgba(0,0,0,0.18)] border border-black/[0.06] flex flex-col overflow-hidden"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            {/* 1. FIXED STANDARDIZED HEADER (Drag Handle + Title + Meta + Status + Close) */}
            <div
              onPointerDown={(e) => sheetDragControls.start(e)}
              className="shrink-0 bg-[#FFFFFF] px-5 sm:px-6 pt-3 pb-3.5 touch-none select-none cursor-grab active:cursor-grabbing"
            >
              <div className="w-11 h-[5px] rounded-full bg-[#D1D5DB] mx-auto mb-3.5" />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-[#F2F3F5] text-[#111827] flex items-center justify-center shrink-0">
                    <Compass className="w-[19px] h-[19px] stroke-[1.9]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-[17px] sm:text-[18px] font-bold text-[#111827] tracking-[-0.02em] leading-tight truncate">
                        {headerTitle}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 leading-tight ${
                          status === 'published'
                            ? 'bg-[#E7F6EC] text-[#15803D]'
                            : status === 'draft'
                              ? 'bg-[#FEF3C7] text-[#92400E]'
                              : 'bg-[#F2F3F5] text-[#4B5563]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            status === 'published'
                              ? 'bg-[#22C55E]'
                              : status === 'draft'
                                ? 'bg-[#D97706]'
                                : 'bg-[#6B7280]'
                          }`}
                        />
                        {status === 'published'
                          ? 'Publicado'
                          : status === 'draft'
                            ? 'Rascunho'
                            : 'Oculto'}
                      </span>
                    </div>

                    <p className="text-[12.5px] font-medium text-[#6B7280] mt-0.5 tabular-nums truncate">
                      {totalPlaces} {totalPlaces === 1 ? 'parada' : 'paradas'} · {daysCount}{' '}
                      {daysCount === 1 ? 'dia' : 'dias'} · {isPremium ? '15 Plátanos' : 'Grátis'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClose}
                  aria-label="Fechar janela de roteiro"
                  className="w-9 h-9 rounded-full bg-[#F2F3F5] hover:bg-[#E5E7EB] active:scale-95 text-[#374151] flex items-center justify-center transition-all cursor-pointer shrink-0"
                >
                  <X className="w-[17px] h-[17px] stroke-[2]" />
                </button>
              </div>
            </div>

            {/* 2. HORIZONTAL STEP NAVIGATION (Standardized across all 4 steps) */}
            <div className="shrink-0 bg-[#FFFFFF] border-b border-[#EFEFF2] px-4 sm:px-6">
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => {
                  const isSelected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative px-3 py-3 text-[13px] font-semibold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap ${
                        isSelected
                          ? 'text-[#111827]'
                          : 'text-[#858585] hover:text-[#374151]'
                      }`}
                    >
                      <span className={isSelected ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}>
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                      {tab.badge}
                      {isSelected && (
                        <motion.span
                          layoutId="admin-itinerary-active-tab-line"
                          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                          className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[#2563EB]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. INDEPENDENT SCROLLABLE CONTENT AREA */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain bg-[#FFFFFF] px-5 sm:px-6 py-5"
            >
              {errorMsg && (
                <div className="mb-4 px-3.5 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[16px] flex items-center gap-2.5 text-[13px] text-[#B91C1C] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {/* ============================================================
                    ETAPA 1 — INFORMAÇÕES E ACESSO
                   ============================================================ */}
                {activeTab === 'info' && (
                  <motion.div
                    key="step-info"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="space-y-5 pb-3"
                  >
                    {/* Nome do Roteiro */}
                    <div>
                      <SectionHeading
                        icon={<MapPin className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Nome do Roteiro"
                      />
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Essência de Campos: O Clássico em 2 Dias"
                        className={`${INPUT_BASE_CLASS} h-[48px]`}
                      />
                    </div>

                    {/* Status de Publicação — 3 opções compactas lado a lado */}
                    <div>
                      <SectionHeading
                        icon={<Megaphone className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Status de Publicação"
                      />
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          {
                            value: 'published' as ItineraryStatus,
                            label: 'Publicado',
                            desc: 'Visível na loja',
                            icon: (selected: boolean) => (
                              <CheckCircle2
                                className={`w-[18px] h-[18px] stroke-[2] ${
                                  selected ? 'text-[#16A34A]' : 'text-[#6B7280]'
                                }`}
                              />
                            ),
                          },
                          {
                            value: 'draft' as ItineraryStatus,
                            label: 'Rascunho',
                            desc: 'Fora da loja',
                            icon: (selected: boolean) => (
                              <Clock
                                className={`w-[18px] h-[18px] stroke-[2] ${
                                  selected ? 'text-[#111827]' : 'text-[#6B7280]'
                                }`}
                              />
                            ),
                          },
                          {
                            value: 'hidden' as ItineraryStatus,
                            label: 'Oculto',
                            desc: 'Arquivado',
                            icon: (selected: boolean) => (
                              <EyeOff
                                className={`w-[18px] h-[18px] stroke-[2] ${
                                  selected ? 'text-[#111827]' : 'text-[#6B7280]'
                                }`}
                              />
                            ),
                          },
                        ].map((opt) => {
                          const selected = status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setStatus(opt.value)}
                              className={`py-3 px-2 rounded-[18px] border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-[0.98] ${
                                selected
                                  ? 'bg-[#FFFFFF] border-[#111827] ring-1 ring-[#111827]/10 shadow-[0_4px_14px_-4px_rgba(17,24,39,0.12)]'
                                  : 'bg-[#F7F8FA] border-[#EAECEF] hover:border-[#D1D5DB]'
                              }`}
                            >
                              {opt.icon(selected)}
                              <span
                                className={`text-[13px] font-bold leading-tight mt-0.5 ${
                                  selected ? 'text-[#111827]' : 'text-[#374151]'
                                }`}
                              >
                                {opt.label}
                              </span>
                              <span className="text-[11px] text-[#6B7280] leading-tight">
                                {opt.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tipo de Acesso — 2 opções lado a lado (Grátis vs Pago 15 Plátanos) */}
                    <div>
                      <SectionHeading
                        icon={<Tag className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Tipo de Acesso"
                      />
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsPremium(false);
                            setPrice('Grátis');
                          }}
                          className={`p-3 rounded-[18px] border text-left flex items-center gap-3 transition-all cursor-pointer active:scale-[0.98] ${
                            !isPremium
                              ? 'bg-[#FFFFFF] border-[#111827] ring-1 ring-[#111827]/10 shadow-[0_4px_14px_-4px_rgba(17,24,39,0.12)]'
                              : 'bg-[#F7F8FA] border-[#EAECEF] hover:border-[#D1D5DB]'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              !isPremium
                                ? 'bg-[#E7F6EC] text-[#15803D]'
                                : 'bg-[#ECEEF2] text-[#6B7280]'
                            }`}
                          >
                            <Sparkles className="w-[17px] h-[17px] stroke-[2]" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[13.5px] font-bold text-[#111827] leading-tight">
                              Grátis
                            </span>
                            <span className="block text-[11.5px] text-[#6B7280] leading-tight mt-0.5 truncate">
                              Acesso livre
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsPremium(true);
                            setPrice('15 Plátanos');
                          }}
                          className={`p-3 rounded-[18px] border text-left flex items-center gap-3 transition-all cursor-pointer active:scale-[0.98] ${
                            isPremium
                              ? 'bg-[#FFFFFF] border-[#111827] ring-1 ring-[#111827]/10 shadow-[0_4px_14px_-4px_rgba(17,24,39,0.12)]'
                              : 'bg-[#F7F8FA] border-[#EAECEF] hover:border-[#D1D5DB]'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                              isPremium ? 'bg-[#111318] text-white' : 'bg-[#ECEEF2] text-[#4B5563]'
                            }`}
                          >
                            <PlatanoLeafIcon className="w-5 h-5" variant="monochrome" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[13.5px] font-bold text-[#111827] leading-tight">
                              Pago · 15 Plátanos
                            </span>
                            <span className="block text-[11.5px] text-[#6B7280] leading-tight mt-0.5 truncate">
                              R$ 29,90 via Stripe
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Duração em Dias */}
                    <div>
                      <SectionHeading
                        icon={<Clock className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Duração em Dias"
                      />
                      <div className="relative flex items-center">
                        <span className="w-7 h-7 rounded-full bg-white border border-black/[0.06] text-[#111827] flex items-center justify-center absolute left-3 pointer-events-none">
                          <Calendar className="w-3.5 h-3.5 stroke-[2]" />
                        </span>
                        <select
                          value={daysCount}
                          onChange={(e) => handleDaysCountChange(Number(e.target.value))}
                          className={`${INPUT_BASE_CLASS} h-[48px] pl-12 pr-10 appearance-none cursor-pointer`}
                        >
                          <option value={1}>1 Dia · Bate e Volta / Expresso</option>
                          <option value={2}>2 Dias · Fim de Semana</option>
                          <option value={3}>3 Dias · Feriado Prolongado</option>
                          <option value={4}>4 Dias · Experiência Completa</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-[#6B7280] absolute right-4 pointer-events-none" />
                      </div>
                    </div>

                    {/* Local na Loja de Roteiros (Abas oficiais com ícones 3D) */}
                    <div>
                      <SectionHeading
                        icon={<Layers className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Local na Loja de Roteiros"
                        rightSlot={
                          <span className="text-[11.5px] font-semibold text-[#6B7280] tabular-nums">
                            {selectedStoreSections.length}{' '}
                            {selectedStoreSections.length === 1 ? 'selecionado' : 'selecionados'}
                          </span>
                        }
                      />
                      <p className="text-[12px] text-[#6B7280] mb-3 leading-snug">
                        Escolha exatamente em qual aba da Loja este roteiro será exibido. Desmarque &quot;Todos&quot; se quiser deixá-lo exclusivo de uma área específica.
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {STORE_SECTION_OPTIONS.map((section) => {
                          const selected = selectedStoreSections.includes(section.id);
                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => toggleStoreSection(section.id)}
                              className={`relative py-2.5 px-1.5 rounded-[18px] border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.97] ${
                                selected
                                  ? 'bg-[#FFFFFF] border-[#111827] ring-1 ring-[#111827]/12 shadow-[0_6px_16px_-6px_rgba(17,24,39,0.16)]'
                                  : 'bg-[#F7F8FA] border-[#EAECEF] hover:border-[#D1D5DB] opacity-75 hover:opacity-100'
                              }`}
                            >
                              {selected && (
                                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#111827] text-white flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                              <img
                                src={section.image}
                                alt={section.name}
                                draggable={false}
                                className={`w-10 h-10 object-contain transition-transform ${
                                  selected ? 'scale-105' : 'scale-95 grayscale-[18%]'
                                }`}
                              />
                              <span
                                className={`text-[11.5px] leading-tight text-center truncate max-w-full ${
                                  selected
                                    ? 'font-bold text-[#111827]'
                                    : 'font-medium text-[#6B7280]'
                                }`}
                              >
                                {section.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Descrição & Dicas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <SectionHeading
                          icon={<FileText className="w-[16px] h-[16px] stroke-[2]" />}
                          title="Descrição do Roteiro"
                        />
                        <textarea
                          rows={3}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Descreva os pontos fortes e o clima desta experiência..."
                          className={`${INPUT_BASE_CLASS} py-3 resize-none leading-relaxed`}
                        />
                      </div>

                      <div>
                        <SectionHeading
                          icon={<Lightbulb className="w-[16px] h-[16px] stroke-[2]" />}
                          title="Dicas do Guia Local"
                        />
                        <textarea
                          rows={3}
                          value={tips}
                          onChange={(e) => setTips(e.target.value)}
                          placeholder="Horários ideais, vestimenta, reservas ou mirantes..."
                          className={`${INPUT_BASE_CLASS} py-3 resize-none leading-relaxed`}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ============================================================
                    ETAPA 2 — FOTO DE CAPA
                   ============================================================ */}
                {activeTab === 'cover' && (
                  <motion.div
                    key="step-cover"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="space-y-5 pb-3"
                  >
                    <input
                      type="file"
                      ref={coverFileInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCoverFileUpload(file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />

                    {/* Preview atual + Área de Upload compacta */}
                    <div>
                      <SectionHeading
                        icon={<Camera className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Imagem de Capa"
                        rightSlot={
                          <span className="text-[11.5px] font-medium text-[#858585]">
                            Proporção 16:9 ou 4:3
                          </span>
                        }
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
                        {/* Prévia da capa selecionada */}
                        <div className="sm:col-span-5 relative rounded-[20px] overflow-hidden bg-[#F2F3F5] border border-black/[0.06] aspect-[16/10] sm:aspect-auto sm:min-h-[144px]">
                          {coverImage ? (
                            <img
                              src={coverImage}
                              alt="Capa selecionada do roteiro"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-[#9CA3AF] gap-1">
                              <ImageIcon className="w-6 h-6" />
                              <span className="text-[12px] font-medium">Sem capa</span>
                            </div>
                          )}
                          <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold">
                            Capa atual
                          </span>
                        </div>

                        {/* Área de Upload compacta */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingCover(true);
                          }}
                          onDragLeave={() => setIsDraggingCover(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingCover(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleCoverFileUpload(file);
                          }}
                          className={`sm:col-span-7 rounded-[20px] border border-dashed p-4 flex flex-col items-center justify-center text-center gap-2 transition-all ${
                            isDraggingCover
                              ? 'border-[#2563EB] bg-[#2563EB]/[0.06]'
                              : 'border-[#D5D9E0] bg-[#F7F8FA] hover:border-[#9CA3AF]'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-white border border-black/[0.06] text-[#111827] flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
                            {isUploadingCover ? (
                              <RefreshCw className="w-[18px] h-[18px] animate-spin text-[#2563EB]" />
                            ) : (
                              <Upload className="w-[18px] h-[18px] stroke-[2]" />
                            )}
                          </div>
                          <div>
                            <p className="text-[13.5px] font-semibold text-[#111827]">
                              Arraste ou envie uma imagem
                            </p>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              JPG, PNG ou WEBP até 10MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => coverFileInputRef.current?.click()}
                            disabled={isUploadingCover}
                            className="mt-1 h-9 px-4 rounded-full bg-[#111318] hover:bg-[#1F232B] active:scale-[0.98] text-white text-[12.5px] font-semibold transition-all cursor-pointer disabled:opacity-60"
                          >
                            {isUploadingCover ? 'Enviando...' : 'Selecionar imagem'}
                          </button>
                        </div>
                      </div>

                      {coverUploadError && (
                        <p className="mt-2 text-[12px] text-[#B91C1C] font-medium">
                          {coverUploadError}
                        </p>
                      )}
                    </div>

                    {/* Imagens Sugeridas de Campos do Jordão — Grade 2 colunas + Ação discreta de URL */}
                    <div>
                      <SectionHeading
                        icon={<ImageIcon className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Sugestões de Campos do Jordão"
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowCoverUrlInput((prev) => !prev)}
                            className="h-8 px-3 rounded-full bg-[#F2F3F5] hover:bg-[#E5E7EB] text-[#374151] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span>{showCoverUrlInput ? 'Ocultar URL' : 'Inserir URL'}</span>
                          </button>
                        }
                      />

                      <AnimatePresence initial={false}>
                        {showCoverUrlInput && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-3"
                          >
                            <input
                              type="url"
                              value={coverImage}
                              onChange={(e) => setCoverImage(e.target.value)}
                              placeholder="https://images.unsplash.com/..."
                              className={`${INPUT_BASE_CLASS} h-[44px] text-[13px]`}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-2 gap-2.5">
                        {COVER_PRESETS.map((preset, idx) => {
                          const isSelected = coverImage === preset.url;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCoverImage(preset.url)}
                              className={`group text-left p-1.5 rounded-[18px] border transition-all cursor-pointer active:scale-[0.985] ${
                                isSelected
                                  ? 'border-[#2563EB] bg-[#2563EB]/[0.04] ring-1 ring-[#2563EB]/25'
                                  : 'border-[#EAECEF] bg-white hover:border-[#D1D5DB]'
                              }`}
                            >
                              <div className="relative aspect-[16/10] rounded-[13px] overflow-hidden bg-[#F2F3F5]">
                                <img
                                  src={preset.url}
                                  alt={preset.label}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                />
                                {isSelected && (
                                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center shadow-sm">
                                    <Check className="w-3.5 h-3.5 stroke-[2.6]" />
                                  </span>
                                )}
                              </div>
                              <div className="px-1.5 pt-2 pb-1">
                                <span
                                  className={`block text-[12.5px] font-semibold truncate ${
                                    isSelected ? 'text-[#2563EB]' : 'text-[#111827]'
                                  }`}
                                >
                                  {preset.label}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ============================================================
                    ETAPA 3 — PARADAS DO ROTEIRO
                   ============================================================ */}
                {activeTab === 'builder' && (
                  <motion.div
                    key="step-builder"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="space-y-4 pb-3"
                  >
                    {/* Hidden file input for optional custom step photo upload */}
                    <input
                      type="file"
                      ref={stepFileInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleStepCustomImageUpload(file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />

                    {/* Seleção de Dias — Botões arredondados e compactos */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                      {days.map((d, dIdx) => {
                        const isSelected = activeDayIdx === dIdx;
                        const count = d.steps.length;
                        return (
                          <button
                            key={dIdx}
                            type="button"
                            onClick={() => setActiveDayIdx(dIdx)}
                            className={`h-[36px] px-3.5 rounded-full text-[12.5px] font-semibold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 tabular-nums ${
                              isSelected
                                ? 'bg-[#111318] text-white border-[#111318] shadow-[0_2px_8px_rgba(17,19,24,0.16)]'
                                : 'bg-[#F4F5F7] text-[#4B5563] border-transparent hover:bg-[#EAECEF]'
                            }`}
                          >
                            <span>Dia {d.dayNumber}</span>
                            <span className={isSelected ? 'text-white/60' : 'text-[#9CA3AF]'}>·</span>
                            <span className={isSelected ? 'text-white/90' : 'text-[#6B7280]'}>
                              {count} {count === 1 ? 'parada' : 'paradas'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Título do Dia — Barra compacta com contagem discreta */}
                    <div className="px-3.5 py-2.5 rounded-[18px] bg-[#F7F8FA] border border-[#E6E8EC] flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[11px] font-semibold text-[#858585] leading-none mb-1">
                          Título do Dia {activeDayIdx + 1}
                        </label>
                        <input
                          type="text"
                          value={currentDay?.title || ''}
                          onChange={(e) => {
                            const copy = [...days];
                            copy[activeDayIdx] = { ...copy[activeDayIdx], title: e.target.value };
                            setDays(copy);
                          }}
                          placeholder={`Dia ${activeDayIdx + 1}: O Clássico de Capivari`}
                          className="w-full bg-transparent text-[14px] font-bold text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                        />
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-white border border-black/[0.06] text-[11.5px] font-semibold text-[#374151] tabular-nums shrink-0">
                        {currentDay?.steps.length || 0}{' '}
                        {currentDay?.steps.length === 1 ? 'local' : 'locais'}
                      </span>
                    </div>

                    {/* Duas colunas no desktop, fluxo vertical compacto no mobile */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      {/* COLUNA A: ROTEIRO DO DIA */}
                      <div className="lg:col-span-6 space-y-2.5">
                        <SectionHeading
                          icon={<Layers className="w-[15px] h-[15px] stroke-[2]" />}
                          title={`Roteiro do Dia ${activeDayIdx + 1}`}
                          rightSlot={
                            <span className="text-[12px] font-semibold text-[#6B7280] tabular-nums">
                              {currentDay?.steps.length || 0}{' '}
                              {currentDay?.steps.length === 1 ? 'parada' : 'paradas'}
                            </span>
                          }
                        />

                        {currentDay?.steps.length === 0 ? (
                          <div className="py-7 px-4 rounded-[20px] border border-dashed border-[#D8DCE3] bg-[#FAFAFB] text-center flex flex-col items-center gap-1.5">
                            <span className="w-10 h-10 rounded-full bg-[#F2F3F5] text-[#6B7280] flex items-center justify-center mb-0.5">
                              <MapPin className="w-[18px] h-[18px] stroke-[1.9]" />
                            </span>
                            <p className="text-[13.5px] font-bold text-[#111827]">
                              Nenhuma parada no Dia {activeDayIdx + 1}
                            </p>
                            <p className="text-[12px] text-[#6B7280] max-w-[240px]">
                              Escolha os locais disponíveis para montar a sequência deste dia.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5 no-scrollbar">
                            {currentDay?.steps.map((step, sIdx) => {
                              const stepNumber = String(sIdx + 1).padStart(2, '0');
                              const spotData = availableSpots.find((s) => s.id === step.spotId);
                              const stepPhoto = step.customImage || spotData?.image;
                              const stepName =
                                step.customName || spotData?.name || 'Local Turístico';

                              return (
                                <div
                                  key={`${step.spotId}-${sIdx}`}
                                  className="p-2.5 rounded-[18px] bg-white border border-[#EAECEF] shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)] space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <span className="w-6 h-6 rounded-full bg-[#2563EB]/10 text-[#2563EB] font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums">
                                        {stepNumber}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setUploadingStepIdx({ dayIdx: activeDayIdx, stepIdx: sIdx });
                                          stepFileInputRef.current?.click();
                                        }}
                                        title="Trocar foto desta parada"
                                        className="relative w-10 h-10 rounded-[12px] overflow-hidden border border-black/[0.06] bg-[#F2F3F5] shrink-0 cursor-pointer group"
                                      >
                                        {stepPhoto ? (
                                          <img
                                            src={stepPhoto}
                                            alt={stepName}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <span className="w-full h-full flex items-center justify-center text-[#9CA3AF]">
                                            <Camera className="w-4 h-4" />
                                          </span>
                                        )}
                                      </button>

                                      <div className="min-w-0 flex-1">
                                        <h4 className="text-[13.5px] font-bold text-[#111827] truncate leading-tight">
                                          {stepName}
                                        </h4>
                                        <span className="text-[11.5px] text-[#6B7280] font-medium block truncate mt-0.5 capitalize">
                                          {spotData?.categoryLabel || spotData?.category || 'Atração'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Reorder & Remove */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        disabled={sIdx === 0}
                                        onClick={() => moveStep(activeDayIdx, sIdx, 'up')}
                                        className="w-7 h-7 rounded-full bg-[#F4F5F7] text-[#374151] hover:bg-[#E5E7EB] disabled:opacity-25 flex items-center justify-center transition-colors cursor-pointer"
                                        title="Mover para cima"
                                      >
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={sIdx === (currentDay?.steps.length || 0) - 1}
                                        onClick={() => moveStep(activeDayIdx, sIdx, 'down')}
                                        className="w-7 h-7 rounded-full bg-[#F4F5F7] text-[#374151] hover:bg-[#E5E7EB] disabled:opacity-25 flex items-center justify-center transition-colors cursor-pointer"
                                        title="Mover para baixo"
                                      >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeStepFromDay(activeDayIdx, sIdx)}
                                        className="w-7 h-7 rounded-full bg-[#FCECEC] text-[#B91C1C] hover:bg-[#FADADA] flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                                        title="Remover parada"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Compact Timing Row */}
                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F2F3F5]">
                                    <div className="flex items-center gap-2 px-2.5 h-8 rounded-[11px] bg-[#F7F8FA] border border-[#ECEEF2]">
                                      <Clock className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                                      <input
                                        type="text"
                                        value={step.suggestedTime}
                                        onChange={(e) =>
                                          updateStepField(
                                            activeDayIdx,
                                            sIdx,
                                            'suggestedTime',
                                            e.target.value
                                          )
                                        }
                                        placeholder="09:30"
                                        aria-label="Horário sugerido"
                                        className="w-full bg-transparent text-[12px] font-semibold text-[#111827] outline-none tabular-nums"
                                      />
                                    </div>

                                    <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-[11px] bg-[#F7F8FA] border border-[#ECEEF2]">
                                      <input
                                        type="number"
                                        value={step.durationMinutes}
                                        onChange={(e) =>
                                          updateStepField(
                                            activeDayIdx,
                                            sIdx,
                                            'durationMinutes',
                                            Number(e.target.value)
                                          )
                                        }
                                        placeholder="60"
                                        aria-label="Duração estimada em minutos"
                                        className="w-full bg-transparent text-[12px] font-semibold text-[#111827] outline-none tabular-nums"
                                      />
                                      <span className="text-[11px] text-[#858585] font-medium shrink-0">
                                        min
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* COLUNA B: LOCAIS TURÍSTICOS DISPONÍVEIS */}
                      <div className="lg:col-span-6 space-y-2.5">
                        <SectionHeading
                          icon={<Search className="w-[15px] h-[15px] stroke-[2]" />}
                          title="Locais Disponíveis"
                          rightSlot={
                            <span className="text-[12px] font-semibold text-[#6B7280] tabular-nums">
                              {filteredSpotsForBuilder.length}
                            </span>
                          }
                        />

                        {/* Campo de Pesquisa + Chips de Categoria */}
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={spotSearchQuery}
                              onChange={(e) => setSpotSearchQuery(e.target.value)}
                              placeholder="Buscar estabelecimento ou atração..."
                              className={`${INPUT_BASE_CLASS} h-[42px] pl-10 pr-9 text-[13.5px]`}
                            />
                            {spotSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setSpotSearchQuery('')}
                                aria-label="Limpar busca"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E5E7EB] text-[#4B5563] flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                setSpotCategoryFilter('all');
                                (e.currentTarget as HTMLElement)?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'nearest',
                                  inline: 'center',
                                });
                              }}
                              className={`h-[30px] px-3 rounded-full text-[12px] font-semibold shrink-0 transition-all cursor-pointer border ${
                                spotCategoryFilter === 'all'
                                  ? 'bg-[#111318] text-white border-[#111318]'
                                  : 'bg-[#F7F8FA] text-[#4B5563] border-[#E6E8EC] hover:border-[#D1D5DB]'
                              }`}
                            >
                              Todos
                            </button>
                            {spotCategories.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={(e) => {
                                  setSpotCategoryFilter(cat);
                                  (e.currentTarget as HTMLElement)?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest',
                                    inline: 'center',
                                  });
                                }}
                                className={`h-[30px] px-3 rounded-full text-[12px] font-semibold shrink-0 capitalize transition-all cursor-pointer border ${
                                  spotCategoryFilter === cat
                                    ? 'bg-[#111318] text-white border-[#111318]'
                                    : 'bg-[#F7F8FA] text-[#4B5563] border-[#E6E8EC] hover:border-[#D1D5DB]'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Resultados Compactos (múltiplos locais visíveis na tela) */}
                        <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5 no-scrollbar">
                          {loadingSpots ? (
                            <div className="py-10 text-center text-[12.5px] text-[#858585] flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Carregando locais...</span>
                            </div>
                          ) : filteredSpotsForBuilder.length === 0 ? (
                            <div className="py-10 text-center text-[12.5px] text-[#858585]">
                              Nenhum local encontrado para este filtro.
                            </div>
                          ) : (
                            filteredSpotsForBuilder.map((spot) => {
                              const countInCurrentDay = (currentDay?.steps || []).filter(
                                (s) => s.spotId === spot.id
                              ).length;

                              return (
                                <div
                                  key={spot.id}
                                  className="p-2 rounded-[16px] bg-white border border-[#ECEEF2] hover:border-[#D1D5DB] flex items-center justify-between gap-2.5 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <img
                                      src={
                                        spot.image ||
                                        'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=300&q=80'
                                      }
                                      alt={spot.name}
                                      loading="lazy"
                                      className="w-10 h-10 rounded-[11px] object-cover shrink-0 bg-[#F2F3F5] border border-black/[0.04]"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-[13px] font-bold text-[#111827] truncate leading-tight">
                                        {spot.name}
                                      </h4>
                                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#6B7280]">
                                        <span className="truncate capitalize">
                                          {spot.categoryLabel || spot.category || 'Ponto Turístico'}
                                        </span>
                                        {spot.priceRange && (
                                          <>
                                            <span className="text-[#D1D5DB]">·</span>
                                            <span className="font-semibold text-[#15803D] shrink-0">
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
                                    className={`h-8 px-3 rounded-full text-[12px] font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 active:scale-[0.96] ${
                                      countInCurrentDay > 0
                                        ? 'bg-[#E7F6EC] text-[#15803D] hover:bg-[#D5EEDF]'
                                        : 'bg-[#111318] text-white hover:bg-[#1F232B]'
                                    }`}
                                  >
                                    {countInCurrentDay > 0 ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>{countInCurrentDay}x</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5 stroke-[2.4]" />
                                        <span>Adicionar</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ============================================================
                    ETAPA 4 — DESTAQUE NA LOJA
                   ============================================================ */}
                {activeTab === 'appearance' && (
                  <motion.div
                    key="step-appearance"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start pb-3"
                  >
                    {/* Coluna Esquerda: Configurações compactas em linhas iOS */}
                    <div className="md:col-span-6 space-y-4">
                      <div>
                        <SectionHeading
                          icon={<Sparkles className="w-[16px] h-[16px] stroke-[2]" />}
                          title="Exibição na Loja"
                        />

                        <div className="rounded-[20px] bg-white border border-[#EAECEF] divide-y divide-[#F0F1F4] overflow-hidden shadow-[0_4px_16px_-6px_rgba(15,23,42,0.05)]">
                          {/* Linha 1: Roteiro em destaque */}
                          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="block text-[14px] font-semibold text-[#111827] leading-tight">
                                Roteiro em destaque
                              </span>
                              <span className="block text-[12px] text-[#6B7280] mt-0.5 leading-snug">
                                Exibir no topo em &quot;Roteiros em destaque&quot;
                              </span>
                            </div>
                            <IOSToggle
                              checked={isFeatured}
                              onChange={handleToggleFeatured}
                              ariaLabel="Ativar roteiro em destaque"
                            />
                          </div>

                          {/* Linha 2: Visibilidade dos dados (contagem de paradas) */}
                          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="block text-[14px] font-semibold text-[#111827] leading-tight">
                                Mostrar contagem de paradas
                              </span>
                              <span className="block text-[12px] text-[#6B7280] mt-0.5 leading-snug">
                                Exibe a quantidade total de locais no card
                              </span>
                            </div>
                            <IOSToggle
                              checked={showStopsCount}
                              onChange={setShowStopsCount}
                              ariaLabel="Mostrar contagem de paradas no card"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Coluna Direita: Pré-visualização compacta do Card na Loja */}
                    <div className="md:col-span-6">
                      <SectionHeading
                        icon={<Layout className="w-[16px] h-[16px] stroke-[2]" />}
                        title="Pré-visualização na Loja"
                      />

                      <div className="p-3.5 rounded-[24px] bg-[#F7F8FA] border border-[#ECEEF2]">
                        <div className="rounded-[20px] bg-white border border-black/[0.05] overflow-hidden shadow-[0_8px_24px_-8px_rgba(15,23,42,0.09)]">
                          <div className="relative aspect-[16/9] bg-[#EFEFF2] overflow-hidden">
                            {coverImage ? (
                              <img
                                src={coverImage}
                                alt="Prévia da capa do roteiro"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#9CA3AF] text-[12px] font-medium">
                                Sem imagem de capa
                              </div>
                            )}

                            {/* Badge Destaque quando ativo */}
                            {isFeatured && (
                              <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md text-[#111827] text-[11px] font-bold shadow-xs">
                                Destaque
                              </span>
                            )}

                            {/* Badge de Acesso */}
                            <span
                              className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[11px] font-bold inline-flex items-center gap-1 shadow-xs ${
                                isPremium
                                  ? 'bg-[#111318]/85 text-white'
                                  : 'bg-[#E7F6EC]/95 text-[#15803D]'
                              }`}
                            >
                              {isPremium && (
                                <PlatanoLeafIcon className="w-3.5 h-3.5" variant="monochrome" />
                              )}
                              <span>{isPremium ? '15 Plátanos' : 'Grátis'}</span>
                            </span>
                          </div>

                          <div className="p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-[#6B7280] tabular-nums">
                              <span>
                                {daysCount} {daysCount === 1 ? 'dia' : 'dias'}
                                {showStopsCount && (
                                  <>
                                    {' · '}
                                    {totalPlaces} {totalPlaces === 1 ? 'parada' : 'paradas'}
                                  </>
                                )}
                              </span>
                              <span className={isPremium ? 'text-[#111827]' : 'text-[#15803D]'}>
                                {isPremium ? 'R$ 29,90' : 'Acesso livre'}
                              </span>
                            </div>

                            <h4 className="text-[15px] font-bold text-[#111827] tracking-[-0.015em] line-clamp-1">
                              {title.trim() || 'Título do Roteiro'}
                            </h4>

                            <p className="text-[12.5px] text-[#6B7280] line-clamp-2 leading-relaxed">
                              {description.trim() ||
                                'Descrição do roteiro que será apresentada aos visitantes na loja do Monvian.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. FIXED STANDARDIZED FOOTER (All 4 Steps + iPhone Safe Area) */}
            <div
              className="shrink-0 bg-[#FFFFFF] border-t border-[#EFEFF2] px-4 sm:px-6 pt-3 flex items-center justify-between gap-2"
              style={{
                paddingBottom: 'max(18px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-[44px] px-3 sm:px-4 rounded-full text-[13px] font-semibold text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveWithStatus('draft')}
                  className="h-[44px] px-3.5 sm:px-4 rounded-full bg-white border border-[#DDE1E7] hover:bg-[#F7F8FA] active:scale-[0.98] text-[#111827] text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Salvar como rascunho</span>
                  <span className="sm:hidden">Rascunho</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSaveWithStatus(primaryActionStatus)}
                  className="h-[44px] px-4 sm:px-5 rounded-full bg-[#111318] hover:bg-[#1F232B] active:scale-[0.98] text-white text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap shadow-[0_4px_14px_-4px_rgba(17,19,24,0.35)]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                      <span>{primaryActionLabel}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
