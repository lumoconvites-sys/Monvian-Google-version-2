import React from 'react';

interface SnowEffectProps {
  enabled: boolean;
  theme?: string;
}

export const SnowEffect: React.FC<SnowEffectProps> = ({ enabled }) => {
  if (!enabled) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-20 bg-cyan-300/[0.03] backdrop-blur-[0.2px]" />
  );
};
export default SnowEffect;
