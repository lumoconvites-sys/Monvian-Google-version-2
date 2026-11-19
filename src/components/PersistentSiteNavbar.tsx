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
        .monvian-glass-nav {
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.42);
          backdrop-filter: blur(32px) saturate(190%);
          -webkit-backdrop-filter: blur(32px) saturate(190%);
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 
            0 12px 36px rgba(0, 0, 0, 0.16),
            inset 0 0 0 1px rgba(255, 255, 255, 0.4);
          color: #FFFFFF;
          transform: translate3d(0, 0, 0);
          transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
        }
        .monvian-glass-nav[data-nav-theme='dark'] {
          color: #FFFFFF;
        }
        .monvian-glass-nav[data-nav-theme='light'] {
          color: #000000;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: 
            0 12px 36px rgba(10, 28, 56, 0.14),
            inset 0 0 0 1px rgba(255, 255, 255, 0.8);
        }
        .monvian-glass-nav[data-nav-theme='dark'] button {
          color: #FFFFFF;
        }
        .monvian-glass-nav[data-nav-theme='light'] button {
          color: #000000;
        }
        .monvian-glass-nav button:hover {
          opacity: 0.75;
        }
      `}</style>

      <div
        ref={langDropdownContainerRef}
        className="fixed left-4 right-4 z-[125] max-w-[420px] md:max-w-[480px] mx-auto pointer-events-none select-none"
        style={{
          top: 'max(14px, calc(env(safe-area-inset-top, 0px) + 10px))',
          fontFamily:
            "'-apple-system', BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', sans-serif",
        }}
      >
        <header
          aria-label="Navegação superior Monvian"
          data-nav-theme={navTheme}
          className="monvian-glass-nav relative w-full pointer-events-auto rounded-[999px] px-5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between"
        >
          <nav className="w-full flex items-center justify-between gap-3 text-[13.5px] sm:text-[14px] font-semibold tracking-[-0.012em]">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsLangMenuOpen(false);
                onStartRegister();
              }}
              className="px-2 py-1 transition-all duration-150 active:scale-[0.96] hover:opacity-75 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2"
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
              className="px-2 py-1 transition-all duration-150 active:scale-[0.96] hover:opacity-75 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2"
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
              className="px-2 py-1 transition-all duration-150 active:scale-[0.96] hover:opacity-75 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2"
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
              className="pl-1 pr-1.5 py-1 rounded-full transition-all duration-150 active:scale-[0.96] hover:opacity-75 whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-2"
            >
              <span className="w-[24px] h-[24px] sm:w-[26px] sm:h-[26px] rounded-full overflow-hidden shrink-0 shadow-[0_2px_6px_rgba(0,0,0,0.16)] ring-1 ring-black/15 flex items-center justify-center">
                <LanguageFlagIcon lang={selectedLanguage} />
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 opacity-90 ${
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
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                transformOrigin: 'top right',
                backgroundColor: isDark ? 'rgba(22, 28, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                fontFamily: "'-apple-system', BlinkMacSystemFont, 'SF Pro Text', sans-serif",
              }}
              className={`absolute right-0 top-full mt-2.5 w-[184px] max-w-[calc(100vw-32px)] rounded-[20px] border overflow-hidden pointer-events-auto ${
                isDark
                  ? 'border-white/20 shadow-[0_18px_44px_rgba(0,0,0,0.7)]'
                  : 'border-white/90 shadow-[0_16px_38px_rgba(10,28,56,0.22),0_2px_8px_rgba(0,0,0,0.06)]'
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
                      className={`h-[1px] mx-3.5 ${isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'}`}
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
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left text-[14px] font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'text-[#FFFFFF] hover:bg-white/[0.08] active:bg-white/[0.12]'
                        : 'text-[#0F172A] hover:bg-black/[0.04] active:bg-black/[0.08]'
                    }`}
                  >
                    <span className="w-[24px] h-[24px] rounded-full overflow-hidden shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.16)]">
                      <LanguageFlagIcon lang={item.code} />
                    </span>
                    <span className="flex-1 truncate" data-no-translate>
                      {item.label}
                    </span>
                    {selectedLanguage === item.code && (
                      <Check className="w-4 h-4 shrink-0 stroke-[2.8] text-[#007AFF]" />
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
