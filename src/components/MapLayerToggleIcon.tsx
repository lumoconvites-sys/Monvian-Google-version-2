import React, { useId } from 'react';

interface MapLayerToggleIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export const MapLayerToggleIcon: React.FC<MapLayerToggleIconProps> = ({
  className = 'w-6 h-6',
  style,
}) => {
  const maskId = useId();

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={style}
      className={`pointer-events-none select-none ${className}`}
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="32" height="32" fill="white" />
          {/* Organic white landmass cutout inside the semi-circular globe */}
          <path
            d="M 19.6 13.9 C 21.8 13.7, 23.8 14.9, 23.6 16.5 C 23.4 17.8, 21.6 17.8, 21.2 19.1 C 20.9 20.1, 22.4 20.9, 21.6 22.1 C 20.8 23.2, 18.7 22.8, 17.7 21.4 L 16.6 19.4 Z"
            fill="black"
          />
        </mask>
      </defs>

      {/* Left folded 3-panel map outline */}
      <path
        d="M 9.6 10.1 L 5.8 12.1 C 5.1 12.5 4.7 13.1 4.7 13.9 L 4.7 18.6 C 4.7 19.6 5.6 20.2 6.5 19.7 L 9.6 18.1 L 13.3 20.2"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 9.6 10.1 L 13.9 12.6 L 17.3 10.7"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 9.6 10.3 L 9.6 17.9"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      <path
        d="M 13.9 12.7 L 13.9 16.5"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />

      {/* Diagonal divider slash */}
      <path
        d="M 13.6 24.1 L 21.1 9.5"
        stroke="currentColor"
        strokeWidth="2.45"
        strokeLinecap="round"
      />

      {/* Lower-right Earth semi-globe with continent cutout */}
      <path
        d="M 20.6 13.3 L 17.1 20.1 A 5.75 5.75 0 1 0 20.6 13.3 Z"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
};

export default MapLayerToggleIcon;
