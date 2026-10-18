import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../services/firestoreSync.js';
import {
  persistPurchaseToSupabase,
  persistUserToSupabase,
} from '../services/supabaseSync.js';

/**
 * Setup Financial Database Tables (Idempotent SQLite Schema)
 */
export function setupFinancialDatabase(db: Database.Database) {
  try {
    db.exec(`
      -- 1. Stripe Connected Accounts
      CREATE TABLE IF NOT EXISTS host_stripe_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        user_email TEXT UNIQUE NOT NULL,
        stripe_account_id TEXT UNIQUE NOT NULL,
        details_submitted INTEGER DEFAULT 0,
        charges_enabled INTEGER DEFAULT 0,
        payouts_enabled INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- 2. Referral Tracking & Clicks
      CREATE TABLE IF NOT EXISTS referral_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referral_code TEXT NOT NULL,
        host_user_id INTEGER NOT NULL,
        visitor_ip_hash TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (host_user_id) REFERENCES users (id)
      );

      -- 3. Financial Sales
      CREATE TABLE IF NOT EXISTS financial_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stripe_session_id TEXT UNIQUE NOT NULL,
        stripe_payment_intent_id TEXT,
        buyer_user_id INTEGER,
        buyer_email TEXT NOT NULL,
        host_user_id INTEGER,
        referral_code TEXT,
        gross_amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'brl',
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'refunded', 'failed'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_user_id) REFERENCES users (id),
        FOREIGN KEY (host_user_id) REFERENCES users (id)
      );

      -- 4. Financial Commissions (60% Host / 40% Monvian)
      CREATE TABLE IF NOT EXISTS financial_commissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        stripe_session_id TEXT UNIQUE NOT NULL,
        host_user_id INTEGER NOT NULL,
        eligible_amount_cents INTEGER NOT NULL,
        host_percentage REAL NOT NULL DEFAULT 60.0,
        host_commission_cents INTEGER NOT NULL,
        monvian_commission_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'available', -- 'pending', 'available', 'transferred', 'reversed'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES financial_sales (id),
        FOREIGN KEY (host_user_id) REFERENCES users (id)
      );

      -- 5. Financial Events (Idempotency Audit Log)
      CREATE TABLE IF NOT EXISTS financial_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        payload_summary TEXT
      );

      -- 6. Refunds and Reversals
      CREATE TABLE IF NOT EXISTS financial_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        commission_id INTEGER,
        stripe_refund_id TEXT UNIQUE NOT NULL,
        refunded_amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES financial_sales (id),
        FOREIGN KEY (commission_id) REFERENCES financial_commissions (id)
      );

      -- 7. Ledger Entries (Double-Entry Financial Audit Trail)
      CREATE TABLE IF NOT EXISTS financial_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_type TEXT NOT NULL, -- 'sale_gross', 'host_commission', 'monvian_revenue', 'refund', 'stripe_fee'
        amount_cents INTEGER NOT NULL,
        sale_id INTEGER,
        host_user_id INTEGER,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for High Performance & Zero Collisions
      CREATE INDEX IF NOT EXISTS idx_host_stripe_user ON host_stripe_accounts (user_id);
      CREATE INDEX IF NOT EXISTS idx_referral_tracks_code ON referral_tracks (referral_code);
      CREATE INDEX IF NOT EXISTS idx_financial_sales_session ON financial_sales (stripe_session_id);
      CREATE INDEX IF NOT EXISTS idx_financial_sales_host ON financial_sales (host_user_id);
      CREATE INDEX IF NOT EXISTS idx_financial_commissions_host ON financial_commissions (host_user_id);
      CREATE INDEX IF NOT EXISTS idx_financial_commissions_sale ON financial_commissions (sale_id);
    `);
  } catch (err) {
    console.error('[Financial DB Setup Error]:', err);
  }
}

/**
 * Utility: Calculates Commission Split (60% Host / 40% Monvian) in Exact Integer Cents
 */
export function calculateCommissionSplit(amountCents: number): {
  hostCommissionCents: number;
  monvianCommissionCents: number;
} {
  const hostCommissionCents = Math.round(amountCents * 0.60);
  const monvianCommissionCents = amountCents - hostCommissionCents;
  return { hostCommissionCents, monvianCommissionCents };
}

