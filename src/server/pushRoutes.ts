import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from '../services/firestoreSync.ts';
import firebaseAppletConfig from '../../firebase-applet-config.json' with { type: 'json' };

export type PushAlertType = 'new_spot' | 'itinerary_update';

export interface PushAlertInput {
  type: PushAlertType;
  title: string;
  body: string;
  spotId?: string | null;
  itineraryId?: string | null;
  imageUrl?: string | null;
}

export interface PushAlertRecord {
  id: string;
  type: PushAlertType;
  title: string;
  body: string;
  spot_id: string | null;
  itinerary_id: string | null;
  image_url: string | null;
  sent_count: number;
  failed_count: number;
  delivery_mode: string;
  created_at: string;
}

interface ServiceAccountCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function withTimeout<T>(promise: Promise<T>, ms = 3000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function hashSubscriptionId(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

function sanitizeShortText(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1000) return null;
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('//'))
  ) {
    return trimmed;
  }
  return null;
}

function sanitizeIdentifier(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const cleaned = String(raw).trim();
  if (!cleaned || cleaned.length > 120) return null;
  if (!/^[a-zA-Z0-9._:@-]+$/.test(cleaned)) return null;
  return cleaned;
}

function parseServiceAccount(): ServiceAccountCredentials | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.client_email === 'string' &&
      typeof parsed?.private_key === 'string' &&
      parsed.client_email.includes('@') &&
      parsed.private_key.includes('BEGIN PRIVATE KEY')
    ) {
      return {
        project_id: String(parsed.project_id || firebaseAppletConfig.projectId || '').trim(),
        client_email: parsed.client_email.trim(),
        private_key: parsed.private_key.replace(/\\n/g, '\n'),
        token_uri:
          typeof parsed.token_uri === 'string' && parsed.token_uri.startsWith('https://')
            ? parsed.token_uri
            : 'https://oauth2.googleapis.com/token',
      };
    }
  } catch {
    console.warn('[PushRoutes] Invalid FIREBASE_SERVICE_ACCOUNT_JSON format; falling back to realtime delivery.');
  }
  return null;
}

export function isFcmServerConfigured(): boolean {
  return Boolean(parseServiceAccount());
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getFcmOAuthAccessToken(creds: ServiceAccountCredentials): Promise<string | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > nowSec + 60) {
    return cachedAccessToken.token;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      sub: creds.client_email,
      aud: creds.token_uri || 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(creds.private_key));
  const assertion = `${signingInput}.${signature}`;

  const tokenRes = await fetch(creds.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    console.warn('[PushRoutes] Failed to mint FCM OAuth token:', tokenRes.status, errText.slice(0, 200));
    return null;
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenJson.access_token) return null;

  cachedAccessToken = {
    token: tokenJson.access_token,
    expiresAt: nowSec + Number(tokenJson.expires_in || 3500),
  };
  return cachedAccessToken.token;
}

