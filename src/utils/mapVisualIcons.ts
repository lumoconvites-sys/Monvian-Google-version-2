import dynamicIconImports from 'lucide-react/dynamicIconImports';
import type { MapVisualIcon } from '../types';

export type LucideSvgNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;

export interface StopIconCategoryPreset {
  key: string;
  label: string;
  shortLabel: string;
  defaultIcon: string;
  defaultColor: string;
}

export const STOP_ICON_CATEGORY_PRESETS: StopIconCategoryPreset[] = [
  {
    key: 'gas_station',
    label: 'Posto de Combustível',
    shortLabel: 'Posto',
    defaultIcon: 'fuel',
    defaultColor: '#1668FF',
  },
  {
    key: 'pharmacy',
    label: 'Farmácia',
    shortLabel: 'Farmácia',
    defaultIcon: 'pill',
    defaultColor: '#EC4899',
  },
  {
    key: 'hospital',
    label: 'Hospital',
    shortLabel: 'Hospital',
    defaultIcon: 'cross',
    defaultColor: '#EF4444',
  },
  {
    key: 'parking',
    label: 'Estacionamento',
    shortLabel: 'Estacionamento',
    defaultIcon: 'circle-parking',
    defaultColor: '#0284C7',
  },
  {
    key: 'restaurant',
    label: 'Restaurante',
    shortLabel: 'Restaurante',
    defaultIcon: 'utensils',
    defaultColor: '#F97316',
  },
  {
    key: 'market',
    label: 'Mercado',
    shortLabel: 'Mercado',
    defaultIcon: 'shopping-cart',
    defaultColor: '#16A34A',
  },
  {
    key: 'gym',
    label: 'Academia',
    shortLabel: 'Academia',
    defaultIcon: 'dumbbell',
    defaultColor: '#15803D',
  },
  {
    key: 'park',
    label: 'Parque',
    shortLabel: 'Parque',
    defaultIcon: 'trees',
    defaultColor: '#22C55E',
  },
  {
    key: 'hotel',
    label: 'Hotel / Pousada',
    shortLabel: 'Hotel',
    defaultIcon: 'bed',
    defaultColor: '#0891B2',
  },
  {
    key: 'restroom',
    label: 'Banheiro',
    shortLabel: 'Banheiro',
    defaultIcon: 'bath',
    defaultColor: '#4F46E5',
  },
  {
    key: 'atm',
    label: 'Caixa Eletrônico',
    shortLabel: 'Caixa Eletrônico',
    defaultIcon: 'credit-card',
    defaultColor: '#059669',
  },
  {
    key: 'ev_charging',
    label: 'Recarga Elétrica',
    shortLabel: 'Recarga EV',
    defaultIcon: 'zap',
    defaultColor: '#2563EB',
  },
  {
    key: 'cafe',
    label: 'Café / Padaria',
    shortLabel: 'Café',
    defaultIcon: 'coffee',
    defaultColor: '#D97706',
  },
  {
    key: 'landmark',
    label: 'Serviço Público / Banco',
    shortLabel: 'Serviço Público',
    defaultIcon: 'landmark',
    defaultColor: '#9333EA',
  },
  {
    key: 'transit',
    label: 'Transporte / Terminal',
    shortLabel: 'Transporte',
    defaultIcon: 'bus',
    defaultColor: '#3B82F6',
  },
  {
    key: 'viewpoint',
    label: 'Mirante / Foto',
    shortLabel: 'Mirante',
    defaultIcon: 'camera',
    defaultColor: '#7C3AED',
  },
];

export const STOP_ICON_COLOR_PALETTE: string[] = [
  '#1668FF',
  '#16A34A',
  '#F97316',
  '#EC4899',
  '#EF4444',
  '#9333EA',
  '#0891B2',
  '#0284C7',
  '#15803D',
  '#4F46E5',
  '#D97706',
  '#334155',
];

export const FEATURED_STOP_SYMBOLS: Array<{ name: string; label: string; color: string }> = [
  { name: 'fuel', label: 'Posto', color: '#1668FF' },
  { name: 'pill', label: 'Farmácia', color: '#EC4899' },
  { name: 'cross', label: 'Hospital', color: '#EF4444' },
  { name: 'circle-parking', label: 'Estacionamento', color: '#0284C7' },
  { name: 'utensils', label: 'Restaurante', color: '#F97316' },
  { name: 'shopping-cart', label: 'Mercado', color: '#16A34A' },
  { name: 'trees', label: 'Parque', color: '#22C55E' },
  { name: 'bed', label: 'Hotel', color: '#0891B2' },
  { name: 'landmark', label: 'Banco / Museu', color: '#9333EA' },
  { name: 'dumbbell', label: 'Academia', color: '#15803D' },
  { name: 'zap', label: 'Recarga EV', color: '#2563EB' },
  { name: 'bath', label: 'Banheiro', color: '#4F46E5' },
];

