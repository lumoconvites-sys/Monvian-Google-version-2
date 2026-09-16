import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { BarCompassIcon } from './BarCompassIcon';
import { ProfileIcon } from './ProfileIcon';
import { motion } from 'motion/react';

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

  const tabs: { id: TabType; label: string; icon?: any; isAvatar?: boolean }[] = [
    { id: 'explorar', label: 'Explorar' },
    { id: 'chat', label: 'Chat', isAvatar: true },
    { id: 'buscar', label: 'Buscar', icon: Search },
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
      className="fixed bottom-0 left-0 right-0 z-50 w-full pointer-events-auto select-none ios-glass-nav rounded-t-[28px] sm:rounded-t-[32px] border-t border-zinc-900/10 dark:border-white/10 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 16px))',
        paddingTop: '8px',
      }}
    >
      {/* Main Bottom Navigation Bar Pill */}
      <div className="w-full max-w-md mx-auto flex items-center justify-around px-2 relative">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`nav-btn-${tab.id}`}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className="relative flex flex-col items-center justify-center gap-1 py-1.5 px-3.5 rounded-full cursor-pointer z-10 select-none active:scale-95 transition-transform"
            >
              {/* Active pill background with adaptive glass feel */}
              {isActive && (
                <div className="absolute inset-0 rounded-full bg-zinc-900/5 dark:bg-white/12 ring-1 ring-zinc-900/10 dark:ring-white/25 -z-10 shadow-xs" />
              )}

              {tab.isAvatar ? (
                <div className="relative">
                  <div
                    className={`w-7 h-7 rounded-full overflow-hidden border ${
                      isActive
                        ? 'border-white ring-2 ring-white/40 shadow-xs'
                        : 'border-zinc-300 dark:border-white/30 opacity-75'
                    }`}
                  >
                    <img
                      src="/guide_avatar.jpg"
                      alt="Chat Guia IA"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full ring-2 ring-zinc-300 dark:ring-black shadow-xs" />
                  )}
                </div>
              ) : tab.id === 'explorar' ? (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    isActive ? 'opacity-100 scale-100' : 'opacity-70 hover:opacity-100 scale-95'
                  }`}
                >
                  <motion.div
                    animate={{ rotate: compassRotation }}
                    transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                    className="w-5.5 h-5.5 flex items-center justify-center"
                  >
                    <BarCompassIcon size={22} className="w-full h-full" />
                  </motion.div>
                </div>
              ) : tab.id === 'perfil' ? (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-400'
                  }`}
                >
                  <ProfileIcon size={20} className="w-5 h-5 text-current" />
                </div>
              ) : (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-400'
                  }`}
                >
                  {Icon && <Icon className="w-5 h-5 stroke-[2.2]" />}
                </div>
              )}

              <span
                className={`text-[11px] tracking-tight ${
                  isActive
                    ? 'font-black text-zinc-900 dark:text-white'
                    : 'font-black text-zinc-400 dark:text-zinc-400'
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
