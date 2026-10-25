import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GeolocationArrivalNotificationItem } from '../services/geolocationNotifications';
import { getSpotFallbackImage, getSpotNotificationImage } from '../utils/spotImages';

interface CompactGeolocationNotificationCardProps {
  notification: GeolocationArrivalNotificationItem;
  onSelect: (notification: GeolocationArrivalNotificationItem) => void;
  theme?: 'dark' | 'light' | string;
  className?: string;
}

export const CompactGeolocationNotificationCard: React.FC<CompactGeolocationNotificationCardProps> = ({
  notification,
  onSelect,
  theme = 'light',
  className = '',
}) => {
  const isDark = theme === 'dark';
  const [imgSrc, setImgSrc] = useState<string>(() =>
    notification.spot
      ? getSpotNotificationImage(notification.spot)
      : getSpotNotificationImage({
          id: notification.spotId,
          name: notification.spotName,
          image: notification.imageUrl,
        })
  );

  useEffect(() => {
    const resolved = notification.spot
      ? getSpotNotificationImage(notification.spot)
      : getSpotNotificationImage({
          id: notification.spotId,
          name: notification.spotName,
          image: notification.imageUrl,
        });
    setImgSrc(resolved);
  }, [notification]);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(notification)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(notification);
        }
      }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 460, damping: 28 }}
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', sans-serif",
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        backdropFilter: 'blur(22px) saturate(180%)',
      }}
      className={`w-[calc(100vw-24px)] max-w-[340px] p-2.5 rounded-[22px] border flex items-center justify-between gap-3 select-none cursor-pointer pointer-events-auto transition-colors ${
        isDark
          ? 'bg-[#1C1C1E]/88 border-white/[0.11] text-white shadow-[0_12px_32px_-6px_rgba(0,0,0,0.55)]'
          : 'bg-white/86 border-black/[0.07] text-zinc-950 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.04)]'
      } ${className}`}
    >
      {/* Left: Monvians + Small Location Indicator + Short Arrival Title */}
      <div className="flex-1 min-w-0 flex flex-col justify-center pl-1.5 py-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-[12px] font-semibold tracking-[-0.01em] leading-none ${
              isDark ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          >
            Monvians
          </span>
          {/* Subtle iOS Location Indicator Arrow */}
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="w-2.5 h-2.5 text-[#007AFF] dark:text-[#0A84FF] fill-current shrink-0"
          >
            <path d="M14.68 1.32a.62.62 0 0 0-.65-.14L1.65 6.13a.63.63 0 0 0 .04 1.18l5.26 1.48 1.48 5.26a.63.63 0 0 0 .59.46h.02a.63.63 0 0 0 .58-.39l4.95-12.38a.62.62 0 0 0-.14-.65Z" />
          </svg>
        </div>

        <p
          className={`text-[14.5px] max-[350px]:text-[13.5px] font-semibold tracking-[-0.02em] leading-[1.24] mt-1.5 break-words line-clamp-2 ${
            isDark ? 'text-white' : 'text-zinc-950'
          }`}
        >
          {notification.title}
        </p>
      </div>

      {/* Right: Real Spot Photograph (76x76px rounded square) */}
      <div
        className={`w-[76px] h-[76px] max-[350px]:w-[68px] max-[350px]:h-[68px] rounded-[15px] overflow-hidden shrink-0 border ${
          isDark ? 'bg-zinc-800 border-white/[0.08]' : 'bg-zinc-100 border-black/[0.06]'
        }`}
      >
        <img
          src={imgSrc}
          alt={notification.spotName}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          referrerPolicy="no-referrer"
          onError={() => {
            const fallback = getSpotFallbackImage(
              notification.spotName,
              notification.spot?.category || 'attractions'
            );
            if (imgSrc !== fallback) {
              setImgSrc(fallback);
            }
          }}
          className="w-full h-full object-cover select-none"
        />
      </div>
    </motion.div>
  );
};

interface GeolocationNotificationBannerProps {
  notification: GeolocationArrivalNotificationItem | null;
  onDismiss: () => void;
  onOpenSpot: (notification: GeolocationArrivalNotificationItem) => void;
  theme?: 'dark' | 'light' | string;
}

export const GeolocationNotificationBanner: React.FC<GeolocationNotificationBannerProps> = ({
  notification,
  onDismiss,
  onOpenSpot,
  theme = 'light',
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [notification, onDismiss]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.id}
          initial={{ opacity: 0, y: -28, scale: 0.96, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -24, scale: 0.96, filter: 'blur(4px)' }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 30,
            mass: 0.85,
          }}
          drag="y"
          dragConstraints={{ top: -80, bottom: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.y < -18 || info.velocity.y < -180) {
              onDismiss();
            }
          }}
          style={{
            top: 'max(calc(env(safe-area-inset-top, 0px) + 10px), 14px)',
          }}
          className="fixed left-1/2 -translate-x-1/2 z-[190] pointer-events-none flex justify-center w-full px-3"
        >
          <CompactGeolocationNotificationCard
            notification={notification}
            theme={theme}
            onSelect={(item) => {
              onOpenSpot(item);
              onDismiss();
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GeolocationNotificationBanner;
