import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { OnboardingShowcaseCarousel } from './OnboardingShowcaseCarousel';
import { Category3DLiquidGlassCarousel } from './Category3DLiquidGlassCarousel';
import { LoginSocialProofSection } from './LoginSocialProofSection';
import { useLanguage } from '../contexts/LanguageContext';


interface CinematicLandingViewProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onStartRegister: () => void;
  onOpenLogin: () => void;
  theme?: 'dark' | 'light';
}

const BrazilFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#009B3A" />
    <path d="M12 4.2L20.4 12L12 19.8L3.6 12Z" fill="#FFDF00" />
    <circle cx="12" cy="12" r="4.15" fill="#002776" />
    <path
      d="M8.05 11.25C10.45 10.25 13.45 10.65 15.9 12.65"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="1.05"
      strokeLinecap="round"
    />
  </svg>
);

const UkFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id="monvian-uk-flag-clip">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
    </defs>
    <g clipPath="url(#monvian-uk-flag-clip)">
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#FFFFFF" strokeWidth="4.4" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#C8102E" strokeWidth="2.1" />
      <path d="M12 0V24M0 12H24" stroke="#FFFFFF" strokeWidth="6.4" />
      <path d="M12 0V24M0 12H24" stroke="#C8102E" strokeWidth="3.6" />
    </g>
  </svg>
);

const SpainFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id="monvian-es-flag-clip">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
    </defs>
    <g clipPath="url(#monvian-es-flag-clip)">
      <rect width="24" height="24" fill="#AA151B" />
      <rect y="6" width="24" height="12" fill="#F1BF00" />
      <rect x="5.4" y="9.2" width="2.8" height="5.6" rx="1.1" fill="#AA151B" />
      <circle cx="6.8" cy="11.2" r="0.85" fill="#F1BF00" />
    </g>
  </svg>
);

const JapanFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#FFFFFF" />
    <circle cx="12" cy="12" r="11.5" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
    <circle cx="12" cy="12" r="5.2" fill="#BC002D" />
  </svg>
);

const LanguageFlagIcon: React.FC<{ lang: 'pt' | 'en' | 'es' | 'ja' }> = ({ lang }) => {
  if (lang === 'en') return <UkFlagIcon />;
  if (lang === 'es') return <SpainFlagIcon />;
  if (lang === 'ja') return <JapanFlagIcon />;
  return <BrazilFlagIcon />;
};