/**
 * Legacy category metadata map preserved for backwards compatibility.
 */
export interface MapVisualIconMeta {
  category: string;
  label: string;
  shortLabel: string;
  bgColor: string;
  iconName: string;
}

export const MAP_VISUAL_ICON_CATEGORIES: Record<string, MapVisualIconMeta> = Object.fromEntries(
  STOP_ICON_CATEGORY_PRESETS.map((p) => [
    p.key,
    {
      category: p.key,
      label: p.label,
      shortLabel: p.shortLabel,
      bgColor: p.defaultColor,
      iconName: p.defaultIcon,
    },
  ])
);

export const DEFAULT_CATEGORY_KEYS = STOP_ICON_CATEGORY_PRESETS.map((p) => p.key);

/**
 * All compatible symbol names exposed directly from the installed lucide-react library.
 */
export const ALL_LUCIDE_ICON_NAMES: string[] = Object.keys(dynamicIconImports).sort();
const LUCIDE_ICON_SET = new Set<string>(ALL_LUCIDE_ICON_NAMES);

/**
 * Bilingual Portuguese -> Lucide icon keyword index so admins can search naturally in PT or EN.
 */
const PT_KEYWORD_TO_ICONS: Array<[string, string[]]> = [
  ['posto', ['fuel', 'gauge', 'car', 'flame']],
  ['combustivel', ['fuel', 'flame', 'droplet']],
  ['gasolina', ['fuel', 'car']],
  ['farmacia', ['pill', 'pills', 'cross', 'heart-pulse', 'stethoscope', 'syringe', 'bandage']],
  ['remedio', ['pill', 'syringe', 'stethoscope']],
  ['hospital', ['cross', 'hospital', 'ambulance', 'heart-pulse', 'activity', 'stethoscope', 'shield-plus']],
  ['saude', ['heart-pulse', 'hospital', 'cross', 'stethoscope', 'activity']],
  ['medico', ['stethoscope', 'hospital', 'cross', 'heart-pulse']],
  ['estacionamento', ['circle-parking', 'square-parking', 'car', 'parking-meter']],
  ['carro', ['car', 'car-front', 'fuel', 'circle-parking', 'wrench']],
  ['restaurante', ['utensils', 'utensils-crossed', 'chef-hat', 'soup', 'pizza', 'beef', 'wine']],
  ['comida', ['utensils', 'pizza', 'sandwich', 'hamburger', 'cake', 'ice-cream-cone']],
  ['cafe', ['coffee', 'cup-soda', 'croissant', 'cake-slice']],
  ['padaria', ['croissant', 'wheat', 'cake', 'coffee']],
  ['bar', ['wine', 'beer', 'martini', 'glass-water']],
  ['mercado', ['shopping-cart', 'shopping-basket', 'shopping-bag', 'store']],
  ['supermercado', ['shopping-cart', 'shopping-basket', 'store']],
  ['loja', ['store', 'shopping-bag', 'tag', 'shirt']],
  ['academia', ['dumbbell', 'biceps-flexed', 'footprints', 'bike', 'activity']],
  ['treino', ['dumbbell', 'timer', 'flame']],
  ['parque', ['trees', 'tree-pine', 'tree-deciduous', 'leaf', 'sprout', 'flower-2', 'mountain']],
  ['natureza', ['trees', 'tree-pine', 'mountain', 'leaf', 'sun']],
  ['hotel', ['bed', 'bed-double', 'building-2', 'home', 'key-round']],
  ['pousada', ['bed', 'home', 'house', 'key-round']],
  ['hospedagem', ['bed', 'bed-double', 'building', 'home']],
  ['banheiro', ['bath', 'shower-head', 'droplets', 'accessibility', 'baby']],
  ['sanitario', ['bath', 'shower-head', 'droplets']],
  ['caixa', ['credit-card', 'banknote', 'landmark', 'wallet', 'coins']],
  ['banco', ['landmark', 'credit-card', 'banknote', 'wallet', 'building']],
  ['dinheiro', ['banknote', 'coins', 'wallet', 'credit-card']],
  ['recarga', ['zap', 'battery-charging', 'plug-zap', 'ev-charger']],
  ['eletrica', ['zap', 'battery-charging', 'plug-zap']],
  ['eletrico', ['zap', 'battery-charging', 'plug-zap']],
  ['onibus', ['bus', 'bus-front', 'tram-front', 'train-front']],
  ['transporte', ['bus', 'train-front', 'car-taxi-front', 'bike', 'plane', 'cable-car']],
  ['taxi', ['car-taxi-front', 'car']],
  ['igreja', ['church', 'landmark', 'bell']],
  ['mirante', ['camera', 'binoculars', 'mountain', 'eye', 'compass']],
  ['foto', ['camera', 'image', 'aperture']],
  ['agua', ['droplet', 'droplets', 'glass-water', 'waves']],
  ['wifi', ['wifi', 'radio', 'signal']],
  ['pet', ['paw-print', 'dog', 'cat']],
  ['cachorro', ['dog', 'paw-print']],
  ['policia', ['shield', 'shield-alert', 'siren']],
  ['bombeiro', ['flame', 'siren', 'shield-alert']],
  ['informacao', ['info', 'circle-help', 'map-pin', 'compass']],
  ['bicicleta', ['bike', 'footprints']],
  ['oficina', ['wrench', 'hammer', 'cog']],
  ['musica', ['music', 'headphones', 'mic']],
  ['cinema', ['clapperboard', 'film', 'ticket']],
  ['teatro', ['drama', 'ticket', 'sparkles']],
  ['escola', ['graduation-cap', 'book-open', 'school']],
  ['correio', ['mail', 'package', 'send']],
];

