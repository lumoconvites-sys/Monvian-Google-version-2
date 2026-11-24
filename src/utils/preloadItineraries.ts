import { preloadAllStoreItineraries, STORE_SECTION_OPTIONS } from '../services/supabaseItineraries';

export function preloadImage(src: string, priority?: 'high' | 'low' | 'auto'): void {
  if (typeof window === 'undefined' || !src) return;
  const img = new Image();
  if (priority && 'fetchPriority' in img) {
    (img as any).fetchPriority = priority;
  }
  img.src = src;
}

export function extractAllItineraryImageUrls(itineraries: any[]): string[] {
  if (!Array.isArray(itineraries)) return [];
  const urls = new Set<string>();
  for (const itin of itineraries) {
    if (itin.coverImage) urls.add(itin.coverImage);
    if (itin.heroImage) urls.add(itin.heroImage);
    if (Array.isArray(itin.gallery)) {
      itin.gallery.forEach((g: string) => {
        if (typeof g === 'string' && g) urls.add(g);
      });
    }
    if (Array.isArray(itin.days)) {
      for (const d of itin.days) {
        if (Array.isArray(d.steps)) {
          for (const s of d.steps) {
            if (s.image) urls.add(s.image);
            if (s.spot?.image) urls.add(s.spot.image);
          }
        }
      }
    }
  }
  return Array.from(urls);
}

let storePreloadStarted = false;

export function startPreloadResources(forceRefreshItineraries = false): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  // Immediately warm Store 3D section icons + core app logos
  const criticalImages = [
    ...STORE_SECTION_OPTIONS.map((s) => s.image),
    '/assets/aistudio/monvian_logo_dark_transparent.png',
    '/logomodoescuro.png',
    '/logocarregamento.png',
    '/loogo.png',
    '/hotel.png',
    '/restaurante.png',
    '/cafe.png',
  ];
  criticalImages.forEach((src) => preloadImage(src, 'high'));

  // Immediately preload all real itineraries & cover photos into memory so
  // entering "Loja de roteiros" renders every section cleanly with zero flash
  if (!storePreloadStarted || forceRefreshItineraries) {
    storePreloadStarted = true;
    return preloadAllStoreItineraries(forceRefreshItineraries)
      .then(() => {
        try {
          (window as any).__monvianMarkItinerariesPreloaded?.();
        } catch {}
      })
      .catch(() => {
        try {
          (window as any).__monvianMarkItinerariesPreloaded?.();
        } catch {}
      });
  }

  return Promise.resolve();
}
