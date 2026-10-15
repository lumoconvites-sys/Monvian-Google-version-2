import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/registerSW';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DeviceBlocker } from './components/DeviceBlocker';
import { startPreloadResources } from './utils/preloadItineraries';

registerServiceWorker();
startPreloadResources();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <DeviceBlocker>
        <App />
      </DeviceBlocker>
    </ErrorBoundary>
  </StrictMode>,
);

