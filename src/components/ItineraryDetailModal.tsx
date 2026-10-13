import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  Bookmark,
  BookmarkCheck,
  Share2,
  CheckCircle2,
  Circle,
  ExternalLink,
  ChevronRight,
  Info,
  Navigation,
  Heart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary, Spot } from '../types';
import { Checkmark3DBadge } from './Checkmark3DBadge';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';

interface ItineraryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: Itinerary | null;
  onSelectSpot?: (spot: Spot) => void;
  onSaveItinerary?: (itinerary: Itinerary) => void;
  isSaved?: boolean;
}

export const ItineraryDetailModal: React.FC<ItineraryDetailModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  onSelectSpot,
  onSaveItinerary,
  isSaved = false
}) => {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Record<string, boolean>>({});
  const [copyFeedback, setCopyFeedback] = useState(false);

  if (!isOpen || !itinerary) return null;

  const days = itinerary.days || [];
  const currentDay = days[activeDayIndex] || days[0];
  const totalPlaces = days.reduce((acc, d) => acc + (d.steps?.length || 0), 0);

  const toggleStepVisited = (stepKey: string) => {
    setVisitedSteps(prev => ({
      ...prev,
      [stepKey]: !prev[stepKey]
    }));
  };

  const handleShare = async () => {
    const text = `Confira o roteiro "${itinerary.title}" em Campos do Jordão no MONVIAN!`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: itinerary.title,
          text,
          url: window.location.href
        });
      } catch (e) {}
    } else {
      navigator.clipboard?.writeText(`${text}\n${window.location.href}`);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && itinerary && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center select-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
          />
          <motion.div
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
            className="relative z-10 bg-white dark:bg-[#000000] border-t sm:border border-zinc-200 dark:border-zinc-800 rounded-t-[26px] sm:rounded-[26px] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden origin-bottom sm:origin-center transform-gpu ios-page-top-rounded"
            style={{
              paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
              willChange: 'transform, opacity',
              borderTopLeftRadius: '26px',
              borderTopRightRadius: '26px',
              overflow: 'hidden',
              WebkitMaskImage: '-webkit-radial-gradient(white, black)',
            }}
          >
        {/* Header with Cover */}
        <div className="relative aspect-21/9 w-full bg-zinc-900 shrink-0 overflow-hidden rounded-b-[28px]">
          <img
            src={itinerary.coverImage || 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1000&q=80'}
            alt={itinerary.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1000&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {/* Top Bar Actions */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-300" />
              <span>{itinerary.daysCount} {itinerary.daysCount === 1 ? 'Dia' : 'Dias'}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSaveItinerary?.(itinerary)}
                className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center justify-center hover:bg-black/80 active:scale-90 transition-transform cursor-pointer"
                title={isSaved ? 'Remover dos salvos' : 'Salvar roteiro'}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
              </button>

              <button
                onClick={handleShare}
                className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                title="Compartilhar roteiro"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Title & Stats over Cover */}
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h2 className="text-lg sm:text-xl font-black leading-tight drop-shadow-sm mb-1.5">
              {itinerary.title}
            </h2>
            <div className="flex items-center gap-3 text-xs text-zinc-200 font-medium">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-zinc-300" />
                {totalPlaces} {totalPlaces === 1 ? 'parada' : 'paradas'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-zinc-300" />
                {(itinerary.usageCount || 0).toLocaleString()} turistas já usaram
              </span>
            </div>
          </div>
        </div>

        {/* Copy toast feedback */}
        {copyFeedback && (
          <div className="bg-zinc-900 text-white text-xs font-medium text-center py-1.5 animate-in fade-in">
            Link copiado para a área de transferência!
          </div>
        )}

        {/* Day Selector Tabs (if more than 1 day) */}
        {days.length > 1 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#15171c] overflow-x-auto shrink-0">
            {days.map((d, idx) => (
              <button
                key={idx}
                onClick={() => setActiveDayIndex(idx)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeDayIndex === idx
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/80 dark:border-zinc-700'
                }`}
              >
                Dia {d.dayNumber || idx + 1}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Day Title and Summary */}
          {currentDay && (
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
                {currentDay.title || `Dia ${(currentDay.dayNumber || activeDayIndex + 1)}`}
              </h3>
              {currentDay.summary && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                  {currentDay.summary}
                </p>
              )}
            </div>
          )}

          {/* Timeline of Steps */}
          {currentDay?.steps && currentDay.steps.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
              {currentDay.steps.map((step, sIdx) => {
                const spot = step.spot;
                const stepKey = `${itinerary.id}-${activeDayIndex}-${step.id || sIdx}`;
                const isVisited = visitedSteps[stepKey] || false;

                return (
                  <div
                    key={sIdx}
                    className="relative pl-10 group"
                  >
                    {/* Timeline bullet / checkpoint */}
                    <button
                      type="button"
                      onClick={() => toggleStepVisited(stepKey)}
                      className={`absolute left-1.5 top-3.5 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer z-10 ${
                        isVisited
                          ? ''
                          : 'bg-white dark:bg-[#121418] border-2 border-zinc-300 dark:border-zinc-700 text-zinc-400 group-hover:border-zinc-500'
                      }`}
                      title={isVisited ? 'Marcar como não visitado' : 'Marcar como visitado'}
                    >
                      {isVisited ? (
                        <Checkmark3DBadge size={24} glow />
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-400">
                          {step.stepOrder || sIdx + 1}
                        </span>
                      )}
                    </button>

                    {/* Step Card */}
                    <div
                      className={`p-4 rounded-2xl border transition-all ${
                        isVisited
                          ? 'bg-zinc-50/80 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/60 opacity-75'
                          : 'bg-white dark:bg-[#181a20] border-zinc-200 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {/* Time and Duration badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span>{step.suggestedTime || '09:00'}</span>
                          </span>

                          {step.durationMinutes && (
                            <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                              Permanência: ~{step.durationMinutes} min
                            </span>
                          )}
                        </div>

                        {spot && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            {spot.categoryLabel || spot.category}
                          </span>
                        )}
                      </div>

                      {/* Spot Details */}
                      <div className="flex items-start gap-3">
                        {spot && (
                          <img
                            src={getSpotImage(spot)}
                            alt={spot.name}
                            className="w-16 h-16 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                            }}
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                            {spot?.name || 'Ponto Turístico'}
                          </h4>
                          {spot?.address && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium line-clamp-1 mt-0.5">
                              {spot.address}
                            </p>
                          )}
                          {step.notes && (
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium mt-1.5 italic bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                              "{step.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action to view spot on map */}
                      {spot && onSelectSpot && (
                        <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSpot(spot);
                              onClose();
                            }}
                            className="text-xs font-bold text-zinc-900 dark:text-white hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Ver detalhes & localização</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleStepVisited(stepKey)}
                            className="text-[11px] font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
                          >
                            {isVisited ? 'Desmarcar visita' : 'Marcar como visitado'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500 text-xs">
              Nenhuma parada cadastrada para este dia.
            </div>
          )}

          {/* Important general notes */}
          {itinerary.notes && (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
                <Info className="w-3.5 h-3.5 text-zinc-500" />
                <span>Dicas para este Roteiro</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                {itinerary.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer CTAs */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121418] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Fechar
          </button>

          {onSaveItinerary && (
            <button
              type="button"
              onClick={() => onSaveItinerary(itinerary)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                isSaved
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700'
                  : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90'
              }`}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4 text-white" /> : <Bookmark className="w-4 h-4" />}
              <span>{isSaved ? 'Roteiro Salvo' : 'Salvar nos Meus Roteiros'}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
};
