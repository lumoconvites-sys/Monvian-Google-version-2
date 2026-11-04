import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MapPin, 
  Type, 
  Check, 
  ChevronDown, 
  Camera, 
  Image as ImageIcon, 
  SlidersHorizontal,
  Music,
  LayoutGrid,
  Sparkles,
  FolderOpen
} from 'lucide-react';
import { Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryPublished: () => void;
  currentUser: { id: string; name: string; photo: string };
  spots?: Spot[];
}

/**
 * High-quality media gallery samples for Campos do Jordão
 */
const CAMPOS_RECENT_MEDIA = [
  {
    id: 'media-01',
    url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Vila Capivari, Campos do Jordão'
  },
  {
    id: 'media-02',
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Restaurante Ludwig, Capivari'
  },
  {
    id: 'media-03',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Parque Capivari, Morro do Elefante'
  },
  {
    id: 'media-04',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Bosque do Silêncio'
  },
  {
    id: 'media-05',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Complexo da Pedra do Baú'
  },
  {
    id: 'media-06',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Cervejaria Baden Baden'
  },
  {
    id: 'media-07',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Parque Amantikir'
  },
  {
    id: 'media-08',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Horto Florestal'
  },
  {
    id: 'media-09',
    url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Mirante da Vista Chinesa'
  },
  {
    id: 'media-10',
    url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Ducha de Prata'
  },
  {
    id: 'media-11',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Vinícola Villa Santa Maria'
  },
  {
    id: 'media-12',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1080&q=85',
    type: 'image',
    location: 'Praça São Benedito'
  }
];

/**
 * iOS Minimalist Orbital Media Loading Animation (2 seconds)
 */
