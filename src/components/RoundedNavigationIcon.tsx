import React, { useId } from 'react';

interface RoundedNavigationIconProps {
  className?: string;
  size?: number;
  isGold?: boolean;
}

/**
 * Premium Apple Maps / SF Symbols style navigation location arrow
 * with extra-rounded tips, smooth curves and organic corners.
 * Supports authentic metallic gold gradient.
 */
export const RoundedNavigationIcon: React.FC<RoundedNavigationIconProps> = ({
  className = '',
  size = 26,
  isGold = false,
}) => {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill={isGold ? `url(#${gradientId})` : 'currentColor'}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible' }}
    >
      {isGold && (
        <defs>
          <linearGradient id={gradientId} x1="10%" y1="10%" x2="90%" y2="90%">
            <stop offset="0%" stopColor="#B88214" />
            <stop offset="22%" stopColor="#E6AC33" />
            <stop offset="48%" stopColor="#FFF4A3" />
            <stop offset="68%" stopColor="#F5BE38" />
            <stop offset="88%" stopColor="#C98B18" />
            <stop offset="100%" stopColor="#9E6505" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M 42.5 53.5 
           L 24.2 46.2 
           C 17.2 43.4, 16.5 34.8, 22.8 31.4 
           L 69.5 13.5 
           C 76.8 10.5, 84.5 18.2, 81.5 25.5 
           L 63.6 72.2 
           C 60.2 78.5, 51.6 77.8, 48.8 70.8 
           L 41.5 52.5 
           Z"
        fill={isGold ? `url(#${gradientId})` : 'currentColor'}
        stroke={isGold ? `url(#${gradientId})` : 'currentColor'}
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};
