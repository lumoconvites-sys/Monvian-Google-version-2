import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-rose-500/90 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Modo Offline</span>
    </div>
  );
};
export default OfflineIndicator;
