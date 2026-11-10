import React, { useEffect, useRef } from 'react';
import {
  iosNavigationManager,
  BackStackEntry,
  resolveEntryElement,
} from '../services/iosNavigationManager';

/**
 * Global iOS Interactive Back Gesture / Edge Swipe Navigation System
 *
 * Provides native iPhone edge-swipe back navigation (left edge -> right)
 * with 1:1 finger tracking, 120Hz GPU-accelerated transforms, parallax depth
 * (-28% -> 0%) on the underlying screen, subtle iOS edge drop-shadow, and
 * conflict prevention for maps, horizontal carousels, sliders, and inputs.
 */

const EDGE_THRESHOLD_PX = 28; // Left edge activation zone in px
const DIRECTION_LOCK_PX = 7; // Minimum movement to lock horizontal vs vertical
const COMPLETE_RATIO = 0.33; // 33% of viewport width completes navigation
const VELOCITY_THRESHOLD = 420; // px/s flick velocity to complete navigation
const PARALLAX_OFFSET_RATIO = 0.28; // -28% parallax on previous screen

function isInteractiveOrHorizontalElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  // 1. Check form inputs, sliders, or explicit opt-out attributes
  const interactiveSelector =
    'input, textarea, select, [contenteditable="true"], [data-no-edge-swipe="true"], .no-edge-swipe';
  if (target.closest(interactiveSelector)) {
    return true;
  }

  // 2. Check if inside a horizontally scrollable container (carousels, galleries)
  // that has already been scrolled right (meaning swiping right scrolls it back left)
  let el: HTMLElement | null = target;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      el.scrollWidth > el.clientWidth + 4 &&
      el.scrollLeft > 2
    ) {
      return true;
    }
    el = el.parentElement;
  }

  return false;
}

