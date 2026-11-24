import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CAMPOS_SPOTS } from '../src/data/spots.js';
import { DEFAULT_CURATED_ITINERARIES } from '../src/data/defaultItineraries.js';
import {
  PRIMARY_GEMINI_MODEL,
  classifyGeminiError,
  runGeminiAssistantTurn,
  type AssistantHistoryTurn,
  type ClassifiedAssistantError,
  type GeminiAssistantKnowledge,
} from '../src/server/geminiAssistantEngine.js';
import {
  getFinancialDashboardMetricsServerless,
  getPlatanosOverviewServerless,
  updatePlatanosPackageServerless,
  updateItineraryPriceServerless,
  adjustPlatanosWalletServerless,
  refundPlatanosOrderServerless,
  invalidateStripeSnapshotCacheServerless,
  type ServerlessFinanceContext,
} from '../src/server/serverlessFinanceEngine.js';

const EXPECTED_FIREBASE_PROJECT_ID = 'inspired-nirvana-5dtd0';
let cachedFirebaseConfig: { apiKey: string; projectId: string } | null = null;
let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

function getFirebaseConfigServerless(): { apiKey: string; projectId: string } {
  if (cachedFirebaseConfig !== null) return cachedFirebaseConfig;

  let fileApiKey = '';
  let fileProjectId = EXPECTED_FIREBASE_PROJECT_ID;

  const candidatePaths: string[] = [];
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(path.resolve(currentDir, '../firebase-applet-config.json'));
  } catch {}
  candidatePaths.push(path.resolve(process.cwd(), 'firebase-applet-config.json'));

  for (const cfgPath of candidatePaths) {
    try {
      if (fs.existsSync(cfgPath)) {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        const k = String(parsed?.apiKey || '').trim();
        const pid = String(parsed?.projectId || '').trim();
        if (pid) fileProjectId = pid;
        if (k && k.startsWith('AIza')) {
          fileApiKey = k;
          break;
        }
      }
    } catch {}
  }

  const envProjectId = String(
    process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || ''
  ).trim();
  const envKey = String(
    process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || ''
  ).trim();

  // Only prefer env API key when env projectId matches the active Firebase project (or config file unavailable)
  const envMatchesProject =
    Boolean(envKey && envKey.startsWith('AIza')) &&
    (!envProjectId || envProjectId === fileProjectId);

  cachedFirebaseConfig = {
    projectId: fileProjectId || EXPECTED_FIREBASE_PROJECT_ID,
    apiKey: fileApiKey || (envMatchesProject ? envKey : ''),
  };
  return cachedFirebaseConfig;
}

async function fetchGoogleSecureTokenCerts(): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.certs;
  }
  try {
    const resp = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!resp.ok) return null;
    const certs = (await resp.json()) as Record<string, string>;
    const cc = resp.headers.get('cache-control') || '';
    const maxAgeMatch = cc.match(/max-age=(\d+)/i);
    const maxAgeSec = maxAgeMatch ? Math.max(60, Math.min(86400, Number(maxAgeMatch[1]))) : 3600;
    cachedGoogleCerts = {
      certs,
      expiresAt: now + maxAgeSec * 1000,
    };
    return certs;
  } catch {
    return null;
  }
}

async function verifyFirebaseIdTokenWithPublicCerts(
  idToken: string,
  projectId: string
): Promise<{ uid: string; email: string; name?: string; avatarUrl?: string } | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    if (header?.alg !== 'RS256' || !header?.kid) return null;

    const certs = await fetchGoogleSecureTokenCerts();
    const certPem = certs?.[String(header.kid)];
    if (!certPem) return null;

    const isValidSig = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'),
      certPem,
      Buffer.from(sigB64, 'base64url')
    );
    if (!isValidSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload?.aud !== projectId) return null;
    if (payload?.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload?.sub || typeof payload.sub !== 'string') return null;
    if (typeof payload?.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload?.iat === 'number' && payload.iat > nowSec + 300) return null;
    if (!payload?.email || typeof payload.email !== 'string') return null;

    return {
      uid: String(payload.sub),
      email: String(payload.email).trim().toLowerCase(),
      name: payload.name ? String(payload.name).trim() : undefined,
      avatarUrl: payload.picture ? String(payload.picture).trim() : undefined,
    };
  } catch {
    return null;
  }
}

const UUID_V4_LIKE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTIVE_PROJECT_REF = 'gxyqrwebnkbgxqrfdvuj';
const DEFAULT_SUPABASE_URL = 'https://gxyqrwebnkbgxqrfdvuj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_WaPR6pa1PiAD6pCG45aeuA_LrVfs39y';

const sanitizeSupabaseUrl = (url?: string): string => {
  if (!url) return '';
  const cleaned = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  if (cleaned.includes('hefkjmjovzpymtybyebw.supabase.co')) {
    return '';
  }
  return cleaned;
};

const isKeyValidForActiveProject = (key: string, url: string): boolean => {
  if (!key || key.includes('9KwMtGFOKB0zF17ozzG1rw')) return false;
  if (!url.includes(ACTIVE_PROJECT_REF)) return true;

  if (key.startsWith('eyJ')) {
    try {
      const parts = key.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return payload?.ref === ACTIVE_PROJECT_REF;
      }
    } catch {
      return false;
    }
  }
  return key === DEFAULT_SUPABASE_ANON_KEY || key.startsWith('sb_secret_');
};

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = sanitizeSupabaseUrl(rawUrl) || DEFAULT_SUPABASE_URL;

let candidateKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
if (!isKeyValidForActiveProject(candidateKey, supabaseUrl)) {
  candidateKey = DEFAULT_SUPABASE_ANON_KEY;
}
const supabaseAnonKey = candidateKey;

const resolveValidServiceKey = (anonKey: string): string => {
  const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!rawServiceKey || !isKeyValidForActiveProject(rawServiceKey, supabaseUrl)) {
    return anonKey;
  }
  return rawServiceKey;
};

const supabaseServiceKey = resolveValidServiceKey(supabaseAnonKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function sanitizeBackendAuthError(err: any, fallback = 'Não foi possível conectar. Tente novamente.'): string {
  const raw = String(err?.message || err || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return fallback;
  if (
    lower.includes('invalid api key') ||
    lower.includes('api-key-not-valid') ||
    lower.includes('jwt') ||
    lower.includes('fetch') ||
    lower.includes('timeout') ||
    lower.includes('econn')
  ) {
    console.error('[Monvian API Auth Diagnostic]', raw);
    return 'Não foi possível conectar. Tente novamente.';
  }
  return raw;
}

async function verifyFirebaseIdTokenServerless(
  idToken?: string
): Promise<{ uid: string; email: string; name?: string; avatarUrl?: string } | null> {
  if (!idToken || typeof idToken !== 'string' || idToken.length < 40) return null;
  const { apiKey, projectId } = getFirebaseConfigServerless();

  // 1. Primary: Cryptographic RS256 verification against Google's official public X.509 certs (zero API key dependency)
  const certVerified = await verifyFirebaseIdTokenWithPublicCerts(idToken, projectId);
  if (certVerified) {
    return certVerified;
  }

  // 2. Fallback: Firebase Identity Toolkit accounts:lookup
  if (!apiKey) {
    console.error('[Monvian API Auth] Firebase API key unavailable for fallback token verification.');
    return null;
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) {
      console.error('[Monvian API Auth] Identity Toolkit rejected token with status:', resp.status);
      return null;
    }
    const json: any = await resp.json();
    const fbUser = Array.isArray(json?.users) ? json.users[0] : null;
    if (!fbUser?.email) return null;
    return {
      uid: String(fbUser.localId || ''),
      email: String(fbUser.email).trim().toLowerCase(),
      name: fbUser.displayName ? String(fbUser.displayName).trim() : undefined,
      avatarUrl: fbUser.photoUrl ? String(fbUser.photoUrl).trim() : undefined,
    };
  } catch (err: any) {
    console.error('[Monvian API Auth] Identity Toolkit lookup failed:', err?.message || err);
    return null;
  }
}

const PRIMARY_ADMIN_EMAILS = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com', 'admin@monvian.com'];

function isPrimaryAdmin(email?: string | null): boolean {
  if (!email) return false;
  return PRIMARY_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

function formatSafeUser(u: any) {
  if (!u) return null;
  const isAdm =
    isPrimaryAdmin(u.email) ||
    isPrimaryAdmin(u.whatsapp) ||
    u.role === 'admin' ||
    u.role === 'superadmin';
  const isGold = isAdm || u.is_gold === 1 || u.plan === 'gold' || u.is_premium === 1;
  const rawTutorial = String(u.map_tutorial_status || '').trim().toLowerCase();
  const mapTutorialStatus =
    rawTutorial === 'pending' || rawTutorial === 'completed' || rawTutorial === 'skipped'
      ? rawTutorial
      : u.onboarding_completed === 0
        ? 'pending'
        : 'completed';
  return {
    id: u.id,
    name: u.name || (u.email ? u.email.split('@')[0] : 'Explorador'),
    username: u.username || (u.email ? u.email.split('@')[0] : 'explorador'),
    email: u.email || u.whatsapp || '',
    whatsapp: u.whatsapp || u.email || '',
    role: isAdm ? 'admin' : (u.role || 'user'),
    plan: isGold ? 'gold' : (u.plan || 'beta'),
    is_gold: isGold ? 1 : 0,
    isGold: Boolean(isGold),
    is_premium: u.is_premium ?? (isGold ? 1 : 0),
    isPremium: Boolean(isGold),
    avatar_url: u.avatar_url || '/fotoperfil.png',
    visits_count: u.visits_count || 1,
    is_banned: u.is_banned || 0,
    bio: u.bio || '',
    onboarding_completed: u.onboarding_completed ?? 1,
    onboarding_step: u.onboarding_step ?? 1,
    welcome_card_seen: u.welcome_card_seen ? 1 : 0,
    globe_intro_seen: u.globe_intro_seen ? 1 : 0,
    map_tutorial_status: mapTutorialStatus,
    map_tutorial_updated_at: u.map_tutorial_updated_at || null,
    location_permission_granted: u.location_permission_granted ?? 0,
    motion_permission_granted: u.motion_permission_granted ?? 0,
    created_at: u.created_at,
  };
}

interface PersistedOnboardingFlags {
  welcome_card_seen?: number;
  globe_intro_seen?: number;
  map_tutorial_status?: 'pending' | 'completed' | 'skipped';
  map_tutorial_updated_at?: string | null;
}

async function readPersistedOnboardingFlags(email: string): Promise<PersistedOnboardingFlags | null> {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return null;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', `user_onboarding_flags:${clean}`)
      .maybeSingle();
    if (!data?.value) return null;
    const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (parsed && typeof parsed === 'object') {
      return parsed as PersistedOnboardingFlags;
    }
  } catch {}
  return null;
}

async function writePersistedOnboardingFlags(
  email: string,
  patch: PersistedOnboardingFlags
): Promise<PersistedOnboardingFlags> {
  const clean = String(email || '').trim().toLowerCase();
  const existing = (await readPersistedOnboardingFlags(clean)) || {};
  const merged: PersistedOnboardingFlags = {
    ...existing,
    ...patch,
  };
  if (clean) {
    try {
      await supabase
        .from('system_settings')
        .upsert(
          {
            key: `user_onboarding_flags:${clean}`,
            value: JSON.stringify(merged),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
    } catch {}
  }
  return merged;
}

async function enrichSafeUserWithOnboardingFlags(safeUser: any) {
  if (!safeUser) return null;
  const email = String(safeUser.email || safeUser.whatsapp || '').trim().toLowerCase();
  if (!email) return safeUser;
  const persisted = await readPersistedOnboardingFlags(email);
  if (!persisted) return safeUser;
  const nextWelcome =
    typeof persisted.welcome_card_seen === 'number'
      ? persisted.welcome_card_seen
      : safeUser.welcome_card_seen;
  const nextGlobe =
    typeof persisted.globe_intro_seen === 'number'
      ? persisted.globe_intro_seen
      : safeUser.globe_intro_seen;
  const nextTutorial =
    persisted.map_tutorial_status === 'pending' ||
    persisted.map_tutorial_status === 'completed' ||
    persisted.map_tutorial_status === 'skipped'
      ? persisted.map_tutorial_status
      : safeUser.map_tutorial_status;
  return {
    ...safeUser,
    welcome_card_seen: nextWelcome ? 1 : 0,
    globe_intro_seen: nextGlobe ? 1 : 0,
    map_tutorial_status: nextTutorial,
    map_tutorial_updated_at: persisted.map_tutorial_updated_at ?? safeUser.map_tutorial_updated_at ?? null,
  };
}

async function generateUniqueUsernameServerless(
  baseInput: string,
  excludeUserId?: number
): Promise<{ username: string; username_normalized: string }> {
  const cleaned = String(baseInput || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
    .slice(0, 22);
  const base = cleaned.length >= 3 ? cleaned : `explorador${Math.floor(100 + Math.random() * 900)}`;

  try {
    const { data: rows } = await supabase
      .from('users')
      .select('id, username_normalized')
      .ilike('username_normalized', `${base}%`);

    const taken = new Set<string>();
    for (const r of rows || []) {
      if (excludeUserId && Number(r.id) === Number(excludeUserId)) continue;
      if (r.username_normalized) taken.add(String(r.username_normalized).toLowerCase());
    }

    if (!taken.has(base)) {
      return { username: base, username_normalized: base };
    }

    let counter = 2;
    while (taken.has(`${base}${counter}`) && counter < 1000) {
      counter++;
    }
    const candidate = `${base}${counter}`;
    return { username: candidate, username_normalized: candidate };
  } catch {
    const fallback = `${base}${Math.floor(10 + Math.random() * 89)}`;
    return { username: fallback, username_normalized: fallback };
  }
}

async function resolveAvatarUrlServerless(rawAvatar?: string, folder = 'avatars'): Promise<string> {
  if (!rawAvatar || typeof rawAvatar !== 'string' || !rawAvatar.trim()) {
    return '/fotoperfil.png';
  }
  const trimmed = rawAvatar.trim();
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  try {
    const match = trimmed.match(/^data:(image)\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const contentType = `${match[1]}/${match[2]}`;
      const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
      const buffer = Buffer.from(match[3], 'base64');
      const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('monvian-media')
        .upload(filePath, buffer, { contentType, upsert: true });
      if (!uploadErr && uploadData) {
        const { data: pubData } = supabase.storage.from('monvian-media').getPublicUrl(uploadData.path);
        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      }
    }
  } catch {}
  return trimmed;
}

async function findUserByEmailOrIdentifier(identifier: string): Promise<any | null> {
  const clean = String(identifier || '').trim().toLowerCase().replace(/^@+/, '');
  if (!clean) return null;

  try {
    const { data: exactEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', clean)
      .limit(1);
    if (exactEmail && exactEmail.length > 0) return exactEmail[0];
  } catch {}

  try {
    const { data: ciEmail } = await supabase
      .from('users')
      .select('*')
      .ilike('email', clean.replace(/[\\%_]/g, '\\$&'))
      .limit(5);
    const matched = (ciEmail || []).find(
      (r: any) => String(r?.email || '').trim().toLowerCase() === clean
    );
    if (matched) return matched;
  } catch {}

  try {
    const { data: exactWhatsapp } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp', clean)
      .limit(1);
    if (exactWhatsapp && exactWhatsapp.length > 0) return exactWhatsapp[0];
  } catch {}

  try {
    const { data: exactUsername } = await supabase
      .from('users')
      .select('*')
      .eq('username_normalized', clean)
      .limit(1);
    if (exactUsername && exactUsername.length > 0) return exactUsername[0];
  } catch {}

  return null;
}

const SESSION_SIGNING_SECRET =
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
const inMemoryRevokedTokenHashes = new Set<string>();

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 48);
}

function signPersistentSessionToken(user: {
  id: number | string;
  email?: string | null;
  whatsapp?: string | null;
  role?: string | null;
}): string {
  const cleanEmail = String(user.email || user.whatsapp || '')
    .trim()
    .toLowerCase();
  const now = Date.now();
  const payloadObj = {
    uid: user.id,
    email: cleanEmail,
    role: isPrimaryAdmin(cleanEmail) || user.role === 'admin' ? 'admin' : 'user',
    iat: now,
    exp: now + SESSION_TTL_MS,
    jti: crypto.randomUUID(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `mvn1.${payloadB64}.${sigB64}`;
}

function verifySignedSessionToken(token: string): {
  uid: number | string;
  email: string;
  role: string;
  iat: number;
  exp: number;
  jti: string;
} | null {
  if (!token || !token.startsWith('mvn1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SIGNING_SECRET)
      .update(payloadB64)
      .digest();
    const providedSig = Buffer.from(sigB64, 'base64url');
    if (expectedSig.length !== providedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || !payload.exp || Number(payload.exp) <= Date.now()) return null;
    return {
      uid: payload.uid,
      email: String(payload.email || '').trim().toLowerCase(),
      role: String(payload.role || 'user'),
      iat: Number(payload.iat || 0),
      exp: Number(payload.exp || 0),
      jti: String(payload.jti || ''),
    };
  } catch {
    return null;
  }
}

function extractRequestToken(req: any): string {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const t = authHeader.substring(7).trim();
    if (t) return t;
  }
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const sessionMatch = cookieHeader.match(/(?:^|;\s*)monvian_session=([^;]+)/);
    const legacyMatch = cookieHeader.match(/(?:^|;\s*)monvian_token=([^;]+)/);
    const rawCookie = sessionMatch?.[1] || legacyMatch?.[1];
    if (rawCookie) {
      try {
        return decodeURIComponent(rawCookie).trim();
      } catch {
        return rawCookie.trim();
      }
    }
  }
  return '';
}

function setPersistentSessionCookie(req: any, res: any, token: string): void {
  try {
    const proto = req?.headers?.['x-forwarded-proto'] || '';
    const isHttps = proto === 'https' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const cookieAttrs = isHttps
      ? 'Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=None; Partitioned'
      : 'Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax';
    res.setHeader('Set-Cookie', `monvian_session=${encodeURIComponent(token)}; ${cookieAttrs}`);
  } catch {}
}

function clearPersistentSessionCookie(req: any, res: any): void {
  try {
    const proto = req?.headers?.['x-forwarded-proto'] || '';
    const isHttps = proto === 'https' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const clearAttrs = isHttps
      ? 'Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None; Partitioned'
      : 'Max-Age=0; Path=/; HttpOnly; SameSite=Lax';
    res.setHeader('Set-Cookie', [
      `monvian_session=; ${clearAttrs}`,
      `monvian_token=; Max-Age=0; Path=/; SameSite=Lax${isHttps ? '; Secure' : ''}`,
    ]);
  } catch {}
}

async function isTokenRevokedServerless(token: string): Promise<boolean> {
  if (!token) return true;
  const tokenHash = hashSessionToken(token);
  if (inMemoryRevokedTokenHashes.has(tokenHash)) return true;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', `revoked_token:${tokenHash}`)
      .maybeSingle();
    if (data) {
      inMemoryRevokedTokenHashes.add(tokenHash);
      return true;
    }
  } catch {}
  return false;
}

async function getAuthUser(req: any, strictSession = false): Promise<any | null> {
  const token = extractRequestToken(req);

  if (token) {
    if (await isTokenRevokedServerless(token)) {
      return null;
    }

    // 1. Verify cryptographically signed persistent token (survives cold starts & DB session misses)
    const signed = verifySignedSessionToken(token);
    if (signed) {
      let userRow: any = null;
      if (signed.email) {
        userRow = await findUserByEmailOrIdentifier(signed.email);
      }
      if (!userRow && signed.uid && Number(signed.uid) < 2147483647) {
        try {
          const { data } = await supabase.from('users').select('*').eq('id', signed.uid).maybeSingle();
          if (data) userRow = data;
        } catch {}
      }
      if (userRow) {
        if (userRow.is_banned === 1 && !isPrimaryAdmin(userRow.email)) return null;
        return await enrichSafeUserWithOnboardingFlags(formatSafeUser(userRow));
      }
      if (signed.email && isPrimaryAdmin(signed.email)) {
        return formatSafeUser({
          id: signed.uid || 75,
          email: signed.email,
          name: 'Mario Admin',
          username: 'marioyesk',
          role: 'admin',
          is_gold: 1,
        });
      }
    }

    // 2. Check sessions table in Supabase
    try {
      const { data: sessionRow } = await supabase
        .from('sessions')
        .select('user_id')
        .eq('token', token)
        .maybeSingle();

      if (sessionRow?.user_id) {
        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', sessionRow.user_id)
          .maybeSingle();

        if (userRow) {
          if (userRow.is_banned === 1 && !isPrimaryAdmin(userRow.email)) return null;
          return await enrichSafeUserWithOnboardingFlags(formatSafeUser(userRow));
        }
      }
    } catch {}

    // 3. Check Supabase Auth JWT
    try {
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user?.email) {
        const userRow = await findUserByEmailOrIdentifier(authData.user.email);
        if (userRow) {
          if (userRow.is_banned === 1 && !isPrimaryAdmin(userRow.email)) return null;
          return await enrichSafeUserWithOnboardingFlags(formatSafeUser(userRow));
        }

        return formatSafeUser({
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.user_metadata?.name || authData.user.email.split('@')[0],
          role: isPrimaryAdmin(authData.user.email) ? 'admin' : 'user',
        });
      }
    } catch {}
  }

  if (strictSession) {
    return null;
  }

  // Fallback: check x-user-email header or body/query email if provided (non-strict legacy routes only)
  const headerEmail = String(
    req.headers['x-user-email'] ||
      req.body?.userEmail ||
      req.body?.email ||
      req.body?.username ||
      ''
  )
    .trim()
    .toLowerCase();

  if (headerEmail) {
    const existing = await findUserByEmailOrIdentifier(headerEmail);
    if (existing) {
      if (existing.is_banned === 1) return null;
      return formatSafeUser(existing);
    }
    if (isPrimaryAdmin(headerEmail)) {
      return formatSafeUser({
        id: 75,
        email: headerEmail,
        name: 'Mario Admin',
        username: 'marioyesk',
        role: 'admin',
        is_gold: 1,
      });
    }
  }

  return null;
}

const DEFAULT_PLATANOS_PACKAGES = [
  { id: 'pkg_15', platanos: 15, priceCents: 2990, priceBRL: 'R$ 29,90', badge: '', isBestValue: false, isActive: true, sortOrder: 1 },
  { id: 'pkg_30', platanos: 30, priceCents: 5490, priceBRL: 'R$ 54,90', badge: '', isBestValue: false, isActive: true, sortOrder: 2 },
  { id: 'pkg_60', platanos: 60, priceCents: 9990, priceBRL: 'R$ 99,90', badge: '', isBestValue: false, isActive: true, sortOrder: 3 },
  { id: 'pkg_100', platanos: 100, priceCents: 14990, priceBRL: 'R$ 149,90', badge: '', isBestValue: false, isActive: true, sortOrder: 4 },
  { id: 'pkg_200', platanos: 200, priceCents: 24990, priceBRL: 'R$ 249,90', badge: 'Melhor custo-benefício', isBestValue: true, isActive: true, sortOrder: 5 },
];

function formatCentsToBRL(cents: number): string {
  const reais = (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
  return `R$ ${reais}`;
}

let cachedStripeKey = '';

async function getStripeClientServerless(): Promise<Stripe | null> {
  const envKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (envKey) return new Stripe(envKey);
  if (cachedStripeKey) return new Stripe(cachedStripeKey);

  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'stripe_secret_key')
      .maybeSingle();
    const key = (data?.value || '').trim();
    if (key) {
      cachedStripeKey = key;
      return new Stripe(key);
    }
  } catch {}
  return null;
}

async function getPlatanosPackagesServerless(includeInactive = false): Promise<any[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'platanos_packages_json')
      .maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const legacyPkg15 = parsed.find((p: any) => p.id === 'pkg_15');
        if (legacyPkg15 && Number(legacyPkg15.priceCents) === 1590) {
          return includeInactive ? DEFAULT_PLATANOS_PACKAGES : DEFAULT_PLATANOS_PACKAGES.filter((p) => p.isActive);
        }
        return includeInactive ? parsed : parsed.filter((p: any) => p.isActive !== false);
      }
    }
  } catch {}
  return DEFAULT_PLATANOS_PACKAGES;
}

