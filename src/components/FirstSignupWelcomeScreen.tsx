import React, { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface FirstSignupWelcomeScreenProps {
  onComplete: () => void;
  theme?: 'dark' | 'light';
}

const PinFeatureIcon: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-[27px] h-[27px] ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2.25C7.71979 2.25 4.25 5.66323 4.25 9.8739C4.25 14.9562 10.2756 20.6929 11.4979 21.797C11.7844 22.0558 12.2156 22.0558 12.5021 21.797C13.7244 20.6929 19.75 14.9562 19.75 9.8739C19.75 5.66323 16.2802 2.25 12 2.25ZM12 12.8C13.6569 12.8 15 11.4569 15 9.8C15 8.14315 13.6569 6.8 12 6.8C10.3431 6.8 9 8.14315 9 9.8C9 11.4569 10.3431 12.8 12 12.8Z"
      fill="currentColor"
    />
  </svg>
);

const CommunityFeatureIcon: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <svg
    viewBox="0 0 28 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-[29px] h-[25px] ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}
    aria-hidden="true"
  >
    {/* Center primary person */}
    <circle cx="14" cy="7.2" r="3.45" fill="currentColor" />
    <path
      d="M8.3 18.7C8.3 15.35 10.82 12.8 14 12.8C17.18 12.8 19.7 15.35 19.7 18.7C19.7 19.52 19.04 20.15 18.22 20.15H9.78C8.96 20.15 8.3 19.52 8.3 18.7Z"
      fill="currentColor"
    />
    {/* Left person */}
    <circle cx="6.2" cy="9.4" r="2.45" fill="currentColor" />
    <path
      d="M1.8 18.35C1.8 15.85 3.62 13.95 6.05 13.95C6.88 13.95 7.64 14.17 8.28 14.55C7.35 15.62 6.8 17.02 6.8 18.55V19.65H3.15C2.4 19.65 1.8 19.07 1.8 18.35Z"
      fill="currentColor"
    />
    {/* Right person */}
    <circle cx="21.8" cy="9.4" r="2.45" fill="currentColor" />
    <path
      d="M26.2 18.35C26.2 15.85 24.38 13.95 21.95 13.95C21.12 13.95 20.36 14.17 19.72 14.55C20.65 15.62 21.2 17.02 21.2 18.55V19.65H24.85C25.6 19.65 26.2 19.07 26.2 18.35Z"
      fill="currentColor"
    />
  </svg>
);

const StarFeatureIcon: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-[27px] h-[27px] ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}
    aria-hidden="true"
  >
    <path
      d="M11.1213 3.12439C11.4847 2.38793 12.5349 2.38793 12.8983 3.12439L14.9502 7.28219C15.0945 7.57463 15.3735 7.77733 15.6962 7.82422L20.2845 8.49093C21.0972 8.60903 21.4217 9.60779 20.8336 10.181L17.5135 13.4173C17.28 13.6449 17.1734 13.9729 17.2285 14.2943L18.0123 18.864C18.1511 19.6735 17.3014 20.2908 16.5745 19.9086L12.4709 17.7511C12.1822 17.5994 11.8374 17.5994 11.5487 17.7511L7.44507 19.9086C6.71819 20.2908 5.86851 19.6735 6.00733 18.864L6.7911 14.2943C6.84623 13.9729 6.73965 13.6449 6.50615 13.4173L3.18602 10.181C2.59792 9.60779 2.92243 8.60903 3.73514 8.49093L8.3234 7.82422C8.64613 7.77733 8.92511 7.57463 9.06944 7.28219L11.1213 3.12439Z"
      fill="currentColor"
    />
  </svg>
);

const BellFeatureIcon: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-[26px] h-[26px] ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}
    aria-hidden="true"
  >
    <path
      d="M12 2.75C12.6904 2.75 13.25 3.30964 13.25 4V4.41487C16.245 4.98301 18.5 7.61439 18.5 10.773V14.3247L20.119 16.7532C20.5317 17.3722 20.0879 18.2 19.344 18.2H4.65599C3.91206 18.2 3.4683 17.3722 3.88101 16.7532L5.5 14.3247V10.773C5.5 7.61439 7.75498 4.98301 10.75 4.41487V4C10.75 3.30964 11.3096 2.75 12 2.75Z"
      fill="currentColor"
    />
    <path
      d="M9.55 19.45C9.89 20.58 10.86 21.35 12 21.35C13.14 21.35 14.11 20.58 14.45 19.45H9.55Z"
      fill="currentColor"
    />
  </svg>
);

