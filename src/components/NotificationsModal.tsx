import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Heart, MessageCircle, UserPlus, Eye, CheckCheck, Loader2 } from 'lucide-react';

export interface SocialNotification {
  id: string;
  recipient_id: string;
  sender_id: string;
  sender_name: string;
  sender_photo: string;
  type: 'like' | 'comment' | 'follow' | 'story_view' | 'mention' | string;
  post_id?: string;
  post_image?: string;
  comment_text?: string;
  is_read: number;
  created_at: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SocialNotification[];
  isLoading: boolean;
  theme?: string;
  onMarkAllAsRead: () => void;
  onNotificationClick?: (notification: SocialNotification) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  isLoading,
  theme = 'dark',
  onMarkAllAsRead,
  onNotificationClick
}) => {
  const isDark = theme !== 'light';
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const toggleFollow = (e: React.MouseEvent, senderId: string) => {
    e.stopPropagation();
    setFollowingMap((prev) => ({
      ...prev,
      [senderId]: !prev[senderId]
    }));
  };

  const formatNotificationDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'agora';
      if (diffMins < 60) return `${diffMins} min`;
      if (diffHours < 24) return `${diffHours} h`;
      if (diffDays === 1) return 'ontem';
      if (diffDays < 7) return `${diffDays} d`;
      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  const now = Date.now();
  const unread: SocialNotification[] = [];
  const last7Days: SocialNotification[] = [];
  const last30Days: SocialNotification[] = [];
  const older: SocialNotification[] = [];

  notifications.forEach((n) => {
    const time = new Date(n.created_at).getTime();
    const diffDays = (now - time) / (1000 * 60 * 60 * 24);

    if (n.is_read === 0) {
      unread.push(n);
    } else if (diffDays <= 7) {
      last7Days.push(n);
    } else if (diffDays <= 30) {
      last30Days.push(n);
    } else {
      older.push(n);
    }
  });

  const hasUnread = unread.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        id="notifications-fullscreen-view"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={`fixed inset-0 z-50 flex flex-col ${
          isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-black'
        } select-none overflow-hidden transition-colors duration-200`}
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
          backgroundColor: isDark ? '#000000' : '#ffffff',
          height: '100dvh',
          width: '100vw',
        }}
      >
        {/* Top Header - Apple iOS Native Navigation Bar */}
        <header
          className={`relative px-4 pb-3 flex items-center justify-between z-20 shrink-0 w-full min-h-[56px] border-b ${
            isDark ? 'border-white/[0.08] bg-[#000000]' : 'border-zinc-200 bg-[#ffffff]'
          } transition-colors duration-200`}
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 8px), 16px)',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          {/* Left: Back Button (Instagram iOS Style) */}
          <div className="w-10 flex items-center justify-start">
            <button
              id="btn-back-notifications"
              type="button"
              onClick={onClose}
              title="Voltar"
              className={`w-10 h-10 rounded-full ${
                isDark
                  ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white border-white/10'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200'
              } active:scale-95 flex items-center justify-center transition-all cursor-pointer border shadow-xs`}
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.4]" />
            </button>
          </div>

          {/* Center: Title + Unread Indicator Dot */}
          <div className="flex-1 flex items-center justify-center gap-1.5 pointer-events-none">
            <h1 className={`text-[17.5px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'} select-none`}>
              Notificações
            </h1>
            {hasUnread && (
              <span className="w-2 h-2 rounded-full bg-[#FF3B30] inline-block animate-pulse" />
            )}
          </div>

          {/* Right: Mark all as read button or balanced spacer */}
          <div className="w-10 flex items-center justify-end">
            {hasUnread ? (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                title="Marcar todas como lidas"
                className={`w-9 h-9 rounded-full ${
                  isDark
                    ? 'bg-white/[0.08] hover:bg-white/[0.14] text-zinc-300 hover:text-white border-white/10'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-black border-zinc-200'
                } active:scale-95 flex items-center justify-center transition-all cursor-pointer border`}
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </header>

        {/* Scrollable Notifications List */}
        <div
          className="flex-1 overflow-y-auto no-scrollbar w-full relative z-10"
          style={{
            paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)',
          }}
        >
          {/* Loading State */}
          {isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 space-y-3 text-zinc-400">
              <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-white' : 'text-zinc-800'}`} />
              <span className="text-xs font-medium">Carregando notificações...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6">
              <div className={`w-16 h-16 rounded-full ${isDark ? 'bg-white/[0.06] border-white/10' : 'bg-zinc-100 border-zinc-200'} border flex items-center justify-center mb-4 text-zinc-400`}>
                <Heart className="w-7 h-7 stroke-[1.8]" />
              </div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-zinc-900'} mb-1.5`}>Nenhuma notificação</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} max-w-xs leading-relaxed`}>
                Quando alguém curtir, comentar ou interagir com suas publicações e stories em Campos do Jordão, você verá tudo aqui.
              </p>
            </div>
          )}

          {/* 1. Unread Section */}
          {unread.length > 0 && (
            <section className="w-full pt-4 pb-2">
              <div className="flex items-center gap-2 px-4 pb-2">
                <h2 className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} tracking-tight`}>
                  Novas
                </h2>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
              </div>
              <div className="divide-y divide-transparent">
                {unread.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    isFollowing={!!followingMap[item.sender_id]}
                    onToggleFollow={(e) => toggleFollow(e, item.sender_id)}
                    onClick={() => onNotificationClick?.(item)}
                    formattedDate={formatNotificationDate(item.created_at)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 2. Last 7 Days Section */}
          {last7Days.length > 0 && (
            <section className="w-full pt-4 pb-2">
              <h2 className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} tracking-tight px-4 pb-2`}>
                Últimos 7 dias
              </h2>
              <div className="divide-y divide-transparent">
                {last7Days.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    isFollowing={!!followingMap[item.sender_id]}
                    onToggleFollow={(e) => toggleFollow(e, item.sender_id)}
                    onClick={() => onNotificationClick?.(item)}
                    formattedDate={formatNotificationDate(item.created_at)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 3. Last 30 Days Section */}
          {last30Days.length > 0 && (
            <section className="w-full pt-4 pb-2">
              <h2 className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} tracking-tight px-4 pb-2`}>
                Últimos 30 dias
              </h2>
              <div className="divide-y divide-transparent">
                {last30Days.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    isFollowing={!!followingMap[item.sender_id]}
                    onToggleFollow={(e) => toggleFollow(e, item.sender_id)}
                    onClick={() => onNotificationClick?.(item)}
                    formattedDate={formatNotificationDate(item.created_at)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 4. Older Section */}
          {older.length > 0 && (
            <section className="w-full pt-4 pb-2">
              <h2 className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-zinc-900'} tracking-tight px-4 pb-2`}>
                Anteriores
              </h2>
              <div className="divide-y divide-transparent">
                {older.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    isFollowing={!!followingMap[item.sender_id]}
                    onToggleFollow={(e) => toggleFollow(e, item.sender_id)}
                    onClick={() => onNotificationClick?.(item)}
                    formattedDate={formatNotificationDate(item.created_at)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

interface NotificationRowProps {
  item: SocialNotification;
  isDark?: boolean;
  isFollowing: boolean;
  onToggleFollow: (e: React.MouseEvent) => void;
  onClick: () => void;
  formattedDate: string;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  item,
  isDark = true,
  isFollowing,
  onToggleFollow,
  onClick,
  formattedDate
}) => {
  const isUnread = item.is_read === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors cursor-pointer transform-gpu will-change-transform ${
        isUnread
          ? isDark ? 'bg-white/[0.04]' : 'bg-zinc-100/80'
          : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-zinc-50'
      }`}
    >
      {/* Left: Avatar with optional sub-badge */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="relative shrink-0">
          <img
            src={item.sender_photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
            alt={item.sender_name}
            className={`w-12 h-12 rounded-full object-cover border ${isDark ? 'border-white/10' : 'border-zinc-200'}`}
          />

          {/* Type Badge (Sub-icon on avatar edge) */}
          {item.type === 'like' && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FF3B30] flex items-center justify-center border-2 ${isDark ? 'border-black' : 'border-white'}`}>
              <Heart className="w-2.5 h-2.5 fill-white text-white" />
            </div>
          )}
          {item.type === 'comment' && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#007AFF] flex items-center justify-center border-2 ${isDark ? 'border-black' : 'border-white'}`}>
              <MessageCircle className="w-2.5 h-2.5 fill-white text-white" />
            </div>
          )}
          {item.type === 'follow' && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#5856D6] flex items-center justify-center border-2 ${isDark ? 'border-black' : 'border-white'}`}>
              <UserPlus className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          {item.type === 'story_view' && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FF9500] flex items-center justify-center border-2 ${isDark ? 'border-black' : 'border-white'}`}>
              <Eye className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-1">
          <p className={`text-[13.5px] leading-snug ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            <span className="font-bold mr-1">{item.sender_name}</span>
            {item.type === 'like' && 'curtiu sua publicação.'}
            {item.type === 'comment' && (
              <>
                comentou:{' '}
                <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                  "{item.comment_text || 'Ótima foto!'}"
                </span>
              </>
            )}
            {item.type === 'follow' && 'começou a seguir você.'}
            {item.type === 'story_view' && (
              <>
                {item.comment_text || 'visualizou seu story.'}
              </>
            )}
            {!['like', 'comment', 'follow', 'story_view'].includes(item.type) && 'interagiu com você.'}
            <span className={`${isDark ? 'text-zinc-500' : 'text-zinc-400'} text-xs ml-1.5 font-normal whitespace-nowrap`}>
              {formattedDate}
            </span>
          </p>
        </div>
      </div>

      {/* Right: Post Thumbnail or Follow/Message Button */}
      <div className="shrink-0 flex items-center pl-1">
        {item.post_image ? (
          <div className={`w-11 h-14 rounded-md overflow-hidden border ${isDark ? 'border-white/10 bg-zinc-900' : 'border-zinc-200 bg-zinc-100'} shadow-xs shrink-0`}>
            <img
              src={item.post_image}
              alt="Publicação"
              className="w-full h-full object-cover"
            />
          </div>
        ) : item.type === 'follow' ? (
          <button
            type="button"
            onClick={onToggleFollow}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isFollowing
                ? isDark ? 'bg-[#262626] text-white hover:bg-[#333333]' : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300'
                : isDark ? 'bg-white text-black hover:bg-zinc-200 active:scale-95 font-bold' : 'bg-black text-white hover:bg-zinc-800 active:scale-95 font-bold'
            }`}
          >
            {isFollowing ? 'Mensagem' : 'Seguir'}
          </button>
        ) : null}
      </div>
    </motion.div>
  );
};
