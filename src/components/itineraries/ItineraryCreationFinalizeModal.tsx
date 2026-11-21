import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Navigation,
} from 'lucide-react';
import { Itinerary, Spot } from '../../types';
import { AppleBackButton } from '../ui/AppleBackButton';
import { LazyImage } from '../ui/LazyImage';
import { getSpotCardThumbnail, getSpotFallbackImage } from '../../utils/spotImages';
import { uploadMediaToSupabaseStorage } from '../../lib/supabase';
import {
  buildItineraryFromOrderedSpots,
  getOrCreateItinerarySessionId,
  persistUserItineraryToBackend,
} from '../../utils/itineraryHelpers';

const MONVIAN_CURATED_COVERS: { id: string; label: string; url: string }[] = [
  {
    id: 'portal-campos',
    label: 'Portal de Campos do Jordão',
    url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'amantikir-gardens',
    label: 'Jardins & Araucárias',
    url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'teleferico-capivari',
    label: 'Vista Panorâmica da Serra',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'mantiqueira-sunset',
    label: 'Montanhas da Mantiqueira',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'gastronomia-inverno',
    label: 'Gastronomia & Charme Alpino',
    url: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'bosque-outono',
    label: 'Bosques & Natureza',
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85',
  },
];

interface ItineraryCreationFinalizeModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialCoverImage?: string;
  existingItinerary?: Itinerary | null;
  selectedSpots: Spot[];
  theme?: 'dark' | 'light';
  user?: any;
  onChangeSelectedSpots: (nextSpots: Spot[]) => void;
  onBackToMapSelection: (draftState: { title: string; coverImage: string }) => void;
  onClose: () => void;
  onSavedAndViewOnMap: (savedItinerary: Itinerary) => void;
  onSavedAndGoToMyItineraries: (savedItinerary: Itinerary) => void;
}

