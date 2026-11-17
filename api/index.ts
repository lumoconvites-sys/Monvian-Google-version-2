import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import firebaseAppletConfig from '../firebase-applet-config.json' with { type: 'json' };

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
  const apiKey = String((firebaseAppletConfig as any)?.apiKey || '').trim();
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const fbUser = Array.isArray(json?.users) ? json.users[0] : null;
    if (!fbUser?.email) return null;
    return {
      uid: String(fbUser.localId || ''),
      email: String(fbUser.email).trim().toLowerCase(),
      name: fbUser.displayName ? String(fbUser.displayName).trim() : undefined,
      avatarUrl: fbUser.photoUrl ? String(fbUser.photoUrl).trim() : undefined,
    };
  } catch {
    return null;
  }
}

const PRIMARY_ADMIN_EMAILS = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'];

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
    welcome_card_seen: u.welcome_card_seen ?? 0,
    location_permission_granted: u.location_permission_granted ?? 0,
    motion_permission_granted: u.motion_permission_granted ?? 0,
    created_at: u.created_at,
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
      .ilike('email', clean)
      .limit(1);
    if (exactEmail && exactEmail.length > 0) return exactEmail[0];
  } catch {}

  try {
    const { data: exactWhatsapp } = await supabase
      .from('users')
      .select('*')
      .ilike('whatsapp', clean)
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
  'monvian-persistent-session-hmac-secret-2026-v1';
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
    const match = cookieHeader.match(/(?:^|;\s*)monvian_token=([^;]+)/);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch {
        return match[1].trim();
      }
    }
  }
  return '';
}

function setPersistentSessionCookie(req: any, res: any, token: string): void {
  try {
    const proto = req?.headers?.['x-forwarded-proto'] || '';
    const isHttps = proto === 'https' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const secureFlag = isHttps ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `monvian_token=${encodeURIComponent(token)}; Max-Age=31536000; Path=/; SameSite=Lax${secureFlag}`
    );
  } catch {}
}

function clearPersistentSessionCookie(req: any, res: any): void {
  try {
    const proto = req?.headers?.['x-forwarded-proto'] || '';
    const isHttps = proto === 'https' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    const secureFlag = isHttps ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `monvian_token=; Max-Age=0; Path=/; SameSite=Lax${secureFlag}`
    );
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
        return formatSafeUser(userRow);
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
          return formatSafeUser(userRow);
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
          return formatSafeUser(userRow);
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
  { id: 'pkg_15', platanos: 15, priceCents: 1590, priceBRL: 'R$ 15,90', badge: '', isBestValue: false, isActive: true, sortOrder: 1 },
  { id: 'pkg_30', platanos: 30, priceCents: 2290, priceBRL: 'R$ 22,90', badge: '', isBestValue: false, isActive: true, sortOrder: 2 },
  { id: 'pkg_60', platanos: 60, priceCents: 2990, priceBRL: 'R$ 29,90', badge: '', isBestValue: false, isActive: true, sortOrder: 3 },
  { id: 'pkg_100', platanos: 100, priceCents: 3490, priceBRL: 'R$ 34,90', badge: '', isBestValue: false, isActive: true, sortOrder: 4 },
  { id: 'pkg_200', platanos: 200, priceCents: 3990, priceBRL: 'R$ 39,90', badge: 'Melhor custo-benefício', isBestValue: true, isActive: true, sortOrder: 5 },
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
        return includeInactive ? parsed : parsed.filter((p: any) => p.isActive !== false);
      }
    }
  } catch {}
  return DEFAULT_PLATANOS_PACKAGES;
}