export function setupPushDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE,
      user_id TEXT,
      user_email TEXT NOT NULL,
      platform TEXT DEFAULT 'web',
      enabled INTEGER DEFAULT 1,
      notify_new_spots INTEGER DEFAULT 1,
      notify_itinerary_updates INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_push_subs_email ON push_subscriptions(user_email);
    CREATE INDEX IF NOT EXISTS idx_push_subs_enabled ON push_subscriptions(enabled);

    CREATE TABLE IF NOT EXISTS push_alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      spot_id TEXT,
      itinerary_id TEXT,
      image_url TEXT,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      delivery_mode TEXT DEFAULT 'realtime',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_push_alerts_created ON push_alerts(created_at DESC);
  `);
}

async function mirrorSubscriptionToFirestore(sub: {
  id: string;
  token: string | null;
  user_id: string | null;
  user_email: string;
  platform: string;
  enabled: number;
  notify_new_spots: number;
  notify_itinerary_updates: number;
  created_at: string;
  updated_at: string;
}): Promise<void> {
  try {
    await withTimeout(
      setDoc(
        doc(firestore, 'push_subscriptions', sub.id),
        {
          id: sub.id,
          token: sub.token || '',
          user_id: sub.user_id || '',
          user_email: sub.user_email,
          platform: sub.platform,
          enabled: sub.enabled,
          notify_new_spots: sub.notify_new_spots,
          notify_itinerary_updates: sub.notify_itinerary_updates,
          created_at: sub.created_at,
          updated_at: sub.updated_at,
        },
        { merge: true }
      ),
      2500,
      null
    );
  } catch {
    // Non-fatal mirror error
  }
}

async function deleteSubscriptionFromFirestore(id: string): Promise<void> {
  try {
    await withTimeout(deleteDoc(doc(firestore, 'push_subscriptions', id)), 2000, null);
  } catch {
    // Non-fatal
  }
}

async function mirrorAlertToFirestore(alert: PushAlertRecord): Promise<void> {
  try {
    await withTimeout(
      setDoc(
        doc(firestore, 'push_alerts', alert.id),
        {
          id: alert.id,
          type: alert.type,
          title: alert.title,
          body: alert.body,
          spot_id: alert.spot_id || '',
          itinerary_id: alert.itinerary_id || '',
          image_url: alert.image_url || '',
          sent_count: alert.sent_count,
          failed_count: alert.failed_count,
          delivery_mode: alert.delivery_mode,
          created_at: alert.created_at,
        },
        { merge: true }
      ),
      2500,
      null
    );
  } catch {
    // Non-fatal
  }
}

async function sendFcmV1Batch(
  db: Database.Database,
  tokens: Array<{ id: string; token: string }>,
  alert: PushAlertRecord
): Promise<{ sentCount: number; failedCount: number; fcmUsed: boolean }> {
  const creds = parseServiceAccount();
  if (!creds || tokens.length === 0) {
    return { sentCount: 0, failedCount: 0, fcmUsed: false };
  }

  const accessToken = await getFcmOAuthAccessToken(creds);
  if (!accessToken) {
    return { sentCount: 0, failedCount: tokens.length, fcmUsed: false };
  }

  const targetRelativeUrl = alert.spot_id
    ? `/?spot=${encodeURIComponent(alert.spot_id)}`
    : alert.itinerary_id
      ? `/?itinerary=${encodeURIComponent(alert.itinerary_id)}`
      : '/';

  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(creds.project_id)}/messages:send`;

  let sentCount = 0;
  let failedCount = 0;

  await Promise.all(
    tokens.map(async ({ id, token }) => {
      try {
        const messagePayload: Record<string, any> = {
          message: {
            token,
            notification: {
              title: alert.title,
              body: alert.body,
              ...(alert.image_url && alert.image_url.startsWith('http') ? { image: alert.image_url } : {}),
            },
            data: {
              alertId: alert.id,
              type: alert.type,
              title: alert.title,
              body: alert.body,
              spotId: alert.spot_id || '',
              itineraryId: alert.itinerary_id || '',
              imageUrl: alert.image_url || '',
              url: targetRelativeUrl,
            },
            webpush: {
              headers: {
                Urgency: 'high',
                TTL: '86400',
              },
              notification: {
                title: alert.title,
                body: alert.body,
                icon: '/pwa-192x192.png',
                badge: '/notification-badge.png',
                ...(alert.image_url && alert.image_url.startsWith('http') ? { image: alert.image_url } : {}),
              },
              fcm_options: {
                link: targetRelativeUrl,
              },
            },
          },
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messagePayload),
        });

        if (response.ok) {
          sentCount += 1;
          return;
        }

        failedCount += 1;
        const errBody = await response.text().catch(() => '');
        // Clean up permanently unregistered tokens so future dispatches stay clean
        if (
          response.status === 404 ||
          errBody.includes('UNREGISTERED') ||
          errBody.includes('registration-token-not-registered')
        ) {
          try {
            db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(id);
            deleteSubscriptionFromFirestore(id).catch(() => {});
          } catch {
            // Ignore cleanup failure
          }
        }
      } catch {
        failedCount += 1;
      }
    })
  );

  return { sentCount, failedCount, fcmUsed: true };
}

/**
 * Dispatches a push alert for a new spot or itinerary update.
 * Persists to SQLite + Firestore (instant real-time delivery to active clients)
 * and delivers background Web Push notifications via FCM HTTP v1 when configured.
 */
