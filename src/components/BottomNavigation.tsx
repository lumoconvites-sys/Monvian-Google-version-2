import React, { useState, useRef, memo } from 'react';
import { motion } from 'motion/react';
import { GlassView } from 'expo-glass-effect';
import { NavAgoraIcon, NavSalvosIcon, NavSearchIcon, NavProfileIcon, NavRoteirosIcon } from './NavIcons';

export type TabType = 'explorar' | 'roteiros' | 'salvos' | 'buscar' | 'perfil';

export interface BottomNavigationProps {
  activeTab: TabType | 'chat'; // support 'chat' for backward compatibility
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  isBlurred?: boolean;
  forceWhiteUI?: boolean;
  theme?: 'dark' | 'light';
}

const TABS: { id: TabType; label: string }[] = [
  { id: 'roteiros', label: 'Roteiros' },
  { id: 'salvos', label: 'Salvos' },
  { id: 'explorar', label: 'Explorar' },
  { id: 'buscar', label: 'Buscar' },
  { id: 'perfil', label: 'Perfil' },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = memo(({
  activeTab,
  onChangeTab,
  isBlurred = false,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [pulseAnimation, setPulseAnimation] = useState<number>(0);

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartTimeRef = useRef<number>(0);

  // Remapeia 'chat' antigo para 'salvos' caso persista no estado anterior
  const normalizedActiveTab: TabType = (activeTab as string) === 'chat' ? 'salvos' : (activeTab as TabType);
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === normalizedActiveTab));

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartTimeRef.current = performance.now();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerDownPosRef.current || e.pointerType === 'mouse') return;
    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
    const dt = performance.now() - dragStartTimeRef.current;
    pointerDownPosRef.current = null;

    // Fast horizontal swipe gesture across the bar
    if (Math.abs(dx) > 42 && dy < 36 && dt < 450) {
      const targetIndex = dx > 0
        ? Math.min(TABS.length - 1, activeIndex + 1)
        : Math.max(0, activeIndex - 1);
      const targetTab = TABS[targetIndex]?.id;
      if (targetTab && targetTab !== normalizedActiveTab) {
        if (targetTab === 'explorar') {
          setPulseAnimation((prev) => prev + 360);
        }
        onChangeTab(targetTab);
      }
    }
  };

  const handleTabClick = (tabId: TabType) => {
    if (tabId === 'explorar') {
      setPulseAnimation((prev) => prev + 360);
    }
    // Always trigger onChangeTab so clicking any tab immediately closes
    // all open detail sheets, modals, and switches views seamlessly
    onChangeTab(tabId);
  };

  return (
    <nav
      id="bottom-floating-navigation"
      aria-label="Navegação Principal"
      className={`fixed inset-x-0 bottom-0 z-[250] flex justify-center select-none px-4 pointer-events-none transition-[opacity,transform,filter] duration-[200ms] ease-out ${
        isBlurred
          ? 'opacity-40 scale-[0.98] blur-[6px] [&_*]:!pointer-events-none'
          : 'opacity-100 scale-100 blur-0'
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerDownPosRef.current = null; }}
      style={{
        touchAction: 'manipulation',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        margin: 0,
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: '0px',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
    >
      {/* Capsule with expo-glass-effect iOS Liquid Glass finish */}
      <GlassView
        variant="bar"
        glassEffectStyle="regular"
        isInteractive
        className="w-full max-w-[326px] sm:max-w-[342px] h-[62px] sm:h-[64px] p-[5.5px] pointer-events-auto relative rounded-full"
        style={{
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        {/* Inner track with 5 uniform slots and hardware-accelerated sliding selection capsule */}
        <div className="relative w-full h-full grid grid-cols-5 items-center z-10">
          {/* Active Option Selection Capsule */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/5 pointer-events-none z-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
              WebkitTransform: `translate3d(${activeIndex * 100}%, 0, 0)`,
              willChange: 'transform',
            }}
          >
            <GlassView
              variant="pill"
              glassEffectStyle="regular"
              className="w-full h-full rounded-full"
            />
          </div>

          {TABS.map((tab) => {
            const isActive = normalizedActiveTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`nav-btn-${tab.id}`}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative z-10 w-full h-full min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center cursor-pointer select-none active:scale-[0.94] transition-[transform,color,opacity] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 ${
                  isDark
                    ? isActive
                      ? 'text-[#FFFFFF] opacity-100 focus-visible:ring-white/30'
                      : 'text-[#FFFFFF] opacity-75 hover:opacity-100 focus-visible:ring-white/30'
                    : isActive
                      ? 'text-[#000000] opacity-100 focus-visible:ring-black/20'
                      : 'text-[#000000] opacity-70 hover:opacity-100 focus-visible:ring-black/20'
                }`}
                style={{
                  color: isDark ? '#FFFFFF' : '#000000',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                <motion.div
                  initial={false}
                  animate={{
                    rotate: tab.id === 'explorar' ? pulseAnimation : 0,
                  }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="w-[24px] h-[24px] flex items-center justify-center shrink-0"
                >
                  {tab.id === 'roteiros' && <NavRoteirosIcon size={24} className="text-current" />}
                  {tab.id === 'salvos' && <NavSalvosIcon size={24} className="text-current" />}
                  {tab.id === 'explorar' && <NavAgoraIcon size={24} className="text-current" />}
                  {tab.id === 'buscar' && <NavSearchIcon size={24} className="text-current" />}
                  {tab.id === 'perfil' && <NavProfileIcon size={24} className="text-current" />}
                </motion.div>
              </button>
            );
          })}
        </div>
      </GlassView>
    </nav>
  );
});


