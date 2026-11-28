import crypto from 'crypto';
import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries.js';
import {
  isValidStripeWebhookSecret,
  resolveStripeSecretKeyFromEnv,
  resolveStripeWebhookSecretFromEnv,
  sanitizeStripeCredential,
  sanitizeStripeErrorMessage,
} from './stripeEnv.js';

export type ServerlessDashboardPeriodKey =
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | 'last_month'
  | 'all'
  | 'custom';

export interface ServerlessFinanceContext {
  supabase: SupabaseClient;
  defaultPackages: any[];
  getStripeClient: () => Promise<Stripe | null>;
  getPackages: (includeInactive?: boolean) => Promise<any[]>;
  getItineraryPrices: () => Promise<Record<string, number>>;
  firebaseConfig?: { projectId: string; apiKey: string; databaseId?: string };
}

interface CanonicalStripeTx {
  id: string;
  stripeChargeId: string | null;
  stripePaymentIntentId: string | null;
  stripeSessionId: string | null;
  customerEmail: string | null;
  productName: string;
  productType: string;
  packageId: string | null;
  platanosAmount: number;
  itineraryId: string | null;
  itineraryTitle: string | null;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
  refundedAmountCents: number;
  currency: string;
  paymentStatus: 'succeeded' | 'partially_refunded' | 'refunded' | 'disputed' | 'failed' | 'pending';
  livemode: boolean;
  purchasedAt: string;
}

interface StripeSnapshotCache {
  syncedAt: string;
  configured: boolean;
  livemode: boolean;
  hasWebhookSecret: boolean;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  currency: string;
  transactions: CanonicalStripeTx[];
  syncError?: string | null;
}

const BRAZIL_OFFSET_MS = -3 * 60 * 60 * 1000;
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SNAPSHOT_CACHE_KEY = 'stripe_financial_snapshot_cache';
const SNAPSHOT_TTL_MS = 45_000;

export function formatBRLCents(cents: number): string {
  const reais = (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
  return `R$ ${reais}`;
}

function parseTimestampMs(raw?: string | null): number {
  if (!raw) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const normalized = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  if (Number.isFinite(ms)) return ms;
  const direct = Date.parse(s);
  return Number.isFinite(direct) ? direct : 0;
}

function toBrazilDateParts(utcMs: number) {
  const shifted = new Date(utcMs + BRAZIL_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const dayOfWeek = shifted.getUTCDay();
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, dayOfWeek, dateKey };
}

function brazilStartOfDayUtcMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day, 0, 0, 0, 0) - BRAZIL_OFFSET_MS;
}

function brazilEndOfDayUtcMs(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day, 23, 59, 59, 999) - BRAZIL_OFFSET_MS;
}

function parseYmd(ymd?: string | null): { year: number; month: number; day: number } | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return null;
  const [y, m, d] = ymd.trim().split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m - 1, day: d };
}

function resolveDateRange(
  periodRaw: string | undefined,
  customStart?: string,
  customEnd?: string,
  earliestDataIso?: string | null
) {
  const allowed: ServerlessDashboardPeriodKey[] = [
    '7d',
    '30d',
    '90d',
    'this_month',
    'last_month',
    'all',
    'custom',
  ];
  const period: ServerlessDashboardPeriodKey = allowed.includes(periodRaw as ServerlessDashboardPeriodKey)
    ? (periodRaw as ServerlessDashboardPeriodKey)
    : '7d';

  const nowMs = Date.now();
  const today = toBrazilDateParts(nowMs);
  const todayEndMs = brazilEndOfDayUtcMs(today.year, today.month, today.day);
  const DAY_MS = 24 * 60 * 60 * 1000;

  let startUtcMs: number;
  let endUtcMs: number = todayEndMs;
  let prevStartUtcMs: number | null = null;
  let prevEndUtcMs: number | null = null;
  let label = 'Últimos 7 dias';
  let bucketMode: 'day' | 'week' | 'month' = 'day';

  if (period === '7d') {
    const startRef = toBrazilDateParts(todayEndMs - 6 * DAY_MS);
    startUtcMs = brazilStartOfDayUtcMs(startRef.year, startRef.month, startRef.day);
    prevEndUtcMs = startUtcMs - 1;
    prevStartUtcMs = startUtcMs - 7 * DAY_MS;
    label = 'Últimos 7 dias';
    bucketMode = 'day';
  } else if (period === '30d') {
    const startRef = toBrazilDateParts(todayEndMs - 29 * DAY_MS);
    startUtcMs = brazilStartOfDayUtcMs(startRef.year, startRef.month, startRef.day);
    prevEndUtcMs = startUtcMs - 1;
    prevStartUtcMs = startUtcMs - 30 * DAY_MS;
    label = 'Últimos 30 dias';
    bucketMode = 'day';
  } else if (period === '90d') {
    const startRef = toBrazilDateParts(todayEndMs - 89 * DAY_MS);
    startUtcMs = brazilStartOfDayUtcMs(startRef.year, startRef.month, startRef.day);
    prevEndUtcMs = startUtcMs - 1;
    prevStartUtcMs = startUtcMs - 90 * DAY_MS;
    label = 'Últimos 90 dias';
    bucketMode = 'week';
  } else if (period === 'this_month') {
    startUtcMs = brazilStartOfDayUtcMs(today.year, today.month, 1);
    const prevMonthYear = today.month === 0 ? today.year - 1 : today.year;
    const prevMonth = today.month === 0 ? 11 : today.month - 1;
    prevStartUtcMs = brazilStartOfDayUtcMs(prevMonthYear, prevMonth, 1);
    prevEndUtcMs = startUtcMs - 1;
    label = 'Este mês';
    bucketMode = 'day';
  } else if (period === 'last_month') {
    const prevMonthYear = today.month === 0 ? today.year - 1 : today.year;
    const prevMonth = today.month === 0 ? 11 : today.month - 1;
    const lastDayPrevMonth = new Date(Date.UTC(prevMonthYear, prevMonth + 1, 0)).getUTCDate();
    startUtcMs = brazilStartOfDayUtcMs(prevMonthYear, prevMonth, 1);
    endUtcMs = brazilEndOfDayUtcMs(prevMonthYear, prevMonth, lastDayPrevMonth);

    const prev2Year = prevMonth === 0 ? prevMonthYear - 1 : prevMonthYear;
    const prev2Month = prevMonth === 0 ? 11 : prevMonth - 1;
    const lastDayPrev2 = new Date(Date.UTC(prev2Year, prev2Month + 1, 0)).getUTCDate();
    prevStartUtcMs = brazilStartOfDayUtcMs(prev2Year, prev2Month, 1);
    prevEndUtcMs = brazilEndOfDayUtcMs(prev2Year, prev2Month, lastDayPrev2);

    label = 'Mês anterior';
    bucketMode = 'day';
  } else if (period === 'custom') {
    const parsedStart = parseYmd(customStart);
    const parsedEnd = parseYmd(customEnd);
    if (parsedStart && parsedEnd) {
      let sMs = brazilStartOfDayUtcMs(parsedStart.year, parsedStart.month, parsedStart.day);
      let eMs = brazilEndOfDayUtcMs(parsedEnd.year, parsedEnd.month, parsedEnd.day);
      if (sMs > eMs) {
        sMs = brazilStartOfDayUtcMs(parsedEnd.year, parsedEnd.month, parsedEnd.day);
        eMs = brazilEndOfDayUtcMs(parsedStart.year, parsedStart.month, parsedStart.day);
      }
      startUtcMs = sMs;
      endUtcMs = eMs;
      const spanMs = Math.max(DAY_MS, endUtcMs - startUtcMs + 1);
      prevEndUtcMs = startUtcMs - 1;
      prevStartUtcMs = startUtcMs - spanMs;
      const spanDays = Math.ceil(spanMs / DAY_MS);
      bucketMode = spanDays > 120 ? 'month' : spanDays > 35 ? 'week' : 'day';
      const sParts = toBrazilDateParts(startUtcMs);
      const eParts = toBrazilDateParts(endUtcMs);
      label = `${String(sParts.day).padStart(2, '0')}/${String(sParts.month + 1).padStart(2, '0')} – ${String(eParts.day).padStart(2, '0')}/${String(eParts.month + 1).padStart(2, '0')}`;
    } else {
      const startRef = toBrazilDateParts(todayEndMs - 29 * DAY_MS);
      startUtcMs = brazilStartOfDayUtcMs(startRef.year, startRef.month, startRef.day);
      prevEndUtcMs = startUtcMs - 1;
      prevStartUtcMs = startUtcMs - 30 * DAY_MS;
      label = 'Período personalizado';
      bucketMode = 'day';
    }
  } else {
    const earliestMs = earliestDataIso ? Date.parse(earliestDataIso) : NaN;
    const defaultStart = toBrazilDateParts(todayEndMs - 179 * DAY_MS);
    const fallbackStartMs = brazilStartOfDayUtcMs(defaultStart.year, defaultStart.month, defaultStart.day);
    startUtcMs = Number.isFinite(earliestMs) && earliestMs < fallbackStartMs ? earliestMs : fallbackStartMs;
    prevStartUtcMs = null;
    prevEndUtcMs = null;
    label = 'Todo o período';
    const spanDays = Math.ceil((endUtcMs - startUtcMs) / DAY_MS);
    bucketMode = spanDays > 90 ? 'month' : spanDays > 35 ? 'week' : 'day';
  }

  return {
    period,
    label,
    startUtcMs,
    endUtcMs,
    prevStartUtcMs,
    prevEndUtcMs,
    startDateStr: toBrazilDateParts(startUtcMs).dateKey,
    endDateStr: toBrazilDateParts(endUtcMs).dateKey,
    bucketMode,
  };
}