export async function dispatchPushAlert(
  db: Database.Database,
  input: PushAlertInput
): Promise<{
  alert: PushAlertRecord;
  subscribersCount: number;
  fcmTokensCount: number;
  sentCount: number;
  failedCount: number;
  deliveryMode: string;
}> {
  const safeType: PushAlertType =
    input.type === 'itinerary_update' ? 'itinerary_update' : 'new_spot';
  const safeTitle = sanitizeShortText(input.title, 110) || (
    safeType === 'new_spot' ? 'Novo local em Campos do Jordão' : 'Roteiro atualizado'
  );
  const safeBody = sanitizeShortText(input.body, 240) || (
    safeType === 'new_spot'
      ? 'Confira o novo ponto turístico adicionado no Monvian.'
      : 'Há novidades em um roteiro de Campos do Jordão.'
  );
  const safeSpotId = sanitizeIdentifier(input.spotId);
  const safeItineraryId = sanitizeIdentifier(input.itineraryId);
  const safeImageUrl = sanitizeImageUrl(input.imageUrl);

  const alertId = `push-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const createdAt = new Date().toISOString();

  const topicColumn =
    safeType === 'new_spot' ? 'notify_new_spots' : 'notify_itinerary_updates';

  const subscribers = db
    .prepare(
      `SELECT id, token, user_email FROM push_subscriptions
       WHERE enabled = 1 AND ${topicColumn} = 1`
    )
    .all() as Array<{ id: string; token: string | null; user_email: string }>;

  // Deduplicate real FCM tokens (ignore placeholder/realtime-only entries)
  const seenTokens = new Set<string>();
  const fcmTargets: Array<{ id: string; token: string }> = [];
  for (const row of subscribers) {
    const tok = String(row.token || '').trim();
    if (tok && tok.length >= 24 && !tok.startsWith('realtime:') && !seenTokens.has(tok)) {
      seenTokens.add(tok);
      fcmTargets.push({ id: row.id, token: tok });
    }
  }

  const baseRecord: PushAlertRecord = {
    id: alertId,
    type: safeType,
    title: safeTitle,
    body: safeBody,
    spot_id: safeSpotId,
    itinerary_id: safeItineraryId,
    image_url: safeImageUrl,
    sent_count: 0,
    failed_count: 0,
    delivery_mode: 'realtime',
    created_at: createdAt,
  };

  const fcmResult = await sendFcmV1Batch(db, fcmTargets, baseRecord);
  const deliveryMode = fcmResult.fcmUsed
    ? fcmTargets.length > 0
      ? 'fcm+realtime'
      : 'realtime'
    : 'realtime';

  const finalRecord: PushAlertRecord = {
    ...baseRecord,
    sent_count: fcmResult.sentCount,
    failed_count: fcmResult.failedCount,
    delivery_mode: deliveryMode,
  };

  db.prepare(
    `INSERT INTO push_alerts (
      id, type, title, body, spot_id, itinerary_id, image_url,
      sent_count, failed_count, delivery_mode, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    finalRecord.id,
    finalRecord.type,
    finalRecord.title,
    finalRecord.body,
    finalRecord.spot_id,
    finalRecord.itinerary_id,
    finalRecord.image_url,
    finalRecord.sent_count,
    finalRecord.failed_count,
    finalRecord.delivery_mode,
    finalRecord.created_at
  );

  // Publish to Firestore so active listeners receive the alert instantaneously
  await mirrorAlertToFirestore(finalRecord);

  return {
    alert: finalRecord,
    subscribersCount: subscribers.length,
    fcmTokensCount: fcmTargets.length,
    sentCount: fcmResult.sentCount,
    failedCount: fcmResult.failedCount,
    deliveryMode,
  };
}

