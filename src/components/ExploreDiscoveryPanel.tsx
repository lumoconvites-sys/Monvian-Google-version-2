import React from 'react';
import { motion, PanInfo } from 'motion/react';
import { Lock, ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { triggerHapticFeedback } from '../utils/haptics';
import { playSpotClickSound, unlockSpotClickSound } from '../utils/soundEffects';
import foldedMapPin3d from '../assets/images/folded_map_pin_3d.png';
import myItinerariesRoute3d from '../assets/images/my_itineraries_route_3d.png';
import tourGuide3d from '../assets/images/tour_guide_3d.png';
import itineraryStoreBag3d from '../assets/images/itinerary_store_bag_3d.png';

interface ExploreDiscoveryPanelProps {
  theme: 'dark' | 'light';
  isMinimized: boolean;
  onToggleMinimized: (minimized: boolean) => void;
  onCreateItinerary: () => void;
  onOpenMyItineraries: () => void;
  onOpenStore: () => void;
}

export const ExploreDiscoveryPanel: React.FC<ExploreDiscoveryPanelProps> = React.memo(({
  theme,
  isMinimized,
  onToggleMinimized,
  onCreateItinerary,
  onOpenMyItineraries,
  onOpenStore,
}) => {
  const { tr } = useLanguage();
  const isDark = theme === 'dark';

  const handleActionClick = (callback: () => void) => {
    unlockSpotClickSound();
    playSpotClickSound();
    triggerHapticFeedback(12);
    callback();
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 42 || info.velocity.y > 320) {
      triggerHapticFeedback(10);
      onToggleMinimized(true);
    }
  };

  if (isMinimized) {
    return (
      <motion.div
        key="explore-discovery-restore-bar"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="md:hidden fixed left-0 right-0 z-[45] flex justify-center pointer-events-none px-4"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        }}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            triggerHapticFeedback(10);
            onToggleMinimized(false);
          }}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-2xl border transition-colors ${
            isDark
              ? 'bg-[#121214]/90 border-white/[0.12] text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
              : 'bg-white/92 border-black/[0.08] text-black shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
          }`}
          aria-label={tr('Vamos fazer hoje?')}
        >
          <span className="text-[13.5px] font-semibold tracking-tight">
            {tr('Vamos fazer hoje?')}
          </span>
          <ChevronUp className={`w-4 h-4 ${isDark ? 'text-white/70' : 'text-black/60'}`} strokeWidth={2.2} />
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.section
      key="explore-discovery-panel"
      id="explore-discovery-panel"
      aria-label={tr('Vamos fazer hoje?')}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`md:hidden relative z-30 w-full shrink-0 max-h-[52dvh] overflow-y-auto overscroll-contain rounded-t-[28px] select-none transition-colors duration-200 ${
        isDark
          ? 'bg-[#09090A] border-t border-white/[0.10] shadow-[0_-8px_28px_rgba(0,0,0,0.5)]'
          : 'bg-[#FFFFFF] border-t border-black/[0.06] shadow-[0_-8px_28px_rgba(0,0,0,0.06)]'
      }`}
      style={{
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
      }}
    >
      {/* Top Drag / Minimize Grabber Handle */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.35 }}
        onDragEnd={handleDragEnd}
        className="w-full flex justify-center pt-2.5 pb-1.5 [@media(max-height:740px)]:pt-2 [@media(max-height:740px)]:pb-1 cursor-grab active:cursor-grabbing touch-none"
      >
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback(8);
            onToggleMinimized(true);
          }}
          aria-label={tr('Expandir mapa')}
          className="px-6 py-1 -my-1 flex items-center justify-center focus:outline-none"
        >
          <span
            className={`block w-9 h-[4px] rounded-full transition-colors ${
              isDark ? 'bg-white/25' : 'bg-black/20'
            }`}
          />
        </button>
      </motion.div>

      {/* Header */}
      <div className="px-1 pt-0.5 pb-3 [@media(max-height:740px)]:pb-2">
        <h2
          className={`text-[23px] sm:text-[25px] [@media(max-height:740px)]:text-[20px] font-bold tracking-[-0.025em] leading-[1.15] ${
            isDark ? 'text-white' : 'text-black'
          }`}
        >
          {tr('Vamos fazer hoje?')}
        </h2>
        <p
          className={`text-[13.5px] sm:text-[14.5px] [@media(max-height:740px)]:text-[12.5px] font-normal leading-[1.3] mt-0.5 ${
            isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
          }`}
        >
          {tr('Como deseja aproveitar sua viagem?')}
        </p>
      </div>

      {/* 2x2 Discovery Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 [@media(max-height:740px)]:gap-2">
        {/* Card 1: Criar roteiro */}
        <motion.button
          id="discovery-card-create-itinerary"
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 460, damping: 28 }}
          onClick={() => handleActionClick(onCreateItinerary)}
          className={`group relative flex flex-col justify-between text-left rounded-[22px] p-3.5 sm:p-4 min-h-[118px] sm:min-h-[126px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[96px] [@media(max-height:740px)]:rounded-[18px] border transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#151517] border-white/[0.08] active:bg-[#1D1D20]'
              : 'bg-[#FFFFFF] border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.045)] active:bg-[#F5F5F7]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[46px] sm:h-[52px] [@media(max-height:740px)]:h-[36px] mb-1.5 [@media(max-height:740px)]:mb-1">
            <img
              src={foldedMapPin3d}
              alt=""
              draggable={false}
              className="h-[44px] sm:h-[50px] [@media(max-height:740px)]:h-[34px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition-transform duration-200 group-active:scale-95"
            />
          </div>
          <div>
            <h3
              className={`text-[14.5px] sm:text-[15.5px] [@media(max-height:740px)]:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Criar roteiro')}
            </h3>
            <p
              className={`text-[12px] sm:text-[12.5px] [@media(max-height:740px)]:text-[11px] leading-[1.3] mt-0.5 line-clamp-2 ${
                isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
              }`}
            >
              {tr('Monte seu próprio passeio.')}
            </p>
          </div>
        </motion.button>

        {/* Card 2: Meus roteiros */}
        <motion.button
          id="discovery-card-my-itineraries"
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 460, damping: 28 }}
          onClick={() => handleActionClick(onOpenMyItineraries)}
          className={`group relative flex flex-col justify-between text-left rounded-[22px] p-3.5 sm:p-4 min-h-[118px] sm:min-h-[126px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[96px] [@media(max-height:740px)]:rounded-[18px] border transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#151517] border-white/[0.08] active:bg-[#1D1D20]'
              : 'bg-[#FFFFFF] border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.045)] active:bg-[#F5F5F7]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[46px] sm:h-[52px] [@media(max-height:740px)]:h-[36px] mb-1.5 [@media(max-height:740px)]:mb-1">
            <img
              src={myItinerariesRoute3d}
              alt=""
              draggable={false}
              className="h-[44px] sm:h-[50px] [@media(max-height:740px)]:h-[34px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition-transform duration-200 group-active:scale-95"
            />
          </div>
          <div>
            <h3
              className={`text-[14.5px] sm:text-[15.5px] [@media(max-height:740px)]:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Meus roteiros')}
            </h3>
            <p
              className={`text-[12px] sm:text-[12.5px] [@media(max-height:740px)]:text-[11px] leading-[1.3] mt-0.5 line-clamp-2 ${
                isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
              }`}
            >
              {tr('Acesse seus roteiros salvos.')}
            </p>
          </div>
        </motion.button>

        {/* Card 3: Encontrar guia (Locked / Coming Soon) */}
        <div
          id="discovery-card-find-guide"
          role="button"
          aria-disabled="true"
          className={`relative flex flex-col justify-between text-left rounded-[22px] p-3.5 sm:p-4 min-h-[118px] sm:min-h-[126px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[96px] [@media(max-height:740px)]:rounded-[18px] border cursor-default select-none ${
            isDark
              ? 'bg-[#121214] border-white/[0.06]'
              : 'bg-[#FAFAFB] border-black/[0.05] shadow-[0_1px_8px_rgba(0,0,0,0.03)]'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-3 right-3 [@media(max-height:740px)]:top-2.5 [@media(max-height:740px)]:right-2.5 flex items-center justify-center ${
              isDark ? 'text-white/40' : 'text-black/38'
            }`}
          >
            <Lock className="w-[15px] h-[15px]" strokeWidth={1.85} />
          </span>

          <div className="w-full flex items-center justify-center h-[46px] sm:h-[52px] [@media(max-height:740px)]:h-[36px] mb-1.5 [@media(max-height:740px)]:mb-1">
            <img
              src={tourGuide3d}
              alt=""
              draggable={false}
              className={`h-[46px] sm:h-[52px] [@media(max-height:740px)]:h-[36px] w-auto object-contain ${
                isDark ? 'opacity-70' : 'opacity-78'
              }`}
            />
          </div>
          <div>
            <h3
              className={`text-[14.5px] sm:text-[15.5px] [@media(max-height:740px)]:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white/68' : 'text-black/62'
              }`}
            >
              {tr('Encontrar guia')}
            </h3>
            <p
              className={`text-[12px] sm:text-[12.5px] [@media(max-height:740px)]:text-[11px] leading-[1.3] mt-0.5 line-clamp-2 ${
                isDark ? 'text-[#7A7A80]' : 'text-[#858585]'
              }`}
            >
              {tr('Em breve disponível.')}
            </p>
          </div>
        </div>

        {/* Card 4: Loja de roteiros */}
        <motion.button
          id="discovery-card-itinerary-store"
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 460, damping: 28 }}
          onClick={() => handleActionClick(onOpenStore)}
          className={`group relative flex flex-col justify-between text-left rounded-[22px] p-3.5 sm:p-4 min-h-[118px] sm:min-h-[126px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[96px] [@media(max-height:740px)]:rounded-[18px] border transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#151517] border-white/[0.08] active:bg-[#1D1D20]'
              : 'bg-[#FFFFFF] border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.045)] active:bg-[#F5F5F7]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[46px] sm:h-[52px] [@media(max-height:740px)]:h-[36px] mb-1.5 [@media(max-height:740px)]:mb-1">
            <img
              src={itineraryStoreBag3d}
              alt=""
              draggable={false}
              className="h-[44px] sm:h-[50px] [@media(max-height:740px)]:h-[34px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition-transform duration-200 group-active:scale-95"
            />
          </div>
          <div>
            <h3
              className={`text-[14.5px] sm:text-[15.5px] [@media(max-height:740px)]:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Loja de roteiros')}
            </h3>
            <p
              className={`text-[12px] sm:text-[12.5px] [@media(max-height:740px)]:text-[11px] leading-[1.3] mt-0.5 line-clamp-2 ${
                isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
              }`}
            >
              {tr('Encontre roteiros prontos para conhecer.')}
            </p>
          </div>
        </motion.button>
      </div>
    </motion.section>
  );
});

ExploreDiscoveryPanel.displayName = 'ExploreDiscoveryPanel';