/**
 * Core Financial Processing Engine: Registers Sales, Commission Split (60%/40%),
 * Webhook Idempotency, and Audit Ledger.
 */
export function recordFinancialSaleAndCommission(
  db: Database.Database,
  data: {
    eventId?: string;
    stripeSessionId: string;
    stripePaymentIntentId?: string | null;
    buyerUserId: number;
    buyerEmail: string;
    referralCode?: string | null;
    hostUserId?: number | null;
    grossAmountCents: number;
    currency?: string;
    metadata?: any;
  }
): { success: boolean; saleId?: number; commissionId?: number; isDuplicate?: boolean } {
  try {
    const cleanSessionId = String(data.stripeSessionId || '').trim();
    if (!cleanSessionId) return { success: false };

    // 1. Idempotency Check via financial_events
    if (data.eventId) {
      const existingEvent = db
        .prepare('SELECT event_id FROM financial_events WHERE event_id = ?')
        .get(data.eventId);
      if (existingEvent) {
        console.log(`[Financial Engine] Event ${data.eventId} already processed (idempotent).`);
        const existingSale: any = db
          .prepare('SELECT id FROM financial_sales WHERE stripe_session_id = ?')
          .get(cleanSessionId);
        return { success: true, saleId: existingSale?.id, isDuplicate: true };
      }
      db.prepare(`
        INSERT OR IGNORE INTO financial_events (event_id, event_type, payload_summary)
        VALUES (?, 'sale_confirmed', ?)
      `).run(data.eventId, JSON.stringify(data.metadata || {}));
    }

    // 2. Resolve Host ID & Referral Code
    let finalHostUserId = data.hostUserId || null;
    let finalReferralCode = data.referralCode || null;

    if (!finalHostUserId && finalReferralCode) {
      const hostProf: any = db
        .prepare('SELECT user_id, referral_code FROM host_profiles WHERE LOWER(referral_code) = ?')
        .get(String(finalReferralCode).trim().toLowerCase());
      if (hostProf) {
        finalHostUserId = hostProf.user_id;
        finalReferralCode = hostProf.referral_code;
      }
    }

    if (!finalHostUserId && data.buyerUserId) {
      const lastTrack: any = db
        .prepare('SELECT host_user_id, referral_code FROM referral_tracks ORDER BY id DESC LIMIT 1')
        .get();
      if (lastTrack) {
        finalHostUserId = lastTrack.host_user_id;
        finalReferralCode = lastTrack.referral_code;
      }
    }

    // 3. Insert or Update Financial Sale
    db.prepare(`
      INSERT INTO financial_sales (
        stripe_session_id, stripe_payment_intent_id, buyer_user_id, buyer_email,
        host_user_id, referral_code, gross_amount_cents, currency, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(stripe_session_id) DO UPDATE SET
        stripe_payment_intent_id = COALESCE(excluded.stripe_payment_intent_id, financial_sales.stripe_payment_intent_id),
        buyer_user_id = COALESCE(excluded.buyer_user_id, financial_sales.buyer_user_id),
        host_user_id = COALESCE(excluded.host_user_id, financial_sales.host_user_id),
        referral_code = COALESCE(excluded.referral_code, financial_sales.referral_code),
        gross_amount_cents = excluded.gross_amount_cents,
        status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
    `).run(
      cleanSessionId,
      data.stripePaymentIntentId || null,
      data.buyerUserId || null,
      (data.buyerEmail || '').trim().toLowerCase(),
      finalHostUserId,
      finalReferralCode,
      data.grossAmountCents || 1990,
      (data.currency || 'brl').toLowerCase()
    );

    const saleRecord: any = db
      .prepare('SELECT * FROM financial_sales WHERE stripe_session_id = ?')
      .get(cleanSessionId);

    let commissionId: number | undefined = undefined;

    // 4. Calculate Commission Split (60% Host / 40% Monvian) if host assigned
    if (saleRecord && saleRecord.host_user_id) {
      const splits = calculateCommissionSplit(saleRecord.gross_amount_cents);

      db.prepare(`
        INSERT INTO financial_commissions (
          sale_id, stripe_session_id, host_user_id, eligible_amount_cents,
          host_percentage, host_commission_cents, monvian_commission_cents, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 60.0, ?, ?, 'available', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(stripe_session_id) DO UPDATE SET
          host_user_id = excluded.host_user_id,
          eligible_amount_cents = excluded.eligible_amount_cents,
          host_commission_cents = excluded.host_commission_cents,
          monvian_commission_cents = excluded.monvian_commission_cents,
          status = 'available',
          updated_at = CURRENT_TIMESTAMP
      `).run(
        saleRecord.id,
        cleanSessionId,
        saleRecord.host_user_id,
        saleRecord.gross_amount_cents,
        splits.hostCommissionCents,
        splits.monvianCommissionCents
      );

      const commRecord: any = db
        .prepare('SELECT id FROM financial_commissions WHERE stripe_session_id = ?')
        .get(cleanSessionId);
      commissionId = commRecord?.id;

      // 5. Record Double-Entry Audit Ledger
      db.prepare(`
        INSERT INTO financial_ledger (entry_type, amount_cents, sale_id, host_user_id, description)
        VALUES ('sale_gross', ?, ?, ?, 'Venda confirmada via Stripe Checkout')
      `).run(saleRecord.gross_amount_cents, saleRecord.id, saleRecord.host_user_id);

      db.prepare(`
        INSERT INTO financial_ledger (entry_type, amount_cents, sale_id, host_user_id, description)
        VALUES ('host_commission', ?, ?, ?, 'Comissão de 60% atribuída ao anfitrião')
      `).run(splits.hostCommissionCents, saleRecord.id, saleRecord.host_user_id);

      db.prepare(`
        INSERT INTO financial_ledger (entry_type, amount_cents, sale_id, host_user_id, description)
        VALUES ('monvian_revenue', ?, ?, NULL, 'Parcela de 40% do Monvian')
      `).run(splits.monvianCommissionCents, saleRecord.id);
    } else if (saleRecord) {
      // Direct Sale without referral
      db.prepare(`
        INSERT INTO financial_ledger (entry_type, amount_cents, sale_id, host_user_id, description)
        VALUES ('sale_gross', ?, ?, NULL, 'Venda direta confirmada sem indicação')
      `).run(saleRecord.gross_amount_cents, saleRecord.id);

      db.prepare(`
        INSERT INTO financial_ledger (entry_type, amount_cents, sale_id, host_user_id, description)
        VALUES ('monvian_revenue', ?, ?, NULL, 'Receita integral de 100% do Monvian')
      `).run(saleRecord.gross_amount_cents, saleRecord.id);
    }

    return { success: true, saleId: saleRecord?.id, commissionId };
  } catch (err) {
    console.error('[Financial Engine Error]:', err);
    return { success: false };
  }
}

