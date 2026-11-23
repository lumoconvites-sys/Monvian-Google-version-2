import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Compass, X } from 'lucide-react';

export interface MapOnboardingTutorialProps {
  isOpen: boolean;
  theme: 'dark' | 'light';
  userName?: string;
  onComplete: () => void;
  onSkip: () => void;
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

const ALL_TUTORIAL_STEPS: TutorialStepDefinition[] = [
  {
    id: 'weather',
    selector: '#weather-header-display',
    preferredPlacement: 'bottom',
    shape: 'rounded',
    padX: 10,
    padY: 6,
    radius: 20,
    title: 'Clima em tempo real',
    description:
      'Acompanhe a temperatura de Campos do Jordão e toque aqui para ver o guia do que vestir hoje.',
  },
  {
    id: 'desktop-weather',
    selector: '#desktop-explore-weather',
    preferredPlacement: 'right',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 18,
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
    radius: 16,
    title: 'Filtros do mapa',
    description:
      'Filtre os pontos turísticos por categoria para encontrar exatamente o que procura.',
  },
  {
    id: 'discovery-plus',
    selector: '#btn-toggle-discovery-panel',
    preferredPlacement: 'left',
    shape: 'circle',
    padX: 6,
    padY: 6,
    radius: 999,
    title: 'Menu de roteiros',
    description:
      'Toque no + para criar seu próprio roteiro no mapa, abrir roteiros salvos ou visitar a loja.',
  },
  {
    id: 'desktop-create-itinerary',
    selector: '#desktop-create-itinerary-btn',
    preferredPlacement: 'bottom',
    shape: 'rounded',
    padX: 6,
    padY: 6,
    radius: 999,
    title: 'Criar roteiro no mapa',
    description:
      'Selecione os pontos desejados direto no mapa e monte seu passeio personalizado.',
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
    title: 'Navegação principal',
    description:
      'Alterne entre Roteiros, Salvos, Mapa, Busca inteligente e o seu Perfil a qualquer momento.',
  },
  {
    id: 'finish',
    selector: null,
    preferredPlacement: 'center',
    shape: 'none',
    padX: 0,
    padY: 0,
    radius: 0,
    title: 'Pronto para explorar',
    description:
      'Toque nos locais do mapa, descubra experiências exclusivas e viva Campos do Jordão no seu ritmo.',
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
  const filtered = ALL_TUTORIAL_STEPS.filter((step) => isElementVisiblyMounted(step.selector));
  return filtered.length > 0 ? filtered : [ALL_TUTORIAL_STEPS[ALL_TUTORIAL_STEPS.length - 1]];
}

function measureSpotlight(step: TutorialStepDefinition | null | undefined): SpotlightRect | null {
  if (!step?.selector || typeof document === 'undefined') return null;
  const el = document.querySelector(step.selector) as HTMLElement | null;
  if (!el || !el.isConnected) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 4 || rect.height <= 4) return null;

  const left = Math.round(rect.left - step.padX);
  const top = Math.round(rect.top - step.padY);
  const width = Math.round(rect.width + step.padX * 2);
  const height = Math.round(rect.height + step.padY * 2);
  const rx =
    step.shape === 'circle'
      ? Math.round(Math.max(width, height) / 2)
      : Math.round(Math.min(step.radius, Math.min(width, height) / 2));

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

function clamp(val: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, val));
}