function normalizeSearchTerm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function searchLucideIconNames(query: string): string[] {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) {
    // Featured symbols first, followed by full library alphabetically
    const featuredNames = FEATURED_STOP_SYMBOLS.map((s) => s.name).filter((n) =>
      LUCIDE_ICON_SET.has(n)
    );
    const featuredSet = new Set(featuredNames);
    return [...featuredNames, ...ALL_LUCIDE_ICON_NAMES.filter((n) => !featuredSet.has(n))];
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const boosted = new Set<string>();

  for (const [ptKey, iconList] of PT_KEYWORD_TO_ICONS) {
    if (tokens.some((t) => ptKey.includes(t) || t.includes(ptKey))) {
      for (const name of iconList) {
        if (LUCIDE_ICON_SET.has(name)) boosted.add(name);
      }
    }
  }

  const directMatches = ALL_LUCIDE_ICON_NAMES.filter((name) => {
    const cleanName = name.replace(/-/g, ' ');
    return tokens.every((t) => name.includes(t) || cleanName.includes(t));
  });

  const merged: string[] = [];
  const seen = new Set<string>();
  for (const name of boosted) {
    if (!seen.has(name)) {
      seen.add(name);
      merged.push(name);
    }
  }
  for (const name of directMatches) {
    if (!seen.has(name)) {
      seen.add(name);
      merged.push(name);
    }
  }
  return merged;
}

/**
 * Normalize legacy PascalCase or category names into canonical kebab-case Lucide icon names.
 */
const LEGACY_ICON_ALIAS: Record<string, string> = {
  gas_station: 'fuel',
  pharmacy: 'pill',
  mountain_peak: 'mountain',
  hospital: 'cross',
  parking: 'circle-parking',
  market: 'shopping-cart',
  cafe: 'coffee',
  restaurant: 'utensils',
  restroom: 'bath',
  park: 'trees',
  viewpoint: 'camera',
  terminal: 'train-front',
  church: 'church',
  lodging: 'bed',
  hotel: 'bed',
  transit: 'bus',
  atm: 'credit-card',
  gym: 'dumbbell',
  ev_charging: 'zap',
  Fuel: 'fuel',
  Plus: 'plus',
  Mountain: 'mountain',
  Cross: 'cross',
  Parking: 'circle-parking',
  ShoppingCart: 'shopping-cart',
  Coffee: 'coffee',
  Utensils: 'utensils',
  Restroom: 'bath',
  Trees: 'trees',
  Camera: 'camera',
  Train: 'train-front',
  Church: 'church',
  Bed: 'bed',
  Bus: 'bus',
  CreditCard: 'credit-card',
};

