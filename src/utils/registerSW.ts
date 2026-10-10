// Service Worker Registration for Monvian PWA
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      // In development mode, ensure no old service worker intercepts Vite dynamic imports
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Listen for updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[Monvian SW] Nova versão disponível');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[Monvian SW] Erro ao registrar Service Worker:', err);
        });
    });
  }
}

