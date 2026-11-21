import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Spot } from '../types';
import { 
  Share2,
  Heart,
  Star,
  MapPin,
  Eye,
  Phone,
  Globe,
  QrCode,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';
import { SpotQrModal } from './SpotQrModal';
import { RoundedNavigationIcon } from './RoundedNavigationIcon';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { VerifiedBadge } from './ui/VerifiedBadge';
import {
  SpotVideo,
  fetchSpotVideos,
  saveVideoPlaybackPosition,
  getVideoPlaybackPosition,
} from '../services/spotVideosService';
import { useIOSBackEntry } from '../services/iosNavigationManager';
import { useLanguage } from '../contexts/LanguageContext';

const REVIEW_AVATAR_FALLBACKS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=180&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=180&auto=format&fit=crop&q=80',
];

function getReviewUserAvatar(rev: any, idx: number): string {
  const explicit = rev?.user_avatar || rev?.avatar_url || rev?.photoUrl || rev?.avatar;
  if (explicit && typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit;
  }
  const name = String(rev?.user_name || '').toLowerCase();
  if (name.includes('mariana')) {
    return REVIEW_AVATAR_FALLBACKS[0];
  }
  if (name.includes('lucas')) {
    return REVIEW_AVATAR_FALLBACKS[1];
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return REVIEW_AVATAR_FALLBACKS[(hash + idx) % REVIEW_AVATAR_FALLBACKS.length];
}

function formatReviewDateLabel(rawDate: any): string {
  if (!rawDate) return 'Recente';
  const str = String(rawDate).trim();
  if (str.startsWith('Há') || str === 'Hoje' || str === 'Ontem' || str === 'Recente') {
    return str;
  }
  const parsed = new Date(str.includes('T') ? str : str.replace(' ', 'T') + 'Z');
  if (isNaN(parsed.getTime())) {
    return str;
  }
  const diffMs = Date.now() - parsed.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Há 1 dia';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return 'Há 1 semana';
  if (diffWeeks < 5) return `Há ${diffWeeks} semanas`;
  const diffMonths = Math.max(1, Math.floor(diffDays / 30));
  return diffMonths === 1 ? 'Há 1 mês' : `Há ${diffMonths} meses`;
}

const ROUNDED_STAR_PATH =
  'M12 2.4c.42 0 .8.24.99.62l2.32 4.7 5.19.76c.42.06.77.35.9.76.13.4 0 .85-.3 1.15l-3.75 3.66.89 5.17c.07.42-.1.84-.44 1.09-.35.25-.8.28-1.18.08L12 18l-4.62 2.43c-.38.2-.83.17-1.18-.08-.34-.25-.51-.67-.44-1.09l.89-5.17-3.75-3.66c-.3-.3-.43-.75-.3-1.15.13-.41.48-.7.9-.76l5.19-.76 2.32-4.7c.19-.38.57-.62.99-.62z';

const SummaryRatingStars: React.FC<{ rating: number; idPrefix: string }> = ({ rating, idPrefix }) => {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <div className="flex items-center gap-1.5" aria-label={`${safeRating.toFixed(1)} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fillFraction = Math.max(0, Math.min(1, safeRating - i));
        const percent = Math.round(fillFraction * 100);
        const clipId = `${idPrefix}-star-clip-${i}`;
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className="w-[26px] h-[26px] shrink-0"
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={`${(24 * percent) / 100}`} height="24" />
              </clipPath>
            </defs>
            {/* Base Empty Star */}
            <path
              d={ROUNDED_STAR_PATH}
              fill="#EFEFF4"
              stroke="#C7C7CC"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Filled Yellow Star Portion */}
            {percent > 0 && (
              <path
                d={ROUNDED_STAR_PATH}
                fill="#F7B801"
                stroke="#F5B000"
                strokeWidth="0.6"
                strokeLinejoin="round"
                clipPath={`url(#${clipId})`}
              />
            )}
          </svg>
        );
      })}
    </div>
  );
};

