import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

import cloche3dImg from '../assets/images/cat_3d_cloche_nobg.png';
import hotelBed3dImg from '../assets/images/cat_3d_hotel_bed_nobg.png';
import mountains3dImg from '../assets/images/cat_3d_mountains_nobg.png';
import ferrisWheel3dImg from '../assets/images/cat_3d_ferris_wheel_nobg.png';
import coffeeCup3dImg from '../assets/images/cat_3d_coffee_cup_nobg.png';
import shoppingBag3dImg from '../assets/images/cat_3d_shopping_bag_nobg.png';
import giftBox3dImg from '../assets/images/cat_3d_gift_box_nobg.png';

export interface TouristCategory3D {
  id: string;
  label: string;
  image: string;
  alt: string;
  objectScale?: string;
}

const CATEGORIES_3D: readonly TouristCategory3D[] = [
  {
    id: 'restaurantes',
    label: 'Restaurantes',
    image: cloche3dImg,
    alt: 'Restaurantes — cloche metálica 3D',
    objectScale: 'scale-[1.04]',
  },
  {
    id: 'passeios',
    label: 'Passeios',
    image: mountains3dImg,
    alt: 'Passeios — montanhas com árvores e paisagem 3D',
    objectScale: 'scale-[1.06]',
  },
  {
    id: 'cafes',
    label: 'Cafés',
    image: coffeeCup3dImg,
    alt: 'Cafés — xícara de café 3D',
    objectScale: 'scale-[1.02]',
  },
  {
    id: 'compras',
    label: 'Compras',
    image: shoppingBag3dImg,
    alt: 'Compras — sacola sofisticada 3D',
    objectScale: 'scale-[0.98]',
  },
  {
    id: 'experiencias',
    label: 'Experiências',
    image: giftBox3dImg,
    alt: 'Experiências — presente sofisticado 3D',
    objectScale: 'scale-[0.98]',
  },
  {
    id: 'atracoes',
    label: 'Atrações',
    image: ferrisWheel3dImg,
    alt: 'Atrações — roda-gigante 3D',
    objectScale: 'scale-[1.04]',
  },
  {
    id: 'hoteis',
    label: 'Hotéis',
    image: hotelBed3dImg,
    alt: 'Hotéis — cama em miniatura 3D',
    objectScale: 'scale-[1.04]',
  },
];

const CARD_COUNT = CATEGORIES_3D.length;
const STEP_DURATION_MS = 3400;
const CYCLE_DURATION_MS = CARD_COUNT * STEP_DURATION_MS;
const SAMPLE_STEPS = 70; // 10 evenly spaced samples per card transition

const getSlotUnitForWidth = (w: number): number => {
  if (w < 430) return 126;
  if (w < 640) return 140;
  return 160;
};

const computeCardGeometry = (d: number, slotUnit: number) => {
  const absD = Math.abs(d);
  const sign = d < 0 ? -1 : 1;
  const linearStep = absD <= 1 ? absD : 1 + (absD - 1) * 0.78;
  const translateX = sign * slotUnit * linearStep;
  const gaussian = Math.exp(-0.56 * absD * absD);
  const scale = 0.57 + 0.43 * gaussian;
  const translateY = (1 - gaussian) * 7;
  // Smoothly fade completely out before reaching the ±3.5 wraparound seam
  const opacity = absD >= 2.55 ? 0 : absD > 1.95 ? Math.max(0, 1 - (absD - 1.95) / 0.6) : 1;
  return { translateX, translateY, scale, opacity, absD };
};

