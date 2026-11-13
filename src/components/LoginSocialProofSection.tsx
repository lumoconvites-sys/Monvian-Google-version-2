import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  DEMO_SOCIAL_PROOF_REVIEWS,
  SocialProofReview,
  distributeReviewsIntoThreeTracks,
} from '../data/socialProofReviews';

interface LoginSocialProofSectionProps {
  /**
   * Permite injetar avaliações autênticas futuramente via API/Firestore,
   * mantendo os 14 itens demonstrativos apenas como fallback visual padrão.
   */
  reviews?: readonly SocialProofReview[];
}

interface InfiniteReviewTrackProps {
  items: readonly SocialProofReview[];
  direction: 'left' | 'right';
  speedPxPerSec: number;
  reduceMotion: boolean;
  isSectionVisible: boolean;
}

const STAR_INDICES = [0, 1, 2, 3, 4] as const;
// 3 cópias idênticas cobrem com folga de iPhones a monitores ultrawide
const CLONE_COPIES = [0, 1, 2] as const;

const FiveStarsRow = memo(function FiveStarsRow() {
  return (
    <div
      className="flex items-center gap-[2px] mt-0.5"
      aria-label="Avaliação de 5 estrelas"
      role="img"
    >
      {STAR_INDICES.map((star) => (
        <svg
          key={star}
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="w-[12px] h-[12px] text-[#F5B400] fill-[#F5B400] shrink-0"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.163 3.58a1 1 0 00.95.69h3.765c.969 0 1.371 1.24.588 1.81l-3.046 2.213a1 1 0 00-.364 1.118l1.164 3.58c.3.921-.755 1.688-1.54 1.118l-3.046-2.213a1 1 0 00-1.175 0l-3.046 2.213c-.784.57-1.838-.197-1.539-1.118l1.163-3.58a1 1 0 00-.364-1.118L2.583 9.007c-.783-.57-.38-1.81.588-1.81h3.765a1 1 0 00.95-.69l1.163-3.58z" />
        </svg>
      ))}
    </div>
  );
});

const ReviewAvatar = memo(function ReviewAvatar({
  src,
  name,
}: {
  src: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);

  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [name]);

  return (
    <div className="w-9 h-9 rounded-full overflow-hidden bg-[#F3F4F7] border border-[#E5E7EB]/80 shrink-0 flex items-center justify-center">
      {!failed && src ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover object-center select-none pointer-events-none"
        />
      ) : (
        <span className="text-[11px] font-semibold text-[#52525B] select-none">
          {initials}
        </span>
      )}
    </div>
  );
});

