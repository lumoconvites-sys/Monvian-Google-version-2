import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/registerSW';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startPreloadResources } from './utils/preloadItineraries';
import { gpsNavigationManager } from './services/gpsNavigation';

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
      <App />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <RootGate />,
);



