import React from 'react';
import { motion } from 'motion/react';
import { useMonvianXp } from '../hooks/useMonvianXp';

interface ProfileXpProgressBarProps {
  isDark?: boolean;
}

export const ProfileXpProgressBar: React.FC<ProfileXpProgressBarProps> = ({ isDark = false }) => {
  const xpState = useMonvianXp();

  const {
    totalXp,
    currentLevel,
    levelTitle,
    nextLevelXp,
    xpRemaining,
    placesDiscoveredCount,
  } = xpState;

  // Level progress percentage for the current level tier
  const tierMin = currentLevel === 1 ? 0 : currentLevel === 2 ? 1000 : currentLevel === 3 ? 2500 : currentLevel === 4 ? 5000 : 10000;
  const tierGoal = nextLevelXp;
  const currentLevelProgress = Math.max(0, totalXp - tierMin);
  const currentLevelSpan = Math.max(1, tierGoal - tierMin);
  const fillPercentage = Math.min(100, Math.max(0, (currentLevelProgress / currentLevelSpan) * 100));

  return (
    <div className="w-full">
      {/* Main Horizontal XP Bar Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.045 }}
        className={`w-full p-4 sm:p-4.5 rounded-[24px] border transition-all shadow-xs ${
          isDark
            ? 'bg-[#1C1C1E] border-white/10'
            : 'bg-[#fefefe] border-white'
        }`}
        style={{
          boxShadow: isDark 
            ? '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 8px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 2px 0 rgba(255,255,255,1)',
          borderBottom: isDark ? '4px solid #000' : '4px solid #e4e4e7'
        }}
      >
        {/* Top Row: Level Title on Left + Current XP / Goal on Right */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/image-x7AMcdc77bLjrT7fLhP52TPpyoaLvY_64ba28fe.png"
              alt="Troféu"
              className="w-11 h-11 object-contain shrink-0"
            />
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
    </div>
  );
};
