import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Spot } from '../types';
import { 
  ArrowLeft,
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
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpotQrModal } from './SpotQrModal';
import { RoundedNavigationIcon } from './RoundedNavigationIcon';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { VerifiedBadge } from './ui/VerifiedBadge';
import { SpotVideoPlayer } from './SpotVideoPlayer';
import {
  SpotVideo,
  fetchSpotVideos,
  saveVideoPlaybackPosition,
  getVideoPlaybackPosition,
} from '../services/spotVideosService';

interface SpotDetailSheetProps {
  spot: Spot | null;
  onClose: () => void;
  onNavigateTo: (spot: Spot) => void;
  isFavorite: boolean;
  onToggleFavorite: (spotId: string) => void;
  onUpdateSpot?: (updatedSpot: Spot) => void;
}

export const SpotDetailSheet: React.FC<SpotDetailSheetProps> = ({
  spot,
  onClose,
  onNavigateTo,
  isFavorite,
  onToggleFavorite,
  onUpdateSpot,
}) => {
  const [activeTab, setActiveTab] = useState('Sobre');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const heroMediaWrapperRef = useRef<HTMLDivElement | null>(null);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

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
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
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
    const scrollTop = e.currentTarget.scrollTop;
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

  const isGoldUser = Boolean(
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
        const cleanEmail = (u.email || u.whatsapp || '').trim().toLowerCase();
        const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail);
        return isGoldAdmin || Boolean(u.isGold || u.is_gold === 1 || u.isPremium || u.is_premium === 1);
      } catch {
        return false;
      }
    })()
  );

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
  const views = (spot.visitorsToday * 112 + 15000).toLocaleString('pt-BR');

  const hasDirections = Boolean((spot.lat && spot.lng) || spot.address || spot.name);
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

  const handleNewVideoUploaded = (newVid: SpotVideo) => {
    setHeroVideos((prev) => [newVid, ...prev]);
    setCurrentHeroVideoIndex(0);
    pendingResumeTimeRef.current = 0;
    setIsTranslucentSwap(true);
    setShowHeroVideo(true);
    window.setTimeout(() => {
      setIsTranslucentSwap(false);
    }, 550);
  };

  return (
    <motion.div
      id="spot-detail-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={() => {
        persistHeroPlaybackPosition();
        onClose();
      }}
      className="fixed inset-0 z-[110] bg-black/60 md:bg-black/45 backdrop-blur-md md:backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center md:pl-[calc(var(--desktop-sidebar-width,72px)+24px)] md:pr-6 md:py-6 select-none cursor-pointer"
    >
      {/* =====================================================================
          1. MOBILE VIEW (< 768px): PRESERVED 100% INTACT
         ===================================================================== */}
      <motion.div
        id="spot-detail-sheet-container"
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="md:hidden relative w-full h-full bg-white dark:bg-[#000000] text-zinc-900 dark:text-white flex flex-col z-[110] transform-gpu overflow-hidden rounded-none"
        style={{
          willChange: 'transform, opacity',
        }}
      >
        {/* Floating Top Bar Controls (Mobile) */}
        <div
          className="absolute left-0 right-0 z-30 flex items-center justify-between pointer-events-none px-4"
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
            left: 'max(16px, env(safe-area-inset-left, 0px))',
            right: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          <motion.button 
            whileTap={{ scale: 0.88 }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              persistHeroPlaybackPosition();
              onClose();
            }} 
            className="w-10 h-10 rounded-full expo-liquid-glass-btn flex items-center justify-center text-black dark:text-white cursor-pointer pointer-events-auto active:opacity-80 transition-opacity"
            title="Voltar"
            aria-label="Voltar para o mapa"
          >
            <ArrowLeft
              className="w-5 h-5 text-black dark:text-white"
            />
          </motion.button>

          <div className="flex items-center gap-2 pointer-events-auto">
            <motion.button 
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsQrModalOpen(true);
              }}
              className="w-10 h-10 rounded-full expo-liquid-glass-btn flex items-center justify-center text-zinc-900 dark:text-white cursor-pointer transition-colors"
              title="Gerar QR Code deste local"
              aria-label="Gerar QR Code deste local"
            >
              <QrCode className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className="w-10 h-10 rounded-full expo-liquid-glass-btn flex items-center justify-center text-zinc-900 dark:text-white cursor-pointer active:opacity-80 transition-opacity"
              title="Compartilhar"
              aria-label="Compartilhar"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(spot.id);
              }} 
              className="w-10 h-10 rounded-full expo-liquid-glass-btn flex items-center justify-center text-zinc-900 dark:text-white cursor-pointer active:opacity-80 transition-opacity"
              title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-900 dark:text-white'}`} />
            </motion.button>
          </div>
        </div>

        {/* Fluid Hardware-Accelerated Smooth Scroll Surface (Mobile) */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            overscrollBehaviorY: 'contain',
            transform: 'translateZ(0)',
          }}
        >
          {/* Header Media Area - Foto por 1s -> Efeito Translúcido -> Vídeo em 1.2x com loop e blur ao rolar */}
          <div 
            onClick={handleToggleHeroPlayPause}
            className="sticky top-0 h-[320px] sm:h-[350px] w-full shrink-0 select-none overflow-hidden bg-zinc-900 z-0 pointer-events-auto touch-pan-y cursor-pointer"
            style={{
              position: 'sticky',
              top: 0,
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
            }}
          >
            <div
              ref={heroMediaWrapperRef}
              className="w-full h-full relative transform-gpu transition-[filter,transform] duration-75 ease-out"
              style={{
                filter: 'none',
                transform: 'scale(1.04) translateZ(0)',
                WebkitTransform: 'scale(1.04) translateZ(0)',
                willChange: 'filter, transform',
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
                    className="absolute inset-0 z-10 bg-white/25 dark:bg-white/15 backdrop-blur-xl pointer-events-none"
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Discreet iOS Audio Toggle on Mobile Hero Video */}
            {!isDesktop && showHeroVideo && currentHeroVideo && (
              <button
                type="button"
                onClick={handleToggleHeroMute}
                aria-label={isHeroMuted ? 'Ativar áudio' : 'Silenciar áudio'}
                className="absolute bottom-11 right-4 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
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
                  <div className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg">
                    {isHeroPaused || heroTapFeedback === 'pause' ? (
                      <Pause className="w-5 h-5 fill-white text-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtle Gradient Shadow for Top Bar Legibility */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 via-black/20 to-transparent pointer-events-none" />
          </div>

          {/* Main Content Body - Card branco que sobe tampando a foto */}
          <div 
            className="relative z-10 -mt-8 bg-white dark:bg-[#000000] dark:border-t dark:border-[#262626] rounded-t-[32px] px-5 sm:px-6 pt-6 pb-32 flex flex-col min-h-[calc(100vh-60px)] shadow-[0_-12px_36px_rgba(0,0,0,0.18)]"
            style={{
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
            }}
          >
            
            {/* Title and Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.025 }}
              className="flex items-center gap-2 mb-2"
            >
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF] leading-tight">
                {spot.name}
              </h1>
              <VerifiedBadge />
            </motion.div>

            {/* Metadata Row */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.055 }}
              className="flex items-center gap-2.5 text-xs sm:text-sm mb-6 text-zinc-600 dark:text-[#A1A1AA] flex-wrap"
            >
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-[#000000] dark:border dark:border-[#262626] px-3 py-1.5 rounded-full">
                <Star className={`w-4 h-4 ${isGoldUser ? 'fill-[#F5BE38] text-[#F5BE38]' : 'fill-zinc-900 text-zinc-900 dark:fill-white dark:text-white'}`} />
                <span className="font-semibold text-zinc-900 dark:text-[#FFFFFF]">{Number(liveRating).toFixed(1)}</span>
                <span className="text-[#9A9894] font-semibold">({liveReviewCount})</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#000000] dark:border dark:border-[#262626] px-3 py-1.5 rounded-full">
                <MapPin className={`w-4 h-4 ${isGoldUser ? 'text-[#F5BE38]' : 'text-zinc-900 dark:text-white'}`} />
                <span className="font-semibold text-zinc-700 dark:text-[#A1A1AA]">{distance}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#000000] dark:border dark:border-[#262626] px-3 py-1.5 rounded-full">
                <Eye className="w-4 h-4 text-zinc-500 dark:text-[#A1A1AA]" />
                <span className="font-semibold text-zinc-700 dark:text-[#A1A1AA]">{views}</span>
              </div>
            </motion.div>

            {/* Action Buttons Row - Apple Maps iOS Liquid Glass Aesthetic */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.085 }}
              className="grid grid-cols-3 gap-3 mb-8"
            >
              <motion.button
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.94, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                onClick={() => openDirectionsMap(spot)}
                className={`rounded-full py-3 px-3 flex items-center justify-center gap-2 transition-all cursor-pointer font-bold active:opacity-90 expo-liquid-glass-btn border border-black/5 ${
                  isGoldUser
                    ? 'text-[#1A1202] dark:text-[#FDE073] shadow-[0_4px_16px_rgba(230,172,51,0.4)]'
                    : 'text-[#000000] dark:text-white'
                }`}
                title="Traçar Rota no GPS"
              >
                <RoundedNavigationIcon isGold={false} className="w-4 h-4 shrink-0 text-[#000000] dark:text-white [&_polygon]:text-[#000000] dark:[&_polygon]:text-white" size={16} />
                <span className="text-sm font-bold text-[#000000] dark:text-white">Rota</span>
              </motion.button>

              <motion.a 
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.94, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                href={phoneHref}
                className="expo-liquid-glass-btn text-zinc-900 dark:text-white rounded-full py-3 px-3 flex items-center justify-center gap-2 transition-colors cursor-pointer font-bold active:opacity-90 border border-black/5"
                title="Ligar para o estabelecimento"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span className="text-sm font-bold">Ligar</span>
              </motion.a>

              <motion.a 
                whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                whileTap={{ scale: 0.94, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="expo-liquid-glass-btn text-zinc-900 dark:text-white rounded-full py-3 px-3 flex items-center justify-center gap-2 transition-colors cursor-pointer font-bold active:opacity-90 border border-black/5"
                title="Acessar Website"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="text-sm font-bold">Site</span>
              </motion.a>
            </motion.div>

            {/* Tabs Row */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.115 }}
              className="flex items-center justify-between border-b border-zinc-200 dark:border-[#262626] mb-6"
            >
              {['Sobre', 'Experiência', 'Vídeos', 'Avaliações'].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-semibold transition-colors cursor-pointer ${
                      isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div
                        layoutId="activeSpotTab"
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className={`absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full ${
                          isGoldUser ? 'bg-[#F5BE38]' : 'bg-zinc-950 dark:bg-white'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </motion.div>

            {/* Tab Panels with Smooth Transitions */}
            <div className="flex-1 space-y-6 pb-6">
              {activeTab === 'Sobre' && (
                <motion.div
                  key="tab-sobre"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-5"
                >
                  <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {spot.description}
                  </p>

                  {/* Informações Práticas */}
                  <div className="grid grid-cols-2 gap-3">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.035 }}
                      className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#000000] border border-zinc-100 dark:border-[#262626]"
                    >
                      <span className="text-xs text-[#9A9894] font-bold block mb-1">Horário de Funcionamento</span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-[#FFFFFF]">{spot.hours || "09:00 - 18:00"}</span>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.07 }}
                      className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#000000] border border-zinc-100 dark:border-[#262626]"
                    >
                      <span className="text-xs text-[#9A9894] font-bold block mb-1">Entrada</span>
                      <span className={`text-sm font-bold ${isGoldUser ? 'text-[#F5BE38]' : 'text-zinc-900 dark:text-[#FFFFFF]'}`}>{spot.priceRange === 'Grátis' ? 'Acesso Livre' : (spot.priceRange || 'Consultar')}</span>
                    </motion.div>
                  </div>

                  <motion.button 
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.1 }}
                    whileHover={{ scale: 1.01, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
                    whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
                    onClick={() => openDirectionsMap(spot)}
                    className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-between px-6 shadow-sm transition-colors cursor-pointer ${
                      isGoldUser
                        ? 'bg-metallic-gold text-[#1A1202] border border-[#FFF4A3]/70 shadow-[0_4px_20px_rgba(230,172,51,0.45)]'
                        : 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RoundedNavigationIcon isGold={false} className={`w-5 h-5 ${isGoldUser ? 'text-[#1A1202]' : ''}`} size={20} />
                      <span className="font-bold">Como chegar no GPS</span>
                    </div>
                    <span className={`font-bold text-lg ${isGoldUser ? 'text-[#1A1202]' : ''}`}>→</span>
                  </motion.button>
                </motion.div>
              )}

              {activeTab === 'Experiência' && (
                <motion.div
                  key="tab-experiencia"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-zinc-50 dark:bg-[#000000] rounded-2xl border border-zinc-100 dark:border-[#262626] space-y-3">
                    <h3 className="font-black text-zinc-900 dark:text-white text-sm uppercase tracking-wider">O que esperar</h3>
                    <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                        <span>Mirante panorâmico com vista de tirar o fôlego para vales e montanhas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                        <span>Excelente ponto para fotografia e contemplação do pôr do sol</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                        <span>Estacionamento e cafés típicos nas imediações</span>
                      </li>
                    </ul>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.045 }}
                    className="p-4 bg-zinc-50 dark:bg-[#000000] rounded-2xl border border-zinc-100 dark:border-[#262626]"
                  >
                    <h4 className="font-black text-zinc-900 dark:text-white text-xs uppercase tracking-wider mb-2">Dica de quem foi</h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {spot.touristTip || 'Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!'}
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'Vídeos' && (
                <motion.div
                  key="tab-videos"
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-4"
                >
                  <SpotVideoPlayer 
                    spotId={spot.id} 
                    spotName={spot.name} 
                    spotCategory={spot.category}
                    onVideoUploaded={handleNewVideoUploaded}
                  />
                </motion.div>
              )}

              {activeTab === 'Avaliações' && (
                <motion.div
                  key="tab-avaliacoes"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-[#000000] rounded-2xl border border-zinc-100 dark:border-[#262626]">
                    <div>
                      <span className="text-3xl font-black text-zinc-900 dark:text-white">{Number(liveRating).toFixed(1)}</span>
                      <span className="text-xs text-zinc-400 block mt-0.5">de 5.0 estrelas</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex text-[#F2B900]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < Math.round(liveRating) ? 'fill-current' : 'text-zinc-300 dark:text-zinc-700'}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{liveReviewCount} avaliações reais</span>
                    </div>
                  </div>

                  {/* Interactive iOS Rating Submission Card */}
                  <form
                    onSubmit={handleSubmitReview}
                    className="p-4 bg-zinc-50 dark:bg-[#000000] rounded-2xl border border-zinc-100 dark:border-[#262626] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        Avaliar este ponto turístico
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((starVal) => (
                          <button
                            key={starVal}
                            type="button"
                            onClick={() => setUserRatingInput(starVal)}
                            className="p-1 cursor-pointer transition-transform active:scale-90"
                            aria-label={`${starVal} estrelas`}
                          >
                            <Star
                              className={`w-5 h-5 transition-colors ${
                                starVal <= userRatingInput
                                  ? 'fill-[#F2B900] text-[#F2B900]'
                                  : 'text-zinc-300 dark:text-zinc-700'
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
                      placeholder="Conte como foi sua experiência (opcional)..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0A0A0C] border border-zinc-200 dark:border-[#262626] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400 dark:focus:border-white/40"
                    />

                    <div className="flex items-center justify-between gap-2">
                      {reviewSubmittedMsg ? (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                          {reviewSubmittedMsg}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400">
                          Nota {userRatingInput}.0 selecionada
                        </span>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-4 py-2 rounded-full expo-liquid-glass-btn text-black dark:bg-white dark:text-black text-xs font-bold transition-transform active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 border border-black/5 shadow-xs"
                      >
                        {isSubmittingReview ? 'Salvando...' : 'Publicar avaliação'}
                      </button>
                    </div>
                  </form>

                  {/* Dynamic Reviews List */}
                  {(reviewsList.length > 0
                    ? reviewsList
                    : [
                        {
                          id: 'default-1',
                          user_name: 'Mariana Costa',
                          rating: 5,
                          comment:
                            'Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável. Vale muito a pena a visita.',
                          created_at: 'Há 2 dias',
                        },
                        {
                          id: 'default-2',
                          user_name: 'Lucas Ferreira',
                          rating: 5,
                          comment:
                            'Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes do sol se pôr para pegar um bom lugar.',
                          created_at: 'Há 1 semana',
                        },
                      ]
                  ).map((rev, idx) => (
                    <motion.div
                      key={rev.id || idx}
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.03 * Math.min(idx, 4) }}
                      className="p-4 bg-zinc-50 dark:bg-[#000000] rounded-2xl border border-zinc-100 dark:border-[#262626] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-zinc-900 dark:text-white">
                          {rev.user_name || 'Visitante'}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {rev.created_at && String(rev.created_at).startsWith('Há')
                            ? rev.created_at
                            : 'Recente'}
                        </span>
                      </div>
                      <div className="flex text-[#F2B900]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < Number(rev.rating ?? 5) ? 'fill-current' : 'text-zinc-300 dark:text-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {rev.comment}
                      </p>
                    </motion.div>
                  ))}
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
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hidden md:flex flex-col lg:flex-row w-full max-w-[960px] lg:max-w-[1080px] xl:max-w-[1180px] 2xl:max-w-[1260px] md:max-h-[88vh] lg:h-[min(680px,85vh)] xl:h-[min(730px,85vh)] bg-white dark:bg-[#000000] text-zinc-950 dark:text-white rounded-[24px] border border-zinc-200/90 dark:border-[#262626] shadow-[0_20px_60px_rgba(0,0,0,0.18)] overflow-hidden cursor-default z-[110]"
        style={{
          fontFamily: "'Inter', sans-serif",
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
                className="absolute bottom-3.5 right-3.5 z-20 w-9 h-9 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
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
                  className="absolute inset-0 z-10 bg-white/25 dark:bg-white/15 backdrop-blur-xl pointer-events-none"
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
                  <div className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg">
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
                className="w-10 h-10 rounded-full expo-liquid-glass-btn text-zinc-900 dark:text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Voltar"
                aria-label="Voltar para o mapa"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-900 dark:text-white" />
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
                className="w-10 h-10 rounded-full expo-liquid-glass-btn text-zinc-900 dark:text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Gerar QR Code deste local"
                aria-label="QR Code"
              >
                <QrCode className="w-5 h-5 text-zinc-900 dark:text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                className="w-10 h-10 rounded-full expo-liquid-glass-btn text-zinc-900 dark:text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title="Compartilhar"
                aria-label="Compartilhar"
              >
                <Share2 className="w-5 h-5 text-zinc-900 dark:text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(spot.id);
                }}
                className="w-10 h-10 rounded-full expo-liquid-glass-btn text-zinc-900 dark:text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                aria-label="Favoritar"
              >
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    isFavorite ? 'fill-red-500 text-red-500' : 'text-zinc-900 dark:text-white'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (42-44% on Desktop): Structured Info, Actions & Integrated Tabs */}
        <div className="flex-1 lg:w-[44%] xl:w-[42%] h-full min-h-0 flex flex-col bg-white dark:bg-[#000000] px-5 py-4 lg:px-7 lg:py-6 overflow-hidden">
          {/* 1 & 2. Full Name + Verification Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-xl lg:text-2xl xl:text-[26px] font-bold tracking-tight text-zinc-950 dark:text-white leading-tight">
              {spot.name}
            </h1>
            <div className="shrink-0">
              <VerifiedBadge />
            </div>
          </div>

          {/* 3. Category & Location */}
          <div className="flex items-center gap-1.5 text-xs lg:text-[13px] font-medium text-zinc-500 dark:text-[#A1A1AA] mt-1.5 shrink-0 flex-wrap">
            <span className="text-zinc-700 dark:text-zinc-300 font-semibold">
              {spot.categoryLabel || spot.category}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-[#A1A1AA]">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate max-w-[280px] xl:max-w-[340px]">
                {spot.address || 'Campos do Jordão, SP'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{distance}</span>
          </div>

          {/* 4. Average Rating, Review Count & Views */}
          <div className="flex items-center gap-3 text-xs lg:text-[13px] mt-3 pb-3.5 border-b border-zinc-100 dark:border-[#262626] shrink-0 flex-wrap">
            {spot.rating !== undefined && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-zinc-950 text-zinc-950 dark:fill-white dark:text-white shrink-0" />
                <span className="font-bold text-zinc-950 dark:text-white">{Number(liveRating).toFixed(1)}</span>
                <span className="text-zinc-500 dark:text-[#A1A1AA] font-medium">
                  ({liveReviewCount.toLocaleString('pt-BR')} avaliações)
                </span>
              </div>
            )}
            {spot.rating !== undefined && <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">·</span>}
            <div className="flex items-center gap-1.5 text-zinc-500 dark:text-[#A1A1AA] font-medium">
              <Eye className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>{views} visualizações</span>
            </div>
          </div>

          {/* 5. Concise Summary Description */}
          {spot.description && (
            <p className="text-[13px] lg:text-[13.5px] text-zinc-600 dark:text-[#A1A1AA] leading-relaxed mt-3 line-clamp-2 shrink-0">
              {spot.description}
            </p>
          )}

          {/* 6. Action Buttons Side-by-Side (Como chegar, Ligar, Site) */}
          <div className="flex items-center gap-2.5 mt-4 shrink-0">
            {hasDirections && (
              <button
                type="button"
                onClick={() => openDirectionsMap(spot)}
                className="flex-1 h-10 px-4 rounded-full expo-liquid-glass-btn text-black dark:text-white text-xs lg:text-[13px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-black/5 shadow-sm"
                title="Traçar rota até este local"
              >
                <RoundedNavigationIcon isGold={false} className="w-4 h-4 shrink-0 text-black dark:text-white [&_polygon]:text-black dark:[&_polygon]:text-white" size={15} />
                <span className="truncate">Como chegar</span>
              </button>
            )}

            {phoneHref && (
              <a
                href={phoneHref}
                className="h-10 px-4 rounded-full expo-liquid-glass-btn text-black dark:text-white text-xs lg:text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-black/5 shadow-sm"
                title="Ligar para o local"
              >
                <Phone className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />
                <span>Ligar</span>
              </a>
            )}

            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-4 rounded-full expo-liquid-glass-btn text-black dark:text-white text-xs lg:text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-black/5 shadow-sm"
                title="Acessar site oficial"
              >
                <Globe className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />
                <span>Site</span>
              </a>
            )}
          </div>

          {/* 7. Horizontal Desktop Tab Navigation (Sobre, Experiência, Vídeos, Avaliações) */}
          <div className="flex items-center gap-6 border-b border-zinc-200 dark:border-[#262626] mt-5 shrink-0" role="tablist">
            {['Sobre', 'Experiência', 'Vídeos', 'Avaliações'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-2.5 text-[13px] lg:text-sm font-semibold transition-colors cursor-pointer ${
                    isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab}
                  {isActive && (
                    <motion.div
                      layoutId="activeSpotTabDesktop"
                      transition={{ type: 'spring', damping: 28, stiffness: 360 }}
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-zinc-950 dark:bg-white"
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-4"
              >
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {spot.description}
                </p>

                {/* Practical Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#000000] border border-zinc-200/70 dark:border-[#262626]">
                    <span className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-semibold block mb-1">
                      Horário de Funcionamento
                    </span>
                    <span className="text-[13px] font-bold text-zinc-900 dark:text-white">
                      {spot.hours || '09:00 - 18:00'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#000000] border border-zinc-200/70 dark:border-[#262626]">
                    <span className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-semibold block mb-1">
                      Entrada
                    </span>
                    <span className="text-[13px] font-bold text-zinc-900 dark:text-white">
                      {spot.priceRange === 'Grátis' ? 'Acesso Livre' : (spot.priceRange || 'Consultar')}
                    </span>
                  </div>
                </div>

                {spot.address && (
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-[#000000] border border-zinc-200/70 dark:border-[#262626] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] font-semibold block mb-0.5">
                        Endereço
                      </span>
                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 block truncate">
                        {spot.address}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDirectionsMap(spot)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-100 dark:bg-[#000000] dark:hover:border-white/30 text-zinc-900 dark:text-white border border-zinc-200 dark:border-[#262626] text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                    >
                      Abrir no GPS
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'Experiência' && (
              <motion.div
                key="desktop-tab-experiencia"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-3.5"
              >
                <div className="p-4 bg-zinc-50 dark:bg-[#000000] rounded-xl border border-zinc-200/70 dark:border-[#262626] space-y-2.5">
                  <h3 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider">
                    O que esperar
                  </h3>
                  <ul className="space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                      <span>Mirante panorâmico com vista de tirar o fôlego para vales e montanhas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                      <span>Excelente ponto para fotografia e contemplação do pôr do sol</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-zinc-900 dark:text-white font-bold">✓</span>
                      <span>Estacionamento e cafés típicos nas imediações</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-[#000000] rounded-xl border border-zinc-200/70 dark:border-[#262626]">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-wider mb-1.5">
                    Dica de quem foi
                  </h4>
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {spot.touristTip || 'Leve um casaco quentinho, especialmente no final da tarde, pois a altitude faz a temperatura cair rapidamente!'}
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'Vídeos' && (
              <motion.div
                key="desktop-tab-videos"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-3"
              >
                <SpotVideoPlayer
                  spotId={spot.id}
                  spotName={spot.name}
                  spotCategory={spot.category}
                  onVideoUploaded={handleNewVideoUploaded}
                />
              </motion.div>
            )}

            {activeTab === 'Avaliações' && (
              <motion.div
                key="desktop-tab-avaliacoes"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-[#000000] rounded-xl border border-zinc-200/70 dark:border-[#262626]">
                  <div>
                    <span className="text-2xl font-bold text-zinc-950 dark:text-white">{Number(liveRating).toFixed(1)}</span>
                    <span className="text-xs text-zinc-500 dark:text-[#A1A1AA] block mt-0.5">de 5.0 estrelas</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-0.5 text-zinc-900 dark:text-[#F2B900]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < Math.round(liveRating) ? 'fill-current' : 'text-zinc-300 dark:text-zinc-700'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-[#A1A1AA] mt-1">
                      {liveReviewCount.toLocaleString('pt-BR')} avaliações reais
                    </span>
                  </div>
                </div>

                {/* Desktop Interactive Rating Card */}
                <form
                  onSubmit={handleSubmitReview}
                  className="p-3.5 bg-zinc-50 dark:bg-[#000000] rounded-xl border border-zinc-200/70 dark:border-[#262626] space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      Avaliar este ponto turístico
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setUserRatingInput(starVal)}
                          className="p-0.5 cursor-pointer transition-transform active:scale-90"
                        >
                          <Star
                            className={`w-4 h-4 transition-colors ${
                              starVal <= userRatingInput
                                ? 'fill-[#F2B900] text-[#F2B900]'
                                : 'text-zinc-300 dark:text-zinc-700'
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
                    placeholder="Conte como foi sua experiência (opcional)..."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#0A0A0C] border border-zinc-200 dark:border-[#262626] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400 dark:focus:border-white/40"
                  />

                  <div className="flex items-center justify-between gap-2">
                    {reviewSubmittedMsg ? (
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                        {reviewSubmittedMsg}
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-400">
                        Nota {userRatingInput}.0 selecionada
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmittingReview}
                      className="px-4 py-2 rounded-full expo-liquid-glass-btn text-black dark:bg-white dark:text-black text-xs font-bold transition-transform active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 border border-black/5 shadow-xs"
                    >
                      {isSubmittingReview ? 'Salvando...' : 'Publicar avaliação'}
                    </button>
                  </div>
                </form>

                {(reviewsList.length > 0
                  ? reviewsList
                  : [
                      {
                        id: 'default-1',
                        user_name: 'Mariana Costa',
                        rating: 5,
                        comment:
                          'Lugar espetacular! Vista incrível de Campos do Jordão e clima super agradável. Vale muito a pena a visita.',
                        created_at: 'Há 2 dias',
                      },
                      {
                        id: 'default-2',
                        user_name: 'Lucas Ferreira',
                        rating: 5,
                        comment:
                          'Pôr do sol inesquecível. Recomendo chegar pelo menos 40 minutos antes do sol se pôr para pegar um bom lugar.',
                        created_at: 'Há 1 semana',
                      },
                    ]
                ).map((rev, idx) => (
                  <div
                    key={rev.id || idx}
                    className="p-3.5 bg-zinc-50 dark:bg-[#000000] rounded-xl border border-zinc-200/70 dark:border-[#262626] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-900 dark:text-white">
                        {rev.user_name || 'Visitante'}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {rev.created_at && String(rev.created_at).startsWith('Há')
                          ? rev.created_at
                          : 'Recente'}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 text-zinc-900 dark:text-[#F2B900]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < Number(rev.rating ?? 5) ? 'fill-current' : 'text-zinc-300 dark:text-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Modal de Compartilhamento por QR Code */}
      <SpotQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        spot={spot}
      />
    </motion.div>
  );
};
