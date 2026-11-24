import React from 'react';
import { createPortal } from 'react-dom';
import { Bell, Loader2, MapPin, Route } from 'lucide-react';
import { motion } from 'motion/react';
import { AppleBackButton } from './ui/AppleBackButton';
import { IOSSwitch } from './IOSSwitch';
import { Spot } from '../types';
import {
  formatArrivalTitle,
  GeolocationArrivalNotificationItem,
} from '../services/geolocationNotifications';
import { getSpotNotificationImage } from '../utils/spotImages';
import { CompactGeolocationNotificationCard } from './GeolocationNotificationBanner';
import type { PushPreferences } from '../services/fcmPushService';

export interface SocialNotification {
  id: string;
  recipient_id?: string;
  sender_id?: string;
  sender_name?: string;
  sender_photo?: string;
  type: 'arrival' | 'new_spot' | 'itinerary_update' | 'like' | 'comment' | 'follow' | 'story_view' | 'mention' | string;
  spot_id?: string;
  itinerary_id?: string;
  spot_name?: string;
  title?: string;
  body?: string;
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
  onSelectItinerary?: (itineraryId: string) => void;
  pushPreferences?: PushPreferences;
  pushBusy?: boolean;
  pushStatusMessage?: string | null;
  onTogglePushMaster?: (enabled: boolean) => void;
  onTogglePushNewSpots?: (enabled: boolean) => void;
  onTogglePushItineraryUpdates?: (enabled: boolean) => void;
}

