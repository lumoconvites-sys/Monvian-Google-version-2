import { getApp, getApps } from 'firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported as isMessagingSupported,
  type Messaging,
} from 'firebase/messaging';
import {
  collection,
  doc,
  getDocFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, getFreshFirebaseIdToken } from '../lib/firebase';
import { firestore } from './firestoreSync';
import { getAuthHeaders } from '../hooks/usePlatanos';
import {
  readScopedJSON,
  writeScopedJSON,
} from '../utils/userScopedStorage';

export type ScopedUserIdentity = any;

export type PushAlertType = 'new_spot' | 'itinerary_update';

export interface PushPreferences {
  enabled: boolean;
  newSpots: boolean;
  itineraryUpdates: boolean;
}

export interface PushAlertItem {
  id: string;
  type: PushAlertType;
  title: string;
  body: string;
  spotId?: string;
  itineraryId?: string;
  imageUrl?: string;
  createdAt: string;
  isRead?: boolean;
}

export interface PushRegistrationResult {
  success: boolean;
  mode: 'fcm' | 'realtime' | 'denied' | 'unsupported';
  permission: NotificationPermission | 'unsupported';
  token?: string | null;
  message: string;
  preferences: PushPreferences;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  };
}

function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
  };
  console.warn('[FCMPushService] Firestore notice:', JSON.stringify(errInfo));
}

const PREFS_STORAGE_KEY = 'monvian_fcm_push_prefs';
const TOKEN_STORAGE_KEY = 'monvian_fcm_device_token';
const READ_ALERTS_STORAGE_KEY = 'monvian_read_push_alert_ids';

const DEFAULT_PREFERENCES: PushPreferences = {
  enabled: false,
  newSpots: true,
  itineraryUpdates: true,
};

let cachedMessaging: Messaging | null = null;
let connectionValidated = false;

export async function validateFirestorePushConnection(): Promise<void> {
  if (connectionValidated) return;
  connectionValidated = true;
  try {
    await getDocFromServer(doc(firestore, 'system_settings', '_health'));
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.warn('[FCMPushService] Firestore appears offline; check Firebase configuration.');
    }
  }
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function detectClientPlatform(): string {
  if (typeof window === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  const isStandalone =
    Boolean((window.navigator as any)?.standalone) ||
    window.matchMedia?.('(display-mode: standalone)')?.matches;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (isIOS && isStandalone) return 'ios-pwa';
  if (isAndroid && isStandalone) return 'android-pwa';
  if (isIOS || isAndroid) return 'mobile-web';
  return 'desktop-web';
}

export function getSavedPushPreferences(user?: ScopedUserIdentity): PushPreferences {
  const stored = readScopedJSON<Partial<PushPreferences> | null>(
    PREFS_STORAGE_KEY,
    null,
    user
  );
  if (!stored) return { ...DEFAULT_PREFERENCES };
  return {
    enabled: Boolean(stored.enabled),
    newSpots: stored.newSpots !== false,
    itineraryUpdates: stored.itineraryUpdates !== false,
  };
}

export function savePushPreferencesLocally(
  prefs: PushPreferences,
  user?: ScopedUserIdentity
): void {
  writeScopedJSON(PREFS_STORAGE_KEY, prefs, user);
}

export function getReadPushAlertIds(user?: ScopedUserIdentity): Set<string> {
  const arr = readScopedJSON<string[]>(READ_ALERTS_STORAGE_KEY, [], user);
  return new Set(Array.isArray(arr) ? arr : []);
}

export function markPushAlertIdsAsRead(
  ids: string[],
  user?: ScopedUserIdentity
): void {
  if (!ids.length) return;
  const existing = getReadPushAlertIds(user);
  for (const id of ids) {
    if (id) existing.add(id);
  }
  // Keep latest 200 read IDs bounded
  const bounded = Array.from(existing).slice(-200);
  writeScopedJSON(READ_ALERTS_STORAGE_KEY, bounded, user);
}

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const baseHeaders = getAuthHeaders();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...baseHeaders,
  };
  if (!headers.Authorization) {
    const firebaseToken = await getFreshFirebaseIdToken().catch(() => null);
    if (firebaseToken) {
      headers.Authorization = `Bearer ${firebaseToken}`;
    }
  }
  return headers;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (cachedMessaging) return cachedMessaging;

  try {
    const supported = await isMessagingSupported();
    if (!supported) return null;
    if (getApps().length === 0) return null;
    cachedMessaging = getMessaging(getApp());
    return cachedMessaging;
  } catch {
    return null;
  }
}

