import { Itinerary, Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries';
import { getSpotImage, getSpotFallbackImage } from '../utils/spotImages';
import { favoritesManager } from './favoritesManager';

export interface WidgetSpotItem {
  position: number;
  spotId: string;
  stepId: string;
  name: string;
  shortDescription: string;
  image: string;
  categoryLabel: string;
  lat: number;
  lng: number;
  deepLinkUrl: string;
}

export interface MonvianWidgetPayload {
  widgetTitle: string;
  itineraryId: string;
  itineraryTitle: string;
  daysCount: number;
  totalStopsCount: number;
  deepLinkUrl: string;
  updatedAt: string;
  spots: WidgetSpotItem[];
}

const WIDGET_CACHE_KEY = 'monvian_widget_payload_v1';
const WIDGET_IMAGE_CACHE_NAME = 'monvian-widget-images-v1';

const WIDGET_CONCISE_DESCRIPTIONS: Record<string, string> = {
  'portal': 'Início da sua aventura',
  'portal-campos': 'Início da sua aventura',
  'portal-de-campos-do-jordao': 'Início da sua aventura',
  'villa-fenix': 'O coração da cidade',
  'vila-capivari': 'O coração da cidade',
  'capivari': 'Diversão para todos',
  'parque-capivari': 'Diversão para todos',
  'amantikir': 'Jardins temáticos e labirinto verde',
  'parque-amantikir': 'Jardins temáticos e labirinto verde',
  'baden-baden': 'Cervejaria e gastronomia alemã',
  'baden': 'Cervejaria e gastronomia alemã',
  'morro-elefante': 'Mirante panorâmico e teleférico',
  'morro-do-elefante': 'Mirante panorâmico e teleférico',
  'ducha-prata': 'Quedas d’água e passarelas na mata',
  'ducha-de-prata': 'Quedas d’água e passarelas na mata',
  'parque-das-cerejeiras': 'Bosque florido e clima oriental',
  'cerejeiras': 'Bosque florido e clima oriental',
  'itapeva': 'Vista panorâmica a 2.030m de altitude',
  'pico-do-itapeva': 'Vista panorâmica a 2.030m de altitude',
  'tarundu': 'Aventura ao ar livre nas montanhas',
  'bosque-silencio': 'Trilhas entre araucárias centenárias',
  'palacio-boa-vista': 'Arte brasileira e história na serra',
  'auditorio-claudio-santoro': 'Música clássica e esculturas ao ar livre',
  'sans-souci': 'Bistrô francês e confeitaria florida',
  'krokodilo': 'Fondue tradicional e carnes nobres',
  'chocolate-araucaria': 'Fábrica tradicional de chocolates',
  'montanhes-chocolates': 'Chocolates artesanais no Capivari',
  'grande-hotel': 'Alta gastronomia e bosque histórico',
  'toriba-hotel': 'Tradição alpina e vista da Mantiqueira',
};

const WIDGET_CLEAN_NAMES: Record<string, string> = {
  'portal': 'Portal de Campos do Jordão',
  'portal-campos': 'Portal de Campos do Jordão',
  'portal-de-campos-do-jordao': 'Portal de Campos do Jordão',
  'villa-fenix': 'Vila Capivari',
  'vila-capivari': 'Vila Capivari',
  'parque-capivari': 'Parque Capivari',
  'capivari': 'Parque Capivari',
  'amantikir': 'Parque Amantikir',
  'parque-amantikir': 'Parque Amantikir',
  'baden-baden': 'Cervejaria Baden Baden',
  'morro-elefante': 'Morro do Elefante',
  'morro-do-elefante': 'Morro do Elefante',
  'ducha-prata': 'Ducha de Prata',
  'ducha-de-prata': 'Ducha de Prata',
  'parque-das-cerejeiras': 'Parque das Cerejeiras',
  'itapeva': 'Pico do Itapeva',
  'pico-do-itapeva': 'Pico do Itapeva',
  'chocolate-araucaria': 'Chocolate Araucária',
};

function normalizeLookupKey(str: string): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getRealSpotsPool(): Spot[] {
  try {
    const cached = localStorage.getItem('monvian_cached_spots');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged = [...parsed];
        const ids = new Set(parsed.map((s: Spot) => s.id));
        for (const s of CAMPOS_SPOTS) {
          if (!ids.has(s.id)) merged.push(s);
        }
        return merged;
      }
    }
  } catch {}
  return CAMPOS_SPOTS;
}

