import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
          onClick={handleClose}
          className="fixed inset-0 z-[150] w-full h-full flex flex-col justify-between overflow-hidden select-none cursor-pointer ios-pushed-page"
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'var(--app-height, 100dvh)',
            minHeight: 'var(--app-height, 100dvh)',
          }}
        >
          <img
            src="/assets/aistudio/IMG_9933_67c87042.jpeg"
            alt="Bem-vindo ao Monvian"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            draggable={false}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
