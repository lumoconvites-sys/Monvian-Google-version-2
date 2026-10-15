import React, { useEffect, useState } from 'react';

interface DeviceBlockerProps {
  children: React.ReactNode;
}

export const DeviceBlocker: React.FC<DeviceBlockerProps> = ({ children }) => {
  const [isIPhone, setIsIPhone] = useState<boolean | null>(null);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

    // Check specifically for iPhone
    const isIphoneDevice = /iPhone/i.test(ua) || (platform === 'iPhone');
    
    // Check for Android
    const isAndroidDevice = /Android/i.test(ua);

    setIsIPhone(isIphoneDevice);
    setIsAndroid(isAndroidDevice);
  }, []);

  // During initial mount detection, render nothing or children safely
  if (isIPhone === null) {
    return <>{children}</>;
  }

  // 3. For iPhone: allow normal access to the site without any blocking screens
  if (isIPhone) {
    return <>{children}</>;
  }

  // 1. For Android: display mobile reference image on pure black background, full screen, no margins, no extra elements
  if (isAndroid) {
    return (
      <div
        className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center m-0 p-0 overflow-hidden select-none z-[99999]"
        style={{ backgroundColor: '#000000', margin: 0, padding: 0 }}
      >
        <img
          src="/bloqueio.jpeg"
          alt="Monvian iPhone Exclusive"
          className="w-full h-full object-contain max-h-screen max-w-screen"
          style={{ objectFit: 'contain' }}
          onError={(e) => {
            // Graceful fallback if user hasn't placed file in /public yet
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  // 2. For Computers/Desktop: display horizontal reference image occupying the full visible area preserving proportions
  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center m-0 p-0 overflow-hidden select-none z-[99999]"
      style={{ backgroundColor: '#000000', margin: 0, padding: 0 }}
    >
      <img
        src="/bloqueiopc.jpeg"
        alt="Monvian iPhone Exclusive"
        className="w-full h-full object-contain max-h-screen max-w-screen"
        style={{ objectFit: 'contain' }}
        onError={(e) => {
          // Graceful fallback if user hasn't placed file in /public yet
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
};