function computeDeltaPercent(
  current: number,
  previous: number | null
): { deltaPct: number | null; trend: 'up' | 'down' | 'neutral'; hasBaseline: boolean } {
  if (previous === null) {
    return { deltaPct: null, trend: 'neutral', hasBaseline: false };
  }
  if (previous === 0) {
    if (current === 0) return { deltaPct: 0, trend: 'neutral', hasBaseline: false };
    return { deltaPct: 100, trend: 'up', hasBaseline: true };
  }
  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw * 10) / 10;
  return {
    deltaPct: rounded,
    trend: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral',
    hasBaseline: true,
  };
}

function extractStripeBalanceSummary(balance: Stripe.Balance) {
  const brlAvail = balance.available
    .filter((b) => b.currency.toLowerCase() === 'brl')
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);
  const brlPending = balance.pending
    .filter((b) => b.currency.toLowerCase() === 'brl')
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);

  const hasBrl =
    balance.available.some((b) => b.currency.toLowerCase() === 'brl') ||
    balance.pending.some((b) => b.currency.toLowerCase() === 'brl');

  if (hasBrl) {
    return { availableBalanceCents: brlAvail, pendingBalanceCents: brlPending, currency: 'brl' };
  }

  const fallbackCurrency = balance.available[0]?.currency || balance.pending[0]?.currency || 'brl';
  const fallbackAvail = balance.available
    .filter((b) => b.currency === fallbackCurrency)
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);
  const fallbackPending = balance.pending
    .filter((b) => b.currency === fallbackCurrency)
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);

  return {
    availableBalanceCents: fallbackAvail,
    pendingBalanceCents: fallbackPending,
    currency: fallbackCurrency.toLowerCase(),
  };
}

async function safeSupabaseSelect(
  supabase: SupabaseClient,
  table: string,
  build?: (q: any) => any
): Promise<any[]> {
  try {
    let q = supabase.from(table).select('*');
    if (build) q = build(q);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function parseFirstCategory(raw: any): string {
  if (!raw) return '';
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      return parsed[0];
    }
  } catch {}
  return '';
}

function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return String(val.stringValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const vals = val.arrayValue?.values;
    return Array.isArray(vals) ? vals.map(decodeFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return val;
}

async function fetchFirestoreWalletsFallback(cfg?: {
  projectId: string;
  apiKey: string;
  databaseId?: string;
}): Promise<any[]> {
  if (!cfg?.projectId || !cfg?.apiKey) return [];
  const dbId = cfg.databaseId || 'ai-studio-monvian-57f74cb5-b162-47d6-acac-3774c885a8c4';
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/${encodeURIComponent(dbId)}/documents/platanos_wallets?pageSize=200&key=${encodeURIComponent(
    cfg.apiKey
  )}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2200);
    const resp = await fetch(endpoint, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const json = (await resp.json()) as { documents?: Array<{ fields?: Record<string, any> }> };
    if (!Array.isArray(json?.documents)) return [];
    return json.documents
      .map((d) => {
        const fields = d.fields || {};
        const parsed: Record<string, any> = {};
        for (const [k, v] of Object.entries(fields)) {
          parsed[k] = decodeFirestoreValue(v);
        }
        return parsed;
      })
      .filter((w) => w && (w.userEmail || w.userId));
  } catch {
    return [];
  }
}

async function resolveWebhookSecretServerless(supabase: SupabaseClient): Promise<string> {
  const envResolved = resolveStripeWebhookSecretFromEnv();
  if (envResolved.secret) return envResolved.secret;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'stripe_webhook_secret')
      .maybeSingle();
    const dbSecret = sanitizeStripeCredential(data?.value);
    return isValidStripeWebhookSecret(dbSecret) ? dbSecret : '';
  } catch {
    return '';
  }
}

export async function invalidateStripeSnapshotCacheServerless(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.from('system_settings').delete().eq('key', SNAPSHOT_CACHE_KEY);
  } catch {}
}

/**
 * Syncs live balance + historical charges + checkout sessions directly from Stripe API,
 * safely coalescing with any stored orders in system_settings / Supabase without double-counting.
 */
