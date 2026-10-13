import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavAgoraIcon, NavChatIcon, NavSalvosIcon, NavSearchIcon, NavProfileIcon, NavRoteirosIcon } from './NavIcons';

export type TabType = 'explorar' | 'roteiros' | 'salvos' | 'buscar' | 'perfil';

export interface BottomNavigationProps {
  activeTab: TabType | 'chat'; // support 'chat' for backward compatibility
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  isBlurred?: boolean;
  forceWhiteUI?: boolean;
  theme?: 'dark' | 'light';
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
  isBlurred = false,
  forceWhiteUI = false,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light' && !forceWhiteUI;
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

  // Remapeia 'chat' antigo para 'salvos' caso persista no estado anterior
  const normalizedActiveTab: TabType = (activeTab as string) === 'chat' ? 'salvos' : (activeTab as TabType);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'roteiros', label: 'Roteiros' },
    { id: 'explorar', label: 'Explorar' },
    { id: 'salvos', label: 'Salvos' },
    { id: 'buscar', label: 'Buscar' },
    { id: 'perfil', label: 'Perfil' },
  ];

  const activeIndex = tabs.findIndex((t) => t.id === normalizedActiveTab);


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

  const isRoteirosPage = activeTab === 'roteiros';

  return (
    <>
      <nav
        id="bottom-floating-navigation"
        aria-label="Navegação Principal"
        className={`fixed inset-x-0 bottom-0 z-50 flex justify-center select-none font-['Inter'] px-3 pointer-events-none transition-[filter,opacity,transform] duration-200 ease-out ${
          isBlurred
            ? 'filter blur-sm opacity-35 scale-[0.98]'
            : 'filter-none opacity-100 scale-100'
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
          paddingBottom:
            activeTab === 'chat'
              ? 'max(6px, calc(env(safe-area-inset-bottom, 0px) + 6px))'
              : 'max(22px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
        }}
      >
        {/* Bottom Navigation Bar */}
        <div
          ref={containerRef}
          className={`w-full max-w-[430px] sm:max-w-[460px] pointer-events-auto flex items-center justify-around px-2 sm:px-3 py-1 relative overflow-hidden rounded-full transition-all duration-300 bg-white dark:bg-zinc-900 ${
            isDark
              ? 'text-white border border-white/15'
              : 'text-zinc-900 border border-zinc-200/80'
          }`}
          style={{
            boxShadow: isDark
              ? '0 12px 36px -4px rgba(0, 0, 0, 0.5)'
              : '0 4px 24px -2px rgba(0, 0, 0, 0.08)',
          }}
        >
        {tabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const isPreviewHovered = isDragging && previewIndex === idx;

          // Colors adapted from image 2 buttons: active is crisp high-contrast, inactive is subtle translucent
          const activeColorClass = isDark
            ? 'text-white scale-100 opacity-100 font-black'
            : 'text-zinc-950 scale-100 opacity-100 font-black';

          const inactiveColorClass = isDark
            ? 'text-zinc-300/80 opacity-80 font-medium'
            : 'text-zinc-700/80 opacity-80 font-medium';

          const labelActiveColor = isDark
            ? 'font-black text-white'
            : 'font-black text-zinc-950';

          const labelInactiveColor = isDark
            ? 'font-semibold text-zinc-300/80'
            : 'font-semibold text-zinc-700/80';

          return (
            <motion.button
              key={tab.id}
              ref={(el) => { tabRefs.current[idx] = el; }}
              id={`nav-btn-${tab.id}`}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              title={tab.label}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`relative flex flex-col items-center justify-center w-[60px] sm:w-[68px] h-[48px] sm:h-[50px] rounded-full cursor-pointer z-10 select-none ${
                isRoteirosPage
                  ? isDark
                    ? 'hover:bg-white/10'
                    : 'hover:bg-black/5'
                  : isDark
                    ? 'hover:bg-white/5'
                    : 'hover:bg-black/5'
              }`}
            >
              {/* Icon logic stays the same but cleaner */}
              <motion.div
                initial={false}
                animate={{ 
                  scale: isActive ? 1.05 : 1,
                  color: isActive ? (isDark ? '#ffffff' : '#000000') : (isDark ? '#a1a1aa' : '#71717a')
                }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="w-6.5 h-6.5 flex items-center justify-center mb-0.5"
              >
                  {/* Inside: Icons logic */}
                  {tab.id === 'explorar' && <NavAgoraIcon size={23} className="text-current" />}
                  {tab.id === 'roteiros' && <NavRoteirosIcon size={22} className="text-current" />}
                  {tab.id === 'salvos' && <NavSalvosIcon size={22} filled={isActive} className="text-current" />}
                  {tab.id === 'buscar' && <NavSearchIcon size={22} className="text-current" />}
                  {tab.id === 'perfil' && <NavProfileIcon size={22} className="text-current" />}
              </motion.div>

              <motion.span
                animate={{ 
                  color: isActive ? (isDark ? '#ffffff' : '#000000') : (isDark ? '#a1a1aa' : '#71717a')
                }}
                className="font-['Inter'] text-[11px] leading-tight tracking-tight select-none"
              >
                {tab.label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  </>
  );
};
