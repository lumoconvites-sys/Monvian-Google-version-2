import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Loader2, Upload } from 'lucide-react';
import { Itinerary, Spot } from '../../types';
import { uploadMediaToSupabaseStorage } from '../../lib/supabase';
import {
  buildItineraryFromOrderedSpots,
  getOrCreateItinerarySessionId,
  persistUserItineraryToBackend,
} from '../../utils/itineraryHelpers';

const DEFAULT_FALLBACK_COVER =
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85';

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
  onBackToMapSelection,
  onClose,
  onSavedAndGoToMyItineraries,
}) => {
  const isDark = theme === 'dark';
  const [title, setTitle] = useState<string>(() => {
    if (initialTitle && initialTitle.trim().length > 0) return initialTitle;
    if (mode === 'edit' && existingItinerary?.title) return existingItinerary.title;
    return '';
  });

  const [coverImage, setCoverImage] = useState<string>(() => {
    if (initialCoverImage && initialCoverImage.trim().length > 0) return initialCoverImage;
    if (mode === 'edit' && existingItinerary?.coverImage) return existingItinerary.coverImage;
    return '';
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTitle && initialTitle.trim().length > 0) {
      setTitle(initialTitle);
    } else if (mode === 'edit' && existingItinerary?.title) {
      setTitle(existingItinerary.title);
    } else {
      setTitle('');
    }

    if (initialCoverImage && initialCoverImage.trim().length > 0) {
      setCoverImage(initialCoverImage);
    } else if (mode === 'edit' && existingItinerary?.coverImage) {
      setCoverImage(existingItinerary.coverImage);
    } else {
      setCoverImage('');
    }
  }, [isOpen, mode, initialTitle, initialCoverImage, existingItinerary?.title, existingItinerary?.coverImage]);

  const handleTriggerFileUpload = () => {
    if (isUploadingPhoto) return;
    fileInputRef.current?.click();
  };

  const handleUploadCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediately create a local Data URL preview so the photo appears right away inside the card
    const readAsDataUrl = (f: File): Promise<string> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(typeof reader.result === 'string' ? reader.result : '');
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(f);
      });

    setIsUploadingPhoto(true);
    try {
      const localPreview = await readAsDataUrl(file);
      if (localPreview) {
        setCoverImage(localPreview);
      }

      const uploadedUrl = await uploadMediaToSupabaseStorage(file, 'itineraries', {
        maxDimension: 1280,
        quality: 0.85,
        filename: file.name,
      });
      if (uploadedUrl) {
        setCoverImage(uploadedUrl);
      }
    } catch {
      // Keep localPreview if remote storage upload fails
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveItinerary = async () => {
    if (selectedSpots.length === 0 || isSaving) return;
    setIsSaving(true);

    const cleanTitle = title.trim() || 'Roteiro Gastronômico';
    const finalCover =
      coverImage ||
      selectedSpots.find((s) => s.image)?.image ||
      DEFAULT_FALLBACK_COVER;

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
    onSavedAndGoToMyItineraries(finalItinerary);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="itinerary-finalize-fullscreen"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.82 }}
        className={`fixed inset-0 z-[270] flex flex-col select-none overflow-hidden ${
          isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#0B0B0C]'
        }`}
        style={{
          backgroundColor: isDark ? '#000000' : '#ffffff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
        }}
      >
        {/* Hidden File Input for Real Device Gallery Selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUploadCoverFile}
          className="hidden"
        />

        {/* 1. CABEÇALHO */}
        <div
          className={`w-full max-w-[480px] mx-auto px-6 pb-4 flex items-center justify-between shrink-0 ${
            isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
          }`}
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 16px) + 14px), 24px)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (mode === 'create') {
                onBackToMapSelection({ title, coverImage });
              } else {
                onClose();
              }
            }}
            aria-label="Voltar"
            title="Voltar"
            className={`w-[46px] h-[46px] rounded-full border flex items-center justify-center active:scale-95 transition-transform cursor-pointer ${
              isDark
                ? 'bg-[#171717] border-white/10 text-[#FFFFFF] shadow-[0_2px_10px_rgba(0,0,0,0.45)]'
                : 'bg-[#F5F5F7] border-black/[0.04] text-[#0B0B0C] shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
            }`}
          >
            <ChevronLeft className="w-6 h-6 -ml-0.5" strokeWidth={2.2} />
          </button>

          <h1
            className={`text-[20px] font-bold tracking-[-0.02em] text-center ${
              isDark ? 'text-[#FFFFFF]' : 'text-[#0B0B0C]'
            }`}
          >
            Finalizar roteiro
          </h1>

          <div className="w-[46px]" />
        </div>

        {/* CORPO PRINCIPAL */}
        <div
          className="flex-1 overflow-y-auto w-full max-w-[480px] mx-auto px-6 pt-3 pb-8"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* 2. CARD DE UPLOAD */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleTriggerFileUpload}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTriggerFileUpload();
              }
            }}
            className={`relative w-full min-h-[304px] rounded-[32px] border overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer transition-transform active:scale-[0.995] ${
              isDark
                ? 'bg-[#171717] border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.45)]'
                : 'bg-[#F7F7F9] border-black/[0.03] shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
            }`}
          >
            {coverImage ? (
              <div className="relative w-full h-[304px]">
                <img
                  src={coverImage}
                  alt={title || 'Foto do roteiro'}
                  className="w-full h-full object-cover"
                />
                {/* Opção discreta para substituir a fotografia */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerFileUpload();
                  }}
                  className="absolute bottom-4 right-4 px-4 py-2.5 rounded-full bg-black/75 backdrop-blur-md text-white text-[13.5px] font-semibold flex items-center gap-2 shadow-lg active:scale-95 transition-transform cursor-pointer"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" strokeWidth={2.2} />
                  )}
                  <span>Substituir foto</span>
                </button>
              </div>
            ) : (
              <div className="w-full px-7 py-9 flex flex-col items-center justify-center">
                {/* Ícone grande de imagem com símbolo de adicionar */}
                <div className="relative w-[78px] h-[66px] mb-5 flex items-center justify-center">
                  <svg
                    viewBox="0 0 76 64"
                    fill="none"
                    className="w-full h-full"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Moldura da fotografia */}
                    <rect
                      x="6"
                      y="6"
                      width="56"
                      height="44"
                      rx="9"
                      stroke={isDark ? '#858585' : '#8E8E93'}
                      strokeWidth="2.6"
                    />
                    {/* Sol */}
                    <circle
                      cx="21"
                      cy="20"
                      r="5"
                      stroke={isDark ? '#858585' : '#8E8E93'}
                      strokeWidth="2.5"
                    />
                    {/* Montanhas */}
                    <path
                      d="M11 46L35 26L45 35L53 28L61 36"
                      stroke={isDark ? '#858585' : '#8E8E93'}
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Círculo com símbolo de adicionar (+) */}
                    <circle cx="57" cy="46" r="14" fill={isDark ? '#FFFFFF' : '#0B0B0C'} />
                    <path
                      d="M57 40V52M51 46H63"
                      stroke={isDark ? '#000000' : '#FFFFFF'}
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Título */}
                <h2
                  className={`text-[22px] font-bold tracking-[-0.02em] leading-tight ${
                    isDark ? 'text-[#FFFFFF]' : 'text-[#0B0B0C]'
                  }`}
                >
                  Adicionar uma foto
                </h2>

                {/* Texto secundário */}
                <p
                  className={`mt-2 text-[15.5px] font-normal leading-[1.35] max-w-[235px] ${
                    isDark ? 'text-[#858585]' : 'text-[#71717A]'
                  }`}
                >
                  Faça upload de uma foto para seu roteiro
                </p>

                {/* Botão "Fazer upload" */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerFileUpload();
                  }}
                  className={`mt-7 w-full max-w-[295px] h-[56px] rounded-full flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform cursor-pointer ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#000000] shadow-[0_6px_20px_rgba(0,0,0,0.4)]'
                      : 'bg-[#0B0B0C] text-white shadow-[0_6px_18px_rgba(0,0,0,0.14)]'
                  }`}
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="w-5 h-5 animate-spin text-current" />
                  ) : (
                    <Upload className="w-[21px] h-[21px] text-current" strokeWidth={2.2} />
                  )}
                  <span className="text-[17px] font-semibold tracking-[-0.01em]">
                    Fazer upload
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 3. NOME DO ROTEIRO */}
          <div className="mt-8">
            <label
              htmlFor="itinerary-finalize-title-input"
              className={`block text-[18px] font-bold tracking-[-0.015em] mb-3 ${
                isDark ? 'text-[#FFFFFF]' : 'text-[#0B0B0C]'
              }`}
            >
              Nome do roteiro
            </label>
            <input
              id="itinerary-finalize-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Roteiro Gastronômico"
              maxLength={60}
              className={`w-full h-[58px] px-5 rounded-[20px] border text-[17px] font-normal outline-none transition-colors ${
                isDark
                  ? 'bg-[#171717] border-white/10 text-[#FFFFFF] placeholder:text-[#858585] focus:border-white/30'
                  : 'bg-[#F5F5F7] border-black/[0.04] text-[#0B0B0C] placeholder:text-[#8E8E93] focus:border-black/20'
              }`}
            />
          </div>

          {/* 4. PARADAS DO ROTEIRO */}
          <div
            className={`mt-7 pt-1 pb-5 border-b flex items-center justify-between gap-3 ${
              isDark ? 'border-white/10' : 'border-[#EFEFF2]'
            }`}
          >
            <span
              className={`text-[18px] font-bold tracking-[-0.015em] ${
                isDark ? 'text-[#FFFFFF]' : 'text-[#0B0B0C]'
              }`}
            >
              Paradas do roteiro ({selectedSpots.length})
            </span>

            <button
              type="button"
              onClick={() => onBackToMapSelection({ title, coverImage })}
              className={`px-5 h-[44px] rounded-full text-[15px] font-semibold flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-[#171717] hover:bg-[#222222] border border-white/10 text-[#FFFFFF]'
                  : 'bg-[#F2F2F5] hover:bg-[#EAEAEF] text-[#0B0B0C]'
              }`}
            >
              Adicionar novo
            </button>
          </div>
        </div>

        {/* 5. BOTÃO INFERIOR FIXO */}
        <div
          className={`w-full border-t shrink-0 ${
            isDark ? 'bg-[#000000] border-white/10' : 'bg-[#FFFFFF] border-[#EFEFF2]'
          }`}
          style={{
            paddingTop: '16px',
            paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
          }}
        >
          <div className="w-full max-w-[480px] mx-auto px-6">
            <button
              type="button"
              disabled={selectedSpots.length === 0 || isSaving}
              onClick={handleSaveItinerary}
              className={`w-full h-[58px] rounded-full font-bold text-[17.5px] tracking-[-0.01em] flex items-center justify-center gap-2 transition-all ${
                selectedSpots.length > 0 && !isSaving
                  ? isDark
                    ? 'bg-[#FFFFFF] text-[#000000] shadow-[0_8px_24px_rgba(0,0,0,0.45)] active:scale-[0.98] cursor-pointer'
                    : 'bg-[#0B0B0C] text-white shadow-[0_8px_24px_rgba(0,0,0,0.14)] active:scale-[0.98] cursor-pointer'
                  : isDark
                    ? 'bg-[#171717] text-[#858585] border border-white/10 cursor-not-allowed shadow-none'
                    : 'bg-[#E5E5EA] text-[#8E8E93] cursor-not-allowed shadow-none'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Salvando roteiro…</span>
                </>
              ) : (
                <span>Salvar roteiro</span>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