async function syncStripeSnapshotServerless(
  ctx: ServerlessFinanceContext,
  forceSync: boolean,
  preloadedSettings?: Array<{ key: string; value: string; updated_at?: string }>
): Promise<StripeSnapshotCache> {
  const { supabase } = ctx;

  if (!forceSync) {
    try {
      const cachedRow = preloadedSettings?.find((r) => r.key === SNAPSHOT_CACHE_KEY);
      let rawVal = cachedRow?.value;
      if (!rawVal) {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', SNAPSHOT_CACHE_KEY)
          .maybeSingle();
        rawVal = data?.value;
      }
      if (rawVal) {
        const parsed = JSON.parse(rawVal) as StripeSnapshotCache;
        const syncedMs = parsed?.syncedAt ? Date.parse(parsed.syncedAt) : 0;
        if (
          parsed?.configured === true &&
          !parsed?.syncError &&
          syncedMs &&
          Date.now() - syncedMs < SNAPSHOT_TTL_MS &&
          Array.isArray(parsed.transactions)
        ) {
          return parsed;
        }
      }
    } catch {}
  }

  const envDiagnostic = resolveStripeSecretKeyFromEnv();
  const [stripe, webhookSecret] = await Promise.all([
    ctx.getStripeClient(),
    resolveWebhookSecretServerless(supabase),
  ]);

  let availableBalanceCents = 0;
  let pendingBalanceCents = 0;
  let currency = 'brl';
  let livemode = envDiagnostic.livemode;
  let syncError: string | null = null;
  const txByCanonicalId = new Map<string, CanonicalStripeTx>();
  const seenSessionIds = new Set<string>();
  const seenPaymentIntentIds = new Set<string>();

  if (stripe) {
    const syncDeadlineMs = Date.now() + 7500;
    const sessionMetaByPi = new Map<string, Stripe.Checkout.Session>();
    const allPaidSessions: Stripe.Checkout.Session[] = [];
    const allCharges: Stripe.Charge[] = [];

    const fetchBalanceTask = async () => {
      try {
        const balance = await stripe.balance.retrieve();
        const summary = extractStripeBalanceSummary(balance);
        availableBalanceCents = summary.availableBalanceCents;
        pendingBalanceCents = summary.pendingBalanceCents;
        currency = summary.currency;
        livemode = Boolean(balance.livemode || livemode);
      } catch (err: any) {
        syncError = sanitizeStripeErrorMessage(err, 'Erro ao consultar saldo na Stripe.');
      }
    };

    const fetchSessionsTask = async () => {
      try {
        let startingAfter: string | undefined;
        for (let page = 0; page < 5; page++) {
          if (page > 0 && Date.now() > syncDeadlineMs) break;
          const list = await stripe.checkout.sessions.list({
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          });
          for (const session of list.data) {
            seenSessionIds.add(session.id);
            const piId =
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id || '';
            if (piId) {
              sessionMetaByPi.set(piId, session);
            }
            if (session.payment_status === 'paid') {
              allPaidSessions.push(session);
            }
          }
          if (!list.has_more || list.data.length === 0) break;
          startingAfter = list.data[list.data.length - 1].id;
        }
      } catch {}
    };

    const fetchChargesTask = async () => {
      let useExpand = true;
      let startingAfter: string | undefined;
      for (let page = 0; page < 6; page++) {
        if (page > 0 && Date.now() > syncDeadlineMs) break;
        try {
          const list = await stripe.charges.list({
            limit: 100,
            ...(useExpand ? { expand: ['data.balance_transaction'] } : {}),
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          });
          for (const charge of list.data) {
            allCharges.push(charge);
          }
          if (!list.has_more || list.data.length === 0) break;
          startingAfter = list.data[list.data.length - 1].id;
        } catch (err: any) {
          const msg = String(err?.message || '').toLowerCase();
          if (useExpand && (msg.includes('permission') || msg.includes('balance_transaction') || msg.includes('expand'))) {
            useExpand = false;
            page--;
            continue;
          }
          syncError = syncError || sanitizeStripeErrorMessage(err, 'Erro ao sincronizar histórico da Stripe.');
          break;
        }
      }
    };

    await Promise.all([fetchBalanceTask(), fetchSessionsTask(), fetchChargesTask()]);

    for (const charge of allCharges) {
      const piId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id || null;
      if (piId) seenPaymentIntentIds.add(piId);
      const session = piId ? sessionMetaByPi.get(piId) : undefined;
      if (session?.id) seenSessionIds.add(session.id);

      const bt =
        charge.balance_transaction && typeof charge.balance_transaction === 'object'
          ? (charge.balance_transaction as Stripe.BalanceTransaction)
          : null;

      const mergedMeta = {
        ...(charge.metadata || {}),
        ...(session?.metadata || {}),
      };

      let paymentStatus: CanonicalStripeTx['paymentStatus'] = 'pending';
      if (charge.disputed) {
        paymentStatus = 'disputed';
      } else if (charge.refunded || (charge.amount_refunded > 0 && charge.amount_refunded >= charge.amount)) {
        paymentStatus = 'refunded';
      } else if (charge.amount_refunded > 0) {
        paymentStatus = 'partially_refunded';
      } else if (charge.status === 'succeeded' && charge.paid) {
        paymentStatus = 'succeeded';
      } else if (charge.status === 'failed') {
        paymentStatus = 'failed';
      }

      const platanosAmount = Number(mergedMeta.platanosAmount || 0) || 0;
      const itineraryId = mergedMeta.itineraryId || null;
      const itineraryTitle = mergedMeta.itineraryTitle || null;
      const canonicalId = piId || charge.id;
      const feeCents = Number(bt?.fee || 0);
      const netCents = bt?.net !== undefined ? Number(bt.net) : Math.max(0, charge.amount - feeCents);

      txByCanonicalId.set(canonicalId, {
        id: canonicalId,
        stripeChargeId: charge.id,
        stripePaymentIntentId: piId,
        stripeSessionId: session?.id || null,
        customerEmail:
          mergedMeta.userEmail ||
          charge.billing_details?.email ||
          charge.receipt_email ||
          session?.customer_details?.email ||
          null,
        productName:
          itineraryTitle ||
          charge.description ||
          (platanosAmount > 0 ? `Recarga ${platanosAmount} Plátanos` : 'Venda Stripe'),
        productType: itineraryId
          ? 'itinerary_direct'
          : mergedMeta.type || (platanosAmount > 0 ? 'platanos_topup' : 'other'),
        packageId: mergedMeta.packageId || null,
        platanosAmount,
        itineraryId,
        itineraryTitle,
        grossAmountCents: Number(charge.amount || 0),
        feeAmountCents: feeCents,
        netAmountCents: netCents,
        refundedAmountCents: Number(charge.amount_refunded || 0),
        currency: (charge.currency || 'brl').toLowerCase(),
        paymentStatus,
        livemode: Boolean(charge.livemode),
        purchasedAt: new Date(charge.created * 1000).toISOString(),
      });
    }

    // Fallback: include any paid Checkout Sessions not already captured by charges.list
    for (const session of allPaidSessions) {
      const piId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null;
      const canonicalId = piId || session.id;
      if (txByCanonicalId.has(canonicalId) || (piId && seenPaymentIntentIds.has(piId))) {
        continue;
      }
      const platanosAmount = Number(session.metadata?.platanosAmount || 0) || 0;
      const itineraryId = session.metadata?.itineraryId || null;
      const itineraryTitle = session.metadata?.itineraryTitle || null;
      txByCanonicalId.set(canonicalId, {
        id: canonicalId,
        stripeChargeId: null,
        stripePaymentIntentId: piId,
        stripeSessionId: session.id,
        customerEmail:
          session.metadata?.userEmail ||
          session.customer_email ||
          session.customer_details?.email ||
          null,
        productName:
          itineraryTitle ||
          (platanosAmount > 0 ? `Pacote ${platanosAmount} Plátanos` : 'Compra Monvian'),
        productType: itineraryId ? 'itinerary_direct' : session.metadata?.type || 'platanos_topup',
        packageId: session.metadata?.packageId || null,
        platanosAmount,
        itineraryId,
        itineraryTitle,
        grossAmountCents: session.amount_total ?? 0,
        feeAmountCents: 0,
        netAmountCents: session.amount_total ?? 0,
        refundedAmountCents: 0,
        currency: (session.currency || 'brl').toLowerCase(),
        paymentStatus: 'succeeded',
        livemode: Boolean(session.livemode),
        purchasedAt: new Date(session.created * 1000).toISOString(),
      });
    }
  } else {
    syncError = envDiagnostic.detectedPublishableOnly
      ? 'Apenas a chave publicável (pk_...) foi detectada nas variáveis de ambiente. Configure a chave secreta da Stripe (sk_live_... ou sk_test_...) em STRIPE_SECRET_KEY na Vercel e faça um novo deploy.'
      : 'Chave secreta da Stripe (STRIPE_SECRET_KEY) não encontrada nas variáveis de ambiente do servidor. Verifique se está definida para o ambiente atual na Vercel (Production/Preview) e faça um novo deploy.';
  }

  // 4. Merge any persisted paid orders from system_settings or Supabase tables not already in Stripe response
  const settingsRows =
    preloadedSettings ||
    (await safeSupabaseSelect(supabase, 'system_settings', (q) => q.like('key', 'platanos_%')));

  const [dbOrders, dbPurchases] = await Promise.all([
    safeSupabaseSelect(supabase, 'platanos_stripe_orders'),
    safeSupabaseSelect(supabase, 'purchases'),
  ]);

  const ingestFallbackOrder = (ord: any) => {
    if (!ord) return;
    const status = String(ord.status || ord.payment_status || '').toLowerCase();
    if (status !== 'paid' && status !== 'succeeded' && status !== 'refunded') return;
    const sid = String(ord.stripeSessionId || ord.stripe_session_id || '').trim();
    const piId = String(ord.stripePaymentIntentId || ord.stripe_payment_intent_id || '').trim();
    if ((sid && seenSessionIds.has(sid)) || (piId && seenPaymentIntentIds.has(piId))) return;
    const cid = piId || sid || String(ord.id || '');
    if (!cid || txByCanonicalId.has(cid)) return;

    const grossCents = Number(ord.amountCents ?? ord.amount_cents ?? ord.amount_total ?? 0);
    const platanosAmt = Number(ord.platanosAmount ?? ord.platanos_amount ?? 0);
    txByCanonicalId.set(cid, {
      id: cid,
      stripeChargeId: null,
      stripePaymentIntentId: piId || null,
      stripeSessionId: sid || null,
      customerEmail: (ord.userEmail || ord.user_email || null) as string | null,
      productName:
        platanosAmt > 0 ? `Recarga ${platanosAmt} Plátanos` : String(ord.plan_granted || 'Venda Monvian'),
      productType: 'platanos_topup',
      packageId: (ord.packageId || ord.package_id || null) as string | null,
      platanosAmount: platanosAmt,
      itineraryId: null,
      itineraryTitle: null,
      grossAmountCents: grossCents,
      feeAmountCents: 0,
      netAmountCents: grossCents,
      refundedAmountCents: status === 'refunded' ? grossCents : 0,
      currency: String(ord.currency || 'brl').toLowerCase(),
      paymentStatus: status === 'refunded' ? 'refunded' : 'succeeded',
      livemode: false,
      purchasedAt: String(ord.createdAt || ord.created_at || new Date().toISOString()),
    });
  };

  for (const row of settingsRows) {
    if (row.key.startsWith('platanos_order_') && row.value) {
      try {
        ingestFallbackOrder(JSON.parse(row.value));
      } catch {}
    }
  }
  for (const ord of dbOrders) ingestFallbackOrder(ord);
  for (const pur of dbPurchases) ingestFallbackOrder(pur);

  const snapshot: StripeSnapshotCache = {
    syncedAt: new Date().toISOString(),
    configured: Boolean(stripe),
    livemode,
    hasWebhookSecret: Boolean(webhookSecret),
    availableBalanceCents,
    pendingBalanceCents,
    currency,
    transactions: Array.from(txByCanonicalId.values()).sort(
      (a, b) => parseTimestampMs(a.purchasedAt) - parseTimestampMs(b.purchasedAt)
    ),
    syncError,
  };

  try {
    await supabase.from('system_settings').upsert(
      {
        key: SNAPSHOT_CACHE_KEY,
        value: JSON.stringify(snapshot),
        updated_at: snapshot.syncedAt,
      },
      { onConflict: 'key' }
    );
  } catch {}

  return snapshot;
}

/**
 * Loads unified, deduplicated Plátanos wallets, orders, transactions, unlocks, itineraries,
 * and audit logs across system_settings, Supabase relational tables, Firestore fallback, and Stripe.
 */