async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    // Use dedicated FCM push scope so it never conflicts with main PWA /sw.js
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });
    return registration;
  } catch {
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  }
}

async function obtainFcmDeviceToken(): Promise<string | null> {
  const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
  if (!vapidKey) {
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const registration = await registerFcmServiceWorker();
  if (!registration) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token ? token.trim() : null;
  } catch (err) {
    console.warn('[FCMPushService] Could not obtain FCM token:', err);
    return null;
  }
}

/**
 * Requests browser Notification permission, obtains FCM Web Push token when configured,
 * and registers the subscription & topic preferences on the Monvian backend + Firestore.
 */
export async function enablePushNotifications(
  user?: ScopedUserIdentity,
  requestedPrefs?: Partial<PushPreferences>
): Promise<PushRegistrationResult> {
  const current = getSavedPushPreferences(user);
  const nextPrefs: PushPreferences = {
    enabled: true,
    newSpots: requestedPrefs?.newSpots ?? current.newSpots ?? true,
    itineraryUpdates: requestedPrefs?.itineraryUpdates ?? current.itineraryUpdates ?? true,
  };

  let permission = getBrowserNotificationPermission();
  if (permission === 'default' && typeof window !== 'undefined' && 'Notification' in window) {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }

  if (permission === 'denied') {
    const disabledPrefs: PushPreferences = { ...nextPrefs, enabled: false };
    savePushPreferencesLocally(disabledPrefs, user);
    return {
      success: false,
      mode: 'denied',
      permission: 'denied',
      token: null,
      message:
        'As notificações estão bloqueadas no navegador. Libere a permissão nas configurações do dispositivo.',
      preferences: disabledPrefs,
    };
  }

  let fcmToken: string | null = null;
  if (permission === 'granted') {
    fcmToken = await obtainFcmDeviceToken();
  }

  if (fcmToken) {
    writeScopedJSON(TOKEN_STORAGE_KEY, fcmToken, user);
  }
  savePushPreferencesLocally(nextPrefs, user);

  try {
    const headers = await buildAuthHeaders();
    await fetch('/api/push/register', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: fcmToken || '',
        platform: detectClientPlatform(),
        enabled: true,
        newSpots: nextPrefs.newSpots,
        itineraryUpdates: nextPrefs.itineraryUpdates,
      }),
    });
  } catch (err) {
    console.warn('[FCMPushService] Backend registration notice:', err);
  }

  return {
    success: true,
    mode: fcmToken ? 'fcm' : 'realtime',
    permission,
    token: fcmToken,
    message: fcmToken
      ? 'Notificações Push ativadas com sucesso.'
      : 'Alertas de novos locais e roteiros ativados.',
    preferences: nextPrefs,
  };
}

/**
 * Updates topic preferences (`newSpots`, `itineraryUpdates`, `enabled`) cleanly.
 */
export async function updatePushPreferences(
  prefs: PushPreferences,
  user?: ScopedUserIdentity
): Promise<PushPreferences> {
  savePushPreferencesLocally(prefs, user);
  try {
    const headers = await buildAuthHeaders();
    await fetch('/api/push/preferences', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        enabled: prefs.enabled,
        newSpots: prefs.newSpots,
        itineraryUpdates: prefs.itineraryUpdates,
      }),
    });
  } catch (err) {
    console.warn('[FCMPushService] Preference update notice:', err);
  }
  return prefs;
}

/**
 * Disables push notifications and revokes FCM token when present.
 */
export async function disablePushNotifications(
  user?: ScopedUserIdentity
): Promise<PushPreferences> {
  const current = getSavedPushPreferences(user);
  const nextPrefs: PushPreferences = {
    ...current,
    enabled: false,
  };
  savePushPreferencesLocally(nextPrefs, user);

  const storedToken = readScopedJSON<string | null>(TOKEN_STORAGE_KEY, null, user);

  try {
    const messaging = await getMessagingInstance();
    if (messaging && storedToken) {
      await deleteToken(messaging).catch(() => {});
    }
  } catch {}

  writeScopedJSON(TOKEN_STORAGE_KEY, null, user);

  try {
    const headers = await buildAuthHeaders();
    await fetch('/api/push/unregister', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ token: storedToken || '' }),
    });
  } catch {}

  return nextPrefs;
}

