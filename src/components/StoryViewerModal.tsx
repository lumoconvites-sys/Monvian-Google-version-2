import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, MapPin, Volume2, VolumeX, Eye, Loader2 } from 'lucide-react';
import { StoryEntity, StoryTrayItem } from '../server/storyRoutes';

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId: string;
  allTrayUsers: StoryTrayItem[];
  currentUser: { id: string; name: string; photo: string };
  onStoryDeleted?: (storyId: string) => void;
  onOpenUserProfile?: (userId: string) => void;
}

const PHOTO_DURATION_MS = 5000;

// Format time ago helper
const formatTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 5) return 'agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return '1d';
  } catch {
    return '';
  }
};

/**
 * Story Face Component: Renders a single 3D Cube face for a user's story
 */
interface StoryFaceProps {
  user: StoryTrayItem;
  story?: StoryEntity;
  userStoriesList: StoryEntity[];
  activeStoryIdx: number;
  progressPercent: number;
  isMuted: boolean;
  onToggleMute: (e: React.MouseEvent) => void;
  onClose: (e: React.MouseEvent) => void;
  onDeleteStory?: (e: React.MouseEvent) => void;
  onOpenUserProfile?: (userId: string) => void;
  isMyStory: boolean;
  isLoading?: boolean;
  shadowOpacity?: number;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onMediaLoaded?: () => void;
  isMediaLoaded?: boolean;
}

