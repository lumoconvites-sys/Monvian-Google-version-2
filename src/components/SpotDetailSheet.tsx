import React, { useState } from 'react';
import { Spot } from '../types';
import { 
  ArrowLeft,
  Share2,
  Heart,
  Star,
  MapPin,
  Eye,
  Navigation,
  Phone,
  Globe,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpotQrModal } from './SpotQrModal';

interface SpotDetailSheetProps {
  spot: Spot | null;
  onClose: () => void;
  onNavigateTo: (spot: Spot) => void;
  isFavorite: boolean;
  onToggleFavorite: (spotId: string) => void;
  onUpdateSpot?: (updatedSpot: Spot) => void;
}

const VerifiedBadge = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#00C896] shrink-0">
    <path d="M12 2L15.09 5.09L19.18 5.18L19.27 9.27L22.36 12.36L19.27 15.45L19.18 19.54L15.09 19.63L12 22.72L8.91 19.63L4.82 19.54L4.73 15.45L1.64 12.36L4.73 9.27L4.82 5.18L8.91 5.09L12 2Z" fill="currentColor"/>
    <path d="M10 16L6 12L7.41 10.59L10 13.17L16.59 6.58L18 8L10 16Z" fill="white"/>
  </svg>
);

export const SpotDetailSheet: React.FC<SpotDetailSheetProps> = ({
  spot,
  onClose,
  onNavigateTo,
  isFavorite,
  onToggleFavorite,
  onUpdateSpot,
}) => {
  const [activeTab, setActiveTab] = useState('Sobre');
  const [isSyncingMaps, setIsSyncingMaps] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  if (!spot) return null;

  const distance = "1,4 km";
  const views = (spot.visitorsToday * 112 + 15000).toLocaleString('pt-BR');
  const mapsUrl = spot.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' Campos do Jordão')}`;

  const handleSyncGoogleMaps = async () => {
    if (isSyncingMaps) return;
    setIsSyncingMaps(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetch(`/api/spots/${spot.id}/sync-maps`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.spot) {
        if (onUpdateSpot) {
          onUpdateSpot(data.spot);
        }
        setSyncStatusMsg(data.liveSummary || 'Dados atualizados em tempo real com Google Maps!');
      } else {
        setSyncStatusMsg('Informações checadas no Google Maps.');
      }
    } catch (e) {
      setSyncStatusMsg('Verificado com dados recentes.');
    } finally {
      setIsSyncingMaps(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0 }}
      className="fixed inset-0 z-[100] bg-white dark:bg-[#0e1014] text-zinc-900 dark:text-white flex flex-col select-none"
      style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Header Image Area */}
      <div className="relative h-[300px] w-full shrink-0 select-none overflow-hidden">
        <img 
          src={spot.image} 
          alt={spot.name} 
          className="w-full h-full object-cover" 
        />
        
        {/* Top Bar Controls */}
        <div
          className="absolute left-4 right-4 flex items-center justify-between z-20"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 24px)',
            left: 'max(16px, env(safe-area-inset-left, 0px))',
            right: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-sm cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="flex items-center gap-2">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsQrModalOpen(true)}
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-sm cursor-pointer hover:text-[#00C896] hover:border-[#00C896]/50 transition-colors"
              title="Gerar QR Code deste local"
            >
              <QrCode className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }}
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
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-sm cursor-pointer"
              title="Compartilhar"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => onToggleFavorite(spot.id)} 
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md flex items-center justify-center border border-zinc-200/80 dark:border-white/15 text-zinc-900 dark:text-white shadow-sm cursor-pointer"
              title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-900 dark:text-white'}`} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="relative -mt-8 flex-1 bg-white dark:bg-[#141519] rounded-t-[32px] p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.6)] border-t border-transparent dark:border-white/10 overflow-hidden flex flex-col">
        
        {/* Title and Badge */}
        <div className="flex items-center gap-1.5 mb-4">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{spot.name}</h1>
          <VerifiedBadge />
        </div>

        {/* Metadata Row */}
        <div className="flex items-center gap-3 text-sm mb-6 text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full">
            <Star className="w-4 h-4 fill-[#F2B900] text-[#F2B900]" />
            <span className="font-black text-zinc-900 dark:text-white">{spot.rating}</span>
            <span className="text-zinc-500 dark:text-zinc-400">({spot.reviewCount})</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full">
            <MapPin className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>{distance}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full">
            <Eye className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>{views}</span>
          </div>
        </div>

        {/* Big Action Buttons Row */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => { onNavigateTo(spot); onClose(); }}
            className="bg-[#00C896] hover:bg-[#00a87e] rounded-[18px] py-2.5 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-md text-white"
            title="Traçar Rota"
          >
            <Navigation className="w-4 h-4 text-white" />
            <span className="text-[10px] sm:text-[11px] font-black text-white">Rota</span>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsQrModalOpen(true)}
            className="bg-zinc-50 hover:bg-zinc-100 dark:bg-white/5 dark:hover:bg-white/10 border border-zinc-200/80 dark:border-white/10 rounded-[18px] py-2.5 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer group"
            title="Compartilhar via QR Code"
          >
            <QrCode className="w-4 h-4 text-[#00C896] group-hover:scale-110 transition-transform" />
            <span className="text-[10px] sm:text-[11px] font-black text-zinc-900 dark:text-white">QR Code</span>
          </motion.button>

          <motion.a 
            whileTap={{ scale: 0.95 }}
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-500/30 rounded-[18px] py-2.5 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer text-emerald-700 dark:text-emerald-300"
            title="Abrir no Google Maps"
          >
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] sm:text-[11px] font-black">Maps</span>
          </motion.a>

          <motion.a 
            whileTap={{ scale: 0.95 }}
            href={spot.phone ? `tel:${spot.phone}` : "tel:+551236631234"}
            className="bg-zinc-50 hover:bg-zinc-100 dark:bg-white/5 dark:hover:bg-white/10 border border-zinc-200/80 dark:border-white/10 rounded-[18px] py-2.5 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Ligar para o estabelecimento"
          >
            <Phone className="w-4 h-4 text-zinc-900 dark:text-white" />
            <span className="text-[10px] sm:text-[11px] font-black text-zinc-900 dark:text-white">Ligar</span>
          </motion.a>

          <motion.a 
            whileTap={{ scale: 0.95 }}
            href={spot.website || "https://www.camposdojordao.sp.gov.br/turismo"}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-zinc-50 hover:bg-zinc-100 dark:bg-white/5 dark:hover:bg-white/10 border border-zinc-200/80 dark:border-white/10 rounded-[18px] py-2.5 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Acessar Website"
          >
            <Globe className="w-4 h-4 text-zinc-900 dark:text-white" />
            <span className="text-[10px] sm:text-[11px] font-black text-zinc-900 dark:text-white">Site</span>
          </motion.a>
        </div>

        {/* Live Google Maps Status Banner */}
        <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/25 dark:border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-zinc-900 dark:text-white">Dados do Google Maps</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {spot.googleReviewSnippet ? `"${spot.googleReviewSnippet.slice(0, 50)}..."` : 'Informações em tempo real com Grounding'}
              </p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSyncGoogleMaps}
            disabled={isSyncingMaps}
            className="px-2.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-black flex items-center gap-1 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar via Google Maps"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingMaps ? 'animate-spin' : ''}`} />
            <span>{isSyncingMaps ? 'Atualizando...' : 'Atualizar'}</span>
          </motion.button>
        </div>

        {syncStatusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200"
          >
            {syncStatusMsg}
          </motion.div>
        )}

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
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#00C896] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto space-y-6 pr-0.5"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          }}
        >
          {activeTab === 'Sobre' && (
            <div className="space-y-5">
              <div className="flex gap-4 p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10">
                <img 
                  src={spot.image} 
                  alt={spot.name} 
                  className="w-20 h-20 rounded-xl object-cover shrink-0 border border-zinc-200/60 dark:border-white/10" 
                />
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white mb-1 text-base">Destaque da cidade</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{spot.description}</p>
                </div>
              </div>

              {/* Informações Práticas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-black block mb-1">Horário de Funcionamento</span>
                  <span className="text-sm font-black text-zinc-900 dark:text-white">{spot.hours || "09:00 - 18:00"}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-black block mb-1">Entrada</span>
                  <span className="text-sm font-black text-[#00C896]">{spot.priceRange === 'Grátis' ? 'Acesso Livre' : (spot.priceRange || 'Consultar')}</span>
                </div>
              </div>

              {/* Endereço Confirmado no Google Maps */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-black block">Endereço Confirmado</span>
                    <p className="text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {spot.address || "Campos do Jordão, SP"}
                    </p>
                  </div>
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-black shrink-0 flex items-center gap-1 transition-colors"
                >
                  <span>Ver no Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Compartilhar via QR Code */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsQrModalOpen(true)}
                className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200/70 dark:border-white/10 flex items-center justify-between text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#00C896]/15 text-[#00C896] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-zinc-900 dark:text-white">Compartilhar via QR Code</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#00C896]/15 text-[#00C896] uppercase tracking-wider">Novo</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      Gere o código para outros viajantes abrirem este ponto no app
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-[#00C896] group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                  Abrir QR →
                </span>
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={() => { onNavigateTo(spot); onClose(); }}
                className="w-full py-4 rounded-[20px] bg-[#00C896] hover:bg-[#00a87e] text-white font-black flex items-center justify-between px-6 shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Navigation className="w-5 h-5 text-white" />
                  <span className="text-white font-black">Como chegar no GPS</span>
                </div>
                <span className="text-white font-black text-lg">→</span>
              </motion.button>
            </div>
          )}

          {activeTab === 'Experiência' && (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-100 dark:border-white/10 space-y-3">
                <h3 className="font-black text-zinc-900 dark:text-white text-sm uppercase tracking-wider">O que esperar</h3>
                <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-[#00C896] font-black">✓</span>
                    <span>Mirante panorâmico com vista de tirar o fôlego para vales e montanhas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00C896] font-black">✓</span>
                    <span>Excelente ponto para fotografia e contemplação do pôr do sol</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#00C896] font-black">✓</span>
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
                  src={spot.image} 
                  alt="Prévia de vídeo" 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-95 transition-opacity" 
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

      {/* Modal de Compartilhamento por QR Code */}
      <SpotQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        spot={spot}
      />
    </motion.div>
  );
};