export const IOSInteractiveBackSystem: React.FC = () => {
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const underlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let activeEntry: BackStackEntry | null = null;
    let fgEl: HTMLElement | null = null;
    let bgEl: HTMLElement | null = null;
    let backdropEl: HTMLElement | null = null;
    let useUnderlayClone = false;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let lastX = 0;
    let lastTimestamp = 0;
    let velocityX = 0;

    let isTracking = false;
    let isLockedHorizontal = false;
    let isAnimatingRelease = false;
    let rafId: number | null = null;
    let viewportWidth = window.innerWidth || 390;

    let savedFgTransition = '';
    let savedFgWillChange = '';
    let savedBgTransition = '';
    let savedBgWillChange = '';
    let savedBgVisibility = '';
    let savedBgOpacity = '';
    let savedBackdropTransition = '';
    let savedBackdropOpacity = '';

    const prepareUnderlayClone = (sourceEl: HTMLElement | null) => {
      const underlay = underlayRef.current;
      if (!underlay) return;
      underlay.innerHTML = '';
      if (!sourceEl) return;
      try {
        const clone = sourceEl.cloneNode(true) as HTMLElement;
        clone.removeAttribute('id');
        clone.style.pointerEvents = 'none';
        clone.style.transform = 'none';
        clone.style.transition = 'none';
        underlay.appendChild(clone);
      } catch {
        // Ignore clone errors
      }
    };

    const applyFrame = (deltaX: number) => {
      const clampedX = Math.max(0, Math.min(viewportWidth, deltaX));
      const progress = Math.min(1, clampedX / viewportWidth);

      // 1. Move Foreground 1:1 with finger
      if (fgEl) {
        fgEl.style.transform = `translate3d(${clampedX}px, 0, 0)`;
      }

      // 2. Move Background with iOS parallax (-28% -> 0%)
      const bgOffsetPx = -viewportWidth * PARALLAX_OFFSET_RATIO * (1 - progress);
      if (bgEl && !useUnderlayClone) {
        bgEl.style.transform = `translate3d(${bgOffsetPx}px, 0, 0)`;
      } else if (underlayRef.current && useUnderlayClone) {
        underlayRef.current.style.transform = `translate3d(${bgOffsetPx}px, 0, 0)`;
      }

      // 3. Fade custom backdrop if provided
      if (backdropEl) {
        backdropEl.style.opacity = `${Math.max(0, 1 - progress)}`;
      }

      // 4. Position Left-Edge Shadow attached to Foreground's left edge
      if (shadowRef.current) {
        const shadowOpacity = Math.min(1, (1 - progress * 0.65) * Math.min(1, clampedX / 18));
        shadowRef.current.style.transform = `translate3d(${clampedX - 24}px, 0, 0)`;
        shadowRef.current.style.opacity = `${shadowOpacity}`;
      }

      // 5. Dim Scrim over background (fades from 0.20 -> 0 as foreground reveals background)
      if (scrimRef.current) {
        const scrimOpacity = (1 - progress) * 0.2;
        scrimRef.current.style.opacity = `${scrimOpacity}`;
      }
    };

    const cleanupStyles = (didComplete: boolean) => {
      if (fgEl) {
        if (didComplete) {
          // Mark element as swiped out so exit animations don't snap it back to 0
          fgEl.setAttribute('data-ios-swiped-out', 'true');
          const elRef = fgEl;
          setTimeout(() => {
            elRef.removeAttribute('data-ios-swiped-out');
            elRef.style.transition = savedFgTransition;
            elRef.style.willChange = savedFgWillChange;
            elRef.style.transform = '';
          }, 90);
        } else {
          fgEl.style.transition = savedFgTransition;
          fgEl.style.willChange = savedFgWillChange;
          fgEl.style.transform = '';
        }
      }

      if (bgEl && !useUnderlayClone) {
        bgEl.style.transition = savedBgTransition;
        bgEl.style.willChange = savedBgWillChange;
        bgEl.style.transform = '';
        if (!didComplete) {
          bgEl.style.visibility = savedBgVisibility;
          bgEl.style.opacity = savedBgOpacity;
        } else {
          bgEl.style.visibility = '';
          bgEl.style.opacity = '';
        }
      }

      if (backdropEl) {
        backdropEl.style.transition = savedBackdropTransition;
        backdropEl.style.opacity = didComplete ? '0' : savedBackdropOpacity;
      }

      if (underlayRef.current) {
        underlayRef.current.style.display = 'none';
        underlayRef.current.style.transition = 'none';
        underlayRef.current.style.transform = 'translate3d(0, 0, 0)';
        underlayRef.current.innerHTML = '';
      }

      if (shadowRef.current) {
        shadowRef.current.style.display = 'none';
        shadowRef.current.style.transition = 'none';
        shadowRef.current.style.opacity = '0';
      }

      if (scrimRef.current) {
        scrimRef.current.style.display = 'none';
        scrimRef.current.style.transition = 'none';
        scrimRef.current.style.opacity = '0';
      }

      activeEntry = null;
      fgEl = null;
      bgEl = null;
      backdropEl = null;
      useUnderlayClone = false;
      isTracking = false;
      isLockedHorizontal = false;
      isAnimatingRelease = false;
      iosNavigationManager.setGestureActive(false);
    };

    const startGestureLock = () => {
      if (!activeEntry) return false;
      fgEl = resolveEntryElement(activeEntry.getForegroundEl, activeEntry.foregroundSelector);
      if (!fgEl) {
        fgEl = document.getElementById('app-active-view-container');
      }
      if (!fgEl) return false;

      // Clear any leftover swiped-out marker
      fgEl.removeAttribute('data-ios-swiped-out');

      bgEl = resolveEntryElement(activeEntry.getBackgroundEl, activeEntry.backgroundSelector);
      backdropEl = activeEntry.getBackdropEl ? activeEntry.getBackdropEl() : null;
      useUnderlayClone = false;

      // If entry provided a snapshotNode or no distinct background element is available,
      // use the underlay container for the parallax background
      if (activeEntry.snapshotNode && underlayRef.current) {
        useUnderlayClone = true;
        underlayRef.current.innerHTML = '';
        underlayRef.current.appendChild(activeEntry.snapshotNode.cloneNode(true));
        underlayRef.current.style.display = 'block';
        underlayRef.current.style.transition = 'none';
      } else if (!bgEl || bgEl === fgEl) {
        useUnderlayClone = true;
        const snapshotHtml = iosNavigationManager.getLatestSnapshot();
        if (underlayRef.current) {
          if (snapshotHtml) {
            underlayRef.current.innerHTML = snapshotHtml;
          } else {
            prepareUnderlayClone(document.getElementById('app-map-layer'));
          }
          underlayRef.current.style.display = 'block';
          underlayRef.current.style.transition = 'none';
        }
      } else {
        savedBgTransition = bgEl.style.transition;
        savedBgWillChange = bgEl.style.willChange;
        savedBgVisibility = bgEl.style.visibility;
        savedBgOpacity = bgEl.style.opacity;
        bgEl.style.transition = 'none';
        bgEl.style.willChange = 'transform';
        bgEl.style.visibility = 'visible';
        if (bgEl.style.opacity === '0') {
          bgEl.style.opacity = '1';
        }
      }

      if (backdropEl) {
        savedBackdropTransition = backdropEl.style.transition;
        savedBackdropOpacity = backdropEl.style.opacity;
        backdropEl.style.transition = 'none';
      }

      savedFgTransition = fgEl.style.transition;
      savedFgWillChange = fgEl.style.willChange;
      fgEl.style.transition = 'none';
      fgEl.style.willChange = 'transform';

      if (shadowRef.current) {
        shadowRef.current.style.display = 'block';
        shadowRef.current.style.transition = 'none';
      }

      if (scrimRef.current) {
        scrimRef.current.style.display = 'block';
        scrimRef.current.style.transition = 'none';
      }

      iosNavigationManager.setGestureActive(true);
      activeEntry.onGestureStart?.();
      return true;
    };

    const finishGesture = (forceCancel = false) => {
      if (!isTracking) return;
      isTracking = false;

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (!isLockedHorizontal || !activeEntry || !fgEl) {
        activeEntry = null;
        fgEl = null;
        bgEl = null;
        backdropEl = null;
        isLockedHorizontal = false;
        iosNavigationManager.setGestureActive(false);
        return;
      }

      const deltaX = Math.max(0, currentX - startX);
      const shouldComplete =
        !forceCancel &&
        (deltaX > viewportWidth * COMPLETE_RATIO ||
          (velocityX > VELOCITY_THRESHOLD && deltaX > 22));

      isAnimatingRelease = true;
      const durationMs = shouldComplete ? 240 : 220;
      const easing = 'cubic-bezier(0.32, 0.72, 0, 1)'; // Native iOS spring curve

      if (fgEl) {
        fgEl.style.transition = `transform ${durationMs}ms ${easing}`;
        fgEl.style.transform = shouldComplete
          ? `translate3d(${viewportWidth}px, 0, 0)`
          : 'translate3d(0px, 0, 0)';
      }

      const cancelOffsetPx = -viewportWidth * PARALLAX_OFFSET_RATIO;
      if (bgEl && !useUnderlayClone) {
        bgEl.style.transition = `transform ${durationMs}ms ${easing}`;
        bgEl.style.transform = shouldComplete
          ? 'translate3d(0px, 0, 0)'
          : `translate3d(${cancelOffsetPx}px, 0, 0)`;
      } else if (underlayRef.current && useUnderlayClone) {
        underlayRef.current.style.transition = `transform ${durationMs}ms ${easing}`;
        underlayRef.current.style.transform = shouldComplete
          ? 'translate3d(0px, 0, 0)'
          : `translate3d(${cancelOffsetPx}px, 0, 0)`;
      }

      if (backdropEl) {
        backdropEl.style.transition = `opacity ${durationMs}ms ${easing}`;
        backdropEl.style.opacity = shouldComplete ? '0' : '1';
      }

      if (shadowRef.current) {
        shadowRef.current.style.transition = `transform ${durationMs}ms ${easing}, opacity ${durationMs}ms ${easing}`;
        shadowRef.current.style.transform = shouldComplete
          ? `translate3d(${viewportWidth - 24}px, 0, 0)`
          : 'translate3d(-24px, 0, 0)';
        shadowRef.current.style.opacity = '0';
      }

      if (scrimRef.current) {
        scrimRef.current.style.transition = `opacity ${durationMs}ms ${easing}`;
        scrimRef.current.style.opacity = shouldComplete ? '0' : '0.2';
      }

      const entryToComplete = activeEntry;
      setTimeout(() => {
        if (shouldComplete && entryToComplete) {
          cleanupStyles(true);
          iosNavigationManager.completeGesturePop(entryToComplete);
        } else {
          entryToComplete?.onGestureCancel?.();
          cleanupStyles(false);
        }
      }, durationMs);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isAnimatingRelease) return;
      if (e.touches.length !== 1) return;

      const topEntry = iosNavigationManager.getTopEntry();
      if (!topEntry) return;

      const touch = e.touches[0];
      viewportWidth = window.innerWidth || 390;

      // Determine left edge relative to viewport OR active container's left edge
      const targetFg = resolveEntryElement(topEntry.getForegroundEl, topEntry.foregroundSelector);
      const containerLeft = targetFg ? Math.max(0, targetFg.getBoundingClientRect().left) : 0;
      const relativeX = touch.clientX - containerLeft;

      const isFromLeftEdge =
        touch.clientX <= EDGE_THRESHOLD_PX ||
        (relativeX >= 0 && relativeX <= EDGE_THRESHOLD_PX);

      if (!isFromLeftEdge) return;
      if (isInteractiveOrHorizontalElement(e.target)) return;

      activeEntry = topEntry;
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      lastX = startX;
      lastTimestamp = performance.now();
      velocityX = 0;
      isTracking = true;
      isLockedHorizontal = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking || isAnimatingRelease || !activeEntry) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!isLockedHorizontal) {
        // If user moves vertically more than horizontally, abort back gesture immediately
        if (Math.abs(dy) > DIRECTION_LOCK_PX && Math.abs(dy) > Math.abs(dx) * 0.9) {
          isTracking = false;
          activeEntry = null;
          return;
        }

        // If user drags left instead of right, abort
        if (dx < -6) {
          isTracking = false;
          activeEntry = null;
          return;
        }

        // Lock horizontal edge-swipe when dragging right past threshold
        if (dx >= DIRECTION_LOCK_PX && dx > Math.abs(dy) * 1.15) {
          if (!startGestureLock()) {
            isTracking = false;
            activeEntry = null;
            return;
          }
          isLockedHorizontal = true;
        } else {
          return;
        }
      }

      // Prevent vertical page scroll & browser native navigation while swiping back
      if (e.cancelable) {
        e.preventDefault();
      }

      const now = performance.now();
      const dt = now - lastTimestamp;
      if (dt > 4) {
        const instantVel = ((touch.clientX - lastX) / dt) * 1000;
        velocityX = velocityX * 0.35 + instantVel * 0.65;
        lastX = touch.clientX;
        lastTimestamp = now;
      }

      currentX = touch.clientX;
      const deltaX = Math.max(0, currentX - startX);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        applyFrame(deltaX);
      });
    };

    const handleTouchEnd = () => {
      finishGesture(false);
    };

    const handleTouchCancel = () => {
      finishGesture(true);
    };

    // Desktop Mouse Edge-Drag support for testing in desktop browsers
    let isMouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      if (isAnimatingRelease || e.button !== 0) return;
      const topEntry = iosNavigationManager.getTopEntry();
      if (!topEntry) return;

      viewportWidth = window.innerWidth || 390;
      const targetFg = resolveEntryElement(topEntry.getForegroundEl, topEntry.foregroundSelector);
      const containerLeft = targetFg ? Math.max(0, targetFg.getBoundingClientRect().left) : 0;
      const relativeX = e.clientX - containerLeft;

      const isFromLeftEdge =
        e.clientX <= EDGE_THRESHOLD_PX ||
        (relativeX >= 0 && relativeX <= EDGE_THRESHOLD_PX);

      if (!isFromLeftEdge) return;
      if (isInteractiveOrHorizontalElement(e.target)) return;

      isMouseDown = true;
      activeEntry = topEntry;
      startX = e.clientX;
      startY = e.clientY;
      currentX = startX;
      lastX = startX;
      lastTimestamp = performance.now();
      velocityX = 0;
      isTracking = true;
      isLockedHorizontal = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || !isTracking || isAnimatingRelease || !activeEntry) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isLockedHorizontal) {
        if (Math.abs(dy) > DIRECTION_LOCK_PX && Math.abs(dy) > Math.abs(dx) * 0.9) {
          isMouseDown = false;
          isTracking = false;
          activeEntry = null;
          return;
        }
        if (dx >= DIRECTION_LOCK_PX && dx > Math.abs(dy) * 1.15) {
          if (!startGestureLock()) {
            isMouseDown = false;
            isTracking = false;
            activeEntry = null;
            return;
          }
          isLockedHorizontal = true;
        } else {
          return;
        }
      }

      e.preventDefault();
      const now = performance.now();
      const dt = now - lastTimestamp;
      if (dt > 4) {
        const instantVel = ((e.clientX - lastX) / dt) * 1000;
        velocityX = velocityX * 0.35 + instantVel * 0.65;
        lastX = e.clientX;
        lastTimestamp = now;
      }

      currentX = e.clientX;
      const deltaX = Math.max(0, currentX - startX);
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        applyFrame(deltaX);
      });
    };

    const handleMouseUp = () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      finishGesture(false);
    };

    window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: true });

    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart, { capture: true });
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });
      window.removeEventListener('touchend', handleTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', handleTouchCancel, { capture: true });

      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('mousemove', handleMouseMove, { capture: true });
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
    };
  }, []);

  return (
    <>
      {/* Fallback Parallax Underlay when background is a tab snapshot */}
      <div
        id="ios-back-parallax-underlay"
        ref={underlayRef}
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none overflow-hidden z-[45] hidden"
        style={{ willChange: 'transform' }}
      />

      {/* Subtle iOS Dimming Scrim over background screen */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[9998] hidden"
        style={{
          backgroundColor: '#000000',
          opacity: 0,
          willChange: 'opacity',
        }}
      />

      {/* Native iOS Left-Edge Drop Shadow attached to sliding foreground */}
      <div
        ref={shadowRef}
        aria-hidden="true"
        className="fixed top-0 bottom-0 w-6 pointer-events-none z-[9999] hidden"
        style={{
          background:
            'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.04) 45%, rgba(0,0,0,0.16) 100%)',
          opacity: 0,
          willChange: 'transform, opacity',
        }}
      />
    </>
  );
};
