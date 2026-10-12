import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * 1. Explorar: Símbolo de exploração moderno, sofisticado e minimalista.
 * Combina um horizonte orbital suave e uma estrela voyager de descoberta de 4 pontas
 * com curvas aerodinâmicas e ponto focal central.
 * Substitui a antiga bússola com agulha / rosa dos ventos tradicional.
 */
/**
 * 1. Explorar (antigo Agora): Bússola minimalista no padrão Apple iOS SF Symbols.
 */
export const NavAgoraIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 8L13.2 13.2L8 16L10.8 10.8L16 8Z"
        fill="currentColor"
      />
    </svg>
  );
};

export const NavExploreIcon: React.FC<IconProps> = ({ className = '', size = 25 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Anel guia de horizonte sutil */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.32"
      />
      {/* Estrela de Descoberta / Farol Voyager com curvas geométricas suaves */}
      <path
        d="M12 3.6C12 8.2 15.8 12 20.4 12C15.8 12 12 15.8 12 20.4C12 15.8 8.2 12 3.6 12C8.2 12 12 8.2 12 3.6Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="currentColor"
        fillOpacity="0.16"
      />
      {/* Núcleo focal do ponto de interesse */}
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
};

/**
 * 2. Chat: Balão de conversa moderno, minimalista e expressivo.
 * Sem foto ou avatar de personagem, com cantos arredondados iOS e
 * detalhes internos que transmitem assistência inteligente.
 */
export const NavChatIcon: React.FC<IconProps> = ({ className = '', size = 25 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Balão de diálogo com cantos arredondados contínuos */}
      <path
        d="M6.8 18C4.7 18 3 16.3 3 14.2V8.8C3 6.7 4.7 5 6.8 5H17.2C19.3 5 21 6.7 21 8.8V14.2C21 16.3 19.3 18 17.2 18H13.2L8.9 21.2C8.35 21.6 7.6 21.25 7.6 20.6V18H6.8Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Detalhe interno de inteligência / assistente turístico */}
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
 * 2.5. Salvos / Favoritos: Ícone de coração no padrão Apple iOS SF Symbols / Airbnb.
 * Traço fino e refinado, proporções equilibradas e preenchimento adaptativo.
 */
export const NavSalvosIcon: React.FC<IconProps & { filled?: boolean }> = ({ className = '', size = 22, filled = false }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 21.05c-.32 0-.63-.12-.87-.34-4.83-4.39-7.98-7.39-7.98-11.21 0-3.12 2.37-5.5 5.5-5.5 1.95 0 3.75 1.01 4.75 2.59 1-1.58 2.8-2.59 4.75-2.59 3.13 0 5.5 2.38 5.5 5.5 0 3.82-3.15 6.82-7.98 11.21-.24.22-.55.34-.87.34z"
        stroke="currentColor"
        strokeWidth={filled ? '0' : '1.85'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const NavPostsIcon: React.FC<IconProps> = ({ className = '', size = 23 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3.5"
        width="18"
        height="17"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8.5" r="1.5" fill="currentColor" />
      <path
        d="M20.5 15.5L15.5 10.8C15.1 10.4 14.4 10.4 14 10.8L4 20"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};


/**
 * 3. Buscar: Lupa redesenhada refinada, com traços uniformes e proporções
 * equilibradas no padrão premium do iOS.
 */
export const NavSearchIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Lente circular perfeitamente balanceada */}
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* Haste a 45 graus com ponta arredondada */}
      <path
        d="M15.3 15.3L20.2 20.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 4. Perfil: Usuário em traços geométricos limpos, elegantes e minimalistas,
 * mantendo a mesma espessura e harmonia do sistema.
 */
export const NavProfileIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Cabeça */}
      <circle
        cx="12"
        cy="7.5"
        r="3.75"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* Ombros / Tronco */}
      <path
        d="M5 19.5C5 15.9 8.1 13 12 13C15.9 13 19 15.9 19 19.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * 5. Roteiros: Linha de rota minimalista e elegante conectando dois pontos no padrão iOS.
 */
export const NavRoteirosIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 18C6 11.5 18 12.5 18 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="6" cy="18" r="2.8" fill="currentColor" />
      <circle cx="18" cy="6" r="2.8" fill="currentColor" />
    </svg>
  );
};

