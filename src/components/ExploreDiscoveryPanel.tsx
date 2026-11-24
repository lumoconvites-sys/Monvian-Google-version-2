import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
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
  onClose?: () => void;
  onCreateItinerary: () => void;
  onOpenMyItineraries: () => void;
  onOpenStore: () => void;
}

const PEEK_VISIBLE_HEIGHT = 92; // Grabber + top spacing right above BottomNavigation

export const ExploreDiscoveryPanel: React.FC<ExploreDiscoveryPanelProps> = React.memo(({
  theme,
  sheetVisibleHeightMV,
  resetDetentSignal = 0,
  onPositionChange,
  onClose,
  onCreateItinerary,
  onOpenMyItineraries,
  onOpenStore,
}) => {
  const { tr } = useLanguage();
  const isDark = theme === 'dark';
  const prefersReducedMotion = useReducedMotion();

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

  // Measure natural panel height synchronously before paint so right-side controls never jump
  useLayoutEffect(() => {
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

    if (currentY > maxDown * 0.35 || velY > 360) {
      triggerHapticFeedback(10);
      onClose?.();
      return;
    }

    snapToPosition('open', Math.max(-1800, Math.min(1800, velY)));
  };

  const handleGrabberTap = () => {
    if (performance.now() < suppressClickUntilRef.current) return;
    triggerHapticFeedback(8);
    onClose?.();
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
    <motion.div
      key="explore-discovery-panel"
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { y: 116, scale: 0.955, opacity: 0 }
      }
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : { y: 0, scale: 1, opacity: 1 }
      }
      exit={
        prefersReducedMotion
          ? { opacity: 0, transition: { duration: 0.16 } }
          : {
              y: 96,
              opacity: 0,
              transition: {
                duration: 0.24,
                ease: [0.32, 0.72, 0, 1],
              },
            }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0.16 }
          : {
              type: 'spring',
              stiffness: 300,
              damping: 30,
              mass: 0.82,
            }
      }
      className="md:hidden absolute inset-x-0 bottom-0 z-[36] w-full pointer-events-none transform-gpu"
      style={{
        willChange: 'transform, opacity',
        transformOrigin: 'center bottom',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      <motion.section
        ref={sheetRef}
        id="explore-discovery-panel"
        aria-label={tr('Painel de Acesso Rápido')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className={`pointer-events-auto relative w-full rounded-t-[28px] select-none transition-colors duration-200 will-change-transform after:content-[''] after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-inherit ${
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
        <div className="w-full flex justify-center">
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
        </div>
      </div>

      {/* 2x2 Discovery Cards Grid — Matching Plans Card Style & Rounding */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 [@media(max-height:740px)]:gap-2 pt-1">
        {/* Card 1: Criar roteiro */}
        <motion.button
          id="discovery-card-create-itinerary"
          type="button"
          whileTap={{ scale: 0.96, transition: IOS_SPRING_PRESS }}
          onClick={() => handleActionClick(onCreateItinerary)}
          className={`group relative flex flex-col justify-between text-left rounded-[24px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[20px] transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#161619] border border-white/[0.07] shadow-[0_4px_18px_rgba(0,0,0,0.35)] active:bg-[#1E1E22]'
              : 'bg-[#FFFFFF] border border-black/[0.04] shadow-[0_4px_18px_rgba(0,0,0,0.045),0_1px_4px_rgba(0,0,0,0.025)] active:bg-[#F9F9FB]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] mb-1 [@media(max-height:740px)]:mb-0.5">
            <img
              src={foldedMapPin3d}
              alt=""
              draggable={false}
              loading="eager"
              decoding="sync"
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
          whileTap={{ scale: 0.96, transition: IOS_SPRING_PRESS }}
          onClick={() => handleActionClick(onOpenMyItineraries)}
          className={`group relative flex flex-col justify-between text-left rounded-[24px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[20px] transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#161619] border border-white/[0.07] shadow-[0_4px_18px_rgba(0,0,0,0.35)] active:bg-[#1E1E22]'
              : 'bg-[#FFFFFF] border border-black/[0.04] shadow-[0_4px_18px_rgba(0,0,0,0.045),0_1px_4px_rgba(0,0,0,0.025)] active:bg-[#F9F9FB]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] mb-1 [@media(max-height:740px)]:mb-0.5">
            <img
              src={myItinerariesRoute3d}
              alt=""
              draggable={false}
              loading="eager"
              decoding="sync"
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
          whileTap={{ scale: 0.985, transition: IOS_SPRING_PRESS }}
          onClick={handleLockedCardTap}
          className={`relative flex flex-col justify-between text-left rounded-[24px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[20px] transition-colors duration-150 cursor-default select-none ${
            isDark
              ? 'bg-[#161619] border border-white/[0.07] shadow-[0_4px_18px_rgba(0,0,0,0.35)]'
              : 'bg-[#FFFFFF] border border-black/[0.04] shadow-[0_4px_18px_rgba(0,0,0,0.045),0_1px_4px_rgba(0,0,0,0.025)]'
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
            <img
              src={tourGuide3d}
              alt=""
              draggable={false}
              loading="eager"
              decoding="sync"
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
          whileTap={{ scale: 0.96, transition: IOS_SPRING_PRESS }}
          onClick={() => handleActionClick(onOpenStore)}
          className={`group relative flex flex-col justify-between text-left rounded-[24px] p-3.5 sm:p-4 min-h-[108px] sm:min-h-[116px] [@media(max-height:740px)]:p-2.5 [@media(max-height:740px)]:min-h-[92px] [@media(max-height:740px)]:rounded-[20px] transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#161619] border border-white/[0.07] shadow-[0_4px_18px_rgba(0,0,0,0.35)] active:bg-[#1E1E22]'
              : 'bg-[#FFFFFF] border border-black/[0.04] shadow-[0_4px_18px_rgba(0,0,0,0.045),0_1px_4px_rgba(0,0,0,0.025)] active:bg-[#F9F9FB]'
          }`}
        >
          <div className="w-full flex items-center justify-center h-[40px] sm:h-[46px] [@media(max-height:740px)]:h-[32px] mb-1 [@media(max-height:740px)]:mb-0.5">
            <img
              src={itineraryStoreBag3d}
              alt=""
              draggable={false}
              loading="eager"
              decoding="sync"
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
    </motion.div>
  );
});

ExploreDiscoveryPanel.displayName = 'ExploreDiscoveryPanel';
