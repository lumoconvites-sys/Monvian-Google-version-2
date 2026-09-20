import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Store,
  Users,
  Calendar,
  Settings,
  Sparkles,
  Layers,
  Menu,
  X,
  Search,
  Bell,
  ArrowLeft,
  CloudSun,
  ShieldCheck,
  Compass,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { AdminSpots } from './AdminSpots';
import { AdminServices } from './AdminServices';
import { AdminUsers } from './AdminUsers';
import { AdminEvents } from './AdminEvents';
import { AdminSettings } from './AdminSettings';
import { AdminCleanup } from './AdminCleanup';
import { AdminMapIcons } from './AdminMapIcons';

interface AdminLayoutProps {
  currentUser: any;
  onExitAdmin: () => void;
  onLogout?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentUser,
  onExitAdmin,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Live Clock & Date formatted (matching screenshot: 16:35 | 12 de setembro)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const day = now.getDate();
      const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
      ];
      const monthStr = months[now.getMonth()];
      setCurrentTime(`${hours}:${minutes} | ${day} de ${monthStr}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  const userName = (currentUser?.name || 'MARIOMELOZ').toUpperCase();

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'spots', label: 'Pontos Turísticos', icon: MapPin },
    { id: 'map_icons', label: 'Ícones do mapa', icon: Layers },
    { id: 'services', label: 'Locais e Serviços', icon: Store },
    { id: 'users', label: 'Usuários & Comunidade', icon: Users },
    { id: 'events', label: 'Eventos no Mapa', icon: Calendar },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'cleanup', label: 'Limpeza do Sistema', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900 flex flex-col font-sans antialiased">
      {/* Top Header Bar (Matching screenshot 1) */}
      <header
        className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* Left: Greeting and Clock */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-zinc-900 tracking-tight">
                BOA TARDE, {userName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-black">
              <span>{currentTime}</span>
              <span className="text-zinc-300">•</span>
              <button
                onClick={onExitAdmin}
                className="text-blue-600 font-black hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>VOLTAR AO MAPA</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Weather, Search, Notifications, Profile */}
        <div className="flex items-center gap-3">
          {/* Weather pill */}
          <div className="hidden lg:flex items-center gap-2 bg-zinc-50 border border-zinc-200/80 px-3 py-1.5 rounded-xl text-xs font-black text-zinc-700">
            <CloudSun className="w-4 h-4 text-amber-500" />
            <span>CAMPOS 20°C - Parcialmente nublado</span>
          </div>

          {/* Quick Search */}
          <div className="hidden md:flex items-center gap-2 bg-zinc-50 border border-zinc-200/80 rounded-xl px-3 py-1.5 w-56 lg:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Busque locais, serviços... ⌘K"
              className="w-full text-xs text-zinc-800 bg-transparent outline-none placeholder-zinc-400"
            />
          </div>

          {/* Bell Icon */}
          <button
            type="button"
            className="relative w-9 h-9 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-600 transition-colors cursor-pointer"
            title="Notificações"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600"></span>
          </button>

          {/* User Profile Capsule */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-200">
            <img
              src={currentUser?.avatar_url || '/fotoperfil.png'}
              alt="Avatar"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200"
            />
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-black text-zinc-900 leading-tight">
                {currentUser?.name || 'mariomeloz'}
              </span>
              <span className="text-[10px] font-black text-blue-600 tracking-wider">
                GERENTE
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar (Matching screenshot layout) */}
        <aside className="hidden md:flex w-64 bg-white border-r border-zinc-200/80 flex-col justify-between shrink-0 p-4">
          <div className="space-y-6">
            {/* Logo */}
            <div className="px-3 py-2 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow-sm overflow-hidden p-1.5">
                <img src="/loogo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="block text-sm font-black tracking-tight text-zinc-900">
                  MONVIAN ADM
                </span>
                <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  Campos do Jordão
                </span>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-black shadow-2xs'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar: System Health Card (Matching reference) */}
          <div className="space-y-3 pt-4 border-t border-zinc-100">
            <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-black text-zinc-400 uppercase">
                <span>SAÚDE DO SISTEMA</span>
                <span className="w-2 h-2 rounded-full bg-[#00C896] animate-pulse"></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-[#00C896]">Operacional</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-black">
                Latência: 24ms • Ativo há 12d 4h
              </p>
            </div>

            <button
              onClick={onExitAdmin}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-black transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Aplicativo</span>
            </button>
          </div>
        </aside>

        {/* Mobile Slide-out Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[80vw] bg-white h-full p-5 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow-sm overflow-hidden p-1.5">
                      <img src="/loogo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-black text-sm text-zinc-900">MONVIAN ADM</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 font-black'
                            : 'text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onExitAdmin();
                  }}
                  className="w-full py-2.5 bg-blue-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar ao Monvian</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <AdminDashboard onNavigateTo={(tab) => setActiveTab(tab)} />}
          {activeTab === 'spots' && <AdminSpots />}
          {activeTab === 'map_icons' && <AdminMapIcons />}
          {activeTab === 'services' && <AdminServices />}
          {activeTab === 'users' && <AdminUsers />}
          {activeTab === 'events' && <AdminEvents />}
          {activeTab === 'settings' && <AdminSettings />}
          {activeTab === 'cleanup' && <AdminCleanup />}
        </main>
      </div>
    </div>
  );
};
