import { Itinerary, ItineraryDay, ItineraryStep, Spot } from '../types';
import { CAMPOS_SPOTS } from '../data/spots';
import {
  getActiveUserScope,
  readScopedString,
  writeScopedString,
  readScopedJSON,
  writeScopedJSON,
  removeScopedKey,
} from './userScopedStorage';
import {
  persistUserItineraryToFirestore,
  fetchUserItinerariesFromFirestore,
  deleteUserItineraryFromFirestore,
} from '../services/firestoreSync';

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
    coverImage?: string;
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
      options?.coverImage ||
      existing?.coverImage ||
      selectedSpots[0]?.image ||
      'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
    daysCount: nextDays.length,
    categories: Array.from(new Set(selectedSpots.map((s) => s.category))),
    isActive: true,
    isRecommended: existing?.isRecommended ?? false,
    usageCount: existing?.usageCount ?? 1,
    isPremium: false,
    badgeText: 'Grátis',
    placesCount: steps.length,
    days: nextDays,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

export function loadIsItineraryActiveOnMapFromStorage(userOverride?: any): boolean {
  try {
    const itin = loadActiveItineraryFromStorage(userOverride);
    if (!itin) return false;
    const flag = readScopedString('monvian_itinerary_map_active', userOverride);
    return flag !== '0';
  } catch {
    return false;
  }
}

export function saveIsItineraryActiveOnMapToStorage(isActiveOnMap: boolean, userOverride?: any): void {
  try {
    writeScopedString('monvian_itinerary_map_active', isActiveOnMap ? '1' : '0', userOverride);
  } catch {}
}

export function saveActiveItineraryToStorage(itinerary: Itinerary | null, userOverride?: any): void {
  try {
    if (itinerary) {
      writeScopedJSON('monvian_active_itinerary', itinerary, userOverride);
      writeScopedString('monvian_itinerary_map_active', '1', userOverride);
    } else {
      removeScopedKey('monvian_active_itinerary', userOverride);
      removeScopedKey('monvian_itinerary_map_active', userOverride);
    }
  } catch {}
}

function getItineraryRequestAuthHeaders(sessionId: string, userOverride?: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
  };
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('monvian_token') : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const rawUser =
      userOverride ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('monvian_user')
        ? JSON.parse(localStorage.getItem('monvian_user') || 'null')
        : null);
    const email = String(rawUser?.email || rawUser?.whatsapp || '').trim().toLowerCase();
    if (email) {
      headers['x-user-email'] = email;
    }
  } catch {}
  return headers;
}

const inMemoryUserItinerariesByScope = new Map<string, Itinerary[]>();
const deletedCustomItineraryIds = new Set<string>();

function resolveEffectiveUser(userOverride?: any): any {
  if (userOverride && typeof userOverride === 'object') return userOverride;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('monvian_user');
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return userOverride;
}

function getEffectiveUserScopeKey(userOverride?: any): string {
  const effective = resolveEffectiveUser(userOverride);
  return getActiveUserScope(effective) || getActiveUserScope() || '__session__';
}

function compactSpotForStorage(spot: Spot | undefined): Spot | undefined {
  if (!spot) return undefined;
  return {
    id: spot.id,
    name: spot.name,
    shortName: spot.shortName,
    tagLabel: spot.tagLabel,
    category: spot.category,
    categoryLabel: spot.categoryLabel,
    lat: spot.lat,
    lng: spot.lng,
    image: typeof spot.image === 'string' && !spot.image.startsWith('data:') ? spot.image : '',
    description: typeof spot.description === 'string' ? spot.description.slice(0, 240) : '',
    touristTip: typeof spot.touristTip === 'string' ? spot.touristTip.slice(0, 200) : '',
    durationMinutes: spot.durationMinutes,
    rating: spot.rating,
    reviewCount: spot.reviewCount,
    hours: spot.hours,
    address: spot.address,
  } as Spot;
}

