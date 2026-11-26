import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/registerSW';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startPreloadResources } from './utils/preloadItineraries';
import { gpsNavigationManager } from './services/gpsNavigation';
import { LanguageProvider } from './contexts/LanguageContext';
import { tryAutoRecoverFromChunkError } from './utils/lazyWithRetry';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    void tryAutoRecoverFromChunkError();
  });

  // Clean up temporary cache-bust query parameter (_mv) from URL bar after recovery
  try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('_mv')) {
      currentUrl.searchParams.delete('_mv');
      window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
    }
  } catch {}
}

let appInitialized = false;

function RootGate() {
  useEffect(() => {
    if (!appInitialized) {
      appInitialized = true;
      registerServiceWorker();
      startPreloadResources();
      gpsNavigationManager.resetSessionOnBoot();
    }
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <RootGate />,
);



