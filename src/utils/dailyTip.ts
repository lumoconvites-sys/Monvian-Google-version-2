import { Spot, SpotCategory } from '../types';

export interface DailyTipResult {
  spot: Spot;
  popularCategoryLabel: string;
}

/**
 * Calculates the most popular spot category among users based on:
 * - Visitors count (visitorsToday)
 * - Review counts & ratings
 * - User favorites
 * 
 * Then selects a random spot from that category to recommend.
 */
export function getRandomSpotFromPopularCategory(
  spots: Spot[],
  favorites: string[] = []
): DailyTipResult | null {
  if (!spots || spots.length === 0) return null;

  // Aggregate category popularity score
  const categoryStats: Record<string, { label: string; score: number; spots: Spot[] }> = {};

  spots.forEach((spot) => {
    const cat = spot.category || 'gastronomy';
    if (!categoryStats[cat]) {
      categoryStats[cat] = {
        label: spot.categoryLabel || getFallbackLabel(cat),
        score: 0,
        spots: [],
      };
    }

    const isFav = favorites.includes(spot.id) ? 150 : 0;
    const visitors = (spot.visitorsToday || 0) * 2;
    const reviews = Math.min((spot.reviewCount || 0) * 0.1, 150);
    const ratingScore = (spot.rating || 4.5) * 20;

    categoryStats[cat].score += visitors + reviews + ratingScore + isFav;
    categoryStats[cat].spots.push(spot);
  });

  // Find the category with the highest popularity score
  let topCategory: { label: string; score: number; spots: Spot[] } | null = null;

  Object.values(categoryStats).forEach((item) => {
    if (!topCategory || item.score > topCategory.score) {
      topCategory = item;
    }
  });

  if (!topCategory || topCategory.spots.length === 0) {
    const fallbackSpot = spots[Math.floor(Math.random() * spots.length)];
    return {
      spot: fallbackSpot,
      popularCategoryLabel: fallbackSpot.categoryLabel || 'Lugares em Destaque',
    };
  }

  // Pick a random spot from that most popular category
  const candidateSpots = topCategory.spots;
  const randomIndex = Math.floor(Math.random() * candidateSpots.length);
  const selectedSpot = candidateSpots[randomIndex];

  return {
    spot: selectedSpot,
    popularCategoryLabel: topCategory.label,
  };
}

function getFallbackLabel(category: SpotCategory | string): string {
  const map: Record<string, string> = {
    hotels: 'Hotéis e Pousadas',
    restaurants: 'Restaurantes',
    cafes: 'Cafés e Docerias',
    sweets: 'Chocolates & Doces',
    attractions: 'Atrações & Passeios',
    events: 'Eventos',
    pharmacies: 'Farmácias',
    nature: 'Natureza & Parques',
    gastronomy: 'Gastronomia',
    culture: 'Cultura & Arte',
    parks: 'Parques',
    viewpoint: 'Mirantes & Vistas',
    services: 'Serviços',
  };
  return map[category] || 'Mais Populares';
}
