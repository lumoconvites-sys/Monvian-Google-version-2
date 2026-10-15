import React from 'react';
import { Compass, Route, Bookmark, User } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  unreadCount?: number;
  isBlurred?: boolean;
  forceWhiteUI?: boolean;
  theme: 'dark' | 'light';
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
}) => {
  const tabs = [
    { id: 'explorar', label: 'Explorar', icon: Compass },
    { id: 'roteiros', label: 'Roteiros', icon: Route },
    { id: 'salvos', label: 'Salvos', icon: Bookmark, badge: unreadCount },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  return (
    <nav
      aria-label="Navegação Principal"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:hidden pointer-events-auto"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-950/85 backdrop-blur-2xl border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-white text-zinc-950 font-bold shadow-md'
                  : 'text-zinc-400 hover:text-white font-medium'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
              {isActive && (
                <span className="text-xs font-black tracking-tight">{tab.label}</span>
              )}
              {tab.badge && tab.badge > 0 && !isActive ? (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
export default BottomNavigation;
