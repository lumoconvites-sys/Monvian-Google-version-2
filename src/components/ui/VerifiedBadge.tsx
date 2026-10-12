import React from 'react';

interface VerifiedBadgeProps {
  className?: string;
  isGold?: boolean;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  className = 'w-3.5 h-3.5',
  isGold = false,
}) => {
  return (
    <svg
      className={`${className} shrink-0 select-none inline-block align-middle`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Verificado"
    >
      <circle
        cx="12"
        cy="12"
        r="11"
        fill={isGold ? 'url(#verified-gold-grad)' : '#FFFFFF'}
      />
      {isGold && (
        <defs>
          <linearGradient id="verified-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B88214" />
            <stop offset="35%" stopColor="#FFF4A3" />
            <stop offset="70%" stopColor="#F5BE38" />
            <stop offset="100%" stopColor="#9E6505" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M7.5 12.2L10.5 15.2L16.5 8.8"
        stroke={isGold ? '#1A1202' : 'white'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
