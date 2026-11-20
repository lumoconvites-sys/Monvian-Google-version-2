import express from 'express';
import Stripe from 'stripe';
import type Database from 'better-sqlite3';
import { handlePlatanosStripeWebhookEvent } from './platanosRoutes.ts';

// Setup SQLite Purchases Table and Users Stripe Column
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
}

export function registerStripeRoutes(
  app: express.Express,
  db: Database.Database,
  getAuthUser: (req: express.Request) => Promise<any> | any,
  _logAdminAction?: (userId: number, userName: string, action: string, details?: string) => void
) {
  // Dynamically resolve Stripe client from environment or system_settings
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

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  // --------------------------------------------------------------------------
  // 1. Check Stripe Configuration Status
  // --------------------------------------------------------------------------
  app.get('/api/stripe/config', (_req, res) => {
    const currentKey = getStripeKey();
    res.json({
      configured: Boolean(currentKey),
      currency: 'BRL',
      mode: 'payment',
      hasWebhookSecret: Boolean(stripeWebhookSecret)
    });
  });

  // --------------------------------------------------------------------------
  // 2. Official Stripe Webhook Handler (Plátanos Virtual Currency)
  // --------------------------------------------------------------------------
  app.post('/api/stripe/webhook', async (req: any, res) => {
    let event: Stripe.Event;

    const sig = req.headers['stripe-signature'];
    const rawBody = req.rawBody || req.body;

    try {
      const stripeClient = getStripeClient();
      if (stripeClient && stripeWebhookSecret && sig) {
        event = stripeClient.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
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
      if (platanosRes.handled) {
        res.json({ received: true, platanos: true, ...platanosRes });
        return;
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error('[Stripe Webhook] Processing error:', err);
      res.status(500).json({ error: 'Internal webhook error: ' + err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Admin Purchases & Stripe Metrics
  // --------------------------------------------------------------------------
  app.get('/api/admin/purchases', async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user || user.role !== 'admin') {
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
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao listar compras: ' + err.message });
    }
  });
}
