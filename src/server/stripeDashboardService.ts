import Stripe from 'stripe';
import type Database from 'better-sqlite3';
import type express from 'express';
import { supabase } from '../services/supabaseClient.ts';

export type DashboardPeriodKey =
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | 'last_month'
  | 'all'
  | 'custom';

export interface DashboardRealtimePayload {
  type: 'financial_update' | 'connected' | 'heartbeat';
  reason?: string;
  eventType?: string;
  timestamp: string;
}

interface SseSubscriber {
  id: string;
  res: express.Response;
}

const sseSubscribers = new Map<string, SseSubscriber>();

export function addDashboardSseSubscriber(id: string, res: express.Response): void {
  sseSubscribers.set(id, { id, res });
}

export function removeDashboardSseSubscriber(id: string): void {
  sseSubscribers.delete(id);
}

export function broadcastDashboardUpdate(reason: string, eventType?: string): void {
  if (sseSubscribers.size === 0) return;
  const payload: DashboardRealtimePayload = {
    type: 'financial_update',
    reason,
    eventType,
    timestamp: new Date().toISOString(),
  };
  const frame = `event: financial_update\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [id, sub] of sseSubscribers.entries()) {
    try {
      sub.res.write(frame);
    } catch {
      sseSubscribers.delete(id);
    }
  }
}

export function setupStripeDashboardDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_financial_transactions (
      id TEXT PRIMARY KEY,
      stripe_charge_id TEXT UNIQUE,
      stripe_payment_intent_id TEXT UNIQUE,
      stripe_session_id TEXT,
      stripe_balance_tx_id TEXT,
      stripe_customer_id TEXT,
      customer_email TEXT,
      product_name TEXT,
      product_type TEXT NOT NULL DEFAULT 'platanos_topup',
      package_id TEXT,
      platanos_amount INTEGER NOT NULL DEFAULT 0,
      itinerary_id TEXT,
      itinerary_title TEXT,
      gross_amount_cents INTEGER NOT NULL DEFAULT 0,
      fee_amount_cents INTEGER NOT NULL DEFAULT 0,
      net_amount_cents INTEGER NOT NULL DEFAULT 0,
      refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'brl',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      refund_status TEXT NOT NULL DEFAULT 'none',
      dispute_status TEXT NOT NULL DEFAULT 'none',
      source TEXT NOT NULL DEFAULT 'stripe_sync',
      livemode INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT,
      purchased_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS stripe_balance_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      available_cents INTEGER NOT NULL DEFAULT 0,
      pending_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'brl',
      livemode INTEGER NOT NULL DEFAULT 0,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sft_purchased_at ON stripe_financial_transactions (purchased_at);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sft_status ON stripe_financial_transactions (payment_status);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sft_session ON stripe_financial_transactions (stripe_session_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sft_itinerary ON stripe_financial_transactions (itinerary_id);`);
  } catch {}
}

export async function resolveStripeSecretKeyAsync(db: Database.Database): Promise<string> {
  const envKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (envKey) return envKey;

  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'stripe_secret_key'")
      .get() as { value?: string } | undefined;
    if (row?.value && row.value.trim()) {
      return row.value.trim();
    }
  } catch {}

  if (supabase) {
    try {
      const { data } = await Promise.race([
        supabase.from('system_settings').select('value').eq('key', 'stripe_secret_key').maybeSingle(),
        new Promise<any>((resolve) => setTimeout(() => resolve({ data: null }), 2500)),
      ]);
      const remoteKey = typeof data?.value === 'string' ? data.value.trim() : '';
      if (remoteKey) {
        try {
          db.prepare(
            `INSERT INTO system_settings (key, value, updated_at) VALUES ('stripe_secret_key', ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
          ).run(remoteKey);
        } catch {}
        return remoteKey;
      }
    } catch {}
  }

  return '';
}

export async function resolveStripeWebhookSecretAsync(db: Database.Database): Promise<string> {
  const envSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (envSecret) return envSecret;

  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'stripe_webhook_secret'")
      .get() as { value?: string } | undefined;
    if (row?.value && row.value.trim()) {
      return row.value.trim();
    }
  } catch {}

  if (supabase) {
    try {
      const { data } = await Promise.race([
        supabase.from('system_settings').select('value').eq('key', 'stripe_webhook_secret').maybeSingle(),
        new Promise<any>((resolve) => setTimeout(() => resolve({ data: null }), 2500)),
      ]);
      const remoteSecret = typeof data?.value === 'string' ? data.value.trim() : '';
      if (remoteSecret) {
        try {
          db.prepare(
            `INSERT INTO system_settings (key, value, updated_at) VALUES ('stripe_webhook_secret', ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
          ).run(remoteSecret);
        } catch {}
        return remoteSecret;
      }
    } catch {}
  }

  return '';
}

export async function getDashboardStripeClientAsync(db: Database.Database): Promise<{
  stripe: Stripe | null;
  configured: boolean;
  livemode: boolean;
}> {
  const key = await resolveStripeSecretKeyAsync(db);
  if (!key) {
    return { stripe: null, configured: false, livemode: false };
  }
  return {
    stripe: new Stripe(key),
    configured: true,
    livemode: key.startsWith('sk_live_') || key.startsWith('rk_live_'),
  };
}

export interface CanonicalTransactionInput {
  stripeChargeId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSessionId?: string | null;
  stripeBalanceTxId?: string | null;
  stripeCustomerId?: string | null;
  customerEmail?: string | null;
  productName?: string | null;
  productType?: string | null;
  packageId?: string | null;
  platanosAmount?: number | null;
  itineraryId?: string | null;
  itineraryTitle?: string | null;
  grossAmountCents?: number | null;
  feeAmountCents?: number | null;
  netAmountCents?: number | null;
  refundedAmountCents?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  refundStatus?: string | null;
  disputeStatus?: string | null;
  source?: string;
  livemode?: boolean;
  metadata?: Record<string, any> | null;
  purchasedAt?: string | null;
}

