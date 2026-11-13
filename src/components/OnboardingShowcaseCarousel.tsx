import React, { memo, useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

export interface ShowcaseSlideItem {
  id: string;
  src: string;
  alt: string;
  title: string;
  subtitle: string;
  imgClassName?: string;
}

const SHOWCASE_ITEMS: readonly ShowcaseSlideItem[] = [
  {
    id: 'showcase-portal',
    src: '/assets/aistudio/IMG_9728_58a7dd25.jpeg',
    alt: 'Portal de entrada de Campos do Jordão com arquitetura enxaimel',
    title: 'Lugares incríveis',
    subtitle: 'Descubra novos destinos.',
    imgClassName: 'object-cover object-[50%_45%]',
  },
  {
    id: 'showcase-cafe',
    src: '/assets/aistudio/IMG_9730_ee7781b1.jpeg',
    alt: 'Sans Souci Café Confeitaria em Campos do Jordão',
    title: 'Gastronomia e charme',
    subtitle: 'Cafés, bistrôs e passeios.',
    imgClassName: 'object-cover object-[50%_58%]',
  },
  {
    id: 'showcase-capivari',
    src: '/assets/aistudio/IMG_9729_494374bb.jpeg',
    alt: 'Cabine telefônica vermelha e estação ferroviária em Vila Capivari',
    title: 'Seus roteiros',
    subtitle: 'Planeje cada parada.',
    imgClassName: 'object-cover object-[50%_35%]',
  },
  {
    id: 'showcase-ponte',
    src: '/assets/aistudio/IMG_9731_3092b8e5.jpeg',
    alt: 'Passarela com guarda-chuvas e luzes em Campos do Jordão ao entardecer',
    title: 'Passeios únicos',
    subtitle: 'Cenários inesquecíveis.',
    imgClassName: 'object-cover object-[50%_45%]',
  },
  {
    id: 'showcase-serra',
    src: '/assets/aistudio/IMG_9727_daa2a8b7.jpeg',
    alt: 'Arquitetura alpina cercada pelas montanhas da Serra da Mantiqueira',
    title: 'Novas experiências',
    subtitle: 'Viva momentos na serra.',
    imgClassName: 'object-cover object-[50%_45%]',
  },
];

// 3 grupos idênticos cobrem com folga de telas compactas a monitores ultrawide (4000px+)
const CLONE_GROUPS = [0, 1, 2] as const;
const BASE_DRIFT_PX_PER_SEC = 36;

const ShowcaseCard = memo(function ShowcaseCard({
  item,
}: {
  item: ShowcaseSlideItem;
}) {
  return (
    <div
      className="relative w-[252px] h-[252px] sm:w-[296px] sm:h-[296px] md:w-[320px] md:h-[320px] shrink-0 rounded-[24px] overflow-hidden bg-[#F3F4F7] text-left select-none pointer-events-none"
      style={{
        contain: 'layout style paint',
      }}
    >
      <img
        src={item.src}
        alt={item.alt}
        loading="eager"
        decoding="async"
        draggable={false}
        referrerPolicy="no-referrer"
        className={`w-full h-full select-none pointer-events-none ${
          item.imgClassName || 'object-cover object-center'
        }`}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none"
      />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex flex-col justify-end text-left pointer-events-none">
        <span
          className="text-[17px] sm:text-[19px] font-bold text-white tracking-[-0.02em] leading-[1.18]"
          style={{
            fontFamily:
              "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {item.title}
        </span>
        <span
          className="mt-0.5 text-[13px] sm:text-[14px] font-normal text-white/85 leading-[1.3]"
          style={{
            fontFamily:
              "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {item.subtitle}
        </span>
      </div>
    </div>
  );
});

export const OnboardingShowcaseCarousel = memo(function OnboardingShowcaseCarousel() {
  const prefersReducedMotion = Boolean(useReducedMotion());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstGroupRef = useRef<HTMLDivElement | null>(null);

  const animRef = useRef<Animation | null>(null);
  const cycleWidthRef = useRef<number>(0);
  const durationMsRef = useRef<number>(30000);
  const isVisibleRef = useRef<boolean>(true);

  // Pre-decode images in background once on mount so zero frame drops occur on first pass
  useEffect(() => {
    SHOWCASE_ITEMS.forEach((item) => {
      try {
        const img = new Image();
        img.src = item.src;
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {});
        }
      } catch {}
    });
  }, []);

  // Off-main-thread GPU Compositor Web Animation, completely non-interactive
  useEffect(() => {
    const trackEl = trackRef.current;
    const groupEl = firstGroupRef.current;
    if (!trackEl || !groupEl) return;

    const setupAnimation = () => {
      const width = groupEl.getBoundingClientRect().width;
      if (width <= 0) return;
      if (animRef.current && Math.abs(width - cycleWidthRef.current) < 0.5) return;

      let progressFraction = 0.25;
      if (animRef.current && durationMsRef.current > 0) {
        const prevTime = Number(animRef.current.currentTime ?? 0);
        if (Number.isFinite(prevTime)) {
          progressFraction =
            (((prevTime % durationMsRef.current) + durationMsRef.current) %
              durationMsRef.current) /
            durationMsRef.current;
        }
        animRef.current.cancel();
        animRef.current = null;
      }

      cycleWidthRef.current = width;
      const durationMs = (width / BASE_DRIFT_PX_PER_SEC) * 1000;
      durationMsRef.current = durationMs;

      if (typeof trackEl.animate === 'function') {
        const anim = trackEl.animate(
          [
            { transform: 'translate3d(0px, 0, 0)' },
            { transform: `translate3d(-${width.toFixed(2)}px, 0, 0)` },
          ],
          {
            duration: durationMs,
            iterations: Infinity,
            easing: 'linear',
          }
        );

        anim.currentTime = progressFraction * durationMs;
        anim.playbackRate = prefersReducedMotion ? 0 : 1;

        if (!isVisibleRef.current || prefersReducedMotion) {
          if (prefersReducedMotion) {
            anim.playbackRate = 0;
          } else {
            anim.pause();
          }
        }

        animRef.current = anim;
      }
    };

    setupAnimation();

    let resizeTimer: number | null = null;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (resizeTimer !== null) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(setupAnimation, 120);
      });
      ro.observe(groupEl);
    }

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          isVisibleRef.current = entry.isIntersecting;
          const anim = animRef.current;
          if (!anim || prefersReducedMotion) return;

          if (entry.isIntersecting) {
            if (anim.playState === 'paused') {
              anim.play();
            }
          } else {
            if (anim.playState === 'running') {
              anim.pause();
            }
          }
        },
        { rootMargin: '240px 0px' }
      );
      io.observe(containerRef.current);
    }

    return () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      ro?.disconnect();
      io?.disconnect();
      animRef.current?.cancel();
      animRef.current = null;
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      id="roteiros"
      aria-label="Destaques de Campos do Jordão"
      className="w-full overflow-hidden select-none pointer-events-none"
      style={{
        touchAction: 'pan-y',
        contain: 'layout style',
      }}
    >
      <div
        ref={trackRef}
        className="flex w-max items-stretch will-change-transform pointer-events-none"
        style={{
          transform: 'translate3d(0px, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
      >
        {CLONE_GROUPS.map((groupIndex) => (
          <div
            key={groupIndex}
            ref={groupIndex === 0 ? firstGroupRef : undefined}
            aria-hidden={groupIndex > 0 ? true : undefined}
            className="flex shrink-0 items-stretch gap-3.5 sm:gap-4 pr-3.5 sm:pr-4"
          >
            {SHOWCASE_ITEMS.map((item) => (
              <ShowcaseCard key={`${groupIndex}-${item.id}`} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});