const wrapDiff = (rawDiff: number): number => {
  let d = ((rawDiff % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
  if (d > CARD_COUNT / 2) d -= CARD_COUNT;
  return d;
};

const posToCycleMs = (pos: number): number => {
  // Inverted direction: as cycle time increases, pos decreases (left-to-right movement)
  const wrappedNeg = (((-pos) % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
  return wrappedNeg * STEP_DURATION_MS;
};

const cycleMsToPos = (ms: number): number => {
  const wrappedMs = ((ms % CYCLE_DURATION_MS) + CYCLE_DURATION_MS) % CYCLE_DURATION_MS;
  return -(wrappedMs / STEP_DURATION_MS);
};

export const Category3DLiquidGlassCarousel: React.FC<{ theme?: 'dark' | 'light' }> = memo(
  function Category3DLiquidGlassCarousel({ theme = 'light' }) {
    const isDark = theme === 'dark';
    const { tr } = useLanguage();
    const prefersReducedMotion = Boolean(useReducedMotion());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const animsRef = useRef<(Animation | null)[]>([]);

  const posRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const activeIndexRef = useRef<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const springRafRef = useRef<number>(0);
  const resumeTimerRef = useRef<number | null>(null);
  const crossoverTimerRef = useRef<number | null>(null);
  const isManualControlRef = useRef<boolean>(false);

  const pointerStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    velocityCardsPerSec: number;
    mode: 'undecided' | 'horizontal' | 'vertical';
    totalAbsDx: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    velocityCardsPerSec: 0,
    mode: 'undecided',
    totalAbsDx: 0,
  });

  // Pre-decode all 7 3D studio images on mount so zero frame drops occur
  useEffect(() => {
    CATEGORIES_3D.forEach((cat) => {
      try {
        const img = new Image();
        img.src = cat.image;
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {});
        }
      } catch {}
    });
  }, []);

  const syncZIndexAndDot = useCallback((pos: number) => {
    for (let i = 0; i < CARD_COUNT; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      const d = wrapDiff(i - pos);
      const absD = Math.abs(d);
      const nextZ = String(Math.round((4.0 - absD) * 100));
      if (card.style.zIndex !== nextZ) {
        card.style.zIndex = nextZ;
      }
      const nextPointer = absD < 2.25 ? 'auto' : 'none';
      if (card.style.pointerEvents !== nextPointer) {
        card.style.pointerEvents = nextPointer;
      }
    }

    const nearest = ((Math.round(pos) % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
    if (nearest !== activeIndexRef.current) {
      activeIndexRef.current = nearest;
      setActiveIndex(nearest);
    }
  }, []);

  const getCurrentLivePos = useCallback((): number => {
    const firstAnim = animsRef.current[0];
    if (firstAnim && firstAnim.currentTime !== null && firstAnim.currentTime !== undefined) {
      const t = Number(firstAnim.currentTime);
      if (Number.isFinite(t)) {
        return cycleMsToPos(t);
      }
    }
    return posRef.current;
  }, []);

  const seekAnimationsToPos = useCallback(
    (pos: number) => {
      posRef.current = pos;
      const cycleMs = posToCycleMs(pos);
      for (let i = 0; i < CARD_COUNT; i++) {
        const anim = animsRef.current[i];
        if (anim) {
          anim.currentTime = cycleMs;
        }
      }
      syncZIndexAndDot(pos);
    },
    [syncZIndexAndDot]
  );

  // Schedule exact lightweight crossover updates ONLY at card boundaries (every ~3.4s)
  // so zero per-frame JS work executes during GPU 120fps playback
  const scheduleNextCrossover = useCallback(() => {
    if (crossoverTimerRef.current !== null) {
      window.clearTimeout(crossoverTimerRef.current);
      crossoverTimerRef.current = null;
    }
    if (prefersReducedMotion || isManualControlRef.current || !isVisibleRef.current) return;

    const livePos = getCurrentLivePos();
    syncZIndexAndDot(livePos);

    // Since pos decreases continuously over time (-1 card per STEP_DURATION_MS),
    // compute exact time until livePos crosses the next (k - 0.5) boundary
    const fracDown = ((livePos - Math.floor(livePos)) + 1) % 1;
    let distToHalf = fracDown > 0.5 ? fracDown - 0.5 : fracDown + 0.5;
    if (distToHalf <= 0.003) distToHalf = 1.0;
    const msUntilBoundary = Math.max(40, Math.round(distToHalf * STEP_DURATION_MS) + 14);

    crossoverTimerRef.current = window.setTimeout(() => {
      scheduleNextCrossover();
    }, msUntilBoundary);
  }, [getCurrentLivePos, prefersReducedMotion, syncZIndexAndDot]);

  const buildAndStartAnimations = useCallback(
    (preserveCurrentPos: boolean = true) => {
      const slotUnit = getSlotUnitForWidth(
        typeof window !== 'undefined' ? window.innerWidth : 390
      );
      const initialPos = preserveCurrentPos ? getCurrentLivePos() : posRef.current;
      const startCycleMs = posToCycleMs(initialPos);

      animsRef.current.forEach((a) => a?.cancel());
      animsRef.current = new Array(CARD_COUNT).fill(null);

      for (let i = 0; i < CARD_COUNT; i++) {
        const card = cardRefs.current[i];
        if (!card || typeof card.animate !== 'function') continue;

        const keyframes: Keyframe[] = [];
        let prevDiff: number | null = null;

        for (let s = 0; s <= SAMPLE_STEPS; s++) {
          const offset = s / SAMPLE_STEPS;
          // Inverted direction: pos goes 0 -> -CARD_COUNT across 1 cycle (gliding left-to-right)
          const posAtOffset = -offset * CARD_COUNT;
          const d = wrapDiff(i - posAtOffset);

          // If wrapping across the invisible ±3.5 seam, insert a zero-opacity jump boundary
          if (prevDiff !== null && Math.abs(d - prevDiff) > CARD_COUNT * 0.5) {
            const boundaryOffset = Math.max(0.0001, offset - 0.0002);
            const gPrev = computeCardGeometry(prevDiff < 0 ? -3.5 : 3.5, slotUnit);
            const gNext = computeCardGeometry(d < 0 ? -3.5 : 3.5, slotUnit);
            keyframes.push({
              offset: boundaryOffset,
              transform: `translate3d(calc(-50% + ${gPrev.translateX.toFixed(2)}px), ${gPrev.translateY.toFixed(2)}px, 0) scale(${gPrev.scale.toFixed(4)})`,
              opacity: 0,
            });
            keyframes.push({
              offset: Math.min(0.9999, boundaryOffset + 0.0001),
              transform: `translate3d(calc(-50% + ${gNext.translateX.toFixed(2)}px), ${gNext.translateY.toFixed(2)}px, 0) scale(${gNext.scale.toFixed(4)})`,
              opacity: 0,
            });
          }

          const g = computeCardGeometry(d, slotUnit);
          keyframes.push({
            offset,
            transform: `translate3d(calc(-50% + ${g.translateX.toFixed(2)}px), ${g.translateY.toFixed(2)}px, 0) scale(${g.scale.toFixed(4)})`,
            opacity: g.opacity,
          });
          prevDiff = d;
        }

        const anim = card.animate(keyframes, {
          duration: CYCLE_DURATION_MS,
          iterations: Infinity,
          easing: 'linear',
          fill: 'both',
        });

        anim.currentTime = startCycleMs;
        if (prefersReducedMotion || !isVisibleRef.current || isManualControlRef.current) {
          anim.pause();
        }
        animsRef.current[i] = anim;
      }

      syncZIndexAndDot(initialPos);
      scheduleNextCrossover();
    },
    [getCurrentLivePos, prefersReducedMotion, scheduleNextCrossover, syncZIndexAndDot]
  );

  // Initialize GPU-composited animations + responsive resize rebuild
  useEffect(() => {
    buildAndStartAnimations(false);

    let resizeTimer: number | null = null;
    const handleResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        buildAndStartAnimations(true);
      }, 120);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          isVisibleRef.current = entry.isIntersecting;
          if (prefersReducedMotion || isManualControlRef.current) return;

          animsRef.current.forEach((anim) => {
            if (!anim) return;
            if (entry.isIntersecting) {
              if (anim.playState === 'paused') anim.play();
            } else {
              if (anim.playState === 'running') anim.pause();
            }
          });

          if (entry.isIntersecting) {
            scheduleNextCrossover();
          } else if (crossoverTimerRef.current !== null) {
            window.clearTimeout(crossoverTimerRef.current);
            crossoverTimerRef.current = null;
          }
        },
        { rootMargin: '220px 0px' }
      );
      io.observe(containerRef.current);
    }

    return () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
      if (crossoverTimerRef.current !== null) window.clearTimeout(crossoverTimerRef.current);
      if (springRafRef.current) cancelAnimationFrame(springRafRef.current);
      io?.disconnect();
      window.removeEventListener('resize', handleResize);
      animsRef.current.forEach((a) => a?.cancel());
      animsRef.current = [];
    };
  }, [buildAndStartAnimations, prefersReducedMotion, scheduleNextCrossover]);

  const springToTargetPos = useCallback(
    (targetPos: number, pauseBeforeAutoMs: number = 1450) => {
      if (springRafRef.current) cancelAnimationFrame(springRafRef.current);
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      if (crossoverTimerRef.current !== null) {
        window.clearTimeout(crossoverTimerRef.current);
        crossoverTimerRef.current = null;
      }

      isManualControlRef.current = true;
      animsRef.current.forEach((a) => a?.pause());

      const startPos = posRef.current;
      const delta = targetPos - startPos;
      if (prefersReducedMotion || Math.abs(delta) < 0.002) {
        seekAnimationsToPos(targetPos);
        isManualControlRef.current = false;
        if (!prefersReducedMotion && isVisibleRef.current) {
          resumeTimerRef.current = window.setTimeout(() => {
            animsRef.current.forEach((a) => a?.play());
            scheduleNextCrossover();
          }, pauseBeforeAutoMs);
        }
        return;
      }

      const startTime = performance.now();
      const durationMs = 380;

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        seekAnimationsToPos(startPos + delta * eased);

        if (t < 1) {
          springRafRef.current = requestAnimationFrame(step);
        } else {
          springRafRef.current = 0;
          isManualControlRef.current = false;
          if (!prefersReducedMotion && isVisibleRef.current) {
            resumeTimerRef.current = window.setTimeout(() => {
              animsRef.current.forEach((a) => a?.play());
              scheduleNextCrossover();
            }, pauseBeforeAutoMs);
          }
        }
      };

      springRafRef.current = requestAnimationFrame(step);
    },
    [prefersReducedMotion, scheduleNextCrossover, seekAnimationsToPos]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const now = performance.now();
    pointerStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastTime: now,
      velocityCardsPerSec: 0,
      mode: 'undecided',
      totalAbsDx: 0,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const p = pointerStateRef.current;
      if (!p.active || e.pointerId !== p.pointerId) return;

      const dxTotal = e.clientX - p.startX;
      const dyTotal = e.clientY - p.startY;
      p.totalAbsDx = Math.max(p.totalAbsDx, Math.abs(dxTotal));

      if (p.mode === 'undecided') {
        if (Math.abs(dxTotal) < 6 && Math.abs(dyTotal) < 6) return;
        if (Math.abs(dxTotal) > Math.abs(dyTotal) * 1.05) {
          p.mode = 'horizontal';
          if (springRafRef.current) {
            cancelAnimationFrame(springRafRef.current);
            springRafRef.current = 0;
          }
          if (resumeTimerRef.current !== null) {
            window.clearTimeout(resumeTimerRef.current);
            resumeTimerRef.current = null;
          }
          if (crossoverTimerRef.current !== null) {
            window.clearTimeout(crossoverTimerRef.current);
            crossoverTimerRef.current = null;
          }
          isManualControlRef.current = true;
          const livePos = getCurrentLivePos();
          animsRef.current.forEach((a) => a?.pause());
          seekAnimationsToPos(livePos);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
        } else {
          p.mode = 'vertical';
          p.active = false;
          return;
        }
      }

      if (p.mode === 'horizontal') {
        const now = performance.now();
        const stepDx = e.clientX - p.lastX;
        const dtSec = Math.max((now - p.lastTime) / 1000, 0.004);
        const slotUnit = getSlotUnitForWidth(window.innerWidth);
        const deltaCards = -stepDx / slotUnit;

        const nextPos = posRef.current + deltaCards;
        seekAnimationsToPos(nextPos);

        const instVel = deltaCards / dtSec;
        p.velocityCardsPerSec = p.velocityCardsPerSec * 0.6 + instVel * 0.4;
        p.lastX = e.clientX;
        p.lastTime = now;
      }
    },
    [getCurrentLivePos, seekAnimationsToPos]
  );

  const finishPointerDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const p = pointerStateRef.current;
      if (!p.active || e.pointerId !== p.pointerId) return;
      const wasHorizontal = p.mode === 'horizontal';
      const velocity = p.velocityCardsPerSec;
      p.active = false;
      p.mode = 'undecided';

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}

      if (wasHorizontal) {
        const clampedThrow = Math.max(-1.6, Math.min(1.6, velocity * 0.2));
        const snappedTarget = Math.round(posRef.current + clampedThrow);
        springToTargetPos(snappedTarget, 1450);
      }
    },
    [springToTargetPos]
  );

  const handleCardTap = useCallback(
    (idx: number) => {
      if (pointerStateRef.current.totalAbsDx > 9) return;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(8);
        }
      } catch {}
      const livePos = getCurrentLivePos();
      posRef.current = livePos;
      const delta = wrapDiff(idx - livePos);
      springToTargetPos(livePos + delta, 1600);
    },
    [getCurrentLivePos, springToTargetPos]
  );

  return (
    <div
      ref={containerRef}
      aria-label={tr('Categorias do Monvian')}
      className="relative w-full select-none pt-1 pb-2"
      style={{
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Full-bleed horizontal viewport stage running on GPU CoreAnimation at 120fps */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        className="relative w-full h-[222px] sm:h-[250px] overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          touchAction: 'pan-y',
          contain: 'layout style',
        }}
      >
        {CATEGORIES_3D.map((category, idx) => (
          <button
            key={category.id}
            ref={(el) => {
              cardRefs.current[idx] = el;
            }}
            type="button"
            onClick={() => handleCardTap(idx)}
            aria-label={tr(category.label)}
            className={`absolute left-1/2 top-[10px] w-[156px] h-[186px] sm:w-[178px] sm:h-[212px] rounded-[30px] sm:rounded-[34px] px-3 pt-2.5 pb-3.5 flex flex-col items-center justify-between text-center focus-visible:outline-2 focus-visible:outline-[#2673E8] will-change-transform cursor-pointer ${
              isDark ? 'bg-[#1C1C1E]' : 'bg-[#FFFFFF]'
            }`}
            style={{
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid rgba(15, 23, 42, 0.045)',
              boxShadow: isDark
                ? '0 18px 34px -14px rgba(0, 0, 0, 0.65), 0 6px 14px -6px rgba(0, 0, 0, 0.40)'
                : '0 18px 34px -14px rgba(15, 23, 42, 0.14), 0 6px 14px -6px rgba(15, 23, 42, 0.06)',
              transformOrigin: 'center center',
              backfaceVisibility: 'hidden',
              contain: 'layout style paint',
            }}
          >
            {/* Transparent 3D miniature object floating cleanly on card surface */}
            <div className="relative w-full flex-1 flex items-center justify-center pointer-events-none">
              <img
                src={category.image}
                alt={tr(category.alt)}
                loading="eager"
                decoding="async"
                draggable={false}
                className={`w-[116px] h-[116px] sm:w-[134px] sm:h-[134px] object-contain select-none pointer-events-none ${
                  category.objectScale || ''
                }`}
                style={{
                  filter: isDark
                    ? 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.45))'
                    : 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.08))',
                }}
              />
            </div>

            {/* Category Title below the 3D object */}
            <span
              className={`relative z-10 mt-1 text-[14.5px] sm:text-[15.5px] font-semibold tracking-[-0.02em] leading-tight whitespace-nowrap ${
                isDark ? 'text-[#FFFFFF]' : 'text-[#080808]'
              }`}
              style={{
                color: isDark ? '#FFFFFF' : '#080808',
                fontFamily:
                  "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {tr(category.label)}
            </span>
          </button>
        ))}
      </div>

      {/* Minimalist iPhone Pagination Dots */}
      <div
        className="mt-2.5 flex items-center justify-center gap-2"
        role="tablist"
        aria-label={tr('Categorias')}
      >
        {CATEGORIES_3D.map((category, idx) => {
          const isActive = activeIndex === idx;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tr(category.label)}
              onClick={() => handleCardTap(idx)}
              className="p-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] rounded-full"
            >
              <span
                className={`block rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isActive
                    ? isDark
                      ? 'w-[7px] h-[7px] bg-[#FFFFFF] scale-105'
                      : 'w-[7px] h-[7px] bg-[#080808] scale-105'
                    : isDark
                    ? 'w-[6px] h-[6px] bg-[#3A3A3C] hover:bg-[#636366]'
                    : 'w-[6px] h-[6px] bg-[#D1D5DB] hover:bg-[#9CA3AF]'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default Category3DLiquidGlassCarousel;