function findRealSpot(spotIdOrName: string | undefined, fallbackSpot?: Partial<Spot> | null): Spot | null {
  const pool = getRealSpotsPool();
  if (!spotIdOrName && !fallbackSpot) return pool[0] || null;

  const target = normalizeLookupKey(spotIdOrName || fallbackSpot?.id || fallbackSpot?.name || '');
  const withoutPrefix = target.replace(/^(parque|restaurante|morro|mirante)-/, '');

  for (const s of pool) {
    const sId = normalizeLookupKey(s.id);
    const sName = normalizeLookupKey(s.name);
    if (sId === target || sName === target || sId === withoutPrefix || sName === withoutPrefix) {
      return s;
    }
  }

  for (const s of pool) {
    const sId = normalizeLookupKey(s.id);
    const sName = normalizeLookupKey(s.name);
    if (
      (target && (sId.includes(target) || target.includes(sId))) ||
      (withoutPrefix && withoutPrefix.length > 3 && (sId.includes(withoutPrefix) || sName.includes(withoutPrefix)))
    ) {
      return s;
    }
  }

  if (fallbackSpot && fallbackSpot.name) {
    return {
      id: fallbackSpot.id || target || 'spot-1',
      name: fallbackSpot.name,
      shortName: fallbackSpot.shortName || fallbackSpot.name,
      category: fallbackSpot.category || 'attractions',
      categoryLabel: fallbackSpot.categoryLabel || 'Ponto Turístico',
      lat: fallbackSpot.lat || -22.734,
      lng: fallbackSpot.lng || -45.591,
      image: fallbackSpot.image || getSpotFallbackImage(fallbackSpot.name, fallbackSpot.category),
      description: fallbackSpot.description || '',
    };
  }

  return pool[0] || null;
}

function resolveCleanSpotName(spotId: string, rawName?: string): string {
  const key = normalizeLookupKey(spotId);
  if (WIDGET_CLEAN_NAMES[key]) return WIDGET_CLEAN_NAMES[key];
  if (!rawName) return 'Ponto Turístico';
  if (rawName === rawName.toUpperCase() && rawName.length > 3) {
    return rawName
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
  }
  // Ensure first letter of each significant word is capitalized nicely (e.g. "Parque amantikir" -> "Parque Amantikir")
  if (rawName.toLowerCase() === 'parque amantikir') return 'Parque Amantikir';
  return rawName;
}

function resolveConciseDescription(spotId: string, rawDesc?: string, categoryLabel?: string): string {
  const key = normalizeLookupKey(spotId);
  if (WIDGET_CONCISE_DESCRIPTIONS[key]) {
    return WIDGET_CONCISE_DESCRIPTIONS[key];
  }
  if (rawDesc && rawDesc.trim().length > 0) {
    const firstSentence = rawDesc.trim().split(/[.!;]/)[0].trim();
    if (firstSentence.length <= 38) return firstSentence;
    return firstSentence.slice(0, 35).trim() + '...';
  }
  return categoryLabel || 'Ponto turístico em Campos do Jordão';
}

export function getKnownItinerariesList(): Itinerary[] {
  const map = new Map<string, Itinerary>();
  try {
    const activeRaw = localStorage.getItem('monvian_active_itinerary');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw);
      if (parsed && parsed.id && Array.isArray(parsed.days) && parsed.days.length > 0) {
        map.set(parsed.id, parsed);
      }
    }
  } catch {}

  try {
    const cached =
      localStorage.getItem('monvian_cached_itineraries') ||
      localStorage.getItem('monvian_itineraries_cache');
    if (cached) {
      const parsed: Itinerary[] = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.id && item.isActive !== false && !map.has(item.id)) {
            map.set(item.id, item);
          }
        }
      }
    }
  } catch {}

  for (const def of DEFAULT_CURATED_ITINERARIES) {
    if (!map.has(def.id)) {
      map.set(def.id, def);
    }
  }

  return Array.from(map.values());
}

