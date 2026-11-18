import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';

interface PersistentSiteNavbarProps {
  navTheme: 'dark' | 'light';
  isDark: boolean;
  onStartRegister: () => void;
  onOpenLogin: () => void;
  onOpenItineraries: () => void;
}

const BrazilFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#009B3A" />
    <path d="M12 4.2L20.4 12L12 19.8L3.6 12Z" fill="#FFDF00" />
    <circle cx="12" cy="12" r="4.15" fill="#002776" />
    <path
      d="M8.05 11.25C10.45 10.25 13.45 10.65 15.9 12.65"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="1.05"
      strokeLinecap="round"
    />
  </svg>
);

const UkFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id="monvian-uk-flag-clip">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
    </defs>
    <g clipPath="url(#monvian-uk-flag-clip)">
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#FFFFFF" strokeWidth="4.4" />
      <path d="M0 0L24 24M24 0L0 24" stroke="#C8102E" strokeWidth="2.1" />
      <path d="M12 0V24M0 12H24" stroke="#FFFFFF" strokeWidth="6.4" />
      <path d="M12 0V24M0 12H24" stroke="#C8102E" strokeWidth="3.6" />
    </g>
  </svg>
);

const SpainFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <defs>
      <clipPath id="monvian-es-flag-clip">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
    </defs>
    <g clipPath="url(#monvian-es-flag-clip)">
      <rect width="24" height="24" fill="#AA151B" />
      <rect y="6" width="24" height="12" fill="#F1BF00" />
      <rect x="5.4" y="9.2" width="2.8" height="5.6" rx="1.1" fill="#AA151B" />
      <circle cx="6.8" cy="11.2" r="0.85" fill="#F1BF00" />
    </g>
  </svg>
);

const JapanFlagIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full block" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#FFFFFF" />
    <circle cx="12" cy="12" r="11.5" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
    <circle cx="12" cy="12" r="5.2" fill="#BC002D" />
  </svg>
);

const LanguageFlagIcon: React.FC<{ lang: 'pt' | 'en' | 'es' | 'ja' }> = ({ lang }) => {
  if (lang === 'en') return <UkFlagIcon />;
  if (lang === 'es') return <SpainFlagIcon />;
  if (lang === 'ja') return <JapanFlagIcon />;
  return <BrazilFlagIcon />;
};

