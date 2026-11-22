import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
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

export type SheetDetent = 'peek' | 'compact' | 'expanded';

interface ExploreDiscoveryPanelProps {
  theme: 'dark' | 'light';
  sheetVisibleHeightMV?: MotionValue<number>;
  resetDetentSignal?: number;
  onDetentChange?: (detent: SheetDetent) => void;
  onCreateItinerary: () => void;
  onOpenMyItineraries: () => void;
  onOpenStore: () => void;
}

interface DetentHeights {
  peek: number;
  compact: number;
  expanded: number;
}

const computeDetentHeights = (viewportHeight: number): DetentHeights => {
  const vh = Math.max(540, viewportHeight || 844);
  // Peek (~16%): grabber + "Vamos fazer hoje?" right above BottomNavigation (~84% visible map)
  const peek = Math.round(Math.max(134, Math.min(vh * 0.165, 152)));
  // Compact (~30–33%): initial default state (~67–70% visible map) with all 4 cards visible
  const compact = Math.round(Math.max(264, Math.min(vh * 0.325, 298)));
  // Expanded (~54–56%): spacious full card view with larger icons & 2-line breathing room
  const expanded = Math.round(Math.max(412, Math.min(vh * 0.55, 466)));
  return { peek, compact, expanded };
};

const getViewportHeight = (): number => {
  if (typeof window === 'undefined') return 844;
  return window.visualViewport?.height || window.innerHeight || 844;
};

