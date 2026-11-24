import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { unlockSpotClickSound } from '../utils/soundEffects';

export interface MapOnboardingTutorialProps {
  isOpen: boolean;
  theme: 'dark' | 'light';
  userName?: string;
  onComplete: () => void;
  onSkip?: () => void;
  onStepChange?: (stepId: string | null) => void;
}

type BalloonPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

interface TutorialStepDefinition {
  id: string;
  selector: string | null;
  preferredPlacement: BalloonPlacement;
  shape: 'circle' | 'rounded' | 'none';
  padX: number;
  padY: number;
  radius: number;
  title: string;
  description: string;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  deferredMount?: boolean;
}

interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  rx: number;
}

const STEP_DURATION_MS = 3000;

const ALL_TUTORIAL_STEPS: TutorialStepDefinition[] = [
  {
    id: 'weather',
    selector: '#weather-header-display',
    preferredPlacement: 'bottom',
    shape: 'rounded',
    padX: 10,
    padY: 6,
    radius: 22,
    mobileOnly: true,
    title: 'Clima em tempo real',
    description:
      'Acompanhe a temperatura de Campos do Jordão e toque para ver o guia do que vestir hoje.',
  },
  {
    id: 'desktop-weather',
    selector: '#desktop-explore-weather',
    preferredPlacement: 'right',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 20,
    desktopOnly: true,
    title: 'Clima na serra',
    description:
      'Veja a temperatura atual em Campos do Jordão e toque para abrir sugestões de vestimenta.',
  },
  {
    id: 'view-3d',
    selector: '#btn-3d-toggle',
    preferredPlacement: 'bottom',
    shape: 'circle',
    padX: 6,
    padY: 6,
    radius: 999,
    title: 'Relevo em 3D',
    description:
      'Alterne entre o mapa com montanhas e relevo em 3D ou a visualização plana em 2D.',
  },
  {
    id: 'filters',
    selector: '#btn-category-icon-toggle',
    preferredPlacement: 'bottom',
    shape: 'circle',
    padX: 6,
    padY: 6,
    radius: 999,
    title: 'Filtros por categoria',
    description:
      'Filtre rapidamente o mapa por hotéis, restaurantes, cafés, chocolates ou atrações.',
  },
  {
    id: 'desktop-categories',
    selector: '#desktop-explore-categories',
    preferredPlacement: 'right',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 18,
    desktopOnly: true,
    title: 'Filtros do mapa',
    description:
      'Filtre os pontos turísticos por categoria para encontrar exatamente o que procura.',
  },
  {
    id: 'compass',
    selector: '#btn-map-compass',
    preferredPlacement: 'left',
    shape: 'circle',
    padX: 6,
    padY: 6,
    radius: 999,
    title: 'Sua localização e bússola',
    description:
      'Centralize o mapa na sua posição atual e ative a orientação em tempo real.',
  },
  {
    id: 'layers',
    selector: '#btn-map-layers',
    preferredPlacement: 'left',
    shape: 'circle',
    padX: 6,
    padY: 6,
    radius: 999,
    title: 'Camadas do mapa',
    description:
      'Alterne com um toque entre o estilo padrão do mapa e a visão por satélite.',
  },
  {
    id: 'bottom-nav',
    selector: '#bottom-navigation-capsule',
    preferredPlacement: 'top',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 999,
    mobileOnly: true,
    title: 'Navegação principal',
    description:
      'Alterne entre Roteiros, Salvos, Mapa, Busca inteligente e o seu Perfil a qualquer momento.',
  },
  {
    id: 'discovery-plus',
    selector: '#btn-toggle-discovery-panel',
    preferredPlacement: 'left',
    shape: 'circle',
    padX: 6,
    padY: 6,
    radius: 999,
    mobileOnly: true,
    title: 'Menu de roteiros',
    description:
      'Toque no + para abrir a aba de roteiros, acessar seus passeios salvos e explorar a loja.',
  },
  {
    id: 'open-discovery-create',
    selector: '#discovery-card-create-itinerary',
    preferredPlacement: 'top',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 26,
    mobileOnly: true,
    deferredMount: true,
    title: 'Criar roteiro personalizado',
    description:
      'Abrindo o menu, toque em Criar roteiro para escolher seus pontos favoritos no mapa.',
  },
  {
    id: 'desktop-create-itinerary',
    selector: '#desktop-create-itinerary-btn',
    preferredPlacement: 'bottom',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 999,
    desktopOnly: true,
    title: 'Criar roteiro no mapa',
    description:
      'Toque em Criar roteiro para selecionar seus pontos favoritos direto no mapa.',
  },
  {
    id: 'select-spots-map-pins',
    selector: '[data-tutorial-select-rank]',
    preferredPlacement: 'top',
    shape: 'circle',
    padX: 12,
    padY: 12,
    radius: 999,
    deferredMount: true,
    title: 'Toque nos pontos do mapa',
    description:
      'Selecione os pontos turísticos em círculos na ordem que deseja visitar durante o passeio.',
  },
  {
    id: 'select-three-spots',
    selector: '#select-mode-bottom-tray',
    preferredPlacement: 'top',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 40,
    deferredMount: true,
    title: 'Acompanhe seu roteiro',
    description:
      'Os pontos escolhidos ficam organizados aqui embaixo. Toque em Continuar para finalizar.',
  },
  {
    id: 'finish',
    selector: null,
    preferredPlacement: 'center',
    shape: 'none',
    padX: 0,
    padY: 0,
    radius: 0,
    title: 'Tudo pronto!',
    description:
      'Vamos aproximar na sua localização para você explorar Campos do Jordão no seu ritmo.',
  },
];