/**
 * Resolves the user's primary itinerary according to the confirmed product rule:
 * 1. User's last active itinerary (`monvian_active_itinerary`)
 * 2. User's primary favorite itinerary (`favoritesManager.getState().itineraries[0]`) or onboarding selection
 * 3. Top curated itinerary from the Monvian database
 */
export function resolvePrimaryUserItinerary(): Itinerary {
  const allKnown = getKnownItinerariesList();

  // 1. Check active itinerary in localStorage
  try {
    const activeRaw = localStorage.getItem('monvian_active_itinerary');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw);
      if (
        parsed &&
        (parsed.id || parsed.title) &&
        Array.isArray(parsed.days) &&
        parsed.days.some((d: any) => Array.isArray(d.steps) && d.steps.length > 0)
      ) {
        return parsed;
      }
    }
  } catch {}

  // 2. Check user's primary favorite itinerary
  try {
    const favState = favoritesManager.getState();
    if (Array.isArray(favState.itineraries) && favState.itineraries.length > 0) {
      for (const favId of favState.itineraries) {
        const match = allKnown.find((i) => i.id === favId);
        if (match && Array.isArray(match.days) && match.days.length > 0) {
          return match;
        }
      }
    }
  } catch {}

  // 3. Check onboarding selected itineraries
  try {
    const onboardingRaw = localStorage.getItem('monvian_selected_onboarding_itineraries');
    if (onboardingRaw) {
      const ids: string[] = JSON.parse(onboardingRaw);
      if (Array.isArray(ids) && ids.length > 0) {
        for (const id of ids) {
          const match = allKnown.find((i) => i.id === id);
          if (match && Array.isArray(match.days) && match.days.length > 0) {
            return match;
          }
        }
      }
    }
  } catch {}

  // 4. Fallback to top recommended itinerary with 3 real spots
  return (
    allKnown.find((i) => i.id === 'roteiro-bate-volta-essencial') ||
    allKnown.find((i) => i.isFeatured || i.isRecommended) ||
    DEFAULT_CURATED_ITINERARIES[0]
  );
}

/**
 * Builds the 2x2 iOS Large Widget payload from any Itinerary using real database spots.
 */
export function buildWidgetPayloadClient(itinerary?: Itinerary | null): MonvianWidgetPayload {
  const target = itinerary || resolvePrimaryUserItinerary();
  const pool = getRealSpotsPool();
  const rawDays = Array.isArray(target?.days) ? target.days : [];

  const flattenedSteps: any[] = [];
  for (const day of rawDays) {
    const daySteps = Array.isArray(day?.steps)
      ? [...day.steps].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
      : [];
    for (const st of daySteps) {
      flattenedSteps.push(st);
    }
  }

  const topThreeSteps = flattenedSteps.slice(0, 3);
  const widgetSpots: WidgetSpotItem[] = topThreeSteps.map((step, idx) => {
    const lookupKey = step.spotId || step.spot?.id || step.customName || step.spotName || step.title;
    const realSpot = findRealSpot(lookupKey, step.spot);
    const spotId = realSpot?.id || step.spotId || `spot-${idx + 1}`;
    const rawName = step.customName || realSpot?.name || step.spotName || step.title || `Ponto ${idx + 1}`;
    const cleanName = resolveCleanSpotName(spotId, rawName);

    const image = realSpot
      ? getSpotImage(realSpot)
      : step.customImage || getSpotFallbackImage(cleanName, step.category);

    const shortDescription = resolveConciseDescription(
      spotId,
      step.customDescription || realSpot?.description || step.notes,
      realSpot?.categoryLabel
    );

    return {
      position: idx + 1,
      spotId,
      stepId: step.id || `${target.id}-step-${idx + 1}`,
      name: cleanName,
      shortDescription,
      image,
      categoryLabel: realSpot?.categoryLabel || 'Ponto Turístico',
      lat: typeof realSpot?.lat === 'number' ? realSpot.lat : -22.734,
      lng: typeof realSpot?.lng === 'number' ? realSpot.lng : -45.591,
      deepLinkUrl: `/?widget_itinerary=${encodeURIComponent(target.id)}&widget_spot=${encodeURIComponent(spotId)}`,
    };
  });

  // Guarantee 3 real spots if the itinerary had fewer than 3 steps
  if (widgetSpots.length < 3 && pool.length > 0) {
    const usedIds = new Set(widgetSpots.map((s) => normalizeLookupKey(s.spotId)));
    for (const fallbackSpot of pool) {
      if (widgetSpots.length >= 3) break;
      const normId = normalizeLookupKey(fallbackSpot.id);
      if (usedIds.has(normId)) continue;
      usedIds.add(normId);
      const pos = widgetSpots.length + 1;
      widgetSpots.push({
        position: pos,
        spotId: fallbackSpot.id,
        stepId: `${target.id}-step-${pos}`,
        name: resolveCleanSpotName(fallbackSpot.id, fallbackSpot.name),
        shortDescription: resolveConciseDescription(
          fallbackSpot.id,
          fallbackSpot.description,
          fallbackSpot.categoryLabel
        ),
        image: getSpotImage(fallbackSpot),
        categoryLabel: fallbackSpot.categoryLabel || 'Ponto Turístico',
        lat: fallbackSpot.lat,
        lng: fallbackSpot.lng,
        deepLinkUrl: `/?widget_itinerary=${encodeURIComponent(target.id)}&widget_spot=${encodeURIComponent(fallbackSpot.id)}`,
      });
    }
  }

  return {
    widgetTitle: 'Vamos começar sua jornada?',
    itineraryId: target.id || 'roteiro-classico-2-dias',
    itineraryTitle: target.title || 'Essência de Campos: O Clássico em 2 Dias',
    daysCount: target.daysCount || rawDays.length || 1,
    totalStopsCount: flattenedSteps.length || widgetSpots.length,
    deepLinkUrl: `/?widget_itinerary=${encodeURIComponent(target.id || 'roteiro-classico-2-dias')}`,
    updatedAt: new Date().toISOString(),
    spots: widgetSpots,
  };
}

