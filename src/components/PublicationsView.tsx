import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Plus, X, ArrowUp, Loader2, RefreshCw, MapPin, Check, ChevronDown, Camera, Send, Bookmark, Users, Sparkles, Search } from 'lucide-react';
import { Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { NotificationsModal, SocialNotification } from './NotificationsModal';
import { UserSearchModal, SearchUserItem } from './UserSearchModal';
import { UserProfileModal } from './UserProfileModal';

export interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_photo: string;
  image_url: string;
  caption?: string;
  location?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_me?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_photo: string;
  text: string;
  created_at: string;
}

interface UserProfileSummary {
  id: string;
  name: string;
  photo: string;
  posts_count: number;
  posts: Array<{
    id: string;
    image_url: string;
    likes_count: number;
    comments_count: number;
  }>;
}

interface PublicationsViewProps {
  isOpen: boolean;
  onClose?: () => void;
  theme?: string;
  spots?: Spot[];
  onSelectSpot?: (spot: Spot) => void;
  onKeyboardStateChange?: (isOpen: boolean) => void;
}

/**
 * Elegant Apple iOS skeleton card - 100% horizontal edge-to-edge fill
 */
const PostSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => (
  <article className={`w-full max-w-none sm:max-w-[480px] shrink-0 ${
    isDark
      ? 'bg-[#000000] sm:bg-[#0c0c0e] sm:border-white/[0.08] border-white/[0.08]'
      : 'bg-[#ffffff] sm:bg-[#ffffff] sm:border-zinc-200 border-zinc-200'
  } sm:rounded-[24px] sm:border border-b sm:border-b-0 flex flex-col overflow-hidden relative`}>
    {/* Author Header Skeleton */}
    <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden shrink-0`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
        </div>
        <div className="space-y-1.5">
          <div className={`w-24 h-3 rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
          </div>
          <div className={`w-32 h-2.5 rounded-full ${isDark ? 'bg-white/[0.05]' : 'bg-zinc-100'} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
          </div>
        </div>
      </div>
      <div className={`w-8 h-2.5 rounded-full ${isDark ? 'bg-white/[0.05]' : 'bg-zinc-100'} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
      </div>
    </div>

    {/* Photo Skeleton with shimmering gradient & minimal aperture (100% full width) */}
    <div className={`w-full aspect-[4/5] min-h-[360px] sm:min-h-[480px] ${isDark ? 'bg-[#111115]' : 'bg-zinc-100'} relative flex items-center justify-center overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent animate-ios-shimmer" />
      <div className={`w-12 h-12 rounded-full ${isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-zinc-200 border-zinc-300'} flex items-center justify-center border relative z-2`}>
        <Camera className={`w-5 h-5 ${isDark ? 'text-white/25' : 'text-zinc-400'}`} />
      </div>
    </div>

    {/* Action Bar Skeleton */}
    <div className="flex items-center justify-between px-3.5 sm:px-4 pt-3 pb-1">
      <div className="flex items-center gap-4">
        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
        </div>
        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
        </div>
        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
        </div>
      </div>
      <div className={`w-6 h-6 rounded-md ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
      </div>
    </div>

    {/* Text Lines Skeleton */}
    <div className="px-3.5 sm:px-4 pt-2 pb-4 space-y-2">
      <div className={`w-20 h-2.5 rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
      </div>
      <div className={`w-4/5 h-2.5 rounded-full ${isDark ? 'bg-white/[0.05]' : 'bg-zinc-100'} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
      </div>
    </div>
  </article>
);

/**
 * Shimmering skeleton rows for comments bottom sheet
 */
const CommentsSkeleton: React.FC = () => (
  <div className="space-y-4 w-full py-1">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white/[0.08] shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
        </div>
        <div className="flex-1 space-y-2 pt-1">
          <div className="w-24 h-2.5 rounded-full bg-white/[0.08] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
          </div>
          <div className="w-3/4 h-3 rounded-full bg-white/[0.05] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/**
 * iOS Minimalist Orbital Photo Loading Animation
 * Runs smoothly for exactly 2 seconds when publishing
 */
interface OrbitalPublishLoaderProps {
  photos: string[];
}

const OrbitalPublishLoader: React.FC<OrbitalPublishLoaderProps> = ({ photos }) => {
  const photoList = photos.filter(Boolean);
  const isSingle = photoList.length === 1;
  const radius = isSingle ? 54 : 64;
  const cardSize = isSingle ? 68 : 52;
  const borderRadius = isSingle ? 18 : 14;

  return (
    <div
      className="absolute inset-0 z-40 bg-[#000000]/95 backdrop-blur-md flex items-center justify-center rounded-[28px] overflow-hidden select-none"
    >
      <div className="relative w-52 h-52 flex items-center justify-center">
        {/* Subtle, elegant orbital circular guide ring */}
        <div
          className="absolute rounded-full border border-white/[0.09]"
          style={{
            width: radius * 2,
            height: radius * 2,
          }}
        />

        {/* Minimal center anchor */}
        <div className="w-1.5 h-1.5 rounded-full bg-white/20 z-0" />

        {/* Rotating orbital system with natural acceleration and deceleration */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2.0,
            ease: [0.42, 0, 0.58, 1],
            repeat: Infinity,
          }}
        >
          {photoList.map((photoUrl, idx) => {
            const angle = (idx * 360) / photoList.length;
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            return (
              <div
                key={idx}
                className="absolute flex items-center justify-center"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                {/* Counter-rotate synchronously so the photo remains upright during the circular orbit */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{
                    duration: 2.0,
                    ease: [0.42, 0, 0.58, 1],
                    repeat: Infinity,
                  }}
                  className="overflow-hidden bg-[#121214] border border-white/25 shadow-2xl ring-1 ring-black/40"
                  style={{
                    width: cardSize,
                    height: cardSize,
                    borderRadius: borderRadius,
                  }}
                >
                  <img
                    src={photoUrl}
                    alt="Foto da publicação"
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

export const PublicationsView: React.FC<PublicationsViewProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  spots = [],
  onSelectSpot,
  onKeyboardStateChange
}) => {
  const isDark = theme !== 'light';

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Progressive image reveal & error tracking
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});

  // Caption expansion state per post
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});

  // Heart burst animation state on double-tap
  const [heartBurstPostId, setHeartBurstPostId] = useState<string | null>(null);
  const lastTapTimeRef = useRef<{ [key: string]: number }>({});

  // Comments Bottom Sheet State
  const [activeCommentsPost, setActiveCommentsPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);

  // User Profile Modal State
  const [activeUserSummary, setActiveUserSummary] = useState<UserProfileSummary | null>(null);
  const [isLoadingUserSummary, setIsLoadingUserSummary] = useState<boolean>(false);

  // New Post Creation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedPhotoData, setSelectedPhotoData] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>('');
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Notifications Modal State
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false);

  // Saved Posts (Instagram Bookmark) State
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});

  // Real User Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  // Full User Profile Modal State
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  // Feed Tab: Strictly 'para_voce' (tab 'seguindo' removed per specification)
  const [activeFeedTab] = useState<'para_voce'>('para_voce');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('monvian_following_users') || '{}');
    } catch {
      return {};
    }
  });

  // Filtered displayed posts - always 'para_voce'
  const displayedPosts = useMemo(() => {
    return posts;
  }, [posts]);

  // Pull-to-refresh touch tracking
  const [pullY, setPullY] = useState<number>(0);
  const touchStartYRef = useRef<number>(0);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  // Combined spots list (passed from App or fallback to CAMPOS_SPOTS)
  const availableSpots: Spot[] = spots && spots.length > 0 ? spots : CAMPOS_SPOTS;

  // Filtered spots for location selector
  const filteredSpots = availableSpots.filter((s) => {
    if (!locationSearchQuery.trim()) return true;
    const query = locationSearchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(query) ||
      (s.categoryLabel && s.categoryLabel.toLowerCase().includes(query)) ||
      (s.tagLabel && s.tagLabel.toLowerCase().includes(query))
    );
  });

  // Get current authenticated user details if stored
  const getCurrentUser = () => {
    try {
      const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
      return {
        id: u.id ? String(u.id) : (localStorage.getItem('monvian_client_id') || 'u-me'),
        name: u.name || 'Visitante',
        photo: u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
      };
    } catch {
      return {
        id: localStorage.getItem('monvian_client_id') || 'u-me',
        name: 'Visitante',
        photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
      };
    }
  };

  const getAuthToken = () => {
    return localStorage.getItem('monvian_token') || '';
  };

  // 1. Fetch Posts from Cloud/Server (exactly 15 per batch)
  const fetchPosts = useCallback(async (pageNumber = 1, isRefresh = false) => {
    if (pageNumber === 1 && !isRefresh) {
      setIsLoadingInitial(true);
    } else if (pageNumber > 1) {
      setIsLoadingMore(true);
    }

    try {
      const token = getAuthToken();
      const currentUser = getCurrentUser();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/posts?page=${pageNumber}&limit=15&clientId=${encodeURIComponent(currentUser.id)}`, {
        headers
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.posts)) {
        if (pageNumber === 1 || isRefresh) {
          let fetchedPosts = data.posts;
          if (isRefresh && fetchedPosts.length > 0) {
            fetchedPosts.sort((a: Post, b: Post) => {
              const scoreA = (Number(a.likes_count || 0) * 2 + Number(a.comments_count || 0)) + (new Date(a.created_at || Date.now()).getTime() / 100000000);
              const scoreB = (Number(b.likes_count || 0) * 2 + Number(b.comments_count || 0)) + (new Date(b.created_at || Date.now()).getTime() / 100000000);
              return scoreB - scoreA;
            });
          }
          setPosts(fetchedPosts);
        } else {
          setPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newPosts = data.posts.filter((p: Post) => !existingIds.has(p.id));
            return [...prev, ...newPosts];
          });
        }
        setPage(pageNumber);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err) {
      console.warn('[PublicationsView] Error fetching posts:', err);
    } finally {
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
      setPullY(0);
    }
  }, []);


  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoadingNotifications(true);
      const token = getAuthToken();
      const currentUser = getCurrentUser();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/notifications?clientId=${encodeURIComponent(currentUser.id)}`, {
        headers
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadNotifsCount(data.unread_count || 0);
      }
    } catch (err) {
      console.warn('[PublicationsView] Error fetching notifications:', err);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  const handleMarkAllNotificationsRead = async () => {
    try {
      const token = getAuthToken();
      const currentUser = getCurrentUser();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      setUnreadNotifsCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));

      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientId: currentUser.id })
      });
    } catch (err) {
      console.warn('[PublicationsView] Error marking notifications as read:', err);
    }
  };

  // Notify parent if comments, create modal, or notification modals are open so navigation can hide
  useEffect(() => {
    onKeyboardStateChange?.(Boolean(activeCommentsPost || isCreateModalOpen || isNotificationsOpen));
  }, [activeCommentsPost, isCreateModalOpen, isNotificationsOpen, onKeyboardStateChange]);

  // Initial load when tab opens
  useEffect(() => {
    if (isOpen) {
      fetchPosts(1);
      fetchNotifications();
    }
  }, [isOpen, fetchPosts, fetchNotifications]);

  // 2. Infinite Scroll Listener (loads next 15 when near bottom)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

    // Trigger next page when within 350px of bottom
    if (scrollBottom < 350 && hasMore && !isLoadingMore && !isLoadingInitial) {
      fetchPosts(page + 1);
    }
  };

  // 3. Pull-To-Refresh Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (feedScrollRef.current && feedScrollRef.current.scrollTop <= 0) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current > 0 && feedScrollRef.current && feedScrollRef.current.scrollTop <= 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartYRef.current;
      if (diff > 0) {
        const pullDistance = Math.min(diff * 0.45, 90);
        setPullY(pullDistance);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullY > 55 && !isRefreshing) {
      setIsRefreshing(true);
      fetchPosts(1, true);
    } else {
      setPullY(0);
    }
    touchStartYRef.current = 0;
  };

  // 4. Like / Unlike Toggle with optimistic update
  const handleToggleLike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const wasLiked = Boolean(p.liked_by_me);
          return {
            ...p,
            liked_by_me: !wasLiked,
            likes_count: wasLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1
          };
        }
        return p;
      })
    );

    try {
      const token = getAuthToken();
      const currentUser = getCurrentUser();
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          clientId: currentUser.id,
          userName: currentUser.name,
          userPhoto: currentUser.photo
        })
      });

      const data = await res.json();
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === postId) {
              return {
                ...p,
                liked_by_me: Boolean(data.liked),
                likes_count: Number(data.likes_count)
              };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.warn('[PublicationsView] Error toggling like:', err);
    }
  };

  // Double-tap photo to like (Instagram style)
  const handlePhotoDoubleTap = (postId: string) => {
    const now = Date.now();
    const lastTap = lastTapTimeRef.current[postId] || 0;
    if (now - lastTap < 300) {
      // Double tap detected!
      setHeartBurstPostId(postId);
      setTimeout(() => setHeartBurstPostId(null), 850);
      const post = posts.find((p) => p.id === postId);
      if (post && !post.liked_by_me) {
        handleToggleLike(postId);
      }
    }
    lastTapTimeRef.current[postId] = now;
  };

  // Relative time helper for comments (iOS Instagram style)
  const formatCommentRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'agora';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (isNaN(diffSec) || diffSec < 60) return 'agora';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} d`;
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks < 4) return `${diffWeeks} sem`;
      const diffMonths = Math.floor(diffDays / 30);
      return `${diffMonths} m`;
    } catch {
      return 'agora';
    }
  };

  // 5. Open Comments Bottom Sheet
  const handleOpenComments = async (post: Post) => {
    setActiveCommentsPost(post);
    setIsLoadingComments(true);
    setNewCommentText('');
    setReplyingTo(null);

    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      if (data.success && Array.isArray(data.comments)) {
        setComments(data.comments);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    } finally {
      setIsLoadingComments(false);
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 300);
    }
  };

  // Handle start reply to a specific comment user
  const handleStartReply = (authorName: string) => {
    setReplyingTo(authorName);
    setNewCommentText((prev) => {
      const cleanPrev = prev.replace(/^@\w+\s*/, '');
      return `@${authorName} ${cleanPrev}`;
    });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  };

  // Handle cancel reply
  const handleCancelReply = () => {
    setReplyingTo(null);
    setNewCommentText((prev) => prev.replace(/^@\w+\s*/, ''));
  };

  // Submit New Comment
  const handleSubmitComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeCommentsPost || !newCommentText.trim() || isSubmittingComment) return;

    const textToSend = newCommentText.trim();
    setIsSubmittingComment(true);

    const currentUser = getCurrentUser();
    const token = getAuthToken();

    try {
      const res = await fetch(`/api/posts/${activeCommentsPost.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          text: textToSend,
          clientId: currentUser.id,
          userName: currentUser.name,
          userPhoto: currentUser.photo
        })
      });

      const data = await res.json();
      if (data.success && data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setNewCommentText('');
        setReplyingTo(null);

        setTimeout(() => {
          if (commentsScrollRef.current) {
            commentsScrollRef.current.scrollTo({
              top: commentsScrollRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 60);

        // Update post comment count in feed
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === activeCommentsPost.id) {
              return {
                ...p,
                comments_count: p.comments_count + 1
              };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.warn('[PublicationsView] Error adding comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 6. Open Full Real User Profile Modal (Connected directly to SQLite DB)
  const handleOpenUserProfile = (userId: string, initialName?: string, initialPhoto?: string) => {
    setSelectedProfileUserId(userId);
  };

  // 7. Handle File Selection for New Post
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedPhotoData(result);
      setPostCaption('');
      setSelectedLocation('Campos do Jordão, SP');
      setLocationSearchQuery('');
      setIsLocationSelectorOpen(false);
      setIsCreateModalOpen(true);
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  // 8. Publish Post with 2-second professional orbital loading animation
  const handlePublishPost = async () => {
    if (!selectedPhotoData || isPublishing) return;
    setIsPublishing(true);

    const animationStartTime = Date.now();
    const TARGET_DURATION_MS = 2000;

    try {
      // Step A: Upload image
      const uploadRes = await fetch('/api/posts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: selectedPhotoData })
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success || !uploadData.imageUrl) {
        throw new Error(uploadData.error || 'Falha no upload da foto');
      }

      // Step B: Create post with caption and location
      const currentUser = getCurrentUser();
      const token = getAuthToken();

      const postRes = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          image_url: uploadData.imageUrl,
          caption: postCaption.trim(),
          location: selectedLocation.trim() || 'Campos do Jordão, SP',
          clientId: currentUser.id,
          userName: currentUser.name,
          userPhoto: currentUser.photo
        })
      });

      const postData = await postRes.json();
      if (!postData.success || !postData.post) {
        throw new Error(postData.error || 'Falha ao salvar publicação');
      }

      // Step C: Ensure the animation lasts exactly 2 seconds
      const elapsed = Date.now() - animationStartTime;
      const remainingTime = Math.max(0, TARGET_DURATION_MS - elapsed);
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      // Step D: Finalize automatically and return user to feed with new post visible
      setPosts((prev) => [postData.post, ...prev]);
      setIsCreateModalOpen(false);
      setSelectedPhotoData(null);
      setPostCaption('');
      setSelectedLocation('');
      setIsPublishing(false);
      feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const elapsed = Date.now() - animationStartTime;
      const remainingTime = Math.max(0, TARGET_DURATION_MS - elapsed);
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }
      setIsPublishing(false);
      console.error('[PublicationsView] Error publishing post:', err);
      alert('Não foi possível publicar a foto. Tente novamente.');
    }
  };

  // Format relative timestamp
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 5) return 'agora';
      if (diffMins < 60) return `há ${diffMins}m`;
      if (diffHours < 24) return `há ${diffHours}h`;
      if (diffDays === 1) return 'ontem';
      if (diffDays < 7) return `há ${diffDays}d`;
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  // Find if location corresponds to an existing spot
  const findMatchingSpot = (locationName?: string): Spot | undefined => {
    if (!locationName) return undefined;
    const lower = locationName.toLowerCase().trim();
    return availableSpots.find((s) => {
      const sName = s.name.toLowerCase();
      return sName.includes(lower) || lower.includes(sName);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      id="publications-fullscreen-overlay"
      className={`fixed inset-0 z-45 flex flex-col justify-between overflow-hidden select-none ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-black'
      } transition-colors duration-200 rounded-t-[26px] ios-page-top-rounded`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: isDark ? '#000000' : '#ffffff',
        height: '100dvh',
        width: '100vw',
        borderTopLeftRadius: '26px',
        borderTopRightRadius: '26px',
        overflow: 'hidden',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        isolation: 'isolate',
      }}
    >
      {/* Scrollable Feed: Header + Posts scroll seamlessly together */}
      <div
        ref={feedScrollRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto w-full relative z-10 no-scrollbar"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
        }}
      >
        {/* Pull-To-Refresh Indicator */}
        <AnimatePresence>
          {(pullY > 0 || isRefreshing) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: pullY > 0 ? pullY : 46 }}
              exit={{ opacity: 0, height: 0 }}
              className={`w-full flex items-center justify-center overflow-hidden ${
                isDark ? 'bg-[#000000] text-zinc-400' : 'bg-[#ffffff] text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-center w-full py-2">
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? (isDark ? 'animate-spin text-white' : 'animate-spin text-black') : ''}`} />
                {isRefreshing && <span className="ml-2 text-xs font-semibold tracking-tight">Atualizando...</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* 1. Header Bar: Instagram Style (scrolls away with feed)         */}
        {/* Left: [+] button | Center: "Publicações" (Centered) | Right: Heart */}
        {/* ============================================================== */}
        <header
          className={`relative px-4 pb-3 flex items-center justify-between z-20 shrink-0 w-full min-h-[54px] border-b ${
            isDark ? 'border-white/[0.08] bg-[#000000]' : 'border-zinc-200 bg-[#ffffff]'
          } transition-colors duration-200`}
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 10px), 18px)',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          {/* Left: Instagram-style Plus Button */}
          <div className="w-10 flex items-center justify-start">
            <button
              id="btn-create-post-instagram"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Nova Publicação"
              className={`relative p-1 ${
                isDark ? 'text-white hover:text-zinc-200' : 'text-black hover:text-zinc-700'
              } active:scale-90 transition-transform cursor-pointer flex items-center justify-center`}
            >
              <Plus className="w-[26px] h-[26px] stroke-[2.1]" />
            </button>
          </div>

          {/* Center: "Publicações" Title horizontally centered */}
          <div className="flex-1 flex items-center justify-center pointer-events-none">
            <h1 className={`text-[17.5px] sm:text-[18.5px] font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-zinc-950'
            } select-none`}>
              Publicações
            </h1>
          </div>

          {/* Right: Search (Lupa) and Heart (Notificações) buttons */}
          <div className="flex items-center justify-end gap-1.5">
            {/* 🔍 Search / Lupa Button */}
            <button
              id="btn-search-users"
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              title="Pesquisar Usuários"
              className={`relative p-1.5 ${
                isDark ? 'text-white hover:text-zinc-200' : 'text-zinc-950 hover:text-zinc-700'
              } active:scale-90 transition-transform cursor-pointer flex items-center justify-center`}
            >
              <Search className="w-[23px] h-[23px] stroke-[2.1]" />
            </button>

            {/* ♡ Heart / Notificações Button */}
            <button
              id="btn-notifications-heart"
              type="button"
              onClick={() => {
                setIsNotificationsOpen(true);
                fetchNotifications();
              }}
              title="Notificações e Atividade"
              className={`relative p-1.5 ${
                isDark ? 'text-white hover:text-zinc-200' : 'text-zinc-950 hover:text-zinc-700'
              } active:scale-90 transition-transform cursor-pointer group flex items-center justify-center`}
            >
              <Heart className="w-[25px] h-[25px] stroke-[1.9] group-hover:text-rose-500 transition-colors" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B30] opacity-75" />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF3B30] border ${
                    isDark ? 'border-black' : 'border-white'
                  }`} />
                </span>
              )}
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </header>

        {/* Posts Feed container - 100% horizontal edge-to-edge fill */}
        <div className="w-full flex flex-col items-center space-y-4 px-0 sm:px-4 pt-1 sm:pt-4">
        {/* Loading Initial State (Smooth Apple Shimmer Skeletons) */}
        {isLoadingInitial && posts.length === 0 && (
          <div className="w-full flex flex-col items-center space-y-4">
            <PostSkeleton isDark={isDark} />
            <PostSkeleton isDark={isDark} />
          </div>
        )}

        {/* Empty State for Para Você */}
        {!isLoadingInitial && activeFeedTab === 'para_voce' && displayedPosts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="flex flex-col items-center justify-center py-20 text-center max-w-sm px-6"
          >
            <div className={`w-16 h-16 rounded-full ${
              isDark ? 'bg-white/5 border-white/10 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
            } border flex items-center justify-center mb-4`}>
              <Plus className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-zinc-900'} mb-1`}>
              Nenhuma publicação ainda
            </h3>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'} mb-5 leading-relaxed`}>
              Toque no botão + no canto superior esquerdo e compartilhe sua primeira foto em Campos do Jordão!
            </p>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => fileInputRef.current?.click()}
              className={`px-5 py-2.5 rounded-full ${
                isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'
              } text-sm font-black transition-transform cursor-pointer shadow-md`}
            >
              Publicar Primeira Foto
            </motion.button>
          </motion.div>
        )}

        {/* 4. Enhanced Post Cards (100% full width edge-to-edge on mobile with 120fps fluid transitions) */}
        {displayedPosts.map((post) => {
          const matchingSpot = findMatchingSpot(post.location);
          const isCaptionExpanded = expandedCaptions[post.id];
          const hasLongCaption = Boolean(post.caption && post.caption.length > 95);
          const displayedCaption = hasLongCaption && !isCaptionExpanded
            ? post.caption?.slice(0, 95) + '...'
            : post.caption;

          return (
            <motion.article
              key={post.id}
              id={`post-${post.id}`}
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340, mass: 0.65 }}
              className={`w-full max-w-none sm:max-w-[480px] shrink-0 ${
                isDark
                  ? 'bg-[#000000] border-white/10 text-white'
                  : 'bg-[#ffffff] border-zinc-200 text-zinc-950'
              } sm:rounded-[24px] sm:border border-b sm:border-b-0 flex flex-col overflow-hidden transition-colors duration-150 transform-gpu will-change-transform shadow-xs`}
            >
              {/* Card Header: Author, Avatar, Follow Button, Location Tag */}
              <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenUserProfile(post.user_id, post.user_name, post.user_photo)}
                    className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
                  >
                    <div className={`w-9 h-9 rounded-full overflow-hidden ${
                      isDark ? 'bg-zinc-900 border-white/15 ring-white/10' : 'bg-zinc-100 border-zinc-200 ring-black/5'
                    } border shrink-0 shadow-xs ring-1`}>
                      <img
                        src={post.user_photo}
                        alt={post.user_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[14px] font-bold ${
                        isDark ? 'text-white group-hover:text-zinc-200' : 'text-zinc-950 group-hover:text-zinc-700'
                      } leading-tight tracking-tight transition-colors`}>
                        {post.user_name}
                      </span>
                      {post.location && (
                        <div className="flex items-center gap-1 text-[11.5px] font-medium leading-tight mt-0.5">
                          <MapPin className={`w-3 h-3 ${isDark ? 'text-white' : 'text-zinc-900'} shrink-0`} />
                          <span
                            onClick={(e) => {
                              if (matchingSpot && onSelectSpot) {
                                e.stopPropagation();
                                onSelectSpot(matchingSpot);
                              }
                            }}
                            className={`truncate max-w-[170px] ${
                              matchingSpot
                                ? isDark
                                  ? 'text-zinc-300 hover:text-white underline decoration-white/30'
                                  : 'text-zinc-700 hover:text-black underline decoration-zinc-400'
                                : isDark
                                ? 'text-zinc-400'
                                : 'text-zinc-500'
                            }`}
                          >
                            {post.location}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Relative timestamp */}
                <span className={`text-[11px] font-medium ${
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                } shrink-0 pr-1`}>
                  {formatTimeAgo(post.created_at)}
                </span>
              </div>

              {/* Post Photo Container (100% Horizontal Edge-to-Edge Fill) */}
              <div
                onClick={() => handlePhotoDoubleTap(post.id)}
                className={`w-full relative ${
                  isDark ? 'bg-zinc-950' : 'bg-zinc-100'
                } overflow-hidden aspect-[4/5] min-h-[360px] sm:min-h-[480px] cursor-pointer select-none`}
              >
                <img
                  src={post.image_url}
                  alt={post.caption || `Foto de ${post.user_name} em Campos do Jordão`}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  loading="lazy"
                  decoding="async"
                />

                {/* Double-tap Heart Burst Animation (120 FPS Native Spring Bounce) */}
                <AnimatePresence>
                  {heartBurstPostId === post.id && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0, rotate: -12 }}
                      animate={{ scale: [0, 1.45, 1.15, 0], opacity: [0, 1, 1, 0], rotate: [-12, 6, 0, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.85, times: [0, 0.35, 0.7, 1], ease: 'easeOut' }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 transform-gpu"
                    >
                      <Heart className="w-24 h-24 text-white fill-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.7)]" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Clickable Tag Badge for Tourist Spot if present with 120fps spring */}
                {matchingSpot && (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectSpot) onSelectSpot(matchingSpot);
                    }}
                    className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer transform-gpu"
                  >
                    <MapPin className="w-3 h-3 text-white" />
                    <span className="truncate max-w-[170px]">{matchingSpot.name}</span>
                  </motion.button>
                )}
              </div>

              {/* Action Bar (Below Photo): Heart, Comment, Share & Bookmark with 120 FPS micro-physics */}
              <div className="flex items-center justify-between px-3.5 sm:px-4 pt-3 pb-1">
                <div className="flex items-center gap-4 sm:gap-5">
                  {/* Like Button */}
                  <motion.button
                    whileTap={{ scale: 0.78 }}
                    type="button"
                    onClick={() => handleToggleLike(post.id)}
                    className="flex items-center gap-1.5 group cursor-pointer select-none"
                    title={post.liked_by_me ? 'Descurtir' : 'Curtir'}
                  >
                    <motion.div
                      key={post.liked_by_me ? 'liked' : 'unliked'}
                      animate={post.liked_by_me ? { scale: [1, 1.4, 0.92, 1] } : { scale: [1, 0.88, 1] }}
                      transition={{ duration: 0.38, ease: [0.175, 0.885, 0.32, 1.275] }}
                    >
                      <Heart
                        className={`w-6 h-6 transition-colors duration-150 ${
                          post.liked_by_me
                            ? 'fill-[#FF3B30] text-[#FF3B30] drop-shadow-sm'
                            : isDark
                            ? 'text-white/85 group-hover:text-white stroke-[1.8]'
                            : 'text-zinc-900 group-hover:text-black stroke-[1.8]'
                        }`}
                      />
                    </motion.div>
                    <span className={`text-[13.5px] font-bold tracking-tight transition-colors ${
                      post.liked_by_me
                        ? isDark ? 'text-white' : 'text-zinc-950'
                        : isDark ? 'text-zinc-300' : 'text-zinc-700'
                    }`}>
                      {post.likes_count}
                    </span>
                  </motion.button>

                  {/* Comment Button */}
                  <motion.button
                    whileTap={{ scale: 0.82 }}
                    type="button"
                    onClick={() => handleOpenComments(post)}
                    className="flex items-center gap-1.5 group cursor-pointer select-none"
                    title="Comentários"
                  >
                    <MessageCircle className={`w-6 h-6 ${
                      isDark ? 'text-white/85 group-hover:text-white' : 'text-zinc-900 group-hover:text-black'
                    } stroke-[1.8]`} />
                    <span className={`text-[13.5px] font-bold ${
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    } tracking-tight`}>
                      {post.comments_count}
                    </span>
                  </motion.button>

                  {/* Share / Send Button */}
                  <motion.button
                    whileTap={{ scale: 0.82 }}
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: `Publicação de ${post.user_name}`,
                          text: post.caption || 'Confira esta publicação em Campos do Jordão no Monvian Life',
                          url: window.location.href,
                        }).catch(() => {});
                      }
                    }}
                    className={`${
                      isDark ? 'text-white/85 hover:text-white' : 'text-zinc-900 hover:text-black'
                    } cursor-pointer`}
                    title="Compartilhar"
                  >
                    <Send className="w-5 h-5 stroke-[1.8] -rotate-12" />
                  </motion.button>
                </div>

                {/* Bookmark / Save Button */}
                <motion.button
                  whileTap={{ scale: 0.82 }}
                  type="button"
                  onClick={() => setSavedPosts((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                  className={`${
                    isDark ? 'text-white/85 hover:text-white' : 'text-zinc-900 hover:text-black'
                  } cursor-pointer`}
                  title={savedPosts[post.id] ? 'Salvo' : 'Salvar'}
                >
                  <motion.div
                    animate={savedPosts[post.id] ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Bookmark className={`w-6 h-6 ${
                      savedPosts[post.id]
                        ? isDark ? 'fill-white text-white' : 'fill-black text-black'
                        : 'stroke-[1.8]'
                    }`} />
                  </motion.div>
                </motion.button>
              </div>

              {/* Likes text counter */}
              <div className="px-3.5 sm:px-4 pt-1">
                <span className={`text-[13px] font-extrabold ${
                  isDark ? 'text-white' : 'text-zinc-950'
                } tracking-tight`}>
                  {post.likes_count === 1 ? '1 curtida' : `${post.likes_count} curtidas`}
                </span>
              </div>

              {/* Caption (Legenda): Author name + text */}
              {post.caption && (
                <div className={`px-3.5 sm:px-4 pt-1 text-[13.5px] leading-relaxed ${
                  isDark ? 'text-zinc-200' : 'text-zinc-800'
                }`}>
                  <span
                    onClick={() => handleOpenUserProfile(post.user_id, post.user_name, post.user_photo)}
                    className={`font-bold ${isDark ? 'text-white' : 'text-zinc-950'} mr-2 cursor-pointer hover:underline`}
                  >
                    {post.user_name}
                  </span>
                  <span>{displayedCaption}</span>
                  {hasLongCaption && !isCaptionExpanded && (
                    <button
                      type="button"
                      onClick={() => setExpandedCaptions((prev) => ({ ...prev, [post.id]: true }))}
                      className={`${
                        isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'
                      } font-semibold text-xs ml-1 cursor-pointer`}
                    >
                      mais
                    </button>
                  )}
                </div>
              )}

              {/* View Comments link */}
              {post.comments_count > 0 && (
                <div className="px-3.5 sm:px-4 pt-1.5 pb-3">
                  <button
                    type="button"
                    onClick={() => handleOpenComments(post)}
                    className={`text-xs font-semibold ${
                      isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
                    } transition-colors cursor-pointer`}
                  >
                    {post.comments_count === 1
                      ? 'Ver 1 comentário'
                      : `Ver todos os ${post.comments_count} comentários`}
                  </button>
                </div>
              )}

              {/* Bottom spacing if no comments */}
              {post.comments_count === 0 && <div className="pb-3" />}
            </motion.article>
          );
        })}

        {/* Loading More Indicator at bottom */}
        {isLoadingMore && (
          <div className="w-full py-6 flex items-center justify-center gap-2 text-zinc-400">
            <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-white/70' : 'text-zinc-700'}`} />
            <span className="text-xs font-semibold tracking-tight">Carregando mais fotos...</span>
          </div>
        )}

        {/* End of Feed indicator */}
        {!hasMore && posts.length > 0 && (
          <div className={`w-full py-8 text-center ${isDark ? 'text-zinc-600' : 'text-zinc-400'} text-xs font-semibold tracking-tight`}>
            Você viu todas as fotos de Campos do Jordão ✨
          </div>
        )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. COMMENTS BOTTOM SHEET (Instagram Style Bottom Sheet)        */}
      {/* ============================================================== */}
      <AnimatePresence>
        {activeCommentsPost && (
          <div className="fixed inset-0 z-55 flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCommentsPost(null)}
              className={`absolute inset-0 ${isDark ? 'bg-black/75' : 'bg-black/45'} backdrop-blur-xs`}
            />

            {/* Bottom Sheet Modal */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 380, mass: 0.7 }}
              className={`relative w-full max-w-lg mx-auto h-[78vh] sm:h-[82vh] ${
                isDark ? 'bg-[#000000] border-white/[0.12] text-white' : 'bg-[#ffffff] border-zinc-200 text-black'
              } rounded-t-[28px] sm:rounded-t-[32px] border-t flex flex-col overflow-hidden shadow-2xl z-10`}
              style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {/* Sheet Header - Title "Comentários" Centered */}
              <div className={`px-4 pb-3 pt-3 flex items-center justify-center relative border-b ${
                isDark ? 'border-white/[0.08]' : 'border-zinc-200'
              } shrink-0`}>
                <h2 className={`text-[15.5px] sm:text-[16px] font-bold ${isDark ? 'text-white' : 'text-zinc-950'} tracking-tight`}>
                  Comentários
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveCommentsPost(null)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full ${
                    isDark ? 'bg-white/[0.06] text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:text-black'
                  } flex items-center justify-center transition-colors cursor-pointer active:scale-95`}
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comments Scrollable List */}
              <div
                ref={commentsScrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar"
              >
                {isLoadingComments ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-2">
                    <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-white' : 'text-zinc-800'}`} />
                    <span className="text-xs font-semibold text-zinc-400">Carregando comentários...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400">
                    <MessageCircle className={`w-9 h-9 ${isDark ? 'text-zinc-600' : 'text-zinc-400'} mb-2.5 stroke-[1.4]`} />
                    <p className={`text-[14px] font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>Nenhum comentário ainda</p>
                    <p className="text-[12px] text-zinc-500 mt-0.5">Seja o primeiro a deixar um comentário!</p>
                  </div>
                ) : (
                  comments.map((comment, commentIdx) => {
                    const isReply = comment.text.trim().startsWith('@');
                    return (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: Math.min(commentIdx * 0.025, 0.2) }}
                        className={`flex items-start gap-3 text-left transform-gpu will-change-transform ${isReply ? 'pl-6 sm:pl-8' : ''}`}
                      >
                        {/* User Avatar */}
                        <button
                          type="button"
                          onClick={() => handleOpenUserProfile(comment.user_id, comment.user_name, comment.user_photo)}
                          className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full overflow-hidden ${
                            isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-zinc-200'
                          } border shrink-0 mt-0.5 cursor-pointer hover:opacity-85 transition-opacity`}
                        >
                          <img
                            src={comment.user_photo}
                            alt={comment.user_name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>

                        {/* User & Comment Body */}
                        <div className="flex-1 min-w-0">
                          {/* Name + Relative Time */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenUserProfile(comment.user_id, comment.user_name, comment.user_photo)}
                              className={`text-[13px] font-bold ${isDark ? 'text-white hover:text-zinc-300' : 'text-zinc-950 hover:text-zinc-700'} tracking-tight cursor-pointer text-left`}
                            >
                              {comment.user_name}
                            </button>
                            <span className={`text-[11.5px] font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              • {formatCommentRelativeTime(comment.created_at)}
                            </span>
                          </div>

                          {/* Comment Text */}
                          <p className={`text-[13.5px] sm:text-[14px] ${isDark ? 'text-zinc-200' : 'text-zinc-800'} font-normal leading-relaxed break-words mt-0.5 whitespace-pre-wrap`}>
                            {comment.text}
                          </p>

                          {/* Responder Action Button */}
                          <div className="mt-1 flex items-center gap-3">
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              type="button"
                              onClick={() => handleStartReply(comment.user_name)}
                              className={`text-[11.5px] font-semibold ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'} transition-colors cursor-pointer`}
                            >
                              Responder
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Bottom Comment Input Bar */}
              <div
                className={`px-3.5 sm:px-4 pt-2.5 pb-3 border-t ${
                  isDark ? 'border-white/[0.08] bg-[#000000]' : 'border-zinc-200 bg-[#ffffff]'
                } shrink-0`}
                style={{
                  paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 10px))',
                }}
              >
                {/* Replying Indicator */}
                {replyingTo && (
                  <div className="flex items-center justify-between pb-2 px-1 text-[12px] text-zinc-400">
                    <span className="truncate">
                      Respondendo a <strong className={isDark ? 'text-white' : 'text-zinc-900 font-semibold'}>@{replyingTo}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelReply}
                      className={`text-[11.5px] ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'} font-medium cursor-pointer ml-2 shrink-0`}
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Form Bar: [Avatar] [ Deixe um comentário... | Publicar ] */}
                <form
                  onSubmit={handleSubmitComment}
                  className="flex items-center gap-2.5"
                >
                  <div className={`w-8 h-8 rounded-full overflow-hidden ${
                    isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-zinc-200'
                  } border shrink-0`}>
                    <img
                      src={getCurrentUser().photo}
                      alt={getCurrentUser().name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className={`flex-1 flex items-center ${
                    isDark ? 'bg-[#18181b] border-white/10 text-white placeholder-zinc-500 focus-within:border-white/30' : 'bg-zinc-100 border-zinc-200 text-black placeholder-zinc-400 focus-within:border-zinc-400'
                  } border rounded-full px-4 py-2 transition-all`}>
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Deixe um comentário..."
                      className="flex-1 bg-transparent text-[13.5px] sm:text-[14px] focus:outline-none font-normal"
                    />
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      type="submit"
                      disabled={!newCommentText.trim() || isSubmittingComment}
                      className={`text-[13px] font-bold tracking-tight ${
                        isDark ? 'text-white hover:text-zinc-200 disabled:text-zinc-600' : 'text-zinc-900 hover:text-black disabled:text-zinc-400'
                      } disabled:opacity-40 disabled:pointer-events-none transition-all ml-2 cursor-pointer shrink-0`}
                    >
                      {isSubmittingComment ? (
                        <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-white' : 'text-zinc-900'}`} />
                      ) : (
                        'Publicar'
                      )}
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 6. USER PROFILE SUMMARY MODAL (Minimalist: Foto, Nome, Posts)   */}
      {/* ============================================================== */}
      <AnimatePresence>
        {activeUserSummary && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveUserSummary(null)}
              className={`absolute inset-0 ${isDark ? 'bg-black/70' : 'bg-black/40'} backdrop-blur-xs`}
            />

            {/* Profile Card */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative w-full max-w-sm ${
                isDark ? 'bg-[#141518] border-white/15 text-white' : 'bg-[#ffffff] border-zinc-200 text-black'
              } border rounded-[28px] p-6 flex flex-col items-center text-center shadow-2xl z-10 overflow-hidden`}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setActiveUserSummary(null)}
                className={`absolute top-4 right-4 w-7 h-7 rounded-full ${
                  isDark ? 'bg-white/10 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:text-black'
                } flex items-center justify-center transition-colors cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>

              {/* User Photo */}
              <div className={`w-20 h-20 rounded-full overflow-hidden border-2 ${
                isDark ? 'border-white/20 bg-zinc-900' : 'border-zinc-200 bg-zinc-100'
              } shadow-lg mb-3`}>
                <img
                  src={activeUserSummary.photo}
                  alt={activeUserSummary.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* User Name */}
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-950'} tracking-tight mb-0.5`}>
                {activeUserSummary.name}
              </h3>

              {/* Posts Count */}
              <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'} tracking-tight mb-3`}>
                {activeUserSummary.posts_count} {activeUserSummary.posts_count === 1 ? 'publicação' : 'publicações'}
              </span>

              {/* Follow Button with 120 FPS spring physics */}
              {activeUserSummary.id !== getCurrentUser().id && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={() => {
                    const nextVal = !followingMap[activeUserSummary.id];
                    setFollowingMap((prev) => {
                      const updated = { ...prev, [activeUserSummary.id]: nextVal };
                      try {
                        localStorage.setItem('monvian_following_users', JSON.stringify(updated));
                      } catch {}
                      return updated;
                    });
                  }}
                  className={`mb-4 px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    followingMap[activeUserSummary.id]
                      ? isDark ? 'bg-white/10 text-zinc-300 border border-white/15' : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                      : isDark ? 'bg-white text-black hover:bg-zinc-100 shadow-md' : 'bg-black text-white hover:bg-zinc-800 shadow-md'
                  }`}
                >
                  {followingMap[activeUserSummary.id] ? 'Seguindo' : 'Seguir'}
                </motion.button>
              )}

              {/* User Posts Grid */}
              <div className={`w-full border-t ${isDark ? 'border-white/10' : 'border-zinc-200'} pt-4`}>
                {isLoadingUserSummary ? (
                  <div className="py-8 flex justify-center text-zinc-400">
                    <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-white' : 'text-black'}`} />
                  </div>
                ) : activeUserSummary.posts.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6">Nenhuma outra foto deste usuário.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 w-full max-h-56 overflow-y-auto no-scrollbar rounded-xl">
                    {activeUserSummary.posts.map((p) => (
                      <motion.div
                        key={p.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                        className={`aspect-square rounded-lg overflow-hidden ${
                          isDark ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-zinc-200'
                        } border cursor-pointer transform-gpu will-change-transform`}
                      >
                        <img
                          src={p.image_url}
                          alt="Foto"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 7. CREATE POST MODAL (Legenda + Marcar Ponto Turístico / Adm)  */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isCreateModalOpen && selectedPhotoData && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isPublishing) setIsCreateModalOpen(false);
              }}
              className={`absolute inset-0 ${isDark ? 'bg-black/80' : 'bg-black/50'} backdrop-blur-sm`}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative w-full max-w-sm ${
                isDark ? 'bg-[#141518] border-white/15 text-white' : 'bg-[#ffffff] border-zinc-200 text-black'
              } border rounded-[28px] p-5 flex flex-col items-center shadow-2xl z-10 max-h-[90vh] overflow-hidden`}
            >
              {/* Minimalist iOS Orbital Photo Loading Animation (Exactly 2s) */}
              <AnimatePresence>
                {isPublishing && selectedPhotoData && (
                  <OrbitalPublishLoader
                    photos={Array.isArray(selectedPhotoData) ? selectedPhotoData : [selectedPhotoData]}
                  />
                )}
              </AnimatePresence>

              {/* Header */}
              <div className={`w-full flex items-center justify-between pb-3 border-b ${
                isDark ? 'border-white/10' : 'border-zinc-200'
              } mb-3.5`}>
                <span className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-zinc-950'} tracking-tight`}>Nova Publicação</span>
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => setIsCreateModalOpen(false)}
                  className={`w-7 h-7 rounded-full ${
                    isDark ? 'bg-white/10 text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:text-black'
                  } flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Photo Preview (Compact 16:9 / 4:3 for comfortable form layout) */}
              <div className={`w-full h-44 rounded-2xl overflow-hidden ${
                isDark ? 'bg-zinc-950 border-white/10' : 'bg-zinc-100 border-zinc-200'
              } border mb-3.5 relative shadow-inner`}>
                <img
                  src={selectedPhotoData}
                  alt="Pré-visualização"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* 1. Opção de Legenda (Caption) */}
              <div className="w-full mb-3 text-left">
                <label className={`text-[11.5px] font-bold ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                } uppercase tracking-wider mb-1.5 block`}>
                  Legenda
                </label>
                <textarea
                  value={postCaption}
                  onChange={(e) => setPostCaption(e.target.value)}
                  placeholder="Escreva uma legenda para sua foto..."
                  rows={2}
                  maxLength={300}
                  className={`w-full ${
                    isDark
                      ? 'bg-[#1c1d22] border-white/10 text-white placeholder-zinc-500 focus:border-white/25'
                      : 'bg-zinc-100 border-zinc-200 text-black placeholder-zinc-400 focus:border-zinc-400'
                  } border rounded-xl p-3 text-[13.5px] focus:outline-none resize-none font-medium leading-relaxed`}
                />
              </div>

              {/* 2. Opção de Marcar Ponto Turístico / Local da Área de Adm */}
              <div className="w-full mb-5 text-left relative">
                <label className={`text-[11.5px] font-bold ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                } uppercase tracking-wider mb-1.5 flex items-center justify-between`}>
                  <span className="flex items-center gap-1.5">
                    <MapPin className={`w-3.5 h-3.5 ${isDark ? 'text-white' : 'text-zinc-900'}`} />
                    Ponto Turístico / Local
                  </span>
                  {selectedLocation && (
                    <span className="text-[11px] text-zinc-500 lowercase">selecionado</span>
                  )}
                </label>

                {/* Location Selector Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsLocationSelectorOpen(!isLocationSelectorOpen)}
                  className={`w-full ${
                    isDark
                      ? 'bg-[#1c1d22] border-white/10 text-white hover:border-white/20'
                      : 'bg-zinc-100 border-zinc-200 text-black hover:border-zinc-300'
                  } border rounded-xl px-3.5 py-2.5 text-[13px] flex items-center justify-between transition-colors cursor-pointer`}
                >
                  <span className={`truncate ${
                    selectedLocation
                      ? isDark ? 'text-white font-semibold' : 'text-zinc-950 font-semibold'
                      : isDark ? 'text-zinc-500' : 'text-zinc-400'
                  }`}>
                    {selectedLocation || 'Selecione um ponto turístico...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform" />
                </button>

                {/* Dropdown with Search & Admin Spots list */}
                {isLocationSelectorOpen && (
                  <div className={`mt-1.5 w-full ${
                    isDark ? 'bg-[#1e2026] border-white/15' : 'bg-white border-zinc-200'
                  } border rounded-xl p-2 shadow-2xl z-20 max-h-48 flex flex-col`}>
                    <input
                      type="text"
                      value={locationSearchQuery}
                      onChange={(e) => setLocationSearchQuery(e.target.value)}
                      placeholder="Buscar ponto turístico..."
                      className={`w-full ${
                        isDark ? 'bg-[#121316] border-white/10 text-white placeholder-zinc-500' : 'bg-zinc-100 border-zinc-200 text-black placeholder-zinc-400'
                      } border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none mb-1.5`}
                    />

                    <div className="overflow-y-auto no-scrollbar space-y-1 max-h-36 pr-1">
                      {/* Default Campos do Jordão option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocation('Campos do Jordão, SP');
                          setIsLocationSelectorOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          selectedLocation === 'Campos do Jordão, SP'
                            ? isDark ? 'bg-white/15 text-white font-bold' : 'bg-zinc-200 text-zinc-950 font-bold'
                            : isDark ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        <span>Campos do Jordão (Geral)</span>
                        {selectedLocation === 'Campos do Jordão, SP' && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>

                      {filteredSpots.map((spot) => (
                        <button
                          key={spot.id}
                          type="button"
                          onClick={() => {
                            setSelectedLocation(spot.name);
                            setIsLocationSelectorOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            selectedLocation === spot.name
                              ? isDark ? 'bg-white/15 text-white font-bold' : 'bg-zinc-200 text-zinc-950 font-bold'
                              : isDark ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="truncate">{spot.name}</span>
                            {spot.categoryLabel && (
                              <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{spot.categoryLabel}</span>
                            )}
                          </div>
                          {selectedLocation === spot.name && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Cancelar / Publicar with 120 FPS spring tactile physics */}
              <div className="w-full flex items-center gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  disabled={isPublishing}
                  onClick={() => setIsCreateModalOpen(false)}
                  className={`flex-1 py-3 rounded-full ${
                    isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                  } text-xs font-bold transition-all cursor-pointer`}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublishPost}
                  className={`flex-1 py-3 rounded-full ${
                    isDark ? 'bg-white hover:bg-zinc-100 text-black' : 'bg-black hover:bg-zinc-800 text-white'
                  } text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Publicar
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* 10. NOTIFICATIONS MODAL (Heart Button Activity) */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        isLoading={isLoadingNotifications}
        theme={theme}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onNotificationClick={(item) => {
          if (item.post_id) {
            const el = document.getElementById(`post-${item.post_id}`);
            if (el) {
              setIsNotificationsOpen(false);
              setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 120);
            }
          }
        }}
      />

      {/* 11. USER SEARCH MODAL (Instagram-style real user search) */}
      <UserSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectUser={(selectedUser) => {
          setIsSearchModalOpen(false);
          setSelectedProfileUserId(selectedUser.id);
        }}
        isDark={isDark}
      />

      {/* 12. FULL USER PROFILE MODAL (Instagram-style real database profile & follow) */}
      {selectedProfileUserId && (
        <UserProfileModal
          isOpen={Boolean(selectedProfileUserId)}
          userId={selectedProfileUserId}
          onClose={() => setSelectedProfileUserId(null)}
          isDark={isDark}
        />
      )}
    </div>
  );
};
