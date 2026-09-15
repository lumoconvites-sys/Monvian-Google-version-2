import React from 'react';

interface BarCompassIconProps {
  className?: string;
  size?: number;
}

export const BarCompassIcon: React.FC<BarCompassIconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 
        Circular compass icon as requested in the latest image reference:
        - Outer: Solid filled circle
        - Inner: Organic rounded compass needle rotated diagonally
        - Center: Solid dot inside the needle
        Light mode: Black circle, White needle, Black center dot
        Dark mode: White circle, Dark needle, White center dot
      */}
      {/* Outer Circle */}
      <circle cx="50" cy="50" r="48" className="fill-zinc-900 dark:fill-white" />

      {/* Rotating Inner Needle & Center Dot */}
      <g transform="rotate(45 50 50)">
        {/* Needle */}
        <path
          d="M 50 22 C 52 14, 58 14, 60 22 C 67 31, 75 40, 75 50 C 75 60, 67 69, 60 78 C 58 86, 52 86, 50 78 C 43 69, 35 60, 35 50 C 35 40, 43 31, 50 22 Z"
          className="fill-white dark:fill-zinc-900"
        />
        {/* Center Dot */}
        <circle cx="50" cy="50" r="7.5" className="fill-zinc-900 dark:fill-white" />
      </g>
    </svg>
  );
};