/**
 * Guarantees ONE canonical row per real Stripe transaction.
 * Merges checkout.session.completed, payment_intent.succeeded, charge.succeeded,
 * charge.refunded, verify-session, and historical sync without EVER double-counting.
 */
export function upsertCanonicalStripeTransaction(
  db: Database.Database,
  input: CanonicalTransactionInput
): { id: string; inserted: boolean } {
  const piId = input.stripePaymentIntentId ? String(input.stripePaymentIntentId).trim() : null;
  const chId = input.stripeChargeId ? String(input.stripeChargeId).trim() : null;
  const csId = input.stripeSessionId ? String(input.stripeSessionId).trim() : null;

  let existing: any = null;
  if (piId) {
    existing = db
      .prepare('SELECT * FROM stripe_financial_transactions WHERE stripe_payment_intent_id = ? OR id = ? LIMIT 1')
      .get(piId, piId);
  }
  if (!existing && chId) {
    existing = db
      .prepare('SELECT * FROM stripe_financial_transactions WHERE stripe_charge_id = ? OR id = ? LIMIT 1')
      .get(chId, chId);
  }
  if (!existing && csId) {
    existing = db
      .prepare('SELECT * FROM stripe_financial_transactions WHERE stripe_session_id = ? OR id = ? LIMIT 1')
      .get(csId, csId);
  }

  const canonicalId = existing?.id || piId || chId || csId;
  if (!canonicalId) {
    throw new Error('Transação Stripe sem identificador canônico.');
  }

  const grossAmountCents =
    input.grossAmountCents !== undefined && input.grossAmountCents !== null
      ? Math.max(0, Math.round(Number(input.grossAmountCents)))
      : Number(existing?.gross_amount_cents || 0);

  const feeAmountCents =
    input.feeAmountCents !== undefined && input.feeAmountCents !== null && input.feeAmountCents > 0
      ? Math.max(0, Math.round(Number(input.feeAmountCents)))
      : Number(existing?.fee_amount_cents || 0);

  const refundedAmountCents =
    input.refundedAmountCents !== undefined && input.refundedAmountCents !== null
      ? Math.max(Number(existing?.refunded_amount_cents || 0), Math.round(Number(input.refundedAmountCents)))
      : Number(existing?.refunded_amount_cents || 0);

  const netAmountCents =
    input.netAmountCents !== undefined && input.netAmountCents !== null && input.netAmountCents > 0
      ? Math.round(Number(input.netAmountCents))
      : existing?.net_amount_cents && Number(existing.net_amount_cents) > 0
        ? Number(existing.net_amount_cents)
        : Math.max(0, grossAmountCents - feeAmountCents);

  // Determine strongest payment status (never downgrade succeeded/refunded back to pending)
  const incomingStatus = String(input.paymentStatus || '').toLowerCase();
  const prevStatus = String(existing?.payment_status || '').toLowerCase();
  let finalStatus = incomingStatus || prevStatus || 'pending';

  if (refundedAmountCents > 0 && grossAmountCents > 0) {
    finalStatus = refundedAmountCents >= grossAmountCents ? 'refunded' : 'partially_refunded';
  } else if (
    (prevStatus === 'succeeded' || prevStatus === 'refunded' || prevStatus === 'partially_refunded') &&
    (incomingStatus === 'pending' || !incomingStatus)
  ) {
    finalStatus = prevStatus;
  }

  const refundStatus =
    refundedAmountCents <= 0
      ? input.refundStatus || existing?.refund_status || 'none'
      : refundedAmountCents >= grossAmountCents && grossAmountCents > 0
        ? 'full'
        : 'partial';

  const disputeStatus = input.disputeStatus || existing?.dispute_status || 'none';
  if (disputeStatus === 'open') {
    finalStatus = 'disputed';
  }

  const mergedMeta = {
    ...(existing?.metadata_json ? safeJsonParse(existing.metadata_json) : {}),
    ...(input.metadata || {}),
  };

  const finalChargeId = chId || existing?.stripe_charge_id || null;
  const finalPiId = piId || existing?.stripe_payment_intent_id || null;
  const finalSessionId = csId || existing?.stripe_session_id || null;
  const finalBalanceTxId = input.stripeBalanceTxId || existing?.stripe_balance_tx_id || null;
  const finalCustomerId = input.stripeCustomerId || existing?.stripe_customer_id || null;
  const finalEmail =
    (input.customerEmail || existing?.customer_email || '').trim().toLowerCase() || null;
  const finalProductName = input.productName || existing?.product_name || null;
  const finalProductType = input.productType || existing?.product_type || 'platanos_topup';
  const finalPackageId = input.packageId || existing?.package_id || null;
  const finalPlatanosAmount =
    input.platanosAmount !== undefined && input.platanosAmount !== null && input.platanosAmount > 0
      ? Math.round(Number(input.platanosAmount))
      : Number(existing?.platanos_amount || 0);
  const finalItineraryId = input.itineraryId || existing?.itinerary_id || null;
  const finalItineraryTitle = input.itineraryTitle || existing?.itinerary_title || null;
  const finalCurrency = (input.currency || existing?.currency || 'brl').toLowerCase();
  const finalSource = input.source || existing?.source || 'stripe_sync';
  const finalLivemode = input.livemode !== undefined ? (input.livemode ? 1 : 0) : Number(existing?.livemode || 0);
  const finalPurchasedAt = input.purchasedAt || existing?.purchased_at || new Date().toISOString();

  if (existing) {
    db.prepare(`
      UPDATE stripe_financial_transactions
      SET
        stripe_charge_id = ?,
        stripe_payment_intent_id = ?,
        stripe_session_id = ?,
        stripe_balance_tx_id = ?,
        stripe_customer_id = ?,
        customer_email = ?,
        product_name = ?,
        product_type = ?,
        package_id = ?,
        platanos_amount = ?,
        itinerary_id = ?,
        itinerary_title = ?,
        gross_amount_cents = ?,
        fee_amount_cents = ?,
        net_amount_cents = ?,
        refunded_amount_cents = ?,
        currency = ?,
        payment_status = ?,
        refund_status = ?,
        dispute_status = ?,
        source = ?,
        livemode = ?,
        metadata_json = ?,
        purchased_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      finalChargeId,
      finalPiId,
      finalSessionId,
      finalBalanceTxId,
      finalCustomerId,
      finalEmail,
      finalProductName,
      finalProductType,
      finalPackageId,
      finalPlatanosAmount,
      finalItineraryId,
      finalItineraryTitle,
      grossAmountCents,
      feeAmountCents,
      netAmountCents,
      refundedAmountCents,
      finalCurrency,
      finalStatus,
      refundStatus,
      disputeStatus,
      finalSource,
      finalLivemode,
      JSON.stringify(mergedMeta),
      finalPurchasedAt,
      existing.id
    );
    return { id: existing.id, inserted: false };
  }

  db.prepare(`
    INSERT INTO stripe_financial_transactions (
      id, stripe_charge_id, stripe_payment_intent_id, stripe_session_id,
      stripe_balance_tx_id, stripe_customer_id, customer_email,
      product_name, product_type, package_id, platanos_amount,
      itinerary_id, itinerary_title,
      gross_amount_cents, fee_amount_cents, net_amount_cents, refunded_amount_cents,
      currency, payment_status, refund_status, dispute_status,
      source, livemode, metadata_json, purchased_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    canonicalId,
    finalChargeId,
    finalPiId,
    finalSessionId,
    finalBalanceTxId,
    finalCustomerId,
    finalEmail,
    finalProductName,
    finalProductType,
    finalPackageId,
    finalPlatanosAmount,
    finalItineraryId,
    finalItineraryTitle,
    grossAmountCents,
    feeAmountCents,
    netAmountCents,
    refundedAmountCents,
    finalCurrency,
    finalStatus,
    refundStatus,
    disputeStatus,
    finalSource,
    finalLivemode,
    JSON.stringify(mergedMeta),
    finalPurchasedAt
  );
  return { id: canonicalId, inserted: true };
}

function safeJsonParse(raw: string): Record<string, any> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function extractBalanceSummary(balance: Stripe.Balance): {
  availableCents: number;
  pendingCents: number;
  currency: string;
} {
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
    return { availableCents: brlAvail, pendingCents: brlPending, currency: 'brl' };
  }

  const fallbackCurrency =
    balance.available[0]?.currency || balance.pending[0]?.currency || 'brl';
  const fallbackAvail = balance.available
    .filter((b) => b.currency === fallbackCurrency)
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);
  const fallbackPending = balance.pending
    .filter((b) => b.currency === fallbackCurrency)
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);

  return {
    availableCents: fallbackAvail,
    pendingCents: fallbackPending,
    currency: fallbackCurrency.toLowerCase(),
  };
}