function formatRelativeTime(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
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
  onSelectItinerary,
  pushPreferences,
  pushBusy = false,
  pushStatusMessage,
  onTogglePushMaster,
  onTogglePushNewSpots,
  onTogglePushItineraryUpdates,
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
    } else if (diffDays <= 60 || isNaN(diffDays)) {
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

    if (item.type === 'itinerary_update' && item.itinerary_id && onSelectItinerary) {
      onSelectItinerary(item.itinerary_id);
      onClose();
      return;
    }

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
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        width: '100vw',
        borderTopLeftRadius: '0px',
        borderTopRightRadius: '0px',
        overflow: 'hidden',
      }}
    >
      {/* Single scroll container so notification cards scroll underneath sticky blurred header */}
      <div
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar w-full flex flex-col"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 28px), 36px)',
        }}
      >
        {/* Top Header - Apple iOS Large Title Style */}
        <div
          className="sticky top-0 shrink-0 w-full z-50 pointer-events-auto backdrop-blur-xl"
          style={{
            paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)',
            paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.72)',
          }}
        >
          <div className="flex items-center justify-between pb-3 relative z-50">
            <AppleBackButton
              id="btn-back-notifications"
              theme={isDark ? 'dark' : 'light'}
              onClick={handleBack}
              title="Voltar ao Perfil"
              aria-label="Voltar para o perfil"
              className="relative z-50 pointer-events-auto"
            />

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
                className={`text-xs font-bold transition-all active:scale-95 cursor-pointer px-3 py-1 rounded-full border border-black/5 shrink-0 ${
                  isDark ? 'text-zinc-300 hover:text-white bg-white/10' : 'expo-liquid-glass-btn text-black hover:bg-zinc-50 shadow-xs'
                }`}
              >
                Limpar
              </button>
            ) : (
              <div className="w-11 h-11 pointer-events-none shrink-0" />
            )}
          </div>
        </div>

        {/* Minimalist Push Notifications Opt-In & Topic Strip */}
        {pushPreferences && onTogglePushMaster && (
          <div className="w-full max-w-[388px] mx-auto px-4 pt-3 pb-1">
            <div
              className={`rounded-[22px] border overflow-hidden ${
                isDark
                  ? 'bg-[#171717] border-white/[0.09] divide-y divide-white/[0.08]'
                  : 'bg-[#F7F7F7] border-black/[0.06] divide-y divide-black/[0.06]'
              }`}
            >
              <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[14.5px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
                    Alertas Push
                  </p>
                  <p className={`text-[12px] mt-0.5 ${isDark ? 'text-[#858585]' : 'text-[#858585]'}`}>
                    Novos locais e atualizações em roteiros
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {pushBusy && (
                    <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
                  )}
                  <IOSSwitch
                    checked={pushPreferences.enabled}
                    onChange={onTogglePushMaster}
                    disabled={pushBusy}
                    ariaLabel="Ativar notificações push"
                  />
                </div>
              </div>

              {pushPreferences.enabled && onTogglePushNewSpots && onTogglePushItineraryUpdates && (
                <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onTogglePushNewSpots(!pushPreferences.newSpots)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95 cursor-pointer border ${
                        pushPreferences.newSpots
                          ? isDark
                            ? 'bg-white text-black border-white'
                            : 'bg-black text-white border-black'
                          : isDark
                            ? 'bg-transparent text-[#858585] border-white/15'
                            : 'bg-white text-[#858585] border-black/10'
                      }`}
                    >
                      Novos locais
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePushItineraryUpdates(!pushPreferences.itineraryUpdates)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95 cursor-pointer border ${
                        pushPreferences.itineraryUpdates
                          ? isDark
                            ? 'bg-white text-black border-white'
                            : 'bg-black text-white border-black'
                          : isDark
                            ? 'bg-transparent text-[#858585] border-white/15'
                            : 'bg-white text-[#858585] border-black/10'
                      }`}
                    >
                      Roteiros
                    </button>
                  </div>
                </div>
              )}
            </div>

            {pushStatusMessage && (
              <p className={`text-[11.5px] px-2 pt-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {pushStatusMessage}
              </p>
            )}
          </div>
        )}

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
              Alertas sobre novos locais e atualizações em roteiros de Campos do Jordão aparecerão aqui.
            </p>
          </motion.div>
        )}

        {/* Notifications List */}
        {notifications.length > 0 && (
          <div className="w-full relative z-10 pt-3 px-4 flex flex-col items-center gap-2.5">
            {[...unread, ...recent].map((item, idx) => {
              const isPushAlert = item.type === 'new_spot' || item.type === 'itinerary_update';

              if (isPushAlert) {
                const isItinerary = item.type === 'itinerary_update';
                const relativeTime = formatRelativeTime(item.created_at);
                const isUnreadItem = item.is_read === 0;

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
                    <motion.div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectItem(item);
                        }
                      }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-[calc(100vw-24px)] max-w-[356px] p-3 rounded-[22px] border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isDark
                          ? 'bg-[#171717] border-white/[0.1] hover:bg-[#1E1E20] text-white'
                          : 'bg-white border-black/[0.07] hover:bg-[#F7F7F7] text-black shadow-[0_6px_20px_-6px_rgba(0,0,0,0.08)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex flex-col justify-center pl-1">
                        <div className="flex items-center gap-1.5">
                          {isUnreadItem && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isDark ? 'bg-white' : 'bg-black'
                              }`}
                            />
                          )}
                          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#858585]">
                            {isItinerary ? 'Roteiro atualizado' : 'Novo local'}
                          </span>
                          {relativeTime && (
                            <span className="text-[11px] text-[#858585]">• {relativeTime}</span>
                          )}
                        </div>

                        <p
                          className={`text-[14.5px] font-semibold tracking-[-0.02em] leading-[1.25] mt-1 line-clamp-1 ${
                            isDark ? 'text-white' : 'text-black'
                          }`}
                        >
                          {item.title || (isItinerary ? 'Roteiro atualizado' : 'Novo local em Campos')}
                        </p>

                        {(item.body || item.comment_text) && (
                          <p
                            className={`text-[12.5px] leading-[1.32] mt-0.5 line-clamp-2 ${
                              isDark ? 'text-zinc-400' : 'text-zinc-600'
                            }`}
                          >
                            {item.body || item.comment_text}
                          </p>
                        )}
                      </div>

                      {item.image_url ? (
                        <div
                          className={`w-[64px] h-[64px] rounded-[15px] overflow-hidden shrink-0 border ${
                            isDark ? 'bg-zinc-900 border-white/[0.08]' : 'bg-[#F2F2F2] border-black/[0.06]'
                          }`}
                        >
                          <img
                            src={item.image_url}
                            alt={item.title || 'Monvian'}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-[48px] h-[48px] rounded-[15px] shrink-0 border flex items-center justify-center ${
                            isDark
                              ? 'bg-white/[0.06] border-white/[0.08] text-white'
                              : 'bg-[#F2F2F2] border-black/[0.05] text-black'
                          }`}
                        >
                          {isItinerary ? (
                            <Route className="w-5 h-5 stroke-[1.8]" />
                          ) : (
                            <MapPin className="w-5 h-5 stroke-[1.8]" />
                          )}
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                );
              }

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
      </div>
    </motion.div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
