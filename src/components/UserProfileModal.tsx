import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ChevronLeft,
  Heart,
  MessageCircle,
  UserCheck,
  UserPlus,
  Grid3X3,
  Loader2,
  Sparkles,
  MapPin,
  Share2,
  Bookmark,
  MoreHorizontal,
  Send,
} from 'lucide-react';
import { FollowersListModal } from './FollowersListModal';
import { VerifiedBadge } from './ui/VerifiedBadge';

const getCurrentUserPhoto = () => {
  try {
    const saved = localStorage.getItem('monvian_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.photo || parsed.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
    }
  } catch {}
  return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';
};

const formatPostTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 5) return 'AGORA';
    if (diffMins < 60) return `HÁ ${diffMins} MIN`;
    if (diffHours < 24) return `HÁ ${diffHours} ${diffHours === 1 ? 'HORA' : 'HORAS'}`;
    if (diffDays === 1) return 'HÁ 1 DIA';
    return `HÁ ${diffDays} DIAS`;
  } catch {
    return '';
  }
};

export interface UserProfileData {
  id: string;
  name: string;
  username: string;
  username_normalized: string;
  avatar_url: string;
  bio: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
  is_me: boolean;
}

export interface UserPostSummary {
  id: string;
  user_id: string;
  user_name: string;
  user_username?: string;
  user_photo: string;
  image_url: string;
  caption?: string;
  location?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_me?: boolean;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialUsername?: string;
  onOpenEditProfile?: () => void;
  onOpenPostDetail?: (post: UserPostSummary) => void;
  isDark?: boolean;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  initialUsername,
  onOpenEditProfile,
  onOpenPostDetail,
  isDark = true,
}) => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [posts, setPosts] = useState<UserPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [selectedPost, setSelectedPost] = useState<UserPostSummary | null>(null);

  // Followers / Following list sub-modal
  const [followListModalOpen, setFollowListModalOpen] = useState(false);
  const [followListInitialTab, setFollowListInitialTab] = useState<'followers' | 'following'>('followers');

  const fetchProfile = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const token = localStorage.getItem('monvian_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/profile`, { headers });
      const data = await res.json();

      if (data.success && data.user) {
        setProfile(data.user);
        setIsFollowing(Boolean(data.user.is_following));
        setFollowersCount(Number(data.user.followers_count || 0));
        setFollowingCount(Number(data.user.following_count || 0));
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const handleToggleFollow = async () => {
    if (!profile) return;
    const token = localStorage.getItem('monvian_token');
    const prevStatus = isFollowing;
    const nextStatus = !prevStatus;

    // Optimistic UI
    setIsFollowing(nextStatus);
    setFollowersCount((prev) => (nextStatus ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/users/${encodeURIComponent(profile.id)}/toggle-follow`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();

      if (data.success) {
        setIsFollowing(Boolean(data.is_following));
        setFollowersCount(Number(data.followers_count));
        setFollowingCount(Number(data.following_count));
      } else {
        // Revert on error
        setIsFollowing(prevStatus);
        setFollowersCount((prev) => (prevStatus ? prev + 1 : Math.max(0, prev - 1)));
      }
    } catch {
      setIsFollowing(prevStatus);
      setFollowersCount((prev) => (prevStatus ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const openFollowList = (tab: 'followers' | 'following') => {
    setFollowListInitialTab(tab);
    setFollowListModalOpen(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[115] w-full h-full flex flex-col select-none overflow-hidden rounded-t-[26px] ios-page-top-rounded">
          {/* Full Screen Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full h-full rounded-t-[26px] overflow-hidden flex flex-col shadow-none z-10 ios-page-top-rounded ${
              isDark
                ? 'bg-[#000000] text-white'
                : 'bg-[#ffffff] text-zinc-900'
            }`}
            style={{
              borderTopLeftRadius: '26px',
              borderTopRightRadius: '26px',
              overflow: 'hidden',
              WebkitMaskImage: '-webkit-radial-gradient(white, black)',
            }}
          >
            {/* Top Navigation Bar */}
            <div
              className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between shrink-0 rounded-t-[26px] ${
                isDark ? 'border-white/10 bg-[#000000]' : 'border-zinc-200 bg-[#ffffff]'
              }`}
              style={{
                paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 8px), 14px)',
                borderTopLeftRadius: '26px',
                borderTopRightRadius: '26px',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-black'
                }`}
                title="Voltar"
              >
                <ArrowLeft
                  className={`w-5 h-5 stroke-[2.2] ${isDark ? 'text-white' : 'text-black'}`}
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                />
              </button>

              <div className="flex flex-col items-center">
                <span className="text-[16px] sm:text-[17px] font-bold tracking-tight">
                  @{profile?.username || initialUsername || 'perfil'}
                </span>
              </div>

              <div className="w-9 h-9" aria-hidden="true" />
            </div>

            {/* Scrollable Profile Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 sm:px-7 py-4 space-y-6">
              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-500 font-semibold">Carregando perfil...</span>
                </div>
              ) : profile ? (
                <>
                  {/* Profile Header: Avatar + Metrics */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    {/* Big Avatar with iOS Ring */}
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full p-1 bg-gradient-to-tr from-[#FFFFFF] to-[#5856D6] shadow-md">
                        <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 border-2 border-black">
                          <img
                            src={profile.avatar_url || '/fotoperfil.png'}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/fotoperfil.png';
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Real Metrics (Publicações, Seguidores, Seguindo) */}
                    <div className="flex-1 flex items-center justify-around text-center select-none">
                      {/* Publicações */}
                      <div className="flex flex-col items-center">
                        <span className="text-[17px] sm:text-[19px] font-extrabold tracking-tight">
                          {posts.length || profile.posts_count}
                        </span>
                        <span className="text-[12px] text-zinc-400 font-medium">Publicações</span>
                      </div>

                      {/* Seguidores (Clickable) */}
                      <button
                        type="button"
                        onClick={() => openFollowList('followers')}
                        className="flex flex-col items-center group cursor-pointer transition-transform active:scale-95"
                      >
                        <span className="text-[17px] sm:text-[19px] font-extrabold tracking-tight group-hover:text-zinc-200 transition-colors">
                          {followersCount}
                        </span>
                        <span className="text-[12px] text-zinc-400 font-medium group-hover:text-zinc-200">
                          Seguidores
                        </span>
                      </button>

                      {/* Seguindo (Clickable) */}
                      <button
                        type="button"
                        onClick={() => openFollowList('following')}
                        className="flex flex-col items-center group cursor-pointer transition-transform active:scale-95"
                      >
                        <span className="text-[17px] sm:text-[19px] font-extrabold tracking-tight group-hover:text-zinc-200 transition-colors">
                          {followingCount}
                        </span>
                        <span className="text-[12px] text-zinc-400 font-medium group-hover:text-zinc-200">
                          Seguindo
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Name, Username, and Bio */}
                  <div className="space-y-1">
                    <h2 className="text-[16.5px] sm:text-[18px] font-bold tracking-tight leading-tight">
                      {profile.name}
                    </h2>
                    <p className="text-[13px] text-zinc-400 font-medium leading-none">
                      @{profile.username}
                    </p>
                    {profile.bio && (
                      <p className="text-[13.5px] leading-relaxed pt-1.5 whitespace-pre-line text-zinc-300 dark:text-zinc-300">
                        {profile.bio}
                      </p>
                    )}
                  </div>

                  {/* Action Button: Seguir / Seguindo or Editar Perfil */}
                  <div className="pt-1">
                    {profile.is_me ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenEditProfile?.();
                        }}
                        className={`w-full py-2.5 rounded-[16px] text-[13.5px] font-bold tracking-tight transition-all cursor-pointer border ${
                          isDark
                            ? 'bg-zinc-900 hover:bg-zinc-800 text-white border-white/10'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200'
                        }`}
                      >
                        Editar Perfil
                      </button>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleToggleFollow}
                        className={`w-full py-2.5 rounded-[16px] text-[13.5px] font-bold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                          isFollowing
                            ? isDark
                              ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                              : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800 border-zinc-300'
                            : isDark
                              ? 'bg-[#FFFFFF] hover:bg-zinc-200 text-black border-transparent shadow-md'
                              : 'bg-black hover:bg-zinc-800 text-white border-transparent shadow-md'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="w-4 h-4 stroke-[2.2]" />
                            <span>Seguindo</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 stroke-[2.2]" />
                            <span>Seguir</span>
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>

                  {/* Grid Header */}
                  <div className={`pt-4 border-t flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${
                    isDark ? 'border-white/10 text-white' : 'border-zinc-200 text-zinc-800'
                  }`}>
                    <Grid3X3 className="w-4 h-4 stroke-[2.2]" />
                    <span>Publicações ({posts.length})</span>
                  </div>

                  {/* 3-Column Posts Grid */}
                  {posts.length === 0 ? (
                    <div className="py-16 text-center text-zinc-500">
                      <p className="text-[14px] font-semibold">Nenhuma publicação ainda</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        As fotos publicadas por este usuário aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1 sm:gap-1.5 pb-6">
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => {
                            if (onOpenPostDetail) {
                              onOpenPostDetail(post);
                            } else {
                              setSelectedPost(post);
                            }
                          }}
                          className="aspect-square bg-zinc-900 rounded-[10px] overflow-hidden relative group cursor-pointer"
                        >
                          <img
                            src={post.image_url}
                            alt={post.caption || 'Publicação'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {/* Hover overlay with likes and comments */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs font-bold">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 fill-white" />
                              {post.likes_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5 fill-white" />
                              {post.comments_count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-24 text-center text-zinc-500">
                  <p className="text-[15px] font-bold">Usuário não encontrado</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Followers / Following List Sub-Modal */}
      {profile && (
        <FollowersListModal
          isOpen={followListModalOpen}
          onClose={() => setFollowListModalOpen(false)}
          userId={profile.id}
          username={profile.username}
          initialTab={followListInitialTab}
          onOpenUserProfile={(newUserId) => {
            setFollowListModalOpen(false);
            // Re-fetch profile for new user
            fetchProfile();
          }}
          isDark={isDark}
        />
      )}

      {/* Real Fullscreen Instagram-Style Publication Page */}
      <AnimatePresence>
        {selectedPost && profile && (
          <PostFullscreenPage
            post={selectedPost}
            profile={profile}
            isFollowing={isFollowing}
            onToggleFollow={handleToggleFollow}
            onClose={() => setSelectedPost(null)}
            onUpdateStats={(postId, newLikes, newComments) => {
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === postId
                    ? { ...p, likes_count: newLikes, comments_count: newComments }
                    : p
                )
              );
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

interface PostFullscreenPageProps {
  post: UserPostSummary;
  profile: UserProfileData;
  isFollowing: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  onUpdateStats?: (postId: string, newLikes: number, newComments: number) => void;
}

const PostFullscreenPage: React.FC<PostFullscreenPageProps> = ({
  post,
  profile,
  isFollowing,
  onToggleFollow,
  onClose,
  onUpdateStats,
}) => {
  const [likesCount, setLikesCount] = useState<number>(post.likes_count || 0);
  const [isLiked, setIsLiked] = useState<boolean>(() => {
    try {
      const savedLikes = JSON.parse(localStorage.getItem('monvian_liked_posts') || '{}');
      if (savedLikes[post.id] !== undefined) return Boolean(savedLikes[post.id]);
    } catch {}
    return Boolean(post.liked_by_me);
  });
  const [commentsCount, setCommentsCount] = useState<number>(post.comments_count || 0);
  const [comments, setComments] = useState<
    Array<{ id: string; user_name: string; user_photo: string; text: string; created_at: string }>
  >([]);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [commentInput, setCommentInput] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('monvian_saved_posts') || '{}');
      return Boolean(saved[post.id]);
    } catch {}
    return false;
  });
  const [showHeartBurst, setShowHeartBurst] = useState<boolean>(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<number>(0);

  const currentUserPhoto = getCurrentUserPhoto();

  useEffect(() => {
    let isMounted = true;
    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const token = localStorage.getItem('monvian_token');
        const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.comments)) {
          setComments(data.comments);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      } finally {
        if (isMounted) setLoadingComments(false);
      }
    };
    fetchComments();
    return () => {
      isMounted = false;
    };
  }, [post.id]);

  const handleToggleLike = async () => {
    const nextLiked = !isLiked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setIsLiked(nextLiked);
    setLikesCount(nextCount);
    if (onUpdateStats) onUpdateStats(post.id, nextCount, commentsCount);

    try {
      const savedLikes = JSON.parse(localStorage.getItem('monvian_liked_posts') || '{}');
      if (nextLiked) savedLikes[post.id] = true;
      else delete savedLikes[post.id];
      localStorage.setItem('monvian_liked_posts', JSON.stringify(savedLikes));
    } catch {}

    try {
      const token = localStorage.getItem('monvian_token');
      await fetch(`/api/posts/${encodeURIComponent(post.id)}/like`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handlePhotoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      if (!isLiked) {
        handleToggleLike();
      }
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 900);
    }
    lastTapRef.current = now;
  };

  const handleToggleSave = () => {
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    try {
      const saved = JSON.parse(localStorage.getItem('monvian_saved_posts') || '{}');
      if (nextSaved) saved[post.id] = true;
      else delete saved[post.id];
      localStorage.setItem('monvian_saved_posts', JSON.stringify(saved));
    } catch {}
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Publicação de @${profile.username}`,
          text: post.caption || 'Confira esta publicação no Movea!',
          url: window.location.href,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch {}
    }
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim() || submittingComment) return;

    const text = commentInput.trim();
    setCommentInput('');
    setSubmittingComment(true);

    try {
      const token = localStorage.getItem('monvian_token');
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success && data.comment) {
        const nextComments = [...comments, data.comment];
        setComments(nextComments);
        const nextCount = commentsCount + 1;
        setCommentsCount(nextCount);
        if (onUpdateStats) onUpdateStats(post.id, likesCount, nextCount);
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="fixed inset-0 z-[150] w-full h-full bg-[#000000] text-white flex flex-col overflow-y-auto select-none"
    >
      {/* 1. TOP NAVIGATION BAR */}
      <div
        className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-white/10 px-3 py-2.5 flex items-center justify-between"
        style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 8px), 14px)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="p-1 -ml-1 text-white hover:text-zinc-300 active:scale-95 transition-all cursor-pointer flex items-center"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.4]" />
        </button>

        <span className="text-[15px] font-bold tracking-tight text-white uppercase">
          Publicações
        </span>

        <div className="w-6" />
      </div>

      {/* 2. POST HEADER */}
      <div className="px-3.5 py-3 flex items-center justify-between bg-black">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-900 border border-white/20 shrink-0">
            <img
              src={profile.avatar_url || post.user_photo}
              alt={profile.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-bold text-white tracking-tight truncate">
                {profile.username || post.user_name}
              </span>
              <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
            </div>
            {post.location && (
              <span className="text-[11px] text-zinc-400 truncate max-w-[210px] leading-tight pt-0.5">
                {post.location}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Botão Seguir se não for o próprio perfil */}
          {!profile.is_me && (
            <button
              type="button"
              onClick={onToggleFollow}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                isFollowing
                  ? 'bg-white/10 text-zinc-300 border border-white/20 hover:bg-white/15'
                  : 'bg-[#FFFFFF] hover:bg-[#0066d6] text-white shadow-sm'
              }`}
            >
              {isFollowing ? 'Seguindo' : 'Seguir'}
            </button>
          )}

          <button
            type="button"
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Opções"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 3. FULL-WIDTH EDGE-TO-EDGE PUBLICATION IMAGE */}
      <div
        onClick={handlePhotoTap}
        className="w-full relative bg-zinc-950 overflow-hidden aspect-[4/5] max-h-[72vh] flex items-center justify-center select-none cursor-pointer"
      >
        <img
          src={post.image_url}
          alt={post.caption || 'Publicação'}
          className="w-full h-full object-cover"
        />

        {/* Double-tap heart pop animation */}
        <AnimatePresence>
          {showHeartBurst && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0.95] }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <Heart className="w-24 h-24 text-white fill-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.85)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. ACTIONS BAR: LIKE, COMMENT, SHARE, SAVE */}
      <div className="px-3.5 pt-3 pb-1.5 flex items-center justify-between bg-black">
        {/* Left: Like, Comment, Share */}
        <div className="flex items-center gap-4">
          {/* Curtis */}
          <motion.button
            whileTap={{ scale: 0.8 }}
            type="button"
            onClick={handleToggleLike}
            className="cursor-pointer text-white focus:outline-none"
            aria-label="Curtir"
          >
            <Heart
              className={`w-6 h-6 transition-colors ${
                isLiked ? 'fill-[#f43f5e] text-[#f43f5e]' : 'text-white'
              }`}
            />
          </motion.button>

          {/* Commentar */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={() => commentInputRef.current?.focus()}
            className="cursor-pointer text-white hover:text-zinc-300 transition-colors focus:outline-none"
            aria-label="Comentar"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>

          {/* Compartilhar */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={handleShare}
            className="cursor-pointer text-white hover:text-zinc-300 transition-colors focus:outline-none"
            aria-label="Compartilhar"
          >
            <Share2 className="w-6 h-6" />
          </motion.button>
        </div>

        {/* Right: Botão Salvar */}
        <motion.button
          whileTap={{ scale: 0.8 }}
          type="button"
          onClick={handleToggleSave}
          className="cursor-pointer text-white focus:outline-none"
          aria-label="Salvar"
        >
          <Bookmark
            className={`w-6 h-6 transition-colors ${
              isSaved ? 'fill-white text-white' : 'text-white'
            }`}
          />
        </motion.button>
      </div>

      {/* 5. LIKES COUNT */}
      <div className="px-3.5 py-0.5">
        <p className="font-bold text-[13.5px] text-white tracking-tight">
          {likesCount.toLocaleString()} {likesCount === 1 ? 'curtida' : 'curtidas'}
        </p>
      </div>

      {/* 6. CAPTION */}
      {post.caption && (
        <div className="px-3.5 py-1 text-[13.5px] leading-snug">
          <strong className="text-white font-bold mr-1.5">
            {profile.username || post.user_name}
          </strong>
          <span className="text-zinc-200">{post.caption}</span>
        </div>
      )}

      {/* 7. TIMESTAMP */}
      <div className="px-3.5 pt-1 pb-2">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          {formatPostTimeAgo(post.created_at)}
        </span>
      </div>

      {/* 8. COMMENTS LIST */}
      <div className="px-3.5 py-2 border-t border-white/10 flex-1">
        <h4 className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
          Comentários {comments.length > 0 && `(${comments.length})`}
        </h4>

        {loadingComments ? (
          <div className="py-6 flex justify-center text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </p>
        ) : (
          <div className="space-y-3 pb-4">
            {comments.map((cmt) => (
              <div key={cmt.id} className="flex items-start gap-2.5 text-xs">
                <img
                  src={cmt.user_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                  alt={cmt.user_name}
                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
                />
                <div className="flex-1 leading-snug">
                  <span className="font-bold text-white mr-1.5">{cmt.user_name}</span>
                  <span className="text-zinc-300">{cmt.text}</span>
                  <div className="text-[10px] text-zinc-500 pt-0.5">
                    {formatPostTimeAgo(cmt.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 9. COMMENT INPUT BAR */}
      <div
        className="sticky bottom-0 bg-black/95 backdrop-blur-md border-t border-white/10 px-3.5 py-2.5 flex items-center gap-2.5 z-40"
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 12px), 16px)' }}
      >
        <img
          src={currentUserPhoto}
          alt="Você"
          className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/20"
        />
        <form onSubmit={handleAddComment} className="flex-1 flex items-center gap-2">
          <input
            ref={commentInputRef}
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Adicione um comentário..."
            className="flex-1 bg-zinc-900/80 border border-white/10 rounded-full px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={!commentInput.trim() || submittingComment}
            className={`text-xs font-bold px-3 py-2 transition-colors cursor-pointer ${
              commentInput.trim() && !submittingComment
                ? 'text-[#FFFFFF] hover:text-zinc-300'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
          >
            {submittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Publicar'}
          </button>
        </form>
      </div>
    </motion.div>
  );
};