export async function refreshStripeBalanceCache(
  db: Database.Database,
  stripeClient?: Stripe | null
): Promise<{
  availableCents: number;
  pendingCents: number;
  currency: string;
  livemode: boolean;
  error?: string;
}> {
  let stripe = stripeClient || null;
  let livemode = false;

  if (!stripe) {
    const resolved = await getDashboardStripeClientAsync(db);
    stripe = resolved.stripe;
    livemode = resolved.livemode;
  }

  if (!stripe) {
    return {
      availableCents: 0,
      pendingCents: 0,
      currency: 'brl',
      livemode: false,
      error: 'Chave da Stripe não configurada.',
    };
  }

  try {
    const balance = await stripe.balance.retrieve();
    const summary = extractBalanceSummary(balance);
    const liveFlag = Boolean(balance.livemode || livemode);

    db.prepare(`
      INSERT INTO stripe_balance_cache (id, available_cents, pending_cents, currency, livemode, synced_at)
      VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        available_cents = excluded.available_cents,
        pending_cents = excluded.pending_cents,
        currency = excluded.currency,
        livemode = excluded.livemode,
        synced_at = CURRENT_TIMESTAMP
    `).run(summary.availableCents, summary.pendingCents, summary.currency, liveFlag ? 1 : 0);

    return {
      ...summary,
      livemode: liveFlag,
    };
  } catch (err: any) {
    const cached = db
      .prepare('SELECT * FROM stripe_balance_cache WHERE id = 1')
      .get() as any;
    return {
      availableCents: Number(cached?.available_cents || 0),
      pendingCents: Number(cached?.pending_cents || 0),
      currency: cached?.currency || 'brl',
      livemode: Boolean(cached?.livemode || livemode),
      error: err?.message || 'Erro ao consultar saldo na Stripe.',
    };
  }
}

let inFlightSyncPromise: Promise<SyncStripeResult> | null = null;

export interface SyncStripeResult {
  configured: boolean;
  livemode: boolean;
  syncedCharges: number;
  syncedSessions: number;
  availableCents: number;
  pendingCents: number;
  currency: string;
  syncedAt: string;
  error?: string;
}

/**
 * Full paginated historical sync from Stripe API (Charges + Balance Transactions + Checkout Sessions + Live Balance).
 * Coalesces concurrent requests so parallel dashboard opens don't hammer Stripe API.
 */
