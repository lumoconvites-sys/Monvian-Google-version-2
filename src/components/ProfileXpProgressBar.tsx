import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { useMonvianXp } from '../hooks/useMonvianXp';
import { monvianXpManager } from '../services/xpService';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileXpProgressBarProps {
  isDark?: boolean;
}

export const ProfileXpProgressBar: React.FC<ProfileXpProgressBarProps> = ({ isDark = false }) => {
  const xpState = useMonvianXp();
  const { tr } = useLanguage();

  useEffect(() => {
    monvianXpManager.fetchProfile().catch(() => {});
  }, []);

  const {
    totalXp,
    currentLevel,
    levelTitle,
    nextLevelXp,
    xpRemaining,
    placesDiscoveredCount,
  } = xpState;

  const isMaxLevel = currentLevel >= 5;

  // Level progress percentage for the current level tier
  const tierMin =
    currentLevel === 1
      ? 0
      : currentLevel === 2
      ? 1000
      : currentLevel === 3
      ? 2500
      : currentLevel === 4
      ? 5000
      : 10000;
  const tierGoal = isMaxLevel ? Math.max(10000, totalXp) : nextLevelXp || 1000;
  const currentLevelProgress = Math.max(0, totalXp - tierMin);
  const currentLevelSpan = Math.max(1, tierGoal - tierMin);
  const rawPercentage = isMaxLevel ? 100 : (currentLevelProgress / currentLevelSpan) * 100;

  // Ensure that when totalXp > 0 (e.g. 100 XP), the bar visibly rises and shows a clear blue progress fill
  const fillPercentage = isMaxLevel
    ? 100
    : totalXp <= 0
    ? 0
    : Math.min(100, Math.max(10, rawPercentage));

  return (
    <div className="w-full">
      {/* Main Horizontal XP Bar Card with 3D Apple iOS physical finish */}
      <div
        className={`w-full p-4 sm:p-4.5 rounded-[24px] border transition-all shadow-xs ${
          isDark
            ? 'bg-[#1C1C1E] border-white/10'
            : 'bg-[#fefefe] border-white'
        }`}
        style={{
          boxShadow: isDark
            ? '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.3), inset 0 1px 0 rgba(0,0,0,0.05)'
            : '0 8px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 2px 0 rgba(255,255,255,1)',
          borderBottom: isDark ? '4px solid #000' : '4px solid #e4e4e7',
        }}
      >
        {/* Top Row: Level Title on Left + Current XP / Goal on Right */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="https://gxyqrwebnkbgxqrfdvuj.supabase.co/storage/v1/object/public/monvian-media/app-assets/xp-badge-icon-1209b807e34e68a6.webp"
              alt={tr('Troféu')}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-[22px] h-[22px] object-contain shrink-0"
            />
            <span
              className={`text-[13px] sm:text-[14px] font-bold tracking-tight truncate ${
                isDark ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {tr(`Nível ${currentLevel} · ${levelTitle}`)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[13px] sm:text-[14px] font-extrabold tracking-tight tabular-nums ${
                isDark ? 'text-zinc-200' : 'text-zinc-900'
              }`}
            >
              {totalXp.toLocaleString()}{' '}
              <span className="text-zinc-400 font-semibold text-[11.5px]">
                {isMaxLevel ? tr('XP · MÁX') : `/ ${tierGoal.toLocaleString()} XP`}
              </span>
            </span>
          </div>
        </div>

        {/* Horizontal Progress Track */}
        <div
          className={`relative w-full h-3.5 rounded-full overflow-hidden ${
            isDark ? 'bg-zinc-800/90' : 'bg-zinc-200/80'
          }`}
        >
          {/* Animated Gradient Fill Bar with explicit h-full and fluid spring animation */}
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#0066FF] via-[#2F80ED] to-[#00A3FF] relative overflow-hidden"
            initial={false}
            animate={{ width: `${fillPercentage}%` }}
            transition={{ type: 'spring', stiffness: 210, damping: 24 }}
            style={{
              minWidth: totalXp > 0 ? '18px' : '0px',
              boxShadow: totalXp > 0 ? '0 0 10px rgba(0, 102, 255, 0.35)' : 'none',
            }}
          />
        </div>

        {/* Bottom Micro Hint */}
        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-2">
          <span>
            {tr(`${placesDiscoveredCount} ${placesDiscoveredCount === 1 ? 'lugar descoberto' : 'lugares descobertos'}`)}
          </span>
          <span>
            {isMaxLevel || xpRemaining <= 0
              ? tr('Todos os pontos explorados · Nível máximo!')
              : tr(`Faltam ${xpRemaining} XP para o próximo nível`)}
          </span>
        </div>
      </div>
    </div>
  );
};
