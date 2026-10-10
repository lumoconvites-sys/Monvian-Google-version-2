import React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { StoryTrayItem } from '../server/storyRoutes';

interface StoriesTrayProps {
  trayUsers: StoryTrayItem[];
  myStory: StoryTrayItem | null;
  currentUser: { id: string; name: string; photo: string };
  isLoading: boolean;
  theme?: string;
  onOpenCreateStory: () => void;
  onOpenUserStory: (userId: string) => void;
}

export const StoriesTray: React.FC<StoriesTrayProps> = ({
  trayUsers,
  myStory,
  currentUser,
  isLoading,
  theme = 'dark',
  onOpenCreateStory,
  onOpenUserStory
}) => {
  const isDark = theme !== 'light';

  return (
    <div className={`w-full ${isDark ? 'bg-[#000000]' : 'bg-[#ffffff]'} select-none shrink-0 mb-3 transition-colors duration-200`}>
      <div
        className="w-full overflow-x-auto no-scrollbar py-3 px-3 sm:px-4"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-max">
          {/* ============================================================== */}
          {/* 1. SEU STORY (FIRST ITEM) - 40% BIGGER + INFINITE LIGHT AURA  */}
          {/* ============================================================== */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 360, mass: 0.6 }}
            className="flex flex-col items-center gap-1.5 w-[98px] sm:w-[104px] shrink-0"
          >
            <div className="relative cursor-pointer group">
              {/* Outer ring if user has active story */}
              {myStory && myStory.stories_count > 0 ? (
                <motion.div
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                  onClick={() => onOpenUserStory(currentUser.id)}
                  className="relative w-[90px] h-[90px] sm:w-[96px] sm:h-[96px] flex items-center justify-center transform-gpu will-change-transform"
                >
                  {/* Anel colorido base dos stories */}
                  <div
                    className="absolute inset-0 rounded-full story-gradient"
                  />

                  {/* Efeito infinito concentrado exatamente sobre a cor do anel (reduzido 95% do raio/espalhamento) */}
                  <div
                    className="absolute inset-0 rounded-full story-gradient animate-story-ring"
                    style={{ willChange: 'transform' }}
                  />
                  <div
                    className="absolute -inset-[0.5px] rounded-full story-gradient animate-story-glow pointer-events-none"
                    style={{ willChange: 'transform, opacity, filter' }}
                  />

                  {/* Foto interna do usuário estática e nítida */}
                  <div className={`relative z-10 w-[82px] h-[82px] sm:w-[88px] sm:h-[88px] rounded-full p-[2.5px] ${isDark ? 'bg-black' : 'bg-white'}`}>
                    <img
                      src={currentUser.photo}
                      alt="Seu story"
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                  onClick={onOpenCreateStory}
                  className={`w-[90px] h-[90px] sm:w-[96px] sm:h-[96px] rounded-full p-[2.5px] ${
                    isDark ? 'border-white/20 bg-zinc-900' : 'border-zinc-300 bg-zinc-100'
                  } border flex items-center justify-center transform-gpu will-change-transform`}
                >
                  <img
                    src={currentUser.photo}
                    alt="Seu story"
                    className="w-full h-full rounded-full object-cover"
                  />
                </motion.div>
              )}

              {/* Plus Badge (+) at bottom right with spring feedback (+40% scale) */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.84 }}
                transition={{ type: 'spring', damping: 18, stiffness: 450 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCreateStory();
                }}
                className={`absolute bottom-0 right-0 z-20 w-[28px] h-[28px] sm:w-[29px] sm:h-[29px] rounded-full ${
                  isDark ? 'bg-white text-black border-black' : 'bg-black text-white border-white'
                } flex items-center justify-center shadow-md border-2 cursor-pointer transform-gpu`}
                title="Adicionar Story"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </motion.button>
            </div>

            <span className={`text-[12px] sm:text-[12.5px] font-medium ${isDark ? 'text-white' : 'text-zinc-900'} tracking-tight truncate max-w-[94px] sm:max-w-[100px] text-center leading-tight`}>
              Seu story
            </span>
          </motion.div>

          {/* ============================================================== */}
          {/* 2. LOADING SKELETONS - 120 FPS SHIMMER                         */}
          {/* ============================================================== */}
          {isLoading && trayUsers.length === 0 && (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 w-[98px] sm:w-[104px] shrink-0 animate-pulse">
                  <div className={`w-[90px] h-[90px] sm:w-[96px] sm:h-[96px] rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-ios-shimmer" />
                  </div>
                  <div className={`w-14 h-2.5 rounded-full ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-200'}`} />
                </div>
              ))}
            </>
          )}

          {/* ============================================================== */}
          {/* 3. ACTIVE OTHER USERS STORIES LIST - INFINITE LIGHT ANIMATION  */}
          {/* ============================================================== */}
          {trayUsers.map((item, idx) => (
            <motion.div
              key={item.user_id}
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: 'spring',
                damping: 24,
                stiffness: 350,
                mass: 0.6,
                delay: Math.min(idx * 0.035, 0.25),
              }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => onOpenUserStory(item.user_id)}
              className="flex flex-col items-center gap-1.5 w-[98px] sm:w-[104px] shrink-0 cursor-pointer group transform-gpu will-change-transform"
            >
              {/* Outer ring: A luz que fica em volta com animação infinita concentrada na borda colorida */}
              <div className="relative w-[90px] h-[90px] sm:w-[96px] sm:h-[96px] flex items-center justify-center">
                {item.has_unviewed ? (
                  <>
                    {/* Anel colorido base */}
                    <div
                      className="absolute inset-0 rounded-full story-gradient"
                    />

                    {/* Anel giratório contínuo com a mesma cor exata (sobreposto perfeitamente ao anel) */}
                    <div
                      className="absolute inset-0 rounded-full story-gradient animate-story-ring"
                      style={{ willChange: 'transform' }}
                    />

                    {/* Leve brilho de luz contido na própria borda (reduzido em 95% sem vazar para fora) */}
                    <div
                      className="absolute -inset-[0.5px] rounded-full story-gradient animate-story-glow pointer-events-none"
                      style={{ willChange: 'transform, opacity, filter' }}
                    />
                  </>
                ) : (
                  /* Story já visualizado: borda discreta sem animação excessiva */
                  <div
                    className={`absolute inset-0 rounded-full border ${
                      isDark ? 'border-zinc-700' : 'border-zinc-300'
                    }`}
                  />
                )}

                {/* Foto interna do usuário estática e nítida (não gira com o anel) */}
                <div className={`relative z-10 w-[82px] h-[82px] sm:w-[88px] sm:h-[88px] rounded-full p-[2.5px] ${isDark ? 'bg-black' : 'bg-white'}`}>
                  <img
                    src={item.user_photo}
                    alt={item.user_name}
                    className="w-full h-full rounded-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Username truncated */}
              <span className={`text-[12px] sm:text-[12.5px] font-medium ${isDark ? 'text-white group-hover:text-zinc-200' : 'text-zinc-900 group-hover:text-zinc-600'} tracking-tight truncate max-w-[94px] sm:max-w-[100px] text-center leading-tight transition-colors`}>
                {item.user_name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
