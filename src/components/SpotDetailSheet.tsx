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

  return (
    <motion.div
      id="spot-detail-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-start md:p-6 md:pl-[310px] lg:md:pl-[340px] select-none cursor-pointer"
    >
      {/* Native Apple Fluid Spring Sheet with smooth scale and slide physics */}
      <motion.div
        id="spot-detail-sheet-container"
        initial={{ opacity: 0, scale: 0.88, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.90, y: 24 }}
        transition={{
          type: 'spring',
          damping: 28,
          stiffness: 320,
          mass: 0.8,
        }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-[94vh] sm:h-[92vh] md:h-[88vh] max-w-2xl md:max-w-md lg:max-w-lg mx-auto md:mx-0 bg-white dark:bg-[#0e1014] text-zinc-900 dark:text-white rounded-t-[26px] md:rounded-[26px] overflow-hidden flex flex-col shadow-2xl origin-bottom md:origin-center cursor-auto transform-gpu border border-transparent dark:md:border-white/10 ios-page-top-rounded"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          willChange: 'transform, opacity',
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
          overflow: 'hidden',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        }}
      >
        {/* Floating Top Bar Controls */}
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
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: spot.name,
                    text: `Confira ${spot.name} em Campos do Jordão!`,
                    url: window.location.href,
                  }).catch(() => {});
                } else {
                  setIsQrModalOpen(true);
                }
              }}
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

        {/* Fluid Hardware-Accelerated Smooth Scroll Surface */}
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
          <div className="relative h-[280px] sm:h-[320px] w-full shrink-0 select-none overflow-hidden bg-zinc-900">
            <motion.img 
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
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
          <div className="relative -mt-6 bg-white dark:bg-[#000000] rounded-t-[32px] px-5 sm:px-6 pt-5 pb-8 shadow-[0_-10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.6)] border-t border-zinc-200/40 dark:border-white/10 min-h-[calc(100dvh-250px)] flex flex-col">
            
            {/* Title and Badge */}
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-[#F5F2EA] leading-tight">
                {spot.name}
              </h1>
              <VerifiedBadge />
            </div>

            {/* Metadata Row */}
            <div className="flex items-center gap-2.5 text-xs sm:text-sm mb-5 text-zinc-600 dark:text-[#9A9894] flex-wrap">
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full">
                <Star className={`w-4 h-4 ${isGoldUser ? 'fill-[#F5BE38] text-[#F5BE38]' : 'fill-zinc-900 text-zinc-900 dark:fill-white dark:text-white'}`} />
                <span className="font-bold text-zinc-900 dark:text-[#F5F2EA]">{spot.rating}</span>
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
            </div>

            {/* Action Buttons Row - Apple Maps iOS Aesthetic */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <motion.button 
                whileTap={{ scale: 0.96 }}
                onClick={() => openDirectionsMap(spot)}
                className={`rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm font-bold active:opacity-90 ${
                  isGoldUser
                    ? 'bg-metallic-gold text-[#1A1202] border border-[#FFF4A3]/60 shadow-[0_4px_16px_rgba(230,172,51,0.4)]'
                    : 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100'
                }`}
                title="Traçar Rota no GPS"
              >
                <RoundedNavigationIcon isGold={false} className={`w-4 h-4 shrink-0 ${isGoldUser ? 'text-[#1A1202]' : ''}`} size={16} />
                <span className="text-sm font-bold">Rota</span>
              </motion.button>

              <motion.a 
                whileTap={{ scale: 0.96 }}
                href={spot.phone ? `tel:${spot.phone}` : "tel:+551236631234"}
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-colors cursor-pointer font-bold active:opacity-90"
                title="Ligar para o estabelecimento"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span className="text-sm font-bold">Ligar</span>
              </motion.a>

              <motion.a 
                whileTap={{ scale: 0.96 }}
                href={spot.website || "https://www.camposdojordao.sp.gov.br/turismo"}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl py-3 px-3 flex items-center justify-center gap-2 transition-colors cursor-pointer font-bold active:opacity-90"
                title="Acessar Website"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="text-sm font-bold">Site</span>
              </motion.a>
            </div>

            {/* Tabs Row */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 mb-6">
              {['Sobre', 'Experiência', 'Vídeos', 'Avaliações'].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-black transition-colors cursor-pointer ${
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
            </div>

            {/* Tab Panels with Smooth Transitions */}
            <div className="flex-1 space-y-6 pb-6">
              {activeTab === 'Sobre' && (
                <div className="space-y-5">
                  {/* Compact Minimal Highlight Card */}
                  <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-zinc-100/80 dark:bg-[#1c1e24] rounded-2xl border border-zinc-200/60 dark:border-white/[0.08] shadow-sm">
                    <img 
                      src={getSpotImage(spot)} 
                      alt={spot.name} 
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-200/40 dark:border-white/10" 
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-[13px] font-bold tracking-tight text-zinc-900 dark:text-[#F5F2EA] leading-snug flex items-center gap-1.5">
                        <span className={isGoldUser ? "text-[#F5BE38]" : "text-[#FFFFFF]"}>★</span> Destaque da cidade
                      </h3>
                      <p className="text-[11px] sm:text-xs text-[#9A9894] font-semibold mt-0.5 leading-relaxed line-clamp-2">
                        {spot.description}
                      </p>
                    </div>
                  </div>

                  {/* Informações Práticas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10">
                      <span className="text-xs text-[#9A9894] font-bold block mb-1">Horário de Funcionamento</span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-[#F5F2EA]">{spot.hours || "09:00 - 18:00"}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10">
                      <span className="text-xs text-[#9A9894] font-bold block mb-1">Entrada</span>
                      <span className={`text-sm font-bold ${isGoldUser ? 'text-[#F5BE38]' : 'text-[#FFFFFF]'}`}>{spot.priceRange === 'Grátis' ? 'Acesso Livre' : (spot.priceRange || 'Consultar')}</span>
                    </div>
                  </div>

                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openDirectionsMap(spot)}
                    className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-between px-6 shadow-sm transition-all cursor-pointer ${
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
                </div>
              )}

              {activeTab === 'Experiência' && (
                <div className="space-y-4">
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

                  <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10">
                    <h4 className="font-black text-zinc-900 dark:text-white text-xs uppercase tracking-wider mb-2">Dica de quem foi</h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'Vídeos' && (
                <div className="space-y-4">
                  <div className="group relative rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-white/10 aspect-video bg-zinc-900 cursor-pointer">
                    <img 
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
                </div>
              )}

              {activeTab === 'Avaliações' && (
                <div className="space-y-4">
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
                  <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10 space-y-2">
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
                  </div>

                  {/* Review card 2 */}
                  <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10 space-y-2">
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Compartilhamento por QR Code */}
        <SpotQrModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          spot={spot}
        />
      </motion.div>
    </motion.div>
  );
};
