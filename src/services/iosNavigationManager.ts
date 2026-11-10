import { useEffect, useRef } from 'react';

export interface BackStackEntry {
  id: string;
  /**
   * Priority determines which active layer is on top of the visual hierarchy:
   * - 10..50: Root tab navigation history ('explorar' <- 'roteiros' / 'salvos' / 'buscar' / 'perfil')
   * - 100..150: Internal subviews within a tab/screen (e.g., Saved collection, Search category, Profile subview, Itinerary map vs explore)
   * - 160..190: Admin panel & internal admin tabs, Map floating previews/search/filter
   * - 200..300: Fullscreen detail sheets & modals (SpotDetailSheet, ItineraryStoreDetailModal, NotificationsModal, etc.)
   */
  priority: number;
  registeredAt: number;
  label?: string;
  /** Returns the foreground element that slides right (0 -> 100vw) with the user's finger */
  getForegroundEl?: () => HTMLElement | null;
  foregroundSelector?: string | (() => HTMLElement | null);
  /** Returns the live underlying element that shifts from -28% to 0% with iOS parallax */
  getBackgroundEl?: () => HTMLElement | null;
  backgroundSelector?: string | (() => HTMLElement | null);
  /** Returns an optional backdrop scrim element whose opacity fades 1 -> 0 */
  getBackdropEl?: () => HTMLElement | null;
  /** Optional cloned DOM snapshot of the previous subview when transitioning within the same container */
  snapshotNode?: HTMLElement | null;
  onGestureStart?: () => void;
  onGestureCancel?: () => void;
  /** Callback that restores the previous state cleanly */
  onPop: () => void;
}

type StackListener = (entries: BackStackEntry[]) => void;

export function resolveEntryElement(
  getter?: () => HTMLElement | null,
  selectorOrGetter?: string | (() => HTMLElement | null)
): HTMLElement | null {
  if (getter) {
    try {
      const el = getter();
      if (el) return el;
    } catch {}
  }
  if (!selectorOrGetter) return null;
  if (typeof selectorOrGetter === 'function') {
    try {
      return selectorOrGetter();
    } catch {
      return null;
    }
  }
  if (typeof document !== 'undefined') {
    return document.querySelector<HTMLElement>(selectorOrGetter);
  }
  return null;
}

class IOSNavigationManager {
  private entries: Map<string, BackStackEntry> = new Map();
  private listeners: Set<StackListener> = new Set();
  private sequenceCounter = 0;
  private isHandlingPopState = false;
  private ignoreNextPopStateCount = 0;
  private currentHistoryDepth = 0;
  private isGestureActive = false;
  private latestSnapshotHtml: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBrowserHistorySync();
    }
  }

  private initBrowserHistorySync() {
    try {
      const currentState = window.history.state || {};
      window.history.replaceState(
        { ...currentState, monvianNavRoot: true, monvianNavDepth: 0 },
        '',
        window.location.href
      );
      this.currentHistoryDepth = 0;
    } catch {}

    window.addEventListener('popstate', (e) => {
      if (this.ignoreNextPopStateCount > 0) {
        this.ignoreNextPopStateCount--;
        return;
      }

      const top = this.getTopEntry();
      if (top) {
        this.isHandlingPopState = true;
        try {
          this.currentHistoryDepth = Math.max(0, this.currentHistoryDepth - 1);
          top.onPop();
        } finally {
          setTimeout(() => {
            this.isHandlingPopState = false;
          }, 50);
        }
      } else {
        // Prevent browser from accidentally leaving the authenticated app onto an external or login page
        const isAuthenticated = Boolean(
          localStorage.getItem('monvian_token') && localStorage.getItem('monvian_user')
        );
        if (isAuthenticated && (!e.state || !e.state.monvianNavRoot)) {
          try {
            window.history.pushState(
              { monvianNavRoot: true, monvianNavDepth: 0 },
              '',
              window.location.href
            );
          } catch {}
        }
      }
    });
  }

  public setGestureActive(active: boolean) {
    this.isGestureActive = active;
  }

  public getIsGestureActive(): boolean {
    return this.isGestureActive;
  }

  public setLatestSnapshot(html: string | null) {
    this.latestSnapshotHtml = html;
  }

  public getLatestSnapshot(): string | null {
    return this.latestSnapshotHtml;
  }

  public register(entry: Omit<BackStackEntry, 'registeredAt'> & { registeredAt?: number }): () => void {
    const existing = this.entries.get(entry.id);
    const registeredAt = existing ? existing.registeredAt : ++this.sequenceCounter;

    const fullEntry: BackStackEntry = {
      ...entry,
      registeredAt,
    };

    const wasEmptyOrSmaller = !existing;
    this.entries.set(entry.id, fullEntry);

    if (wasEmptyOrSmaller && !this.isHandlingPopState && typeof window !== 'undefined') {
      try {
        this.currentHistoryDepth++;
        const currentState = window.history.state || {};
        window.history.pushState(
          {
            ...currentState,
            monvianNavRoot: true,
            monvianNavDepth: this.currentHistoryDepth,
            entryId: entry.id,
          },
          '',
          window.location.href
        );
      } catch {}
    }

    this.notify();

    return () => {
      this.unregister(entry.id);
    };
  }

  public unregister(id: string) {
    if (!this.entries.has(id)) return;
    this.entries.delete(id);
    this.notify();
  }

  public clearAuthEntries() {
    let changed = false;
    for (const key of Array.from(this.entries.keys())) {
      if (key.startsWith('auth:')) {
        this.entries.delete(key);
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  public resetAll() {
    if (this.entries.size === 0) return;
    this.entries.clear();
    this.notify();
  }

  public getSortedEntries(): BackStackEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.registeredAt - a.registeredAt;
    });
  }

  public getTopEntry(): BackStackEntry | null {
    const sorted = this.getSortedEntries();
    for (const entry of sorted) {
      const fg = resolveEntryElement(entry.getForegroundEl, entry.foregroundSelector);
      if (fg && document.body.contains(fg)) {
        return entry;
      }
    }
    return sorted[0] || null;
  }

  public canGoBack(): boolean {
    return this.getTopEntry() !== null;
  }

  /**
   * Called when an interactive swipe-back completes.
   * Pops the entry and synchronizes browser history without double-firing.
   */
  public completeGesturePop(entry: BackStackEntry) {
    this.isHandlingPopState = true;
    try {
      entry.onPop();
      if (typeof window !== 'undefined' && this.currentHistoryDepth > 0) {
        this.currentHistoryDepth = Math.max(0, this.currentHistoryDepth - 1);
        this.ignoreNextPopStateCount++;
        try {
          window.history.back();
        } catch {
          this.ignoreNextPopStateCount = Math.max(0, this.ignoreNextPopStateCount - 1);
        }
      }
    } finally {
      setTimeout(() => {
        this.isHandlingPopState = false;
      }, 60);
    }
  }

  public subscribe(listener: StackListener): () => void {
    this.listeners.add(listener);
    listener(this.getSortedEntries());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const sorted = this.getSortedEntries();
    this.listeners.forEach((listener) => listener(sorted));
  }
}

