import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Home,
  MapPin,
  MapPinned,
  Map,
  Leaf,
  Store,
  Users,
  Settings,
  Menu,
  X,
  ArrowLeft,
  ChevronDown,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useIOSBackEntry } from '../../services/iosNavigationManager';

const AdminDashboard = React.lazy(() =>
  import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminSpots = React.lazy(() =>
  import('./AdminSpots').then((m) => ({ default: m.AdminSpots }))
);
const AdminUsers = React.lazy(() =>
  import('./AdminUsers').then((m) => ({ default: m.AdminUsers }))
);
const AdminSettings = React.lazy(() =>
  import('./AdminSettings').then((m) => ({ default: m.AdminSettings }))
);
const AdminItineraries = React.lazy(() =>
  import('./AdminItineraries').then((m) => ({ default: m.AdminItineraries }))
);
const AdminServices = React.lazy(() =>
  import('./AdminServices').then((m) => ({ default: m.AdminServices }))
);
const AdminPlatanos = React.lazy(() =>
  import('./AdminPlatanos').then((m) => ({ default: m.AdminPlatanos }))
);
const AdminStopIcons = React.lazy(() =>
  import('./AdminStopIcons').then((m) => ({ default: m.AdminStopIcons }))
);
import {
  ADMIN_COLORS,
  ADMIN_MOTION_EASE,
  ADMIN_NAV_3D_STYLE,
  ADMIN_SHADOWS,
} from './adminTheme';

interface AdminLayoutProps {
  currentUser: any;
  onExitAdmin: () => void;
  onLogout?: () => void;
}

interface NavItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'dashboard', label: 'Visão Geral', icon: Home },
  { id: 'spots', label: 'Pontos Turísticos', icon: MapPin },
  { id: 'stop-icons', label: 'Ícones de Pontos de Parada', icon: MapPinned },
  { id: 'itineraries', label: 'Roteiros', icon: Map },
  { id: 'platanos', label: 'Plátanos & Stripe', icon: Leaf },
  { id: 'services', label: 'Locais e Serviços', icon: Store },
  { id: 'users', label: 'Usuários & Comunidade', icon: Users },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

interface Sidebar3DButtonProps {
  item: NavItemDef;
  isActive: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}