async function getItineraryPricesServerless(): Promise<Record<string, number>> {
  const prices: Record<string, number> = {
    'roteiro-classico-2-dias': 0,
    'roteiro-bate-volta-essencial': 0,
    'roteiro-romantico-montanhas': 15,
    'roteiro-natureza-aventura': 15,
    'roteiro-gastronomia-chocolates': 15,
  };
  try {
    const [itinsRes, customPricesRes] = await Promise.all([
      supabase.from('itineraries').select('id, is_premium, platanos_price'),
      supabase.from('system_settings').select('value').eq('key', 'platanos_itinerary_prices_json').maybeSingle(),
    ]);
    let customMap: Record<string, number> = {};
    if (customPricesRes.data?.value) {
      try {
        customMap = JSON.parse(customPricesRes.data.value) || {};
      } catch {}
    }
    for (const row of itinsRes.data || []) {
      const isPrem = Number(row.is_premium) === 1;
      const customVal = Number(customMap[row.id] ?? (row as any).platanos_price ?? 0);
      prices[row.id] = isPrem ? (customVal > 0 ? customVal : 15) : 0;
    }
    for (const [k, v] of Object.entries(customMap)) {
      if (prices[k] === undefined && Number(v) >= 0) {
        prices[k] = Number(v);
      }
    }
  } catch {}
  return prices;
}

async function loadUserPlatanosWallet(user: { id: number; email: string }) {
  const cleanEmail = (user.email || `uid_${user.id}`).trim().toLowerCase();
  const settingKey = `platanos_wallet_${cleanEmail}`;
  const [packages, itineraryPrices, walletRow] = await Promise.all([
    getPlatanosPackagesServerless(false),
    getItineraryPricesServerless(),
    supabase.from('system_settings').select('value').eq('key', settingKey).maybeSingle(),
  ]);

  let stored: any = null;
  if (walletRow.data?.value) {
    try {
      stored = JSON.parse(walletRow.data.value);
    } catch {}
  }

  return {
    userId: Number(user.id || stored?.userId || 1),
    userEmail: cleanEmail,
    balance: Number(stored?.balance || 0),
    totalCredited: Number(stored?.totalCredited || 0),
    totalSpent: Number(stored?.totalSpent || 0),
    unlockedItineraryIds: Array.isArray(stored?.unlockedItineraryIds) ? stored.unlockedItineraryIds : [],
    transactions: Array.isArray(stored?.transactions) ? stored.transactions : [],
    orders: Array.isArray(stored?.orders) ? stored.orders : [],
    packages,
    itineraryPrices,
  };
}

