import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
  filled?: boolean;
  style?: React.CSSProperties;
}

/**
 * 1. Explorar (antigo Agora): Bússola minimalista no padrão Apple iOS SF Symbols.
 * Espessura de traço uniforme (2.15) e proporções equilibradas para 28–30px.
 */
export const NavAgoraIcon: React.FC<IconProps> = ({ className = '', size = 28, style }) => {
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
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 8.2L13.3 13.3L8.2 15.8L10.7 10.7L15.8 8.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const NavExploreIcon: React.FC<IconProps> = ({ className = '', size = 28, style }) => {
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
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        opacity="0.32"
      />
      <path
        d="M12 3.6C12 8.2 15.8 12 20.4 12C15.8 12 12 15.8 12 20.4C12 15.8 8.2 12 3.6 12C8.2 12 12 8.2 12 3.6Z"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
};

export const NavChatIcon: React.FC<IconProps> = ({ className = '', size = 28, style }) => {
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
        d="M6.8 18C4.7 18 3 16.3 3 14.2V8.8C3 6.7 4.7 5 6.8 5H17.2C19.3 5 21 6.7 21 8.8V14.2C21 16.3 19.3 18 17.2 18H13.2L8.9 21.2C8.35 21.6 7.6 21.25 7.6 20.6V18H6.8Z"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.8" cy="11.5" r="1.15" fill="currentColor" />
      <path
        d="M12 8.6C12 10.1 13.1 11.2 14.6 11.2C13.1 11.2 12 12.3 12 13.8C12 12.3 10.9 11.2 9.4 11.2C10.9 11.2 12 10.1 12 8.6Z"
        fill="currentColor"
      />
      <circle cx="16.2" cy="11.5" r="1.15" fill="currentColor" />
    </svg>
  );
};

/**
 * 2. Salvos / Favoritos: Ícone de coração no padrão Apple iOS SF Symbols.
 * Espessura de traço uniforme (2.15) e proporções equilibradas para 28–30px.
 */
export const NavSalvosIcon: React.FC<IconProps> = ({
  className = '',
  size = 28,
  filled = false,
  style,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const NavPostsIcon: React.FC<IconProps> = ({ className = '', size = 28, style }) => {
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
      <rect
        x="3"
        y="3.5"
        width="18"
        height="17"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8.5" r="1.5" fill="currentColor" />
      <path
        d="M20.5 15.5L15.5 10.8C15.1 10.4 14.4 10.4 14 10.8L4 20"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * 3. Buscar: Lupa refinada com traço uniforme (2.15) e proporções equilibradas para 28–30px.
 */
export const NavSearchIcon: React.FC<IconProps> = ({ className = '', size = 28, style }) => {
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
      <circle
        cx="10.8"
        cy="10.8"
        r="6.8"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M15.8 15.8L20.4 20.4"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 4. Perfil: Silhueta geométrica limpa e moderna com traço uniforme (2.15).
 */
export const NavProfileIcon: React.FC<IconProps> = ({ className = '', size = 28, style }) => {
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
      <circle
        cx="12"
        cy="7.5"
        r="3.85"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M4.8 19.5C4.8 15.85 8 13.1 12 13.1C16 13.1 19.2 15.85 19.2 19.5"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 5. Roteiros: Linha de rota minimalista conectando dois pontos no padrão iOS com traço uniforme (2.15).
 */
export const NavRoteirosIcon: React.FC<IconProps> = ({ className = '', size = 28, style }) => {
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
        d="M6 18C6 11.5 18 12.5 18 6"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <circle cx="6" cy="18" r="2.75" fill="currentColor" />
      <circle cx="18" cy="6" r="2.75" fill="currentColor" />
    </svg>
  );
};


