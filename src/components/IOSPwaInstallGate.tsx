import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Mandatory iOS PWA Installation Gate for Monvian.
 *
 * Shown automatically after signup/onboarding (and whenever an authenticated user
 * opens Monvian in iOS Safari outside standalone PWA mode).
 *
 * Design rules:
 * - Minimalist pure white background (#FFFFFF) — no photos, castles, or background images.
 * - Original Monvian logo & native iOS SF Pro typography.
 * - Subtle Liquid Glass translucent cards with updated iOS Safari UI illustrations.
 * - Zero manual bypass, continue, or confirmation buttons (unlocks strictly via real standalone detection).
 */
export const IOSPwaInstallGate: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  // Immediately hide any boot preloader and harmonize iOS Safari status bar / background chrome
  useEffect(() => {
    try {
      const hidePreloader = (window as unknown as { __monvianHidePreloaderImmediately?: () => void })
        .__monvianHidePreloaderImmediately;
      if (typeof hidePreloader === 'function') {
        hidePreloader();
      } else {
        const preloader = document.getElementById('monvian-app-preloader');
        if (preloader) {
          preloader.style.display = 'none';
          preloader.style.opacity = '0';
          preloader.style.pointerEvents = 'none';
        }
      }
    } catch {}

    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevThemeColor = themeColorMeta?.getAttribute('content') || null;

    try {
      document.body.style.backgroundColor = '#ffffff';
      document.documentElement.style.backgroundColor = '#ffffff';
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', '#ffffff');
      }
      window.scrollTo(0, 0);
    } catch {}

    return () => {
      try {
        document.body.style.backgroundColor = prevBodyBg;
        document.documentElement.style.backgroundColor = prevHtmlBg;
        if (themeColorMeta && prevThemeColor) {
          themeColorMeta.setAttribute('content', prevThemeColor);
        }
      } catch {}
    };
  }, []);

  const cardMotion = (delay: number) =>
    prefersReducedMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.18 } }
      : {
          initial: { opacity: 0, y: 14, scale: 0.985 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div
      id="monvian-ios-pwa-install-gate"
      data-testid="ios-pwa-install-gate"
      role="main"
      aria-labelledby="monvian-pwa-gate-title"
      className="fixed inset-0 z-[220] w-full bg-[#FFFFFF] text-[#000000] overflow-y-auto overscroll-contain select-none"
      style={{
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 28px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 20px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 20px)',
      }}
    >
      <div className="min-h-full w-full max-w-[402px] mx-auto flex flex-col items-center justify-center py-4">
        {/* Header: Original Monvian Logo + Title + Subtitle */}
        <motion.header
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.16 : 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex flex-col items-center text-center mb-7"
        >
          <img
            src="/assets/aistudio/monvian_logo_dark_transparent.png"
            alt="Monvian"
            draggable={false}
            className="w-[188px] sm:w-[204px] h-auto object-contain mb-5 pointer-events-none"
          />

          <h1
            id="monvian-pwa-gate-title"
            className="text-[28px] sm:text-[31px] font-bold text-[#000000] leading-[1.12] tracking-[-0.03em] max-w-[320px]"
          >
            Adicione o Monvian
            <br />
            à Tela de Início
          </h1>

          <p className="mt-3 text-[15px] sm:text-[15.5px] font-normal text-[#636366] leading-[1.38] tracking-[-0.01em] max-w-[300px]">
            Instale nosso aplicativo para continuar e aproveitar sua experiência.
          </p>
        </motion.header>

        {/* 3-Step iOS Safari Tutorial Cards (Subtle Liquid Glass on Pure White) */}
        <ol className="w-full flex flex-col gap-[14px] list-none p-0 m-0">
          {/* STEP 1 */}
          <motion.li
            {...cardMotion(0.06)}
            className="w-full rounded-[28px] px-[18px] pt-[18px] pb-[16px] border border-black/[0.065]"
            style={{
              backgroundColor: 'rgba(246, 247, 249, 0.78)',
              backdropFilter: 'blur(26px) saturate(160%)',
              WebkitBackdropFilter: 'blur(26px) saturate(160%)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 10px 28px rgba(0, 0, 0, 0.045), 0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div className="flex items-start gap-[14px]">
              <span
                aria-hidden="true"
                className="w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center text-[17px] font-semibold text-[#000000] bg-[#E8EAEF] mt-[1px]"
              >
                1
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold text-[#000000] leading-[1.2] tracking-[-0.02em]">
                  Toque no botão Compartilhar
                </h2>
                <p className="mt-1 text-[13.5px] font-normal text-[#6E6E73] leading-[1.35] tracking-[-0.005em]">
                  Na barra inferior do Safari, toque no ícone de compartilhamento.
                </p>
              </div>
            </div>

            {/* Updated iOS Safari Bottom Bar Illustration */}
            <div
              aria-hidden="true"
              className="mt-4 h-[52px] w-full rounded-full px-3 flex items-center justify-between border border-black/[0.06]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.88)',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 1), 0 4px 14px rgba(0, 0, 0, 0.04)',
              }}
            >
              {/* Back */}
              <div className="w-10 h-10 flex items-center justify-center text-[#007AFF]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </div>

              {/* Forward (disabled) */}
              <div className="w-10 h-10 flex items-center justify-center text-[#C7C7CC]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>

              {/* Highlighted Share Icon */}
              <div
                className="w-[46px] h-[46px] rounded-full bg-[#FFFFFF] border border-black/[0.06] flex items-center justify-center text-[#007AFF] shrink-0"
                style={{
                  boxShadow:
                    '0 6px 16px rgba(0, 0, 0, 0.10), 0 1px 3px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 1)',
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" />
                  <path d="M8 7l4-4 4 4" />
                  <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                </svg>
              </div>

              {/* Bookmarks */}
              <div className="w-10 h-10 flex items-center justify-center text-[#007AFF]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H9a3 3 0 0 1 3 3v14a2.5 2.5 0 0 0-2.5-2.5H4.5A2.5 2.5 0 0 1 2 15V5.5z" />
                  <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H15a3 3 0 0 0-3 3v14a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 0 22 15V5.5z" />
                </svg>
              </div>

              {/* Tabs */}
              <div className="w-10 h-10 flex items-center justify-center text-[#007AFF]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="11" height="11" rx="2.2" />
                  <path d="M15 9h3a2.2 2.2 0 0 1 2.2 2.2v6.6A2.2 2.2 0 0 1 18 20h-6.6A2.2 2.2 0 0 1 9.2 17.8V15" />
                </svg>
              </div>
            </div>
          </motion.li>

          {/* STEP 2 */}
          <motion.li
            {...cardMotion(0.12)}
            className="w-full rounded-[28px] px-[15px] py-[16px] border border-black/[0.065]"
            style={{
              backgroundColor: 'rgba(246, 247, 249, 0.78)',
              backdropFilter: 'blur(26px) saturate(160%)',
              WebkitBackdropFilter: 'blur(26px) saturate(160%)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 10px 28px rgba(0, 0, 0, 0.045), 0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-start gap-[10px] flex-1 min-w-0">
                <span
                  aria-hidden="true"
                  className="w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center text-[16px] font-semibold text-[#000000] bg-[#E8EAEF] mt-[1px]"
                >
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14.5px] sm:text-[15.5px] font-semibold text-[#000000] leading-[1.22] tracking-[-0.02em]">
                    Selecione “Adicionar à Tela de Início”
                  </h2>
                  <p className="mt-1 text-[12.5px] font-normal text-[#6E6E73] leading-[1.35] tracking-[-0.005em]">
                    Encontre essa opção no menu do Safari.
                  </p>
                </div>
              </div>

              {/* Updated iOS Safari Share Sheet Menu Illustration */}
              <div
                aria-hidden="true"
                className="w-[172px] shrink-0 rounded-[18px] p-[5px] border border-black/[0.06] overflow-hidden"
                style={{
                  backgroundColor: 'rgba(235, 237, 241, 0.85)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 6px 16px rgba(0, 0, 0, 0.045)',
                }}
              >
                <div className="px-2 py-[6px] flex items-center justify-between gap-1 text-[9.5px] font-normal text-[#3A3A3C]">
                  <span className="truncate">Adicionar Favorito</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-75">
                    <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H9a3 3 0 0 1 3 3v14a2.5 2.5 0 0 0-2.5-2.5H4.5A2.5 2.5 0 0 1 2 15V5.5z" />
                    <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H15a3 3 0 0 0-3 3v14a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 0 22 15V5.5z" />
                  </svg>
                </div>

                {/* Highlighted "Adicionar à Tela de Início" option */}
                <div
                  className="px-[7px] py-[7px] rounded-[11px] bg-[#FFFFFF] border border-black/[0.05] flex items-center justify-between gap-1 text-[#000000] overflow-hidden"
                  style={{
                    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.075), 0 1px 2px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <span className="text-[8.8px] font-semibold tracking-[-0.02em] whitespace-nowrap">
                    Adicionar à Tela de Início
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                    <path d="M12 8v8" />
                    <path d="M8 12h8" />
                  </svg>
                </div>

                <div className="px-2 py-[6px] flex items-center justify-between gap-1 text-[9.5px] font-normal text-[#3A3A3C]">
                  <span className="truncate">Buscar na Página</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-75">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.li>

          {/* STEP 3 */}
          <motion.li
            {...cardMotion(0.18)}
            className="w-full rounded-[28px] px-[15px] py-[16px] border border-black/[0.065]"
            style={{
              backgroundColor: 'rgba(246, 247, 249, 0.78)',
              backdropFilter: 'blur(26px) saturate(160%)',
              WebkitBackdropFilter: 'blur(26px) saturate(160%)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 10px 28px rgba(0, 0, 0, 0.045), 0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-start gap-[10px] flex-1 min-w-0">
                <span
                  aria-hidden="true"
                  className="w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center text-[16px] font-semibold text-[#000000] bg-[#E8EAEF] mt-[1px]"
                >
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] sm:text-[16px] font-semibold text-[#000000] leading-[1.22] tracking-[-0.02em]">
                    Confirme em “Adicionar”
                  </h2>
                  <p className="mt-1 text-[12.5px] font-normal text-[#6E6E73] leading-[1.35] tracking-[-0.005em]">
                    Pronto! O Monvian aparecerá entre seus aplicativos.
                  </p>
                </div>
              </div>

              {/* Non-interactive iOS Safari "Adicionar" confirmation pill illustration */}
              <div
                aria-hidden="true"
                className="shrink-0 px-[16px] py-[9.5px] rounded-full bg-[#FFFFFF] border border-black/[0.06] text-[#007AFF] font-semibold text-[14.5px] tracking-[-0.015em] pointer-events-none"
                style={{
                  boxShadow:
                    '0 6px 16px rgba(0, 0, 0, 0.075), 0 1px 3px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 1)',
                }}
              >
                Adicionar
              </div>
            </div>
          </motion.li>
        </ol>
      </div>
    </div>
  );
};
