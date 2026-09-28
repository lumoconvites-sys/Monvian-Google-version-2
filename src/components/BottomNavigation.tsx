import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavAgoraIcon, NavChatIcon, NavSearchIcon, NavProfileIcon, NavRoteirosIcon } from './NavIcons';

export type TabType = 'explorar' | 'roteiros' | 'chat' | 'buscar' | 'perfil';

export interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  isBlurred?: boolean;
  forceWhiteUI?: boolean;
  theme?: 'dark' | 'light';
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 2,
  isBlurred = false,
  forceWhiteUI = false,
  theme = 'dark',
}) => {
  const isUserGold = Boolean(
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
        const cleanEmail = (u.email || u.whatsapp || '').trim().toLowerCase();
        const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail);
        return isGoldAdmin || Boolean(u.isGold || u.is_gold === 1 || u.isPremium || u.is_premium === 1);
      } catch {
        return false;
      }
    })()
  );
  const [pulseAnimation, setPulseAnimation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabRects, setTabRects] = useState<{ left: number; width: number; center: number }[]>([]);

  const startXRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'explorar', label: 'Explorar' },
    { id: 'roteiros', label: 'Roteiros' },
    { id: 'chat', label: 'Chat' },
    { id: 'buscar', label: 'Buscar' },
    { id: 'perfil', label: 'Perfil' },
  ];

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const updateTabRects = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const rects = tabRefs.current.map((el) => {
      if (!el) return { left: 0, width: 0, center: 0 };
      const rect = el.getBoundingClientRect();
      const left = rect.left - containerRect.left;
      return { left, width: rect.width, center: left + rect.width / 2 };
    });
    setTabRects(rects);
  };

  useLayoutEffect(() => {
    updateTabRects();
    window.addEventListener('resize', updateTabRects);
    return () => window.removeEventListener('resize', updateTabRects);
  }, []);

  useEffect(() => {
    updateTabRects();
  }, [activeTab]);

  const activeRect = tabRects[activeIndex] || { left: 0, width: 58, center: 29 };
  const currentPillCenterX = activeRect.center + (isDragging ? dragOffset : 0);

  // Identify preview tab during drag
  const previewIndex = tabRects.reduce((closestIdx, rect, idx) => {
    const dist = Math.abs(rect.center - currentPillCenterX);
    const closestDist = Math.abs(tabRects[closestIdx].center - currentPillCenterX);
    return dist < closestDist ? idx : closestIdx;
  }, activeIndex);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only engage drag logic on touch devices to prevent interfering with mouse clicks on desktop
    if (e.pointerType === 'mouse') return;
    e.stopPropagation();
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    startXRef.current = e.clientX;
    dragStartTimeRef.current = Date.now();
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || e.pointerType === 'mouse') return;
    e.stopPropagation();

    const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
    const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
    if (dx > 12) {
      hasMovedRef.current = true;
    }

    if (hasMovedRef.current) {
      const deltaX = e.clientX - startXRef.current;
      const minOffset = tabRefs.current[0] ? tabRefs.current[0].getBoundingClientRect().left - activeRect.left - 20 : -180;
      const maxOffset = tabRefs.current[tabs.length - 1] ? tabRefs.current[tabs.length - 1].getBoundingClientRect().left - activeRect.left + 20 : 180;
      const clamped = Math.max(minOffset, Math.min(maxOffset, deltaX));
      setDragOffset(clamped);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (!hasMovedRef.current) {
      setDragOffset(0);
      return;
    }

    const dt = Date.now() - dragStartTimeRef.current;
    const velocity = dt > 0 ? dragOffset / dt : 0;

    let targetIndex = activeIndex;
    if (velocity > 0.4 && dragOffset > 15) {
      targetIndex = Math.min(tabs.length - 1, activeIndex + 1);
    } else if (velocity < -0.4 && dragOffset < -15) {
      targetIndex = Math.max(0, activeIndex - 1);
    } else {
      const finalCenterX = activeRect.center + dragOffset;
      targetIndex = tabRects.reduce((closestIdx, rect, idx) => {
        const dist = Math.abs(rect.center - finalCenterX);
        const closestDist = Math.abs(tabRects[closestIdx].center - finalCenterX);
        return dist < closestDist ? idx : closestIdx;
      }, activeIndex);
    }

    setDragOffset(0);
    const targetTab = tabs[targetIndex].id;
    if (targetTab !== activeTab) {
      if (targetTab === 'explorar') {
        setPulseAnimation((prev) => prev + 360);
      }
      onChangeTab(targetTab);
    }
  };

  const handleTabClick = (tabId: TabType) => {
    if (tabId === 'explorar') {
      setPulseAnimation((prev) => prev + 360);
    }
    onChangeTab(tabId);
  };

  return (
    <>
      {/* 0. Translucent Glassmorphism Protection Scrim behind the bottom bar
          Active ONLY on the four screens that use the bottom navigation (Roteiros, Chat, Buscar, Perfil).
          Preserves the main map view (Explorar) completely free of any overlay, blur, or mask. */}
      <AnimatePresence>
        {activeTab !== 'explorar' && (
          <motion.div
            key="bottom-nav-protection-layer"
            id="bottom-nav-protection-layer"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-0 bottom-0 pointer-events-none z-48 select-none overflow-hidden"
            style={{
              height: 'calc(max(8px, env(safe-area-inset-bottom, 8px)) + 76px)',
              background:
                theme === 'light'
                  ? 'linear-gradient(to top, rgba(242, 242, 245, 0.46) 0%, rgba(242, 242, 245, 0.38) 45%, rgba(242, 242, 245, 0.18) 75%, rgba(242, 242, 245, 0) 100%)'
                  : 'linear-gradient(to top, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.38) 45%, rgba(0, 0, 0, 0.20) 75%, rgba(0, 0, 0, 0) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              maskImage:
                'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage:
                'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0) 100%)',
              boxShadow: 'none',
            }}
          />
        )}
      </AnimatePresence>

      <nav
        id="bottom-floating-navigation"
        aria-label="Navegação Principal"
        className={`fixed inset-x-0 bottom-0 z-50 flex justify-center select-none font-['Manrope'] px-3 pb-0 transition-[filter,opacity,transform] duration-200 ease-out ${
          isBlurred
            ? 'pointer-events-none filter blur-sm opacity-35 scale-[0.98]'
            : 'pointer-events-auto filter-none opacity-100 scale-100'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          touchAction: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          margin: 0,
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        }}
      >
        {/* Bottom Navigation Capsule Bar - Exact horizontal width matching tourist spot card */}
        <div
          ref={containerRef}
          className={`w-full max-w-[calc(768px-32px)] flex items-center justify-around px-2 sm:px-3 py-1.5 mb-0 rounded-full relative overflow-hidden transition-all duration-300 shadow-none ${
            forceWhiteUI
              ? 'ios-glass-nav-white border border-white/80'
              : 'ios-glass-nav border border-white/20 dark:border-white/15'
          }`}
          style={{
            marginBottom: 0,
            boxShadow: 'none',
          }}
        >
        {/* Active Tab Pill Indicator with Smooth Drag & Spring Snap */}
        {tabRects.length > 0 && (
          <motion.div
            className={`absolute rounded-full -z-10 pointer-events-none transition-colors duration-300 shadow-none ${
              forceWhiteUI
                ? 'bg-black/[0.08] border border-black/[0.06]'
                : 'bg-white/[0.14] dark:bg-white/[0.15] border border-white/25 dark:border-white/20'
            }`}
            style={{
              top: 3,
              bottom: 3,
              width: Math.max(0, activeRect.width - 4),
              left: activeRect.left + 2,
            }}
            animate={
              isDragging
                ? { x: dragOffset, transition: { duration: 0 } }
                : { x: 0, transition: { type: 'spring', stiffness: 500, damping: 35 } }
            }
          />
        )}

        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const isPreviewHovered = isDragging && previewIndex === idx;

          // Compute text/icon colors based on forceWhiteUI vs dark mode
          const activeColorClass = forceWhiteUI
            ? 'text-zinc-950 scale-100 opacity-100 font-extrabold'
            : 'text-zinc-800 dark:text-white scale-100 opacity-100 font-extrabold';

          const inactiveColorClass = forceWhiteUI
            ? 'text-zinc-500 opacity-80 font-medium hover:text-zinc-950'
            : 'text-zinc-400 dark:text-zinc-400 opacity-80 font-medium hover:text-zinc-700 dark:hover:text-zinc-200';

          const labelActiveColor = forceWhiteUI
            ? 'font-extrabold text-zinc-950'
            : 'font-extrabold text-zinc-900 dark:text-white';

          const labelInactiveColor = forceWhiteUI
            ? 'font-medium text-zinc-500'
            : 'font-medium text-zinc-400 dark:text-zinc-400';

          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[idx] = el; }}
              id={`nav-btn-${tab.id}`}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              className="relative flex flex-col items-center justify-center w-[60px] sm:w-[68px] h-[48px] sm:h-[50px] rounded-full cursor-pointer z-10 select-none hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            >
              {/* 1. Agora Icon */}
              {tab.id === 'explorar' && (
                <div
                  className={`w-6.5 h-6.5 flex items-center justify-center mb-0.5 transition-all ${
                    isActive || isPreviewHovered ? activeColorClass : inactiveColorClass
                  }`}
                >
                  <motion.div
                    animate={{ rotate: pulseAnimation }}
                    transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                    className="w-6 h-6 flex items-center justify-center"
                  >
                    <NavAgoraIcon size={23} className="w-full h-full text-current" />
                  </motion.div>
                </div>
              )}

              {/* 2. Roteiros Icon */}
              {tab.id === 'roteiros' && (
                <div
                  className={`w-6.5 h-6.5 flex items-center justify-center mb-0.5 transition-all ${
                    isActive || isPreviewHovered ? activeColorClass : inactiveColorClass
                  }`}
                >
                  <NavRoteirosIcon size={22} className="w-5.5 h-5.5 text-current" />
                </div>
              )}

              {/* 3. Chat Icon */}
              {tab.id === 'chat' && (
                <div
                  className={`relative w-6.5 h-6.5 flex items-center justify-center mb-0.5 transition-all ${
                    isActive || isPreviewHovered ? activeColorClass : inactiveColorClass
                  }`}
                >
                  <NavChatIcon size={22} className="w-5.5 h-5.5 text-current" />
                  {unreadCount > 0 && (
                    <span className={`absolute -top-0.5 right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#16181d] shadow-xs ${
                      isUserGold ? 'bg-[#F5BE38]' : 'bg-blue-600'
                    }`} />
                  )}
                </div>
              )}

              {/* 3. Buscar Icon */}
              {tab.id === 'buscar' && (
                <div
                  className={`w-6.5 h-6.5 flex items-center justify-center mb-0.5 transition-all ${
                    isActive || isPreviewHovered ? activeColorClass : inactiveColorClass
                  }`}
                >
                  <NavSearchIcon size={22} className="w-5.5 h-5.5 text-current" />
                </div>
              )}

              {/* 4. Perfil Icon */}
              {tab.id === 'perfil' && (
                <div
                  className={`w-6.5 h-6.5 flex items-center justify-center mb-0.5 transition-all ${
                    isActive || isPreviewHovered ? activeColorClass : inactiveColorClass
                  }`}
                >
                  <NavProfileIcon size={22} className="w-5.5 h-5.5 text-current" />
                </div>
              )}

              <span
                className={`font-['Manrope'] text-[11px] leading-tight tracking-tight select-none transition-all ${
                  isActive || isPreviewHovered ? labelActiveColor : labelInactiveColor
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  </>
  );
};
