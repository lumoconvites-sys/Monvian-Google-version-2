import React from 'react';

interface Map3DIconProps {
  mode?: '3D' | '2D';
  className?: string;
  style?: React.CSSProperties;
}

export const Map3DIcon: React.FC<Map3DIconProps> = ({
  mode = '3D',
  className = '',
  style,
}) => (
  <span
    aria-hidden="true"
    style={{
      color: '#111111',
      ...style,
    }}
    className={`inline-flex items-center justify-center font-bold tracking-[-0.03em] leading-none pointer-events-none select-none text-[19px] sm:text-[21px] ${className}`}
  >
    {mode}
  </span>
);

export default Map3DIcon;
