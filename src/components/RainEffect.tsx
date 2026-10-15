import React from 'react';

interface RainEffectProps {
  enabled: boolean;
  weatherCode?: number;
  theme?: string;
}

export const RainEffect: React.FC<RainEffectProps> = ({ enabled }) => {
  if (!enabled) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-20 bg-blue-500/[0.03] backdrop-blur-[0.2px]" />
  );
};
export default RainEffect;