export const ItineraryCreationFinalizeModal: React.FC<ItineraryCreationFinalizeModalProps> = ({
  isOpen,
  mode,
  initialTitle = '',
  initialCoverImage = '',
  existingItinerary = null,
  selectedSpots,
  theme = 'light',
  user,
  onChangeSelectedSpots,
  onBackToMapSelection,
  onClose,
  onSavedAndViewOnMap,
  onSavedAndGoToMyItineraries,
}) => {
  const isDark = theme === 'dark';

  const getSuggestedTitle = useCallback(() => {
    if (initialTitle && initialTitle.trim().length > 0) return initialTitle.trim();
    if (existingItinerary?.title) return existingItinerary.title;
    if (selectedSpots.length > 0) {
      const hasFood = selectedSpots.some(
        (s) => s.category === 'gastronomy' || s.category === 'restaurants' || s.category === 'cafes' || s.category === 'sweets'
      );
      const hasNature = selectedSpots.some(
        (s) => s.category === 'parks' || s.category === 'viewpoint' || s.category === 'attractions'
      );
      if (hasFood && !hasNature) return 'Roteiro Gastronômico';
      if (hasNature && selectedSpots.length >= 3) return 'Fim de Semana em Campos';
    }
    return 'Meu Roteiro em Campos';
  }, [initialTitle, existingItinerary?.title, selectedSpots]);

  const [title, setTitle] = useState<string>(() => getSuggestedTitle());
  const [coverImage, setCoverImage] = useState<string>(
    () => initialCoverImage || existingItinerary?.coverImage || ''
  );
  const [isGeneratingCover, setIsGeneratingCover] = useState<boolean>(false);
  const [coverGenerationError, setCoverGenerationError] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState<boolean>(false);
  const [isUploadingCustomPhoto, setIsUploadingCustomPhoto] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedItineraryResult, setSavedItineraryResult] = useState<Itinerary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasAutoTriggeredCoverRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateAICover = useCallback(
    async (customTitle?: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsGeneratingCover(true);
      setCoverGenerationError(null);

      try {
        const res = await fetch('/api/itineraries/generate-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            title: (customTitle ?? title).trim() || 'Experiência em Campos do Jordão',
            spots: selectedSpots.map((s) => ({
              id: s.id,
              name: s.name,
              category: s.category,
              categoryLabel: s.categoryLabel,
              description: s.description,
            })),
          }),
        });

        if (controller.signal.aborted) return;

        const data = await res.json().catch(() => null);
        if (res.ok && data?.success && data?.coverImage) {
          setCoverImage(data.coverImage);
          setCoverGenerationError(null);
        } else {
          setCoverGenerationError(
            data?.error ||
              'Não foi possível gerar a capa automática agora. Tente novamente ou escolha uma fotografia abaixo.'
          );
          setShowLibraryPicker(true);
          if (!coverImage) {
            const firstSpotImg = selectedSpots.find((s) => s.image)?.image;
            setCoverImage(firstSpotImg || MONVIAN_CURATED_COVERS[0].url);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setCoverGenerationError(
          'Não foi possível concluir a geração por IA. Você pode tentar novamente ou escolher uma fotografia abaixo.'
        );
        setShowLibraryPicker(true);
        if (!coverImage) {
          const firstSpotImg = selectedSpots.find((s) => s.image)?.image;
          setCoverImage(firstSpotImg || MONVIAN_CURATED_COVERS[0].url);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsGeneratingCover(false);
          abortControllerRef.current = null;
        }
      }
    },
    [title, selectedSpots, coverImage]
  );

  useEffect(() => {
    if (!isOpen) {
      hasAutoTriggeredCoverRef.current = false;
      setSavedItineraryResult(null);
      abortControllerRef.current?.abort();
      return;
    }

    const nextSuggestedTitle = getSuggestedTitle();
    setTitle(nextSuggestedTitle);

    const existingCover = initialCoverImage || existingItinerary?.coverImage || '';
    if (existingCover) {
      setCoverImage(existingCover);
    }

    // Automatically generate AI cover when finalizing a new itinerary that doesn't have a cover yet
    if (mode === 'create' && !existingCover && !hasAutoTriggeredCoverRef.current) {
      hasAutoTriggeredCoverRef.current = true;
      void generateAICover(nextSuggestedTitle);
    }
  }, [isOpen, mode, initialCoverImage, existingItinerary?.coverImage, getSuggestedTitle, generateAICover]);

  const handleMoveSpot = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= selectedSpots.length) return;
    const next = [...selectedSpots];
    const temp = next[targetIdx];
    next[targetIdx] = next[index];
    next[index] = temp;
    onChangeSelectedSpots(next);
  };

  const handleRemoveSpot = (spotId: string) => {
    const next = selectedSpots.filter((s) => s.id !== spotId);
    onChangeSelectedSpots(next);
  };

  const handleUploadCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCustomPhoto(true);
    setCoverGenerationError(null);
    try {
      const uploadedUrl = await uploadMediaToSupabaseStorage(file, 'itineraries', {
        maxDimension: 1280,
        quality: 0.85,
        filename: file.name,
      });
      if (uploadedUrl) {
        setCoverImage(uploadedUrl);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setCoverImage(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCoverImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingCustomPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveItinerary = async () => {
    if (selectedSpots.length === 0 || isSaving) return;
    setIsSaving(true);

    const cleanTitle = title.trim() || 'Meu Roteiro em Campos';
    const finalCover =
      coverImage ||
      selectedSpots.find((s) => s.image)?.image ||
      MONVIAN_CURATED_COVERS[0].url;

    const built = buildItineraryFromOrderedSpots(selectedSpots, {
      existingItinerary: mode === 'edit' ? existingItinerary : null,
      targetDayIndex: 0,
      title: cleanTitle,
      coverImage: finalCover,
    });

    const finalItinerary: Itinerary = {
      ...built,
      id: mode === 'edit' && existingItinerary?.id ? existingItinerary.id : built.id,
      title: cleanTitle,
      coverImage: finalCover,
      placesCount: selectedSpots.length,
      createdAt:
        mode === 'edit' && existingItinerary?.createdAt
          ? existingItinerary.createdAt
          : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const sessionId = getOrCreateItinerarySessionId(user);
      await persistUserItineraryToBackend(
        finalItinerary,
        mode === 'edit' ? 'PUT' : 'POST',
        sessionId,
        user
      );
    } catch {}

    setIsSaving(false);
    setSavedItineraryResult(finalItinerary);
  };

  // Combine Monvian curated covers + photos of selected spots for the library picker
  const libraryChoices = React.useMemo(() => {
    const spotPhotos = selectedSpots
      .filter((s) => Boolean(s.image))
      .map((s) => ({
        id: `spot-${s.id}`,
        label: s.name,
        url: getSpotCardThumbnail(s),
      }));
    const seen = new Set<string>();
    const combined: { id: string; label: string; url: string }[] = [];
    for (const item of [...MONVIAN_CURATED_COVERS, ...spotPhotos]) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      combined.push(item);
    }
    return combined;
  }, [selectedSpots]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="itinerary-finalize-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[270] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center select-none"
      >
        <motion.div
          key="itinerary-finalize-modal-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.82 }}
          className={`w-full md:max-w-[520px] h-[94dvh] md:h-[88vh] rounded-t-[34px] md:rounded-[34px] overflow-hidden flex flex-col shadow-[0_-14px_48px_rgba(0,0,0,0.22)] ${
            isDark ? 'bg-[#000000] text-white border border-white/10' : 'bg-[#FFFFFF] text-[#111111]'
          }`}
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
          }}
        >
          {/* Hidden file input for custom cover upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/jpg"
            onChange={handleUploadCoverFile}
            className="hidden"
          />

          {/* Top Bar */}
          <div
            className={`px-5 pt-4 pb-3 flex items-center justify-between border-b shrink-0 ${
              isDark ? 'border-white/10 bg-[#000000]' : 'border-black/[0.06] bg-[#FFFFFF]'
            }`}
          >
            <AppleBackButton
              theme={isDark ? 'dark' : 'light'}
              onClick={() => {
                if (savedItineraryResult) {
                  onSavedAndGoToMyItineraries(savedItineraryResult);
                  return;
                }
                if (mode === 'create') {
                  onBackToMapSelection({ title, coverImage });
                } else {
                  onClose();
                }
              }}
              title="Voltar"
              aria-label="Voltar"
            />

            <h2 className="text-[18px] font-bold tracking-tight text-center">
              {savedItineraryResult
                ? 'Roteiro Salvo'
                : mode === 'edit'
                  ? 'Editar roteiro'
                  : 'Finalizar roteiro'}
            </h2>

            <div className="w-10" />
          </div>

          {/* Content Body */}
          {savedItineraryResult ? (
            /* ============================================================
             * POST-SAVE CONFIRMATION SCREEN ("Seu roteiro está pronto!")
             * ============================================================ */
            <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                className="w-16 h-16 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center mb-5 shadow-lg"
              >
                <Check className="w-8 h-8 stroke-[2.8]" />
              </motion.div>

              <h3 className="text-[26px] font-extrabold tracking-tight leading-tight mb-2">
                Seu roteiro está pronto!
              </h3>
              <p className="text-[14.5px] font-medium text-[#8E8E93] max-w-[320px] mb-6">
                {savedItineraryResult.title} foi salvo com {selectedSpots.length}{' '}
                {selectedSpots.length === 1 ? 'parada' : 'paradas'} em Campos do Jordão.
              </p>

              {/* Saved Preview Card */}
              <div
                className={`w-full max-w-[380px] rounded-[28px] overflow-hidden border mb-7 text-left shadow-[0_10px_30px_rgba(0,0,0,0.08)] ${
                  isDark ? 'bg-[#171717] border-white/10' : 'bg-[#FFFFFF] border-black/[0.06]'
                }`}
              >
                <div className="relative w-full h-[180px] bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                  <img
                    src={savedItineraryResult.coverImage}
                    alt={savedItineraryResult.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-[17px] font-bold tracking-tight truncate">
                      {savedItineraryResult.title}
                    </h4>
                    <p className="text-[12.5px] font-medium text-[#8E8E93] mt-0.5">
                      {selectedSpots.length}{' '}
                      {selectedSpots.length === 1 ? 'local selecionado' : 'locais selecionados'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-[380px] space-y-3">
                <button
                  type="button"
                  onClick={() => onSavedAndViewOnMap(savedItineraryResult)}
                  className={`w-full h-[54px] rounded-full font-bold text-[15.5px] flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] transition-transform cursor-pointer ${
                    isDark ? 'bg-white text-black' : 'bg-[#000000] text-white'
                  }`}
                >
                  <Navigation className="w-4 h-4 fill-current" />
                  <span>Visualizar roteiro no mapa</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSavedAndGoToMyItineraries(savedItineraryResult)}
                  className={`w-full h-[54px] rounded-full font-bold text-[15.5px] flex items-center justify-center transition-colors active:scale-[0.98] cursor-pointer ${
                    isDark
                      ? 'bg-[#1C1C1E] text-white border border-white/10 hover:bg-zinc-800'
                      : 'bg-[#F2F2F7] text-[#111111] hover:bg-zinc-200/80'
                  }`}
                >
                  <span>Voltar para Meus roteiros</span>
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================
             * EDIT / FINALIZE FORM VIEW
             * ============================================================ */
            <>
              <div
                className="flex-1 overflow-y-auto px-5 py-5 space-y-6"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {/* 1. AI Cover Image Card */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[13px] font-bold uppercase tracking-wider text-[#8E8E93]">
                      Capa do roteiro
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isGeneratingCover}
                        onClick={() => generateAICover(title)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                          isDark
                            ? 'bg-[#1C1C1E] text-white border border-white/10 hover:bg-zinc-800'
                            : 'bg-[#F2F2F7] text-[#111111] hover:bg-zinc-200/80'
                        } ${isGeneratingCover ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{coverImage ? 'Gerar nova capa IA' : 'Gerar capa IA'}</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className={`relative w-full h-[200px] sm:h-[220px] rounded-[26px] overflow-hidden border ${
                      isDark
                        ? 'bg-[#141416] border-white/10'
                        : 'bg-[#F5F5F7] border-black/[0.06]'
                    }`}
                  >
                    {isGeneratingCover ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-black/90 dark:bg-white/90 text-white dark:text-black flex items-center justify-center mb-3.5 shadow-md">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                        <p className="text-[15px] font-bold tracking-tight">
                          Preparando a capa da sua experiência…
                        </p>
                        <p className="text-[12.5px] font-medium text-[#8E8E93] mt-1 max-w-[260px]">
                          Criando fotografia exclusiva de Campos do Jordão com base no seu roteiro
                        </p>
                      </div>
                    ) : coverImage ? (
                      <>
                        <img
                          src={coverImage}
                          alt={title || 'Capa do roteiro'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setShowLibraryPicker((prev) => !prev)}
                            className="px-3.5 py-2 rounded-full bg-white/95 text-black text-[12px] font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Biblioteca</span>
                          </button>

                          <button
                            type="button"
                            disabled={isUploadingCustomPhoto}
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2 rounded-full bg-black/75 backdrop-blur-md text-white text-[12px] font-bold shadow-md flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
                          >
                            {isUploadingCustomPhoto ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            <span>Enviar foto</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <button
                          type="button"
                          onClick={() => generateAICover(title)}
                          className="px-5 py-2.5 rounded-full bg-black text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Gerar capa por IA</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Error notice with Retry + Library fallback */}
                  {coverGenerationError && (
                    <div
                      className={`mt-2.5 p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-[#1C1C1E] border-white/10 text-zinc-200'
                          : 'bg-[#F8F8FA] border-black/[0.06] text-zinc-800'
                      }`}
                    >
                      <p className="text-[12.5px] font-medium leading-snug flex-1">
                        {coverGenerationError}
                      </p>
                      <button
                        type="button"
                        onClick={() => generateAICover(title)}
                        className="px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[11.5px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Tentar novamente</span>
                      </button>
                    </div>
                  )}

                  {/* Expandable Monvian Library & Upload Picker */}
                  <AnimatePresence>
                    {showLibraryPicker && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-bold text-[#8E8E93]">
                              Biblioteca Monvian ou foto própria
                            </span>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-[12px] font-bold text-black dark:text-white underline cursor-pointer"
                            >
                              Enviar do aparelho
                            </button>
                          </div>
                          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                            {libraryChoices.map((choice) => {
                              const isSelected = coverImage === choice.url;
                              return (
                                <button
                                  key={choice.id}
                                  type="button"
                                  onClick={() => setCoverImage(choice.url)}
                                  className={`relative w-24 h-16 rounded-2xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-black dark:border-white scale-[1.02]'
                                      : 'border-transparent opacity-80 hover:opacity-100'
                                  }`}
                                  title={choice.label}
                                >
                                  <img
                                    src={choice.url}
                                    alt={choice.label}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 2. Itinerary Title Input */}
                <div>
                  <label
                    htmlFor="itinerary-custom-title-input"
                    className="block text-[13px] font-bold uppercase tracking-wider text-[#8E8E93] mb-2"
                  >
                    Nome do roteiro
                  </label>
                  <input
                    id="itinerary-custom-title-input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Fim de Semana Romântico"
                    maxLength={60}
                    className={`w-full h-[54px] px-4 rounded-[20px] text-[16px] font-bold tracking-tight outline-none border transition-colors ${
                      isDark
                        ? 'bg-[#171717] border-white/15 text-white focus:border-white'
                        : 'bg-[#F5F5F7] border-black/[0.06] text-[#111111] focus:border-black focus:bg-white'
                    }`}
                  />
                </div>

                {/* 3. Selected Tourist Spots & Order */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[15px] font-bold tracking-tight">
                        Paradas do roteiro ({selectedSpots.length})
                      </h3>
                      <p className="text-[12px] font-medium text-[#8E8E93]">
                        Ordem das paradas selecionadas no mapa
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onBackToMapSelection({ title, coverImage })}
                      className={`px-3.5 py-2 rounded-full text-[12.5px] font-bold flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                        isDark
                          ? 'bg-[#1C1C1E] text-white border border-white/10'
                          : 'bg-[#F2F2F7] text-[#111111]'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.4]" />
                      <span>Adicionar no mapa</span>
                    </button>
                  </div>

                  {selectedSpots.length === 0 ? (
                    <div
                      className={`p-6 rounded-[24px] border text-center ${
                        isDark ? 'bg-[#171717] border-white/10' : 'bg-[#F7F7F9] border-black/[0.05]'
                      }`}
                    >
                      <MapPin className="w-7 h-7 mx-auto mb-2 text-[#8E8E93]" />
                      <p className="text-[14px] font-bold mb-1">
                        Nenhum local selecionado
                      </p>
                      <p className="text-[12.5px] text-[#8E8E93] mb-4">
                        Volte ao mapa Explorar para selecionar os pontos turísticos do seu roteiro.
                      </p>
                      <button
                        type="button"
                        onClick={() => onBackToMapSelection({ title, coverImage })}
                        className="px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold cursor-pointer"
                      >
                        Selecionar locais no mapa
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedSpots.map((spot, idx) => (
                        <div
                          key={spot.id}
                          className={`p-3 rounded-[22px] border flex items-center justify-between gap-2.5 ${
                            isDark
                              ? 'bg-[#171717] border-white/10'
                              : 'bg-[#FFFFFF] border-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.03)]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span
                              className={`w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums ${
                                isDark ? 'bg-white text-black' : 'bg-[#000000] text-white'
                              }`}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>

                            <div className="w-12 h-12 rounded-[14px] overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800">
                              <LazyImage
                                src={getSpotCardThumbnail(spot)}
                                alt={spot.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = getSpotFallbackImage(
                                    spot.name,
                                    spot.category
                                  );
                                }}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#8E8E93] truncate">
                                {spot.categoryLabel || 'Ponto Turístico'}
                              </p>
                              <h4 className="text-[14.5px] font-bold tracking-tight truncate">
                                {spot.name}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveSpot(idx, 'up')}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                idx === 0
                                  ? 'opacity-25 cursor-not-allowed'
                                  : isDark
                                    ? 'hover:bg-white/10 text-white'
                                    : 'hover:bg-zinc-100 text-zinc-700'
                              }`}
                              title="Mover para cima"
                              aria-label="Mover para cima"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === selectedSpots.length - 1}
                              onClick={() => handleMoveSpot(idx, 'down')}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                idx === selectedSpots.length - 1
                                  ? 'opacity-25 cursor-not-allowed'
                                  : isDark
                                    ? 'hover:bg-white/10 text-white'
                                    : 'hover:bg-zinc-100 text-zinc-700'
                              }`}
                              title="Mover para baixo"
                              aria-label="Mover para baixo"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveSpot(spot.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remover parada"
                              aria-label="Remover parada"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Bottom Save Button */}
              <div
                className={`p-5 border-t shrink-0 ${
                  isDark ? 'bg-[#000000] border-white/10' : 'bg-[#FFFFFF] border-black/[0.06]'
                }`}
                style={{
                  paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 14px))',
                }}
              >
                <button
                  type="button"
                  disabled={selectedSpots.length === 0 || isSaving || isGeneratingCover}
                  onClick={handleSaveItinerary}
                  className={`w-full h-[56px] rounded-full font-bold text-[16px] tracking-tight flex items-center justify-center gap-2 shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition-all ${
                    selectedSpots.length > 0 && !isSaving && !isGeneratingCover
                      ? isDark
                        ? 'bg-white text-black active:scale-[0.98] cursor-pointer'
                        : 'bg-[#000000] text-white active:scale-[0.98] cursor-pointer'
                      : isDark
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Salvando roteiro…</span>
                    </>
                  ) : (
                    <span>{mode === 'edit' ? 'Salvar alterações' : 'Salvar roteiro'}</span>
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
