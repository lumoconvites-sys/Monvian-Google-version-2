import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { supabase } from '../lib/supabase.ts';

// Initialize Firebase singleton for server sync
const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const firestore = dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);

let firestoreAvailable: boolean | null = null;

/**
 * Utility to run a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms = 3000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

/**
 * Checks whether Cloud Firestore database is active and reachable
 */
export async function isFirestoreReachable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  try {
    const testDoc = doc(firestore, 'system_settings', '_health');
    await withTimeout(getDoc(testDoc), 2000, null);
    firestoreAvailable = true;
    return true;
  } catch (e) {
    try {
      const projectId = (firebaseConfig as any).projectId;
      if (!projectId) {
        firestoreAvailable = false;
        return false;
      }
      firestoreAvailable = true;
      return true;
    } catch (err) {
      firestoreAvailable = false;
      return false;
    }
  }
}

export interface FirestoreUser {
  id?: number;
  name: string;
  username?: string;
  username_normalized?: string;
  bio?: string;
  email: string;
  whatsapp?: string;
  password_hash?: string;
  role: string;
  avatar_url?: string;
  visits_count?: number;
  is_banned?: number;
  snow_enabled?: number;
  theme?: string;
  high_contrast?: number;
  onboarding_completed?: number;
  onboarding_step?: number;
  location_permission_granted?: number;
  motion_permission_granted?: number;
  last_access?: string;
  created_at?: string;
  firebase_uid?: string | null;
  auth_id?: string | null;
  welcome_card_seen?: number;
  globe_intro_seen?: number;
  map_tutorial_status?: 'pending' | 'completed' | 'skipped' | string;
  map_tutorial_updated_at?: string;
  campos_relationship?: string;
  next_trip_timing?: string;
  next_trip_date?: string;
  interest_categories?: string[] | string;
  travel_company?: string;
  location_preference?: string;
}

export interface FirestoreUserOnboarding {
  user_id?: string | number;
  user_email: string;
  campos_relationship?: string;
  next_trip_timing?: string;
  next_trip_date?: string;
  interest_categories?: string[];
  travel_company?: string;
  location_preference?: string;
  location_permission_granted?: number;
  onboarding_step?: number;
  onboarding_completed?: number;
  completed_at?: string;
  updated_at?: string;
}

export interface FirestoreSession {
  token: string;
  user_id: number;
  user_email: string;
  created_at: string;
}

