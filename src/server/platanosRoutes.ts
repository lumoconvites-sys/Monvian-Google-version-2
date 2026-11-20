import express from 'express';
import Stripe from 'stripe';
import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { firestore, isPrimaryAdmin } from '../services/firestoreSync.ts';
import { supabase } from '../services/supabaseClient.ts';
import { doc, setDoc } from 'firebase/firestore';

export interface PlatanoPackageRow {
  id: string;
  platanos: number;
  price_cents: number;
  price_brl: string;
  badge: string;
  is_best_value: number;
  is_active: number;
  sort_order: number;
}

export const INITIAL_PLATANOS_PACKAGES: PlatanoPackageRow[] = [
  {
    id: 'pkg_15',
    platanos: 15,
    price_cents: 2990,
    price_brl: 'R$ 29,90',
    badge: '',
    is_best_value: 0,
    is_active: 1,
    sort_order: 1,
  },
  {
    id: 'pkg_30',
    platanos: 30,
    price_cents: 5490,
    price_brl: 'R$ 54,90',
    badge: '',
    is_best_value: 0,
    is_active: 1,
    sort_order: 2,
  },
  {
    id: 'pkg_60',
    platanos: 60,
    price_cents: 9990,
    price_brl: 'R$ 99,90',
    badge: '',
    is_best_value: 0,
    is_active: 1,
    sort_order: 3,
  },
  {
    id: 'pkg_100',
    platanos: 100,
    price_cents: 14990,
    price_brl: 'R$ 149,90',
    badge: '',
    is_best_value: 0,
    is_active: 1,
    sort_order: 4,
  },
  {
    id: 'pkg_200',
    platanos: 200,
    price_cents: 24990,
    price_brl: 'R$ 249,90',
    badge: 'Melhor custo-benefício',
    is_best_value: 1,
    is_active: 1,
    sort_order: 5,
  },
];

