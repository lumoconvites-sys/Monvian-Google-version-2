import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import explore3dImg from '../assets/images/airbnb_explore_3d_1791905342247.jpg';
import itinerary3dImg from '../assets/images/airbnb_itinerary_3d_1791905343756.jpg';
import saved3dImg from '../assets/images/airbnb_saved_3d_1791905342576.jpg';

export type PresentationTab = 'explorar' | 'roteiros' | 'salvos';

const STORAGE_KEY = 'monvian_airbnb_presentation_seen_v1';

export function isPresentationCardSeen(tab: PresentationTab): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed[tab]);
  } catch {
    return false;
  }
}

export function markPresentationCardSeen(tab: PresentationTab): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[tab] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage issues in private modes
  }
}

interface AirbnbPresentationCardProps {
  isOpen: boolean;
  tab: PresentationTab | null;
  onClose: () => void;
  onAction: () => void;
  theme?: 'dark' | 'light';
}

const TAB_DATA: Record<PresentationTab, {
  title: string;
  description: string;
  buttonText: string;
  image: string;
  alt: string;
}> = {
  explorar: {
    title: 'Descubra novos lugares',
    description: 'Encontre atrações e experiências incríveis.',
    buttonText: 'Comece já',
    image: explore3dImg,
    alt: 'Ilustração 3D de exploração e descoberta de novos lugares',
  },
  roteiros: {
    title: 'Planeje sua viagem',
    description: 'Organize seus passeios favoritos.',
    buttonText: 'Ver roteiros',
    image: itinerary3dImg,
    alt: 'Ilustração 3D de planejamento de viagens e roteiros turísticos',
  },
  salvos: {
    title: 'Guarde seus favoritos',
    description: 'Tenha seus lugares preferidos sempre à mão.',
    buttonText: 'Explorar lugares',
    image: saved3dImg,
    alt: 'Ilustração 3D de lista de lugares salvos e favoritos',
  },
};

/**
 * TransparentIllustration
 * Removes the white/off-white background from the generated 3D illustration
 * using a high-performance offscreen Canvas, so the 3D element floats seamlessly
 * without any square bounding box in both dark mode and light mode.
 */
const TransparentIllustration: React.FC<{
  src: string;
  alt: string;
  isDark: boolean;
}> = ({ src, alt, isDark }) => {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      if (isCancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProcessedSrc(src);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Strip off-white background with smooth anti-aliased alpha feathering
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const minChannel = Math.min(r, g, b);

          if (minChannel > 228) {
            // Smoothly feather alpha from 228 to 255
            const factor = (255 - minChannel) / 27; // 1 at 228, 0 at 255
            const alpha = Math.max(0, Math.min(255, factor * 255));
            data[i + 3] = Math.round(alpha);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        if (!isCancelled) {
          setProcessedSrc(dataUrl);
        }
      } catch {
        if (!isCancelled) setProcessedSrc(src);
      }
    };

    img.onerror = () => {
      if (!isCancelled) setProcessedSrc(src);
    };

    return () => {
      isCancelled = true;
    };
  }, [src]);

  return (
    <img
      src={processedSrc || src}
      alt={alt}
      className={`w-full h-full object-contain pointer-events-none select-none transition-opacity duration-300 drop-shadow-md ${
        processedSrc ? 'opacity-100' : 'opacity-90'
      } ${!isDark ? 'mix-blend-multiply' : ''}`}
      referrerPolicy="no-referrer"
      loading="eager"
    />
  );
};

export const AirbnbPresentationCard: React.FC<AirbnbPresentationCardProps> = ({
  isOpen,
  tab,
  onClose,
  onAction,
  theme = 'dark',
}) => {
  if (!isOpen || !tab) return null;

  const currentData = TAB_DATA[tab];
  if (!currentData) return null;

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      <div
        id={`airbnb-presentation-overlay-${tab}`}
        className="fixed inset-0 z-45 flex flex-col justify-end select-none pointer-events-auto"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        }}
      >
        {/* Subtle translucent backdrop over map or tab content (tap to dismiss) */}
        <motion.div
          key="presentation-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-[3px] cursor-pointer"
          aria-hidden="true"
        />

        {/* Presentation Sheet Card with refined iOS spring animation */}
        <motion.div
          key={`presentation-card-${tab}`}
          initial={{ y: '100%', opacity: 0.5, scale: 0.98 }}
          animate={{ y: '0%', opacity: 1, scale: 1 }}
          exit={{ y: '100%', opacity: 0, scale: 0.96 }}
          transition={{
            type: 'spring',
            damping: 30,
            stiffness: 340,
            mass: 0.8,
          }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 300) {
              onClose();
            }
          }}
          className={`relative w-full max-w-lg mx-auto rounded-t-[32px] sm:rounded-t-[38px] overflow-hidden flex flex-col items-center justify-between z-10 transition-colors duration-200 ${
            isDark
              ? 'bg-[#141518] text-white border-t border-white/12 shadow-[0_-18px_60px_rgba(0,0,0,0.7)]'
              : 'bg-white text-zinc-900 border-t border-black/8 shadow-[0_-12px_44px_rgba(0,0,0,0.18)]'
          }`}
          style={{
            touchAction: 'pan-y',
            paddingBottom: 'calc(max(32px, env(safe-area-inset-bottom, 0px)) + 90px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Grab Handle */}
          <div className="w-full pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
            <div
              className={`w-10 h-1.5 rounded-full transition-colors ${
                isDark ? 'bg-white/20' : 'bg-zinc-300'
              }`}
            />
          </div>

          {/* Discreet Close Button in Top Right */}
          <button
            type="button"
            onClick={onClose}
            className={`absolute top-3.5 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/18 text-zinc-300 hover:text-white'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
            }`}
            aria-label="Fechar apresentação"
            title="Fechar"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Card Body */}
          <div className="w-full px-6 pt-1 flex flex-col items-center text-center">
            {/* 3D Illustration without background */}
            <motion.div
              initial={{ scale: 0.86, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{
                type: 'spring',
                damping: 24,
                stiffness: 280,
                delay: 0.06,
              }}
              className="w-48 h-48 sm:w-56 sm:h-56 my-1 flex items-center justify-center relative shrink-0"
            >
              <TransparentIllustration
                src={currentData.image}
                alt={currentData.alt}
                isDark={isDark}
              />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3 }}
              className={`text-2xl sm:text-[27px] font-bold tracking-tight leading-tight mt-1 mb-2 ${
                isDark ? 'text-white' : 'text-zinc-900'
              }`}
            >
              {currentData.title}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.3 }}
              className={`text-sm sm:text-base leading-relaxed max-w-xs sm:max-w-sm font-normal mb-5 ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              {currentData.description}
            </motion.p>

            {/* Action Button: Branco no modo escuro com texto preto / Preto no modo claro com texto branco */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: 'spring',
                damping: 26,
                stiffness: 300,
                delay: 0.2,
              }}
              className="w-full flex justify-center mt-1"
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onAction}
                className={`w-auto min-w-[210px] sm:min-w-[240px] px-8 py-3.5 font-extrabold text-base rounded-2xl transition-all cursor-pointer tracking-tight ${
                  isDark
                    ? 'bg-white text-black hover:bg-zinc-100 shadow-[0_6px_22px_rgba(255,255,255,0.18)] active:bg-zinc-200'
                    : 'bg-black text-white hover:bg-zinc-900 shadow-[0_6px_22px_rgba(0,0,0,0.25)] active:bg-zinc-800'
                }`}
              >
                {currentData.buttonText}
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
