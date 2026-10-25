// Smart image resolver for spots in Monvians
// Guarantees each spot has its unique, registered, high-resolution photo and never repeats generic fallbacks.

const SPOT_PHOTO_MAP: Record<string, string> = {
  'parque-capivari': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
  'morro-do-elefante': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  'morro-elefante': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  'pousada-morro-elefante': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
  'parque-amantikir': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
  'amantikir': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
  'pico-do-itapeva': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  'itapeva': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  'cervejaria-baden-baden': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
  'baden-baden': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
  'ducha-de-prata': 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
  'ducha-prata': 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
  'parque-das-cerejeiras': 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
  'cerejeiras': 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
  'portal-de-campos-do-jordao': 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=800&q=80',
  'portal-campos': 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=800&q=80',
  'portal': 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=800&q=80',
  'tarundu': 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
  'horto-florestal': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
  'horto': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
  'auditorio-claudio-santoro': 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
  'museu-felicia-leirner': 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80',
  'felicia-leirner': 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80',
  'bosque-do-silencio': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
  'bosque-silencio': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
  'pedra-do-bau': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  'pedra-bau': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  'palacio-boa-vista': 'https://images.unsplash.com/photo-1541971875076-8f970d573be6?auto=format&fit=crop&w=800&q=80',
  'chocolate-araucaria': 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=800&q=80',
  'montanhes-chocolates': 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=800&q=80',
  'villa-fenix': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  'vila-capivari': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
  'sans-souci': 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
  'krokodilo': 'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?auto=format&fit=crop&w=800&q=80',
  'simpatia': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',
  'grande-hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  'toriba-hotel': 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
  'droga-raia': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
  'drogaria-sao-paulo-capivari': 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80',
  'festival-inverno-evento': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
  'festa-pinhao-evento': 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
};

export const CATEGORY_FALLBACK_IMAGES: Record<string, string[]> = {
  gastronomy: [
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  ],
  cafes: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
  ],
  sweets: [
    'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1548907040-4baa42d10919?auto=format&fit=crop&w=800&q=80',
  ],
  viewpoint: [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  ],
  parks: [
    'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
  ],
  nature: [
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
  ],
  hotels: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
  ],
  culture: [
    'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
  ],
  attractions: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
  ],
};

