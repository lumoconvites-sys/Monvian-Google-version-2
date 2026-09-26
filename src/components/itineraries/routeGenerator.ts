import { Itinerary, ItineraryDay, ItineraryStep, Spot } from '../../types';

// Haversine distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Order spots to minimize travel distance (TSP heuristic starting at morning-appropriate spot)
function optimizeSpotOrder(spots: Spot[]): Spot[] {
  if (spots.length <= 2) return spots;

  // Find best morning starter (nature, park or viewpoint)
  const remaining = [...spots];
  let currentIdx = remaining.findIndex(
    s => s.category === 'parks' || s.category === 'nature' || s.category === 'culture'
  );
  if (currentIdx === -1) currentIdx = 0;

  const ordered: Spot[] = [remaining[currentIdx]];
  remaining.splice(currentIdx, 1);

  // Greedily pick nearest next spot
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistanceKm(last.lat, last.lng, remaining[i].lat, remaining[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    ordered.push(remaining[nearestIdx]);
    remaining.splice(nearestIdx, 1);
  }

  return ordered;
}

export function generateCustomItinerary(
  likedSpots: Spot[],
  tripDate: string,
  formattedDate: string,
  peopleCount: number,
  budget: string,
  adultsCount: number = 2,
  childrenCount: number = 0
): Itinerary {
  // Ensure we have at least 1 spot
  if (likedSpots.length === 0) {
    throw new Error('Nenhum lugar selecionado.');
  }

  const orderedSpots = optimizeSpotOrder(likedSpots);

  // Starting schedule at 09:30 AM (570 minutes from midnight)
  let currentMinutes = 9 * 60 + 30;

  const steps: ItineraryStep[] = orderedSpots.map((spot, index) => {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

    const durationMin = 90;
    const distanceToNext =
      index < orderedSpots.length - 1
        ? calculateDistanceKm(spot.lat, spot.lng, orderedSpots[index + 1].lat, orderedSpots[index + 1].lng)
        : undefined;

    const travelTimeMin = distanceToNext !== undefined ? Math.max(5, Math.round(distanceToNext * 2.5 + 4)) : 0;

    // Advance time for next stop
    currentMinutes += durationMin + travelTimeMin;

    return {
      id: `custom-step-${index + 1}`,
      spotId: spot.id,
      stepOrder: index + 1,
      suggestedTime: timeStr,
      durationMinutes: durationMin,
      notes: spot.touristTip || `Aproveite sua parada em ${spot.name}.`,
      spot,
      distanceToNextKm: distanceToNext,
      durationToNextMin: travelTimeMin || undefined
    };
  });

  const coverImage =
    orderedSpots[0]?.image ||
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80';

  const travelersSummary = childrenCount > 0
    ? `${adultsCount} ${adultsCount === 1 ? 'adulto' : 'adultos'} e ${childrenCount} ${childrenCount === 1 ? 'criança' : 'crianças'}`
    : `${peopleCount} ${peopleCount === 1 ? 'pessoa' : 'pessoas'}`;

  const dayData: ItineraryDay = {
    id: 'user-day-1',
    dayNumber: 1,
    title: 'Dia 1: Rota Personalizada na Serra',
    summary: `Roteiro planejado para ${travelersSummary}, passando por ${orderedSpots.map(s => s.shortName || s.name).slice(0, 3).join(', ')}.`,
    steps
  };

  const id = `user-itinerary-${Date.now()}`;

  return {
    id,
    title: 'Meu Roteiro',
    description: `Roteiro criado com ${orderedSpots.length} paradas selecionadas no dia ${formattedDate || tripDate}.`,
    coverImage,
    daysCount: 1,
    categories: Array.from(new Set(orderedSpots.map(s => s.category))),
    days: [dayData],
    isActive: true,
    isRecommended: true,
    usageCount: 1,
    placesCount: orderedSpots.length
  };
}