const MinimalWavingHandIcon: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] shrink-0 ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}
    aria-hidden="true"
  >
    {/* Minimalist motion arcs top-left & bottom-left */}
    <path
      d="M7.2 7.8C5.9 9.5 5.2 11.4 5 13.4"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="M4.2 10.2C3.5 11.4 3.2 12.6 3.1 13.8"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
    />
    <path
      d="M7.4 25.5C8.5 27.2 10 28.5 11.8 29.4"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <path
      d="M5.1 26.8C6.0 28.2 7.2 29.4 8.6 30.2"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
    />
    {/* Solid minimalist hand silhouette */}
    <path
      d="M13.3 8.15C14.15 7.42 15.42 7.52 16.15 8.37L19.95 12.8C20.28 13.18 20.89 12.88 20.78 12.39L18.42 6.82C17.98 5.79 18.46 4.6 19.49 4.16C20.52 3.72 21.71 4.2 22.15 5.23L24.95 11.85C25.13 12.27 25.75 12.14 25.75 11.68V5.95C25.75 4.83 26.66 3.92 27.78 3.92C28.9 3.92 29.81 4.83 29.81 5.95V13.85C29.81 14.32 30.44 14.47 30.65 14.05L31.42 12.48C31.92 11.47 33.15 11.06 34.16 11.56C35.17 12.06 35.58 13.29 35.08 14.3L31.88 21.95C30.45 25.38 27.1 27.6 23.38 27.6C19.86 27.6 16.56 25.77 14.72 22.76L9.92 14.95C9.32 13.97 9.62 12.69 10.6 12.09C11.43 11.58 12.51 11.75 13.16 12.46L15.1 14.62C15.42 14.97 15.99 14.69 15.89 14.23L13.08 10.1C12.56 9.33 12.66 8.69 13.3 8.15Z"
      fill="currentColor"
      transform="translate(-1.5, 1.5) scale(0.92)"
    />
  </svg>
);

