import React from 'react';
import { TabType } from '../BottomNavigation';
import {
  NavAgoraIcon,
  NavRoteirosIcon,
  NavSalvosIcon,
  NavSearchIcon,
  NavProfileIcon,
} from '../NavIcons';
import { Weather3DIcon } from '../Weather3DIcon';

interface DesktopSidebarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  realWeather: {
    temperature: number;
    condition: string;
    weatherCode: number;
    isDay: boolean;
  };
  onOpenWeatherModal: () => void;
  user?: {
    name?: string;
    avatar_url?: string;
    email?: string;
  } | null;
  onOpenAdmin?: () => void;
  isUserAdmin?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
  theme,
  onToggleTheme,
  realWeather,
  onOpenWeatherModal,
}) => {
  // Navigation tabs matching the exact mobile bottom dock 1:1
  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'explorar',
      label: 'Explorar',
      icon: <NavAgoraIcon size={22} className="shrink-0" />,
    },
    {
      id: 'roteiros',
      label: 'Roteiros',
      icon: <NavRoteirosIcon size={22} className="shrink-0" />,
    },
    {
      id: 'salvos',
      label: 'Salvos',
      icon: <NavSalvosIcon size={22} filled={activeTab === 'salvos'} className="shrink-0" />,
    },
    {
      id: 'buscar',
      label: 'Buscar',
      icon: <NavSearchIcon size={22} className="shrink-0" />,
    },
    {
      id: 'perfil',
      label: 'Perfil',
      icon: <NavProfileIcon size={22} className="shrink-0" />,
    },
  ];

  return (
    <aside
      aria-label="Menu Principal Monvian"
      className="hidden md:flex flex-col justify-between w-64 lg:w-72 h-full z-40 shrink-0 select-none transition-all duration-300 ios-glass border-r border-white/20 dark:border-white/15 text-zinc-900 dark:text-white"
      style={{
        boxShadow: '4px 0 24px 0 rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* 1. Header with Brand Identity (Identical logo container and typography) */}
      <div className="p-5 lg:p-6 pb-4 border-b border-black/10 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-black flex items-center justify-center p-2 shadow-md shrink-0 border border-white/10 overflow-hidden">
            <img
              src="/logomodoescuro.png"
              alt="Monvian"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-base font-black tracking-tight leading-none text-zinc-900 dark:text-white uppercase font-['Inter']">
              Monvian
            </span>
            <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1 truncate">
              Campos do Jordão
            </span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Items List (Identical active pill style and icons to mobile BottomNavigation) */}
      <nav aria-label="Navegação lateral" className="flex-1 py-4 px-3 lg:px-4 space-y-1.5 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`desktop-nav-${item.id}`}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] transition-all duration-200 cursor-pointer relative font-['Inter'] ${
                isActive
                  ? 'bg-white/[0.14] dark:bg-white/[0.15] border border-white/25 dark:border-white/20 text-zinc-950 dark:text-white font-extrabold shadow-sm'
                  : 'text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-transparent font-bold'
              }`}
            >
              <div
                className={`transition-colors shrink-0 ${
                  isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-800 dark:text-zinc-200'
                }`}
              >
                {item.icon}
              </div>

              <span className="truncate flex-1 text-left">{item.label}</span>

              {item.badge && item.badge > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#FFFFFF] text-white shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. Footer: Weather Widget + Sol e Lua Theme Switcher (Same transparency, blur, no extra icons) */}
      <div className="p-3.5 lg:p-4 border-t border-black/10 dark:border-white/10 space-y-3 shrink-0">
        {/* Weather Card with identical mobile typography and 3D icon */}
        <button
          type="button"
          onClick={onOpenWeatherModal}
          className="w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left cursor-pointer group ios-glass-btn border border-white/20 dark:border-white/15"
          title="Ver previsão completa do tempo"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 -my-1">
              <Weather3DIcon
                weatherCode={realWeather.weatherCode}
                isDay={realWeather.isDay}
                className="w-10 h-10 object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black text-zinc-900 dark:text-white leading-none">
                  {realWeather.temperature}°
                </span>
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Campos
                </span>
              </div>
              <span className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 truncate leading-tight mt-0.5">
                {realWeather.condition}
              </span>
            </div>
          </div>
        </button>

        {/* Footer Row: Centered Sol e Lua circular toggle button (Exact replica of mobile btn-theme-toggle) */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
            Tema {theme === 'dark' ? 'Escuro' : 'Claro'}
          </span>

          <button
            id="desktop-btn-theme-toggle"
            type="button"
            onClick={onToggleTheme}
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 cursor-pointer group transition-all ios-glass-btn text-zinc-700 dark:text-white border border-white/20 dark:border-white/15"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? (
              <div className="relative w-5 h-5 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500 text-[#FFD60A]">
                <svg className="w-full h-full text-[#FFD60A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" className="fill-[#FFD60A]" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </div>
            ) : (
              <div className="relative w-5 h-5 flex items-center justify-center group-hover:-rotate-12 transition-transform duration-500 text-[#5F55E8]">
                <svg className="w-full h-full text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" className="fill-[#5F55E8]" />
                </svg>
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