export const MapOnboardingTutorial: React.FC<MapOnboardingTutorialProps> = ({
  isOpen,
  theme,
  userName,
  onComplete,
  onSkip,
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
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 390,
    h: typeof window !== 'undefined' ? window.innerHeight : 844,
  });

  const balloonRef = useRef<HTMLDivElement | null>(null);
  const [balloonSize, setBalloonSize] = useState<{ w: number; h: number }>({ w: 266, h: 170 });

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
      return;
    }

    const initialSteps = recomputeVisibleSteps();
    setStepIndex(0);
    setSpotlight(measureSpotlight(initialSteps[0]));

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
  }, [isOpen, recomputeVisibleSteps]);

  const activeStep = visibleSteps[stepIndex] || visibleSteps[visibleSteps.length - 1] || null;
  const totalSteps = visibleSteps.length;
  const isFinalStep = Boolean(activeStep && activeStep.selector === null);

  const updatePositions = useCallback(() => {
    if (!isOpen) return;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    if (activeStep) {
      setSpotlight(measureSpotlight(activeStep));
    }
  }, [isOpen, activeStep]);

  useEffect(() => {
    if (!isOpen) return;
    updatePositions();

    const raf = requestAnimationFrame(updatePositions);
    const t = window.setTimeout(updatePositions, 80);
    const onResize = () => {
      recomputeVisibleSteps();
      updatePositions();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    let ro: ResizeObserver | null = null;
    if (activeStep?.selector && typeof ResizeObserver !== 'undefined') {
      const targetEl = document.querySelector(activeStep.selector);
      if (targetEl) {
        ro = new ResizeObserver(updatePositions);
        ro.observe(targetEl);
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      ro?.disconnect();
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
  }, [isOpen, stepIndex, activeStep?.id, viewport.w, viewport.h]);

  const handleNext = useCallback(() => {
    if (!isOpen) return;
    if (stepIndex >= totalSteps - 1) {
      onComplete();
    } else {
      setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
    }
  }, [isOpen, stepIndex, totalSteps, onComplete]);

  const handleSkipTutorial = useCallback(() => {
    if (!isOpen) return;
    onSkip();
  }, [isOpen, onSkip]);

  // Keyboard support for accessibility & desktop users
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkipTutorial();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleNext, handleSkipTutorial]);

  // Compute dynamic smart balloon position + arrow pointer offset
  const balloonLayout = useMemo(() => {
    const vw = viewport.w;
    const vh = viewport.h;
    const safeH = 16;
    const safeTop = Math.max(24, vw < 768 ? 52 : 24);
    const safeBottom = Math.max(20, vw < 768 ? 26 : 20);
    const maxW = isFinalStep ? Math.min(316, vw - safeH * 2) : Math.min(266, vw - safeH * 2);
    const bW = Math.min(maxW, balloonSize.w || maxW);
    const bH = balloonSize.h || 170;

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

    if (chosen === 'left') {
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
      const arrowOffset = clamp(targetCy - top, 24, bH - 24);
      return { placement: 'left' as BalloonPlacement, left, top, maxWidth: availableW, arrowOffset };
    }

    if (chosen === 'right') {
      const availableW = Math.min(maxW, Math.max(220, vw - safeH - spotlight.right - gap));
      const left = clamp(spotlight.right + gap, safeH, vw - safeH - availableW);
      const top = clamp(targetCy - bH / 2, safeTop, vh - safeBottom - bH);
      const arrowOffset = clamp(targetCy - top, 24, bH - 24);
      return { placement: 'right' as BalloonPlacement, left, top, maxWidth: availableW, arrowOffset };
    }

    if (chosen === 'top') {
      const left = clamp(targetCx - bW / 2, safeH, vw - safeH - maxW);
      const top = clamp(spotlight.top - gap - bH, safeTop, vh - safeBottom - bH);
      const arrowOffset = clamp(targetCx - left, 26, Math.min(bW, maxW) - 26);
      return { placement: 'top' as BalloonPlacement, left, top, maxWidth: maxW, arrowOffset };
    }

    // default: bottom
    const left = clamp(targetCx - bW / 2, safeH, vw - safeH - maxW);
    const top = clamp(spotlight.bottom + gap, safeTop, vh - safeBottom - bH);
    const arrowOffset = clamp(targetCx - left, 26, Math.min(bW, maxW) - 26);
    return { placement: 'bottom' as BalloonPlacement, left, top, maxWidth: maxW, arrowOffset };
  }, [viewport, spotlight, activeStep, isFinalStep, balloonSize.w, balloonSize.h]);

  const firstName = useMemo(() => {
    const raw = (userName || '').trim().split(/\s+/)[0];
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [userName]);

  const transitionEase = [0.22, 1, 0.36, 1] as const;
  const backdropFill = isDark ? 'rgba(0, 0, 0, 0.64)' : 'rgba(0, 0, 0, 0.46)';
  const hasSpotlightCutout = Boolean(spotlight && !isFinalStep);

  return (
    <AnimatePresence>
      {isOpen && activeStep && (
        <motion.div
          key="monvian-map-onboarding-tutorial"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.14 : 0.32, ease: transitionEase }}
          role="dialog"
          aria-modal="true"
          aria-label="Apresentação do mapa Monvian"
          className="fixed inset-0 z-[280] select-none overflow-hidden"
          style={{ touchAction: 'none' }}
        >
          {/* Interactive tap-blocker backdrop so user remains focused on the tour */}
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
            }}
          />

          {/* Full-screen dimming layer when on the centered final step (or no spotlight target) */}
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{ opacity: hasSpotlightCutout ? 0 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.28, ease: transitionEase }}
            className="fixed inset-0 pointer-events-none"
            style={{ backgroundColor: backdropFill }}
          />

          {/* Hardware-friendly Spotlight Cutout + Monochrome Focus Ring (Zero WebKit SVG Mask glitches) */}
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
                opacity: isFinalStep ? 0 : 1,
              }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.12 }
                  : { duration: 0.36, ease: transitionEase }
              }
              className="fixed pointer-events-none"
              style={{
                boxShadow: isDark
                  ? `0 0 0 2600px ${backdropFill}, 0 0 0 1.5px rgba(255, 255, 255, 0.88), 0 0 24px rgba(255, 255, 255, 0.28)`
                  : `0 0 0 2600px ${backdropFill}, 0 0 0 1.5px rgba(255, 255, 255, 0.96), 0 0 26px rgba(255, 255, 255, 0.42)`,
              }}
            >
              {!prefersReducedMotion && !isFinalStep && (
                <motion.div
                  aria-hidden="true"
                  className="absolute -inset-[6px]"
                  style={{
                    borderRadius: spotlight.rx + 6,
                    border: '1px solid rgba(255, 255, 255, 0.45)',
                  }}
                  animate={{
                    scale: [1, 1.09, 1],
                    opacity: [0.6, 0.08, 0.6],
                  }}
                  transition={{
                    duration: 2.1,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}
            </motion.div>
          )}

          {/* Compact Floating Callout Balloon with smooth step-to-step AnimatePresence transitions */}
          <AnimatePresence mode="wait">
            <motion.div
              ref={balloonRef}
              key={activeStep.id}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      scale: 0.95,
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
              className={`fixed pointer-events-auto rounded-[22px] p-4 border backdrop-blur-2xl ${
                isDark
                  ? 'bg-[#171717]/94 border-white/14 text-[#FFFFFF]'
                  : 'bg-[#FFFFFF]/96 border-black/[0.08] text-[#000000]'
              }`}
              style={{
                left: balloonLayout.left,
                top: balloonLayout.top,
                width: balloonLayout.maxWidth,
                boxShadow: isDark
                  ? '0 22px 48px -12px rgba(0, 0, 0, 0.72), 0 0 0 0.5px rgba(255, 255, 255, 0.08)'
                  : '0 22px 48px -12px rgba(0, 0, 0, 0.22), 0 4px 16px -4px rgba(0, 0, 0, 0.08)',
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
              }}
            >
              {/* Subtle Directional Pointer Arrow */}
              {!isFinalStep && balloonLayout.placement === 'bottom' && (
                <span
                  aria-hidden="true"
                  className={`absolute -top-[6px] w-3 h-3 rotate-45 border-l border-t ${
                    isDark
                      ? 'bg-[#171717] border-white/14'
                      : 'bg-[#FFFFFF] border-black/[0.08]'
                  }`}
                  style={{ left: balloonLayout.arrowOffset - 6 }}
                />
              )}
              {!isFinalStep && balloonLayout.placement === 'top' && (
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-[6px] w-3 h-3 rotate-45 border-r border-b ${
                    isDark
                      ? 'bg-[#171717] border-white/14'
                      : 'bg-[#FFFFFF] border-black/[0.08]'
                  }`}
                  style={{ left: balloonLayout.arrowOffset - 6 }}
                />
              )}
              {!isFinalStep && balloonLayout.placement === 'left' && (
                <span
                  aria-hidden="true"
                  className={`absolute -right-[6px] w-3 h-3 rotate-45 border-r border-t ${
                    isDark
                      ? 'bg-[#171717] border-white/14'
                      : 'bg-[#FFFFFF] border-black/[0.08]'
                  }`}
                  style={{ top: balloonLayout.arrowOffset - 6 }}
                />
              )}
              {!isFinalStep && balloonLayout.placement === 'right' && (
                <span
                  aria-hidden="true"
                  className={`absolute -left-[6px] w-3 h-3 rotate-45 border-l border-b ${
                    isDark
                      ? 'bg-[#171717] border-white/14'
                      : 'bg-[#FFFFFF] border-black/[0.08]'
                  }`}
                  style={{ top: balloonLayout.arrowOffset - 6 }}
                />
              )}

              {/* Header row: subtle step indicator + close/skip icon */}
              <div className="flex items-center justify-between gap-2 mb-2">
                {isFinalStep ? (
                  <div
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-tight ${
                      isDark ? 'text-[#A3A3A3]' : 'text-[#858585]'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>Campos do Jordão</span>
                  </div>
                ) : (
                  <span
                    className={`text-[11px] font-semibold tracking-tight tabular-nums ${
                      isDark ? 'text-[#A3A3A3]' : 'text-[#858585]'
                    }`}
                  >
                    {stepIndex + 1} de {totalSteps}
                  </span>
                )}

                {!isFinalStep && (
                  <button
                    type="button"
                    onClick={handleSkipTutorial}
                    aria-label="Pular apresentação"
                    className={`-mr-1 -mt-1 p-1 rounded-full transition-colors cursor-pointer ${
                      isDark
                        ? 'text-[#858585] hover:text-[#FFFFFF] hover:bg-white/10'
                        : 'text-[#858585] hover:text-[#000000] hover:bg-black/5'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </button>
                )}
              </div>

              {/* Title & concise explanation */}
              <h3
                className={`text-[15.5px] font-semibold leading-snug tracking-[-0.015em] ${
                  isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                }`}
              >
                {isFinalStep && firstName
                  ? `${firstName}, tudo pronto para explorar`
                  : activeStep.title}
              </h3>

              <p
                className={`mt-1.5 text-[13px] leading-[1.45] font-normal ${
                  isDark ? 'text-[#B3B3B3]' : 'text-[#525252]'
                }`}
              >
                {activeStep.description}
              </p>

              {/* Progress dots + Discreet Actions */}
              <div className="mt-4 flex items-center justify-between gap-2">
                {!isFinalStep ? (
                  <button
                    type="button"
                    onClick={handleSkipTutorial}
                    className={`text-[12.5px] font-medium px-2 py-1 -ml-2 rounded-lg transition-colors cursor-pointer ${
                      isDark
                        ? 'text-[#858585] hover:text-[#FFFFFF]'
                        : 'text-[#858585] hover:text-[#000000]'
                    }`}
                  >
                    Pular
                  </button>
                ) : (
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {visibleSteps.map((s, idx) => (
                      <span
                        key={s.id}
                        className={`h-1 rounded-full transition-all duration-200 ${
                          idx === stepIndex
                            ? `w-3.5 ${isDark ? 'bg-[#FFFFFF]' : 'bg-[#000000]'}`
                            : `w-1 ${isDark ? 'bg-white/25' : 'bg-black/15'}`
                        }`}
                      />
                    ))}
                  </div>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleNext}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold tracking-tight transition-opacity hover:opacity-90 cursor-pointer ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#000000]'
                      : 'bg-[#171717] text-[#FFFFFF]'
                  }`}
                >
                  <span>{isFinalStep ? 'Explorar o mapa' : 'Continuar'}</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} />
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MapOnboardingTutorial;