function compactItineraryForLocalStorage(itinerary: Itinerary, stripDataCover = false): Itinerary {
  const cover =
    typeof itinerary.coverImage === 'string'
      ? stripDataCover && itinerary.coverImage.startsWith('data:')
        ? ''
        : itinerary.coverImage.length > 350_000
          ? ''
          : itinerary.coverImage
      : '';

  const compactDays: ItineraryDay[] = (itinerary.days || []).map((d) => ({
    ...d,
    steps: (d.steps || []).map((s) => ({
      ...s,
      description: typeof s.description === 'string' ? s.description.slice(0, 240) : '',
      image: typeof s.image === 'string' && !s.image.startsWith('data:') ? s.image : '',
      spot: compactSpotForStorage(s.spot),
    })),
  }));

  return {
    ...itinerary,
    coverImage: cover,
    days: compactDays,
  };
}

export function loadUserCreatedItinerariesFromStorage(userOverride?: any): Itinerary[] {
  const effective = resolveEffectiveUser(userOverride);
  const scopeKey = getEffectiveUserScopeKey(effective);
  const memoryList = inMemoryUserItinerariesByScope.get(scopeKey) || [];

  let storageList: Itinerary[] = [];
  try {
    const list = readScopedJSON<Itinerary[]>('monvian_my_custom_itineraries', [], effective);
    if (Array.isArray(list)) {
      storageList = list
        .filter(
          (it) =>
            it &&
            (it.id || it.title) &&
            Array.isArray(it.days) &&
            it.days.length > 0 &&
            !deletedCustomItineraryIds.has(it.id)
        )
        .map((it) => normalizeItineraryLivreFlags(it));
    }
  } catch {}

  if (memoryList.length === 0) return storageList;

  const merged = new Map<string, Itinerary>();
  for (const item of storageList) {
    if (item?.id) merged.set(item.id, item);
  }
  for (const item of memoryList) {
    if (item?.id && !deletedCustomItineraryIds.has(item.id)) {
      merged.set(item.id, item);
    }
  }
  return Array.from(merged.values()).sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
}

export function saveUserCreatedItinerariesToStorage(itineraries: Itinerary[], userOverride?: any): void {
  const effective = resolveEffectiveUser(userOverride);
  const scopeKey = getEffectiveUserScopeKey(effective);
  const cleanList = (itineraries || []).filter(
    (it) => it && (it.id || it.title) && Array.isArray(it.days) && it.days.length > 0
  );
  inMemoryUserItinerariesByScope.set(scopeKey, cleanList);

  try {
    const compact = cleanList.map((it) => compactItineraryForLocalStorage(it, false));
    writeScopedJSON('monvian_my_custom_itineraries', compact, effective);
  } catch {
    try {
      const ultraCompact = cleanList.map((it) => compactItineraryForLocalStorage(it, true));
      writeScopedJSON('monvian_my_custom_itineraries', ultraCompact, effective);
    } catch {}
  }

  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('monvian:user_itineraries_updated', { detail: cleanList }));
    }
  } catch {}
}

export function upsertUserCreatedItineraryToStorage(itinerary: Itinerary, userOverride?: any): Itinerary[] {
  if (itinerary?.id) {
    deletedCustomItineraryIds.delete(itinerary.id);
  }
  const effective = resolveEffectiveUser(userOverride);
  const current = loadUserCreatedItinerariesFromStorage(effective);
  const normalized = normalizeItineraryLivreFlags({
    ...itinerary,
    isUserCreated: true,
    updatedAt: new Date().toISOString(),
    createdAt: itinerary.createdAt || new Date().toISOString(),
  });
  const existsIdx = current.findIndex((item) => item.id === normalized.id);
  const next =
    existsIdx >= 0
      ? current.map((item, idx) => (idx === existsIdx ? normalized : item))
      : [normalized, ...current];
  saveUserCreatedItinerariesToStorage(next, effective);
  return next;
}

export function removeUserCreatedItineraryFromStorage(itineraryId: string, userOverride?: any): Itinerary[] {
  if (itineraryId) {
    deletedCustomItineraryIds.add(itineraryId);
  }
  const effective = resolveEffectiveUser(userOverride);
  const current = loadUserCreatedItinerariesFromStorage(effective);
  const next = current.filter((item) => item.id !== itineraryId);
  saveUserCreatedItinerariesToStorage(next, effective);
  return next;
}