async function saveUserPlatanosWallet(wallet: any) {
  const cleanEmail = (wallet.userEmail || `uid_${wallet.userId || 1}`).trim().toLowerCase();
  const settingKey = `platanos_wallet_${cleanEmail}`;
  await supabase.from('system_settings').upsert(
    {
      key: settingKey,
      value: JSON.stringify(wallet),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
}

async function resolvePlatanosUserServerless(req: any, body: any, url: URL): Promise<{ id: number; email: string; name: string }> {
  const authUser = await getAuthUser(req);
  if (authUser && authUser.email) {
    return {
      id: Number(authUser.id || 1),
      email: String(authUser.email).trim().toLowerCase(),
      name: authUser.name || 'Explorador',
    };
  }
  const rawCandidate = String(
    req.headers['x-user-email'] ||
      body?.userEmail ||
      body?.email ||
      body?.username ||
      url.searchParams.get('email') ||
      ''
  )
    .trim()
    .toLowerCase();
  if (rawCandidate) {
    const cleanEmail = rawCandidate.includes('@') ? rawCandidate : `${rawCandidate.replace(/[^a-z0-9_]/g, '')}@monvian.com`;
    return {
      id: Number(body?.userId || 1),
      email: cleanEmail,
      name: cleanEmail.split('@')[0] || 'Explorador',
    };
  }
  return {
    id: 1,
    email: 'explorador@monvian.com',
    name: 'Explorador Monvian',
  };
}

async function creditPlatanosOrderServerless(params: {
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  userId?: number;
  userEmail?: string;
  packageId?: string;
}) {
  const orderKey = `platanos_order_${params.stripeSessionId}`;
  const { data: orderRow } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', orderKey)
    .maybeSingle();

  let orderObj: any = null;
  if (orderRow?.value) {
    try {
      orderObj = JSON.parse(orderRow.value);
    } catch {}
  }

  const targetEmail = (params.userEmail || orderObj?.userEmail || 'explorador@monvian.com').trim().toLowerCase();
  const targetUserId = Number(params.userId || orderObj?.userId || 1);
  const wallet = await loadUserPlatanosWallet({ id: targetUserId, email: targetEmail });

  const existingCompletedTx = wallet.transactions.find(
    (t: any) => t.referenceId === params.stripeSessionId && t.type === 'credit_purchase' && t.status === 'completed'
  );
  if (existingCompletedTx || (orderObj && orderObj.credited === 1 && orderObj.status === 'paid')) {
    return {
      alreadyCredited: true,
      creditedAmount: Number(orderObj?.platanosAmount || existingCompletedTx?.amount || 0),
      wallet,
    };
  }

  const pkgId = params.packageId || orderObj?.packageId || 'pkg_15';
  const packages = await getPlatanosPackagesServerless(true);
  const pkg = packages.find((p: any) => p.id === pkgId) || DEFAULT_PLATANOS_PACKAGES[0];
  const platanosToCredit = Number(orderObj?.platanosAmount || pkg.platanos || 15);
  const amountCents = Number(orderObj?.amountCents || pkg.priceCents || 2990);

  const balanceBefore = Number(wallet.balance || 0);
  const balanceAfter = balanceBefore + platanosToCredit;
  const nowIso = new Date().toISOString();
  const txId = `ptx_${crypto.randomUUID()}`;

  const newTx = {
    id: txId,
    userId: targetUserId,
    userEmail: targetEmail,
    type: 'credit_purchase',
    amount: platanosToCredit,
    balanceBefore,
    balanceAfter,
    status: 'completed',
    description: `Recarga de +${platanosToCredit} Plátanos (${formatCentsToBRL(amountCents)})`,
    referenceType: 'stripe_session',
    referenceId: params.stripeSessionId,
    createdAt: nowIso,
  };

  wallet.balance = balanceAfter;
  wallet.totalCredited = Number(wallet.totalCredited || 0) + platanosToCredit;
  wallet.transactions = [newTx, ...(wallet.transactions || [])].slice(0, 100);

  const updatedOrder = {
    ...(orderObj || {
      id: `ord_${crypto.randomUUID()}`,
      userId: targetUserId,
      userEmail: targetEmail,
      packageId: pkgId,
      platanosAmount: platanosToCredit,
      amountCents,
      currency: 'brl',
      stripeSessionId: params.stripeSessionId,
      createdAt: nowIso,
    }),
    stripePaymentIntentId: params.stripePaymentIntentId || orderObj?.stripePaymentIntentId || null,
    status: 'paid',
    credited: 1,
    updatedAt: nowIso,
  };

  const otherOrders = (wallet.orders || []).filter((o: any) => o.stripeSessionId !== params.stripeSessionId);
  wallet.orders = [updatedOrder, ...otherOrders].slice(0, 50);

  await Promise.all([
    saveUserPlatanosWallet(wallet),
    supabase.from('system_settings').upsert(
      {
        key: orderKey,
        value: JSON.stringify(updatedOrder),
        updated_at: nowIso,
      },
      { onConflict: 'key' }
    ),
    invalidateStripeSnapshotCacheServerless(supabase),
  ]);

  return {
    alreadyCredited: false,
    creditedAmount: platanosToCredit,
    wallet,
  };
}

async function readJsonBodyServerless(req: any, method: string): Promise<any> {
  if (req?.body !== undefined && req?.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      const raw = req.body.toString('utf8').trim();
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    if (typeof req.body === 'string') {
      const trimmed = req.body.trim();
      if (!trimmed) return {};
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return req.body;
  }

  if (
    (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
    typeof req?.on === 'function' &&
    !req.readableEnded
  ) {
    try {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => resolve(), 5000);
        req.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on('end', () => {
          clearTimeout(timer);
          resolve();
        });
        req.on('error', (err: any) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
    } catch {}
  }

  return {};
}

export default async function handler(req: any, res: any) {
  // Scoped CORS for same-host and trusted deployments (never wildcard on authenticated routes)
  const origin = String(req.headers?.origin || '').trim();
  const reqHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').trim().toLowerCase();
  let isAllowedOrigin = false;
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      const originHost = parsedOrigin.host.toLowerCase();
      if (
        (reqHost && originHost === reqHost) ||
        parsedOrigin.hostname === 'localhost' ||
        parsedOrigin.hostname === '127.0.0.1' ||
        parsedOrigin.hostname.endsWith('.vercel.app') ||
        parsedOrigin.hostname.endsWith('.run.app') ||
        parsedOrigin.hostname === 'monvians.com.br' ||
        parsedOrigin.hostname.endsWith('.monvians.com.br')
      ) {
        isAllowedOrigin = true;
      }
    } catch {}
  }
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-email, x-monvian-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url || '/', `https://${req.headers?.host || 'localhost'}`);
  let rawPath = url.pathname;

  // Extract rewritten path cleanly across all Vercel rewrite formats (:path*, array query, header fallback)
  const pathParams = url.searchParams.getAll('__path').filter(Boolean);
  let rewrittenPath = pathParams.length > 0 ? pathParams.join('/') : '';
  if (!rewrittenPath && req?.query?.__path) {
    rewrittenPath = Array.isArray(req.query.__path)
      ? req.query.__path.join('/')
      : String(req.query.__path);
  }
  const isInvalidRewriteParam =
    !rewrittenPath ||
    rewrittenPath === '/index' ||
    rewrittenPath === 'index' ||
    rewrittenPath === '/api/index' ||
    rewrittenPath.includes('$1') ||
    rewrittenPath.includes(':path');

  if (!isInvalidRewriteParam) {
    rawPath = rewrittenPath;
    url.searchParams.delete('__path');
  } else if (rawPath === '/api/index' || rawPath === '/index' || rawPath === '/') {
    const origUrl = String(
      req.headers?.['x-vercel-original-url'] ||
        req.headers?.['x-forwarded-uri'] ||
        req.headers?.['x-invoke-path'] ||
        req.headers?.['x-original-url'] ||
        ''
    );
    if (origUrl) {
      try {
        const parsedOrig = new URL(origUrl, 'https://localhost').pathname;
        if (parsedOrig && parsedOrig !== '/api/index' && parsedOrig !== '/index') {
          rawPath = parsedOrig;
        }
      } catch {}
    }
  }

  if (rawPath.startsWith('/api/')) {
    rawPath = rawPath.slice(4);
  } else if (rawPath === '/api') {
    rawPath = '/';
  }
  if (!rawPath.startsWith('/')) {
    rawPath = '/' + rawPath;
  }
  // Normalize duplicate slashes and trim trailing slash for uniform routing
  rawPath = rawPath.replace(/\/{2,}/g, '/');
  const cleanPath = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const method = req.method?.toUpperCase() || 'GET';

  const body = await readJsonBodyServerless(req, method);

  try {
    // =========================================================================
    // 1. HEALTH CHECK
    // =========================================================================
    if (cleanPath === '' || cleanPath === '/' || cleanPath === '/health') {
      return res.status(200).json({
        status: 'healthy',
        service: 'monvian-api',
        supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
        timestamp: new Date().toISOString(),
      });
    }

    // =========================================================================
    // 2. AUTHENTICATION & USER PROFILE
    // =========================================================================
    if (cleanPath === '/auth/login' && method === 'POST') {
      const { identifier, email, whatsapp, password, firebase_id_token, firebase_uid } = body || {};
      const loginId = String(identifier || email || whatsapp || '')
        .trim()
        .toLowerCase()
        .replace(/^@+/, '');

      if (!loginId || (!password && !firebase_id_token)) {
        return res.status(400).json({ success: false, error: 'Informe seu e-mail e sua senha.' });
      }

      const verifiedFirebase = firebase_id_token
        ? await verifyFirebaseIdTokenServerless(firebase_id_token)
        : null;

      let user = await findUserByEmailOrIdentifier(verifiedFirebase?.email || loginId);

      if (user?.is_banned === 1 && !isPrimaryAdmin(user.email)) {
        return res.status(403).json({
          success: false,
          error: 'Esta conta encontra-se suspensa. Entre em contato com o suporte.',
        });
      }

      let authSuccess = Boolean(
        verifiedFirebase?.email &&
          (!loginId.includes('@') || verifiedFirebase.email === loginId)
      );

      // 1. Check password hash stored in users table (for existing legacy accounts)
      if (!authSuccess && user?.password_hash && password) {
        try {
          if (user.password_hash.startsWith('$2')) {
            authSuccess = bcrypt.compareSync(String(password), user.password_hash);
          } else if (
            user.password_hash !== 'google_oauth' &&
            user.password_hash !== 'supabase_auth' &&
            user.password_hash !== 'profile_sync' &&
            user.password_hash === String(password)
          ) {
            authSuccess = true;
          }
        } catch {}
      }

      // 2. Check Supabase Auth only if needed for legacy accounts without local hash
      const emailToAuth = user?.email || (loginId.includes('@') ? loginId : '');
      if (!authSuccess && emailToAuth && password) {
        try {
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: emailToAuth,
            password: String(password),
          });
          if (!authErr && authData?.user) {
            authSuccess = true;
          }
        } catch {}
      }

      if (!user && !authSuccess) {
        return res.status(401).json({
          success: false,
          error: 'E-mail ou senha incorretos.',
        });
      }

      if (!authSuccess) {
        if (user?.password_hash === 'google_oauth') {
          return res.status(401).json({
            success: false,
            error: 'Esta conta foi criada com o Google. Clique em "Entrar com Google / Gmail" abaixo.',
          });
        }
        return res.status(401).json({
          success: false,
          error: 'E-mail ou senha incorretos.',
        });
      }

      const nowIso = new Date().toISOString();

      // Ensure user exists in public.users with a valid integer ID
      if (!user) {
        const cleanEmail = emailToAuth || `${loginId}@monvian.com`;
        const { username, username_normalized } = await generateUniqueUsernameServerless(
          cleanEmail.split('@')[0]
        );
        const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';
        const isGold = role === 'admin' ? 1 : 0;
        const hash = bcrypt.hashSync(String(password), 10);

        const { data: createdUser } = await supabase
          .from('users')
          .insert({
            name: role === 'admin' ? 'Mario Admin' : cleanEmail.split('@')[0],
            username,
            username_normalized,
            email: cleanEmail,
            whatsapp: cleanEmail,
            password_hash: hash,
            role,
            is_gold: isGold,
            is_premium: isGold,
            plan: isGold ? 'gold' : 'beta',
            avatar_url: '/fotoperfil.png',
            onboarding_completed: 1,
            visits_count: 1,
            last_access: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select()
          .single();

        user = createdUser || {
          id: 75,
          email: cleanEmail,
          whatsapp: cleanEmail,
          name: role === 'admin' ? 'Mario Admin' : cleanEmail.split('@')[0],
          username,
          role,
          is_gold: isGold,
        };
      } else {
        // Update visits_count and last_access
        const nextVisits = Number(user.visits_count || 0) + 1;
        const nextRole = isPrimaryAdmin(user.email) || user.role === 'admin' ? 'admin' : (user.role || 'user');
        const nextGold = nextRole === 'admin' || user.is_gold === 1 ? 1 : 0;
        try {
          const { data: updatedUser } = await supabase
            .from('users')
            .update({
              visits_count: nextVisits,
              last_access: nowIso,
              role: nextRole,
              is_gold: nextGold,
              updated_at: nowIso,
            })
            .eq('id', user.id)
            .select()
            .single();
          if (updatedUser) user = updatedUser;
        } catch {}
      }

      const token = signPersistentSessionToken(user);
      if (user?.id && Number(user.id) < 2147483647) {
        try {
          await supabase.from('sessions').insert({
            token,
            user_id: Number(user.id),
            created_at: nowIso,
          });
        } catch {}
      }

      setPersistentSessionCookie(req, res, token);

      return res.status(200).json({
        success: true,
        token,
        user: await enrichSafeUserWithOnboardingFlags(formatSafeUser(user)),
      });
    }

    if (cleanPath === '/auth/register' && method === 'POST') {
      const { name, email, password, whatsapp, avatar_url, firebase_id_token, supabase_auth_id } = body || {};
      const cleanEmail = String(email || whatsapp || '')
        .trim()
        .toLowerCase();
      const cleanName = String(name || '').trim();

      if (!cleanName || cleanName.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe seu nome completo.',
        });
      }

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Por favor, informe um endereço de e-mail válido.',
        });
      }

      if (!password || String(password).length < 6) {
        return res.status(400).json({
          success: false,
          error: 'A senha deve ter pelo menos 6 caracteres.',
        });
      }

      // Check if account already exists in public.users
      const existingUser = await findUserByEmailOrIdentifier(cleanEmail);
      const hash = bcrypt.hashSync(String(password), 10);
      const nowIso = new Date().toISOString();
      const resolvedAvatar = await resolveAvatarUrlServerless(avatar_url, 'avatars');
      const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';
      const isGold = role === 'admin' ? 1 : 0;

      if (existingUser) {
        const verifiedFirebase = firebase_id_token
          ? await verifyFirebaseIdTokenServerless(firebase_id_token)
          : null;
        const canUpgradeOAuthAccount =
          verifiedFirebase?.email === cleanEmail &&
          (existingUser.password_hash === 'google_oauth' ||
            existingUser.password_hash === 'supabase_auth' ||
            existingUser.password_hash === 'profile_sync' ||
            !existingUser.password_hash);

        if (!canUpgradeOAuthAccount) {
          return res.status(409).json({
            success: false,
            error: 'Este e-mail já está cadastrado. Faça login na sua conta.',
          });
        }

        // Upgrade verified OAuth / synced account with the new password and profile info
        const preservedRole = role === 'admin' || existingUser.role === 'admin' ? 'admin' : 'user';
        const preservedGold = preservedRole === 'admin' || existingUser.is_gold === 1 ? 1 : 0;
        const { data: updatedUser, error: updErr } = await supabase
          .from('users')
          .update({
            name: cleanName || existingUser.name,
            password_hash: hash,
            avatar_url:
              resolvedAvatar !== '/fotoperfil.png'
                ? resolvedAvatar
                : existingUser.avatar_url || '/fotoperfil.png',
            role: preservedRole,
            is_gold: preservedGold,
            onboarding_completed: 0,
            onboarding_step: 1,
            last_access: nowIso,
            updated_at: nowIso,
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updErr) {
          console.error('[Monvian API Register Update Error]', updErr);
          return res.status(500).json({
            success: false,
            error: sanitizeBackendAuthError(updErr, 'Não foi possível concluir seu cadastro. Tente novamente.'),
          });
        }

        const token = signPersistentSessionToken(updatedUser);
        if (updatedUser?.id && Number(updatedUser.id) < 2147483647) {
          try {
            await supabase.from('sessions').insert({
              token,
              user_id: Number(updatedUser.id),
              created_at: nowIso,
            });
          } catch {}
        }

        await writePersistedOnboardingFlags(cleanEmail, {
          welcome_card_seen: 0,
          globe_intro_seen: 0,
          map_tutorial_status: 'pending',
          map_tutorial_updated_at: null,
        });

        setPersistentSessionCookie(req, res, token);

        return res.status(200).json({
          success: true,
          token,
          user: await enrichSafeUserWithOnboardingFlags(formatSafeUser(updatedUser)),
          isNewUser: true,
        });
      }

      // Generate collision-free username & username_normalized
      const { username, username_normalized } = await generateUniqueUsernameServerless(
        cleanName || cleanEmail.split('@')[0]
      );

      // Ensure whatsapp is never empty string "" (which violates users_whatsapp_key unique constraint)
      const safeWhatsapp = String(whatsapp || cleanEmail).trim().toLowerCase() || cleanEmail;

      // IMPORTANT: Never write Firebase UIDs into public.users.auth_id (UUID FK -> auth.users.id)
      const payload: any = {
        name: cleanName || cleanEmail.split('@')[0],
        username,
        username_normalized,
        email: cleanEmail,
        whatsapp: safeWhatsapp,
        password_hash: hash,
        role,
        is_gold: isGold,
        is_premium: isGold,
        plan: isGold ? 'gold' : 'beta',
        avatar_url: resolvedAvatar,
        onboarding_completed: 0,
        onboarding_step: 1,
        visits_count: 1,
        last_access: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
      if (supabase_auth_id && UUID_V4_LIKE_REGEX.test(String(supabase_auth_id))) {
        payload.auth_id = String(supabase_auth_id);
      }

      let inserted: any = null;
      let insErr: any = null;

      const firstAttempt = await supabase.from('users').insert(payload).select().single();
      inserted = firstAttempt.data;
      insErr = firstAttempt.error;

      // Retry with randomized username/whatsapp suffix (and without auth_id) if any constraint occurred
      if (insErr) {
        console.error('[Monvian API Register First Insert Error]', insErr);
        const msg = String(insErr.message || '').toLowerCase();
        if (msg.includes('users_email_key') || (msg.includes('duplicate key') && msg.includes('email'))) {
          return res.status(409).json({
            success: false,
            error: 'Este e-mail já possui uma conta.',
          });
        }
        const retrySuffix = Math.floor(1000 + Math.random() * 9000);
        const retryUsername = `${username.slice(0, 18)}${retrySuffix}`;
        const { auth_id: _droppedAuthId, ...retryBase } = payload;
        const retryPayload = {
          ...retryBase,
          username: retryUsername,
          username_normalized: retryUsername.toLowerCase(),
          whatsapp: cleanEmail,
        };
        const retryAttempt = await supabase.from('users').insert(retryPayload).select().single();
        inserted = retryAttempt.data;
        insErr = retryAttempt.error;
      }

      if (insErr || !inserted) {
        console.error('[Monvian API Register Final Insert Error]', insErr);
        return res.status(500).json({
          success: false,
          error: sanitizeBackendAuthError(insErr, 'Não foi possível concluir o cadastro no momento.'),
        });
      }

      const token = signPersistentSessionToken(inserted);
      if (inserted?.id && Number(inserted.id) < 2147483647) {
        try {
          await supabase.from('sessions').insert({
            token,
            user_id: Number(inserted.id),
            created_at: nowIso,
          });
        } catch {}
      }

      await writePersistedOnboardingFlags(cleanEmail, {
        welcome_card_seen: 0,
        globe_intro_seen: 0,
        map_tutorial_status: 'pending',
        map_tutorial_updated_at: null,
      });

      setPersistentSessionCookie(req, res, token);

      return res.status(200).json({
        success: true,
        token,
        user: await enrichSafeUserWithOnboardingFlags(formatSafeUser(inserted)),
        isNewUser: true,
      });
    }

    // Google OAuth Authentication Route (POST & GET)
    if (cleanPath === '/auth/google' || cleanPath === '/auth/google/callback') {
      if (method === 'GET') {
        const accept = String(req.headers.accept || '');
        if (accept.includes('application/json')) {
          return res.status(200).json({
            success: true,
            provider: 'google',
            message: 'Use POST /api/auth/google com os dados da conta autenticada.',
          });
        }
        res.setHeader('Location', '/?google_auth=1');
        return res.status(302).end();
      }

      if (method === 'POST') {
        const { name, avatar_url, idToken } = body || {};

        if (!idToken || typeof idToken !== 'string') {
          return res.status(401).json({
            success: false,
            error: 'Não foi possível validar sua sessão do Google. Tente novamente.',
          });
        }

        // Verify Firebase ID Token via Identity Toolkit (authoritative email & identity)
        const verified = await verifyFirebaseIdTokenServerless(idToken);
        if (!verified?.email || !verified.email.includes('@')) {
          return res.status(401).json({
            success: false,
            error: 'Não foi possível entrar com Google. Tente novamente.',
          });
        }

        const resolvedEmail = verified.email;
        const resolvedName = verified.name || String(name || '').trim();
        const resolvedAvatar = verified.avatarUrl || String(avatar_url || '').trim();

        const nowIso = new Date().toISOString();
        let user = await findUserByEmailOrIdentifier(resolvedEmail);
        let isNewUser = false;

        if (user) {
          if (user.is_banned === 1 && !isPrimaryAdmin(user.email)) {
            return res.status(403).json({
              success: false,
              error: 'Esta conta encontra-se suspensa.',
            });
          }

          const role = isPrimaryAdmin(resolvedEmail) || user.role === 'admin' ? 'admin' : (user.role || 'user');
          const isGold = role === 'admin' || user.is_gold === 1 ? 1 : 0;
          const updatedName =
            !user.name || user.name === 'Explorador' || user.name === 'Visitante'
              ? resolvedName || user.name || resolvedEmail.split('@')[0]
              : user.name;
          const updatedAvatar =
            (!user.avatar_url || user.avatar_url === '/fotoperfil.png') && resolvedAvatar
              ? resolvedAvatar
              : user.avatar_url || '/fotoperfil.png';

          // IMPORTANT: Do not write Firebase UID into public.users.auth_id (UUID FK -> auth.users.id)
          const { data: updatedRow, error: updErr } = await supabase
            .from('users')
            .update({
              name: updatedName,
              email: resolvedEmail,
              avatar_url: updatedAvatar,
              role,
              is_gold: isGold,
              is_premium: isGold,
              plan: isGold ? 'gold' : (user.plan || 'beta'),
              visits_count: Number(user.visits_count || 0) + 1,
              last_access: nowIso,
              updated_at: nowIso,
            })
            .eq('id', user.id)
            .select()
            .single();

          if (updErr) {
            console.error('[Monvian API Google Update Error]', updErr);
          }
          if (updatedRow) user = updatedRow;
        } else {
          isNewUser = true;
          const role = isPrimaryAdmin(resolvedEmail) ? 'admin' : 'user';
          const isGold = role === 'admin' ? 1 : 0;
          const cleanName = resolvedName || resolvedEmail.split('@')[0];
          const { username, username_normalized } = await generateUniqueUsernameServerless(
            cleanName || resolvedEmail.split('@')[0]
          );

          // IMPORTANT: Do not write Firebase UID into public.users.auth_id (UUID FK -> auth.users.id)
          const insertPayload: any = {
            name: cleanName,
            username,
            username_normalized,
            email: resolvedEmail,
            whatsapp: resolvedEmail,
            password_hash: 'google_oauth',
            role,
            is_gold: isGold,
            is_premium: isGold,
            plan: isGold ? 'gold' : 'beta',
            avatar_url: resolvedAvatar || '/fotoperfil.png',
            onboarding_completed: 0,
            onboarding_step: 1,
            visits_count: 1,
            last_access: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          };

          const { data: createdRow, error: createErr } = await supabase
            .from('users')
            .insert(insertPayload)
            .select()
            .single();

          if (createErr) {
            console.error('[Monvian API Google First Insert Error]', createErr);
            const retrySuffix = Math.floor(1000 + Math.random() * 9000);
            const retryUsername = `${username.slice(0, 18)}${retrySuffix}`;
            const { data: retryRow, error: retryErr } = await supabase
              .from('users')
              .insert({
                ...insertPayload,
                username: retryUsername,
                username_normalized: retryUsername.toLowerCase(),
              })
              .select()
              .single();

            if (retryErr || !retryRow) {
              console.error('[Monvian API Google Final Insert Error]', retryErr || createErr);
              return res.status(500).json({
                success: false,
                error: sanitizeBackendAuthError(retryErr || createErr, 'Não foi possível entrar com Google. Tente novamente.'),
              });
            }
            user = retryRow;
          } else {
            user = createdRow;
          }
        }

        const token = signPersistentSessionToken(user);
        if (user?.id && Number(user.id) < 2147483647) {
          try {
            await supabase.from('sessions').insert({
              token,
              user_id: Number(user.id),
              created_at: nowIso,
            });
          } catch {}
        }

        if (isNewUser && resolvedEmail) {
          await writePersistedOnboardingFlags(resolvedEmail, {
            welcome_card_seen: 0,
            globe_intro_seen: 0,
            map_tutorial_status: 'pending',
            map_tutorial_updated_at: null,
          });
        }

        setPersistentSessionCookie(req, res, token);

        return res.status(200).json({
          success: true,
          token,
          user: await enrichSafeUserWithOnboardingFlags(formatSafeUser(user)),
          isNewUser,
        });
      }
    }

    if (cleanPath === '/auth/sync-password' && method === 'POST') {
      const { firebase_id_token, new_password } = body || {};
      if (!firebase_id_token || !new_password || String(new_password).length < 6) {
        return res.status(400).json({ success: false, error: 'Dados inválidos para atualização de senha.' });
      }
      const verified = await verifyFirebaseIdTokenServerless(firebase_id_token);
      if (!verified?.email) {
        return res.status(401).json({ success: false, error: 'Sessão de redefinição inválida ou expirada.' });
      }
      const existing = await findUserByEmailOrIdentifier(verified.email);
      if (existing) {
        const hash = bcrypt.hashSync(String(new_password), 10);
        await supabase
          .from('users')
          .update({
            password_hash: hash,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
      return res.status(200).json({ success: true });
    }

    if (cleanPath === '/auth/supabase-sync' && method === 'POST') {
      const { access_token } = body || {};
      if (!access_token) {
        return res.status(400).json({ success: false, error: 'Token Supabase ausente' });
      }
      const { data: authData, error: authErr } = await supabase.auth.getUser(String(access_token));
      if (authErr || !authData?.user?.email) {
        return res.status(401).json({ success: false, error: 'Sessão Supabase inválida' });
      }

      const cleanEmail = authData.user.email.trim().toLowerCase();
      const nowIso = new Date().toISOString();
      let user = await findUserByEmailOrIdentifier(cleanEmail);

      if (!user) {
        const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';
        const isGold = role === 'admin' ? 1 : 0;
        const displayName =
          authData.user.user_metadata?.full_name ||
          authData.user.user_metadata?.name ||
          cleanEmail.split('@')[0];
        const { username, username_normalized } = await generateUniqueUsernameServerless(displayName);

        const { data: created } = await supabase
          .from('users')
          .insert({
            auth_id: authData.user.id,
            name: displayName,
            username,
            username_normalized,
            email: cleanEmail,
            whatsapp: cleanEmail,
            password_hash: 'supabase_auth',
            avatar_url: authData.user.user_metadata?.avatar_url || '/fotoperfil.png',
            role,
            is_gold: isGold,
            is_premium: isGold,
            plan: isGold ? 'gold' : 'beta',
            onboarding_completed: 1,
            visits_count: 1,
            last_access: nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select()
          .single();

        user = created;
      }

      const token = signPersistentSessionToken(user);
      if (user?.id && Number(user.id) < 2147483647) {
        try {
          await supabase.from('sessions').insert({
            token,
            user_id: Number(user.id),
            created_at: nowIso,
          });
        } catch {}
      }

      setPersistentSessionCookie(req, res, token);

      return res.status(200).json({
        success: true,
        token,
        user: formatSafeUser(user),
      });
    }

    if (cleanPath === '/auth/recover-password' && method === 'POST') {
      const cleanEmail = String(body?.email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'Informe um endereço de e-mail válido.' });
      }

      try {
        const host = req.headers.host || 'monvians.com.br';
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const redirectOrigin = process.env.APP_URL || `${proto}://${host}`;
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectOrigin,
        });
      } catch {}

      return res.status(200).json({
        success: true,
        message: 'Instruções de recuperação de senha enviadas para seu e-mail.',
      });
    }

    if (cleanPath === '/auth/welcome-seen' && method === 'POST') {
      const currentUser = await getAuthUser(req);
      const email = String(body?.email || currentUser?.email || body?.identifier || '')
        .trim()
        .toLowerCase();

      if (!currentUser && !email) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }

      let updatedUser = currentUser;
      if (email) {
        await writePersistedOnboardingFlags(email, { welcome_card_seen: 1 });
        try {
          const { data } = await supabase
            .from('users')
            .update({ welcome_card_seen: 1, updated_at: new Date().toISOString() })
            .ilike('email', email)
            .select()
            .maybeSingle();
          if (data) updatedUser = await enrichSafeUserWithOnboardingFlags(formatSafeUser(data));
        } catch {}
      }

      return res.status(200).json({
        success: true,
        user: updatedUser ? { ...updatedUser, welcome_card_seen: 1 } : null,
      });
    }

    if (cleanPath === '/auth/globe-intro-seen' && method === 'POST') {
      const currentUser = await getAuthUser(req);
      const email = String(body?.email || currentUser?.email || body?.identifier || '')
        .trim()
        .toLowerCase();

      if (!currentUser && !email) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }

      let updatedUser = currentUser;
      if (email) {
        await writePersistedOnboardingFlags(email, { globe_intro_seen: 1 });
        try {
          const { data } = await supabase
            .from('users')
            .update({ globe_intro_seen: 1, updated_at: new Date().toISOString() })
            .ilike('email', email)
            .select()
            .maybeSingle();
          if (data) updatedUser = await enrichSafeUserWithOnboardingFlags(formatSafeUser(data));
        } catch {}
      }

      return res.status(200).json({
        success: true,
        user: updatedUser ? { ...updatedUser, globe_intro_seen: 1 } : null,
      });
    }

    if (cleanPath === '/user/map-tutorial' && method === 'GET') {
      const currentUser = await getAuthUser(req, true);
      if (!currentUser) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      return res.status(200).json({
        success: true,
        status: currentUser.map_tutorial_status || 'completed',
        updatedAt: currentUser.map_tutorial_updated_at || null,
        user: currentUser,
      });
    }

    if (cleanPath === '/user/map-tutorial' && method === 'POST') {
      const currentUser = await getAuthUser(req, true);
      if (!currentUser) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      const rawStatus = String(body?.status || '').trim().toLowerCase();
      if (rawStatus !== 'completed' && rawStatus !== 'skipped') {
        return res.status(400).json({ success: false, error: 'Status inválido para tutorial.' });
      }
      const nowIso = new Date().toISOString();
      const email = String(currentUser.email || currentUser.whatsapp || '').trim().toLowerCase();
      if (email) {
        await writePersistedOnboardingFlags(email, {
          map_tutorial_status: rawStatus as 'completed' | 'skipped',
          map_tutorial_updated_at: nowIso,
        });
        try {
          await supabase
            .from('users')
            .update({
              map_tutorial_status: rawStatus,
              map_tutorial_updated_at: nowIso,
              updated_at: nowIso,
            })
            .ilike('email', email);
        } catch {}
      }
      const refreshedUser = {
        ...currentUser,
        map_tutorial_status: rawStatus,
        map_tutorial_updated_at: nowIso,
      };
      return res.status(200).json({
        success: true,
        status: rawStatus,
        updatedAt: nowIso,
        user: refreshedUser,
      });
    }

    if (cleanPath === '/auth/me' && method === 'GET') {
      const user = await getAuthUser(req, true);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      const currentToken = extractRequestToken(req);
      let refreshedToken: string | undefined;
      const signed = currentToken ? verifySignedSessionToken(currentToken) : null;
      if (!signed || Date.now() - signed.iat > TOKEN_REFRESH_THRESHOLD_MS) {
        refreshedToken = signPersistentSessionToken(user);
        if (user?.id && Number(user.id) < 2147483647) {
          try {
            await supabase.from('sessions').insert({
              token: refreshedToken,
              user_id: Number(user.id),
              created_at: new Date().toISOString(),
            });
          } catch {}
        }
        setPersistentSessionCookie(req, res, refreshedToken);
      }
      return res.status(200).json({
        success: true,
        user,
        ...(refreshedToken ? { refreshedToken } : {}),
      });
    }

    if (cleanPath === '/auth/logout' && method === 'POST') {
      const requestToken = extractRequestToken(req);
      const bodyToken = typeof body?.token === 'string' ? body.token.trim() : '';
      const tokens = Array.from(new Set([requestToken, bodyToken].filter(Boolean)));
      for (const token of tokens) {
        const tokenHash = hashSessionToken(token);
        inMemoryRevokedTokenHashes.add(tokenHash);
        try {
          await supabase.from('sessions').delete().eq('token', token);
        } catch {}
        try {
          await supabase
            .from('system_settings')
            .upsert(
              {
                key: `revoked_token:${tokenHash}`,
                value: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'key' }
            );
        } catch {}
      }
      clearPersistentSessionCookie(req, res);
      return res.status(200).json({ success: true });
    }

    if ((cleanPath === '/user/profile' || cleanPath === '/auth/profile') && (method === 'POST' || method === 'PUT')) {
      const currentUser = await getAuthUser(req);
      const targetEmail = String(body?.email || body?.whatsapp || currentUser?.email || '')
        .trim()
        .toLowerCase();
      if (!targetEmail && !currentUser) {
        return res.status(400).json({ success: false, error: 'E-mail ou sessão necessária' });
      }

      const existing = await findUserByEmailOrIdentifier(targetEmail || currentUser?.email || '');
      const role =
        isPrimaryAdmin(targetEmail) || currentUser?.role === 'admin' || existing?.role === 'admin'
          ? 'admin'
          : 'user';
      const isGold =
        role === 'admin' || currentUser?.is_gold === 1 || existing?.is_gold === 1 ? 1 : 0;

      const resolvedAvatar = body?.avatar_url
        ? await resolveAvatarUrlServerless(body.avatar_url, 'avatars')
        : existing?.avatar_url || currentUser?.avatar_url || '/fotoperfil.png';

      const cleanUsernameInput = String(
        body?.username || existing?.username || body?.name || targetEmail.split('@')[0] || 'explorador'
      )
        .trim()
        .replace(/^@+/, '');

      const { username, username_normalized } = await generateUniqueUsernameServerless(
        cleanUsernameInput,
        existing?.id || currentUser?.id
      );

      const updateData: any = {
        name: body?.name || existing?.name || currentUser?.name || username,
        username,
        username_normalized,
        bio: body?.bio !== undefined ? body.bio : (existing?.bio || ''),
        avatar_url: resolvedAvatar,
        email: targetEmail || existing?.email || currentUser?.email,
        whatsapp: body?.whatsapp || targetEmail || existing?.whatsapp || currentUser?.email,
        role,
        is_gold: isGold,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }
        return res.status(200).json({ success: true, user: formatSafeUser(data) });
      } else {
        const { data, error } = await supabase
          .from('users')
          .insert({
            ...updateData,
            password_hash: 'profile_sync',
            onboarding_completed: 1,
            visits_count: 1,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }
        return res.status(200).json({ success: true, user: formatSafeUser(data) });
      }
    }

    if (
      (cleanPath === '/user/onboarding/step' ||
        cleanPath === '/user/onboarding/complete' ||
        cleanPath === '/user/onboarding/preferences') &&
      (method === 'POST' || method === 'PUT')
    ) {
      const currentUser = await getAuthUser(req);
      const emailParam = String(req.headers['x-user-email'] || body?.email || body?.user_email || '').trim().toLowerCase();
      const targetEmail = String(currentUser?.email || emailParam || '').trim().toLowerCase();
      if (!targetEmail) {
        return res.status(400).json({ success: false, error: 'E-mail do usuário não identificado.' });
      }
      const markComplete =
        cleanPath === '/user/onboarding/complete' || cleanPath === '/user/onboarding/preferences' || Boolean(body?.onboarding_completed);
      const nextStep = Math.max(1, Math.min(4, Number(body?.onboarding_step) || (markComplete ? 4 : 1)));
      const nowIso = new Date().toISOString();

      let existingPrefs: any = {};
      try {
        const { data: prefRow } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', `onboarding_${targetEmail}`)
          .maybeSingle();
        if (prefRow?.value) {
          existingPrefs = JSON.parse(prefRow.value);
        }
      } catch {}

      const mergedPrefs = {
        ...existingPrefs,
        ...(body || {}),
        user_email: targetEmail,
        onboarding_step: nextStep,
        onboarding_completed: markComplete ? 1 : 0,
        updated_at: nowIso,
      };

      try {
        await supabase.from('system_settings').upsert(
          { key: `onboarding_${targetEmail}`, value: JSON.stringify(mergedPrefs), updated_at: nowIso },
          { onConflict: 'key' }
        );
      } catch {}

      let updatedUser = currentUser;
      if (markComplete) {
        const existingFlags = await readPersistedOnboardingFlags(targetEmail);
        if (!existingFlags) {
          await writePersistedOnboardingFlags(targetEmail, {
            welcome_card_seen: 0,
            globe_intro_seen: 0,
            map_tutorial_status: 'pending',
            map_tutorial_updated_at: null,
          });
        }
      }
      try {
        const { data: userRow } = await supabase
          .from('users')
          .update({
            onboarding_step: nextStep,
            onboarding_completed: markComplete ? 1 : 0,
            updated_at: nowIso,
          })
          .ilike('email', targetEmail)
          .select()
          .maybeSingle();
        if (userRow) {
          updatedUser = await enrichSafeUserWithOnboardingFlags(formatSafeUser(userRow));
        }
      } catch {}

      return res.status(200).json({
        success: true,
        onboarding_completed: markComplete ? 1 : 0,
        onboarding_step: nextStep,
        preferences: mergedPrefs,
        user: updatedUser,
      });
    }

    if (cleanPath === '/user/settings' && method === 'POST') {
      const currentUser = await getAuthUser(req);
      const { rain_enabled, snow_enabled, theme, high_contrast } = body || {};
      if (currentUser?.id) {
        const updates: any = { updated_at: new Date().toISOString() };
        if (rain_enabled !== undefined) updates.rain_enabled = rain_enabled ? 1 : 0;
        if (snow_enabled !== undefined) updates.snow_enabled = snow_enabled ? 1 : 0;
        if (theme) updates.theme = theme;
        if (high_contrast !== undefined) updates.high_contrast = high_contrast ? 1 : 0;
        try {
          await supabase.from('users').update(updates).eq('id', currentUser.id);
        } catch {}
      }
      return res.status(200).json({ success: true });
    }

    if (cleanPath === '/user/permissions' && method === 'POST') {
      const currentUser = await getAuthUser(req);
      const { email, locationGranted, motionGranted, coords } = body || {};
      const targetEmail = String(email || currentUser?.email || '').trim().toLowerCase();
      const nowIso = new Date().toISOString();

      const settingsUpserts: { key: string; value: string; updated_at: string }[] = [];
      if (locationGranted !== undefined && locationGranted) {
        settingsUpserts.push({ key: 'perm_loc_global', value: '1', updated_at: nowIso });
        if (targetEmail) {
          settingsUpserts.push({ key: `perm_loc_${targetEmail}`, value: '1', updated_at: nowIso });
        }
      }
      if (motionGranted !== undefined && motionGranted) {
        settingsUpserts.push({ key: 'perm_mot_global', value: '1', updated_at: nowIso });
        if (targetEmail) {
          settingsUpserts.push({ key: `perm_mot_${targetEmail}`, value: '1', updated_at: nowIso });
        }
      }
      if (Array.isArray(coords) && coords.length === 2) {
        const coordsJson = JSON.stringify([Number(coords[0]), Number(coords[1])]);
        settingsUpserts.push({ key: 'perm_coords_global', value: coordsJson, updated_at: nowIso });
        if (targetEmail) {
          settingsUpserts.push({ key: `perm_coords_${targetEmail}`, value: coordsJson, updated_at: nowIso });
        }
      }

      if (settingsUpserts.length > 0) {
        try {
          await supabase.from('system_settings').upsert(settingsUpserts, { onConflict: 'key' });
        } catch {}
      }

      return res.status(200).json({
        success: true,
        permissions: {
          location_permission_granted: locationGranted ? 1 : 0,
          motion_permission_granted: motionGranted ? 1 : 0,
        },
      });
    }

    if (cleanPath === '/user/permissions' && method === 'GET') {
      const currentUser = await getAuthUser(req);
      const email = String(url.searchParams.get('email') || currentUser?.email || '').trim().toLowerCase();
      let locGranted = false;
      let motGranted = false;
      let savedCoords: [number, number] | null = null;

      try {
        const keysToFetch = ['perm_loc_global', 'perm_mot_global', 'perm_coords_global'];
        if (email) {
          keysToFetch.push(`perm_loc_${email}`, `perm_mot_${email}`, `perm_coords_${email}`);
        }
        const { data: rows } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', keysToFetch);

        const map = new Map<string, string>();
        for (const r of rows || []) {
          if (r.key) map.set(r.key, r.value || '');
        }
        if (map.get(`perm_loc_${email}`) === '1' || map.get('perm_loc_global') === '1') locGranted = true;
        if (map.get(`perm_mot_${email}`) === '1' || map.get('perm_mot_global') === '1') motGranted = true;
        const rawCoords = map.get(`perm_coords_${email}`) || map.get('perm_coords_global');
        if (rawCoords) {
          const parsed = JSON.parse(rawCoords);
          if (Array.isArray(parsed) && parsed.length === 2) {
            savedCoords = [Number(parsed[0]), Number(parsed[1])];
          }
        }
      } catch {}

      return res.status(200).json({
        success: true,
        location_permission_granted: locGranted ? 1 : 0,
        motion_permission_granted: motGranted ? 1 : 0,
        coords: savedCoords,
      });
    }

    if (cleanPath === '/user/privacy-data' && method === 'GET') {
      const currentUser = await getAuthUser(req);
      const emailParam = String(url.searchParams.get('email') || currentUser?.email || '').trim().toLowerCase();
      const dbUser = currentUser || (emailParam ? await findUserByEmailOrIdentifier(emailParam) : null);
      const safeUser = formatSafeUser(dbUser);
      let favoriteSpotIds: string[] = [];
      if (safeUser?.id) {
        try {
          const { data: favs } = await supabase.from('favorites').select('spot_id').eq('user_id', safeUser.id);
          favoriteSpotIds = (favs || []).map((f: any) => f.spot_id);
        } catch {}
      }
      return res.status(200).json({
        success: true,
        personalData: safeUser,
        stats: {
          favoritesCount: favoriteSpotIds.length,
          favoriteSpotIds,
          postsCount: 0,
          commentsCount: 0,
          storiesCount: 0,
        },
        requests: [],
        tickets: [],
      });
    }

    if ((cleanPath === '/user/delete-account' || cleanPath === '/auth/delete-account') && (method === 'POST' || method === 'DELETE')) {
      const currentUser = await getAuthUser(req);
      const { email, confirmText } = body || {};
      if (String(confirmText || '').trim().toUpperCase() !== 'EXCLUIR') {
        return res.status(400).json({
          success: false,
          error: 'Confirmação explícita necessária: digite EXCLUIR para confirmar a exclusão da conta.',
        });
      }
      const targetEmail = String(email || currentUser?.email || '').trim().toLowerCase();
      const dbUser = currentUser || (targetEmail ? await findUserByEmailOrIdentifier(targetEmail) : null);
      if (dbUser?.id) {
        try {
          await supabase.from('sessions').delete().eq('user_id', dbUser.id);
          await supabase.from('favorites').delete().eq('user_id', dbUser.id);
          await supabase.from('users').delete().eq('id', dbUser.id);
        } catch {}
      }
      const protocol = `DEL-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return res.status(200).json({
        success: true,
        protocol,
        deletedAt: new Date().toISOString(),
        message: 'Sua conta e seus dados pessoais associados foram excluídos permanentemente.',
      });
    }

    if (cleanPath === '/support/tickets' && (method === 'POST' || method === 'GET')) {
      if (method === 'GET') {
        return res.status(200).json({ success: true, tickets: [] });
      }
      const protocol = `SUP-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return res.status(200).json({
        success: true,
        protocol,
        ticket: {
          id: `tkt_${Date.now()}`,
          protocol,
          subject: body?.subject || 'Atendimento Monvian',
          category: body?.category || 'geral',
          message: body?.message || '',
          status: 'aberto',
          created_at: new Date().toISOString(),
        },
      });
    }


    // =========================================================================
    // 3. TOURIST SPOTS (CRUD)
    // =========================================================================
    if (cleanPath === '/spots' && method === 'GET') {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .eq('is_active', 1)
        .order('name', { ascending: true });
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, spots: data || [] });
    }

    if (cleanPath === '/admin/spots' && method === 'GET') {
      const { data, error } = await supabase
        .from('spots')
        .select('*')
        .order('name', { ascending: true });
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, spots: data || [] });
    }

    if ((cleanPath === '/admin/spots' && method === 'POST') || (cleanPath.startsWith('/admin/spots/') && (method === 'PUT' || method === 'POST'))) {
      const defaultImage = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80';
      const finalImage = body.image || (Array.isArray(body.gallery) && body.gallery.length > 0 ? body.gallery[0] : '') || defaultImage;
      const finalGallery = Array.isArray(body.gallery) ? JSON.stringify(body.gallery) : (typeof body.gallery === 'string' && body.gallery ? body.gallery : JSON.stringify([finalImage]));

      const payload = {
        ...body,
        image: finalImage,
        gallery: finalGallery,
        lat: Number(body.lat ?? -22.7192),
        lng: Number(body.lng ?? -45.5673),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('spots')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, spot: data || payload });
    }

    if (cleanPath.startsWith('/admin/spots/') && method === 'DELETE') {
      const spotId = cleanPath.replace('/admin/spots/', '');
      const { error } = await supabase.from('spots').delete().eq('id', spotId);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // =========================================================================
    // 4. EVENTS (CRUD)
    // =========================================================================
    if ((cleanPath === '/events' || cleanPath === '/admin/events') && method === 'GET') {
      const query = supabase.from('events').select('*').order('date', { ascending: true });
      if (cleanPath === '/events') query.eq('status', 'active');
      const { data, error } = await query;
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, events: data || [] });
    }

    if (cleanPath === '/admin/events' && method === 'POST') {
      const { data, error } = await supabase
        .from('events')
        .insert(body)
        .select()
        .single();
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, event: data });
    }

    if (cleanPath.startsWith('/admin/events/') && method === 'PUT') {
      const eventId = cleanPath.replace('/admin/events/', '');
      const { data, error } = await supabase
        .from('events')
        .update(body)
        .eq('id', eventId)
        .select()
        .single();
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, event: data });
    }

    if (cleanPath.startsWith('/admin/events/') && method === 'DELETE') {
      const eventId = cleanPath.replace('/admin/events/', '');
      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // =========================================================================
    // 5. ITINERARIES & CATEGORIES
    // =========================================================================
    // =========================================================================
    // 5. ITINERARIES & CATEGORIES
    // =========================================================================
    if ((cleanPath === '/itineraries' || cleanPath === '/admin/itineraries') && method === 'GET') {
      const includeAll = url.searchParams.get('all') === 'true' || cleanPath.includes('/admin/');
      let query = supabase.from('itineraries').select('*').order('sort_order', { ascending: true });
      if (!includeAll) {
        query = query.eq('is_active', 1);
      }
      const { data: rawItins, error } = await query;
      if (error) return res.status(500).json({ success: false, error: error.message });

      // Hydrate days and steps
      const [daysRes, stepsRes, spotsRes] = await Promise.all([
        supabase.from('itinerary_days').select('*').order('day_number', { ascending: true }),
        supabase.from('itinerary_steps').select('*').order('step_order', { ascending: true }),
        supabase.from('spots').select('id, name, short_name, category, category_label, lat, lng, image, description'),
      ]);

      const allDays = Array.isArray(daysRes.data) ? daysRes.data : [];
      const allSteps = Array.isArray(stepsRes.data) ? stepsRes.data : [];
      const allSpots = Array.isArray(spotsRes.data) ? spotsRes.data : [];

      const spotsMap = new Map<string, any>();
      for (const s of allSpots) spotsMap.set(s.id, s);

      const stepsByDay = new Map<string, any[]>();
      for (const st of allSteps) {
        const dId = st.day_id;
        if (!stepsByDay.has(dId)) stepsByDay.set(dId, []);
        const sp = spotsMap.get(st.spot_id);
        stepsByDay.get(dId)!.push({
          id: st.id,
          itineraryId: st.itinerary_id,
          dayId: st.day_id,
          spotId: st.spot_id,
          stepOrder: st.step_order,
          suggestedTime: st.suggested_time,
          durationMinutes: st.duration_minutes,
          notes: st.notes,
          customName: st.custom_name,
          customDescription: st.custom_description,
          customTip: st.custom_tip,
          customImage: st.custom_image,
          spot: sp ? {
            id: sp.id,
            name: sp.name,
            category: sp.category,
            categoryLabel: sp.category_label,
            lat: Number(sp.lat),
            lng: Number(sp.lng),
            image: sp.image,
            description: sp.description,
          } : undefined,
        });
      }

      const daysByItin = new Map<string, any[]>();
      for (const d of allDays) {
        const itId = d.itinerary_id;
        if (!daysByItin.has(itId)) daysByItin.set(itId, []);
        daysByItin.get(itId)!.push({
          id: d.id,
          itineraryId: d.itinerary_id,
          dayNumber: d.day_number,
          title: d.title,
          summary: d.summary,
          steps: stepsByDay.get(d.id) || [],
        });
      }

      const formatted = (rawItins || []).map((row: any) => {
        let cats: string[] = [];
        try {
          cats = Array.isArray(row.categories) ? row.categories : JSON.parse(row.categories || '[]');
        } catch {
          cats = String(row.categories || '').split(',').map((s) => s.trim()).filter(Boolean);
        }
        return {
          id: row.id,
          title: row.title,
          description: row.description || '',
          coverImage: row.cover_image || '',
          daysCount: row.days_count || 1,
          categories: cats,
          isActive: Number(row.is_active) === 1,
          isRecommended: Number(row.is_recommended) === 1,
          isFeatured: Number(row.is_featured) === 1,
          isPremium: Number(row.is_premium) === 1,
          price: row.price || 'R$ 14,90',
          status: row.status || 'published',
          badgeText: row.badge_text || 'Premium',
          showBadge: Number(row.show_badge) === 1,
          showPrice: Number(row.show_price) === 1,
          showStopsCount: Number(row.show_stops_count) === 1,
          tips: row.tips || row.notes || '',
          sortOrder: row.sort_order || 0,
          usageCount: row.usage_count || 0,
          notes: row.notes || '',
          days: daysByItin.get(row.id) || [],
        };
      });

      return res.status(200).json({ success: true, itineraries: formatted });
    }

    if ((cleanPath === '/itineraries' || cleanPath === '/admin/itineraries') && method === 'POST') {
      const itinId = body.id || `itin-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      const days = Array.isArray(body.days) ? body.days : [];
      const safeDaysCount = Math.max(1, Number(body.daysCount) || days.length || 1);
      const safeCategories = Array.isArray(body.categories)
        ? JSON.stringify(body.categories)
        : typeof body.categories === 'string'
          ? body.categories
          : '[]';

      const status = body.status || (body.isActive ? 'published' : 'draft');
      const isActive = status === 'published' ? 1 : 0;
      const isFeatured = body.isFeatured ? 1 : (body.isRecommended ? 1 : 0);

      const itinRow: any = {
        id: itinId,
        title: String(body.title || 'Novo Roteiro').trim(),
        description: String(body.description || '').trim(),
        cover_image: body.coverImage || body.cover_image || '',
        days_count: safeDaysCount,
        categories: safeCategories,
        is_active: isActive,
        is_recommended: isFeatured,
        is_featured: isFeatured,
        is_premium: body.isPremium !== undefined ? (body.isPremium ? 1 : 0) : 1,
        price: body.price || 'R$ 14,90',
        status,
        badge_text: body.badgeText || 'Premium',
        show_badge: body.showBadge !== undefined ? (body.showBadge ? 1 : 0) : 1,
        show_price: body.showPrice !== undefined ? (body.showPrice ? 1 : 0) : 1,
        show_stops_count: body.showStopsCount !== undefined ? (body.showStopsCount ? 1 : 0) : 1,
        tips: body.tips || body.notes || '',
        sort_order: Number(body.sortOrder || 0),
        notes: body.notes || body.tips || '',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('itineraries').upsert(itinRow, { onConflict: 'id' }).select();
      if (error) return res.status(500).json({ success: false, error: error.message });

      if (days.length > 0) {
        await supabase.from('itinerary_steps').delete().eq('itinerary_id', itinId);
        await supabase.from('itinerary_days').delete().eq('itinerary_id', itinId);

        const daysRows: any[] = [];
        const stepsRows: any[] = [];

        days.forEach((d: any, dIdx: number) => {
          const dId = d.id || `${itinId}-day-${dIdx + 1}`;
          daysRows.push({
            id: dId,
            itinerary_id: itinId,
            day_number: d.dayNumber || dIdx + 1,
            title: d.title || `Dia ${dIdx + 1}`,
            summary: d.summary || '',
          });

          if (Array.isArray(d.steps)) {
            d.steps.forEach((s: any, sIdx: number) => {
              stepsRows.push({
                id: s.id || `${dId}-step-${sIdx + 1}`,
                itinerary_id: itinId,
                day_id: dId,
                spot_id: s.spotId || s.spot_id,
                step_order: s.stepOrder || s.step_order || sIdx + 1,
                suggested_time: s.suggestedTime || s.suggested_time || '09:00',
                duration_minutes: Number(s.durationMinutes || s.duration_minutes || 90),
                notes: s.notes || '',
                custom_name: s.customName || s.custom_name || '',
                custom_description: s.customDescription || s.custom_description || '',
                custom_tip: s.customTip || s.custom_tip || '',
                custom_image: s.customImage || s.custom_image || '',
              });
            });
          }
        });

        if (daysRows.length > 0) await supabase.from('itinerary_days').insert(daysRows);
        if (stepsRows.length > 0) await supabase.from('itinerary_steps').insert(stepsRows);
      }

      return res.status(200).json({ success: true, id: itinId, itinerary: data?.[0] || itinRow });
    }

    if ((cleanPath.startsWith('/itineraries/') || cleanPath.startsWith('/admin/itineraries/')) && method === 'PUT') {
      const rawId = cleanPath.replace('/admin/itineraries/', '').replace('/itineraries/', '');
      const parts = rawId.split('/');
      const id = parts[0];
      const subAction = parts[1];

      if (subAction === 'featured') {
        const { data: cur } = await supabase.from('itineraries').select('is_featured').eq('id', id).maybeSingle();
        const nextVal = cur?.is_featured ? 0 : 1;
        const { error } = await supabase.from('itineraries').update({ is_featured: nextVal, is_recommended: nextVal }).eq('id', id);
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, isFeatured: nextVal === 1 });
      }

      if (subAction === 'status') {
        const newStatus = body?.status || 'published';
        const isActive = newStatus === 'published' ? 1 : 0;
        const { error } = await supabase.from('itineraries').update({ status: newStatus, is_active: isActive }).eq('id', id);
        if (error) return res.status(500).json({ success: false, error: error.message });
        return res.status(200).json({ success: true, status: newStatus });
      }

      // Full update
      const days = Array.isArray(body.days) ? body.days : [];
      const safeCategories = Array.isArray(body.categories)
        ? JSON.stringify(body.categories)
        : typeof body.categories === 'string'
          ? body.categories
          : undefined;

      const updatePayload: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.title) updatePayload.title = String(body.title).trim();
      if (body.description !== undefined) updatePayload.description = String(body.description).trim();
      if (body.coverImage || body.cover_image) updatePayload.cover_image = body.coverImage || body.cover_image;
      if (body.daysCount !== undefined) updatePayload.days_count = Number(body.daysCount);
      if (safeCategories !== undefined) updatePayload.categories = safeCategories;
      if (body.price !== undefined) updatePayload.price = body.price;
      if (body.status !== undefined) {
        updatePayload.status = body.status;
        updatePayload.is_active = body.status === 'published' ? 1 : 0;
      }
      if (body.badgeText !== undefined) updatePayload.badge_text = body.badgeText;
      if (body.tips !== undefined) updatePayload.tips = body.tips;
      if (body.notes !== undefined) updatePayload.notes = body.notes;

      const { data, error } = await supabase.from('itineraries').update(updatePayload).eq('id', id).select();
      if (error) return res.status(500).json({ success: false, error: error.message });

      if (days.length > 0) {
        await supabase.from('itinerary_steps').delete().eq('itinerary_id', id);
        await supabase.from('itinerary_days').delete().eq('itinerary_id', id);

        const daysRows: any[] = [];
        const stepsRows: any[] = [];

        days.forEach((d: any, dIdx: number) => {
          const dId = d.id || `${id}-day-${dIdx + 1}`;
          daysRows.push({
            id: dId,
            itinerary_id: id,
            day_number: d.dayNumber || dIdx + 1,
            title: d.title || `Dia ${dIdx + 1}`,
            summary: d.summary || '',
          });

          if (Array.isArray(d.steps)) {
            d.steps.forEach((s: any, sIdx: number) => {
              stepsRows.push({
                id: s.id || `${dId}-step-${sIdx + 1}`,
                itinerary_id: id,
                day_id: dId,
                spot_id: s.spotId || s.spot_id,
                step_order: s.stepOrder || s.step_order || sIdx + 1,
                suggested_time: s.suggestedTime || s.suggested_time || '09:00',
                duration_minutes: Number(s.durationMinutes || s.duration_minutes || 90),
                notes: s.notes || '',
                custom_name: s.customName || s.custom_name || '',
                custom_description: s.customDescription || s.custom_description || '',
                custom_tip: s.customTip || s.custom_tip || '',
                custom_image: s.customImage || s.custom_image || '',
              });
            });
          }
        });

        if (daysRows.length > 0) await supabase.from('itinerary_days').insert(daysRows);
        if (stepsRows.length > 0) await supabase.from('itinerary_steps').insert(stepsRows);
      }

      return res.status(200).json({ success: true, itinerary: data?.[0] || updatePayload });
    }

    if ((cleanPath.startsWith('/itineraries/') || cleanPath.startsWith('/admin/itineraries/')) && method === 'DELETE') {
      const id = cleanPath.replace('/admin/itineraries/', '').replace('/itineraries/', '');
      const { error } = await supabase.from('itineraries').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, message: 'Roteiro excluído' });
    }

    if (cleanPath === '/itinerary-categories' && method === 'GET') {
      const { data, error } = await supabase
        .from('itinerary_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, categories: data || [] });
    }

    if ((cleanPath === '/itinerary-categories' || cleanPath === '/admin/itinerary-categories') && method === 'POST') {
      const { data, error } = await supabase
        .from('itinerary_categories')
        .upsert(body, { onConflict: 'id' })
        .select()
        .single();
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, category: data });
    }

    if ((cleanPath.startsWith('/itinerary-categories/') || cleanPath.startsWith('/admin/itinerary-categories/')) && method === 'DELETE') {
      const id = cleanPath.replace('/admin/itinerary-categories/', '').replace('/itinerary-categories/', '');
      const { error } = await supabase.from('itinerary_categories').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // Media upload handler
    if ((cleanPath === '/admin/upload' || cleanPath === '/upload') && method === 'POST') {
      const { imageBase64, folder = 'spots' } = body || {};
      if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Imagem base64 é obrigatória' });
      }

      // Try uploading to Supabase Storage bucket 'monvian-media'
      try {
        const match = imageBase64.match(/^data:(image|video)\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          const contentType = `${match[1]}/${match[2]}`;
          const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
          const buffer = Buffer.from(match[3], 'base64');
          const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('monvian-media')
            .upload(filePath, buffer, { contentType, upsert: true });

          if (!uploadErr && uploadData) {
            const { data: pubData } = supabase.storage.from('monvian-media').getPublicUrl(uploadData.path);
            if (pubData?.publicUrl) {
              return res.status(200).json({ success: true, url: pubData.publicUrl });
            }
          }
        }
      } catch {}

      // Robust fallback: Return processed compressed base64 dataUrl so user upload never fails
      return res.status(200).json({ success: true, url: imageBase64 });
    }

    // =========================================================================
    // 6. MAP VISUAL ICONS (Stop Icons — Schema-Resilient Supabase CRUD)
    // =========================================================================
    const isMissingColumnError = (err: any): string | null => {
      const msg = String(err?.message || err?.details || '');
      const cacheMatch = msg.match(/Could not find the '([^']+)' column/i);
      if (cacheMatch?.[1]) return cacheMatch[1];
      const pgMatch = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"?map_visual_icons"?\s+does not exist/i);
      if (pgMatch?.[1]) return pgMatch[1];
      const genericPg = msg.match(/column\s+map_visual_icons\.([a-zA-Z0-9_]+)\s+does not exist/i);
      if (genericPg?.[1]) return genericPg[1];
      return null;
    };

    const normalizeStopIconPayload = (raw: any, existingId?: string) => {
      const cleanName = String(raw?.name ?? '').trim().slice(0, 120);
      const cleanCategory = String(raw?.category ?? '').trim().slice(0, 80);
      const cleanIcon = String(raw?.icon ?? cleanCategory ?? 'map-pin').trim().slice(0, 80);
      const rawColor = String(raw?.color ?? '').trim();
      const cleanColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor.toUpperCase() : '#1668FF';
      const lat = Number(raw?.latitude);
      const lng = Number(raw?.longitude);
      const isActive =
        raw?.is_active !== undefined ? (Number(raw.is_active) === 0 ? 0 : 1) : 1;

      if (!cleanCategory || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return { error: 'Categoria, latitude e longitude válidas são obrigatórias.' } as const;
      }

      const id =
        existingId ||
        (typeof raw?.id === 'string' && raw.id.trim().length > 0
          ? raw.id.trim().slice(0, 80)
          : `mvi_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);

      const nowIso = new Date().toISOString();
      return {
        id,
        name: cleanName || cleanCategory,
        category: cleanCategory,
        icon: cleanIcon || 'map-pin',
        color: cleanColor,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        is_active: isActive,
        created_at: nowIso,
        updated_at: nowIso,
      } as const;
    };

    const ensureStopIconAdmin = async (): Promise<boolean> => {
      const authUser = await getAuthUser(req, false);
      if (authUser && (authUser.role === 'admin' || authUser.role === 'superadmin' || isPrimaryAdmin(authUser.email))) {
        return true;
      }
      const token = extractRequestToken(req);
      if (token) {
        try {
          const fbCfg = getFirebaseConfigServerless();
          const fbUser = await verifyFirebaseIdTokenWithPublicCerts(token, fbCfg.projectId);
          if (fbUser?.email) {
            if (isPrimaryAdmin(fbUser.email)) return true;
            const dbUser = await findUserByEmailOrIdentifier(fbUser.email);
            if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'superadmin')) return true;
          }
        } catch {}
      }
      return false;
    };

    if (cleanPath === '/map-visual-icons' && method === 'GET') {
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=60');
      let result = await supabase
        .from('map_visual_icons')
        .select('*')
        .eq('is_active', 1)
        .order('created_at', { ascending: false });
      if (result.error && isMissingColumnError(result.error)) {
        result = await supabase.from('map_visual_icons').select('*').eq('is_active', 1);
      }
      if (result.error) return res.status(500).json({ success: false, error: result.error.message });
      return res.status(200).json({ success: true, icons: result.data || [] });
    }

    if (cleanPath === '/admin/map-visual-icons' && method === 'GET') {
      if (!(await ensureStopIconAdmin())) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      let result = await supabase
        .from('map_visual_icons')
        .select('*')
        .order('created_at', { ascending: false });
      if (result.error && isMissingColumnError(result.error)) {
        result = await supabase.from('map_visual_icons').select('*');
      }
      if (result.error) return res.status(500).json({ success: false, error: result.error.message });
      return res.status(200).json({ success: true, icons: result.data || [] });
    }

    if (cleanPath === '/admin/map-visual-icons' && method === 'POST') {
      if (!(await ensureStopIconAdmin())) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const parsed = normalizeStopIconPayload(body);
      if ('error' in parsed) {
        return res.status(400).json({ success: false, error: parsed.error });
      }

      const attemptRow: Record<string, any> = { ...parsed };
      let savedData: any = null;
      let lastError: any = null;

      for (let i = 0; i < 6; i++) {
        const { data, error } = await supabase
          .from('map_visual_icons')
          .insert(attemptRow)
          .select()
          .single();
        if (!error) {
          savedData = data;
          lastError = null;
          break;
        }
        lastError = error;
        const missingCol = isMissingColumnError(error);
        if (missingCol && missingCol in attemptRow) {
          delete attemptRow[missingCol];
          continue;
        }
        break;
      }

      if (lastError) {
        return res.status(500).json({ success: false, error: lastError.message });
      }

      const hydratedIcon = {
        ...parsed,
        ...(savedData || {}),
        name: savedData?.name || parsed.name,
        icon: savedData?.icon || parsed.icon,
        color: savedData?.color || parsed.color,
      };
      return res.status(200).json({ success: true, icon: hydratedIcon });
    }

    if (
      cleanPath.startsWith('/admin/map-visual-icons/') &&
      !cleanPath.endsWith('/toggle-active') &&
      method === 'PUT'
    ) {
      if (!(await ensureStopIconAdmin())) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const id = decodeURIComponent(cleanPath.replace('/admin/map-visual-icons/', '')).trim();
      if (!id) {
        return res.status(400).json({ success: false, error: 'ID inválido.' });
      }
      const parsed = normalizeStopIconPayload(body, id);
      if ('error' in parsed) {
        return res.status(400).json({ success: false, error: parsed.error });
      }

      const attemptRow: Record<string, any> = {
        name: parsed.name,
        category: parsed.category,
        icon: parsed.icon,
        color: parsed.color,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        is_active: parsed.is_active,
        updated_at: parsed.updated_at,
      };
      let savedData: any = null;
      let lastError: any = null;

      for (let i = 0; i < 6; i++) {
        const { data, error } = await supabase
          .from('map_visual_icons')
          .update(attemptRow)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (!error) {
          savedData = data;
          lastError = null;
          break;
        }
        lastError = error;
        const missingCol = isMissingColumnError(error);
        if (missingCol && missingCol in attemptRow) {
          delete attemptRow[missingCol];
          continue;
        }
        break;
      }

      if (lastError) {
        return res.status(500).json({ success: false, error: lastError.message });
      }

      // If icon existed only in Firestore and not yet in Supabase, upsert it cleanly
      if (!savedData) {
        const insertAttempt: Record<string, any> = { ...parsed };
        for (let i = 0; i < 6; i++) {
          const { data, error } = await supabase
            .from('map_visual_icons')
            .upsert(insertAttempt, { onConflict: 'id' })
            .select()
            .maybeSingle();
          if (!error) {
            savedData = data;
            break;
          }
          const missingCol = isMissingColumnError(error);
          if (missingCol && missingCol in insertAttempt) {
            delete insertAttempt[missingCol];
            continue;
          }
          return res.status(500).json({ success: false, error: error.message });
        }
      }

      const hydratedIcon = {
        ...parsed,
        ...(savedData || {}),
        id,
        name: savedData?.name || parsed.name,
        icon: savedData?.icon || parsed.icon,
        color: savedData?.color || parsed.color,
      };
      return res.status(200).json({ success: true, icon: hydratedIcon });
    }

    if (cleanPath.startsWith('/admin/map-visual-icons/') && cleanPath.endsWith('/toggle-active') && method === 'PATCH') {
      if (!(await ensureStopIconAdmin())) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const id = decodeURIComponent(
        cleanPath.replace('/admin/map-visual-icons/', '').replace('/toggle-active', '')
      ).trim();
      const { data: existing } = await supabase
        .from('map_visual_icons')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const newStatus = existing && Number(existing.is_active ?? 1) === 1 ? 0 : 1;

      const attemptUpdate: Record<string, any> = {
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      };
      let updatedRow: any = null;
      let lastError: any = null;

      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
          .from('map_visual_icons')
          .update(attemptUpdate)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (!error) {
          updatedRow = data;
          lastError = null;
          break;
        }
        lastError = error;
        const missingCol = isMissingColumnError(error);
        if (missingCol && missingCol in attemptUpdate) {
          delete attemptUpdate[missingCol];
          continue;
        }
        break;
      }

      if (lastError) return res.status(500).json({ success: false, error: lastError.message });
      return res.status(200).json({
        success: true,
        is_active: newStatus,
        icon: updatedRow || (existing ? { ...existing, is_active: newStatus } : { id, is_active: newStatus }),
      });
    }

    if (cleanPath.startsWith('/admin/map-visual-icons/') && method === 'DELETE') {
      if (!(await ensureStopIconAdmin())) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const id = decodeURIComponent(cleanPath.replace('/admin/map-visual-icons/', '')).trim();
      const { error } = await supabase.from('map_visual_icons').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // =========================================================================
    // 7. SYSTEM SETTINGS
    // =========================================================================
    if (cleanPath === '/settings' && method === 'GET') {
      const { data } = await supabase.from('system_settings').select('*');
      const settings: Record<string, string> = {};
      if (data) {
        data.forEach((row: any) => {
          if (row.key) settings[row.key] = row.value || '';
        });
      }
      return res.status(200).json({ success: true, settings });
    }

    if ((cleanPath === '/settings' || cleanPath === '/admin/settings') && method === 'POST') {
      const updates = body || {};
      for (const [key, value] of Object.entries(updates)) {
        await supabase
          .from('system_settings')
          .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
      return res.status(200).json({ success: true });
    }

    // =========================================================================
    // 8. ADMIN USERS & STATS
    // =========================================================================
    if (cleanPath === '/admin/stats' && method === 'GET') {
      const [{ count: spotsCount }, { count: usersCount }, { count: eventsCount }, { count: itinerariesCount }] =
        await Promise.all([
          supabase.from('spots').select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('events').select('*', { count: 'exact', head: true }),
          supabase.from('itineraries').select('*', { count: 'exact', head: true }),
        ]);

      return res.status(200).json({
        success: true,
        stats: {
          totalSpots: spotsCount || 0,
          totalUsers: usersCount || 0,
          totalEvents: eventsCount || 0,
          totalItineraries: itinerariesCount || 0,
        },
      });
    }

    if (cleanPath === '/admin/users' && method === 'GET') {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ success: false, error: error.message });
      const safeUsers = (data || []).map(formatSafeUser);
      return res.status(200).json({
        success: true,
        users: safeUsers,
        stats: {
          total: safeUsers.length,
          completedOnboarding: safeUsers.filter((u: any) => u.onboarding_completed === 1).length,
          pendingOnboarding: safeUsers.filter((u: any) => u.onboarding_completed !== 1).length,
        },
      });
    }

    if (cleanPath.startsWith('/admin/users/') && cleanPath.endsWith('/ban') && method === 'PATCH') {
      const id = cleanPath.replace('/admin/users/', '').replace('/ban', '');
      const { data: user } = await supabase.from('users').select('is_banned').eq('id', id).single();
      const newBanned = user?.is_banned === 1 ? 0 : 1;
      const { error } = await supabase.from('users').update({ is_banned: newBanned }).eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, is_banned: newBanned });
    }

    if (cleanPath.startsWith('/admin/users/') && method === 'DELETE') {
      const id = cleanPath.replace('/admin/users/', '');
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // =========================================================================
    // 8B. ADMIN FINANCIAL DASHBOARD & PLÁTANOS MANAGEMENT (VERCEL)
    // =========================================================================
    const resolveAdminUserServerless = async (): Promise<{ id: any; email: string } | null> => {
      const queryToken = String(url.searchParams.get('token') || '').trim();
      const effectiveReq =
        !extractRequestToken(req) && queryToken
          ? {
              ...req,
              headers: {
                ...(req.headers || {}),
                authorization: `Bearer ${queryToken}`,
              },
            }
          : req;

      const authUser = await getAuthUser(effectiveReq, false);
      if (
        authUser &&
        (authUser.role === 'admin' || authUser.role === 'superadmin' || isPrimaryAdmin(authUser.email))
      ) {
        return {
          id: authUser.id || 1,
          email: String(authUser.email || 'admin@monvian.com').trim().toLowerCase(),
        };
      }

      const token = extractRequestToken(effectiveReq);
      if (token) {
        try {
          const fbCfg = getFirebaseConfigServerless();
          const fbUser = await verifyFirebaseIdTokenWithPublicCerts(token, fbCfg.projectId);
          if (fbUser?.email) {
            const dbUser = await findUserByEmailOrIdentifier(fbUser.email);
            if (
              isPrimaryAdmin(fbUser.email) ||
              (dbUser && (dbUser.role === 'admin' || dbUser.role === 'superadmin'))
            ) {
              return {
                id: dbUser?.id || 1,
                email: fbUser.email.trim().toLowerCase(),
              };
            }
          }
        } catch {}
      }
      return null;
    };

    const getServerlessFinanceContext = (): ServerlessFinanceContext => {
      const fbCfg = getFirebaseConfigServerless();
      return {
        supabase,
        defaultPackages: DEFAULT_PLATANOS_PACKAGES,
        getStripeClient: getStripeClientServerless,
        getPackages: getPlatanosPackagesServerless,
        getItineraryPrices: getItineraryPricesServerless,
        firebaseConfig: {
          projectId: fbCfg.projectId,
          apiKey: fbCfg.apiKey,
          databaseId: 'ai-studio-monvian-57f74cb5-b162-47d6-acac-3774c885a8c4',
        },
      };
    };

    if (cleanPath === '/admin/dashboard/financial' && method === 'GET') {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const period = String(url.searchParams.get('period') || '7d').trim();
      const startDate = String(url.searchParams.get('startDate') || '').trim();
      const endDate = String(url.searchParams.get('endDate') || '').trim();
      const syncFlag = String(url.searchParams.get('sync') || '').trim();
      const forceSync = syncFlag === '1' || syncFlag === 'true';

      const payload = await getFinancialDashboardMetricsServerless(getServerlessFinanceContext(), {
        period,
        startDate,
        endDate,
        forceSync,
      });
      return res.status(200).json(payload);
    }

    if (cleanPath === '/admin/dashboard/financial/sync' && method === 'POST') {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const period = String(body?.period || url.searchParams.get('period') || '7d').trim();
      const startDate = String(body?.startDate || url.searchParams.get('startDate') || '').trim();
      const endDate = String(body?.endDate || url.searchParams.get('endDate') || '').trim();

      const payload = await getFinancialDashboardMetricsServerless(getServerlessFinanceContext(), {
        period,
        startDate,
        endDate,
        forceSync: true,
      });
      return res.status(200).json(payload);
    }

    if (cleanPath === '/admin/dashboard/financial/stream' && method === 'GET') {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
      res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);
      if (typeof res.flush === 'function') res.flush();

      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (!res.writableEnded) {
            res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
            res.end();
          }
          resolve();
        }, 12000);
        if (typeof req?.on === 'function') {
          req.on('close', () => {
            clearTimeout(timer);
            resolve();
          });
        }
      });
      return;
    }

    if (cleanPath === '/admin/platanos/overview' && method === 'GET') {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const overview = await getPlatanosOverviewServerless(getServerlessFinanceContext());
      return res.status(200).json(overview);
    }

    if (cleanPath.startsWith('/admin/platanos/packages/') && method === 'PUT') {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const pkgId = decodeURIComponent(cleanPath.replace('/admin/platanos/packages/', '')).trim();
      const result = await updatePlatanosPackageServerless(getServerlessFinanceContext(), admin, pkgId, body);
      return res.status(result.status).json(result.payload);
    }

    if (
      cleanPath.startsWith('/admin/platanos/itineraries/') &&
      cleanPath.endsWith('/price') &&
      method === 'PUT'
    ) {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const itineraryId = decodeURIComponent(
        cleanPath.replace('/admin/platanos/itineraries/', '').replace('/price', '')
      ).trim();
      const result = await updateItineraryPriceServerless(
        getServerlessFinanceContext(),
        admin,
        itineraryId,
        body
      );
      return res.status(result.status).json(result.payload);
    }

    if (
      cleanPath.startsWith('/admin/platanos/wallets/') &&
      cleanPath.endsWith('/adjust') &&
      method === 'POST'
    ) {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const targetUserParam = decodeURIComponent(
        cleanPath.replace('/admin/platanos/wallets/', '').replace('/adjust', '')
      ).trim();
      const result = await adjustPlatanosWalletServerless(
        getServerlessFinanceContext(),
        admin,
        targetUserParam,
        body
      );
      return res.status(result.status).json(result.payload);
    }

    if (
      cleanPath.startsWith('/admin/platanos/orders/') &&
      cleanPath.endsWith('/refund') &&
      method === 'POST'
    ) {
      const admin = await resolveAdminUserServerless();
      if (!admin) {
        return res.status(403).json({ success: false, error: 'Acesso administrativo obrigatório.' });
      }
      const sessionId = decodeURIComponent(
        cleanPath.replace('/admin/platanos/orders/', '').replace('/refund', '')
      ).trim();
      const result = await refundPlatanosOrderServerless(getServerlessFinanceContext(), admin, sessionId);
      return res.status(result.status).json(result.payload);
    }

    // =========================================================================
    // 9. FAVORITES
    // =========================================================================
    if ((cleanPath === '/favorites' || cleanPath === '/user/favorites') && method === 'GET') {
      const user = await getAuthUser(req);
      if (!user) return res.status(200).json({ success: true, favorites: [] });
      const { data } = await supabase.from('favorites').select('spot_id').eq('user_id', user.id);
      const spotIds = (data || []).map((f: any) => f.spot_id);
      return res.status(200).json({ success: true, favorites: spotIds });
    }

    if ((cleanPath === '/favorites/toggle' || cleanPath === '/user/favorites/toggle') && method === 'POST') {
      const user = await getAuthUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Login necessário' });
      const { spotId } = body || {};
      if (!spotId) return res.status(400).json({ success: false, error: 'Ponto não especificado' });

      const { data: existing } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .eq('spot_id', spotId)
        .maybeSingle();

      if (existing) {
        await supabase.from('favorites').delete().eq('user_id', user.id).eq('spot_id', spotId);
        return res.status(200).json({ success: true, favorited: false });
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, spot_id: spotId, created_at: new Date().toISOString() });
        return res.status(200).json({ success: true, favorited: true });
      }
    }

    // =========================================================================
    // 10. PLÁTANOS VIRTUAL CURRENCY & WALLET ROUTES (STRIPE)
    // =========================================================================
    if (cleanPath === '/platanos/packages' && method === 'GET') {
      const [packages, itineraryPrices] = await Promise.all([
        getPlatanosPackagesServerless(false),
        getItineraryPricesServerless(),
      ]);
      return res.status(200).json({
        success: true,
        packages,
        itineraryPrices,
      });
    }

    if (cleanPath === '/platanos/wallet' && method === 'GET') {
      const authUser = await getAuthUser(req);
      const rawEmail = String(req.headers['x-user-email'] || url.searchParams.get('email') || '').trim().toLowerCase();
      if (!authUser && !rawEmail) {
        const [packages, itineraryPrices] = await Promise.all([
          getPlatanosPackagesServerless(false),
          getItineraryPricesServerless(),
        ]);
        return res.status(200).json({
          success: true,
          authenticated: false,
          wallet: {
            userId: 0,
            userEmail: '',
            balance: 0,
            totalCredited: 0,
            totalSpent: 0,
            unlockedItineraryIds: [],
            transactions: [],
            orders: [],
            packages,
            itineraryPrices,
          },
        });
      }

      const resolvedUser = await resolvePlatanosUserServerless(req, body, url);
      const wallet = await loadUserPlatanosWallet(resolvedUser);
      return res.status(200).json({
        success: true,
        authenticated: true,
        wallet,
      });
    }

    if (cleanPath === '/platanos/checkout' && method === 'POST') {
      const user = await resolvePlatanosUserServerless(req, body, url);
      const packageId = String(body?.packageId || '').trim();
      if (!packageId) {
        return res.status(400).json({ error: 'Selecione um pacote válido de Plátanos.' });
      }

      const packages = await getPlatanosPackagesServerless(true);
      const pkg = packages.find((p: any) => p.id === packageId) || DEFAULT_PLATANOS_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) {
        return res.status(400).json({ error: 'Pacote de Plátanos não encontrado ou indisponível.' });
      }

      const stripeClient = await getStripeClientServerless();
      if (!stripeClient) {
        return res.status(503).json({
          error: 'Integração Stripe aguardando configuração da chave secreta (STRIPE_SECRET_KEY) no servidor.',
        });
      }

      const cleanEmail = (user.email || '').trim().toLowerCase();
      const isValidEmail = cleanEmail.includes('@') && cleanEmail.includes('.');
      const host = req.headers.host || 'localhost:3000';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const origin = process.env.APP_URL || `${proto}://${host}`;

      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: `${pkg.platanos} Plátanos — Monvian`,
                description: `Pacote de ${pkg.platanos} Plátanos para desbloqueio de roteiros exclusivos em Campos do Jordão.`,
              },
              unit_amount: Number(pkg.priceCents),
            },
            quantity: 1,
          },
        ],
        ...(isValidEmail ? { customer_email: cleanEmail } : {}),
        client_reference_id: String(user.id),
        metadata: {
          type: 'platanos_topup',
          packageId: pkg.id,
          platanosAmount: String(pkg.platanos),
          amountCents: String(pkg.priceCents),
          userId: String(user.id),
          userEmail: cleanEmail,
        },
        payment_intent_data: {
          metadata: {
            type: 'platanos_topup',
            packageId: pkg.id,
            platanosAmount: String(pkg.platanos),
            amountCents: String(pkg.priceCents),
            userId: String(user.id),
            userEmail: cleanEmail,
          },
        },
        success_url: `${origin}/?platanos_payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?platanos_payment=cancelled&package_id=${encodeURIComponent(pkg.id)}`,
      });

      const orderId = `ord_${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      const newOrder = {
        id: orderId,
        userId: Number(user.id),
        userEmail: cleanEmail,
        packageId: pkg.id,
        platanosAmount: Number(pkg.platanos),
        amountCents: Number(pkg.priceCents),
        currency: 'brl',
        stripeSessionId: session.id,
        stripePaymentIntentId: null,
        status: 'pending',
        credited: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const wallet = await loadUserPlatanosWallet(user);
      wallet.orders = [newOrder, ...(wallet.orders || [])].slice(0, 50);

      await Promise.all([
        saveUserPlatanosWallet(wallet),
        supabase.from('system_settings').upsert(
          {
            key: `platanos_order_${session.id}`,
            value: JSON.stringify(newOrder),
            updated_at: nowIso,
          },
          { onConflict: 'key' }
        ),
      ]);

      return res.status(200).json({
        success: true,
        orderId,
        sessionId: session.id,
        url: session.url,
        package: {
          id: pkg.id,
          platanos: pkg.platanos,
          priceCents: pkg.priceCents,
          priceBRL: pkg.priceBRL || formatCentsToBRL(pkg.priceCents),
        },
      });
    }

    if (cleanPath === '/platanos/verify-session' && method === 'GET') {
      const sessionId = String(url.searchParams.get('session_id') || '').trim();
      if (!sessionId) {
        return res.status(400).json({ error: 'session_id é obrigatório.' });
      }

      const stripeClient = await getStripeClientServerless();
      if (stripeClient) {
        const session = await stripeClient.checkout.sessions.retrieve(sessionId);
        if (session && session.payment_status === 'paid') {
          const creditRes = await creditPlatanosOrderServerless({
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            userId: session.metadata?.userId ? parseInt(session.metadata.userId, 10) : undefined,
            userEmail: session.metadata?.userEmail || session.customer_email || undefined,
            packageId: session.metadata?.packageId || undefined,
          });
          return res.status(200).json({
            success: true,
            status: 'paid',
            creditedAmount: creditRes.creditedAmount,
            alreadyCredited: creditRes.alreadyCredited,
            wallet: creditRes.wallet,
          });
        }
      }

      return res.status(200).json({
        success: false,
        status: 'pending',
        message: 'Pagamento aguardando confirmação do Stripe.',
      });
    }

    if (cleanPath === '/platanos/cancel-order' && method === 'POST') {
      const user = await resolvePlatanosUserServerless(req, body, url);
      const wallet = await loadUserPlatanosWallet(user);
      const sessionId = String(body?.sessionId || '').trim();
      const packageId = String(body?.packageId || '').trim();

      let updated = false;
      wallet.orders = (wallet.orders || []).map((o: any) => {
        if (
          o.status === 'pending' &&
          o.credited === 0 &&
          ((sessionId && o.stripeSessionId === sessionId) || (!sessionId && packageId && o.packageId === packageId && !updated))
        ) {
          updated = true;
          return { ...o, status: 'cancelled', updatedAt: new Date().toISOString() };
        }
        return o;
      });

      if (updated) {
        await saveUserPlatanosWallet(wallet);
      }

      return res.status(200).json({ success: true, wallet });
    }

    if (cleanPath === '/platanos/purchase-itinerary' && method === 'POST') {
      const user = await resolvePlatanosUserServerless(req, body, url);
      const itineraryId = String(body?.itineraryId || '').trim();
      const itineraryTitle = String(body?.itineraryTitle || 'Roteiro Exclusivo').trim();

      if (!itineraryId) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_INPUT',
          error: 'ID do roteiro é obrigatório.',
        });
      }

      const wallet = await loadUserPlatanosWallet(user);
      if (wallet.unlockedItineraryIds.includes(itineraryId)) {
        return res.status(200).json({
          success: true,
          alreadyUnlocked: true,
          itineraryId,
          itineraryTitle,
          charged: 0,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          transactionId: 'existing_unlock',
          wallet,
        });
      }

      const isFreeId =
        itineraryId === 'roteiro-classico-2-dias' ||
        itineraryId === 'roteiro-bate-volta-essencial' ||
        itineraryId.startsWith('manual-itin-') ||
        itineraryId.startsWith('user-itin-');
      const authoritativePrice = isFreeId
        ? 0
        : wallet.itineraryPrices?.[itineraryId] !== undefined
          ? Number(wallet.itineraryPrices[itineraryId])
          : 15;

      const balanceBefore = Number(wallet.balance || 0);
      if (balanceBefore < authoritativePrice) {
        const missing = authoritativePrice - balanceBefore;
        return res.status(402).json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          error: `Saldo insuficiente de Plátanos. Você possui ${balanceBefore} e este roteiro requer ${authoritativePrice} Plátanos.`,
          balance: balanceBefore,
          required: authoritativePrice,
          missing,
        });
      }

      const balanceAfter = balanceBefore - authoritativePrice;
      const nowIso = new Date().toISOString();
      const txId = `ptx_${crypto.randomUUID()}`;

      wallet.balance = balanceAfter;
      wallet.totalSpent = Number(wallet.totalSpent || 0) + authoritativePrice;
      wallet.unlockedItineraryIds = [itineraryId, ...wallet.unlockedItineraryIds];
      wallet.transactions = [
        {
          id: txId,
          userId: user.id,
          userEmail: user.email,
          type: 'debit_itinerary',
          amount: -authoritativePrice,
          balanceBefore,
          balanceAfter,
          status: 'completed',
          description: `Roteiro adicionado: ${itineraryTitle}`,
          referenceType: 'itinerary_unlock',
          referenceId: itineraryId,
          createdAt: nowIso,
        },
        ...(wallet.transactions || []),
      ].slice(0, 100);

      await Promise.all([
        saveUserPlatanosWallet(wallet),
        invalidateStripeSnapshotCacheServerless(supabase),
      ]);

      return res.status(200).json({
        success: true,
        alreadyUnlocked: false,
        itineraryId,
        itineraryTitle,
        charged: authoritativePrice,
        balanceBefore,
        balanceAfter,
        transactionId: txId,
        wallet,
      });
    }

    if ((cleanPath === '/platanos/webhook' || cleanPath === '/stripe/webhook') && method === 'POST') {
      const event = typeof body === 'string' ? JSON.parse(body) : body;
      if (event?.type === 'checkout.session.completed') {
        const session = event.data?.object;
        if (session?.metadata?.type === 'platanos_topup' && session.payment_status === 'paid') {
          const creditRes = await creditPlatanosOrderServerless({
            stripeSessionId: session.id,
            stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            userId: session.metadata?.userId ? parseInt(session.metadata.userId, 10) : undefined,
            userEmail: session.metadata?.userEmail || session.customer_email || undefined,
            packageId: session.metadata?.packageId || undefined,
          });
          return res.status(200).json({ received: true, platanos: true, ...creditRes });
        }
        const userEmail = (session?.metadata?.userEmail || session?.customer_email || '').trim().toLowerCase();
        if (userEmail && session?.payment_status === 'paid') {
          await Promise.all([
            supabase
              .from('users')
              .update({ is_gold: 1, plan: 'gold', is_premium: 1, updated_at: new Date().toISOString() })
              .eq('email', userEmail),
            invalidateStripeSnapshotCacheServerless(supabase),
          ]);
        }
      }
      return res.status(200).json({ received: true });
    }

    // =========================================================================
    // 11. STRIPE GOLD CHECKOUT ROUTES
    // =========================================================================
    if (cleanPath === '/stripe/config' && method === 'GET') {
      const stripeClient = await getStripeClientServerless();
      return res.status(200).json({
        configured: Boolean(stripeClient),
        price: 'R$ 19,90',
        currency: 'BRL',
        mode: 'payment',
      });
    }

    if (cleanPath === '/stripe/create-checkout-session' && method === 'POST') {
      const user = await resolvePlatanosUserServerless(req, body, url);
      const stripeClient = await getStripeClientServerless();
      const host = req.headers.host || 'localhost:3000';
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const origin = process.env.APP_URL || `${proto}://${host}`;

      if (!stripeClient) {
        return res.status(503).json({
          error: 'Integração Stripe aguardando configuração da chave secreta (STRIPE_SECRET_KEY) no servidor.',
        });
      }

      const cleanEmail = (user.email || '').trim().toLowerCase();
      const isValidEmail = cleanEmail.includes('@') && cleanEmail.includes('.');

      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: 'Monvian - Conta Elite Gold',
                description: 'Acesso permanente aos roteiros exclusivos e pontos turísticos selecionados em Campos do Jordão.',
              },
              unit_amount: 1990,
            },
            quantity: 1,
          },
        ],
        ...(isValidEmail ? { customer_email: cleanEmail } : {}),
        client_reference_id: String(user.id),
        metadata: {
          userId: String(user.id),
          userEmail: cleanEmail || 'guest',
          plan: 'gold',
          product: 'monvians_gold_premium',
          price: '19.90',
        },
        success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?payment=cancelled`,
        allow_promotion_codes: true,
      });

      return res.status(200).json({
        success: true,
        sessionId: session.id,
        url: session.url,
      });
    }

    if (cleanPath === '/stripe/verify-session' && method === 'GET') {
      const sessionId = String(url.searchParams.get('session_id') || '').trim();
      const stripeClient = await getStripeClientServerless();
      if (sessionId && stripeClient) {
        const session = await stripeClient.checkout.sessions.retrieve(sessionId);
        if (session && session.payment_status === 'paid') {
          const userEmail = (session.metadata?.userEmail || session.customer_email || '').trim().toLowerCase();
          if (userEmail) {
            await Promise.all([
              supabase
                .from('users')
                .update({ is_gold: 1, plan: 'gold', is_premium: 1, updated_at: new Date().toISOString() })
                .eq('email', userEmail),
              invalidateStripeSnapshotCacheServerless(supabase),
            ]);
          }
          return res.status(200).json({ success: true, plan: 'gold', isGold: true });
        }
      }
      return res.status(200).json({ success: false, status: 'pending' });
    }

    // =========================================================================
    // 12. MONVIAN AI ASSISTANT (GOOGLE GEMINI SERVER-SIDE ENGINE)
    // =========================================================================
    if (cleanPath === '/assistant/health' && method === 'GET') {
      const hasKey = Boolean(String(process.env.GEMINI_API_KEY || '').trim());
      return res.status(200).json({
        ok: hasKey,
        provider: 'google-gemini',
        model: PRIMARY_GEMINI_MODEL,
        configured: hasKey,
      });
    }

    if (cleanPath === '/assistant/history' && method === 'GET') {
      const userKey = String(
        url.searchParams.get('userKey') || req.headers['x-monvian-user-id'] || 'guest_anonymous'
      )
        .trim()
        .slice(0, 128);
      const settingKey = `assistant_conv_${userKey}`;
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', settingKey)
          .limit(1);
        if (data && data.length > 0 && data[0].value) {
          const parsed = JSON.parse(data[0].value);
          return res.status(200).json({
            conversationId: parsed?.conversationId || null,
            messages: Array.isArray(parsed?.messages) ? parsed.messages.slice(-60) : [],
          });
        }
      } catch {}
      return res.status(200).json({ conversationId: null, messages: [] });
    }

    if (cleanPath === '/assistant/reset' && method === 'POST') {
      const userKey = String(
        body?.userKey || req.headers['x-monvian-user-id'] || 'guest_anonymous'
      )
        .trim()
        .slice(0, 128);
      const newConvId = `conv_${crypto.randomUUID()}`;
      const settingKey = `assistant_conv_${userKey}`;
      try {
        await supabase.from('system_settings').upsert(
          {
            key: settingKey,
            value: JSON.stringify({ conversationId: newConvId, messages: [] }),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );
      } catch {}
      return res.status(200).json({ conversationId: newConvId, messages: [] });
    }

    if (cleanPath === '/assistant/chat' && method === 'POST') {
      const userMessage = String(body?.message || '').trim();
      if (!userMessage) {
        return res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'Digite uma mensagem antes de enviar.',
          retryable: false,
        });
      }

      const userKey = String(
        body?.userKey || req.headers['x-monvian-user-id'] || 'guest_anonymous'
      )
        .trim()
        .slice(0, 128);
      const userName = String(body?.userName || '').trim() || undefined;
      const pendingStyleFromClient = String(body?.pendingItineraryStyle || '').trim();
      const userLocation =
        body?.userLocation &&
        Number.isFinite(Number(body.userLocation.lat)) &&
        Number.isFinite(Number(body.userLocation.lng))
          ? { lat: Number(body.userLocation.lat), lng: Number(body.userLocation.lng) }
          : null;

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      const sendEvent = (event: string, data: any) => {
        if (res.writableEnded) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      };

      const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`: keep-alive\n\n`);
          if (typeof res.flush === 'function') res.flush();
        }
      }, 4000);

      try {
        const settingKey = `assistant_conv_${userKey}`;
        let storedConvId = String(body?.conversationId || '').trim() || `conv_${crypto.randomUUID()}`;
        let storedMessages: any[] = [];

        try {
          const { data } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', settingKey)
            .limit(1);
          if (data && data.length > 0 && data[0].value) {
            const parsed = JSON.parse(data[0].value);
            if (parsed?.conversationId && (!body?.conversationId || parsed.conversationId === body.conversationId)) {
              storedConvId = String(parsed.conversationId);
              storedMessages = Array.isArray(parsed.messages) ? parsed.messages : [];
            }
          }
        } catch {}

        // Use client-provided compact history fallback if serverless storage was empty
        const clientHistory: AssistantHistoryTurn[] = Array.isArray(body?.history)
          ? body.history
              .slice(-12)
              .map((h: any) => ({
                role: h?.role === 'user' ? 'user' : 'assistant',
                content: String(h?.content || ''),
              }))
              .filter((h: AssistantHistoryTurn) => h.content.trim().length > 0)
          : [];

        const history: AssistantHistoryTurn[] =
          storedMessages.length > 0
            ? storedMessages.slice(-12).map((m: any) => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: String(m.content || ''),
              }))
            : clientHistory;

        const userMsgId = `msg_${crypto.randomUUID()}`;
        sendEvent('meta', { conversationId: storedConvId, userMessageId: userMsgId });

        // Build live Monvian RAG knowledge base from Supabase (with CAMPOS_SPOTS fallback)
        let activeSpots = CAMPOS_SPOTS.map((s) => ({
          id: String(s.id),
          name: s.name,
          category: s.category,
          categoryLabel: s.categoryLabel,
          address: s.address,
          priceRange: s.priceRange || '$$',
          price: s.price,
          rating: s.rating,
          hours: s.hours,
          description: s.description,
          touristTip: s.touristTip,
          lat: s.lat,
          lng: s.lng,
          image: s.image,
          highlighted: Boolean(s.highlighted),
        }));

        try {
          const { data: dbSpots } = await supabase
            .from('spots')
            .select('*')
            .neq('is_active', 0)
            .limit(60);
          if (Array.isArray(dbSpots) && dbSpots.length > 0) {
            activeSpots = dbSpots.map((r: any) => ({
              id: String(r.id),
              name: String(r.name || ''),
              category: String(r.category || 'culture') as typeof activeSpots[number]['category'],
              categoryLabel: String(r.category_label || r.categoryLabel || r.category || ''),
              address: String(r.address || 'Campos do Jordão, SP'),
              priceRange: String(r.price_range || r.priceRange || '$$') as typeof activeSpots[number]['priceRange'],
              price: String(r.price || ''),
              rating: Number(r.rating) || 4.8,
              hours: String(r.hours || ''),
              description: String(r.description || ''),
              touristTip: String(r.tourist_tip || r.touristTip || ''),
              lat: Number(r.lat) || -22.7192,
              lng: Number(r.lng) || -45.5669,
              image: String(r.image || ''),
              highlighted: Boolean(r.highlighted || r.is_star),
            }));
          }
        } catch {}

        const knowledge: GeminiAssistantKnowledge = {
          spots: activeSpots,
          itineraries: DEFAULT_CURATED_ITINERARIES.slice(0, 8).map((it: any) => ({
            id: String(it.id),
            title: String(it.title || ''),
            subtitle: String(it.subtitle || it.description || ''),
            category: String(it.category || it.tag || 'Experiência'),
            duration: String(it.duration || `${it.days?.length || 1} dia(s)`),
            stopsCount: Number(it.stopsCount || it.days?.[0]?.steps?.length || 3),
            description: String(it.description || ''),
          })),
          events: [],
        };

        const result = await runGeminiAssistantTurn({
          apiKey: String(process.env.GEMINI_API_KEY || ''),
          userMessage,
          history,
          knowledge,
          userName,
          pendingItineraryStyle: pendingStyleFromClient || undefined,
          userLocation,
          onTextDelta: (delta) => {
            sendEvent('delta', { text: delta });
          },
        });

        if (result.action) {
          sendEvent('action', result.action);
        }

        const assistantMsgId = `msg_${crypto.randomUUID()}`;
        const updatedMessages = [
          ...storedMessages,
          { id: userMsgId, role: 'user', content: userMessage, createdAt: new Date().toISOString() },
          {
            id: assistantMsgId,
            role: 'assistant',
            content: result.text,
            metadata: result.action ? { action: result.action } : undefined,
            createdAt: new Date().toISOString(),
          },
        ].slice(-40);

        try {
          await supabase.from('system_settings').upsert(
            {
              key: settingKey,
              value: JSON.stringify({ conversationId: storedConvId, messages: updatedMessages }),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          );
        } catch {}

        sendEvent('done', {
          messageId: assistantMsgId,
          conversationId: storedConvId,
          content: result.text,
          action: result.action,
          model: result.modelUsed,
        });
      } catch (err: any) {
        const classified: ClassifiedAssistantError =
          err && typeof err === 'object' && 'code' in err && 'userMessage' in err
            ? (err as ClassifiedAssistantError)
            : classifyGeminiError(err);

        console.error(
          `[Monvian Serverless Assistant Error] [${classified.code}]`,
          classified.technicalDetail
        );

        sendEvent('error', {
          code: classified.code,
          message: classified.userMessage,
          retryable: classified.retryable,
        });
      } finally {
        clearInterval(heartbeat);
        if (!res.writableEnded) {
          res.end();
        }
      }
      return;
    }

    return res.status(404).json({ success: false, error: `Route ${cleanPath} not found`, message: `Route ${cleanPath} not found` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: sanitizeBackendAuthError(err, 'Erro interno ao processar sua solicitação.') });
  }
}