const HeroUsersCounter = React.memo(function HeroUsersCounter({
  prefersReducedMotion,
  isDark = false,
}: {
  prefersReducedMotion: boolean | null;
  isDark?: boolean;
}) {
  const { language, tr } = useLanguage();
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
      setUserCount((prev) => {
        const randomStep = Math.floor(Math.random() * 3) + 3;
        const next = prev + randomStep;
        try {
          localStorage.setItem('monvian_social_user_count', String(next));
        } catch {}
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const localeMap: Record<'pt' | 'en' | 'es' | 'ja', string> = {
    pt: 'pt-BR',
    en: 'en-US',
    es: 'es-ES',
    ja: 'ja-JP',
  };
  const formattedCount = userCount.toLocaleString(localeMap[language] ?? 'pt-BR');

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0.15 : 0.35,
        ease: [0.22, 1, 0.36, 1],
        delay: prefersReducedMotion ? 0 : 0.08,
      }}
      className="relative z-[95] flex items-center justify-center gap-4 sm:gap-5 select-none"
      aria-label={`${formattedCount} ${tr('Usuários')} Monvian`}
    >
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
            className={`relative ${avatar.zIndex} w-[44px] h-[44px] sm:w-[46px] sm:h-[46px] rounded-full border-[2.5px] shadow-[0_6px_16px_rgba(14,42,79,0.22)] overflow-hidden shrink-0 ${
              isDark ? 'border-[#000000] bg-[#1C1C1E]' : 'border-white bg-white'
            }`}
          >
            <img
              src={avatar.src}
              alt={tr(avatar.alt)}
              width={46}
              height={46}
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover block select-none pointer-events-none"
            />
          </div>
        ))}
      </div>

      <div
        className={`relative z-[95] w-[1.5px] h-[40px] sm:h-[42px] rounded-full shrink-0 ${
          isDark ? 'bg-white/25' : 'bg-[#080808]/20'
        }`}
        aria-hidden="true"
      />

      <div className="relative z-[95] flex flex-col items-start justify-center text-left">
        <span
          className={`inline-flex items-center text-[25px] sm:text-[27px] font-bold leading-[1.06] tracking-[-0.02em] tabular-nums ${
            isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
          }`}
          style={{
            fontFamily:
              "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {formattedCount
            .split('')
            .map((char, idx) => {
              if (char === '.' || char === ',') {
                return (
                  <span key={`sep-${idx}`} className="inline-block px-[0.5px]">
                    {char}
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
          className={`text-[14.5px] sm:text-[15.5px] font-medium leading-[1.2] tracking-[-0.01em] mt-0.5 ${
            isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
          }`}
          style={{
            fontFamily:
              "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {tr('Usuários')}
        </span>
      </div>
    </motion.div>
  );
});

export const CinematicLandingView: React.FC<CinematicLandingViewProps> = ({
  scrollContainerRef,
  onStartRegister,
  onOpenLogin,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const prefersReducedMotion = useReducedMotion();

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

  // Navigation bar ref & scroll tracking (zero React re-renders during scroll)
  const navHeaderRef = useRef<HTMLElement | null>(null);
  const langDropdownContainerRef = useRef<HTMLDivElement | null>(null);

  // Language selector state synced globally with LanguageContext
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const { language: selectedLanguage, setLanguage, isEnglish, tr } = useLanguage();

  useEffect(() => {
    if (!isLangMenuOpen) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        langDropdownContainerRef.current &&
        !langDropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsLangMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLangMenuOpen]);

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
      if (parallaxIslandRef.current) {
        parallaxIslandRef.current.style.transform = `translate3d(${(ix * 20).toFixed(2)}px, ${(iy * 14).toFixed(2)}px, 0)`;
      }
      if (parallaxMidRef.current) {
        parallaxMidRef.current.style.transform = `translate3d(${(ix * 24).toFixed(2)}px, ${(iy * 17).toFixed(2)}px, 0)`;
      }
      if (parallaxFrontRef.current) {
        parallaxFrontRef.current.style.transform = `translate3d(${(ix * 28).toFixed(2)}px, ${(iy * 20).toFixed(2)}px, 0)`;
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
    let lastProgress = -1;
    let lastNavLight = false;

    const syncScroll = () => {
      rafScrollId = null;
      if (!scroller || !hero) return;

      const scrollTop = scroller.scrollTop;
      const viewportHeight = scroller.clientHeight || window.innerHeight || 844;
      const transitionDistance = Math.max(280, viewportHeight * 0.6);
      const progress = Math.max(0, Math.min(1, scrollTop / transitionDistance));

      if (Math.abs(progress - lastProgress) > 0.0004) {
        lastProgress = progress;
        tl.progress(progress);
      }

      // Keep navbar permanently fixed at the top; adapt translucent glass theme and smooth shrink on scroll
      const navEl = navHeaderRef.current;
      const nextLight = !isDark && scrollTop > viewportHeight * 0.36;
      if (navEl) {
        const isScrolledDown = scrollTop > 40;
        navEl.style.transform = isScrolledDown ? 'scale(0.95)' : 'scale(1)';
        navEl.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), background 0.28s ease, border-color 0.28s ease, color 0.24s ease, box-shadow 0.28s ease';
      }

      if (nextLight !== lastNavLight) {
        lastNavLight = nextLight;
        if (navEl) {
          navEl.setAttribute('data-nav-theme', nextLight ? 'light' : 'dark');
        }
      } else if (isDark && navEl && navEl.getAttribute('data-nav-theme') !== 'dark') {
        navEl.setAttribute('data-nav-theme', 'dark');
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
  }, [scrollContainerRef, prefersReducedMotion, isDark]);

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
            ? 'text-[#83C792] drop-shadow-[0_2px_18px_rgba(131,199,146,0.28)]'
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
      className={`relative w-full select-none overflow-x-clip transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#080808]'
      }`}
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
            opacity: 0.36;
          }
          85% {
            opacity: 0.36;
          }
          100% {
            transform: translate3d(-18%, 0px, 0) scale(1.1);
            opacity: 0;
          }
        }
        .monvian-hero-foreground {
          padding-top: max(136px, calc(env(safe-area-inset-top, 0px) + 124px));
          padding-bottom: max(18px, calc(env(safe-area-inset-bottom, 0px) + 10px));
        }
        @media (min-width: 1024px) {
          .monvian-hero-foreground {
            padding-top: 84px;
            padding-bottom: 20px;
          }
        }
        .monvian-cloud-soft-mask {
          filter: brightness(1.14) contrast(1.1);
          -webkit-mask-image: radial-gradient(ellipse 50% 44% at 50% 50%, rgba(0,0,0,1) 38%, rgba(0,0,0,0.65) 68%, rgba(0,0,0,0) 96%);
          mask-image: radial-gradient(ellipse 50% 44% at 50% 50%, rgba(0,0,0,1) 38%, rgba(0,0,0,0.65) 68%, rgba(0,0,0,0) 96%);
        }
        .monvian-floating-nav {
          border-radius: 999px;
          backdrop-filter: blur(25px) saturate(151%);
          -webkit-backdrop-filter: blur(25px) saturate(151%);
          transform: translate3d(0, 0, 0);
          overflow: hidden;
          transition: background 0.28s ease, border-color 0.28s ease, color 0.24s ease, box-shadow 0.28s ease;
          contain: layout style;
        }
        .monvian-floating-nav::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 999px;
          padding: 1.25px;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.94) 0%,
            rgba(255, 255, 255, 0.36) 24%,
            rgba(255, 255, 255, 0.72) 50%,
            rgba(255, 255, 255, 0.32) 76%,
            rgba(255, 255, 255, 0.96) 100%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          pointer-events: none;
          z-index: 2;
        }
        .monvian-floating-nav::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background:
            radial-gradient(28% 120% at 4% 52%, rgba(255, 255, 255, 0.44) 0%, rgba(255, 255, 255, 0.12) 48%, rgba(255, 255, 255, 0) 85%),
            radial-gradient(28% 120% at 96% 48%, rgba(255, 255, 255, 0.46) 0%, rgba(255, 255, 255, 0.12) 48%, rgba(255, 255, 255, 0) 85%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.04) 26%, rgba(255, 255, 255, 0) 62%, rgba(255, 255, 255, 0.16) 100%);
          pointer-events: none;
          z-index: 1;
        }
        .monvian-floating-nav > nav {
          position: relative;
          z-index: 3;
        }
        .monvian-floating-nav[data-nav-theme='dark'] {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.18) 0%,
            rgba(255, 255, 255, 0.07) 52%,
            rgba(255, 255, 255, 0.14) 100%
          );
          border-color: rgba(255, 255, 255, 0.34);
          color: rgba(255, 255, 255, 0.98);
          text-shadow: 0 1px 2px rgba(8, 22, 46, 0.18);
          box-shadow:
            0 12px 30px rgba(10, 28, 56, 0.18),
            0 3px 10px rgba(0, 0, 0, 0.08),
            inset 0 1.5px 2px rgba(255, 255, 255, 0.65),
            inset 0 -1.5px 3px rgba(255, 255, 255, 0.28),
            inset 10px 0 16px -8px rgba(255, 255, 255, 0.38),
            inset -10px 0 16px -8px rgba(255, 255, 255, 0.38);
        }
        .monvian-floating-nav[data-nav-theme='light'] {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.56) 0%,
            rgba(244, 247, 254, 0.36) 52%,
            rgba(255, 255, 255, 0.50) 100%
          );
          border-color: rgba(255, 255, 255, 0.72);
          color: rgba(8, 8, 8, 0.90);
          text-shadow: none;
          box-shadow:
            0 0 0 0.5px rgba(8, 8, 8, 0.06),
            0 10px 28px rgba(15, 23, 42, 0.09),
            0 2px 8px rgba(15, 23, 42, 0.05),
            inset 0 1.5px 2px rgba(255, 255, 255, 0.92),
            inset 0 -1.5px 3px rgba(255, 255, 255, 0.55),
            inset 10px 0 16px -8px rgba(255, 255, 255, 0.62),
            inset -10px 0 16px -8px rgba(255, 255, 255, 0.62);
        }
        .monvian-floating-nav[data-nav-theme='light'] button:hover {
          color: #2673E8;
        }
        @media (prefers-reduced-motion: reduce) {
          .monvian-anim-float,
          .monvian-anim-cloud {
            animation: none !important;
          }
          .monvian-floating-nav {
            transition: background 0.16s ease, color 0.16s ease;
          }
        }
      `}</style>

      {/* =========================================================================
          PARTE 5 — BARRA DE NAVEGAÇÃO LIQUID GLASS FIXA NO TOPO (ESTILO iOS)
         ========================================================================= */}
      <div
        ref={langDropdownContainerRef}
        className="fixed left-4 right-4 z-[999] max-w-[400px] md:max-w-[520px] mx-auto pointer-events-none"
        style={{
          top: 'max(12px, calc(env(safe-area-inset-top, 0px) + 8px))',
        }}
      >
        <header
          ref={navHeaderRef}
          aria-label="Navegação de apresentação Monvian"
          data-nav-theme="dark"
          className="monvian-floating-nav relative w-full pointer-events-auto rounded-[999px] px-3.5 sm:px-5 py-2 border"
        >
          <nav className="flex items-center justify-between gap-1 sm:gap-3 text-[12px] sm:text-[13px] font-medium tracking-[-0.01em]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                onStartRegister();
              }}
              className="px-2 py-1 rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8]"
            >
              {tr('Criar conta')}
            </button>
            <button
              id="btn-landing-top-login"
              type="button"
              onClick={() => {
                triggerHaptic();
                onOpenLogin();
              }}
              className="px-2 py-1 rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8]"
            >
              {tr('Entrar')}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('roteiros')}
              className="px-2 py-1 rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8]"
            >
              {tr('Roteiros')}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLangMenuOpen((prev) => !prev);
              }}
              aria-haspopup="menu"
              aria-expanded={isLangMenuOpen}
              aria-label={tr('Selecionar idioma')}
              className="px-1.5 py-[1px] rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#2673E8]"
            >
              <span className="w-[24px] h-[24px] sm:w-[25px] sm:h-[25px] rounded-full overflow-hidden shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.20)] ring-1 ring-white/45 flex items-center justify-center">
                <LanguageFlagIcon lang={selectedLanguage} />
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 stroke-[2.4] transition-transform duration-200 ${
                  isLangMenuOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
          </nav>
        </header>

        <AnimatePresence>
          {isLangMenuOpen && (
            <motion.div
              role="menu"
              aria-label={tr('Idiomas disponíveis')}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{
                transformOrigin: 'top right',
                backgroundColor: isDark ? 'rgba(28, 28, 30, 0.94)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
              className={`absolute right-0 top-full mt-2 w-[178px] max-w-[calc(100vw-32px)] rounded-[18px] border overflow-hidden pointer-events-auto ${
                isDark
                  ? 'border-white/15 shadow-[0_14px_36px_rgba(0,0,0,0.65)]'
                  : 'border-white/85 shadow-[0_12px_32px_rgba(10,28,56,0.18),0_2px_8px_rgba(0,0,0,0.06)]'
              }`}
            >
              {(
                [
                  { code: 'pt', label: 'Português' },
                  { code: 'en', label: 'English' },
                  { code: 'es', label: 'Español' },
                  { code: 'ja', label: '日本語' },
                ] as const
              ).map((item, idx) => (
                <React.Fragment key={item.code}>
                  {idx > 0 && (
                    <div
                      className={`h-[1px] mx-3 ${isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'}`}
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedLanguage === item.code}
                    onClick={() => {
                      triggerHaptic();
                      setLanguage(item.code);
                      setIsLangMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left text-[13.5px] font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'text-[#FFFFFF] hover:bg-white/[0.06] active:bg-white/[0.10]'
                        : 'text-[#111827] hover:bg-black/[0.04] active:bg-black/[0.07]'
                    }`}
                  >
                    <span className="w-[22px] h-[22px] rounded-full overflow-hidden shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
                      <LanguageFlagIcon lang={item.code} />
                    </span>
                    <span className="flex-1 truncate" data-no-translate>
                      {item.label}
                    </span>
                    {selectedLanguage === item.code && (
                      <Check className="w-4 h-4 shrink-0 stroke-[2.6] text-[#007AFF]" />
                    )}
                  </button>
                </React.Fragment>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =========================================================================
          HERO CINEMATOGRÁFICO (100svh) — ILHA 3D 100% VISÍVEL POR COMPLETO
         ========================================================================= */}
      <section
        ref={heroSectionRef}
        aria-label="Apresentação principal Monvian — Campos do Jordão"
        className={`relative z-[70] w-full min-h-[640px] flex flex-col justify-between overflow-hidden ${
          isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
        }`}
        style={{
          height: 'var(--app-height, 100dvh)',
          minHeight: 'max(640px, var(--app-height, 100dvh))',
          filter: 'saturate(0.9)',
        }}
      >
        {/* 1. CÉU TRIDIMENSIONAL MULTICAMADAS */}
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
                background: isDark
                  ? 'linear-gradient(180deg, #0D1E36 0%, #152D4F 22%, #1C3C66 42%, #172E4D 62%, #0C1726 78%, #04070D 89%, #000000 95%, #000000 100%)'
                  : 'linear-gradient(180deg, #2968A9 0%, #357DC2 18%, #4B93D3 36%, #79B4E3 53%, #AAD2EF 68%, #DCEDF9 80%, #F4F9FD 88%, #FFFFFF 94%, #FFFFFF 100%)',
              }}
            >
              {/* Brilho Solar Radial e Iluminação Atmosférica */}
              <div
                ref={sunGlowRef}
                className="absolute inset-0 will-change-transform"
                style={{
                  background: isDark
                    ? 'radial-gradient(circle at 58% 24%, rgba(120, 175, 240, 0.16) 0%, rgba(45, 92, 155, 0.08) 38%, rgba(0, 0, 0, 0) 72%)'
                    : 'radial-gradient(circle at 58% 24%, rgba(255, 255, 255, 0.26) 0%, rgba(202, 229, 249, 0.14) 34%, rgba(53, 125, 194, 0) 70%), radial-gradient(ellipse 88% 36% at 50% 68%, rgba(255, 255, 255, 0.52) 0%, rgba(232, 244, 252, 0.22) 55%, rgba(255, 255, 255, 0) 100%)',
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

        {/* 4. BRILHO ATMOSFÉRICO CENTRAL ATRÁS DA ILHA (z-[18] < z-[24]) */}
        <div
          className="absolute inset-0 pointer-events-none z-[18]"
          aria-hidden="true"
        >
          <div
            className="absolute left-1/2 lg:left-[71%] top-[56%] lg:top-[50%] -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[780px] h-[34vh] lg:h-[46vh] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.42) 0%, rgba(230, 245, 255, 0.20) 50%, rgba(255, 255, 255, 0) 78%)',
              filter: 'blur(16px)',
            }}
          />
          {/* Bruma volumétrica suave nos cantos inferiores no Desktop para emoldurar a ilha entre nuvens */}
          <div
            className="hidden lg:block absolute inset-x-[-6%] -bottom-[8%] h-[28vh] pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 36% 65% at 10% 85%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 75%), radial-gradient(ellipse 40% 65% at 88% 85%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 75%)',
              filter: 'blur(14px)',
            }}
          />
        </div>

        {/* 4.5. GRUPO 2 — NUVENS INTERMEDIÁRIAS PASSANDO POR CIMA DA ILHA 3D (z-[28] > z-[24], movendo-se lentamente para a direita) */}
        <div
          ref={parallaxMidRef}
          className="absolute inset-0 pointer-events-none z-[28] will-change-transform"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={
              assetsReady
                ? { opacity: 0.86, y: 0, scale: 1 }
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
                        className="monvian-cloud-soft-mask absolute top-[35%] -left-[12%] md:left-[6%] w-[80vw] max-w-[490px] md:w-[40vw] md:max-w-[580px] opacity-55 select-none"
                      />
                    </picture>

                    <picture>
                      <source srcSet="/assets/aistudio/cloud_volumetric_1.webp" type="image/webp" />
                      <img
                        src="/assets/aistudio/cloud_volumetric_1.webp"
                        alt=""
                        decoding="async"
                        className="monvian-cloud-soft-mask absolute top-[38%] right-[-10%] md:right-[6%] w-[82vw] max-w-[510px] md:w-[42vw] md:max-w-[600px] opacity-55 select-none"
                      />
                    </picture>
                  </div>
                ))}
              </div>

              {/* Nuvens volumétricas passando por cima do mapa 3D flutuante (z-[28] > z-[24], movendo-se para a direita) */}
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
                  className="monvian-anim-cloud monvian-cloud-soft-mask absolute top-[48%] left-1/2 w-[104vw] max-w-[640px] md:w-[54vw] md:max-w-[780px] opacity-30 select-none"
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
                  className="monvian-anim-cloud monvian-cloud-soft-mask absolute top-[52%] left-1/2 w-[104vw] max-w-[640px] md:w-[54vw] md:max-w-[780px] opacity-25 select-none"
                />
              </picture>
            </div>
          </motion.div>
        </div>

        {/* 5. ELEMENTO PRINCIPAL: ILHA 3D ORIGINAL DE CAMPOS DO JORDÃO (z-[24]) */}
        <div
          ref={parallaxIslandRef}
          className="absolute inset-0 pointer-events-none z-[24] flex items-center justify-center will-change-transform"
        >
          <div className="monvian-hero-foreground w-full h-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 flex flex-col justify-between">
            <div className="w-full flex-1 flex items-center justify-center lg:justify-start">
              <div className="hidden lg:block lg:w-[45%] shrink-0" aria-hidden="true" />
              <div className="relative w-full lg:w-[55%] flex items-center justify-center lg:justify-end translate-y-[13.5vh] sm:translate-y-[12vh] md:translate-y-[11vh] lg:translate-y-0">
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
                  className="relative w-[92vw] max-w-[425px] sm:max-w-[475px] md:w-[52vw] md:max-w-[600px] lg:w-full lg:max-w-[740px] xl:max-w-[820px] 2xl:max-w-[860px] flex items-center justify-center"
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
                            filter:
                              'brightness(1.01) contrast(1.08) saturate(0.95) drop-shadow(0 24px 34px rgba(10, 44, 96, 0.22))',
                          }}
                          className="w-full h-auto lg:max-h-[63vh] xl:max-h-[67vh] block object-contain select-none"
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
                      background: isDark
                        ? 'radial-gradient(ellipse 62% 54% at 50% 50%, #000000 0%, rgba(0, 0, 0, 0.96) 48%, rgba(0, 0, 0, 0) 100%)'
                        : 'radial-gradient(ellipse 62% 54% at 50% 50%, #FFFFFF 0%, rgba(255, 255, 255, 0.96) 48%, rgba(255, 255, 255, 0) 100%)',
                      filter: 'blur(12px)',
                    }}
                  />
                  {!isDark && (
                    <picture>
                      <source srcSet="/assets/aistudio/cloud_volumetric_3.webp" type="image/webp" />
                      <img
                        src="/assets/aistudio/cloud_volumetric_3.webp"
                        alt=""
                        decoding="async"
                        className="monvian-cloud-soft-mask absolute -top-[8%] left-1/2 -translate-x-1/2 w-[96%] h-auto opacity-95 select-none"
                      />
                    </picture>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
            </div>
            <div className="hidden lg:block lg:h-[68px] xl:h-[76px] shrink-0" aria-hidden="true" />
          </div>
        </div>

        {/* 6. GRUPO 3 — NUVENS FRONTAIS DE TRANSIÇÃO */}
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
                className={`monvian-cloud-soft-mask absolute top-[54%] left-1/2 -translate-x-1/2 w-[108vw] max-w-[660px] md:w-[56vw] md:max-w-[820px] select-none ${
                  isDark ? 'opacity-25' : 'opacity-95'
                }`}
              />
            </picture>
          </div>
        </div>

        {/* 6.5 CORTINA DE TRANSIÇÃO QUE SOBE DE BAIXO DURANTE O SCROLL */}
        <div
          ref={risingBottomCloudsRef}
          style={{ opacity: 0 }}
          className="absolute inset-x-[-15%] -bottom-[32vh] h-[68vh] pointer-events-none z-[32] will-change-transform"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background: isDark
                ? 'radial-gradient(ellipse 75% 65% at 50% 60%, #000000 0%, #000000 52%, rgba(0,0,0,0.92) 72%, rgba(0,0,0,0) 100%)'
                : 'radial-gradient(ellipse 75% 65% at 50% 60%, #FFFFFF 0%, #FFFFFF 52%, rgba(255,255,255,0.92) 72%, rgba(255,255,255,0) 100%)',
              filter: 'blur(16px)',
            }}
          />
          <div
            className="absolute -top-[8vh] left-[-5%] w-[65%] h-[36vh] rounded-full"
            style={{
              background: isDark
                ? 'radial-gradient(ellipse at center, #000000 0%, rgba(0,0,0,0.95) 46%, rgba(0,0,0,0) 80%)'
                : 'radial-gradient(ellipse at center, #FFFFFF 0%, rgba(255,255,255,0.95) 46%, rgba(255,255,255,0) 80%)',
              filter: 'blur(18px)',
            }}
          />
          <div
            className="absolute -top-[8vh] right-[-5%] w-[65%] h-[36vh] rounded-full"
            style={{
              background: isDark
                ? 'radial-gradient(ellipse at center, #000000 0%, rgba(0,0,0,0.95) 46%, rgba(0,0,0,0) 80%)'
                : 'radial-gradient(ellipse at center, #FFFFFF 0%, rgba(255,255,255,0.95) 46%, rgba(255,255,255,0) 80%)',
              filter: 'blur(18px)',
            }}
          />
        </div>

        {/* 7. COMPOSIÇÃO DO HERO: NO DESKTOP, COLUNA ESQUERDA (45%) + ILHA 3D À DIREITA (55%) + INDICADOR DE USUÁRIOS CENTRALIZADO NA BASE */}
        <div
          className="monvian-hero-foreground relative z-[85] w-full h-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 flex flex-col justify-between pointer-events-none"
        >
          {/* Área Principal do Hero (Vertical no Mobile; Duas Colunas 45% / 55% centralizadas verticalmente no Desktop) */}
          <div className="w-full flex-1 flex flex-col lg:flex-row items-center lg:items-center justify-start lg:justify-between">
            {/* LADO ESQUERDO (45% no Desktop): Logo, Título, Descrição e Botões de Conversão */}
            <div className="w-full max-w-[430px] md:max-w-[680px] lg:max-w-none lg:w-[45%] mx-auto lg:mx-0 flex flex-col items-center lg:items-start text-center lg:text-left lg:pr-6">
              <div ref={heroLogoWrapRef} className="will-change-transform">
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={assetsReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  transition={{
                    duration: prefersReducedMotion ? 0.2 : 0.45,
                    ease: [0.22, 1, 0.36, 1],
                    delay: prefersReducedMotion ? 0 : 0.02,
                  }}
                  className="mb-3 sm:mb-3.5 lg:mb-5 flex items-center justify-center lg:justify-start"
                >
                  <img
                    src="/assets/aistudio/monvian_logo_white_transparent.png"
                    alt="Monvian"
                    width={429}
                    height={141}
                    className="h-[51px] sm:h-[57px] md:h-[64px] lg:h-[70px] xl:h-[78px] w-auto object-contain select-none drop-shadow-[0_4px_16px_rgba(12,35,68,0.28)]"
                  />
                </motion.div>
              </div>

              <div
                ref={heroTextWrapRef}
                className="w-full flex flex-col items-center lg:items-start will-change-transform"
              >
                <h1
                  data-no-translate
                  className="text-center lg:text-left text-[32px] sm:text-[40px] md:text-[48px] lg:text-[46px] xl:text-[54px] 2xl:text-[58px] font-extrabold tracking-[-0.032em] leading-[1.06] lg:leading-[1.04] text-white mb-2.5 sm:mb-3.5 lg:mb-4 drop-shadow-[0_6px_24px_rgba(14,42,79,0.28)]"
                  style={{
                    fontFamily:
                      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                    textWrap: 'balance',
                  }}
                >
                  {selectedLanguage === 'en' ? (
                    <>
                      {renderMaskedWord('Campos', 0)}{' '}
                      {renderMaskedWord('do', 6)}{' '}
                      {renderMaskedWord('Jordão', 8)}
                      <br />
                      {renderMaskedWord('your', 14, true)}{' '}
                      {renderMaskedWord('way.', 19, true)}
                    </>
                  ) : selectedLanguage === 'es' ? (
                    <>
                      {renderMaskedWord('Campos', 0)}{' '}
                      {renderMaskedWord('do', 6)}{' '}
                      {renderMaskedWord('Jordão', 8)}
                      <br />
                      {renderMaskedWord('a', 14)}{' '}
                      {renderMaskedWord('tu', 16, true)}{' '}
                      {renderMaskedWord('manera.', 19, true)}
                    </>
                  ) : selectedLanguage === 'ja' ? (
                    <>
                      {renderMaskedWord('Campos', 0)}{' '}
                      {renderMaskedWord('do', 6)}{' '}
                      {renderMaskedWord('Jordão', 8)}
                      <br />
                      {renderMaskedWord('あなたらしく。', 14, true)}
                    </>
                  ) : (
                    <>
                      {renderMaskedWord('Campos', 0)}{' '}
                      {renderMaskedWord('do', 6)}{' '}
                      {renderMaskedWord('Jordão', 8)}
                      <br />
                      {renderMaskedWord('do', 14)}{' '}
                      {renderMaskedWord('seu', 16, true)}{' '}
                      {renderMaskedWord('jeito.', 19, true)}
                    </>
                  )}
                </h1>

                <motion.p
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={assetsReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{
                    duration: prefersReducedMotion ? 0.2 : 0.48,
                    ease: [0.22, 1, 0.36, 1],
                    delay: prefersReducedMotion ? 0 : 0.14,
                  }}
                  className="hidden lg:block text-left text-[17px] xl:text-[19px] font-normal text-white/95 leading-[1.42] tracking-[-0.01em] max-w-[440px] drop-shadow-[0_2px_12px_rgba(12,35,68,0.22)]"
                  style={{
                    fontFamily:
                      "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  {tr('Descubra, explore e compartilhe')}
                  <br />
                  {tr('os melhores lugares da cidade.')}
                </motion.p>

                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={assetsReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  transition={{
                    duration: prefersReducedMotion ? 0.2 : 0.48,
                    ease: [0.22, 1, 0.36, 1],
                    delay: prefersReducedMotion ? 0 : 0.2,
                  }}
                  className="hidden lg:flex items-center gap-3.5 mt-7 xl:mt-8 pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onStartRegister();
                    }}
                    className="min-h-[48px] px-8 py-3 rounded-full bg-white hover:bg-[#F3F6FB] active:scale-[0.98] text-[#080808] text-[15px] xl:text-[15.5px] font-bold tracking-[-0.01em] shadow-[0_12px_28px_rgba(10,36,76,0.18)] transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                  >
                    {tr('Criar conta')}
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToSection('roteiros')}
                    className={`group min-h-[48px] px-7 py-3 rounded-full border active:scale-[0.98] backdrop-blur-md text-[15px] xl:text-[15.5px] font-semibold tracking-[-0.01em] shadow-[0_8px_22px_rgba(10,36,76,0.12)] transition-all duration-150 inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white ${
                      isDark
                        ? 'border-white/20 bg-[#1C1C1E] hover:bg-[#2C2C2E] text-white'
                        : 'border-white/80 bg-[#ffffff] text-[#080808]'
                    }`}
                  >
                    <span className={isDark ? 'text-white' : 'text-[#000000]'}>{tr('Explorar roteiros')}</span>
                    <ArrowRight
                      className={`w-[17px] h-[17px] stroke-[2] transition-transform duration-200 group-hover:translate-x-0.5 ${
                        isDark ? 'text-white' : 'text-[#080808]'
                      }`}
                    />
                  </button>
                </motion.div>
              </div>
            </div>

            {/* Espaçador reservado no Desktop (55%) para a Ilha 3D sem sobreposição */}
            <div className="hidden lg:block lg:w-[55%] shrink-0 pointer-events-none" aria-hidden="true" />
          </div>

          {/* Base do Hero: Indicador de Usuários 100% Centralizado Horizontalmente */}
          <div
            ref={heroCtaWrapRef}
            className="relative z-[95] w-full flex justify-center pb-1 sm:pb-2 lg:pb-2 xl:pb-3 pointer-events-auto shrink-0 will-change-transform"
          >
            <HeroUsersCounter prefersReducedMotion={prefersReducedMotion} isDark={isDark} />
          </div>
        </div>
      </section>

      {/* =========================================================================
          PARTE 9 — SEÇÃO DE APRESENTAÇÃO DO MONVIAN
         ========================================================================= */}
      <section
        id="como-funciona"
        ref={presentationSectionRef}
        aria-labelledby="monvian-presentation-heading"
        className={`relative z-[80] w-full pt-8 sm:pt-12 pb-10 sm:pb-12 transition-colors duration-200 ${
          isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
        }`}
        style={{ filter: 'saturate(1.2)' }}
      >
        {/* Conteúdo editorial e minimalista */}
        <div
          ref={presentationContentRef}
          className="relative z-[82] w-full"
        >
          {/* Cabeçalho Editorial da Segunda Seção */}
          <div className="w-full max-w-[430px] md:max-w-[760px] mx-auto px-5 sm:px-8">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              className="text-center max-w-[540px] mx-auto mb-6 sm:mb-8"
            >
              <h2
                id="monvian-presentation-heading"
                data-no-translate
                className={`text-[28px] sm:text-[34px] md:text-[40px] font-extrabold tracking-[-0.032em] leading-[1.1] ${
                  isDark ? 'text-[#FFFFFF]' : 'text-[#080808]'
                }`}
                style={{
                  fontFamily:
                    "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  textWrap: 'balance',
                }}
              >
                {selectedLanguage === 'en' ? (
                  <>
                    Visit <span className="text-[#2673E8]">amazing</span> places
                    <br />
                    <span>in the city.</span>
                  </>
                ) : selectedLanguage === 'es' ? (
                  <>
                    Visita lugares <span className="text-[#2673E8]">increíbles</span>
                    <br />
                    <span>de la ciudad.</span>
                  </>
                ) : selectedLanguage === 'ja' ? (
                  <>
                    街の<span className="text-[#2673E8]">素晴らしい</span>場所を
                    <br />
                    <span>訪れよう。</span>
                  </>
                ) : (
                  <>
                    Visite lugares <span className="text-[#2673E8]">incríveis</span>
                    <br />
                    <span>da cidade.</span>
                  </>
                )}
              </h2>

              <p
                className={`mt-2.5 text-[15px] sm:text-[16.5px] font-medium leading-[1.36] max-w-[340px] sm:max-w-[420px] mx-auto ${
                  isDark ? 'text-[#A1A1AA]' : 'text-[#737780]'
                }`}
                style={{
                  fontFamily:
                    "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {tr('Tudo o que você precisa para aproveitar')}
                <br />
                {tr('sua viagem, em um só lugar.')}
              </p>
            </motion.div>
          </div>

          {/* Vitrine Visual Contínua de Destinos Turísticos */}
          <div className="w-full">
            <OnboardingShowcaseCarousel />
          </div>

          {/* Conversão Final na Base da Página */}
          <div className="w-full max-w-[430px] md:max-w-[760px] mx-auto px-5 sm:px-8">
            <div className="mt-10 md:mt-14 max-w-[400px] mx-auto flex flex-col items-center text-center">
            <img
              src={
                isDark
                  ? '/assets/aistudio/monvian_logo_white_transparent.png'
                  : '/assets/aistudio/monvian_logo_dark_transparent.png'
              }
              alt="Monvian"
              loading="lazy"
              decoding="async"
              className="h-[32px] w-auto object-contain mb-4 select-none"
            />
            <p className={`text-[14px] mb-5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#737780]'}`}>
              {tr('Comece agora e viva Campos do Jordão do seu jeito.')}
            </p>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                triggerHaptic();
                onStartRegister();
              }}
              className={`group w-full min-h-[56px] pl-7 pr-2.5 py-2 rounded-full text-[16.5px] font-bold tracking-[-0.015em] shadow-[0_12px_28px_rgba(8,8,8,0.14)] flex items-center justify-between gap-3 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#2673E8] ${
                isDark
                  ? 'bg-[#FFFFFF] hover:bg-zinc-200 text-[#000000]'
                  : 'bg-[#080808] hover:bg-[#181A1F] text-white'
              }`}
            >
              <span className="flex-1 text-center pl-4">{tr('Criar conta')}</span>
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors duration-200 ${
                  isDark
                    ? 'bg-[#080808] group-hover:bg-zinc-800 text-white'
                    : 'bg-white group-hover:bg-[#F2F4F8] text-[#080808]'
                }`}
              >
                <ArrowRight
                  className={`w-[18px] h-[18px] stroke-[2.5] transition-transform duration-200 group-hover:translate-x-0.5 ${
                    isDark ? 'text-white' : 'text-[#080808]'
                  }`}
                />
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
              className={`mt-3.5 py-2.5 px-6 rounded-full text-[15px] font-bold transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-[#2673E8] ${
                isDark
                  ? 'text-[#FFFFFF] hover:text-[#3B82F6] hover:bg-white/[0.06] active:bg-white/[0.10]'
                  : 'text-[#080808] hover:text-[#2673E8] hover:bg-black/[0.03] active:bg-black/[0.06]'
              }`}
            >
              {tr('Já tenho uma conta')}
            </motion.button>
            </div>
          </div>



          {/* Seção de Provas Sociais ("Quem vive, recomenda.") abaixo do carrossel */}
          <div className="w-full mt-10 sm:mt-14">
            <LoginSocialProofSection theme={theme} />
          </div>
        </div>
      </section>

      {/* Rodapé Absoluto Monvian */}
      <footer
        className={`w-full pt-3 text-center select-none transition-colors duration-200 ${
          isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
        }`}
        style={{
          paddingBottom: 'max(36px, calc(env(safe-area-inset-bottom, 0px) + 24px))',
        }}
      >
        <p
          className={`text-[12px] sm:text-[13px] font-normal tracking-[-0.01em] ${
            isDark ? 'text-[#71717A]' : 'text-[#8A8F99]'
          }`}
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          }}
        >
          {tr('© 2026 Monvian. Todos os direitos reservados.')}
        </p>
      </footer>
    </div>
  );
};

export default CinematicLandingView;

