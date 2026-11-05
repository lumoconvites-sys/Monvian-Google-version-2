import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ChevronRight, Award, Compass, MapPin, Sparkles, X } from 'lucide-react';
import { useMonvianXp } from '../hooks/useMonvianXp';

interface ProfileXpProgressBarProps {
  isDark?: boolean;
}

export const ProfileXpProgressBar: React.FC<ProfileXpProgressBarProps> = ({ isDark = false }) => {
  const xpState = useMonvianXp();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const {
    totalXp,
    currentLevel,
    levelTitle,
    nextLevelXp,
    xpRemaining,
    placesDiscoveredCount,
    history,
  } = xpState;

  // Level progress percentage for the current level tier
  // e.g., Level 1: 0 to 1000
  // e.g., Level 2: 1000 to 2500
  const tierMin = currentLevel === 1 ? 0 : currentLevel === 2 ? 1000 : currentLevel === 3 ? 2500 : currentLevel === 4 ? 5000 : 10000;
  const tierGoal = nextLevelXp;
  const currentLevelProgress = Math.max(0, totalXp - tierMin);
  const currentLevelSpan = Math.max(1, tierGoal - tierMin);
  const fillPercentage = Math.min(100, Math.max(0, (currentLevelProgress / currentLevelSpan) * 100));

  return (
    <div className="w-full">
      {/* 1. Main Horizontal Interactive XP Bar Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.045 }}
        whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
        whileTap={{ scale: 0.985 }}
        onClick={() => setIsDetailsOpen((prev) => !prev)}
        className={`w-full p-4 sm:p-4.5 rounded-[24px] border transition-all cursor-pointer group shadow-xs ${
          isDark
            ? 'bg-[#1C1C1E] border-white/10 hover:bg-[#242428]'
            : 'bg-[#fefefe] border-black/5 hover:bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]'
        }`}
      >
        {/* Top Row: Level Title on Left + Current XP / Goal on Right */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-blue-500/10 dark:bg-blue-400/15 text-[#0066FF] dark:text-[#388BFD] flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <span
              className={`text-[13px] sm:text-[14px] font-bold tracking-tight truncate ${
                isDark ? 'text-white' : 'text-zinc-950'
              }`}
            >
              Nível {currentLevel} · {levelTitle}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[13px] sm:text-[14px] font-extrabold tracking-tight tabular-nums ${
                isDark ? 'text-zinc-200' : 'text-zinc-900'
              }`}
            >
              {totalXp.toLocaleString()} <span className="text-zinc-400 font-semibold text-[11.5px]">/ {tierGoal.toLocaleString()} XP</span>
            </span>
            <ChevronRight
              className={`w-4 h-4 transition-transform duration-200 ${
                isDetailsOpen ? 'rotate-90 text-[#0066FF]' : 'text-zinc-400'
              }`}
            />
          </div>
        </div>

        {/* Horizontal Progress Track */}
        <div
          className={`relative w-full h-3 rounded-full overflow-hidden ${
            isDark ? 'bg-zinc-800/90' : 'bg-zinc-200/80'
          }`}
        >
          {/* Animated Gradient Fill Bar with fluid spring animation */}
          <motion.div
            className="absolute top-0 left-0 bottom-0 rounded-full bg-gradient-to-r from-[#0066FF] via-[#2F80ED] to-[#00A3FF] relative overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(4, fillPercentage)}%` }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            {/* Shimmer light sweep highlight effect */}
            <motion.div
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>

        {/* Bottom Micro Hint */}
        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-2">
          <span>{placesDiscoveredCount} {placesDiscoveredCount === 1 ? 'lugar descoberto' : 'lugares descobertos'}</span>
          <span>{xpRemaining > 0 ? `Faltam ${xpRemaining} XP para o próximo nível` : 'Nível máximo atingido!'}</span>
        </div>
      </motion.div>

      {/* 2. Interactive Details Drawer / Panel (XP acumulado, lugares descobertos, histórico) */}
      <AnimatePresence>
        {isDetailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className="overflow-hidden pt-2"
          >
            <div
              className={`p-4 rounded-[22px] border space-y-3.5 ${
                isDark
                  ? 'bg-zinc-900/95 border-white/10'
                  : 'bg-zinc-50/95 border-black/5 shadow-inner'
              }`}
            >
              {/* Stats Summary Cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div
                  className={`p-2.5 rounded-2xl border ${
                    isDark ? 'bg-zinc-800/60 border-white/5' : 'bg-white border-black/5'
                  }`}
                >
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">XP Total</p>
                  <p className="text-[15px] font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {totalXp}
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-2xl border ${
                    isDark ? 'bg-zinc-800/60 border-white/5' : 'bg-white border-black/5'
                  }`}
                >
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Lugares</p>
                  <p className="text-[15px] font-black text-zinc-900 dark:text-white mt-0.5">
                    {placesDiscoveredCount}
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-2xl border ${
                    isDark ? 'bg-zinc-800/60 border-white/5' : 'bg-white border-black/5'
                  }`}
                >
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Próx. Nível</p>
                  <p className="text-[15px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{xpRemaining}
                  </p>
                </div>
              </div>

              {/* History of Discovered Places */}
              <div>
                <p className="text-[11.5px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-500" />
                  <span>Histórico de Descobertas</span>
                </p>

                {history.length === 0 ? (
                  <div
                    className={`py-4 px-3 rounded-2xl text-center text-xs font-medium ${
                      isDark ? 'bg-zinc-800/30 text-zinc-400' : 'bg-white text-zinc-500'
                    }`}
                  >
                    Explore o mapa de Campos do Jordão! Aproxime-se a menos de 40m de um ponto turístico para ganhar +100 XP.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {history.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                          isDark ? 'bg-zinc-800/50 border-white/5' : 'bg-white border-black/5'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold truncate text-zinc-900 dark:text-white">
                              {item.spot_name}
                            </p>
                            <p className="text-[10.5px] text-zinc-400">
                              {new Date(item.visited_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold text-[11px]">
                          +{item.xp_awarded} XP
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
