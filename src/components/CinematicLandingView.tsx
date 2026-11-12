import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight, ChevronDown, Clock, MapPin, Mountain, Utensils, X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import gsap from 'gsap';

const FAQ_ITEMS = [
  {
    id: 'faq-1',
    question: 'Como o Monvian organiza meus passeios em Campos do Jordão?',
    answer:
      'O Monvian reúne os melhores pontos turísticos, restaurantes, cafeterias e experiências da serra em roteiros interativos com mapa em tempo real, facilitando cada etapa da sua viagem.',
  },
  {
    id: 'faq-2',
    question: 'O aplicativo funciona durante o passeio pela cidade?',
    answer:
      'Sim. Ao escolher um roteiro ou explorar o mapa, você acompanha sua localização ao vivo, distância até as próximas paradas e sugestões próximas no seu iPhone.',
  },
  {
    id: 'faq-3',
    question: 'Como faço para começar a usar?',
    answer:
      'Basta tocar em “Criar minha conta”, informar seu nome, e-mail e senha em poucos segundos para acessar todos os roteiros e experiências de Campos do Jordão.',
  },
];

const CARD_1_SLIDES = [
  '/assets/aistudio/card_slide_1_1.jpg',
  '/assets/aistudio/card_slide_1_2.jpg',
  '/assets/aistudio/card_slide_1_3.jpg',
  '/assets/aistudio/card_slide_1_4.jpg',
];

const CARD_2_SLIDES = [
  '/assets/aistudio/card_slide_2_1.jpg',
  '/assets/aistudio/card_slide_2_2.jpg',
  '/assets/aistudio/card_slide_2_3.jpg',
  '/assets/aistudio/card_slide_2_4.jpg',
];

const CARD_3_SLIDES = [
  '/assets/aistudio/card_slide_3_1.jpg',
  '/assets/aistudio/card_slide_3_2.jpg',
  '/assets/aistudio/card_slide_3_3.jpg',
  '/assets/aistudio/card_slide_3_4.jpg',
];

interface CinematicLandingViewProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onStartRegister: () => void;
  onOpenLogin: () => void;
}

