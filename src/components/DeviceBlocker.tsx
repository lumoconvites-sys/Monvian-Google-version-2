import React, { useEffect, useState } from 'react';

export const DeviceBlocker = ({ children }: { children: React.ReactNode }) => {
  const [deviceType, setDeviceType] = useState<'iphone' | 'android' | 'desktop' | 'checking'>('checking');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) {
      setDeviceType('iphone');
    } else if (/Android/i.test(ua)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }
  }, []);

  if (deviceType === 'checking') {
    return null; // Or a loading screen
  }

  if (deviceType === 'android') {
    return (
      <div className="fixed inset-0 bg-black z-[999999] flex items-center justify-center">
        <img src="/bloqueio.jpeg" alt="Acesso restrito" className="w-full h-full object-contain" />
      </div>
    );
  }

  if (deviceType === 'desktop') {
    return (
      <div className="fixed inset-0 bg-black z-[999999] flex items-center justify-center">
        <img src="/bloqueiopc.jpeg" alt="Acesso restrito" className="w-full h-full object-contain" />
      </div>
    );
  }

  return <>{children}</>;
};