async function collectAllPlatanosRecordsServerless(
  ctx: ServerlessFinanceContext,
  options?: { forceStripeSync?: boolean }
) {
  const { supabase } = ctx;

  const [
    settingsRows,
    usersRows,
    itinerariesRows,
    dbWallets,
    dbTransactions,
    dbOrders,
    dbUnlocks,
    dbAuditLogs,
    firestoreWallets,
    packagesAll,
    itineraryPrices,
  ] = await Promise.all([
    safeSupabaseSelect(supabase, 'system_settings', (q) => q.like('key', 'platanos_%')),
    safeSupabaseSelect(supabase, 'users', (q) => q.select('id, name, email, whatsapp, is_gold')),
    safeSupabaseSelect(supabase, 'itineraries'),
    safeSupabaseSelect(supabase, 'platanos_wallets'),
    safeSupabaseSelect(supabase, 'platanos_transactions'),
    safeSupabaseSelect(supabase, 'platanos_stripe_orders'),
    safeSupabaseSelect(supabase, 'platanos_itinerary_unlocks'),
    safeSupabaseSelect(supabase, 'platanos_admin_audit_logs'),
    fetchFirestoreWalletsFallback(ctx.firebaseConfig),
    ctx.getPackages(true),
    ctx.getItineraryPrices(),
  ]);

  const snapshot = await syncStripeSnapshotServerless(
    ctx,
    Boolean(options?.forceStripeSync),
    settingsRows
  );

  // User lookup maps (by email & by id)
  const userByEmail = new Map<string, { id: number; name: string; email: string }>();
  const userById = new Map<number, { id: number; name: string; email: string }>();
  for (const u of usersRows) {
    const uid = Number(u.id);
    const email = String(u.email || u.whatsapp || '').trim().toLowerCase();
    const name = String(u.name || (email ? email.split('@')[0] : `Usuário #${uid}`)).trim();
    const rec = { id: uid, name, email };
    if (email) userByEmail.set(email, rec);
    if (Number.isFinite(uid) && uid > 0) userById.set(uid, rec);
  }

  const resolveUserMeta = (rawId: any, rawEmail: any) => {
    const cleanEmail = String(rawEmail || '').trim().toLowerCase();
    const numId = Number(rawId);
    const byEmail = cleanEmail ? userByEmail.get(cleanEmail) : undefined;
    const byId = Number.isFinite(numId) && numId > 0 ? userById.get(numId) : undefined;
    const resolvedId = byEmail?.id || byId?.id || (Number.isFinite(numId) && numId > 0 ? numId : 0);
    const resolvedEmail = cleanEmail || byId?.email || byEmail?.email || '';
    const resolvedName =
      byEmail?.name || byId?.name || (resolvedEmail ? resolvedEmail.split('@')[0] : 'Explorador');
    return {
      user_id: resolvedId,
      user_email: resolvedEmail,
      user_name: resolvedName,
    };
  };

  // Catalog map for itineraries (Supabase + curated defaults)
  const itineraryMap = new Map<
    string,
    {
      id: string;
      title: string;
      isPremium: boolean;
      platanosPrice: number;
      usageCount: number;
      status: string;
      coverImage: string;
      subtitle: string;
    }
  >();

  for (const def of DEFAULT_CURATED_ITINERARIES) {
    const priceOverride = itineraryPrices[def.id];
    const isPrem = priceOverride !== undefined ? priceOverride > 0 : Boolean(def.isPremium);
    const pPrice =
      priceOverride !== undefined
        ? priceOverride
        : isPrem
          ? Number(def.platanosPrice || 15)
          : 0;
    itineraryMap.set(def.id, {
      id: def.id,
      title: def.title,
      isPremium: isPrem,
      platanosPrice: pPrice,
      usageCount: Number(def.usageCount || 0),
      status: def.status || 'published',
      coverImage: def.coverImage || '',
      subtitle: parseFirstCategory(def.categories) || `${def.daysCount || 1} dia(s) em Campos`,
    });
  }

  for (const r of itinerariesRows) {
    const id = String(r.id);
    const priceOverride = itineraryPrices[id];
    const isPrem =
      priceOverride !== undefined ? priceOverride > 0 : Number(r.is_premium) === 1;
    const pPrice =
      priceOverride !== undefined
        ? priceOverride
        : isPrem
          ? Number(r.platanos_price || 15)
          : 0;
    itineraryMap.set(id, {
      id,
      title: String(r.title || itineraryMap.get(id)?.title || id),
      isPremium: isPrem,
      platanosPrice: pPrice,
      usageCount: Number(r.usage_count ?? itineraryMap.get(id)?.usageCount ?? 0),
      status: String(r.status || 'published'),
      coverImage: String(r.cover_image || itineraryMap.get(id)?.coverImage || ''),
      subtitle:
        parseFirstCategory(r.categories) ||
        (r.days_count ? `${r.days_count} dia(s) em Campos` : 'Roteiro Monvian'),
    });
  }

  // Wallets, Transactions, Orders, Unlocks aggregation
  const walletMap = new Map<string, any>();
  const txMap = new Map<string, any>();
  const orderMap = new Map<string, any>();
  const unlockMap = new Map<string, any>();
  let auditLogsList: any[] = [];

  const upsertWallet = (raw: any) => {
    const meta = resolveUserMeta(raw.user_id ?? raw.userId, raw.user_email ?? raw.userEmail);
    const key = meta.user_email || (meta.user_id ? `uid_${meta.user_id}` : '');
    if (!key) return;
    const existing = walletMap.get(key);
    const candidate = {
      user_id: meta.user_id || existing?.user_id || hashEmailToNumericId(key),
      user_name: meta.user_name || existing?.user_name || key,
      user_email: meta.user_email || existing?.user_email || key,
      balance: Number(raw.balance ?? existing?.balance ?? 0),
      total_credited: Number(raw.total_credited ?? raw.totalCredited ?? existing?.total_credited ?? 0),
      total_spent: Number(raw.total_spent ?? raw.totalSpent ?? existing?.total_spent ?? 0),
      updated_at: String(raw.updated_at || raw.updatedAt || existing?.updated_at || new Date().toISOString()),
    };
    if (
      !existing ||
      parseTimestampMs(candidate.updated_at) >= parseTimestampMs(existing.updated_at) ||
      candidate.total_credited > existing.total_credited
    ) {
      walletMap.set(key, candidate);
    }
  };

  const upsertTx = (raw: any) => {
    const id = String(raw.id || '');
    if (!id) return;
    const meta = resolveUserMeta(raw.user_id ?? raw.userId, raw.user_email ?? raw.userEmail);
    const normalized = {
      id,
      user_id: meta.user_id || hashEmailToNumericId(meta.user_email || id),
      user_name: meta.user_name,
      user_email: meta.user_email,
      type: String(raw.type || 'credit_purchase'),
      amount: Number(raw.amount || 0),
      balance_before: Number(raw.balance_before ?? raw.balanceBefore ?? 0),
      balance_after: Number(raw.balance_after ?? raw.balanceAfter ?? 0),
      status: String(raw.status || 'completed'),
      description: String(raw.description || ''),
      reference_type: String(raw.reference_type ?? raw.referenceType ?? ''),
      reference_id: String(raw.reference_id ?? raw.referenceId ?? ''),
      created_at: String(raw.created_at || raw.createdAt || new Date().toISOString()),
    };
    if (!txMap.has(id)) {
      txMap.set(id, normalized);
    }
    if (normalized.type === 'debit_itinerary' && normalized.status === 'completed' && normalized.reference_id) {
      const itId = normalized.reference_id;
      const uKey = `${normalized.user_email || normalized.user_id}::${itId}`;
      if (!unlockMap.has(uKey)) {
        const itInfo = itineraryMap.get(itId);
        unlockMap.set(uKey, {
          id: `unl_${normalized.id}`,
          user_id: normalized.user_id,
          user_name: normalized.user_name,
          user_email: normalized.user_email,
          itinerary_id: itId,
          itinerary_title:
            itInfo?.title ||
            normalized.description.replace(/^Roteiro adicionado:\s*/i, '').trim() ||
            itId,
          platanos_paid: Math.abs(normalized.amount) || itInfo?.platanosPrice || 15,
          created_at: normalized.created_at,
        });
      }
    }
  };

  const upsertOrder = (raw: any) => {
    const sid = String(raw.stripe_session_id ?? raw.stripeSessionId ?? raw.id ?? '').trim();
    if (!sid) return;
    const meta = resolveUserMeta(raw.user_id ?? raw.userId, raw.user_email ?? raw.userEmail);
    const existing = orderMap.get(sid);
    const candidate = {
      id: String(raw.id || existing?.id || sid),
      user_id: meta.user_id || existing?.user_id || hashEmailToNumericId(meta.user_email || sid),
      user_name: meta.user_name || existing?.user_name || '',
      user_email: meta.user_email || existing?.user_email || '',
      package_id: String(raw.package_id ?? raw.packageId ?? existing?.package_id ?? 'pkg_15'),
      platanos_amount: Number(raw.platanos_amount ?? raw.platanosAmount ?? existing?.platanos_amount ?? 0),
      amount_cents: Number(raw.amount_cents ?? raw.amountCents ?? existing?.amount_cents ?? 0),
      currency: String(raw.currency || existing?.currency || 'brl').toLowerCase(),
      stripe_session_id: sid,
      stripe_payment_intent_id:
        raw.stripe_payment_intent_id ?? raw.stripePaymentIntentId ?? existing?.stripe_payment_intent_id ?? null,
      status: String(raw.status || existing?.status || 'pending').toLowerCase(),
      credited: Number(raw.credited ?? existing?.credited ?? (raw.status === 'paid' ? 1 : 0)),
      created_at: String(raw.created_at || raw.createdAt || existing?.created_at || new Date().toISOString()),
      updated_at: String(raw.updated_at || raw.updatedAt || existing?.updated_at || new Date().toISOString()),
    };
    if (!existing || candidate.status === 'paid' || candidate.status === 'refunded') {
      orderMap.set(sid, candidate);
    }
  };

  // Ingest system_settings records (primary Vercel persistence)
  for (const row of settingsRows) {
    if (!row?.key || !row?.value) continue;
    if (row.key.startsWith('platanos_wallet_')) {
      try {
        const w = JSON.parse(row.value);
        const emailFromKey = row.key.replace('platanos_wallet_', '').trim().toLowerCase();
        if (!w.userEmail && emailFromKey.includes('@')) w.userEmail = emailFromKey;
        w.updated_at = w.updatedAt || row.updated_at;
        upsertWallet(w);
        if (Array.isArray(w.transactions)) {
          for (const t of w.transactions) upsertTx({ ...t, userEmail: t.userEmail || w.userEmail, userId: t.userId || w.userId });
        }
        if (Array.isArray(w.orders)) {
          for (const o of w.orders) upsertOrder({ ...o, userEmail: o.userEmail || w.userEmail, userId: o.userId || w.userId });
        }
        if (Array.isArray(w.unlockedItineraryIds)) {
          const wMeta = resolveUserMeta(w.userId, w.userEmail);
          for (const itId of w.unlockedItineraryIds) {
            const uKey = `${wMeta.user_email || wMeta.user_id}::${itId}`;
            if (!unlockMap.has(uKey)) {
              const itInfo = itineraryMap.get(String(itId));
              unlockMap.set(uKey, {
                id: `unl_${wMeta.user_id || 'u'}_${itId}`,
                user_id: wMeta.user_id || hashEmailToNumericId(wMeta.user_email || String(itId)),
                user_name: wMeta.user_name,
                user_email: wMeta.user_email,
                itinerary_id: String(itId),
                itinerary_title: itInfo?.title || String(itId),
                platanos_paid: itInfo?.platanosPrice || 15,
                created_at: String(w.updated_at || row.updated_at || new Date().toISOString()),
              });
            }
          }
        }
      } catch {}
    } else if (row.key.startsWith('platanos_order_')) {
      try {
        upsertOrder(JSON.parse(row.value));
      } catch {}
    } else if (row.key === 'platanos_admin_audit_logs_json') {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) auditLogsList = parsed;
      } catch {}
    }
  }

  // Ingest Supabase relational rows (if populated by Express backend)
  for (const w of dbWallets) upsertWallet(w);
  for (const t of dbTransactions) upsertTx(t);
  for (const o of dbOrders) upsertOrder(o);
  for (const u of dbUnlocks) {
    const meta = resolveUserMeta(u.user_id, u.user_email);
    const uKey = `${meta.user_email || meta.user_id}::${u.itinerary_id}`;
    const itInfo = itineraryMap.get(String(u.itinerary_id));
    unlockMap.set(uKey, {
      id: u.id || `unl_${uKey}`,
      user_id: meta.user_id || Number(u.user_id || 0),
      user_name: meta.user_name,
      user_email: meta.user_email,
      itinerary_id: String(u.itinerary_id),
      itinerary_title: itInfo?.title || u.itinerary_title || String(u.itinerary_id),
      platanos_paid: Number(u.platanos_paid || itInfo?.platanosPrice || 15),
      created_at: String(u.created_at || new Date().toISOString()),
    });
  }

  // Ingest Firestore wallets fallback (only enrich missing data)
  for (const fw of firestoreWallets) {
    upsertWallet(fw);
    if (Array.isArray(fw.unlockedItineraryIds)) {
      const fMeta = resolveUserMeta(fw.userId, fw.userEmail);
      for (const itId of fw.unlockedItineraryIds) {
        const uKey = `${fMeta.user_email || fMeta.user_id}::${itId}`;
        if (!unlockMap.has(uKey)) {
          const itInfo = itineraryMap.get(String(itId));
          unlockMap.set(uKey, {
            id: `unl_fs_${fMeta.user_id || 'u'}_${itId}`,
            user_id: fMeta.user_id || hashEmailToNumericId(fMeta.user_email || String(itId)),
            user_name: fMeta.user_name,
            user_email: fMeta.user_email,
            itinerary_id: String(itId),
            itinerary_title: itInfo?.title || String(itId),
            platanos_paid: itInfo?.platanosPrice || 15,
            created_at: String(fw.updatedAt || new Date().toISOString()),
          });
        }
      }
    }
  }

  // Ingest real Stripe Plátanos topup transactions into orders if missing
  for (const tx of snapshot.transactions) {
    if (tx.productType === 'platanos_topup' || tx.platanosAmount > 0) {
      const sid = tx.stripeSessionId || tx.stripePaymentIntentId || tx.id;
      const mappedStatus =
        tx.paymentStatus === 'succeeded'
          ? 'paid'
          : tx.paymentStatus === 'refunded'
            ? 'refunded'
            : tx.paymentStatus === 'failed'
              ? 'failed'
              : 'pending';
      upsertOrder({
        id: tx.id,
        user_email: tx.customerEmail || '',
        package_id: tx.packageId || 'pkg_15',
        platanos_amount: tx.platanosAmount,
        amount_cents: tx.grossAmountCents,
        currency: tx.currency,
        stripe_session_id: sid,
        stripe_payment_intent_id: tx.stripePaymentIntentId,
        status: mappedStatus,
        credited: mappedStatus === 'paid' ? 1 : 0,
        created_at: tx.purchasedAt,
        updated_at: tx.purchasedAt,
      });
    }
  }

  const wallets = Array.from(walletMap.values()).sort(
    (a, b) => b.balance - a.balance || parseTimestampMs(b.updated_at) - parseTimestampMs(a.updated_at)
  );
  const transactions = Array.from(txMap.values())
    .sort((a, b) => parseTimestampMs(b.created_at) - parseTimestampMs(a.created_at))
    .slice(0, 200);
  const orders = Array.from(orderMap.values())
    .sort((a, b) => parseTimestampMs(b.created_at) - parseTimestampMs(a.created_at))
    .slice(0, 200);
  const unlocks = Array.from(unlockMap.values())
    .sort((a, b) => parseTimestampMs(b.created_at) - parseTimestampMs(a.created_at))
    .slice(0, 200);

  const combinedAuditMap = new Map<string, any>();
  for (const log of [...auditLogsList, ...dbAuditLogs]) {
    const key = String(log.id || `${log.action}_${log.created_at}`);
    if (!combinedAuditMap.has(key)) combinedAuditMap.set(key, log);
  }
  const auditLogs = Array.from(combinedAuditMap.values())
    .sort((a, b) => parseTimestampMs(b.created_at) - parseTimestampMs(a.created_at))
    .slice(0, 100);

  const itineraries = Array.from(itineraryMap.values()).map((it) => ({
    id: it.id,
    title: it.title,
    isPremium: it.isPremium,
    platanosPrice: it.platanosPrice,
    usageCount: it.usageCount,
    status: it.status,
  }));

  return {
    snapshot,
    packages: packagesAll,
    itineraries,
    itineraryMap,
    wallets,
    transactions,
    orders,
    unlocks,
    auditLogs,
    settingsRows,
  };
}

