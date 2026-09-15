// Monvian PWA Service Worker - Offline Caching Engine for Spots & Map Tiles
const STATIC_CACHE = 'monvian-static-v3';
const API_CACHE = 'monvian-api-v3';
const TILES_CACHE = 'monvian-tiles-v3';
const IMAGES_CACHE = 'monvian-images-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/logo-white.png',
  '/logo.png',
  '/fotoperfil.png',
  '/guide_avatar.jpg',
  '/loogo.png'
];

// Initial map tiles around Campos do Jordão (-22.7420, -45.5870) for instant offline availability
const PRECACHE_TILES = [
  'https://a.basemaps.cartocdn.com/dark_all/14/6118/9216@2x.png',
  'https://b.basemaps.cartocdn.com/dark_all/14/6119/9216@2x.png',
  'https://c.basemaps.cartocdn.com/dark_all/14/6118/9217@2x.png',
  'https://d.basemaps.cartocdn.com/dark_all/14/6119/9217@2x.png',
  'https://a.basemaps.cartocdn.com/light_all/14/6118/9216@2x.png',
  'https://b.basemaps.cartocdn.com/light_all/14/6119/9216@2x.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // 1. Cache essential app shell
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[SW] Precache shell warning:', err);
        });
      }),
      // 2. Precache base map tiles for Campos do Jordão
      caches.open(TILES_CACHE).then((cache) => {
        return Promise.allSettled(
          PRECACHE_TILES.map((tileUrl) =>
            fetch(tileUrl, { mode: 'no-cors' })
              .then((res) => cache.put(tileUrl, res))
              .catch(() => {})
          )
        );
      })
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, API_CACHE, TILES_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
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

  // 1. Map Tiles Caching Strategy (Cache-First with Background Update)
  // Handles CARTO, OpenStreetMap, ESRI, etc.
  const isMapTile =
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.pathname.includes('/rastertiles/') ||
    url.pathname.includes('/tile/');

  if (isMapTile) {
    event.respondWith(
      caches.open(TILES_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // If offline and not in cache, return empty fallback
          return cachedResponse || new Response(null, { status: 503, statusText: 'Tile Offline' });
        }
      })
    );
    return;
  }

  // 2. Read-Only API Endpoints Caching Strategy (Stale-While-Revalidate / Network-First with Cache Fallback)
  // Endpoints: /api/spots, /api/settings, /api/events, /api/services, /api/weather
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
          // Try network first to get freshest data
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for slow networks
          
          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }
          
          const cached = await cache.match(request);
          return cached || networkResponse;
        } catch (err) {
          // Offline fallback from Cache
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

  // 3. Images and Photos Caching Strategy (Cache-First)
  // Handles Unsplash, spot images, user photos
  const isImage =
    request.destination === 'image' ||
    url.hostname.includes('unsplash.com') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif)$/i);

  if (isImage) {
    event.respondWith(
      caches.open(IMAGES_CACHE).then(async (cache) => {
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
        } catch (err) {
          return cached || new Response(null, { status: 404 });
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
        } catch (err) {
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

  // 6. Generic Static Assets (JS, CSS, SVGs) (Stale-While-Revalidate)
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
