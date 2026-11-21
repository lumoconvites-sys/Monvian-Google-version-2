import React, { useState, useRef, useEffect, memo } from 'react';
import { motion } from 'motion/react';
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
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'roteiros', label: 'Roteiros' },
  { id: 'salvos', label: 'Salvos' },
  { id: 'explorar', label: 'Explorar' },
  { id: 'buscar', label: 'Buscar' },
  { id: 'perfil', label: 'Perfil' },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = memo(({
  activeTab,
  onChangeTab,
  isBlurred = false,
  forceWhiteUI = false,
  isSatellite = false,
  theme = 'light',
}) => {
  const useWhiteIcons = !isSatellite && (forceWhiteUI || theme === 'dark');
  const iconColor = isSatellite
    ? theme === 'dark'
      ? '#C0C0C6'
      : '#858585'
    : useWhiteIcons
      ? '#FFFFFF'
      : '#000000';
  const [pulseAnimation, setPulseAnimation] = useState<number>(0);
  const [isCompact, setIsCompact] = useState<boolean>(false);

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartTimeRef = useRef<number>(0);
  const lastScrollTopMapRef = useRef<WeakMap<EventTarget, number>>(new WeakMap());
  const scrollAccumRef = useRef<number>(0);
  const touchAnchorYRef = useRef<number | null>(null);
  const touchLastYRef = useRef<number | null>(null);
  const touchDirectionRef = useRef<'up' | 'down' | null>(null);
  const isTouchInScrollableRef = useRef<boolean>(false);

  // Remapeia 'chat' antigo para 'salvos' caso persista no estado anterior
  const normalizedActiveTab: TabType = (activeTab as string) === 'chat' ? 'salvos' : (activeTab as TabType);
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === normalizedActiveTab));

  const isCompactRef = useRef<boolean>(false);
  const setCompactSafe = (next: boolean) => {
    if (isCompactRef.current === next) return;
    isCompactRef.current = next;
    setIsCompact(next);
  };

  // Reset to normal size whenever switching tabs
  useEffect(() => {
    setCompactSafe(false);
    scrollAccumRef.current = 0;
  }, [normalizedActiveTab]);

  // Listen to page/container scrolling and vertical touch gestures across all screens
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let scrollRafId = 0;
    let pendingScrollEl: HTMLElement | null = null;

    const isInsideMap = (node: EventTarget | null): boolean => {
      return node instanceof HTMLElement && Boolean(node.closest('.maplibregl-map, #app-map-layer'));
    };

    const processScroll = () => {
      scrollRafId = 0;
      const el = pendingScrollEl;
      pendingScrollEl = null;
      if (!el) return;

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
      if (e.touches.length !== 1) {
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
  }, [normalizedActiveTab]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartTimeRef.current = performance.now();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownPosRef.current || e.pointerType === 'mouse') return;
    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
    const dt = performance.now() - dragStartTimeRef.current;
    pointerDownPosRef.current = null;

    // Fast horizontal swipe gesture across the bar
    if (Math.abs(dx) > 42 && dy < 36 && dt < 450) {
      const targetIndex = dx > 0
        ? Math.min(TABS.length - 1, activeIndex + 1)
        : Math.max(0, activeIndex - 1);
      const targetTab = TABS[targetIndex]?.id;
      if (targetTab && targetTab !== normalizedActiveTab) {
        if (targetTab === 'explorar') {
          setPulseAnimation((prev) => prev + 360);
        }
        onChangeTab(targetTab);
      }
    }
  };

  const handleTabClick = (tabId: TabType) => {
    if (tabId === 'explorar') {
      setPulseAnimation((prev) => prev + 360);
    }
    // Always trigger onChangeTab so clicking any tab immediately closes
    // all open detail sheets, modals, and switches views seamlessly
    onChangeTab(tabId);
  };

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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerDownPosRef.current = null; }}
      style={{
        touchAction: 'manipulation',
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
      {/* Capsule with iOS 26 Liquid Glass finish — GPU-accelerated smooth iOS spring transition when shrinking and expanding */}
      <GlassView
        id="bottom-navigation-capsule"
        variant="bar"
        glassEffectStyle="liquid26"
        isInteractive
        className="w-full max-w-[326px] sm:max-w-[342px] h-[62px] sm:h-[64px] p-[5.5px] pointer-events-auto relative rounded-full motion-reduce:transition-none"
        style={{
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
        {/* Inner track with 5 uniform slots and hardware-accelerated sliding selection capsule */}
        <div className="relative w-full h-full grid grid-cols-5 items-center z-10">
          {/* Active Option Selection Capsule */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/5 pointer-events-none z-0 transition-transform duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
            style={{
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
              WebkitTransform: `translate3d(${activeIndex * 100}%, 0, 0)`,
              willChange: 'transform',
            }}
          >
            <GlassView
              variant="pill"
              glassEffectStyle="liquid26"
              className="w-full h-full rounded-full"
            />
          </div>

          {TABS.map((tab) => {
            const isActive = normalizedActiveTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`nav-btn-${tab.id}`}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative z-10 w-full h-full rounded-full flex items-center justify-center cursor-pointer select-none active:scale-[0.94] transition-[transform,color,opacity] duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 ${
                  isSatellite
                    ? theme === 'dark'
                      ? 'text-[#C0C0C6] focus-visible:ring-white/30'
                      : 'text-[#858585] focus-visible:ring-black/20'
                    : useWhiteIcons
                      ? 'text-[#FFFFFF] focus-visible:ring-white/30'
                      : 'text-[#000000] focus-visible:ring-black/25'
                } ${
                  isActive ? 'opacity-100' : 'opacity-85 hover:opacity-100'
                }`}
                style={{
                  color: iconColor,
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
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
              </button>
            );
          })}
        </div>
      </GlassView>
    </nav>
  );
});




