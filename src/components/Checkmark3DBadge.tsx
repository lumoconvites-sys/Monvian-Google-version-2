import React from 'react';
import { Check } from 'lucide-react';

interface Checkmark3DBadgeProps {
  size?: number;
  glow?: boolean;
  className?: string;
}

export const Checkmark3DBadge: React.FC<Checkmark3DBadgeProps> = ({
  size = 24,
  glow = true,
  className = '',
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shrink-0 ${
        glow ? 'shadow-[0_2px_10px_rgba(16,185,129,0.5)]' : 'shadow-xs'
      } border border-emerald-300/40 ${className}`}
    >
      <Check
        className="text-white drop-shadow-xs"
        style={{ width: size * 0.58, height: size * 0.58 }}
        strokeWidth={3.5}
      />
    </div>
  );
};
