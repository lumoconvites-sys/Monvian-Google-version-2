import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/registerSW';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startPreloadResources } from './utils/preloadItineraries';
import { gpsNavigationManager } from './services/gpsNavigation';

registerServiceWorker();
startPreloadResources();
gpsNavigationManager.resetSessionOnBoot();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