export const ExploreDiscoveryPanel: React.FC<ExploreDiscoveryPanelProps> = React.memo(({
  theme,
  sheetVisibleHeightMV,
  resetDetentSignal = 0,
  onDetentChange,
  onCreateItinerary,
  onOpenMyItineraries,
  onOpenStore,
}) => {
  const { tr } = useLanguage();
  const isDark = theme === 'dark';

  const [detents, setDetents] = useState<DetentHeights>(() =>
    computeDetentHeights(getViewportHeight())
  );
  const detentsRef = useRef<DetentHeights>(detents);
  detentsRef.current = detents;

  const [activeDetent, setActiveDetent] = useState<SheetDetent>('compact');
  const activeDetentRef = useRef<SheetDetent>('compact');
  activeDetentRef.current = activeDetent;

  const [lockedShakeTick, setLockedShakeTick] = useState(0);

  // Core GPU-friendly height MotionValue (tracks finger 1:1 with zero React re-renders)
  const sheetHeight = useMotionValue<number>(detents.compact);
  const activeAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  // Sync visible height outward to MapComponent right-side controls
  useEffect(() => {
    sheetVisibleHeightMV?.set(sheetHeight.get());
    const unsub = sheetHeight.on('change', (latest) => {
      sheetVisibleHeightMV?.set(latest);
    });
    return () => {
      unsub();
      sheetVisibleHeightMV?.set(0);
    };
  }, [sheetHeight, sheetVisibleHeightMV]);

  // Keep detents synchronized with iOS orientation / dynamic toolbar resize
  useEffect(() => {
    const handleResize = () => {
      const next = computeDetentHeights(getViewportHeight());
      setDetents(next);
      detentsRef.current = next;
      const target = next[activeDetentRef.current];
      activeAnimRef.current?.stop();
      sheetHeight.set(target);
      sheetVisibleHeightMV?.set(target);
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [sheetHeight, sheetVisibleHeightMV]);

  const snapToDetent = useCallback(
    (targetDetent: SheetDetent, initialVelocity: number = 0) => {
      const targetHeight = detentsRef.current[targetDetent];
      activeAnimRef.current?.stop();
      activeAnimRef.current = animate(sheetHeight, targetHeight, {
        ...IOS_SPRING_SHEET,
        velocity: initialVelocity,
      });
      if (targetDetent !== activeDetentRef.current) {
        activeDetentRef.current = targetDetent;
        setActiveDetent(targetDetent);
        onDetentChange?.(targetDetent);
      }
    },
    [sheetHeight, onDetentChange]
  );

  // Smoothly return to 70/30 compact default when returning to Explorar tab
  useEffect(() => {
    if (resetDetentSignal > 0 && activeDetentRef.current !== 'compact') {
      snapToDetent('compact');
    }
  }, [resetDetentSignal, snapToDetent]);

  // Continuous real-time visual adaptation driven directly by sheetHeight (no React re-renders)
  const expandProgress = useTransform(
    sheetHeight,
    [detents.compact, detents.expanded],
    [0, 1],
    { clamp: true }
  );
  const gridRevealProgress = useTransform(
    sheetHeight,
    [detents.peek + 12, detents.compact - 10],
    [0, 1],
    { clamp: true }
  );

  // Progressive icon & typography scaling synchronized with finger drag
  const iconScale = useTransform(expandProgress, [0, 1], [1, 1.54]);
  const titleScale = useTransform(expandProgress, [0, 1], [1, 1.18]);
  const subtitleOpacity = useTransform(gridRevealProgress, [0, 0.6, 1], [0.72, 0.85, 1]);
  const gridOpacity = useTransform(gridRevealProgress, [0, 0.35, 1], [0, 0.55, 1]);
  const gridScale = useTransform(gridRevealProgress, [0, 1], [0.95, 1]);
  const gridY = useTransform(gridRevealProgress, [0, 1], [10, 0]);
  const handleScaleX = useTransform(expandProgress, [0, 1], [1, 1.12]);

  // Unified pointer gesture state for 1:1 finger tracking with zero map conflict
  const dragStateRef = useRef<{
    pointerId: number | null;
    startY: number;
    startHeight: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    isDragging: boolean;
    startedOnHandle: boolean;
  }>({
    pointerId: null,
    startY: 0,
    startHeight: detents.compact,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
    isDragging: false,
    startedOnHandle: false,
  });
  const suppressCardClickUntilRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement | null;
    const startedOnHandle = Boolean(target?.closest('[data-sheet-drag-zone="true"]'));

    activeAnimRef.current?.stop();
    dragStateRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: sheetHeight.get(),
      lastY: e.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      isDragging: startedOnHandle,
      startedOnHandle,
    };

    if (startedOnHandle) {
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
      st.startHeight = sheetHeight.get();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }

    const now = performance.now();
    const dt = Math.max(4, now - st.lastTime);
    const instantVel = ((e.clientY - st.lastY) / dt) * 1000; // px/s downward positive
    st.velocityY = st.velocityY * 0.65 + instantVel * 0.35;
    st.lastY = e.clientY;
    st.lastTime = now;

    // Finger dragging UP (negative deltaY) increases sheetHeight
    const rawHeight = st.startHeight - (e.clientY - st.startY);
    const { peek, expanded } = detentsRef.current;

    // Natural iOS rubber-band resistance outside min/max detents
    let nextHeight = rawHeight;
    if (rawHeight > expanded) {
      nextHeight = expanded + (rawHeight - expanded) * 0.22;
    } else if (rawHeight < peek) {
      nextHeight = peek - (peek - rawHeight) * 0.22;
    }

    sheetHeight.set(Math.max(peek - 28, Math.min(expanded + 36, nextHeight)));
  };

  const finishDrag = (e: React.PointerEvent<HTMLElement>) => {
    const st = dragStateRef.current;
    if (st.pointerId !== e.pointerId) return;

    const wasDragging = st.isDragging;
    const totalMove = Math.abs(e.clientY - st.startY);
    const velY = st.velocityY; // positive = downward swipe, negative = upward swipe
    st.pointerId = null;
    st.isDragging = false;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (!wasDragging) return;

    if (totalMove > 8) {
      suppressCardClickUntilRef.current = performance.now() + 180;
    }

    const { peek, compact, expanded } = detentsRef.current;
    const currentH = sheetHeight.get();
    const heightVelocity = -velY; // positive = moving upward (increasing height)

    // Determine snap point using both current position and swipe momentum
    let targetDetent: SheetDetent = activeDetentRef.current;
    if (Math.abs(heightVelocity) > 420) {
      if (heightVelocity > 0) {
        // Fast flick UP
        targetDetent = currentH < compact - 18 ? 'compact' : 'expanded';
      } else {
        // Fast flick DOWN
        targetDetent = currentH > compact + 18 ? 'compact' : 'peek';
      }
    } else {
      const projected = currentH + heightVelocity * 0.14;
      const candidates: Array<{ detent: SheetDetent; dist: number }> = [
        { detent: 'peek', dist: Math.abs(projected - peek) },
        { detent: 'compact', dist: Math.abs(projected - compact) },
        { detent: 'expanded', dist: Math.abs(projected - expanded) },
      ];
      candidates.sort((a, b) => a.dist - b.dist);
      targetDetent = candidates[0].detent;
    }

    if (targetDetent !== activeDetentRef.current) {
      triggerHapticFeedback(8);
    }
    snapToDetent(targetDetent, Math.max(-1800, Math.min(1800, heightVelocity)));
  };

  const handleGrabberTap = () => {
    if (performance.now() < suppressCardClickUntilRef.current) return;
    triggerHapticFeedback(8);
    if (activeDetentRef.current === 'expanded') {
      snapToDetent('compact');
    } else if (activeDetentRef.current === 'peek') {
      snapToDetent('compact');
    } else {
      snapToDetent('expanded');
    }
  };

  const handleCardPress = (callback: () => void) => {
    if (performance.now() < suppressCardClickUntilRef.current) return;
    unlockSpotClickSound();
    playSpotClickSound();
    triggerHapticFeedback(12);
    callback();
  };

  const handleLockedCardTap = () => {
    if (performance.now() < suppressCardClickUntilRef.current) return;
    triggerHapticFeedback(6);
    setLockedShakeTick((t) => t + 1);
  };

  const isPeek = activeDetent === 'peek';
  const isExpanded = activeDetent === 'expanded';

  return (
    <motion.section
      key="explore-discovery-panel"
      id="explore-discovery-panel"
      aria-label={tr('Vamos fazer hoje?')}
      initial={{ opacity: 0, y: 44 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 52 }}
      transition={IOS_SPRING_SHEET}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className={`md:hidden absolute inset-x-0 bottom-0 z-[36] flex flex-col rounded-t-[28px] select-none overflow-hidden transition-colors duration-200 will-change-[height,transform] ${
        isDark
          ? 'bg-[#0A0A0C] border-t border-white/[0.11] shadow-[0_-12px_36px_rgba(0,0,0,0.68)]'
          : 'bg-[#FFFFFF] border-t border-black/[0.05] shadow-[0_-10px_32px_rgba(0,0,0,0.14)]'
      }`}
      style={{
        height: sheetHeight,
        contain: 'layout paint',
        paddingLeft: 'max(14px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(14px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)',
        transform: 'translateZ(0)',
      }}
    >
      {/* Draggable Apple Maps-style Top Handle + Header Zone */}
      <div
        data-sheet-drag-zone="true"
        className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
      >
        {/* Top Grabber Bar */}
        <div className="w-full flex justify-center pt-2 pb-1">
          <button
            type="button"
            onClick={handleGrabberTap}
            aria-label={isExpanded ? tr('Recolher painel') : tr('Expandir painel')}
            className="px-8 py-1.5 -my-1.5 flex items-center justify-center focus:outline-none"
          >
            <motion.span
              style={{ scaleX: handleScaleX }}
              className={`block w-9 h-[4px] rounded-full transition-colors ${
                isDark ? 'bg-white/28' : 'bg-black/22'
              }`}
            />
          </button>
        </div>

        {/* Title & Subtitle */}
        <div className="px-1 pt-0.5 pb-2">
          <motion.h2
            style={{ scale: titleScale, transformOrigin: 'left center' }}
            className={`text-[18px] sm:text-[19px] font-bold tracking-[-0.025em] leading-[1.15] will-change-transform ${
              isDark ? 'text-white' : 'text-black'
            }`}
          >
            {tr('Vamos fazer hoje?')}
          </motion.h2>
          <motion.p
            style={{ opacity: subtitleOpacity }}
            className={`text-[11.5px] sm:text-[12.5px] font-normal leading-[1.25] mt-0.5 ${
              isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'
            }`}
          >
            {tr('Como deseja aproveitar sua viagem?')}
          </motion.p>
        </div>
      </div>

      {/* 2x2 Discovery Cards Grid — Fluidly adapts height & icon scale during drag */}
      <motion.div
        aria-hidden={isPeek}
        style={{
          opacity: gridOpacity,
          scale: gridScale,
          y: gridY,
          transformOrigin: '50% 0%',
        }}
        className={`flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-2 sm:gap-2.5 pb-1 will-change-[transform,opacity] ${
          isPeek ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        {/* Card 1: Criar roteiro */}
        <motion.button
          id="discovery-card-create-itinerary"
          type="button"
          whileTap={{ scale: 0.955 }}
          transition={IOS_SPRING_PRESS}
          onClick={() => handleCardPress(onCreateItinerary)}
          className={`group relative flex flex-col justify-between text-left rounded-[19px] px-2.5 py-2 sm:px-3 sm:py-2.5 h-full min-h-0 overflow-hidden border transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#151517] border-white/[0.08] active:bg-[#1E1E22]'
              : 'bg-[#FFFFFF] border-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.045)] active:bg-[#F4F4F6]'
          }`}
        >
          <div className="w-full flex-1 min-h-[24px] flex items-center justify-center">
            <motion.img
              src={foldedMapPin3d}
              alt=""
              draggable={false}
              style={{ scale: iconScale }}
              className="h-[26px] sm:h-[28px] w-auto object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.16)] will-change-transform transition-opacity duration-150 group-active:opacity-90"
            />
          </div>
          <div className="shrink-0 pt-0.5">
            <h3
              className={`text-[12.5px] sm:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.18] truncate ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Criar roteiro')}
            </h3>
            <p
              className={`text-[10px] sm:text-[11px] leading-[1.22] mt-0.5 ${
                isExpanded ? 'line-clamp-2' : 'line-clamp-1'
              } ${isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'}`}
            >
              {tr('Monte seu próprio passeio.')}
            </p>
          </div>
        </motion.button>

        {/* Card 2: Meus roteiros */}
        <motion.button
          id="discovery-card-my-itineraries"
          type="button"
          whileTap={{ scale: 0.955 }}
          transition={IOS_SPRING_PRESS}
          onClick={() => handleCardPress(onOpenMyItineraries)}
          className={`group relative flex flex-col justify-between text-left rounded-[19px] px-2.5 py-2 sm:px-3 sm:py-2.5 h-full min-h-0 overflow-hidden border transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#151517] border-white/[0.08] active:bg-[#1E1E22]'
              : 'bg-[#FFFFFF] border-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.045)] active:bg-[#F4F4F6]'
          }`}
        >
          <div className="w-full flex-1 min-h-[24px] flex items-center justify-center">
            <motion.img
              src={myItinerariesRoute3d}
              alt=""
              draggable={false}
              style={{ scale: iconScale }}
              className="h-[26px] sm:h-[28px] w-auto object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.16)] will-change-transform transition-opacity duration-150 group-active:opacity-90"
            />
          </div>
          <div className="shrink-0 pt-0.5">
            <h3
              className={`text-[12.5px] sm:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.18] truncate ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Meus roteiros')}
            </h3>
            <p
              className={`text-[10px] sm:text-[11px] leading-[1.22] mt-0.5 ${
                isExpanded ? 'line-clamp-2' : 'line-clamp-1'
              } ${isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'}`}
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
          whileTap={{ scale: 0.985 }}
          transition={IOS_SPRING_PRESS}
          onClick={handleLockedCardTap}
          className={`relative flex flex-col justify-between text-left rounded-[19px] px-2.5 py-2 sm:px-3 sm:py-2.5 h-full min-h-0 overflow-hidden border cursor-default select-none ${
            isDark
              ? 'bg-[#121214] border-white/[0.06]'
              : 'bg-[#FAFAFB] border-black/[0.05] shadow-[0_1px_7px_rgba(0,0,0,0.03)]'
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
            className={`absolute top-2 right-2.5 flex items-center justify-center ${
              isDark ? 'text-white/40' : 'text-black/38'
            }`}
          >
            <Lock className="w-[13.5px] h-[13.5px]" strokeWidth={1.85} />
          </motion.span>

          <div className="w-full flex-1 min-h-[24px] flex items-center justify-center">
            <motion.img
              src={tourGuide3d}
              alt=""
              draggable={false}
              style={{ scale: iconScale }}
              className={`h-[26px] sm:h-[28px] w-auto object-contain will-change-transform ${
                isDark ? 'opacity-70' : 'opacity-78'
              }`}
            />
          </div>
          <div className="shrink-0 pt-0.5">
            <h3
              className={`text-[12.5px] sm:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.18] truncate ${
                isDark ? 'text-white/68' : 'text-black/62'
              }`}
            >
              {tr('Encontrar guia')}
            </h3>
            <p
              className={`text-[10px] sm:text-[11px] leading-[1.22] mt-0.5 ${
                isExpanded ? 'line-clamp-2' : 'line-clamp-1'
              } ${isDark ? 'text-[#7A7A80]' : 'text-[#858585]'}`}
            >
              {tr('Em breve disponível.')}
            </p>
          </div>
        </motion.div>

        {/* Card 4: Loja de roteiros */}
        <motion.button
          id="discovery-card-itinerary-store"
          type="button"
          whileTap={{ scale: 0.955 }}
          transition={IOS_SPRING_PRESS}
          onClick={() => handleCardPress(onOpenStore)}
          className={`group relative flex flex-col justify-between text-left rounded-[19px] px-2.5 py-2 sm:px-3 sm:py-2.5 h-full min-h-0 overflow-hidden border transition-colors duration-150 cursor-pointer focus:outline-none ${
            isDark
              ? 'bg-[#151517] border-white/[0.08] active:bg-[#1E1E22]'
              : 'bg-[#FFFFFF] border-black/[0.06] shadow-[0_2px_10px_rgba(0,0,0,0.045)] active:bg-[#F4F4F6]'
          }`}
        >
          <div className="w-full flex-1 min-h-[24px] flex items-center justify-center">
            <motion.img
              src={itineraryStoreBag3d}
              alt=""
              draggable={false}
              style={{ scale: iconScale }}
              className="h-[26px] sm:h-[28px] w-auto object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.16)] will-change-transform transition-opacity duration-150 group-active:opacity-90"
            />
          </div>
          <div className="shrink-0 pt-0.5">
            <h3
              className={`text-[12.5px] sm:text-[13.5px] font-semibold tracking-[-0.015em] leading-[1.18] truncate ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {tr('Loja de roteiros')}
            </h3>
            <p
              className={`text-[10px] sm:text-[11px] leading-[1.22] mt-0.5 ${
                isExpanded ? 'line-clamp-2' : 'line-clamp-1'
              } ${isDark ? 'text-[#8E8E93]' : 'text-[#6E6E73]'}`}
            >
              {tr('Encontre roteiros prontos para conhecer.')}
            </p>
          </div>
        </motion.button>
      </motion.div>
    </motion.section>
  );
});

ExploreDiscoveryPanel.displayName = 'ExploreDiscoveryPanel';