function isElementVisiblyMounted(selector: string | null): boolean {
  if (!selector) return true;
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el || !el.isConnected) return false;
  if (el.getClientRects().length === 0) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return (
    rect.width > 6 &&
    rect.height > 6 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function getVisibleTutorialSteps(): TutorialStepDefinition[] {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const filtered = ALL_TUTORIAL_STEPS.filter((step) => {
    if (step.mobileOnly && isDesktop) return false;
    if (step.desktopOnly && !isDesktop) return false;
    if (step.deferredMount || !step.selector) return true;
    return isElementVisiblyMounted(step.selector);
  });
  return filtered.length > 0 ? filtered : [ALL_TUTORIAL_STEPS[ALL_TUTORIAL_STEPS.length - 1]];
}

function buildSpotlightFromElement(
  el: HTMLElement,
  padX: number,
  padY: number,
  shape: 'circle' | 'rounded' | 'none',
  radius: number
): SpotlightRect | null {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 4 || rect.height <= 4) return null;

  if (shape === 'circle') {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const diameter = Math.round(Math.max(rect.width, rect.height) + Math.max(padX, padY) * 2);
    const left = Math.round(cx - diameter / 2);
    const top = Math.round(cy - diameter / 2);
    return {
      left,
      top,
      width: diameter,
      height: diameter,
      right: left + diameter,
      bottom: top + diameter,
      rx: Math.round(diameter / 2),
    };
  }

  const left = Math.round(rect.left - padX);
  const top = Math.round(rect.top - padY);
  const width = Math.round(rect.width + padX * 2);
  const height = Math.round(rect.height + padY * 2);
  const rx = Math.round(Math.min(radius, Math.min(width, height) / 2));

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    rx,
  };
}

