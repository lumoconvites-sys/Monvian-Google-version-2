import React from 'react';
import { Navigation } from 'lucide-react';

export interface RoundedNavigationIconProps {
  className?: string;
  isGold?: boolean;
  size?: number;
}

export const RoundedNavigationIcon: React.FC<RoundedNavigationIconProps> = ({
  className = 'w-5 h-5',
  isGold = false,
  size,
}) => (
  <Navigation
    size={size}
    className={`${className} ${isGold ? 'text-amber-400' : ''}`}
  />
);

export default RoundedNavigationIcon;
