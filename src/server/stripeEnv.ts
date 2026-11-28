import Stripe from 'stripe';

const STRIPE_SECRET_ENV_CANDIDATES = [
  'STRIPE_SECRET_KEY',
  'STRIPE_LIVE_SECRET_KEY',
  'STRIPE_SECRET_KEY_LIVE',
  'STRIPE_API_KEY',
  'STRIPE_SECRET',
  'STRIPE_PRIVATE_KEY',
  'STRIPE_RESTRICTED_KEY',
  'STRIPE_KEY',
  'STRIPE_TEST_SECRET_KEY',
  'STRIPE_SECRET_KEY_TEST',
  'VITE_STRIPE_SECRET_KEY',
  'VITE_STRIPE_API_KEY',
  'NEXT_PUBLIC_STRIPE_SECRET_KEY',
] as const;

const STRIPE_WEBHOOK_ENV_CANDIDATES = [
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_WEBHOOK_SIGNING_SECRET',
  'STRIPE_SIGNING_SECRET',
  'STRIPE_WHSEC',
  'WEBHOOK_SECRET_STRIPE',
  'VITE_STRIPE_WEBHOOK_SECRET',
] as const;

/**
 * Normalizes a credential read from process.env or DB by trimming whitespace,
 * stripping accidental surrounding quotes ("..." or '...'), and removing line breaks.
 */
export function sanitizeStripeCredential(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.replace(/[\r\n]/g, '').trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

export function isValidStripeSecretKey(key: string): boolean {
  if (!key) return false;
  return /^(sk|rk)_(live|test)_[A-Za-z0-9_]{10,}$/.test(key);
}

export function isStripePublishableKey(key: string): boolean {
  if (!key) return false;
  return /^pk_(live|test)_[A-Za-z0-9_]{10,}$/.test(key);
}

export function isValidStripeWebhookSecret(secret: string): boolean {
  if (!secret) return false;
  return /^whsec_[A-Za-z0-9_]{8,}$/.test(secret);
}

export function isLiveStripeKey(key: string): boolean {
  return key.startsWith('sk_live_') || key.startsWith('rk_live_');
}

export interface ResolvedStripeEnvKey {
  key: string;
  sourceEnvName: string | null;
  livemode: boolean;
  detectedPublishableOnly: boolean;
}

/**
 * Resolves the Stripe secret/restricted key from server-side process.env.
 * Checks canonical names first, then falls back to scanning env vars for any
 * valid sk_live_/rk_live_/sk_test_/rk_test_ key (never confusing pk_* publishable keys).
 */
export function resolveStripeSecretKeyFromEnv(): ResolvedStripeEnvKey {
  let sawPublishable = false;

  for (const name of STRIPE_SECRET_ENV_CANDIDATES) {
    const val = sanitizeStripeCredential(process.env[name]);
    if (!val) continue;
    if (isValidStripeSecretKey(val)) {
      return {
        key: val,
        sourceEnvName: name,
        livemode: isLiveStripeKey(val),
        detectedPublishableOnly: false,
      };
    }
    if (isStripePublishableKey(val)) {
      sawPublishable = true;
    }
  }

  // Fallback: scan process.env for any valid Stripe secret/restricted key (e.g. custom Vercel env var name)
  const discovered: Array<{ name: string; val: string; score: number }> = [];
  for (const [name, rawVal] of Object.entries(process.env)) {
    const val = sanitizeStripeCredential(rawVal);
    if (!val) continue;
    if (isValidStripeSecretKey(val)) {
      let score = 0;
      const upper = name.toUpperCase();
      if (upper.includes('STRIPE')) score += 100;
      if (upper.includes('SECRET')) score += 40;
      if (val.startsWith('sk_live_')) score += 30;
      else if (val.startsWith('rk_live_')) score += 20;
      else if (val.startsWith('sk_test_')) score += 10;
      else if (val.startsWith('rk_test_')) score += 5;
      discovered.push({ name, val, score });
    } else if (name.toUpperCase().includes('STRIPE') && isStripePublishableKey(val)) {
      sawPublishable = true;
    }
  }

  if (discovered.length > 0) {
    discovered.sort((a, b) => b.score - a.score);
    const best = discovered[0];
    return {
      key: best.val,
      sourceEnvName: best.name,
      livemode: isLiveStripeKey(best.val),
      detectedPublishableOnly: false,
    };
  }

  return {
    key: '',
    sourceEnvName: null,
    livemode: false,
    detectedPublishableOnly: sawPublishable,
  };
}

export function resolveStripeWebhookSecretFromEnv(): {
  secret: string;
  sourceEnvName: string | null;
} {
  for (const name of STRIPE_WEBHOOK_ENV_CANDIDATES) {
    const val = sanitizeStripeCredential(process.env[name]);
    if (isValidStripeWebhookSecret(val)) {
      return { secret: val, sourceEnvName: name };
    }
  }

  const discovered: Array<{ name: string; val: string; score: number }> = [];
  for (const [name, rawVal] of Object.entries(process.env)) {
    const val = sanitizeStripeCredential(rawVal);
    if (isValidStripeWebhookSecret(val)) {
      const upper = name.toUpperCase();
      let score = 0;
      if (upper.includes('STRIPE')) score += 100;
      if (upper.includes('WEBHOOK')) score += 50;
      discovered.push({ name, val, score });
    }
  }

  if (discovered.length > 0) {
    discovered.sort((a, b) => b.score - a.score);
    return { secret: discovered[0].val, sourceEnvName: discovered[0].name };
  }

  return { secret: '', sourceEnvName: null };
}

export function createStripeClientSafe(rawKey?: string | null): Stripe | null {
  const key = sanitizeStripeCredential(rawKey);
  if (!isValidStripeSecretKey(key)) return null;
  try {
    return new Stripe(key, {
      maxNetworkRetries: 2,
      timeout: 15000,
    });
  } catch {
    return null;
  }
}

/**
 * Produces a safe, user-friendly Portuguese error message from a Stripe SDK error
 * without ever leaking secret key fragments.
 */
export function sanitizeStripeErrorMessage(
  err: any,
  fallback = 'Erro ao sincronizar dados com a Stripe.'
): string {
  const raw = String(err?.message || err || '').trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();

  if (lower.includes('invalid api key') || lower.includes('expired api key')) {
    return 'A chave secreta da Stripe configurada foi rejeitada ou expirou. Verifique STRIPE_SECRET_KEY na Vercel e faça um novo deploy.';
  }
  if (lower.includes('publishable api key') || lower.includes('pk_live_') || lower.includes('pk_test_')) {
    return 'Foi informada uma chave publicável (pk_...). Configure a chave secreta da Stripe (sk_live_... ou sk_test_...) em STRIPE_SECRET_KEY.';
  }
  if (lower.includes('does not have the required permissions') || lower.includes('permission')) {
    return 'A chave restrita da Stripe (rk_...) não possui permissão de leitura para saldo/cobranças. Habilite leitura de Balance, Charges e Checkout Sessions ou use a chave secreta (sk_...).';
  }
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econn')) {
    return 'Tempo limite excedido ao consultar a API da Stripe. Tente sincronizar novamente.';
  }

  // Strip any accidental key tokens before returning
  const redacted = raw.replace(/\b(sk|rk|pk|whsec)_(live|test)?_?[A-Za-z0-9_*]+/g, '[chave-oculta]');
  return redacted.slice(0, 220) || fallback;
}