function hashEmailToNumericId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export async function getFinancialDashboardMetricsServerless(
  ctx: ServerlessFinanceContext,
  params: {
    period?: string;
    startDate?: string;
    endDate?: string;
    forceSync?: boolean;
  }
) {
  const {
    snapshot,
    packages,
    itineraryMap,
    unlocks,
  } = await collectAllPlatanosRecordsServerless(ctx, {
    forceStripeSync: Boolean(params.forceSync),
  });

  const APPROVED_STATUSES = new Set(['succeeded', 'partially_refunded', 'refunded']);

  const approvedTxs = snapshot.transactions.filter((tx) =>
    APPROVED_STATUSES.has(tx.paymentStatus)
  );

  const earliestCandidates: string[] = [];
  if (approvedTxs.length > 0) earliestCandidates.push(approvedTxs[0].purchasedAt);
  for (const u of unlocks) {
    if (u.created_at) earliestCandidates.push(u.created_at);
  }
  earliestCandidates.sort();

  const range = resolveDateRange(
    params.period,
    params.startDate,
    params.endDate,
    earliestCandidates[0] || null
  );

  const currentStripeTxs: Array<CanonicalStripeTx & { _ms: number }> = [];
  const prevStripeTxs: Array<CanonicalStripeTx & { _ms: number }> = [];

  for (const tx of approvedTxs) {
    const ms = parseTimestampMs(tx.purchasedAt);
    if (ms >= range.startUtcMs && ms <= range.endUtcMs) {
      currentStripeTxs.push({ ...tx, _ms: ms });
    } else if (
      range.prevStartUtcMs !== null &&
      range.prevEndUtcMs !== null &&
      ms >= range.prevStartUtcMs &&
      ms <= range.prevEndUtcMs
    ) {
      prevStripeTxs.push({ ...tx, _ms: ms });
    }
  }

  const grossRevenueCents = currentStripeTxs.reduce(
    (sum, t) => sum + Number(t.grossAmountCents || 0),
    0
  );
  const feesCents = currentStripeTxs.reduce((sum, t) => sum + Number(t.feeAmountCents || 0), 0);
  const refundsCents = currentStripeTxs.reduce(
    (sum, t) => sum + Number(t.refundedAmountCents || 0),
    0
  );
  const netRevenueCents = Math.max(0, grossRevenueCents - feesCents - refundsCents);

  const prevGrossRevenueCents =
    range.prevStartUtcMs !== null
      ? prevStripeTxs.reduce((sum, t) => sum + Number(t.grossAmountCents || 0), 0)
      : null;

  const revenueComparison = computeDeltaPercent(grossRevenueCents, prevGrossRevenueCents);

  // Average cents per Plátano from active packages
  const activePkgs = packages.filter((p: any) => p.isActive !== false && Number(p.platanos) > 0);
  let centsPerPlatano = 2990 / 15;
  if (activePkgs.length > 0) {
    const totalP = activePkgs.reduce((acc: number, p: any) => acc + Number(p.platanos || 0), 0);
    const totalC = activePkgs.reduce((acc: number, p: any) => acc + Number(p.priceCents || 0), 0);
    if (totalP > 0 && totalC > 0) centsPerPlatano = totalC / totalP;
  }

  interface SaleEvent {
    ms: number;
    itineraryId: string;
    title: string;
    subtitle: string;
    coverImage: string;
    revenueCents: number;
    platanosPaid: number;
  }

  const currentSalesEvents: SaleEvent[] = [];
  const prevSalesEvents: SaleEvent[] = [];

  for (const u of unlocks) {
    const ms = parseTimestampMs(u.created_at);
    const cat = itineraryMap.get(String(u.itinerary_id));
    const ev: SaleEvent = {
      ms,
      itineraryId: String(u.itinerary_id),
      title: cat?.title || u.itinerary_title || 'Roteiro Turístico',
      subtitle: cat?.subtitle || 'Roteiro Monvian',
      coverImage: cat?.coverImage || '',
      revenueCents: Math.round(Number(u.platanos_paid || 0) * centsPerPlatano),
      platanosPaid: Number(u.platanos_paid || 0),
    };
    if (ms >= range.startUtcMs && ms <= range.endUtcMs) {
      currentSalesEvents.push(ev);
    } else if (
      range.prevStartUtcMs !== null &&
      range.prevEndUtcMs !== null &&
      ms >= range.prevStartUtcMs &&
      ms <= range.prevEndUtcMs
    ) {
      prevSalesEvents.push(ev);
    }
  }

  for (const tx of currentStripeTxs) {
    if (tx.itineraryId && tx.paymentStatus !== 'refunded') {
      const cat = itineraryMap.get(String(tx.itineraryId));
      currentSalesEvents.push({
        ms: tx._ms,
        itineraryId: String(tx.itineraryId),
        title: cat?.title || tx.itineraryTitle || tx.productName || 'Roteiro Turístico',
        subtitle: cat?.subtitle || 'Compra direta Stripe',
        coverImage: cat?.coverImage || '',
        revenueCents: Math.max(0, Number(tx.grossAmountCents || 0) - Number(tx.refundedAmountCents || 0)),
        platanosPaid: 0,
      });
    }
  }
  for (const tx of prevStripeTxs) {
    if (tx.itineraryId && tx.paymentStatus !== 'refunded') {
      const cat = itineraryMap.get(String(tx.itineraryId));
      prevSalesEvents.push({
        ms: tx._ms,
        itineraryId: String(tx.itineraryId),
        title: cat?.title || tx.itineraryTitle || tx.productName || 'Roteiro Turístico',
        subtitle: cat?.subtitle || 'Compra direta Stripe',
        coverImage: cat?.coverImage || '',
        revenueCents: Math.max(0, Number(tx.grossAmountCents || 0) - Number(tx.refundedAmountCents || 0)),
        platanosPaid: 0,
      });
    }
  }

  const itinerarySalesCount = currentSalesEvents.length;
  const prevItinerarySalesCount = range.prevStartUtcMs !== null ? prevSalesEvents.length : null;
  const salesComparison = computeDeltaPercent(itinerarySalesCount, prevItinerarySalesCount);

  // Top Itineraries ranking
  const rankingMap = new Map<string, any>();
  for (const ev of currentSalesEvents) {
    const existing = rankingMap.get(ev.itineraryId);
    if (existing) {
      existing.salesCount += 1;
      existing.revenueCents += ev.revenueCents;
      existing.platanosTotal += ev.platanosPaid;
    } else {
      rankingMap.set(ev.itineraryId, {
        id: ev.itineraryId,
        title: ev.title,
        subtitle: ev.subtitle,
        coverImage: ev.coverImage,
        salesCount: 1,
        revenueCents: ev.revenueCents,
        platanosTotal: ev.platanosPaid,
      });
    }
  }

  const topItineraries = Array.from(rankingMap.values())
    .sort((a, b) => b.salesCount - a.salesCount || b.revenueCents - a.revenueCents)
    .map((item, idx) => ({
      rank: idx + 1,
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      coverImage: item.coverImage,
      salesCount: item.salesCount,
      revenueCents: item.revenueCents,
      revenueReais: Number((item.revenueCents / 100).toFixed(2)),
      platanosTotal: item.platanosTotal,
    }));

  // Time-series buckets
  interface TimeBucket {
    key: string;
    label: string;
    fullLabel: string;
    startMs: number;
    endMs: number;
    revenueCents: number;
    feesCents: number;
    refundsCents: number;
    salesCount: number;
    approvedOrdersCount: number;
  }

  const buckets: TimeBucket[] = [];
  const DAY_MS = 24 * 60 * 60 * 1000;

  if (range.bucketMode === 'day') {
    let cursor = range.startUtcMs;
    const isSevenDays = range.period === '7d';
    while (cursor <= range.endUtcMs && buckets.length < 62) {
      const p = toBrazilDateParts(cursor);
      const dayStart = brazilStartOfDayUtcMs(p.year, p.month, p.day);
      const dayEnd = brazilEndOfDayUtcMs(p.year, p.month, p.day);
      const shortDate = `${String(p.day).padStart(2, '0')}/${String(p.month + 1).padStart(2, '0')}`;
      buckets.push({
        key: p.dateKey,
        label: isSevenDays ? WEEKDAYS_PT[p.dayOfWeek] : shortDate,
        fullLabel: `${WEEKDAYS_PT[p.dayOfWeek]}, ${shortDate}/${p.year}`,
        startMs: dayStart,
        endMs: dayEnd,
        revenueCents: 0,
        feesCents: 0,
        refundsCents: 0,
        salesCount: 0,
        approvedOrdersCount: 0,
      });
      cursor = dayEnd + 1;
    }
  } else if (range.bucketMode === 'week') {
    let cursor = range.startUtcMs;
    while (cursor <= range.endUtcMs && buckets.length < 24) {
      const weekEnd = Math.min(range.endUtcMs, cursor + 7 * DAY_MS - 1);
      const pStart = toBrazilDateParts(cursor);
      const pEnd = toBrazilDateParts(weekEnd);
      const sLabel = `${String(pStart.day).padStart(2, '0')}/${String(pStart.month + 1).padStart(2, '0')}`;
      const eLabel = `${String(pEnd.day).padStart(2, '0')}/${String(pEnd.month + 1).padStart(2, '0')}`;
      buckets.push({
        key: `${pStart.dateKey}_${pEnd.dateKey}`,
        label: sLabel,
        fullLabel: `${sLabel} a ${eLabel}`,
        startMs: cursor,
        endMs: weekEnd,
        revenueCents: 0,
        feesCents: 0,
        refundsCents: 0,
        salesCount: 0,
        approvedOrdersCount: 0,
      });
      cursor = weekEnd + 1;
    }
  } else {
    const startP = toBrazilDateParts(range.startUtcMs);
    const endP = toBrazilDateParts(range.endUtcMs);
    let y = startP.year;
    let m = startP.month;
    while ((y < endP.year || (y === endP.year && m <= endP.month)) && buckets.length < 36) {
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      buckets.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        label: `${MONTHS_PT[m]}/${String(y).slice(-2)}`,
        fullLabel: `${MONTHS_PT[m]} de ${y}`,
        startMs: brazilStartOfDayUtcMs(y, m, 1),
        endMs: brazilEndOfDayUtcMs(y, m, lastDay),
        revenueCents: 0,
        feesCents: 0,
        refundsCents: 0,
        salesCount: 0,
        approvedOrdersCount: 0,
      });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }

  for (const tx of currentStripeTxs) {
    const b = buckets.find((bk) => tx._ms >= bk.startMs && tx._ms <= bk.endMs);
    if (b) {
      b.revenueCents += Number(tx.grossAmountCents || 0);
      b.feesCents += Number(tx.feeAmountCents || 0);
      b.refundsCents += Number(tx.refundedAmountCents || 0);
      if (tx.paymentStatus !== 'refunded') b.approvedOrdersCount += 1;
    }
  }

  for (const ev of currentSalesEvents) {
    const b = buckets.find((bk) => ev.ms >= bk.startMs && ev.ms <= bk.endMs);
    if (b) b.salesCount += 1;
  }

  const sampleCount = 7;
  const revenueSparkline: number[] = [];
  const salesBars: number[] = [];

  if (buckets.length <= sampleCount) {
    for (const b of buckets) {
      revenueSparkline.push(Number((b.revenueCents / 100).toFixed(2)));
      salesBars.push(b.salesCount > 0 ? b.salesCount : b.approvedOrdersCount);
    }
    while (revenueSparkline.length < sampleCount) {
      revenueSparkline.unshift(0);
      salesBars.unshift(0);
    }
  } else {
    const step = buckets.length / sampleCount;
    for (let i = 0; i < sampleCount; i++) {
      const from = Math.floor(i * step);
      const to = Math.min(buckets.length, Math.floor((i + 1) * step));
      let rev = 0;
      let cnt = 0;
      for (let j = from; j < to; j++) {
        rev += buckets[j].revenueCents;
        cnt += buckets[j].salesCount > 0 ? buckets[j].salesCount : buckets[j].approvedOrdersCount;
      }
      revenueSparkline.push(Number((rev / 100).toFixed(2)));
      salesBars.push(cnt);
    }
  }

  const salesEvolutionSeries = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    fullLabel: b.fullLabel,
    revenueCents: b.revenueCents,
    revenueReais: Number((b.revenueCents / 100).toFixed(2)),
    feesCents: b.feesCents,
    refundsCents: b.refundsCents,
    salesCount: b.salesCount,
    approvedOrdersCount: b.approvedOrdersCount,
  }));

  const approvedPaymentsCount = currentStripeTxs.filter(
    (t) => t.paymentStatus !== 'refunded'
  ).length;

  return {
    success: true,
    period: {
      key: range.period,
      label: range.label,
      startDate: range.startDateStr,
      endDate: range.endDateStr,
      bucketMode: range.bucketMode,
    },
    stripe: {
      configured: snapshot.configured,
      livemode: snapshot.livemode,
      hasWebhookSecret: snapshot.hasWebhookSecret,
      currency: snapshot.currency,
      lastSyncedAt: snapshot.syncedAt,
    },
    revenue: {
      totalCents: grossRevenueCents,
      grossCents: grossRevenueCents,
      feesCents,
      refundsCents,
      netCents: netRevenueCents,
      availableBalanceCents: snapshot.availableBalanceCents,
      pendingBalanceCents: snapshot.pendingBalanceCents,
      currency: snapshot.currency,
      deltaPct: revenueComparison.deltaPct,
      trend: revenueComparison.trend,
      hasBaseline: revenueComparison.hasBaseline,
      sparkline: revenueSparkline,
    },
    sales: {
      itinerarySalesCount,
      approvedPaymentsCount,
      deltaPct: salesComparison.deltaPct,
      trend: salesComparison.trend,
      hasBaseline: salesComparison.hasBaseline,
      bars: salesBars,
    },
    evolution: {
      series: salesEvolutionSeries,
    },
    topItineraries,
    syncError: snapshot.syncError || null,
  };
}

