import React from 'react';
import { Navigation } from 'lucide-react';

export const RoundedNavigationIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <Navigation className={className} />
);
export default RoundedNavigationIcon;
