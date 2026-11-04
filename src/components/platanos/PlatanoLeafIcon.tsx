import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PlatanoLeafIconProps {
  className?: string;
  size?: number;
  variant?: 'gold' | 'monochrome' | 'light' | 'dark';
}

/**
 * Símbolo minimalista e exclusivo dos Plátanos (Folha de Plátano / Maple da Serra da Mantiqueira)
 * Acabamento geométrico monocromático inspirado na estética nativa do iOS.
 */
export const PlatanoLeafIcon: React.FC<PlatanoLeafIconProps> = ({
  className = 'w-4 h-4',
  size,
  variant = 'monochrome',
}) => {
  const strokeColor =
    variant === 'light'
      ? '#FFFFFF'
      : variant === 'dark'
        ? '#000000'
        : 'currentColor';

  const fillColor =
    variant === 'light'
      ? 'rgba(255,255,255,0.14)'
      : variant === 'dark'
        ? 'rgba(0,0,0,0.12)'
        : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Silhueta orgânica e simétrica de folha de Plátano de Campos do Jordão */}
      <path
        d="M12 2.25L14.35 6.4L18.6 5.2L17.2 9.45L21.25 11.6L17.6 14.3L18.4 17.65L14.25 16.95L12 19.2L9.75 16.95L5.6 17.65L6.4 14.3L2.75 11.6L6.8 9.45L5.4 5.2L9.65 6.4L12 2.25Z"
        fill={fillColor}
        fillOpacity={0.14}
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Nervura central e caule minimalista */}
      <path
        d="M12 7.5V21.75M12 12.5L9.2 10.2M12 12.5L14.8 10.2"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
              className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-[#000000] border-[#262626] text-[#FFFFFF]'
                  : 'bg-[#F5F5F7] border-[#E5E5EA] text-[#000000]'
              }`}
            >
              <PlatanoLeafIcon className="w-4 h-4" variant="monochrome" />
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
