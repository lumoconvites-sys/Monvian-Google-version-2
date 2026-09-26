import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  MapPin,
  Calendar,
  Check,
  Sparkles,
  Info,
  Compass,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Spot, Itinerary, ItineraryCategory } from '../../types';

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
  { label: 'Trilha & Floresta de Pinhos', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=80' },
];

export const AdminItineraryModal: React.FC<AdminItineraryModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  itineraryToEdit,
  categories
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'builder'>('info');
  const [availableSpots, setAvailableSpots] = useState<Spot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(COVER_PRESETS[0].url);
  const [daysCount, setDaysCount] = useState(2);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isRecommended, setIsRecommended] = useState(false);
  const [notes, setNotes] = useState('');

  // Days and Steps state
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
    }>;
  }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch all spots for the picker
  useEffect(() => {
    if (!isOpen) return;
    const fetchSpots = async () => {
      try {
        setLoadingSpots(true);
        const res = await fetch('/api/admin/spots');
        const data = await res.json();
        if (data.success && Array.isArray(data.spots)) {
          setAvailableSpots(data.spots);
        }
      } catch (e) {
        console.error('Error fetching spots for itinerary builder:', e);
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
      setCoverImage(itineraryToEdit.coverImage || COVER_PRESETS[0].url);
      setDaysCount(itineraryToEdit.daysCount || 1);
      setSelectedCategories(itineraryToEdit.categories || []);
      setIsActive(itineraryToEdit.isActive !== false);
      setIsRecommended(Boolean(itineraryToEdit.isRecommended));
      setNotes(itineraryToEdit.notes || '');

      if (Array.isArray(itineraryToEdit.days) && itineraryToEdit.days.length > 0) {
        setDays(
          itineraryToEdit.days.map((d, dIdx) => ({
            dayNumber: d.dayNumber || dIdx + 1,
            title: d.title || `Dia ${dIdx + 1}`,
            summary: d.summary || '',
            steps: (d.steps || []).map((s, sIdx) => ({
              spotId: s.spotId || (s.spot?.id || ''),
              stepOrder: s.stepOrder || sIdx + 1,
              suggestedTime: s.suggestedTime || '09:00',
              durationMinutes: s.durationMinutes || 90,
              notes: s.notes || ''
            }))
          }))
        );
      } else {
        initDefaultDays(itineraryToEdit.daysCount || 1);
      }
    } else {
      setTitle('');
      setDescription('');
      setCoverImage(COVER_PRESETS[0].url);
      setDaysCount(2);
      setSelectedCategories(['nature', 'gastronomy']);
      setIsActive(true);
      setIsRecommended(false);
      setNotes('');
      initDefaultDays(2);
    }
    setActiveTab('info');
    setErrorMsg('');
  }, [isOpen, itineraryToEdit]);

  const initDefaultDays = (count: number) => {
    const newDays = [];
    for (let i = 1; i <= count; i++) {
      newDays.push({
        dayNumber: i,
        title: `Dia ${i}: Explorando a Montanha`,
        summary: '',
        steps: []
      });
    }
    setDays(newDays);
  };

  const handleDaysCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(7, newCount));
    setDaysCount(validCount);

    setDays(prev => {
      if (validCount > prev.length) {
        const added = [];
        for (let i = prev.length + 1; i <= validCount; i++) {
          added.push({
            dayNumber: i,
            title: `Dia ${i}: Passeios & Gastronomia`,
            summary: '',
            steps: []
          });
        }
        return [...prev, ...added];
      } else if (validCount < prev.length) {
        return prev.slice(0, validCount);
      }
      return prev;
    });
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const addStepToDay = (dayIndex: number) => {
    if (availableSpots.length === 0) return;
    const defaultSpot = availableSpots[0];
    setDays(prev => {
      const copy = [...prev];
      const targetDay = { ...copy[dayIndex] };
      const newSteps = [...targetDay.steps];

      // Calculate default suggested time based on previous step
      let nextTime = '09:30';
      if (newSteps.length > 0) {
        const lastStep = newSteps[newSteps.length - 1];
        const [h, m] = (lastStep.suggestedTime || '09:00').split(':').map(Number);
        const nextMin = (h || 9) * 60 + (m || 0) + (lastStep.durationMinutes || 90) + 30;
        const nh = Math.floor(nextMin / 60) % 24;
        const nm = nextMin % 60;
        nextTime = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
      }

      newSteps.push({
        spotId: defaultSpot.id,
        stepOrder: newSteps.length + 1,
        suggestedTime: nextTime,
        durationMinutes: (defaultSpot as any).durationMinutes || 90,
        notes: ''
      });
      targetDay.steps = newSteps;
      copy[dayIndex] = targetDay;
      return copy;
    });
  };

  const removeStep = (dayIndex: number, stepIndex: number) => {
    setDays(prev => {
      const copy = [...prev];
      const targetDay = { ...copy[dayIndex] };
      targetDay.steps = targetDay.steps
        .filter((_, idx) => idx !== stepIndex)
        .map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
      copy[dayIndex] = targetDay;
      return copy;
    });
  };

  const moveStep = (dayIndex: number, stepIndex: number, direction: 'up' | 'down') => {
    setDays(prev => {
      const copy = [...prev];
      const targetDay = { ...copy[dayIndex] };
      const steps = [...targetDay.steps];
      const targetIdx = direction === 'up' ? stepIndex - 1 : stepIndex + 1;

      if (targetIdx < 0 || targetIdx >= steps.length) return prev;

      const temp = steps[stepIndex];
      steps[stepIndex] = steps[targetIdx];
      steps[targetIdx] = temp;

      targetDay.steps = steps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
      copy[dayIndex] = targetDay;
      return copy;
    });
  };

  const updateStepField = (dayIndex: number, stepIndex: number, field: string, value: any) => {
    setDays(prev => {
      const copy = [...prev];
      const targetDay = { ...copy[dayIndex] };
      const steps = [...targetDay.steps];
      steps[stepIndex] = { ...steps[stepIndex], [field]: value };

      // If spotId changed, also update duration if appropriate
      if (field === 'spotId') {
        const found = availableSpots.find(s => s.id === value);
        if (found && (found as any).durationMinutes) {
          steps[stepIndex].durationMinutes = (found as any).durationMinutes;
        }
      }

      targetDay.steps = steps;
      copy[dayIndex] = targetDay;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Por favor, informe o título do roteiro.');
      setActiveTab('info');
      return;
    }

    const totalSteps = days.reduce((acc, d) => acc + d.steps.length, 0);
    if (totalSteps === 0) {
      setErrorMsg('Adicione pelo menos um ponto turístico ao roteiro no Construtor de Dias.');
      setActiveTab('builder');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = {
      title: title.trim(),
      description: description.trim(),
      coverImage: coverImage.trim(),
      daysCount,
      categories: selectedCategories,
      isActive,
      isRecommended,
      notes: notes.trim(),
      days
    };

    try {
      const url = itineraryToEdit ? `/api/admin/itineraries/${itineraryToEdit.id}` : '/api/admin/itineraries';
      const method = itineraryToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setErrorMsg(data.error || 'Erro ao salvar roteiro.');
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalPlaces = days.reduce((acc, d) => acc + d.steps.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121418] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-[#17191e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                {itineraryToEdit ? 'Editar Roteiro Turístico' : 'Criar Novo Roteiro'}
              </h2>
              <p className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">
                {totalPlaces} {totalPlaces === 1 ? 'lugar cadastrado' : 'lugares cadastrados'} em {daysCount} {daysCount === 1 ? 'dia' : 'dias'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-5 pt-2 bg-zinc-50/50 dark:bg-[#15171c] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'info'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            1. Informações Principais
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'builder'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <span>2. Construtor de Dias & Pontos</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 font-bold">
              {totalPlaces}
            </span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: INFORMATIONS */}
          {activeTab === 'info' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Title & Days */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nome do Roteiro *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Essência de Campos: O Clássico em 2 Dias"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Quantidade de Dias
                  </label>
                  <select
                    value={daysCount}
                    onChange={e => handleDaysCountChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:border-zinc-500"
                  >
                    <option value={1}>1 Dia (Bate e Volta / Expresso)</option>
                    <option value={2}>2 Dias (Fim de Semana Clássico)</option>
                    <option value={3}>3 Dias (Feriado Prolongado)</option>
                    <option value={4}>4 Dias (Experiência Completa)</option>
                    <option value={5}>5 Dias (Imersão Total na Serra)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Descrição do Roteiro
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Explique o objetivo deste roteiro, o perfil indicado e os principais destaques..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:border-zinc-500 resize-none"
                />
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Imagem de Capa (URL)
                </label>
                <div className="flex gap-2 mb-2.5">
                  <input
                    type="url"
                    value={coverImage}
                    onChange={e => setCoverImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3.5 py-2 bg-white dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-zinc-500"
                  />
                  {coverImage && (
                    <img
                      src={coverImage}
                      alt="Capa"
                      className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                    />
                  )}
                </div>

                {/* Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-zinc-700 dark:text-zinc-400 font-medium">Fotos de Campos do Jordão recomendadas:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COVER_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCoverImage(preset.url)}
                        className={`text-left p-1.5 rounded-xl border flex items-center gap-2 transition-all ${
                          coverImage === preset.url
                            ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categories Multi-Select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Categorias do Roteiro (Selecione as que combinam com este roteiro)
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => {
                    const selected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                          selected
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent shadow-2xs'
                            : 'bg-white dark:bg-[#181a20] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5" />}
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status and Recommendation Switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181a20] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white">Status do Roteiro</div>
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-400 font-medium">Visível para os turistas no aplicativo</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      isActive ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#181a20] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white">Destaque Recomendado</div>
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-400 font-medium">Exibir com selo de destaque no topo</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRecommended(!isRecommended)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      isRecommended ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${
                        isRecommended ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Observações Gerais */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Dicas e Observações Importantes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Leve agasalho para o final da tarde, reserve o fondue com antecedência..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#181a20] border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-hidden focus:border-zinc-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: BUILDER (DAYS & STEPS) */}
          {activeTab === 'builder' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">
                  Organize os pontos turísticos em ordem cronológica de visitação.
                </p>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Total: {totalPlaces} {totalPlaces === 1 ? 'local' : 'locais'}
                </span>
              </div>

              {days.map((day, dIdx) => (
                <div
                  key={dIdx}
                  className="border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/70 dark:bg-[#15171d] p-4 sm:p-5 space-y-4"
                >
                  {/* Day Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          Dia {day.dayNumber}
                        </span>
                        <input
                          type="text"
                          value={day.title}
                          onChange={e => {
                            const newDays = [...days];
                            newDays[dIdx].title = e.target.value;
                            setDays(newDays);
                          }}
                          placeholder={`Título do Dia ${day.dayNumber}`}
                          className="font-bold text-sm bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-500 focus:outline-hidden text-zinc-900 dark:text-white px-1 py-0.5"
                        />
                      </div>
                      <input
                        type="text"
                        value={day.summary}
                        onChange={e => {
                          const newDays = [...days];
                          newDays[dIdx].summary = e.target.value;
                          setDays(newDays);
                        }}
                        placeholder="Resumo do dia (opcional, ex: Manhã com flores e tarde no Capivari)"
                        className="w-full text-xs bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-500 focus:outline-hidden text-zinc-700 dark:text-zinc-400 font-medium px-1 py-0.5"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => addStepToDay(dIdx)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Ponto</span>
                    </button>
                  </div>

                  {/* Day Steps */}
                  {day.steps.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#17191f]">
                      <Compass className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2" />
                      <p className="text-xs text-zinc-700 dark:text-zinc-400 font-medium mb-2">
                        Nenhum ponto adicionado ao Dia {day.dayNumber}.
                      </p>
                      <button
                        type="button"
                        onClick={() => addStepToDay(dIdx)}
                        className="text-xs font-semibold text-zinc-900 dark:text-white underline hover:opacity-80 cursor-pointer"
                      >
                        + Adicionar primeiro ponto turístico
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {day.steps.map((step, sIdx) => {
                        const spotData = availableSpots.find(s => s.id === step.spotId);
                        return (
                          <div
                            key={sIdx}
                            className="bg-white dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 shadow-2xs"
                          >
                            {/* Number & Reorder controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center">
                                {step.stepOrder}
                              </span>
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  disabled={sIdx === 0}
                                  onClick={() => moveStep(dIdx, sIdx, 'up')}
                                  className="p-0.5 text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                                  title="Mover para cima"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={sIdx === day.steps.length - 1}
                                  onClick={() => moveStep(dIdx, sIdx, 'down')}
                                  className="p-0.5 text-zinc-700 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                                  title="Mover para baixo"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Spot thumbnail & Spot selection dropdown */}
                            <div className="flex-1 flex items-center gap-2.5 min-w-[200px] w-full sm:w-auto">
                              {spotData?.image && (
                                <img
                                  src={spotData.image}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                                />
                              )}
                              <div className="flex-1">
                                <select
                                  value={step.spotId}
                                  onChange={e => updateStepField(dIdx, sIdx, 'spotId', e.target.value)}
                                  className="w-full text-xs font-semibold bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-900 dark:text-white focus:outline-hidden"
                                >
                                  {availableSpots.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} ({s.categoryLabel || s.category})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Suggested Time & Duration */}
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                              <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                <Clock className="w-3 h-3 text-zinc-700 dark:text-zinc-400" />
                                <input
                                  type="text"
                                  value={step.suggestedTime}
                                  onChange={e => updateStepField(dIdx, sIdx, 'suggestedTime', e.target.value)}
                                  placeholder="09:00"
                                  className="w-12 text-xs font-semibold bg-transparent text-zinc-900 dark:text-white focus:outline-hidden text-center"
                                />
                              </div>

                              <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                <span className="text-[10px] text-zinc-700 dark:text-zinc-400 font-medium">Duração:</span>
                                <input
                                  type="number"
                                  min={15}
                                  max={360}
                                  step={15}
                                  value={step.durationMinutes}
                                  onChange={e => updateStepField(dIdx, sIdx, 'durationMinutes', Number(e.target.value))}
                                  className="w-10 text-xs font-semibold bg-transparent text-zinc-900 dark:text-white focus:outline-hidden text-center"
                                />
                                <span className="text-[10px] text-zinc-700 dark:text-zinc-400 font-medium">min</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeStep(dIdx, sIdx)}
                                className="p-1.5 text-zinc-700 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Remover ponto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Add day button */}
              {days.length < 7 && (
                <button
                  type="button"
                  onClick={() => handleDaysCountChange(days.length + 1)}
                  className="w-full py-3 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Dia {days.length + 1} ao Roteiro</span>
                </button>
              )}
            </div>
          )}

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2.5">
              {activeTab === 'info' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('builder')}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Próximo: Construtor de Dias & Pontos →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className="px-3.5 py-2 text-zinc-600 dark:text-zinc-400 text-xs font-semibold hover:underline cursor-pointer"
                >
                  ← Voltar às Informações
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSubmitting ? 'Salvando...' : itineraryToEdit ? 'Salvar Alterações' : 'Publicar Roteiro'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
