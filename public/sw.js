// Monvian PWA Service Worker - Offline Caching Engine for Spots & Assets
const STATIC_CACHE = 'monvian-static-v10';
const API_CACHE = 'monvian-api-v8';
const IMAGES_CACHE = 'monvian-images-v8';
const MAX_IMAGE_CACHE_ENTRIES = 120;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/assets/aistudio/monvian_logo_dark_transparent.png',
  '/notification-badge.png',
  '/logo.png',
  '/fotoperfil.png',
  '/loogo.png'
];

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const excess = keys.length - maxItems;
      await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
    }
  } catch {
    // Ignore storage quota cleanup errors
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache shell warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, API_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations like POST, PUT, DELETE must go straight to server)
  if (request.method !== 'GET') {
    return;
  }

  // Never intercept or cache authenticated requests or auth provider domains (Supabase, Firebase, Google OAuth)
  if (
    request.headers.has('Authorization') ||
    request.headers.has('apikey') ||
    url.pathname.startsWith('/api/auth/') ||
    url.pathname.startsWith('/__/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('accounts.google.com')
  ) {
    return;
  }

  // Bypass Vite internal modules and dev requests
  if (
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@id/') ||
    url.pathname.includes('/@fs/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.search.includes('?t=')
  ) {
    return;
  }

  // Allow map tiles to bypass Service Worker completely so browser native HTTP cache
  // handles them cleanly without CORS or opaque response issues in WebGL
  const isMapTile =
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('mapbox.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.pathname.includes('/rastertiles/') ||
    url.pathname.includes('/tiles/') ||
    url.pathname.includes('/tile/');

  if (isMapTile) {
    return;
  }

  // 2. Read-Only API Endpoints Caching Strategy (Network-First with Cache Fallback)
  const isCacheableApi =
    url.pathname.startsWith('/api/spots') ||
    url.pathname.startsWith('/api/settings') ||
    url.pathname.startsWith('/api/events') ||
    url.pathname.startsWith('/api/services') ||
    url.pathname.startsWith('/api/weather');

  if (isCacheableApi) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }

          const cached = await cache.match(request);
          return cached || networkResponse;
        } catch {
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          return new Response(JSON.stringify({ success: true, offline: true, spots: [] }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // Other non-cacheable API requests (auth, admin mutations, etc.)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. Images and Photos Caching Strategy (Cache-First with bounded cache size)
  const isImage =
    request.destination === 'image' ||
    url.hostname.includes('unsplash.com') ||
    /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(url.pathname);

  if (isImage) {
    event.respondWith(
      caches.open(IMAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached && (cached.status === 200 || cached.type === 'opaque')) {
          return cached;
        }

        try {
          const networkResponse = await fetch(request, { referrerPolicy: 'no-referrer' });
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            try {
              await cache.put(request, networkResponse.clone());
              event.waitUntil(trimCache(IMAGES_CACHE, MAX_IMAGE_CACHE_ENTRIES));
            } catch {}
          }
          return networkResponse;
        } catch {
          return cached || new Response(null, { status: 504 });
        }
      })
    );
    return;
  }

  // 4. Google Fonts Caching (Cache-First)
  const isFont =
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    request.destination === 'font';

  if (isFont) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cached || new Response(null, { status: 404 });
        }
      })
    );
    return;
  }

  // 5. Navigation / HTML requests (Network-First with Index.html Fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((fallback) => {
            return fallback || caches.match('/');
          });
        })
    );
    return;
  }

  // 6. Immutable Vite Hashed Assets (Cache-First for instant repeat navigation)
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
    );
    return;
  }

  // 7. Generic Static Assets (Stale-While-Revalidate)
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Handle native iOS / Web notification click to open the corresponding tourist spot or itinerary
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const spotId = data.spotId ? String(data.spotId) : '';
  const itineraryId = data.itineraryId ? String(data.itineraryId) : '';
  const alertType = data.alertType ? String(data.alertType) : '';
  const rawUrl = typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//')
    ? data.url
    : '';
  const targetUrl =
    rawUrl ||
    (spotId
      ? `/?spot=${encodeURIComponent(spotId)}`
      : itineraryId
        ? `/?itinerary=${encodeURIComponent(itineraryId)}`
        : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'MONVIAN_NOTIFICATION_CLICK',
            spotId,
            itineraryId,
            alertType,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