export interface FirestoreSpot {
  id: string;
  name: string;
  short_name?: string;
  tag_label?: string;
  category: string;
  category_label?: string;
  lat: number;
  lng: number;
  image: string;
  gallery?: string;
  description?: string;
  tourist_tip?: string;
  rating?: number;
  review_count?: number;
  hours?: string;
  address?: string;
  price_range?: string;
  popular_times?: string;
  visitors_today?: number;
  badge?: string;
  highlighted?: number;
  is_active?: number;
  is_verified?: number;
  website?: string;
  phone?: string;
  maps_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FirestoreMapVisualIcon {
  id: string;
  category: string;
  icon: string;
  latitude: number;
  longitude: number;
  color?: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export interface FirestoreEvent {
  id: string;
  name: string;
  description?: string;
  image?: string;
  category?: string;
  date?: string;
  time?: string;
  address?: string;
  lat: number;
  lng: number;
  status?: string;
  highlighted?: number;
  created_at?: string;
}

// ----------------------------------------------------
// USERS & SESSIONS PERSISTENCE
// ----------------------------------------------------

export async function persistUserToFirestore(user: FirestoreUser): Promise<void> {
  if (!user.email) return;
  const cleanEmail = user.email.trim().toLowerCase();
  const isAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail) || user.role === 'admin';

  if (supabase) {
    try {
      await withTimeout(
        Promise.resolve(
          supabase.from('users').upsert(
            {
              name: user.name || cleanEmail.split('@')[0],
              username: user.username || cleanEmail.split('@')[0],
              username_normalized: (user.username_normalized || user.username || cleanEmail.split('@')[0]).toLowerCase(),
              bio: user.bio || '',
              email: cleanEmail,
              whatsapp: user.whatsapp || cleanEmail,
              password_hash: user.password_hash || '',
              role: isAdmin ? 'admin' : 'user',
              avatar_url: user.avatar_url || '/fotoperfil.png',
              visits_count: user.visits_count || 1,
              is_banned: user.is_banned || 0,
              snow_enabled: user.snow_enabled || 0,
              theme: user.theme || 'dark',
              high_contrast: user.high_contrast || 0,
              onboarding_completed: user.onboarding_completed !== undefined ? user.onboarding_completed : 1,
              onboarding_step: user.onboarding_step || 1,
              last_access: user.last_access || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          )
        ),
        2500,
        null
      );
    } catch {}
  }

  try {
    const userRef = doc(firestore, 'users', cleanEmail);
    const dataToSave: any = {
      name: user.name || '',
      username: user.username || cleanEmail.split('@')[0],
      email: cleanEmail,
      whatsapp: user.whatsapp || cleanEmail,
      role: isAdmin ? 'admin' : 'user',
      avatar_url: user.avatar_url || '/fotoperfil.png',
      visits_count: user.visits_count || 1,
      is_banned: user.is_banned || 0,
      snow_enabled: user.snow_enabled || 0,
      theme: user.theme || 'dark',
      high_contrast: user.high_contrast || 0,
      onboarding_completed: user.onboarding_completed !== undefined ? user.onboarding_completed : 1,
      onboarding_step: user.onboarding_step || 1,
      last_access: user.last_access || new Date().toISOString(),
      created_at: user.created_at || new Date().toISOString()
    };
    if (user.password_hash) {
      dataToSave.password_hash = user.password_hash;
    }
    if (user.auth_id || user.firebase_uid) {
      dataToSave.auth_id = user.auth_id || user.firebase_uid;
      dataToSave.firebase_uid = user.firebase_uid || user.auth_id;
    }
    if (user.location_permission_granted !== undefined) {
      dataToSave.location_permission_granted = user.location_permission_granted ? 1 : 0;
    }
    if (user.motion_permission_granted !== undefined) {
      dataToSave.motion_permission_granted = user.motion_permission_granted ? 1 : 0;
    }
    if (user.welcome_card_seen !== undefined) {
      dataToSave.welcome_card_seen = user.welcome_card_seen ? 1 : 0;
    }
    if (user.globe_intro_seen !== undefined) {
      dataToSave.globe_intro_seen = user.globe_intro_seen ? 1 : 0;
    }
    if (user.map_tutorial_status !== undefined) {
      const normalizedTutorial = String(user.map_tutorial_status).trim().toLowerCase();
      if (normalizedTutorial === 'pending' || normalizedTutorial === 'completed' || normalizedTutorial === 'skipped') {
        dataToSave.map_tutorial_status = normalizedTutorial;
      }
    }
    if (user.map_tutorial_updated_at !== undefined) {
      dataToSave.map_tutorial_updated_at = user.map_tutorial_updated_at;
    }
    if (user.campos_relationship !== undefined) {
      dataToSave.campos_relationship = user.campos_relationship;
    }
    if (user.next_trip_timing !== undefined) {
      dataToSave.next_trip_timing = user.next_trip_timing;
    }
    if (user.next_trip_date !== undefined) {
      dataToSave.next_trip_date = user.next_trip_date;
    }
    if (user.interest_categories !== undefined) {
      dataToSave.interest_categories = Array.isArray(user.interest_categories)
        ? user.interest_categories
        : user.interest_categories;
    }
    if (user.travel_company !== undefined) {
      dataToSave.travel_company = user.travel_company;
    }
    if (user.location_preference !== undefined) {
      dataToSave.location_preference = user.location_preference;
    }
    if (user.id) {
      dataToSave.id = user.id;
    }

    await withTimeout(setDoc(userRef, dataToSave, { merge: true }), 2500, null);
  } catch (err: any) {
    // Fail silently in background
  }
}

export async function persistUserOnboardingToFirestore(
  payload: FirestoreUserOnboarding
): Promise<void> {
  const cleanEmail = String(payload.user_email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  const nowIso = new Date().toISOString();

  const record: Record<string, any> = {
    user_id: payload.user_id !== undefined ? String(payload.user_id) : '',
    user_email: cleanEmail,
    updated_at: payload.updated_at || nowIso,
  };

  if (payload.campos_relationship !== undefined) {
    record.campos_relationship = String(payload.campos_relationship || '');
  }
  if (payload.next_trip_timing !== undefined) {
    record.next_trip_timing = String(payload.next_trip_timing || '');
  }
  if (payload.next_trip_date !== undefined) {
    record.next_trip_date = String(payload.next_trip_date || '');
  }
  if (payload.interest_categories !== undefined) {
    record.interest_categories = Array.isArray(payload.interest_categories)
      ? payload.interest_categories
      : [];
  }
  if (payload.travel_company !== undefined) {
    record.travel_company = String(payload.travel_company || '');
  }
  if (payload.location_preference !== undefined) {
    record.location_preference = String(payload.location_preference || '');
  }
  if (payload.location_permission_granted !== undefined) {
    record.location_permission_granted = payload.location_permission_granted ? 1 : 0;
  }
  if (payload.onboarding_step !== undefined) {
    record.onboarding_step = Number(payload.onboarding_step || 1);
  }
  if (payload.onboarding_completed !== undefined) {
    record.onboarding_completed = payload.onboarding_completed ? 1 : 0;
  }
  if (payload.completed_at !== undefined) {
    record.completed_at = payload.completed_at;
  }

  try {
    const onboardingRef = doc(firestore, 'user_onboarding', cleanEmail);
    const userRef = doc(firestore, 'users', cleanEmail);
    await Promise.allSettled([
      withTimeout(setDoc(onboardingRef, record, { merge: true }), 2500, null),
      withTimeout(setDoc(userRef, record, { merge: true }), 2500, null),
    ]);
  } catch {}
}

export async function getUserOnboardingFromFirestore(
  email?: string
): Promise<FirestoreUserOnboarding | null> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  try {
    const onboardingRef = doc(firestore, 'user_onboarding', cleanEmail);
    const snap = await withTimeout(getDoc(onboardingRef), 2500, null as any);
    if (snap && snap.exists && snap.exists()) {
      const data = snap.data() || {};
      return {
        user_id: data.user_id || '',
        user_email: cleanEmail,
        campos_relationship: data.campos_relationship || '',
        next_trip_timing: data.next_trip_timing || '',
        next_trip_date: data.next_trip_date || '',
        interest_categories: Array.isArray(data.interest_categories)
          ? data.interest_categories
          : [],
        travel_company: data.travel_company || '',
        location_preference: data.location_preference || '',
        location_permission_granted: Number(data.location_permission_granted || 0),
        onboarding_step: Number(data.onboarding_step || 1),
        onboarding_completed:
          data.onboarding_completed !== undefined
            ? Number(data.onboarding_completed)
            : 0,
        completed_at: data.completed_at || '',
        updated_at: data.updated_at || '',
      };
    }

    const userRef = doc(firestore, 'users', cleanEmail);
    const uSnap = await withTimeout(getDoc(userRef), 2500, null as any);
    if (uSnap && uSnap.exists && uSnap.exists()) {
      const uData = uSnap.data() || {};
      if (
        uData.campos_relationship ||
        uData.next_trip_timing ||
        uData.travel_company ||
        (Array.isArray(uData.interest_categories) && uData.interest_categories.length > 0)
      ) {
        return {
          user_id: uData.id ? String(uData.id) : '',
          user_email: cleanEmail,
          campos_relationship: uData.campos_relationship || '',
          next_trip_timing: uData.next_trip_timing || '',
          next_trip_date: uData.next_trip_date || '',
          interest_categories: Array.isArray(uData.interest_categories)
            ? uData.interest_categories
            : [],
          travel_company: uData.travel_company || '',
          location_preference: uData.location_preference || '',
          location_permission_granted: Number(uData.location_permission_granted || 0),
          onboarding_step: Number(uData.onboarding_step || 1),
          onboarding_completed:
            uData.onboarding_completed !== undefined
              ? Number(uData.onboarding_completed)
              : 1,
          updated_at: uData.updated_at || '',
        };
      }
    }
  } catch {}
  return null;
}

function normalizeInterestList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {}
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

let cachedAllOnboardingMap: Map<string, FirestoreUserOnboarding> | null = null;
let cachedAllOnboardingAt = 0;
const ONBOARDING_CACHE_TTL_MS = 10000;

export async function getAllUserOnboardingFromFirestore(
  forceRefresh = false
): Promise<Map<string, FirestoreUserOnboarding>> {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedAllOnboardingMap &&
    now - cachedAllOnboardingAt < ONBOARDING_CACHE_TTL_MS
  ) {
    return cachedAllOnboardingMap;
  }

  const mergedMap = new Map<string, FirestoreUserOnboarding>();

  try {
    const [obSnap, usersSnap] = await Promise.all([
      withTimeout(getDocs(collection(firestore, 'user_onboarding')), 3500, null as any),
      withTimeout(getDocs(collection(firestore, 'users')), 3500, null as any),
    ]);

    const mergeInto = (emailRaw: string, src: Record<string, any>, preferIncoming: boolean) => {
      const cleanEmail = String(emailRaw || '').trim().toLowerCase();
      if (!cleanEmail) return;

      const existing = mergedMap.get(cleanEmail);
      const incomingInterests = normalizeInterestList(src.interest_categories);
      const existingInterests = existing?.interest_categories || [];

      const pickStr = (incoming: any, current?: string) => {
        const inc = String(incoming || '').trim();
        const cur = String(current || '').trim();
        if (preferIncoming) return inc || cur;
        return cur || inc;
      };

      mergedMap.set(cleanEmail, {
        user_id: pickStr(src.user_id || src.id, existing?.user_id ? String(existing.user_id) : ''),
        user_email: cleanEmail,
        campos_relationship: pickStr(src.campos_relationship, existing?.campos_relationship),
        next_trip_timing: pickStr(src.next_trip_timing, existing?.next_trip_timing),
        next_trip_date: pickStr(src.next_trip_date, existing?.next_trip_date),
        interest_categories:
          preferIncoming
            ? incomingInterests.length > 0
              ? incomingInterests
              : existingInterests
            : existingInterests.length > 0
              ? existingInterests
              : incomingInterests,
        travel_company: pickStr(src.travel_company, existing?.travel_company),
        location_preference: pickStr(src.location_preference, existing?.location_preference),
        location_permission_granted: Number(
          src.location_permission_granted ?? existing?.location_permission_granted ?? 0
        ),
        onboarding_step: Number(src.onboarding_step ?? existing?.onboarding_step ?? 1),
        onboarding_completed:
          src.onboarding_completed !== undefined
            ? Number(src.onboarding_completed)
            : existing?.onboarding_completed !== undefined
              ? Number(existing.onboarding_completed)
              : 0,
        completed_at: pickStr(src.completed_at, existing?.completed_at),
        updated_at: pickStr(src.updated_at, existing?.updated_at),
      });
    };

    if (usersSnap && !usersSnap.empty) {
      usersSnap.forEach((docSnap: any) => {
        const data = docSnap.data() || {};
        const email = data.email || data.user_email || docSnap.id;
        if (
          data.campos_relationship ||
          data.next_trip_timing ||
          data.next_trip_date ||
          data.travel_company ||
          data.location_preference ||
          normalizeInterestList(data.interest_categories).length > 0
        ) {
          mergeInto(email, data, false);
        }
      });
    }

    if (obSnap && !obSnap.empty) {
      obSnap.forEach((docSnap: any) => {
        const data = docSnap.data() || {};
        const email = data.user_email || data.email || docSnap.id;
        mergeInto(email, data, true);
      });
    }

    cachedAllOnboardingMap = mergedMap;
    cachedAllOnboardingAt = now;
  } catch (err) {
    if (cachedAllOnboardingMap) return cachedAllOnboardingMap;
  }

  return mergedMap;
}

/**
 * Permanently registers that the first-access welcome card was presented to the authenticated user.
 * Syncs to SQLite server API, Firestore, and Supabase.
 */
export async function markWelcomeCardSeen(cleanEmail: string, token?: string): Promise<void> {
  const email = (cleanEmail || '').trim().toLowerCase();
  if (!email && !token) return;

  // 1. Update SQLite via backend endpoint
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const savedToken = token || localStorage.getItem('monvian_token');
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
    await fetch('/api/auth/welcome-seen', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email })
    }).catch(() => {});
  } catch {}

  // 2. Update Firestore document
  if (email) {
    try {
      const userRef = doc(firestore, 'users', email);
      await withTimeout(
        setDoc(userRef, { welcome_card_seen: 1, updated_at: new Date().toISOString() }, { merge: true }),
        2500,
        null
      );
    } catch {}
  }

  // 3. Update Supabase table
  if (email && supabase) {
    try {
      await withTimeout(
        Promise.resolve(supabase.from('users').update({ welcome_card_seen: 1 }).eq('email', email)),
        2500,
        null
      );
    } catch {}
  }
}

