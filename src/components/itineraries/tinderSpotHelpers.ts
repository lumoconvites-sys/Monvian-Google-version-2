import { Spot } from '../../types';

export interface FormattedSpotCard {
  spot: Spot;
  name: string;
  isVerified: boolean;
  categoryLabel: string;
  shortDescription: string;
  priceDisplay: string;
}

// Map of concise 1-line descriptions tailored for Campos do Jordão
const SHORT_DESCRIPTIONS: Record<string, string> = {
  'palacio-boa-vista': 'Antiga residência de inverno com acervo clássico de arte brasileira.',
  'amantikir': '26 jardins temáticos do mundo e o famoso labirinto verde.',
  'itapeva': 'Vista panorâmica a mais de 2.030m para 15 cidades da Serra.',
  'baden-baden': 'Cervejas artesanais icônicas e gastronomia alemã no Capivari.',
  'ducha-prata': 'Passarelas suspensas de madeira entre cascatas e pinheiros.',
  'auditorio-claudio-santoro': 'Esculturas ao ar livre e pôr do sol inesquecível na montanha.',
  'chocolate-araucaria': 'Fábrica tradicional com vista para produção e degustação.',
  'morro-elefante': 'Mirante clássico do Capivari com vista para toda a vila.',
  'tarundu': 'Parque ao ar livre com tirolesas, arborismo e passeios a cavalo.',
  'horto-florestal': 'Parque estadual com trilhas na mata atlântica e araucárias.',
  'bosque-silencio': 'Trilhas relaxantes em meio a pinheiros e natureza preservada.',
  'vila-capivari': 'Vila charmosa com arquitetura alpina, bistrôs e lojas de lã.',
  'villa-fenix': 'Bistrôs e lojas elegantes com luzes aconchegantes à noite.',
  'chateau-suisse': 'Tradicional fondue suíço e gastronomia europeia no Capivari.',
  'parque-cerejeiras': 'Bosque exuberante com centenas de cerejeiras em flor e trilhas.',
  'gruta-crioulos': 'Formação rochosa histórica esculpida pela natureza na serra.',
  'museu-xilografia': 'Maior museu de xilogravura do Brasil com raras obras de arte.',
  'estrada-ferro': 'Passeio nostálgico de trem e bondinho pelas montanhas.'
};

// Map of curated prices/price ranges
const PRICES: Record<string, string> = {
  'palacio-boa-vista': 'R$ 0 / Entrada gratuita',
  'amantikir': 'R$ 60 / pessoa',
  'itapeva': 'R$ 20 / veículo',
  'baden-baden': 'Faixa R$ 80 — R$ 160',
  'ducha-prata': 'R$ 0 / Entrada gratuita',
  'auditorio-claudio-santoro': 'R$ 15 / pessoa (Meia R$ 7,50)',
  'chocolate-araucaria': 'R$ 0 / Entrada gratuita',
  'morro-elefante': 'R$ 0 / Acesso ao mirante gratuito',
  'tarundu': 'R$ 45 / entrada no parque',
  'horto-florestal': 'R$ 19 / pessoa',
  'bosque-silencio': 'R$ 30 / entrada',
  'vila-capivari': 'R$ 0 / Acesso Grátis',
  'villa-fenix': 'Faixa R$ 50 — R$ 110',
  'chateau-suisse': 'Faixa R$ 120 — R$ 220',
  'parque-cerejeiras': 'R$ 30 / pessoa',
  'gruta-crioulos': 'R$ 0 / Entrada gratuita',
  'museu-xilografia': 'R$ 10 / pessoa',
  'estrada-ferro': 'R$ 25 / passeio'
};

export function formatSpotForTinder(spot: Spot): FormattedSpotCard {
  // Category label
  let categoryLabel = spot.categoryLabel || 'Ponto Turístico';
  if (spot.category === 'culture') categoryLabel = 'Cultura e História';
  else if (spot.category === 'parks') categoryLabel = 'Natureza e Jardins';
  else if (spot.category === 'viewpoint') categoryLabel = 'Mirante e Pôr do Sol';
  else if (spot.category === 'gastronomy') categoryLabel = 'Gastronomia';
  else if (spot.category === 'cafes') categoryLabel = 'Cafés e Bistrôs';
  else if (spot.category === 'sweets') categoryLabel = 'Chocolates Artesanais';

  // Short description: 1 short sentence max
  let shortDesc = SHORT_DESCRIPTIONS[spot.id];
  if (!shortDesc) {
    if (spot.touristTip) {
      shortDesc = spot.touristTip.split('.')[0] + '.';
    } else if (spot.description) {
      shortDesc = spot.description.split('.')[0] + '.';
    } else {
      shortDesc = 'Experiência imperdível na montanha de Campos do Jordão.';
    }
    // Limit to 75 chars
    if (shortDesc.length > 80) {
      shortDesc = shortDesc.substring(0, 77) + '...';
    }
  }

  // Price display
  let price = PRICES[spot.id];
  if (!price) {
    if (spot.priceRange === 'Grátis' || spot.priceRange === '$') {
      price = 'R$ 0 / Entrada gratuita';
    } else if (spot.priceRange === '$$') {
      price = 'Faixa R$ 50 — R$ 100';
    } else if (spot.priceRange === '$$$' || spot.priceRange === '$$$$') {
      price = 'Faixa R$ 120+';
    } else {
      price = 'Consultar no local';
    }
  }

  // Verification badge: major attractions with high quality
  const isVerified = Boolean(
    spot.highlighted ||
    spot.badge ||
    spot.id === 'palacio-boa-vista' ||
    spot.id === 'amantikir' ||
    spot.id === 'itapeva' ||
    spot.id === 'baden-baden' ||
    spot.id === 'ducha-prata' ||
    spot.id === 'auditorio-claudio-santoro' ||
    spot.id === 'horto-florestal' ||
    spot.id === 'tarundu'
  );

  return {
    spot,
    name: spot.name,
    isVerified,
    categoryLabel,
    shortDescription: shortDesc,
    priceDisplay: price
  };
}
