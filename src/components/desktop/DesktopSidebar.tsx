import React, { useState } from 'react';
import {
  Compass,
  Route,
  Bookmark,
  User,
  Shield,
  Settings,
  ChevronRight,
  ChevronLeft,
  Search,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
  theme,
  realWeather,
  onOpenWeatherModal,
  user,
  onOpenAdmin,
  onOpenHostDashboard,
  isUserAdmin,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
}) => {
  // Collapsed by default as requested (64-76px), expandable to 220-250px
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(true);
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const navItems = [
    { id: 'roteiros', label: 'Roteiros', icon: Route },
    { id: 'salvos', label: 'Salvos', icon: Bookmark, badge: unreadCount },
    { id: 'explorar', label: 'Explorar', icon: Compass },
    { id: 'buscar', label: 'Buscar', icon: Search },
    { id: 'perfil', label: 'Perfil', icon: User },
  ];

  const displayUsername = user?.username ? `@${user.username}` : '@monvians';
  const displayName = user?.name || 'mariomeloz';

  return (
    <aside
      className={`hidden md:flex flex-col justify-between h-full bg-white border-r border-zinc-200/90 z-40 select-none shrink-0 transition-[width] duration-200 ease-in-out ${
        isCollapsed ? 'w-[72px]' : 'w-[250px]'
      }`}
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
      }}
      aria-label="Menu principal desktop"
    >
      <div className={`space-y-6 ${isCollapsed ? 'p-3' : 'p-5'}`}>
        {/* Brand Header: logocarregamento.png (+40% horizontal) when expanded, minilogo.png when collapsed */}
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
          {isCollapsed ? (
            /* Collapsed state: shows minilogo.png */
            <div
              onClick={handleToggle}
              className="flex items-center justify-center cursor-pointer group"
              title="Expandir menu"
            >
              <img
                src="/minilogo.png"
                alt="Monvian"
                className="w-9 h-9 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform duration-200"
              />
            </div>
          ) : (
            /* Expanded state: shows logocarregamento.png (+40% horizontally) */
            <div className="flex items-center min-w-0 flex-1 pr-3 overflow-visible animate-fadeIn">
              <img
                src="/logocarregamento.png"
                alt="Monvian"
                className="h-[34px] w-auto max-w-none select-none transition-transform duration-200"
                style={{
                  transform: 'scaleX(1.4)',
                  transformOrigin: 'left center',
                }}
              />
            </div>
          )}

          {/* Discreet Toggle Button */}
          <button
            type="button"
            onClick={handleToggle}
            className={`p-1.5 rounded-xl text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer group relative ${
              isCollapsed ? 'w-8 h-8 flex items-center justify-center' : ''
            }`}
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {isCollapsed ? (
              <PanelLeft className="w-4 h-4 stroke-[2]" />
            ) : (
              <PanelLeftClose className="w-4 h-4 stroke-[2]" />
            )}

            {/* Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-zinc-900 text-white text-[11px] font-medium tracking-tight shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                Expandir menu
              </div>
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5" aria-label="Navegação">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`w-full flex items-center transition-all duration-200 cursor-pointer ${
                    isCollapsed
                      ? 'w-11 h-11 mx-auto justify-center rounded-2xl'
                      : 'justify-between px-3.5 py-2.5 rounded-2xl text-[14px] font-semibold'
                  } ${
                    isActive
                      ? 'bg-[#f3f3f3] text-black border border-zinc-200/80 shadow-xs'
                      : 'text-zinc-600 hover:text-black hover:bg-zinc-100 border border-transparent'
                  }`}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <div
                      className={`flex items-center justify-center transition-colors ${
                        isCollapsed
                          ? 'w-6 h-6'
                          : isActive
                            ? 'w-7 h-7 rounded-full bg-[#d9d9d9] text-black'
                            : 'w-7 h-7 rounded-full text-zinc-500 group-hover:text-black'
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] stroke-[2.2]" style={{ color: '#000000' }} />
                    </div>

                    {!isCollapsed && (
                      <span className="truncate" style={{ color: '#000000' }}>
                        {item.label}
                      </span>
                    )}
                  </div>

                  {/* Salvos / Unread indicator dot */}
                  {item.id === 'salvos' && (
                    <span
                      className={`rounded-full bg-[#0095fe] shadow-[0_0_8px_rgba(0,149,254,0.6)] ${
                        isCollapsed ? 'absolute top-2 right-2 w-2 h-2' : 'w-2 h-2'
                      }`}
                      style={{ backgroundColor: '#0095fe' }}
                    />
                  )}
                </button>

                {/* macOS Style Discrete Tooltip on Hover (When Collapsed) */}
                {isCollapsed && (
                  <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium tracking-tight shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}

          {/* Host Dashboard Link */}
          {onOpenHostDashboard && (
            <div className={`pt-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
              <div className="relative group w-full">
                <button
                  type="button"
                  onClick={onOpenHostDashboard}
                  className={`flex items-center transition-all cursor-pointer ${
                    isCollapsed
                      ? 'w-11 h-11 mx-auto justify-center rounded-2xl text-black hover:bg-zinc-100 border border-transparent hover:border-zinc-200'
                      : 'w-full justify-between px-3.5 py-2.5 rounded-2xl text-[13px] font-medium text-black hover:bg-zinc-100 border border-zinc-200'
                  }`}
                  aria-label="Área do anfitrião"
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <User className="w-4 h-4 stroke-[2]" style={{ color: '#000000' }} />
                    {!isCollapsed && <span style={{ color: '#000000' }}>Área do anfitrião</span>}
                  </div>
                  {!isCollapsed && <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                </button>

                {isCollapsed && (
                  <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium tracking-tight shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                    Área do anfitrião
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Panel Link */}
          {isUserAdmin && (
            <div className={`pt-1 ${isCollapsed ? 'flex justify-center' : ''}`}>
              <div className="relative group w-full">
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className={`flex items-center transition-all cursor-pointer ${
                    isCollapsed
                      ? 'w-11 h-11 mx-auto justify-center rounded-2xl text-[#0069ff] hover:bg-blue-50 border border-transparent hover:border-blue-200'
                      : 'w-full gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-semibold text-[#008dff] hover:bg-blue-50 border border-blue-200'
                  }`}
                  aria-label="Painel Admin"
                >
                  <Shield className="w-4 h-4 stroke-[2.2]" style={{ color: '#0069ff' }} />
                  {!isCollapsed && <span style={{ color: '#008dff' }}>Painel Admin</span>}
                </button>

                {isCollapsed && (
                  <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium tracking-tight shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                    Painel Admin
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Footer Section */}
      <div
        className={`border-t border-zinc-200/90 bg-white ${
          isCollapsed ? 'p-3 flex flex-col items-center' : 'p-4 lg:p-5'
        }`}
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* User Profile Widget */}
        <div className="relative group w-full flex justify-center">
          <div
            onClick={() => onChangeTab('perfil')}
            className={`transition-all cursor-pointer ${
              isCollapsed
                ? 'w-10 h-10 rounded-full flex items-center justify-center'
                : 'w-full p-2.5 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 flex items-center justify-between shadow-2xs'
            }`}
            role="button"
            tabIndex={0}
            title={displayName}
          >
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1 mr-2'}`}>
              <img
                src={
                  user?.avatar_url && user.avatar_url !== '/fotoperfil.png'
                    ? user.avatar_url
                    : (typeof window !== 'undefined' ? localStorage.getItem('monvian_local_avatar') : null) ||
                      user?.avatar_url ||
                      '/fotoperfil.png'
                }
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover border border-zinc-200 shrink-0 group-hover:ring-2 group-hover:ring-amber-500/50 transition-all"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/fotoperfil.png';
                }}
              />

              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-black truncate group-hover:text-amber-600 transition-colors" style={{ color: '#000000' }}>
                    {displayName}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">
                    {displayUsername}
                  </p>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeTab('perfil');
                  }}
                  className="p-1 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Configurações do Perfil"
                  aria-label="Configurações"
                >
                  <Settings className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            )}
          </div>

          {isCollapsed && (
            <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium tracking-tight shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
              {displayName} ({displayUsername})
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