const ReviewCard = memo(function ReviewCard({
  review,
}: {
  review: SocialProofReview;
}) {
  return (
    <article
      data-source-type={review.sourceType}
      className="w-[264px] sm:w-[286px] shrink-0 rounded-[20px] bg-[#FFFFFF] border border-[#ECEEF2] px-4 py-3.5 shadow-[0_1px_4px_rgba(15,23,42,0.03)] flex flex-col justify-between select-none pointer-events-none"
      style={{
        contain: 'layout style paint',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ReviewAvatar src={review.avatarSrc} name={review.authorName} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[#000000] leading-tight truncate">
            {review.authorName}
          </p>
          <FiveStarsRow />
        </div>
      </div>

      <p className="mt-2.5 text-[13px] leading-[1.45] text-[#0A0A0A] font-normal">
        {review.comment}
      </p>
    </article>
  );
});

const InfiniteReviewTrack = memo(function InfiniteReviewTrack({
  items,
  direction,
  speedPxPerSec,
  reduceMotion,
  isSectionVisible,
}: InfiniteReviewTrackProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstGroupRef = useRef<HTMLDivElement | null>(null);

  const animRef = useRef<Animation | null>(null);
  const cycleWidthRef = useRef<number>(0);
  const durationMsRef = useRef<number>(40000);
  const isVisibleRef = useRef<boolean>(isSectionVisible);
  isVisibleRef.current = isSectionVisible;

  // Build GPU Compositor Web Animation (zero JS rAF loop on main thread)
  useEffect(() => {
    const trackEl = trackRef.current;
    const groupEl = firstGroupRef.current;
    if (!trackEl || !groupEl) return;

    const setupAnimation = () => {
      const width = groupEl.getBoundingClientRect().width;
      if (width <= 0) return;
      if (animRef.current && Math.abs(width - cycleWidthRef.current) < 0.5) return;

      let progressFraction = direction === 'right' ? 0.35 : 0.15;
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
      const durationMs = (width / speedPxPerSec) * 1000;
      durationMsRef.current = durationMs;

      const fromX = direction === 'left' ? '0px' : `-${width.toFixed(2)}px`;
      const toX = direction === 'left' ? `-${width.toFixed(2)}px` : '0px';

      if (typeof trackEl.animate === 'function') {
        const anim = trackEl.animate(
          [
            { transform: `translate3d(${fromX}, 0, 0)` },
            { transform: `translate3d(${toX}, 0, 0)` },
          ],
          {
            duration: durationMs,
            iterations: Infinity,
            easing: 'linear',
          }
        );

        anim.currentTime = progressFraction * durationMs;
        anim.playbackRate = reduceMotion ? 0 : 1;

        if (!isVisibleRef.current || reduceMotion) {
          if (reduceMotion) {
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

    return () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      ro?.disconnect();
      animRef.current?.cancel();
      animRef.current = null;
    };
  }, [direction, speedPxPerSec, reduceMotion, items]);

  // Pause / resume compositor animation smoothly based on section visibility
  useEffect(() => {
    const anim = animRef.current;
    if (!anim || reduceMotion) return;

    if (isSectionVisible) {
      if (anim.playState === 'paused') {
        anim.play();
      }
    } else {
      if (anim.playState === 'running') {
        anim.pause();
      }
    }
  }, [isSectionVisible, reduceMotion]);

  return (
    <div
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
        {CLONE_COPIES.map((copyIndex) => (
          <div
            key={copyIndex}
            ref={copyIndex === 0 ? firstGroupRef : undefined}
            aria-hidden={copyIndex > 0 ? true : undefined}
            className="flex shrink-0 items-stretch gap-3 pr-3"
          >
            {items.map((review) => (
              <ReviewCard
                key={`${copyIndex}-${review.id}`}
                review={review}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

export const LoginSocialProofSection = memo(function LoginSocialProofSection({
  reviews = DEMO_SOCIAL_PROOF_REVIEWS,
}: LoginSocialProofSectionProps) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isSectionVisible, setIsSectionVisible] = useState(true);

  // Pre-decode all review avatars once in background so zero decode hitches happen on scroll
  useEffect(() => {
    reviews.forEach((review) => {
      if (!review.avatarSrc) return;
      try {
        const img = new Image();
        img.src = review.avatarSrc;
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {});
        }
      } catch {}
    });
  }, [reviews]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsSectionVisible(entry.isIntersecting);
        }
      },
      { rootMargin: '240px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [track1, track2, track3] = useMemo(
    () => distributeReviewsIntoThreeTracks(reviews),
    [reviews]
  );

  return (
    <section
      ref={sectionRef}
      aria-label="Avaliações de visitantes"
      className="w-full bg-[#FFFFFF] pt-4 pb-2 shrink-0 overflow-hidden select-none pointer-events-none"
      style={{
        touchAction: 'pan-y',
        contain: 'layout style',
      }}
    >
      {/* Título exclusivo em uma única linha responsiva */}
      <div className="w-full px-4 mb-6 flex justify-center">
        <h2
          className="text-center font-bold text-[#000000] tracking-[-0.025em] whitespace-nowrap leading-tight"
          style={{
            fontSize: 'clamp(1.22rem, 5.2vw, 1.6rem)',
            fontFamily:
              "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          Quem vive, recomenda.
        </h2>
      </div>

      {/* Carrossel infinito de 3 faixas independentes com degradê branco lateral */}
      <div className="relative w-full overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-20 z-10 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF]/85 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-20 z-10 bg-gradient-to-l from-[#FFFFFF] via-[#FFFFFF]/85 to-transparent"
        />

        <div className="flex flex-col gap-3">
          <InfiniteReviewTrack
            items={track1}
            direction="left"
            speedPxPerSec={24}
            reduceMotion={shouldReduceMotion}
            isSectionVisible={isSectionVisible}
          />
          <InfiniteReviewTrack
            items={track2}
            direction="right"
            speedPxPerSec={20}
            reduceMotion={shouldReduceMotion}
            isSectionVisible={isSectionVisible}
          />
          <InfiniteReviewTrack
            items={track3}
            direction="left"
            speedPxPerSec={22}
            reduceMotion={shouldReduceMotion}
            isSectionVisible={isSectionVisible}
          />
        </div>
      </div>
    </section>
  );
});