/**
 * Handles Refunds and Reversals cleanly without destroying sales history
 */
export function recordFinancialRefund(
  db: Database.Database,
  data: {
    eventId?: string;
    stripeRefundId: string;
    stripeSessionId: string;
    refundedAmountCents: number;
    reason?: string;
  }
): { success: boolean } {
  try {
    const saleRecord: any = db
      .prepare('SELECT * FROM financial_sales WHERE stripe_session_id = ? OR stripe_payment_intent_id = ?')
      .get(data.stripeSessionId, data.stripeSessionId);

    if (!saleRecord) return { success: false };

    const commRecord: any = db
      .prepare('SELECT * FROM financial_commissions WHERE sale_id = ?')
      .get(saleRecord.id);

    // 1. Record Refund
    db.prepare(`
      INSERT OR IGNORE INTO financial_refunds (
        sale_id, commission_id, stripe_refund_id, refunded_amount_cents, status, created_at
      ) VALUES (?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
    `).run(
      saleRecord.id,
      commRecord?.id || null,
      data.stripeRefundId,
      data.refundedAmountCents || saleRecord.gross_amount_cents
    );

    // 2. Mark Sale as Refunded & Commission as Reversed
    db.prepare(`UPDATE financial_sales SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(saleRecord.id);

    if (commRecord) {
      db.prepare(`UPDATE financial_commissions SET status = 'reversed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(commRecord.id);
    }

    // 3. Ledger Entry for Audit
    db.prepare(`
      INSERT INTO financial_ledger (entry_type, amount_cents, sale_id, host_user_id, description)
      VALUES ('refund', ?, ?, ?, ?)
    `).run(
      -(data.refundedAmountCents || saleRecord.gross_amount_cents),
      saleRecord.id,
      saleRecord.host_user_id,
      `Reembolso processado: ${data.reason || 'Solicitação do comprador'}`
    );

    return { success: true };
  } catch (err) {
    console.error('[Financial Refund Error]:', err);
    return { success: false };
  }
}


