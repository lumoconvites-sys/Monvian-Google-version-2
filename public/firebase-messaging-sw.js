// Monvian — Firebase Cloud Messaging Background Service Worker
// Handles background Web Push messages from FCM for new spots & itinerary updates.

function sanitizeSafeTargetUrl(rawUrl, spotId, itineraryId) {
  if (typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
    return rawUrl;
  }
  if (spotId) {
    return '/?spot=' + encodeURIComponent(String(spotId));
  }
  if (itineraryId) {
    return '/?itinerary=' + encodeURIComponent(String(itineraryId));
  }
  return '/';
}

function sanitizeImageUrl(rawImage) {
  if (typeof rawImage !== 'string') return undefined;
  const trimmed = rawImage.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return trimmed;
  }
  return undefined;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Standard Web Push handler (compatible with FCM HTTP v1 webpush payloads)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'Monvian', body: event.data.text() } };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = String(notification.title || data.title || 'Monvian').slice(0, 120);
  const body = String(notification.body || data.body || 'Nova atualização em Campos do Jordão.').slice(0, 240);
  const spotId = data.spotId ? String(data.spotId) : '';
  const itineraryId = data.itineraryId ? String(data.itineraryId) : '';
  const alertType = data.type ? String(data.type) : (itineraryId ? 'itinerary_update' : 'new_spot');
  const alertId = data.alertId ? String(data.alertId) : ('fcm-' + Date.now());
  const image = sanitizeImageUrl(notification.image || data.imageUrl);
  const targetUrl = sanitizeSafeTargetUrl(data.url, spotId, itineraryId);

  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/notification-badge.png',
    tag: 'monvian-push-' + alertId,
    renotify: true,
    data: {
      alertId,
      alertType,
      spotId,
      itineraryId,
      url: targetUrl,
    },
  };

  if (image) {
    options.image = image;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const spotId = data.spotId ? String(data.spotId) : '';
  const itineraryId = data.itineraryId ? String(data.itineraryId) : '';
  const alertType = data.alertType ? String(data.alertType) : '';
  const targetUrl = sanitizeSafeTargetUrl(data.url, spotId, itineraryId);

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