export async function syncStripeHistoryAndBalance(
  db: Database.Database,
  options?: { force?: boolean; silent?: boolean }
): Promise<SyncStripeResult> {
  if (inFlightSyncPromise && !options?.force) {
    return inFlightSyncPromise;
  }

  const run = async (): Promise<SyncStripeResult> => {
    const { stripe, configured, livemode } = await getDashboardStripeClientAsync(db);
    if (!configured || !stripe) {
      return {
        configured: false,
        livemode: false,
        syncedCharges: 0,
        syncedSessions: 0,
        availableCents: 0,
        pendingCents: 0,
        currency: 'brl',
        syncedAt: new Date().toISOString(),
        error: 'STRIPE_SECRET_KEY não configurada.',
      };
    }

    const balanceResult = await refreshStripeBalanceCache(db, stripe);

    // Build checkout session metadata map (paginated) so charges get itinerary/package metadata
    const sessionMetaByPi = new Map<string, Stripe.Checkout.Session>();
    let syncedSessions = 0;
    try {
      let startingAfter: string | undefined;
      for (let page = 0; page < 10; page++) {
        const list = await stripe.checkout.sessions.list({
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const session of list.data) {
          syncedSessions++;
          const piId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id || '';
          if (piId) {
            sessionMetaByPi.set(piId, session);
          }
          // If paid session has no charge yet or is a paid zero-charge session, still upsert safely
          if (session.payment_status === 'paid' && !piId) {
            upsertCanonicalStripeTransaction(db, {
              stripeSessionId: session.id,
              stripeCustomerId:
                typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
              customerEmail:
                session.metadata?.userEmail ||
                session.customer_email ||
                session.customer_details?.email ||
                null,
              productName:
                session.metadata?.itineraryTitle ||
                (session.metadata?.platanosAmount
                  ? `Pacote ${session.metadata.platanosAmount} Plátanos`
                  : 'Compra Monvian'),
              productType: session.metadata?.itineraryId ? 'itinerary_direct' : session.metadata?.type || 'platanos_topup',
              packageId: session.metadata?.packageId || null,
              platanosAmount: session.metadata?.platanosAmount ? parseInt(session.metadata.platanosAmount, 10) : 0,
              itineraryId: session.metadata?.itineraryId || null,
              itineraryTitle: session.metadata?.itineraryTitle || null,
              grossAmountCents: session.amount_total ?? 0,
              currency: session.currency || 'brl',
              paymentStatus: 'succeeded',
              source: 'stripe_sync',
              livemode: session.livemode,
              metadata: session.metadata || undefined,
              purchasedAt: new Date(session.created * 1000).toISOString(),
            });
          }
        }
        if (!list.has_more || list.data.length === 0) break;
        startingAfter = list.data[list.data.length - 1].id;
      }
    } catch (err: any) {
      console.warn('[Stripe Sync] Erro ao paginar checkout sessions:', err?.message);
    }

    // Paginate ALL charges with balance_transaction expanded for exact gross, fee, net & refunds
    let syncedCharges = 0;
    let changedCount = 0;
    let syncError: string | undefined;

    try {
      let startingAfter: string | undefined;
      for (let page = 0; page < 20; page++) {
        const list = await stripe.charges.list({
          limit: 100,
          expand: ['data.balance_transaction'],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        for (const charge of list.data) {
          syncedCharges++;
          const piId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id || null;
          const session = piId ? sessionMetaByPi.get(piId) : undefined;
          const balanceTx =
            charge.balance_transaction && typeof charge.balance_transaction === 'object'
              ? (charge.balance_transaction as Stripe.BalanceTransaction)
              : null;

          // Enrich from local platanos_stripe_orders if available
          let localOrder: any = null;
          try {
            if (piId) {
              localOrder = db
                .prepare('SELECT * FROM platanos_stripe_orders WHERE stripe_payment_intent_id = ? LIMIT 1')
                .get(piId);
            }
            if (!localOrder && session?.id) {
              localOrder = db
                .prepare('SELECT * FROM platanos_stripe_orders WHERE stripe_session_id = ? LIMIT 1')
                .get(session.id);
            }
          } catch {}

          const mergedMeta = {
            ...(charge.metadata || {}),
            ...(session?.metadata || {}),
          };

          let paymentStatus: string = 'pending';
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
          } else {
            paymentStatus = 'pending';
          }

          const platanosAmount =
            Number(mergedMeta.platanosAmount || localOrder?.platanos_amount || 0) || 0;
          const itineraryId = mergedMeta.itineraryId || null;
          const itineraryTitle = mergedMeta.itineraryTitle || null;
          const productName =
            itineraryTitle ||
            charge.description ||
            (platanosAmount > 0 ? `Recarga ${platanosAmount} Plátanos` : 'Venda Stripe');

          const res = upsertCanonicalStripeTransaction(db, {
            stripeChargeId: charge.id,
            stripePaymentIntentId: piId,
            stripeSessionId: session?.id || localOrder?.stripe_session_id || null,
            stripeBalanceTxId: balanceTx?.id || (typeof charge.balance_transaction === 'string' ? charge.balance_transaction : null),
            stripeCustomerId:
              typeof charge.customer === 'string' ? charge.customer : charge.customer?.id || null,
            customerEmail:
              mergedMeta.userEmail ||
              charge.billing_details?.email ||
              charge.receipt_email ||
              session?.customer_details?.email ||
              localOrder?.user_email ||
              null,
            productName,
            productType: itineraryId
              ? 'itinerary_direct'
              : mergedMeta.type || (platanosAmount > 0 ? 'platanos_topup' : 'other'),
            packageId: mergedMeta.packageId || localOrder?.package_id || null,
            platanosAmount,
            itineraryId,
            itineraryTitle,
            grossAmountCents: charge.amount,
            feeAmountCents: balanceTx?.fee ?? 0,
            netAmountCents: balanceTx?.net ?? Math.max(0, charge.amount - (balanceTx?.fee ?? 0)),
            refundedAmountCents: charge.amount_refunded || 0,
            currency: charge.currency || 'brl',
            paymentStatus,
            refundStatus:
              charge.amount_refunded <= 0
                ? 'none'
                : charge.amount_refunded >= charge.amount
                  ? 'full'
                  : 'partial',
            disputeStatus: charge.disputed ? 'open' : 'none',
            source: 'stripe_sync',
            livemode: charge.livemode,
            metadata: mergedMeta,
            purchasedAt: new Date(charge.created * 1000).toISOString(),
          });

          if (res.inserted) changedCount++;
        }

        if (!list.has_more || list.data.length === 0) break;
        startingAfter = list.data[list.data.length - 1].id;
      }
    } catch (err: any) {
      syncError = err?.message || 'Erro ao sincronizar histórico da Stripe.';
      console.error('[Stripe Sync] Erro ao paginar charges:', err?.message);
    }

    const syncedAt = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ('stripe_last_sync_at', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
      ).run(syncedAt);
    } catch {}

    if (changedCount > 0 && !options?.silent) {
      broadcastDashboardUpdate('stripe_sync', 'sync_complete');
    }

    return {
      configured: true,
      livemode: balanceResult.livemode || livemode,
      syncedCharges,
      syncedSessions,
      availableCents: balanceResult.availableCents,
      pendingCents: balanceResult.pendingCents,
      currency: balanceResult.currency,
      syncedAt,
      error: syncError || balanceResult.error,
    };
  };

  inFlightSyncPromise = run().finally(() => {
    inFlightSyncPromise = null;
  });

  return inFlightSyncPromise;
}

/**
 * Idempotent real-time Stripe webhook processor for financial metrics.
 * Always validates/deduplicates by Stripe Event ID + Canonical Transaction ID.
 */
export async function processStripeDashboardWebhookEvent(
  db: Database.Database,
  event: Stripe.Event,
  stripeClient?: Stripe | null
): Promise<{ processed: boolean; duplicate?: boolean; eventType: string }> {
  if (!event || !event.id || !event.type) {
    return { processed: false, eventType: 'unknown' };
  }

  // Idempotency guard: skip if this exact Stripe event.id was already processed
  const alreadyProcessed = db
    .prepare('SELECT event_id FROM stripe_webhook_events WHERE event_id = ?')
    .get(event.id);
  if (alreadyProcessed) {
    return { processed: false, duplicate: true, eventType: event.type };
  }

  const stripe = stripeClient || (await getDashboardStripeClientAsync(db)).stripe;
  let shouldRefreshBalance = false;
  let summary = '';

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const piId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null;

        let feeCents = 0;
        let netCents = 0;
        let chargeId: string | null = null;
        let balanceTxId: string | null = null;

        if (stripe && piId && session.payment_status === 'paid') {
          try {
            const pi = await stripe.paymentIntents.retrieve(piId, {
              expand: ['latest_charge.balance_transaction'],
            });
            const latestCharge =
              pi.latest_charge && typeof pi.latest_charge === 'object'
                ? (pi.latest_charge as Stripe.Charge)
                : null;
            if (latestCharge) {
              chargeId = latestCharge.id;
              const bt =
                latestCharge.balance_transaction && typeof latestCharge.balance_transaction === 'object'
                  ? (latestCharge.balance_transaction as Stripe.BalanceTransaction)
                  : null;
              if (bt) {
                balanceTxId = bt.id;
                feeCents = bt.fee || 0;
                netCents = bt.net || 0;
              }
            }
          } catch {}
        }

        const platanosAmount = Number(session.metadata?.platanosAmount || 0) || 0;
        const itineraryId = session.metadata?.itineraryId || null;
        const itineraryTitle = session.metadata?.itineraryTitle || null;

        upsertCanonicalStripeTransaction(db, {
          stripeChargeId: chargeId,
          stripePaymentIntentId: piId,
          stripeSessionId: session.id,
          stripeBalanceTxId: balanceTxId,
          stripeCustomerId:
            typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          customerEmail:
            session.metadata?.userEmail ||
            session.customer_email ||
            session.customer_details?.email ||
            null,
          productName:
            itineraryTitle ||
            (platanosAmount > 0 ? `Recarga ${platanosAmount} Plátanos` : 'Checkout Stripe'),
          productType: itineraryId
            ? 'itinerary_direct'
            : session.metadata?.type || 'platanos_topup',
          packageId: session.metadata?.packageId || null,
          platanosAmount,
          itineraryId,
          itineraryTitle,
          grossAmountCents: session.amount_total ?? 0,
          feeAmountCents: feeCents,
          netAmountCents: netCents,
          currency: session.currency || 'brl',
          paymentStatus: session.payment_status === 'paid' ? 'succeeded' : 'pending',
          source: 'stripe_webhook',
          livemode: session.livemode,
          metadata: session.metadata || undefined,
          purchasedAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });

        shouldRefreshBalance = session.payment_status === 'paid';
        summary = `session=${session.id} status=${session.payment_status}`;
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const piId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null;
        upsertCanonicalStripeTransaction(db, {
          stripePaymentIntentId: piId,
          stripeSessionId: session.id,
          grossAmountCents: session.amount_total ?? 0,
          currency: session.currency || 'brl',
          paymentStatus: event.type === 'checkout.session.expired' ? 'cancelled' : 'failed',
          source: 'stripe_webhook',
          livemode: session.livemode,
          purchasedAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });
        summary = `session=${session.id} ${event.type}`;
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        let chargeId =
          typeof pi.latest_charge === 'string'
            ? pi.latest_charge
            : pi.latest_charge?.id || null;
        let feeCents = 0;
        let netCents = 0;
        let balanceTxId: string | null = null;
        let receiptEmail: string | null = pi.receipt_email || null;

        if (stripe && chargeId) {
          try {
            const charge = await stripe.charges.retrieve(chargeId, {
              expand: ['balance_transaction'],
            });
            receiptEmail = receiptEmail || charge.billing_details?.email || charge.receipt_email || null;
            const bt =
              charge.balance_transaction && typeof charge.balance_transaction === 'object'
                ? (charge.balance_transaction as Stripe.BalanceTransaction)
                : null;
            if (bt) {
              balanceTxId = bt.id;
              feeCents = bt.fee || 0;
              netCents = bt.net || 0;
            }
          } catch {}
        }

        upsertCanonicalStripeTransaction(db, {
          stripeChargeId: chargeId,
          stripePaymentIntentId: pi.id,
          stripeBalanceTxId: balanceTxId,
          stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null,
          customerEmail: pi.metadata?.userEmail || receiptEmail,
          productName: pi.metadata?.itineraryTitle || pi.description || 'Pagamento Stripe',
          productType: pi.metadata?.itineraryId ? 'itinerary_direct' : pi.metadata?.type || 'platanos_topup',
          packageId: pi.metadata?.packageId || null,
          platanosAmount: Number(pi.metadata?.platanosAmount || 0) || 0,
          itineraryId: pi.metadata?.itineraryId || null,
          itineraryTitle: pi.metadata?.itineraryTitle || null,
          grossAmountCents: pi.amount_received || pi.amount,
          feeAmountCents: feeCents,
          netAmountCents: netCents,
          currency: pi.currency || 'brl',
          paymentStatus: 'succeeded',
          source: 'stripe_webhook',
          livemode: pi.livemode,
          metadata: pi.metadata || undefined,
          purchasedAt: new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });

        shouldRefreshBalance = true;
        summary = `pi=${pi.id} succeeded`;
        break;
      }

      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        upsertCanonicalStripeTransaction(db, {
          stripePaymentIntentId: pi.id,
          grossAmountCents: pi.amount,
          currency: pi.currency || 'brl',
          paymentStatus: event.type === 'payment_intent.canceled' ? 'cancelled' : 'failed',
          source: 'stripe_webhook',
          livemode: pi.livemode,
          purchasedAt: new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });
        summary = `pi=${pi.id} ${event.type}`;
        break;
      }

      case 'charge.succeeded':
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const piId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id || null;

        let feeCents = 0;
        let netCents = 0;
        let balanceTxId =
          typeof charge.balance_transaction === 'string'
            ? charge.balance_transaction
            : charge.balance_transaction?.id || null;

        if (charge.balance_transaction && typeof charge.balance_transaction === 'object') {
          feeCents = (charge.balance_transaction as Stripe.BalanceTransaction).fee || 0;
          netCents = (charge.balance_transaction as Stripe.BalanceTransaction).net || 0;
        } else if (stripe && balanceTxId) {
          try {
            const bt = await stripe.balanceTransactions.retrieve(balanceTxId);
            feeCents = bt.fee || 0;
            netCents = bt.net || 0;
          } catch {}
        }

        const isFullRefund =
          charge.refunded || (charge.amount_refunded > 0 && charge.amount_refunded >= charge.amount);
        const isPartialRefund = charge.amount_refunded > 0 && !isFullRefund;

        upsertCanonicalStripeTransaction(db, {
          stripeChargeId: charge.id,
          stripePaymentIntentId: piId,
          stripeBalanceTxId: balanceTxId,
          stripeCustomerId:
            typeof charge.customer === 'string' ? charge.customer : charge.customer?.id || null,
          customerEmail:
            charge.metadata?.userEmail || charge.billing_details?.email || charge.receipt_email || null,
          productName: charge.metadata?.itineraryTitle || charge.description || 'Venda Stripe',
          productType: charge.metadata?.itineraryId
            ? 'itinerary_direct'
            : charge.metadata?.type || 'platanos_topup',
          packageId: charge.metadata?.packageId || null,
          platanosAmount: Number(charge.metadata?.platanosAmount || 0) || 0,
          itineraryId: charge.metadata?.itineraryId || null,
          itineraryTitle: charge.metadata?.itineraryTitle || null,
          grossAmountCents: charge.amount,
          feeAmountCents: feeCents,
          netAmountCents: netCents,
          refundedAmountCents: charge.amount_refunded || 0,
          currency: charge.currency || 'brl',
          paymentStatus: isFullRefund
            ? 'refunded'
            : isPartialRefund
              ? 'partially_refunded'
              : charge.paid && charge.status === 'succeeded'
                ? 'succeeded'
                : 'failed',
          refundStatus: isFullRefund ? 'full' : isPartialRefund ? 'partial' : 'none',
          disputeStatus: charge.disputed ? 'open' : 'none',
          source: 'stripe_webhook',
          livemode: charge.livemode,
          metadata: charge.metadata || undefined,
          purchasedAt: new Date((charge.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });

        shouldRefreshBalance = true;
        summary = `charge=${charge.id} ${event.type}`;
        break;
      }

      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id || null;
        const piId =
          typeof dispute.payment_intent === 'string'
            ? dispute.payment_intent
            : dispute.payment_intent?.id || null;

        if (chargeId || piId) {
          upsertCanonicalStripeTransaction(db, {
            stripeChargeId: chargeId,
            stripePaymentIntentId: piId,
            disputeStatus: event.type === 'charge.dispute.created' ? 'open' : dispute.status,
            paymentStatus: event.type === 'charge.dispute.created' ? 'disputed' : undefined,
            source: 'stripe_webhook',
          });
          shouldRefreshBalance = true;
          summary = `dispute=${dispute.id} ${event.type}`;
        }
        break;
      }

      case 'balance.available': {
        shouldRefreshBalance = true;
        summary = 'balance.available';
        break;
      }

      default:
        summary = `ignored:${event.type}`;
        break;
    }

    // Record idempotency key AFTER successful DB update
    db.prepare(
      `INSERT OR IGNORE INTO stripe_webhook_events (event_id, event_type, summary) VALUES (?, ?, ?)`
    ).run(event.id, event.type, summary);

    if (shouldRefreshBalance) {
      await refreshStripeBalanceCache(db, stripe);
    }

    broadcastDashboardUpdate('stripe_webhook', event.type);
    return { processed: true, eventType: event.type };
  } catch (err: any) {
    console.error(`[Stripe Dashboard Webhook] Erro em ${event.type}:`, err?.message);
    throw err;
  }
}