export function registerPushRoutes(
  app: Express,
  db: Database.Database,
  resolveAuthenticatedUser: (req: Request) => Promise<any | null>,
  isRequestAdmin: (req: Request) => Promise<boolean>
): void {
  setupPushDatabase(db);

  // Hydrate existing Firestore push subscriptions into SQLite on cold start (non-blocking)
  withTimeout(getDocs(collection(firestore, 'push_subscriptions')), 3500, null)
    .then((snap) => {
      if (!snap) return;
      const upsert = db.prepare(`
        INSERT INTO push_subscriptions (
          id, token, user_id, user_email, platform, enabled,
          notify_new_spots, notify_itinerary_updates, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          token = COALESCE(excluded.token, push_subscriptions.token),
          enabled = excluded.enabled,
          notify_new_spots = excluded.notify_new_spots,
          notify_itinerary_updates = excluded.notify_itinerary_updates,
          updated_at = excluded.updated_at
      `);
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d?.id || !d?.user_email) return;
        try {
          upsert.run(
            String(d.id),
            d.token ? String(d.token) : null,
            d.user_id ? String(d.user_id) : null,
            String(d.user_email).toLowerCase(),
            String(d.platform || 'web'),
            d.enabled ? 1 : 0,
            d.notify_new_spots !== undefined ? (d.notify_new_spots ? 1 : 0) : 1,
            d.notify_itinerary_updates !== undefined ? (d.notify_itinerary_updates ? 1 : 0) : 1,
            String(d.created_at || new Date().toISOString()),
            String(d.updated_at || new Date().toISOString())
          );
        } catch {
          // Ignore duplicate token constraint
        }
      });
    })
    .catch(() => {});

  // 1. Get current authenticated user's push notification status & preferences
  app.get('/api/push/status', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
      }

      const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
      const rows = db
        .prepare(
          `SELECT id, token, platform, enabled, notify_new_spots, notify_itinerary_updates, updated_at
           FROM push_subscriptions
           WHERE user_email = ?
           ORDER BY updated_at DESC`
        )
        .all(cleanEmail) as any[];

      const latest = rows[0] || null;
      const fcmDevices = rows.filter(
        (r) => r.enabled === 1 && typeof r.token === 'string' && r.token.length >= 24 && !r.token.startsWith('realtime:')
      ).length;

      return res.json({
        success: true,
        fcmConfigured: isFcmServerConfigured(),
        subscribed: Boolean(latest && latest.enabled === 1),
        fcmDevices,
        preferences: {
          enabled: latest ? latest.enabled === 1 : false,
          newSpots: latest ? latest.notify_new_spots === 1 : true,
          itineraryUpdates: latest ? latest.notify_itinerary_updates === 1 : true,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao consultar status de notificações.' });
    }
  });

  // 2. Register or refresh FCM device token & topic preferences for authenticated user
  app.post('/api/push/register', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
      }

      const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
      if (!cleanEmail) {
        return res.status(400).json({ success: false, error: 'Conta sem e-mail válido.' });
      }

      const body = req.body || {};
      const rawToken = typeof body.token === 'string' ? body.token.trim() : '';
      if (rawToken && (rawToken.length > 512 || /\s/.test(rawToken))) {
        return res.status(400).json({ success: false, error: 'Token FCM inválido.' });
      }

      const allowedPlatforms = new Set(['web', 'ios-pwa', 'android-pwa', 'desktop-web', 'mobile-web']);
      const platform = allowedPlatforms.has(String(body.platform || ''))
        ? String(body.platform)
        : 'web';

      const enabled = body.enabled !== false ? 1 : 0;
      const notifyNewSpots = body.newSpots !== false ? 1 : 0;
      const notifyItineraryUpdates = body.itineraryUpdates !== false ? 1 : 0;

      const tokenValue = rawToken || `realtime:${cleanEmail}`;
      const subId = hashSubscriptionId(rawToken ? `fcm:${rawToken}` : `realtime:${cleanEmail}`);
      const nowIso = new Date().toISOString();
      const userIdStr = user.id !== undefined && user.id !== null ? String(user.id) : '';

      // If registering a real FCM token, remove stale placeholder row for same email so counts remain accurate
      if (rawToken) {
        const placeholderId = hashSubscriptionId(`realtime:${cleanEmail}`);
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(placeholderId);
        deleteSubscriptionFromFirestore(placeholderId).catch(() => {});
      }

      db.prepare(`
        INSERT INTO push_subscriptions (
          id, token, user_id, user_email, platform, enabled,
          notify_new_spots, notify_itinerary_updates, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET
          user_id = excluded.user_id,
          user_email = excluded.user_email,
          platform = excluded.platform,
          enabled = excluded.enabled,
          notify_new_spots = excluded.notify_new_spots,
          notify_itinerary_updates = excluded.notify_itinerary_updates,
          updated_at = excluded.updated_at
      `).run(
        subId,
        tokenValue,
        userIdStr,
        cleanEmail,
        platform,
        enabled,
        notifyNewSpots,
        notifyItineraryUpdates,
        nowIso,
        nowIso
      );

      mirrorSubscriptionToFirestore({
        id: subId,
        token: tokenValue,
        user_id: userIdStr,
        user_email: cleanEmail,
        platform,
        enabled,
        notify_new_spots: notifyNewSpots,
        notify_itinerary_updates: notifyItineraryUpdates,
        created_at: nowIso,
        updated_at: nowIso,
      }).catch(() => {});

      return res.json({
        success: true,
        id: subId,
        mode: rawToken ? 'fcm' : 'realtime',
        fcmConfigured: isFcmServerConfigured(),
        preferences: {
          enabled: enabled === 1,
          newSpots: notifyNewSpots === 1,
          itineraryUpdates: notifyItineraryUpdates === 1,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao registrar notificações.' });
    }
  });

  // 3. Update notification topic preferences for authenticated user
  app.patch('/api/push/preferences', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
      }

      const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
      const body = req.body || {};
      const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1;
      const notifyNewSpots = body.newSpots !== undefined ? (body.newSpots ? 1 : 0) : 1;
      const notifyItineraryUpdates =
        body.itineraryUpdates !== undefined ? (body.itineraryUpdates ? 1 : 0) : 1;
      const nowIso = new Date().toISOString();

      const existingRows = db
        .prepare('SELECT * FROM push_subscriptions WHERE user_email = ?')
        .all(cleanEmail) as any[];

      if (existingRows.length === 0) {
        const subId = hashSubscriptionId(`realtime:${cleanEmail}`);
        const tokenValue = `realtime:${cleanEmail}`;
        const userIdStr = user.id !== undefined && user.id !== null ? String(user.id) : '';
        db.prepare(`
          INSERT INTO push_subscriptions (
            id, token, user_id, user_email, platform, enabled,
            notify_new_spots, notify_itinerary_updates, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'web', ?, ?, ?, ?, ?)
        `).run(
          subId,
          tokenValue,
          userIdStr,
          cleanEmail,
          enabled,
          notifyNewSpots,
          notifyItineraryUpdates,
          nowIso,
          nowIso
        );
        mirrorSubscriptionToFirestore({
          id: subId,
          token: tokenValue,
          user_id: userIdStr,
          user_email: cleanEmail,
          platform: 'web',
          enabled,
          notify_new_spots: notifyNewSpots,
          notify_itinerary_updates: notifyItineraryUpdates,
          created_at: nowIso,
          updated_at: nowIso,
        }).catch(() => {});
      } else {
        db.prepare(`
          UPDATE push_subscriptions
          SET enabled = ?, notify_new_spots = ?, notify_itinerary_updates = ?, updated_at = ?
          WHERE user_email = ?
        `).run(enabled, notifyNewSpots, notifyItineraryUpdates, nowIso, cleanEmail);

        for (const row of existingRows) {
          mirrorSubscriptionToFirestore({
            id: row.id,
            token: row.token,
            user_id: row.user_id,
            user_email: cleanEmail,
            platform: row.platform || 'web',
            enabled,
            notify_new_spots: notifyNewSpots,
            notify_itinerary_updates: notifyItineraryUpdates,
            created_at: row.created_at || nowIso,
            updated_at: nowIso,
          }).catch(() => {});
        }
      }

      return res.json({
        success: true,
        preferences: {
          enabled: enabled === 1,
          newSpots: notifyNewSpots === 1,
          itineraryUpdates: notifyItineraryUpdates === 1,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao atualizar preferências.' });
    }
  });

  // 4. Unregister device token or disable push for authenticated user
  app.delete('/api/push/unregister', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
      }

      const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
      const rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

      if (rawToken) {
        const matched = db
          .prepare('SELECT id FROM push_subscriptions WHERE token = ? AND user_email = ?')
          .get(rawToken, cleanEmail) as { id?: string } | undefined;
        if (matched?.id) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(matched.id);
          deleteSubscriptionFromFirestore(matched.id).catch(() => {});
        }
      } else {
        const rows = db
          .prepare('SELECT id FROM push_subscriptions WHERE user_email = ?')
          .all(cleanEmail) as Array<{ id: string }>;
        db.prepare('DELETE FROM push_subscriptions WHERE user_email = ?').run(cleanEmail);
        for (const r of rows) {
          deleteSubscriptionFromFirestore(r.id).catch(() => {});
        }
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao remover inscrição.' });
    }
  });

  // 5. Recent push alerts feed (new spots & itinerary updates)
  app.get('/api/push/alerts', (req: Request, res: Response) => {
    try {
      const limitRaw = Number(req.query.limit || 25);
      const safeLimit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 25, 1), 50);
      const typeFilter = String(req.query.type || '').trim();

      const rows =
        typeFilter === 'new_spot' || typeFilter === 'itinerary_update'
          ? db
              .prepare(
                `SELECT id, type, title, body, spot_id, itinerary_id, image_url, created_at
                 FROM push_alerts
                 WHERE type = ?
                 ORDER BY created_at DESC
                 LIMIT ?`
              )
              .all(typeFilter, safeLimit)
          : db
              .prepare(
                `SELECT id, type, title, body, spot_id, itinerary_id, image_url, created_at
                 FROM push_alerts
                 ORDER BY created_at DESC
                 LIMIT ?`
              )
              .all(safeLimit);

      return res.json({ success: true, alerts: rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao buscar alertas.' });
    }
  });

  // 6. Admin Push Stats
  app.get('/api/admin/push/stats', async (req: Request, res: Response) => {
    try {
      if (!(await isRequestAdmin(req))) {
        return res.status(403).json({ success: false, error: 'Acesso restrito a administradores.' });
      }

      const totals = db
        .prepare(
          `SELECT
             COUNT(*) AS total,
             SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN enabled = 1 AND notify_new_spots = 1 THEN 1 ELSE 0 END) AS new_spots,
             SUM(CASE WHEN enabled = 1 AND notify_itinerary_updates = 1 THEN 1 ELSE 0 END) AS itinerary_updates,
             SUM(CASE WHEN enabled = 1 AND token IS NOT NULL AND token NOT LIKE 'realtime:%' THEN 1 ELSE 0 END) AS fcm_devices
           FROM push_subscriptions`
        )
        .get() as any;

      const recentAlerts = db
        .prepare(
          `SELECT id, type, title, body, spot_id, itinerary_id, image_url, sent_count, failed_count, delivery_mode, created_at
           FROM push_alerts
           ORDER BY created_at DESC
           LIMIT 10`
        )
        .all();

      return res.json({
        success: true,
        fcmConfigured: isFcmServerConfigured(),
        stats: {
          totalSubscribers: Number(totals?.total || 0),
          activeSubscribers: Number(totals?.active || 0),
          newSpotsSubscribers: Number(totals?.new_spots || 0),
          itinerarySubscribers: Number(totals?.itinerary_updates || 0),
          fcmDevices: Number(totals?.fcm_devices || 0),
        },
        recentAlerts,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao consultar estatísticas de push.' });
    }
  });

  // 7. Admin Manual Push Dispatch (New Spot or Itinerary Update)
  app.post('/api/admin/push/send', async (req: Request, res: Response) => {
    try {
      if (!(await isRequestAdmin(req))) {
        return res.status(403).json({ success: false, error: 'Acesso restrito a administradores.' });
      }

      const body = req.body || {};
      const type: PushAlertType =
        body.type === 'itinerary_update' ? 'itinerary_update' : 'new_spot';
      const title = sanitizeShortText(body.title, 110);
      const message = sanitizeShortText(body.body || body.message, 240);

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          error: 'Informe um título e uma mensagem para enviar a notificação.',
        });
      }

      const result = await dispatchPushAlert(db, {
        type,
        title,
        body: message,
        spotId: body.spotId || null,
        itineraryId: body.itineraryId || null,
        imageUrl: body.imageUrl || null,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao enviar notificação push.' });
    }
  });
}
