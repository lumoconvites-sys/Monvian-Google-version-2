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
  'monvian_itinerary_map_active',
  'monvian_itinerary_session',
  'monvian_selected_onboarding_itineraries',
  'monvian_trip_budget',
  'monvian_trip_note_campos',
  'monvian_cached_itinerary',
  'monvian_my_custom_itineraries',
  'monvian_selected_category_filter',
  'monvian_map_category_filter',
  'monvian_search_category_filter',
  'monvian_search_query',
  'monvian_geo_visit_state_v2',
  'monvian_geo_notifications_history_v2',
  'monvian_presentation_seen_explorar',
  'monvian_presentation_seen_roteiros',
  'monvian_presentation_seen_salvos',
  'monvian_welcome_completed',
  'monvian_user_session_id',
  'monvian_last_coords',
  'monvian_last_coords_meta_v2',
  'monvian_local_avatar',
];

export const VALID_MAP_CATEGORY_FILTERS = new Set<string>([
  'hotels',
  'restaurants',
  'cafes',
  'sweets',
  'attractions',
  'pharmacies',
]);

const CATEGORY_FILTER_STORAGE_KEY = 'monvian_selected_category_filter';
const SEARCH_CATEGORY_FILTER_STORAGE_KEY = 'monvian_search_category_filter';
const SEARCH_QUERY_STORAGE_KEY = 'monvian_search_query';

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

function sanitizeScopePart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._@-]/g, '_');
}

export function getActiveUserScope(userOverride?: any): string | null {
  if (!hasLocalStorage() && userOverride === undefined) return null;
  if (userOverride === null) return null;

  try {
    let target = userOverride;
    if (target === undefined) {
      if (!hasLocalStorage()) return null;
      const token = localStorage.getItem('monvian_token');
      const rawUser = localStorage.getItem('monvian_user');
      if (!token || !rawUser) return null;
      target = JSON.parse(rawUser);
    }
    if (!target || typeof target !== 'object') return null;

    const rawId =
      target.id !== undefined && target.id !== null && String(target.id).trim() !== ''
        ? String(target.id).trim()
        : target.uid !== undefined && target.uid !== null && String(target.uid).trim() !== ''
          ? String(target.uid).trim()
          : target.auth_id !== undefined && target.auth_id !== null && String(target.auth_id).trim() !== ''
            ? String(target.auth_id).trim()
            : '';

    const cleanEmail = String(target.email || target.whatsapp || '')
      .trim()
      .toLowerCase();

    if (rawId && cleanEmail) {
      return `id_${sanitizeScopePart(rawId)}__e_${sanitizeScopePart(cleanEmail)}`;
    }
    if (rawId) {
      return `id_${sanitizeScopePart(rawId)}`;
    }
    if (cleanEmail) {
      return `e_${sanitizeScopePart(cleanEmail)}`;
    }
  } catch {}
  return null;
}

