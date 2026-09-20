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
  email: string;
  whatsapp?: string;
  password_hash: string;
  role: string;
  avatar_url?: string;
  visits_count?: number;
  is_banned?: number;
  snow_enabled?: number;
  theme?: string;
  high_contrast?: number;
  onboarding_completed?: number;
  onboarding_step?: number;
  last_access?: string;
  created_at?: string;
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
  
  try {
    const userRef = doc(firestore, 'users', cleanEmail);
    const dataToSave: any = {
      name: user.name || '',
      email: cleanEmail,
      whatsapp: user.whatsapp || cleanEmail,
      password_hash: user.password_hash,
      role: user.role || 'user',
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
    if (user.id) {
      dataToSave.id = user.id;
    }

    await withTimeout(setDoc(userRef, dataToSave, { merge: true }), 2500, null);
  } catch (err: any) {
    // Fail silently in background
  }
}

export async function getUserFromFirestore(email: string): Promise<FirestoreUser | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

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

export async function persistSpotToFirestore(spot: FirestoreSpot): Promise<void> {
  if (!spot.id) return;
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
  try {
    const spotRef = doc(firestore, 'spots', spotId);
    await withTimeout(deleteDoc(spotRef), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to delete spot from Firestore:', spotId, err?.message);
  }
}

// ----------------------------------------------------
// MAP VISUAL ICONS PERSISTENCE
// ----------------------------------------------------

export async function persistMapVisualIconToFirestore(icon: FirestoreMapVisualIcon): Promise<void> {
  if (!icon.id) return;
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
  try {
    const iconRef = doc(firestore, 'map_visual_icons', iconId);
    await withTimeout(deleteDoc(iconRef), 3000, null);
  } catch (err: any) {
    console.warn('[FirestoreSync] Failed to delete visual icon from Firestore:', iconId, err?.message);
  }
}

// ----------------------------------------------------
// SYSTEM SETTINGS PERSISTENCE
// ----------------------------------------------------

export async function persistSystemSettingToFirestore(key: string, value: string): Promise<void> {
  if (!key) return;
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
  try {
    const eventRef = doc(firestore, 'events', eventId);
    await withTimeout(deleteDoc(eventRef), 3000, null);
  } catch (err: any) {}
}

// ----------------------------------------------------
// FULL BIDIRECTIONAL REPLICATION ON SERVER BOOT
// ----------------------------------------------------

export async function syncDatabaseWithFirestore(sqliteDb: any): Promise<void> {
  console.log('[FirestoreSync] Starting full sync between SQLite and Cloud Firestore...');
  
  try {
    // ----------------------------------------------------
    // 1. SYSTEM SETTINGS
    // ----------------------------------------------------
    try {
      const localSettings = sqliteDb.prepare('SELECT key, value FROM system_settings').all();
      for (const s of localSettings) {
        if (s.key) {
          await persistSystemSettingToFirestore(s.key, s.value);
        }
      }

      const settingsSnap = await withTimeout(getDocs(collection(firestore, 'system_settings')), 4000, null as any);
      if (settingsSnap && !settingsSnap.empty) {
        const upsertSetting = sqliteDb.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
        settingsSnap.forEach((docSnap: any) => {
          const data = docSnap.data();
          if (data && data.key && data.key !== '_health') {
            upsertSetting.run(data.key, String(data.value || ''));
          }
        });
      }
    } catch (e) {
      console.warn('[FirestoreSync] Settings sync notice:', e);
    }

    // ----------------------------------------------------
    // 2. MAP VISUAL ICONS (Firmly anchored to GPS)
    // ----------------------------------------------------
    try {
      const localIcons = sqliteDb.prepare('SELECT * FROM map_visual_icons').all();
      for (const icon of localIcons) {
        if (icon.id) {
          await persistMapVisualIconToFirestore({
            id: icon.id,
            category: icon.category,
            icon: icon.icon,
            latitude: Number(icon.latitude),
            longitude: Number(icon.longitude),
            is_active: Number(icon.is_active !== undefined ? icon.is_active : 1),
            created_at: icon.created_at,
            updated_at: icon.updated_at
          });
        }
      }

      const iconsSnap = await withTimeout(getDocs(collection(firestore, 'map_visual_icons')), 5000, null as any);
      if (iconsSnap && !iconsSnap.empty) {
        try { sqliteDb.exec(`ALTER TABLE map_visual_icons ADD COLUMN color TEXT;`); } catch (e) {}
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

        iconsSnap.forEach((docSnap: any) => {
          const icon = docSnap.data() as FirestoreMapVisualIcon;
          if (icon && icon.id && icon.category && !isNaN(icon.latitude) && !isNaN(icon.longitude)) {
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
      }
    } catch (e) {
      console.warn('[FirestoreSync] Map visual icons sync notice:', e);
    }

    // ----------------------------------------------------
    // 3. SPOTS (Tourist Spots / Points of Interest)
    // ----------------------------------------------------
    try {
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

      const spotsSnap = await withTimeout(getDocs(collection(firestore, 'spots')), 5000, null as any);
      if (spotsSnap && !spotsSnap.empty) {
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

        spotsSnap.forEach((docSnap: any) => {
          const s = docSnap.data() as FirestoreSpot;
          if (s && s.id && s.name && !isNaN(s.lat) && !isNaN(s.lng)) {
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
      }
    } catch (e) {
      console.warn('[FirestoreSync] Spots sync notice:', e);
    }

    // ----------------------------------------------------
    // 4. USERS (Profiles, credentials, preferences)
    // ----------------------------------------------------
    try {
      const localUsers = sqliteDb.prepare('SELECT * FROM users').all();
      for (const u of localUsers) {
        const email = (u.email || u.whatsapp || '').trim().toLowerCase();
        if (email && email.includes('@')) {
          await persistUserToFirestore({
            id: u.id,
            name: u.name || '',
            email: email,
            whatsapp: u.whatsapp || email,
            password_hash: u.password_hash,
            role: u.role || 'user',
            avatar_url: u.avatar_url || '/fotoperfil.png',
            visits_count: u.visits_count || 1,
            is_banned: u.is_banned || 0,
            snow_enabled: u.snow_enabled || 0,
            theme: u.theme || 'dark',
            high_contrast: u.high_contrast || 0,
            onboarding_completed: u.onboarding_completed !== undefined ? u.onboarding_completed : 1,
            onboarding_step: u.onboarding_step || 1,
            last_access: u.last_access,
            created_at: u.created_at
          });
        }
      }

      const usersSnap = await withTimeout(getDocs(collection(firestore, 'users')), 4000, null as any);
      if (usersSnap && !usersSnap.empty) {
        usersSnap.forEach((docSnap: any) => {
          const cloudUser = docSnap.data() as FirestoreUser;
          if (!cloudUser.email || !cloudUser.password_hash) return;

          const cleanEmail = cloudUser.email.trim().toLowerCase();
          const existingUser = sqliteDb.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);

          if (!existingUser) {
            sqliteDb.prepare(`
              INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              cloudUser.name || cleanEmail.split('@')[0],
              cleanEmail,
              cloudUser.whatsapp || cleanEmail,
              cloudUser.password_hash,
              cloudUser.role || 'user',
              cloudUser.avatar_url || '/fotoperfil.png',
              cloudUser.visits_count || 1,
              cloudUser.is_banned || 0,
              cloudUser.snow_enabled || 0,
              cloudUser.theme || 'dark',
              cloudUser.high_contrast || 0,
              cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
              cloudUser.onboarding_step || 1,
              cloudUser.last_access || new Date().toISOString(),
              cloudUser.created_at || new Date().toISOString()
            );
          } else {
            sqliteDb.prepare(`
              UPDATE users 
              SET name = ?, password_hash = ?, role = ?, avatar_url = ?, is_banned = ?
              WHERE id = ?
            `).run(
              cloudUser.name,
              cloudUser.password_hash,
              cloudUser.role || 'user',
              cloudUser.avatar_url || '/fotoperfil.png',
              cloudUser.is_banned || 0,
              existingUser.id
            );
          }
        });
      }
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