// ============================================================================
// DATE RANGE & BRAZIL LOCAL BUCKETING HELPERS (UTC-3 America/Sao_Paulo)
// ============================================================================
const BRAZIL_OFFSET_MS = -3 * 60 * 60 * 1000;
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function toBrazilDateParts(utcMs: number): {
  year: number;
  month: number; // 0-11
  day: number;
  dayOfWeek: number;
  dateKey: string;
} {
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

interface ResolvedDateRange {
  period: DashboardPeriodKey;
  label: string;
  startUtcMs: number;
  endUtcMs: number;
  prevStartUtcMs: number | null;
  prevEndUtcMs: number | null;
  startDateStr: string;
  endDateStr: string;
  bucketMode: 'day' | 'week' | 'month';
}

function resolveDateRange(
  periodRaw: string | undefined,
  customStart?: string,
  customEnd?: string,
  earliestDataIso?: string | null
): ResolvedDateRange {
  const allowed: DashboardPeriodKey[] = [
    '7d',
    '30d',
    '90d',
    'this_month',
    'last_month',
    'all',
    'custom',
  ];
  const period: DashboardPeriodKey = allowed.includes(periodRaw as DashboardPeriodKey)
    ? (periodRaw as DashboardPeriodKey)
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
        const tmp = sMs;
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
    // 'all'
    const earliestMs = earliestDataIso ? Date.parse(earliestDataIso) : NaN;
    const defaultStart = toBrazilDateParts(todayEndMs - 179 * DAY_MS);
    const fallbackStartMs = brazilStartOfDayUtcMs(
      defaultStart.year,
      defaultStart.month,
      defaultStart.day
    );
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

function computeDeltaPercent(current: number, previous: number | null): {
  deltaPct: number | null;
  trend: 'up' | 'down' | 'neutral';
  hasBaseline: boolean;
} {
  if (previous === null) {
    return { deltaPct: null, trend: 'neutral', hasBaseline: false };
  }
  if (previous === 0) {
    if (current === 0) {
      return { deltaPct: 0, trend: 'neutral', hasBaseline: false };
    }
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

function getAverageCentsPerPlatano(db: Database.Database): number {
  try {
    const pkgs = db
      .prepare('SELECT platanos, price_cents FROM platanos_packages WHERE is_active = 1 AND platanos > 0')
      .all() as Array<{ platanos: number; price_cents: number }>;
    if (pkgs.length > 0) {
      const totalPlatanos = pkgs.reduce((acc, p) => acc + Number(p.platanos || 0), 0);
      const totalCents = pkgs.reduce((acc, p) => acc + Number(p.price_cents || 0), 0);
      if (totalPlatanos > 0) {
        return totalCents / totalPlatanos;
      }
    }
  } catch {}
  return 2990 / 15; // R$ 29,90 for 15 Plátanos baseline
}

function parseSqlDateMs(raw: string | null | undefined): number {
  if (!raw) return 0;
  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : 0;
}

export async function getFinancialDashboardMetrics(
  db: Database.Database,
  params: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const { configured, livemode } = await getDashboardStripeClientAsync(db);
  const webhookSecret = await resolveStripeWebhookSecretAsync(db);

  // Earliest date for 'all' period
  const earliestTx = db
    .prepare(`SELECT MIN(purchased_at) as d FROM stripe_financial_transactions WHERE payment_status IN ('succeeded', 'partially_refunded', 'refunded')`)
    .get() as { d?: string } | undefined;
  const earliestUnlock = db
    .prepare(`SELECT MIN(created_at) as d FROM platanos_itinerary_unlocks`)
    .get() as { d?: string } | undefined;

  const earliestCandidates = [earliestTx?.d, earliestUnlock?.d].filter(Boolean) as string[];
  earliestCandidates.sort();
  const range = resolveDateRange(
    params.period,
    params.startDate,
    params.endDate,
    earliestCandidates[0] || null
  );

  // Fetch all real Stripe transactions (canonical, deduplicated)
  const allStripeRows = db
    .prepare(`
      SELECT *
      FROM stripe_financial_transactions
      ORDER BY purchased_at ASC
    `)
    .all() as any[];

  // Filter approved/refunded transactions for current & previous periods
  const APPROVED_STATUSES = new Set(['succeeded', 'partially_refunded', 'refunded']);

  const currentStripeTxs: any[] = [];
  const prevStripeTxs: any[] = [];
  for (const tx of allStripeRows) {
    if (!APPROVED_STATUSES.has(String(tx.payment_status || '').toLowerCase())) continue;
    const ms = parseSqlDateMs(tx.purchased_at);
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
    (sum, t) => sum + Number(t.gross_amount_cents || 0),
    0
  );
  const feesCents = currentStripeTxs.reduce((sum, t) => sum + Number(t.fee_amount_cents || 0), 0);
  const refundsCents = currentStripeTxs.reduce(
    (sum, t) => sum + Number(t.refunded_amount_cents || 0),
    0
  );
  const netRevenueCents = Math.max(0, grossRevenueCents - feesCents - refundsCents);

  const prevGrossRevenueCents =
    range.prevStartUtcMs !== null
      ? prevStripeTxs.reduce((sum, t) => sum + Number(t.gross_amount_cents || 0), 0)
      : null;

  const revenueComparison = computeDeltaPercent(grossRevenueCents, prevGrossRevenueCents);

  // Live Stripe Balance (exact from Stripe API cache, NEVER estimated)
  const balanceRow = db
    .prepare('SELECT * FROM stripe_balance_cache WHERE id = 1')
    .get() as any;
  const availableBalanceCents = Number(balanceRow?.available_cents || 0);
  const pendingBalanceCents = Number(balanceRow?.pending_cents || 0);
  const balanceCurrency = String(balanceRow?.currency || 'brl').toLowerCase();

  const lastSyncRow = db
    .prepare("SELECT value FROM system_settings WHERE key = 'stripe_last_sync_at'")
    .get() as { value?: string } | undefined;

  // Itinerary Sales & Top Itineraries (Real unlocks via Plátanos + Direct Stripe itinerary purchases)
  const centsPerPlatano = getAverageCentsPerPlatano(db);
  const allUnlocks = db
    .prepare(`
      SELECT
        u.id,
        u.itinerary_id,
        u.itinerary_title,
        u.platanos_paid,
        u.created_at,
        i.title as live_title,
        i.description as live_description,
        i.cover_image as live_cover_image,
        i.categories as live_categories,
        i.days_count as live_days_count
      FROM platanos_itinerary_unlocks u
      LEFT JOIN itineraries i ON i.id = u.itinerary_id
      ORDER BY u.created_at ASC
    `)
    .all() as any[];

  const parseFirstCategory = (raw: any): string => {
    if (!raw) return '';
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        return parsed[0];
      }
    } catch {}
    return '';
  };

  // Build combined real itinerary sales events (never double counting)
  interface ItinerarySaleEvent {
    ms: number;
    itineraryId: string;
    title: string;
    subtitle: string;
    coverImage: string;
    revenueCents: number;
    platanosPaid: number;
  }

  const currentSalesEvents: ItinerarySaleEvent[] = [];
  const prevSalesEvents: ItinerarySaleEvent[] = [];

  for (const row of allUnlocks) {
    const ms = parseSqlDateMs(row.created_at);
    const firstCat = parseFirstCategory(row.live_categories);
    const ev: ItinerarySaleEvent = {
      ms,
      itineraryId: String(row.itinerary_id),
      title: row.live_title || row.itinerary_title || 'Roteiro Turístico',
      subtitle:
        firstCat ||
        (row.live_days_count ? `${row.live_days_count} dia(s) em Campos` : 'Roteiro Monvian'),
      coverImage: row.live_cover_image || '',
      revenueCents: Math.round(Number(row.platanos_paid || 0) * centsPerPlatano),
      platanosPaid: Number(row.platanos_paid || 0),
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

  // Also include direct Stripe itinerary charges (where product_type = 'itinerary_direct')
  const itineraryCatalogMap = new Map<string, any>();
  try {
    const itRows = db
      .prepare('SELECT id, title, description, cover_image, categories, days_count FROM itineraries')
      .all() as any[];
    for (const r of itRows) {
      itineraryCatalogMap.set(String(r.id), r);
    }
  } catch {}

  for (const tx of currentStripeTxs) {
    if (tx.itinerary_id && tx.payment_status !== 'refunded') {
      const cat = itineraryCatalogMap.get(String(tx.itinerary_id));
      currentSalesEvents.push({
        ms: tx._ms,
        itineraryId: String(tx.itinerary_id),
        title: cat?.title || tx.itinerary_title || tx.product_name || 'Roteiro Turístico',
        subtitle: parseFirstCategory(cat?.categories) || 'Compra direta Stripe',
        coverImage: cat?.cover_image || '',
        revenueCents: Math.max(0, Number(tx.gross_amount_cents || 0) - Number(tx.refunded_amount_cents || 0)),
        platanosPaid: 0,
      });
    }
  }
  for (const tx of prevStripeTxs) {
    if (tx.itinerary_id && tx.payment_status !== 'refunded') {
      const cat = itineraryCatalogMap.get(String(tx.itinerary_id));
      prevSalesEvents.push({
        ms: tx._ms,
        itineraryId: String(tx.itinerary_id),
        title: cat?.title || tx.itinerary_title || tx.product_name || 'Roteiro Turístico',
        subtitle: parseFirstCategory(cat?.categories) || 'Compra direta Stripe',
        coverImage: cat?.cover_image || '',
        revenueCents: Math.max(0, Number(tx.gross_amount_cents || 0) - Number(tx.refunded_amount_cents || 0)),
        platanosPaid: 0,
      });
    }
  }

  const itinerarySalesCount = currentSalesEvents.length;
  const prevItinerarySalesCount = range.prevStartUtcMs !== null ? prevSalesEvents.length : null;
  const salesComparison = computeDeltaPercent(itinerarySalesCount, prevItinerarySalesCount);

  // Build Ranked Top Itineraries
  const rankingMap = new Map<
    string,
    {
      id: string;
      title: string;
      subtitle: string;
      coverImage: string;
      salesCount: number;
      revenueCents: number;
      platanosTotal: number;
    }
  >();

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

  // =========================================================================
  // BUILD TIME-SERIES BUCKETS FOR CHARTS (100% Real Aggregated Data)
  // =========================================================================
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
    // 'month'
    const startP = toBrazilDateParts(range.startUtcMs);
    const endP = toBrazilDateParts(range.endUtcMs);
    let y = startP.year;
    let m = startP.month;
    while ((y < endP.year || (y === endP.year && m <= endP.month)) && buckets.length < 36) {
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const mStart = brazilStartOfDayUtcMs(y, m, 1);
      const mEnd = brazilEndOfDayUtcMs(y, m, lastDay);
      buckets.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        label: `${MONTHS_PT[m]}/${String(y).slice(-2)}`,
        fullLabel: `${MONTHS_PT[m]} de ${y}`,
        startMs: mStart,
        endMs: mEnd,
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
      b.revenueCents += Number(tx.gross_amount_cents || 0);
      b.feesCents += Number(tx.fee_amount_cents || 0);
      b.refundsCents += Number(tx.refunded_amount_cents || 0);
      if (tx.payment_status !== 'refunded') {
        b.approvedOrdersCount += 1;
      }
    }
  }

  for (const ev of currentSalesEvents) {
    const b = buckets.find((bk) => ev.ms >= bk.startMs && ev.ms <= bk.endMs);
    if (b) {
      b.salesCount += 1;
    }
  }

  // Build 7-point compact sparkline & 7-bar summary from real buckets (never fake!)
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

  // If evolution chart has too many daily points (e.g., 30d), keep all points in payload
  // so frontend can show crisp tick labels while allowing hover/tap on every point.
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
    (t) => t.payment_status !== 'refunded'
  ).length;

  return {
    period: {
      key: range.period,
      label: range.label,
      startDate: range.startDateStr,
      endDate: range.endDateStr,
      bucketMode: range.bucketMode,
    },
    stripe: {
      configured,
      livemode: Boolean(balanceRow?.livemode || livemode),
      hasWebhookSecret: Boolean(webhookSecret),
      currency: balanceCurrency,
      lastSyncedAt: lastSyncRow?.value || balanceRow?.synced_at || null,
    },
    revenue: {
      totalCents: grossRevenueCents,
      grossCents: grossRevenueCents,
      feesCents,
      refundsCents,
      netCents: netRevenueCents,
      availableBalanceCents,
      pendingBalanceCents,
      currency: balanceCurrency,
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
  };
}
