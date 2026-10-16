import React from 'react';

interface ProfileIconProps {
  className?: string;
  size?: number;
}

export const ProfileIcon: React.FC<ProfileIconProps> = ({ className = '', size = 24 }) => {
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
        Solid minimalist user profile icon matching exact reference image:
        - Top: Pure round circle head
        - Bottom: Smooth rounded capsule body with organic pill corners
        - Single uniform color: Black (#000000) in light mode, White (#FFFFFF) in dark mode
      */}
      {/* Head */}
      <circle cx="50" cy="28" r="19" fill="currentColor" />
      
      {/* Body / Shoulders */}
      <rect
        x="15"
        y="53"
        width="70"
        height="36"
        rx="18"
        ry="18"
        fill="currentColor"
      />
    </svg>
  );
};
