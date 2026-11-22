import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  animate,
  MotionValue,
} from 'motion/react';
import { Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { triggerHapticFeedback } from '../utils/haptics';
import { playSpotClickSound, unlockSpotClickSound } from '../utils/soundEffects';
import { IOS_SPRING_PRESS, IOS_SPRING_SHEET } from '../utils/iosMotion';
import foldedMapPin3d from '../assets/images/folded_map_pin_3d.png';
import myItinerariesRoute3d from '../assets/images/my_itineraries_route_3d.png';
import tourGuide3d from '../assets/images/tour_guide_3d.png';
import itineraryStoreBag3d from '../assets/images/itinerary_store_bag_3d.png';

export type SheetPosition = 'open' | 'collapsed';

interface ExploreDiscoveryPanelProps {
  theme: 'dark' | 'light';
  sheetVisibleHeightMV?: MotionValue<number>;
  resetDetentSignal?: number;
  entranceTick?: number;
  onPositionChange?: (position: SheetPosition) => void;
  onCreateItinerary: () => void;
  onOpenMyItineraries: () => void;
  onOpenStore: () => void;
}

const PEEK_VISIBLE_HEIGHT = 92; // Grabber + top spacing right above BottomNavigation

// Exact spring physics used in ItinerariesView / AirbnbItineraryExplorer ("Loja de roteiros")
const STORE_ENTRANCE_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 22,
};

