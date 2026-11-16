// User-scoped local storage utilities to guarantee strict per-account data isolation on shared devices

const LEGACY_UNSCOPED_ACTIVITY_KEYS = [
  'monvian_saved_itineraries',
  'monvian_itinerary_favs',
  'monvian_saved_spots',
  'monvian_removed_items',
  'monvian_saved_places',
  'monvian_favorites',
  'monvian_liked_posts',
  'monvian_saved_posts',
  'monvian_following_users',
  'monvian_active_itinerary',
  'monvian_itinerary_view_mode',
  'monvian_itinerary_expanded',
  'monvian_itinerary_session',
  'monvian_selected_onboarding_itineraries',
  'monvian_trip_budget',
  'monvian_trip_note_campos',
  'monvian_cached_itinerary',
];

function sanitizeScopePart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@-]/g, '_');
}

export function getActiveUserScope(userOverride?: any): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let target = userOverride;
    if (!target) {
      const token = localStorage.getItem('monvian_token');
      const rawUser = localStorage.getItem('monvian_user');
      if (!token || !rawUser) return null;
      target = JSON.parse(rawUser);
    }
    if (!target || typeof target !== 'object') return null;

    const cleanEmail = String(target.email || target.whatsapp || '')
      .trim()
      .toLowerCase();
    if (cleanEmail) {
      return `e_${sanitizeScopePart(cleanEmail)}`;
    }
    if (target.id !== undefined && target.id !== null && String(target.id).trim() !== '') {
      return `id_${sanitizeScopePart(String(target.id))}`;
    }
  } catch {}
  return null;
}

export function getScopedStorageKey(baseKey: string, userOverride?: any): string | null {
  const scope = getActiveUserScope(userOverride);
  if (!scope) return null;
  return `${baseKey}__acct_${scope}`;
}

export function readScopedJSON<T>(baseKey: string, fallback: T, userOverride?: any): T {
  if (typeof window === 'undefined') return fallback;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return fallback;
  try {
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeScopedJSON(baseKey: string, value: unknown, userOverride?: any): void {
  if (typeof window === 'undefined') return;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return;
  try {
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch {}
}

export function readScopedString(baseKey: string, userOverride?: any): string | null {
  if (typeof window === 'undefined') return null;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return null;
  try {
    return localStorage.getItem(scopedKey);
  } catch {
    return null;
  }
}

export function writeScopedString(baseKey: string, value: string, userOverride?: any): void {
  if (typeof window === 'undefined') return;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return;
  try {
    localStorage.setItem(scopedKey, value);
  } catch {}
}

export function removeScopedKey(baseKey: string, userOverride?: any): void {
  if (typeof window === 'undefined') return;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (scopedKey) {
    try {
      localStorage.removeItem(scopedKey);
    } catch {}
  }
  try {
    localStorage.removeItem(baseKey);
  } catch {}
}

export function purgeLegacyUnscopedActivityKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    LEGACY_UNSCOPED_ACTIVITY_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    });

    const dynamicLegacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.startsWith('monvian_user_itinerary_') &&
        !k.includes('__acct_')
      ) {
        dynamicLegacyKeys.push(k);
      }
    }
    dynamicLegacyKeys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch {}
}
