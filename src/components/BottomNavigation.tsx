import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';
import { GlassView } from 'expo-glass-effect';
import { NavAgoraIcon, NavSalvosIcon, NavSearchIcon, NavProfileIcon, NavRoteirosIcon } from './NavIcons';

export type TabType = 'explorar' | 'roteiros' | 'salvos' | 'buscar' | 'perfil';

export interface BottomNavigationProps {
  activeTab: TabType | 'chat'; // support 'chat' for backward compatibility
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  isBlurred?: boolean;
  forceWhiteUI?: boolean;
  isSatellite?: boolean;
  theme?: 'dark' | 'light';
  isTutorialSweepActive?: boolean;
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'roteiros', label: 'Roteiros' },
  { id: 'salvos', label: 'Salvos' },
  { id: 'explorar', label: 'Explorar' },
  { id: 'buscar', label: 'Buscar' },
  { id: 'perfil', label: 'Perfil' },
];

// Spring presets calibrated for natural iOS/macOS Dock physics
const ICON_SCALE_SPRING = { stiffness: 460, damping: 27, mass: 0.55 };
const ICON_OFFSET_SPRING = { stiffness: 430, damping: 29, mass: 0.58 };
const LENS_MOVE_SPRING = { stiffness: 520, damping: 34, mass: 0.52 };
const LENS_SCALE_SPRING = { stiffness: 440, damping: 26, mass: 0.55 };

// Hit tolerance around the bar while dragging so slight vertical drift stays responsive
const HORIZONTAL_VALID_PADDING_PX = 20;
const VERTICAL_VALID_PADDING_PX = 62;

let lastDockHapticTs = 0;
function triggerDockHaptic(durationMs: number = 10) {
  if (typeof navigator === 'undefined') return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastDockHapticTs < 38) return;
  lastDockHapticTs = now;
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Silently ignore on platforms without vibration API support
  }
}

interface DockTabButtonProps {
  tab: { id: TabType; label: string };
  index: number;
  isActive: boolean;
  isHighlighted: boolean;
  isScrubbing: boolean;
  pulseAnimation: number;
  iconColor: string;
  isSatellite: boolean;
  useWhiteIcons: boolean;
  theme: 'dark' | 'light';
  prefersReducedMotion: boolean;
  pointerSlotMV: MotionValue<number>;
  magnifyStrengthMV: MotionValue<number>;
  onButtonClick: (tabId: TabType) => void;
}