const Sidebar3DButton: React.FC<Sidebar3DButtonProps> = ({
  item,
  isActive,
  onClick,
  reducedMotion,
}) => {
  const Icon = item.icon;
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const baseStyle = isActive ? ADMIN_NAV_3D_STYLE.active : ADMIN_NAV_3D_STYLE.normal;

  const computedShadow = isPressed
    ? isActive
      ? '0 3px 10px -3px rgba(22, 104, 255, 0.22), inset 2.5px 0 0 rgba(22, 104, 255, 0.85), inset 0 2px 4px rgba(22, 104, 255, 0.14)'
      : '0 2px 6px -2px rgba(15, 23, 42, 0.08), inset 0 2px 4px rgba(148, 163, 184, 0.18)'
    : isHovered
      ? isActive
        ? '0 14px 28px -6px rgba(22, 104, 255, 0.28), 0 4px 10px -2px rgba(22, 104, 255, 0.14), inset 2.5px 0 0 rgba(22, 104, 255, 0.9), inset 0 1px 1px rgba(255, 255, 255, 0.96), inset 0 -2px 3px rgba(22, 104, 255, 0.12)'
        : '0 11px 22px -6px rgba(30, 58, 138, 0.13), 0 3px 8px -2px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 1), inset 0 -1.5px 2px rgba(148, 163, 184, 0.10)'
      : baseStyle.boxShadow;

  const computedTransform = reducedMotion
    ? 'none'
    : isPressed
      ? 'translateY(1px) scale(0.985)'
      : isHovered
        ? 'translateY(-2.5px)'
        : 'translateY(0px)';

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      aria-current={isActive ? 'page' : undefined}
      className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[19px] text-left cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#1668FF]/40"
      style={{
        ...baseStyle,
        boxShadow: computedShadow,
        transform: computedTransform,
        transition: reducedMotion
          ? 'background 180ms ease, color 180ms ease'
          : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1), background 220ms ease, border-color 220ms ease',
      }}
    >
      <span
        className="w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200"
        style={{ color: isActive ? ADMIN_COLORS.primaryBlue : '#3B4D6B' }}
      >
        <Icon className={`w-[19px] h-[19px] ${isActive ? 'stroke-[2.25]' : 'stroke-[1.85]'}`} />
      </span>
      <span
        className={`text-[14.5px] tracking-[-0.01em] leading-snug truncate transition-colors duration-200 ${
          isActive ? 'font-bold text-[#1668FF]' : 'font-semibold text-[#0D1526]'
        }`}
      >
        {item.label}
      </span>
    </button>
  );
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentUser,
  onExitAdmin,
  onLogout,
}) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [adminTabHistory, setAdminTabHistory] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const handleSelectAdminTab = React.useCallback((nextTab: string) => {
    setActiveTab((prev) => {
      if (prev === nextTab) return prev;
      setAdminTabHistory((hist) => [...hist, prev]);
      return nextTab;
    });
  }, []);

  // Close profile dropdown on outside click or Escape key
  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

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

  const displayName = currentUser?.name || 'Mario Yesk';
  const avatarSrc =
    currentUser?.avatar_url && currentUser.avatar_url !== '/fotoperfil.png'
      ? currentUser.avatar_url
      : (typeof window !== 'undefined' ? localStorage.getItem('monvian_local_avatar') : null) ||
        currentUser?.avatar_url ||
        '/fotoperfil.png';

  return (
    <div
      id="admin-layout-root"
      className="w-full flex overflow-hidden antialiased rounded-t-[26px] ios-page-top-rounded"
      style={{
        backgroundColor:
          activeTab === 'dashboard'
            ? '#F2F6FC'
            : activeTab === 'users' || activeTab === 'itineraries'
              ? '#F6F7F9'
              : ADMIN_COLORS.canvasBg,
        color: ADMIN_COLORS.textPrimary,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif',
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        borderTopLeftRadius: '26px',
        borderTopRightRadius: '26px',
        overflow: 'hidden',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        isolation: 'isolate',
        colorScheme: 'light',
      }}
    >
      {/* Desktop Sidebar (~308px on 1648px reference, adapts cleanly on notebooks) */}
      <aside
        className="hidden md:flex md:w-[272px] lg:w-[292px] xl:w-[308px] shrink-0 bg-white flex-col z-20 overflow-y-auto md:rounded-r-[28px]"
        style={{
          boxShadow: ADMIN_SHADOWS.sidebar,
          paddingTop: 'max(28px, calc(env(safe-area-inset-top, 0px) + 20px))',
          paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
        }}
      >
        {/* Brand Identity Lockup (Original Monvian logo + Monvian / Campos do Jordão) */}
        <div className="px-6 pb-8 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="/minilogo.png"
              alt="Monvian"
              className="w-10 h-10 object-contain select-none"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
          <div className="min-w-0">
            <span className="block text-[21px] font-bold tracking-[-0.03em] text-[#0D1526] leading-tight">
              Monvian
            </span>
            <span className="block text-[12.5px] font-medium text-[#64748B] tracking-[-0.01em] leading-tight mt-0.5">
              Campos do Jordão
            </span>
          </div>
        </div>

        {/* 3D Tactile Navigation Buttons (Exclusively the 7 core pages) */}
        <nav className="px-5 flex-1 space-y-3" aria-label="Navegação administrativa">
          {NAV_ITEMS.map((item) => (
            <Sidebar3DButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => handleSelectAdminTab(item.id)}
              reducedMotion={prefersReducedMotion}
            />
          ))}
        </nav>

        <div className="px-5 pt-4 mt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] text-[14px] font-semibold text-[#475569] hover:text-[#1668FF] hover:bg-[#F2F6FC] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
            <span>Voltar ao App</span>
          </button>
        </div>
      </aside>

      {/* Mobile / Tablet Slide-over Sidebar Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="fixed inset-0 bg-[#0D1526]/30"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={prefersReducedMotion ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? undefined : { x: '-100%' }}
              transition={{ duration: 0.24, ease: ADMIN_MOTION_EASE }}
              className="relative w-[290px] max-w-[84vw] bg-white h-full flex flex-col z-10 rounded-r-[28px] overflow-y-auto"
              style={{
                boxShadow: '20px 0 50px -12px rgba(15, 23, 42, 0.22)',
                paddingTop: 'max(24px, calc(env(safe-area-inset-top, 0px) + 16px))',
                paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
              }}
            >
              <div className="px-5 pb-6 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                    <img
                      src="/minilogo.png"
                      alt="Monvian"
                      className="w-9 h-9 object-contain select-none"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                  </div>
                  <div>
                    <span className="block text-[19px] font-bold tracking-[-0.03em] text-[#0D1526] leading-tight">
                      Monvian
                    </span>
                    <span className="block text-[12px] font-medium text-[#64748B] leading-tight">
                      Campos do Jordão
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Fechar menu"
                  className="p-2 rounded-full text-[#64748B] hover:text-[#0D1526] hover:bg-[#F4F7FC] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="px-4 flex-1 space-y-2.5" aria-label="Navegação administrativa mobile">
                {NAV_ITEMS.map((item) => (
                  <Sidebar3DButton
                    key={item.id}
                    item={item}
                    isActive={activeTab === item.id}
                    onClick={() => {
                      handleSelectAdminTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    reducedMotion={prefersReducedMotion}
                  />
                ))}
              </nav>

              <div className="px-4 pt-4 mt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onExitAdmin();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] text-[14px] font-semibold text-[#475569] hover:text-[#1668FF] hover:bg-[#F2F6FC] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-[18px] h-[18px]" />
                  <span>Voltar ao App</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <main
          id="admin-main-content"
          className="flex-1 overflow-y-auto min-h-0 w-full"
          style={{
            paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))',
            paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
          }}
        >
          <div className="max-w-[1340px] mx-auto px-0.5 sm:px-4 lg:px-8">
            {/* Compact Top Utility Row (Hidden on Dashboard so Dashboard owns its clean reference header without Monvian branding) */}
            {activeTab !== 'dashboard' && (
            <div className="flex items-center justify-between md:justify-end gap-2.5 mb-5">
              {/* Mobile Hamburger + Compact Brand */}
              <div className="flex md:hidden items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Abrir menu administrativo"
                  className="w-11 h-11 rounded-full bg-white border border-black/[0.04] flex items-center justify-center text-[#1C1F26] active:scale-95 transition-transform cursor-pointer shrink-0"
                  style={{
                    boxShadow:
                      '0 6px 18px -6px rgba(15, 23, 42, 0.08), 0 1px 4px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <Menu className="w-[19px] h-[19px] stroke-[2]" />
                </button>
                <div className="flex items-center gap-1.5 min-w-0">
                  <img
                    src="/minilogo.png"
                    alt="Monvian"
                    className="w-7 h-7 object-contain select-none shrink-0"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                  <span className="text-[16px] font-bold tracking-[-0.025em] text-[#181C23] truncate">
                    Monvian
                  </span>
                </div>
              </div>

              {/* Compact Floating Profile Pill Dropdown */}
              <div ref={profileMenuRef} className="relative z-40 shrink-0">
                <button
                  type="button"
                  id="btn-admin-profile-menu"
                  onClick={() => setIsProfileMenuOpen((v) => !v)}
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="menu"
                  className="group flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full bg-white border border-black/[0.04] cursor-pointer select-none transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                  style={{
                    boxShadow:
                      '0 6px 18px -6px rgba(15, 23, 42, 0.08), 0 1px 4px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-black/[0.05] shrink-0"
                  />
                  <span className="text-[13.5px] sm:text-[14.5px] font-semibold text-[#181C23] tracking-[-0.015em] max-w-[116px] sm:max-w-[180px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#4B5563] transition-transform duration-200 shrink-0 ${
                      isProfileMenuOpen ? 'rotate-180 text-[#181C23]' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div
                      role="menu"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: ADMIN_MOTION_EASE }}
                      className="absolute right-0 mt-2.5 w-64 rounded-[22px] bg-white border border-slate-200/80 p-2 z-50 origin-top-right"
                      style={{ boxShadow: ADMIN_SHADOWS.popover }}
                    >
                      <div className="px-3.5 py-2.5 border-b border-slate-100 mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={avatarSrc}
                            alt={displayName}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-bold text-[#0D1526] truncate">
                              {displayName}
                            </p>
                            <p className="text-[11.5px] font-medium text-[#64748B] truncate">
                              {currentUser?.email || 'Administrador Monvian'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        id="btn-admin-back-to-profile"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onExitAdmin();
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-[#0D1526] hover:bg-[#F4F7FC] hover:text-[#1668FF] transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4 text-[#1668FF]" />
                        <span>Voltar ao Perfil</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          handleSelectAdminTab('settings');
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-[#334155] hover:bg-[#F4F7FC] hover:text-[#0D1526] transition-colors cursor-pointer"
                      >
                        <UserIcon className="w-4 h-4 text-[#64748B]" />
                        <span>Configurações da Conta</span>
                      </button>

                      {onLogout && (
                        <div className="mt-1 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              onLogout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sair do Painel</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            )}

            {/* Active Admin Page Container */}
            <Suspense
              fallback={
                <div className="w-full py-16 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
                </div>
              }
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: ADMIN_MOTION_EASE }}
                  className="w-full"
                >
                  {activeTab === 'dashboard' && (
                    <AdminDashboard
                      currentUser={currentUser}
                      onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
                      onOpenFinancialDetails={() => setActiveTab('platanos')}
                    />
                  )}
                  {activeTab === 'spots' && <AdminSpots />}
                  {activeTab === 'stop-icons' && <AdminStopIcons currentUser={currentUser} />}
                  {activeTab === 'itineraries' && <AdminItineraries />}
                  {activeTab === 'platanos' && <AdminPlatanos currentUser={currentUser} />}
                  {activeTab === 'services' && <AdminServices />}
                  {activeTab === 'users' && <AdminUsers />}
                  {activeTab === 'settings' && <AdminSettings />}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};
