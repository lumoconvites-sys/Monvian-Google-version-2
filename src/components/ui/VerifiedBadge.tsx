import React from 'react';
import { Check } from 'lucide-react';

export const VerifiedBadge: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-blue-500 text-white ${className}`}>
    <Check className="w-2.5 h-2.5 stroke-[3]" />
  </span>
);
export default VerifiedBadge;
