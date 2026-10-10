import React from 'react';

interface Map3DIconProps {
  className?: string;
}

/**
 * Premium minimalist 3D map icon inspired by iOS native design and Apple Maps.
 * - 1024x1024 viewBox with pure white background (#FFFFFF).
 * - Single centered isometric 3D map symbol occupying ~65% of area.
 * - Monochromatic graphite/black material with subtle light & shadow gradients for 3D depth.
 * - Zero text, numbers, blue, green, or neon.
 */
export const Map3DIcon: React.FC<Map3DIconProps> = ({ className = 'w-6 h-6' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none overflow-hidden rounded-full ${className}`}>
      <svg
        viewBox="0 0 1024 1024"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:drop-shadow-[0_6px_16px_rgba(0,0,0,0.6)]"
      >
        <defs>
          {/* Background */}
          <rect width="1024" height="1024" fill="#FFFFFF" />

          {/* Graphite Material Gradients for 3D Isomorphic Map Panels */}
          <linearGradient id="mapTopPanel" x1="200" y1="200" x2="800" y2="700" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3A3B40" />
            <stop offset="50%" stopColor="#222327" />
            <stop offset="100%" stopColor="#151619" />
          </linearGradient>

          <linearGradient id="mapLeftPanel" x1="200" y1="500" x2="500" y2="900" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2A2B30" />
            <stop offset="100%" stopColor="#121316" />
          </linearGradient>

          <linearGradient id="mapRightPanel" x1="500" y1="500" x2="800" y2="900" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4A4B52" />
            <stop offset="100%" stopColor="#2C2D32" />
          </linearGradient>

          <linearGradient id="pinMetal" x1="450" y1="200" x2="574" y2="600" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#64656D" />
            <stop offset="50%" stopColor="#3A3B40" />
            <stop offset="100%" stopColor="#1D1E22" />
          </linearGradient>

          {/* Soft Shadow under 3D map */}
          <radialGradient id="mapShadow" cx="512" cy="850" r="300" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Pure White Canvas Base */}
        <rect width="1024" height="1024" fill="#FFFFFF" />

        {/* Ground Soft Contact Shadow */}
        <ellipse cx="512" cy="840" rx="280" ry="70" fill="url(#mapShadow)" />

        {/* 3D Isometric Map Symbol Group (Centered, ~65% area = scale/coords around 250-774) */}
        <g transform="translate(0, 30)">
          {/* Map Left Fold Side */}
          <path
            d="M 230 420 L 512 580 L 512 820 L 230 660 Z"
            fill="url(#mapLeftPanel)"
          />

          {/* Map Right Fold Side */}
          <path
            d="M 794 420 L 512 580 L 512 820 L 794 660 Z"
            fill="url(#mapRightPanel)"
          />

          {/* Map Top Surface (Isometric Diamond / Folded Map) */}
          <path
            d="M 512 240 L 820 420 L 512 600 L 204 420 Z"
            fill="url(#mapTopPanel)"
          />

          {/* Subtle engraved grid lines on map surface */}
          <path
            d="M 512 300 L 700 410 M 512 360 L 620 420 M 512 420 L 400 480 M 512 480 L 320 430"
            stroke="#5A5B62"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* Center 3D Navigation Pin / Marker standing on the map */}
          <g transform="translate(0, -30)">
            {/* Pin casting shadow on map */}
            <ellipse cx="512" cy="530" rx="35" ry="15" fill="#000000" opacity="0.4" />

            {/* 3D Pin Head (Isometric teardrop/sphere) */}
            <path
              d="M 512 320 C 472 320, 440 352, 440 392 C 440 440, 512 512, 512 512 C 512 512, 584 440, 584 392 C 584 352, 552 320, 512 320 Z"
              fill="url(#pinMetal)"
            />
            {/* Pin Inner Specular Highlight */}
            <circle cx="500" cy="380" r="14" fill="#8E8F98" opacity="0.6" />
            <circle cx="512" cy="392" r="8" fill="#151619" />
          </g>
        </g>
      </svg>
    </div>
  );
};