export async function getPlatanosOverviewServerless(ctx: ServerlessFinanceContext) {
  const {
    packages,
    itineraries,
    wallets,
    transactions,
    orders,
    unlocks,
    auditLogs,
  } = await collectAllPlatanosRecordsServerless(ctx, { forceStripeSync: false });

  const totalCirculation = wallets.reduce((acc, w) => acc + (Number(w.balance) || 0), 0);
  const totalCredited = wallets.reduce((acc, w) => acc + (Number(w.total_credited) || 0), 0);
  const totalSpent = wallets.reduce((acc, w) => acc + (Number(w.total_spent) || 0), 0);

  const paidOrders = orders.filter((o) => o.status === 'paid' && Number(o.credited ?? 1) === 1);
  const revenueCents = paidOrders.reduce((acc, o) => acc + (Number(o.amount_cents) || 0), 0);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const buildPerformanceSeries = (daysWindow: 7 | 30 | 90) => {
    const bucketCount = daysWindow === 7 ? 7 : 6;
    const bucketSizeDays = daysWindow === 7 ? 1 : daysWindow / bucketCount;
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const buckets: Array<{
      label: string;
      fullLabel: string;
      creditsAdded: number;
      platanosConsumed: number;
    }> = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const endMs = now.getTime() - i * bucketSizeDays * 86400000;
      const startMs = endMs - bucketSizeDays * 86400000;
      const endDate = new Date(endMs);

      let creditsAdded = 0;
      let platanosConsumed = 0;

      for (const tx of transactions) {
        if (tx.status === 'cancelled' || tx.status === 'failed') continue;
        const t = parseTimestampMs(tx.created_at);
        if (!t || t <= startMs || t > endMs) continue;
        const amt = Number(tx.amount) || 0;
        if (amt > 0) creditsAdded += amt;
        else if (amt < 0) platanosConsumed += Math.abs(amt);
      }

      const dd = String(endDate.getDate()).padStart(2, '0');
      const mm = String(endDate.getMonth() + 1).padStart(2, '0');
      buckets.push({
        label: daysWindow === 7 ? dayNames[endDate.getDay()] : `${dd}/${mm}`,
        fullLabel: `${dd}/${mm}`,
        creditsAdded,
        platanosConsumed,
      });
    }
    return buckets;
  };

  const buildStripeRevenueSeries = (daysWindow: 7 | 30 | 90) => {
    const bucketCount = daysWindow === 7 ? 7 : 6;
    const bucketSizeDays = daysWindow === 7 ? 1 : daysWindow / bucketCount;
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const buckets: Array<{
      label: string;
      fullLabel: string;
      revenueCents: number;
      revenueReais: number;
      paymentsCount: number;
    }> = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const endMs = now.getTime() - i * bucketSizeDays * 86400000;
      const startMs = endMs - bucketSizeDays * 86400000;
      const endDate = new Date(endMs);

      let bCents = 0;
      let paymentsCount = 0;

      for (const ord of paidOrders) {
        const t = parseTimestampMs(ord.created_at);
        if (!t || t <= startMs || t > endMs) continue;
        bCents += Number(ord.amount_cents) || 0;
        paymentsCount += 1;
      }

      const dd = String(endDate.getDate()).padStart(2, '0');
      const mm = String(endDate.getMonth() + 1).padStart(2, '0');
      buckets.push({
        label: daysWindow === 7 ? dayNames[endDate.getDay()] : `${dd}/${mm}`,
        fullLabel: `${dd}/${mm}`,
        revenueCents: bCents,
        revenueReais: Number((bCents / 100).toFixed(2)),
        paymentsCount,
      });
    }
    return buckets;
  };

  const perf7d = buildPerformanceSeries(7);
  const rev7d = buildStripeRevenueSeries(7);

  const computeDeltaPct = (current: number, previous: number): number | null => {
    if (previous <= 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  };

  const nowMs = Date.now();
  const d30Ms = nowMs - 30 * 86400000;
  const d60Ms = nowMs - 60 * 86400000;

  let credCur = 0;
  let credPrev = 0;
  let spentCur = 0;
  let spentPrev = 0;
  let netCur = 0;
  let netPrev = 0;

  for (const tx of transactions) {
    if (tx.status === 'cancelled' || tx.status === 'failed') continue;
    const t = parseTimestampMs(tx.created_at);
    if (!t) continue;
    const amt = Number(tx.amount) || 0;
    if (t >= d30Ms) {
      netCur += amt;
      if (amt > 0) credCur += amt;
      else if (amt < 0) spentCur += Math.abs(amt);
    } else if (t >= d60Ms && t < d30Ms) {
      netPrev += amt;
      if (amt > 0) credPrev += amt;
      else if (amt < 0) spentPrev += Math.abs(amt);
    }
  }

  let revCur = 0;
  let revPrev = 0;
  for (const ord of paidOrders) {
    const t = parseTimestampMs(ord.created_at);
    if (!t) continue;
    const c = Number(ord.amount_cents) || 0;
    if (t >= d30Ms) revCur += c;
    else if (t >= d60Ms && t < d30Ms) revPrev += c;
  }

  return {
    success: true,
    stats: {
      totalCirculation,
      totalCredited,
      totalSpent,
      totalWallets: wallets.length,
      revenueCents,
      revenueBRL: formatBRLCents(revenueCents),
      paidOrdersCount: paidOrders.length,
      totalUnlocks: unlocks.length,
    },
    analytics: {
      performanceByRange: {
        '7d': perf7d,
        '30d': buildPerformanceSeries(30),
        '90d': buildPerformanceSeries(90),
      },
      stripeRevenueByRange: {
        '7d': rev7d,
        '30d': buildStripeRevenueSeries(30),
        '90d': buildStripeRevenueSeries(90),
      },
      sparklines: {
        circulation: perf7d.map((p) => Math.max(0, p.creditsAdded - p.platanosConsumed)),
        credited: perf7d.map((p) => p.creditsAdded),
        spent: perf7d.map((p) => p.platanosConsumed),
        revenue: rev7d.map((r) => r.revenueReais),
      },
      deltas: {
        circulationPct: computeDeltaPct(Math.max(0, netCur), Math.max(0, netPrev)),
        creditedPct: computeDeltaPct(credCur, credPrev),
        spentPct: computeDeltaPct(spentCur, spentPrev),
        revenuePct: computeDeltaPct(revCur, revPrev),
      },
    },
    packages,
    itineraries,
    wallets,
    transactions,
    orders,
    unlocks,
    auditLogs,
  };
}