export const FirstSignupWelcomeScreen: React.FC<FirstSignupWelcomeScreenProps> = ({
  onComplete,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const { tr } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [isClosing, setIsClosing] = useState(false);

  const handleDismiss = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
    onComplete();
  }, [isClosing, onComplete]);

  const features = [
    {
      id: 'explore-map',
      icon: <PinFeatureIcon isDark={isDark} />,
      title: tr('Explore o mapa'),
      description: tr('Descubra os melhores lugares em tempo real, pelo mapa da cidade.'),
    },
    {
      id: 'connect',
      icon: <CommunityFeatureIcon isDark={isDark} />,
      title: tr('Conecte-se'),
      description: tr('Veja o que outras pessoas estão fazendo e compartilhe suas experiências.'),
    },
    {
      id: 'save-favorites',
      icon: <StarFeatureIcon isDark={isDark} />,
      title: tr('Salve seus favoritos'),
      description: tr('Monte sua lista de lugares preferidos e não perca nada.'),
    },
    {
      id: 'updates',
      icon: <BellFeatureIcon isDark={isDark} />,
      title: tr('Receba novidades'),
      description: tr('Fique por dentro de eventos, passeios e muito mais.'),
    },
  ];

  const baseEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
  const iosSpring = { type: 'spring' as const, damping: 26, stiffness: 260, mass: 0.9 };

  return (
    <motion.div
      id="monvian-first-signup-welcome"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-welcome-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0, transition: { duration: 0.16 } }
          : {
              opacity: 0,
              scale: 1.03,
              filter: 'blur(10px)',
              transition: { duration: 0.38, ease: baseEase },
            }
      }
      transition={{ duration: prefersReducedMotion ? 0.18 : 0.48, ease: baseEase }}
      className="fixed inset-0 z-[260] w-full select-none overflow-hidden"
      style={{
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Translucent iOS 26 Liquid Glass Fullscreen Layer over live Monvian Map */}
      <motion.div
        aria-hidden="true"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.18 : 0.65, ease: baseEase }}
        className="absolute inset-0 pointer-events-none"
        style={{
          backdropFilter: 'blur(22px) saturate(145%)',
          WebkitBackdropFilter: 'blur(22px) saturate(145%)',
          background: isDark
            ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.52) 0%, rgba(12, 12, 14, 0.72) 48%, rgba(0, 0, 0, 0.84) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.30) 0%, rgba(255, 255, 255, 0.42) 48%, rgba(246, 248, 252, 0.54) 100%)',
        }}
      />

      {/* Subtle specular ambient sheen for Liquid Glass depth */}
      <motion.div
        aria-hidden="true"
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.18 : 0.85, ease: baseEase }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 92% 48% at 50% 24%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 75%)'
            : 'radial-gradient(ellipse 92% 48% at 50% 24%, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 75%)',
        }}
      />

      {/* Main Scroll-Safe Vertical Container Respecting Safe Areas */}
      <div
        className="relative z-10 w-full h-full overflow-y-auto overscroll-y-contain no-scrollbar"
        style={{
          paddingTop: 'max(28px, calc(env(safe-area-inset-top, 0px) + 22px))',
          paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 18px))',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="min-h-full w-full max-w-[392px] mx-auto flex flex-col justify-between gap-6 py-2">
          {/* Center Composition: Logo lowered directly above Bem-vindo + 4 Feature Highlights */}
          <div className="flex flex-col items-center my-auto w-full pt-4 sm:pt-6">
            {/* Monvian Script Logo positioned cleanly just above Bem-vindo */}
            <motion.div
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -22, scale: 0.88, filter: 'blur(8px)' }
              }
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.16 }
                  : { ...iosSpring, delay: 0.10 }
              }
              className="flex justify-center mb-5 sm:mb-6 shrink-0"
            >
              <img
                src="/assets/aistudio/monvian_logo_white_transparent.png"
                alt="Monvian"
                draggable={false}
                className="h-[46px] sm:h-[52px] w-auto object-contain select-none pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.16)]"
              />
            </motion.div>

            {/* Hero Greeting + Hand Wave */}
            <div className="text-center w-full mb-7 sm:mb-9">
              <motion.h1
                id="first-welcome-title"
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 18, scale: 0.96, filter: 'blur(4px)' }
                }
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.16 }
                    : { ...iosSpring, delay: 0.22 }
                }
                className={`inline-flex items-center justify-center gap-2.5 text-[35px] sm:text-[41px] font-bold tracking-[-0.025em] leading-[1.08] ${
                  isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                }`}
              >
                <span>{tr('Bem-vindo')}</span>
                <motion.span
                  initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.6, rotate: -18 }}
                  animate={
                    prefersReducedMotion
                      ? { scale: 1, rotate: 0 }
                      : { scale: 1, rotate: [0, -14, 12, -8, 4, 0] }
                  }
                  transition={
                    prefersReducedMotion
                      ? { duration: 0.15 }
                      : {
                          scale: { ...iosSpring, delay: 0.28 },
                          rotate: { duration: 0.85, delay: 0.42, ease: baseEase },
                        }
                  }
                  style={{ transformOrigin: '75% 80%', display: 'inline-flex' }}
                >
                  <MinimalWavingHandIcon isDark={isDark} />
                </motion.span>
              </motion.h1>

              <motion.p
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 12, filter: 'blur(3px)' }
                }
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{
                  duration: prefersReducedMotion ? 0.15 : 0.48,
                  delay: prefersReducedMotion ? 0 : 0.30,
                  ease: baseEase,
                }}
                className={`mt-1.5 text-[17.5px] sm:text-[19px] font-normal tracking-[-0.012em] leading-[1.3] ${
                  isDark ? 'text-[#A1A1AA]' : 'text-[#1D1D1F]/85'
                }`}
                style={{
                  fontFamily:
                    "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {tr('Que bom ter você por aqui!')}
              </motion.p>
            </div>

            {/* 4 Liquid Glass Icon Rows with Staggered Spring Reveal */}
            <ul className="w-full max-w-[356px] space-y-5 sm:space-y-6">
              {features.map((item, idx) => {
                const rowDelay = prefersReducedMotion ? 0 : 0.36 + idx * 0.085;
                return (
                  <motion.li
                    key={item.id}
                    initial={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: -10, y: 16 }
                    }
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.15 }
                        : { ...iosSpring, delay: rowDelay }
                    }
                    className="flex items-center gap-4 text-left"
                  >
                    {/* Liquid Glass Squircle Tile */}
                    <motion.div
                      initial={
                        prefersReducedMotion
                          ? { opacity: 1 }
                          : { scale: 0.72, rotate: -6 }
                      }
                      animate={{ scale: 1, rotate: 0 }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0.15 }
                          : {
                              type: 'spring',
                              damping: 20,
                              stiffness: 300,
                              mass: 0.8,
                              delay: rowDelay + 0.03,
                            }
                      }
                      className="relative w-[62px] h-[62px] sm:w-[66px] sm:h-[66px] rounded-[20px] shrink-0 flex items-center justify-center overflow-hidden"
                      style={{
                        background: isDark
                          ? 'linear-gradient(145deg, rgba(44, 44, 46, 0.78) 0%, rgba(28, 28, 30, 0.68) 100%)'
                          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.56) 0%, rgba(255, 255, 255, 0.24) 55%, rgba(255, 255, 255, 0.40) 100%)',
                        backdropFilter: 'blur(20px) saturate(175%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(175%)',
                        border: isDark
                          ? '1px solid rgba(255, 255, 255, 0.16)'
                          : '1px solid rgba(255, 255, 255, 0.72)',
                        boxShadow: isDark
                          ? '0 10px 24px rgba(0, 0, 0, 0.42), inset 0 1px 1px rgba(255, 255, 255, 0.20)'
                          : '0 10px 24px rgba(0, 0, 0, 0.08), inset 0 1.5px 1.5px rgba(255, 255, 255, 0.92), inset 0 -1.5px 2px rgba(255, 255, 255, 0.34)',
                      }}
                    >
                      {/* Top specular curved glint */}
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 top-[1px] h-[1.5px] rounded-full pointer-events-none"
                        style={{
                          background: isDark
                            ? 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.34) 50%, rgba(255,255,255,0) 100%)'
                            : 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0) 100%)',
                        }}
                      />
                      <div className="relative z-10 flex items-center justify-center">
                        {item.icon}
                      </div>
                    </motion.div>

                    {/* Feature Copy */}
                    <div className="flex-1 min-w-0">
                      <h2
                        className={`text-[16.5px] sm:text-[17.5px] font-bold tracking-[-0.015em] leading-[1.2] ${
                          isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                        }`}
                      >
                        {item.title}
                      </h2>
                      <p
                        className={`mt-0.5 text-[13.5px] sm:text-[14.5px] font-normal leading-[1.35] ${
                          isDark ? 'text-[#A1A1AA]' : 'text-[#1C1F24]/82'
                        }`}
                        style={{
                          fontFamily:
                            "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                        }}
                      >
                        {item.description}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>

          {/* Primary Bottom Dark Liquid Glass Pill CTA with Gentle Pulse */}
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 26, scale: 0.95 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.16 }
                : { ...iosSpring, delay: 0.55 }
            }
            className="relative w-full max-w-[356px] mx-auto pt-2 pb-1 shrink-0"
          >
            {/* Subtle ambient outer halo pulse (restrained adult iOS breathing) */}
            {!prefersReducedMotion && !isClosing && (
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: [0.10, 0.28, 0.10],
                  scale: [0.995, 1.028, 0.995],
                }}
                transition={{
                  duration: 2.35,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.9,
                }}
                className="pointer-events-none absolute inset-x-0 top-2 bottom-1 rounded-full"
                style={{
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(0, 0, 0, 0.20)',
                  boxShadow: isDark ? '0 0 22px rgba(255, 255, 255, 0.16)' : '0 0 22px rgba(0, 0, 0, 0.14)',
                }}
              />
            )}

            <motion.button
              id="btn-first-welcome-start"
              type="button"
              onClick={handleDismiss}
              disabled={isClosing}
              animate={
                prefersReducedMotion || isClosing
                  ? { scale: 1 }
                  : {
                      scale: [1, 1.022, 1],
                    }
              }
              transition={
                prefersReducedMotion || isClosing
                  ? { duration: 0.15 }
                  : {
                      duration: 2.35,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.9,
                    }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              className={`relative w-full h-[56px] sm:h-[60px] rounded-full flex items-center justify-center gap-2.5 text-[#FFFFFF] text-[17.5px] sm:text-[18.5px] font-semibold tracking-[-0.012em] cursor-pointer overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isDark ? 'focus-visible:outline-[#FFFFFF]' : 'focus-visible:outline-[#000000]'
              }`}
              style={{
                background: isDark
                  ? 'linear-gradient(180deg, rgba(44, 44, 46, 0.92) 0%, rgba(28, 28, 30, 0.96) 54%, rgba(36, 36, 40, 0.94) 100%)'
                  : 'linear-gradient(180deg, rgba(36, 36, 40, 0.94) 0%, rgba(10, 10, 12, 0.98) 54%, rgba(22, 22, 26, 0.96) 100%)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.30)' : '1px solid rgba(255, 255, 255, 0.22)',
                boxShadow:
                  '0 14px 32px rgba(0, 0, 0, 0.24), 0 4px 12px rgba(0, 0, 0, 0.14), inset 0 1.5px 1.5px rgba(255, 255, 255, 0.36), inset 0 -1.5px 2px rgba(255, 255, 255, 0.10)',
                willChange: 'transform',
              }}
            >
              {/* Top Liquid Glass Rim Reflection */}
              <span
                aria-hidden="true"
                className="absolute inset-x-6 top-[1px] h-[1.5px] rounded-full pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.48) 50%, rgba(255,255,255,0) 100%)',
                }}
              />
              <span className="relative z-10">{tr('Começar')}</span>
              <ArrowRight className="relative z-10 w-[19px] h-[19px] stroke-[2.2]" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

