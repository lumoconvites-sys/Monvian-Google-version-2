import { Itinerary } from '../types';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries';
import { CAMPOS_SPOTS } from '../data/spots';
import { CATEGORY_FALLBACK_IMAGES } from '../utils/spotImages';
import { initGeoCachePreload } from './geoCache';

// Persistent registry of already preloaded image URLs to avoid duplicate requests
const preloadedUrls = new Set<string>();

// Keep image references in memory so the browser does not garbage collect decoded bitmaps
const inMemoryImageCache = new Map<string, HTMLImageElement>();

let hasPreloadStarted = false;

/**
 * Preloads a single image URL into browser HTTP cache and memory decode pipeline.
 */
export function preloadImage(url?: string | null, priority: 'high' | 'auto' | 'low' = 'auto'): Promise<boolean> {
  if (!url || typeof url !== 'string') return Promise.resolve(false);
  const trimmedUrl = url.trim();
  if (!trimmedUrl.startsWith('http') && !trimmedUrl.startsWith('/')) return Promise.resolve(false);

  if (preloadedUrls.has(trimmedUrl)) {
    return Promise.resolve(true);
  }
  preloadedUrls.add(trimmedUrl);

  // Maintain bounded memory cache (max 40 items) to prevent high RAM consumption on mobile
  if (inMemoryImageCache.size > 40) {
    const firstKey = inMemoryImageCache.keys().next().value;
    if (firstKey) inMemoryImageCache.delete(firstKey);
  }

  // Instantiate Image element and trigger asynchronous decode into browser cache
  return new Promise<boolean>((resolve) => {
    try {
      const img = new Image();
      img.decoding = 'async';
      if ('fetchPriority' in img) {
        (img as any).fetchPriority = priority;
      }

      img.onload = () => {
        inMemoryImageCache.set(trimmedUrl, img);
        if ('decode' in img) {
          img.decode().then(() => resolve(true)).catch(() => resolve(true));
        } else {
          resolve(true);
        }
      };

      img.onerror = () => {
        resolve(false);
      };

      img.src = trimmedUrl;
    } catch (_) {
      resolve(false);
    }
  });
}

/**
 * Extracts all unique image URLs from an itinerary list.
 */
export function extractAllItineraryImageUrls(itineraries: Itinerary[]): string[] {
  const urls = new Set<string>();
  if (!Array.isArray(itineraries)) return [];

  for (const itin of itineraries) {
    if (itin.coverImage) {
      urls.add(itin.coverImage.trim());
    }
    if (Array.isArray(itin.days)) {
      for (const day of itin.days) {
        if (Array.isArray(day.steps)) {
          for (const step of day.steps) {
            if (step.customImage) urls.add(step.customImage.trim());
            if (step.spot?.image) urls.add(step.spot.image.trim());
          }
        }
      }
    }
  }

  return Array.from(urls);
}

/**
 * Starts background preloading of all images as soon as the app starts.
 */
export function startPreloadResources(): void {
  if (typeof window === 'undefined') return;
  if (hasPreloadStarted) return;
  hasPreloadStarted = true;

  // Initialize 40km geographic preloading & caching centered on Campos do Jordão
  initGeoCachePreload(CAMPOS_SPOTS);

  // 1. Preload spot images from CAMPOS_SPOTS
  CAMPOS_SPOTS.forEach(spot => {
    // Only preload the main image with high priority, and at most the first gallery image with low priority
    if (spot.image) preloadImage(spot.image, 'high');
    if (Array.isArray(spot.gallery) && spot.gallery.length > 0) {
      preloadImage(spot.gallery[0], 'low');
    }
  });

  // Preload itinerary images
  let localItineraries: Itinerary[] = [...DEFAULT_CURATED_ITINERARIES];
  try {
    const cached = localStorage.getItem('monvian_itineraries_store_cache_v5');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localItineraries = [...localItineraries, ...parsed];
      }
    }
  } catch (_) {}

  const allUrls = extractAllItineraryImageUrls(localItineraries);
  allUrls.forEach((url) => {
    // Preload itinerary images with low priority
    preloadImage(url, 'low');
  });

  // 3. Preload fallback images
  Object.values(CATEGORY_FALLBACK_IMAGES).forEach(list => {
    list.forEach(url => preloadImage(url, 'low'));
  });
}