export function resolveLucideIconName(iconOrCategory?: string, fallbackCategory?: string): string {
  const candidates = [iconOrCategory, fallbackCategory].filter(Boolean) as string[];
  for (const raw of candidates) {
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    if (LUCIDE_ICON_SET.has(trimmed)) return trimmed;
    if (LEGACY_ICON_ALIAS[trimmed] && LUCIDE_ICON_SET.has(LEGACY_ICON_ALIAS[trimmed])) {
      return LEGACY_ICON_ALIAS[trimmed];
    }
    // Convert PascalCase or snake_case to kebab-case
    const kebab = trimmed
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();
    if (LUCIDE_ICON_SET.has(kebab)) return kebab;
    if (LEGACY_ICON_ALIAS[kebab] && LUCIDE_ICON_SET.has(LEGACY_ICON_ALIAS[kebab])) {
      return LEGACY_ICON_ALIAS[kebab];
    }
  }
  return 'map-pin';
}

export function sanitizeHexColor(color?: string | null, fallbackCategory?: string): string {
  if (typeof color === 'string') {
    const trimmed = color.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toUpperCase();
    if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
  }
  const preset = STOP_ICON_CATEGORY_PRESETS.find(
    (p) => p.key === fallbackCategory || p.label.toLowerCase() === String(fallbackCategory || '').toLowerCase()
  );
  return preset?.defaultColor || '#1668FF';
}

export function getCategoryDisplayLabel(category?: string): string {
  if (!category) return 'Ponto de Parada';
  const preset = STOP_ICON_CATEGORY_PRESETS.find((p) => p.key === category);
  return preset ? preset.label : category;
}

/**
 * Synchronous built-in SVG node cache for the most common utility symbols so map markers
 * render instantaneously on frame 0 without async delay, while any of the ~1,600+ other
 * lucide-react symbols load dynamically on demand and cache permanently in memory.
 */
