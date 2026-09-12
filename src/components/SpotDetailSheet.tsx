import React, { useState } from 'react';
import { Spot } from '../types';
import { 
  X, 
  MapPin, 
  Clock, 
  Star, 
  Navigation, 
  Heart, 
  Share2, 
  Sparkles, 
  Users, 
  Compass,
  CheckCircle2
} from 'lucide-react';

interface SpotDetailSheetProps {
  spot: Spot | null;
  onClose: () => void;
  onNavigateTo: (spot: Spot) => void;
  isFavorite: boolean;
  onToggleFavorite: (spotId: string) => void;
}

export const SpotDetailSheet: React.FC<SpotDetailSheetProps> = ({
  spot,
  onClose,
  onNavigateTo,
  isFavorite,
  onToggleFavorite,
}) => {
  const [copied, setCopied] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  if (!spot) return null;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: spot.name,
        text: `Conheça ${spot.name} em Campos do Jordão! ${spot.description}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${spot.name} - Campos do Jordão: ${spot.description}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenGoogleMaps = () => {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      id="spot-detail-overlay"
      className="fixed inset-0 z-45 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="spot-detail-card"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#18191d] text-white rounded-t-3xl sm:rounded-3xl border border-white/15 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        {/* Top Header / Image Gallery */}
        <div className="relative h-60 w-full overflow-hidden bg-zinc-900 shrink-0">
          <img
            src={spot.image}
            alt={spot.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#18191d] via-transparent to-black/60" />

          {/* Close button */}
          <button
            id="btn-close-spot-detail"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white/90 hover:bg-black/90 flex items-center justify-center transition-colors border border-white/15"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Category & Badge */}
          <div className="absolute top-4 left-4 flex gap-2 items-center">
            <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-xs font-semibold text-emerald-400 border border-emerald-500/30">
              {spot.categoryLabel}
            </span>
            {spot.badge && (
              <span className="px-2.5 py-1 rounded-full bg-[#00ff88]/90 text-black text-[11px] font-bold tracking-tight shadow">
                {spot.badge}
              </span>
            )}
          </div>

          {/* Title & Rating on bottom of image */}
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
              {spot.name}
            </h2>
            <div className="flex items-center gap-3 text-xs text-white/80 mt-1">
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-4 h-4 fill-amber-400" />
                {spot.rating}
              </span>
              <span>•</span>
              <span>{spot.reviewCount.toLocaleString('pt-BR')} avaliações</span>
              {spot.priceRange && (
                <>
                  <span>•</span>
                  <span className="text-emerald-300 font-semibold">{spot.priceRange}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm leading-relaxed text-zinc-300">
          {/* Social Visitors Live pill */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>
                <strong className="text-white font-semibold">{spot.visitorsToday + (checkedIn ? 1 : 0)} turistas</strong> visitaram hoje
              </span>
            </div>
            <button
              id="btn-spot-checkin"
              onClick={() => setCheckedIn(!checkedIn)}
              className={`px-3 py-1 rounded-full font-medium transition-all text-xs flex items-center gap-1.5 ${
                checkedIn
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {checkedIn ? 'Check-in Feito!' : 'Fazer Check-in'}
            </button>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs uppercase tracking-wider font-bold text-white/50 mb-1">
              Sobre o Local
            </h3>
            <p className="text-zinc-200">{spot.description}</p>
          </div>

          {/* Tourist Tip */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/25 text-emerald-200">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-400 mb-1">
              <Sparkles className="w-4 h-4" />
              Dica de Ouro do Turista
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/90">{spot.touristTip}</p>
          </div>

          {/* Hours & Address */}
          <div className="space-y-2 text-xs pt-1 border-t border-white/10">
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-white font-medium">Horário de Funcionamento:</span>
                <p className="text-zinc-400">{spot.hours}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-white font-medium">Localização:</span>
                <p className="text-zinc-400">{spot.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-[#141518] border-t border-white/10 flex items-center gap-2.5 shrink-0">
          <button
            id="btn-spot-favorite"
            onClick={() => onToggleFavorite(spot.id)}
            className={`p-3 rounded-2xl border transition-all flex items-center justify-center ${
              isFavorite
                ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }`}
            title="Salvar nos Favoritos"
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-400' : ''}`} />
          </button>

          <button
            id="btn-spot-share"
            onClick={handleShare}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all flex items-center justify-center"
            title="Compartilhar"
          >
            <Share2 className="w-5 h-5" />
          </button>

          <button
            id="btn-spot-route-map"
            onClick={() => {
              onNavigateTo(spot);
              onClose();
            }}
            className="flex-1 py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 font-semibold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            Ver no Mapa
          </button>

          <button
            id="btn-spot-directions"
            onClick={handleOpenGoogleMaps}
            className="flex-1 py-3 px-3 rounded-2xl bg-[#00ff88] hover:bg-[#15e07e] text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(0,255,136,0.3)] active:scale-98"
          >
            <Navigation className="w-4 h-4 fill-black" />
            Como Chegar
          </button>
        </div>

        {copied && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-black px-4 py-1.5 rounded-full text-xs font-bold shadow-xl animate-in fade-in">
            Link copiado para a área de transferência!
          </div>
        )}
      </div>
    </div>
  );
};