async function appendAdminAuditLogServerless(
  supabase: SupabaseClient,
  entry: {
    adminUserId: number | string;
    adminEmail: string;
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, any>;
  }
) {
  const nowIso = new Date().toISOString();
  const newLog = {
    id: `aud_${crypto.randomUUID()}`,
    admin_user_id: entry.adminUserId,
    admin_email: entry.adminEmail,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    details_json: JSON.stringify(entry.details),
    created_at: nowIso,
  };

  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'platanos_admin_audit_logs_json')
      .maybeSingle();
    let existing: any[] = [];
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) existing = parsed;
      } catch {}
    }
    const next = [newLog, ...existing].slice(0, 120);
    await supabase.from('system_settings').upsert(
      {
        key: 'platanos_admin_audit_logs_json',
        value: JSON.stringify(next),
        updated_at: nowIso,
      },
      { onConflict: 'key' }
    );
  } catch {}
}

export async function updatePlatanosPackageServerless(
  ctx: ServerlessFinanceContext,
  admin: { id: any; email: string },
  pkgId: string,
  body: any
) {
  const platanos = Number(body?.platanos);
  const priceCents = Number(body?.priceCents);
  const badge = String(body?.badge ?? '').trim().slice(0, 60);
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!pkgId || !Number.isInteger(platanos) || platanos <= 0 || !Number.isInteger(priceCents) || priceCents < 100) {
    return { status: 400, payload: { error: 'Quantidade de Plátanos e preço em centavos (>= 100) devem ser inteiros válidos.' } };
  }

  const packages = await ctx.getPackages(true);
  const updatedList = packages.map((p: any) =>
    p.id === pkgId
      ? {
          ...p,
          platanos,
          priceCents,
          priceBRL: formatBRLCents(priceCents),
          badge,
          isActive,
        }
      : p
  );

  await ctx.supabase.from('system_settings').upsert(
    {
      key: 'platanos_packages_json',
      value: JSON.stringify(updatedList),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  await appendAdminAuditLogServerless(ctx.supabase, {
    adminUserId: admin.id || 1,
    adminEmail: admin.email || 'admin@monvian.com',
    action: 'UPDATE_PACKAGE',
    targetType: 'package',
    targetId: pkgId,
    details: { platanos, priceCents, priceBRL: formatBRLCents(priceCents), badge, isActive },
  });

  return { status: 200, payload: { success: true, packages: updatedList } };
}

export async function updateItineraryPriceServerless(
  ctx: ServerlessFinanceContext,
  admin: { id: any; email: string },
  itineraryId: string,
  body: any
) {
  const platanosPrice = Number(body?.platanosPrice);
  const isPremium =
    body?.isPremium !== undefined ? (body.isPremium ? 1 : 0) : platanosPrice > 0 ? 1 : 0;

  if (!itineraryId || !Number.isInteger(platanosPrice) || platanosPrice < 0) {
    return { status: 400, payload: { error: 'Preço em Plátanos inválido.' } };
  }

  const finalPrice = isPremium ? platanosPrice : 0;
  const nowIso = new Date().toISOString();

  // Persist in system_settings custom price map (works for both curated defaults and DB itineraries)
  const existingMap = await ctx.getItineraryPrices();
  existingMap[itineraryId] = finalPrice;

  await Promise.all([
    ctx.supabase.from('system_settings').upsert(
      {
        key: 'platanos_itinerary_prices_json',
        value: JSON.stringify(existingMap),
        updated_at: nowIso,
      },
      { onConflict: 'key' }
    ),
    ctx.supabase
      .from('itineraries')
      .update({
        platanos_price: finalPrice,
        is_premium: isPremium,
        price: isPremium ? `${finalPrice} Plátanos` : 'Grátis',
        updated_at: nowIso,
      })
      .eq('id', itineraryId),
  ]);

  await appendAdminAuditLogServerless(ctx.supabase, {
    adminUserId: admin.id || 1,
    adminEmail: admin.email || 'admin@monvian.com',
    action: 'UPDATE_ITINERARY_PRICE',
    targetType: 'itinerary',
    targetId: itineraryId,
    details: { platanosPrice: finalPrice, isPremium },
  });

  return { status: 200, payload: { success: true, itineraryPrices: existingMap } };
}

export async function adjustPlatanosWalletServerless(
  ctx: ServerlessFinanceContext,
  admin: { id: any; email: string },
  targetUserParam: string,
  body: any
) {
  const delta = Number(body?.delta);
  const reason = String(body?.reason || 'Ajuste administrativo').trim().slice(0, 160);

  if (!targetUserParam || !Number.isInteger(delta) || delta === 0) {
    return { status: 400, payload: { error: 'Informe uma quantidade inteira diferente de zero para o ajuste.' } };
  }

  const { wallets, settingsRows } = await collectAllPlatanosRecordsServerless(ctx, { forceStripeSync: false });
  const targetNum = Number(targetUserParam);
  const matchedWallet = wallets.find(
    (w) =>
      (Number.isFinite(targetNum) && Number(w.user_id) === targetNum) ||
      String(w.user_email || '').toLowerCase() === targetUserParam.toLowerCase()
  );

  let targetEmail = matchedWallet?.user_email || '';
  if (!targetEmail && Number.isFinite(targetNum) && targetNum > 0) {
    const { data: userRow } = await ctx.supabase
      .from('users')
      .select('email, whatsapp')
      .eq('id', targetNum)
      .maybeSingle();
    targetEmail = String(userRow?.email || userRow?.whatsapp || '').trim().toLowerCase();
  }

  if (!targetEmail) {
    return { status: 404, payload: { error: 'Carteira do usuário não encontrada.' } };
  }

  const walletKey = `platanos_wallet_${targetEmail}`;
  const existingSetting = settingsRows.find((r) => r.key === walletKey);
  let storedWallet: any = null;
  if (existingSetting?.value) {
    try {
      storedWallet = JSON.parse(existingSetting.value);
    } catch {}
  }

  const balanceBefore = Number(storedWallet?.balance ?? matchedWallet?.balance ?? 0);
  const balanceAfter = balanceBefore + delta;
  if (balanceAfter < 0) {
    return {
      status: 400,
      payload: {
        error: `O ajuste deixaria o saldo negativo (${balanceAfter}). Saldo atual: ${balanceBefore}`,
      },
    };
  }

  const nowIso = new Date().toISOString();
  const txId = `ptx_${crypto.randomUUID()}`;
  const uid = Number(storedWallet?.userId ?? matchedWallet?.user_id ?? targetNum) || 1;

  const newTx = {
    id: txId,
    userId: uid,
    userEmail: targetEmail,
    type: 'admin_adjustment',
    amount: delta,
    balanceBefore,
    balanceAfter,
    status: 'completed',
    description: reason,
    referenceType: 'admin',
    referenceId: String(admin.id || 1),
    createdAt: nowIso,
  };

  const nextWallet = {
    userId: uid,
    userEmail: targetEmail,
    balance: balanceAfter,
    totalCredited: Number(storedWallet?.totalCredited ?? matchedWallet?.total_credited ?? 0) + (delta > 0 ? delta : 0),
    totalSpent: Number(storedWallet?.totalSpent ?? matchedWallet?.total_spent ?? 0) + (delta < 0 ? Math.abs(delta) : 0),
    unlockedItineraryIds: Array.isArray(storedWallet?.unlockedItineraryIds) ? storedWallet.unlockedItineraryIds : [],
    transactions: [newTx, ...(Array.isArray(storedWallet?.transactions) ? storedWallet.transactions : [])].slice(0, 100),
    orders: Array.isArray(storedWallet?.orders) ? storedWallet.orders : [],
    updatedAt: nowIso,
  };

  await ctx.supabase.from('system_settings').upsert(
    {
      key: walletKey,
      value: JSON.stringify(nextWallet),
      updated_at: nowIso,
    },
    { onConflict: 'key' }
  );

  await appendAdminAuditLogServerless(ctx.supabase, {
    adminUserId: admin.id || 1,
    adminEmail: admin.email || 'admin@monvian.com',
    action: 'MANUAL_WALLET_ADJUSTMENT',
    targetType: 'wallet',
    targetId: String(uid),
    details: { userEmail: targetEmail, delta, balanceBefore, balanceAfter, reason },
  });

  return { status: 200, payload: { success: true, balanceBefore, balanceAfter, txId } };
}

export async function refundPlatanosOrderServerless(
  ctx: ServerlessFinanceContext,
  admin: { id: any; email: string },
  sessionId: string
) {
  const cleanSessionId = decodeURIComponent(String(sessionId || '')).trim();
  if (!cleanSessionId) {
    return { status: 400, payload: { error: 'Sessão Stripe inválida.' } };
  }

  const { orders, settingsRows } = await collectAllPlatanosRecordsServerless(ctx, { forceStripeSync: false });
  const targetOrder = orders.find(
    (o) => o.stripe_session_id === cleanSessionId || o.id === cleanSessionId
  );

  if (!targetOrder) {
    return { status: 404, payload: { error: 'Pedido Stripe não encontrado.' } };
  }
  if (targetOrder.status === 'refunded') {
    return { status: 400, payload: { error: 'Este pedido já foi reembolsado.' } };
  }

  // Trigger real Stripe refund if payment_intent exists and Stripe key is configured
  const stripe = await ctx.getStripeClient();
  if (stripe && targetOrder.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create({
        payment_intent: targetOrder.stripe_payment_intent_id,
      });
    } catch (err: any) {
      // Allow local reversal if charge was already refunded on Stripe dashboard
      if (!String(err?.message || '').toLowerCase().includes('already been refunded')) {
        return { status: 400, payload: { error: err?.message || 'Falha ao estornar na Stripe.' } };
      }
    }
  }

  const targetEmail = String(targetOrder.user_email || '').trim().toLowerCase();
  const walletKey = `platanos_wallet_${targetEmail}`;
  const walletRow = settingsRows.find((r) => r.key === walletKey);
  let storedWallet: any = null;
  if (walletRow?.value) {
    try {
      storedWallet = JSON.parse(walletRow.value);
    } catch {}
  }

  const platanosAmt = Number(targetOrder.platanos_amount || 0);
  const balanceBefore = Number(storedWallet?.balance ?? 0);
  const debitAmt = Math.min(balanceBefore, platanosAmt);
  const balanceAfter = Math.max(0, balanceBefore - debitAmt);
  const nowIso = new Date().toISOString();
  const txId = `ptx_${crypto.randomUUID()}`;

  const refundTx = {
    id: txId,
    userId: Number(targetOrder.user_id || 1),
    userEmail: targetEmail,
    type: 'refund_debit',
    amount: -debitAmt,
    balanceBefore,
    balanceAfter,
    status: 'refunded',
    description: `Estorno do pedido ${cleanSessionId}`,
    referenceType: 'stripe_refund',
    referenceId: cleanSessionId,
    createdAt: nowIso,
  };

  const updatedOrder = {
    id: targetOrder.id,
    userId: targetOrder.user_id,
    userEmail: targetEmail,
    packageId: targetOrder.package_id,
    platanosAmount: platanosAmt,
    amountCents: Number(targetOrder.amount_cents || 0),
    currency: targetOrder.currency || 'brl',
    stripeSessionId: targetOrder.stripe_session_id,
    stripePaymentIntentId: targetOrder.stripe_payment_intent_id,
    status: 'refunded',
    credited: 0,
    createdAt: targetOrder.created_at,
    updatedAt: nowIso,
  };

  if (targetEmail) {
    const nextWallet = {
      userId: Number(storedWallet?.userId ?? targetOrder.user_id ?? 1),
      userEmail: targetEmail,
      balance: balanceAfter,
      totalCredited: Number(storedWallet?.totalCredited ?? 0),
      totalSpent: Number(storedWallet?.totalSpent ?? 0),
      unlockedItineraryIds: Array.isArray(storedWallet?.unlockedItineraryIds) ? storedWallet.unlockedItineraryIds : [],
      transactions: [refundTx, ...(Array.isArray(storedWallet?.transactions) ? storedWallet.transactions : [])].slice(0, 100),
      orders: [
        updatedOrder,
        ...(Array.isArray(storedWallet?.orders) ? storedWallet.orders : []).filter(
          (o: any) => o.stripeSessionId !== targetOrder.stripe_session_id
        ),
      ].slice(0, 50),
      updatedAt: nowIso,
    };

    await ctx.supabase.from('system_settings').upsert(
      { key: walletKey, value: JSON.stringify(nextWallet), updated_at: nowIso },
      { onConflict: 'key' }
    );
  }

  await Promise.all([
    ctx.supabase.from('system_settings').upsert(
      {
        key: `platanos_order_${targetOrder.stripe_session_id}`,
        value: JSON.stringify(updatedOrder),
        updated_at: nowIso,
      },
      { onConflict: 'key' }
    ),
    invalidateStripeSnapshotCacheServerless(ctx.supabase),
  ]);

  await appendAdminAuditLogServerless(ctx.supabase, {
    adminUserId: admin.id || 1,
    adminEmail: admin.email || 'admin@monvian.com',
    action: 'REFUND_ORDER',
    targetType: 'order',
    targetId: cleanSessionId,
    details: {
      userEmail: targetEmail,
      platanosReversed: debitAmt,
      amountCents: targetOrder.amount_cents,
      balanceBefore,
      balanceAfter,
    },
  });

  return { status: 200, payload: { success: true, balanceBefore, balanceAfter } };
}
