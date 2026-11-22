import type { Spot } from '../types.js';

export type AssistantBudgetTier = 'economico' | 'premium';

export interface AssistantSpotCandidate {
  id: string;
  name: string;
  category: string;
  categoryLabel?: string;
  address?: string;
  priceRange?: string;
  price?: string;
  rating?: number;
  hours?: string;
  description?: string;
  touristTip?: string;
  lat: number;
  lng: number;
  image?: string;
  highlighted?: boolean;
}

/**
 * Computes a strictly user-isolated storage key for the Monvian Assistant conversation state.
 * Never returns a shared global key across authenticated accounts.
 */
export function getAssistantStorageKey(userIdentity?: { id?: string | null; email?: string | null } | null): string {
  const uid = userIdentity?.id?.trim();
  const email = userIdentity?.email?.trim()?.toLowerCase();
  const key = uid || email || 'guest_anonymous';
  return `monvian_assistant_state_v1::${key}`;
}

/**
 * Calculates Haversine distance in kilometers between two coordinates.
 */
export function calculateHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Orders an array of spots using nearest-neighbor geographic proximity so itinerary routes
 * flow naturally through Campos do Jordão without erratic back-and-forth jumps.
 */
export function orderSpotsByProximity<T extends { id: string; lat: number; lng: number }>(
  spots: T[],
  startCoord?: { lat: number; lng: number } | null
): T[] {
  if (spots.length <= 2) return [...spots];

  const remaining = [...spots];
  const ordered: T[] = [];

  if (startCoord && Number.isFinite(startCoord.lat) && Number.isFinite(startCoord.lng)) {
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = calculateHaversineKm(startCoord.lat, startCoord.lng, remaining[i].lat, remaining[i].lng);
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }
    ordered.push(remaining.splice(closestIdx, 1)[0]);
  } else {
    ordered.push(remaining.shift()!);
  }

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateHaversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    ordered.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return ordered;
}

/**
 * Determines whether a spot matches an economic or premium budget tier.
 */
export function matchesBudgetTier(
  spot: Pick<Spot, 'priceRange' | 'price' | 'category' | 'highlighted'>,
  tier: AssistantBudgetTier
): boolean {
  const range = (spot.priceRange || '').trim();
  const priceText = (spot.price || '').toLowerCase();

  if (tier === 'economico') {
    if (range === '$$$$' || range === '$$$') return false;
    if (
      priceText.includes('gratuito') ||
      priceText.includes('grátis') ||
      priceText.includes('free') ||
      range === '$' ||
      range === '$$' ||
      range === ''
    ) {
      return true;
    }
    const numMatch = priceText.match(/r\$\s*(\d+)/i);
    if (numMatch && Number(numMatch[1]) <= 95) return true;
    return range !== '$$$$';
  }

  // Premium tier
  if (range === '$$$$' || range === '$$$' || range === '$$') return true;
  if (spot.highlighted) return true;
  const numMatch = priceText.match(/r\$\s*(\d+)/i);
  if (numMatch && Number(numMatch[1]) >= 60) return true;
  return true;
}

/**
 * Selects and orders real Monvian spots for an itinerary based on style/theme and budget tier.
 * Never returns nonexistent spot IDs.
 */
export function selectSmartItinerarySpots<T extends AssistantSpotCandidate>(
  allSpots: T[],
  options: {
    requestedSpotIds?: string[];
    style?: string;
    budgetTier?: AssistantBudgetTier;
    limit?: number;
    userLocation?: { lat: number; lng: number } | null;
  }
): T[] {
  const limit = Math.max(2, Math.min(options.limit || 4, 6));
  const byId = new Map(allSpots.map((s) => [String(s.id), s]));

  // 1. Validate any explicit spot IDs chosen by Gemini against real database spots
  const validatedExplicit: T[] = [];
  if (Array.isArray(options.requestedSpotIds)) {
    for (const rawId of options.requestedSpotIds) {
      const found = byId.get(String(rawId).trim());
      if (found && !validatedExplicit.some((s) => s.id === found.id)) {
        validatedExplicit.push(found);
      }
    }
  }

  if (validatedExplicit.length >= 2) {
    return orderSpotsByProximity(validatedExplicit.slice(0, limit), options.userLocation);
  }

  // 2. Fallback / complement with intelligent thematic + budget scoring over real spots
  const styleNorm = (options.style || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const tier: AssistantBudgetTier = options.budgetTier || 'premium';

  const scored = allSpots
    .filter((s) => !validatedExplicit.some((v) => v.id === s.id))
    .map((spot) => {
      let score = 0;
      const text = `${spot.name} ${spot.category} ${spot.categoryLabel || ''} ${spot.description || ''} ${spot.touristTip || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (matchesBudgetTier(spot as unknown as Spot, tier)) {
        score += 25;
      }

      if (tier === 'premium' && (spot.priceRange === '$$$$' || spot.priceRange === '$$$' || spot.highlighted)) {
        score += 18;
      }
      if (tier === 'economico' && (spot.priceRange === '$' || (spot.price || '').toLowerCase().includes('gratuito'))) {
        score += 18;
      }

      if (styleNorm.includes('romant') || styleNorm.includes('casal')) {
        if (text.includes('romant') || text.includes('casal') || text.includes('fondue') || text.includes('jardim') || text.includes('mirante') || text.includes('vinho') || text.includes('chocolate')) {
          score += 30;
        }
      } else if (styleNorm.includes('famil') || styleNorm.includes('crianc')) {
        if (text.includes('parque') || text.includes('famil') || text.includes('teleferico') || text.includes('chocolate') || text.includes('bosque') || text.includes('lago')) {
          score += 30;
        }
      } else if (styleNorm.includes('gastronom') || styleNorm.includes('jantar') || styleNorm.includes('restaurante')) {
        if (spot.category === 'restaurants' || spot.category === 'cafes' || spot.category === 'chocolate' || text.includes('gastronom') || text.includes('restaurante')) {
          score += 32;
        }
      } else if (styleNorm.includes('nature') || styleNorm.includes('aventur') || styleNorm.includes('trilha') || styleNorm.includes('paisag')) {
        if (spot.category === 'nature' || spot.category === 'viewpoints' || text.includes('parque') || text.includes('pico') || text.includes('horto') || text.includes('mirante')) {
          score += 30;
        }
      }

      score += (spot.rating || 4.6) * 3;
      return { spot, score };
    })
    .sort((a, b) => b.score - a.score);

  const combined = [...validatedExplicit];
  const usedCategories = new Set(combined.map((s) => s.category));

  // Prefer diverse categories first for a complete Campos do Jordão experience
  for (const item of scored) {
    if (combined.length >= limit) break;
    if (!usedCategories.has(item.spot.category) || styleNorm.includes('gastronom')) {
      combined.push(item.spot);
      usedCategories.add(item.spot.category);
    }
  }

  for (const item of scored) {
    if (combined.length >= limit) break;
    if (!combined.some((s) => s.id === item.spot.id)) {
      combined.push(item.spot);
    }
  }

  return orderSpotsByProximity(combined, options.userLocation);
}
