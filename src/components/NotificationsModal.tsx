import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Bell, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Spot } from '../types';
import {
  formatArrivalTitle,
  GeolocationArrivalNotificationItem,
} from '../services/geolocationNotifications';
import { getSpotNotificationImage } from '../utils/spotImages';
import { CompactGeolocationNotificationCard } from './GeolocationNotificationBanner';

export interface SocialNotification {
  id: string;
  recipient_id?: string;
  sender_id?: string;
  sender_name?: string;
  sender_photo?: string;
  type: 'arrival' | 'like' | 'comment' | 'follow' | 'story_view' | 'mention' | string;
  spot_id?: string;
  spot_name?: string;
  title?: string;
  image_url?: string;
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
  spots?: Spot[];
  onSelectSpot?: (spot: Spot) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onBack,
  notifications,
  isLoading,
  theme = 'light',
  onMarkAllAsRead,
  onNotificationClick,
  spots = [],
  onSelectSpot,
}) => {
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const now = Date.now();
  const unread: SocialNotification[] = [];
  const recent: SocialNotification[] = [];

  notifications.forEach((n) => {
    const time = new Date(n.created_at).getTime();
    const diffDays = (now - time) / (1000 * 60 * 60 * 24);

    if (n.is_read === 0) {
      unread.push(n);
    } else if (diffDays <= 30 || !isNaN(diffDays)) {
      recent.push(n);
    }
  });

  const hasUnread = unread.length > 0;

  const handleBack = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (onBack) {
      onBack();
    }
    if (onClose) {
      onClose();
    }
  };

  const toArrivalCardItem = (item: SocialNotification): GeolocationArrivalNotificationItem => {
    const spotId = item.spot_id || item.post_id || item.sender_id || '';
    const matchedSpot = spots.find(
      (s) =>
        s.id.toLowerCase() === spotId.toLowerCase() ||
        (item.spot_name && s.name.toLowerCase() === item.spot_name.toLowerCase())
    );
    const spotName =
      matchedSpot?.shortName ||
      matchedSpot?.name ||
      item.spot_name ||
      item.sender_name ||
      'Parque Capivari';

    const title =
      item.title ||
      (item.type === 'arrival'
        ? formatArrivalTitle(matchedSpot || { id: spotId, name: spotName })
        : item.comment_text || formatArrivalTitle(matchedSpot || { id: spotId, name: spotName }));

    const imageUrl = matchedSpot
      ? getSpotNotificationImage(matchedSpot)
      : getSpotNotificationImage({
          id: spotId,
          name: spotName,
          image: item.image_url || item.post_image || item.sender_photo,
        });

    return {
      id: item.id,
      spotId: matchedSpot?.id || spotId,
      spotName,
      title,
      imageUrl,
      createdAt: item.created_at,
      isRead: item.is_read === 1,
      spot: matchedSpot,
    };
  };

  const handleSelectItem = (item: SocialNotification) => {
    onNotificationClick?.(item);
    const cardItem = toArrivalCardItem(item);
    if (cardItem.spot && onSelectSpot) {
      onSelectSpot(cardItem.spot);
      onClose();
    }
  };

  const modalContent = (
    <motion.div
      id="notifications-fullscreen-view"
      initial={{ opacity: 0, scale: 0.98, y: 10, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.98, y: -8, filter: 'blur(6px)' }}
      transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[150] flex flex-col ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-black'
      } select-none overflow-hidden rounded-none pointer-events-auto`}
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', sans-serif",
        backgroundColor: isDark ? '#000000' : '#ffffff',
        height: '100dvh',
        width: '100vw',
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '0px',
        overflow: 'hidden',
      }}
    >
      {/* Top Header - Apple iOS Large Title Style */}
      <div
        className="shrink-0 w-full relative z-50 pointer-events-auto"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center justify-between pb-3 relative z-50">
          <button
            id="btn-back-notifications"
            type="button"
            onClick={handleBack}
            title="Voltar ao Perfil"
            aria-label="Voltar para o perfil"
            className={`relative z-50 w-11 h-11 rounded-full ${
              isDark
                ? 'bg-white/[0.12] hover:bg-white/[0.20] text-white border-white/15'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200/80'
            } active:scale-90 flex items-center justify-center transition-all cursor-pointer border shadow-sm shrink-0 pointer-events-auto`}
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.6] pointer-events-none" />
          </button>

          <h1
            className={`text-2xl sm:text-3xl font-bold tracking-tight text-center flex-1 mx-2 ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
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
              Limpar
            </button>
          ) : (
            <div className="w-11 h-11 pointer-events-none shrink-0" />
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && notifications.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center pb-14 space-y-3 text-zinc-400 pointer-events-none">
          <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-white' : 'text-zinc-800'}`} />
          <span className="text-xs font-medium">Carregando notificações...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && notifications.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
          className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-16 select-none pointer-events-none"
        >
          <Bell className={`w-11 h-11 stroke-[1.6] mb-5 ${isDark ? 'text-white' : 'text-zinc-900'}`} />
          <h2
            className={`text-lg sm:text-[19px] font-bold tracking-tight mb-2 ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
          >
            Ainda não há notificações
          </h2>
          <p
            className={`text-[14px] sm:text-[15px] leading-relaxed max-w-xs ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            Ao chegar aos pontos turísticos de Campos do Jordão, seus alertas aparecerão aqui.
          </p>
        </motion.div>
      )}

      {/* Compact iOS Geolocation Notifications List */}
      {notifications.length > 0 && (
        <div
          className="flex-1 overflow-y-auto no-scrollbar w-full relative z-10 pt-3 px-4 flex flex-col items-center gap-2.5"
          style={{
            paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 28px), 36px)',
          }}
        >
          {[...unread, ...recent].map((item, idx) => {
            const arrivalItem = toArrivalCardItem(item);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 28,
                  delay: Math.min(idx * 0.04, 0.24),
                }}
                className="w-full flex justify-center"
              >
                <CompactGeolocationNotificationCard
                  notification={arrivalItem}
                  theme={theme}
                  onSelect={() => handleSelectItem(item)}
                />
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