const StoryFace: React.FC<StoryFaceProps> = ({
  user,
  story,
  userStoriesList,
  activeStoryIdx,
  progressPercent,
  isMuted,
  onToggleMute,
  onClose,
  onDeleteStory,
  onOpenUserProfile,
  isMyStory,
  isLoading = false,
  shadowOpacity = 0,
  videoRef,
  onMediaLoaded,
  isMediaLoaded = true,
}) => {
  const currentStory = story || userStoriesList[activeStoryIdx] || userStoriesList[0];

  return (
    <div className="relative w-full h-full bg-black flex flex-col justify-between overflow-hidden select-none">
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <Loader2 className="w-8 h-8 animate-spin text-white/70" />
        </div>
      )}

      {/* 1. TOP PROGRESS BARS SEGMENTS */}
      <div
        className="absolute top-0 inset-x-0 z-40 px-3 flex items-center gap-1.5 pt-3"
        style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 8px), 14px)' }}
      >
        {userStoriesList.length > 0 ? (
          userStoriesList.map((s, idx) => {
            let fill = 0;
            if (idx < activeStoryIdx) {
              fill = 100;
            } else if (idx === activeStoryIdx) {
              fill = progressPercent;
            }
            return (
              <div
                key={s.id || idx}
                className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full transition-all duration-75"
                  style={{ width: `${fill}%` }}
                />
              </div>
            );
          })
        ) : (
          <div className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      {/* 2. TOP HEADER (Avatar, Name, Time, Location, Controls) */}
      <div
        className="absolute top-7 inset-x-0 z-40 px-4 py-2 flex items-center justify-between pointer-events-none"
        style={{ top: 'max(calc(env(safe-area-inset-top, 0px) + 22px), 28px)' }}
      >
        {/* User info - click avatar or username to view profile */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenUserProfile) {
              onOpenUserProfile(user.user_id);
            }
          }}
          className="flex items-center gap-2.5 pointer-events-auto cursor-pointer group active:opacity-75 transition-all select-none"
          title={`Ver perfil de ${user.user_name}`}
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-white/20 shrink-0 group-hover:ring-2 group-hover:ring-white/50 transition-all">
            <img
              src={user.user_photo}
              alt={user.user_name}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-tight drop-shadow-md group-hover:underline">
                {user.user_name}
              </span>
              {currentStory && (
                <span className="text-[11px] font-medium text-white/70 drop-shadow-md">
                  {formatTimeAgo(currentStory.created_at)}
                </span>
              )}
            </div>
            {currentStory?.location && (
              <div className="flex items-center gap-1 text-[10.5px] font-semibold text-white/90 drop-shadow-md">
                <MapPin className="w-2.5 h-2.5 text-white" />
                <span className="truncate max-w-[170px]">{currentStory.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Video Sound Toggle */}
          {currentStory?.media_type === 'video' && (
            <button
              type="button"
              onClick={onToggleMute}
              className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/90 active:scale-95 cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Delete button (only for current user's story) */}
          {isMyStory && onDeleteStory && (
            <button
              type="button"
              onClick={onDeleteStory}
              className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-red-400 hover:text-red-300 active:scale-95 cursor-pointer"
              title="Excluir Story"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white active:scale-95 cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. MEDIA CANVAS (FULLSCREEN IMAGE OR VIDEO) */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {currentStory ? (
          <>
            {currentStory.media_type === 'video' ? (
              <video
                ref={videoRef}
                src={currentStory.media_url}
                autoPlay
                playsInline
                muted={isMuted}
                onLoadedData={onMediaLoaded}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            ) : (
              <img
                src={currentStory.media_url}
                alt={currentStory.caption || 'Story'}
                onLoad={onMediaLoaded}
                className="w-full h-full object-cover select-none pointer-events-none transition-opacity duration-200"
                style={{ opacity: isMediaLoaded ? 1 : 0.85 }}
                loading="eager"
              />
            )}

            {/* Caption Overlay */}
            {currentStory.caption && (
              <div className="absolute bottom-20 inset-x-6 z-30 flex justify-center pointer-events-none">
                <div className="px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 text-white text-sm font-bold text-center leading-relaxed shadow-2xl max-w-sm">
                  {currentStory.caption}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-white/50 mb-2" />
            <span className="text-xs">Carregando stories...</span>
          </div>
        )}
      </div>

      {/* 4. BOTTOM BAR (VIEWS COUNTER ON OWN STORY / 24H INFO) */}
      <div
        className="absolute bottom-0 inset-x-0 z-30 px-5 py-3 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 8px), 14px)' }}
      >
        {isMyStory && currentStory ? (
          <div className="w-full flex items-center justify-between text-xs text-white/90 font-bold pointer-events-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
              <Eye className="w-3.5 h-3.5 text-white" />
              <span>{currentStory.views_count} {currentStory.views_count === 1 ? 'visualização' : 'visualizações'}</span>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">Expira em 24h</span>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between text-xs text-zinc-400">
            <span className="text-[11px] tracking-tight">Campos do Jordão • Stories 24h</span>
            <span className="text-[10px] text-zinc-500">Toque nas laterais para navegar</span>
          </div>
        )}
      </div>

      {/* 5. 3D AMBIENT LIGHTING / DEPTH SHADOW (Darkens face as it turns away into depth) */}
      {shadowOpacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-75"
          style={{
            backgroundColor: '#000000',
            opacity: Math.min(0.85, Math.max(0, shadowOpacity)),
          }}
        />
      )}
    </div>
  );
};

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  onClose,
  initialUserId,
  allTrayUsers,
  currentUser,
  onStoryDeleted,
  onOpenUserProfile,
}) => {
  // Current user cluster index in the tray
  const [currentClusterIndex, setCurrentClusterIndex] = useState<number>(0);
  // Current active story index within the user's stories
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0);
  // Stories cache: Record<userId, StoryEntity[]>
  const [storiesCache, setStoriesCache] = useState<Record<string, StoryEntity[]>>({});
  const storiesCacheRef = useRef<Record<string, StoryEntity[]>>({});

  // Loading state for active user stories
  const [isLoadingActive, setIsLoadingActive] = useState<boolean>(false);
  // Progress state for the current story (0 to 100)
  const [progress, setProgress] = useState<number>(0);
  // Pause state
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // Sound toggle
  const [isMuted, setIsMuted] = useState<boolean>(true);
  // Media loaded state
  const [isMediaLoaded, setIsMediaLoaded] = useState<boolean>(false);

  // 3D CUBE INTERACTIVE STATE
  // cubeMode: 'next' (dragging left, turning to next user) | 'prev' (dragging right, turning to prev user) | null
  const [cubeMode, setCubeMode] = useState<'next' | 'prev' | null>(null);
  const cubeModeRef = useRef<'next' | 'prev' | null>(null);
  // cubeProgress: 0.0 to 1.0 (directly proportional to finger drag distance)
  const [cubeProgress, setCubeProgress] = useState<number>(0);
  const cubeProgressRef = useRef<number>(0);

  // References
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Gesture tracking refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const isCubeDraggingRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);
  const stageWidthRef = useRef<number>(typeof window !== 'undefined' ? Math.min(window.innerWidth, 448) : 420);

  // Keep refs in sync
  useEffect(() => {
    cubeModeRef.current = cubeMode;
  }, [cubeMode]);
  useEffect(() => {
    cubeProgressRef.current = cubeProgress;
  }, [cubeProgress]);

  // Update stage width on resize
  useEffect(() => {
    const updateW = () => {
      if (stageRef.current) {
        stageWidthRef.current = stageRef.current.getBoundingClientRect().width || Math.min(window.innerWidth, 448);
      }
    };
    updateW();
    window.addEventListener('resize', updateW);
    return () => window.removeEventListener('resize', updateW);
  }, [isOpen]);

  // Find cluster index of initialUserId on open
  useEffect(() => {
    if (!isOpen) return;
    const idx = allTrayUsers.findIndex((u) => u.user_id === initialUserId);
    setCurrentClusterIndex(idx >= 0 ? idx : 0);
    setCurrentStoryIndex(0);
    setProgress(0);
    setCubeMode(null);
    setCubeProgress(0);
    cubeModeRef.current = null;
    cubeProgressRef.current = 0;
  }, [isOpen, initialUserId, allTrayUsers]);

  // Active cluster user
  const activeClusterUser = allTrayUsers[currentClusterIndex] || null;
  const nextClusterUser = allTrayUsers[currentClusterIndex + 1] || null;
  const prevClusterUser = allTrayUsers[currentClusterIndex - 1] || null;

  // 1. Fetch & cache user stories helper
  const fetchUserStories = useCallback(async (userId: string, isCurrent = false) => {
    if (!userId) return;
    if (storiesCacheRef.current[userId]) {
      if (isCurrent) setIsLoadingActive(false);
      return;
    }

    if (isCurrent) setIsLoadingActive(true);

    try {
      const clientId = currentUser.id || 'u-me';
      const res = await fetch(`/api/stories/user/${encodeURIComponent(userId)}?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.stories) && data.stories.length > 0) {
        storiesCacheRef.current[userId] = data.stories;
        setStoriesCache((prev) => ({ ...prev, [userId]: data.stories }));

        // Preload first story media image
        const first = data.stories[0];
        if (first?.media_url && first.media_type === 'image') {
          const img = new Image();
          img.src = first.media_url;
        }
      }
    } catch (err) {
      console.warn('[StoryViewer] Error fetching stories:', err);
    } finally {
      if (isCurrent) setIsLoadingActive(false);
    }
  }, [currentUser.id]);

  // 2. Preload active, next, and prev user stories whenever currentClusterIndex changes
  useEffect(() => {
    if (!isOpen || !activeClusterUser) return;

    // Fetch active user
    fetchUserStories(activeClusterUser.user_id, true);

    // Preload next user (so the next face is ready instantly for the 3D cube)
    if (nextClusterUser) {
      fetchUserStories(nextClusterUser.user_id, false);
    }

    // Preload prev user
    if (prevClusterUser) {
      fetchUserStories(prevClusterUser.user_id, false);
    }
  }, [isOpen, currentClusterIndex, activeClusterUser, nextClusterUser, prevClusterUser, fetchUserStories]);

  // Current user's stories list
  const activeUserStories = activeClusterUser ? (storiesCache[activeClusterUser.user_id] || storiesCacheRef.current[activeClusterUser.user_id] || []) : [];
  const currentStory: StoryEntity | undefined = activeUserStories[currentStoryIndex];

  // Next and Prev user's stories list
  const nextUserStories = nextClusterUser ? (storiesCache[nextClusterUser.user_id] || storiesCacheRef.current[nextClusterUser.user_id] || []) : [];
  const prevUserStories = prevClusterUser ? (storiesCache[prevClusterUser.user_id] || storiesCacheRef.current[prevClusterUser.user_id] || []) : [];

  // Record view on backend
  useEffect(() => {
    if (!currentStory || !isOpen) return;
    const clientId = currentUser.id || 'u-me';

    fetch(`/api/stories/${currentStory.id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, userName: currentUser.name, userPhoto: currentUser.photo }),
    }).catch(() => {});
  }, [currentStory?.id, isOpen, currentUser.id, currentUser.name, currentUser.photo]);

  // Story auto-advance ticker
  useEffect(() => {
    if (!isOpen || !currentStory || isPaused || cubeMode !== null || !isMediaLoaded) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    const totalDuration = currentStory.media_type === 'video'
      ? (videoRef.current?.duration ? videoRef.current.duration * 1000 : 12000)
      : PHOTO_DURATION_MS;

    const increment = (stepMs / totalDuration) * 100;

    progressIntervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(progressIntervalRef.current!);
          handleAutoNextStory();
          return 100;
        }
        return next;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isOpen, currentStory, isPaused, cubeMode, isMediaLoaded]);

  // Video sync
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPaused || cubeMode !== null) {
      videoRef.current.pause();
    } else if (isMediaLoaded) {
      videoRef.current.play().catch(() => {});
    }
  }, [isPaused, cubeMode, isMediaLoaded]);

  // 3. Smooth programmatic 3D Cube animation (for automated transitions)
  const animateCubeTransition = useCallback((targetMode: 'next' | 'prev', onComplete: () => void) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setCubeMode(targetMode);
    cubeModeRef.current = targetMode;

    const startTime = performance.now();
    const duration = 380; // ms

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Apple cubic-bezier easeOut: 1 - Math.pow(1 - t, 3)
      const ease = 1 - Math.pow(1 - t, 3);
      setCubeProgress(ease);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        isAnimatingRef.current = false;
        setCubeProgress(0);
        setCubeMode(null);
        cubeModeRef.current = null;
        onComplete();
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  // 4. Navigation Handlers
  // Advance story (internal or next user)
  const handleNextStory = useCallback(() => {
    if (currentStoryIndex < activeUserStories.length - 1) {
      // Normal internal story navigation (SEM CUBO)
      setCurrentStoryIndex((prev) => prev + 1);
      setProgress(0);
      setIsMediaLoaded(false);
    } else if (currentClusterIndex < allTrayUsers.length - 1) {
      // Last story -> Programmatic 3D Cube transition to next user!
      animateCubeTransition('next', () => {
        setCurrentClusterIndex((prev) => prev + 1);
        setCurrentStoryIndex(0);
        setProgress(0);
        setIsMediaLoaded(false);
      });
    } else {
      // Reached the end of all stories in tray
      onClose();
    }
  }, [currentStoryIndex, activeUserStories.length, currentClusterIndex, allTrayUsers.length, animateCubeTransition, onClose]);

  const handleAutoNextStory = useCallback(() => {
    handleNextStory();
  }, [handleNextStory]);

  // Previous story (internal or prev user)
  const handlePrevStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      // Normal internal story navigation (SEM CUBO)
      setCurrentStoryIndex((prev) => prev - 1);
      setProgress(0);
      setIsMediaLoaded(false);
    } else if (currentClusterIndex > 0) {
      // First story -> Programmatic 3D Cube transition to prev user!
      animateCubeTransition('prev', () => {
        setCurrentClusterIndex((prev) => prev - 1);
        setCurrentStoryIndex(0);
        setProgress(0);
        setIsMediaLoaded(false);
      });
    }
  }, [currentStoryIndex, currentClusterIndex, animateCubeTransition]);

  // Delete current story
  const handleDeleteCurrentStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory) return;
    if (!confirm('Deseja excluir este story?')) return;

    try {
      const res = await fetch(`/api/stories/${currentStory.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: currentUser.id }),
      });
      const data = await res.json();

      if (data.success) {
        if (onStoryDeleted) onStoryDeleted(currentStory.id);
        const updated = activeUserStories.filter((s) => s.id !== currentStory.id);
        if (updated.length > 0) {
          storiesCacheRef.current[activeClusterUser.user_id] = updated;
          setStoriesCache((prev) => ({ ...prev, [activeClusterUser.user_id]: updated }));
          setCurrentStoryIndex((prev) => Math.min(prev, updated.length - 1));
          setProgress(0);
        } else {
          onClose();
        }
      }
    } catch {
      alert('Não foi possível excluir o story.');
    }
  };

  // =========================================================================
  // 5. INTERACTIVE 3D CUBE GESTURE (Follows finger in real time!)
  // =========================================================================
  const handlePointerDown = (e: React.PointerEvent) => {
    // If an animation is completing, cancel it
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    isAnimatingRef.current = false;

    isPointerDownRef.current = true;
    isCubeDraggingRef.current = false;
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
    dragStartTimeRef.current = performance.now();
    setIsPaused(true);

    if (stageRef.current) {
      stageWidthRef.current = stageRef.current.getBoundingClientRect().width || Math.min(window.innerWidth, 448);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current || isAnimatingRef.current) return;

    const deltaX = e.clientX - touchStartXRef.current;
    const deltaY = e.clientY - touchStartYRef.current;
    const w = stageWidthRef.current || 420;

    // A. Detect if we should enter interactive 3D Cube mode
    if (!isCubeDraggingRef.current) {
      // Check horizontal movement threshold (6px)
      if (Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) {
        // Dragging Left (towards next user)
        if (deltaX < 0) {
          // Rule 5 & 11: ONLY use 3D Cube when on the LAST story of current user!
          const isLastStoryOfUser = currentStoryIndex >= activeUserStories.length - 1;
          const hasNextUser = currentClusterIndex < allTrayUsers.length - 1;

          if (isLastStoryOfUser && hasNextUser) {
            isCubeDraggingRef.current = true;
            setCubeMode('next');
            cubeModeRef.current = 'next';
          }
        }
        // Dragging Right (towards prev user)
        else if (deltaX > 0) {
          // Rule 5 & 11: ONLY use 3D Cube when on the FIRST story of current user!
          const isFirstStoryOfUser = currentStoryIndex === 0;
          const hasPrevUser = currentClusterIndex > 0;

          if (isFirstStoryOfUser && hasPrevUser) {
            isCubeDraggingRef.current = true;
            setCubeMode('prev');
            cubeModeRef.current = 'prev';
          }
        }
      }
    }

    // B. If 3D Cube drag is active, update progress proportionally in REAL TIME!
    if (isCubeDraggingRef.current) {
      if (cubeModeRef.current === 'next') {
        // Dragging left: progress from 0 (0% moved) to 1 (100% screen width moved)
        const rawProgress = -deltaX / w;
        const clamped = Math.min(1, Math.max(0, rawProgress));
        setCubeProgress(clamped);
      } else if (cubeModeRef.current === 'prev') {
        // Dragging right: progress from 0 to 1
        const rawProgress = deltaX / w;
        const clamped = Math.min(1, Math.max(0, rawProgress));
        setCubeProgress(clamped);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    const deltaX = e.clientX - touchStartXRef.current;
    const deltaY = e.clientY - touchStartYRef.current;
    const dt = performance.now() - dragStartTimeRef.current;
    const velocity = Math.abs(deltaX) / (dt || 1); // px/ms

    // A. User was actively dragging the 3D Cube!
    if (isCubeDraggingRef.current && cubeModeRef.current) {
      isCubeDraggingRef.current = false;
      const currentP = cubeProgressRef.current;
      const currentMode = cubeModeRef.current;

      // Threshold: 35% displacement OR fast flick velocity (> 0.45 px/ms)
      const passedThreshold = currentP >= 0.35 || velocity > 0.45;

      isAnimatingRef.current = true;
      const startP = currentP;
      const targetP = passedThreshold ? 1 : 0;
      const duration = Math.max(140, Math.min(280, Math.abs(targetP - startP) * 320));
      const animStart = performance.now();

      const finishStep = (now: number) => {
        const elapsed = now - animStart;
        const t = Math.min(1, elapsed / duration);
        // Smooth iOS spring ease: 1 - Math.pow(1 - t, 3)
        const ease = 1 - Math.pow(1 - t, 3);
        const interpolated = startP + (targetP - startP) * ease;
        setCubeProgress(interpolated);

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(finishStep);
        } else {
          isAnimatingRef.current = false;
          setCubeProgress(0);
          setCubeMode(null);
          cubeModeRef.current = null;

          if (passedThreshold) {
            // Commit transition to next or previous user!
            if (currentMode === 'next') {
              setCurrentClusterIndex((prev) => prev + 1);
              setCurrentStoryIndex(0);
              setProgress(0);
              setIsMediaLoaded(false);
            } else if (currentMode === 'prev') {
              setCurrentClusterIndex((prev) => prev - 1);
              setCurrentStoryIndex(0);
              setProgress(0);
              setIsMediaLoaded(false);
            }
          }
          setIsPaused(false);
        }
      };

      animFrameRef.current = requestAnimationFrame(finishStep);
      return;
    }

    // B. Not in cube drag mode: handle taps, swipes down, and internal story navigation
    setIsPaused(false);

    // Swipe down to close
    if (deltaY > 80 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
      onClose();
      return;
    }

    // Quick tap (< 10px movement)
    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      const w = stageWidthRef.current || window.innerWidth || 420;
      if (e.clientX < w * 0.35) {
        handlePrevStory();
      } else {
        handleNextStory();
      }
      return;
    }

    // Swipe between stories of the SAME person (SEM CUBO)
    if (deltaX < -50) {
      if (currentStoryIndex < activeUserStories.length - 1) {
        setCurrentStoryIndex((prev) => prev + 1);
        setProgress(0);
        setIsMediaLoaded(false);
      }
    } else if (deltaX > 50) {
      if (currentStoryIndex > 0) {
        setCurrentStoryIndex((prev) => prev - 1);
        setProgress(0);
        setIsMediaLoaded(false);
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    handlePointerUp(e);
  };

  if (!isOpen || !activeClusterUser) return null;

  const isMyStory = Boolean(activeClusterUser.is_current_user || (currentStory && currentStory.user_id === currentUser.id));
  const stageWidth = stageWidthRef.current || 420;

  return (
    <div
      className="fixed inset-0 z-60 bg-black text-white flex items-center justify-center select-none overflow-hidden"
      style={{
        height: '100dvh',
        width: '100vw',
        touchAction: 'none',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 3D CUBE STAGE CONTAINER */}
      <div
        ref={stageRef}
        className="relative w-full h-full max-w-md bg-black overflow-hidden shadow-2xl"
        style={{
          perspective: '1200px',
          perspectiveOrigin: '50% 50%',
          transformStyle: 'preserve-3d',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* ==================================================================== */}
        {/* CASE 1: 3D CUBE DRAG TO NEXT USER (Turning Left)                      */}
        {/* ==================================================================== */}
        {cubeMode === 'next' && nextClusterUser && (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
            }}
          >
            {/* FACE 1: Current User (Turns from 0deg to -90deg, hinged on right edge) */}
            <div
              className="absolute inset-0 w-full h-full transform-gpu will-change-transform"
              style={{
                transformOrigin: '100% 50%',
                transform: `translateX(${-cubeProgress * stageWidth}px) rotateY(${-cubeProgress * 90}deg)`,
                backfaceVisibility: 'hidden',
              }}
            >
              <StoryFace
                user={activeClusterUser}
                story={currentStory}
                userStoriesList={activeUserStories}
                activeStoryIdx={currentStoryIndex}
                progressPercent={progress}
                isMuted={isMuted}
                onToggleMute={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                onClose={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onDeleteStory={isMyStory ? handleDeleteCurrentStory : undefined}
                onOpenUserProfile={onOpenUserProfile}
                isMyStory={isMyStory}
                shadowOpacity={cubeProgress * 0.72}
                videoRef={videoRef}
                onMediaLoaded={() => setIsMediaLoaded(true)}
                isMediaLoaded={isMediaLoaded}
              />
            </div>

            {/* FACE 2: Next User (Turns from +90deg to 0deg, hinged on left edge) */}
            <div
              className="absolute inset-0 w-full h-full transform-gpu will-change-transform"
              style={{
                transformOrigin: '0% 50%',
                transform: `translateX(${(1 - cubeProgress) * stageWidth}px) rotateY(${(1 - cubeProgress) * 90}deg)`,
                backfaceVisibility: 'hidden',
              }}
            >
              <StoryFace
                user={nextClusterUser}
                story={nextUserStories[0]}
                userStoriesList={nextUserStories}
                activeStoryIdx={0}
                progressPercent={0}
                isMuted={true}
                onToggleMute={(e) => e.stopPropagation()}
                onClose={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onOpenUserProfile={onOpenUserProfile}
                isMyStory={Boolean(nextClusterUser.is_current_user)}
                shadowOpacity={(1 - cubeProgress) * 0.72}
              />
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* CASE 2: 3D CUBE DRAG TO PREVIOUS USER (Turning Right)                 */}
        {/* ==================================================================== */}
        {cubeMode === 'prev' && prevClusterUser && (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              transformStyle: 'preserve-3d',
            }}
          >
            {/* FACE 1: Current User (Turns from 0deg to +90deg, hinged on left edge) */}
            <div
              className="absolute inset-0 w-full h-full transform-gpu will-change-transform"
              style={{
                transformOrigin: '0% 50%',
                transform: `translateX(${cubeProgress * stageWidth}px) rotateY(${cubeProgress * 90}deg)`,
                backfaceVisibility: 'hidden',
              }}
            >
              <StoryFace
                user={activeClusterUser}
                story={currentStory}
                userStoriesList={activeUserStories}
                activeStoryIdx={currentStoryIndex}
                progressPercent={progress}
                isMuted={isMuted}
                onToggleMute={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                onClose={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onDeleteStory={isMyStory ? handleDeleteCurrentStory : undefined}
                onOpenUserProfile={onOpenUserProfile}
                isMyStory={isMyStory}
                shadowOpacity={cubeProgress * 0.72}
                videoRef={videoRef}
                onMediaLoaded={() => setIsMediaLoaded(true)}
                isMediaLoaded={isMediaLoaded}
              />
            </div>

            {/* FACE 2: Previous User (Turns from -90deg to 0deg, hinged on right edge) */}
            <div
              className="absolute inset-0 w-full h-full transform-gpu will-change-transform"
              style={{
                transformOrigin: '100% 50%',
                transform: `translateX(${-(1 - cubeProgress) * stageWidth}px) rotateY(${-(1 - cubeProgress) * 90}deg)`,
                backfaceVisibility: 'hidden',
              }}
            >
              <StoryFace
                user={prevClusterUser}
                story={prevUserStories[0]}
                userStoriesList={prevUserStories}
                activeStoryIdx={Math.max(0, prevUserStories.length - 1)}
                progressPercent={100}
                isMuted={true}
                onToggleMute={(e) => e.stopPropagation()}
                onClose={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onOpenUserProfile={onOpenUserProfile}
                isMyStory={Boolean(prevClusterUser.is_current_user)}
                shadowOpacity={(1 - cubeProgress) * 0.72}
              />
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* CASE 3: NORMAL STANDALONE STORY (No active cube drag)                */}
        {/* ==================================================================== */}
        {cubeMode === null && (
          <div className="absolute inset-0 w-full h-full">
            <StoryFace
              user={activeClusterUser}
              story={currentStory}
              userStoriesList={activeUserStories}
              activeStoryIdx={currentStoryIndex}
              progressPercent={progress}
              isMuted={isMuted}
              onToggleMute={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              onClose={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onDeleteStory={isMyStory ? handleDeleteCurrentStory : undefined}
              onOpenUserProfile={onOpenUserProfile}
              isMyStory={isMyStory}
              isLoading={isLoadingActive && activeUserStories.length === 0}
              shadowOpacity={0}
              videoRef={videoRef}
              onMediaLoaded={() => setIsMediaLoaded(true)}
              isMediaLoaded={isMediaLoaded}
            />
          </div>
        )}
      </div>
    </div>
  );
};
