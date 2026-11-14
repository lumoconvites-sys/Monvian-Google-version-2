// Durable iOS/PWA-compatible authentication storage backed by IndexedDB + localStorage + cookie fallback.
// Never stores plaintext passwords — only signed session tokens, Supabase OAuth/refresh tokens, and safe profile metadata.

const DB_NAME = 'monvian_auth_vault';
const DB_VERSION = 1;
const SESSION_STORE = 'session_store';
const KV_STORE = 'kv_store';
const SESSION_RECORD_KEY = 'current_session';

const LS_TOKEN_KEY = 'monvian_token';
const LS_USER_KEY = 'monvian_user';
const COOKIE_TOKEN_KEY = 'monvian_token';

export interface PersistentSessionRecord {
  id: string;
  token: string;
  user: any;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openAuthDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          try {
            db.close();
          } catch {}
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

async function idbGet<T = any>(storeName: string, key: string): Promise<T | null> {
  const db = await openAuthDb();
  if (!db) return null;

  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(storeName: string, value: any): Promise<void> {
  const db = await openAuthDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openAuthDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbClearStore(storeName: string): Promise<void> {
  const db = await openAuthDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function setAuthCookie(token: string): void {
  if (typeof document === 'undefined' || !token) return;
  try {
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const secureFlag = isHttps ? '; Secure' : '';
    document.cookie = `${COOKIE_TOKEN_KEY}=${encodeURIComponent(token)}; Max-Age=31536000; Path=/; SameSite=Lax${secureFlag}`;
  } catch {}
}

export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;
  try {
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const secureFlag = isHttps ? '; Secure' : '';
    document.cookie = `${COOKIE_TOKEN_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secureFlag}`;
    document.cookie = `${COOKIE_TOKEN_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `monvian_user=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {}
}

export function hasSyncSessionToken(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const token = localStorage.getItem(LS_TOKEN_KEY);
    const savedUser = localStorage.getItem(LS_USER_KEY);
    return Boolean(token && savedUser);
  } catch {
    return false;
  }
}

export async function savePersistentSession(token: string, user: any): Promise<void> {
  if (!token || !user) return;

  try {
    localStorage.setItem(LS_TOKEN_KEY, token);
    localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
  } catch {}

  setAuthCookie(token);

  const record: PersistentSessionRecord = {
    id: SESSION_RECORD_KEY,
    token,
    user,
    updatedAt: Date.now(),
  };

  await idbPut(SESSION_STORE, record);
}

export async function loadPersistentSession(): Promise<{ token: string; user: any | null } | null> {
  let lsToken: string | null = null;
  let lsUser: any | null = null;

  try {
    lsToken = localStorage.getItem(LS_TOKEN_KEY);
    const rawUser = localStorage.getItem(LS_USER_KEY);
    if (rawUser) {
      lsUser = JSON.parse(rawUser);
    }
  } catch {}

  if (lsToken && lsUser) {
    // Ensure IndexedDB & cookie mirrors stay up to date
    setAuthCookie(lsToken);
    idbGet<PersistentSessionRecord>(SESSION_STORE, SESSION_RECORD_KEY)
      .then((existing) => {
        if (!existing || existing.token !== lsToken) {
          return idbPut(SESSION_STORE, {
            id: SESSION_RECORD_KEY,
            token: lsToken,
            user: lsUser,
            updatedAt: Date.now(),
          });
        }
      })
      .catch(() => {});
    return { token: lsToken, user: lsUser };
  }

  // Fallback 1: IndexedDB durable store (survives iOS PWA restart & localStorage eviction)
  try {
    const idbRecord = await idbGet<PersistentSessionRecord>(SESSION_STORE, SESSION_RECORD_KEY);
    if (idbRecord?.token) {
      try {
        localStorage.setItem(LS_TOKEN_KEY, idbRecord.token);
        if (idbRecord.user) {
          localStorage.setItem(LS_USER_KEY, JSON.stringify(idbRecord.user));
        }
      } catch {}
      setAuthCookie(idbRecord.token);
      return { token: idbRecord.token, user: idbRecord.user || null };
    }
  } catch {}

  // Fallback 2: Persistent cookie (restores token if both localStorage & IDB lagged)
  const cookieToken = getCookieValue(COOKIE_TOKEN_KEY);
  if (cookieToken) {
    try {
      localStorage.setItem(LS_TOKEN_KEY, cookieToken);
    } catch {}
    return { token: cookieToken, user: lsUser };
  }

  if (lsToken) {
    return { token: lsToken, user: lsUser };
  }

  return null;
}

export function clearSyncSessionStorage(options?: { preserveManualLogoutFlag?: boolean }): void {
  if (typeof window === 'undefined') return;
  const keysToRemove = [
    'monvian_token',
    'monvian_auth_token',
    'auth_token',
    'monvian_supabase_auth',
    'monvian_user',
    'monvian_local_avatar',
    'monvian_active_itinerary',
    'monvian_itinerary_view_mode',
    'monvian_itinerary_expanded',
    'monvian_itinerary_session',
    'monvian_selected_onboarding_itineraries',
    'monvian_trip_budget',
    'monvian_trip_note_campos',
    'monvian_user_preferences',
    'monvian_user_session_id',
    ...(options?.preserveManualLogoutFlag ? [] : ['monvian_manual_logout']),
  ];

  keysToRemove.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });

  try {
    const dynamicKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('monvian_user_avatar_') ||
          k.startsWith('monvian_user_itinerary_') ||
          k.startsWith('monvian_cached_xp_state_') ||
          k.startsWith('sb-') ||
          k.startsWith('supabase.auth'))
      ) {
        dynamicKeys.push(k);
      }
    }
    dynamicKeys.forEach((k) => localStorage.removeItem(k));
  } catch {}

  try {
    sessionStorage.clear();
  } catch {}

  clearAuthCookies();
}

export async function clearPersistentSession(options?: { preserveManualLogoutFlag?: boolean }): Promise<void> {
  clearSyncSessionStorage(options);

  await Promise.allSettled([
    idbDelete(SESSION_STORE, SESSION_RECORD_KEY),
    idbClearStore(KV_STORE),
  ]);
}

/**
 * Custom async storage adapter for @supabase/supabase-js that persists refresh & access tokens
 * in IndexedDB (durable on iOS PWA) mirrored with localStorage.
 */
export function createSupabaseIndexedDBStorage() {
  return {
    getItem: async (key: string): Promise<string | null> => {
      let lsVal: string | null = null;
      try {
        lsVal = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {}

      try {
        const record = await idbGet<{ key: string; value: string }>(KV_STORE, key);
        if (record && typeof record.value === 'string') {
          if (!lsVal) {
            try {
              localStorage.setItem(key, record.value);
            } catch {}
          }
          return record.value;
        }
      } catch {}

      if (lsVal) {
        // Migrate existing localStorage session into IndexedDB automatically
        idbPut(KV_STORE, { key, value: lsVal }).catch(() => {});
        return lsVal;
      }

      return null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch {}
      await idbPut(KV_STORE, { key, value });
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch {}
      await idbDelete(KV_STORE, key);
    },
  };
}