function measureSelectedPinSpotlights(step: TutorialStepDefinition): {
  primary: SpotlightRect | null;
  secondary: SpotlightRect[];
} {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { primary: null, secondary: [] };
  }

  const rankedEls = Array.from(
    document.querySelectorAll('[data-tutorial-select-rank]')
  ) as HTMLElement[];

  const validRanked = rankedEls
    .map((el) => {
      const rank = Number(el.getAttribute('data-tutorial-select-rank') || '0');
      const rect = el.getBoundingClientRect();
      return { el, rank, rect };
    })
    .filter(
      (item) =>
        item.rank > 0 &&
        item.rect.width > 6 &&
        item.rect.height > 6 &&
        item.rect.bottom > 0 &&
        item.rect.top < window.innerHeight
    )
    .sort((a, b) => a.rank - b.rank);

  if (validRanked.length > 0) {
    const latest = validRanked[validRanked.length - 1];
    const primary = buildSpotlightFromElement(
      latest.el,
      step.padX,
      step.padY,
      'circle',
      999
    );
    const secondary = validRanked
      .slice(0, -1)
      .map((item) => buildSpotlightFromElement(item.el, 8, 8, 'circle', 999))
      .filter(Boolean) as SpotlightRect[];
    return { primary, secondary };
  }

  // Fallback for initial ~100ms before first demo spot receives rank attribute
  const allMarkers = Array.from(
    document.querySelectorAll('.monvian-explore-marker[data-spot-id]')
  ) as HTMLElement[];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centerMarker = allMarkers.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 12 && r.top > 110 && r.bottom < vh - 210 && r.left > 24 && r.right < vw - 24;
  });

  if (centerMarker) {
    return {
      primary: buildSpotlightFromElement(centerMarker, step.padX, step.padY, 'circle', 999),
      secondary: [],
    };
  }

  return { primary: null, secondary: [] };
}

function measureSpotlight(step: TutorialStepDefinition | null | undefined): SpotlightRect | null {
  if (!step?.selector || typeof document === 'undefined') return null;
  if (step.id === 'select-spots-map-pins') {
    return measureSelectedPinSpotlights(step).primary;
  }
  const el = document.querySelector(step.selector) as HTMLElement | null;
  if (!el || !el.isConnected) return null;
  return buildSpotlightFromElement(el, step.padX, step.padY, step.shape, step.radius);
}

function clamp(val: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, val));
}