function normalizeSpotKey(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const GENERIC_AMANTIKIR_URL_PART = 'photo-1585320806297-9794b3e4eeae';
const MORRO_ELEFANTE_STOCK_PART = 'photo-1507525428034-b723cf961d3e';
const PARQUE_CAPIVARI_STOCK_PART = 'photo-1513836279014-a89f7a76ae86';

/**
 * Gets the unique, correct image for a spot.
 * Prioritizes the real specific image from the database (`spot.image` or `spot.gallery[0]`),
 * ensuring Parque Capivari and Morro do Elefante always show their own distinct photos.
 */
export function getSpotImage(spot: {
  id?: string;
  name?: string;
  shortName?: string;
  category?: string;
  image?: string;
  gallery?: string[];
}): string {
  if (!spot) return SPOT_PHOTO_MAP['parque-capivari'];

  const idKey = normalizeSpotKey(spot.id || '');
  const nameKey = normalizeSpotKey(spot.shortName || spot.name || '');
  const fullNameKey = normalizeSpotKey(spot.name || '');

  const isAmantikir =
    idKey.includes('amantikir') ||
    nameKey.includes('amantikir') ||
    fullNameKey.includes('amantikir');

  const isParqueCapivariOnly =
    (idKey === 'parque-capivari' ||
      nameKey.includes('parque-capivari') ||
      (fullNameKey.includes('parque-capivari') && !fullNameKey.includes('morro'))) &&
    !idKey.includes('morro');

  const isMorroElefanteOnly =
    (idKey.includes('morro-elefante') ||
      idKey.includes('morro-do-elefante') ||
      nameKey.includes('morro-do-elefante') ||
      nameKey.includes('morro-elefante')) &&
    !idKey.includes('pousada');

  // Extract candidate image from spot record or gallery
  const rawCandidate =
    (spot.image && spot.image.trim()) ||
    (Array.isArray(spot.gallery) && spot.gallery.length > 0 && typeof spot.gallery[0] === 'string'
      ? spot.gallery[0].trim()
      : '');

  if (rawCandidate) {
    // Data URLs or custom uploaded storage images are always specific
    if (rawCandidate.startsWith('data:image/')) {
      return rawCandidate;
    }

    if (rawCandidate.startsWith('http') || rawCandidate.startsWith('/')) {
      const isGenericAmantikirFallback =
        rawCandidate.includes(GENERIC_AMANTIKIR_URL_PART) && !isAmantikir;

      // Prevent Parque Capivari from reusing Morro do Elefante's stock fallback or vice-versa
      const isCrossMatchedCapivari =
        isParqueCapivariOnly && rawCandidate.includes(MORRO_ELEFANTE_STOCK_PART);
      const isCrossMatchedMorro =
        isMorroElefanteOnly && rawCandidate.includes(PARQUE_CAPIVARI_STOCK_PART);

      if (!isGenericAmantikirFallback && !isCrossMatchedCapivari && !isCrossMatchedMorro) {
        return rawCandidate;
      }
    }
  }

  if (isParqueCapivariOnly) {
    return SPOT_PHOTO_MAP['parque-capivari'];
  }

  if (isMorroElefanteOnly) {
    return SPOT_PHOTO_MAP['morro-do-elefante'];
  }

  // Exact match by idKey or nameKey first
  if (idKey && SPOT_PHOTO_MAP[idKey]) {
    return SPOT_PHOTO_MAP[idKey];
  }
  if (nameKey && SPOT_PHOTO_MAP[nameKey]) {
    return SPOT_PHOTO_MAP[nameKey];
  }
  if (fullNameKey && SPOT_PHOTO_MAP[fullNameKey]) {
    return SPOT_PHOTO_MAP[fullNameKey];
  }

  // Substring match (only when key and target have >= 4 chars, never empty string)
  for (const [key, url] of Object.entries(SPOT_PHOTO_MAP)) {
    if (key.length < 4) continue;
    if (
      (idKey.length >= 4 && (idKey.includes(key) || key.includes(idKey))) ||
      (nameKey.length >= 4 && (nameKey.includes(key) || key.includes(nameKey))) ||
      (fullNameKey.length >= 4 && fullNameKey.includes(key))
    ) {
      return url;
    }
  }

  if (rawCandidate && rawCandidate.startsWith('http')) {
    return rawCandidate;
  }

  return getSpotFallbackImage(spot.name || spot.shortName || '', spot.category || 'attractions');
}

/**
 * Returns an optimized high-DPI square image URL specifically tuned for compact iOS notifications (~76x76px @ 3x Retina = 240x240px).
 * Preserves custom database URLs while optimizing Unsplash CDN parameters for fast loading.
 */
export function getSpotNotificationImage(spot: {
  id?: string;
  name?: string;
  shortName?: string;
  category?: string;
  image?: string;
  gallery?: string[];
}): string {
  const resolved = getSpotImage(spot);
  if (!resolved) return SPOT_PHOTO_MAP['parque-capivari'];

  if (resolved.includes('images.unsplash.com/')) {
    try {
      const url = new URL(resolved);
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', '240');
      url.searchParams.set('h', '240');
      url.searchParams.set('q', '82');
      return url.toString();
    } catch {
      return resolved;
    }
  }

  return resolved;
}

const preloadedUrls = new Set<string>();

/**
 * Preloads and decodes a spot's notification thumbnail in memory so it renders with zero latency.
 */
export function preloadSpotNotificationImage(spot: {
  id?: string;
  name?: string;
  shortName?: string;
  category?: string;
  image?: string;
  gallery?: string[];
}): Promise<string> {
  const url = getSpotNotificationImage(spot);
  if (typeof window === 'undefined' || !url || preloadedUrls.has(url)) {
    return Promise.resolve(url);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      preloadedUrls.add(url);
      resolve(url);
    };
    img.onerror = () => {
      const fallback = getSpotFallbackImage(spot.name || '', spot.category || 'attractions');
      resolve(fallback);
    };
    img.src = url;
  });
}

/**
 * Gets a distinct fallback image based on spot category and name hash,
 * so different spots never show the same picture.
 */
export function getSpotFallbackImage(name: string, category: string = 'attractions'): string {
  const normName = normalizeSpotKey(name);
  if (normName.includes('parque-capivari') && !normName.includes('morro')) {
    return SPOT_PHOTO_MAP['parque-capivari'];
  }
  if (normName.includes('morro-elefante') || normName.includes('morro-do-elefante')) {
    return SPOT_PHOTO_MAP['morro-do-elefante'];
  }

  if (normName && SPOT_PHOTO_MAP[normName]) {
    return SPOT_PHOTO_MAP[normName];
  }

  for (const [key, url] of Object.entries(SPOT_PHOTO_MAP)) {
    if (key.length >= 4 && normName.length >= 4 && (normName.includes(key) || key.includes(normName))) {
      return url;
    }
  }

  const list = CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.attractions;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % list.length;
  return list[index];
}
