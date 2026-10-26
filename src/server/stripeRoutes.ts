import express from 'express';
import Stripe from 'stripe';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import {
  persistUserToFirestore,
  getUserFromFirestore,
  firestore,
  isPrimaryAdmin
} from '../services/firestoreSync';
import {
  persistUserToSupabase,
  persistPurchaseToSupabase,
} from '../services/supabaseSync.js';
import {
  recordFinancialSaleAndCommission,
  recordFinancialRefund,
} from './financialRoutes.js';
import { handlePlatanosStripeWebhookEvent } from './platanosRoutes.js';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Setup SQLite Purchases Table and Users Columns
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
        plan_granted TEXT NOT NULL DEFAULT 'gold',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);
  } catch (e) {
    console.error('[Stripe DB] Error creating purchases table:', e);
  }

  try { db.exec(`ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'beta';`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN is_gold INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0;`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN gold_activated_at DATETIME;`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;`); } catch (e) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_purchases_session ON purchases (stripe_session_id);`); } catch (e) {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases (user_id);`); } catch (e) {}
}

export function registerStripeRoutes(
  app: express.Express,
  db: Database.Database,
  getAuthUser: (req: express.Request) => Promise<any> | any,
  logAdminAction?: (userId: number, userName: string, action: string, details?: string) => void
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

  const GOLD_PRICE_CENTS = 1990; // R$ 19,90 (1990 centavos BRL)
  const GOLD_CURRENCY = 'brl';

  /**
   * Helper to permanently grant Gold to a user in SQLite, Supabase PostgreSQL, and Firestore
   */
  async function activateUserGoldPermanently(
    userId: number,
    userEmail: string,
    stripeSessionId: string,
    paymentIntentId: string | null = null,
    amountTotal: number = GOLD_PRICE_CENTS,
    currency: string = GOLD_CURRENCY,
    metadataObj: any = {}
  ): Promise<{ success: boolean; user?: any }> {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const nowIso = new Date().toISOString();

    try {
      // 1. Idempotent purchase record in SQLite
      db.prepare(`
        INSERT OR IGNORE INTO purchases (
          user_id, user_email, stripe_session_id, stripe_payment_intent_id,
          amount_total, currency, payment_status, plan_granted, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'paid', 'gold', ?, CURRENT_TIMESTAMP)
      `).run(
        userId,
        cleanEmail,
        stripeSessionId,
        paymentIntentId,
        amountTotal,
        currency.toLowerCase(),
        JSON.stringify(metadataObj)
      );

      // 1.5 Record sale, referral attribution & commission split (60% host / 40% Monvian)
      recordFinancialSaleAndCommission(db, {
        stripeSessionId,
        stripePaymentIntentId: paymentIntentId,
        buyerUserId: userId,
        buyerEmail: cleanEmail,
        referralCode: metadataObj?.referralCode || metadataObj?.ref || null,
        hostUserId: metadataObj?.hostUserId ? parseInt(metadataObj.hostUserId, 10) : null,
        grossAmountCents: amountTotal,
        currency,
        metadata: metadataObj
      });

      // 2. Update user status in SQLite
      db.prepare(`
        UPDATE users 
        SET plan = 'gold', is_gold = 1, is_premium = 1, gold_activated_at = COALESCE(gold_activated_at, CURRENT_TIMESTAMP)
        WHERE id = ? OR LOWER(email) = ? OR LOWER(whatsapp) = ?
      `).run(userId, cleanEmail, cleanEmail);

      const updatedUser: any = db.prepare('SELECT * FROM users WHERE id = ? OR LOWER(email) = ?').get(userId, cleanEmail);

      // 2.5 Persist to Supabase PostgreSQL
      await persistUserToSupabase({
        ...updatedUser,
        email: cleanEmail,
        is_gold: 1,
        is_premium: 1,
        plan: 'gold',
        gold_activated_at: nowIso,
      });
      await persistPurchaseToSupabase({
        user_id: userId,
        user_email: cleanEmail,
        stripe_session_id: stripeSessionId,
        stripe_payment_intent_id: paymentIntentId,
        amount_total: amountTotal,
        currency: currency.toLowerCase(),
        payment_status: 'paid',
        plan_granted: 'gold',
        metadata: JSON.stringify(metadataObj),
      });

      // 3. Persist to Cloud Firestore for cross-device & cross-container durability
      try {
        const cloudUser = await getUserFromFirestore(cleanEmail);
        await persistUserToFirestore({
          id: userId,
          name: updatedUser?.name || cloudUser?.name || cleanEmail.split('@')[0],
          email: cleanEmail,
          whatsapp: updatedUser?.whatsapp || cleanEmail,
          password_hash: updatedUser?.password_hash || cloudUser?.password_hash || '',
          role: updatedUser?.role || (isPrimaryAdmin(cleanEmail) ? 'admin' : 'user'),
          avatar_url: updatedUser?.avatar_url || cloudUser?.avatar_url || '/fotoperfil.png',
          visits_count: updatedUser?.visits_count || 1,
          is_banned: 0,
          is_premium: 1,
          is_gold: 1,
          plan: 'gold',
          gold_activated_at: nowIso,
          snow_enabled: updatedUser?.snow_enabled || 0,
          theme: updatedUser?.theme || 'dark',
          high_contrast: updatedUser?.high_contrast || 0,
          onboarding_completed: updatedUser?.onboarding_completed || 1,
          onboarding_step: updatedUser?.onboarding_step || 1,
          last_access: nowIso,
          created_at: updatedUser?.created_at || nowIso
        });

        // Also record purchase in Firestore purchases collection
        try {
          const purchaseDocRef = doc(firestore, 'purchases', stripeSessionId);
          await setDoc(purchaseDocRef, {
            user_id: userId,
            user_email: cleanEmail,
            stripe_session_id: stripeSessionId,
            stripe_payment_intent_id: paymentIntentId,
            amount_total: amountTotal,
            currency: currency.toLowerCase(),
            payment_status: 'paid',
            plan_granted: 'gold',
            metadata: metadataObj,
            created_at: nowIso
          }, { merge: true });
        } catch (err) {
          console.warn('[Stripe] Firestore purchase doc sync warning:', err);
        }
      } catch (cloudErr) {
        console.warn('[Stripe] Firestore sync warning on gold activation:', cloudErr);
      }

      if (logAdminAction) {
        logAdminAction(
          userId,
          updatedUser?.name || cleanEmail,
          'Ativação de Conta Elite Gold Permanente (Stripe R$ 19,90)',
          `Sessão: ${stripeSessionId} | Valor: R$ ${(amountTotal / 100).toFixed(2)}`
        );
      }

      console.log(`[Stripe] Conta Elite Gold ativada com sucesso para ${cleanEmail} (ID: ${userId})`);
      return { success: true, user: updatedUser };
    } catch (err) {
      console.error('[Stripe] Error activating user gold:', err);
      return { success: false };
    }
  }

  // --------------------------------------------------------------------------
  // 1. Check Stripe Configuration Status
  // --------------------------------------------------------------------------
  app.get('/api/stripe/config', (req, res) => {
    const currentKey = getStripeKey();
    res.json({
      configured: Boolean(currentKey),
      price: 'R$ 19,90',
      currency: 'BRL',
      mode: 'payment',
      hasWebhookSecret: Boolean(stripeWebhookSecret)
    });
  });

  // --------------------------------------------------------------------------
  // 2. Create Stripe Checkout Session (One-Time Payment R$ 19,90)
  // --------------------------------------------------------------------------
  app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
      const user = await getAuthUser(req);
      const bodyEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const bodyUserId = req.body?.userId ? String(req.body.userId) : '';
      const cleanEmail = (user?.email || user?.whatsapp || bodyEmail || '').trim().toLowerCase();
      const userIdStr = String(user?.id || bodyUserId || 'guest');

      const referralCode = req.body?.referralCode || req.body?.ref || req.body?.referral_code || '';
      let hostUserIdNum: number | null = null;
      if (referralCode) {
        const hp: any = db.prepare('SELECT user_id FROM host_profiles WHERE LOWER(referral_code) = ?').get(String(referralCode).trim().toLowerCase());
        if (hp) hostUserIdNum = hp.user_id;
      }

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      const origin = process.env.APP_URL || `${protocol}://${host}`;
      const stripeClient = getStripeClient();

      if (!stripeClient) {
        // Safe developer fallback if STRIPE_SECRET_KEY is not configured yet
        console.warn('[Stripe] STRIPE_SECRET_KEY não foi configurado em variáveis de ambiente.');
        
        // Return a mock checkout URL or error with clear instructions
        const mockSessionId = `test_sess_${crypto.randomBytes(16).toString('hex')}`;
        res.json({
          success: true,
          isTestFallback: true,
          sessionId: mockSessionId,
          url: `${origin}/?payment=success&session_id=${mockSessionId}&test_mode=1`,
          message: 'Modo de teste ativo: Chave do Stripe não configurada em .env. Utilize STRIPE_SECRET_KEY para produção.'
        });
        return;
      }

      const isValidEmail = cleanEmail.includes('@') && cleanEmail.includes('.');
      const productImages = origin.startsWith('https://') ? [`${origin}/stripe_gold_banner.jpg`] : undefined;

      // Create authentic Stripe Checkout Session
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment', // STRICT ONE-TIME PAYMENT (NO SUBSCRIPTION)
        line_items: [
          {
            price_data: {
              currency: GOLD_CURRENCY,
              product_data: {
                name: 'Monvian - Conta Elite Gold',
                description: 'Acesso permanente aos roteiros exclusivos, pontos turísticos selecionados por guias e experiências em Campos do Jordão.',
                ...(productImages ? { images: productImages } : {}),
              },
              unit_amount: GOLD_PRICE_CENTS, // R$ 19,90 (1990 centavos BRL)
            },
            quantity: 1,
          },
        ],
        ...(isValidEmail ? { customer_email: cleanEmail } : {}),
        client_reference_id: userIdStr,
        metadata: {
          userId: userIdStr,
          userEmail: cleanEmail || 'guest',
          referralCode: referralCode || '',
          hostUserId: hostUserIdNum ? String(hostUserIdNum) : '',
          plan: 'gold',
          product: 'monvians_gold_premium',
          price: '19.90'
        },
        success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?payment=cancelled`,
        allow_promotion_codes: true,
      });

      res.json({
        success: true,
        sessionId: session.id,
        url: session.url
      });
    } catch (err: any) {
      console.error('[Stripe] Error creating checkout session:', err);
      res.status(500).json({
        error: 'Erro ao iniciar checkout do Stripe: ' + (err.message || 'Tente novamente.')
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Official Stripe Webhook Handler (Stripe -> Webhook -> Database -> Plan=Gold)
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
        // Safe parsing if webhook signature secret is not supplied or during local testing
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      // First check if this Stripe event belongs to a Plátanos virtual currency order
      const platanosRes = handlePlatanosStripeWebhookEvent(db, event);
      if (platanosRes.handled) {
        res.json({ received: true, platanos: true, ...platanosRes });
        return;
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        // Verify that payment status is 'paid' (or mode is 'payment')
        const isPaid = session.payment_status === 'paid' || (session.status as any) === 'complete';
        if (!isPaid) {
          console.log(`[Stripe Webhook] Session ${session.id} not marked as paid yet. Status: ${session.payment_status}`);
          res.json({ received: true, status: 'ignored_unpaid' });
          return;
        }

        const userIdStr = session.metadata?.userId || session.client_reference_id;
        const userEmail = session.metadata?.userEmail || session.customer_email || session.customer_details?.email;
        const amountTotal = session.amount_total || GOLD_PRICE_CENTS;
        const currency = session.currency || GOLD_CURRENCY;
        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

        let userId = userIdStr ? parseInt(userIdStr, 10) : 0;
        let cleanEmail = (userEmail || '').trim().toLowerCase();

        // If userId wasn't directly in metadata, find user by email
        if (!userId && cleanEmail) {
          const u: any = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
          if (u) userId = u.id;
        }

        if (!userId && !cleanEmail) {
          console.error('[Stripe Webhook] No user identified for completed session:', session.id);
          res.status(400).json({ error: 'User could not be identified' });
          return;
        }

        await activateUserGoldPermanently(
          userId,
          cleanEmail,
          session.id,
          paymentIntentId,
          amountTotal,
          currency,
          session.metadata || {}
        );

        res.json({ received: true, activated: true });
        return;
      }

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userEmail = paymentIntent.metadata?.userEmail || paymentIntent.receipt_email;
        const userIdStr = paymentIntent.metadata?.userId;

        if (userEmail || userIdStr) {
          const userId = userIdStr ? parseInt(userIdStr, 10) : 0;
          const cleanEmail = (userEmail || '').trim().toLowerCase();
          
          await activateUserGoldPermanently(
            userId,
            cleanEmail,
            `pi_${paymentIntent.id}`,
            paymentIntent.id,
            paymentIntent.amount,
            paymentIntent.currency,
            paymentIntent.metadata || {}
          );
        }

        res.json({ received: true });
        return;
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error('[Stripe Webhook] Processing error:', err);
      res.status(500).json({ error: 'Internal webhook error: ' + err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 4. Verify Session on Return (Safe verification fallback when user returns to app)
  // --------------------------------------------------------------------------
  app.get('/api/stripe/verify-session', async (req, res) => {
    try {
      const sessionId = (req.query.session_id as string || '').trim();
      if (!sessionId) {
        res.status(400).json({ error: 'session_id obrigatório' });
        return;
      }

      // 1. Check if purchase already recorded in local SQLite database
      const existingPurchase: any = db.prepare('SELECT * FROM purchases WHERE stripe_session_id = ?').get(sessionId);
      if (existingPurchase) {
        const user: any = db.prepare('SELECT id, name, email, whatsapp, role, plan, is_gold, is_premium, avatar_url, gold_activated_at FROM users WHERE id = ?').get(existingPurchase.user_id);
        res.json({
          success: true,
          plan: 'gold',
          is_gold: 1,
          isGold: true,
          user
        });
        return;
      }

      // 2. If test mode session, activate gracefully
      if (sessionId.startsWith('test_sess_')) {
        const authUser = await getAuthUser(req);
        if (authUser) {
          const result = await activateUserGoldPermanently(
            authUser.id,
            authUser.email || authUser.whatsapp,
            sessionId,
            null,
            GOLD_PRICE_CENTS,
            'brl',
            { test: true }
          );
          res.json({
            success: true,
            plan: 'gold',
            is_gold: 1,
            isGold: true,
            user: result.user
          });
          return;
        }
      }

      // 3. Actively query Stripe API to confirm real payment status
      const stripeClient = getStripeClient();
      if (stripeClient) {
        const session = await stripeClient.checkout.sessions.retrieve(sessionId);
        if (session && (session.payment_status === 'paid' || (session.status as any) === 'complete')) {
          const userIdStr = session.metadata?.userId || session.client_reference_id;
          const userEmail = session.metadata?.userEmail || session.customer_email || session.customer_details?.email;
          const cleanEmail = (userEmail || '').trim().toLowerCase();
          
          let userId = userIdStr ? parseInt(userIdStr, 10) : 0;
          if (!userId && cleanEmail) {
            const u: any = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
            if (u) userId = u.id;
          }

          if (userId || cleanEmail) {
            const result = await activateUserGoldPermanently(
              userId,
              cleanEmail,
              session.id,
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
              session.amount_total || GOLD_PRICE_CENTS,
              session.currency || GOLD_CURRENCY,
              session.metadata || {}
            );

            res.json({
              success: true,
              plan: 'gold',
              is_gold: 1,
              isGold: true,
              user: result.user
            });
            return;
          }
        }
      }

      // Not found or not paid yet
      res.json({
        success: false,
        is_gold: 0,
        isGold: false,
        message: 'Pagamento pendente ou não confirmado pelo Stripe.'
      });
    } catch (err: any) {
      console.error('[Stripe Verify] Error verifying session:', err);
      res.status(500).json({ error: 'Erro ao verificar sessão: ' + err.message });
    }
  });

  // --------------------------------------------------------------------------
  // 5. Admin Purchases & Stripe Metrics
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
      const totalGoldUsers = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE is_gold = 1 OR plan = 'gold'`).get() as any)?.count || 0;

      res.json({
        success: true,
        purchases,
        stats: {
          totalRevenueBRL: (totalRevenueCents / 100).toFixed(2),
          totalPurchases: purchases.length,
          totalGoldUsers
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao listar compras: ' + err.message });
    }
  });

  // Admin simulation tool to safely test webhook activation in dev/staging
  app.post('/api/admin/simulate-stripe-payment', async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso restrito ao administrador' });
        return;
      }

      const { email, targetUserId } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      
      let targetUser: any = null;
      if (targetUserId) {
        targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
      } else if (cleanEmail) {
        targetUser = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
      }

      if (!targetUser) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      const fakeSessionId = `sim_${crypto.randomBytes(16).toString('hex')}`;
      const result = await activateUserGoldPermanently(
        targetUser.id,
        targetUser.email || targetUser.whatsapp,
        fakeSessionId,
        `pi_sim_${crypto.randomBytes(8).toString('hex')}`,
        GOLD_PRICE_CENTS,
        GOLD_CURRENCY,
        { simulated_by_admin: user.id }
      );

      res.json({
        success: true,
        message: `Conta Elite Gold ativada com sucesso para ${targetUser.email}!`,
        user: result.user
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao simular pagamento: ' + err.message });
    }
  });
}
