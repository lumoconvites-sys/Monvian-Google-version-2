import { Itinerary, ItineraryDay, ItineraryStep, Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import { readScopedString, writeScopedString, readScopedJSON, writeScopedJSON, removeScopedKey } from './userScopedStorage';

export function formatEstimatedDuration(durationMinutes?: number): string {
  const mins = Number(durationMinutes);
  if (!Number.isFinite(mins) || mins <= 0) return '1h 30min';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const rem = Math.round(mins % 60);
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function getOrCreateItinerarySessionId(userOverride?: any): string {
  let sid = readScopedString('monvian_itinerary_session', userOverride);
  if (!sid) {
    sid = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    writeScopedString('monvian_itinerary_session', sid, userOverride);
  }
  return sid;
}

export function normalizeItineraryLivreFlags(itinerary: Itinerary): Itinerary {
  const isLivre =
    itinerary.id === 'roteiro-classico-2-dias' ||
    itinerary.id?.startsWith('roteiro-classico') ||
    itinerary.id === 'roteiro-bate-volta-essencial' ||
    itinerary.badgeText?.toLowerCase() === 'grátis' ||
    itinerary.price === 'R$ 0' ||
    itinerary.price === 'Grátis';
  if (!isLivre) return itinerary;
  return {
    ...itinerary,
    isPremium: false,
    badgeText: 'Grátis',
  };
}

export function buildItineraryFromOrderedSpots(
  selectedSpots: Spot[],
  options?: {
    existingItinerary?: Itinerary | null;
    targetDayIndex?: number;
    title?: string;
  }
): Itinerary {
  const existing = options?.existingItinerary || null;
  const targetIdx = Math.max(0, options?.targetDayIndex ?? 0);
  const itineraryId = existing?.id || `user-itinerary-${Date.now()}`;
  const existingTargetDay = existing?.days?.[targetIdx];
  const dayId = existingTargetDay?.id || `${itineraryId}-day-${targetIdx + 1}`;

  let currentMinutes = 9 * 60 + 30;
  const steps: ItineraryStep[] = selectedSpots.map((spot, idx) => {
    const existingStep = existingTargetDay?.steps?.find(
      (s) => s.spotId === spot.id || s.spot?.id === spot.id
    );
    const hours = Math.floor(currentMinutes / 60) % 24;
    const mins = currentMinutes % 60;
    const suggestedTime = existingStep?.suggestedTime || `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    const durationMin = Number(existingStep?.durationMinutes || spot.durationMinutes || 90);
    const nextSpot = idx < selectedSpots.length - 1 ? selectedSpots[idx + 1] : null;
    const distanceToNext = nextSpot
      ? calculateHaversineKm(Number(spot.lat), Number(spot.lng), Number(nextSpot.lat), Number(nextSpot.lng))
      : undefined;
    const travelTimeMin = distanceToNext !== undefined ? Math.max(4, Math.round(distanceToNext * 2.5 + 4)) : undefined;

    currentMinutes += durationMin + (travelTimeMin || 0);

    return {
      id: existingStep?.id || `step-${spot.id}-${idx + 1}`,
      itineraryId,
      dayId,
      dayNumber: targetIdx + 1,
      spotId: spot.id,
      stepOrder: idx + 1,
      suggestedTime,
      durationMinutes: durationMin,
      notes: existingStep?.notes || spot.touristTip || '',
      title: spot.name,
      spotName: spot.name,
      category: spot.category,
      categoryLabel: spot.categoryLabel || 'Atração',
      description: spot.description || '',
      image: spot.image || '',
      lat: Number(spot.lat),
      lng: Number(spot.lng),
      spot,
      distanceToNextKm: distanceToNext,
      durationToNextMin: travelTimeMin,
    };
  });

  const updatedDay: ItineraryDay = {
    ...(existingTargetDay || {}),
    id: dayId,
    itineraryId,
    dayNumber: targetIdx + 1,
    title: existingTargetDay?.title || `Dia ${targetIdx + 1}: Meu Roteiro`,
    summary: existingTargetDay?.summary || `${steps.length} ${steps.length === 1 ? 'parada selecionada' : 'paradas selecionadas'} em Campos do Jordão.`,
    steps,
  };

  const nextDays: ItineraryDay[] =
    existing?.days && existing.days.length > 0
      ? existing.days.map((d, idx) => (idx === targetIdx ? updatedDay : d))
      : [updatedDay];

  return {
    ...(existing || {}),
    id: itineraryId,
    title: options?.title || existing?.title || 'Meu Roteiro',
    description:
      existing?.description ||
      `Roteiro personalizado com ${steps.length} ${steps.length === 1 ? 'parada' : 'paradas'} selecionadas no mapa.`,
    coverImage:
      selectedSpots[0]?.image ||
      existing?.coverImage ||
      'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
    daysCount: nextDays.length,
    categories: Array.from(new Set(selectedSpots.map((s) => s.category))),
    isActive: true,
    isRecommended: existing?.isRecommended ?? false,
    usageCount: existing?.usageCount ?? 1,
    isPremium: existing?.isPremium ?? false,
    badgeText: existing?.badgeText || 'Grátis',
    placesCount: steps.length,
    days: nextDays,
  };
}

export function recomputeStepsScheduleAndDistances(steps: ItineraryStep[]): ItineraryStep[] {
  return steps.map((step, idx) => {
    const nextStep = idx < steps.length - 1 ? steps[idx + 1] : null;
    const lat1 = Number(step.spot?.lat ?? step.lat);
    const lng1 = Number(step.spot?.lng ?? step.lng);
    const lat2 = nextStep ? Number(nextStep.spot?.lat ?? nextStep.lat) : NaN;
    const lng2 = nextStep ? Number(nextStep.spot?.lng ?? nextStep.lng) : NaN;
    const hasCoords = Number.isFinite(lat1) && Number.isFinite(lng1) && Number.isFinite(lat2) && Number.isFinite(lng2);
    const distanceToNext = hasCoords ? calculateHaversineKm(lat1, lng1, lat2, lng2) : undefined;
    const travelTimeMin = distanceToNext !== undefined ? Math.max(4, Math.round(distanceToNext * 2.5 + 4)) : undefined;

    return {
      ...step,
      stepOrder: idx + 1,
      distanceToNextKm: distanceToNext,
      durationToNextMin: travelTimeMin,
    };
  });
}

export function resolveEnrichedDaySteps(
  itinerary: Itinerary | null | undefined,
  dayIndex: number,
  allSpots: Spot[]
): ItineraryStep[] {
  if (!itinerary?.days || itinerary.days.length === 0) return [];
  const dayToUse = itinerary.days[dayIndex] || itinerary.days[0];
  const rawSteps = [...(dayToUse?.steps || [])].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));
  const pool = allSpots && allSpots.length > 0 ? allSpots : CAMPOS_SPOTS;

  const resolved = rawSteps.map((step, idx) => {
    const foundSpot = pool.find((sp) => sp.id === step.spotId) || step.spot;
    const lat =
      foundSpot && typeof foundSpot.lat === 'number' && !isNaN(foundSpot.lat)
        ? foundSpot.lat
        : typeof step.lat === 'number' && !isNaN(step.lat)
          ? step.lat
          : -22.734 + idx * 0.005;
    const lng =
      foundSpot && typeof foundSpot.lng === 'number' && !isNaN(foundSpot.lng)
        ? foundSpot.lng
        : typeof step.lng === 'number' && !isNaN(step.lng)
          ? step.lng
          : -45.591 + idx * 0.004;

    const spotToUse: Spot = foundSpot
      ? ({ ...foundSpot, lat, lng } as Spot)
      : ({
          id: step.spotId || `spot-${idx}`,
          name: step.spotName || step.title || 'Ponto Turístico',
          shortName: step.spotName || 'Ponto',
          tagLabel: 'Atração',
          category: 'attractions',
          categoryLabel: step.categoryLabel || 'Atração / Turística',
          lat,
          lng,
          image: step.image || '',
          description: step.description || '',
          touristTip: step.notes || '',
          durationMinutes: Number(step.durationMinutes || 90),
          rating: 4.8,
          reviewCount: 120,
          hours: '09:00 - 18:00',
          address: 'Campos do Jordão, SP',
          visitorsToday: 42,
        } as Spot);

    const stepId = step.id || (step.spotId ? `step-${step.spotId}` : `step-item-${idx}`);
    return {
      ...step,
      id: stepId,
      stepOrder: idx + 1,
      durationMinutes: Number(step.durationMinutes || spotToUse.durationMinutes || 90),
      spot: spotToUse,
      lat,
      lng,
    };
  });

  return recomputeStepsScheduleAndDistances(resolved);
}

export function loadActiveItineraryFromStorage(userOverride?: any): Itinerary | null {
  try {
    const parsed = readScopedJSON<Itinerary | null>('monvian_active_itinerary', null, userOverride);
    if (parsed && (parsed.id || parsed.title) && Array.isArray(parsed.days) && parsed.days.length > 0) {
      return normalizeItineraryLivreFlags(parsed);
    }
  } catch {}
  return null;
}

export function saveActiveItineraryToStorage(itinerary: Itinerary | null, userOverride?: any): void {
  try {
    if (itinerary) {
      writeScopedJSON('monvian_active_itinerary', itinerary, userOverride);
    } else {
      removeScopedKey('monvian_active_itinerary', userOverride);
    }
  } catch {}
}

export async function persistUserItineraryToBackend(
  itinerary: Itinerary,
  method: 'POST' | 'PUT',
  sessionId: string
): Promise<void> {
  try {
    const url = method === 'POST' ? '/api/user-itineraries' : `/api/user-itineraries/${encodeURIComponent(itinerary.id)}`;
    await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({
        id: itinerary.id,
        title: itinerary.title,
        description: itinerary.description,
        coverImage: itinerary.coverImage,
        daysCount: itinerary.daysCount,
        tripDate: '',
        days: itinerary.days,
      }),
    });
  } catch (err) {
    console.warn('[Itinerary] Backend sync warning:', err);
  }
}

export async function deleteUserItineraryFromBackend(itineraryId: string, sessionId: string): Promise<void> {
  try {
    await fetch(`/api/user-itineraries/${encodeURIComponent(itineraryId)}`, {
      method: 'DELETE',
      headers: { 'x-session-id': sessionId },
    });
  } catch {}
}