export const MapOnboardingTutorial: React.FC<MapOnboardingTutorialProps> = ({
  isOpen,
  theme,
  userName,
  onComplete,
  onStepChange,
}) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const isDark = theme === 'dark';

  const [visibleSteps, setVisibleSteps] = useState<TutorialStepDefinition[]>(() =>
    isOpen ? getVisibleTutorialSteps() : []
  );
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(() => {
    if (!isOpen) return null;
    const steps = getVisibleTutorialSteps();
    return measureSpotlight(steps[0]);
  });
  const [secondarySpotlights, setSecondarySpotlights] = useState<SpotlightRect[]>([]);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 390,
    h: typeof window !== 'undefined' ? window.innerHeight : 844,
  });
  const [isSimulatingTap, setIsSimulatingTap] = useState<boolean>(false);

  const balloonRef = useRef<HTMLDivElement | null>(null);
  const [balloonSize, setBalloonSize] = useState<{ w: number; h: number }>({ w: 288, h: 132 });

  const recomputeVisibleSteps = useCallback(() => {
    const filtered = getVisibleTutorialSteps();
    setVisibleSteps((prev) => {
      if (
        prev.length === filtered.length &&
        prev.every((item, idx) => item.id === filtered[idx].id)
      ) {
        return prev;
      }
      return filtered;
    });
    return filtered;
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setSpotlight(null);
      setSecondarySpotlights([]);
      setIsSimulatingTap(false);
      onStepChange?.(null);
      return;
    }

    const initialSteps = recomputeVisibleSteps();
    setStepIndex(0);
    setSpotlight(measureSpotlight(initialSteps[0]));
    setSecondarySpotlights([]);

    const settleTimer1 = window.setTimeout(() => {
      const updated = recomputeVisibleSteps();
      setStepIndex((currIdx) => {
        const clamped = Math.min(currIdx, Math.max(0, updated.length - 1));
        setSpotlight(measureSpotlight(updated[clamped]));
        return clamped;
      });
    }, 120);

    const settleTimer2 = window.setTimeout(() => {
      const updated = recomputeVisibleSteps();
      setStepIndex((currIdx) => {
        const clamped = Math.min(currIdx, Math.max(0, updated.length - 1));
        setSpotlight(measureSpotlight(updated[clamped]));
        return clamped;
      });
    }, 360);

    return () => {
      window.clearTimeout(settleTimer1);
      window.clearTimeout(settleTimer2);
    };
  }, [isOpen, recomputeVisibleSteps, onStepChange]);

  const activeStep = visibleSteps[stepIndex] || visibleSteps[visibleSteps.length - 1] || null;
  const totalSteps = visibleSteps.length;
  const isFinalStep = Boolean(activeStep && activeStep.selector === null);

  useEffect(() => {
    if (!isOpen) {
      onStepChange?.(null);
      return;
    }
    onStepChange?.(activeStep?.id || null);
  }, [isOpen, activeStep?.id, onStepChange]);

  const updatePositions = useCallback(() => {
    if (!isOpen) return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    if (activeStep?.id === 'select-spots-map-pins') {
      const { primary, secondary } = measureSelectedPinSpotlights(activeStep);
      setSpotlight(primary);
      setSecondarySpotlights(secondary);
    } else {
      setSecondarySpotlights([]);
      if (activeStep) {
        setSpotlight(measureSpotlight(activeStep));
      }
    }
  }, [isOpen, activeStep]);

  // Continuously track target rects during spring mounts, circular spot selection, and viewport shifts
  useEffect(() => {
    if (!isOpen) return;
    updatePositions();

    const trackDurationMs = activeStep?.id === 'select-spots-map-pins' ? STEP_DURATION_MS : 750;
    let rafId: number | null = null;
    const startTime = performance.now();
    const trackSpringLoop = () => {
      updatePositions();
      if (performance.now() - startTime < trackDurationMs) {
        rafId = requestAnimationFrame(trackSpringLoop);
      }
    };
    rafId = requestAnimationFrame(trackSpringLoop);

    const settle1 = window.setTimeout(updatePositions, 90);
    const settle2 = window.setTimeout(updatePositions, 260);
    const settle3 = window.setTimeout(updatePositions, 520);

    const onResize = () => {
      recomputeVisibleSteps();
      updatePositions();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const attachResizeObserver = () => {
      if (ro) {
        ro.disconnect();
        ro = null;
      }
      if (
        activeStep?.selector &&
        activeStep.id !== 'select-spots-map-pins' &&
        typeof ResizeObserver !== 'undefined'
      ) {
        const targetEl = document.querySelector(activeStep.selector);
        if (targetEl) {
          ro = new ResizeObserver(() => {
            updatePositions();
          });
          ro.observe(targetEl);
        }
      }
    };

    attachResizeObserver();

    if (activeStep?.selector && typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        attachResizeObserver();
        updatePositions();
      });
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: activeStep.id === 'select-spots-map-pins',
        attributeFilter:
          activeStep.id === 'select-spots-map-pins'
            ? ['data-tutorial-select-rank', 'style']
            : undefined,
      });
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.clearTimeout(settle1);
      window.clearTimeout(settle2);
      window.clearTimeout(settle3);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [isOpen, activeStep, updatePositions, recomputeVisibleSteps]);

  useLayoutEffect(() => {
    if (!isOpen || !balloonRef.current) return;
    const rect = balloonRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setBalloonSize((prev) =>
        Math.abs(prev.w - rect.width) > 1 || Math.abs(prev.h - rect.height) > 1
          ? { w: Math.round(rect.width), h: Math.round(rect.height) }
          : prev
      );
    }
  }, [isOpen, stepIndex, activeStep?.id, spotlight?.top, spotlight?.height, viewport.w, viewport.h]);

  const handleNext = useCallback(() => {
    if (!isOpen) return;
    unlockSpotClickSound();
    setIsSimulatingTap(false);
    if (stepIndex >= totalSteps - 1) {
      onComplete();
    } else {
      setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
    }
  }, [isOpen, stepIndex, totalSteps, onComplete]);

  // 3-second auto-advance timer per card + simulated click pulses synchronized with live UI demos
  useEffect(() => {
    if (!isOpen || !activeStep) return;

    setIsSimulatingTap(false);
    const timers: number[] = [];

    if (
      activeStep.id === 'open-discovery-create' ||
      activeStep.id === 'desktop-create-itinerary'
    ) {
      timers.push(
        window.setTimeout(() => {
          setIsSimulatingTap(true);
        }, 2250)
      );
    } else if (activeStep.id === 'layers') {
      timers.push(
        window.setTimeout(() => setIsSimulatingTap(true), 290),
        window.setTimeout(() => setIsSimulatingTap(false), 680),
        window.setTimeout(() => setIsSimulatingTap(true), 1650),
        window.setTimeout(() => setIsSimulatingTap(false), 2040)
      );
    }

    const autoAdvanceTimer = window.setTimeout(() => {
      handleNext();
    }, STEP_DURATION_MS);

    return () => {
      timers.forEach((tid) => window.clearTimeout(tid));
      window.clearTimeout(autoAdvanceTimer);
    };
  }, [isOpen, activeStep?.id, stepIndex, handleNext]);

  // Keyboard support for accessibility & desktop users
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleNext]);

  // Compute dynamic smart balloon position + arrow pointer offset
  const balloonLayout = useMemo(() => {
    const vw = viewport.w;
    const vh = viewport.h;
    const safeH = 16;
    const isSelectPinsStep = activeStep?.id === 'select-spots-map-pins';
    const safeTop = isSelectPinsStep
      ? Math.max(96, vw < 768 ? 104 : 90)
      : Math.max(24, vw < 768 ? 52 : 24);
    const safeBottom = isSelectPinsStep
      ? Math.max(210, vw < 768 ? 228 : 180)
      : Math.max(20, vw < 768 ? 26 : 20);
    const maxW = isFinalStep ? Math.min(330, vw - safeH * 2) : Math.min(292, vw - safeH * 2);
    const bW = Math.min(maxW, balloonSize.w || maxW);
    const bH = balloonSize.h || 132;

    if (!spotlight || !activeStep || isFinalStep) {
      return {
        placement: 'center' as BalloonPlacement,
        left: Math.round((vw - maxW) / 2),
        top: Math.round(clamp((vh - bH) / 2, safeTop, vh - safeBottom - bH)),
        maxWidth: maxW,
        arrowOffset: 0,
      };
    }

    const gap = 14;
    const targetCx = spotlight.left + spotlight.width / 2;
    const targetCy = spotlight.top + spotlight.height / 2;

    let chosen: BalloonPlacement = activeStep.preferredPlacement;

    if (isSelectPinsStep) {
      const spaceAbove = spotlight.top - safeTop - gap;
      const spaceBelow = vh - safeBottom - spotlight.bottom - gap;
      chosen = spaceAbove >= bH || spaceAbove >= spaceBelow ? 'top' : 'bottom';
    } else if (chosen === 'left') {
      const spaceLeft = spotlight.left - safeH - gap;
      if (spaceLeft < 210) {
        chosen = spotlight.top > vh * 0.55 ? 'top' : 'bottom';
      }
    } else if (chosen === 'right') {
      const spaceRight = vw - safeH - spotlight.right - gap;
      if (spaceRight < 220) {
        chosen = spotlight.top > vh * 0.55 ? 'top' : 'bottom';
      }
    } else if (chosen === 'bottom') {
      const spaceBelow = vh - safeBottom - spotlight.bottom - gap;
      if (spaceBelow < bH) {
        chosen = 'top';
      }
    } else if (chosen === 'top') {
      const spaceAbove = spotlight.top - safeTop - gap;
      if (spaceAbove < bH) {
        chosen = 'bottom';
      }
    }

    if (chosen === 'left') {
      const availableW = Math.min(maxW, Math.max(204, spotlight.left - safeH - gap));
      const left = clamp(spotlight.left - gap - availableW, safeH, vw - safeH - availableW);
      const top = clamp(targetCy - bH / 2, safeTop, vh - safeBottom - bH);
      const arrowOffset = clamp(targetCy - top, 28, bH - 28);
      return { placement: 'left' as BalloonPlacement, left, top, maxWidth: availableW, arrowOffset };
    }

    if (chosen === 'right') {
      const availableW = Math.min(maxW, Math.max(220, vw - safeH - spotlight.right - gap));
      const left = clamp(spotlight.right + gap, safeH, vw - safeH - availableW);
      const top = clamp(targetCy - bH / 2, safeTop, vh - safeBottom - bH);
      const arrowOffset = clamp(targetCy - top, 28, bH - 28);
      return { placement: 'right' as BalloonPlacement, left, top, maxWidth: availableW, arrowOffset };
    }

    if (chosen === 'top') {
      const left = clamp(targetCx - bW / 2, safeH, vw - safeH - maxW);
      const top = clamp(spotlight.top - gap - bH, safeTop, vh - safeBottom - bH);
      const arrowOffset = clamp(targetCx - left, 32, Math.min(bW, maxW) - 32);
      return { placement: 'top' as BalloonPlacement, left, top, maxWidth: maxW, arrowOffset };
    }

    // default: bottom
    const left = clamp(targetCx - bW / 2, safeH, vw - safeH - maxW);
    const top = clamp(spotlight.bottom + gap, safeTop, vh - safeBottom - bH);
    const arrowOffset = clamp(targetCx - left, 32, Math.min(bW, maxW) - 32);
    return { placement: 'bottom' as BalloonPlacement, left, top, maxWidth: maxW, arrowOffset };
  }, [viewport, spotlight, activeStep, isFinalStep, balloonSize.w, balloonSize.h]);

  const firstName = useMemo(() => {
    const raw = (userName || '').trim().split(/\s+/)[0];
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [userName]);

  const transitionEase = [0.22, 1, 0.36, 1] as const;
  const backdropFill = isDark ? 'rgba(0, 0, 0, 0.60)' : 'rgba(0, 0, 0, 0.42)';
  const hasSpotlightCutout = Boolean(spotlight && !isFinalStep);
  const isWaitingForDeferredTarget = Boolean(!isFinalStep && activeStep?.selector && !spotlight);

  // Exact Liquid Glass optical surface matching #select-mode-bottom-tray
  const liquidGlassCardStyle: React.CSSProperties = isDark
    ? {
        background:
          'linear-gradient(168deg, rgba(30, 30, 34, 0.78) 0%, rgba(17, 17, 19, 0.72) 100%)',
        backdropFilter: 'blur(32px) saturate(165%)',
        WebkitBackdropFilter: 'blur(32px) saturate(165%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow:
          '0 22px 48px -8px rgba(0, 0, 0, 0.74), 0 -6px 24px -6px rgba(0, 0, 0, 0.38), -10px 4px 26px -8px rgba(0, 0, 0, 0.40), 10px 4px 26px -8px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.20), inset 0 -1px 0 rgba(255, 255, 255, 0.05)',
      }
    : {
        background:
          'linear-gradient(168deg, rgba(255, 255, 255, 0.78) 0%, rgba(246, 246, 248, 0.68) 100%)',
        backdropFilter: 'blur(32px) saturate(195%)',
        WebkitBackdropFilter: 'blur(32px) saturate(195%)',
        border: '1px solid rgba(255, 255, 255, 0.76)',
        boxShadow:
          '0 20px 46px -8px rgba(0, 0, 0, 0.22), 0 -6px 24px -6px rgba(0, 0, 0, 0.08), -10px 4px 26px -8px rgba(0, 0, 0, 0.09), 10px 4px 26px -8px rgba(0, 0, 0, 0.09), 0 0 0 0.5px rgba(0, 0, 0, 0.07), inset 0 1.5px 1px rgba(255, 255, 255, 0.94), inset 0 -1px 1px rgba(255, 255, 255, 0.40)',
      };

  const arrowSurfaceStyle: React.CSSProperties = isDark
    ? {
        backgroundColor: 'rgba(26, 26, 30, 0.78)',
        borderColor: 'rgba(255, 255, 255, 0.16)',
      }
    : {
        backgroundColor: 'rgba(255, 255, 255, 0.76)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
      };

  return (
    <AnimatePresence>
      {isOpen && activeStep && (
        <motion.div
          key="monvian-map-onboarding-tutorial"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.14 : 0.3, ease: transitionEase }}
          role="dialog"
          aria-modal="true"
          aria-label="Apresentação do mapa Monvian"
          onClick={handleNext}
          className="fixed inset-0 z-[280] select-none overflow-hidden pointer-events-auto cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          {/* Full-screen dimming layer when on the centered final step or awaiting deferred target mount */}
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{ opacity: hasSpotlightCutout ? 0 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.28, ease: transitionEase }}
            className="fixed inset-0 pointer-events-none"
            style={{ backgroundColor: backdropFill }}
          />

          {/* Secondary subtle circular rings over already-selected map spots */}
          {activeStep.id === 'select-spots-map-pins' &&
            secondarySpotlights.map((rect, i) => (
              <motion.div
                key={`secondary-pin-halo-${i}`}
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.84 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.24, ease: transitionEase }}
                className="fixed pointer-events-none rounded-full"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  border: '1.5px solid rgba(255, 255, 255, 0.92)',
                  boxShadow:
                    '0 0 18px rgba(255, 255, 255, 0.38), inset 0 0 10px rgba(255, 255, 255, 0.18)',
                }}
              />
            ))}

          {/* Hardware-friendly Spotlight Cutout + Monochrome Focus Ring */}
          {spotlight && (
            <motion.div
              aria-hidden="true"
              initial={{
                left: spotlight.left - 14,
                top: spotlight.top - 14,
                width: spotlight.width + 28,
                height: spotlight.height + 28,
                borderRadius: spotlight.rx + 14,
                opacity: 0,
              }}
              animate={{
                left: spotlight.left,
                top: spotlight.top,
                width: spotlight.width,
                height: spotlight.height,
                borderRadius: spotlight.rx,
                scale: isSimulatingTap ? 0.94 : 1,
                opacity: isFinalStep ? 0 : 1,
              }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.12 }
                  : { duration: 0.34, ease: transitionEase }
              }
              className="fixed pointer-events-none"
              style={{
                boxShadow: isDark
                  ? `0 0 0 2600px ${backdropFill}, 0 0 0 1.5px rgba(255, 255, 255, 0.9), 0 0 26px rgba(255, 255, 255, 0.28)`
                  : `0 0 0 2600px ${backdropFill}, 0 0 0 1.5px rgba(255, 255, 255, 0.98), 0 0 28px rgba(255, 255, 255, 0.42)`,
              }}
            >
              {!prefersReducedMotion && !isFinalStep && (
                <motion.div
                  aria-hidden="true"
                  className="absolute -inset-[6px]"
                  style={{
                    borderRadius: spotlight.rx + 6,
                    border: '1px solid rgba(255, 255, 255, 0.48)',
                  }}
                  animate={
                    isSimulatingTap
                      ? { scale: [1, 1.16], opacity: [0.95, 0] }
                      : { scale: [1, 1.09, 1], opacity: [0.62, 0.1, 0.62] }
                  }
                  transition={
                    isSimulatingTap
                      ? { duration: 0.55, ease: 'easeOut' }
                      : { duration: 2.0, repeat: Infinity, ease: 'easeInOut' }
                  }
                />
              )}
            </motion.div>
          )}

          {/* Translucent Liquid Glass Floating Callout Card (Matches #select-mode-bottom-tray) */}
          {!isWaitingForDeferredTarget && (
            <AnimatePresence mode="wait">
              <motion.div
                ref={balloonRef}
                key={activeStep.id}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        scale: 0.94,
                        y:
                          balloonLayout.placement === 'top'
                            ? 10
                            : balloonLayout.placement === 'bottom'
                              ? -10
                              : 8,
                        x:
                          balloonLayout.placement === 'left'
                            ? 10
                            : balloonLayout.placement === 'right'
                              ? -10
                              : 0,
                      }
                }
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        scale: 0.96,
                        y:
                          balloonLayout.placement === 'top'
                            ? -6
                            : balloonLayout.placement === 'bottom'
                              ? 6
                              : -4,
                      }
                }
                transition={{
                  duration: prefersReducedMotion ? 0.14 : 0.24,
                  ease: transitionEase,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className={`fixed pointer-events-auto rounded-[34px] p-5 transition-[left,top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                }`}
                style={{
                  ...liquidGlassCardStyle,
                  left: balloonLayout.left,
                  top: balloonLayout.top,
                  width: balloonLayout.maxWidth,
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
                }}
              >
                {/* Optical Liquid Glass top rim sheen */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-6 top-[1px] h-[1px] rounded-full bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
                />

                {/* Translucent Directional Pointer Arrow */}
                {!isFinalStep && balloonLayout.placement === 'bottom' && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-[6px] w-3 h-3 rotate-45 rounded-[3px] border-l border-t backdrop-blur-md"
                    style={{ ...arrowSurfaceStyle, left: balloonLayout.arrowOffset - 6 }}
                  />
                )}
                {!isFinalStep && balloonLayout.placement === 'top' && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-[6px] w-3 h-3 rotate-45 rounded-[3px] border-r border-b backdrop-blur-md"
                    style={{ ...arrowSurfaceStyle, left: balloonLayout.arrowOffset - 6 }}
                  />
                )}
                {!isFinalStep && balloonLayout.placement === 'left' && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-[6px] w-3 h-3 rotate-45 rounded-[3px] border-r border-t backdrop-blur-md"
                    style={{ ...arrowSurfaceStyle, top: balloonLayout.arrowOffset - 6 }}
                  />
                )}
                {!isFinalStep && balloonLayout.placement === 'right' && (
                  <span
                    aria-hidden="true"
                    className="absolute -left-[6px] w-3 h-3 rotate-45 rounded-[3px] border-l border-b backdrop-blur-md"
                    style={{ ...arrowSurfaceStyle, top: balloonLayout.arrowOffset - 6 }}
                  />
                )}

                {/* Title & concise explanation */}
                <h3
                  className={`text-[16px] font-bold leading-snug tracking-[-0.02em] ${
                    isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                  }`}
                >
                  {isFinalStep && firstName
                    ? `${firstName}, tudo pronto!`
                    : activeStep.title}
                </h3>

                <p
                  className={`mt-1.5 text-[13px] leading-[1.45] font-medium ${
                    isDark ? 'text-[#D1D1D6]' : 'text-[#2C2C2E]'
                  }`}
                >
                  {activeStep.description}
                </p>

                {/* Subtle 3-second monochrome auto-advance timer bar */}
                <div
                  aria-hidden="true"
                  className={`mt-3.5 h-[2.5px] w-full rounded-full overflow-hidden ${
                    isDark ? 'bg-white/[0.14]' : 'bg-black/[0.09]'
                  }`}
                >
                  <motion.div
                    key={`progress-${activeStep.id}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: STEP_DURATION_MS / 1000,
                      ease: 'linear',
                    }}
                    className={`h-full w-full origin-left rounded-full ${
                      isDark ? 'bg-[#FFFFFF]' : 'bg-[#000000]'
                    }`}
                  />
                </div>

                {/* Minimalist progress dots (tap anywhere on screen or card to advance) */}
                <div className="mt-3 flex items-center justify-center gap-1" aria-hidden="true">
                  {visibleSteps.map((s, idx) => (
                    <span
                      key={s.id}
                      className={`h-1 rounded-full transition-all duration-200 ${
                        idx === stepIndex
                          ? `w-3.5 ${isDark ? 'bg-[#FFFFFF]' : 'bg-[#000000]'}`
                          : `w-1 ${isDark ? 'bg-white/25' : 'bg-black/20'}`
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapOnboardingTutorial;
