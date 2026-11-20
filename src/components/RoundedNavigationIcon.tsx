import React from 'react';

export interface RoundedNavigationIconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const RoundedNavigationIcon: React.FC<RoundedNavigationIconProps> = ({
  className = 'w-5 h-5',
  size = 24,
  style,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M5.61 8.99L18.20 4.09Q21 3 19.91 5.80L15.01 18.39Q14 21 13.09 18.78L11.33 14.50Q10.8 13.2 9.50 12.67L5.22 10.91Q3 10 5.61 8.99Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default RoundedNavigationIcon;

