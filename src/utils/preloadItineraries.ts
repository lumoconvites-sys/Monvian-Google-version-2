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

export function startPreloadResources() {
  if (typeof window === 'undefined') return;
  // Preload critical assets in idle time
  const preload = () => {
    const imagesToPreload = [
      '/logocarregamento.png',
      '/logomodoescuro.png',
      '/loogo.png',
      '/hotel.png',
      '/restaurante.png',
      '/cafe.png'
    ];
    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(preload);
  } else {
    setTimeout(preload, 1200);
  }
}
