import React, { useState, useRef } from 'react';
import { Spot } from '../types';
import { 
  ArrowLeft,
  Share2,
  Heart,
  Star,
  MapPin,
  Eye,
  Phone,
  Globe,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { motion } from 'motion/react';
import { SpotQrModal } from './SpotQrModal';
import { RoundedNavigationIcon } from './RoundedNavigationIcon';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { VerifiedBadge } from './ui/VerifiedBadge';

interface SpotDetailSheetProps {
  spot: Spot | null;
  onClose: () => void;
  onNavigateTo: (spot: Spot) => void;
  isFavorite: boolean;
  onToggleFavorite: (spotId: string) => void;
  onUpdateSpot?: (updatedSpot: Spot) => void;
}

export const SpotDetailSheet: React.FC<SpotDetailSheetProps> = ({
  spot,
  onClose,
  onNavigateTo,
  isFavorite,
  onToggleFavorite,
}) => {
  const [activeTab, setActiveTab] = useState('Sobre');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isGoldUser = Boolean(
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
        const cleanEmail = (u.email || u.whatsapp || '').trim().toLowerCase();
        const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail);
        return isGoldAdmin || Boolean(u.isGold || u.is_gold === 1 || u.isPremium || u.is_premium === 1);
      } catch {
        return false;
      }
    })()
  );

  if (!spot) return null;

  const openDirectionsMap = (s: Spot) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const destination = s.lat && s.lng 
      ? `${s.lat},${s.lng}` 
      : encodeURIComponent(s.address ? `${s.name}, ${s.address}` : `${s.name} Campos do Jordão`);

    if (isIOS) {
      window.open(`https://maps.apple.com/?daddr=${destination}&dirflg=d`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
    }
  };

  const distance = "1,4 km";
  const views = (spot.visitorsToday * 112 + 15000).toLocaleString('pt-BR');

  const hasDirections = Boolean((spot.lat && spot.lng) || spot.address || spot.name);
  const phoneHref = spot.phone ? `tel:${spot.phone}` : 'tel:+551236631234';
  const websiteHref = spot.website || spot.mapsUrl || 'https://www.camposdojordao.sp.gov.br/turismo';

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: spot.name,
          text: `Confira ${spot.name} em Campos do Jordão!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      setIsQrModalOpen(true);
    }
  };

  return (
    <motion.div
      id="spot-detail-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-black/60 md:bg-black/45 backdrop-blur-md md:backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center md:pl-[calc(var(--desktop-sidebar-width,72px)+24px)] md:pr-6 md:py-6 select-none cursor-pointer"
    >
      {/* =====================================================================
          1. MOBILE VIEW (< 768px): PRESERVED 100% INTACT
         ===================================================================== */}
      <motion.div
        id="spot-detail-sheet-container"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="md:hidden relative w-full h-full bg-white dark:bg-[#0E0F12] text-zinc-900 dark:text-white flex flex-col z-[110] transform-gpu overflow-hidden rounded-none"
        style={{
          willChange: 'transform, opacity',
        }}
      >
        {/* Floating Top Bar Controls (Mobile) */}
        <div
          className="absolute left-0 right-0 z-30 flex items-center justify-between pointer-events-none px-4"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
            left: 'max(16px, env(safe-area-inset-left, 0px))',
            right: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          <motion.button 
            whileTap={{ scale: 0.92 }}
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/65 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-black dark:text-white shadow-md cursor-pointer pointer-events-auto active:opacity-80 transition-opacity"
            title="Voltar"
            aria-label="Voltar para o mapa"
          >
            <ArrowLeft
              className="w-5 h-5 text-black dark:text-white"
            />
          </motion.button>

          <div className="flex items-center gap-2 pointer-events-auto">
            <motion.button 
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsQrModalOpen(true)}
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/65 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-md cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/20 transition-colors"
              title="Gerar QR Code deste local"
            >
              <QrCode className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.92 }}
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/65 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-md cursor-pointer active:opacity-80 transition-opacity"
              title="Compartilhar"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.92 }}
              onClick={() => onToggleFavorite(spot.id)} 
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/65 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-md cursor-pointer active:opacity-80 transition-opacity"
              title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-900 dark:text-white'}`} />
            </motion.button>
          </div>
        </div>

        {/* Fluid Hardware-Accelerated Smooth Scroll Surface (Mobile) */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            overscrollBehaviorY: 'contain',
            transform: 'translateZ(0)',
          }}
        >
          {/* Header Image Area */}
          <div className="relative h-[320px] w-full shrink-0 select-none overflow-hidden bg-zinc-900">
            <motion.img 
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              src={getSpotImage(spot)} 
              alt={spot.name} 
              className="w-full h-full object-cover pointer-events-none transform-gpu" 
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
              }}
            />
            {/* Subtle Gradient Shadow for Top Bar Legibility */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
          </div>

          {/* Main Content Body */}
          <div className="relative -mt-8 bg-white dark:bg-[#000000] rounded-t-[32px] px-5 sm:px-6 pt-6 pb-12 flex flex-col min-h-[calc(100vh-280px)]">
            
            {/* Title and Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.025 }}
              className="flex items-center gap-2 mb-2"
            >
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#000000] leading-tight">
                {spot.name}
              </h1>
              <VerifiedBadge />
            </motion.div>

            {/* Metadata Row */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.055 }}
              className="flex items-center gap-2.5 text-xs sm:text-sm mb-6 text-zinc-600 dark:text-[#9A9894] flex-wrap"
            >
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full">
                <Star className={`w-4 h-4 ${isGoldUser ? 'fill-[#F5BE38] text-[#F5BE38]' : 'fill-zinc-900 text-zinc-900 dark:fill-white dark:text-white'}`} />
                <span className="font-semibold text-zinc-900 dark:text-[#F5F2EA]">{spot.rating}</span>
                <span className="text-[#9A9894] font-semibold">({spot.reviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full">
                <MapPin className={`w-4 h-4 ${isGoldUser ? 'text-[#F5BE38]' : 'text-zinc-900 dark:text-white'}`} />
                <span className="font-semibold text-zinc-700 dark:text-[#9A9894]">{distance}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full">
                <Eye className="w-4 h-4 text-zinc-500 dark:text-[#9A9894]" />
                <span className="font-semibold text-zinc-700 dark:text-[#9A9894]">{views}</span>
              </div>
            </motion.div>

            {/* Action Buttons Row - Apple Maps iOS Aesthetic */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.085 }}
              className="grid grid-cols-3 gap-3 mb-8"
            >
              <motion.button 
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.94, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                onClick={() => openDirectionsMap(spot)}
                className={`rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm font-bold active:opacity-90 bg-[#ffffff] ${
                  isGoldUser
                    ? 'text-[#1A1202] border border-[#FFF4A3]/60 shadow-[0_4px_16px_rgba(230,172,51,0.4)]'
                    : 'text-white hover:bg-zinc-800 dark:bg-[#ffffff] dark:text-black dark:hover:bg-zinc-100'
                }`}
                title="Traçar Rota no GPS"
              >
                <RoundedNavigationIcon isGold={false} className="w-4 h-4 shrink-0 text-[#000000] [&_polygon]:text-[#000000]" size={16} />
                <span className="text-sm font-bold text-[#000000]">Rota</span>
              </motion.button>

              <motion.a 
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.94, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                href={phoneHref}
                className="bg-[#ffffff] hover:bg-zinc-200 dark:bg-[#ffffff] dark:hover:bg-white/15 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-colors cursor-pointer font-bold active:opacity-90"
                title="Ligar para o estabelecimento"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span className="text-sm font-bold">Ligar</span>
              </motion.a>

              <motion.a 
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.94, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#ffffff] hover:bg-zinc-200 dark:bg-[#ffffff] dark:hover:bg-white/15 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-colors cursor-pointer font-bold active:opacity-90"
                title="Acessar Website"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="text-sm font-bold">Site</span>
              </motion.a>
            </motion.div>

            {/* Tabs Row */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.115 }}
              className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 mb-6"
            >
              {['Sobre', 'Experiência', 'Vídeos', 'Avaliações'].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-semibold transition-colors cursor-pointer ${
                      isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div
                        layoutId="activeSpotTab"
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className={`absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full ${
                          isGoldUser ? 'bg-[#F5BE38]' : 'bg-zinc-950 dark:bg-white'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </motion.div>

            {/* Tab Panels with Smooth Transitions */}
            <div className="flex-1 space-y-6 pb-6">
              {activeTab === 'Sobre' && (
                <motion.div
                  key="tab-sobre"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-5"
                >
                  <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {spot.description}
                  </p>

                  {/* Informações Práticas */}
                  <div className="grid grid-cols-2 gap-3">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.035 }}
                      className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10"
                    >
                      <span className="text-xs text-[#9A9894] font-bold block mb-1">Horário de Funcionamento</span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-[#F5F2EA]">{spot.hours || "09:00 - 18:00"}</span>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.07 }}
                      className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10"
                    >
                      <span className="text-xs text-[#9A9894] font-bold block mb-1">Entrada</span>
                      <span className={`text-sm font-bold ${isGoldUser ? 'text-[#F5BE38]' : 'text-[#FFFFFF]'}`}>{spot.priceRange === 'Grátis' ? 'Acesso Livre' : (spot.priceRange || 'Consultar')}</span>
                    </motion.div>
                  </div>

                  <motion.button 
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.1 }}
                    whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                    whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                    onClick={() => openDirectionsMap(spot)}
                    className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-between px-6 shadow-sm transition-colors cursor-pointer ${
                      isGoldUser
                        ? 'bg-metallic-gold text-[#1A1202] border border-[#FFF4A3]/70 shadow-[0_4px_20px_rgba(230,172,51,0.45)]'
                        : 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RoundedNavigationIcon isGold={false} className={`w-5 h-5 ${isGoldUser ? 'text-[#1A1202]' : ''}`} size={20} />
                      <span className="font-bold">Como chegar no GPS</span>
                    </div>
                    <span className={`font-bold text-lg ${isGoldUser ? 'text-[#1A1202]' : ''}`}>→</span>
                  </motion.button>
                </motion.div>
              )}

              {activeTab === 'Experiência' && (
                <motion.div
                  key="tab-experiencia"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10 space-y-3">
                    <h3 className="font-black text-zinc-900 dark:text-white text-sm uppercase tracking-wider">O que esperar</h3>
                    <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                        <span>Mirante panorâmico com vista de tirar o fôlego para vales e montanhas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                        <span>Excelente ponto para fotografia e contemplação do pôr do sol</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                        <span>Estacionamento e cafés típicos nas imediações</span>
                      </li>
                    </ul>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.045 }}
                    className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10"
                  >
                    <h4 className="font-black text-zinc-900 dark:text-white text-xs uppercase tracking-wider mb-2">Dica de quem foi</h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {spot.touristTip || 'Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!'}
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'Vídeos' && (
                <motion.div
                  key="tab-videos"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-4"
                >
                  <div className="group relative rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-white/10 aspect-video bg-zinc-900 cursor-pointer">
                    <motion.img 
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.03 }}
                      src={spot.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80'} 
                      alt="Prévia de vídeo" 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-95 transition-opacity" 
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-white text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <span className="ml-1 text-sm font-black">▶</span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-3 right-3 text-white text-xs font-black drop-shadow-md">
                      Tour Guiado e Dicas em 4K • 3:42
                    </div>
                  </div>
                  <p className="text-xs text-center text-zinc-400">Vídeos enviados pela comunidade e guias locais</p>
                </motion.div>
              )}

              {activeTab === 'Avaliações' && (
                <motion.div
                  key="tab-avaliacoes"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10">
                    <div>
                      <span className="text-3xl font-black text-zinc-900 dark:text-white">{spot.rating}</span>
                      <span className="text-xs text-zinc-400 block mt-0.5">de 5.0 estrelas</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex text-[#F2B900]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{spot.reviewCount} avaliações reais</span>
                    </div>
                  </div>

                  {/* Review card 1 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
                    className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-zinc-900 dark:text-white">Mariana Costa</span>
                      <span className="text-[11px] text-zinc-400">Há 2 dias</span>
                    </div>
                    <div className="flex text-[#F2B900]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável. Vale muito a pena a visita.
                    </p>
                  </motion.div>

                  {/* Review card 2 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.08 }}
                    className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-zinc-900 dark:text-white">Lucas Ferreira</span>
                      <span className="text-[11px] text-zinc-400">Há 1 semana</span>
                    </div>
                    <div className="flex text-[#F2B900]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-current" />
                      ))}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes do sol se pôr para pegar um bom lugar.
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* =====================================================================
          2. DESKTOP & TABLET VIEW (>= 768px): TWO-COLUMN HORIZONTAL PANEL
         ===================================================================== */}
      <motion.div
        id="spot-detail-desktop-panel"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hidden md:flex flex-col lg:flex-row w-full max-w-[960px] lg:max-w-[1080px] xl:max-w-[1180px] 2xl:max-w-[1260px] md:max-h-[88vh] lg:h-[min(680px,85vh)] xl:h-[min(730px,85vh)] bg-white text-zinc-950 rounded-[24px] border border-zinc-200/90 shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden cursor-default z-[110]"
        style={{
          fontFamily: "'Inter', sans-serif",
          backgroundColor: '#ffffff',
        }}
      >
        {/* LEFT COLUMN (56-58% on Desktop): Horizontal Image & Floating Controls */}
        <div className="relative w-full lg:w-[56%] xl:w-[58%] h-[260px] md:h-[300px] lg:h-full p-3 lg:p-4 shrink-0 flex flex-col bg-white">
          <div className="relative w-full h-full rounded-[18px] overflow-hidden bg-zinc-100 border border-zinc-200/60">
            <img
              src={getSpotImage(spot)}
              alt={spot.name}
              className="w-full h-full object-cover select-none"
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
              }}
            />

            {/* Subtle top vignette for control legibility */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />

            {/* Top-Left: Back Button */}
            <div className="absolute top-3.5 left-3.5 z-20">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-zinc-900 border border-black/10 shadow-sm flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Voltar"
                aria-label="Voltar para o mapa"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.2] text-zinc-900" />
              </button>
            </div>

            {/* Top-Right: Discreet Floating Controls (QR Code, Share, Favorite) */}
            <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-zinc-900 border border-black/10 shadow-sm flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Gerar QR Code deste local"
                aria-label="QR Code"
              >
                <QrCode className="w-4 h-4 stroke-[2] text-zinc-900" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-zinc-900 border border-black/10 shadow-sm flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Compartilhar"
                aria-label="Compartilhar"
              >
                <Share2 className="w-4 h-4 stroke-[2] text-zinc-900" />
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(spot.id)}
                className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-zinc-900 border border-black/10 shadow-sm flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                aria-label="Favoritar"
              >
                <Heart
                  className={`w-4 h-4 stroke-[2] transition-colors ${
                    isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-900'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (42-44% on Desktop): Structured Info, Actions & Integrated Tabs */}
        <div className="flex-1 lg:w-[44%] xl:w-[42%] h-full min-h-0 flex flex-col bg-white px-5 py-4 lg:px-7 lg:py-6 overflow-hidden">
          {/* 1 & 2. Full Name + Verification Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-xl lg:text-2xl xl:text-[26px] font-bold tracking-tight text-zinc-950 leading-tight">
              {spot.name}
            </h1>
            <div className="shrink-0">
              <VerifiedBadge />
            </div>
          </div>

          {/* 3. Category & Location */}
          <div className="flex items-center gap-1.5 text-xs lg:text-[13px] font-medium text-zinc-500 mt-1.5 shrink-0 flex-wrap">
            <span className="text-zinc-700 font-semibold">
              {spot.categoryLabel || spot.category}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate max-w-[280px] xl:max-w-[340px]">
                {spot.address || 'Campos do Jordão, SP'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{distance}</span>
          </div>

          {/* 4. Average Rating, Review Count & Views */}
          <div className="flex items-center gap-3 text-xs lg:text-[13px] mt-3 pb-3.5 border-b border-zinc-100 shrink-0 flex-wrap">
            {spot.rating !== undefined && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-zinc-950 text-zinc-950 shrink-0" />
                <span className="font-bold text-zinc-950">{spot.rating}</span>
                {spot.reviewCount !== undefined && (
                  <span className="text-zinc-500 font-medium">
                    ({spot.reviewCount.toLocaleString('pt-BR')} avaliações)
                  </span>
                )}
              </div>
            )}
            {spot.rating !== undefined && <span className="text-zinc-300" aria-hidden="true">·</span>}
            <div className="flex items-center gap-1.5 text-zinc-500 font-medium">
              <Eye className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>{views} visualizações</span>
            </div>
          </div>

          {/* 5. Concise Summary Description */}
          {spot.description && (
            <p className="text-[13px] lg:text-[13.5px] text-zinc-600 leading-relaxed mt-3 line-clamp-2 shrink-0">
              {spot.description}
            </p>
          )}

          {/* 6. Action Buttons Side-by-Side (Como chegar, Ligar, Site) */}
          <div className="flex items-center gap-2.5 mt-4 shrink-0">
            {hasDirections && (
              <button
                type="button"
                onClick={() => openDirectionsMap(spot)}
                className="flex-1 h-10 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs lg:text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                title="Traçar rota até este local"
              >
                <RoundedNavigationIcon isGold={false} className="w-4 h-4 shrink-0 text-white [&_polygon]:text-white" size={15} />
                <span className="truncate">Como chegar</span>
              </button>
            )}

            {phoneHref && (
              <a
                href={phoneHref}
                className="h-10 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 border border-zinc-200/80 text-xs lg:text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Ligar para o local"
              >
                <Phone className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                <span>Ligar</span>
              </a>
            )}

            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 border border-zinc-200/80 text-xs lg:text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Acessar site oficial"
              >
                <Globe className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                <span>Site</span>
              </a>
            )}
          </div>

          {/* 7. Horizontal Desktop Tab Navigation (Sobre, Experiência, Vídeos, Avaliações) */}
          <div className="flex items-center gap-6 border-b border-zinc-200 mt-5 shrink-0" role="tablist">
            {['Sobre', 'Experiência', 'Vídeos', 'Avaliações'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-2.5 text-[13px] lg:text-sm font-semibold transition-colors cursor-pointer ${
                    isActive ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-700'
                  }`}
                >
                  {tab}
                  {isActive && (
                    <motion.div
                      layoutId="activeSpotTabDesktop"
                      transition={{ type: 'spring', damping: 28, stiffness: 360 }}
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-zinc-950"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Scrollable Tab Content Area (Independent vertical scroll inside right column) */}
          <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-2 pr-1 space-y-4 custom-scrollbar">
            {activeTab === 'Sobre' && (
              <motion.div
                key="desktop-tab-sobre"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-4"
              >
                <p className="text-sm text-zinc-700 leading-relaxed">
                  {spot.description}
                </p>

                {/* Practical Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                    <span className="text-[11px] text-zinc-500 font-semibold block mb-1">
                      Horário de Funcionamento
                    </span>
                    <span className="text-[13px] font-bold text-zinc-900">
                      {spot.hours || '09:00 - 18:00'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                    <span className="text-[11px] text-zinc-500 font-semibold block mb-1">
                      Entrada
                    </span>
                    <span className="text-[13px] font-bold text-zinc-900">
                      {spot.priceRange === 'Grátis' ? 'Acesso Livre' : (spot.priceRange || 'Consultar')}
                    </span>
                  </div>
                </div>

                {spot.address && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] text-zinc-500 font-semibold block mb-0.5">
                        Endereço
                      </span>
                      <span className="text-xs font-medium text-zinc-800 block truncate">
                        {spot.address}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDirectionsMap(spot)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                    >
                      Abrir no GPS
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'Experiência' && (
              <motion.div
                key="desktop-tab-experiencia"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-3.5"
              >
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70 space-y-2.5">
                  <h3 className="font-bold text-zinc-900 text-xs uppercase tracking-wider">
                    O que esperar
                  </h3>
                  <ul className="space-y-2 text-[13px] text-zinc-600">
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-900 font-bold">✓</span>
                      <span>Mirante panorâmico com vista de tirar o fôlego para vales e montanhas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-900 font-bold">✓</span>
                      <span>Excelente ponto para fotografia e contemplação do pôr do sol</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-900 font-bold">✓</span>
                      <span>Estacionamento e cafés típicos nas imediações</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70">
                  <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider mb-1.5">
                    Dica de quem foi
                  </h4>
                  <p className="text-[13px] text-zinc-600 leading-relaxed">
                    {spot.touristTip || 'Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!'}
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'Vídeos' && (
              <motion.div
                key="desktop-tab-videos"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-3"
              >
                <div className="group relative rounded-xl overflow-hidden border border-zinc-200 aspect-video bg-zinc-900 cursor-pointer">
                  <img
                    src={spot.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80'}
                    alt="Prévia de vídeo"
                    className="w-full h-full object-cover opacity-85 group-hover:opacity-95 transition-opacity"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-white/95 text-zinc-950 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <span className="ml-0.5 text-xs font-bold">▶</span>
                    </div>
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-3 text-white text-xs font-semibold drop-shadow">
                    Tour Guiado e Dicas em 4K · 3:42
                  </div>
                </div>
                <p className="text-xs text-center text-zinc-400">
                  Vídeos enviados pela comunidade e guias locais
                </p>
              </motion.div>
            )}

            {activeTab === 'Avaliações' && (
              <motion.div
                key="desktop-tab-avaliacoes"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/70">
                  <div>
                    <span className="text-2xl font-bold text-zinc-950">{spot.rating}</span>
                    <span className="text-xs text-zinc-500 block mt-0.5">de 5.0 estrelas</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-0.5 text-zinc-900">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500 mt-1">
                      {spot.reviewCount?.toLocaleString('pt-BR')} avaliações reais
                    </span>
                  </div>
                </div>

                {/* Review card 1 */}
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-900">Mariana Costa</span>
                    <span className="text-[11px] text-zinc-400">Há 2 dias</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-zinc-900">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável. Vale muito a pena a visita.
                  </p>
                </div>

                {/* Review card 2 */}
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/70 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-900">Lucas Ferreira</span>
                    <span className="text-[11px] text-zinc-400">Há 1 semana</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-zinc-900">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes do sol se pôr para pegar um bom lugar.
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modal de Compartilhamento por QR Code */}
      <SpotQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        spot={spot}
      />
    </motion.div>
  );
};
