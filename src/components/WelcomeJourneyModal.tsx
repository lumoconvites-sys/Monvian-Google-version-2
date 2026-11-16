import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Users, Star, Bell, X, ArrowRight } from 'lucide-react';
import { triggerHapticFeedback } from '../utils/haptics';

interface WelcomeJourneyModalProps {
  isOpen: boolean;
  onFinish: () => void;
}

export const WelcomeJourneyModal: React.FC<WelcomeJourneyModalProps> = ({
  isOpen,
  onFinish,
}) => {
  if (!isOpen) return null;

  const handleClose = () => {
    triggerHapticFeedback(12);
    try {
      localStorage.setItem('monvian_welcome_completed', 'true');
    } catch {}
    onFinish();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[150] w-full h-full flex flex-col justify-between overflow-y-auto overflow-x-hidden overscroll-y-contain select-none ios-pushed-page"
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
            backgroundColor: 'rgba(235, 239, 244, 0.55)',
            backdropFilter: 'blur(36px) saturate(190%)',
            WebkitBackdropFilter: 'blur(36px) saturate(190%)',
          }}
        >
          {/* Top Bar with Close Button */}
          <div
            className="w-full flex items-center justify-start px-6 pt-6 shrink-0 relative z-20"
            style={{
              paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 24px)',
            }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              type="button"
              className="w-9 h-9 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-xl border border-black/10 dark:border-white/10 flex items-center justify-center text-zinc-900 dark:text-white shadow-sm cursor-pointer transition-transform"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 stroke-[2.4]" />
            </motion.button>
          </div>

          {/* Centralized Content Box */}
          <div className="relative z-20 w-full max-w-md mx-auto px-6 py-4 flex flex-col items-center my-auto">
            {/* Monvian Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: -10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-16 h-16 rounded-[22px] bg-black text-white flex items-center justify-center shadow-lg mb-5 relative overflow-hidden"
            >
              {/* Planetary Ring Icon */}
              <div className="relative w-10 h-10 flex items-center justify-center">
                <div className="absolute w-9 h-9 rounded-full border-2 border-white/80 rotate-[-25deg]" />
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
            </motion.div>

            {/* Title & Subtitle */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="text-center mb-7 space-y-1.5"
            >
              <h1 className="text-[32px] sm:text-[36px] font-black tracking-tight text-zinc-900 dark:text-white flex items-center justify-center gap-2">
                <span>Bem-vindo</span>
                <span className="inline-block">👋</span>
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-[15px] sm:text-[16px] font-medium tracking-tight">
                Que bom ter você por aqui!
              </p>
            </motion.div>

            {/* 4 Features list */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="w-full space-y-3.5"
            >
              {[
                {
                  icon: MapPin,
                  title: 'Explore o mapa',
                  description: 'Descubra os melhores lugares, em tempo real, pelo mapa da cidade.',
                },
                {
                  icon: Users,
                  title: 'Conecte-se',
                  description: 'Veja o que outras pessoas estão fazendo e compartilhe suas experiências.',
                },
                {
                  icon: Star,
                  title: 'Salve seus favoritos',
                  description: 'Monte sua lista de lugares preferidos e não perca nada.',
                },
                {
                  icon: Bell,
                  title: 'Receba novidades',
                  description: 'Fique por dentro de eventos, passeios e muito mais.',
                },
              ].map((feat, idx) => {
                const IconComp = feat.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-3.5 rounded-[24px] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/90 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                  >
                    <div className="w-11 h-11 rounded-[16px] bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0 shadow-xs border border-black/5 dark:border-white/10">
                      <IconComp className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="flex flex-col text-left min-w-0 flex-1">
                      <h3 className="text-[14.5px] font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
                        {feat.title}
                      </h3>
                      <p className="text-[12px] text-zinc-600 dark:text-zinc-400 font-medium tracking-tight leading-relaxed line-clamp-2">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>

          {/* Bottom Button */}
          <div
            className="w-full max-w-md mx-auto px-6 pb-8 pt-4 shrink-0 relative z-20"
            style={{
              paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)',
            }}
          >
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.015 }}
              onClick={handleClose}
              type="button"
              className="w-full h-14 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-[16px] tracking-tight flex items-center justify-center gap-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.22)] cursor-pointer transition-transform"
            >
              <span>Começar</span>
              <ArrowRight className="w-5 h-5 stroke-[2.4]" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