export function registerFinancialRoutes(
  app: express.Express,
  db: Database.Database,
  getAuthUser: (req: Request) => Promise<any> | any
) {
  function getStripeKey(): string {
    const envKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (envKey) return envKey;
    try {
      const row = db.prepare("SELECT value FROM system_settings WHERE key = 'stripe_secret_key'").get() as { value?: string } | undefined;
      if (row?.value && row.value.trim()) return row.value.trim();
    } catch {}
    return '';
  }

  function getStripeClient(): Stripe | null {
    const key = getStripeKey();
    if (!key) return null;
    return new Stripe(key);
  }

  // ---------------------------------------------------------------------------
  // 1. POST /api/referral/track
  // Records a referral visit from a host link (/indique/:code or ?ref=code)
  // ---------------------------------------------------------------------------
  app.post('/api/referral/track', async (req: Request, res: Response) => {
    try {
      const { code } = req.body || {};
      const cleanCode = String(code || '').trim();
      if (!cleanCode) {
        return res.status(400).json({ success: false, error: 'Código de indicação obrigatório.' });
      }

      // Resolve host profile by referral_code
      const hostProfile: any = db
        .prepare('SELECT user_id, user_email, referral_code FROM host_profiles WHERE LOWER(referral_code) = ?')
        .get(cleanCode.toLowerCase());

      if (!hostProfile) {
        return res.status(404).json({ success: false, error: 'Anfitrião não encontrado.' });
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const ipHash = crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
      const userAgent = (req.headers['user-agent'] || '').slice(0, 200);

      db.prepare(`
        INSERT INTO referral_tracks (referral_code, host_user_id, visitor_ip_hash, user_agent)
        VALUES (?, ?, ?, ?)
      `).run(hostProfile.referral_code, hostProfile.user_id, ipHash, userAgent);

      return res.json({
        success: true,
        hostUserId: hostProfile.user_id,
        referralCode: hostProfile.referral_code,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Erro ao registrar clique de indicação.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. POST /api/host/stripe/connect-account
  // Stripe Connect Onboarding: Creates or retrieves Express account for host
  // ---------------------------------------------------------------------------
  app.post('/api/host/stripe/connect-account', async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
      }

      const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
      const hostProfile: any = db
        .prepare('SELECT * FROM host_profiles WHERE user_id = ? OR LOWER(user_email) = ?')
        .get(user.id, cleanEmail);

      if (!hostProfile || hostProfile.onboarding_completed !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Conclua o cadastro de anfitrião antes de conectar sua conta bancária.',
        });
      }

      const stripe = getStripeClient();
      const host = req.get('host') || 'localhost:3000';
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      const origin = process.env.APP_URL || `${protocol}://${host}`;

      let accountRecord: any = db
        .prepare('SELECT * FROM host_stripe_accounts WHERE user_id = ?')
        .get(user.id);

      let accountId = accountRecord?.stripe_account_id;

      if (!accountId) {
        if (!stripe) {
          // Safe test mode link when Stripe API Key is not set in environment
          const fakeAccountId = `acct_sim_${crypto.randomBytes(8).toString('hex')}`;
          db.prepare(`
            INSERT INTO host_stripe_accounts (user_id, user_email, stripe_account_id, details_submitted, charges_enabled, payouts_enabled)
            VALUES (?, ?, ?, 1, 1, 1)
          `).run(user.id, cleanEmail, fakeAccountId);

          db.prepare(`
            UPDATE host_profiles SET stripe_onboarding_status = 'verified' WHERE user_id = ?
          `).run(user.id);

          return res.json({
            success: true,
            isTestFallback: true,
            accountId: fakeAccountId,
            url: `${origin}/?stripe_connect=success&test_mode=1`,
            message: 'Modo de simulação: Conta de recebimentos conectada para testes.',
          });
        }

        // Create genuine Stripe Connect Express Account
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'BR',
          email: hostProfile.contact_email || cleanEmail,
          capabilities: {
            transfers: { requested: true },
          },
          business_type: 'individual',
          individual: {
            first_name: (hostProfile.full_name || '').split(' ')[0] || 'Anfitrião',
            last_name: (hostProfile.full_name || '').split(' ').slice(1).join(' ') || 'Monvian',
            email: hostProfile.contact_email || cleanEmail,
          },
          metadata: {
            userId: String(user.id),
            userEmail: cleanEmail,
            referralCode: hostProfile.referral_code || '',
          },
        });

        accountId = account.id;

        db.prepare(`
          INSERT INTO host_stripe_accounts (user_id, user_email, stripe_account_id, details_submitted, charges_enabled, payouts_enabled)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          user.id,
          cleanEmail,
          accountId,
          account.details_submitted ? 1 : 0,
          account.charges_enabled ? 1 : 0,
          account.payouts_enabled ? 1 : 0
        );
      } else if (stripe) {
        // Sync account status from Stripe
        try {
          const account = await stripe.accounts.retrieve(accountId);
          db.prepare(`
            UPDATE host_stripe_accounts
            SET details_submitted = ?, charges_enabled = ?, payouts_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE stripe_account_id = ?
          `).run(
            account.details_submitted ? 1 : 0,
            account.charges_enabled ? 1 : 0,
            account.payouts_enabled ? 1 : 0,
            accountId
          );

          const statusStr = account.payouts_enabled ? 'verified' : account.details_submitted ? 'pending_verification' : 'incomplete';
          db.prepare(`UPDATE host_profiles SET stripe_onboarding_status = ? WHERE user_id = ?`).run(statusStr, user.id);
        } catch (e) {
          console.warn('[Stripe Connect Sync Warning]:', e);
        }
      }

      if (!stripe) {
        return res.json({
          success: true,
          url: `${origin}/?stripe_connect=success&test_mode=1`,
        });
      }

      // Generate official Stripe Account Link for onboarding / management
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/?view=anfitriao&stripe_connect=refresh`,
        return_url: `${origin}/?view=anfitriao&stripe_connect=success`,
        type: 'account_onboarding',
      });

      return res.json({
        success: true,
        accountId,
        url: accountLink.url,
      });
    } catch (err: any) {
      console.error('[Stripe Connect Onboarding Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar o link de cadastro financeiro do Stripe: ' + (err.message || 'Tente novamente.'),
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/host/stripe/account-status
  // Checks Stripe Connect verification & payout capabilities
  // ---------------------------------------------------------------------------
  app.get('/api/host/stripe/account-status', async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
      }

      const accountRecord: any = db
        .prepare('SELECT * FROM host_stripe_accounts WHERE user_id = ?')
        .get(user.id);

      if (!accountRecord) {
        return res.json({
          success: true,
          hasAccount: false,
          detailsSubmitted: false,
          payoutsEnabled: false,
          chargesEnabled: false,
          status: 'not_connected',
        });
      }

      const stripe = getStripeClient();
      if (stripe && accountRecord.stripe_account_id && !accountRecord.stripe_account_id.startsWith('acct_sim_')) {
        try {
          const account = await stripe.accounts.retrieve(accountRecord.stripe_account_id);
          db.prepare(`
            UPDATE host_stripe_accounts
            SET details_submitted = ?, charges_enabled = ?, payouts_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE stripe_account_id = ?
          `).run(
            account.details_submitted ? 1 : 0,
            account.charges_enabled ? 1 : 0,
            account.payouts_enabled ? 1 : 0,
            accountRecord.stripe_account_id
          );

          return res.json({
            success: true,
            hasAccount: true,
            accountId: accountRecord.stripe_account_id,
            detailsSubmitted: account.details_submitted,
            payoutsEnabled: account.payouts_enabled,
            chargesEnabled: account.charges_enabled,
            status: account.payouts_enabled ? 'verified' : account.details_submitted ? 'pending_verification' : 'incomplete',
          });
        } catch (err) {
          console.warn('[Stripe Connect Retrieve Error]:', err);
        }
      }

      return res.json({
        success: true,
        hasAccount: true,
        accountId: accountRecord.stripe_account_id,
        detailsSubmitted: Boolean(accountRecord.details_submitted),
        payoutsEnabled: Boolean(accountRecord.payouts_enabled),
        chargesEnabled: Boolean(accountRecord.charges_enabled),
        status: accountRecord.payouts_enabled ? 'verified' : 'pending_verification',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Erro ao verificar conta Stripe.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. GET /api/admin/financial/overview
  // Admin Financial Billing & Revenue Breakdown
  // ---------------------------------------------------------------------------
  app.get('/api/admin/financial/overview', async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Acesso restrito ao administrador.' });
      }

      // 1. Total Confirmed Gross Sales Volume
      const salesStats: any = db.prepare(`
        SELECT 
          COUNT(*) as total_sales_count,
          COALESCE(SUM(CASE WHEN status = 'confirmed' THEN gross_amount_cents ELSE 0 END), 0) as confirmed_gross_cents,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN gross_amount_cents ELSE 0 END), 0) as pending_gross_cents,
          COALESCE(SUM(CASE WHEN status = 'refunded' THEN gross_amount_cents ELSE 0 END), 0) as refunded_gross_cents
        FROM financial_sales
      `).get();

      // 2. Commission Splits Total
      const commissionStats: any = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN status IN ('available', 'transferred') THEN host_commission_cents ELSE 0 END), 0) as host_commission_confirmed_cents,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN host_commission_cents ELSE 0 END), 0) as host_commission_pending_cents,
          COALESCE(SUM(CASE WHEN status IN ('available', 'transferred') THEN monvian_commission_cents ELSE 0 END), 0) as monvian_commission_cents
        FROM financial_commissions
      `).get();

      // 3. Estimated Stripe Processing Fees (approx 3.99% + R$ 0,39 per transaction)
      const confirmedCount = salesStats?.total_sales_count || 0;
      const confirmedGrossCents = salesStats?.confirmed_gross_cents || 0;
      const estimatedStripeFeeCents = Math.round(confirmedGrossCents * 0.0399) + (confirmedCount * 39);

      // 4. Monvian Net Revenue
      const monvianNetRevenueCents = Math.max(0, commissionStats.monvian_commission_cents - estimatedStripeFeeCents);

      // 5. Total Host Accounts & Referral Clicks
      const totalHosts = (db.prepare('SELECT COUNT(*) as c FROM host_profiles WHERE onboarding_completed = 1').get() as any)?.c || 0;
      const totalReferralClicks = (db.prepare('SELECT COUNT(*) as c FROM referral_tracks').get() as any)?.c || 0;

      // 6. Detailed Sales List
      const salesList = db.prepare(`
        SELECT 
          fs.*,
          c.host_commission_cents,
          c.monvian_commission_cents,
          c.status as commission_status,
          hp.full_name as host_name
        FROM financial_sales fs
        LEFT JOIN financial_commissions c ON c.sale_id = fs.id
        LEFT JOIN host_profiles hp ON hp.user_id = fs.host_user_id
        ORDER BY fs.id DESC
        LIMIT 50
      `).all();

      return res.json({
        success: true,
        summary: {
          grossVolumeBRL: (salesStats.confirmed_gross_cents / 100).toFixed(2),
          pendingVolumeBRL: (salesStats.pending_gross_cents / 100).toFixed(2),
          refundedVolumeBRL: (salesStats.refunded_gross_cents / 100).toFixed(2),
          hostCommissionsBRL: (commissionStats.host_commission_confirmed_cents / 100).toFixed(2),
          hostPendingCommissionsBRL: (commissionStats.host_commission_pending_cents / 100).toFixed(2),
          monvianGrossShareBRL: (commissionStats.monvian_commission_cents / 100).toFixed(2),
          estimatedStripeFeesBRL: (estimatedStripeFeeCents / 100).toFixed(2),
          monvianNetEstimatedBRL: (monvianNetRevenueCents / 100).toFixed(2),
          totalHosts,
          totalReferralClicks,
          totalConfirmedSales: salesStats.total_sales_count,
        },
        sales: salesList,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Erro ao gerar faturamento administrativo: ' + err.message });
    }
  });
}