export function formatCentsToBRL(cents: number): string {
  const reais = (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
  return `R$ ${reais}`;
}

export function setupPlatanosDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS platanos_packages (
      id TEXT PRIMARY KEY,
      platanos INTEGER NOT NULL CHECK (platanos > 0),
      price_cents INTEGER NOT NULL CHECK (price_cents > 0),
      price_brl TEXT NOT NULL,
      badge TEXT DEFAULT '',
      is_best_value INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS platanos_wallets (
      user_id INTEGER PRIMARY KEY,
      user_email TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
      total_credited INTEGER NOT NULL DEFAULT 0 CHECK (total_credited >= 0),
      total_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS platanos_stripe_orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      package_id TEXT NOT NULL,
      platanos_amount INTEGER NOT NULL CHECK (platanos_amount > 0),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      currency TEXT NOT NULL DEFAULT 'brl',
      stripe_session_id TEXT UNIQUE NOT NULL,
      stripe_payment_intent_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      credited INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (package_id) REFERENCES platanos_packages (id)
    );

    CREATE TABLE IF NOT EXISTS platanos_transactions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      status TEXT NOT NULL DEFAULT 'completed',
      description TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS platanos_itinerary_unlocks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      itinerary_id TEXT NOT NULL,
      itinerary_title TEXT NOT NULL,
      platanos_paid INTEGER NOT NULL CHECK (platanos_paid >= 0),
      transaction_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, itinerary_id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (transaction_id) REFERENCES platanos_transactions (id)
    );

    CREATE TABLE IF NOT EXISTS platanos_admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details_json TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_platanos_tx_user ON platanos_transactions (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_platanos_orders_user ON platanos_stripe_orders (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_platanos_orders_session ON platanos_stripe_orders (stripe_session_id);
    CREATE INDEX IF NOT EXISTS idx_platanos_unlocks_user ON platanos_itinerary_unlocks (user_id);
  `);

  try {
    db.exec(`ALTER TABLE itineraries ADD COLUMN platanos_price INTEGER DEFAULT 15;`);
  } catch {}

  try {
    db.exec(`UPDATE itineraries SET is_premium = 1, platanos_price = 15, price = '15 Plátanos' WHERE id IN ('roteiro-romantico-montanhas', 'roteiro-natureza-aventura', 'roteiro-gastronomia-chocolates') AND (is_premium = 0 OR platanos_price IS NULL OR platanos_price <= 0 OR price = 'R$ 0' OR price = 'Grátis');`);
    db.exec(`UPDATE itineraries SET platanos_price = 15, price = '15 Plátanos' WHERE is_premium = 1 AND (platanos_price IS NULL OR platanos_price <= 0 OR platanos_price != 15);`);
    db.exec(`UPDATE itineraries SET platanos_price = 0, price = 'Grátis' WHERE is_premium = 0 AND (platanos_price IS NULL OR id IN ('roteiro-classico-2-dias', 'roteiro-bate-volta-essencial'));`);
  } catch {}

  // Seed default closed packages idempotently
  const insertPkg = db.prepare(`
    INSERT OR IGNORE INTO platanos_packages (
      id, platanos, price_cents, price_brl, badge, is_best_value, is_active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const pkg of INITIAL_PLATANOS_PACKAGES) {
    insertPkg.run(
      pkg.id,
      pkg.platanos,
      pkg.price_cents,
      pkg.price_brl,
      pkg.badge,
      pkg.is_best_value,
      pkg.is_active,
      pkg.sort_order
    );
  }

  // Upgrade legacy R$ 15,90 package pricing in existing SQLite DBs to R$ 29,90 per 15 Plátanos
  try {
    const legacyPkg15 = db
      .prepare(`SELECT price_cents FROM platanos_packages WHERE id = 'pkg_15'`)
      .get() as { price_cents?: number } | undefined;
    if (legacyPkg15 && Number(legacyPkg15.price_cents) === 1590) {
      const updateLegacyPkg = db.prepare(`
        UPDATE platanos_packages
        SET price_cents = ?, price_brl = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      for (const pkg of INITIAL_PLATANOS_PACKAGES) {
        updateLegacyPkg.run(pkg.price_cents, pkg.price_brl, pkg.id);
      }
    }
  } catch {}
}

export function ensureUserWallet(db: Database.Database, userId: number, userEmail: string) {
  const cleanEmail = (userEmail || `user_${userId}@monvian.com`).trim().toLowerCase();
  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!existingUser) {
      const uname = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || `user_${userId}`;
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, username, email, whatsapp, password_hash, role)
        VALUES (?, ?, ?, ?, ?, 'platanos_auto', 'user')
      `).run(userId, uname, `${uname}_${userId}`, cleanEmail, cleanEmail);
    }
  } catch {}

  db.prepare(`
    INSERT OR IGNORE INTO platanos_wallets (user_id, user_email, balance, total_credited, total_spent)
    VALUES (?, ?, 0, 0, 0)
  `).run(userId, cleanEmail);

  return db.prepare('SELECT * FROM platanos_wallets WHERE user_id = ?').get(userId) as {
    user_id: number;
    user_email: string;
    balance: number;
    total_credited: number;
    total_spent: number;
    created_at: string;
    updated_at: string;
  };
}

export function getPackagesList(db: Database.Database, includeInactive = false) {
  const rows = db
    .prepare(
      includeInactive
        ? 'SELECT * FROM platanos_packages ORDER BY sort_order ASC'
        : 'SELECT * FROM platanos_packages WHERE is_active = 1 ORDER BY sort_order ASC'
    )
    .all() as PlatanoPackageRow[];

  return rows.map((r) => ({
    id: r.id,
    platanos: Number(r.platanos),
    priceCents: Number(r.price_cents),
    priceBRL: r.price_brl || formatCentsToBRL(r.price_cents),
    badge: r.badge || (r.is_best_value ? 'Melhor custo-benefício' : ''),
    isBestValue: Boolean(r.is_best_value),
    isActive: Boolean(r.is_active),
    sortOrder: Number(r.sort_order),
  }));
}

export function getItineraryPricesMap(db: Database.Database): Record<string, number> {
  const map: Record<string, number> = {};
  try {
    const rows = db.prepare('SELECT id, is_premium, platanos_price FROM itineraries').all() as {
      id: string;
      is_premium: number;
      platanos_price: number | null;
    }[];
    for (const r of rows) {
      const isPrem = Number(r.is_premium) === 1;
      map[r.id] = isPrem ? (r.platanos_price && r.platanos_price > 0 ? Number(r.platanos_price) : 15) : 0;
    }
  } catch {}
  return map;
}

export function getUserWalletSnapshot(db: Database.Database, userId: number, userEmail: string) {
  const wallet = ensureUserWallet(db, userId, userEmail);
  const unlocks = db
    .prepare('SELECT itinerary_id FROM platanos_itinerary_unlocks WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as { itinerary_id: string }[];

  const transactions = db
    .prepare('SELECT * FROM platanos_transactions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100')
    .all(userId) as any[];

  const orders = db
    .prepare('SELECT * FROM platanos_stripe_orders WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50')
    .all(userId) as any[];

  return {
    userId: wallet.user_id,
    userEmail: wallet.user_email,
    balance: Number(wallet.balance),
    totalCredited: Number(wallet.total_credited),
    totalSpent: Number(wallet.total_spent),
    unlockedItineraryIds: unlocks.map((u) => u.itinerary_id),
    transactions: transactions.map((t) => ({
      id: t.id,
      userId: t.user_id,
      userEmail: t.user_email,
      type: t.type,
      amount: Number(t.amount),
      balanceBefore: Number(t.balance_before),
      balanceAfter: Number(t.balance_after),
      status: t.status,
      description: t.description,
      referenceType: t.reference_type,
      referenceId: t.reference_id,
      createdAt: t.created_at,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      userId: o.user_id,
      userEmail: o.user_email,
      packageId: o.package_id,
      platanosAmount: Number(o.platanos_amount),
      amountCents: Number(o.amount_cents),
      currency: o.currency,
      stripeSessionId: o.stripe_session_id,
      stripePaymentIntentId: o.stripe_payment_intent_id,
      status: o.status,
      credited: Number(o.credited),
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    })),
    packages: getPackagesList(db, false),
    itineraryPrices: getItineraryPricesMap(db),
  };
}

async function syncWalletToFirestore(db: Database.Database, userId: number, userEmail: string) {
  let snap: any = null;
  try {
    snap = getUserWalletSnapshot(db, userId, userEmail);
    const ref = doc(firestore, 'platanos_wallets', String(userId));
    await setDoc(
      ref,
      {
        userId: snap.userId,
        userEmail: snap.userEmail,
        balance: snap.balance,
        totalCredited: snap.totalCredited,
        totalSpent: snap.totalSpent,
        unlockedItineraryIds: snap.unlockedItineraryIds,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {}

  try {
    if (supabase && snap) {
      const keyEmail = (snap.userEmail || userEmail || `uid_${userId}`).trim().toLowerCase();
      await supabase.from('system_settings').upsert(
        {
          key: `platanos_wallet_${keyEmail}`,
          value: JSON.stringify(snap),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
    }
  } catch {}
}

/**
 * Atomically credits Plátanos for a confirmed Stripe Checkout Session.
 * Strictly idempotent: calling multiple times with the same stripeSessionId will only credit once.
 */
export function creditPlatanosFromStripeOrder(
  db: Database.Database,
  params: {
    stripeSessionId: string;
    stripePaymentIntentId?: string | null;
    userId?: number;
    userEmail?: string;
    packageId?: string;
    amountTotalCents?: number;
  }
): {
  success: boolean;
  alreadyCredited: boolean;
  creditedAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  userId: number;
  orderId: string;
} {
  const tx = db.transaction(() => {
    const cleanSessionId = String(params.stripeSessionId || '').trim();
    if (!cleanSessionId) {
      throw new Error('stripe_session_id inválido');
    }

    let order = db
      .prepare('SELECT * FROM platanos_stripe_orders WHERE stripe_session_id = ?')
      .get(cleanSessionId) as any;

    const idempotencyKey = `stripe_credit_${cleanSessionId}`;
    const existingTx = db
      .prepare('SELECT * FROM platanos_transactions WHERE idempotency_key = ?')
      .get(idempotencyKey) as any;

    if ((order && Number(order.credited) === 1) || existingTx) {
      const uid = order?.user_id || existingTx?.user_id || params.userId || 0;
      const w = ensureUserWallet(db, uid, order?.user_email || existingTx?.user_email || params.userEmail || '');
      return {
        success: true,
        alreadyCredited: true,
        creditedAmount: Number(order?.platanos_amount || existingTx?.amount || 0),
        balanceBefore: Number(existingTx?.balance_before ?? w.balance),
        balanceAfter: Number(w.balance),
        userId: uid,
        orderId: order?.id || existingTx?.reference_id || '',
      };
    }

    // If order wasn't created before webhook (or came from metadata), validate package from DB
    if (!order) {
      const pkgId = String(params.packageId || '').trim();
      const pkg = db.prepare('SELECT * FROM platanos_packages WHERE id = ?').get(pkgId) as PlatanoPackageRow | undefined;
      if (!pkg) {
        throw new Error(`Pacote de Plátanos inválido ou não permitido: ${pkgId}`);
      }
      if (
        params.amountTotalCents !== undefined &&
        Number(params.amountTotalCents) !== Number(pkg.price_cents)
      ) {
        throw new Error(
          `Divergência de valor pago (${params.amountTotalCents}) vs preço oficial do pacote (${pkg.price_cents})`
        );
      }
      const uid = Number(params.userId || 0);
      const uEmail = String(params.userEmail || '').trim().toLowerCase();
      if (!uid) {
        throw new Error('Usuário não identificado para crédito de Plátanos');
      }
      const newOrderId = `ord_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO platanos_stripe_orders (
          id, user_id, user_email, package_id, platanos_amount, amount_cents,
          currency, stripe_session_id, stripe_payment_intent_id, status, credited
        ) VALUES (?, ?, ?, ?, ?, ?, 'brl', ?, ?, 'pending', 0)
      `).run(
        newOrderId,
        uid,
        uEmail,
        pkg.id,
        pkg.platanos,
        pkg.price_cents,
        cleanSessionId,
        params.stripePaymentIntentId || null
      );
      order = db.prepare('SELECT * FROM platanos_stripe_orders WHERE id = ?').get(newOrderId);
    } else {
      // Verify paid amount matches authoritative order amount_cents if provided
      if (
        params.amountTotalCents !== undefined &&
        Number(params.amountTotalCents) !== Number(order.amount_cents)
      ) {
        throw new Error(
          `Valor pago no Stripe (${params.amountTotalCents}) diverge do pedido registrado (${order.amount_cents})`
        );
      }
    }

    const wallet = ensureUserWallet(db, order.user_id, order.user_email);
    const balanceBefore = Number(wallet.balance);
    const creditAmount = Number(order.platanos_amount);
    const balanceAfter = balanceBefore + creditAmount;

    db.prepare(`
      UPDATE platanos_wallets
      SET balance = ?, total_credited = total_credited + ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(balanceAfter, creditAmount, order.user_id);

    db.prepare(`
      UPDATE platanos_stripe_orders
      SET status = 'paid', credited = 1, stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(params.stripePaymentIntentId || null, order.id);

    const txId = `ptx_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO platanos_transactions (
        id, user_id, user_email, type, amount, balance_before, balance_after,
        status, description, reference_type, reference_id, idempotency_key
      ) VALUES (?, ?, ?, 'credit_purchase', ?, ?, ?, 'completed', ?, 'stripe_order', ?, ?)
    `).run(
      txId,
      order.user_id,
      order.user_email,
      creditAmount,
      balanceBefore,
      balanceAfter,
      `Recarga de ${creditAmount} Plátanos (${formatCentsToBRL(order.amount_cents)})`,
      order.id,
      idempotencyKey
    );

    return {
      success: true,
      alreadyCredited: false,
      creditedAmount: creditAmount,
      balanceBefore,
      balanceAfter,
      userId: Number(order.user_id),
      orderId: String(order.id),
    };
  });

  const result = tx.immediate();
  syncWalletToFirestore(db, result.userId, params.userEmail || '').catch(() => {});
  return result;
}

/**
 * Updates order status when a Stripe checkout session expires, is cancelled, or fails.
 * Never alters wallet balance.
 */
export function markPlatanosOrderStatus(
  db: Database.Database,
  stripeSessionIdOrIntentId: string,
  status: 'cancelled' | 'failed',
  reasonDescription?: string
) {
  const tx = db.transaction(() => {
    const order = db
      .prepare(
        'SELECT * FROM platanos_stripe_orders WHERE stripe_session_id = ? OR stripe_payment_intent_id = ?'
      )
      .get(stripeSessionIdOrIntentId, stripeSessionIdOrIntentId) as any;

    if (!order) return { updated: false };
    if (Number(order.credited) === 1 || order.status === 'paid' || order.status === 'refunded') {
      return { updated: false, status: order.status };
    }

    db.prepare(`
      UPDATE platanos_stripe_orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, order.id);

    const idempotencyKey = `stripe_${status}_${order.stripe_session_id}`;
    const existingTx = db
      .prepare('SELECT id FROM platanos_transactions WHERE idempotency_key = ?')
      .get(idempotencyKey);

    if (!existingTx) {
      const wallet = ensureUserWallet(db, order.user_id, order.user_email);
      const txId = `ptx_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO platanos_transactions (
          id, user_id, user_email, type, amount, balance_before, balance_after,
          status, description, reference_type, reference_id, idempotency_key
        ) VALUES (?, ?, ?, 'credit_purchase', 0, ?, ?, ?, ?, 'stripe_order', ?, ?)
      `).run(
        txId,
        order.user_id,
        order.user_email,
        wallet.balance,
        wallet.balance,
        status,
        reasonDescription ||
          (status === 'cancelled'
            ? `Recarga cancelada (${order.platanos_amount} Plátanos)`
            : `Pagamento recusado (${order.platanos_amount} Plátanos)`),
        order.id,
        idempotencyKey
      );
    }

    return { updated: true, status, orderId: order.id };
  });

  return tx.immediate();
}

/**
 * Atomically processes a Stripe refund for a Plátanos order.
 */
export function refundPlatanosOrder(
  db: Database.Database,
  stripeSessionIdOrIntentId: string,
  adminActor?: { id: number; email: string }
) {
  const tx = db.transaction(() => {
    const order = db
      .prepare(
        'SELECT * FROM platanos_stripe_orders WHERE stripe_session_id = ? OR stripe_payment_intent_id = ? OR id = ?'
      )
      .get(stripeSessionIdOrIntentId, stripeSessionIdOrIntentId, stripeSessionIdOrIntentId) as any;

    if (!order) {
      throw new Error('Pedido de Plátanos não encontrado para reembolso');
    }

    const idempotencyKey = `stripe_refund_${order.stripe_session_id}`;
    const existingRefundTx = db
      .prepare('SELECT * FROM platanos_transactions WHERE idempotency_key = ?')
      .get(idempotencyKey) as any;

    if (order.status === 'refunded' || existingRefundTx) {
      const wallet = ensureUserWallet(db, order.user_id, order.user_email);
      return {
        success: true,
        alreadyRefunded: true,
        balanceAfter: wallet.balance,
        orderId: order.id,
      };
    }

    const wallet = ensureUserWallet(db, order.user_id, order.user_email);
    const balanceBefore = Number(wallet.balance);
    const deductAmount = Number(order.credited) === 1 ? Math.min(balanceBefore, Number(order.platanos_amount)) : 0;
    const balanceAfter = Math.max(0, balanceBefore - deductAmount);

    db.prepare(`
      UPDATE platanos_wallets
      SET balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(balanceAfter, order.user_id);

    db.prepare(`
      UPDATE platanos_stripe_orders
      SET status = 'refunded', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order.id);

    const txId = `ptx_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO platanos_transactions (
        id, user_id, user_email, type, amount, balance_before, balance_after,
        status, description, reference_type, reference_id, idempotency_key
      ) VALUES (?, ?, ?, 'refund_debit', ?, ?, ?, 'refunded', ?, 'stripe_order', ?, ?)
    `).run(
      txId,
      order.user_id,
      order.user_email,
      -deductAmount,
      balanceBefore,
      balanceAfter,
      `Estorno de recarga (${order.platanos_amount} Plátanos)`,
      order.id,
      idempotencyKey
    );

    if (adminActor) {
      db.prepare(`
        INSERT INTO platanos_admin_audit_logs (
          admin_user_id, admin_email, action, target_type, target_id, details_json
        ) VALUES (?, ?, 'REFUND_ORDER', 'stripe_order', ?, ?)
      `).run(
        adminActor.id,
        adminActor.email,
        order.id,
        JSON.stringify({
          userId: order.user_id,
          deductedPlatanos: deductAmount,
          balanceBefore,
          balanceAfter,
        })
      );
    }

    return {
      success: true,
      alreadyRefunded: false,
      deducted: deductAmount,
      balanceBefore,
      balanceAfter,
      userId: Number(order.user_id),
      orderId: order.id,
    };
  });

  const res = tx.immediate();
  if (res.userId) {
    syncWalletToFirestore(db, res.userId, '').catch(() => {});
  }
  return res;
}

/**
 * Atomically unlocks a premium itinerary using the user's Plátanos wallet.
 * - Uses db.transaction().immediate() to serialize concurrent requests
 * - Looks up the authoritative price from the database (never trusts frontend price/balance)
 * - Checks if already unlocked (prevents duplicate billing)
 * - Verifies sufficient balance
 * - Subtracts ONLY the exact itinerary price (e.g. 15->0, 30->15, 200->185)
 */
export function purchaseItineraryWithPlatanos(
  db: Database.Database,
  params: {
    userId: number;
    userEmail: string;
    itineraryId: string;
    itineraryTitleFallback?: string;
  }
): {
  success: boolean;
  alreadyUnlocked: boolean;
  itineraryId: string;
  itineraryTitle: string;
  charged: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionId: string;
} {
  const tx = db.transaction(() => {
    const userId = Number(params.userId);
    const cleanEmail = String(params.userEmail || '').trim().toLowerCase();
    const itineraryId = String(params.itineraryId || '').trim();

    if (!userId || !itineraryId) {
      const err: any = new Error('Usuário e roteiro são obrigatórios.');
      err.code = 'INVALID_INPUT';
      throw err;
    }

    const itinRow = db
      .prepare('SELECT id, title, is_premium, platanos_price FROM itineraries WHERE id = ?')
      .get(itineraryId) as { id: string; title: string; is_premium: number; platanos_price: number | null } | undefined;

    const itineraryTitle =
      itinRow?.title || params.itineraryTitleFallback || 'Roteiro Exclusivo';
    const isPremium = itinRow ? Number(itinRow.is_premium) === 1 : true;
    const authoritativePrice = isPremium
      ? itinRow?.platanos_price && Number(itinRow.platanos_price) > 0
        ? Number(itinRow.platanos_price)
        : 15
      : 0;

    const wallet = ensureUserWallet(db, userId, cleanEmail);
    const balanceBefore = Number(wallet.balance);

    // 1. Check if user already unlocked this itinerary
    const existingUnlock = db
      .prepare('SELECT * FROM platanos_itinerary_unlocks WHERE user_id = ? AND itinerary_id = ?')
      .get(userId, itineraryId) as any;

    if (existingUnlock) {
      return {
        success: true,
        alreadyUnlocked: true,
        itineraryId,
        itineraryTitle,
        charged: 0,
        balanceBefore,
        balanceAfter: balanceBefore,
        transactionId: String(existingUnlock.transaction_id),
      };
    }

    // 2. Verify balance is sufficient
    if (balanceBefore < authoritativePrice) {
      const err: any = new Error(
        `Saldo insuficiente. Você possui ${balanceBefore} Plátanos e este roteiro custa ${authoritativePrice} Plátanos.`
      );
      err.code = 'INSUFFICIENT_BALANCE';
      err.balance = balanceBefore;
      err.required = authoritativePrice;
      err.missing = authoritativePrice - balanceBefore;
      throw err;
    }

    // 3. Exact single subtraction: balanceAfter = balanceBefore - authoritativePrice
    const balanceAfter = balanceBefore - authoritativePrice;

    const updateRes = db
      .prepare(`
        UPDATE platanos_wallets
        SET balance = ?, total_spent = total_spent + ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND balance = ?
      `)
      .run(balanceAfter, authoritativePrice, userId, balanceBefore);

    if (updateRes.changes !== 1) {
      const err: any = new Error('Conflito de concorrência ao atualizar saldo. Tente novamente.');
      err.code = 'CONCURRENCY_CONFLICT';
      throw err;
    }

    const txId = `ptx_${crypto.randomUUID()}`;
    const idempotencyKey = `unlock_${userId}_${itineraryId}`;

    db.prepare(`
      INSERT INTO platanos_transactions (
        id, user_id, user_email, type, amount, balance_before, balance_after,
        status, description, reference_type, reference_id, idempotency_key
      ) VALUES (?, ?, ?, 'debit_itinerary', ?, ?, ?, 'completed', ?, 'itinerary_unlock', ?, ?)
    `).run(
      txId,
      userId,
      cleanEmail,
      -authoritativePrice,
      balanceBefore,
      balanceAfter,
      `Roteiro adicionado: ${itineraryTitle}`,
      itineraryId,
      idempotencyKey
    );

    const unlockId = `unl_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO platanos_itinerary_unlocks (
        id, user_id, user_email, itinerary_id, itinerary_title, platanos_paid, transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(unlockId, userId, cleanEmail, itineraryId, itineraryTitle, authoritativePrice, txId);

    try {
      db.prepare('UPDATE itineraries SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = ?').run(
        itineraryId
      );
    } catch {}

    return {
      success: true,
      alreadyUnlocked: false,
      itineraryId,
      itineraryTitle,
      charged: authoritativePrice,
      balanceBefore,
      balanceAfter,
      transactionId: txId,
    };
  });

  const result = tx.immediate();
  syncWalletToFirestore(db, params.userId, params.userEmail).catch(() => {});
  return result;
}

export function registerPlatanosRoutes(
  app: express.Express,
  db: Database.Database,
  getAuthUser: (req: express.Request) => Promise<any> | any,
  _isRequestAdmin?: (req: express.Request) => Promise<boolean>
) {
  async function isStrictAdmin(req: express.Request): Promise<boolean> {
    const user = await getAuthUser(req);
    if (user) {
      return user.role === 'admin' || isPrimaryAdmin(user.email || user.whatsapp || '');
    }
    const headerEmail = String(req.headers['x-user-email'] || '').trim().toLowerCase();
    if (headerEmail && isPrimaryAdmin(headerEmail)) {
      return true;
    }
    return false;
  }
  function getStripeKey(): string {
    const envKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (envKey) return envKey;
    try {
      const row = db
        .prepare("SELECT value FROM system_settings WHERE key = 'stripe_secret_key'")
        .get() as { value?: string } | undefined;
      if (row?.value && row.value.trim()) return row.value.trim();
    } catch {}
    return '';
  }

  function getStripeClient(): Stripe | null {
    const key = getStripeKey();
    if (!key) return null;
    return new Stripe(key);
  }

  async function getStripeClientAsync(): Promise<Stripe | null> {
    const syncClient = getStripeClient();
    if (syncClient) return syncClient;
    try {
      if (supabase) {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'stripe_secret_key')
          .maybeSingle();
        const remoteKey = (data?.value || '').trim();
        if (remoteKey) {
          try {
            db.prepare(
              "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('stripe_secret_key', ?, CURRENT_TIMESTAMP)"
            ).run(remoteKey);
          } catch {}
          return new Stripe(remoteKey);
        }
      }
    } catch {}
    return null;
  }

  async function resolvePlatanosUser(req: express.Request, allowGuestProvision = false): Promise<any | null> {
    const authUser = await getAuthUser(req);
    if (authUser && authUser.id) {
      return authUser;
    }

    const rawCandidate = String(
      req.headers['x-user-email'] ||
        req.body?.userEmail ||
        req.body?.email ||
        req.body?.username ||
        req.query?.email ||
        ''
    )
      .trim()
      .toLowerCase();

    if (rawCandidate) {
      const existing = db
        .prepare(
          'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ? OR LOWER(username) = ?'
        )
        .get(rawCandidate, rawCandidate, rawCandidate.replace(/^@+/, '')) as any;
      if (existing) return existing;

      const emailVal = rawCandidate.includes('@') ? rawCandidate : `${rawCandidate.replace(/[^a-z0-9_]/g, '')}@monvian.com`;
      const unameVal = rawCandidate.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'explorador';
      const roleVal = isPrimaryAdmin(emailVal) ? 'admin' : 'user';
      try {
        const info = db
          .prepare(
            `INSERT INTO users (name, username, email, whatsapp, password_hash, role)
             VALUES (?, ?, ?, ?, 'platanos_auto', ?)`
          )
          .run(unameVal, `${unameVal}_${Date.now().toString().slice(-4)}`, emailVal, emailVal, roleVal);
        const created = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as any;
        if (created) return created;
      } catch {
        const retry = db
          .prepare('SELECT * FROM users WHERE LOWER(email) = ?')
          .get(emailVal) as any;
        if (retry) return retry;
      }
    }

    if (allowGuestProvision) {
      const firstUser = db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get() as any;
      if (firstUser) return firstUser;
      try {
        const info = db
          .prepare(
            `INSERT INTO users (name, username, email, whatsapp, password_hash, role)
             VALUES ('Explorador Monvian', 'explorador', 'explorador@monvian.com', 'explorador@monvian.com', 'guest', 'user')`
          )
          .run();
        return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as any;
      } catch {}
    }

    return null;
  }

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  // 1. Public list of closed Plátanos packages and itinerary prices
  app.get('/api/platanos/packages', (_req, res) => {
    try {
      const packages = getPackagesList(db, false);
      const itineraryPrices = getItineraryPricesMap(db);
      res.json({
        success: true,
        packages,
        itineraryPrices,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao carregar pacotes de Plátanos: ' + err.message });
    }
  });

  // 2. Get authenticated user's Plátanos wallet, unlocked itineraries, and transaction history
  app.get('/api/platanos/wallet', async (req, res) => {
    try {
      const user = await resolvePlatanosUser(req, false);
      if (!user || !user.id) {
        res.json({
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
            packages: getPackagesList(db, false),
            itineraryPrices: getItineraryPricesMap(db),
          },
        });
        return;
      }

      const snapshot = getUserWalletSnapshot(db, Number(user.id), user.email || user.whatsapp || '');
      res.json({
        success: true,
        authenticated: true,
        wallet: snapshot,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao carregar carteira de Plátanos: ' + err.message });
    }
  });

  // 3. Create Stripe Checkout Session for a closed Plátanos package
  app.post('/api/platanos/checkout', async (req, res) => {
    try {
      const user = await resolvePlatanosUser(req, true);
      if (!user || !user.id) {
        res.status(401).json({ error: 'Faça login na sua conta para recarregar Plátanos.' });
        return;
      }

      const packageId = String(req.body?.packageId || '').trim();
      if (!packageId) {
        res.status(400).json({ error: 'Selecione um pacote válido de Plátanos.' });
        return;
      }

      // Strictly look up authoritative package from server database (ignore any client price/amount)
      let pkg = db
        .prepare('SELECT * FROM platanos_packages WHERE id = ? AND is_active = 1')
        .get(packageId) as PlatanoPackageRow | undefined;

      if (!pkg) {
        pkg = INITIAL_PLATANOS_PACKAGES.find((p) => p.id === packageId);
      }

      if (!pkg) {
        res.status(400).json({ error: 'Pacote de Plátanos não encontrado ou indisponível.' });
        return;
      }

      const cleanEmail = (user.email || user.whatsapp || '').trim().toLowerCase();
      const isValidEmail = cleanEmail.includes('@') && cleanEmail.includes('.');
      const host = req.get('host') || 'localhost:3000';
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      const origin = process.env.APP_URL || `${protocol}://${host}`;
      const stripeClient = await getStripeClientAsync();

      if (!stripeClient) {
        res.status(503).json({
          error: 'Integração Stripe aguardando configuração da chave secreta (STRIPE_SECRET_KEY) no servidor.',
        });
        return;
      }

      ensureUserWallet(db, Number(user.id), cleanEmail);

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
              unit_amount: Number(pkg.price_cents),
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
          amountCents: String(pkg.price_cents),
          userId: String(user.id),
          userEmail: cleanEmail,
        },
        payment_intent_data: {
          metadata: {
            type: 'platanos_topup',
            packageId: pkg.id,
            platanosAmount: String(pkg.platanos),
            amountCents: String(pkg.price_cents),
            userId: String(user.id),
            userEmail: cleanEmail,
          },
        },
        success_url: `${origin}/?platanos_payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?platanos_payment=cancelled&package_id=${encodeURIComponent(pkg.id)}`,
      });

      const orderId = `ord_${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO platanos_stripe_orders (
          id, user_id, user_email, package_id, platanos_amount, amount_cents,
          currency, stripe_session_id, status, credited, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, 'brl', ?, 'pending', 0, ?)
      `).run(
        orderId,
        Number(user.id),
        cleanEmail,
        pkg.id,
        Number(pkg.platanos),
        Number(pkg.price_cents),
        session.id,
        JSON.stringify({ checkoutUrl: session.url })
      );

      res.json({
        success: true,
        orderId,
        sessionId: session.id,
        url: session.url,
        package: {
          id: pkg.id,
          platanos: pkg.platanos,
          priceCents: pkg.price_cents,
          priceBRL: pkg.price_brl || formatCentsToBRL(pkg.price_cents),
        },
      });
    } catch (err: any) {
      console.error('[Plátanos Checkout] Error:', err);
      res.status(500).json({
        error: 'Erro ao criar sessão de pagamento no Stripe: ' + (err.message || 'Tente novamente.'),
      });
    }
  });

  // 4. Dedicated Stripe Webhook for Plátanos (with HMAC signature verification)
  app.post('/api/platanos/webhook', async (req: any, res) => {
    const sig = req.headers['stripe-signature'];
    const rawBody = req.rawBody;

    let event: Stripe.Event;
    try {
      const stripeClient = getStripeClient();
      if (stripeWebhookSecret) {
        if (!sig || !rawBody) {
          res.status(400).json({ error: 'Assinatura do webhook ausente.' });
          return;
        }
        if (stripeClient) {
          event = stripeClient.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
        } else {
          const tempStripe = new Stripe('sk_test_webhook_verifier');
          event = tempStripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
        }
      } else {
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (err: any) {
      console.error('[Plátanos Webhook] Falha na validação de assinatura:', err.message);
      res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      return;
    }

    try {
      const result = handlePlatanosStripeWebhookEvent(db, event);
      res.json({ received: true, ...result });
    } catch (err: any) {
      console.error('[Plátanos Webhook] Erro ao processar evento:', err);
      res.status(400).json({ error: err.message || 'Erro ao processar webhook' });
    }
  });

  // 5. Verify Session Status on Return (queries DB first; if still pending, verifies directly with Stripe API)
  app.get('/api/platanos/verify-session', async (req, res) => {
    try {
      const sessionId = String(req.query.session_id || '').trim();
      if (!sessionId) {
        res.status(400).json({ error: 'session_id é obrigatório.' });
        return;
      }

      const existingOrder = db
        .prepare('SELECT * FROM platanos_stripe_orders WHERE stripe_session_id = ?')
        .get(sessionId) as any;

      if (existingOrder && Number(existingOrder.credited) === 1 && existingOrder.status === 'paid') {
        const wallet = getUserWalletSnapshot(db, existingOrder.user_id, existingOrder.user_email);
        res.json({
          success: true,
          status: 'paid',
          creditedAmount: Number(existingOrder.platanos_amount),
          wallet,
        });
        return;
      }

      // Query Stripe API directly to verify real payment status
      const stripeClient = await getStripeClientAsync();
      if (stripeClient) {
        const session = await stripeClient.checkout.sessions.retrieve(sessionId);
        if (
          session &&
          session.metadata?.type === 'platanos_topup' &&
          session.payment_status === 'paid'
        ) {
          const creditRes = creditPlatanosFromStripeOrder(db, {
            stripeSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
            userId: session.metadata?.userId ? parseInt(session.metadata.userId, 10) : existingOrder?.user_id,
            userEmail: session.metadata?.userEmail || existingOrder?.user_email || '',
            packageId: session.metadata?.packageId || existingOrder?.package_id,
            amountTotalCents: session.amount_total ?? undefined,
          });
          const wallet = getUserWalletSnapshot(db, creditRes.userId, existingOrder?.user_email || '');
          res.json({
            success: true,
            status: 'paid',
            creditedAmount: creditRes.creditedAmount,
            alreadyCredited: creditRes.alreadyCredited,
            wallet,
          });
          return;
        }

        if (session && (session.status as string) === 'expired') {
          markPlatanosOrderStatus(db, session.id, 'cancelled', 'Sessão de checkout expirada');
          res.json({
            success: false,
            status: 'cancelled',
            message: 'A sessão de pagamento expirou.',
          });
          return;
        }
      }

      res.json({
        success: false,
        status: existingOrder?.status || 'pending',
        message: 'Pagamento aguardando confirmação do Stripe.',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao verificar sessão: ' + err.message });
    }
  });

  // 6. Mark Pending Order Cancelled When User Cancels Checkout
  app.post('/api/platanos/cancel-order', async (req, res) => {
    try {
      const user = await resolvePlatanosUser(req, true);
      if (!user || !user.id) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
      }
      const sessionId = String(req.body?.sessionId || '').trim();
      const packageId = String(req.body?.packageId || '').trim();

      let targetSessionId = sessionId;
      if (!targetSessionId && packageId) {
        const latestPending = db
          .prepare(
            `SELECT stripe_session_id FROM platanos_stripe_orders
             WHERE user_id = ? AND package_id = ? AND status = 'pending' AND credited = 0
             ORDER BY created_at DESC, rowid DESC LIMIT 1`
          )
          .get(user.id, packageId) as { stripe_session_id?: string } | undefined;
        if (latestPending?.stripe_session_id) {
          targetSessionId = latestPending.stripe_session_id;
        }
      }

      if (targetSessionId) {
        markPlatanosOrderStatus(db, targetSessionId, 'cancelled', 'Checkout cancelado pelo usuário');
      }

      const wallet = getUserWalletSnapshot(db, Number(user.id), user.email || '');
      res.json({ success: true, wallet });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Purchase / Unlock Premium Itinerary with Plátanos
  app.post('/api/platanos/purchase-itinerary', async (req, res) => {
    try {
      const user = await resolvePlatanosUser(req, true);
      if (!user || !user.id) {
        res.status(401).json({
          success: false,
          code: 'UNAUTHENTICATED',
          error: 'Faça login na sua conta para adicionar este roteiro com Plátanos.',
        });
        return;
      }

      const itineraryId = String(req.body?.itineraryId || '').trim();
      const itineraryTitle = String(req.body?.itineraryTitle || '').trim();

      if (!itineraryId) {
        res.status(400).json({
          success: false,
          code: 'INVALID_INPUT',
          error: 'ID do roteiro é obrigatório.',
        });
        return;
      }

      const result = purchaseItineraryWithPlatanos(db, {
        userId: Number(user.id),
        userEmail: user.email || user.whatsapp || '',
        itineraryId,
        itineraryTitleFallback: itineraryTitle,
      });

      const wallet = getUserWalletSnapshot(db, Number(user.id), user.email || user.whatsapp || '');

      res.json({
        ...result,
        wallet,
      });
    } catch (err: any) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        res.status(402).json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          error: err.message,
          balance: err.balance,
          required: err.required,
          missing: err.missing,
        });
        return;
      }
      res.status(400).json({
        success: false,
        code: err.code || 'PURCHASE_FAILED',
        error: err.message || 'Não foi possível concluir a compra do roteiro.',
      });
    }
  });

  // ===========================================================================
  // 8. ADMIN ROUTES FOR PLÁTANOS MANAGEMENT & AUDIT
  // ===========================================================================
  app.get('/api/admin/platanos/overview', async (req, res) => {
    try {
      const isAdmin = await isStrictAdmin(req);
      if (!isAdmin) {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return;
      }

      const packages = getPackagesList(db, true);
      const itineraries = db
        .prepare(
          'SELECT id, title, is_premium, platanos_price, price, usage_count, status FROM itineraries ORDER BY sort_order ASC, title ASC'
        )
        .all()
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          isPremium: Number(r.is_premium) === 1,
          platanosPrice: Number(r.is_premium) === 1 ? Number(r.platanos_price || 15) : 0,
          usageCount: Number(r.usage_count || 0),
          status: r.status || 'published',
        }));

      const wallets = db
        .prepare(`
          SELECT w.*, u.name as user_name
          FROM platanos_wallets w
          LEFT JOIN users u ON u.id = w.user_id
          ORDER BY w.balance DESC, w.updated_at DESC
          LIMIT 200
        `)
        .all();

      const transactions = db
        .prepare(`
          SELECT t.*, u.name as user_name
          FROM platanos_transactions t
          LEFT JOIN users u ON u.id = t.user_id
          ORDER BY t.created_at DESC, t.rowid DESC
          LIMIT 200
        `)
        .all();

      const orders = db
        .prepare(`
          SELECT o.*, u.name as user_name
          FROM platanos_stripe_orders o
          LEFT JOIN users u ON u.id = o.user_id
          ORDER BY o.created_at DESC, o.rowid DESC
          LIMIT 200
        `)
        .all();

      const unlocks = db
        .prepare(`
          SELECT u.*, usr.name as user_name
          FROM platanos_itinerary_unlocks u
          LEFT JOIN users usr ON usr.id = u.user_id
          ORDER BY u.created_at DESC, u.rowid DESC
          LIMIT 200
        `)
        .all();

      const auditLogs = db
        .prepare(`
          SELECT * FROM platanos_admin_audit_logs
          ORDER BY id DESC
          LIMIT 100
        `)
        .all();

      const statsRow = db
        .prepare(`
          SELECT
            COALESCE(SUM(balance), 0) as totalCirculation,
            COALESCE(SUM(total_credited), 0) as totalCredited,
            COALESCE(SUM(total_spent), 0) as totalSpent,
            COUNT(*) as totalWallets
          FROM platanos_wallets
        `)
        .get() as any;

      const revenueRow = db
        .prepare(`
          SELECT
            COALESCE(SUM(amount_cents), 0) as revenueCents,
            COUNT(*) as paidOrdersCount
          FROM platanos_stripe_orders
          WHERE status = 'paid' AND credited = 1
        `)
        .get() as any;

      const parseDbTimestamp = (ts: string | null | undefined): number => {
        if (!ts) return NaN;
        const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
        const parsed = Date.parse(normalized);
        return Number.isNaN(parsed) ? Date.parse(ts) : parsed;
      };

      const allTx90d = db
        .prepare(`
          SELECT amount, type, status, created_at
          FROM platanos_transactions
          WHERE created_at IS NOT NULL AND datetime(created_at) >= datetime('now', '-90 days')
        `)
        .all() as Array<{ amount: number; type: string; status: string; created_at: string }>;

      const allPaidOrders90d = db
        .prepare(`
          SELECT amount_cents, platanos_amount, created_at
          FROM platanos_stripe_orders
          WHERE status = 'paid' AND credited = 1 AND created_at IS NOT NULL AND datetime(created_at) >= datetime('now', '-90 days')
        `)
        .all() as Array<{ amount_cents: number; platanos_amount: number; created_at: string }>;

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

          for (const tx of allTx90d) {
            if (tx.status === 'cancelled' || tx.status === 'failed') continue;
            const t = parseDbTimestamp(tx.created_at);
            if (Number.isNaN(t) || t <= startMs || t > endMs) continue;
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

          let revenueCents = 0;
          let paymentsCount = 0;

          for (const ord of allPaidOrders90d) {
            const t = parseDbTimestamp(ord.created_at);
            if (Number.isNaN(t) || t <= startMs || t > endMs) continue;
            revenueCents += Number(ord.amount_cents) || 0;
            paymentsCount += 1;
          }

          const dd = String(endDate.getDate()).padStart(2, '0');
          const mm = String(endDate.getMonth() + 1).padStart(2, '0');
          buckets.push({
            label: daysWindow === 7 ? dayNames[endDate.getDay()] : `${dd}/${mm}`,
            fullLabel: `${dd}/${mm}`,
            revenueCents,
            revenueReais: Number((revenueCents / 100).toFixed(2)),
            paymentsCount,
          });
        }

        return buckets;
      };

      const perf7d = buildPerformanceSeries(7);
      const rev7d = buildStripeRevenueSeries(7);

      // Compute real historical deltas (last 30d vs prior 30d) ONLY when prior period has non-zero baseline
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

      for (const tx of allTx90d) {
        if (tx.status === 'cancelled' || tx.status === 'failed') continue;
        const t = parseDbTimestamp(tx.created_at);
        if (Number.isNaN(t)) continue;
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
      for (const ord of allPaidOrders90d) {
        const t = parseDbTimestamp(ord.created_at);
        if (Number.isNaN(t)) continue;
        const c = Number(ord.amount_cents) || 0;
        if (t >= d30Ms) revCur += c;
        else if (t >= d60Ms && t < d30Ms) revPrev += c;
      }

      res.json({
        success: true,
        stats: {
          totalCirculation: Number(statsRow?.totalCirculation || 0),
          totalCredited: Number(statsRow?.totalCredited || 0),
          totalSpent: Number(statsRow?.totalSpent || 0),
          totalWallets: Number(statsRow?.totalWallets || 0),
          revenueCents: Number(revenueRow?.revenueCents || 0),
          revenueBRL: formatCentsToBRL(Number(revenueRow?.revenueCents || 0)),
          paidOrdersCount: Number(revenueRow?.paidOrdersCount || 0),
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
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao carregar painel Plátanos: ' + err.message });
    }
  });

  // Update package price / platanos / badge (Admin + Audit Log)
  app.put('/api/admin/platanos/packages/:id', async (req, res) => {
    try {
      const isAdmin = await isStrictAdmin(req);
      if (!isAdmin) {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return;
      }

      const adminUser = (await getAuthUser(req)) || { id: 1, email: 'admin@monvian.com' };
      const pkgId = String(req.params.id || '').trim();
      const platanos = Number(req.body?.platanos);
      const priceCents = Number(req.body?.priceCents);
      const badge = String(req.body?.badge ?? '').trim();
      const isActive = req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : 1;

      if (!pkgId || !Number.isInteger(platanos) || platanos <= 0 || !Number.isInteger(priceCents) || priceCents < 100) {
        res.status(400).json({ error: 'Quantidade de Plátanos e preço em centavos (>= 100) devem ser inteiros válidos.' });
        return;
      }

      const priceBRL = formatCentsToBRL(priceCents);
      db.prepare(`
        UPDATE platanos_packages
        SET platanos = ?, price_cents = ?, price_brl = ?, badge = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(platanos, priceCents, priceBRL, badge, isActive, pkgId);

      db.prepare(`
        INSERT INTO platanos_admin_audit_logs (
          admin_user_id, admin_email, action, target_type, target_id, details_json
        ) VALUES (?, ?, 'UPDATE_PACKAGE', 'package', ?, ?)
      `).run(
        adminUser.id || 1,
        adminUser.email || 'admin@monvian.com',
        pkgId,
        JSON.stringify({ platanos, priceCents, priceBRL, badge, isActive })
      );

      res.json({
        success: true,
        packages: getPackagesList(db, true),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar pacote: ' + err.message });
    }
  });

  // Update itinerary Plátanos price (Admin + Audit Log)
  app.put('/api/admin/platanos/itineraries/:id/price', async (req, res) => {
    try {
      const isAdmin = await isStrictAdmin(req);
      if (!isAdmin) {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return;
      }

      const adminUser = (await getAuthUser(req)) || { id: 1, email: 'admin@monvian.com' };
      const itineraryId = String(req.params.id || '').trim();
      const platanosPrice = Number(req.body?.platanosPrice);
      const isPremium = req.body?.isPremium !== undefined ? (req.body.isPremium ? 1 : 0) : platanosPrice > 0 ? 1 : 0;

      if (!itineraryId || !Number.isInteger(platanosPrice) || platanosPrice < 0) {
        res.status(400).json({ error: 'Preço em Plátanos inválido.' });
        return;
      }

      db.prepare(`
        UPDATE itineraries
        SET platanos_price = ?, is_premium = ?, price = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        isPremium ? platanosPrice : 0,
        isPremium,
        isPremium ? `${platanosPrice} Plátanos` : 'Grátis',
        itineraryId
      );

      db.prepare(`
        INSERT INTO platanos_admin_audit_logs (
          admin_user_id, admin_email, action, target_type, target_id, details_json
        ) VALUES (?, ?, 'UPDATE_ITINERARY_PRICE', 'itinerary', ?, ?)
      `).run(
        adminUser.id || 1,
        adminUser.email || 'admin@monvian.com',
        itineraryId,
        JSON.stringify({ platanosPrice: isPremium ? platanosPrice : 0, isPremium })
      );

      res.json({
        success: true,
        itineraryPrices: getItineraryPricesMap(db),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar preço do roteiro: ' + err.message });
    }
  });

  // Admin Manual Audited Balance Adjustment
  app.post('/api/admin/platanos/wallets/:userId/adjust', async (req, res) => {
    try {
      const isAdmin = await isStrictAdmin(req);
      if (!isAdmin) {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return;
      }

      const adminUser = (await getAuthUser(req)) || { id: 1, email: 'admin@monvian.com' };
      const targetUserId = Number(req.params.userId);
      const delta = Number(req.body?.delta);
      const reason = String(req.body?.reason || 'Ajuste administrativo').trim();

      if (!targetUserId || !Number.isInteger(delta) || delta === 0) {
        res.status(400).json({ error: 'Informe uma quantidade inteira diferente de zero para o ajuste.' });
        return;
      }

      const userRow = db.prepare('SELECT id, email, whatsapp FROM users WHERE id = ?').get(targetUserId) as any;
      const userEmail = userRow?.email || userRow?.whatsapp || `user_${targetUserId}`;

      const tx = db.transaction(() => {
        const wallet = ensureUserWallet(db, targetUserId, userEmail);
        const balanceBefore = Number(wallet.balance);
        const balanceAfter = balanceBefore + delta;
        if (balanceAfter < 0) {
          throw new Error(`O ajuste deixaria o saldo negativo (${balanceAfter}). Saldo atual: ${balanceBefore}`);
        }

        db.prepare(`
          UPDATE platanos_wallets
          SET
            balance = ?,
            total_credited = total_credited + ?,
            total_spent = total_spent + ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          balanceAfter,
          delta > 0 ? delta : 0,
          delta < 0 ? Math.abs(delta) : 0,
          targetUserId
        );

        const txId = `ptx_${crypto.randomUUID()}`;
        db.prepare(`
          INSERT INTO platanos_transactions (
            id, user_id, user_email, type, amount, balance_before, balance_after,
            status, description, reference_type, reference_id, idempotency_key
          ) VALUES (?, ?, ?, 'admin_adjustment', ?, ?, ?, 'completed', ?, 'admin', ?, ?)
        `).run(
          txId,
          targetUserId,
          userEmail,
          delta,
          balanceBefore,
          balanceAfter,
          reason,
          String(adminUser.id || 1),
          `admin_adj_${txId}`
        );

        db.prepare(`
          INSERT INTO platanos_admin_audit_logs (
            admin_user_id, admin_email, action, target_type, target_id, details_json
          ) VALUES (?, ?, 'ADJUST_WALLET_BALANCE', 'wallet', ?, ?)
        `).run(
          adminUser.id || 1,
          adminUser.email || 'admin@monvian.com',
          String(targetUserId),
          JSON.stringify({ delta, balanceBefore, balanceAfter, reason })
        );

        return { balanceBefore, balanceAfter, txId };
      });

      const out = tx.immediate();
      syncWalletToFirestore(db, targetUserId, userEmail).catch(() => {});
      res.json({ success: true, ...out });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Refund Order
  app.post('/api/admin/platanos/orders/:sessionId/refund', async (req, res) => {
    try {
      const isAdmin = await isStrictAdmin(req);
      if (!isAdmin) {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return;
      }

      const adminUser = (await getAuthUser(req)) || { id: 1, email: 'admin@monvian.com' };
      const sessionId = String(req.params.sessionId || '').trim();
      const result = refundPlatanosOrder(db, sessionId, {
        id: adminUser.id || 1,
        email: adminUser.email || 'admin@monvian.com',
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}

/**
 * Shared Stripe Webhook event processor for Plátanos events.
 * Can be called from both `/api/platanos/webhook` and `/api/stripe/webhook`.
 */
export function handlePlatanosStripeWebhookEvent(db: Database.Database, event: Stripe.Event) {
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const isPlatanos =
      session.metadata?.type === 'platanos_topup' ||
      Boolean(
        db
          .prepare('SELECT id FROM platanos_stripe_orders WHERE stripe_session_id = ?')
          .get(session.id)
      );

    if (!isPlatanos) {
      return { handled: false };
    }

    if (session.payment_status !== 'paid') {
      return { handled: true, status: 'pending_payment' };
    }

    const userIdStr = session.metadata?.userId || session.client_reference_id;
    let userId = userIdStr ? parseInt(userIdStr, 10) : 0;
    const userEmail = (
      session.metadata?.userEmail ||
      session.customer_email ||
      session.customer_details?.email ||
      ''
    )
      .trim()
      .toLowerCase();

    if (!userId && userEmail) {
      const u = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?')
        .get(userEmail, userEmail) as { id: number } | undefined;
      if (u) userId = u.id;
    }

    const creditRes = creditPlatanosFromStripeOrder(db, {
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
      userId,
      userEmail,
      packageId: session.metadata?.packageId,
      amountTotalCents: session.amount_total ?? undefined,
    });

    return { handled: true, ...creditRes };
  }

  if (
    event.type === 'checkout.session.expired' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const status = event.type === 'checkout.session.expired' ? 'cancelled' : 'failed';
    const res = markPlatanosOrderStatus(
      db,
      session.id,
      status,
      status === 'cancelled'
        ? 'Sessão de checkout expirada no Stripe'
        : 'Falha no pagamento assíncrono do Stripe'
    );
    return { handled: res.updated, ...res };
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const sessionIdFromMeta = (pi.metadata as any)?.sessionId;
    const res = markPlatanosOrderStatus(
      db,
      sessionIdFromMeta || pi.id,
      'failed',
      pi.last_payment_error?.message || 'Pagamento recusado pelo emissor do cartão'
    );
    return { handled: res.updated, ...res };
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : '';
    if (piId) {
      try {
        const res = refundPlatanosOrder(db, piId);
        return { handled: true, ...res };
      } catch {
        return { handled: false };
      }
    }
  }

  return { handled: false };
}
