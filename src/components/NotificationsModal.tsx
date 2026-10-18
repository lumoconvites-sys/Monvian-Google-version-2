import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Bell, Heart, MessageCircle, UserPlus, Eye, CheckCheck, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

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
  onBack?: () => void;
  notifications: SocialNotification[];
  isLoading: boolean;
  theme?: string;
  onMarkAllAsRead: () => void;
  onNotificationClick?: (notification: SocialNotification) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onBack,
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

  const handleBack = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onBack) {
      onBack();
    } else if (onClose) {
      onClose();
    }
  };

  const modalContent = (
    <motion.div
      id="notifications-fullscreen-view"
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      onClick={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[150] flex flex-col ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-black'
      } select-none overflow-hidden rounded-none pointer-events-auto`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
        backgroundColor: isDark ? '#000000' : '#ffffff',
        height: '100dvh',
        width: '100vw',
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '0px',
        overflow: 'hidden',
      }}
    >
        {/* Top Header - Apple iOS Large Title Style matching reference */}
        <div
          className="shrink-0 w-full"
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
            paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
          }}
        >
          {/* Header Row with Back Button, Centered Title, and Optional Action */}
          <div className="flex items-center justify-between pb-3">
            <button
              id="btn-back-notifications"
              type="button"
              onClick={handleBack}
              onTouchEnd={handleBack}
              title="Voltar ao Perfil"
              aria-label="Voltar para o perfil"
              className={`w-11 h-11 rounded-full ${
                isDark
                  ? 'bg-white/[0.12] hover:bg-white/[0.20] text-white border-white/15'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200/80'
              } active:scale-90 flex items-center justify-center transition-all cursor-pointer border shadow-sm shrink-0 pointer-events-auto`}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.6]" />
            </button>

            <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight text-center flex-1 mx-2 ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}>
              Notificações
            </h1>

            {hasUnread ? (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                title="Marcar todas como lidas"
                className={`text-xs font-semibold ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
                } transition-colors cursor-pointer px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/10 shrink-0`}
              >
                Marcar como lidas
              </button>
            ) : (
              <div className="w-10 h-10 pointer-events-none shrink-0" />
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && notifications.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-14 space-y-3 text-zinc-400">
            <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-white' : 'text-zinc-800'}`} />
            <span className="text-xs font-medium">Carregando notificações...</span>
          </div>
        )}

        {/* Empty State: Centered directly in the middle of the screen matching reference */}
        {!isLoading && notifications.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
            className="flex-1 flex flex-col items-center justify-center text-center px-6 -mt-16 select-none"
          >
            {/* Bell Icon matching reference */}
            <Bell
              className={`w-11 h-11 stroke-[1.6] mb-5 ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}
            />

            {/* Title matching reference */}
            <h2 className={`text-lg sm:text-[19px] font-bold tracking-tight mb-2 ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}>
              Ainda não há notificações
            </h2>

            {/* Subtitle matching reference */}
            <p className={`text-[14px] sm:text-[15px] leading-relaxed max-w-xs ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}>
              Não há nada aqui (por enquanto).<br />
              Avisaremos assim que houver novidades.
            </p>
          </motion.div>
        )}

        {/* Scrollable Notifications List (when notifications exist) */}
        {notifications.length > 0 && (
          <div
            className="flex-1 overflow-y-auto no-scrollbar w-full relative z-10 pt-2 px-1"
            style={{
              paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)',
            }}
          >
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
                  {unread.map((item, idx) => (
                    <NotificationRow
                      key={item.id}
                      index={idx}
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
                  {last7Days.map((item, idx) => (
                    <NotificationRow
                      key={item.id}
                      index={idx}
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
                  {last30Days.map((item, idx) => (
                    <NotificationRow
                      key={item.id}
                      index={idx}
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
                  {older.map((item, idx) => (
                    <NotificationRow
                      key={item.id}
                      index={idx}
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
        )}
      </motion.div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

interface NotificationRowProps {
  item: SocialNotification;
  index?: number;
  isDark?: boolean;
  isFollowing: boolean;
  onToggleFollow: (e: React.MouseEvent) => void;
  onClick: () => void;
  formattedDate: string;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  item,
  index = 0,
  isDark = true,
  isFollowing,
  onToggleFollow,
  onClick,
  formattedDate
}) => {
  const isUnread = item.is_read === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: index * 0.035 }}
      whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 14 } }}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 transition-colors cursor-pointer select-none active:bg-white/[0.04] ${
        isUnread
          ? isDark ? 'bg-white/[0.04]' : 'bg-zinc-100/80'
          : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-zinc-50'
      }`}
    >
      {/* Left: Avatar with optional sub-badge */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div className="relative shrink-0">
          <motion.img
            initial={{ opacity: 0, scale: 0.88, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22, delay: index * 0.035 + 0.02 }}
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
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#FFFFFF] flex items-center justify-center border-2 ${isDark ? 'border-black' : 'border-white'}`}>
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
            <motion.img
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: index * 0.035 + 0.03 }}
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
