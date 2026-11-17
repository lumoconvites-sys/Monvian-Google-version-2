import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useIOSBackEntry } from '../services/iosNavigationManager';
import {
  CAMPOS_ACHIEVEMENT_SOURCE_PATH,
  PreparedCamposAchievementAsset,
  prepareCamposAchievementAsset,
  shareCamposAchievementToStory,
} from '../utils/achievementStoryShare';

interface CamposAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const IOSShareUploadIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 3.25V14.75"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.75 7.5L12 3.25L16.25 7.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.5 10.25H6.5C5.11929 10.25 4 11.3693 4 12.75V18.25C4 19.6307 5.11929 20.75 6.5 20.75H17.5C18.8807 20.75 20 19.6307 20 18.25V12.75C20 11.3693 18.8807 10.25 17.5 10.25H15.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CamposAchievementModal: React.FC<CamposAchievementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [preparedAsset, setPreparedAsset] = useState<PreparedCamposAchievementAsset | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  // Drag-to-dismiss state (no extra close button added to preserve the approved visual 1:1)
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragCurrentYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  useIOSBackEntry({
    id: 'campos-achievement',
    enabled: isOpen,
    priority: 260,
    label: 'Conquista Campos do Jordão',
    getForegroundEl: () => sheetRef.current,
    onPop: onClose,
  });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    prepareCamposAchievementAsset()
      .then((asset) => {
        if (!cancelled) {
          setPreparedAsset(asset);
        }
      })
      .catch(() => {
        // Handled lazily on share tap if initial prepare fails
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFeedbackMessage(null);
      setIsSharing(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const showTransientFeedback = useCallback((message: string) => {
    setFeedbackMessage(message);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
      feedbackTimerRef.current = null;
    }, 4200);
  }, []);

  const handleShareClick = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    setFeedbackMessage(null);

    try {
      const result = await shareCamposAchievementToStory(preparedAsset);
      if (result.status === 'downloaded_fallback') {
        showTransientFeedback(result.message);
      }
    } catch {
      showTransientFeedback('Não foi possível preparar a imagem para compartilhamento.');
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, preparedAsset, showTransientFeedback]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement)?.closest('button')) return;
    dragStartYRef.current = e.clientY;
    dragCurrentYRef.current = 0;
    isDraggingRef.current = true;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || dragStartYRef.current === null) return;
    const deltaY = Math.max(0, e.clientY - dragStartYRef.current);
    dragCurrentYRef.current = deltaY;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translate3d(0, ${deltaY}px, 0)`;
    }
  }, []);

  const finishDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const delta = dragCurrentYRef.current;
    dragStartYRef.current = null;
    dragCurrentYRef.current = 0;

    if (delta > 110) {
      onClose();
      return;
    }

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
      sheetRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  }, [onClose]);

  const visualArtworkSrc = preparedAsset?.modalBackgroundUrl || CAMPOS_ACHIEVEMENT_SOURCE_PATH;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="campos-achievement-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[240] flex items-center justify-center overflow-hidden select-none"
          style={{
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
            backgroundColor: '#7EA5D2',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Conquista desbloqueada: Eu visitei Campos do Jordão"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          {/* Ambient backdrop on wide desktop screens preserving crisp 9:19.5 composition */}
          <img
            src={visualArtworkSrc}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="hidden sm:block absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-75 pointer-events-none"
          />

          {/* Primary Approved Artwork Frame */}
          <motion.div
            ref={sheetRef}
            initial={{ opacity: 0, scale: 0.985, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: 24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            className="relative w-full h-full sm:w-auto sm:h-[min(94vh,880px)] sm:aspect-[852/1846] sm:rounded-[40px] sm:overflow-hidden sm:shadow-[0_28px_80px_rgba(0,0,0,0.38)] touch-none"
          >
            {/* Pixel-accurate artwork (9:41 and baked static button cleanly healed so real status bar + CTA render seamlessly) */}
            <img
              src={visualArtworkSrc}
              alt="Conquista desbloqueada: Eu visitei Campos do Jordão, São Paulo, Brasil"
              draggable={false}
              className="w-full h-full object-cover object-center pointer-events-none select-none"
            />

            {/* Subtle discreet fallback notice only when Instagram / OS share sheet cannot open */}
            <AnimatePresence>
              {feedbackMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-x-[10%] bottom-[calc(max(30px,env(safe-area-inset-bottom,0px)+14px)+74px)] z-20 flex justify-center pointer-events-none"
                >
                  <div className="px-4 py-2.5 rounded-2xl bg-black/75 backdrop-blur-md text-white text-[12.5px] font-medium text-center leading-snug shadow-lg">
                    {feedbackMessage}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Exact Reference Pill CTA Button: "Compartilhar no Story" */}
            <div
              className="absolute inset-x-0 z-20 flex justify-center px-[10.3%]"
              style={{
                bottom: 'max(48px, calc(env(safe-area-inset-bottom, 0px) + 34px))',
              }}
            >
              <button
                type="button"
                onClick={handleShareClick}
                disabled={isSharing}
                aria-busy={isSharing}
                className="w-full h-[58px] rounded-full flex items-center justify-center gap-3 text-[#111317] transition-transform duration-150 active:scale-[0.97] disabled:opacity-80 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.90)',
                  backdropFilter: 'blur(18px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
                }}
              >
                {isSharing ? (
                  <span
                    className="w-[19px] h-[19px] rounded-full border-2 border-[#111317]/25 border-t-[#111317] animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <IOSShareUploadIcon className="w-[21px] h-[21px] text-[#111317] shrink-0" />
                )}
                <span className="text-[16.5px] font-medium tracking-[-0.015em] leading-none">
                  Compartilhar no Story
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