/**
 * Permanently registers that the post-onboarding 3D globe cinematic intro was completed by the authenticated user.
 * Syncs to SQLite server API, Firestore, and Supabase.
 */
export async function markGlobeIntroSeen(cleanEmail: string, token?: string): Promise<void> {
  const email = (cleanEmail || '').trim().toLowerCase();
  if (!email && !token) return;

  // 1. Update SQLite via backend endpoint
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const savedToken = token || localStorage.getItem('monvian_token');
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
    await fetch('/api/auth/globe-intro-seen', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email })
    }).catch(() => {});
  } catch {}

  // 2. Update Firestore document
  if (email) {
    try {
      const userRef = doc(firestore, 'users', email);
      await withTimeout(
        setDoc(userRef, { globe_intro_seen: 1, updated_at: new Date().toISOString() }, { merge: true }),
        2500,
        null
      );
    } catch {}
  }

  // 3. Update Supabase table
  if (email && supabase) {
    try {
      await withTimeout(
        Promise.resolve(supabase.from('users').update({ globe_intro_seen: 1 }).eq('email', email)),
        2500,
        null
      );
    } catch {}
  }
}

/**
 * Persists the interactive map onboarding tutorial status ('completed' | 'skipped')
 * strictly bound to the authenticated user across SQLite API, Cloud Firestore, and Supabase.
 */
export async function updateMapTutorialStatusInDb(
  status: 'completed' | 'skipped',
  cleanEmail?: string,
  token?: string
): Promise<any | null> {
  const email = (cleanEmail || '').trim().toLowerCase();
  const nextStatus: 'completed' | 'skipped' = status === 'skipped' ? 'skipped' : 'completed';
  const nowIso = new Date().toISOString();
  let updatedServerUser: any = null;

  // 1. Update authoritative backend SQLite + session-authenticated user record
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const savedToken =
      token ||
      (typeof window !== 'undefined' ? window.localStorage?.getItem('monvian_token') : null);
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
    const resp = await fetch('/api/user/map-tutorial', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ status: nextStatus }),
    });
    if (resp.ok) {
      const json = await resp.json().catch(() => null);
      if (json?.user) {
        updatedServerUser = json.user;
      }
    }
  } catch {}

  // 2. Update Firestore document scoped to user email
  if (email) {
    try {
      const userRef = doc(firestore, 'users', email);
      await withTimeout(
        setDoc(
          userRef,
          {
            map_tutorial_status: nextStatus,
            map_tutorial_updated_at: nowIso,
            updated_at: nowIso,
          },
          { merge: true }
        ),
        2500,
        null
      );
    } catch {}
  }

  // 3. Best-effort Supabase table update scoped to user email
  if (email && supabase) {
    try {
      await withTimeout(
        Promise.resolve(
          supabase
            .from('users')
            .update({ map_tutorial_status: nextStatus, map_tutorial_updated_at: nowIso })
            .eq('email', email)
        ),
        2500,
        null
      );
    } catch {}
  }

  return updatedServerUser;
}

/**
 * Permanently saves Location and Motion/Orientation permissions in:
 * 1. LocalStorage + Long-lived Browser Cookie
 * 2. Cloud Firestore (users/{email}, user_permissions/{email}, and user_permissions/global_device)
 * 3. Backend SQLite / Supabase Database (/api/user/permissions)
 */
export async function saveUserPermissionsToDatabase(params: {
  locationGranted?: boolean;
  motionGranted?: boolean;
  coords?: [number, number];
  email?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const savedUserRaw = localStorage.getItem('monvian_user');
    const savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : {};
    const cleanEmail = (params.email || savedUser?.email || savedUser?.whatsapp || '').trim().toLowerCase();

    if (params.locationGranted) {
      localStorage.setItem('monvian_location_permission_granted', 'true');
      localStorage.setItem('monvian_location_perm', 'true');
      document.cookie = 'monvian_location_granted=true; max-age=315360000; path=/; SameSite=Lax';
      savedUser.location_permission_granted = 1;
    }

    if (params.motionGranted) {
      localStorage.setItem('monvian_motion_permission_granted', 'true');
      localStorage.setItem('monvian_compass_permission_handled', 'true');
      document.cookie = 'monvian_motion_granted=true; max-age=315360000; path=/; SameSite=Lax';
      savedUser.motion_permission_granted = 1;
    }

    if (params.coords && Array.isArray(params.coords) && params.coords.length === 2) {
      localStorage.setItem('monvian_last_coords', JSON.stringify(params.coords));
    }

    const token = localStorage.getItem('monvian_token');
    if (savedUserRaw && token) {
      localStorage.setItem('monvian_user', JSON.stringify(savedUser));
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cleanEmail) headers['x-user-email'] = cleanEmail;

    fetch('/api/user/permissions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: cleanEmail,
        locationGranted: params.locationGranted,
        motionGranted: params.motionGranted,
        coords: params.coords,
      }),
    }).catch(() => {});

    const permPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (params.locationGranted) permPayload.location_permission_granted = 1;
    if (params.motionGranted) permPayload.motion_permission_granted = 1;
    if (params.coords && Array.isArray(params.coords) && params.coords.length === 2) {
      permPayload.last_lng = params.coords[0];
      permPayload.last_lat = params.coords[1];
    }

    if (cleanEmail) {
      await withTimeout(setDoc(doc(firestore, 'user_permissions', cleanEmail), permPayload, { merge: true }), 2500, null);
      await withTimeout(setDoc(doc(firestore, 'users', cleanEmail), permPayload, { merge: true }), 2500, null);
    }
  } catch {}
}

let inFlightPermSync: Promise<{
  locationGranted: boolean;
  motionGranted: boolean;
  coords?: [number, number] | null;
}> | null = null;

/**
 * Loads and restores saved permissions from the database (Backend SQLite + Cloud Firestore)
 * strictly for the currently authenticated user account.
 */
