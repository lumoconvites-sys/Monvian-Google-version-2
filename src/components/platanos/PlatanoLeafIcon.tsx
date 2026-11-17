import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PlatanoLeafIconProps {
  className?: string;
  size?: number;
  variant?: 'gold' | 'monochrome' | 'light' | 'dark';
}

export const PLATANO_LEAF_3D_ICON_SRC = '/assets/aistudio/IMG_0028_9f9883a6.png';

/**
 * Símbolo 3D oficial dos Plátanos (Folha de Plátano de Campos do Jordão)
 */
export const PlatanoLeafIcon: React.FC<PlatanoLeafIconProps> = ({
  className = 'w-6 h-6',
  size,
}) => {
  return (
    <img
      src={PLATANO_LEAF_3D_ICON_SRC}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className={`${className} object-contain shrink-0 select-none pointer-events-none inline-block`}
      style={size ? { width: size, height: size } : undefined}
    />
  );
};

/**
 * Notificação minimalista em preto, branco e cinza exibida ao desbloquear um roteiro ou creditar Plátanos.
 */
export const PlatanoUnlockToast: React.FC<{
  visible: boolean;
  title: string;
  subtitle?: string;
  theme?: 'dark' | 'light';
  onDone?: () => void;
}> = ({ visible, title, subtitle, theme = 'dark', onDone }) => {
  const isDark = theme === 'dark';

  React.useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onDone?.();
    }, 2800);
    return () => clearTimeout(timer);
  }, [visible, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-4 inset-x-0 z-[360] flex justify-center px-4 pointer-events-none"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
          }}
        >
          <div
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl max-w-sm w-full ${
              isDark
                ? 'bg-[#111111]/95 border-[#262626] text-[#FFFFFF] shadow-[0_8px_28px_rgba(0,0,0,0.65)]'
                : 'bg-[#FFFFFF]/95 border-[#E5E5EA] text-[#000000] shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-[#000000] border-[#262626] text-[#FFFFFF]'
                  : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#000000]'
              }`}
            >
              <PlatanoLeafIcon className="w-[30px] h-[30px]" variant="monochrome" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tracking-tight truncate">{title}</p>
              {subtitle && (
                <p className="text-[11.5px] font-normal text-[#8E8E93] truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