const BUILTIN_ICON_NODES: Record<string, LucideSvgNode> = {
  fuel: [
    ['path', { d: 'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5' }],
    ['path', { d: 'M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16' }],
    ['path', { d: 'M2 21h13' }],
    ['path', { d: 'M3 9h11' }],
  ],
  pill: [
    ['path', { d: 'm10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z' }],
    ['path', { d: 'm8.5 8.5 7 7' }],
  ],
  cross: [
    ['path', { d: 'M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z' }],
  ],
  'circle-parking': [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M9 17V7h4a3 3 0 0 1 0 6H9' }],
  ],
  utensils: [
    ['path', { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' }],
    ['path', { d: 'M7 2v20' }],
    ['path', { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' }],
  ],
  'shopping-cart': [
    ['circle', { cx: '8', cy: '21', r: '1' }],
    ['circle', { cx: '19', cy: '21', r: '1' }],
    ['path', { d: 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12' }],
  ],
  trees: [
    ['path', { d: 'M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z' }],
    ['path', { d: 'M7 16v6' }],
    ['path', { d: 'M13 19v3' }],
    ['path', { d: 'M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5' }],
  ],
  bed: [
    ['path', { d: 'M2 4v16' }],
    ['path', { d: 'M2 8h18a2 2 0 0 1 2 2v10' }],
    ['path', { d: 'M2 17h20' }],
    ['path', { d: 'M6 8v9' }],
  ],
  landmark: [
    ['line', { x1: '3', x2: '21', y1: '22', y2: '22' }],
    ['line', { x1: '6', x2: '6', y1: '18', y2: '11' }],
    ['line', { x1: '10', x2: '10', y1: '18', y2: '11' }],
    ['line', { x1: '14', x2: '14', y1: '18', y2: '11' }],
    ['line', { x1: '18', x2: '18', y1: '18', y2: '11' }],
    ['polygon', { points: '12 2 20 7 4 7' }],
  ],
  dumbbell: [
    ['path', { d: 'M14.4 14.4 9.6 9.6' }],
    ['path', { d: 'M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z' }],
    ['path', { d: 'm21.5 21.5-1.4-1.4' }],
    ['path', { d: 'M3.9 3.9 2.5 2.5' }],
    ['path', { d: 'M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z' }],
  ],
  zap: [
    ['path', { d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z' }],
  ],
  bath: [
    ['path', { d: 'M10 4 8 6' }],
    ['path', { d: 'M17 19v2' }],
    ['path', { d: 'M2 12h20' }],
    ['path', { d: 'M7 19v2' }],
    ['path', { d: 'M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5' }],
  ],
  'credit-card': [
    ['rect', { width: '20', height: '14', x: '2', y: '5', rx: '2' }],
    ['line', { x1: '2', x2: '22', y1: '10', y2: '10' }],
  ],
  coffee: [
    ['path', { d: 'M10 2v2' }],
    ['path', { d: 'M14 2v2' }],
    ['path', { d: 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1' }],
    ['path', { d: 'M6 2v2' }],
  ],
  bus: [
    ['path', { d: 'M8 6v6' }],
    ['path', { d: 'M15 6v6' }],
    ['path', { d: 'M2 12h19.6' }],
    ['path', { d: 'M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3' }],
    ['circle', { cx: '7', cy: '18', r: '2' }],
    ['path', { d: 'M9 18h5' }],
    ['circle', { cx: '16', cy: '18', r: '2' }],
  ],
  camera: [
    ['path', { d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z' }],
    ['circle', { cx: '12', cy: '13', r: '3' }],
  ],
  'map-pin': [
    ['path', { d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' }],
    ['circle', { cx: '12', cy: '10', r: '3' }],
  ],
};

const iconNodeCache = new Map<string, LucideSvgNode>(Object.entries(BUILTIN_ICON_NODES));
const pendingIconLoads = new Map<string, Promise<LucideSvgNode>>();

export function getLucideIconNodeSync(iconName: string): LucideSvgNode | null {
  const canonical = resolveLucideIconName(iconName);
  return iconNodeCache.get(canonical) || null;
}

export async function loadLucideIconNode(iconName: string): Promise<LucideSvgNode> {
  const canonical = resolveLucideIconName(iconName);
  const cached = iconNodeCache.get(canonical);
  if (cached) return cached;

  const existingPromise = pendingIconLoads.get(canonical);
  if (existingPromise) return existingPromise;

  const loader = (dynamicIconImports as Record<string, () => Promise<any>>)[canonical];
  if (!loader) {
    return BUILTIN_ICON_NODES['map-pin'];
  }

  const p = loader()
    .then((mod) => {
      const node = (mod?.__iconNode || mod?.default?.__iconNode) as LucideSvgNode | undefined;
      if (Array.isArray(node) && node.length > 0) {
        iconNodeCache.set(canonical, node);
        return node;
      }
      return BUILTIN_ICON_NODES['map-pin'];
    })
    .catch(() => BUILTIN_ICON_NODES['map-pin'])
    .finally(() => {
      pendingIconLoads.delete(canonical);
    });

  pendingIconLoads.set(canonical, p);
  return p;
}

const ALLOWED_SVG_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const ALLOWED_SVG_ATTRS = new Set([
  'd',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'height',
  'points',
]);

/**
 * Safely builds a crisp vector SVG DOM element from a Lucide icon node without innerHTML.
 */
export function buildLucideSvgElement(node: LucideSvgNode, sizePx: number, strokeWidth = 2.25): SVGSVGElement {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(sizePx));
  svg.setAttribute('height', String(sizePx));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#FFFFFF');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.display = 'block';
  svg.style.pointerEvents = 'none';

  for (const [tag, attrs] of node) {
    if (!ALLOWED_SVG_TAGS.has(tag)) continue;
    const child = document.createElementNS(svgNS, tag);
    if (attrs && typeof attrs === 'object') {
      for (const [k, v] of Object.entries(attrs)) {
        if (ALLOWED_SVG_ATTRS.has(k) && (typeof v === 'string' || typeof v === 'number')) {
          child.setAttribute(k, String(v));
        }
      }
    }
    svg.appendChild(child);
  }
  return svg;
}

/**
 * Populates a container element with a Lucide vector SVG, loading dynamically if needed.
 */
export function renderLucideIntoContainer(
  container: HTMLElement,
  iconName: string,
  svgSizePx: number,
  strokeWidth = 2.25
): void {
  const canonical = resolveLucideIconName(iconName);
  const syncNode = getLucideIconNodeSync(canonical);
  container.dataset.iconKey = canonical;

  if (syncNode) {
    container.replaceChildren(buildLucideSvgElement(syncNode, svgSizePx, strokeWidth));
    return;
  }

  // Render subtle neutral placeholder dot briefly until the 1KB icon chunk resolves
  container.replaceChildren(buildLucideSvgElement(BUILTIN_ICON_NODES['map-pin'], svgSizePx, strokeWidth));
  loadLucideIconNode(canonical).then((resolvedNode) => {
    if (container.dataset.iconKey === canonical && container.isConnected) {
      container.replaceChildren(buildLucideSvgElement(resolvedNode, svgSizePx, strokeWidth));
    }
  });
}

/**
 * Creates a lightweight, purely visual MapLibre marker element for a Stop Icon.
 * - ~10% smaller than legacy 31-32px utility markers (default 28px circle)
 * - Circular colored disc, crisp thin white rim, subtle elevation shadow
 * - Touch interaction ONLY triggers a brief tactile scale/press feedback and returns to rest
 * - NEVER opens popups, cards, sheets, routes, or alters camera
 */
export function createStopIconMarkerElements(
  icon: Pick<MapVisualIcon, 'id' | 'category' | 'icon' | 'color' | 'name'>,
  sizePx = 28
): { root: HTMLDivElement; badge: HTMLDivElement; svgHolder: HTMLDivElement } {
  const root = document.createElement('div');
  root.className = 'monvian-stop-icon-root';
  root.style.width = `${sizePx}px`;
  root.style.height = `${sizePx}px`;
  root.style.display = 'flex';
  root.style.alignItems = 'center';
  root.style.justifyContent = 'center';
  root.style.userSelect = 'none';
  root.style.webkitUserSelect = 'none';
  root.style.cursor = 'pointer';
  root.style.zIndex = '4';
  root.style.willChange = 'transform, opacity';
  root.style.transition = 'opacity 180ms ease';

  const badge = document.createElement('div');
  badge.className = 'monvian-stop-icon-badge';
  badge.style.width = `${sizePx}px`;
  badge.style.height = `${sizePx}px`;
  badge.style.borderRadius = '9999px';
  badge.style.backgroundColor = sanitizeHexColor(icon.color, icon.category);
  badge.style.border = '2px solid rgba(255, 255, 255, 0.96)';
  badge.style.boxShadow = '0 2.5px 7px rgba(15, 23, 42, 0.28), 0 1px 2px rgba(15, 23, 42, 0.16)';
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.transformOrigin = 'center center';
  badge.style.transition = 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1), filter 160ms ease, box-shadow 180ms ease';
  badge.style.opacity = '0';
  badge.style.transform = 'scale(0.84)';

  const svgHolder = document.createElement('div');
  svgHolder.style.display = 'flex';
  svgHolder.style.alignItems = 'center';
  svgHolder.style.justifyContent = 'center';
  svgHolder.style.pointerEvents = 'none';

  const innerSize = Math.round(sizePx * 0.54);
  const canonicalIcon = resolveLucideIconName(icon.icon, icon.category);
  renderLucideIntoContainer(svgHolder, canonicalIcon, innerSize, 2.25);

  badge.appendChild(svgHolder);
  root.appendChild(badge);

  // Discrete entry animation (single shot, zero continuous pulsing)
  requestAnimationFrame(() => {
    badge.style.opacity = '1';
    badge.style.transform = 'scale(1)';
  });

  // Exclusively visual tactile tap feedback (never triggers map click, modal, popup, or camera)
  let releaseTimer: number | null = null;
  const triggerVisualTap = () => {
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    badge.style.transform = 'scale(1.13)';
    badge.style.filter = 'brightness(1.08)';
    badge.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.34), 0 0 0 3px rgba(255, 255, 255, 0.42)';
    releaseTimer = window.setTimeout(() => {
      badge.style.transform = 'scale(1)';
      badge.style.filter = 'none';
      badge.style.boxShadow = '0 2.5px 7px rgba(15, 23, 42, 0.28), 0 1px 2px rgba(15, 23, 42, 0.16)';
      releaseTimer = null;
    }, 180);
  };

  root.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    badge.style.transform = 'scale(0.86)';
    badge.style.filter = 'brightness(0.96)';
  });

  root.addEventListener('pointercancel', () => {
    badge.style.transform = 'scale(1)';
    badge.style.filter = 'none';
  });

  root.addEventListener('pointerleave', () => {
    if (releaseTimer === null) {
      badge.style.transform = 'scale(1)';
      badge.style.filter = 'none';
    }
  });

  root.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerVisualTap();
  });

  return { root, badge, svgHolder };
}

export function updateStopIconMarkerAppearance(
  badge: HTMLDivElement,
  svgHolder: HTMLDivElement,
  icon: Pick<MapVisualIcon, 'category' | 'icon' | 'color'>,
  sizePx = 28
): void {
  badge.style.backgroundColor = sanitizeHexColor(icon.color, icon.category);
  const innerSize = Math.round(sizePx * 0.54);
  const canonicalIcon = resolveLucideIconName(icon.icon, icon.category);
  if (svgHolder.dataset.iconKey !== canonicalIcon) {
    renderLucideIntoContainer(svgHolder, canonicalIcon, innerSize, 2.25);
  }
}