export async function syncPermissionsFromDatabase(email?: string): Promise<{
  locationGranted: boolean;
  motionGranted: boolean;
  coords?: [number, number] | null;
}> {
  if (typeof window === 'undefined') {
    return { locationGranted: false, motionGranted: false, coords: null };
  }

  if (inFlightPermSync && !email) {
    return inFlightPermSync;
  }

  const runSync = async () => {
    let locationGranted = false;
    let motionGranted = false;
    let coords: [number, number] | null = null;

    try {
      const savedUserRaw = localStorage.getItem('monvian_user');
      const savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : {};
      const cleanEmail = (email || savedUser?.email || savedUser?.whatsapp || '').trim().toLowerCase();

      if (savedUser?.location_permission_granted === 1) locationGranted = true;
      if (savedUser?.motion_permission_granted === 1) motionGranted = true;

      if (cleanEmail) {
        const token = localStorage.getItem('monvian_token');
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        // 1. Check backend SQLite database for this user
        const res = await withTimeout(
          fetch(`/api/user/permissions?email=${encodeURIComponent(cleanEmail)}`, { headers }),
          2000,
          null as any
        );
        if (res && res.ok) {
          const data = await res.json();
          if (data.location_permission_granted === 1) locationGranted = true;
          if (data.motion_permission_granted === 1) motionGranted = true;
          if (Array.isArray(data.coords) && data.coords.length === 2) {
            coords = [Number(data.coords[0]), Number(data.coords[1])];
          }
        }

        // 2. Check Cloud Firestore strictly for this user's email
        const permSnap = await withTimeout(getDoc(doc(firestore, 'user_permissions', cleanEmail)), 2000, null as any);
        if (permSnap && permSnap.exists()) {
          const pData = permSnap.data();
          if (pData?.location_permission_granted === 1) locationGranted = true;
          if (pData?.motion_permission_granted === 1) motionGranted = true;
          if (typeof pData?.last_lng === 'number' && typeof pData?.last_lat === 'number') {
            coords = [pData.last_lng, pData.last_lat];
          }
        }

        const userSnap = await withTimeout(getDoc(doc(firestore, 'users', cleanEmail)), 2000, null as any);
        if (userSnap && userSnap.exists()) {
          const uData = userSnap.data();
          if (uData?.location_permission_granted === 1) locationGranted = true;
          if (uData?.motion_permission_granted === 1) motionGranted = true;
        }
      }

      // Sync back to local storage & cookies if granted in DB
      if (locationGranted) {
        localStorage.setItem('monvian_location_permission_granted', 'true');
        localStorage.setItem('monvian_location_perm', 'true');
        document.cookie = 'monvian_location_granted=true; max-age=315360000; path=/; SameSite=Lax';
        savedUser.location_permission_granted = 1;
      }
      if (motionGranted) {
        localStorage.setItem('monvian_motion_permission_granted', 'true');
        localStorage.setItem('monvian_compass_permission_handled', 'true');
        document.cookie = 'monvian_motion_granted=true; max-age=315360000; path=/; SameSite=Lax';
        savedUser.motion_permission_granted = 1;
      }
      if (coords) {
        localStorage.setItem('monvian_last_coords', JSON.stringify(coords));
      }
      if (savedUserRaw && localStorage.getItem('monvian_token') && (locationGranted || motionGranted)) {
        localStorage.setItem('monvian_user', JSON.stringify(savedUser));
      }
    } catch {}

    return { locationGranted, motionGranted, coords };
  };

  const p = runSync().finally(() => {
    inFlightPermSync = null;
  });
  if (!email) inFlightPermSync = p;
  return p;
}

export async function getUserFromFirestore(email: string): Promise<FirestoreUser | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  if (supabase) {
    try {
      const res: any = await withTimeout(
        Promise.resolve(
          supabase
            .from('users')
            .select('*')
            .or(`email.ilike.${cleanEmail},username_normalized.eq.${cleanEmail},whatsapp.ilike.${cleanEmail}`)
            .limit(1)
            .maybeSingle()
        ),
        2500,
        null
      );
      if (res?.data) {
        return res.data as FirestoreUser;
      }
    } catch {}
  }

  try {
    const userRef = doc(firestore, 'users', cleanEmail);
    const snap = await withTimeout(getDoc(userRef), 2500, null as any);
    if (snap && snap.exists && snap.exists()) {
      return snap.data() as FirestoreUser;
    }
  } catch (err: any) {}
  return null;
}

export async function persistSessionToFirestore(token: string, userId: number, email: string): Promise<void> {
  if (!token) return;
  try {
    const sessionRef = doc(firestore, 'sessions', token);
    await withTimeout(setDoc(sessionRef, {
      token,
      user_id: userId,
      user_email: (email || '').trim().toLowerCase(),
      created_at: new Date().toISOString()
    }), 2500, null);
  } catch (err: any) {}
}

export async function getSessionFromFirestore(token: string): Promise<FirestoreSession | null> {
  if (!token) return null;
  try {
    const sessionRef = doc(firestore, 'sessions', token);
    const snap = await withTimeout(getDoc(sessionRef), 2500, null as any);
    if (snap && snap.exists && snap.exists()) {
      return snap.data() as FirestoreSession;
    }
  } catch (err: any) {}
  return null;
}

export async function deleteSessionFromFirestore(token: string): Promise<void> {
  if (!token) return;
  try {
    const sessionRef = doc(firestore, 'sessions', token);
    await withTimeout(deleteDoc(sessionRef), 2500, null);
  } catch (err: any) {}
}

// ----------------------------------------------------
// SPOTS PERSISTENCE
// ----------------------------------------------------

