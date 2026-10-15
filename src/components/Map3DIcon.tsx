import React from 'react';
import { Layers } from 'lucide-react';

export const Map3DIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <div className={`flex items-center justify-center text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)] ${className}`}>
    <Layers className="w-full h-full stroke-[2]" />
  </div>
);
export default Map3DIcon;