export async function fetchUserCreatedItinerariesFromBackend(userOverride?: any): Promise<Itinerary[]> {
  const effective = resolveEffectiveUser(userOverride);
  const localList = loadUserCreatedItinerariesFromStorage(effective);
  const sessionId = getOrCreateItinerarySessionId(effective);
  const cleanEmail = String(effective?.email || effective?.whatsapp || '').trim().toLowerCase();

  const mergedMap = new Map<string, Itinerary>();
  const mergeCandidate = (candidate: any) => {
    if (!candidate || !candidate.id) return;
    if (deletedCustomItineraryIds.has(candidate.id)) return;
    if (candidate.isUserCreated === false || candidate.sourceItineraryId) return;
    if (!Array.isArray(candidate.days) || candidate.days.length === 0) return;

    const normalized = normalizeItineraryLivreFlags({ ...candidate, isUserCreated: true });
    const existing = mergedMap.get(normalized.id);
    if (!existing) {
      mergedMap.set(normalized.id, normalized);
      return;
    }
    const candTime = normalized.updatedAt ? new Date(normalized.updatedAt).getTime() : 0;
    const existTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    if (candTime >= existTime) {
      mergedMap.set(normalized.id, normalized);
    }
  };

  for (const localItem of localList) {
    mergeCandidate(localItem);
  }

  try {
    const [apiResult, cloudResult] = await Promise.all([
      fetch('/api/user-itineraries', {
        headers: getItineraryRequestAuthHeaders(sessionId, effective),
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetchUserItinerariesFromFirestore({
        email: cleanEmail,
        userId: effective?.id ?? effective?.uid ?? null,
        sessionId,
      }).catch(() => []),
    ]);

    if (apiResult?.success && Array.isArray(apiResult.itineraries)) {
      for (const item of apiResult.itineraries) {
        mergeCandidate(item);
      }
    }
    if (Array.isArray(cloudResult)) {
      for (const item of cloudResult) {
        mergeCandidate(item);
      }
    }
  } catch {}

  const merged = Array.from(mergedMap.values()).sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  saveUserCreatedItinerariesToStorage(merged, effective);
  return merged;
}

export async function persistUserItineraryToBackend(
  itinerary: Itinerary,
  method: 'POST' | 'PUT',
  sessionId: string,
  userOverride?: any
): Promise<void> {
  const effective = resolveEffectiveUser(userOverride);
  const cleanEmail = String(effective?.email || effective?.whatsapp || '').trim().toLowerCase();

  try {
    upsertUserCreatedItineraryToStorage(itinerary, effective);
    const url =
      method === 'POST'
        ? '/api/user-itineraries'
        : `/api/user-itineraries/${encodeURIComponent(itinerary.id)}`;

    await Promise.all([
      fetch(url, {
        method,
        headers: getItineraryRequestAuthHeaders(sessionId, effective),
        body: JSON.stringify({
          id: itinerary.id,
          title: itinerary.title,
          description: itinerary.description,
          coverImage: itinerary.coverImage,
          daysCount: itinerary.daysCount,
          tripDate: '',
          preferences: { isUserCreated: true },
          days: itinerary.days,
        }),
      }).catch(() => null),
      persistUserItineraryToFirestore(
        { ...itinerary, isUserCreated: true },
        {
          userId: effective?.id ?? effective?.uid ?? null,
          userEmail: cleanEmail,
          sessionId,
        }
      ).catch(() => null),
    ]);
  } catch (err) {
    console.warn('[Itinerary] Backend sync warning:', err);
  }
}

export async function deleteUserItineraryFromBackend(
  itineraryId: string,
  sessionId: string,
  userOverride?: any
): Promise<void> {
  const effective = resolveEffectiveUser(userOverride);
  try {
    removeUserCreatedItineraryFromStorage(itineraryId, effective);
    await Promise.all([
      fetch(`/api/user-itineraries/${encodeURIComponent(itineraryId)}`, {
        method: 'DELETE',
        headers: getItineraryRequestAuthHeaders(sessionId, effective),
      }).catch(() => null),
      deleteUserItineraryFromFirestore(itineraryId).catch(() => null),
    ]);
  } catch {}
}