export async function persistSpotToFirestore(spot: FirestoreSpot | any): Promise<void> {
  if (!spot?.id) return;
  if (supabase) {
    try {
      await withTimeout(
        Promise.resolve(
          supabase.from('spots').upsert(
            {
              id: String(spot.id),
              name: String(spot.name || ''),
              short_name: spot.short_name || spot.shortName || spot.name || '',
              tag_label: spot.tag_label || spot.tagLabel || spot.name || '',
              category: spot.category || 'attractions',
              category_label: spot.category_label || spot.categoryLabel || spot.category || 'Atrações',
              lat: Number(spot.lat ?? -22.7192),
              lng: Number(spot.lng ?? -45.5673),
              image: spot.image || '',
              gallery: typeof spot.gallery === 'string' ? spot.gallery : JSON.stringify(spot.gallery || []),
              description: spot.description || '',
              tourist_tip: spot.tourist_tip || spot.touristTip || '',
              rating: Number(spot.rating ?? 4.8),
              review_count: Number(spot.review_count ?? spot.reviewCount ?? 100),
              hours: spot.hours || '',
              address: spot.address || 'Campos do Jordão, SP',
              price_range: spot.price_range || spot.priceRange || '$$',
              maps_url: spot.maps_url || spot.mapsUrl || '',
              is_active: spot.is_active !== undefined ? Number(spot.is_active) : spot.isActive === false ? 0 : 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
        ),
        3000,
        null
      );
    } catch {}
  }
  try {
    const spotRef = doc(firestore, 'spots', spot.id);
    await withTimeout(setDoc(spotRef, {
      ...spot,
      updated_at: new Date().toISOString()
    }, { merge: true }), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to persist spot:', spot.id, err?.message);
  }
}

export async function deleteSpotFromFirestore(spotId: string): Promise<void> {
  if (!spotId) return;
  if (supabase) {
    try {
      await withTimeout(Promise.resolve(supabase.from('spots').delete().eq('id', spotId)), 3000, null);
    } catch {}
  }
  try {
    const spotRef = doc(firestore, 'spots', spotId);
    await withTimeout(deleteDoc(spotRef), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to delete spot from Firestore:', spotId, err?.message);
  }
}

export async function fetchCloudSpots(): Promise<any[]> {
  if (supabase) {
    try {
      const res: any = await withTimeout(
        Promise.resolve(supabase.from('spots').select('*').order('name', { ascending: true })),
        3500,
        null
      );
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {}
  }
  try {
    const spotsSnap = await withTimeout(getDocs(collection(firestore, 'spots')), 3500, null as any);
    if (!spotsSnap || spotsSnap.empty) return [];
    return spotsSnap.docs.map((d: any) => d.data());
  } catch {
    return [];
  }
}

// ----------------------------------------------------
// MAP VISUAL ICONS PERSISTENCE
// ----------------------------------------------------

export async function persistMapVisualIconToFirestore(icon: FirestoreMapVisualIcon | any): Promise<void> {
  if (!icon?.id) return;
  if (supabase) {
    try {
      await withTimeout(
        Promise.resolve(
          supabase.from('map_visual_icons').upsert(
            {
              id: String(icon.id),
              category: String(icon.category),
              icon: String(icon.icon || icon.category),
              latitude: Number(icon.latitude),
              longitude: Number(icon.longitude),
              color: icon.color || null,
              is_active: icon.is_active !== undefined ? Number(icon.is_active) : 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
        ),
        3000,
        null
      );
    } catch {}
  }
  try {
    const iconRef = doc(firestore, 'map_visual_icons', icon.id);
    await withTimeout(setDoc(iconRef, {
      ...icon,
      updated_at: new Date().toISOString()
    }, { merge: true }), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to persist visual icon:', icon.id, err?.message);
  }
}

export async function deleteMapVisualIconFromFirestore(iconId: string): Promise<void> {
  if (!iconId) return;
  if (supabase) {
    try {
      await withTimeout(Promise.resolve(supabase.from('map_visual_icons').delete().eq('id', iconId)), 3000, null);
    } catch {}
  }
  try {
    const iconRef = doc(firestore, 'map_visual_icons', iconId);
    await withTimeout(deleteDoc(iconRef), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to delete visual icon from Firestore:', iconId, err?.message);
  }
}

export async function fetchCloudMapVisualIcons(): Promise<any[]> {
  if (supabase) {
    try {
      const res: any = await withTimeout(
        Promise.resolve(supabase.from('map_visual_icons').select('*')),
        3500,
        null
      );
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {}
  }
  try {
    const snap = await withTimeout(getDocs(collection(firestore, 'map_visual_icons')), 3500, null as any);
    if (!snap || snap.empty) return [];
    return snap.docs.map((d: any) => d.data());
  } catch {
    return [];
  }
}

// ----------------------------------------------------
// SYSTEM SETTINGS PERSISTENCE
// ----------------------------------------------------

export async function persistSystemSettingToFirestore(key: string, value: string): Promise<void> {
  if (!key) return;
  if (supabase) {
    try {
      await withTimeout(
        Promise.resolve(
          supabase.from('system_settings').upsert(
            { key, value: String(value), updated_at: new Date().toISOString() },
            { onConflict: 'key' }
          )
        ),
        2500,
        null
      );
    } catch {}
  }
  try {
    const settingRef = doc(firestore, 'system_settings', key);
    await withTimeout(setDoc(settingRef, {
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }, { merge: true }), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to persist system setting:', key, err?.message);
  }
}

// ----------------------------------------------------
// EVENTS PERSISTENCE
// ----------------------------------------------------

export async function persistEventToFirestore(event: FirestoreEvent): Promise<void> {
  if (!event.id) return;
  if (supabase) {
    try {
      await withTimeout(
        Promise.resolve(
          supabase.from('events').upsert(
            {
              id: event.id,
              name: event.name,
              description: event.description || '',
              image: event.image || '',
              category: event.category || 'Música & Cultura',
              date: event.date || '',
              time: event.time || '',
              address: event.address || 'Campos do Jordão, SP',
              lat: Number(event.lat ?? -22.7192),
              lng: Number(event.lng ?? -45.5673),
              status: event.status || 'active',
              highlighted: event.highlighted ? 1 : 0,
            },
            { onConflict: 'id' }
          )
        ),
        2500,
        null
      );
    } catch {}
  }
  try {
    const eventRef = doc(firestore, 'events', event.id);
    await withTimeout(setDoc(eventRef, {
      ...event,
      updated_at: new Date().toISOString()
    }, { merge: true }), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to persist event:', event.id, err?.message);
  }
}

export async function deleteEventFromFirestore(eventId: string): Promise<void> {
  if (!eventId) return;
  if (supabase) {
    try {
      await withTimeout(Promise.resolve(supabase.from('events').delete().eq('id', eventId)), 2500, null);
    } catch {}
  }
  try {
    const eventRef = doc(firestore, 'events', eventId);
    await withTimeout(deleteDoc(eventRef), 3000, null);
  } catch (err: any) {}
}

// ----------------------------------------------------
// FULL BIDIRECTIONAL REPLICATION ON SERVER BOOT
// ----------------------------------------------------

const PRIMARY_ADMIN_EMAILS = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'];

export function isPrimaryAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return PRIMARY_ADMIN_EMAILS.includes(clean);
}

/**
 * Sanitizes any value into a valid SQLite3 binding (number, string, bigint, Buffer, or null).
 * Prevents "TypeError: SQLite3 can only bind numbers, strings, bigints, buffers, and null"
 * caused by booleans, undefined values, Firestore Timestamp objects, or complex structures.
 */
function toSqliteParam(val: any): string | number | bigint | Buffer | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') return val;
  if (typeof val === 'bigint') return val;
  if (Buffer.isBuffer(val)) return val;
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000).toISOString();
    }
    try {
      return JSON.stringify(val);
    } catch {
      return null;
    }
  }
  return String(val);
}

export async function syncDatabaseWithFirestore(sqliteDb: any): Promise<void> {
  console.log('[FirestoreSync] Starting durable sync: Cloud Firestore is the absolute authority...');
  
  try {
    // ----------------------------------------------------
    // 1. SYSTEM SETTINGS (Read from Cloud Firestore first!)
    // ----------------------------------------------------
    try {
      const defaultSettings: Record<string, string> = {
        community_url: 'https://chat.whatsapp.com/invite/monvian-campos',
        instagram_url: 'https://instagram.com/monvian.campos',
        support_phone: '+55 12 99123-4567',
        app_name: 'Monvian - Campos do Jordão',
        maintenance_mode: '0',
        map_center_lat: '-22.7290',
        map_center_lng: '-45.5830',
        map_zoom: '11.75',
        map_pitch: '52',
        map_bearing: '-13',
        map_default_mode: 'explorar'
      };

      const settingsSnap = await withTimeout(getDocs(collection(firestore, 'system_settings')), 5000, null as any);
      const foundCloudKeys = new Set<string>();

      const upsertSetting = sqliteDb.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');

      if (settingsSnap && !settingsSnap.empty) {
        settingsSnap.forEach((docSnap: any) => {
          const data = docSnap.data();
          if (data && data.key && data.key !== '_health') {
            foundCloudKeys.add(data.key);
            upsertSetting.run(String(data.key), String(data.value ?? ''));
          }
        });
      }

      // Fill in any missing default settings that were never written to Firestore
      for (const [key, value] of Object.entries(defaultSettings)) {
        if (!foundCloudKeys.has(key)) {
          const existingLocal = sqliteDb.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
          const finalVal = existingLocal ? String(existingLocal.value) : value;
          upsertSetting.run(key, finalVal);
          await persistSystemSettingToFirestore(key, finalVal);
        }
      }
    } catch (e) {
      console.warn('[FirestoreSync] Settings sync notice:', e);
    }

    // ----------------------------------------------------
    // 2. MAP VISUAL ICONS (Firmly anchored to GPS, Firestore Authority)
    // ----------------------------------------------------
    try {
      try { sqliteDb.exec(`ALTER TABLE map_visual_icons ADD COLUMN icon TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE map_visual_icons ADD COLUMN color TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE map_visual_icons ADD COLUMN is_active INTEGER DEFAULT 1;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE map_visual_icons ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE map_visual_icons ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}

      const iconsSnap = await withTimeout(getDocs(collection(firestore, 'map_visual_icons')), 6000, null as any);
      const upsertIcon = sqliteDb.prepare(`
        INSERT INTO map_visual_icons (id, category, icon, latitude, longitude, color, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          icon = excluded.icon,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          color = excluded.color,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `);

      if (iconsSnap && !iconsSnap.empty) {
        console.log(`[FirestoreSync] Restoring ${iconsSnap.size} map visual icons from Cloud Firestore...`);
        const validIconIds = new Set<string>();

        iconsSnap.forEach((docSnap: any) => {
          const icon = docSnap.data() as FirestoreMapVisualIcon;
          if (icon && icon.id && icon.category && !isNaN(Number(icon.latitude)) && !isNaN(Number(icon.longitude))) {
            validIconIds.add(icon.id);
            upsertIcon.run(
              toSqliteParam(icon.id),
              toSqliteParam(icon.category),
              toSqliteParam(icon.icon || icon.category),
              Number(icon.latitude),
              Number(icon.longitude),
              toSqliteParam(icon.color || null),
              icon.is_active !== undefined ? (icon.is_active ? 1 : 0) : 1,
              toSqliteParam(icon.created_at || new Date().toISOString()),
              toSqliteParam(icon.updated_at || new Date().toISOString())
            );
          }
        });

        // Delete any local SQLite visual icons that were removed by the admin
        const localIcons = sqliteDb.prepare('SELECT id FROM map_visual_icons').all() as { id: string }[];
        for (const local of localIcons) {
          if (!validIconIds.has(local.id)) {
            sqliteDb.prepare('DELETE FROM map_visual_icons WHERE id = ?').run(local.id);
          }
        }
      }
    } catch (e) {
      console.warn('[FirestoreSync] Map visual icons sync notice:', e);
    }

    // ----------------------------------------------------
    // 3. SPOTS (Tourist Spots / Points of Interest - Firestore Authority)
    // ----------------------------------------------------
    try {
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN popular_times TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN visitors_today INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN badge TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN highlighted INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN is_verified INTEGER DEFAULT 1;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN website TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN phone TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN short_name TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN tag_label TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN category_label TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN price_range TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN price TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN available_for_itinerary INTEGER DEFAULT 1;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN duration_minutes INTEGER DEFAULT 90;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN tags TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN maps_url TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE spots ADD COLUMN is_active INTEGER DEFAULT 1;`); } catch (e) {}

      const spotsSnap = await withTimeout(getDocs(collection(firestore, 'spots')), 7000, null as any);
      
      const upsertSpot = sqliteDb.prepare(`
        INSERT INTO spots (
          id, name, short_name, tag_label, category, category_label,
          lat, lng, image, gallery, description, tourist_tip,
          rating, review_count, hours, address, price_range,
          popular_times, visitors_today, badge, highlighted, is_active, is_verified,
          website, phone, maps_url, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          short_name = excluded.short_name,
          tag_label = excluded.tag_label,
          category = excluded.category,
          category_label = excluded.category_label,
          lat = excluded.lat,
          lng = excluded.lng,
          image = excluded.image,
          gallery = excluded.gallery,
          description = excluded.description,
          tourist_tip = excluded.tourist_tip,
          rating = excluded.rating,
          review_count = excluded.review_count,
          hours = excluded.hours,
          address = excluded.address,
          price_range = excluded.price_range,
          popular_times = excluded.popular_times,
          visitors_today = excluded.visitors_today,
          badge = excluded.badge,
          highlighted = excluded.highlighted,
          is_active = excluded.is_active,
          is_verified = excluded.is_verified,
          website = excluded.website,
          phone = excluded.phone,
          maps_url = excluded.maps_url,
          updated_at = excluded.updated_at
      `);

      if (spotsSnap && !spotsSnap.empty) {
        console.log(`[FirestoreSync] Restoring ${spotsSnap.size} spots from Cloud Firestore...`);
        const validSpotIds = new Set<string>();

        spotsSnap.forEach((docSnap: any) => {
          const s = docSnap.data() as FirestoreSpot;
          if (s && s.id && s.name && !isNaN(Number(s.lat)) && !isNaN(Number(s.lng))) {
            validSpotIds.add(s.id);
            upsertSpot.run(
              toSqliteParam(s.id),
              toSqliteParam(s.name),
              toSqliteParam(s.short_name || s.name),
              toSqliteParam(s.tag_label || s.name),
              toSqliteParam(s.category || 'culture'),
              toSqliteParam(s.category_label || s.category),
              Number(s.lat),
              Number(s.lng),
              toSqliteParam(s.image || ''),
              toSqliteParam(typeof s.gallery === 'string' ? s.gallery : JSON.stringify(s.gallery || [])),
              toSqliteParam(s.description || ''),
              toSqliteParam(s.tourist_tip || ''),
              Number(s.rating || 4.5),
              Number(s.review_count || 0),
              toSqliteParam(s.hours || ''),
              toSqliteParam(s.address || ''),
              toSqliteParam(s.price_range || '$$'),
              toSqliteParam(typeof s.popular_times === 'object' ? JSON.stringify(s.popular_times) : (s.popular_times || '')),
              Number(s.visitors_today || 0),
              toSqliteParam(s.badge || ''),
              Number(s.highlighted || 0),
              Number(s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1),
              Number(s.is_verified !== undefined ? (s.is_verified ? 1 : 0) : 1),
              toSqliteParam(s.website || ''),
              toSqliteParam(s.phone || ''),
              toSqliteParam(s.maps_url || ''),
              toSqliteParam(s.created_at || new Date().toISOString()),
              toSqliteParam(s.updated_at || new Date().toISOString())
            );
          }
        });

        // Delete any local SQLite spots that were deleted by the admin or stale seed pins
        const localSpots = sqliteDb.prepare('SELECT id FROM spots').all() as { id: string }[];
        for (const local of localSpots) {
          if (!validSpotIds.has(local.id)) {
            sqliteDb.prepare('DELETE FROM spots WHERE id = ?').run(local.id);
          }
        }
      } else {
        // If Firestore had no spots yet, seed from SQLite and store permanently in Cloud Firestore
        const localSpots = sqliteDb.prepare('SELECT * FROM spots').all();
        for (const spot of localSpots) {
          if (spot.id) {
            await persistSpotToFirestore({
              id: spot.id,
              name: spot.name,
              short_name: spot.short_name,
              tag_label: spot.tag_label,
              category: spot.category,
              category_label: spot.category_label,
              lat: Number(spot.lat),
              lng: Number(spot.lng),
              image: spot.image,
              gallery: spot.gallery,
              description: spot.description,
              tourist_tip: spot.tourist_tip,
              rating: Number(spot.rating || 4.5),
              review_count: Number(spot.review_count || 0),
              hours: spot.hours,
              address: spot.address,
              price_range: spot.price_range,
              popular_times: spot.popular_times,
              visitors_today: Number(spot.visitors_today || 0),
              badge: spot.badge,
              highlighted: Number(spot.highlighted || 0),
              is_active: Number(spot.is_active !== undefined ? spot.is_active : 1),
              is_verified: Number(spot.is_verified !== undefined ? spot.is_verified : 1),
              website: spot.website,
              phone: spot.phone,
              maps_url: spot.maps_url,
              created_at: spot.created_at,
              updated_at: spot.updated_at
            });
          }
        }
      }
    } catch (e) {
      console.warn('[FirestoreSync] Spots sync notice:', e);
    }

    // ----------------------------------------------------
    // 4. EVENTS (Firestore Authority)
    // ----------------------------------------------------
    try {
      const eventsSnap = await withTimeout(getDocs(collection(firestore, 'events')), 5000, null as any);
      if (eventsSnap && !eventsSnap.empty) {
        const validEventIds = new Set<string>();
        const upsertEvent = sqliteDb.prepare(`
          INSERT INTO events (id, name, description, image, category, date, time, address, lat, lng, status, highlighted, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            image = excluded.image,
            category = excluded.category,
            date = excluded.date,
            time = excluded.time,
            address = excluded.address,
            lat = excluded.lat,
            lng = excluded.lng,
            status = excluded.status,
            highlighted = excluded.highlighted
        `);

        eventsSnap.forEach((docSnap: any) => {
          const ev = docSnap.data() as FirestoreEvent;
          if (ev && ev.id && ev.name) {
            validEventIds.add(ev.id);
            upsertEvent.run(
              toSqliteParam(ev.id),
              toSqliteParam(ev.name),
              toSqliteParam(ev.description || ''),
              toSqliteParam(ev.image || ''),
              toSqliteParam(ev.category || 'Geral'),
              toSqliteParam(ev.date || ''),
              toSqliteParam(ev.time || ''),
              toSqliteParam(ev.address || ''),
              Number(ev.lat || -22.7290),
              Number(ev.lng || -45.5830),
              toSqliteParam(ev.status || 'active'),
              ev.highlighted ? 1 : 0,
              toSqliteParam(ev.created_at || new Date().toISOString())
            );
          }
        });

        // Delete any local events not in Firestore
        const localEvents = sqliteDb.prepare('SELECT id FROM events').all() as { id: string }[];
        for (const local of localEvents) {
          if (!validEventIds.has(local.id)) {
            sqliteDb.prepare('DELETE FROM events WHERE id = ?').run(local.id);
          }
        }
      }
    } catch (e) {
      console.warn('[FirestoreSync] Events sync notice:', e);
    }

    // ----------------------------------------------------
    // 5. USERS (Profiles, credentials, roles)
    // ----------------------------------------------------
    try {
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN username_normalized TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN username TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN visits_count INTEGER DEFAULT 1;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN snow_enabled INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN rain_enabled INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN high_contrast INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 1;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 1;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN location_permission_granted INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN motion_permission_granted INTEGER DEFAULT 0;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN last_access DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN auth_id TEXT;`); } catch (e) {}
      try {
        sqliteDb.exec(`
          UPDATE users 
          SET username_normalized = LOWER(REPLACE(COALESCE(username, name, email, 'user'), ' ', ''))
          WHERE username_normalized IS NULL OR username_normalized = '';
        `);
      } catch (e) {}

      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN campos_relationship TEXT DEFAULT '';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN next_trip_timing TEXT DEFAULT '';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN next_trip_date TEXT DEFAULT '';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN interest_categories TEXT DEFAULT '[]';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN travel_company TEXT DEFAULT '';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN location_preference TEXT DEFAULT '';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN map_tutorial_status TEXT DEFAULT 'completed';`); } catch (e) {}
      try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN map_tutorial_updated_at DATETIME;`); } catch (e) {}
      try {
        sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS user_onboarding (
            user_email TEXT PRIMARY KEY,
            user_id TEXT,
            campos_relationship TEXT DEFAULT '',
            next_trip_timing TEXT DEFAULT '',
            next_trip_date TEXT DEFAULT '',
            interest_categories TEXT DEFAULT '[]',
            travel_company TEXT DEFAULT '',
            location_preference TEXT DEFAULT '',
            location_permission_granted INTEGER DEFAULT 0,
            onboarding_step INTEGER DEFAULT 1,
            onboarding_completed INTEGER DEFAULT 0,
            completed_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } catch (e) {}

      const [usersSnap, onboardingSnap] = await Promise.all([
        withTimeout(getDocs(collection(firestore, 'users')), 5000, null as any),
        withTimeout(getDocs(collection(firestore, 'user_onboarding')), 5000, null as any),
      ]);

      const cloudObByEmail = new Map<string, any>();
      if (onboardingSnap && !onboardingSnap.empty) {
        onboardingSnap.forEach((docSnap: any) => {
          const obData = docSnap.data() || {};
          const key = String(obData.user_email || obData.email || docSnap.id || '').trim().toLowerCase();
          if (key) cloudObByEmail.set(key, obData);
        });
      }

      if (usersSnap && !usersSnap.empty) {
        usersSnap.forEach((docSnap: any) => {
          const cloudUser = docSnap.data() as FirestoreUser;
          if (!cloudUser || !cloudUser.email || !cloudUser.password_hash) return;

          const cleanEmail = String(cloudUser.email).trim().toLowerCase();
          const targetRole = isPrimaryAdmin(cleanEmail) ? 'admin' : (cloudUser.role ? String(cloudUser.role) : 'user');
          const cloudOb = cloudObByEmail.get(cleanEmail) || {};

          const mergedRelationship = String(cloudOb.campos_relationship || cloudUser.campos_relationship || '').trim();
          const mergedTiming = String(cloudOb.next_trip_timing || cloudUser.next_trip_timing || '').trim();
          const mergedTripDate = String(cloudOb.next_trip_date || cloudUser.next_trip_date || '').trim();
          const mergedCompany = String(cloudOb.travel_company || cloudUser.travel_company || '').trim();
          const mergedLocPref = String(cloudOb.location_preference || cloudUser.location_preference || '').trim();
          const mergedInterestsList = (() => {
            const fromOb = normalizeInterestList(cloudOb.interest_categories);
            if (fromOb.length > 0) return fromOb;
            return normalizeInterestList(cloudUser.interest_categories);
          })();
          const mergedInterestsJson = JSON.stringify(mergedInterestsList);

          const rawCloudTutorial = String(cloudUser.map_tutorial_status || '').trim().toLowerCase();
          const explicitCloudTutorial =
            rawCloudTutorial === 'pending' || rawCloudTutorial === 'completed' || rawCloudTutorial === 'skipped'
              ? rawCloudTutorial
              : '';
          const resolvedCloudTutorial = explicitCloudTutorial || 'completed';

          const existingUser = sqliteDb.prepare('SELECT id, name, map_tutorial_status FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail) as any;

          const normUsername = (cloudUser.username_normalized || cloudUser.username || cleanEmail.split('@')[0]).toLowerCase();

          if (!existingUser) {
            sqliteDb.prepare(`
              INSERT INTO users (
                name, username, username_normalized, email, whatsapp, password_hash, role, avatar_url,
                visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step,
                location_permission_granted, motion_permission_granted,
                campos_relationship, next_trip_timing, next_trip_date, interest_categories, travel_company, location_preference,
                map_tutorial_status, map_tutorial_updated_at,
                last_access, created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              toSqliteParam(cloudUser.name || cleanEmail.split('@')[0]),
              toSqliteParam(cloudUser.username || cleanEmail.split('@')[0]),
              toSqliteParam(normUsername),
              cleanEmail,
              toSqliteParam(cloudUser.whatsapp || cleanEmail),
              toSqliteParam(cloudUser.password_hash),
              targetRole,
              toSqliteParam(cloudUser.avatar_url || '/fotoperfil.png'),
              toSqliteParam(cloudUser.visits_count || 1),
              cloudUser.is_banned ? 1 : 0,
              cloudUser.snow_enabled ? 1 : 0,
              toSqliteParam(cloudUser.theme || 'light'),
              cloudUser.high_contrast ? 1 : 0,
              cloudUser.onboarding_completed !== undefined ? (cloudUser.onboarding_completed ? 1 : 0) : 1,
              Number(cloudOb.onboarding_step || cloudUser.onboarding_step || 1),
              cloudUser.location_permission_granted ? 1 : 0,
              cloudUser.motion_permission_granted ? 1 : 0,
              mergedRelationship,
              mergedTiming,
              mergedTripDate,
              mergedInterestsJson,
              mergedCompany,
              mergedLocPref,
              resolvedCloudTutorial,
              toSqliteParam(cloudUser.map_tutorial_updated_at || null),
              toSqliteParam(cloudUser.last_access || new Date().toISOString()),
              toSqliteParam(cloudUser.created_at || new Date().toISOString())
            );
          } else {
            const localTutorial = String(existingUser.map_tutorial_status || '').trim().toLowerCase();
            const finalTutorialStatus =
              localTutorial === 'completed' || localTutorial === 'skipped'
                ? localTutorial
                : explicitCloudTutorial === 'completed' || explicitCloudTutorial === 'skipped'
                  ? explicitCloudTutorial
                  : localTutorial === 'pending' || explicitCloudTutorial === 'pending'
                    ? 'pending'
                    : 'completed';

            sqliteDb.prepare(`
              UPDATE users 
              SET name = ?, username = COALESCE(?, username), username_normalized = COALESCE(?, username_normalized),
                  password_hash = ?, role = ?, avatar_url = ?, is_banned = ?,
                  location_permission_granted = CASE WHEN ? = 1 THEN 1 ELSE COALESCE(location_permission_granted, 0) END,
                  motion_permission_granted = CASE WHEN ? = 1 THEN 1 ELSE COALESCE(motion_permission_granted, 0) END,
                  campos_relationship = CASE WHEN ? != '' THEN ? ELSE COALESCE(campos_relationship, '') END,
                  next_trip_timing = CASE WHEN ? != '' THEN ? ELSE COALESCE(next_trip_timing, '') END,
                  next_trip_date = CASE WHEN ? != '' THEN ? ELSE COALESCE(next_trip_date, '') END,
                  interest_categories = CASE WHEN ? != '[]' THEN ? ELSE COALESCE(interest_categories, '[]') END,
                  travel_company = CASE WHEN ? != '' THEN ? ELSE COALESCE(travel_company, '') END,
                  location_preference = CASE WHEN ? != '' THEN ? ELSE COALESCE(location_preference, '') END,
                  map_tutorial_status = ?,
                  map_tutorial_updated_at = COALESCE(?, map_tutorial_updated_at)
              WHERE id = ?
            `).run(
              toSqliteParam(cloudUser.name || existingUser.name || cleanEmail.split('@')[0]),
              toSqliteParam(cloudUser.username || null),
              toSqliteParam(normUsername),
              toSqliteParam(cloudUser.password_hash),
              targetRole,
              toSqliteParam(cloudUser.avatar_url || '/fotoperfil.png'),
              cloudUser.is_banned ? 1 : 0,
              cloudUser.location_permission_granted ? 1 : 0,
              cloudUser.motion_permission_granted ? 1 : 0,
              mergedRelationship,
              mergedRelationship,
              mergedTiming,
              mergedTiming,
              mergedTripDate,
              mergedTripDate,
              mergedInterestsJson,
              mergedInterestsJson,
              mergedCompany,
              mergedCompany,
              mergedLocPref,
              mergedLocPref,
              finalTutorialStatus,
              toSqliteParam(cloudUser.map_tutorial_updated_at || null),
              existingUser.id
            );
          }
        });
      }

      // Also hydrate user_onboarding SQLite table from Firestore user_onboarding collection
      if (cloudObByEmail.size > 0) {
        const upsertObStmt = sqliteDb.prepare(`
          INSERT INTO user_onboarding (
            user_email, user_id, campos_relationship, next_trip_timing, next_trip_date,
            interest_categories, travel_company, location_preference,
            location_permission_granted, onboarding_step, onboarding_completed,
            completed_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_email) DO UPDATE SET
            campos_relationship = CASE WHEN excluded.campos_relationship != '' THEN excluded.campos_relationship ELSE user_onboarding.campos_relationship END,
            next_trip_timing = CASE WHEN excluded.next_trip_timing != '' THEN excluded.next_trip_timing ELSE user_onboarding.next_trip_timing END,
            next_trip_date = CASE WHEN excluded.next_trip_date != '' THEN excluded.next_trip_date ELSE user_onboarding.next_trip_date END,
            interest_categories = CASE WHEN excluded.interest_categories != '[]' THEN excluded.interest_categories ELSE user_onboarding.interest_categories END,
            travel_company = CASE WHEN excluded.travel_company != '' THEN excluded.travel_company ELSE user_onboarding.travel_company END,
            location_preference = CASE WHEN excluded.location_preference != '' THEN excluded.location_preference ELSE user_onboarding.location_preference END,
            onboarding_step = COALESCE(excluded.onboarding_step, user_onboarding.onboarding_step),
            onboarding_completed = CASE WHEN excluded.onboarding_completed = 1 THEN 1 ELSE user_onboarding.onboarding_completed END,
            completed_at = COALESCE(excluded.completed_at, user_onboarding.completed_at),
            updated_at = COALESCE(excluded.updated_at, user_onboarding.updated_at)
        `);
        const updateUsersFromObStmt = sqliteDb.prepare(`
          UPDATE users
          SET campos_relationship = CASE WHEN ? != '' THEN ? ELSE COALESCE(campos_relationship, '') END,
              next_trip_timing = CASE WHEN ? != '' THEN ? ELSE COALESCE(next_trip_timing, '') END,
              next_trip_date = CASE WHEN ? != '' THEN ? ELSE COALESCE(next_trip_date, '') END,
              interest_categories = CASE WHEN ? != '[]' THEN ? ELSE COALESCE(interest_categories, '[]') END,
              travel_company = CASE WHEN ? != '' THEN ? ELSE COALESCE(travel_company, '') END,
              location_preference = CASE WHEN ? != '' THEN ? ELSE COALESCE(location_preference, '') END
          WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?
        `);

        cloudObByEmail.forEach((obData, cleanEmail) => {
          try {
            const rel = String(obData.campos_relationship || '').trim();
            const timing = String(obData.next_trip_timing || '').trim();
            const tripDate = String(obData.next_trip_date || '').trim();
            const interestsJson = JSON.stringify(normalizeInterestList(obData.interest_categories));
            const company = String(obData.travel_company || '').trim();
            const locPref = String(obData.location_preference || '').trim();
            upsertObStmt.run(
              cleanEmail,
              String(obData.user_id || ''),
              rel,
              timing,
              tripDate,
              interestsJson,
              company,
              locPref,
              obData.location_permission_granted ? 1 : 0,
              Number(obData.onboarding_step || 1),
              obData.onboarding_completed ? 1 : 0,
              obData.completed_at || null,
              obData.updated_at || new Date().toISOString()
            );
            updateUsersFromObStmt.run(
              rel, rel,
              timing, timing,
              tripDate, tripDate,
              interestsJson, interestsJson,
              company, company,
              locPref, locPref,
              cleanEmail, cleanEmail
            );
          } catch {}
        });
      }

      // Enforce: empresariomario@gmail.com, marioempresario@gmail.com, and marioyesk@gmail.com are admin
      sqliteDb.prepare(`
        UPDATE users 
        SET role = CASE 
          WHEN LOWER(TRIM(COALESCE(email, ''))) IN ('empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com') 
            OR LOWER(TRIM(COALESCE(whatsapp, ''))) IN ('empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com')
            OR LOWER(TRIM(COALESCE(username, ''))) = 'marioyesk' THEN 'admin'
          ELSE role
        END
      `).run();

    } catch (e) {
      console.warn('[FirestoreSync] Users sync notice:', e);
    }

    try {
      sqliteDb.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    console.log('[FirestoreSync] Complete synchronization with Cloud Firestore finished successfully.');
  } catch (err: any) {
    console.error('[FirestoreSync] Error during database synchronization:', err?.message || err);
  }
}

export async function persistPrivacyRequestToFirestore(reqItem: {
  id: string;
  protocol: string;
  user_id?: string | number | null;
  user_email: string;
  user_name?: string;
  request_type: string;
  details?: string;
  status: string;
  created_at: string;
}): Promise<void> {
  try {
    const ref = doc(firestore, 'privacy_requests', reqItem.id);
    await withTimeout(setDoc(ref, reqItem, { merge: true }), 2500, null);
  } catch {}
}

export async function persistSupportTicketToFirestore(ticket: {
  id: string;
  protocol: string;
  user_id?: string | number | null;
  user_name: string;
  user_email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}): Promise<void> {
  try {
    const ref = doc(firestore, 'support_tickets', ticket.id);
    await withTimeout(setDoc(ref, ticket, { merge: true }), 2500, null);
  } catch {}
}

export async function persistUserFavoritesToFirestore(params: {
  email?: string;
  userId?: string | number;
  itineraries: string[];
  spots: string[];
  places: string[];
}): Promise<void> {
  const cleanEmail = String(params.email || '').trim().toLowerCase();
  const docKey = cleanEmail || (params.userId ? `uid_${params.userId}` : '');
  if (!docKey) return;

  try {
    const ref = doc(firestore, 'user_favorites', docKey);
    await withTimeout(
      setDoc(
        ref,
        {
          user_id: params.userId ? String(params.userId) : '',
          user_email: cleanEmail,
          itineraries: Array.from(new Set(params.itineraries || [])),
          spots: Array.from(new Set(params.spots || [])),
          places: Array.from(new Set(params.places || [])),
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      ),
      2500,
      null
    );
  } catch {}
}

export async function getUserFavoritesFromFirestore(
  email?: string,
  userId?: string | number
): Promise<{ itineraries: string[]; spots: string[]; places: string[] } | null> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const docKey = cleanEmail || (userId ? `uid_${userId}` : '');
  if (!docKey) return null;

  try {
    const ref = doc(firestore, 'user_favorites', docKey);
    const snap = await withTimeout(getDoc(ref), 2500, null as any);
    if (snap && snap.exists && snap.exists()) {
      const data = snap.data() || {};
      return {
        itineraries: Array.isArray(data.itineraries) ? data.itineraries : [],
        spots: Array.isArray(data.spots) ? data.spots : [],
        places: Array.isArray(data.places) ? data.places : [],
      };
    }
  } catch {}
  return null;
}

export async function deleteUserAccountFromFirestore(email: string, deletionLog?: {
  id: string;
  protocol: string;
  account_ref_hash: string;
  reason?: string;
  deleted_at: string;
  legal_basis: string;
}): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  try {
    if (cleanEmail) {
      await withTimeout(deleteDoc(doc(firestore, 'users', cleanEmail)), 2500, null);
      await withTimeout(deleteDoc(doc(firestore, 'user_onboarding', cleanEmail)), 2500, null);
      await withTimeout(deleteDoc(doc(firestore, 'user_permissions', cleanEmail)), 2500, null);
      await withTimeout(deleteDoc(doc(firestore, 'user_favorites', cleanEmail)), 2500, null);
    }
    if (deletionLog) {
      await withTimeout(
        setDoc(doc(firestore, 'account_deletion_logs', deletionLog.id), deletionLog),
        2500,
        null
      );
    }
  } catch {}
}

