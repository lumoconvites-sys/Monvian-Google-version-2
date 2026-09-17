import React, { useState } from 'react';
import { motion } from 'motion/react';
import { NavExploreIcon, NavChatIcon, NavSearchIcon, NavProfileIcon } from './NavIcons';

export type TabType = 'explorar' | 'chat' | 'buscar' | 'perfil';

export interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 2,
}) => {
  const [compassRotation, setCompassRotation] = useState<number>(0);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'explorar', label: 'Explorar' },
    { id: 'chat', label: 'Chat' },
    { id: 'buscar', label: 'Buscar' },
    { id: 'perfil', label: 'Perfil' },
  ];

  const handleTabClick = (tabId: TabType) => {
    if (tabId === 'explorar') {
      setCompassRotation((prev) => prev + 360);
    }
    onChangeTab(tabId);
  };

  return (
    <nav
      id="bottom-floating-navigation"
      aria-label="Navegação Principal"
      className="fixed left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-[380px] pointer-events-auto select-none font-['Manrope']"
      style={{
        bottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
      }}
    >
      {/* Main Bottom Navigation Bar Capsule (matches IMG_6904) */}
      <div className="w-full flex items-center justify-between p-1.5 sm:p-2 rounded-full ios-glass-nav relative shadow-[0_12px_40px_rgba(0,0,0,0.4)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.9)] border border-white/20 dark:border-white/20">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-btn-${tab.id}`}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className="relative flex flex-col items-center justify-center w-[66px] h-[60px] rounded-full cursor-pointer z-10 select-none active:scale-95 transition-all"
            >
              {/* Active Tab Circular Highlight matching reference image IMG_6904 */}
              {isActive && (
                <motion.div
                  layoutId="activeTabCircle"
                  className="absolute inset-0 rounded-full bg-white/[0.12] dark:bg-white/[0.14] border border-white/30 dark:border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.08)] -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              {/* 1. Explorar Icon */}
              {tab.id === 'explorar' && (
                <div
                  className={`w-7 h-7 flex items-center justify-center mb-0.5 transition-all ${
                    isActive
                      ? 'text-zinc-700 dark:text-white scale-105 opacity-100'
                      : 'text-zinc-500 dark:text-zinc-400 opacity-85'
                  }`}
                >
                  <motion.div
                    animate={{ rotate: compassRotation }}
                    transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                    className="w-6.5 h-6.5 flex items-center justify-center"
                  >
                    <NavExploreIcon size={25} className="w-full h-full text-current" />
                  </motion.div>
                </div>
              )}

              {/* 2. Chat Icon (No characters or avatars, elegant smart assistant bubble) */}
              {tab.id === 'chat' && (
                <div
                  className={`relative w-7 h-7 flex items-center justify-center mb-0.5 transition-all ${
                    isActive
                      ? 'text-zinc-700 dark:text-white scale-105 opacity-100'
                      : 'text-zinc-500 dark:text-zinc-400 opacity-85'
                  }`}
                >
                  <NavChatIcon size={24} className="w-6 h-6 text-current" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-900 shadow-xs" />
                  )}
                </div>
              )}

              {/* 3. Buscar Icon (Refined magnifying glass) */}
              {tab.id === 'buscar' && (
                <div
                  className={`w-7 h-7 flex items-center justify-center mb-0.5 transition-all ${
                    isActive
                      ? 'text-zinc-700 dark:text-white scale-105 opacity-100'
                      : 'text-zinc-500 dark:text-zinc-400 opacity-85'
                  }`}
                >
                  <NavSearchIcon size={24} className="w-6 h-6 text-current" />
                </div>
              )}

              {/* 4. Perfil Icon (Clean geometric user representation) */}
              {tab.id === 'perfil' && (
                <div
                  className={`w-7 h-7 flex items-center justify-center mb-0.5 transition-all ${
                    isActive
                      ? 'text-zinc-700 dark:text-white scale-105 opacity-100'
                      : 'text-zinc-500 dark:text-zinc-400 opacity-85'
                  }`}
                >
                  <NavProfileIcon size={24} className="w-6 h-6 text-current" />
                </div>
              )}

              <span
                className={`font-['Manrope'] text-[11.5px] leading-tight tracking-tight select-none ${
                  isActive
                    ? 'font-extrabold text-zinc-700 dark:text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
                    : 'font-bold text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