export const PersistentSiteNavbar: React.FC<PersistentSiteNavbarProps> = ({
  navTheme,
  isDark,
  onStartRegister,
  onOpenLogin,
  onOpenItineraries,
}) => {
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langDropdownContainerRef = useRef<HTMLDivElement | null>(null);
  const { language: selectedLanguage, setLanguage, tr } = useLanguage();

  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLangMenuOpen) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        langDropdownContainerRef.current &&
        !langDropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsLangMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLangMenuOpen]);

  const content = (
    <>
      <style>{`
        .monvian-floating-nav {
          border-radius: 999px;
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.08);
          color: #000000;
          text-shadow: none;
          box-shadow:
            0 10px 28px rgba(10, 28, 56, 0.12),
            0 2px 8px rgba(0, 0, 0, 0.06);
          transform: translate3d(0, 0, 0);
          overflow: hidden;
          transition: background 0.24s ease, border-color 0.24s ease, color 0.24s ease, box-shadow 0.24s ease;
          contain: layout style;
        }
        .monvian-floating-nav > nav {
          position: relative;
          z-index: 3;
        }
        .monvian-floating-nav[data-nav-theme='dark'],
        .monvian-floating-nav[data-nav-theme='light'] {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.08);
          color: #000000;
          text-shadow: none;
          box-shadow:
            0 10px 28px rgba(10, 28, 56, 0.12),
            0 2px 8px rgba(0, 0, 0, 0.06);
        }
        .monvian-floating-nav button {
          color: #000000;
        }
        .monvian-floating-nav button:hover {
          color: #000000;
          opacity: 0.72;
        }
        @media (prefers-reduced-motion: reduce) {
          .monvian-floating-nav {
            transition: background 0.16s ease, color 0.16s ease;
          }
        }
      `}</style>

      <div
        ref={langDropdownContainerRef}
        className="fixed left-4 right-4 z-[125] max-w-[400px] md:max-w-[520px] mx-auto pointer-events-none select-none"
        style={{
          top: 'max(12px, calc(env(safe-area-inset-top, 0px) + 8px))',
          fontFamily:
            "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <header
          aria-label="Navegação de apresentação Monvian"
          data-nav-theme={navTheme}
          className="monvian-floating-nav relative w-full pointer-events-auto rounded-[999px] px-3.5 sm:px-5 py-2 border"
        >
          <nav className="flex items-center justify-between gap-1 sm:gap-3 text-[12px] sm:text-[13px] font-medium tracking-[-0.01em] text-[#000000]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLangMenuOpen(false);
                onStartRegister();
              }}
              className="px-2 py-1 rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer text-[#000000] focus-visible:outline-2 focus-visible:outline-[#000000]"
            >
              {tr('Criar conta')}
            </button>
            <button
              id="btn-landing-top-login"
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLangMenuOpen(false);
                onOpenLogin();
              }}
              className="px-2 py-1 rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer text-[#000000] focus-visible:outline-2 focus-visible:outline-[#000000]"
            >
              {tr('Entrar')}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLangMenuOpen(false);
                onOpenItineraries();
              }}
              className="px-2 py-1 rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer text-[#000000] focus-visible:outline-2 focus-visible:outline-[#000000]"
            >
              {tr('Roteiros')}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLangMenuOpen((prev) => !prev);
              }}
              aria-haspopup="menu"
              aria-expanded={isLangMenuOpen}
              aria-label={tr('Selecionar idioma')}
              className="px-1.5 py-[1px] rounded-full transition-transform duration-150 active:scale-[0.96] whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 text-[#000000] focus-visible:outline-2 focus-visible:outline-[#000000]"
            >
              <span className="w-[24px] h-[24px] sm:w-[25px] sm:h-[25px] rounded-full overflow-hidden shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.16)] ring-1 ring-black/10 flex items-center justify-center">
                <LanguageFlagIcon lang={selectedLanguage} />
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 stroke-[2.4] text-[#000000] transition-transform duration-200 ${
                  isLangMenuOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
          </nav>
        </header>

        <AnimatePresence>
          {isLangMenuOpen && (
            <motion.div
              role="menu"
              aria-label={tr('Idiomas disponíveis')}
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{
                transformOrigin: 'top right',
                backgroundColor: isDark ? 'rgba(28, 28, 30, 0.94)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
              className={`absolute right-0 top-full mt-2 w-[178px] max-w-[calc(100vw-32px)] rounded-[18px] border overflow-hidden pointer-events-auto ${
                isDark
                  ? 'border-white/15 shadow-[0_14px_36px_rgba(0,0,0,0.65)]'
                  : 'border-white/85 shadow-[0_12px_32px_rgba(10,28,56,0.18),0_2px_8px_rgba(0,0,0,0.06)]'
              }`}
            >
              {(
                [
                  { code: 'pt', label: 'Português' },
                  { code: 'en', label: 'English' },
                  { code: 'es', label: 'Español' },
                  { code: 'ja', label: '日本語' },
                ] as const
              ).map((item, idx) => (
                <React.Fragment key={item.code}>
                  {idx > 0 && (
                    <div
                      className={`h-[1px] mx-3 ${isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'}`}
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedLanguage === item.code}
                    onClick={() => {
                      triggerHaptic();
                      setLanguage(item.code);
                      setIsLangMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left text-[13.5px] font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'text-[#FFFFFF] hover:bg-white/[0.06] active:bg-white/[0.10]'
                        : 'text-[#111827] hover:bg-black/[0.04] active:bg-black/[0.07]'
                    }`}
                  >
                    <span className="w-[22px] h-[22px] rounded-full overflow-hidden shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
                      <LanguageFlagIcon lang={item.code} />
                    </span>
                    <span className="flex-1 truncate" data-no-translate>
                      {item.label}
                    </span>
                    {selectedLanguage === item.code && (
                      <Check className="w-4 h-4 shrink-0 stroke-[2.6] text-[#007AFF]" />
                    )}
                  </button>
                </React.Fragment>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};
