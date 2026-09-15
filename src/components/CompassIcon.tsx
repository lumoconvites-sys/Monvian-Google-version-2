import React from 'react';

interface CompassIconProps {
  className?: string;
  size?: number;
}

export const CompassIcon: React.FC<CompassIconProps> = ({ className = '', size = 24 }) => {
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
        Solid, organic diagonal compass needle with extra-rounded corners matching the reference image.
        Single uniform color: Solid Black (#000000) in light mode, Solid White (#FFFFFF) in dark mode.
      */}
      <path
        d="M 45 18 C 47 10, 53 10, 55 18 C 62 28, 70 37, 70 50 C 70 63, 62 72, 55 82 C 53 90, 47 90, 45 82 C 38 72, 30 63, 30 50 C 30 37, 38 28, 45 18 Z"
        className="fill-black dark:fill-white text-black dark:text-white"
        transform="rotate(52 50 50)"
      />
    </svg>
  );
};

