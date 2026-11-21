export interface BackStackEntry {
  id: string;
  priority: number;
  registeredAt: number;
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
  public setGestureActive(_active: boolean) {}
  public getIsGestureActive(): boolean {
    return false;
  }
  public setLatestSnapshot(_html: string | null) {}
  public getLatestSnapshot(): string | null {
    return null;
  }
  public register(_entry: Omit<BackStackEntry, 'registeredAt'> & { registeredAt?: number }): () => void {
    return () => {};
  }
  public unregister(_id: string) {}
  public clearAuthEntries() {}
  public resetAll() {}
  public getSortedEntries(): BackStackEntry[] {
    return [];
  }
  public getTopEntry(): BackStackEntry | null {
    return null;
  }
  public canGoBack(): boolean {
    return false;
  }
  public completeGesturePop(_entry: BackStackEntry) {}
  public subscribe(_listener: (entries: BackStackEntry[]) => void): () => void {
    return () => {};
  }
}

export const iosNavigationManager = new IOSNavigationManager();

export function captureDOMSnapshot(_sourceEl: HTMLElement | null): HTMLElement | null {
  return null;
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

export function useIOSBackEntry(_options: UseIOSBackEntryOptions) {
  // iOS drag-to-right edge-swipe back navigation disabled per user request
}
