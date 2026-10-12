import React from 'react';

interface Map3DIconProps {
  className?: string;
}

export const Map3DIcon: React.FC<Map3DIconProps> = ({ className = 'w-6 h-6' }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M 50 10 L 90 30 L 50 50 L 10 30 Z"
        className="fill-zinc-700/40 dark:fill-white/40"
      />
      <path
        d="M 10 30 L 50 50 L 50 90 L 10 70 Z"
        className="fill-zinc-700/70 dark:fill-white/70"
      />
      <path
        d="M 50 50 L 90 30 L 90 70 L 50 90 Z"
        className="fill-zinc-700 dark:fill-white"
      />
    </svg>
  );
};