export const iosNavigationManager = new IOSNavigationManager();

/**
 * Captures a lightweight visual DOM clone of a container before a subview transition
 * so the previous subview can be rendered with 120Hz parallax behind the new subview.
 */
export function captureDOMSnapshot(sourceEl: HTMLElement | null): HTMLElement | null {
  if (!sourceEl || typeof document === 'undefined') return null;
  try {
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    const elementsWithId = clone.querySelectorAll('[id]');
    elementsWithId.forEach((el) => el.removeAttribute('id'));

    // Sync scroll positions of scrollable containers
    const origScrollables = sourceEl.querySelectorAll('*');
    const cloneScrollables = clone.querySelectorAll('*');
    for (let i = 0; i < origScrollables.length; i++) {
      const orig = origScrollables[i] as HTMLElement;
      const cln = cloneScrollables[i] as HTMLElement;
      if (orig && cln && (orig.scrollTop > 0 || orig.scrollLeft > 0)) {
        cln.scrollTop = orig.scrollTop;
        cln.scrollLeft = orig.scrollLeft;
      }
    }

    // Sync input values
    const origInputs = sourceEl.querySelectorAll('input, textarea, select');
    const cloneInputs = clone.querySelectorAll('input, textarea, select');
    for (let i = 0; i < origInputs.length; i++) {
      const orig = origInputs[i] as HTMLInputElement;
      const cln = cloneInputs[i] as HTMLInputElement;
      if (orig && cln) {
        cln.value = orig.value;
        cln.setAttribute('value', orig.value);
      }
    }

    clone.style.pointerEvents = 'none';
    clone.style.userSelect = 'none';
    return clone;
  } catch {
    return null;
  }
}

export interface UseIOSBackEntryOptions {
  id: string;
  enabled: boolean;
  priority: number;
  label?: string;
  getForegroundEl?: () => HTMLElement | null;
  foregroundSelector?: string | (() => HTMLElement | null);
  getBackgroundEl?: () => HTMLElement | null;
  backgroundSelector?: string | (() => HTMLElement | null);
  getBackdropEl?: () => HTMLElement | null;
  snapshotNode?: HTMLElement | null;
  onGestureStart?: () => void;
  onGestureCancel?: () => void;
  onPop: () => void;
}

/**
 * Declarative hook to register a screen, modal, drawer, or subview with the global
 * iOS Interactive Back Gesture system.
 */
export function useIOSBackEntry({
  id,
  enabled,
  priority,
  label,
  getForegroundEl,
  foregroundSelector,
  getBackgroundEl,
  backgroundSelector,
  getBackdropEl,
  snapshotNode,
  onGestureStart,
  onGestureCancel,
  onPop,
}: UseIOSBackEntryOptions) {
  const callbacksRef = useRef({
    getForegroundEl,
    foregroundSelector,
    getBackgroundEl,
    backgroundSelector,
    getBackdropEl,
    snapshotNode,
    onGestureStart,
    onGestureCancel,
    onPop,
  });

  callbacksRef.current = {
    getForegroundEl,
    foregroundSelector,
    getBackgroundEl,
    backgroundSelector,
    getBackdropEl,
    snapshotNode,
    onGestureStart,
    onGestureCancel,
    onPop,
  };

  useEffect(() => {
    if (!enabled) {
      iosNavigationManager.unregister(id);
      return;
    }

    const unregister = iosNavigationManager.register({
      id,
      priority,
      label,
      getForegroundEl: () =>
        resolveEntryElement(
          callbacksRef.current.getForegroundEl,
          callbacksRef.current.foregroundSelector
        ),
      getBackgroundEl: () =>
        resolveEntryElement(
          callbacksRef.current.getBackgroundEl,
          callbacksRef.current.backgroundSelector
        ),
      getBackdropEl: () =>
        callbacksRef.current.getBackdropEl ? callbacksRef.current.getBackdropEl() : null,
      snapshotNode: callbacksRef.current.snapshotNode || null,
      onGestureStart: () => callbacksRef.current.onGestureStart?.(),
      onGestureCancel: () => callbacksRef.current.onGestureCancel?.(),
      onPop: () => callbacksRef.current.onPop(),
    });

    return () => {
      unregister();
    };
  }, [id, enabled, priority, label]);
}
