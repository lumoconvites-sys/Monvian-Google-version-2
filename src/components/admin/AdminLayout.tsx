import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  ArrowLeft,
  ShieldCheck,
  Compass,
  LogOut,
  ChevronRight,
  Route
} from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { AdminSpots } from './AdminSpots';
import { AdminUsers } from './AdminUsers';
import { AdminEvents } from './AdminEvents';
import { AdminSettings } from './AdminSettings';
import { AdminCleanup } from './AdminCleanup';
import { AdminItineraries } from './AdminItineraries';
import { AdminServices } from './AdminServices';
import { useIOSBackEntry } from '../../services/iosNavigationManager';

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
  const [adminTabHistory, setAdminTabHistory] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const handleSelectAdminTab = React.useCallback((nextTab: string) => {
    setActiveTab((prev) => {
      if (prev === nextTab) return prev;
      setAdminTabHistory((hist) => [...hist, prev]);
      return nextTab;
    });
  }, []);

  // Register iOS Edge-Swipe Back Gesture for internal Admin tabs
  useIOSBackEntry({
    id: `admin:tab:${activeTab}`,
    enabled: adminTabHistory.length > 0,
    priority: 175,
    label: 'Painel ADM',
    foregroundSelector: '#admin-main-content',
    backgroundSelector: '#admin-layout-root',
    onPop: () => {
      setAdminTabHistory((hist) => {
        if (hist.length === 0) return hist;
        const nextHist = [...hist];
        const prevTab = nextHist.pop() || 'dashboard';
        setActiveTab(prevTab);
        return nextHist;
      });
    },
  });

  // Register iOS Edge-Swipe Back Gesture to exit Admin back to the main app
  useIOSBackEntry({
    id: 'admin:root',
    enabled: true,
    priority: 170,
    label: 'Voltar ao App',
    foregroundSelector: '#admin-layout-root',
    backgroundSelector: '#app-root-shell',
    onPop: () => {
      onExitAdmin();
    },
  });

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
    { id: 'itineraries', label: 'Roteiros', icon: Route },
    { id: 'services', label: 'Locais e Serviços', icon: Store },
    { id: 'users', label: 'Usuários & Comunidade', icon: Users },
    { id: 'events', label: 'Eventos', icon: Calendar },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'cleanup', label: 'Limpeza do Sistema', icon: Sparkles },
  ];

  return (
    <div
      id="admin-layout-root"
      className="w-full bg-[#f8fafc] dark:bg-[#000000] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans antialiased overflow-hidden rounded-t-[26px] ios-page-top-rounded"
      style={{
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        borderTopLeftRadius: '26px',
        borderTopRightRadius: '26px',
        overflow: 'hidden',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        isolation: 'isolate',
      }}
    >
      {/* Top Header Bar */}
      <header
        className="shrink-0 z-40 bg-white dark:bg-[#000000] border-b border-zinc-200/80 dark:border-[#262626] px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs rounded-t-[26px]"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          borderTopLeftRadius: '26px',
          borderTopRightRadius: '26px',
        }}
      >
        {/* Left: Greeting and Clock */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white tracking-tight">
                BOA TARDE, {userName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-400 font-black">
              <span>{currentTime}</span>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <button
                type="button"
                onClick={onExitAdmin}
                className="text-blue-600 dark:text-blue-400 font-black hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>VOLTAR AO PERFIL</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions and Profile */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="btn-admin-back-to-profile"
            onClick={onExitAdmin}
            onTouchEnd={(e) => {
              e.preventDefault();
              onExitAdmin();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 text-white dark:text-zinc-900 font-black text-xs shadow-xs transition-all cursor-pointer pointer-events-auto z-30"
            title="Voltar ao Perfil"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Voltar ao Perfil</span>
          </button>

          {/* User Profile Capsule */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-700">
            <img
              src={
                currentUser?.avatar_url && currentUser.avatar_url !== '/fotoperfil.png'
                  ? currentUser.avatar_url
                  : (typeof window !== 'undefined' ? localStorage.getItem('monvian_local_avatar') : null) ||
                    currentUser?.avatar_url ||
                    '/fotoperfil.png'
              }
              alt="Avatar"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
            />
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-black text-zinc-900 dark:text-zinc-100 leading-tight">
                {currentUser?.name || 'mariomeloz'}
              </span>
              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 tracking-wider">
                GERENTE
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Sidebar (Matching screenshot layout) */}
        <aside className="hidden md:flex w-64 bg-white dark:bg-[#000000] border-r border-zinc-200/80 dark:border-[#262626] flex-col justify-between shrink-0 p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Logo */}
            <div className="px-3 py-2 flex items-center gap-2.5">
              <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center shadow-sm overflow-hidden p-1.5">
                <img src="/logomodoescuro.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="block text-sm font-black tracking-tight text-zinc-900 dark:text-white">
                  MONVIAN ADM
                </span>
                <span className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
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
                    onClick={() => handleSelectAdminTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar: System Health Card (Matching reference) */}
          <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase">
                <span>SAÚDE DO SISTEMA</span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400">Operacional</span>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black">
                Latência: 24ms • Ativo há 12d 4h
              </p>
            </div>

            <button
              type="button"
              onClick={onExitAdmin}
              onTouchEnd={(e) => {
                e.preventDefault();
                onExitAdmin();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-black transition-colors cursor-pointer pointer-events-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Voltar ao Perfil</span>
            </button>
          </div>
        </aside>

        {/* Mobile Slide-out Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div 
              className="relative w-72 max-w-[80vw] bg-white dark:bg-[#000000] border-r dark:border-[#262626] h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200"
              style={{
                paddingTop: 'max(24px, calc(env(safe-area-inset-top, 0px) + 16px))',
                paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
                paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
              }}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center shadow-sm overflow-hidden p-1.5">
                      <img src="/logomodoescuro.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-black text-sm text-zinc-900 dark:text-white">MONVIAN ADM</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
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
                          handleSelectAdminTab(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
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
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onExitAdmin();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onExitAdmin();
                  }}
                  className="w-full py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                  <span>Voltar ao Perfil</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Content Area with Full Scroll & Safe Bottom Padding */}
        <main 
          id="admin-main-content"
          className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0 max-w-7xl mx-auto w-full"
          style={{
            paddingBottom: 'max(128px, calc(env(safe-area-inset-bottom, 0px) + 96px))',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full"
            >
              {activeTab === 'dashboard' && <AdminDashboard onNavigateTo={(tab) => handleSelectAdminTab(tab)} />}
              {activeTab === 'spots' && <AdminSpots />}
              {activeTab === 'itineraries' && <AdminItineraries />}
              {activeTab === 'services' && <AdminServices />}
              {activeTab === 'users' && <AdminUsers />}
              {activeTab === 'events' && <AdminEvents />}
              {activeTab === 'settings' && <AdminSettings />}
              {activeTab === 'cleanup' && <AdminCleanup />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
