import { useState, useEffect } from 'react';
import { monvianXpManager, XpProfileState } from '../services/xpService';

export function useMonvianXp() {
  const [xpState, setXpState] = useState<XpProfileState>(() => monvianXpManager.getState());

  useEffect(() => {
    const unsubscribe = monvianXpManager.subscribe((state) => {
      setXpState(state);
    });

    // Refresh profile from server on mount
    monvianXpManager.fetchProfile().catch(() => {});

    return () => {
      unsubscribe();
    };
  }, []);

  return xpState;
}