/**
 * Preloads and caches the 3 spot photos in Browser CacheStorage + memory
 * so the iPhone widget displays images immediately and works offline.
 */
export async function cacheWidgetSpotImages(spots: WidgetSpotItem[]): Promise<void> {
  if (typeof window === 'undefined') return;

  for (const item of spots) {
    if (!item.image) continue;
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = item.image;
    } catch {}
  }

  if ('caches' in window) {
    try {
      const cache = await window.caches.open(WIDGET_IMAGE_CACHE_NAME);
      await Promise.allSettled(
        spots.map(async (s) => {
          if (!s.image) return;
          const match = await cache.match(s.image);
          if (!match) {
            await cache.add(new Request(s.image, { mode: 'no-cors' }));
          }
        })
      );
    } catch {}
  }
}

/**
 * Synchronizes the widget payload locally and with the backend API,
 * and notifies all mounted widget components in real time.
 */
export function syncWidgetWithItinerary(itinerary?: Itinerary | null): MonvianWidgetPayload {
  const payload = buildWidgetPayloadClient(itinerary);

  try {
    localStorage.setItem(WIDGET_CACHE_KEY, JSON.stringify(payload));
  } catch {}

  cacheWidgetSpotImages(payload.spots).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monvian:widget_updated', {
        detail: payload,
      })
    );
  }

  // Sync with backend asynchronously
  if (itinerary) {
    const sessionId = localStorage.getItem('monvian_itinerary_session') || '';
    fetch('/api/widget/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({ itinerary }),
    }).catch(() => {});
  }

  return payload;
}

/**
 * Loads the current widget payload (instant synchronous hydration from active state/cache,
 * followed by optional background refresh from `/api/widget/itinerary`).
 */
export function getInitialWidgetPayload(): MonvianWidgetPayload {
  try {
    const primary = resolvePrimaryUserItinerary();
    if (primary) {
      const fresh = buildWidgetPayloadClient(primary);
      localStorage.setItem(WIDGET_CACHE_KEY, JSON.stringify(fresh));
      cacheWidgetSpotImages(fresh.spots).catch(() => {});
      return fresh;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(WIDGET_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.spots) && parsed.spots.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return buildWidgetPayloadClient(DEFAULT_CURATED_ITINERARIES[0]);
}