function getLegacyEmailScope(userOverride?: any): string | null {
  if (userOverride === null) return null;
  try {
    let target = userOverride;
    if (target === undefined && hasLocalStorage()) {
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
  } catch {}
  return null;
}

export function getScopedStorageKey(baseKey: string, userOverride?: any): string | null {
  const scope = getActiveUserScope(userOverride);
  if (!scope) return null;
  return `${baseKey}__acct_${scope}`;
}

export function readScopedJSON<T>(baseKey: string, fallback: T, userOverride?: any): T {
  if (!hasLocalStorage()) return fallback;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return fallback;
  try {
    let raw = localStorage.getItem(scopedKey);
    if (!raw) {
      const legacyScope = getLegacyEmailScope(userOverride);
      const legacyKey = legacyScope ? `${baseKey}__acct_${legacyScope}` : null;
      if (legacyKey && legacyKey !== scopedKey) {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          raw = legacyRaw;
          localStorage.setItem(scopedKey, legacyRaw);
          localStorage.removeItem(legacyKey);
        }
      }
    }
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeScopedJSON(baseKey: string, value: unknown, userOverride?: any): void {
  if (!hasLocalStorage()) return;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return;
  try {
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch {}
}

export function readScopedString(baseKey: string, userOverride?: any): string | null {
  if (!hasLocalStorage()) return null;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return null;
  try {
    let val = localStorage.getItem(scopedKey);
    if (val === null) {
      const legacyScope = getLegacyEmailScope(userOverride);
      const legacyKey = legacyScope ? `${baseKey}__acct_${legacyScope}` : null;
      if (legacyKey && legacyKey !== scopedKey) {
        const legacyVal = localStorage.getItem(legacyKey);
        if (legacyVal !== null) {
          val = legacyVal;
          localStorage.setItem(scopedKey, legacyVal);
          localStorage.removeItem(legacyKey);
        }
      }
    }
    return val;
  } catch {
    return null;
  }
}

export function writeScopedString(baseKey: string, value: string, userOverride?: any): void {
  if (!hasLocalStorage()) return;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (!scopedKey) return;
  try {
    localStorage.setItem(scopedKey, value);
  } catch {}
}

export function removeScopedKey(baseKey: string, userOverride?: any): void {
  if (!hasLocalStorage()) return;
  const scopedKey = getScopedStorageKey(baseKey, userOverride);
  if (scopedKey) {
    try {
      localStorage.removeItem(scopedKey);
    } catch {}
  }
  const legacyScope = getLegacyEmailScope(userOverride);
  if (legacyScope) {
    try {
      localStorage.removeItem(`${baseKey}__acct_${legacyScope}`);
    } catch {}
  }
  try {
    localStorage.removeItem(baseKey);
  } catch {}
}

export function readUserCategoryFilter(userOverride?: any): string | null {
  const val = readScopedString(CATEGORY_FILTER_STORAGE_KEY, userOverride);
  if (!val) return null;
  const clean = val.trim();
  return VALID_MAP_CATEGORY_FILTERS.has(clean) ? clean : null;
}

export function writeUserCategoryFilter(categoryId: string | null, userOverride?: any): void {
  if (!categoryId || categoryId === 'all' || !VALID_MAP_CATEGORY_FILTERS.has(categoryId)) {
    removeScopedKey(CATEGORY_FILTER_STORAGE_KEY, userOverride);
    return;
  }
  writeScopedString(CATEGORY_FILTER_STORAGE_KEY, categoryId, userOverride);
}

export function readUserSearchCategoryFilter(userOverride?: any): string | null {
  const val = readScopedString(SEARCH_CATEGORY_FILTER_STORAGE_KEY, userOverride);
  return val && val.trim() ? val.trim() : null;
}

export function writeUserSearchCategoryFilter(categoryId: string | null, userOverride?: any): void {
  if (!categoryId) {
    removeScopedKey(SEARCH_CATEGORY_FILTER_STORAGE_KEY, userOverride);
    return;
  }
  writeScopedString(SEARCH_CATEGORY_FILTER_STORAGE_KEY, categoryId, userOverride);
}

export function readUserSearchQuery(userOverride?: any): string {
  return readScopedString(SEARCH_QUERY_STORAGE_KEY, userOverride) || '';
}

export function writeUserSearchQuery(query: string, userOverride?: any): void {
  const clean = (query || '').trim();
  if (!clean) {
    removeScopedKey(SEARCH_QUERY_STORAGE_KEY, userOverride);
    return;
  }
  writeScopedString(SEARCH_QUERY_STORAGE_KEY, query, userOverride);
}

export function purgeScopedKeysForUser(userOverride: any): void {
  if (!hasLocalStorage() || !userOverride) return;
  try {
    const activeScope = getActiveUserScope(userOverride);
    const legacyEmailScope = getLegacyEmailScope(userOverride);
    const rawId =
      userOverride.id !== undefined && userOverride.id !== null
        ? `id_${sanitizeScopePart(String(userOverride.id))}`
        : null;

    const suffixes = [activeScope, legacyEmailScope, rawId]
      .filter((s): s is string => Boolean(s))
      .map((s) => `__acct_${s}`);

    if (suffixes.length === 0) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (suffixes.some((suffix) => k.endsWith(suffix))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch {}
}

export function purgeLegacyUnscopedActivityKeys(): void {
  if (!hasLocalStorage()) return;
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
        (k.startsWith('monvian_user_itinerary_') ||
          k.startsWith('monvian_presentation_seen_')) &&
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
