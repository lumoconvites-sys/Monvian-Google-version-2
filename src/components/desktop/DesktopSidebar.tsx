import React from 'react';
import { Compass, Route, Bookmark, User, Shield, Sun, Moon } from 'lucide-react';

interface DesktopSidebarProps {
  activeTab: string;
  onChangeTab: (tab: any) => void;
  unreadCount?: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  realWeather?: any;
  onOpenWeatherModal?: () => void;
  user?: any;
  onOpenAdmin?: () => void;
  isUserAdmin?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
  theme,
  onToggleTheme,
  user,
  onOpenAdmin,
  isUserAdmin
}) => {
  const isDark = theme === 'dark';

  const navItems = [
    { id: 'explorar', label: 'Explorar', icon: Compass },
    { id: 'roteiros', label: 'Roteiros', icon: Route },
    { id: 'salvos', label: 'Salvos', icon: Bookmark, badge: unreadCount },
    { id: 'perfil', label: 'Perfil', icon: User }
  ];

  return (
    <aside className="hidden md:flex flex-col justify-between w-64 h-full p-6 bg-zinc-950/80 backdrop-blur-xl border-r border-white/10 z-40 select-none">
      <div className="space-y-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img src="/loogo.png" alt="Monvian" className="w-10 h-10 object-contain rounded-xl" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">Monvian</h1>
            <p className="text-[11px] text-zinc-400 font-medium">Campos do Jordão</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-zinc-950 shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 stroke-[2]" />
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 && !isActive ? (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                ) : null}
              </button>
            );
          })}

          {isUserAdmin && (
            <button
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold text-amber-400 hover:bg-amber-400/10 transition-all cursor-pointer mt-4"
            >
              <Shield className="w-5 h-5" />
              <span>Painel Admin</span>
            </button>
          )}
        </nav>
      </div>

      {/* Footer User & Theme */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={user?.avatar_url || '/loogo.png'}
            alt={user?.name || 'User'}
            className="w-9 h-9 rounded-full object-cover border border-white/10"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">{user?.name || 'Turista'}</p>
            <p className="text-[10px] text-zinc-400 truncate">{user?.email || 'Campos do Jordão'}</p>
          </div>
        </div>

        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title="Alternar Tema"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
export default DesktopSidebar;
