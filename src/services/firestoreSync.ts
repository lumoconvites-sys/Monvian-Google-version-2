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
import firebaseConfig from '../../firebase-applet-config.json';
import { supabase } from '../lib/supabase';

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
  is_premium?: number;
  is_gold?: number;
  plan?: 'beta' | 'gold';
  gold_activated_at?: string;
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
  const isGold = isAdmin || user.is_gold === 1 || user.is_premium === 1 || user.plan === 'gold';

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
              is_premium: isGold ? 1 : 0,
              is_gold: isGold ? 1 : 0,
              plan: isGold ? 'gold' : 'beta',
              gold_activated_at: user.gold_activated_at || null,
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
      is_premium: isGold ? 1 : 0,
      is_gold: isGold ? 1 : 0,
      plan: isGold ? 'gold' : 'beta',
      gold_activated_at: user.gold_activated_at || null,
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
    if (user.id) {
      dataToSave.id = user.id;
    }

    await withTimeout(setDoc(userRef, dataToSave, { merge: true }), 2500, null);
  } catch (err: any) {
    // Fail silently in background
  }
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

    if (savedUserRaw) {
      localStorage.setItem('monvian_user', JSON.stringify(savedUser));
    }

    const token = localStorage.getItem('monvian_token');
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

    await withTimeout(setDoc(doc(firestore, 'user_permissions', 'global_device'), permPayload, { merge: true }), 2500, null);
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
 * so the user is never prompted again after permitting once.
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
    let locationGranted =
      localStorage.getItem('monvian_location_permission_granted') === 'true' ||
      document.cookie.includes('monvian_location_granted=true');
    let motionGranted =
      localStorage.getItem('monvian_motion_permission_granted') === 'true' ||
      localStorage.getItem('monvian_compass_permission_handled') === 'true' ||
      document.cookie.includes('monvian_motion_granted=true');
    let coords: [number, number] | null = null;

    try {
      const savedUserRaw = localStorage.getItem('monvian_user');
      const savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : {};
      const cleanEmail = (email || savedUser?.email || savedUser?.whatsapp || '').trim().toLowerCase();

      if (savedUser?.location_permission_granted === 1) locationGranted = true;
      if (savedUser?.motion_permission_granted === 1) motionGranted = true;

      // 1. Check backend SQLite database
      const res = await withTimeout(
        fetch(`/api/user/permissions?email=${encodeURIComponent(cleanEmail)}`),
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

      // 2. Check Cloud Firestore (both global_device and user email if available)
      const globalSnap = await withTimeout(getDoc(doc(firestore, 'user_permissions', 'global_device')), 2000, null as any);
      if (globalSnap && globalSnap.exists()) {
        const gData = globalSnap.data();
        if (gData?.location_permission_granted === 1) locationGranted = true;
        if (gData?.motion_permission_granted === 1) motionGranted = true;
        if (typeof gData?.last_lng === 'number' && typeof gData?.last_lat === 'number') {
          coords = [gData.last_lng, gData.last_lat];
        }
      }

      if (cleanEmail) {
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
      if (savedUserRaw && (locationGranted || motionGranted)) {
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
        weather_rain_mode: 'auto',
        weather_snow_mode: 'fraca',
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
            upsertSetting.run(data.key, String(data.value || ''));
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
      try { sqliteDb.exec(`ALTER TABLE map_visual_icons ADD COLUMN color TEXT;`); } catch (e) {}

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
          if (icon && icon.id && icon.category && !isNaN(icon.latitude) && !isNaN(icon.longitude)) {
            validIconIds.add(icon.id);
            upsertIcon.run(
              icon.id,
              icon.category,
              icon.icon || icon.category,
              Number(icon.latitude),
              Number(icon.longitude),
              icon.color || null,
              icon.is_active !== undefined ? Number(icon.is_active) : 1,
              icon.created_at || new Date().toISOString(),
              icon.updated_at || new Date().toISOString()
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
          if (s && s.id && s.name && !isNaN(s.lat) && !isNaN(s.lng)) {
            validSpotIds.add(s.id);
            upsertSpot.run(
              s.id,
              s.name,
              s.short_name || s.name,
              s.tag_label || s.name,
              s.category || 'culture',
              s.category_label || s.category,
              Number(s.lat),
              Number(s.lng),
              s.image || '',
              s.gallery || '[]',
              s.description || '',
              s.tourist_tip || '',
              Number(s.rating || 4.5),
              Number(s.review_count || 0),
              s.hours || '',
              s.address || '',
              s.price_range || '$$',
              s.popular_times || '',
              Number(s.visitors_today || 0),
              s.badge || '',
              Number(s.highlighted || 0),
              Number(s.is_active !== undefined ? s.is_active : 1),
              Number(s.is_verified !== undefined ? s.is_verified : 1),
              s.website || '',
              s.phone || '',
              s.maps_url || '',
              s.created_at || new Date().toISOString(),
              s.updated_at || new Date().toISOString()
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
              ev.id,
              ev.name,
              ev.description || '',
              ev.image || '',
              ev.category || 'Geral',
              ev.date || '',
              ev.time || '',
              ev.address || '',
              Number(ev.lat || -22.7290),
              Number(ev.lng || -45.5830),
              ev.status || 'active',
              ev.highlighted ? 1 : 0,
              ev.created_at || new Date().toISOString()
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
      const usersSnap = await withTimeout(getDocs(collection(firestore, 'users')), 5000, null as any);
      if (usersSnap && !usersSnap.empty) {
        usersSnap.forEach((docSnap: any) => {
          const cloudUser = docSnap.data() as FirestoreUser;
          if (!cloudUser.email || !cloudUser.password_hash) return;

          const cleanEmail = cloudUser.email.trim().toLowerCase();
          const targetRole = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';

          const existingUser = sqliteDb.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);

          const isGold = isPrimaryAdmin(cleanEmail) || cloudUser.is_gold === 1 || cloudUser.plan === 'gold';
          const plan = isGold ? 'gold' : (cloudUser.plan || 'beta');

          if (!existingUser) {
            sqliteDb.prepare(`
              INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, is_premium, is_gold, plan, gold_activated_at, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, location_permission_granted, motion_permission_granted, last_access, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              cloudUser.name || cleanEmail.split('@')[0],
              cleanEmail,
              cloudUser.whatsapp || cleanEmail,
              cloudUser.password_hash,
              targetRole,
              cloudUser.avatar_url || '/fotoperfil.png',
              cloudUser.visits_count || 1,
              cloudUser.is_banned || 0,
              isGold ? 1 : 0,
              isGold ? 1 : 0,
              plan,
              cloudUser.gold_activated_at || null,
              cloudUser.snow_enabled || 0,
              cloudUser.theme || 'light',
              cloudUser.high_contrast || 0,
              cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
              cloudUser.onboarding_step || 1,
              cloudUser.location_permission_granted ? 1 : 0,
              cloudUser.motion_permission_granted ? 1 : 0,
              cloudUser.last_access || new Date().toISOString(),
              cloudUser.created_at || new Date().toISOString()
            );
          } else {
            sqliteDb.prepare(`
              UPDATE users 
              SET name = ?, password_hash = ?, role = ?, avatar_url = ?, is_banned = ?,
                  is_premium = CASE WHEN ? = 1 THEN 1 ELSE is_premium END,
                  is_gold = CASE WHEN ? = 1 THEN 1 ELSE is_gold END,
                  plan = CASE WHEN ? = 'gold' THEN 'gold' ELSE plan END,
                  gold_activated_at = COALESCE(gold_activated_at, ?),
                  location_permission_granted = CASE WHEN ? = 1 THEN 1 ELSE COALESCE(location_permission_granted, 0) END,
                  motion_permission_granted = CASE WHEN ? = 1 THEN 1 ELSE COALESCE(motion_permission_granted, 0) END
              WHERE id = ?
            `).run(
              cloudUser.name,
              cloudUser.password_hash,
              targetRole,
              cloudUser.avatar_url || '/fotoperfil.png',
              cloudUser.is_banned || 0,
              isGold ? 1 : 0,
              isGold ? 1 : 0,
              plan,
              cloudUser.gold_activated_at || null,
              cloudUser.location_permission_granted ? 1 : 0,
              cloudUser.motion_permission_granted ? 1 : 0,
              existingUser.id
            );
          }
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
        END,
        is_gold = CASE
          WHEN LOWER(TRIM(COALESCE(email, ''))) IN ('empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com') 
            OR LOWER(TRIM(COALESCE(whatsapp, ''))) IN ('empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com')
            OR LOWER(TRIM(COALESCE(username, ''))) = 'marioyesk' THEN 1
          ELSE is_gold
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
