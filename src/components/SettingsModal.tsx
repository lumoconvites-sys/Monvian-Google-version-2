import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Moon,
  Sun,
  CloudRain,
  Snowflake,
  Sliders,
  Check,
  ChevronRight,
  User,
  Sparkles,
} from 'lucide-react';
import { IOSSwitch } from './IOSSwitch';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  rainEnabled?: boolean;
  onToggleRain?: () => void;
  snowEnabled?: boolean;
  onToggleSnow?: () => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  onOpenAccountSettings?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  rainEnabled = false,
  onToggleRain,
  snowEnabled = false,
  onToggleSnow,
  highContrast = false,
  onToggleHighContrast,
  onOpenAccountSettings,
}) => {
  const isDark = false;

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
          className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-6 bg-black/60 backdrop-blur-sm select-none"
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
                ? 'bg-[#121214] text-white border-white/10'
                : 'bg-[#F2F2F7] text-zinc-900 border-black/10'
            }`}
            style={{
              maxHeight: 'min(86vh, 640px)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 24px)',
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
            <div className="flex items-center justify-between px-6 pt-3 pb-3 border-b border-black/5 dark:border-white/5">
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
                    : 'bg-white text-zinc-600 hover:text-black shadow-xs'
                }`}
                aria-label="Fechar configurações"
              >
                <X className="w-5 h-5 stroke-[2.2]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* SECTION: EFEITOS VISUAIS */}

              {/* SECTION: EFEITOS VISUAIS */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-2 block mb-2">
                  Efeitos & Relevo
                </span>
                <div
                  className={`rounded-2xl border divide-y overflow-hidden ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 divide-white/5'
                      : 'bg-white border-black/5 divide-black/5 shadow-2xs'
                  }`}
                >
                  {/* Chuva */}
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CloudRain className="w-5 h-5 text-blue-500 shrink-0 stroke-[2]" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold tracking-tight">
                          Chuva Dinâmica
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Precipitação no mapa 3D
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={Boolean(rainEnabled)}
                      onChange={() => onToggleRain?.()}
                      ariaLabel="Chuva dinâmica"
                    />
                  </div>

                  {/* Neve */}
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Snowflake className="w-5 h-5 text-sky-400 shrink-0 stroke-[2]" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold tracking-tight">
                          Neve das Montanhas
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Flocos de neve sobre Campos
                        </p>
                      </div>
                    </div>
                    <IOSSwitch
                      checked={Boolean(snowEnabled)}
                      onChange={() => onToggleSnow?.()}
                      ariaLabel="Neve das montanhas"
                    />
                  </div>
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
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
