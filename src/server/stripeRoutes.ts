import express from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import type Database from 'better-sqlite3';
import { handlePlatanosStripeWebhookEvent } from './platanosRoutes.ts';
import {
  setupStripeDashboardDatabase,
  getDashboardStripeClientAsync,
  resolveStripeWebhookSecretAsync,
  syncStripeHistoryAndBalance,
  processStripeDashboardWebhookEvent,
  getFinancialDashboardMetrics,
  addDashboardSseSubscriber,
  removeDashboardSseSubscriber,
} from './stripeDashboardService.ts';

const PRIMARY_ADMIN_EMAILS = new Set(['marioyesk@gmail.com', 'admin@monvian.com']);

// Setup SQLite Purchases Table, Financial Dashboard Tables and Users Stripe Column
export function setupStripeDatabase(db: Database.Database) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_email TEXT NOT NULL,
        stripe_session_id TEXT UNIQUE NOT NULL,
        stripe_payment_intent_id TEXT,
        amount_total INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'brl',
        payment_status TEXT NOT NULL,
        plan_granted TEXT NOT NULL DEFAULT 'platanos',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);
  } catch (e) {
    console.error('[Stripe DB] Error creating purchases table:', e);
  }

  try { db.exec(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;`); } catch (e) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_purchases_session ON purchases (stripe_session_id);`); } catch (e) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases (user_id);`); } catch (e) {}

  try {
    setupStripeDashboardDatabase(db);
  } catch (e) {
    console.error('[Stripe DB] Error creating financial dashboard tables:', e);
  }
}

export function registerStripeRoutes(
  app: express.Express,
  db: Database.Database,
  getAuthUser: (req: express.Request) => Promise<any> | any,
  _logAdminAction?: (userId: number, userName: string, action: string, details?: string) => void
) {
  async function requireStrictAdmin(req: express.Request): Promise<any | null> {
    // Allow EventSource SSE requests to authenticate via ?token=... by hydrating Authorization header
    const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    const effectiveReq =
      !req.headers.authorization && queryToken
        ? ({
            ...req,
            headers: {
              ...req.headers,
              authorization: `Bearer ${queryToken}`,
            },
          } as express.Request)
        : req;

    const user = await getAuthUser(effectiveReq);
    if (!user) return null;
    const email = String(user.email || '').trim().toLowerCase();
    if (user.role === 'admin' || PRIMARY_ADMIN_EMAILS.has(email)) {
      return user;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // 1. Check Stripe Configuration Status (Never exposes secret keys)
  // --------------------------------------------------------------------------
  app.get('/api/stripe/config', async (_req, res) => {
    try {
      const { configured, livemode } = await getDashboardStripeClientAsync(db);
      const webhookSecret = await resolveStripeWebhookSecretAsync(db);
      res.json({
        configured,
        livemode,
        currency: 'BRL',
        mode: 'payment',
        hasWebhookSecret: Boolean(webhookSecret),
      });
    } catch {
      res.json({
        configured: false,
        livemode: false,
        currency: 'BRL',
        mode: 'payment',
        hasWebhookSecret: false,
      });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Official Stripe Webhook Handler (Plátanos + Real-Time Financial Dashboard)
  // --------------------------------------------------------------------------
  app.post('/api/stripe/webhook', async (req: any, res) => {
    let event: Stripe.Event;

    const sig = req.headers['stripe-signature'];
    const rawBody = req.rawBody || req.body;
    const { stripe: stripeClient } = await getDashboardStripeClientAsync(db);
    const stripeWebhookSecret = await resolveStripeWebhookSecretAsync(db);

    try {
      if (stripeWebhookSecret) {
        if (!sig) {
          res.status(400).send('Webhook Error: Missing stripe-signature header');
          return;
        }
        const verifier = stripeClient || new Stripe('sk_test_webhook_verifier');
        event = verifier.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
      } else {
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      const platanosRes = handlePlatanosStripeWebhookEvent(db, event);
      const dashboardRes = await processStripeDashboardWebhookEvent(db, event, stripeClient);

      res.json({
        received: true,
        platanos: platanosRes.handled ? platanosRes : undefined,
        dashboard: dashboardRes,
      });
    } catch (err: any) {
      console.error('[Stripe Webhook] Processing error:', err);
      res.status(500).json({ error: 'Internal webhook error: ' + err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Admin Financial Dashboard Metrics (Real Stripe + Period Filters)
  // --------------------------------------------------------------------------
  app.get('/api/admin/dashboard/financial', async (req, res) => {
    try {
      const admin = await requireStrictAdmin(req);
      if (!admin) {
        res.status(403).json({ error: 'Acesso restrito ao administrador.' });
        return;
      }

      const period = typeof req.query.period === 'string' ? req.query.period : '7d';
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const forceSync = req.query.sync === '1' || req.query.sync === 'true';

      // Auto-sync with Stripe API when explicitly requested or when cache is older than 60s
      let syncError: string | undefined;
      try {
        const lastSyncRow = db
          .prepare("SELECT value FROM system_settings WHERE key = 'stripe_last_sync_at'")
          .get() as { value?: string } | undefined;
        const lastSyncMs = lastSyncRow?.value ? Date.parse(lastSyncRow.value) : 0;
        const isStale = !lastSyncMs || Date.now() - lastSyncMs > 60_000;

        if (forceSync || isStale) {
          const syncRes = await syncStripeHistoryAndBalance(db, {
            force: forceSync,
            silent: true,
          });
          if (syncRes.error && syncRes.configured) {
            syncError = syncRes.error;
          }
        }
      } catch (err: any) {
        syncError = err?.message || 'Erro ao sincronizar com a Stripe.';
      }

      const metrics = await getFinancialDashboardMetrics(db, {
        period,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        ...metrics,
        syncError: syncError || null,
      });
    } catch (err: any) {
      console.error('[Admin Financial Dashboard] Error:', err);
      res.status(500).json({ error: 'Erro ao carregar dados financeiros: ' + err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 4. Trigger On-Demand Full Stripe Historical Sync + Live Balance Refresh
  // --------------------------------------------------------------------------
  app.post('/api/admin/dashboard/financial/sync', async (req, res) => {
    try {
      const admin = await requireStrictAdmin(req);
      if (!admin) {
        res.status(403).json({ error: 'Acesso restrito ao administrador.' });
        return;
      }

      const period = typeof req.body?.period === 'string' ? req.body.period : '7d';
      const startDate = typeof req.body?.startDate === 'string' ? req.body.startDate : undefined;
      const endDate = typeof req.body?.endDate === 'string' ? req.body.endDate : undefined;

      const syncResult = await syncStripeHistoryAndBalance(db, { force: true });
      const metrics = await getFinancialDashboardMetrics(db, {
        period,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        sync: syncResult,
        ...metrics,
      });
    } catch (err: any) {
      console.error('[Admin Financial Sync] Error:', err);
      res.status(500).json({ error: 'Erro ao sincronizar com a Stripe: ' + err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 5. Real-Time Server-Sent Events (SSE) Stream for Auto-Updating Dashboard
  // --------------------------------------------------------------------------
  app.get('/api/admin/dashboard/financial/stream', async (req, res) => {
    try {
      const admin = await requireStrictAdmin(req);
      if (!admin) {
        res.status(403).json({ error: 'Acesso restrito ao administrador.' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const clientId = `dash_${crypto.randomUUID()}`;
      addDashboardSseSubscriber(clientId, res);

      res.write(
        `event: connected\ndata: ${JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
        })}\n\n`
      );

      const heartbeat = setInterval(() => {
        try {
          res.write(
            `event: heartbeat\ndata: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
            })}\n\n`
          );
        } catch {
          clearInterval(heartbeat);
          removeDashboardSseSubscriber(clientId);
        }
      }, 25_000);

      req.on('close', () => {
        clearInterval(heartbeat);
        removeDashboardSseSubscriber(clientId);
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 6. Legacy Admin Purchases Endpoint (Preserved for compatibility)
  // --------------------------------------------------------------------------
  app.get('/api/admin/purchases', async (req, res) => {
    try {
      const admin = await requireStrictAdmin(req);
      if (!admin) {
        res.status(403).json({ error: 'Acesso restrito ao administrador' });
        return;
      }

      const purchases = db.prepare(`
        SELECT p.*, u.name as user_name
        FROM purchases p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.id DESC
      `).all();

      const totalRevenueCents = (db.prepare(`SELECT SUM(amount_total) as total FROM purchases WHERE payment_status = 'paid'`).get() as any)?.total || 0;

      res.json({
        success: true,
        purchases,
        stats: {
          totalRevenueBRL: (totalRevenueCents / 100).toFixed(2),
          totalPurchases: purchases.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao listar compras: ' + err.message });
    }
  });
}
