import React, { useEffect, useRef } from 'react';
import { getOrCreateSignupIntroVideo } from '../utils/signupIntroVideo';

export type SignupIntroStage = 'idle' | 'white' | 'video' | 'revealing';

interface SignupIntroSequenceProps {
  stage: SignupIntroStage;
  onAdvanceStage: (nextStage: SignupIntroStage) => void;
}

export const SignupIntroSequence: React.FC<SignupIntroSequenceProps> = ({
  stage,
  onAdvanceStage,
}) => {
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const hasTriggeredRevealRef = useRef<boolean>(false);

  // Reset reveal guard when sequence starts at 'white'
  useEffect(() => {
    if (stage === 'white') {
      hasTriggeredRevealRef.current = false;
    }
  }, [stage]);

  // Mount the shared gesture-unlocked HTMLVideoElement into the container
  useEffect(() => {
    if (stage === 'idle') return;
    const host = videoHostRef.current;
    if (!host) return;

    const videoEl = getOrCreateSignupIntroVideo();

    const updateResponsiveFit = () => {
      const isPortraitViewport = window.innerWidth / Math.max(1, window.innerHeight) <= 0.75;
      videoEl.style.objectFit = isPortraitViewport ? 'cover' : 'contain';
    };

    updateResponsiveFit();
    window.addEventListener('resize', updateResponsiveFit);

    if (videoEl.parentElement !== host) {
      host.innerHTML = '';
      host.appendChild(videoEl);
    }

    if (stage === 'white') {
      try {
        videoEl.pause();
        videoEl.currentTime = 0;
        videoEl.muted = false;
        videoEl.volume = 1.0;
      } catch {}
    }

    return () => {
      window.removeEventListener('resize', updateResponsiveFit);
    };
  }, [stage]);

  // STEP 1: Pure white screen for 0.8 seconds before starting video playback
  useEffect(() => {
    if (stage !== 'white') return;

    const timer = window.setTimeout(() => {
      onAdvanceStage('video');
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [stage, onAdvanceStage]);

  // STEP 2: Full-screen video playback with sound until the very last second (ended event)
  useEffect(() => {
    if (stage !== 'video') return;

    const videoEl = getOrCreateSignupIntroVideo();
    let rafId: number | null = null;
    let fallbackTimerId: number | null = null;

    const triggerRevealOnce = () => {
      if (hasTriggeredRevealRef.current) return;
      hasTriggeredRevealRef.current = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (fallbackTimerId !== null) {
        window.clearTimeout(fallbackTimerId);
        fallbackTimerId = null;
      }
      onAdvanceStage('revealing');
    };

    const monitorPlaybackCompletion = () => {
      if (hasTriggeredRevealRef.current) return;
      if (videoEl.ended) {
        triggerRevealOnce();
        return;
      }
      rafId = requestAnimationFrame(monitorPlaybackCompletion);
    };

    const handleEnded = () => {
      triggerRevealOnce();
    };

    const handleError = () => {
      triggerRevealOnce();
    };

    videoEl.addEventListener('ended', handleEnded);
    videoEl.addEventListener('error', handleError);

    // Ensure playback starts at the beginning with maximum quality and sound enabled
    try {
      if (videoEl.currentTime > 0.25) {
        videoEl.currentTime = 0;
      }
      videoEl.muted = false;
      videoEl.volume = 1.0;
    } catch {}

    const unmuteOnInteraction = () => {
      try {
        videoEl.muted = false;
        videoEl.volume = 1.0;
      } catch {}
      window.removeEventListener('pointerdown', unmuteOnInteraction, true);
      window.removeEventListener('touchstart', unmuteOnInteraction, true);
      window.removeEventListener('keydown', unmuteOnInteraction, true);
    };

    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          rafId = requestAnimationFrame(monitorPlaybackCompletion);
        })
        .catch(() => {
          // Fallback if browser policy requires muted start until next touch
          try {
            videoEl.muted = true;
            window.addEventListener('pointerdown', unmuteOnInteraction, { capture: true, once: true });
            window.addEventListener('touchstart', unmuteOnInteraction, { capture: true, once: true });
            window.addEventListener('keydown', unmuteOnInteraction, { capture: true, once: true });
            videoEl
              .play()
              .then(() => {
                rafId = requestAnimationFrame(monitorPlaybackCompletion);
              })
              .catch(() => {
                triggerRevealOnce();
              });
          } catch {
            triggerRevealOnce();
          }
        });
    } else {
      rafId = requestAnimationFrame(monitorPlaybackCompletion);
    }

    // Safety ceiling timer well past the full 17.81s video duration in case network stalls completely
    fallbackTimerId = window.setTimeout(() => {
      triggerRevealOnce();
    }, 24000);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (fallbackTimerId !== null) window.clearTimeout(fallbackTimerId);
      videoEl.removeEventListener('ended', handleEnded);
      videoEl.removeEventListener('error', handleError);
      window.removeEventListener('pointerdown', unmuteOnInteraction, true);
      window.removeEventListener('touchstart', unmuteOnInteraction, true);
      window.removeEventListener('keydown', unmuteOnInteraction, true);
    };
  }, [stage, onAdvanceStage]);

  // STEP 3: Smooth, light, subtle translucent transition to the Exclusive Itinerary Selection Screen
  useEffect(() => {
    if (stage !== 'revealing') return;

    const timer = window.setTimeout(() => {
      try {
        const videoEl = getOrCreateSignupIntroVideo();
        videoEl.pause();
        if (videoEl.parentElement) {
          videoEl.parentElement.removeChild(videoEl);
        }
      } catch {}
      onAdvanceStage('idle');
    }, 680);

    return () => {
      window.clearTimeout(timer);
    };
  }, [stage, onAdvanceStage]);

  if (stage === 'idle') return null;

  return (
    <div
      id="signup-intro-sequence-overlay"
      aria-hidden="true"
      className="fixed inset-0 w-screen h-[100dvh] z-[10000] bg-[#FFFFFF] overflow-hidden select-none"
      style={{
        opacity: stage === 'revealing' ? 0 : 1,
        filter: stage === 'revealing' ? 'blur(10px)' : 'blur(0px)',
        transform: stage === 'revealing' ? 'scale(1.015)' : 'scale(1)',
        transition:
          stage === 'revealing'
            ? 'opacity 660ms cubic-bezier(0.22, 1, 0.36, 1), filter 660ms cubic-bezier(0.22, 1, 0.36, 1), transform 660ms cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
        pointerEvents: stage === 'revealing' ? 'none' : 'auto',
        willChange: 'opacity, filter, transform',
      }}
    >
      {/* Video Host Container */}
      <div
        ref={videoHostRef}
        className="w-full h-full bg-[#FFFFFF] flex items-center justify-center overflow-hidden"
        style={{
          opacity: stage === 'white' ? 0 : 1,
          transition: stage === 'video' ? 'opacity 140ms ease-out' : 'none',
        }}
      />

      {/* Pure White Screen for Stage 1 (0.8s) */}
      <div
        className="absolute inset-0 bg-[#FFFFFF] pointer-events-none"
        style={{
          opacity: stage === 'white' ? 1 : 0,
          transition: stage === 'video' ? 'opacity 140ms ease-out' : 'none',
        }}
      />
    </div>
  );
};