const DockTabButton: React.FC<DockTabButtonProps> = memo(({
  tab,
  index,
  isActive,
  isHighlighted,
  isScrubbing,
  pulseAnimation,
  iconColor,
  isSatellite,
  useWhiteIcons,
  theme,
  prefersReducedMotion,
  pointerSlotMV,
  magnifyStrengthMV,
  onButtonClick,
}) => {
  // Continuous cosine-bell Dock magnification curve centered on each slot (index + 0.5)
  const rawScale = useTransform(
    [pointerSlotMV, magnifyStrengthMV],
    ([slot, strength]: number[]) => {
      if (strength <= 0.001 || slot < -5) return 1;
      const center = index + 0.5;
      const dist = Math.abs(slot - center);
      const radius = 1.65;
      if (dist >= radius) return 1;
      const bell = 0.5 * (1 + Math.cos((Math.PI * dist) / radius));
      const maxBoost = prefersReducedMotion ? 0.14 : 0.38;
      return 1 + maxBoost * bell * strength;
    }
  );

  const rawY = useTransform(
    [pointerSlotMV, magnifyStrengthMV],
    ([slot, strength]: number[]) => {
      if (prefersReducedMotion || strength <= 0.001 || slot < -5) return 0;
      const center = index + 0.5;
      const dist = Math.abs(slot - center);
      const radius = 1.65;
      if (dist >= radius) return 0;
      const bell = 0.5 * (1 + Math.cos((Math.PI * dist) / radius));
      return -5.5 * bell * strength;
    }
  );

  // Subtle organic horizontal spread so neighbor icons gently part around the magnified icon
  const rawX = useTransform(
    [pointerSlotMV, magnifyStrengthMV],
    ([slot, strength]: number[]) => {
      if (prefersReducedMotion || strength <= 0.001 || slot < -5) return 0;
      const center = index + 0.5;
      const diff = center - slot;
      const dist = Math.abs(diff);
      const radius = 1.65;
      if (dist < 0.04 || dist >= radius) return 0;
      const push = Math.sin((Math.PI * dist) / radius) * 4.5 * strength;
      return diff > 0 ? push : -push;
    }
  );

  const smoothScale = useSpring(rawScale, ICON_SCALE_SPRING);
  const smoothY = useSpring(rawY, ICON_OFFSET_SPRING);
  const smoothX = useSpring(rawX, ICON_OFFSET_SPRING);

  const isEmphasized = isScrubbing ? isHighlighted : isActive;

  return (
    <button
      id={`nav-btn-${tab.id}`}
      type="button"
      onClick={() => onButtonClick(tab.id)}
      aria-label={tab.label}
      aria-current={isActive ? 'page' : undefined}
      className={`relative z-10 w-full h-full rounded-full flex items-center justify-center cursor-pointer select-none transition-[color,opacity] duration-[200ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 ${
        isSatellite
          ? theme === 'dark'
            ? 'text-[#C0C0C6] focus-visible:ring-white/30'
            : 'text-[#858585] focus-visible:ring-black/20'
          : useWhiteIcons
            ? 'text-[#FFFFFF] focus-visible:ring-white/30'
            : 'text-[#000000] focus-visible:ring-black/25'
      } ${isEmphasized ? 'opacity-100' : 'opacity-85 hover:opacity-100'}`}
      style={{
        color: iconColor,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      <motion.div
        style={{
          scale: smoothScale,
          x: smoothX,
          y: smoothY,
          willChange: 'transform',
        }}
        className="flex items-center justify-center pointer-events-none"
      >
        <motion.div
          initial={false}
          animate={{
            rotate: tab.id === 'explorar' ? pulseAnimation : 0,
          }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          className="w-[24px] h-[24px] flex items-center justify-center shrink-0"
        >
          {tab.id === 'roteiros' && <NavRoteirosIcon size={24} className="text-current" />}
          {tab.id === 'salvos' && <NavSalvosIcon size={24} className="text-current" />}
          {tab.id === 'explorar' && <NavAgoraIcon size={24} className="text-current" />}
          {tab.id === 'buscar' && <NavSearchIcon size={24} className="text-current" />}
          {tab.id === 'perfil' && <NavProfileIcon size={24} className="text-current" />}
        </motion.div>
      </motion.div>
    </button>
  );
});

export const BottomNavigation: React.FC<BottomNavigationProps> = memo(({
  activeTab,
  onChangeTab,
  isBlurred = false,
  forceWhiteUI = false,
  isSatellite = false,
  theme = 'light',
  isTutorialSweepActive = false,
}) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const useWhiteIcons = forceWhiteUI || theme === 'dark';
  const iconColor = useWhiteIcons ? '#FFFFFF' : '#000000';

  const [pulseAnimation, setPulseAnimation] = useState<number>(0);
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [isLensActive, setIsLensActive] = useState<boolean>(false);

  const capsuleRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const isScrubbingRef = useRef<boolean>(false);
  const isTutorialSweepRef = useRef<boolean>(false);
  const lastScrubIndexRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef<boolean>(false);

  const lastScrollTopMapRef = useRef<WeakMap<EventTarget, number>>(new WeakMap());
  const scrollAccumRef = useRef<number>(0);
  const touchAnchorYRef = useRef<number | null>(null);
  const touchLastYRef = useRef<number | null>(null);
  const touchDirectionRef = useRef<'up' | 'down' | null>(null);
  const isTouchInScrollableRef = useRef<boolean>(false);

  // Remapeia 'chat' antigo para 'salvos' caso persista no estado anterior
  const normalizedActiveTab: TabType = (activeTab as string) === 'chat' ? 'salvos' : (activeTab as TabType);
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === normalizedActiveTab));

  // MotionValues driving 60/120fps magnification and Liquid Glass lens position outside React renders
  const pointerSlotMV = useMotionValue<number>(-10);
  const magnifyStrengthMV = useMotionValue<number>(0);
  const pillSlotMV = useMotionValue<number>(activeIndex);
  const pillScaleXMV = useMotionValue<number>(1);
  const pillScaleYMV = useMotionValue<number>(1);
  const pillLiftYMV = useMotionValue<number>(0);

  const smoothPillSlot = useSpring(pillSlotMV, LENS_MOVE_SPRING);
  const pillTranslateX = useTransform(smoothPillSlot, (slot) => `${slot * 100}%`);
  const smoothPillScaleX = useSpring(pillScaleXMV, LENS_SCALE_SPRING);
  const smoothPillScaleY = useSpring(pillScaleYMV, LENS_SCALE_SPRING);
  const smoothPillLiftY = useSpring(pillLiftYMV, LENS_SCALE_SPRING);

  // Keep pill aligned with activeIndex whenever not actively dragging or running tutorial sweep
  useEffect(() => {
    if (!isScrubbingRef.current && !isTutorialSweepRef.current) {
      pillSlotMV.set(activeIndex);
    }
  }, [activeIndex, pillSlotMV]);

  const isCompactRef = useRef<boolean>(false);
  const setCompactSafe = useCallback((next: boolean) => {
    if (isCompactRef.current === next) return;
    isCompactRef.current = next;
    setIsCompact(next);
  }, []);

  // Reset to normal size whenever switching tabs
  useEffect(() => {
    setCompactSafe(false);
    scrollAccumRef.current = 0;
  }, [normalizedActiveTab, setCompactSafe]);

  // Prevent iOS Safari rubber-band / page scrolling while dragging anywhere on the navigation capsule
  useEffect(() => {
    const capsuleEl = capsuleRef.current;
    if (!capsuleEl) return;

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (isScrubbingRef.current && e.cancelable) {
        e.preventDefault();
      }
    };

    capsuleEl.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    return () => {
      capsuleEl.removeEventListener('touchmove', handleNativeTouchMove);
    };
  }, []);

  // Listen to page/container scrolling and vertical touch gestures across all screens
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let scrollRafId = 0;
    let pendingScrollEl: HTMLElement | null = null;

    const isInsideMap = (node: EventTarget | null): boolean => {
      return node instanceof HTMLElement && Boolean(node.closest('.maplibregl-map, #app-map-layer'));
    };

    const isInsideBottomNav = (node: EventTarget | null): boolean => {
      return node instanceof HTMLElement && Boolean(node.closest('#bottom-floating-navigation'));
    };

    const processScroll = () => {
      scrollRafId = 0;
      const el = pendingScrollEl;
      pendingScrollEl = null;
      if (!el || isScrubbingRef.current) return;

      const canScrollY = el.scrollHeight > el.clientHeight + 8;
      if (!canScrollY) return;

      const currentScrollTop = Math.max(0, el.scrollTop);
      const prevScrollTop = lastScrollTopMapRef.current.get(el) ?? currentScrollTop;
      const delta = currentScrollTop - prevScrollTop;
      lastScrollTopMapRef.current.set(el, currentScrollTop);

      if (Math.abs(delta) < 1.5) return;

      if (currentScrollTop <= 14) {
        scrollAccumRef.current = 0;
        setCompactSafe(false);
        return;
      }

      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      const isNearBottomBounce = maxScrollTop > 0 && currentScrollTop >= maxScrollTop - 28;
      if (delta < 0 && isNearBottomBounce && touchDirectionRef.current !== 'down') {
        return;
      }

      if ((delta > 0 && scrollAccumRef.current < 0) || (delta < 0 && scrollAccumRef.current > 0)) {
        scrollAccumRef.current = 0;
      }
      scrollAccumRef.current += delta;

      if (scrollAccumRef.current > 10 && currentScrollTop > 20) {
        setCompactSafe(true);
        scrollAccumRef.current = 0;
      } else if (scrollAccumRef.current < -10) {
        setCompactSafe(false);
        scrollAccumRef.current = 0;
      }
    };

    const handleScrollCapture = (e: Event) => {
      if (isScrubbingRef.current) return;
      const rawTarget = e.target;
      if (!rawTarget) return;

      let el: HTMLElement | null = null;
      if (rawTarget === document || rawTarget === window) {
        el = (document.scrollingElement || document.documentElement) as HTMLElement;
      } else if (rawTarget instanceof HTMLElement) {
        el = rawTarget;
      }
      if (!el) return;

      pendingScrollEl = el;
      if (!scrollRafId) {
        scrollRafId = requestAnimationFrame(processScroll);
      }
    };

    const findScrollableAncestor = (node: EventTarget | null): HTMLElement | null => {
      let curr = node instanceof HTMLElement ? node : null;
      while (curr && curr !== document.body) {
        if (curr.id === 'bottom-floating-navigation') return null;
        if (curr.scrollHeight > curr.clientHeight + 10) {
          const overflowY = window.getComputedStyle(curr).overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll') {
            return curr;
          }
        }
        curr = curr.parentElement;
      }
      return null;
    };

    let isTouchMoveListening = false;

    const detachTouchMove = () => {
      if (!isTouchMoveListening) return;
      isTouchMoveListening = false;
      window.removeEventListener('touchmove', handleTouchMove);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isInsideBottomNav(e.target)) {
        isTouchInScrollableRef.current = false;
        detachTouchMove();
        return;
      }
      if (normalizedActiveTab === 'explorar' && isInsideMap(e.target)) {
        isTouchInScrollableRef.current = false;
        detachTouchMove();
        return;
      }
      const y = e.touches[0].clientY;
      touchAnchorYRef.current = y;
      touchLastYRef.current = y;
      touchDirectionRef.current = null;
      const scrollable = normalizedActiveTab !== 'explorar' ? null : findScrollableAncestor(e.target);
      isTouchInScrollableRef.current = Boolean(scrollable) || normalizedActiveTab !== 'explorar';
      if (isTouchInScrollableRef.current && !isTouchMoveListening) {
        isTouchMoveListening = true;
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (
        isScrubbingRef.current ||
        e.touches.length !== 1 ||
        touchLastYRef.current === null ||
        touchAnchorYRef.current === null ||
        !isTouchInScrollableRef.current
      ) {
        detachTouchMove();
        return;
      }
      const currentY = e.touches[0].clientY;
      const frameDeltaY = currentY - touchLastYRef.current;
      touchLastYRef.current = currentY;

      if (Math.abs(frameDeltaY) > 1.5) {
        const currentDir: 'up' | 'down' = frameDeltaY < 0 ? 'up' : 'down';
        if (touchDirectionRef.current && touchDirectionRef.current !== currentDir) {
          touchAnchorYRef.current = currentY;
        }
        touchDirectionRef.current = currentDir;
      }

      const totalDragFromAnchor = currentY - touchAnchorYRef.current;

      if (totalDragFromAnchor < -16) {
        setCompactSafe(true);
        touchAnchorYRef.current = currentY;
      } else if (totalDragFromAnchor > 16) {
        setCompactSafe(false);
        touchAnchorYRef.current = currentY;
      }
    };

    const handleTouchEnd = () => {
      touchAnchorYRef.current = null;
      touchLastYRef.current = null;
      touchDirectionRef.current = null;
      isTouchInScrollableRef.current = false;
      detachTouchMove();
    };

    const handleWheel = (e: WheelEvent) => {
      if (isScrubbingRef.current) return;
      if (normalizedActiveTab === 'explorar') {
        if (isInsideMap(e.target)) return;
        if (!findScrollableAncestor(e.target)) return;
      }
      if (e.deltaY > 8) {
        setCompactSafe(true);
      } else if (e.deltaY < -8) {
        setCompactSafe(false);
      }
    };

    window.addEventListener('scroll', handleScrollCapture, { capture: true, passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      detachTouchMove();
      window.removeEventListener('scroll', handleScrollCapture, { capture: true });
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [normalizedActiveTab, setCompactSafe]);

  const commitTabSelection = useCallback(
    (tabId: TabType) => {
      if (tabId === 'explorar') {
        setPulseAnimation((prev) => prev + 360);
      }
      // Always trigger onChangeTab so selecting any tab immediately closes
      // all open detail sheets, modals, and switches views seamlessly
      onChangeTab(tabId);
    },
    [onChangeTab]
  );

  // Resolve pointer coordinates relative to the 5-slot navigation track
  const evaluatePointerPosition = useCallback((clientX: number, clientY: number) => {
    const trackEl = trackRef.current;
    if (!trackEl) {
      return { isInside: false, continuousSlot: -10, tabIndex: null as number | null };
    }
    const rect = trackEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { isInside: false, continuousSlot: -10, tabIndex: null as number | null };
    }

    const insideX =
      clientX >= rect.left - HORIZONTAL_VALID_PADDING_PX &&
      clientX <= rect.right + HORIZONTAL_VALID_PADDING_PX;
    const insideY =
      clientY >= rect.top - VERTICAL_VALID_PADDING_PX &&
      clientY <= rect.bottom + VERTICAL_VALID_PADDING_PX;

    if (!insideX || !insideY) {
      return { isInside: false, continuousSlot: -10, tabIndex: null as number | null };
    }

    const clampedRelX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const slotWidth = rect.width / TABS.length;
    const continuousSlot = clampedRelX / slotWidth;
    const tabIndex = Math.max(0, Math.min(TABS.length - 1, Math.floor(continuousSlot)));

    return { isInside: true, continuousSlot, tabIndex };
  }, []);

  const resetLensToRest = useCallback(
    (targetSlotIndex: number) => {
      magnifyStrengthMV.set(0);
      pointerSlotMV.set(-10);
      pillSlotMV.set(targetSlotIndex);
      pillScaleXMV.set(1);
      pillScaleYMV.set(1);
      pillLiftYMV.set(0);
      lastScrubIndexRef.current = null;
      setScrubIndex(null);
      setIsLensActive(false);
    },
    [magnifyStrengthMV, pillLiftYMV, pillScaleXMV, pillScaleYMV, pillSlotMV, pointerSlotMV]
  );

  const applyActiveDockPosition = useCallback(
    (continuousSlot: number, tabIndex: number, silentHaptics: boolean = false) => {
      pointerSlotMV.set(continuousSlot);
      magnifyStrengthMV.set(1);
      // Center the floating Liquid Glass lens directly under the finger, framed cleanly inside the bar
      const clampedLensSlot = Math.max(0, Math.min(TABS.length - 1, continuousSlot - 0.5));
      pillSlotMV.set(clampedLensSlot);
      pillScaleXMV.set(prefersReducedMotion ? 1.06 : 1.18);
      pillScaleYMV.set(prefersReducedMotion ? 1.08 : 1.26);
      pillLiftYMV.set(prefersReducedMotion ? 0 : -1.5);
      setIsLensActive(true);

      if (lastScrubIndexRef.current !== tabIndex) {
        lastScrubIndexRef.current = tabIndex;
        setScrubIndex(tabIndex);
        if (!silentHaptics) {
          triggerDockHaptic(10);
        }
      }
    },
    [magnifyStrengthMV, pillLiftYMV, pillScaleXMV, pillScaleYMV, pillSlotMV, pointerSlotMV, prefersReducedMotion]
  );

  // Choreographed interactive pill demonstration during the 'bottom-nav' tutorial step:
  // Glides the Liquid Glass lens across all 5 icons (center -> left -> right -> center) and settles back cleanly
  useEffect(() => {
    if (!isTutorialSweepActive) {
      if (isTutorialSweepRef.current) {
        isTutorialSweepRef.current = false;
        resetLensToRest(activeIndex);
      }
      return;
    }

    isTutorialSweepRef.current = true;
    setCompactSafe(false);

    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const startSlot = activeIndex + 0.5;
    const minSlot = 0.5;
    const maxSlot = TABS.length - 0.5;

    const phase1Ms = 600; // center -> leftmost (Roteiros)
    const phase2Ms = 1780; // leftmost -> rightmost (Perfil)
    const phase3Ms = 2480; // rightmost -> center (Explorar)

    let rafId: number | null = null;
    let startTime = 0;

    const stepFrame = (now: number) => {
      if (!isTutorialSweepRef.current) return;
      const elapsed = now - startTime;

      let slot = startSlot;
      if (elapsed < phase1Ms) {
        const p = easeInOut(Math.max(0, elapsed / phase1Ms));
        slot = startSlot + (minSlot - startSlot) * p;
      } else if (elapsed < phase2Ms) {
        const p = easeInOut((elapsed - phase1Ms) / (phase2Ms - phase1Ms));
        slot = minSlot + (maxSlot - minSlot) * p;
      } else if (elapsed < phase3Ms) {
        const p = easeInOut((elapsed - phase2Ms) / (phase3Ms - phase2Ms));
        slot = maxSlot + (startSlot - maxSlot) * p;
      } else {
        isTutorialSweepRef.current = false;
        resetLensToRest(activeIndex);
        return;
      }

      const idx = Math.max(0, Math.min(TABS.length - 1, Math.floor(slot)));
      applyActiveDockPosition(slot, idx, true);
      rafId = requestAnimationFrame(stepFrame);
    };

    const kickOffTimer = window.setTimeout(() => {
      if (!isTutorialSweepRef.current) return;
      startTime = performance.now();
      applyActiveDockPosition(startSlot, activeIndex, true);
      rafId = requestAnimationFrame(stepFrame);
    }, 120);

    return () => {
      window.clearTimeout(kickOffTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (isTutorialSweepRef.current) {
        isTutorialSweepRef.current = false;
        resetLensToRest(activeIndex);
      }
    };
  }, [isTutorialSweepActive, activeIndex, applyActiveDockPosition, resetLensToRest, setCompactSafe]);

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isBlurred) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      // Expand the bar immediately if it was compacted during scrolling
      setCompactSafe(false);

      const { isInside, continuousSlot, tabIndex } = evaluatePointerPosition(e.clientX, e.clientY);
      if (!isInside || tabIndex === null) return;

      activePointerIdRef.current = e.pointerId;
      isScrubbingRef.current = true;
      suppressNextClickRef.current = false;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable in synthetic test environments
      }

      applyActiveDockPosition(continuousSlot, tabIndex);
    },
    [applyActiveDockPosition, evaluatePointerPosition, isBlurred, setCompactSafe]
  );

  const handleTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isBlurred) return;

      // Active press-and-drag Dock scrubbing (touch, pen, or mouse drag)
      if (isScrubbingRef.current && activePointerIdRef.current === e.pointerId) {
        const { isInside, continuousSlot, tabIndex } = evaluatePointerPosition(e.clientX, e.clientY);
        if (isInside && tabIndex !== null) {
          applyActiveDockPosition(continuousSlot, tabIndex);
        } else {
          // Finger moved outside valid bar area: deflate smoothly back to current tab without selecting
          magnifyStrengthMV.set(0);
          pointerSlotMV.set(-10);
          pillSlotMV.set(activeIndex);
          pillScaleXMV.set(1);
          pillScaleYMV.set(1);
          pillLiftYMV.set(0);
          if (lastScrubIndexRef.current !== null) {
            lastScrubIndexRef.current = null;
            setScrubIndex(null);
          }
          setIsLensActive(false);
        }
        return;
      }

      // Subtle macOS Dock hover magnification on desktop mouse/trackpad
      if (e.pointerType === 'mouse' && !isScrubbingRef.current) {
        const trackEl = trackRef.current;
        if (!trackEl) return;
        const rect = trackEl.getBoundingClientRect();
        if (rect.width <= 0) return;
        const clampedRelX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        pointerSlotMV.set((clampedRelX / rect.width) * TABS.length);
        magnifyStrengthMV.set(0.45);
      }
    },
    [
      activeIndex,
      applyActiveDockPosition,
      evaluatePointerPosition,
      isBlurred,
      magnifyStrengthMV,
      pillLiftYMV,
      pillScaleXMV,
      pillScaleYMV,
      pillSlotMV,
      pointerSlotMV,
    ]
  );

  const handleTrackPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isScrubbingRef.current || activePointerIdRef.current !== e.pointerId) return;

      isScrubbingRef.current = false;
      activePointerIdRef.current = null;

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore capture release errors
      }

      const { isInside, tabIndex } = evaluatePointerPosition(e.clientX, e.clientY);
      // Prevent duplicate firing from the synthetic button click event right after pointerup
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 60);

      if (isInside && tabIndex !== null) {
        const targetTab = TABS[tabIndex]?.id;
        resetLensToRest(tabIndex);
        if (targetTab) {
          triggerDockHaptic(12);
          commitTabSelection(targetTab);
        }
      } else {
        // Released outside any valid icon: cancel cleanly and keep current page
        resetLensToRest(activeIndex);
      }
    },
    [activeIndex, commitTabSelection, evaluatePointerPosition, resetLensToRest]
  );

  const handleTrackPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerIdRef.current !== e.pointerId && !isScrubbingRef.current) return;
      isScrubbingRef.current = false;
      activePointerIdRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
      resetLensToRest(activeIndex);
    },
    [activeIndex, resetLensToRest]
  );

  const handleTrackPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only clear hover magnification on mouse leave; active drag is tracked via pointer capture
      if (e.pointerType === 'mouse' && !isScrubbingRef.current) {
        magnifyStrengthMV.set(0);
        pointerSlotMV.set(-10);
      }
    },
    [magnifyStrengthMV, pointerSlotMV]
  );

  const handleButtonClick = useCallback(
    (tabId: TabType) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      commitTabSelection(tabId);
    },
    [commitTabSelection]
  );

  return (
    <nav
      id="bottom-floating-navigation"
      aria-label="Navegação Principal"
      data-compact={isCompact ? 'true' : 'false'}
      className={`fixed inset-x-0 bottom-0 z-[250] flex justify-center select-none px-4 pointer-events-none transition-[opacity,transform,filter] duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
        isBlurred
          ? 'opacity-40 scale-[0.98] blur-[6px] [&_*]:!pointer-events-none'
          : 'opacity-100 scale-100 blur-0'
      }`}
      style={{
        touchAction: 'none',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        margin: 0,
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: '12px',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      {/* Capsule with iOS 26 Liquid Glass finish (expo-glass-effect GlassView) */}
      <GlassView
        ref={capsuleRef as React.Ref<HTMLElement>}
        id="bottom-navigation-capsule"
        variant="bar"
        glassEffectStyle="liquid26"
        colorScheme={theme}
        isInteractive
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerCancel}
        onPointerLeave={handleTrackPointerLeave}
        className="w-full max-w-[326px] sm:max-w-[342px] h-[62px] sm:h-[64px] p-[5.5px] pointer-events-auto relative rounded-full motion-reduce:transition-none"
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          transformOrigin: '50% 100%',
          WebkitTransformOrigin: '50% 100%',
          transform: isCompact
            ? 'translate3d(0, 3px, 0) scale3d(0.82, 0.82, 1)'
            : 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
          WebkitTransform: isCompact
            ? 'translate3d(0, 3px, 0) scale3d(0.82, 0.82, 1)'
            : 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
          transition: 'transform 440ms cubic-bezier(0.32, 0.72, 0, 1)',
          WebkitTransition: '-webkit-transform 440ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* Inner 5-slot interactive Dock track */}
        <div
          ref={trackRef}
          className="relative w-full h-full grid grid-cols-5 items-center z-10 select-none"
          style={{
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          {/* Active Selection Capsule / Interactive Magnifying Liquid Glass Lens */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/5 pointer-events-none z-0"
            style={{
              x: pillTranslateX,
              y: smoothPillLiftY,
              scaleX: smoothPillScaleX,
              scaleY: smoothPillScaleY,
              transformOrigin: '50% 50%',
              willChange: 'transform',
            }}
          >
            <GlassView
              variant="pill"
              glassEffectStyle="liquid26"
              colorScheme={theme}
              data-lens-active={isLensActive ? 'true' : 'false'}
              className="w-full h-full rounded-full transition-[background,box-shadow,border-color,backdrop-filter] duration-[200ms] ease-out"
            />
          </motion.div>

          {TABS.map((tab, index) => {
            const isActive = normalizedActiveTab === tab.id;
            const isHighlighted = scrubIndex === index;

            return (
              <DockTabButton
                key={tab.id}
                tab={tab}
                index={index}
                isActive={isActive}
                isHighlighted={isHighlighted}
                isScrubbing={scrubIndex !== null}
                pulseAnimation={pulseAnimation}
                iconColor={iconColor}
                isSatellite={isSatellite}
                useWhiteIcons={useWhiteIcons}
                theme={theme}
                prefersReducedMotion={prefersReducedMotion}
                pointerSlotMV={pointerSlotMV}
                magnifyStrengthMV={magnifyStrengthMV}
                onButtonClick={handleButtonClick}
              />
            );
          })}
        </div>
      </GlassView>
    </nav>
  );
});
