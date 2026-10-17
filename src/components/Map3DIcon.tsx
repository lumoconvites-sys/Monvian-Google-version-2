import React from 'react';
import { Layers } from 'lucide-react';

export const Map3DIcon: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <div className={`flex items-center justify-center text-current drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] ${className}`}>
    <Layers className="w-full h-full stroke-[2.2]" />
  </div>
);
export default Map3DIcon;