/**
 * Fetches persisted preferences from the backend and merges with local state.
 */
export async function syncPushStatusFromServer(
  user?: ScopedUserIdentity
): Promise<PushPreferences> {
  const local = getSavedPushPreferences(user);
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch('/api/push/status', { headers });
    if (!res.ok) return local;
    const data = await res.json();
    if (data?.success && data.preferences) {
      const merged: PushPreferences = {
        enabled: Boolean(data.preferences.enabled),
        newSpots: data.preferences.newSpots !== false,
        itineraryUpdates: data.preferences.itineraryUpdates !== false,
      };
      savePushPreferencesLocally(merged, user);

      // Quietly refresh FCM token if user opted in & permission is already granted
      if (merged.enabled && getBrowserNotificationPermission() === 'granted') {
        obtainFcmDeviceToken()
          .then((tok) => {
            if (!tok) return;
            const prevTok = readScopedJSON<string | null>(TOKEN_STORAGE_KEY, null, user);
            if (tok !== prevTok) {
              writeScopedJSON(TOKEN_STORAGE_KEY, tok, user);
              fetch('/api/push/register', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  token: tok,
                  platform: detectClientPlatform(),
                  enabled: merged.enabled,
                  newSpots: merged.newSpots,
                  itineraryUpdates: merged.itineraryUpdates,
                }),
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      return merged;
    }
  } catch {}
  return local;
}

/**
 * Fetches recent push alerts (new spots & itinerary updates) from API.
 */
export async function fetchRecentPushAlerts(
  user?: ScopedUserIdentity,
  maxItems = 25
): Promise<PushAlertItem[]> {
  try {
    const res = await fetch(`/api/push/alerts?limit=${Math.min(Math.max(maxItems, 1), 50)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.alerts)) return [];

    const readIds = getReadPushAlertIds(user);
    return data.alerts.map((row: any) => ({
      id: String(row.id),
      type: row.type === 'itinerary_update' ? 'itinerary_update' : 'new_spot',
      title: String(row.title || 'Monvian'),
      body: String(row.body || ''),
      spotId: row.spot_id ? String(row.spot_id) : undefined,
      itineraryId: row.itinerary_id ? String(row.itinerary_id) : undefined,
      imageUrl: row.image_url ? String(row.image_url) : undefined,
      createdAt: String(row.created_at || new Date().toISOString()),
      isRead: readIds.has(String(row.id)),
    }));
  } catch {
    return [];
  }
}

/**
 * Triggers a native browser/PWA notification if permission is granted and the tab is hidden.
 */
export async function showNativePushNotification(alert: PushAlertItem): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const targetUrl = alert.spotId
    ? `/?spot=${encodeURIComponent(alert.spotId)}`
    : alert.itineraryId
      ? `/?itinerary=${encodeURIComponent(alert.itineraryId)}`
      : '/';

  const options: NotificationOptions = {
    body: alert.body,
    icon: '/pwa-192x192.png',
    badge: '/notification-badge.png',
    tag: `monvian-push-${alert.id}`,
    data: {
      alertId: alert.id,
      alertType: alert.type,
      spotId: alert.spotId || '',
      itineraryId: alert.itineraryId || '',
      url: targetUrl,
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(alert.title, options);
        return;
      }
    }
    new Notification(alert.title, options);
  } catch {
    // Ignore native notification failures on restricted webviews
  }
}

/**
 * Subscribes to foreground FCM messages (`onMessage`) AND real-time Firestore `push_alerts`.
 * Deduplicates alerts by ID so each push arrives cleanly once.
 */
export function subscribeToPushAlerts(params: {
  user?: ScopedUserIdentity;
  onAlertReceived: (alert: PushAlertItem) => void;
  onAlertsListUpdated?: (alerts: PushAlertItem[]) => void;
}): () => void {
  const { user, onAlertReceived, onAlertsListUpdated } = params;
  const seenAlertIds = new Set<string>();
  let isInitialSnapshot = true;
  let unsubFirestore: (() => void) | null = null;
  let unsubFcm: (() => void) | null = null;
  let cancelled = false;

  const shouldDeliverByPrefs = (type: PushAlertType): boolean => {
    const prefs = getSavedPushPreferences(user);
    if (!prefs.enabled) return false;
    return type === 'itinerary_update' ? prefs.itineraryUpdates : prefs.newSpots;
  };

  const emitOnce = (alert: PushAlertItem, triggerNativeIfHidden: boolean) => {
    if (seenAlertIds.has(alert.id)) return;
    seenAlertIds.add(alert.id);

    if (!shouldDeliverByPrefs(alert.type)) return;

    onAlertReceived(alert);

    if (
      triggerNativeIfHidden &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      showNativePushNotification(alert).catch(() => {});
    }
  };

  // 1. Validate Firestore connectivity once
  validateFirestorePushConnection().catch(() => {});

  // 2. Real-time Firestore listener on `push_alerts`
  try {
    const alertsQuery = query(
      collection(firestore, 'push_alerts'),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    unsubFirestore = onSnapshot(
      alertsQuery,
      (snapshot) => {
        if (cancelled) return;
        const readIds = getReadPushAlertIds(user);
        const list: PushAlertItem[] = [];

        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d?.id) return;
          const item: PushAlertItem = {
            id: String(d.id),
            type: d.type === 'itinerary_update' ? 'itinerary_update' : 'new_spot',
            title: String(d.title || 'Monvian'),
            body: String(d.body || ''),
            spotId: d.spot_id ? String(d.spot_id) : undefined,
            itineraryId: d.itinerary_id ? String(d.itinerary_id) : undefined,
            imageUrl: d.image_url ? String(d.image_url) : undefined,
            createdAt: String(d.created_at || new Date().toISOString()),
            isRead: readIds.has(String(d.id)),
          };
          list.push(item);
        });

        onAlertsListUpdated?.(list);

        if (isInitialSnapshot) {
          isInitialSnapshot = false;
          for (const item of list) {
            seenAlertIds.add(item.id);
          }
          return;
        }

        for (const change of snapshot.docChanges()) {
          if (change.type !== 'added') continue;
          const d = change.doc.data();
          if (!d?.id) continue;
          const alert: PushAlertItem = {
            id: String(d.id),
            type: d.type === 'itinerary_update' ? 'itinerary_update' : 'new_spot',
            title: String(d.title || 'Monvian'),
            body: String(d.body || ''),
            spotId: d.spot_id ? String(d.spot_id) : undefined,
            itineraryId: d.itinerary_id ? String(d.itinerary_id) : undefined,
            imageUrl: d.image_url ? String(d.image_url) : undefined,
            createdAt: String(d.created_at || new Date().toISOString()),
            isRead: false,
          };
          emitOnce(alert, true);
        }
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, 'push_alerts');
      }
    );
  } catch (err) {
    logFirestoreError(err, OperationType.LIST, 'push_alerts');
  }

  // 3. Foreground Firebase Cloud Messaging `onMessage` listener
  getMessagingInstance()
    .then((messaging) => {
      if (!messaging || cancelled) return;
      unsubFcm = onMessage(messaging, (payload) => {
        const data = payload.data || {};
        const notif = payload.notification || {};
        const type: PushAlertType =
          data.type === 'itinerary_update' ? 'itinerary_update' : 'new_spot';
        const alert: PushAlertItem = {
          id: data.alertId ? String(data.alertId) : `fcm-${Date.now()}`,
          type,
          title: String(notif.title || data.title || 'Monvian'),
          body: String(notif.body || data.body || 'Nova atualização em Campos do Jordão.'),
          spotId: data.spotId ? String(data.spotId) : undefined,
          itineraryId: data.itineraryId ? String(data.itineraryId) : undefined,
          imageUrl: notif.image || data.imageUrl || undefined,
          createdAt: new Date().toISOString(),
          isRead: false,
        };
        emitOnce(alert, false);
      });
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    try {
      unsubFirestore?.();
    } catch {}
    try {
      unsubFcm?.();
    } catch {}
  };
}
