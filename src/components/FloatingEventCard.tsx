import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag } from 'lucide-react';
import { triggerHapticFeedback } from '../utils/haptics';
import { playPinTapSound } from '../utils/sound';

export interface MonvianMapEvent {
  id: string;
  name: string;
  image: string;
  description: string;
  date: string;
  time?: string;
  start_time?: string;
  end_time?: string;
  cost_price?: string;
  linked_spot_id?: string;
  linked_spot_name?: string;
  lat: number;
  lng: number;
  address?: string;
  status: 'published' | 'draft' | string;
}

interface FloatingEventCardProps {
  visible?: boolean;
  onActiveChange?: (hasActiveEvents: boolean) => void;
}

const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=900&q=80';

let cachedFloatingEvents: MonvianMapEvent[] = [];
let cachedFloatingIndex = 0;
let cachedFloatingIsDismissed = false;

if (typeof window !== 'undefined') {
  window.addEventListener('monvian:user_logged_out', () => {
    cachedFloatingEvents = [];
    cachedFloatingIndex = 0;
    cachedFloatingIsDismissed = false;
  });
}

export const FloatingEventCard: React.FC<FloatingEventCardProps> = ({
  visible = true,
  onActiveChange,
}) => {
  const [events, setEvents] = useState<MonvianMapEvent[]>(() => cachedFloatingEvents);
  const [currentIndex, setCurrentIndex] = useState<number>(() => cachedFloatingIndex);
  const [slideDirection, setSlideDirection] = useState<number>(1);
  const [capsuleWidth, setCapsuleWidth] = useState<number | null>(null);
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => cachedFloatingIsDismissed);
  const [dismissDirection, setDismissDirection] = useState<'right' | 'down'>('right');
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    cachedFloatingIndex = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    cachedFloatingIsDismissed = isDismissed;
  }, [isDismissed]);

  const fetchPublishedEvents = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    try {
      const res = await fetch('/api/events', { signal: controller.signal });
      if (!res.ok || controller.signal.aborted) return;
      const data = await res.json();
      if (!controller.signal.aborted && data && data.success && Array.isArray(data.events)) {
        cachedFloatingEvents = data.events;
        setEvents(data.events);
        setCurrentIndex((prev) =>
          data.events.length > 0 ? Math.min(prev, data.events.length - 1) : 0
        );
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[FloatingEventCard] Failed to fetch published events:', err);
      }
    }
  }, []);

  useEffect(() => {
    fetchPublishedEvents();
    const handleEventsUpdated = () => {
      fetchPublishedEvents();
    };
    window.addEventListener('monvian:events_updated', handleEventsUpdated);
    window.addEventListener('focus', handleEventsUpdated);
    return () => {
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
      window.removeEventListener('monvian:events_updated', handleEventsUpdated);
      window.removeEventListener('focus', handleEventsUpdated);
    };
  }, [fetchPublishedEvents]);

  useEffect(() => {
    onActiveChange?.(events.length > 0);
  }, [events.length, onActiveChange]);

  // Synchronize exact horizontal width with #bottom-navigation-capsule
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const measureBottomNavWidth = () => {
      const navCapsule = document.getElementById('bottom-navigation-capsule');
      if (navCapsule) {
        const rect = navCapsule.getBoundingClientRect();
        if (rect.width > 0) {
          setCapsuleWidth(Math.round(rect.width * 10) / 10);
        }
      }
    };

    measureBottomNavWidth();

    let resizeObserver: ResizeObserver | null = null;
    const navCapsule = document.getElementById('bottom-navigation-capsule');
    if (navCapsule && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        measureBottomNavWidth();
      });
      resizeObserver.observe(navCapsule);
    }

    window.addEventListener('resize', measureBottomNavWidth, { passive: true });
    window.addEventListener('orientationchange', measureBottomNavWidth, { passive: true });
    const t1 = window.setTimeout(measureBottomNavWidth, 120);
    const t2 = window.setTimeout(measureBottomNavWidth, 450);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureBottomNavWidth);
      window.removeEventListener('orientationchange', measureBottomNavWidth);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visible, events.length]);

  // Smooth automatic horizontal rotation when multiple published events exist
  useEffect(() => {
    if (!visible || events.length <= 1) return;
    const interval = window.setInterval(() => {
      setSlideDirection(1);
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [visible, events.length]);

  const activeEvent = events[currentIndex] || null;

  const handleFocusEventOnMap = (evt: MonvianMapEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      triggerHapticFeedback(12);
      playPinTapSound();
    } catch {}

    window.dispatchEvent(
      new CustomEvent('monvian:focus_map_event', {
        detail: {
          id: evt.id,
          name: evt.name,
          image: evt.image,
          lat: Number(evt.lat),
          lng: Number(evt.lng),
          linked_spot_id: evt.linked_spot_id || '',
          address: evt.address || '',
        },
      })
    );
  };


  const formatTimeLine = (evt: MonvianMapEvent): string => {
    if (evt.start_time && evt.end_time) {
      return `${evt.start_time} às ${evt.end_time}`;
    }
    if (evt.start_time) return evt.start_time;
    if (evt.time) return evt.time;
    return 'Hoje';
  };

  const [flagTopPx, setFlagTopPx] = useState<number | null>(null);

  // Align the minimized event flag icon directly below the right-side map controls (+, -, compass, layers) with the same 12px (gap-3) spacing
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const updateFlagAlignment = () => {
      const controlsEl = document.getElementById('mobile-map-right-controls');
      if (controlsEl) {
        const rect = controlsEl.getBoundingClientRect();
        if (rect.height > 0) {
          setFlagTopPx(Math.round(rect.bottom + 12));
        }
      }
    };

    updateFlagAlignment();
    window.addEventListener('resize', updateFlagAlignment, { passive: true });
    window.addEventListener('orientationchange', updateFlagAlignment, { passive: true });
    const t1 = window.setTimeout(updateFlagAlignment, 60);
    const t2 = window.setTimeout(updateFlagAlignment, 250);

    return () => {
      window.removeEventListener('resize', updateFlagAlignment);
      window.removeEventListener('orientationchange', updateFlagAlignment);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visible, isDismissed, events.length]);

  const shouldRender = Boolean(visible && activeEvent);

  return (
    <AnimatePresence mode="wait">
      {shouldRender && activeEvent && isDismissed && (
        <motion.div
          key="monvian-floating-event-flag-capsule"
          initial={{ opacity: 0, scale: 0.84 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.84 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{
            top: flagTopPx !== null ? `${flagTopPx}px` : 'calc(50% + 126px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
          className="md:hidden fixed right-3.5 z-[55] flex flex-col items-center select-none pointer-events-none"
        >
          <button
            type="button"
            aria-label={`Ver evento: ${activeEvent.name}`}
            onClick={(e) => {
              e.stopPropagation();
              try {
                triggerHapticFeedback(12);
                playPinTapSound();
              } catch {}
              setIsDismissed(false);
            }}
            className="pointer-events-auto w-12 h-12 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.22)] flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <Flag className="w-5 h-5 text-amber-500 fill-amber-500 stroke-[2.2]" />
          </button>
        </motion.div>
      )}

      {shouldRender && activeEvent && !isDismissed && (
        <motion.div
          key="monvian-floating-event-card-wrapper"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={
            !visible
              ? { opacity: 0, scale: 0.92, y: 6, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }
              : dismissDirection === 'down'
                ? { opacity: 0, y: 110, scale: 0.86, transition: { duration: 0.28, ease: [0.32, 1, 0.23, 1] } }
                : { opacity: 0, x: 260, scale: 0.86, transition: { duration: 0.28, ease: [0.32, 1, 0.23, 1] } }
          }
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{
            bottom: '84px',
          }}
          className="md:hidden fixed inset-x-0 z-[55] flex justify-center px-4 select-none pointer-events-none"
        >
          <motion.div
            drag
            dragConstraints={{ left: 0, top: 0, right: 0, bottom: 0 }}
            dragElastic={{ top: 0.08, left: 0.08, right: 0.75, bottom: 0.75 }}
            onDragEnd={(_e, info) => {
              const isSwipeDown = info.offset.y > 35 || info.velocity.y > 180;
              const isSwipeRight = info.offset.x > 45 || info.velocity.x > 200;
              const isSwipeLeft = info.offset.x < -45 || info.velocity.x < -200;

              if (isSwipeDown) {
                try {
                  triggerHapticFeedback(12);
                } catch {}
                setDismissDirection('down');
                setIsDismissed(true);
              } else if (isSwipeRight) {
                try {
                  triggerHapticFeedback(12);
                } catch {}
                setDismissDirection('right');
                setIsDismissed(true);
              } else if (isSwipeLeft && events.length > 1) {
                try {
                  triggerHapticFeedback(8);
                } catch {}
                setSlideDirection(1);
                setCurrentIndex((prev) => (prev + 1) % events.length);
              }
            }}
            onTap={() => handleFocusEventOnMap(activeEvent)}
            style={{
              width: capsuleWidth ? `${capsuleWidth}px` : undefined,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
              backgroundColor: 'rgba(255, 255, 255, 0.78)',
              backdropFilter: 'blur(24px) saturate(190%)',
              WebkitBackdropFilter: 'blur(24px) saturate(190%)',
              boxShadow:
                '0 10px 28px -6px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.92)',
              touchAction: 'none',
            }}
            className="w-full max-w-[326px] sm:max-w-[342px] rounded-[28px] px-3 py-2.5 border border-white/85 pointer-events-auto cursor-grab active:cursor-grabbing transition-transform duration-200 overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeEvent.id}
                initial={{ opacity: 0, x: slideDirection * 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDirection * -18 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-between gap-2.5 w-full pointer-events-none"
              >
                {/* Left Area: Circular Event Photo with delicate white border */}
                <div className="w-[46px] h-[46px] rounded-full overflow-hidden shrink-0 border-[2px] border-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] bg-zinc-200/70">
                  <img
                    src={activeEvent.image || DEFAULT_EVENT_IMAGE}
                    alt={activeEvent.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_EVENT_IMAGE;
                    }}
                  />
                </div>

                {/* Center Area: Event Name in Bold + Event Time + Short Objective Description */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 className="text-[14.5px] font-bold text-black tracking-[-0.02em] leading-[1.18] truncate">
                    {activeEvent.name}
                  </h4>

                  <div className="flex items-center gap-1.5 mt-0.5 text-[11.5px] font-semibold text-black/65 tracking-[-0.01em] truncate">
                    <span className="truncate">{formatTimeLine(activeEvent)}</span>
                    {activeEvent.cost_price && (
                      <>
                        <span className="text-black/30">·</span>
                        <span className="truncate">{activeEvent.cost_price}</span>
                      </>
                    )}
                  </div>

                  {activeEvent.description && (
                    <p className="text-[11.5px] font-normal text-black/55 tracking-[-0.01em] leading-[1.2] truncate mt-0.5">
                      {activeEvent.description}
                    </p>
                  )}
                </div>

                {/* Right Area: Circular Play Button with translucent white background & black Play icon */}
                <button
                  type="button"
                  aria-label={`Ver ${activeEvent.name} no mapa`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setIsPressed(true);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    setIsPressed(false);
                  }}
                  onPointerLeave={() => setIsPressed(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      triggerHapticFeedback(14);
                      playPinTapSound();
                    } catch {}
                    window.dispatchEvent(
                      new CustomEvent('monvian:apply_event_as_itinerary', {
                        detail: activeEvent,
                      })
                    );
                  }}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    boxShadow:
                      '0 2px 8px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                  }}
                  className={`pointer-events-auto w-[38px] h-[38px] rounded-full border border-white/90 shrink-0 flex items-center justify-center transition-transform duration-150 cursor-pointer ${
                    isPressed ? 'scale-90 bg-white' : 'hover:scale-105 active:scale-90'
                  }`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="w-[15px] h-[15px] text-black translate-x-[1px]"
                    fill="currentColor"
                  >
                    <path d="M6.3 3.84A1.2 1.2 0 0 1 8.12 2.8l8.15 5.16a1.2 1.2 0 0 1 0 2.08l-8.15 5.16A1.2 1.2 0 0 1 6.3 14.16V3.84Z" />
                  </svg>
                </button>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
