import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Route, Sparkles, Clock, MapPin, ChevronRight, CheckCircle2, Compass, Plus } from 'lucide-react';
import { Spot } from '../types';
import { DEFAULT_ITINERARIES, CuratedItinerary } from '../data/defaultItineraries';
import { ItineraryDetailModal } from './ItineraryDetailModal';

interface ItinerariesViewProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  spots: Spot[];
}

export const ItinerariesView: React.FC<ItinerariesViewProps> = ({
  isOpen,
  onClose,
  theme,
  spots
}) => {
  const [selectedItinerary, setSelectedItinerary] = useState<CuratedItinerary | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 pt-20 pb-28 px-4 sm:px-6 overflow-y-auto bg-black/95 text-white select-none pointer-events-auto"
      style={{
        paddingTop: 'max(84px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(96px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Title */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-zinc-400 uppercase">
            <Route className="w-4 h-4 text-white" />
            <span>Roteiros Inteligentes</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Explore Campos do Jordão
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Roteiros otimizados por tempo, estilo e proximidade para a sua viagem perfeita.
          </p>
        </div>

        {/* Itinerary Cards */}
        <div className="grid grid-cols-1 gap-4">
          {DEFAULT_ITINERARIES.map((itinerary) => (
            <motion.div
              key={itinerary.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedItinerary(itinerary)}
              className="group relative overflow-hidden rounded-3xl bg-zinc-900/80 border border-white/10 p-5 cursor-pointer shadow-lg hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold">
                    <Clock className="w-3 h-3" />
                    <span>{itinerary.duration}</span>
                  </div>
                  <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors">
                    {itinerary.title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2">
                    {itinerary.description}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white group-hover:text-zinc-950 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>

              {/* Spots Counter */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{itinerary.stops?.length || itinerary.spotIds?.length || 4} paradas inclusas</span>
                </div>
                <span className="text-[11px] font-bold text-white group-hover:underline">Ver roteiro completo</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Itinerary Detail Modal */}
      {selectedItinerary && (
        <ItineraryDetailModal
          isOpen={Boolean(selectedItinerary)}
          onClose={() => setSelectedItinerary(null)}
          itinerary={selectedItinerary}
          onSelectSpot={() => setSelectedItinerary(null)}
          isSaved={false}
          onSaveItinerary={() => {}}
        />
      )}
    </div>
  );
};
export default ItinerariesView;