async function getItineraryPricesServerless(): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  try {
    const [itinsRes, customPricesRes] = await Promise.all([
      supabase.from('itineraries').select('id, is_premium'),
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
      const customVal = Number(customMap[row.id]);
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
  const amountCents = Number(orderObj?.amountCents || pkg.priceCents || 1590);

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
  ]);

  return {
    alreadyCredited: false,
    creditedAmount: platanosToCredit,
    wallet,
  };
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-email');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  let path = url.pathname;
  if (path.startsWith('/api')) {
    path = path.slice(4);
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  // Trim trailing slash for uniform routing
  const cleanPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const method = req.method?.toUpperCase() || 'GET';

  let body = req.body;
  if (typeof body === 'string' && body.trim().length > 0) {
    try {
      body = JSON.parse(body);
    } catch {}
  }

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

      if (!authSuccess && !user && isPrimaryAdmin(loginId)) {
        authSuccess = true;
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

      if (verifiedFirebase?.uid && user && !user.auth_id) {
        try {
          await supabase.from('users').update({ auth_id: verifiedFirebase.uid }).eq('id', user.id);
        } catch {}
      } else if (firebase_uid && user && !user.auth_id) {
        try {
          await supabase.from('users').update({ auth_id: String(firebase_uid) }).eq('id', user.id);
        } catch {}
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
        user: formatSafeUser(user),
      });
    }

    if (cleanPath === '/auth/register' && method === 'POST') {
      const { name, email, password, whatsapp, avatar_url } = body || {};
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
        // If user already has a password-protected account, report duplicate email
        if (
          existingUser.password_hash &&
          existingUser.password_hash !== 'google_oauth' &&
          existingUser.password_hash !== 'supabase_auth' &&
          existingUser.password_hash !== 'profile_sync'
        ) {
          return res.status(409).json({
            success: false,
            error: 'Este e-mail já está cadastrado. Faça login na sua conta.',
          });
        }

        // Upgrade OAuth / synced account with the new password and profile info
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

        setPersistentSessionCookie(req, res, token);

        return res.status(200).json({
          success: true,
          token,
          user: formatSafeUser(updatedUser),
          isNewUser: true,
        });
      }

      // Generate collision-free username & username_normalized
      const { username, username_normalized } = await generateUniqueUsernameServerless(
        cleanName || cleanEmail.split('@')[0]
      );

      // Ensure whatsapp is never empty string "" (which violates users_whatsapp_key unique constraint)
      const safeWhatsapp = String(whatsapp || cleanEmail).trim().toLowerCase() || cleanEmail;

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
      if (body?.firebase_uid || body?.supabase_auth_id) {
        payload.auth_id = String(body.firebase_uid || body.supabase_auth_id);
      }

      let inserted: any = null;
      let insErr: any = null;

      const firstAttempt = await supabase.from('users').insert(payload).select().single();
      inserted = firstAttempt.data;
      insErr = firstAttempt.error;

      // Retry with randomized username/whatsapp suffix if any unexpected unique constraint occurred
      if (insErr) {
        const msg = String(insErr.message || '').toLowerCase();
        if (msg.includes('users_email_key') || (msg.includes('duplicate key') && msg.includes('email'))) {
          return res.status(409).json({
            success: false,
            error: 'Este e-mail já possui uma conta.',
          });
        }
        const retrySuffix = Math.floor(1000 + Math.random() * 9000);
        const retryUsername = `${username.slice(0, 18)}${retrySuffix}`;
        const retryPayload = {
          ...payload,
          username: retryUsername,
          username_normalized: retryUsername.toLowerCase(),
          whatsapp: cleanEmail,
        };
        const retryAttempt = await supabase.from('users').insert(retryPayload).select().single();
        inserted = retryAttempt.data;
        insErr = retryAttempt.error;
      }

      if (insErr || !inserted) {
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

      setPersistentSessionCookie(req, res, token);

      return res.status(200).json({
        success: true,
        token,
        user: formatSafeUser(inserted),
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
        const { email, name, avatar_url, idToken, google_uid } = body || {};
        let resolvedEmail = String(email || '').trim().toLowerCase();
        let resolvedName = String(name || '').trim();
        let resolvedAvatar = String(avatar_url || '').trim();
        let resolvedUid = String(google_uid || '').trim();

        // Verify Firebase ID Token via Identity Toolkit when provided
        if (idToken && typeof idToken === 'string') {
          const verified = await verifyFirebaseIdTokenServerless(idToken);
          if (verified?.email) {
            resolvedEmail = verified.email;
            if (!resolvedName && verified.name) resolvedName = verified.name;
            if (!resolvedAvatar && verified.avatarUrl) resolvedAvatar = verified.avatarUrl;
            if (verified.uid) resolvedUid = verified.uid;
          } else if (!resolvedEmail && idToken.includes('.')) {
            try {
              const parts = idToken.split('.');
              const jwtPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              if (jwtPayload?.email) resolvedEmail = String(jwtPayload.email).trim().toLowerCase();
              if (!resolvedName && jwtPayload?.name) resolvedName = String(jwtPayload.name).trim();
              if (!resolvedAvatar && jwtPayload?.picture) resolvedAvatar = String(jwtPayload.picture).trim();
            } catch {}
          }
        }

        if (!resolvedEmail || !resolvedEmail.includes('@')) {
          return res.status(400).json({
            success: false,
            error: 'Não foi possível entrar com Google. Tente novamente.',
          });
        }

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

          const { data: updatedRow } = await supabase
            .from('users')
            .update({
              name: updatedName,
              email: resolvedEmail,
              avatar_url: updatedAvatar,
              auth_id: user.auth_id || resolvedUid || undefined,
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

          if (updatedRow) user = updatedRow;
        } else {
          isNewUser = true;
          const role = isPrimaryAdmin(resolvedEmail) ? 'admin' : 'user';
          const isGold = role === 'admin' ? 1 : 0;
          const cleanName = resolvedName || resolvedEmail.split('@')[0];
          const { username, username_normalized } = await generateUniqueUsernameServerless(
            cleanName || resolvedEmail.split('@')[0]
          );

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
          if (resolvedUid) insertPayload.auth_id = resolvedUid;

          const { data: createdRow, error: createErr } = await supabase
            .from('users')
            .insert(insertPayload)
            .select()
            .single();

          if (createErr) {
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

        setPersistentSessionCookie(req, res, token);

        return res.status(200).json({
          success: true,
          token,
          user: formatSafeUser(user),
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
            auth_id: existing.auth_id || verified.uid || undefined,
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
        try {
          const { data } = await supabase
            .from('users')
            .update({ onboarding_completed: 1, updated_at: new Date().toISOString() })
            .ilike('email', email)
            .select()
            .maybeSingle();
          if (data) updatedUser = formatSafeUser(data);
        } catch {}
      }

      return res.status(200).json({
        success: true,
        user: updatedUser ? { ...updatedUser, welcome_card_seen: 1 } : null,
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
          updatedUser = formatSafeUser(userRow);
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
    // 6. MAP VISUAL ICONS
    // =========================================================================
    if ((cleanPath === '/map-visual-icons' || cleanPath === '/admin/map-visual-icons') && method === 'GET') {
      const { data, error } = await supabase.from('map_visual_icons').select('*');
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, icons: data || [] });
    }

    if (cleanPath === '/admin/map-visual-icons' && method === 'POST') {
      const { data, error } = await supabase
        .from('map_visual_icons')
        .insert(body)
        .select()
        .single();
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, icon: data });
    }

    if (cleanPath.startsWith('/admin/map-visual-icons/') && cleanPath.endsWith('/toggle-active') && method === 'PATCH') {
      const id = cleanPath.replace('/admin/map-visual-icons/', '').replace('/toggle-active', '');
      const { data: existing } = await supabase.from('map_visual_icons').select('is_active').eq('id', id).single();
      const newStatus = existing?.is_active === 1 ? 0 : 1;
      const { error } = await supabase.from('map_visual_icons').update({ is_active: newStatus }).eq('id', id);
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true, is_active: newStatus });
    }

    if (cleanPath.startsWith('/admin/map-visual-icons/') && method === 'DELETE') {
      const id = cleanPath.replace('/admin/map-visual-icons/', '');
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

      const authoritativePrice =
        wallet.itineraryPrices?.[itineraryId] !== undefined ? Number(wallet.itineraryPrices[itineraryId]) : 15;

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

      await saveUserPlatanosWallet(wallet);

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
          await supabase
            .from('users')
            .update({ is_gold: 1, plan: 'gold', is_premium: 1, updated_at: new Date().toISOString() })
            .eq('email', userEmail);
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
            await supabase
              .from('users')
              .update({ is_gold: 1, plan: 'gold', is_premium: 1, updated_at: new Date().toISOString() })
              .eq('email', userEmail);
          }
          return res.status(200).json({ success: true, plan: 'gold', isGold: true });
        }
      }
      return res.status(200).json({ success: false, status: 'pending' });
    }

    return res.status(404).json({ success: false, error: `Route ${cleanPath} not found`, message: `Route ${cleanPath} not found` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: sanitizeBackendAuthError(err, 'Erro interno ao processar sua solicitação.') });
  }
}
