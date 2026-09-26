export interface MapVisualIconMeta {
  category: string;
  label: string;
  shortLabel: string;
  bgColor: string;
  iconName: string;
  svgInner: string;
}

export const MAP_VISUAL_ICON_CATEGORIES: Record<string, MapVisualIconMeta> = {
  gas_station: {
    category: 'gas_station',
    label: 'Posto de Gasolina',
    shortLabel: 'Posto',
    bgColor: '#2563EB', // Blue
    iconName: 'Fuel',
    svgInner: `
      <path d="M4 22V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M4 11h10" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M14 8h2a2 2 0 0 1 2 2v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.5a1.5 1.5 0 0 0-2.5-1.1L18 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="9" cy="7" r="1.2" fill="white"/>
    `
  },
  pharmacy: {
    category: 'pharmacy',
    label: 'Farmácia',
    shortLabel: 'Farmácia',
    bgColor: '#E11D48', // Coral Red
    iconName: 'Plus',
    svgInner: `
      <path d="M12 5v14M5 12h14" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  mountain_peak: {
    category: 'mountain_peak',
    label: 'Pico / Montanha',
    shortLabel: 'Pico',
    bgColor: '#0F766E', // Deep Teal / Alpine Forest
    iconName: 'Mountain',
    svgInner: `
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M4.5 16.5 8 12l3 4.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  hospital: {
    category: 'hospital',
    label: 'Hospital / P.S.',
    shortLabel: 'Hospital',
    bgColor: '#DC2626', // Bright Red
    iconName: 'Cross',
    svgInner: `
      <rect x="9" y="4" width="6" height="16" rx="1.5" fill="white" />
      <rect x="4" y="9" width="16" height="6" rx="1.5" fill="white" />
    `
  },
  parking: {
    category: 'parking',
    label: 'Estacionamento',
    shortLabel: 'Estacionamento',
    bgColor: '#0284C7', // Sky / Royal Blue
    iconName: 'Parking',
    svgInner: `
      <text x="12" y="17.5" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Roboto, sans-serif" font-weight="900" font-size="16" fill="white">P</text>
    `
  },
  market: {
    category: 'market',
    label: 'Mercado / Supermercado',
    shortLabel: 'Mercado',
    bgColor: '#D97706', // Amber
    iconName: 'ShoppingCart',
    svgInner: `
      <circle cx="8" cy="21" r="1.5" fill="white"/>
      <circle cx="19" cy="21" r="1.5" fill="white"/>
      <path d="M2.5 3h3l2.4 11.5a2 2 0 0 0 2 1.5h8.6a2 2 0 0 0 2-1.6l1.5-7.4H6.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  cafe: {
    category: 'cafe',
    label: 'Café / Cafeteria',
    shortLabel: 'Café',
    bgColor: '#EA580C', // Warm Orange
    iconName: 'Coffee',
    svgInner: `
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="6" y1="2" x2="6" y2="4" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="2" x2="10" y2="4" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <line x1="14" y1="2" x2="14" y2="4" stroke="white" stroke-width="2" stroke-linecap="round"/>
    `
  },
  restaurant: {
    category: 'restaurant',
    label: 'Restaurante / Gastronomia',
    shortLabel: 'Restaurante',
    bgColor: '#F97316', // Coral Orange
    iconName: 'Utensils',
    svgInner: `
      <path d="M18 2v20M21 2v6a3 3 0 0 1-3 3M18 11v11" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M5 2v7a3 3 0 0 0 6 0V2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="8" y1="9" x2="8" y2="22" stroke="white" stroke-width="2" stroke-linecap="round"/>
    `
  },
  restroom: {
    category: 'restroom',
    label: 'Banheiro Público',
    shortLabel: 'Banheiro',
    bgColor: '#0891B2', // Cyan
    iconName: 'Restroom',
    svgInner: `
      <circle cx="9" cy="5" r="2" fill="white"/>
      <path d="M6 10h6v6h-2v5H8v-5H6z" fill="white"/>
      <circle cx="17" cy="5" r="2" fill="white"/>
      <path d="M14 10l3 9 3-9z" fill="white"/>
    `
  },
  park: {
    category: 'park',
    label: 'Parque / Bosque',
    shortLabel: 'Parque',
    bgColor: '#16A34A', // Lush Green
    iconName: 'Trees',
    svgInner: `
      <path d="M12 2L6 10h3l-4 6h5v4h4v-4h5l-4-6h3L12 2z" fill="white"/>
    `
  },
  viewpoint: {
    category: 'viewpoint',
    label: 'Mirante / Ponto Fotográfico',
    shortLabel: 'Mirante',
    bgColor: '#9333EA', // Purple
    iconName: 'Camera',
    svgInner: `
      <path d="M14.5 4h-5L7.5 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5L14.5 4z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="13" r="3.5" stroke="white" stroke-width="2" fill="none"/>
    `
  },
  terminal: {
    category: 'terminal',
    label: 'Terminal / Estação',
    shortLabel: 'Terminal',
    bgColor: '#4F46E5', // Indigo
    iconName: 'Train',
    svgInner: `
      <rect x="4" y="3" width="16" height="15" rx="3" stroke="white" stroke-width="2" fill="none"/>
      <path d="M4 11h16" stroke="white" stroke-width="2"/>
      <circle cx="8" cy="15" r="1.5" fill="white"/>
      <circle cx="16" cy="15" r="1.5" fill="white"/>
      <path d="m8 19-3 3M16 19l3 3" stroke="white" stroke-width="2" stroke-linecap="round"/>
    `
  },
  church: {
    category: 'church',
    label: 'Igreja / Templo',
    shortLabel: 'Igreja',
    bgColor: '#475569', // Slate Grey
    iconName: 'Church',
    svgInner: `
      <path d="M12 3v18M7 8h10" stroke="white" stroke-width="3" stroke-linecap="round"/>
    `
  },
  lodging: {
    category: 'lodging',
    label: 'Pousada / Hotel',
    shortLabel: 'Pousada',
    bgColor: '#7C3AED', // Violet
    iconName: 'Bed',
    svgInner: `
      <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="8" cy="12" r="2" fill="white"/>
    `
  },
  transit: {
    category: 'transit',
    label: 'Ponto de Ônibus / Transporte',
    shortLabel: 'Transporte',
    bgColor: '#2563EB', // Blue
    iconName: 'Bus',
    svgInner: `
      <rect x="4" y="3" width="16" height="14" rx="2" stroke="white" stroke-width="2" fill="none"/>
      <path d="M4 9h16" stroke="white" stroke-width="2"/>
      <circle cx="7.5" cy="13.5" r="1.2" fill="white"/>
      <circle cx="16.5" cy="13.5" r="1.2" fill="white"/>
      <path d="M7 17v2M17 17v2" stroke="white" stroke-width="2" stroke-linecap="round"/>
    `
  },
  atm: {
    category: 'atm',
    label: 'Caixa Eletrônico / Banco',
    shortLabel: 'Caixa Eletrônico',
    bgColor: '#059669', // Emerald
    iconName: 'CreditCard',
    svgInner: `
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" stroke-width="2" fill="none"/>
      <line x1="2" y1="9" x2="22" y2="9" stroke="white" stroke-width="2"/>
      <circle cx="6" cy="14" r="1.2" fill="white"/>
    `
  }
};

export const DEFAULT_CATEGORY_KEYS = Object.keys(MAP_VISUAL_ICON_CATEGORIES);

/**
 * Generates the clean HTML string for MapLibre marker
 * Strictly pointer-events-none and user-select-none
 */
export function generateMarkerHtml(categoryKey: string, size = 18, customColor?: string): string {
  const meta = MAP_VISUAL_ICON_CATEGORIES[categoryKey] || MAP_VISUAL_ICON_CATEGORIES.gas_station;
  const innerSize = Math.round(size * 0.58);
  const bgColor = (customColor && customColor.trim()) ? customColor.trim() : meta.bgColor;

  return `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 9999px;
      background-color: ${bgColor};
      border: 1.5px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none !important;
      user-select: none !important;
      -webkit-user-select: none !important;
    ">
      <svg
        viewBox="0 0 24 24"
        width="${innerSize}"
        height="${innerSize}"
        style="display: block; pointer-events: none; overflow: visible;"
      >
        ${meta.svgInner}
      </svg>
    </div>
  `;
}
