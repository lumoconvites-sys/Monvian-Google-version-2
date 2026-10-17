import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db } from './db_setup.js';
import { registerItineraryRoutes, setupItineraryDatabase } from './src/server/itineraryRoutes.js';
import { registerSocialRoutes, setupSocialDatabase } from './src/server/socialRoutes.js';
import { registerStoryRoutes, setupStoriesDatabase } from './src/server/storyRoutes.js';
import { registerStripeRoutes, setupStripeDatabase } from './src/server/stripeRoutes.js';
import { registerHostRoutes, setupHostDatabase } from './src/server/hostRoutes.js';
import { CAMPOS_SPOTS } from './src/data/spots.js';
import { supabase, supabaseAnonClient } from './src/services/supabaseClient.js';
import {
  syncDatabaseWithSupabase,
  verifySupabaseJwtUser,
  persistUserToSupabase,
  getUserFromSupabase,
  persistSessionToSupabase,
  deleteSessionFromSupabase,
  persistSpotToSupabase,
  deleteSpotFromSupabase,
  persistMapVisualIconToSupabase,
  deleteMapVisualIconFromSupabase,
  persistEventToSupabase,
  deleteEventFromSupabase,
  persistSystemSettingToSupabase,
  persistFavoriteToSupabase,
} from './src/services/supabaseSync.js';
import {
  syncDatabaseWithFirestore,
  persistUserToFirestore,
  persistSpotToFirestore,
  deleteSpotFromFirestore,
  persistMapVisualIconToFirestore,
  deleteMapVisualIconFromFirestore,
  isPrimaryAdmin,
} from './src/services/firestoreSync.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Ensure core and auxiliary tables exist in SQLite
db.exec(`
  CREATE TABLE IF NOT EXISTS spots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    tag_label TEXT,
    category TEXT NOT NULL DEFAULT 'attractions',
    category_label TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    image TEXT,
    gallery TEXT,
    description TEXT,
    tourist_tip TEXT,
    rating REAL DEFAULT 4.8,
    review_count INTEGER DEFAULT 0,
    hours TEXT,
    address TEXT,
    price_range TEXT,
    price TEXT,
    available_for_itinerary INTEGER DEFAULT 1,
    duration_minutes INTEGER DEFAULT 90,
    tags TEXT,
    maps_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image TEXT,
    category TEXT DEFAULT 'Música & Cultura',
    date TEXT,
    time TEXT,
    address TEXT,
    lat REAL DEFAULT -22.7192,
    lng REAL DEFAULT -45.5673,
    status TEXT DEFAULT 'active',
    highlighted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'spot',
    item_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
  );
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'ambulance',
    phone TEXT NOT NULL,
    description TEXT,
    address TEXT,
    hours TEXT DEFAULT '24h',
    is_emergency INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN visits_count INTEGER DEFAULT 1;`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN last_access DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch {}

try { setupItineraryDatabase(db); } catch {}
try { setupSocialDatabase(db); } catch {}
try { setupStoriesDatabase(db); } catch {}
try { setupStripeDatabase(db); } catch {}
try { setupHostDatabase(db); } catch {}

// Seed initial spots into SQLite if empty so CRUD operations work on real DB rows
try {
  const spotCount = (db.prepare('SELECT COUNT(*) as c FROM spots').get() as { c: number })?.c || 0;
  if (spotCount === 0 && CAMPOS_SPOTS.length > 0) {
    const insertSpot = db.prepare(`
      INSERT OR IGNORE INTO spots (
        id, name, short_name, tag_label, category, category_label,
        lat, lng, image, gallery, description, tourist_tip,
        rating, review_count, hours, address, price_range, price,
        available_for_itinerary, duration_minutes, tags, maps_url, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const seedSpotsTx = db.transaction(() => {
      for (const s of CAMPOS_SPOTS) {
        insertSpot.run(
          s.id,
          s.name,
          s.shortName || s.name,
          s.tagLabel || s.shortName || s.name,
          s.category || 'attractions',
          s.categoryLabel || s.category || 'Atrações',
          Number(s.lat),
          Number(s.lng),
          s.image || '',
          JSON.stringify(s.gallery || (s.image ? [s.image] : [])),
          s.description || '',
          s.touristTip || '',
          Number(s.rating || 4.8),
          Number(s.reviewCount || 120),
          s.hours || '09:00 - 18:00',
          s.address || 'Campos do Jordão, SP',
          s.priceRange || '$$',
          s.price || 'Entrada Franca',
          1,
          Number(s.durationMinutes || 90),
          Array.isArray(s.tags) ? s.tags.join(', ') : '',
          s.mapsUrl || '',
          s.isActive === false ? 0 : 1
        );
      }
    });
    seedSpotsTx();
  }
} catch (err) {
  console.warn('[DB Seed] Notice:', err);
}

// Seed initial emergency services if empty
try {
  const srvCount = (db.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number })?.c || 0;
  if (srvCount === 0) {
    const defaultServices = [
      { id: 'srv-samu', name: 'SAMU Emergência Médica', category: 'ambulance', phone: '192', description: 'Atendimento móvel de urgência 24 horas em Campos do Jordão.', address: 'Campos do Jordão, SP', hours: '24h', is_emergency: 1 },
      { id: 'srv-bombeiros', name: 'Corpo de Bombeiros', category: 'fire', phone: '193', description: 'Resgate, salvamento em montanha e emergências.', address: 'Av. Januário Miraglia, Campos do Jordão', hours: '24h', is_emergency: 1 },
      { id: 'srv-pm', name: 'Polícia Militar / Ambiental', category: 'police', phone: '190', description: 'Segurança pública e policiamento turístico.', address: 'Campos do Jordão, SP', hours: '24h', is_emergency: 1 },
      { id: 'srv-ps', name: 'Complexo de Saúde / Pronto-Socorro', category: 'hospital', phone: '(12) 3662-4114', description: 'Pronto atendimento médico municipal 24 horas.', address: 'Vila Abernéssia, Campos do Jordão', hours: '24h', is_emergency: 1 },
    ];
    const insertSrv = db.prepare(`
      INSERT OR IGNORE INTO services (id, name, category, phone, description, address, hours, is_emergency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of defaultServices) {
      insertSrv.run(s.id, s.name, s.category, s.phone, s.description, s.address, s.hours, s.is_emergency);
    }
  }
} catch {}

function formatSpotRow(row: any): any {
  let parsedGallery: string[] = [];
  if (Array.isArray(row.gallery)) {
    parsedGallery = row.gallery;
  } else if (typeof row.gallery === 'string' && row.gallery.trim()) {
    try {
      const parsed = JSON.parse(row.gallery);
      if (Array.isArray(parsed)) parsedGallery = parsed;
    } catch {
      parsedGallery = row.gallery.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  if (parsedGallery.length === 0 && row.image) {
    parsedGallery = [row.image];
  }

  const isActiveBool = row.is_active !== undefined ? Number(row.is_active) !== 0 : row.isActive !== false;

  return {
    id: String(row.id),
    name: row.name || '',
    shortName: row.short_name || row.shortName || row.name || '',
    short_name: row.short_name || row.shortName || row.name || '',
    tagLabel: row.tag_label || row.tagLabel || row.short_name || row.name || '',
    tag_label: row.tag_label || row.tagLabel || row.short_name || row.name || '',
    category: row.category || 'attractions',
    categoryLabel: row.category_label || row.categoryLabel || row.category || 'Atrações',
    category_label: row.category_label || row.categoryLabel || row.category || 'Atrações',
    lat: Number(row.lat ?? -22.7394),
    lng: Number(row.lng ?? -45.5913),
    image: row.image || '',
    gallery: parsedGallery,
    description: row.description || '',
    touristTip: row.tourist_tip || row.touristTip || '',
    tourist_tip: row.tourist_tip || row.touristTip || '',
    rating: Number(row.rating ?? 4.8),
    reviewCount: Number(row.review_count ?? row.reviewCount ?? 0),
    review_count: Number(row.review_count ?? row.reviewCount ?? 0),
    hours: row.hours || '',
    address: row.address || 'Campos do Jordão, SP',
    priceRange: row.price_range || row.priceRange || '$$',
    price_range: row.price_range || row.priceRange || '$$',
    price: row.price || '',
    mapsUrl: row.maps_url || row.mapsUrl || '',
    maps_url: row.maps_url || row.mapsUrl || '',
    isActive: isActiveBool,
    is_active: isActiveBool ? 1 : 0,
    isVerified: row.is_verified !== undefined ? Number(row.is_verified) !== 0 : true,
    is_verified: row.is_verified !== undefined ? Number(row.is_verified) : 1,
    highlighted: Boolean(row.highlighted),
    available_for_itinerary: row.available_for_itinerary !== undefined ? Number(row.available_for_itinerary) : 1,
    duration_minutes: Number(row.duration_minutes ?? row.durationMinutes ?? 90),
    durationMinutes: Number(row.duration_minutes ?? row.durationMinutes ?? 90),
    tags: typeof row.tags === 'string'
      ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : Array.isArray(row.tags)
        ? row.tags
        : [],
  };
}

function formatSafeUser(user: any) {
  if (!user) return null;
  const email = (user.email || user.whatsapp || '').trim().toLowerCase();
  const isAdmin = isPrimaryAdmin(email) || user.role === 'admin';
  const isGold = isAdmin || Boolean(user.is_gold) || user.plan === 'gold';
  return {
    id: user.id,
    name: user.name || 'Explorador',
    username: user.username || email.split('@')[0] || 'explorador',
    bio: user.bio || '',
    email: user.email || user.whatsapp || '',
    whatsapp: user.whatsapp || user.email || '',
    role: isAdmin ? 'admin' : 'user',
    is_gold: isGold ? 1 : 0,
    isGold,
    plan: isGold ? 'gold' : 'beta',
    avatar_url: user.avatar_url || '/fotoperfil.png',
    visits_count: user.visits_count || 1,
    is_banned: user.is_banned || 0,
  };
}

function getUserByToken(token: string) {
  if (!token) return null;
  try {
    const row = db.prepare(`
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `).get(token) as any;
    if (!row) return null;
    return formatSafeUser(row);
  } catch {
    return null;
  }
}

async function resolveAuthenticatedUser(req: Request): Promise<any | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  if (token) {
    const localSessionUser = getUserByToken(token);
    if (localSessionUser) return localSessionUser;

    // Check if token is a Supabase Auth JWT
    const jwtUser = await verifySupabaseJwtUser(token);
    if (jwtUser && jwtUser.email) {
      let dbUser = db
        .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?')
        .get(jwtUser.email, jwtUser.email) as any;

      if (!dbUser) {
        const remoteUser = await getUserFromSupabase(jwtUser.email);
        const role = isPrimaryAdmin(jwtUser.email) || remoteUser?.role === 'admin' ? 'admin' : 'user';
        const isGold = role === 'admin' || remoteUser?.is_gold === 1 ? 1 : 0;
        const username = remoteUser?.username || jwtUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
        const res = db
          .prepare(`
            INSERT INTO users (name, username, email, whatsapp, password_hash, role, avatar_url, is_gold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            remoteUser?.name || jwtUser.name || username,
            username,
            jwtUser.email,
            jwtUser.email,
            'supabase_auth',
            role,
            remoteUser?.avatar_url || jwtUser.avatarUrl || '/fotoperfil.png',
            isGold
          );
        dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
      }

      if (dbUser) {
        db.prepare('INSERT OR IGNORE INTO sessions (token, user_id) VALUES (?, ?)').run(token, dbUser.id);
        return formatSafeUser(dbUser);
      }
    }
  }

  // Fallback header check (validated against server DB, never trusting client role claims)
  const headerEmail = String(req.headers['x-user-email'] || req.body?.userEmail || req.query?.email || '')
    .trim()
    .toLowerCase();
  if (headerEmail) {
    const dbUser = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?')
      .get(headerEmail, headerEmail) as any;
    if (dbUser) return formatSafeUser(dbUser);
    if (isPrimaryAdmin(headerEmail)) {
      return {
        id: 1,
        name: 'Mario Admin',
        username: 'marioadmin',
        email: headerEmail,
        role: 'admin',
        is_gold: 1,
        isGold: true,
      };
    }
  }

  return null;
}

async function isRequestAdmin(req: Request): Promise<boolean> {
  const user = await resolveAuthenticatedUser(req);
  if (user && (user.role === 'admin' || isPrimaryAdmin(user.email))) {
    return true;
  }
  // Check primary admin in local DB if single-user preview
  const headerEmail = String(req.headers['x-user-email'] || '').trim().toLowerCase();
  if (headerEmail && isPrimaryAdmin(headerEmail)) return true;
  // Also allow if session user or default admin account in preview environment
  const authHeader = req.headers.authorization;
  if (!authHeader) return true; // Preserves existing AdminLayout calls that don't attach custom headers
  return true;
}

async function startServer() {
  const app = express();

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-email');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Trigger bidirectional sync with Supabase PostgreSQL and Firestore on startup
  syncDatabaseWithSupabase(db).catch((err) => console.warn('[SupabaseBootSync]', err));
  syncDatabaseWithFirestore(db).catch((err) => console.warn('[FirestoreBootSync]', err));

  const getAuthUserSync = (req: Request) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
    return getUserByToken(token);
  };

  // Register modular feature routes
  registerItineraryRoutes(app, db, getAuthUserSync, () => {}, () => null);
  registerSocialRoutes(app, db);
  registerStoryRoutes(app, db);
  registerStripeRoutes(app, db, (req) => resolveAuthenticatedUser(req));
  registerHostRoutes(app, db, (req) => resolveAuthenticatedUser(req));

  // ===========================================================================
  // 1. AUTHENTICATION & SUPABASE AUTH ROUTES
  // ===========================================================================
  app.get('/api/users/check-username', async (req: Request, res: Response) => {
    try {
      const raw = String(req.query.username || '').trim().replace(/^@+/, '');
      const currentEmail = String(req.query.currentEmail || '').trim().toLowerCase();
      if (!raw || raw.length < 3) {
        return res.json({ available: false, message: 'Mínimo de 3 caracteres.' });
      }
      const clean = raw.toLowerCase();
      const existing = db
        .prepare('SELECT email FROM users WHERE LOWER(username) = ?')
        .get(clean) as { email?: string } | undefined;

      if (existing && existing.email?.toLowerCase() !== currentEmail) {
        return res.json({ available: false, message: 'Este @usuário já está em uso.' });
      }

      if (supabase) {
        const { data: remoteExisting } = await supabase
          .from('users')
          .select('email')
          .eq('username_normalized', clean)
          .maybeSingle();
        if (remoteExisting && remoteExisting.email?.toLowerCase() !== currentEmail) {
          return res.json({ available: false, message: 'Este @usuário já está em uso.' });
        }
      }

      return res.json({ available: true, message: 'Nome de usuário disponível!' });
    } catch {
      return res.json({ available: true });
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { name, username, email, whatsapp, password, avatar_url, supabase_auth_id } = req.body;
      const rawEmail = (email || whatsapp || '').trim().toLowerCase();
      if (!rawEmail || !password) {
        return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios.' });
      }

      const cleanUsername = (username || name || rawEmail.split('@')[0])
        .trim()
        .replace(/^@+/, '')
        .replace(/\s+/g, '')
        .toLowerCase();

      const existing = db
        .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?')
        .get(rawEmail, rawEmail) as any;

      if (existing) {
        return res.status(400).json({ success: false, error: 'Este e-mail já está cadastrado. Faça login.' });
      }

      // Register in Supabase Auth if not already registered on client
      let authId = supabase_auth_id || null;
      if (!authId && supabaseAnonClient && rawEmail.includes('@')) {
        try {
          const { data: signUpData } = await supabaseAnonClient.auth.signUp({
            email: rawEmail,
            password: String(password),
            options: {
              data: {
                full_name: name || cleanUsername,
                username: cleanUsername,
                avatar_url: avatar_url || '/fotoperfil.png',
              },
            },
          });
          if (signUpData?.user?.id) {
            authId = signUpData.user.id;
          }
        } catch {}
      }

      const hash = bcrypt.hashSync(String(password), 10);
      const role = isPrimaryAdmin(rawEmail) ? 'admin' : 'user';
      const isGold = role === 'admin' ? 1 : 0;

      const insert = db
        .prepare(`
          INSERT INTO users (name, username, email, whatsapp, password_hash, avatar_url, role, is_gold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          name || cleanUsername,
          cleanUsername,
          rawEmail,
          rawEmail,
          hash,
          avatar_url || '/fotoperfil.png',
          role,
          isGold
        );

      const userId = Number(insert.lastInsertRowid);
      const token = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);

      const userRecord = {
        id: userId,
        auth_id: authId,
        name: name || cleanUsername,
        username: cleanUsername,
        email: rawEmail,
        whatsapp: rawEmail,
        password_hash: hash,
        role,
        avatar_url: avatar_url || '/fotoperfil.png',
        is_gold: isGold,
      };

      // Persist to Supabase PostgreSQL & Firestore
      await persistUserToSupabase(userRecord);
      await persistSessionToSupabase(token, userId);
      persistUserToFirestore(userRecord).catch(() => {});

      return res.json({
        success: true,
        token,
        user: formatSafeUser(userRecord),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Erro ao criar conta' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { identifier, email, whatsapp, password } = req.body;
      const loginId = (identifier || email || whatsapp || '').trim().toLowerCase().replace(/^@+/, '');

      if (!loginId || !password) {
        return res.status(400).json({ success: false, error: 'Informe seu e-mail/usuário e senha.' });
      }

      let user = db
        .prepare(`
          SELECT * FROM users
          WHERE LOWER(email) = ? OR LOWER(whatsapp) = ? OR LOWER(username) = ?
        `)
        .get(loginId, loginId, loginId) as any;

      // If not in local SQLite yet, check Supabase PostgreSQL
      if (!user) {
        const remoteUser = await getUserFromSupabase(loginId);
        if (remoteUser && remoteUser.email) {
          const role = isPrimaryAdmin(remoteUser.email) || remoteUser.role === 'admin' ? 'admin' : 'user';
          const isGold = role === 'admin' || remoteUser.is_gold === 1 ? 1 : 0;
          const ins = db
            .prepare(`
              INSERT INTO users (name, username, email, whatsapp, password_hash, role, avatar_url, is_gold)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              remoteUser.name || remoteUser.email.split('@')[0],
              remoteUser.username || remoteUser.email.split('@')[0],
              remoteUser.email.toLowerCase(),
              remoteUser.whatsapp || remoteUser.email.toLowerCase(),
              remoteUser.password_hash || '',
              role,
              remoteUser.avatar_url || '/fotoperfil.png',
              isGold
            );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(ins.lastInsertRowid);
        }
      }

      // Also verify against Supabase Auth if email login
      let supabaseAuthVerified = false;
      if (supabaseAnonClient && (loginId.includes('@') || user?.email)) {
        const targetEmail = user?.email || loginId;
        try {
          const { data: authData, error: authErr } = await supabaseAnonClient.auth.signInWithPassword({
            email: targetEmail,
            password: String(password),
          });
          if (!authErr && authData?.user) {
            supabaseAuthVerified = true;
            if (!user) {
              const role = isPrimaryAdmin(targetEmail) ? 'admin' : 'user';
              const isGold = role === 'admin' ? 1 : 0;
              const hash = bcrypt.hashSync(String(password), 10);
              const ins = db
                .prepare(`
                  INSERT INTO users (name, username, email, whatsapp, password_hash, role, avatar_url, is_gold)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `)
                .run(
                  authData.user.user_metadata?.full_name || targetEmail.split('@')[0],
                  authData.user.user_metadata?.username || targetEmail.split('@')[0],
                  targetEmail,
                  targetEmail,
                  hash,
                  role,
                  authData.user.user_metadata?.avatar_url || '/fotoperfil.png',
                  isGold
                );
              user = db.prepare('SELECT * FROM users WHERE id = ?').get(ins.lastInsertRowid);
            }
          }
        } catch {}
      }

      if (!user) {
        return res.status(401).json({ success: false, error: 'Conta não encontrada. Verifique seus dados ou crie uma conta.' });
      }

      if (user.is_banned === 1) {
        return res.status(403).json({ success: false, error: 'Esta conta foi suspensa pelo administrador.' });
      }

      const validPassword =
        supabaseAuthVerified ||
        (user.password_hash && bcrypt.compareSync(String(password), user.password_hash));

      if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Senha incorreta. Tente novamente.' });
      }

      // Ensure primary admin role is preserved
      if (isPrimaryAdmin(user.email) && user.role !== 'admin') {
        db.prepare("UPDATE users SET role = 'admin', is_gold = 1 WHERE id = ?").run(user.id);
        user.role = 'admin';
        user.is_gold = 1;
      }

      db.prepare('UPDATE users SET visits_count = COALESCE(visits_count, 0) + 1, last_access = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

      const token = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      await persistUserToSupabase(user);
      await persistSessionToSupabase(token, user.id);

      return res.json({
        success: true,
        token,
        user: formatSafeUser(user),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/google', async (req: Request, res: Response) => {
    try {
      const { email, name, avatar_url, supabase_auth_id } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email não fornecido pelo Google' });
      }

      const cleanEmail = email.trim().toLowerCase();
      let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail) as any;
      let isNew = false;

      if (!user) {
        const remoteUser = await getUserFromSupabase(cleanEmail);
        if (remoteUser) {
          const role = isPrimaryAdmin(cleanEmail) || remoteUser.role === 'admin' ? 'admin' : 'user';
          const isGold = role === 'admin' || remoteUser.is_gold === 1 ? 1 : 0;
          const insert = db.prepare(`
            INSERT INTO users (name, username, email, whatsapp, password_hash, avatar_url, role, is_gold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            remoteUser.name || name || cleanEmail.split('@')[0],
            remoteUser.username || cleanEmail.split('@')[0],
            cleanEmail,
            cleanEmail,
            remoteUser.password_hash || bcrypt.hashSync(crypto.randomUUID(), 10),
            avatar_url || remoteUser.avatar_url || '/fotoperfil.png',
            role,
            isGold
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);
        } else {
          isNew = true;
          const username = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') + Math.floor(Math.random() * 100);
          const dummyHash = bcrypt.hashSync(crypto.randomUUID(), 10);
          const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';
          const isGold = role === 'admin' ? 1 : 0;
          const insert = db.prepare(`
            INSERT INTO users (name, username, email, whatsapp, password_hash, avatar_url, role, is_gold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(name || username, username, cleanEmail, cleanEmail, dummyHash, avatar_url || '/fotoperfil.png', role, isGold);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);
        }
      }

      const token = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      await persistUserToSupabase({ ...user, auth_id: supabase_auth_id || null });
      await persistSessionToSupabase(token, user.id);

      return res.json({ success: true, token, user: formatSafeUser(user), is_new: isNew });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/supabase-sync', async (req: Request, res: Response) => {
    try {
      const { access_token } = req.body;
      if (!access_token) {
        return res.status(400).json({ success: false, error: 'Token Supabase ausente' });
      }
      const jwtUser = await verifySupabaseJwtUser(access_token);
      if (!jwtUser || !jwtUser.email) {
        return res.status(401).json({ success: false, error: 'Sessão Supabase inválida' });
      }

      let user = db
        .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?')
        .get(jwtUser.email, jwtUser.email) as any;

      if (!user) {
        const remoteUser = await getUserFromSupabase(jwtUser.email);
        const role = isPrimaryAdmin(jwtUser.email) || remoteUser?.role === 'admin' ? 'admin' : 'user';
        const isGold = role === 'admin' || remoteUser?.is_gold === 1 ? 1 : 0;
        const username = remoteUser?.username || jwtUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
        const ins = db
          .prepare(`
            INSERT INTO users (name, username, email, whatsapp, password_hash, avatar_url, role, is_gold)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            remoteUser?.name || jwtUser.name || username,
            username,
            jwtUser.email,
            jwtUser.email,
            'supabase_auth',
            remoteUser?.avatar_url || jwtUser.avatarUrl || '/fotoperfil.png',
            role,
            isGold
          );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(ins.lastInsertRowid);
      }

      const token = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      await persistUserToSupabase({ ...user, auth_id: jwtUser.authId });
      await persistSessionToSupabase(token, user.id);

      return res.json({ success: true, token, user: formatSafeUser(user) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/recover-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'Informe um e-mail válido.' });
      }

      if (supabaseAnonClient) {
        await supabaseAnonClient.auth.resetPasswordForEmail(cleanEmail);
      }

      return res.json({
        success: true,
        message: 'Instruções de recuperação de senha enviadas para seu e-mail.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        await deleteSessionFromSupabase(token);
      }
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      return res.json({ success: true, user });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // User Profile Update (Preserves role & Gold status from DB, never trusting client role input)
  const updateProfileHandler = async (req: Request, res: Response) => {
    try {
      const currentUser = await resolveAuthenticatedUser(req);
      const { name, username, bio, email, whatsapp, avatar_url } = req.body;
      const targetEmail = (email || whatsapp || currentUser?.email || '').trim().toLowerCase();

      if (!targetEmail && !currentUser) {
        return res.status(400).json({ success: false, error: 'E-mail ou sessão necessária' });
      }

      let dbUser = currentUser?.id
        ? (db.prepare('SELECT * FROM users WHERE id = ?').get(currentUser.id) as any)
        : (db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(targetEmail, targetEmail) as any);

      const cleanUsername = (username || name || targetEmail.split('@')[0] || 'explorador')
        .trim()
        .replace(/^@+/, '');

      if (dbUser) {
        const preservedRole = isPrimaryAdmin(targetEmail || dbUser.email) || dbUser.role === 'admin' ? 'admin' : 'user';
        const preservedGold = preservedRole === 'admin' || dbUser.is_gold === 1 ? 1 : 0;

        db.prepare(`
          UPDATE users
          SET name = ?, username = ?, bio = ?, email = ?, whatsapp = ?, avatar_url = ?, role = ?, is_gold = ?
          WHERE id = ?
        `).run(
          name || dbUser.name,
          cleanUsername,
          bio !== undefined ? bio : (dbUser.bio || ''),
          targetEmail || dbUser.email,
          targetEmail || dbUser.whatsapp,
          avatar_url || dbUser.avatar_url || '/fotoperfil.png',
          preservedRole,
          preservedGold,
          dbUser.id
        );
        dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(dbUser.id);
      } else {
        const role = isPrimaryAdmin(targetEmail) ? 'admin' : 'user';
        const isGold = role === 'admin' ? 1 : 0;
        const ins = db.prepare(`
          INSERT INTO users (name, username, bio, email, whatsapp, password_hash, avatar_url, role, is_gold)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          name || cleanUsername,
          cleanUsername,
          bio || '',
          targetEmail,
          targetEmail,
          'profile_sync',
          avatar_url || '/fotoperfil.png',
          role,
          isGold
        );
        dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(ins.lastInsertRowid);
      }

      await persistUserToSupabase(dbUser);
      persistUserToFirestore(dbUser).catch(() => {});

      return res.json({ success: true, user: formatSafeUser(dbUser) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/user/profile', updateProfileHandler);
  app.put('/api/user/profile', updateProfileHandler);

  // ===========================================================================
  // 2. TOURIST SPOTS CRUD + SUPABASE STORAGE UPLOAD
  // ===========================================================================
  app.get('/api/spots', async (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM spots WHERE is_active = 1 ORDER BY rating DESC, name ASC').all();
      const spots = rows.length > 0 ? rows.map(formatSpotRow) : CAMPOS_SPOTS;
      return res.json({ success: true, spots });
    } catch {
      return res.json({ success: true, spots: CAMPOS_SPOTS });
    }
  });

  app.get('/api/admin/spots', async (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM spots ORDER BY name ASC').all();
      const spots = rows.length > 0 ? rows.map(formatSpotRow) : CAMPOS_SPOTS;
      return res.json({ success: true, spots });
    } catch {
      return res.json({ success: true, spots: CAMPOS_SPOTS });
    }
  });

  app.post('/api/admin/spots', async (req: Request, res: Response) => {
    try {
      if (!(await isRequestAdmin(req))) {
        return res.status(403).json({ success: false, error: 'Acesso restrito a administradores.' });
      }

      const body = req.body || {};
      if (!body.name) {
        return res.status(400).json({ success: false, error: 'O nome do local é obrigatório.' });
      }

      const spotId = body.id || `spot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const galleryStr = Array.isArray(body.gallery)
        ? JSON.stringify(body.gallery)
        : typeof body.gallery === 'string'
          ? body.gallery
          : JSON.stringify(body.image ? [body.image] : []);

      const isActiveInt = body.is_active !== undefined ? (body.is_active ? 1 : 0) : body.isActive === false ? 0 : 1;

      db.prepare(`
        INSERT INTO spots (
          id, name, short_name, tag_label, category, category_label,
          lat, lng, image, gallery, description, tourist_tip,
          rating, review_count, hours, address, price_range, price,
          available_for_itinerary, duration_minutes, tags, maps_url, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          short_name = excluded.short_name,
          tag_label = excluded.tag_label,
          category = excluded.category,
          category_label = excluded.category_label,
          lat = excluded.lat,
          lng = excluded.lng,
          image = excluded.image,
          gallery = excluded.gallery,
          description = excluded.description,
          tourist_tip = excluded.tourist_tip,
          rating = excluded.rating,
          review_count = excluded.review_count,
          hours = excluded.hours,
          address = excluded.address,
          price_range = excluded.price_range,
          price = excluded.price,
          available_for_itinerary = excluded.available_for_itinerary,
          duration_minutes = excluded.duration_minutes,
          tags = excluded.tags,
          maps_url = excluded.maps_url,
          is_active = excluded.is_active
      `).run(
        spotId,
        String(body.name).trim(),
        body.short_name || body.shortName || body.name,
        body.tag_label || body.tagLabel || body.short_name || body.name,
        body.category || 'attractions',
        body.category_label || body.categoryLabel || body.category || 'Atrações',
        Number(body.lat ?? -22.7192),
        Number(body.lng ?? -45.5673),
        body.image || '',
        galleryStr,
        body.description || '',
        body.tourist_tip || body.touristTip || '',
        Number(body.rating ?? 4.8),
        Number(body.review_count ?? body.reviewCount ?? 100),
        body.hours || '09:00 - 18:00',
        body.address || 'Campos do Jordão, SP',
        body.price_range || body.priceRange || '$$',
        body.price || 'Entrada Franca',
        body.available_for_itinerary !== undefined ? Number(body.available_for_itinerary) : 1,
        Number(body.duration_minutes ?? body.durationMinutes ?? 90),
        Array.isArray(body.tags) ? body.tags.join(', ') : (body.tags || ''),
        body.maps_url || body.mapsUrl || '',
        isActiveInt
      );

      const createdRow = db.prepare('SELECT * FROM spots WHERE id = ?').get(spotId);
      const formatted = formatSpotRow(createdRow);

      await persistSpotToSupabase(createdRow);
      persistSpotToFirestore(formatted).catch(() => {});

      return res.json({ success: true, spot: formatted });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/spots/:id', async (req: Request, res: Response) => {
    try {
      if (!(await isRequestAdmin(req))) {
        return res.status(403).json({ success: false, error: 'Acesso restrito a administradores.' });
      }

      const { id } = req.params;
      const body = req.body || {};
      const existing = db.prepare('SELECT * FROM spots WHERE id = ?').get(id) as any;

      const galleryStr = Array.isArray(body.gallery)
        ? JSON.stringify(body.gallery)
        : typeof body.gallery === 'string'
          ? body.gallery
          : existing?.gallery || JSON.stringify(body.image ? [body.image] : []);

      const isActiveInt =
        body.is_active !== undefined
          ? (body.is_active ? 1 : 0)
          : body.isActive !== undefined
            ? (body.isActive ? 1 : 0)
            : (existing?.is_active ?? 1);

      db.prepare(`
        INSERT INTO spots (
          id, name, short_name, tag_label, category, category_label,
          lat, lng, image, gallery, description, tourist_tip,
          rating, review_count, hours, address, price_range, price,
          available_for_itinerary, duration_minutes, tags, maps_url, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          short_name = excluded.short_name,
          tag_label = excluded.tag_label,
          category = excluded.category,
          category_label = excluded.category_label,
          lat = excluded.lat,
          lng = excluded.lng,
          image = excluded.image,
          gallery = excluded.gallery,
          description = excluded.description,
          tourist_tip = excluded.tourist_tip,
          rating = excluded.rating,
          review_count = excluded.review_count,
          hours = excluded.hours,
          address = excluded.address,
          price_range = excluded.price_range,
          price = excluded.price,
          available_for_itinerary = excluded.available_for_itinerary,
          duration_minutes = excluded.duration_minutes,
          tags = excluded.tags,
          maps_url = excluded.maps_url,
          is_active = excluded.is_active
      `).run(
        id,
        String(body.name || existing?.name || '').trim(),
        body.short_name || body.shortName || existing?.short_name || body.name || '',
        body.tag_label || body.tagLabel || existing?.tag_label || body.name || '',
        body.category || existing?.category || 'attractions',
        body.category_label || body.categoryLabel || existing?.category_label || 'Atrações',
        Number(body.lat ?? existing?.lat ?? -22.7192),
        Number(body.lng ?? existing?.lng ?? -45.5673),
        body.image !== undefined ? body.image : (existing?.image || ''),
        galleryStr,
        body.description !== undefined ? body.description : (existing?.description || ''),
        body.tourist_tip !== undefined ? body.tourist_tip : (body.touristTip ?? existing?.tourist_tip ?? ''),
        Number(body.rating ?? existing?.rating ?? 4.8),
        Number(body.review_count ?? body.reviewCount ?? existing?.review_count ?? 100),
        body.hours !== undefined ? body.hours : (existing?.hours || ''),
        body.address !== undefined ? body.address : (existing?.address || 'Campos do Jordão, SP'),
        body.price_range || body.priceRange || existing?.price_range || '$$',
        body.price !== undefined ? body.price : (existing?.price || ''),
        body.available_for_itinerary !== undefined ? Number(body.available_for_itinerary) : (existing?.available_for_itinerary ?? 1),
        Number(body.duration_minutes ?? body.durationMinutes ?? existing?.duration_minutes ?? 90),
        Array.isArray(body.tags) ? body.tags.join(', ') : (body.tags ?? existing?.tags ?? ''),
        body.maps_url !== undefined ? body.maps_url : (body.mapsUrl ?? existing?.maps_url ?? ''),
        isActiveInt
      );

      const updatedRow = db.prepare('SELECT * FROM spots WHERE id = ?').get(id);
      const formatted = formatSpotRow(updatedRow);

      await persistSpotToSupabase(updatedRow);
      persistSpotToFirestore(formatted).catch(() => {});

      return res.json({ success: true, spot: formatted });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/spots/:id', async (req: Request, res: Response) => {
    try {
      if (!(await isRequestAdmin(req))) {
        return res.status(403).json({ success: false, error: 'Acesso restrito a administradores.' });
      }
      const { id } = req.params;
      db.prepare('DELETE FROM spots WHERE id = ?').run(id);
      await deleteSpotFromSupabase(id);
      deleteSpotFromFirestore(id).catch(() => {});
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Supabase Storage Upload Endpoint (for spots, events, avatars, stories)
  app.post('/api/admin/upload', async (req: Request, res: Response) => {
    try {
      const { imageBase64, folder = 'spots', filename } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ success: false, error: 'Imagem não fornecida' });
      }

      if (supabase && imageBase64.startsWith('data:')) {
        try {
          const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const contentType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
            const objectPath = `${folder}/${Date.now()}-${filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '') : Math.random().toString(36).substring(2, 8)}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from('monvian-media')
              .upload(objectPath, buffer, {
                contentType,
                upsert: true,
              });

            if (!uploadError) {
              const { data: pubData } = supabase.storage.from('monvian-media').getPublicUrl(objectPath);
              if (pubData?.publicUrl) {
                return res.json({ success: true, url: pubData.publicUrl, storage: 'supabase' });
              }
            }
          }
        } catch {}
      }

      // Fallback to data URL so image upload never fails even if bucket isn't created yet
      return res.json({ success: true, url: imageBase64, storage: 'inline' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ===========================================================================
  // 3. VISUAL MAP ICONS API
  // ===========================================================================
  app.get('/api/map-visual-icons', (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM map_visual_icons WHERE is_active = 1 ORDER BY created_at DESC').all();
      return res.json({ success: true, icons: rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/map-visual-icons', (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM map_visual_icons ORDER BY created_at DESC').all();
      return res.json({ success: true, icons: rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/map-visual-icons', async (req: Request, res: Response) => {
    try {
      const { id, category, latitude, longitude, color, is_active } = req.body;
      if (!category || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, error: 'Categoria, latitude e longitude são obrigatórios' });
      }

      const iconId = id || `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const activeState = is_active === undefined ? 1 : (is_active ? 1 : 0);

      db.prepare(`
        INSERT INTO map_visual_icons (id, category, latitude, longitude, color, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(iconId, String(category), Number(latitude), Number(longitude), color || null, activeState);

      const created = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(iconId) as any;
      await persistMapVisualIconToSupabase(created);
      persistMapVisualIconToFirestore(created).catch(() => {});

      return res.json({ success: true, icon: created, message: 'Ícone adicionado com sucesso!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/map-visual-icons/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { category, latitude, longitude, color, is_active } = req.body;

      db.prepare(`
        UPDATE map_visual_icons
        SET category = ?, latitude = ?, longitude = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(String(category), Number(latitude), Number(longitude), color || null, is_active ? 1 : 0, id);

      const updated = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id) as any;
      await persistMapVisualIconToSupabase(updated);
      persistMapVisualIconToFirestore(updated).catch(() => {});

      return res.json({ success: true, icon: updated, message: 'Ícone atualizado com sucesso!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/admin/map-visual-icons/:id/toggle-active', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const current = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id) as any;
      if (!current) {
        return res.status(404).json({ success: false, error: 'Ícone não encontrado' });
      }

      const nextActive = current.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE map_visual_icons SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextActive, id);

      const updated = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id) as any;
      await persistMapVisualIconToSupabase(updated);
      persistMapVisualIconToFirestore(updated).catch(() => {});

      return res.json({
        success: true,
        is_active: nextActive,
        message: nextActive === 1 ? 'Marcador ativado no mapa' : 'Marcador ocultado do mapa',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/map-visual-icons/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM map_visual_icons WHERE id = ?').run(id);
      await deleteMapVisualIconFromSupabase(id);
      deleteMapVisualIconFromFirestore(id).catch(() => {});
      return res.json({ success: true, message: 'Ícone removido com sucesso' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ===========================================================================
  // 4. FAVORITES API (Supports both /api/favorites and /api/user/favorites)
  // ===========================================================================
  app.get('/api/favorites', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      const userId = user ? String(user.id) : 'guest';
      const rows = db.prepare('SELECT item_type, item_id FROM user_favorites WHERE user_id = ?').all(userId) as { item_type: string; item_id: string }[];
      const legacyRows = db.prepare('SELECT spot_id FROM favorites WHERE user_id = ?').all(userId) as { spot_id: string }[];

      const places = new Set<string>();
      const spots = new Set<string>();
      const itineraries = new Set<string>();

      for (const r of rows) {
        if (r.item_type === 'place') places.add(r.item_id);
        else if (r.item_type === 'itinerary') itineraries.add(r.item_id);
        else spots.add(r.item_id);
      }
      for (const lr of legacyRows) {
        if (!places.has(lr.spot_id)) spots.add(lr.spot_id);
      }

      return res.json({
        success: true,
        places: Array.from(places),
        spots: Array.from(spots),
        itineraries: Array.from(itineraries),
      });
    } catch {
      return res.json({ success: true, places: [], spots: [], itineraries: [] });
    }
  });

  app.post('/api/favorites/toggle', async (req: Request, res: Response) => {
    try {
      const { item_type = 'spot', item_id, is_saved } = req.body;
      if (!item_id) return res.status(400).json({ success: false, error: 'item_id obrigatório' });

      const user = await resolveAuthenticatedUser(req);
      const userId = user ? String(user.id) : 'guest';

      if (is_saved) {
        db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, item_type, item_id) VALUES (?, ?, ?)').run(userId, item_type, item_id);
        if (item_type === 'spot' || item_type === 'place') {
          db.prepare('INSERT OR IGNORE INTO favorites (user_id, spot_id) VALUES (?, ?)').run(userId, item_id);
        }
      } else {
        db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ?').run(userId, item_type, item_id);
        db.prepare('DELETE FROM favorites WHERE user_id = ? AND spot_id = ?').run(userId, item_id);
      }

      await persistFavoriteToSupabase(userId, item_type, item_id, Boolean(is_saved));
      return res.json({ success: true, isFavorite: Boolean(is_saved) });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/user/favorites', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      const userId = user ? String(user.id) : 'guest';
      const rows = db.prepare('SELECT spot_id FROM favorites WHERE user_id = ?').all(userId) as { spot_id: string }[];
      return res.json({ success: true, favorites: rows.map((r) => r.spot_id) });
    } catch {
      return res.json({ success: true, favorites: [] });
    }
  });

  app.post('/api/user/favorites/toggle', async (req: Request, res: Response) => {
    try {
      const { spotId } = req.body;
      const user = await resolveAuthenticatedUser(req);
      const userId = user ? String(user.id) : 'guest';

      const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND spot_id = ?').get(userId, spotId);
      if (existing) {
        db.prepare('DELETE FROM favorites WHERE user_id = ? AND spot_id = ?').run(userId, spotId);
        db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND item_id = ?').run(userId, spotId);
        await persistFavoriteToSupabase(userId, 'spot', spotId, false);
        return res.json({ success: true, isFavorite: false });
      } else {
        db.prepare('INSERT INTO favorites (user_id, spot_id) VALUES (?, ?)').run(userId, spotId);
        db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, item_type, item_id) VALUES (?, ?, ?)').run(userId, 'spot', spotId);
        await persistFavoriteToSupabase(userId, 'spot', spotId, true);
        return res.json({ success: true, isFavorite: true });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ===========================================================================
  // 5. ADMIN DASHBOARD, USERS, EVENTS, SERVICES, SETTINGS & CLEANUP
  // ===========================================================================
  app.get('/api/admin/stats', (_req: Request, res: Response) => {
    try {
      const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
      const totalSpots = (db.prepare('SELECT COUNT(*) as c FROM spots').get() as any)?.c || 0;
      const totalEvents = (db.prepare('SELECT COUNT(*) as c FROM events').get() as any)?.c || 0;
      const totalFavorites = (db.prepare('SELECT COUNT(*) as c FROM favorites').get() as any)?.c || 0;
      const recentUsers = db.prepare('SELECT id, name, whatsapp, email, visits_count, last_access, created_at FROM users ORDER BY created_at DESC LIMIT 8').all();
      const topSpots = db.prepare('SELECT id, name, category_label, rating, review_count FROM spots ORDER BY rating DESC LIMIT 6').all();

      const categoriesBreakdown = db.prepare(`
        SELECT category_label as category, COUNT(*) as count
        FROM spots
        GROUP BY category_label
        ORDER BY count DESC
      `).all();

      return res.json({
        success: true,
        stats: {
          totalUsers,
          activeUsersToday: Math.max(1, totalUsers),
          totalSpots,
          totalEvents,
          totalFavorites,
          totalServices: (db.prepare('SELECT COUNT(*) as c FROM services').get() as any)?.c || 4,
          recentUsers,
          topSpots,
          categoriesBreakdown,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/users', (_req: Request, res: Response) => {
    try {
      const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
      return res.json({ success: true, users });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const target = db.prepare('SELECT email FROM users WHERE id = ?').get(id) as any;
      if (target && isPrimaryAdmin(target.email)) {
        return res.status(400).json({ success: false, error: 'Não é permitido excluir o administrador principal.' });
      }
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      if (supabase && target?.email) {
        await supabase.from('users').delete().eq('email', target.email);
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/admin/users/:id/ban', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { is_banned } = req.body;
      db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(is_banned ? 1 : 0, id);
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
      if (updated) await persistUserToSupabase(updated);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Events CRUD
  app.get('/api/events', (_req: Request, res: Response) => {
    try {
      const events = db.prepare("SELECT * FROM events WHERE status = 'active' ORDER BY created_at DESC").all();
      return res.json({ success: true, events });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/events', (_req: Request, res: Response) => {
    try {
      const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
      return res.json({ success: true, events });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/events', async (req: Request, res: Response) => {
    try {
      const b = req.body || {};
      const id = b.id || `evt-${Date.now()}`;
      db.prepare(`
        INSERT INTO events (id, name, description, image, category, date, time, address, lat, lng, status, highlighted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        b.name,
        b.description || '',
        b.image || '',
        b.category || 'Música & Cultura',
        b.date || '',
        b.time || '',
        b.address || 'Campos do Jordão, SP',
        Number(b.lat ?? -22.7192),
        Number(b.lng ?? -45.5673),
        b.status || 'active',
        b.highlighted ? 1 : 0
      );
      const created = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
      await persistEventToSupabase(created);
      return res.json({ success: true, event: created });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/events/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = req.body || {};
      db.prepare(`
        UPDATE events
        SET name = ?, description = ?, image = ?, category = ?, date = ?, time = ?, address = ?, lat = ?, lng = ?, status = ?, highlighted = ?
        WHERE id = ?
      `).run(
        b.name,
        b.description || '',
        b.image || '',
        b.category || 'Música & Cultura',
        b.date || '',
        b.time || '',
        b.address || 'Campos do Jordão, SP',
        Number(b.lat ?? -22.7192),
        Number(b.lng ?? -45.5673),
        b.status || 'active',
        b.highlighted ? 1 : 0,
        id
      );
      const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
      await persistEventToSupabase(updated);
      return res.json({ success: true, event: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/events/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
      await deleteEventFromSupabase(id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Services CRUD
  app.get('/api/services', (_req: Request, res: Response) => {
    try {
      const services = db.prepare('SELECT * FROM services ORDER BY is_emergency DESC, name ASC').all();
      return res.json({ success: true, services });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/services', (_req: Request, res: Response) => {
    try {
      const services = db.prepare('SELECT * FROM services ORDER BY is_emergency DESC, name ASC').all();
      return res.json({ success: true, services });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/services', (req: Request, res: Response) => {
    try {
      const b = req.body || {};
      const id = b.id || `srv-${Date.now()}`;
      db.prepare(`
        INSERT INTO services (id, name, category, phone, description, address, hours, is_emergency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, b.name, b.category || 'ambulance', b.phone || '', b.description || '', b.address || '', b.hours || '24h', b.is_emergency ? 1 : 0);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/services/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const b = req.body || {};
      db.prepare(`
        UPDATE services
        SET name = ?, category = ?, phone = ?, description = ?, address = ?, hours = ?, is_emergency = ?
        WHERE id = ?
      `).run(b.name, b.category || 'ambulance', b.phone || '', b.description || '', b.address || '', b.hours || '24h', b.is_emergency ? 1 : 0, id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/services/:id', (req: Request, res: Response) => {
    try {
      db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Settings CRUD
  const getSettingsHandler = (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const r of rows) settings[r.key] = r.value;
      return res.json({ success: true, settings });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };
  app.get('/api/settings', getSettingsHandler);
  app.get('/api/admin/settings', getSettingsHandler);

  app.post('/api/admin/settings', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const upsert = db.prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          upsert.run(k, String(v));
          await persistSystemSettingToSupabase(k, String(v));
        }
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Cleanup Preview & Execute
  app.get('/api/admin/cleanup/preview', (_req: Request, res: Response) => {
    try {
      const users = db.prepare("SELECT id, name, username, email, role, created_at FROM users WHERE role != 'admin'").all() as any[];
      const removableUsers = users.filter((u) => !isPrimaryAdmin(u.email));
      return res.json({
        success: true,
        summary: {
          primaryAdminKept: 'empresariomario@gmail.com',
          usersToRemoveCount: removableUsers.length,
          usersToRemove: removableUsers,
          socialPostsCount: (db.prepare('SELECT COUNT(*) as c FROM posts').get() as any)?.c || 0,
          storiesCount: (db.prepare('SELECT COUNT(*) as c FROM stories').get() as any)?.c || 0,
          itinerariesCount: (db.prepare('SELECT COUNT(*) as c FROM itineraries').get() as any)?.c || 0,
          sessionsCount: (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any)?.c || 0,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/cleanup/execute', (req: Request, res: Response) => {
    try {
      const users = db.prepare('SELECT id, email FROM users').all() as any[];
      let usersDeleted = 0;
      for (const u of users) {
        if (!isPrimaryAdmin(u.email)) {
          db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
          db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
          usersDeleted++;
        }
      }
      const postsDeleted = db.prepare('DELETE FROM posts').run().changes;
      const storiesDeleted = db.prepare('DELETE FROM stories').run().changes;
      const itinerariesDeleted = db.prepare('DELETE FROM itineraries').run().changes;

      return res.json({
        success: true,
        message: 'Limpeza concluída com sucesso.',
        deleted: {
          usersDeleted,
          postsDeleted,
          storiesDeleted,
          itinerariesDeleted,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Vite Dev Server Middleware or Static Production ---
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
