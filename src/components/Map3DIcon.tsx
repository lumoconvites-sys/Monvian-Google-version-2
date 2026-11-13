import React from 'react';

export const Map3DIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = 'w-[30px] h-[30px] sm:w-[36px] sm:h-[36px]',
  style,
}) => (
  <img
    src="/assets/aistudio/5323926_d82d0d18.png"
    alt="Mapa"
    style={style}
    draggable={false}
    className={`object-contain pointer-events-none select-none ${className}`}
  />
);

export default Map3DIcon;