export const CinematicLandingView: React.FC<CinematicLandingViewProps> = ({
  scrollContainerRef,
  onStartRegister,
  onOpenLogin,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Transição suave das fotos e contador persistente de usuários (+3 a +5 aleatório a cada 3s estilo YouTube)
  const [photoSlideIndex, setPhotoSlideIndex] = useState(0);
  const [userCount, setUserCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('monvian_social_user_count');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= 38937) {
          return parsed;
        }
      }
    } catch {}
    return 38937;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setPhotoSlideIndex((prev) => (prev + 1) % 4);
      setUserCount((prev) => {
        const randomStep = Math.floor(Math.random() * 3) + 3; // Aleatório entre 3, 4 e 5
        const next = prev + randomStep;
        try {
          localStorage.setItem('monvian_social_user_count', String(next));
        } catch {}
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Asset readiness for orchestrated entrance animation (starts true for zero blank screen)
  const [assetsReady, setAssetsReady] = useState(true);
  const [isHeroInView, setIsHeroInView] = useState(true);

  // Guarantee hero starts at top on mount
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (scroller) {
      scroller.scrollTop = 0;
    }
  }, [scrollContainerRef]);

  // Navigation bar states
  const [navVisible, setNavVisible] = useState(true);
  const [navLightTheme, setNavLightTheme] = useState(false);
  const lastScrollTopRef = useRef(0);

  // FAQ state
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-1');

  // Hero & Scroll animation refs
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const presentationSectionRef = useRef<HTMLElement | null>(null);
  const presentationContentRef = useRef<HTMLDivElement | null>(null);
  const sectionCloudVeilRef = useRef<HTMLDivElement | null>(null);
  const sectionCloudCenterRef = useRef<HTMLDivElement | null>(null);
  const sectionCloudLeftRef = useRef<HTMLDivElement | null>(null);
  const sectionCloudRightRef = useRef<HTMLDivElement | null>(null);
  const skyLayerRef = useRef<HTMLDivElement | null>(null);
  const sunGlowRef = useRef<HTMLDivElement | null>(null);
  const cloudsFarRef = useRef<HTMLDivElement | null>(null);
  const cloudsMidRef = useRef<HTMLDivElement | null>(null);
  const islandScrollWrapRef = useRef<HTMLDivElement | null>(null);
  const islandBottomCloudBedRef = useRef<HTMLDivElement | null>(null);
  const cloudsFrontRef = useRef<HTMLDivElement | null>(null);
  const risingBottomCloudsRef = useRef<HTMLDivElement | null>(null);
  const heroLogoWrapRef = useRef<HTMLDivElement | null>(null);
  const heroTextWrapRef = useRef<HTMLDivElement | null>(null);
  const heroCtaWrapRef = useRef<HTMLDivElement | null>(null);

  // Separate Parallax wrappers so mouse parallax never conflicts with scroll or entrance transforms
  const parallaxSkyRef = useRef<HTMLDivElement | null>(null);
  const parallaxFarRef = useRef<HTMLDivElement | null>(null);
  const parallaxMidRef = useRef<HTMLDivElement | null>(null);
  const parallaxIslandRef = useRef<HTMLDivElement | null>(null);
  const parallaxFrontRef = useRef<HTMLDivElement | null>(null);

  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
  }, []);

  // 1. Preload primary 3D island and logo assets before starting entrance sequence
  useEffect(() => {
    let mounted = true;
    const islandImg = new Image();
    const logoImg = new Image();
    let loadedCount = 0;

    const markReady = () => {
      if (!mounted) return;
      loadedCount += 1;
      if (loadedCount >= 2) {
        setAssetsReady(true);
      }
    };

    islandImg.onload = markReady;
    islandImg.onerror = markReady;
    logoImg.onload = markReady;
    logoImg.onerror = markReady;

    islandImg.src = '/assets/aistudio/monvian_island_3d.webp';
    logoImg.src = '/assets/aistudio/monvian_logo_white_transparent.png';

    const fallbackTimer = window.setTimeout(() => {
      if (mounted) setAssetsReady(true);
    }, 600);

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  // 2. IntersectionObserver to pause continuous animations when hero leaves viewport
  useEffect(() => {
    const target = heroSectionRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsHeroInView(entry.isIntersecting);
        }
      },
      { threshold: 0.02 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // 3. Desktop Cursor Parallax with requestAnimationFrame smoothing (inverted relative to cursor)
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (typeof window === 'undefined') return;
    const isFinePointer = window.matchMedia?.('(pointer: fine) and (min-width: 1024px)').matches;
    if (!isFinePointer) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId: number | null = null;

    const updateParallax = () => {
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;

      const ix = -currentX;
      const iy = -currentY;

      if (parallaxSkyRef.current) {
        parallaxSkyRef.current.style.transform = `translate3d(${(ix * 3).toFixed(2)}px, 0px, 0)`;
      }
      if (parallaxFarRef.current) {
        parallaxFarRef.current.style.transform = `translate3d(${(ix * 8).toFixed(2)}px, ${(iy * 6).toFixed(2)}px, 0)`;
      }
      if (parallaxMidRef.current) {
        parallaxMidRef.current.style.transform = `translate3d(${(ix * 14).toFixed(2)}px, ${(iy * 10).toFixed(2)}px, 0)`;
      }
      if (parallaxIslandRef.current) {
        parallaxIslandRef.current.style.transform = `translate3d(${(ix * 20).toFixed(2)}px, ${(iy * 14).toFixed(2)}px, 0)`;
      }
      if (parallaxFrontRef.current) {
        parallaxFrontRef.current.style.transform = `translate3d(${(ix * 26).toFixed(2)}px, ${(iy * 18).toFixed(2)}px, 0)`;
      }

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        rafId = window.requestAnimationFrame(updateParallax);
      } else {
        rafId = null;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isHeroInView) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      targetX = Math.max(-1, Math.min(1, nx));
      targetY = Math.max(-1, Math.min(1, ny));
      if (rafId === null) {
        rafId = window.requestAnimationFrame(updateParallax);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion, isHeroInView]);

  // 4. Synchronized Cinematic Scroll Transition:
  // Clouds rise UPWARD over the 3D island as the user scrolls down, and then dissolve seamlessly
  // into pure #FFFFFF so there is NEVER any horizontal seam or cut above #como-funciona.
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    const hero = heroSectionRef.current;
    if (!scroller || !hero) return;

    const tl = gsap.timeline({ paused: true });

    if (prefersReducedMotion) {
      tl.to(
        [heroLogoWrapRef.current, heroTextWrapRef.current, heroCtaWrapRef.current],
        { opacity: 0, duration: 0.5, ease: 'none' },
        0
      ).to(
        islandScrollWrapRef.current,
        { opacity: 0, duration: 0.6, ease: 'none' },
        0.1
      );
    } else {
      // 1. Sky stays anchored vertically (no y shift that could expose a bottom edge) and dissolves smoothly into pure white
      tl.to(
        skyLayerRef.current,
        { opacity: 0, duration: 0.82, ease: 'power1.inOut' },
        0.12
      )
        .to(
          sunGlowRef.current,
          { opacity: 0, duration: 0.7, ease: 'power1.inOut' },
          0.1
        )
        // 2. Distant clouds rise discreetly and fade out completely into white
        .to(
          cloudsFarRef.current,
          { y: -65, scale: 1.06, opacity: 0, duration: 0.75, ease: 'power1.inOut' },
          0.05
        )
        // 3. Intermediate clouds rise and dissolve completely before reaching the lower section
        .to(
          cloudsMidRef.current,
          { y: -115, scale: 1.14, opacity: 0, duration: 0.8, ease: 'power1.inOut' },
          0.06
        )
        // 4. Scroll-only cloud bed rises from below to cover the 3D island, then dissolves into white
        .fromTo(
          islandBottomCloudBedRef.current,
          {
            y: 90,
            scale: 0.92,
            opacity: 0,
          },
          {
            y: -90,
            scale: 1.38,
            opacity: 1,
            duration: 0.42,
            ease: 'power1.out',
          },
          0.01
        )
        .to(
          islandBottomCloudBedRef.current,
          {
            y: -165,
            scale: 1.52,
            opacity: 0,
            duration: 0.42,
            ease: 'power1.inOut',
          },
          0.44
        )
        // 5, 6. Original 3D Island rises, scales down progressively, and disappears behind the rising clouds
        .to(
          islandScrollWrapRef.current,
          {
            y: -95,
            scale: 0.78,
            opacity: 0,
            filter: 'blur(9px)',
            duration: 0.62,
            ease: 'power1.inOut',
          },
          0.03
        )
        // 7. Foreground clouds surge upward over the island, then dissolve smoothly into pure white (zero edge)
        .fromTo(
          cloudsFrontRef.current,
          {
            y: 65,
            scale: 0.96,
            opacity: 0,
          },
          {
            y: -120,
            scale: 1.24,
            opacity: 1,
            duration: 0.44,
            ease: 'power1.out',
          },
          0.01
        )
        .to(
          cloudsFrontRef.current,
          {
            y: -220,
            scale: 1.36,
            opacity: 0,
            duration: 0.44,
            ease: 'power1.inOut',
          },
          0.46
        )
        // 8. Pure white volumetric cloud billows rise from below with zero grey/blue tint
        .fromTo(
          risingBottomCloudsRef.current,
          {
            y: 40,
            scale: 1,
            opacity: 0,
          },
          {
            y: -260,
            scale: 1.18,
            opacity: 1,
            duration: 0.75,
            ease: 'power1.out',
          },
          0.02
        )
        // 9. Logo and headline texts fade out smoothly
        .to(
          heroLogoWrapRef.current,
          { y: -30, opacity: 0, duration: 0.42, ease: 'power1.in' },
          0.08
        )
        .to(
          heroTextWrapRef.current,
          { y: -42, opacity: 0, scale: 0.96, duration: 0.45, ease: 'power1.in' },
          0.1
        )
        // 10. Social Proof fades out smoothly as user scrolls toward Section 2
        .to(
          heroCtaWrapRef.current,
          { y: -36, opacity: 0, scale: 0.95, duration: 0.46, ease: 'power1.in' },
          0.08
        );
    }

    let rafScrollId: number | null = null;

    const syncScroll = () => {
      rafScrollId = null;
      if (!scroller || !hero) return;

      const scrollTop = scroller.scrollTop;
      const viewportHeight = scroller.clientHeight || window.innerHeight || 844;
      const transitionDistance = Math.max(280, viewportHeight * 0.6);
      const progress = Math.max(0, Math.min(1, scrollTop / transitionDistance));

      tl.progress(progress);

      // Update floating navbar visibility & adaptive theme
      const delta = scrollTop - lastScrollTopRef.current;
      if (scrollTop < 32) {
        setNavVisible(true);
      } else if (delta > 6) {
        setNavVisible(false);
      } else if (delta < -5) {
        setNavVisible(true);
      }
      lastScrollTopRef.current = scrollTop;

      setNavLightTheme(scrollTop > viewportHeight * 0.36);

      // Seamless pure-white cloud parting for the lower presentation section (#como-funciona):
      const sectionStart = viewportHeight * 0.12;
      const sectionEnd = viewportHeight * 0.60;
      const sectionReveal = prefersReducedMotion
        ? 1
        : Math.max(0, Math.min(1, (scrollTop - sectionStart) / Math.max(1, sectionEnd - sectionStart)));

      if (presentationContentRef.current) {
        presentationContentRef.current.style.opacity = '1';
        presentationContentRef.current.style.transform = 'none';
      }

      if (sectionCloudVeilRef.current) {
        sectionCloudVeilRef.current.style.display = 'none';
      }
    };

    const onScroll = () => {
      if (rafScrollId === null) {
        rafScrollId = window.requestAnimationFrame(syncScroll);
      }
    };

    syncScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafScrollId !== null) window.cancelAnimationFrame(rafScrollId);
      tl.kill();
    };
  }, [scrollContainerRef, prefersReducedMotion]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      triggerHaptic();
      const scroller = scrollContainerRef.current;
      const target = document.getElementById(sectionId);
      if (!scroller || !target) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offsetTop = targetRect.top - scrollerRect.top + scroller.scrollTop - 72;
      scroller.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    },
    [scrollContainerRef, prefersReducedMotion, triggerHaptic]
  );

  // Title words split into characters for letter-by-letter masked entrance
  const renderMaskedWord = (word: string, baseCharIdx: number, isAccent = false) => {
    return (
      <span
        className={`inline-block whitespace-nowrap ${
          isAccent
            ? 'text-[#4389F5] drop-shadow-[0_2px_18px_rgba(38,115,232,0.45)]'
            : 'text-[#FFFFFF]'
        }`}
      >
        {word.split('').map((char, idx) => {
          const delay = prefersReducedMotion ? 0 : 0.04 + (baseCharIdx + idx) * 0.012;
          return (
            <span
              key={`${word}-${idx}`}
              className="inline-block overflow-hidden align-bottom pb-[0.06em] -mb-[0.06em]"
            >
              <motion.span
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { y: '110%', opacity: 0, rotateZ: 2 }
                }
                animate={
                  assetsReady
                    ? { y: '0%', opacity: 1, rotateZ: 0 }
                    : prefersReducedMotion
                      ? { opacity: 0 }
                      : { y: '110%', opacity: 0, rotateZ: 2 }
                }
                transition={{
                  duration: prefersReducedMotion ? 0.2 : 0.54,
                  ease: [0.22, 1, 0.36, 1],
                  delay,
                }}
                className="inline-block will-change-transform"
              >
                {char}
              </motion.span>
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div
      className="relative w-full select-none bg-[#FFFFFF] text-[#080808] overflow-x-clip"
      style={{
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Keyframes for continuous 7.5s island float and slow rightward cloud movement */}
      <style>{`
        @keyframes monvianIslandFloat {
          0%, 100% {
            transform: translate3d(0, 0px, 0) rotate(0deg);
          }
          50% {
            transform: translate3d(0, -8px, 0) rotate(0.28deg);
          }
        }
        /* Seamless continuous rightward movement (-50% -> 0% on a 200% width dual-panel track) */
        @keyframes monvianCloudTrackRightSlow {
          0% {
            transform: translate3d(-50%, 0px, 0);
          }
          100% {
            transform: translate3d(0%, 0px, 0);
          }
        }
        @keyframes monvianCloudCenterDriftRight {
          0% {
            transform: translate3d(-82%, 0px, 0) scale(1.06);
            opacity: 0;
          }
          15% {
            opacity: 0.9;
          }
          85% {
            opacity: 0.9;
          }
          100% {
            transform: translate3d(-18%, 0px, 0) scale(1.1);
            opacity: 0;
          }
        }
        .monvian-cloud-soft-mask {
          -webkit-mask-image: radial-gradient(ellipse 50% 44% at 50% 50%, rgba(0,0,0,1) 38%, rgba(0,0,0,0.65) 68%, rgba(0,0,0,0) 96%);
          mask-image: radial-gradient(ellipse 50% 44% at 50% 50%, rgba(0,0,0,1) 38%, rgba(0,0,0,0.65) 68%, rgba(0,0,0,0) 96%);
        }
        @media (prefers-reduced-motion: reduce) {
          .monvian-anim-float,
          .monvian-anim-cloud {
            animation: none !important;
          }
        }
      `}</style>

      {/* =========================================================================
          PARTE 5 — BARRA DE NAVEGAÇÃO TRANSLÚCIDA FLUTUANTE NO TOPO
         ========================================================================= */}
      <motion.header
        aria-label="Navegação de apresentação Monvian"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
        animate={
          assetsReady
            ? {
                opacity: navVisible ? 1 : 0,
                y: navVisible ? 0 : -72,
              }
            : { opacity: 0, y: -18 }
        }
        transition={{
          duration: prefersReducedMotion ? 0.18 : 0.4,
          ease: [0.22, 1, 0.36, 1],
          delay: prefersReducedMotion ? 0 : 0.05,
        }}
        onFocusCapture={() => setNavVisible(true)}
        style={{
          top: 'max(12px, calc(env(safe-area-inset-top, 0px) + 8px))',
        }}
        className={`fixed left-4 right-4 z-[125] max-w-[400px] md:max-w-[520px] mx-auto pointer-events-auto transition-colors duration-300 rounded-full px-3.5 sm:px-5 py-2 backdrop-blur-xl border ${
          navLightTheme
            ? 'bg-white/88 border-black/[0.08] text-[#080808] shadow-[0_8px_28px_rgba(8,8,8,0.08)]'
            : 'bg-white/[0.15] border-white/[0.24] text-white shadow-[0_10px_32px_rgba(12,35,68,0.18)]'
        }`}
      >
        <nav className="flex items-center justify-between gap-1 sm:gap-3 text-[12px] sm:text-[13px] font-medium tracking-[-0.01em]">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            onClick={() => {
              triggerHaptic();
              onStartRegister();
            }}
            className={`px-2 py-1 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] ${
              navLightTheme
                ? 'text-[#080808]/85 hover:text-[#2673E8]'
                : 'text-white/95 hover:text-white'
            }`}
          >
            Criar conta
          </motion.button>
          <motion.button
            id="btn-landing-top-login"
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            onClick={() => {
              triggerHaptic();
              onOpenLogin();
            }}
            className={`px-2 py-1 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] ${
              navLightTheme
                ? 'text-[#080808]/85 hover:text-[#2673E8]'
                : 'text-white/95 hover:text-white'
            }`}
          >
            Entrar
          </motion.button>
          <button
            type="button"
            onClick={() => scrollToSection('roteiros')}
            className={`px-2 py-1 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] ${
              navLightTheme
                ? 'text-[#080808]/85 hover:text-[#2673E8]'
                : 'text-white/95 hover:text-white'
            }`}
          >
            Roteiros
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('duvidas')}
            className={`px-2 py-1 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] ${
              navLightTheme
                ? 'text-[#080808]/85 hover:text-[#2673E8]'
                : 'text-white/95 hover:text-white'
            }`}
          >
            Dúvidas
          </button>
        </nav>
      </motion.header>

      {/* =========================================================================
          HERO CINEMATOGRÁFICO (100svh) — ILHA 3D 100% VISÍVEL POR COMPLETO
         ========================================================================= */}
      <section
        ref={heroSectionRef}
        aria-label="Apresentação principal Monvian — Campos do Jordão"
        className="relative z-[70] w-full h-[100svh] min-h-[640px] flex flex-col justify-between bg-[#FFFFFF] overflow-hidden"
      >
        {/* 1. CÉU TRIDIMENSIONAL MULTICAMADAS (Termina em branco puro #FFFFFF muito antes da base para zero corte horizontal) */}
        <div
          ref={parallaxSkyRef}
          className="absolute inset-x-[-16px] top-[-24px] bottom-0 pointer-events-none will-change-transform"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={assetsReady ? { opacity: 1 } : { opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.25 : 1.0,
              ease: [0.22, 1, 0.36, 1],
              delay: prefersReducedMotion ? 0 : 0.1,
            }}
            className="w-full h-full relative"
          >
            <div
              ref={skyLayerRef}
              className="w-full h-full relative will-change-transform"
              style={{
                background:
                  'linear-gradient(180deg, #1F518A 0%, #2B66A3 16%, #3A78B4 34%, #6F9EC9 52%, #B8D5F5 68%, #EAF3FF 80%, #F7FAFF 88%, #FFFFFF 94%, #FFFFFF 100%)',
              }}
            >
              {/* Brilho Solar Radial e Iluminação Atmosférica */}
              <div
                ref={sunGlowRef}
                className="absolute inset-0 will-change-transform"
                style={{
                  background:
                    'radial-gradient(circle at 62% 28%, rgba(255, 249, 235, 0.44) 0%, rgba(234, 217, 194, 0.22) 28%, rgba(184, 213, 245, 0.12) 54%, rgba(43, 102, 163, 0) 78%), radial-gradient(ellipse 95% 42% at 50% 62%, rgba(255, 255, 255, 0.85) 0%, rgba(234, 243, 255, 0.45) 54%, rgba(184, 213, 245, 0) 100%)',
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* 3. GRUPO 1 — NUVENS DISTANTES (Atrás da ilha, movendo-se lentamente para a direita) */}
        <div
          ref={parallaxFarRef}
          className="absolute inset-0 pointer-events-none z-[12] will-change-transform"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={assetsReady ? { opacity: 0.78, y: 0 } : { opacity: 0, y: 18 }}
            transition={{
              duration: prefersReducedMotion ? 0.25 : 1.05,
              ease: [0.22, 1, 0.36, 1],
              delay: prefersReducedMotion ? 0 : 0.32,
            }}
            className="relative w-full h-full"
          >
            <div ref={cloudsFarRef} className="relative w-full h-full will-change-transform">
              <div
                style={{
                  animation:
                    isHeroInView && !prefersReducedMotion
                      ? 'monvianCloudTrackRightSlow 24s linear infinite'
                      : 'none',
                }}
                className="monvian-anim-cloud absolute top-0 left-0 w-[200%] h-full flex will-change-transform"
              >
                {[0, 1].map((panelIdx) => (
                  <div key={`far-panel-${panelIdx}`} className="relative w-1/2 h-full shrink-0">
                    <picture>
                      <source srcSet="/assets/aistudio/cloud_volumetric_1.webp" type="image/webp" />
                      <img
                        src="/assets/aistudio/cloud_volumetric_1.webp"
                        alt=""
                        decoding="async"
                        className="monvian-cloud-soft-mask absolute top-[15%] -left-[8%] md:left-[4%] w-[64vw] max-w-[390px] md:w-[32vw] md:max-w-[460px] opacity-72 select-none"
                      />
                    </picture>

                    <picture>
                      <source srcSet="/assets/aistudio/cloud_volumetric_2.webp" type="image/webp" />
                      <img
                        src="/assets/aistudio/cloud_volumetric_2.webp"
                        alt=""
                        decoding="async"
                        className="monvian-cloud-soft-mask absolute top-[19%] right-[-6%] md:right-[8%] w-[66vw] max-w-[410px] md:w-[34vw] md:max-w-[490px] opacity-68 select-none"
                      />
                    </picture>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* 4. GRUPO 2 — NUVENS INTERMEDIÁRIAS ATRÁS DA ILHA (z-[18] < z-[24], movendo-se lentamente para a direita) */}
        <div
          ref={parallaxMidRef}
          className="absolute inset-0 pointer-events-none z-[18] will-change-transform"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={
              assetsReady
                ? { opacity: 0.92, y: 0, scale: 1 }
                : { opacity: 0, y: 24, scale: 0.96 }
            }
            transition={{
              duration: prefersReducedMotion ? 0.25 : 1.1,
              ease: [0.22, 1, 0.36, 1],
              delay: prefersReducedMotion ? 0 : 0.52,
            }}
            className="relative w-full h-full"
          >
            <div ref={cloudsMidRef} className="relative w-full h-full will-change-transform">
              <div
                style={{
                  animation:
                    isHeroInView && !prefersReducedMotion
                      ? 'monvianCloudTrackRightSlow 16s linear infinite'
                      : 'none',
                }}
                className="monvian-anim-cloud absolute top-0 left-0 w-[200%] h-full flex will-change-transform"
              >
                {[0, 1].map((panelIdx) => (
                  <div key={`mid-panel-${panelIdx}`} className="relative w-1/2 h-full shrink-0">
                    <picture>
                      <source srcSet="/assets/aistudio/cloud_volumetric_2.webp" type="image/webp" />
                      <img
                        src="/assets/aistudio/cloud_volumetric_2.webp"
                        alt=""
                        decoding="async"
                        className="monvian-cloud-soft-mask absolute top-[35%] -left-[12%] md:left-[6%] w-[80vw] max-w-[490px] md:w-[40vw] md:max-w-[580px] opacity-90 select-none"
                      />
                    </picture>

                    <picture>
                      <source srcSet="/assets/aistudio/cloud_volumetric_1.webp" type="image/webp" />
                      <img
                        src="/assets/aistudio/cloud_volumetric_1.webp"
                        alt=""
                        decoding="async"
                        className="monvian-cloud-soft-mask absolute top-[38%] right-[-10%] md:right-[6%] w-[82vw] max-w-[510px] md:w-[42vw] md:max-w-[600px] opacity-90 select-none"
                      />
                    </picture>
                  </div>
                ))}
              </div>

              {/* Nuvens volumétricas atrás da base da ilha (z-[18], atrás da ilha z-[24], movendo-se para a direita) */}
              <picture>
                <source srcSet="/assets/aistudio/cloud_volumetric_3.webp" type="image/webp" />
                <img
                  src="/assets/aistudio/cloud_volumetric_3.webp"
                  alt=""
                  decoding="async"
                  style={{
                    animation:
                      isHeroInView && !prefersReducedMotion
                        ? 'monvianCloudCenterDriftRight 14s linear infinite'
                        : 'none',
                  }}
                  className="monvian-anim-cloud monvian-cloud-soft-mask absolute top-[48%] left-1/2 w-[104vw] max-w-[640px] md:w-[54vw] md:max-w-[780px] opacity-90 select-none"
                />
              </picture>

              <picture>
                <source srcSet="/assets/aistudio/cloud_volumetric_3.webp" type="image/webp" />
                <img
                  src="/assets/aistudio/cloud_volumetric_3.webp"
                  alt=""
                  decoding="async"
                  style={{
                    animation:
                      isHeroInView && !prefersReducedMotion
                        ? 'monvianCloudCenterDriftRight 14s linear -7s infinite'
                        : 'none',
                  }}
                  className="monvian-anim-cloud monvian-cloud-soft-mask absolute top-[49%] left-1/2 w-[104vw] max-w-[640px] md:w-[54vw] md:max-w-[780px] opacity-85 select-none"
                />
              </picture>

              {/* Brilho atmosférico central atrás da ilha */}
              <div
                className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[780px] h-[34vh] rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.55) 48%, rgba(255, 255, 255, 0) 78%)',
                  filter: 'blur(16px)',
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* 5. ELEMENTO PRINCIPAL: ILHA 3D ORIGINAL DE CAMPOS DO JORDÃO (z-[24]) */}
        <div
          ref={parallaxIslandRef}
          className="absolute inset-0 pointer-events-none z-[24] flex items-center justify-center will-change-transform"
        >
          <div className="relative w-full flex items-center justify-center translate-y-[13.5vh] sm:translate-y-[12vh] md:translate-y-[11vh]">
            <motion.div
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 40, scale: 0.94, rotate: -1.1 }
              }
              animate={
                assetsReady
                  ? { opacity: 1, y: 0, scale: 1, rotate: 0 }
                  : prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 40, scale: 0.94, rotate: -1.1 }
              }
              transition={{
                duration: prefersReducedMotion ? 0.2 : 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: prefersReducedMotion ? 0 : 0.05,
              }}
              className="relative w-[92vw] max-w-[425px] sm:max-w-[475px] md:w-[46vw] md:max-w-[650px] lg:max-w-[700px] flex items-center justify-center"
            >
              {/* Continuous 7.5s subtle floating wrapper */}
              <div
                style={{
                  animation:
                    isHeroInView && !prefersReducedMotion
                      ? 'monvianIslandFloat 7.5s ease-in-out infinite'
                      : 'none',
                }}
                className="monvian-anim-float relative w-full flex items-center justify-center will-change-transform"
              >
                {/* Maquete 3D Original de Campos do Jordão */}
                <div ref={islandScrollWrapRef} className="w-full will-change-transform">
                  <picture className="w-full block">
                    <source
                      srcSet="/assets/aistudio/monvian_island_3d.webp"
                      type="image/webp"
                    />
                    <img
                      src="/assets/aistudio/monvian_island_3d.webp"
                      alt="Maquete tridimensional de Campos do Jordão"
                      width={1347}
                      height={879}
                      fetchPriority="high"
                      decoding="async"
                      draggable={false}
                      style={{
                        filter: 'drop-shadow(0 20px 30px rgba(18, 48, 89, 0.22))',
                      }}
                      className="w-full h-auto block object-contain select-none"
                    />
                  </picture>
                </div>

                {/* CAMADA DE NUVENS DE TRANSIÇÃO DE SCROLL */}
                <div
                  ref={islandBottomCloudBedRef}
                  style={{ opacity: 0 }}
                  className="absolute inset-x-[-24%] -bottom-[24%] h-[68%] pointer-events-none z-[26] will-change-transform"
                  aria-hidden="true"
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        'radial-gradient(ellipse 62% 54% at 50% 50%, #FFFFFF 0%, rgba(255, 255, 255, 0.96) 48%, rgba(255, 255, 255, 0) 100%)',
                      filter: 'blur(12px)',
                    }}
                  />
                  <picture>
                    <source srcSet="/assets/aistudio/cloud_volumetric_3.webp" type="image/webp" />
                    <img
                      src="/assets/aistudio/cloud_volumetric_3.webp"
                      alt=""
                      decoding="async"
                      className="monvian-cloud-soft-mask absolute -top-[8%] left-1/2 -translate-x-1/2 w-[96%] h-auto opacity-95 select-none"
                    />
                  </picture>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* 6. GRUPO 3 — NUVENS FRONTAIS DE TRANSIÇÃO (Invisíveis no topo para a figura 3D aparecer 100% completa; sobem ao rolar e dissolvem no branco) */}
        <div
          ref={parallaxFrontRef}
          className="absolute inset-0 pointer-events-none z-[30] will-change-transform"
          aria-hidden="true"
        >
          <div
            ref={cloudsFrontRef}
            style={{ opacity: 0 }}
            className="relative w-full h-full will-change-transform"
          >
            <picture>
              <source srcSet="/assets/aistudio/cloud_volumetric_3.webp" type="image/webp" />
              <img
                src="/assets/aistudio/cloud_volumetric_3.webp"
                alt=""
                decoding="async"
                className="monvian-cloud-soft-mask absolute top-[54%] left-1/2 -translate-x-1/2 w-[108vw] max-w-[660px] md:w-[56vw] md:max-w-[820px] opacity-95 select-none"
              />
            </picture>
          </div>
        </div>

        {/* 6.5 CORTINA DE NUVENS BRANCAS PURAS (#FFFFFF) QUE SOBE DE BAIXO DURANTE O SCROLL SEM NENHUM CORTE OU SOMBRA CINZA */}
        <div
          ref={risingBottomCloudsRef}
          style={{ opacity: 0 }}
          className="absolute inset-x-[-15%] -bottom-[32vh] h-[68vh] pointer-events-none z-[32] will-change-transform"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 75% 65% at 50% 60%, #FFFFFF 0%, #FFFFFF 52%, rgba(255,255,255,0.92) 72%, rgba(255,255,255,0) 100%)',
              filter: 'blur(16px)',
            }}
          />
          <div
            className="absolute -top-[8vh] left-[-5%] w-[65%] h-[36vh] rounded-full"
            style={{
              background:
                'radial-gradient(ellipse at center, #FFFFFF 0%, rgba(255,255,255,0.95) 46%, rgba(255,255,255,0) 80%)',
              filter: 'blur(18px)',
            }}
          />
          <div
            className="absolute -top-[8vh] right-[-5%] w-[65%] h-[36vh] rounded-full"
            style={{
              background:
                'radial-gradient(ellipse at center, #FFFFFF 0%, rgba(255,255,255,0.95) 46%, rgba(255,255,255,0) 80%)',
              filter: 'blur(18px)',
            }}
          />
        </div>

        {/* 7. COMPOSIÇÃO DO HERO: LOGO, TÍTULO PRINCIPAL E SUBTÍTULO NO TOPO E PROVA SOCIAL NA BASE (ACIMA DAS NUVENS) */}
        <div
          className="relative z-[85] w-full h-full max-w-[1280px] mx-auto px-5 sm:px-8 flex flex-col justify-between pointer-events-none"
          style={{
            paddingTop: 'max(136px, calc(env(safe-area-inset-top, 0px) + 124px))',
            paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
          }}
        >
          {/* Topo do Hero: Logo original Monvian + Título Principal + Subtítulo */}
          <div className="w-full max-w-[430px] md:max-w-[680px] mx-auto flex flex-col items-center text-center">
            <div ref={heroLogoWrapRef} className="will-change-transform">
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={assetsReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{
                  duration: prefersReducedMotion ? 0.2 : 0.45,
                  ease: [0.22, 1, 0.36, 1],
                  delay: prefersReducedMotion ? 0 : 0.02,
                }}
                className="mb-3 sm:mb-3.5 flex items-center justify-center"
              >
                <img
                  src="/assets/aistudio/monvian_logo_white_transparent.png"
                  alt="Monvian"
                  width={286}
                  height={94}
                  className="h-[34px] sm:h-[38px] md:h-[44px] w-auto object-contain select-none drop-shadow-[0_4px_16px_rgba(12,35,68,0.28)]"
                />
              </motion.div>
            </div>

            <div
              ref={heroTextWrapRef}
              className="w-full flex flex-col items-center will-change-transform"
            >
              <h1
                className="text-center text-[32px] sm:text-[40px] md:text-[54px] font-extrabold tracking-[-0.032em] leading-[1.06] text-white mb-2.5 sm:mb-3.5 drop-shadow-[0_6px_24px_rgba(14,42,79,0.28)]"
                style={{
                  fontFamily:
                    "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  textWrap: 'balance',
                }}
              >
                {renderMaskedWord('Campos', 0)}{' '}
                {renderMaskedWord('do', 6)}{' '}
                {renderMaskedWord('Jordão', 8)}
                <br />
                {renderMaskedWord('do', 14)}{' '}
                {renderMaskedWord('seu', 16, true)}{' '}
                {renderMaskedWord('jeito.', 19)}
              </h1>
            </div>
          </div>

          {/* Base do Hero: Seção de Prova Social Minimalista e Nativa (100% acima das nuvens) */}
          <div
            ref={heroCtaWrapRef}
            className="relative z-[95] w-full max-w-[380px] sm:max-w-[420px] mx-auto flex flex-col items-center pb-[6.5vh] sm:pb-[5vh] pointer-events-auto will-change-transform"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0.15 : 0.35,
                ease: [0.22, 1, 0.36, 1],
                delay: prefersReducedMotion ? 0 : 0.08,
              }}
              className="relative z-[95] flex items-center justify-center gap-5 sm:gap-6 select-none"
              aria-label={`${userCount.toLocaleString('pt-BR')} Usuários no Monvian`}
            >
              {/* 3 fotos de perfil circulares sobrepostas em camadas (nítidas e acima das nuvens) */}
              <div className="relative z-[95] flex items-center -space-x-2.5 shrink-0">
                {[
                  {
                    src: '/assets/aistudio/social_user_1.jpg',
                    alt: 'Usuário Monvian 1',
                    zIndex: 'z-[3]',
                  },
                  {
                    src: '/assets/aistudio/social_user_2.jpg',
                    alt: 'Usuária Monvian 2',
                    zIndex: 'z-[2]',
                  },
                  {
                    src: '/assets/aistudio/social_user_3.jpg',
                    alt: 'Usuário Monvian 3',
                    zIndex: 'z-[1]',
                  },
                ].map((avatar) => (
                  <div
                    key={avatar.src}
                    className={`relative ${avatar.zIndex} w-[42px] h-[42px] sm:w-[44px] sm:h-[44px] rounded-full border-[2.5px] border-white shadow-[0_6px_16px_rgba(14,42,79,0.22)] overflow-hidden bg-white shrink-0`}
                  >
                    <img
                      src={avatar.src}
                      alt={avatar.alt}
                      width={44}
                      height={44}
                      decoding="async"
                      draggable={false}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover block select-none pointer-events-none"
                    />
                  </div>
                ))}
              </div>

              {/* Divisor vertical discreto e visível */}
              <div
                className="relative z-[95] w-[1.5px] h-[38px] sm:h-[40px] bg-[#080808]/20 rounded-full shrink-0"
                aria-hidden="true"
              />

              {/* Número de usuários com animação estilo inscritos do YouTube (+5 a cada 3s, sobe e volta para baixo) e "Usuários" abaixo */}
              <div className="relative z-[95] flex flex-col items-start justify-center text-left">
                <span
                  className="inline-flex items-center text-[25px] sm:text-[27px] font-bold text-[#000000] leading-[1.06] tracking-[-0.02em] tabular-nums"
                  style={{
                    fontFamily:
                      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  {userCount
                    .toLocaleString('pt-BR')
                    .split('')
                    .map((char, idx) => {
                      if (char === '.') {
                        return (
                          <span key={`sep-${idx}`} className="inline-block px-[0.5px]">
                            .
                          </span>
                        );
                      }
                      return (
                        <span
                          key={`digit-slot-${idx}`}
                          className="relative inline-flex flex-col items-center justify-center overflow-hidden h-[1.14em] -my-[0.04em]"
                        >
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={`pos-${idx}-val-${char}`}
                              initial={
                                prefersReducedMotion
                                  ? { opacity: 1, y: '0%' }
                                  : { y: '100%', opacity: 0.25 }
                              }
                              animate={
                                prefersReducedMotion
                                  ? { opacity: 1, y: '0%' }
                                  : {
                                      y: ['100%', '-22%', '0%'],
                                      opacity: [0.25, 1, 1],
                                    }
                              }
                              exit={
                                prefersReducedMotion
                                  ? { opacity: 0 }
                                  : {
                                      y: '-100%',
                                      opacity: 0,
                                      transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
                                    }
                              }
                              transition={{
                                duration: 0.62,
                                times: [0, 0.62, 1],
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="inline-block tabular-nums will-change-transform"
                            >
                              {char}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                      );
                    })}
                </span>
                <span
                  className="text-[14.5px] sm:text-[15.5px] font-medium text-[#000000] leading-[1.2] tracking-[-0.01em] mt-0.5"
                  style={{
                    fontFamily:
                      "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  Usuários
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PARTE 9 — SEÇÃO DE APRESENTAÇÃO DO MONVIAN
          Sem overflow-hidden e sem imagens de nuvem acinzentadas sobre o branco,
          eliminando 100% qualquer corte horizontal visível
         ========================================================================= */}
      <section
        id="como-funciona"
        ref={presentationSectionRef}
        aria-labelledby="monvian-presentation-heading"
        className="relative z-[80] w-full pt-8 sm:pt-12 pb-20 px-5 sm:px-8 bg-[#FFFFFF]"
      >
        {/* Conteúdo editorial e minimalista */}
        <div
          ref={presentationContentRef}
          className="relative z-[82] w-full max-w-[430px] md:max-w-[760px] mx-auto will-change-transform"
        >
          {/* Cabeçalho Editorial da Segunda Seção */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="text-center max-w-[540px] mx-auto mb-6 sm:mb-8"
          >
            <h2
              id="monvian-presentation-heading"
              className="text-[28px] sm:text-[34px] md:text-[40px] font-extrabold tracking-[-0.032em] leading-[1.1] text-[#080808]"
              style={{
                fontFamily:
                  "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                textWrap: 'balance',
                color: '#080808',
              }}
            >
              Visite lugares <span className="text-[#2673E8]" style={{ color: '#2673E8' }}>incríveis</span>
              <br />
              <span style={{ color: '#080808' }}>da cidade.</span>
            </h2>

            <p
              className="mt-2.5 text-[15px] sm:text-[16.5px] font-medium text-[#737780] leading-[1.36] max-w-[340px] sm:max-w-[420px] mx-auto"
              style={{
                fontFamily:
                  "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                color: '#737780',
              }}
            >
              Tudo o que você precisa para aproveitar
              <br />
              sua viagem, em um só lugar.
            </p>
          </motion.div>

          {/* Blocos Visuais Modernos com Fotografias Reais de Campos do Jordão */}
          <div className="flex flex-col gap-3.5 sm:gap-4">
            {/* Bloco Principal Superior — Descubra lugares incríveis */}
            <motion.div
              id="experiencias"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                id="landing-card-explore"
                type="button"
                aria-label="Descubra lugares incríveis — Encontre atrações, restaurantes e muito mais."
                onClick={() => {
                  triggerHaptic();
                  onStartRegister();
                }}
                className="group relative w-full block rounded-[24px] sm:rounded-[28px] overflow-hidden bg-white border-2 border-white ring-1 ring-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.06)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] active:scale-[0.99] transition-transform duration-200"
              >
                <div className="relative w-full aspect-[16/7.8] sm:aspect-[16/7] overflow-hidden">
                  {CARD_1_SLIDES.map((src, idx) => (
                    <img
                      key={src}
                      src={src}
                      alt="Descubra lugares incríveis"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-all duration-1000 ease-in-out group-hover:scale-[1.03] ${
                        idx === photoSlideIndex
                          ? 'opacity-100 scale-100 z-[1]'
                          : 'opacity-0 scale-[1.02] z-0'
                      }`}
                    />
                  ))}
                  {/* Gradiente escuro inferior suave para legibilidade editorial */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none z-[5]" />

                  {/* Textos e ícone elegantes no canto inferior esquerdo */}
                  <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-5 flex flex-col justify-end text-left pointer-events-none z-[10]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                        <MapPin className="w-3.5 h-3.5 fill-[#2673E8] text-[#2673E8]" />
                      </span>
                      <span className="text-[16px] sm:text-[18.5px] font-bold text-white tracking-[-0.015em] leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                        Descubra lugares incríveis
                      </span>
                    </div>
                    <p className="text-[12.5px] sm:text-[13.5px] text-[#E0E4EC] font-medium leading-tight pl-7 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                      Encontre atrações, restaurantes e muito mais.
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>

            {/* Linha Inferior em Duas Colunas — Seus roteiros & Novas experiências */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <motion.div
                id="roteiros"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  id="landing-card-itineraries"
                  type="button"
                  aria-label="Seus roteiros — Planeje seus passeios."
                  onClick={() => {
                    triggerHaptic();
                    onStartRegister();
                  }}
                  className="group relative w-full block rounded-[22px] sm:rounded-[26px] overflow-hidden bg-white border-2 border-white ring-1 ring-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.06)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] active:scale-[0.985] transition-transform duration-200"
                >
                  <div className="relative w-full aspect-[4/3] sm:aspect-[1.25/1] overflow-hidden">
                    {CARD_2_SLIDES.map((src, idx) => (
                      <img
                        key={src}
                        src={src}
                        alt="Seus roteiros"
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-all duration-1000 ease-in-out group-hover:scale-[1.03] ${
                          idx === photoSlideIndex
                            ? 'opacity-100 scale-100 z-[1]'
                            : 'opacity-0 scale-[1.02] z-0'
                        }`}
                      />
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none z-[5]" />

                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 flex flex-col justify-end text-left pointer-events-none z-[10]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Mountain className="w-4 h-4 text-white stroke-[2.3] shrink-0 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]" />
                        <span className="text-[14px] sm:text-[16px] font-bold text-white tracking-[-0.015em] leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                          Seus roteiros
                        </span>
                      </div>
                      <p className="text-[11.5px] sm:text-[12.5px] text-[#E0E4EC] font-medium leading-tight pl-5.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                        Planeje seus passeios.
                      </p>
                    </div>
                  </div>
                </button>
              </motion.div>

              <motion.div
                id="momentos"
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  id="landing-card-experiences"
                  type="button"
                  aria-label="Novas experiências — Descubra o que fazer."
                  onClick={() => {
                    triggerHaptic();
                    onStartRegister();
                  }}
                  className="group relative w-full block rounded-[22px] sm:rounded-[26px] overflow-hidden bg-white border-2 border-white ring-1 ring-white/60 shadow-[0_8px_24px_rgba(15,23,42,0.06)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] active:scale-[0.985] transition-transform duration-200"
                >
                  <div className="relative w-full aspect-[4/3] sm:aspect-[1.25/1] overflow-hidden">
                    {CARD_3_SLIDES.map((src, idx) => (
                      <img
                        key={src}
                        src={src}
                        alt="Novas experiências"
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-all duration-1000 ease-in-out group-hover:scale-[1.03] ${
                          idx === photoSlideIndex
                            ? 'opacity-100 scale-100 z-[1]'
                            : 'opacity-0 scale-[1.02] z-0'
                        }`}
                      />
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none z-[5]" />

                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 flex flex-col justify-end text-left pointer-events-none z-[10]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Utensils className="w-4 h-4 text-white stroke-[2.3] shrink-0 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]" />
                        <span className="text-[14px] sm:text-[16px] font-bold text-white tracking-[-0.015em] leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                          Novas experiências
                        </span>
                      </div>
                      <p className="text-[11.5px] sm:text-[12.5px] text-[#E0E4EC] font-medium leading-tight pl-5.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                        Descubra o que fazer.
                      </p>
                    </div>
                  </div>
                </button>
              </motion.div>
            </div>

            {/* Indicador sutil e moderno de fotos estilo iOS */}
            <div className="flex items-center justify-center gap-1.5 pt-3 pb-1" aria-hidden="true">
              {CARD_1_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoSlideIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === photoSlideIndex
                      ? 'w-7 bg-[#2673E8]'
                      : 'w-2.5 bg-[#DDE2EB] hover:bg-[#CBD5E1]'
                  }`}
                  aria-label={`Foto ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Seção "Dúvidas" (Âncora #duvidas da navegação superior) */}
          <div
            id="duvidas"
            className="mt-12 md:mt-20 max-w-[680px] mx-auto pt-4 sm:pt-6"
          >
            <h3
              className="text-center text-[22px] sm:text-[26px] font-bold tracking-[-0.025em] text-[#080808] mb-5"
              style={{
                fontFamily:
                  "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              Dúvidas frequentes
            </h3>

            <div className="space-y-2">
              {FAQ_ITEMS.map((item) => {
                const isOpen = openFaqId === item.id;
                return (
                  <div key={item.id} className="py-3.5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setOpenFaqId(isOpen ? null : item.id);
                      }}
                      aria-expanded={isOpen}
                      className="w-full py-1.5 text-left flex items-center justify-between gap-4 text-[15.5px] sm:text-[16.5px] font-semibold text-[#080808] hover:text-[#2673E8] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8]"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 text-[#737780] transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#2673E8]' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="pt-2 pb-1 text-[14px] sm:text-[14.5px] text-[#737780] leading-[1.5]">
                            {item.answer}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversão Final na Base da Página */}
          <div
            className="mt-10 md:mt-14 max-w-[400px] mx-auto flex flex-col items-center text-center"
            style={{
              paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <img
              src="/assets/aistudio/monvian_logo_dark_transparent.png"
              alt="Monvian"
              loading="lazy"
              decoding="async"
              className="h-[32px] w-auto object-contain mb-4 select-none"
            />
            <p className="text-[14px] text-[#737780] mb-5">
              Comece agora e viva Campos do Jordão do seu jeito.
            </p>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                triggerHaptic();
                onStartRegister();
              }}
              className="group w-full min-h-[56px] pl-7 pr-2.5 py-2 rounded-full bg-[#080808] hover:bg-[#181A1F] text-white text-[16.5px] font-bold tracking-[-0.015em] shadow-[0_12px_28px_rgba(8,8,8,0.14)] flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8]"
            >
              <span className="flex-1 text-center pl-4">Criar conta</span>
              <span className="w-10 h-10 rounded-full bg-white group-hover:bg-[#F2F4F8] text-[#080808] flex items-center justify-center shrink-0 shadow-sm transition-colors duration-200">
                <ArrowRight className="w-[18px] h-[18px] stroke-[2.5] text-[#080808] transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </motion.button>

            <motion.button
              id="btn-landing-bottom-login"
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              onClick={() => {
                triggerHaptic();
                onOpenLogin();
              }}
              className="mt-3.5 py-2.5 px-6 rounded-full text-[15px] font-bold text-[#080808] hover:text-[#2673E8] hover:bg-black/[0.03] active:bg-black/[0.06] transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-[#2673E8]"
            >
              Já tenho uma conta
            </motion.button>
          </div>
        </div>
      </section>

      {/* Rodapé Absoluto Monvian */}
      <footer className="w-full bg-[#FFFFFF] pt-3 pb-8 sm:pb-10 text-center select-none">
        <p
          className="text-[12px] sm:text-[13px] font-normal text-[#8A8F99] tracking-[-0.01em]"
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
            color: '#8A8F99',
          }}
        >
          © 2026 Monvian. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

export default CinematicLandingView;

