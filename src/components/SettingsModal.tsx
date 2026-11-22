import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Moon,
  Sun,
  Sliders,
  Check,
  ChevronRight,
  User,
  Sparkles,
  Globe,
} from 'lucide-react';
import { IOSSwitch } from './IOSSwitch';
import { useLanguage } from '../contexts/LanguageContext';
import {
  CircularLanguageFlag,
  MONVIAN_LANGUAGE_OPTIONS,
} from './ui/CircularLanguageFlag';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  onOpenAccountSettings?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  highContrast = false,
  onToggleHighContrast,
  onOpenAccountSettings,
}) => {
  const isDark = theme === 'dark';
  const { language, setLanguage, tr } = useLanguage();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="settings-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 bg-black/60 select-none"
        >
          <motion.div
            id="settings-modal-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 340,
              mass: 0.85,
            }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full md:max-w-md rounded-t-[32px] md:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border ${
              isDark
                ? 'bg-[#000000] text-white border-white/10'
                : 'bg-[#fefefe] text-zinc-900 border-black/10'
            }`}
            style={{
              maxHeight: 'min(86vh, 640px)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 24px)',
            }}
          >
            {/* Scrollable Body including Sticky Blurred Header */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div
                className="sticky top-0 z-20 shrink-0 border-b border-black/5 dark:border-white/10"
                style={{
                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(254, 254, 254, 0.40)',
                }}
              >
                {/* iOS Grabber */}
                <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
                  <div
                    className={`w-10 h-1.5 rounded-full ${
                      isDark ? 'bg-zinc-700' : 'bg-zinc-300'
                    }`}
                  />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-3 pb-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      Configurações
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      Aparência e preferências do Monvian
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                      isDark
                        ? 'bg-zinc-800 text-zinc-300 hover:text-white'
                        : 'bg-white/90 text-zinc-600 hover:text-black shadow-xs'
                    }`}
                    aria-label="Fechar configurações"
                  >
                    <X className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>
              </div>

              <div className="px-5 py-4 space-y-4">
              {/* SECTION: APARÊNCIA / MODO ESCURO */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-2 block mb-2">
                  {tr('Aparência')}
                </span>
                <div
                  className={`rounded-2xl border divide-y overflow-hidden ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 divide-white/10'
                      : 'bg-white border-black/5 divide-black/5 shadow-2xs'
                  }`}
                >
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Moon className="w-5 h-5 text-zinc-900 dark:text-white shrink-0 stroke-[2]" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold tracking-tight">
                          {tr('Modo Escuro')}
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {tr('Tema escuro em todo o aplicativo')}
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={isDark}
                      onChange={onToggleTheme}
                      ariaLabel="Modo Escuro"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: EFEITOS VISUAIS */}
              {/* SECTION: IDIOMA */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-2 block mb-2">
                  {tr('Idioma')}
                </span>
                <div
                  className={`rounded-2xl border divide-y overflow-hidden ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 divide-white/5'
                      : 'bg-white border-black/5 divide-black/5 shadow-2xs'
                  }`}
                >
                  {MONVIAN_LANGUAGE_OPTIONS.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setLanguage(item.code)}
                      className={`w-full p-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        isDark
                          ? 'hover:bg-white/5 active:bg-white/10'
                          : 'hover:bg-zinc-50 active:bg-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CircularLanguageFlag
                          lang={item.code}
                          className="w-6 h-6 ring-1 ring-black/10 dark:ring-white/10"
                        />
                        <span className="text-sm font-semibold tracking-tight" data-no-translate>
                          {item.label}
                        </span>
                      </div>
                      {language === item.code && (
                        <Check className={`w-4 h-4 stroke-[2.5] shrink-0 ${isDark ? 'text-white' : 'text-zinc-950'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: ACESSO AO PERFIL */}
              {onOpenAccountSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAccountSettings();
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#252528]'
                      : 'bg-white border-black/5 hover:bg-zinc-50 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                    <div>
                      <h4 className="text-sm font-semibold tracking-tight">
                        Minha Conta & Permissões
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Gerenciar perfil, GPS e notificações
                      </p>
                    </div>
                  </div>
                </button>
              )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
