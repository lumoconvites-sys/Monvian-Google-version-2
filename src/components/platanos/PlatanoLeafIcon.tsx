import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface PlatanoLeafIconProps {
  className?: string;
  size?: number;
  variant?: 'gold' | 'monochrome' | 'light' | 'dark';
}

/**
 * Símbolo minimalista e exclusivo dos Plátanos (Folha de Plátano / Maple da Serra da Mantiqueira)
 * Acabamento geométrico refinado inspirado na linguagem Apple iOS, com dourado discreto.
 */
export const PlatanoLeafIcon: React.FC<PlatanoLeafIconProps> = ({
  className = 'w-4 h-4',
  size,
  variant = 'gold',
}) => {
  const uniqueId = React.useId();
  const gradId = `platano-gold-${uniqueId}`;

  const strokeColor =
    variant === 'gold'
      ? `url(#${gradId})`
      : variant === 'light'
        ? '#FFFFFF'
        : variant === 'dark'
          ? '#18181B'
          : 'currentColor';

  const fillColor =
    variant === 'gold'
      ? `url(#${gradId})`
      : variant === 'light'
        ? 'rgba(255,255,255,0.16)'
        : variant === 'dark'
          ? 'rgba(24,24,27,0.12)'
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
      {variant === 'gold' && (
        <defs>
          <linearGradient id={gradId} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F5D78E" />
            <stop offset="50%" stopColor="#D9A84E" />
            <stop offset="100%" stopColor="#B8862D" />
          </linearGradient>
        </defs>
      )}
      {/* Silhueta orgânica e simétrica de folha de Plátano de Campos do Jordão */}
      <path
        d="M12 2.25L14.35 6.4L18.6 5.2L17.2 9.45L21.25 11.6L17.6 14.3L18.4 17.65L14.25 16.95L12 19.2L9.75 16.95L5.6 17.65L6.4 14.3L2.75 11.6L6.8 9.45L5.4 5.2L9.65 6.4L12 2.25Z"
        fill={fillColor}
        fillOpacity={variant === 'gold' ? 0.22 : 0.14}
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
 * Animação discreta e elegante da folha de Plátano exibida ao desbloquear um roteiro ou creditar moedas.
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
          initial={{ opacity: 0, y: -18, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-4 inset-x-0 z-[360] flex justify-center px-4 pointer-events-none"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-lg max-w-sm w-full ${
              isDark
                ? 'bg-[#141416]/95 border-[#D9A84E]/35 text-white shadow-black/60'
                : 'bg-white/95 border-[#D9A84E]/40 text-zinc-900 shadow-black/10'
            }`}
          >
            <motion.div
              initial={{ rotate: -18, scale: 0.7 }}
              animate={{ rotate: [0, 8, 0], scale: [1, 1.12, 1] }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="w-9 h-9 rounded-full bg-[#D9A84E]/15 border border-[#D9A84E]/35 flex items-center justify-center shrink-0"
            >
              <PlatanoLeafIcon className="w-5 h-5" variant="gold" />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold tracking-tight truncate">{title}</p>
              {subtitle && (
                <p
                  className={`text-[11.5px] font-medium truncate ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
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