export const ExploreDiscoveryPanel: React.FC<ExploreDiscoveryPanelProps> = React.memo(({
  theme,
  sheetVisibleHeightMV,
  resetDetentSignal = 0,
  entranceTick = 0,
  onPositionChange,
  onCreateItinerary,
  onOpenMyItineraries,
  onOpenStore,
}) => {
  const { tr } = useLanguage();
  const isDark = theme === 'dark';

  const sheetRef = useRef<HTMLElement | null>(null);
  const measuredHeightRef = useRef<number>(310);
  const [position, setPosition] = useState<SheetPosition>('open');
  const positionRef = useRef<SheetPosition>('open');
  positionRef.current = position;

  const [lockedShakeTick, setLockedShakeTick] = useState(0);

  // Pure GPU translateY: 0 = full original panel open; collapseDistance = smoothly lowered peek
  const sheetY = useMotionValue<number>(0);
  const activeAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  const getCollapseDistance = useCallback(() => {
    return Math.max(120, measuredHeightRef.current - PEEK_VISIBLE_HEIGHT);
  }, []);

  const syncVisibleHeight = useCallback(
    (currentY: number) => {
      if (!sheetVisibleHeightMV) return;
      const visible = Math.max(0, measuredHeightRef.current - currentY);
      sheetVisibleHeightMV.set(visible);
    },
    [sheetVisibleHeightMV]
  );

  // Measure natural panel height once (and on resize) so the sheet never resizes its internals during drag
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const updateMeasure = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        measuredHeightRef.current = h;
        if (positionRef.current === 'collapsed') {
          const dist = Math.max(120, h - PEEK_VISIBLE_HEIGHT);
          sheetY.set(dist);
          syncVisibleHeight(dist);
        } else {
          syncVisibleHeight(sheetY.get());
        }
      }
    };

    updateMeasure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateMeasure);
      ro.observe(el);
    }
    window.addEventListener('resize', updateMeasure);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateMeasure);
    };
  }, [sheetY, syncVisibleHeight]);

  // Continuously broadcast visible sheet height to MapComponent (right-side controls & 3D camera padding)
  useEffect(() => {
    syncVisibleHeight(sheetY.get());
    const unsub = sheetY.on('change', (latestY) => {
      syncVisibleHeight(latestY);
    });
    return () => {
      unsub();
      sheetVisibleHeightMV?.set(0);
    };
  }, [sheetY, syncVisibleHeight, sheetVisibleHeightMV]);

  const snapToPosition = useCallback(
    (targetPos: SheetPosition, initialVelocity: number = 0) => {
      const targetY = targetPos === 'open' ? 0 : getCollapseDistance();
      activeAnimRef.current?.stop();
      activeAnimRef.current = animate(sheetY, targetY, {
        ...IOS_SPRING_SHEET,
        velocity: initialVelocity,
      });
      if (targetPos !== positionRef.current) {
        positionRef.current = targetPos;
        setPosition(targetPos);
        onPositionChange?.(targetPos);
      }
    },
    [getCollapseDistance, sheetY, onPositionChange]
  );

  // Restore open position cleanly when returning to Explorar tab
  useEffect(() => {
    if (resetDetentSignal > 0 && positionRef.current !== 'open') {
      snapToPosition('open');
    }
  }, [resetDetentSignal, snapToPosition]);

  // Real-time 1:1 finger drag handling (moves the entire panel as one rigid GPU layer)
  const dragStateRef = useRef<{
    pointerId: number | null;
    startY: number;
    startSheetY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    isDragging: boolean;
  }>({
    pointerId: null,
    startY: 0,
    startSheetY: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
    isDragging: false,
  });
  const suppressClickUntilRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement | null;
    const startedOnDragZone = Boolean(target?.closest('[data-sheet-drag-zone="true"]'));

    activeAnimRef.current?.stop();
    dragStateRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startSheetY: sheetY.get(),
      lastY: e.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      isDragging: startedOnDragZone,
    };

    if (startedOnDragZone) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const st = dragStateRef.current;
    if (st.pointerId !== e.pointerId) return;

    const deltaY = e.clientY - st.startY;
    if (!st.isDragging) {
      if (Math.abs(deltaY) < 7) return;
      st.isDragging = true;
      st.startY = e.clientY;
      st.startSheetY = sheetY.get();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }

    const now = performance.now();
    const dt = Math.max(4, now - st.lastTime);
    const instantVel = ((e.clientY - st.lastY) / dt) * 1000;
    st.velocityY = st.velocityY * 0.65 + instantVel * 0.35;
    st.lastY = e.clientY;
    st.lastTime = now;

    const maxDown = getCollapseDistance();
    const rawY = st.startSheetY + (e.clientY - st.startY);

    // Subtle iOS rubber-band resistance past open (0) or collapsed (maxDown)
    let nextY = rawY;
    if (rawY < 0) {
      nextY = rawY * 0.18;
    } else if (rawY > maxDown) {
      nextY = maxDown + (rawY - maxDown) * 0.18;
    }

    sheetY.set(Math.max(-28, Math.min(maxDown + 32, nextY)));
  };

  const finishDrag = (e: React.PointerEvent<HTMLElement>) => {
    const st = dragStateRef.current;
    if (st.pointerId !== e.pointerId) return;

    const wasDragging = st.isDragging;
    const totalMove = Math.abs(e.clientY - st.startY);
    const velY = st.velocityY;
    st.pointerId = null;
    st.isDragging = false;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (!wasDragging) return;

    if (totalMove > 8) {
      suppressClickUntilRef.current = performance.now() + 180;
    }

    const maxDown = getCollapseDistance();
    const currentY = sheetY.get();
    let targetPos: SheetPosition = positionRef.current;

    if (Math.abs(velY) > 380) {
      targetPos = velY > 0 ? 'collapsed' : 'open';
    } else {
      const projectedY = currentY + velY * 0.14;
      targetPos = projectedY > maxDown * 0.45 ? 'collapsed' : 'open';
    }

    if (targetPos !== positionRef.current) {
      triggerHapticFeedback(8);
    }
    snapToPosition(targetPos, Math.max(-1800, Math.min(1800, velY)));
  };

  const handleGrabberTap = () => {
    if (performance.now() < suppressClickUntilRef.current) return;
    triggerHapticFeedback(8);
    snapToPosition(positionRef.current === 'open' ? 'collapsed' : 'open');
  };

  const handleActionClick = (callback: () => void) => {
    if (performance.now() < suppressClickUntilRef.current) return;
    unlockSpotClickSound();
    playSpotClickSound();
    triggerHapticFeedback(12);
    callback();
  };

  const handleLockedCardTap = () => {
    if (performance.now() < suppressClickUntilRef.current) return;
    triggerHapticFeedback(6);
    setLockedShakeTick((t) => t + 1);
  };

  const isCollapsed = position === 'collapsed';

  return (
    <motion.section
      ref={sheetRef}
      key={`explore-discovery-panel-${entranceTick}`}
      id="explore-discovery-panel"
      aria-label={tr('Vamos fazer hoje?')}
      initial={{ opacity: 0, scale: 0.94, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 32 }}
      transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.01 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className={`md:hidden absolute inset-x-0 bottom-0 z-[36] w-full rounded-t-[28px] select-none transition-colors duration-200 will-change-transform after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-inherit ${
        isDark
          ? 'bg-[#09090A] border-t border-white/[0.10] shadow-[0_-10px_32px_rgba(0,0,0,0.6)]'
          : 'bg-[#FFFFFF] border-t border-black/[0.06] shadow-[0_-10px_30px_rgba(0,0,0,0.12)]'
      }`}
      style={{
        y: sheetY,
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
      }}
    >
      {/* Top Drag Handle Bar */}
      <div
        data-sheet-drag-zone="true"
        className="touch-none cursor-grab active:cursor-grabbing pb-2 pt-2.5"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.02 }}
          className="w-full flex justify-center"
        >
          <button
            type="button"
            onClick={handleGrabberTap}
            aria-label={isCollapsed ? tr('Expandir painel') : tr('Recolher painel')}
            className="px-8 py-1.5 -my-1.5 flex items-center justify-center focus:outline-none"
          >
            <span
              className={`block w-9 h-[4px] rounded-full transition-colors ${
                isDark ? 'bg-white/25' : 'bg-black/20'
              }`}
            />
          </button>
        </motion.div>
      </div>

      {/* 2x2 Discovery Cards Grid — Premium iOS 3D Volumetric Finish */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 [@media(max-height:740px)]:gap-2 pt-1">
        {/* Card 1: Criar roteiro */}
        <motion.button
          id="discovery-card-create-itinerary"
          type="button"
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.065 }}
          whileTap={{ scale: 0.96, transition: IOS_SPRING_PRESS }}
          onClick={() => handleActionClick(onCreateItinerary)}
          className={`group relative flex flex-col justify-between text-left rounded-[26px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[22px] transition-all duration-200 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#18181B] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] active:bg-[#202024]'
              : 'bg-[#FFFFFF] border border-black/[0.04] shadow-[0_12px_36px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.9)] active:bg-[#F9F9FB]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] mb-1 [@media(max-height:740px)]:mb-0.5">
            <motion.img
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.08 }}
              src={foldedMapPin3d}
              alt=""
              draggable={false}
              className="h-[38px] sm:h-[44px] [@media(max-height:740px)]:h-[30px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition-transform duration-200 group-active:scale-95"
            />
          </div>
          <div>
            <h3
              className={`text-[14px] sm:text-[15px] [@media(max-height:740px)]:text-[13px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Criar roteiro')}
            </h3>
            <p
              className={`text-[11.5px] sm:text-[12px] [@media(max-height:740px)]:text-[10.5px] leading-[1.25] mt-0.5 line-clamp-2 ${
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
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.095 }}
          whileTap={{ scale: 0.96, transition: IOS_SPRING_PRESS }}
          onClick={() => handleActionClick(onOpenMyItineraries)}
          className={`group relative flex flex-col justify-between text-left rounded-[26px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[22px] transition-all duration-200 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#18181B] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] active:bg-[#202024]'
              : 'bg-[#FFFFFF] border border-black/[0.04] shadow-[0_12px_36px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.9)] active:bg-[#F9F9FB]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] mb-1 [@media(max-height:740px)]:mb-0.5">
            <motion.img
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.11 }}
              src={myItinerariesRoute3d}
              alt=""
              draggable={false}
              className="h-[38px] sm:h-[44px] [@media(max-height:740px)]:h-[30px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition-transform duration-200 group-active:scale-95"
            />
          </div>
          <div>
            <h3
              className={`text-[14px] sm:text-[15px] [@media(max-height:740px)]:text-[13px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Meus roteiros')}
            </h3>
            <p
              className={`text-[11.5px] sm:text-[12px] [@media(max-height:740px)]:text-[10.5px] leading-[1.25] mt-0.5 line-clamp-2 ${
                isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
              }`}
            >
              {tr('Acesse seus roteiros salvos.')}
            </p>
          </div>
        </motion.button>

        {/* Card 3: Encontrar guia (Locked / Coming Soon) */}
        <motion.div
          id="discovery-card-find-guide"
          role="button"
          aria-disabled="true"
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.125 }}
          whileTap={{ scale: 0.985, transition: IOS_SPRING_PRESS }}
          onClick={handleLockedCardTap}
          className={`relative flex flex-col justify-between text-left rounded-[26px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[22px] transition-all duration-200 cursor-default select-none ${
            isDark
              ? 'bg-[#151518] border border-white/[0.06] shadow-[0_10px_32px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]'
              : 'bg-[#FAFAFB] border border-black/[0.03] shadow-[0_10px_28px_rgba(0,0,0,0.04),0_2px_6px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,0.8)]'
          }`}
        >
          <motion.span
            key={lockedShakeTick}
            animate={
              lockedShakeTick > 0
                ? { x: [0, -2.5, 2.5, -1.5, 1.5, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            aria-hidden="true"
            className={`absolute top-3 right-3 [@media(max-height:740px)]:top-2.5 [@media(max-height:740px)]:right-2.5 flex items-center justify-center ${
              isDark ? 'text-white/40' : 'text-black/38'
            }`}
          >
            <Lock className="w-[14px] h-[14px]" strokeWidth={1.85} />
          </motion.span>

          <div className="w-full flex items-center justify-center h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] mb-1 [@media(max-height:740px)]:mb-0.5">
            <motion.img
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.14 }}
              src={tourGuide3d}
              alt=""
              draggable={false}
              className={`h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] w-auto object-contain ${
                isDark ? 'opacity-70' : 'opacity-78'
              }`}
            />
          </div>
          <div>
            <h3
              className={`text-[14px] sm:text-[15px] [@media(max-height:740px)]:text-[13px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white/68' : 'text-black/62'
              }`}
            >
              {tr('Encontrar guia')}
            </h3>
            <p
              className={`text-[11.5px] sm:text-[12px] [@media(max-height:740px)]:text-[10.5px] leading-[1.25] mt-0.5 line-clamp-2 ${
                isDark ? 'text-[#7A7A80]' : 'text-[#858585]'
              }`}
            >
              {tr('Em breve disponível.')}
            </p>
          </div>
        </motion.div>

        {/* Card 4: Loja de roteiros */}
        <motion.button
          id="discovery-card-itinerary-store"
          type="button"
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.155 }}
          whileTap={{ scale: 0.96, transition: IOS_SPRING_PRESS }}
          onClick={() => handleActionClick(onOpenStore)}
          className={`group relative flex flex-col justify-between text-left rounded-[26px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[22px] transition-all duration-200 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#18181B] border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] active:bg-[#202024]'
              : 'bg-[#FFFFFF] border border-black/[0.04] shadow-[0_12px_36px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.9)] active:bg-[#F9F9FB]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] mb-1 [@media(max-height:740px)]:mb-0.5">
            <motion.img
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...STORE_ENTRANCE_SPRING, delay: 0.17 }}
              src={itineraryStoreBag3d}
              alt=""
              draggable={false}
              className="h-[38px] sm:h-[44px] [@media(max-height:740px)]:h-[30px] w-auto object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)] transition-transform duration-200 group-active:scale-95"
            />
          </div>
          <div>
            <h3
              className={`text-[14px] sm:text-[15px] [@media(max-height:740px)]:text-[13px] font-semibold tracking-[-0.015em] leading-[1.2] ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Loja de roteiros')}
            </h3>
            <p
              className={`text-[11.5px] sm:text-[12px] [@media(max-height:740px)]:text-[10.5px] leading-[1.25] mt-0.5 line-clamp-2 ${
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