const UserReviewStars: React.FC<{ rating: number }> = ({ rating }) => {
  const count = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
  return (
    <div className="flex items-center gap-[3px] shrink-0 pt-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const isFilled = i < count;
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className="w-[17px] h-[17px] shrink-0"
          >
            <path
              d={ROUNDED_STAR_PATH}
              fill={isFilled ? '#F7B801' : '#E5E5EA'}
              stroke={isFilled ? '#F5B000' : '#C7C7CC'}
              strokeWidth={isFilled ? '0.5' : '1'}
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
};

interface SpotDetailSheetProps {
  spot: Spot | null;
  onClose: () => void;
  onNavigateTo: (spot: Spot) => void;
  isFavorite: boolean;
  onToggleFavorite: (spotId: string) => void;
  onUpdateSpot?: (updatedSpot: Spot) => void;
  theme?: 'dark' | 'light';
}

export const SpotDetailSheet: React.FC<SpotDetailSheetProps> = React.memo(({
  spot,
  onClose,
  onNavigateTo,
  isFavorite,
  onToggleFavorite,
  onUpdateSpot,
}) => {
  const { tr } = useLanguage();
  const [activeTab, setActiveTab] = useState('Sobre');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isAllReviewsOpen, setIsAllReviewsOpen] = useState(false);
  const [showWriteReviewForm, setShowWriteReviewForm] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSheetRef = useRef<HTMLDivElement | null>(null);
  const heroMediaWrapperRef = useRef<HTMLDivElement | null>(null);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const pullDownY = useMotionValue(0);
  const pullDownScale = useTransform(pullDownY, [0, 380], [1, 0.94]);
  const pullDownRadius = useTransform(pullDownY, [0, 120], [0, 28]);
  const pullBackdropOpacity = useTransform(pullDownY, [0, 340], [1, 0.12]);

  // Register iOS Edge-Swipe Back Navigation for SpotDetailSheet and SpotQrModal
  useIOSBackEntry({
    id: `spot-detail:${spot?.id || 'active'}`,
    enabled: Boolean(spot),
    priority: 240,
    label: spot?.name || 'Detalhes do Local',
    getForegroundEl: () =>
      document.getElementById('spot-detail-sheet-container') ||
      document.getElementById('spot-detail-desktop-panel'),
    backgroundSelector: '#main-app-content',
    getBackdropEl: () => document.getElementById('spot-detail-sheet-backdrop'),
    onPop: () => {
      if (heroVideoRef.current && spot?.id && heroVideos[currentHeroVideoIndex]) {
        saveVideoPlaybackPosition(
          spot.id,
          heroVideos[currentHeroVideoIndex].id,
          heroVideoRef.current.currentTime
        );
      }
      onClose();
    },
  });

  useIOSBackEntry({
    id: `spot-qr:${spot?.id || 'active'}`,
    enabled: Boolean(spot && isQrModalOpen),
    priority: 265,
    label: 'QR Code do Local',
    foregroundSelector: '#spot-detail-sheet-container',
    backgroundSelector: '#main-app-content',
    onPop: () => setIsQrModalOpen(false),
  });

  // Live Rating & Reviews state synced with database
  const [liveRating, setLiveRating] = useState<number>(Number(spot?.rating ?? 5.0));
  const [liveReviewCount, setLiveReviewCount] = useState<number>(Number(spot?.reviewCount ?? 120));
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [userRatingInput, setUserRatingInput] = useState<number>(5);
  const [userCommentInput, setUserCommentInput] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewSubmittedMsg, setReviewSubmittedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!spot?.id) return;
    setLiveRating(Number(spot.rating ?? 5.0));
    setLiveReviewCount(Number(spot.reviewCount ?? 120));
    setReviewSubmittedMsg(null);
    setIsAllReviewsOpen(false);
    setShowWriteReviewForm(false);

    let active = true;
    fetch(`/api/spots/${encodeURIComponent(spot.id)}/reviews`)
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.success) return;
        if (typeof data.rating === 'number' && !isNaN(data.rating)) {
          setLiveRating(data.rating);
        }
        if (typeof data.reviewCount === 'number' && !isNaN(data.reviewCount)) {
          setLiveReviewCount(data.reviewCount);
        }
        if (Array.isArray(data.reviews)) {
          setReviewsList(data.reviews);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [spot?.id, spot?.rating, spot?.reviewCount]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spot?.id || isSubmittingReview) return;
    setIsSubmittingReview(true);
    setReviewSubmittedMsg(null);

    try {
      let userName = 'Visitante Monvian';
      let userId: string | undefined = undefined;
      try {
        const rawUser = localStorage.getItem('monvian_user');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          if (parsed?.name || parsed?.username) userName = parsed.name || parsed.username;
          if (parsed?.id) userId = String(parsed.id);
        }
      } catch {}

      const token = localStorage.getItem('monvian_token');
      const res = await fetch(`/api/spots/${encodeURIComponent(spot.id)}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          rating: userRatingInput,
          comment: userCommentInput.trim() || (userRatingInput === 5 ? 'Experiência impecável em Campos do Jordão!' : 'Muito bom, recomendo a visita.'),
          userName,
          userId,
        }),
      });

      const data = await res.json();
      if (data?.success) {
        const nextRating = Number(data.rating ?? userRatingInput);
        const nextCount = Number(data.reviewCount ?? liveReviewCount + 1);
        setLiveRating(nextRating);
        setLiveReviewCount(nextCount);
        if (Array.isArray(data.reviews)) {
          setReviewsList(data.reviews);
        }
        setUserCommentInput('');
        setReviewSubmittedMsg(
          `Avaliação registrada com sucesso! Média atual: ${nextRating.toFixed(1)}.`
        );

        const updatedSpotObj: Spot = data.spot || {
          ...spot,
          rating: nextRating,
          reviewCount: nextCount,
        };
        if (onUpdateSpot) {
          onUpdateSpot(updatedSpotObj);
        }
        window.dispatchEvent(
          new CustomEvent('monvian:spots_updated', {
            detail: { spot: updatedSpotObj },
          })
        );
      }
    } catch {
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Track viewport mode so only one <video> instance mounts & plays at a time
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px) and (min-height: 540px)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px) and (min-height: 540px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Top Hero Video Playlist state (1s cover photo -> translucent transition -> 1.2x infinite loop)
  const [heroVideos, setHeroVideos] = useState<SpotVideo[]>([]);
  const [currentHeroVideoIndex, setCurrentHeroVideoIndex] = useState(0);
  const [showHeroVideo, setShowHeroVideo] = useState(false);
  const [isTranslucentSwap, setIsTranslucentSwap] = useState(false);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [isHeroMuted, setIsHeroMuted] = useState(false);
  const [heroTapFeedback, setHeroTapFeedback] = useState<'play' | 'pause' | null>(null);
  const tapFeedbackTimerRef = useRef<number | null>(null);
  const pendingResumeTimeRef = useRef<number | null>(null);

  const currentHeroVideo = heroVideos[currentHeroVideoIndex] || null;

  // Persist current playback position
  const persistHeroPlaybackPosition = useCallback(() => {
    const vid = heroVideoRef.current;
    if (!vid || !spot?.id || !currentHeroVideo) return;
    if (vid.currentTime > 0 && !vid.ended) {
      saveVideoPlaybackPosition(spot.id, currentHeroVideo.id, vid.currentTime);
    }
  }, [spot?.id, currentHeroVideo]);

  // Load spot videos and start the 1-second timer to swap photo -> translucent video ONLY if the spot has videos
  useEffect(() => {
    if (!spot?.id) return;
    let isMounted = true;
    let swapStageTimer: number | null = null;
    let clearSwapOverlayTimer: number | null = null;
    const mountedAt = Date.now();

    setShowHeroVideo(false);
    setIsTranslucentSwap(false);
    setIsHeroPaused(false);
    setHeroVideos([]);

    fetchSpotVideos(spot.id, spot.name, spot.category).then((list) => {
      if (!isMounted) return;
      setHeroVideos(list);

      // If this tourist spot has no uploaded videos, load nothing and keep the cover photo
      if (!list || list.length === 0) {
        setShowHeroVideo(false);
        setIsTranslucentSwap(false);
        return;
      }

      const saved = getVideoPlaybackPosition(spot.id);
      if (saved) {
        const foundIdx = list.findIndex((v) => v.id === saved.videoId);
        if (foundIdx !== -1) {
          setCurrentHeroVideoIndex(foundIdx);
          pendingResumeTimeRef.current = saved.currentTime;
        } else {
          setCurrentHeroVideoIndex(0);
          pendingResumeTimeRef.current = 0;
        }
      } else {
        setCurrentHeroVideoIndex(0);
        pendingResumeTimeRef.current = 0;
      }

      // Keep photo for 1 second, then trigger translucent transition & load video
      const elapsed = Date.now() - mountedAt;
      const remainingDelay = Math.max(0, 1000 - elapsed);

      swapStageTimer = window.setTimeout(() => {
        if (!isMounted) return;
        setIsTranslucentSwap(true);
        setShowHeroVideo(true);
      }, remainingDelay);

      clearSwapOverlayTimer = window.setTimeout(() => {
        if (!isMounted) return;
        setIsTranslucentSwap(false);
      }, remainingDelay + 650);
    });

    return () => {
      isMounted = false;
      if (swapStageTimer !== null) window.clearTimeout(swapStageTimer);
      if (clearSwapOverlayTimer !== null) window.clearTimeout(clearSwapOverlayTimer);
      persistHeroPlaybackPosition();
    };
  }, [spot?.id, spot?.name, spot?.category]);

  // Save position before unmount / tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistHeroPlaybackPosition();
      }
    };
    window.addEventListener('pagehide', persistHeroPlaybackPosition);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      persistHeroPlaybackPosition();
      window.removeEventListener('pagehide', persistHeroPlaybackPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [persistHeroPlaybackPosition]);

  // Enforce 1.2x speed, audio, and resume time when video source loads
  const handleHeroVideoLoadedMetadata = () => {
    const vid = heroVideoRef.current;
    if (!vid) return;
    vid.playbackRate = 1.2;
    vid.defaultPlaybackRate = 1.2;
    vid.muted = isHeroMuted;
    vid.volume = 1.0;

    if (pendingResumeTimeRef.current && pendingResumeTimeRef.current > 0.2) {
      if (
        vid.duration &&
        !Number.isNaN(vid.duration) &&
        pendingResumeTimeRef.current < vid.duration - 0.4
      ) {
        vid.currentTime = pendingResumeTimeRef.current;
      }
      pendingResumeTimeRef.current = null;
    }

    if (!isHeroPaused) {
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          vid.muted = true;
          setIsHeroMuted(true);
          vid.play().catch(() => {});
        });
      }
    }
  };

  // Advance playlist or return cover photo to the card once video playback finishes
  const handleHeroVideoEnded = () => {
    if (heroVideos.length === 0 || !spot?.id) {
      setShowHeroVideo(false);
      return;
    }

    const nextIdx = currentHeroVideoIndex + 1;

    if (nextIdx < heroVideos.length) {
      const nextVid = heroVideos[nextIdx];
      if (nextVid) {
        saveVideoPlaybackPosition(spot.id, nextVid.id, 0);
      }
      pendingResumeTimeRef.current = 0;

      setIsTranslucentSwap(true);
      window.setTimeout(() => {
        setIsTranslucentSwap(false);
      }, 520);

      setCurrentHeroVideoIndex(nextIdx);
      setIsHeroPaused(false);
    } else {
      // Video finished: return the cover photo to the card
      if (heroVideos[0]) {
        saveVideoPlaybackPosition(spot.id, heroVideos[0].id, 0);
      }
      pendingResumeTimeRef.current = 0;

      setIsTranslucentSwap(true);
      setShowHeroVideo(false);
      setIsHeroPaused(false);
      setCurrentHeroVideoIndex(0);

      window.setTimeout(() => {
        setIsTranslucentSwap(false);
      }, 520);
    }
  };

  // Single click/tap on hero pauses or resumes video
  const handleToggleHeroPlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showHeroVideo || !heroVideoRef.current) return;
    const vid = heroVideoRef.current;

    if (tapFeedbackTimerRef.current) {
      window.clearTimeout(tapFeedbackTimerRef.current);
    }

    if (vid.paused) {
      vid.playbackRate = 1.2;
      vid.muted = isHeroMuted;
      vid.volume = 1.0;
      vid.play().catch(() => {});
      setIsHeroPaused(false);
      setHeroTapFeedback('play');
    } else {
      vid.pause();
      persistHeroPlaybackPosition();
      setIsHeroPaused(true);
      setHeroTapFeedback('pause');
    }

    tapFeedbackTimerRef.current = window.setTimeout(() => {
      setHeroTapFeedback(null);
    }, 650);
  };

  const handleToggleHeroMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vid = heroVideoRef.current;
    const nextMuted = !isHeroMuted;
    setIsHeroMuted(nextMuted);
    if (vid) {
      vid.muted = nextMuted;
      if (!nextMuted) {
        vid.volume = 1.0;
      }
    }
  };

  // Smooth scroll-driven blur & scale effect (native iOS fluid feel)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const rawScrollTop = e.currentTarget.scrollTop;
    const scrollTop = rawScrollTop < 0 ? 0 : rawScrollTop;
    if (!heroMediaWrapperRef.current) return;

    // As user scrolls down and the white card climbs over the sticky hero media:
    // progress smoothly scales from 0 (top) to 1 (when card has covered 240px).
    const progress = Math.min(1, Math.max(0, scrollTop / 240));
    const blurPx = progress * 16;
    const scale = 1.04 + progress * 0.04;
    const brightness = 1 - progress * 0.12;

    if (progress <= 0.002) {
      heroMediaWrapperRef.current.style.filter = 'none';
      heroMediaWrapperRef.current.style.transform = 'scale(1.04) translateZ(0)';
      heroMediaWrapperRef.current.style.webkitTransform = 'scale(1.04) translateZ(0)';
    } else {
      heroMediaWrapperRef.current.style.filter = `blur(${blurPx.toFixed(1)}px) brightness(${brightness.toFixed(2)})`;
      heroMediaWrapperRef.current.style.transform = `scale(${scale.toFixed(3)}) translateZ(0)`;
      heroMediaWrapperRef.current.style.webkitTransform = `scale(${scale.toFixed(3)}) translateZ(0)`;
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    if (heroMediaWrapperRef.current) {
      heroMediaWrapperRef.current.style.filter = 'none';
      heroMediaWrapperRef.current.style.transform = 'scale(1.04) translateZ(0)';
      heroMediaWrapperRef.current.style.webkitTransform = 'scale(1.04) translateZ(0)';
    }
  }, [spot?.id]);

  // Immediately close sheet when user clicks any option on the navigation bar
  useEffect(() => {
    const handleCloseAll = () => {
      persistHeroPlaybackPosition();
      onClose();
    };
    window.addEventListener('monvian-close-modals', handleCloseAll);
    return () => window.removeEventListener('monvian-close-modals', handleCloseAll);
  }, [onClose, persistHeroPlaybackPosition]);

  // Smooth native iOS pull-down-to-dismiss gesture on mobile when scrolled to top
  useEffect(() => {
    pullDownY.set(0);
    if (isDesktop || !spot) return;
    const container = mobileSheetRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isCandidate = false;
    let isPulling = false;
    let currentDragY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      // Leave left-edge zone free for iOS edge-swipe back navigation
      if (touch.clientX < 28) {
        isCandidate = false;
        isPulling = false;
        return;
      }
      const scrollTop = scrollRef.current ? scrollRef.current.scrollTop : 0;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      isCandidate = scrollTop <= 2;
      isPulling = false;
      currentDragY = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isCandidate || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!isPulling) {
        if (dy > 4 && dy > Math.abs(dx) * 1.1) {
          isPulling = true;
        } else if (Math.abs(dx) > 10 || dy < -6) {
          isCandidate = false;
          return;
        } else {
          return;
        }
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      currentDragY = Math.max(0, dy * 0.88);
      pullDownY.set(currentDragY);
    };

    const onTouchEnd = () => {
      if (!isPulling) {
        isCandidate = false;
        return;
      }
      const elapsed = Math.max(16, performance.now() - startTime);
      const velocityY = currentDragY / elapsed; // px/ms

      isCandidate = false;
      isPulling = false;

      if (currentDragY > 95 || (currentDragY > 40 && velocityY > 0.42)) {
        persistHeroPlaybackPosition();
        onClose();
      } else {
        animate(pullDownY, 0, {
          type: 'spring',
          stiffness: 420,
          damping: 36,
        });
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDesktop, spot?.id, onClose, persistHeroPlaybackPosition, pullDownY]);

  if (!spot) return null;

  const openDirectionsMap = (s: Spot) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const destination = s.lat && s.lng 
      ? `${s.lat},${s.lng}` 
      : encodeURIComponent(s.address ? `${s.name}, ${s.address}` : `${s.name} Campos do Jordão`);

    if (isIOS) {
      window.open(`https://maps.apple.com/?daddr=${destination}&dirflg=d`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
    }
  };

  const distance = "1,4 km";
  const views = ((spot.visitorsToday || 0) * 112 + 15000).toLocaleString('pt-BR');

  const phoneHref = spot.phone ? `tel:${spot.phone}` : 'tel:+551236631234';
  const websiteHref = spot.website || spot.mapsUrl || 'https://www.camposdojordao.sp.gov.br/turismo';

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: spot.name,
          text: `Confira ${spot.name} em Campos do Jordão!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      setIsQrModalOpen(true);
    }
  };

  return (
    <motion.div
      id="spot-detail-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => {
        persistHeroPlaybackPosition();
        onClose();
      }}
      className="fixed inset-0 z-[260] flex flex-col justify-end md:justify-center md:items-center md:pl-[calc(var(--desktop-sidebar-width,72px)+24px)] md:pr-6 md:py-6 select-none cursor-pointer"
    >
      {/* Dim scrim that fades smoothly when pulling down to reveal the previous page */}
      <motion.div
        aria-hidden="true"
        style={{ opacity: pullBackdropOpacity }}
        className="absolute inset-0 bg-black/45 md:bg-black/40 pointer-events-none"
      />
      {/* =====================================================================
          1. MOBILE VIEW (< 768px): SMOOTH HARDWARE-COMPOSED iOS SPRING ENTRANCE
         ===================================================================== */}
      <motion.div
        id="spot-detail-sheet-container"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.82 }}
        onClick={(e) => e.stopPropagation()}
        className="md:hidden relative w-full h-full flex flex-col z-[260] transform-gpu overflow-hidden bg-transparent"
        style={{
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform',
        }}
      >
        <motion.div
          ref={mobileSheetRef}
          style={{
            y: pullDownY,
            scale: pullDownScale,
            borderTopLeftRadius: pullDownRadius,
            borderTopRightRadius: pullDownRadius,
            willChange: 'transform',
          }}
          className="relative w-full h-full bg-transparent text-zinc-900 dark:text-white flex flex-col overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.20)]"
        >
        {/* Floating Top Bar Controls (Mobile) */}
        <div
          className="absolute left-0 right-0 z-30 flex items-center justify-between pointer-events-none px-5"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
          }}
        >
          <motion.button
            initial={{ opacity: 0, scale: 0.76, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 460, damping: 26, delay: 0.09 }}
            whileTap={{ scale: 0.88 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              persistHeroPlaybackPosition();
              onClose();
            }}
            className="pointer-events-auto w-[44px] h-[44px] rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.14)] flex items-center justify-center cursor-pointer transition-transform"
            title="Voltar"
            aria-label="Voltar para o mapa"
          >
            <ArrowLeft className="w-[21px] h-[21px]" strokeWidth={2.2} />
          </motion.button>

          <div className="flex items-center gap-2 pointer-events-auto">
            <motion.button 
              initial={{ opacity: 0, scale: 0.76, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 460, damping: 26, delay: 0.12 }}
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsQrModalOpen(true);
              }}
              className="w-[44px] h-[44px] rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.14)] flex items-center justify-center cursor-pointer transition-transform"
              title="Gerar QR Code deste local"
              aria-label="Gerar QR Code deste local"
            >
              <QrCode className="w-[20px] h-[20px]" strokeWidth={1.9} />
            </motion.button>
            <motion.button 
              initial={{ opacity: 0, scale: 0.76, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 460, damping: 26, delay: 0.15 }}
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className="w-[44px] h-[44px] rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.14)] flex items-center justify-center cursor-pointer transition-transform"
              title="Compartilhar"
              aria-label="Compartilhar"
            >
              <Share2 className="w-[20px] h-[20px]" strokeWidth={1.9} />
            </motion.button>
            <motion.button 
              initial={{ opacity: 0, scale: 0.76, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 460, damping: 26, delay: 0.18 }}
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(spot.id);
              }} 
              className="w-[44px] h-[44px] rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.14)] flex items-center justify-center cursor-pointer transition-transform"
              title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Heart
                className={`w-[20px] h-[20px] ${
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-[#111111] dark:text-white'
                }`}
                strokeWidth={1.9}
              />
            </motion.button>
          </div>
        </div>

        {/* Fluid Hardware-Accelerated Smooth Scroll Surface (Mobile) */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-none touch-pan-y"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            overscrollBehaviorY: 'none',
            transform: 'translateZ(0)',
          }}
        >
          {/* Header Media Area - Foto por 1s -> Efeito Translúcido -> Vídeo em 1.2x com loop e blur ao rolar */}
          <div 
            onClick={handleToggleHeroPlayPause}
            className="sticky top-0 h-[310px] sm:h-[340px] w-full shrink-0 select-none overflow-hidden bg-zinc-900 z-0 pointer-events-auto touch-pan-y cursor-pointer"
            style={{
              position: 'sticky',
              top: 0,
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
            }}
          >
            <motion.div
              initial={{ scale: 1.12 }}
              animate={{ scale: 1.04 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.9 }}
              ref={heroMediaWrapperRef}
              className="w-full h-full relative transform-gpu"
              style={{
                filter: 'none',
                transform: 'scale(1.04) translateZ(0)',
                WebkitTransform: 'scale(1.04) translateZ(0)',
                willChange: 'transform',
              }}
            >
              {/* Base Cover Photo (stays for 1s, then cross-fades under the translucent video) */}
              <img 
                src={getSpotImage(spot)} 
                alt={spot.name} 
                className={`w-full h-full object-cover pointer-events-none transition-all duration-700 ease-out ${
                  showHeroVideo && currentHeroVideo ? 'opacity-0 scale-105 blur-md' : 'opacity-100 scale-100 blur-0'
                }`}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
                }}
              />

              {/* Autoplay 1.2x Community Video inside Top Hero Area */}
              {!isDesktop && showHeroVideo && currentHeroVideo && (
                <motion.video
                  key={currentHeroVideo.id}
                  ref={heroVideoRef}
                  src={currentHeroVideo.videoUrl}
                  initial={{ opacity: 0, scale: 1.04, filter: 'blur(14px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  playsInline
                  muted={isHeroMuted}
                  autoPlay
                  onLoadedMetadata={handleHeroVideoLoadedMetadata}
                  onPlay={(e) => {
                    e.currentTarget.playbackRate = 1.2;
                  }}
                  onTimeUpdate={() => {
                    persistHeroPlaybackPosition();
                  }}
                  onEnded={handleHeroVideoEnded}
                  onError={() => {
                    setShowHeroVideo(false);
                    setIsTranslucentSwap(false);
                  }}
                />
              )}

              {/* Translucent Glass Swap Veil (efeito translúcido de troca) */}
              <AnimatePresence>
                {isTranslucentSwap && (
                  <motion.div
                    key="hero-translucent-veil"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.38, ease: 'easeInOut' }}
                    className="absolute inset-0 z-10 bg-white/25 dark:bg-white/15 pointer-events-none"
                  />
                )}
              </AnimatePresence>
            </motion.div>

            {/* Discreet iOS Audio Toggle on Mobile Hero Video */}
            {!isDesktop && showHeroVideo && currentHeroVideo && (
              <button
                type="button"
                onClick={handleToggleHeroMute}
                aria-label={isHeroMuted ? 'Ativar áudio' : 'Silenciar áudio'}
                className="absolute bottom-11 right-4 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 border border-white/15 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
              >
                {isHeroMuted ? (
                  <VolumeX className="w-4 h-4 text-white/90" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
            )}

            {/* Single-Tap Pause/Play Translucent Indicator */}
            <AnimatePresence>
              {(isHeroPaused || heroTapFeedback) && showHeroVideo && (
                <motion.div
                  key="hero-tap-indicator"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                >
                  <div className="w-12 h-12 rounded-full bg-black/45 border border-white/20 flex items-center justify-center text-white shadow-lg">
                    {isHeroPaused || heroTapFeedback === 'pause' ? (
                      <Pause className="w-5 h-5 fill-white text-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtle Top Shadow for Control Legibility */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 via-black/10 to-transparent pointer-events-none" />
          </div>

          {/* Main Content Body - Card Branco Puro Premium iOS */}
          <div
            className="relative z-10 -mt-7 bg-[#FFFFFF] dark:bg-[#000000] border-t border-black/[0.04] dark:border-white/10 rounded-t-[32px] rounded-b-none px-5 pt-7 flex flex-col min-h-[calc(var(--app-height,100dvh)-60px)] shadow-[0_-6px_28px_rgba(0,0,0,0.06)] dark:shadow-[0_-12px_36px_rgba(0,0,0,0.5)]"
            style={{
              paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 32px), 40px)',
              transform: 'translate3d(0, 0, 0)',
              WebkitTransform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* 1. Título forte + Selo de verificação azul */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.08 }}
              className="flex items-center gap-2.5 mb-4"
            >
              <h1 className="text-[26px] sm:text-[28px] font-extrabold tracking-[-0.02em] text-[#0B0B0C] dark:text-[#FFFFFF] leading-[1.15]">
                {spot.name}
              </h1>
              <VerifiedBadge className="w-[21px] h-[21px] shrink-0" />
            </motion.div>

            {/* 2. Três indicadores distribuídos uniformemente pela largura */}
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.12 }}
              className="grid grid-cols-3 gap-2.5 mb-5"
            >
              <div className="h-[42px] px-2.5 rounded-full bg-[#F3F3F5] dark:bg-[#1C1C1E] dark:border dark:border-white/10 flex items-center justify-center gap-1.5 min-w-0 tabular-nums">
                <Star className="w-[16px] h-[16px] fill-[#111111] text-[#111111] dark:fill-white dark:text-white shrink-0" />
                <span className="text-[14px] font-bold text-[#111111] dark:text-[#FFFFFF] leading-none">
                  {Number(liveRating).toFixed(1)}
                </span>
                <span className="text-[13.5px] font-medium text-[#71717A] dark:text-[#A1A1AA] leading-none">
                  ({liveReviewCount})
                </span>
              </div>

              <div className="h-[42px] px-2.5 rounded-full bg-[#F3F3F5] dark:bg-[#1C1C1E] dark:border dark:border-white/10 flex items-center justify-center gap-1.5 min-w-0 tabular-nums">
                <MapPin className="w-[16px] h-[16px] text-[#111111] dark:text-white shrink-0" strokeWidth={2} />
                <span className="text-[14px] font-semibold text-[#52525B] dark:text-[#D4D4D8] leading-none truncate">
                  {distance}
                </span>
              </div>

              <div className="h-[42px] px-2.5 rounded-full bg-[#F3F3F5] dark:bg-[#1C1C1E] dark:border dark:border-white/10 flex items-center justify-center gap-1.5 min-w-0 tabular-nums">
                <Eye className="w-[17px] h-[17px] text-[#3F3F46] dark:text-[#A1A1AA] shrink-0" strokeWidth={1.9} />
                <span className="text-[14px] font-semibold text-[#52525B] dark:text-[#D4D4D8] leading-none truncate">
                  {views}
                </span>
              </div>
            </motion.div>

            {/* 3. Botões principais — Ligar e Site (2 colunas iguais, altura e destaque premium) */}
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.16 }}
              className="grid grid-cols-2 gap-3 mb-7"
            >
              <motion.a
                whileTap={{ scale: 0.95 }}
                href={phoneHref}
                className="h-[54px] px-4 rounded-full bg-[#0B0B0C] hover:bg-[#1C1C1E] text-white dark:bg-white dark:text-black shadow-[0_6px_18px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                title="Ligar para o estabelecimento"
              >
                <Phone className="w-[19px] h-[19px] shrink-0" strokeWidth={2} />
                <span className="text-[16px] font-semibold tracking-[-0.01em]">Ligar</span>
              </motion.a>

              <motion.a
                whileTap={{ scale: 0.95 }}
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="h-[54px] px-4 rounded-full bg-[#FFFFFF] hover:bg-[#FAFAFA] text-[#111111] dark:bg-[#1C1C1E] dark:text-white border border-[#E5E5EA] dark:border-white/15 shadow-[0_4px_14px_rgba(0,0,0,0.05)] flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                title="Acessar Website"
              >
                <Globe className="w-[19px] h-[19px] shrink-0" strokeWidth={1.9} />
                <span className="text-[16px] font-semibold tracking-[-0.01em]">Site</span>
              </motion.a>
            </motion.div>

            {/* 4. Navegação por abas */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30, delay: 0.19 }}
              className="grid grid-cols-3 border-b border-[#EFEFF1] dark:border-white/10 mb-5"
              role="tablist"
            >
              {['Sobre', 'Experiência', 'Avaliações'].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-[15px] tracking-[-0.01em] text-center transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'text-[#0B0B0C] dark:text-white font-bold'
                        : 'text-[#8E8E93] dark:text-zinc-500 font-medium hover:text-[#3F3F46] dark:hover:text-zinc-300'
                    }`}
                  >
                    <span>{tr(tab)}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeSpotTab"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[#0B0B0C] dark:bg-white"
                      />
                    )}
                  </button>
                );
              })}
            </motion.div>

            {/* Tab Panels */}
            <div className="flex-1 space-y-5 pb-4">
              {activeTab === 'Sobre' && (
                <motion.div
                  key="tab-sobre"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30, delay: 0.04 }}
                  className="space-y-5"
                >
                  {/* 5. Cartões informativos lado a lado (Horário de funcionamento e Entrada) */}
                  <motion.div
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.21 }}
                    className="grid grid-cols-2 gap-3.5"
                  >
                    <div className="p-4 rounded-[22px] bg-[#F6F6F8] dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/10 flex flex-col justify-between min-h-[124px]">
                      <div className="flex items-start gap-2.5">
                        <Clock
                          className="w-[22px] h-[22px] text-[#111111] dark:text-white shrink-0 mt-0.5"
                          strokeWidth={1.9}
                        />
                        <span className="text-[13px] font-medium text-[#71717A] dark:text-[#A1A1AA] leading-[1.25]">
                          Horário de Funcionamento
                        </span>
                      </div>
                      <span className="mt-3 text-[15.5px] font-bold text-[#111111] dark:text-[#FFFFFF] leading-[1.3] block">
                        {spot.hours || '09:00 - 18:00'}
                      </span>
                    </div>

                    <div className="p-4 rounded-[22px] bg-[#F6F6F8] dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/10 flex flex-col justify-between min-h-[124px]">
                      <div className="flex items-start gap-2.5">
                        <Ticket
                          className="w-[22px] h-[22px] text-[#111111] dark:text-white shrink-0 mt-0.5"
                          strokeWidth={1.9}
                        />
                        <span className="text-[13px] font-medium text-[#71717A] dark:text-[#A1A1AA] leading-[1.25]">
                          Entrada
                        </span>
                      </div>
                      <span className="mt-3 text-[15.5px] font-bold text-[#111111] dark:text-[#FFFFFF] leading-[1.3] block">
                        {spot.priceRange === 'Grátis' ? 'Acesso Livre' : spot.priceRange || 'Consultar'}
                      </span>
                    </div>
                  </motion.div>

                  {/* 6. Botão de GPS proeminente */}
                  <motion.button
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.25 }}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => openDirectionsMap(spot)}
                    className="w-full h-[58px] rounded-full px-6 flex items-center justify-between bg-[#0B0B0C] hover:bg-[#1C1C1E] text-white dark:bg-white dark:text-black shadow-[0_8px_22px_rgba(0,0,0,0.14)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <RoundedNavigationIcon className="w-[20px] h-[20px] shrink-0" size={20} />
                      <span className="text-[16.5px] font-bold tracking-[-0.01em]">
                        Como chegar no GPS
                      </span>
                    </div>
                    <ArrowRight className="w-[21px] h-[21px] shrink-0" strokeWidth={2.2} />
                  </motion.button>

                  {/* Descrição e endereço do estabelecimento preservados abaixo */}
                  {spot.description && (
                    <p className="text-[14.5px] text-[#52525B] dark:text-zinc-300 leading-relaxed pt-1">
                      {spot.description}
                    </p>
                  )}

                  {spot.address && (
                    <div className="flex items-center gap-2 text-[13px] text-[#71717A] dark:text-[#A1A1AA]">
                      <MapPin className="w-4 h-4 shrink-0 text-[#52525B] dark:text-[#A1A1AA]" />
                      <span>{spot.address}</span>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'Experiência' && (
                <motion.div
                  key="tab-experiencia"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-[#F6F6F8] dark:bg-[#1C1C1E] rounded-[22px] border border-black/[0.04] dark:border-white/10 space-y-3">
                    <h3 className="font-bold text-[#111111] dark:text-white text-xs uppercase tracking-wider">O que esperar</h3>
                    <ul className="space-y-2.5 text-sm text-[#52525B] dark:text-zinc-300">
                      <li className="flex items-start gap-2">
                        <span className="text-[#111111] dark:text-white font-bold">✓</span>
                        <span>Mirante panorâmico com vista de tirar o fôlego para vales e montanhas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#111111] dark:text-white font-bold">✓</span>
                        <span>Excelente ponto para fotografia e contemplação do pôr do sol</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#111111] dark:text-white font-bold">✓</span>
                        <span>Estacionamento e cafés típicos nas imediações</span>
                      </li>
                    </ul>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30, delay: 0.04 }}
                    className="p-4 bg-[#F6F6F8] dark:bg-[#1C1C1E] rounded-[22px] border border-black/[0.04] dark:border-white/10"
                  >
                    <h4 className="font-bold text-[#111111] dark:text-white text-xs uppercase tracking-wider mb-2">Dica de quem foi</h4>
                    <p className="text-sm text-[#52525B] dark:text-zinc-300 leading-relaxed">
                      {spot.touristTip || 'Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!'}
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'Avaliações' && (
                <motion.div
                  key="tab-avaliacoes"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="space-y-4 pt-0.5 bg-[#FFFFFF]"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  {/* 3. Resumo das avaliações — Card único, amplo e minimalista */}
                  <div
                    className="flex items-center justify-between px-5 py-6 bg-[#FFFFFF] rounded-[26px] border border-[#EBEBEF] shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <div className="w-[43%] flex flex-col items-center justify-center pr-2">
                      <span className="text-[48px] leading-none font-extrabold text-[#0B0B0C] tracking-[-0.03em] tabular-nums">
                        {Number(liveRating).toFixed(1)}
                      </span>
                      <span className="text-[14.5px] font-normal text-[#6E6E73] mt-2 tracking-[-0.01em]">
                        {tr('de 5.0 estrelas')}
                      </span>
                    </div>

                    {/* Separação visual discreta entre a nota e as estrelas */}
                    <div className="w-[1px] h-[58px] bg-[#DCDCE1] shrink-0" />

                    <div className="w-[56%] flex flex-col items-center justify-center pl-2">
                      <SummaryRatingStars rating={Number(liveRating)} idPrefix="mobile-summary" />
                      <span className="text-[15px] font-normal text-[#6E6E73] mt-2.5 tracking-[-0.01em] tabular-nums">
                        {tr(`${liveReviewCount} avaliações`)}
                      </span>
                    </div>
                  </div>

                  {/* 4. Avaliações dos usuários — Cards modernos seguindo exatamente a referência */}
                  {(reviewsList.length > 0
                    ? reviewsList.slice(0, 2)
                    : [
                        {
                          id: 'default-1',
                          user_name: 'Mariana Costa',
                          rating: 5,
                          comment:
                            'Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável.',
                          created_at: 'Há 2 dias',
                        },
                        {
                          id: 'default-2',
                          user_name: 'Lucas Ferreira',
                          rating: 5,
                          comment:
                            'Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes.',
                          created_at: 'Há 1 semana',
                        },
                      ]
                  ).map((rev, idx) => (
                    <motion.div
                      key={rev.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.04 * Math.min(idx, 4) }}
                      className="p-5 bg-[#FFFFFF] rounded-[26px] border border-[#EBEBEF] shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                      style={{ backgroundColor: '#ffffff' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={getReviewUserAvatar(rev, idx)}
                            alt={rev.user_name || 'Visitante'}
                            className="w-[48px] h-[48px] rounded-full object-cover shrink-0 bg-[#E5E5EA]"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = REVIEW_AVATAR_FALLBACKS[idx % REVIEW_AVATAR_FALLBACKS.length];
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[17px] font-bold text-[#0B0B0C] leading-[1.2] tracking-[-0.015em] truncate">
                              {rev.user_name || 'Visitante'}
                            </span>
                            <span className="text-[14px] font-normal text-[#8E8E93] leading-[1.2] mt-1">
                              {formatReviewDateLabel(rev.created_at)}
                            </span>
                          </div>
                        </div>
                        <UserReviewStars rating={Number(rev.rating ?? 5)} />
                      </div>
                      <p className="mt-3.5 text-[16px] font-normal text-[#1C1C1E] leading-[1.42] tracking-[-0.01em]">
                        {rev.comment}
                      </p>
                    </motion.div>
                  ))}

                  {/* 5. Botão inferior — Ver todas as avaliações */}
                  <button
                    type="button"
                    onClick={() => setIsAllReviewsOpen(true)}
                    className="w-full h-[56px] rounded-full bg-[#FFFFFF] border border-[#E5E5EA] shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex items-center justify-center gap-1.5 text-[16.5px] font-bold text-[#0B0B0C] tracking-[-0.01em] hover:bg-[#FAFAFC] active:scale-[0.98] transition-all cursor-pointer"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <span>{tr('Ver todas as avaliações')}</span>
                    <ChevronRight className="w-[19px] h-[19px] text-[#0B0B0C] shrink-0" strokeWidth={2.4} />
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* =====================================================================
          2. DESKTOP & TABLET VIEW (>= 768px): TWO-COLUMN HORIZONTAL PANEL
         ===================================================================== */}
      <motion.div
        id="spot-detail-desktop-panel"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
        onClick={(e) => e.stopPropagation()}
        className="hidden md:flex flex-col lg:flex-row w-full max-w-[960px] lg:max-w-[1080px] xl:max-w-[1180px] 2xl:max-w-[1260px] md:max-h-[88vh] lg:h-[min(680px,85vh)] xl:h-[min(730px,85vh)] bg-white dark:bg-[#000000] text-zinc-950 dark:text-white rounded-[24px] border border-zinc-200/90 dark:border-[#262626] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden cursor-default z-[260]"
        style={{
          fontFamily: "'Inter', sans-serif",
          willChange: 'transform, opacity',
        }}
      >
        {/* LEFT COLUMN (56-58% on Desktop): Horizontal Media & Floating Controls */}
        <div className="relative w-full lg:w-[56%] xl:w-[58%] h-[260px] md:h-[300px] lg:h-full p-3 lg:p-4 shrink-0 flex flex-col bg-white dark:bg-[#000000]">
          <div 
            onClick={handleToggleHeroPlayPause}
            className="relative w-full h-full rounded-[18px] overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-[#262626] cursor-pointer"
          >
            <img
              src={getSpotImage(spot)}
              alt={spot.name}
              className={`w-full h-full object-cover select-none transition-all duration-700 ease-out ${
                showHeroVideo && currentHeroVideo ? 'opacity-0 scale-105 blur-md' : 'opacity-100 scale-100 blur-0'
              }`}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getSpotFallbackImage(spot.name, spot.category);
              }}
            />

            {/* Autoplay 1.2x Community Video on Desktop Hero */}
            {isDesktop && showHeroVideo && currentHeroVideo && (
              <motion.video
                key={currentHeroVideo.id}
                ref={heroVideoRef}
                src={currentHeroVideo.videoUrl}
                initial={{ opacity: 0, scale: 1.04, filter: 'blur(14px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                playsInline
                muted={isHeroMuted}
                autoPlay
                onLoadedMetadata={handleHeroVideoLoadedMetadata}
                onPlay={(e) => {
                  e.currentTarget.playbackRate = 1.2;
                }}
                onTimeUpdate={() => {
                  persistHeroPlaybackPosition();
                }}
                onEnded={handleHeroVideoEnded}
                onError={() => {
                  setShowHeroVideo(false);
                  setIsTranslucentSwap(false);
                }}
              />
            )}

            {/* Discreet iOS Audio Toggle on Desktop Hero Video */}
            {isDesktop && showHeroVideo && currentHeroVideo && (
              <button
                type="button"
                onClick={handleToggleHeroMute}
                aria-label={isHeroMuted ? 'Ativar áudio' : 'Silenciar áudio'}
                className="absolute bottom-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 border border-white/15 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
              >
                {isHeroMuted ? (
                  <VolumeX className="w-4 h-4 text-white/90" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
            )}

            {/* Translucent Glass Swap Veil on Desktop */}
            <AnimatePresence>
              {isTranslucentSwap && (
                <motion.div
                  key="desktop-hero-translucent-veil"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: 'easeInOut' }}
                  className="absolute inset-0 z-10 bg-white/25 dark:bg-white/15 pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* Single-Tap Pause/Play Translucent Indicator on Desktop */}
            <AnimatePresence>
              {(isHeroPaused || heroTapFeedback) && showHeroVideo && (
                <motion.div
                  key="desktop-hero-tap-indicator"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                >
                  <div className="w-12 h-12 rounded-full bg-black/45 border border-white/20 flex items-center justify-center text-white shadow-lg">
                    {isHeroPaused || heroTapFeedback === 'pause' ? (
                      <Pause className="w-5 h-5 fill-white text-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtle top vignette for control legibility */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />

            {/* Top-Left: Back Button */}
            <div className="absolute top-3.5 left-3.5 z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  persistHeroPlaybackPosition();
                  onClose();
                }}
                className="w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.14)] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Voltar"
                aria-label="Voltar para o mapa"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
              </button>
            </div>

            {/* Top-Right: Discreet Floating Controls (QR Code, Share, Favorite) */}
            <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsQrModalOpen(true);
                }}
                className="w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.14)] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Gerar QR Code deste local"
                aria-label="QR Code"
              >
                <QrCode className="w-5 h-5" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                className="w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.14)] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Compartilhar"
                aria-label="Compartilhar"
              >
                <Share2 className="w-5 h-5" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(spot.id);
                }}
                className="w-11 h-11 rounded-full bg-white dark:bg-[#1C1C1E] text-[#111111] dark:text-white border border-black/[0.05] dark:border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.14)] flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                aria-label="Favoritar"
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    isFavorite ? 'fill-red-500 text-red-500' : 'text-[#111111] dark:text-white'
                  }`}
                  strokeWidth={1.9}
                />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (42-44% on Desktop): Structured Info, Actions & Integrated Tabs */}
        <div
          className="flex-1 lg:w-[44%] xl:w-[42%] h-full min-h-0 flex flex-col bg-white dark:bg-[#000000] px-5 py-4 lg:px-7 lg:py-6 overflow-hidden"
          style={{ backgroundColor: activeTab === 'Avaliações' ? '#ffffff' : undefined }}
        >
          {/* 1 & 2. Full Name + Verification Indicator */}
          <div
            className="flex items-center gap-2.5 shrink-0 bg-[#FFFFFF] dark:bg-transparent"
            style={{ backgroundColor: '#ffffff' }}
          >
            <h1 className="text-2xl xl:text-[27px] font-extrabold tracking-[-0.02em] text-[#0B0B0C] dark:text-white leading-tight">
              {spot.name}
            </h1>
            <VerifiedBadge className="w-[20px] h-[20px] shrink-0" />
          </div>

          {/* 3. Three Uniform Indicators (Rating, Distance, Views) */}
          <div
            className="grid grid-cols-3 gap-2 mt-3.5 shrink-0 bg-[#FFFFFF] dark:bg-transparent"
            style={{ backgroundColor: '#ffffff' }}
          >
            <div className="h-[38px] px-2.5 rounded-full bg-[#F3F3F5] dark:bg-[#1C1C1E] dark:border dark:border-white/10 flex items-center justify-center gap-1.5 min-w-0 tabular-nums">
              <Star className="w-4 h-4 fill-[#111111] text-[#111111] dark:fill-white dark:text-white shrink-0" />
              <span className="text-[13px] font-bold text-[#111111] dark:text-white">{Number(liveRating).toFixed(1)}</span>
              <span className="text-[12.5px] font-medium text-[#71717A] dark:text-[#A1A1AA]">({liveReviewCount})</span>
            </div>
            <div className="h-[38px] px-2.5 rounded-full bg-[#F3F3F5] dark:bg-[#1C1C1E] dark:border dark:border-white/10 flex items-center justify-center gap-1.5 min-w-0 tabular-nums">
              <MapPin className="w-4 h-4 text-[#111111] dark:text-white shrink-0" strokeWidth={2} />
              <span className="text-[13px] font-semibold text-[#52525B] dark:text-[#D4D4D8] truncate">{distance}</span>
            </div>
            <div className="h-[38px] px-2.5 rounded-full bg-[#F3F3F5] dark:bg-[#1C1C1E] dark:border dark:border-white/10 flex items-center justify-center gap-1.5 min-w-0 tabular-nums">
              <Eye className="w-4 h-4 text-[#3F3F46] dark:text-[#A1A1AA] shrink-0" strokeWidth={1.9} />
              <span className="text-[13px] font-semibold text-[#52525B] dark:text-[#D4D4D8] truncate">{views}</span>
            </div>
          </div>

          {/* 4. Action Buttons Side-by-Side (Ligar, Site) */}
          <div className="grid grid-cols-2 gap-3 mt-4 shrink-0">
            <a
              href={phoneHref}
              className="h-[48px] px-4 rounded-full bg-[#0B0B0C] hover:bg-[#1C1C1E] text-white dark:bg-white dark:text-black text-[14.5px] font-semibold flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-colors cursor-pointer"
              title="Ligar para o local"
            >
              <Phone className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
              <span>Ligar</span>
            </a>

            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="h-[48px] px-4 rounded-full bg-[#FFFFFF] hover:bg-[#FAFAFA] text-[#111111] dark:bg-[#1C1C1E] dark:text-white border border-[#E5E5EA] dark:border-white/15 text-[14.5px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-colors cursor-pointer"
              title="Acessar site oficial"
            >
              <Globe className="w-[17px] h-[17px] shrink-0" strokeWidth={1.9} />
              <span>Site</span>
            </a>
          </div>

          {/* 5. Horizontal Desktop Tab Navigation (Sobre, Experiência, Avaliações) */}
          <div className="grid grid-cols-3 border-b border-[#EFEFF1] dark:border-[#262626] mt-5 shrink-0" role="tablist">
            {['Sobre', 'Experiência', 'Avaliações'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-2.5 text-[13.5px] text-center transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'text-[#0B0B0C] dark:text-white font-bold'
                      : 'text-[#8E8E93] font-medium hover:text-[#3F3F46] dark:hover:text-zinc-200'
                  }`}
                >
                  <span>{tr(tab)}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeSpotTabDesktop"
                      transition={{ type: 'spring', damping: 28, stiffness: 360 }}
                      className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full bg-[#0B0B0C] dark:bg-white"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Scrollable Tab Content Area (Independent vertical scroll inside right column) */}
          <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-2 pr-1 space-y-4 custom-scrollbar">
            {activeTab === 'Sobre' && (
              <motion.div
                key="desktop-tab-sobre"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                {/* Practical Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-[20px] bg-[#F6F6F8] dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/10 flex flex-col justify-between min-h-[108px]">
                    <div className="flex items-start gap-2">
                      <Clock className="w-[19px] h-[19px] text-[#111111] dark:text-white shrink-0 mt-0.5" strokeWidth={1.9} />
                      <span className="text-[12px] text-[#71717A] dark:text-[#A1A1AA] font-medium leading-tight">
                        Horário de Funcionamento
                      </span>
                    </div>
                    <span className="mt-2.5 text-[14.5px] font-bold text-[#111111] dark:text-white leading-snug block">
                      {spot.hours || '09:00 - 18:00'}
                    </span>
                  </div>
                  <div className="p-4 rounded-[20px] bg-[#F6F6F8] dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/10 flex flex-col justify-between min-h-[108px]">
                    <div className="flex items-start gap-2">
                      <Ticket className="w-[19px] h-[19px] text-[#111111] dark:text-white shrink-0 mt-0.5" strokeWidth={1.9} />
                      <span className="text-[12px] text-[#71717A] dark:text-[#A1A1AA] font-medium leading-tight">
                        Entrada
                      </span>
                    </div>
                    <span className="mt-2.5 text-[14.5px] font-bold text-[#111111] dark:text-white leading-snug block">
                      {spot.priceRange === 'Grátis' ? 'Acesso Livre' : (spot.priceRange || 'Consultar')}
                    </span>
                  </div>
                </div>

                {/* Desktop GPS CTA */}
                <button
                  type="button"
                  onClick={() => openDirectionsMap(spot)}
                  className="w-full h-[52px] rounded-full px-5 flex items-center justify-between bg-[#0B0B0C] hover:bg-[#1C1C1E] text-white dark:bg-white dark:text-black shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <RoundedNavigationIcon className="w-[18px] h-[18px] shrink-0" size={18} />
                    <span className="text-[15px] font-bold">Como chegar no GPS</span>
                  </div>
                  <ArrowRight className="w-[19px] h-[19px] shrink-0" strokeWidth={2.2} />
                </button>

                {spot.description && (
                  <p className="text-[13.5px] text-[#52525B] dark:text-zinc-300 leading-relaxed">
                    {spot.description}
                  </p>
                )}

                {spot.address && (
                  <div className="flex items-center gap-2 text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[#52525B] dark:text-[#A1A1AA]" />
                    <span>{spot.address}</span>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'Experiência' && (
              <motion.div
                key="desktop-tab-experiencia"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-3.5"
              >
                <div className="p-4 bg-[#F6F6F8] dark:bg-[#1C1C1E] rounded-[22px] border border-black/[0.04] dark:border-white/10 space-y-2.5">
                  <h3 className="font-bold text-[#111111] dark:text-white text-xs uppercase tracking-wider">
                    O que esperar
                  </h3>
                  <ul className="space-y-2 text-[13px] text-[#52525B] dark:text-zinc-300">
                    <li className="flex items-start gap-2">
                      <span className="text-[#111111] dark:text-white font-bold">✓</span>
                      <span>Mirante panorâmico com vista de tirar o fôlego para vales e montanhas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#111111] dark:text-white font-bold">✓</span>
                      <span>Excelente ponto para fotografia e contemplação do pôr do sol</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#111111] dark:text-white font-bold">✓</span>
                      <span>Estacionamento e cafés típicos nas imediações</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-[#F6F6F8] dark:bg-[#1C1C1E] rounded-[22px] border border-black/[0.04] dark:border-white/10">
                  <h4 className="font-bold text-[#111111] dark:text-white text-xs uppercase tracking-wider mb-1.5">
                    Dica de quem foi
                  </h4>
                  <p className="text-[13px] text-[#52525B] dark:text-zinc-300 leading-relaxed">
                    {spot.touristTip || 'Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!'}
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'Avaliações' && (
              <motion.div
                key="desktop-tab-avaliacoes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-3.5 bg-[#FFFFFF]"
                style={{ backgroundColor: '#ffffff' }}
              >
                {/* Resumo das avaliações */}
                <div
                  className="flex items-center justify-between px-5 py-5 bg-[#FFFFFF] rounded-[24px] border border-[#EBEBEF] shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <div className="w-[43%] flex flex-col items-center justify-center pr-2">
                    <span className="text-[42px] leading-none font-extrabold text-[#0B0B0C] tracking-[-0.03em] tabular-nums">
                      {Number(liveRating).toFixed(1)}
                    </span>
                    <span className="text-[13.5px] font-normal text-[#6E6E73] mt-2 tracking-[-0.01em]">
                      {tr('de 5.0 estrelas')}
                    </span>
                  </div>

                  <div className="w-[1px] h-[54px] bg-[#DCDCE1] shrink-0" />

                  <div className="w-[56%] flex flex-col items-center justify-center pl-2">
                    <SummaryRatingStars rating={Number(liveRating)} idPrefix="desktop-summary" />
                    <span className="text-[14px] font-normal text-[#6E6E73] mt-2 tracking-[-0.01em] tabular-nums">
                      {tr(`${liveReviewCount} avaliações`)}
                    </span>
                  </div>
                </div>

                {/* Avaliações dos usuários */}
                {(reviewsList.length > 0
                  ? reviewsList.slice(0, 2)
                  : [
                      {
                        id: 'default-1',
                        user_name: 'Mariana Costa',
                        rating: 5,
                        comment:
                          'Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável.',
                        created_at: 'Há 2 dias',
                      },
                      {
                        id: 'default-2',
                        user_name: 'Lucas Ferreira',
                        rating: 5,
                        comment:
                          'Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes.',
                        created_at: 'Há 1 semana',
                      },
                    ]
                ).map((rev, idx) => (
                  <div
                    key={rev.id || idx}
                    className="p-4.5 bg-[#FFFFFF] rounded-[24px] border border-[#EBEBEF] shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getReviewUserAvatar(rev, idx)}
                          alt={rev.user_name || 'Visitante'}
                          className="w-[44px] h-[44px] rounded-full object-cover shrink-0 bg-[#E5E5EA]"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = REVIEW_AVATAR_FALLBACKS[idx % REVIEW_AVATAR_FALLBACKS.length];
                          }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[15.5px] font-bold text-[#0B0B0C] leading-[1.2] tracking-[-0.015em] truncate">
                            {rev.user_name || 'Visitante'}
                          </span>
                          <span className="text-[13px] font-normal text-[#8E8E93] leading-[1.2] mt-0.5">
                            {formatReviewDateLabel(rev.created_at)}
                          </span>
                        </div>
                      </div>
                      <UserReviewStars rating={Number(rev.rating ?? 5)} />
                    </div>
                    <p className="mt-3 text-[14.5px] font-normal text-[#1C1C1E] leading-[1.42] tracking-[-0.01em]">
                      {rev.comment}
                    </p>
                  </div>
                ))}

                {/* Botão inferior — Ver todas as avaliações */}
                <button
                  type="button"
                  onClick={() => setIsAllReviewsOpen(true)}
                  className="w-full h-[52px] rounded-full bg-[#FFFFFF] border border-[#E5E5EA] shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex items-center justify-center gap-1.5 text-[15.5px] font-bold text-[#0B0B0C] tracking-[-0.01em] hover:bg-[#FAFAFC] active:scale-[0.98] transition-all cursor-pointer"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <span>{tr('Ver todas as avaliações')}</span>
                  <ChevronRight className="w-[18px] h-[18px] text-[#0B0B0C] shrink-0" strokeWidth={2.4} />
                </button>
              </motion.div>
            )}
          </div>
        </div>
        </motion.div>
      </motion.div>

      {/* Listagem Completa das Avaliações */}
      <AnimatePresence>
        {isAllReviewsOpen && (
          <motion.div
            key="all-reviews-overlay"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[280] bg-[#FFFFFF] flex flex-col overflow-hidden"
            style={{
              backgroundColor: '#ffffff',
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif",
            }}
          >
            {/* Topo da listagem completa */}
            <div
              className="flex items-center justify-between px-5 pb-3.5 border-b border-[#EFEFF1] bg-[#FFFFFF] shrink-0"
              style={{
                backgroundColor: '#ffffff',
                paddingTop: 'max(calc(env(safe-area-inset-top, 14px) + 12px), 20px)',
              }}
            >
              <button
                type="button"
                onClick={() => setIsAllReviewsOpen(false)}
                aria-label="Voltar"
                className="w-10 h-10 rounded-full bg-[#F3F3F5] flex items-center justify-center text-[#0B0B0C] active:scale-95 transition-transform cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
              </button>
              <h2 className="text-[18px] font-bold text-[#0B0B0C] tracking-[-0.015em]">
                {tr('Todas as avaliações')}
              </h2>
              <button
                type="button"
                onClick={() => setShowWriteReviewForm((prev) => !prev)}
                className="px-3.5 h-9 rounded-full bg-[#F3F3F5] text-[13px] font-semibold text-[#0B0B0C] active:scale-95 transition-transform cursor-pointer"
              >
                {showWriteReviewForm ? tr('Fechar') : tr('Avaliar')}
              </button>
            </div>

            {/* Corpo rolável com todas as avaliações */}
            <div
              className="flex-1 overflow-y-auto px-5 pt-5 space-y-4 max-w-2xl w-full mx-auto bg-[#FFFFFF]"
              style={{
                backgroundColor: '#ffffff',
                paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 32px), 40px)',
              }}
            >
              {/* Resumo das avaliações no topo */}
              <div
                className="flex items-center justify-between px-5 py-6 bg-[#FFFFFF] rounded-[26px] border border-[#EBEBEF] shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                style={{ backgroundColor: '#ffffff' }}
              >
                <div className="w-[43%] flex flex-col items-center justify-center pr-2">
                  <span className="text-[48px] leading-none font-extrabold text-[#0B0B0C] tracking-[-0.03em] tabular-nums">
                    {Number(liveRating).toFixed(1)}
                  </span>
                  <span className="text-[14.5px] font-normal text-[#6E6E73] mt-2 tracking-[-0.01em]">
                    {tr('de 5.0 estrelas')}
                  </span>
                </div>

                <div className="w-[1px] h-[58px] bg-[#DCDCE1] shrink-0" />

                <div className="w-[56%] flex flex-col items-center justify-center pl-2">
                  <SummaryRatingStars rating={Number(liveRating)} idPrefix="modal-summary" />
                  <span className="text-[15px] font-normal text-[#6E6E73] mt-2.5 tracking-[-0.01em] tabular-nums">
                    {tr(`${liveReviewCount} avaliações`)}
                  </span>
                </div>
              </div>

              {/* Formulário opcional ao tocar em Avaliar */}
              <AnimatePresence>
                {showWriteReviewForm && (
                  <motion.form
                    key="modal-review-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSubmitReview}
                    className="p-5 bg-[#FFFFFF] rounded-[26px] border border-[#EBEBEF] space-y-3.5 overflow-hidden"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-[#0B0B0C]">
                        {tr('Sua avaliação')}
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((starVal) => (
                          <button
                            key={starVal}
                            type="button"
                            onClick={() => setUserRatingInput(starVal)}
                            className="p-1 cursor-pointer transition-transform active:scale-90"
                          >
                            <Star
                              className={`w-5 h-5 transition-colors ${
                                starVal <= userRatingInput
                                  ? 'fill-[#F7B801] text-[#F7B801]'
                                  : 'text-zinc-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={userCommentInput}
                      onChange={(e) => setUserCommentInput(e.target.value)}
                      placeholder={tr('Conte como foi sua experiência...')}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-[#E5E5EA] text-[14.5px] text-[#0B0B0C] focus:outline-none focus:border-[#0B0B0C]"
                    />

                    <div className="flex items-center justify-between gap-2">
                      {reviewSubmittedMsg ? (
                        <span className="text-[12.5px] text-[#52525B] font-medium">
                          {tr(reviewSubmittedMsg)}
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-[#71717A]">
                          {tr(`Nota ${userRatingInput}.0 selecionada`)}
                        </span>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-5 py-2.5 rounded-full bg-[#0B0B0C] hover:bg-[#1C1C1E] text-white text-[13.5px] font-bold transition-transform active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isSubmittingReview ? tr('Salvando...') : tr('Publicar')}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Lista completa de avaliações */}
              {(reviewsList.length > 0
                ? reviewsList
                : [
                    {
                      id: 'default-1',
                      user_name: 'Mariana Costa',
                      rating: 5,
                      comment:
                        'Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável.',
                      created_at: 'Há 2 dias',
                    },
                    {
                      id: 'default-2',
                      user_name: 'Lucas Ferreira',
                      rating: 5,
                      comment:
                        'Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes.',
                      created_at: 'Há 1 semana',
                    },
                  ]
              ).map((rev, idx) => (
                <div
                  key={rev.id || idx}
                  className="p-5 bg-[#FFFFFF] rounded-[26px] border border-[#EBEBEF] shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={getReviewUserAvatar(rev, idx)}
                        alt={rev.user_name || 'Visitante'}
                        className="w-[48px] h-[48px] rounded-full object-cover shrink-0 bg-[#E5E5EA]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = REVIEW_AVATAR_FALLBACKS[idx % REVIEW_AVATAR_FALLBACKS.length];
                        }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[17px] font-bold text-[#0B0B0C] leading-[1.2] tracking-[-0.015em] truncate">
                          {rev.user_name || 'Visitante'}
                        </span>
                        <span className="text-[14px] font-normal text-[#8E8E93] leading-[1.2] mt-1">
                          {formatReviewDateLabel(rev.created_at)}
                        </span>
                      </div>
                    </div>
                    <UserReviewStars rating={Number(rev.rating ?? 5)} />
                  </div>
                  <p className="mt-3.5 text-[16px] font-normal text-[#1C1C1E] leading-[1.42] tracking-[-0.01em]">
                    {rev.comment}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Compartilhamento por QR Code */}
      <SpotQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        spot={spot}
      />
    </motion.div>
  );
});
