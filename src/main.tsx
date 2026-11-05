import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/registerSW';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startPreloadResources } from './utils/preloadItineraries';
import { gpsNavigationManager } from './services/gpsNavigation';

function checkIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 768;
}

let mobileInitialized = false;

function RootGate() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => checkIsDesktop());

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(checkIsDesktop());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop && !mobileInitialized) {
      mobileInitialized = true;
      registerServiceWorker();
      startPreloadResources();
      gpsNavigationManager.resetSessionOnBoot();
    }
  }, [isDesktop]);

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-[99999] w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none">
        <img
          src="/assets/aistudio/Experi_ncia_exclusiva_para_iPhone_1b92f668.png"
          alt="Uma experiência feita para iPhone"
          className="w-full h-full object-contain object-center bg-black pointer-events-none"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <RootGate />,
);


