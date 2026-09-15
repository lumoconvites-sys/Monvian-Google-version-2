import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronUp, Sparkles, ArrowRight } from 'lucide-react';
import { BarCompassIcon } from './BarCompassIcon';
import { ProfileIcon } from './ProfileIcon';
import { motion } from 'motion/react';
import { Spot } from '../types';
import { playPinTapSound } from '../utils/sound';

export type TabType = 'explorar' | 'chat' | 'buscar' | 'perfil';

export interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  isSuggestionsOpen?: boolean;
  onToggleSuggestions?: () => void;
  suggestionSpot?: Spot | null;
  popularCategoryLabel?: string;
  onSelectSpot?: (spot: Spot) => void;
  showSuggestionsChevron?: boolean;
}

/**
 * Apple iOS standard rubber-band resistance function.
 * Accurately models UIScrollView / iOS Sheet elasticity when dragging past boundaries.
 */
function appleRubberBand(distance: number, dimension: number = 220, constant: number = 0.55): number {
  return (distance * dimension * constant) / (dimension + constant * distance);
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 2,
  isSuggestionsOpen = false,
  onToggleSuggestions,
  suggestionSpot,
  popularCategoryLabel = 'Mais Populares',
  onSelectSpot,
  showSuggestionsChevron = true,
}) => {
  const [compassRotation, setCompassRotation] = useState<number>(0);

  // DOM Refs for high-performance direct animation updates (120Hz native iOS fluidity)
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardWrapperRef = useRef<HTMLDivElement | null>(null);
  const cardInnerRef = useRef<HTMLDivElement | null>(null);
  const chevronRef = useRef<SVGSVGElement | null>(null);
  const grabberRef = useRef<HTMLDivElement | null>(null);

  // Gesture state tracking
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const currentHeightRef = useRef(isSuggestionsOpen ? 122 : 0);
  const currentElasticYRef = useRef(0);
  const measuredHeightRef = useRef(122);
  const animFrameIdRef = useRef<number | null>(null);

  // Drag coordinates & velocity tracker
  const gestureRef = useRef<{
    startY: number;
    lastY: number;
    lastTime: number;
    initialHeight: number;
    velocity: number;
    hasMoved: boolean;
    activePointerId: number | null;
  }>({
    startY: 0,
    lastY: 0,
    lastTime: 0,
    initialHeight: 0,
    velocity: 0,
    hasMoved: false,
    activePointerId: null,
  });

  // Track if a gesture was a drag to prevent accidental tab clicks
  const didDragRef = useRef(false);

  // Measure card height accurately on mount and resize
  const measureCardHeight = useCallback(() => {
    if (cardInnerRef.current) {
      const h = cardInnerRef.current.offsetHeight;
      if (h > 40) {
        measuredHeightRef.current = h;
        return h;
      }
    }
    return measuredHeightRef.current;
  }, []);

  useEffect(() => {
    measureCardHeight();
  }, [measureCardHeight, suggestionSpot]);

  // Synchronize visual DOM elements without causing React re-renders during active gestures
  const applyDOMStyles = useCallback((height: number, elasticY: number) => {
    currentHeightRef.current = height;
    currentElasticYRef.current = elasticY;

    const maxH = measuredHeightRef.current || 122;
    const progress = Math.max(0, Math.min(1, height / maxH));

    // Elastic container translation (rubber band overshoot effect)
    if (containerRef.current) {
      containerRef.current.style.transform = `translate3d(0, ${elasticY.toFixed(2)}px, 0)`;
    }

    // Card height wrapper
    if (cardWrapperRef.current) {
      cardWrapperRef.current.style.height = `${Math.max(0, height).toFixed(1)}px`;
    }

    // Card inner parallax + opacity fade
    if (cardInnerRef.current) {
      const innerTranslate = (1 - progress) * 14;
      cardInnerRef.current.style.opacity = `${progress.toFixed(3)}`;
      cardInnerRef.current.style.transform = `translate3d(0, ${innerTranslate.toFixed(2)}px, 0)`;
      cardInnerRef.current.style.pointerEvents = progress > 0.6 ? 'auto' : 'none';
    }

    // Chevron rotation: 0deg (pointing UP when collapsed) -> 180deg (pointing DOWN when expanded)
    if (chevronRef.current) {
      const rot = progress * 180;
      chevronRef.current.style.transform = `rotate(${rot.toFixed(1)}deg)`;
    }

    // Grabber active appearance
    if (grabberRef.current) {
      if (isDraggingRef.current) {
        grabberRef.current.style.transform = 'scaleX(1.15)';
      } else {
        grabberRef.current.style.transform = 'scaleX(1)';
      }
    }
  }, []);

  /**
   * Damped harmonic spring simulation modeled after Apple's UISpringTimingParameters / SwiftUI.
   * Stiffness = 420, Damping = 32 -> Ultra crisp, snappy settling with 0% sluggishness.
   */
  const animateSpring = useCallback(
    (
      fromHeight: number,
      toHeight: number,
      fromElasticY: number,
      initialVelocity: number,
      onComplete?: () => void
    ) => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }

      let h = fromHeight;
      let vH = -initialVelocity; // Negative clientY velocity means moving UP (increasing height)
      let eY = fromElasticY;
      let vEY = 0;

      let lastTime = performance.now();
      const stiffness = 420;
      const damping = 32;

      function step(now: number) {
        const dt = Math.min(0.032, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        // Spring calculation for height
        const forceH = -stiffness * (h - toHeight) - damping * vH;
        vH += forceH * dt;
        h += vH * dt;

        // Spring calculation for elastic return to 0
        const forceEY = -stiffness * (eY - 0) - damping * vEY;
        vEY += forceEY * dt;
        eY += vEY * dt;

        const isHeightDone = Math.abs(h - toHeight) < 0.25 && Math.abs(vH) < 8;
        const isElasticDone = Math.abs(eY) < 0.25 && Math.abs(vEY) < 8;

        if (isHeightDone && isElasticDone) {
          applyDOMStyles(toHeight, 0);
          animFrameIdRef.current = null;
          onComplete?.();
          return;
        }

        applyDOMStyles(h, eY);
        animFrameIdRef.current = requestAnimationFrame(step);
      }

      animFrameIdRef.current = requestAnimationFrame(step);
    },
    [applyDOMStyles]
  );

  // Sync state when external prop `isSuggestionsOpen` changes and not actively dragging
  useEffect(() => {
    if (isDraggingRef.current) return;
    const target = isSuggestionsOpen ? measureCardHeight() : 0;
    if (Math.abs(currentHeightRef.current - target) > 1) {
      animateSpring(currentHeightRef.current, target, currentElasticYRef.current, 0);
    }
  }, [isSuggestionsOpen, measureCardHeight, animateSpring]);

  // Cleanup ongoing animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  /**
   * Finish drag gesture and snap to closest / velocity-directed state.
   */
  const handleSnap = useCallback(
    (velocity: number) => {
      const maxH = measuredHeightRef.current || 122;
      const currentH = currentHeightRef.current;
      const currentEY = currentElasticYRef.current;

      // Determine snap destination based on velocity flick or position threshold
      let targetH = 0;
      let shouldBeOpen = false;

      // Fast flick upwards (negative clientY velocity)
      if (velocity < -0.28) {
        targetH = maxH;
        shouldBeOpen = true;
      }
      // Fast flick downwards (positive clientY velocity)
      else if (velocity > 0.28) {
        targetH = 0;
        shouldBeOpen = false;
      }
      // Positional threshold (iOS snap point: 42% of expanded height)
      else if (currentH > maxH * 0.42) {
        targetH = maxH;
        shouldBeOpen = true;
      } else {
        targetH = 0;
        shouldBeOpen = false;
      }

      // Haptic and audio feedback
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(6);
        } catch (_) {}
      }
      playPinTapSound(0.35);

      // Run iOS spring
      animateSpring(currentH, targetH, currentEY, velocity, () => {
        if (shouldBeOpen !== isSuggestionsOpen) {
          onToggleSuggestions?.();
        }
      });
    },
    [isSuggestionsOpen, onToggleSuggestions, animateSpring]
  );

  /**
   * Pointer down handler on drag triggers (Handle tab, Suggestions Card, or Navigation Bar).
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!showSuggestionsChevron) return;

    // Ignore secondary mouse clicks
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Stop any in-flight spring animation for instant 1:1 finger latch
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    measureCardHeight();

    gestureRef.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: performance.now(),
      initialHeight: currentHeightRef.current,
      velocity: 0,
      hasMoved: false,
      activePointerId: e.pointerId,
    };

    didDragRef.current = false;
    isDraggingRef.current = true;
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  /**
   * Pointer move handler tracking finger position continuously in real-time.
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isDraggingRef.current || gestureRef.current.activePointerId !== e.pointerId) return;

    const g = gestureRef.current;
    const deltaY = e.clientY - g.startY; // Dragging UP is negative deltaY

    if (Math.abs(deltaY) > 5) {
      g.hasMoved = true;
      didDragRef.current = true;
    }

    // Velocity tracking over time windows
    const now = performance.now();
    const dt = now - g.lastTime;
    if (dt > 8) {
      g.velocity = (e.clientY - g.lastY) / dt;
      g.lastY = e.clientY;
      g.lastTime = now;
    }

    const maxH = measuredHeightRef.current || 122;
    // Upward drag (-deltaY) increases height
    const rawHeight = g.initialHeight - deltaY;

    let nextH = rawHeight;
    let nextElasticY = 0;

    // Rubber-band resistance past maximum expanded height
    if (rawHeight > maxH) {
      nextH = maxH;
      const overshoot = rawHeight - maxH;
      nextElasticY = -appleRubberBand(overshoot, 220, 0.45);
    }
    // Rubber-band resistance past collapsed bottom
    else if (rawHeight < 0) {
      nextH = 0;
      const overshoot = -rawHeight;
      nextElasticY = appleRubberBand(overshoot, 220, 0.45);
    } else {
      nextH = rawHeight;
      nextElasticY = 0;
    }

    applyDOMStyles(nextH, nextElasticY);
  };

  /**
   * Pointer up/cancel handler that releases drag and snaps to resting position.
   */
  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!isDraggingRef.current || gestureRef.current.activePointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    const g = gestureRef.current;
    isDraggingRef.current = false;
    setIsDragging(false);

    // If it was just a clean tap without movement, toggle state
    if (!g.hasMoved) {
      const maxH = measuredHeightRef.current || 122;
      const target = isSuggestionsOpen ? 0 : maxH;

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(6);
        } catch (_) {}
      }
      playPinTapSound(0.35);

      animateSpring(currentHeightRef.current, target, 0, 0, () => {
        onToggleSuggestions?.();
      });
      return;
    }

    // User performed a drag: calculate snap point
    handleSnap(g.velocity);
  };

  const tabs: { id: TabType; label: string; icon?: any; isAvatar?: boolean }[] = [
    { id: 'explorar', label: 'Explorar' },
    { id: 'chat', label: 'Chat', isAvatar: true },
    { id: 'buscar', label: 'Buscar', icon: Search },
    { id: 'perfil', label: 'Perfil' },
  ];

  const handleTabClick = (tabId: TabType) => {
    // If the user was dragging the bottom sheet, do not trigger tab click
    if (didDragRef.current) {
      return;
    }
    if (tabId === 'explorar') {
      setCompassRotation((prev) => prev + 360);
    }
    onChangeTab(tabId);
  };

  return (
    <nav
      id="bottom-floating-navigation"
      aria-label="Navegação Principal"
      className="fixed left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm pointer-events-auto select-none flex flex-col items-center will-change-transform"
      style={{
        bottom: '0px',
        touchAction: 'none',
      }}
    >
      {/* Dynamic Native Sheet Container */}
      <div
        ref={containerRef}
        className="w-full flex flex-col items-center will-change-transform"
        style={{ transform: 'translate3d(0, 0px, 0)' }}
      >
        {/* iOS Native Minimalist Handle / Grabber Tab */}
        {showSuggestionsChevron && (
          <div
            id="btn-sheet-ios-grabber"
            role="button"
            tabIndex={0}
            aria-label={isSuggestionsOpen ? 'Recolher painel de sugestões' : 'Expandir painel de sugestões'}
            title="Arraste para cima ou toque para expandir"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`group flex flex-col items-center justify-center -mb-px z-20 cursor-grab active:cursor-grabbing select-none transition-colors ${
              isDragging ? 'cursor-grabbing' : ''
            }`}
            style={{ touchAction: 'none' }}
          >
            <div className="h-5 px-4.5 pt-1 rounded-t-xl bg-white/95 dark:bg-[#141518]/95 backdrop-blur-2xl border-t border-x border-zinc-200/80 dark:border-white/15 flex flex-col items-center justify-center gap-0.5 shadow-xs transition-colors group-hover:bg-zinc-50 dark:group-hover:bg-[#1a1c21]">
              {/* Minimalist iOS Handle Pill */}
              <div
                ref={grabberRef}
                className="w-8.5 h-1 rounded-full bg-zinc-300/90 dark:bg-zinc-600/90 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-400 transition-all origin-center"
              />
              {/* Responsive indicator arrow that accompanies panel expansion */}
              <ChevronUp
                ref={chevronRef}
                className="w-3 h-3 text-zinc-400 dark:text-zinc-400 stroke-[2.5] transition-colors"
                style={{
                  transform: isSuggestionsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transformOrigin: 'center center',
                }}
              />
            </div>
          </div>
        )}

        {/* Expandable Suggestions Sheet Card */}
        {showSuggestionsChevron && (
          <div
            ref={cardWrapperRef}
            className="w-full overflow-hidden flex flex-col items-center mb-[-1px] z-10 will-change-[height]"
            style={{
              height: isSuggestionsOpen ? 'auto' : '0px',
              touchAction: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              ref={cardInnerRef}
              className="w-full rounded-t-[26px] rounded-b-[18px] bg-white/95 dark:bg-[#141518]/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/15 p-3 sm:p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8)] will-change-[transform,opacity]"
              style={{
                opacity: isSuggestionsOpen ? 1 : 0,
                transform: isSuggestionsOpen ? 'translate3d(0, 0px, 0)' : 'translate3d(0, 14px, 0)',
                pointerEvents: isSuggestionsOpen ? 'auto' : 'none',
              }}
            >
              {suggestionSpot ? (
                <>
                  {/* Header: Dica do Dia & Categoria em alta */}
                  <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5 text-[#00C896]" />
                      <span>Dica do Dia</span>
                    </div>
                    <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 truncate max-w-[170px]">
                      Em alta: <strong className="text-zinc-700 dark:text-zinc-200 font-black">{popularCategoryLabel}</strong>
                    </div>
                  </div>

                  {/* Essential Card Body */}
                  <div className="flex items-center gap-3">
                    {/* Spot Thumbnail */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpot?.(suggestionSpot);
                      }}
                      className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-white/10 shadow-xs cursor-pointer active:scale-95 transition-transform"
                    >
                      <img
                        src={suggestionSpot.image}
                        alt={suggestionSpot.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=200&q=80';
                        }}
                      />
                    </div>

                    {/* Spot Details */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpot?.(suggestionSpot);
                      }}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <h4 className="text-sm sm:text-[15px] font-black text-zinc-900 dark:text-white truncate leading-tight">
                        {suggestionSpot.name}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mt-0.5 truncate">
                        ★ {suggestionSpot.rating} · {suggestionSpot.categoryLabel || suggestionSpot.category}
                      </p>
                    </div>

                    {/* Green Ver Local Button */}
                    <button
                      type="button"
                      id="btn-suggestion-ver-local"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpot?.(suggestionSpot);
                      }}
                      className="px-3.5 py-2 rounded-full bg-[#00C896] hover:bg-[#00b285] active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shrink-0 transition-transform cursor-pointer shadow-sm"
                    >
                      <span>Ver Local</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-2 text-center text-xs text-zinc-500 font-black">
                  Nenhuma sugestão disponível no momento
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Bottom Navigation Bar Pill */}
        <div
          className="w-full flex items-center justify-around py-2 px-2.5 rounded-[36px] bg-white/90 dark:bg-[#141518]/90 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8)] relative cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                id={`nav-btn-${tab.id}`}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className="relative flex flex-col items-center justify-center gap-1 py-1.5 px-3.5 rounded-full cursor-pointer z-10 select-none active:scale-95 transition-transform"
              >
                {/* Active pill background without animated transition */}
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-zinc-100 dark:bg-white/10 ring-1 ring-zinc-200 dark:ring-white/20 -z-10 shadow-xs" />
                )}

                {tab.isAvatar ? (
                  <div className="relative">
                    <div
                      className={`w-7 h-7 rounded-full overflow-hidden border ${
                        isActive
                          ? 'border-[#00C896] ring-2 ring-[#00C896]/40 shadow-xs'
                          : 'border-zinc-300 dark:border-white/30 opacity-75'
                      }`}
                    >
                      <img
                        src="/guide_avatar.jpg"
                        alt="Chat Guia IA"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#00C896] rounded-full ring-2 ring-white dark:ring-[#141518]" />
                    )}
                  </div>
                ) : tab.id === 'explorar' ? (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isActive ? 'opacity-100 scale-100' : 'opacity-70 hover:opacity-100 scale-95'
                    }`}
                  >
                    <motion.div
                      animate={{ rotate: compassRotation }}
                      transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                      className="w-5.5 h-5.5 flex items-center justify-center"
                    >
                      <BarCompassIcon size={22} className="w-full h-full" />
                    </motion.div>
                  </div>
                ) : tab.id === 'perfil' ? (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-400'
                    }`}
                  >
                    <ProfileIcon size={20} className="w-5 h-5 text-current" />
                  </div>
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-400'
                    }`}
                  >
                    {Icon && <Icon className="w-5 h-5 stroke-[2.2]" />}
                  </div>
                )}

                <span
                  className={`text-[11px] tracking-tight ${
                    isActive
                      ? 'font-black text-zinc-900 dark:text-white'
                      : 'font-black text-zinc-400 dark:text-zinc-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};


