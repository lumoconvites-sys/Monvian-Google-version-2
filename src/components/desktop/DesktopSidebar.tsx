import React from 'react';
import { Compass, Route, Bookmark, User, Shield, Sun, Moon, Settings, ChevronRight, Sparkles } from 'lucide-react';
import { Weather3DIcon } from '../Weather3DIcon';

interface DesktopSidebarProps {
  activeTab: string;
  onChangeTab: (tab: any) => void;
  unreadCount?: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  realWeather?: {
    temperature: number;
    condition: string;
    isDay: boolean;
    weatherCode: number;
  };
  onOpenWeatherModal?: () => void;
  user?: any;
  onOpenAdmin?: () => void;
  onOpenHostDashboard?: () => void;
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
  user,
  onOpenAdmin,
  onOpenHostDashboard,
  isUserAdmin,
}) => {
  const isDark = theme === 'dark';

  const navItems = [
    { id: 'salvos', label: 'Salvos', icon: Bookmark, badge: unreadCount },
    { id: 'roteiros', label: 'Roteiros', icon: Route },
    { id: 'explorar', label: 'Explorar', icon: Compass },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  const isGoldUser = Boolean(
    user?.isGold || user?.is_gold === 1 || user?.isPremium || user?.is_premium === 1
  );

  const displayUsername = user?.username ? `@${user.username}` : '@monvians';
  const displayName = user?.name || 'mariomeloz';

  return (
    <aside
      className="hidden md:flex flex-col justify-between w-64 lg:w-72 h-full bg-[#090A0D] border-r border-white/[0.08] z-40 select-none shrink-0"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
      }}
    >
      <div className="p-5 lg:p-6 space-y-7">
        {/* Brand Header (Stylized Golden 'M' matching uploaded image) */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1C1A14] to-[#0E0D0B] border border-amber-500/30 flex items-center justify-center shrink-0 shadow-[0_2px_12px_rgba(230,172,51,0.15)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-6 h-6"
            >
              <path
                d="M4 19L8.5 5L12 13L15.5 5L20 19H16.8L15.5 13.5L12 20L8.5 13.5L7.2 19H4Z"
                fill="url(#goldGradientBrand)"
              />
              <defs>
                <linearGradient id="goldGradientBrand" x1="4" y1="5" x2="20" y2="19" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFE07A" />
                  <stop offset="0.45" stopColor="#E5AC33" />
                  <stop offset="1" stopColor="#B37C12" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-white leading-none">
                Monvian
              </h1>
              {isGoldUser && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Gold
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-zinc-400 tracking-tight mt-1 truncate">
              Campos do Jordão
            </p>
          </div>
        </div>

        {/* Navigation Items (Matching uploaded image golden pill styling) */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-[14px] font-semibold transition-all duration-200 cursor-pointer group ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/12 via-amber-500/5 to-transparent border border-amber-500/40 text-white shadow-[0_0_18px_rgba(230,172,51,0.12)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-400 group-hover:text-white'
                  }`}>
                    <Icon className="w-[18px] h-[18px] stroke-[2.2]" />
                  </div>
                  <span>{item.label}</span>
                </div>

                {item.id === 'salvos' && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                )}
              </button>
            );
          })}

          {onOpenHostDashboard && (
            <div className="pt-2">
              <button
                onClick={onOpenHostDashboard}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[13px] font-medium text-zinc-300 hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 stroke-[1.8] text-zinc-300" />
                  <span>Área do anfitrião</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          )}

          {isUserAdmin && (
            <div className="pt-1">
              <button
                onClick={onOpenAdmin}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 border border-amber-400/20 transition-all cursor-pointer"
              >
                <Shield className="w-4 h-4 stroke-[2.2]" />
                <span>Painel Admin</span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Footer: Weather Card Widget & User Profile Card Widget (Matching Image) */}
      <div className="p-4 lg:p-5 border-t border-white/[0.08] space-y-2.5">
        {/* Weather Card Widget */}
        <div
          onClick={onOpenWeatherModal}
          className="w-full p-3 rounded-2xl bg-[#12141A] border border-white/[0.06] hover:border-white/15 flex items-center justify-between cursor-pointer transition-all group"
          title="Ver previsão do tempo"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              {realWeather ? (
                <Weather3DIcon
                  weatherCode={realWeather.weatherCode}
                  isDay={realWeather.isDay}
                  className="w-7 h-7"
                />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white tracking-tight">
                {realWeather ? `${realWeather.temperature}°C` : '19°C'}
              </p>
              <p className="text-[10px] text-zinc-400 font-medium truncate max-w-[130px]">
                {realWeather?.condition || 'Tempo nublado'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
        </div>

        {/* User Profile Card Widget */}
        <div className="w-full p-3 rounded-2xl bg-[#12141A] border border-white/[0.06] hover:border-white/15 flex items-center justify-between transition-all">
          <div
            onClick={() => onChangeTab('perfil')}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1 mr-2"
          >
            <img
              src={user?.avatar_url || '/fotoperfil.png'}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0 group-hover:ring-1 group-hover:ring-amber-400/50 transition-all"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/fotoperfil.png';
              }}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-zinc-400 truncate">
                {displayUsername}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onChangeTab('perfil')}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Configurações do Perfil"
            >
              <Settings className="w-4 h-4 stroke-[2]" />
            </button>
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title={isDark ? 'Tema Claro' : 'Tema Escuro'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
