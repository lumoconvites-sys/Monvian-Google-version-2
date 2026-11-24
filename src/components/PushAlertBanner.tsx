import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MapPin, Route } from 'lucide-react';
import type { PushAlertItem } from '../services/fcmPushService';

interface PushAlertBannerProps {
  alert: PushAlertItem | null;
  onDismiss: () => void;
  onSelectAlert: (alert: PushAlertItem) => void;
  theme?: 'dark' | 'light' | string;
}

export const PushAlertBanner: React.FC<PushAlertBannerProps> = ({
  alert,
  onDismiss,
  onSelectAlert,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, 6800);
    return () => window.clearTimeout(timer);
  }, [alert, onDismiss]);

  const categoryLabel =
    alert?.type === 'itinerary_update' ? 'Roteiro atualizado' : 'Novo local';

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
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
          className="fixed left-1/2 -translate-x-1/2 z-[195] pointer-events-none flex justify-center w-full px-3"
        >
          <motion.div
            role="button"
            tabIndex={0}
            onClick={() => {
              onSelectAlert(alert);
              onDismiss();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectAlert(alert);
                onDismiss();
              }
            }}
            whileTap={{ scale: 0.975 }}
            transition={{ type: 'spring', stiffness: 460, damping: 28 }}
            style={{
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', sans-serif",
            }}
            className={`w-[calc(100vw-24px)] max-w-[360px] p-3 rounded-[22px] border backdrop-blur-xl flex items-center justify-between gap-3 select-none cursor-pointer pointer-events-auto transition-colors ${
              isDark
                ? 'bg-[#171717]/92 border-white/[0.12] text-white shadow-[0_14px_34px_-6px_rgba(0,0,0,0.65)]'
                : 'bg-white/92 border-black/[0.08] text-black shadow-[0_12px_30px_-6px_rgba(0,0,0,0.16),0_2px_6px_rgba(0,0,0,0.04)]'
            }`}
          >
            <div className="flex-1 min-w-0 flex flex-col justify-center pl-1 py-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.04em] leading-none ${
                    isDark ? 'text-[#858585]' : 'text-[#858585]'
                  }`}
                >
                  Monvian • {categoryLabel}
                </span>
              </div>

              <p
                className={`text-[14px] font-semibold tracking-[-0.02em] leading-[1.25] mt-1 line-clamp-1 ${
                  isDark ? 'text-white' : 'text-black'
                }`}
              >
                {alert.title}
              </p>

              <p
                className={`text-[12.5px] leading-[1.3] mt-0.5 line-clamp-2 ${
                  isDark ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                {alert.body}
              </p>
            </div>

            {alert.imageUrl ? (
              <div
                className={`w-[60px] h-[60px] rounded-[14px] overflow-hidden shrink-0 border ${
                  isDark ? 'bg-[#171717] border-white/[0.08]' : 'bg-[#F2F2F2] border-black/[0.06]'
                }`}
              >
                <img
                  src={alert.imageUrl}
                  alt={alert.title}
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover select-none"
                />
              </div>
            ) : (
              <div
                className={`w-[46px] h-[46px] rounded-[14px] shrink-0 border flex items-center justify-center ${
                  isDark
                    ? 'bg-white/[0.08] border-white/[0.1] text-white'
                    : 'bg-[#F2F2F2] border-black/[0.06] text-black'
                }`}
              >
                {alert.type === 'itinerary_update' ? (
                  <Route className="w-5 h-5 stroke-[1.8]" />
                ) : alert.type === 'new_spot' ? (
                  <MapPin className="w-5 h-5 stroke-[1.8]" />
                ) : (
                  <Bell className="w-5 h-5 stroke-[1.8]" />
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PushAlertBanner;