const OrbitalStoryLoader: React.FC<{ mediaUrl: string; mediaType: 'image' | 'video' }> = ({
  mediaUrl,
  mediaType
}) => {
  const radius = 56;
  const cardSize = 70;
  const borderRadius = 18;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="absolute inset-0 z-50 bg-[#000000]/95 backdrop-blur-md flex items-center justify-center select-none"
    >
      <div className="relative w-56 h-56 flex items-center justify-center">
        {/* Subtle, elegant orbital circular guide ring */}
        <div
          className="absolute rounded-full border border-white/[0.09]"
          style={{ width: radius * 2, height: radius * 2 }}
        />

        {/* Center anchor */}
        <div className="w-1.5 h-1.5 rounded-full bg-white/20 z-0" />

        {/* Rotating orbital system with natural physics */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2.0,
            ease: [0.42, 0, 0.58, 1],
            repeat: Infinity,
          }}
        >
          <div
            className="absolute flex items-center justify-center"
            style={{ transform: `translate(${radius}px, 0px)` }}
          >
            {/* Counter-rotate to keep media upright */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{
                duration: 2.0,
                ease: [0.42, 0, 0.58, 1],
                repeat: Infinity,
              }}
              className="overflow-hidden bg-[#121214] border border-white/25 shadow-2xl ring-1 ring-black/40"
              style={{
                width: cardSize,
                height: cardSize,
                borderRadius: borderRadius,
              }}
            >
              {mediaType === 'video' ? (
                <video
                  src={mediaUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt="Story"
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onStoryPublished,
  currentUser,
  spots = []
}) => {
  // Step state: 'welcome' | 'gallery_picker' | 'editor'
  const [step, setStep] = useState<'welcome' | 'gallery_picker' | 'editor'>('welcome');
  const [selectedMediaData, setSelectedMediaData] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('Campos do Jordão, SP');
  const [isAddingText, setIsAddingText] = useState<boolean>(false);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState<boolean>(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const availableSpots = spots.length > 0 ? spots : CAMPOS_SPOTS;
  const filteredSpots = availableSpots.filter((s) => {
    if (!locationSearchQuery.trim()) return true;
    const q = locationSearchQuery.toLowerCase().trim();
    return s.name.toLowerCase().includes(q) || (s.categoryLabel && s.categoryLabel.toLowerCase().includes(q));
  });

  const handleDeviceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      alert('Por favor, selecione uma foto ou vídeo.');
      return;
    }

    setMediaType(isVideo ? 'video' : 'image');

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedMediaData(result);
      setCaption('');
      setSelectedLocation('Campos do Jordão, SP');
      setIsLocationSelectorOpen(false);
      setIsAddingText(false);
      setStep('editor');
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleSelectSampleMedia = (item: typeof CAMPOS_RECENT_MEDIA[0]) => {
    setSelectedMediaData(item.url);
    setMediaType(item.type as 'image' | 'video');
    setCaption('');
    setSelectedLocation(item.location || 'Campos do Jordão, SP');
    setIsLocationSelectorOpen(false);
    setIsAddingText(false);
    setStep('editor');
  };

  const handlePublishStory = async () => {
    if (!selectedMediaData || isPublishing) return;
    setIsPublishing(true);

    const startTime = Date.now();
    const TARGET_DURATION_MS = 2000;

    try {
      // 1. Upload media or reference
      let finalMediaUrl = selectedMediaData;

      if (selectedMediaData.startsWith('data:')) {
        const uploadRes = await fetch('/api/stories/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: selectedMediaData })
        });
        const uploadData = await uploadRes.json();

        if (!uploadData.success || !uploadData.mediaUrl) {
          throw new Error(uploadData.error || 'Falha no upload do story');
        }
        finalMediaUrl = uploadData.mediaUrl;
      }

      // 2. Create story record with 24-hour expiration
      const token = localStorage.getItem('monvian_token') || '';
      const storyRes = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          mediaUrl: finalMediaUrl,
          mediaType: mediaType,
          caption: caption.trim(),
          location: selectedLocation.trim() || 'Campos do Jordão, SP',
          clientId: currentUser.id,
          userName: currentUser.name,
          userPhoto: currentUser.photo
        })
      });

      const storyData = await storyRes.json();
      if (!storyData.success) {
        throw new Error(storyData.error || 'Falha ao salvar story');
      }

      // 3. Ensure exactly 2 seconds of smooth animation
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, TARGET_DURATION_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      // 4. Return to main screen and refresh stories tray
      setIsPublishing(false);
      setSelectedMediaData(null);
      setCaption('');
      setSelectedLocation('');
      setStep('welcome');
      onStoryPublished();
      onClose();
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, TARGET_DURATION_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      setIsPublishing(false);
      console.error('[CreateStoryModal] Error publishing story:', err);
      alert('Não foi possível publicar o story. Tente novamente.');
    }
  };

  const handleClose = () => {
    setStep('welcome');
    setSelectedMediaData(null);
    setCaption('');
    setSelectedLocation('');
    setIsAddingText(false);
    setIsLocationSelectorOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="create-story-fullscreen-overlay"
        initial={{ opacity: 0, y: '100%', scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: '100%', scale: 0.96 }}
        transition={{ type: 'spring', damping: 32, stiffness: 360, mass: 0.75 }}
        className="fixed inset-0 z-55 flex flex-col bg-black text-white select-none overflow-hidden transform-gpu will-change-transform rounded-t-[26px] ios-page-top-rounded"
        style={{
          height: '100dvh',
          width: '100vw',
          fontFamily: "'Inter', sans-serif",
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
          overflow: 'hidden',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          isolation: 'isolate',
        }}
      >
        {/* Hidden file inputs for device camera & gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleDeviceFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleDeviceFileSelect}
      />

      {/* ============================================================== */}
      {/* 1. WELCOME SCREEN (Clean, spacious, 2 big iOS buttons)         */}
      {/* ============================================================== */}
      {step === 'welcome' && (
        <div className="flex-1 w-full h-full flex flex-col justify-between px-6 bg-black">
          {/* Top Bar */}
          <header
            className="w-full flex items-center justify-between z-20 shrink-0 pb-4"
            style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)' }}
          >
            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer border border-white/10"
              title="Fechar"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>

            <h1 className="text-[17.5px] font-bold text-white tracking-tight">
              Criar Story
            </h1>

            <div className="w-10" />
          </header>

          {/* Central Area: Premium Camera Icon + Spacious Text */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="w-20 h-20 rounded-full bg-[#141416] border border-white/10 flex items-center justify-center mb-6 text-white shadow-2xl">
              <Camera className="w-9 h-9 stroke-[1.8] text-white/90" />
            </div>

            <h2 className="text-2xl font-black text-white mb-2.5 tracking-tight">
              Compartilhe seu momento
            </h2>

            <p className="text-[13px] text-zinc-400 leading-relaxed max-w-[280px]">
              Seus stories ficam visíveis por 24 horas para todos os visitantes de Campos do Jordão.
            </p>
          </div>

          {/* Bottom Actions: 2 Big iOS Buttons */}
          <div
            className="w-full space-y-3 pt-4 pb-6"
            style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 16px), 28px)' }}
          >
            {/* Primary Button: Escolher da Galeria */}
            <button
              type="button"
              onClick={() => setStep('gallery_picker')}
              className="w-full py-4 px-5 rounded-full bg-white text-black text-[14.5px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-xl"
            >
              <ImageIcon className="w-5 h-5 stroke-[2.2]" />
              <span>Escolher da Galeria (Foto ou Vídeo)</span>
            </button>

            {/* Secondary Button: Câmera */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-4 px-5 rounded-full bg-[#181818] hover:bg-[#202020] text-white text-[14.5px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer border border-white/10"
            >
              <Camera className="w-5 h-5 stroke-[2.2]" />
              <span>Câmera</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. GALLERY PICKER SCREEN (Instagram-style Media Selector)       */}
      {/* ============================================================== */}
      {step === 'gallery_picker' && (
        <div className="flex-1 w-full h-full flex flex-col bg-black overflow-hidden">
          {/* Top Bar: X | Adicionar ao story | Configurações */}
          <header
            className="w-full px-4 pb-3 flex items-center justify-between z-20 shrink-0 border-b border-white/[0.08] bg-black"
            style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)' }}
          >
            <button
              type="button"
              onClick={() => setStep('welcome')}
              className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer border border-white/10"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>

            <h1 className="text-[17.5px] font-bold text-white tracking-tight">
              Adicionar ao story
            </h1>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Abrir arquivos do dispositivo"
              className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer border border-white/10"
            >
              <SlidersHorizontal className="w-4.5 h-4.5" />
            </button>
          </header>

          {/* Shortcuts Pills Row: "Sua vez", "Música", "Colagem" */}
          <div className="w-full overflow-x-auto no-scrollbar px-4 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.12] hover:bg-white/[0.18] active:scale-95 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border border-white/10"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
              <span>Sua vez</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.12] hover:bg-white/[0.18] active:scale-95 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border border-white/10"
            >
              <Music className="w-3.5 h-3.5 text-zinc-300" />
              <span>Música</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.12] hover:bg-white/[0.18] active:scale-95 text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border border-white/10"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-zinc-300" />
              <span>Colagem</span>
            </button>
          </div>

          {/* Sub-header: "Recentes ▾" + "Selecionar" */}
          <div className="w-full px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1 text-sm font-bold text-white cursor-pointer">
              <span>Recentes</span>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 rounded-full bg-white/[0.12] hover:bg-white/[0.18] text-xs font-bold text-white cursor-pointer transition-colors"
            >
              Selecionar
            </button>
          </div>

          {/* 3-Column Grid of Recent Media */}
          <div
            className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-3 gap-1 px-1 pb-8"
            style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)' }}
          >
            {/* Device Import Tile */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square bg-[#161618] hover:bg-[#202024] border border-dashed border-white/20 flex flex-col items-center justify-center text-center p-2 transition-colors cursor-pointer group"
            >
              <FolderOpen className="w-6 h-6 text-zinc-400 group-hover:text-white mb-1" />
              <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white">Galeria Local</span>
            </button>

            {/* Camera Capture Tile */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="aspect-square bg-[#161618] hover:bg-[#202024] border border-white/10 flex flex-col items-center justify-center text-center p-2 transition-colors cursor-pointer group"
            >
              <Camera className="w-6 h-6 text-zinc-400 group-hover:text-white mb-1" />
              <span className="text-[11px] font-bold text-zinc-300 group-hover:text-white">Abrir Câmera</span>
            </button>

            {/* Curated Gallery Media Grid */}
            {CAMPOS_RECENT_MEDIA.map((item) => (
              <motion.div
                key={item.id}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                onClick={() => handleSelectSampleMedia(item)}
                className="aspect-square relative overflow-hidden bg-zinc-900 cursor-pointer group transform-gpu will-change-transform"
              >
                <img
                  src={item.url}
                  alt="Mídia de Campos do Jordão"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. STORY EDITOR & PUBLISHER SCREEN (Full 9:16 Preview)         */}
      {/* ============================================================== */}
      {step === 'editor' && selectedMediaData && (
        <div className="relative w-full h-full flex flex-col overflow-hidden bg-black">
          {/* Orbital loader during 2-second publishing animation */}
          <AnimatePresence>
            {isPublishing && (
              <OrbitalStoryLoader mediaUrl={selectedMediaData} mediaType={mediaType} />
            )}
          </AnimatePresence>

          {/* Media Fullscreen Preview */}
          <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center bg-black">
            {mediaType === 'video' ? (
              <video
                src={selectedMediaData}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={selectedMediaData}
                alt="Pré-visualização do story"
                className="w-full h-full object-cover"
              />
            )}

            {/* Gradient overlays for controls readability */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-10" />

            {/* Story Text Overlay on Media */}
            {caption && (
              <div
                onClick={() => {
                  if (!isPublishing) setIsAddingText(true);
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[85%] px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-center font-bold text-base leading-snug shadow-2xl z-20 cursor-pointer"
              >
                {caption}
              </div>
            )}

            {/* Location Tag Badge on Media */}
            {selectedLocation && (
              <div
                onClick={() => {
                  if (!isPublishing) setIsLocationSelectorOpen(true);
                }}
                className="absolute top-24 left-4 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/25 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg z-20 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-white" />
                <span className="truncate max-w-[200px]">{selectedLocation}</span>
              </div>
            )}

            {/* Interactive Text Input overlay if editing text */}
            {isAddingText && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6">
                <input
                  ref={textInputRef}
                  autoFocus
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Digite sua legenda..."
                  maxLength={120}
                  className="w-full max-w-xs text-center text-xl font-extrabold text-white bg-transparent placeholder-zinc-500 focus:outline-none border-b border-white/30 pb-2 mb-6"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsAddingText(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsAddingText(false)}
                  className="px-6 py-2.5 rounded-full bg-white text-black font-extrabold text-xs cursor-pointer shadow-lg active:scale-95"
                >
                  Concluir
                </button>
              </div>
            )}

            {/* Top Toolbar */}
            <header
              className="absolute top-0 inset-x-0 px-4 pt-3 flex items-center justify-between z-20"
              style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 10px), 18px)' }}
            >
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => setStep('gallery_picker')}
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                {/* Text Tool */}
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => setIsAddingText(true)}
                  className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                    caption ? 'bg-white text-black border-white' : 'bg-black/50 border-white/15 text-white'
                  }`}
                  title="Adicionar Texto"
                >
                  <Type className="w-4.5 h-4.5 stroke-[2.2]" />
                </button>

                {/* Location Tool */}
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => setIsLocationSelectorOpen(!isLocationSelectorOpen)}
                  className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                    selectedLocation ? 'bg-[#FFFFFF] text-white border-[#FFFFFF]' : 'bg-black/50 border-white/15 text-white'
                  }`}
                  title="Marcar Localização"
                >
                  <MapPin className="w-4.5 h-4.5 stroke-[2.2]" />
                </button>
              </div>
            </header>

            {/* Location Selector Dropdown */}
            {isLocationSelectorOpen && (
              <div className="absolute top-24 inset-x-4 bg-[#141518]/95 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-2xl z-40 max-h-64 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-white">Marcar Ponto em Campos</span>
                  <button
                    type="button"
                    onClick={() => setIsLocationSelectorOpen(false)}
                    className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-zinc-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={locationSearchQuery}
                  onChange={(e) => setLocationSearchQuery(e.target.value)}
                  placeholder="Buscar ponto turístico..."
                  className="w-full bg-[#1e2026] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none mb-2"
                />

                <div className="overflow-y-auto no-scrollbar space-y-1 max-h-40">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocation('Campos do Jordão, SP');
                      setIsLocationSelectorOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-white/10 text-white cursor-pointer"
                  >
                    <span>Campos do Jordão (Geral)</span>
                    {selectedLocation === 'Campos do Jordão, SP' && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>

                  {filteredSpots.map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(spot.name);
                        setIsLocationSelectorOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-white/10 text-white cursor-pointer"
                    >
                      <span className="truncate">{spot.name}</span>
                      {selectedLocation === spot.name && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <footer
            className="p-4 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center gap-3 z-20 shrink-0"
            style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 12px), 20px)' }}
          >
            <button
              type="button"
              disabled={isPublishing}
              onClick={() => setStep('gallery_picker')}
              className="py-3 px-5 rounded-full bg-white/10 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              Voltar
            </button>

            <button
              type="button"
              disabled={isPublishing}
              onClick={handlePublishStory}
              className="flex-1 py-3 px-5 rounded-full bg-white hover:bg-zinc-100 text-black text-xs font-black active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Publicar Story</span>
            </button>
          </footer>
        </div>
      )}
      </motion.div>
    </AnimatePresence>
  );
};
