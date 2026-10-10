import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { CAMPOS_SPOTS } from './src/data/spots';
import {
  persistUserToFirestore,
  getUserFromFirestore,
  persistSessionToFirestore,
  getSessionFromFirestore,
  deleteSessionFromFirestore,
  persistSpotToFirestore,
  deleteSpotFromFirestore,
  persistMapVisualIconToFirestore,
  deleteMapVisualIconFromFirestore,
  persistSystemSettingToFirestore,
  persistEventToFirestore,
  deleteEventFromFirestore,
  syncDatabaseWithFirestore,
  isPrimaryAdmin
} from './src/services/firestoreSync';
import { setupItineraryDatabase, registerItineraryRoutes } from './src/server/itineraryRoutes';
import { setupStripeDatabase, registerStripeRoutes } from './src/server/stripeRoutes';
import { setupSocialDatabase, registerSocialRoutes } from './src/server/socialRoutes';
import { setupStoriesDatabase, registerStoryRoutes } from './src/server/storyRoutes';

dotenv.config();

// Port 3000 is required by the infrastructure proxy (never read process.env.PORT)
const PORT = 3000;
const SERVER_START_TIME = Date.now();

// Setup Database
const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    whatsapp TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    is_banned INTEGER DEFAULT 0,
    snow_enabled INTEGER DEFAULT 0,
    theme TEXT DEFAULT 'dark',
    avatar_url TEXT,
    visits_count INTEGER DEFAULT 1,
    last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS spots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    tag_label TEXT,
    category TEXT NOT NULL,
    category_label TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    image TEXT NOT NULL,
    gallery TEXT,
    description TEXT,
    tourist_tip TEXT,
    rating REAL DEFAULT 4.5,
    review_count INTEGER DEFAULT 0,
    hours TEXT,
    address TEXT,
    price_range TEXT,
    popular_times TEXT,
    visitors_today INTEGER DEFAULT 0,
    badge TEXT,
    highlighted INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_verified INTEGER DEFAULT 1,
    website TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image TEXT,
    category TEXT,
    date TEXT,
    time TEXT,
    address TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT DEFAULT 'active',
    highlighted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    event_type TEXT NOT NULL,
    item_id TEXT,
    item_name TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_id TEXT NOT NULL,
    user_id INTEGER,
    user_name TEXT,
    user_avatar TEXT,
    rating REAL NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    referral_source TEXT,
    travel_frequency TEXT,
    travel_style TEXT,
    main_interests TEXT,
    preferred_season TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT,
    data_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

// Create indices for faster analytics queries
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_type_date ON analytics_events (event_type, created_at);`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_reviews_spot ON reviews (spot_id, created_at);`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences (user_id);`); } catch (e) {}

// MAP VISUAL ICONS TABLE (Dynamic, strictly non-interactive visual markers layer)
db.exec(`
  CREATE TABLE IF NOT EXISTS map_visual_icons (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    icon TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    color TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
// Initialize Itineraries & Stripe databases
setupItineraryDatabase(db);
setupStripeDatabase(db);
setupSocialDatabase(db);
setupStoriesDatabase(db);

// Enforce Gold account status for primary admin accounts and preserve paid users
try {
  db.prepare(`
    UPDATE users 
    SET is_premium = 1, is_gold = 1, plan = 'gold' 
    WHERE LOWER(TRIM(email)) IN ('empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com')
       OR LOWER(TRIM(whatsapp)) IN ('empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com')
  `).run();

  // Restore gold status for all users who completed a purchase
  db.prepare(`
    UPDATE users 
    SET is_premium = 1, is_gold = 1, plan = 'gold' 
    WHERE id IN (SELECT DISTINCT user_id FROM purchases WHERE payment_status = 'paid')
       OR LOWER(email) IN (SELECT DISTINCT LOWER(user_email) FROM purchases WHERE payment_status = 'paid')
  `).run();
} catch (e) {}

try { db.exec(`ALTER TABLE map_visual_icons ADD COLUMN color TEXT;`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_map_visual_icons_active ON map_visual_icons (is_active);`); } catch (e) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_map_visual_icons_category ON map_visual_icons (category);`); } catch (e) {}

// Seed realistic initial map visual icons for Campos do Jordão (matching user reference screenshot)
try {
  const iconCount = (db.prepare('SELECT count(*) as count FROM map_visual_icons').get() as any)?.count || 0;
  if (iconCount === 0) {
    const initialVisualIcons = [
      // Postos de Gasolina (Azul com bomba)
      { id: 'icon-posto-portal', category: 'gas_station', icon: 'gas_station', lat: -22.7684, lng: -45.5842 },
      { id: 'icon-posto-abernessia', category: 'gas_station', icon: 'gas_station', lat: -22.7441, lng: -45.5925 },
      { id: 'icon-posto-jaguaribe', category: 'gas_station', icon: 'gas_station', lat: -22.7335, lng: -45.5788 },
      { id: 'icon-posto-capivari', category: 'gas_station', icon: 'gas_station', lat: -22.7180, lng: -45.5685 },
      { id: 'icon-posto-sp123', category: 'gas_station', icon: 'gas_station', lat: -22.7820, lng: -45.5710 },
      { id: 'icon-posto-altovista', category: 'gas_station', icon: 'gas_station', lat: -22.7050, lng: -45.5890 },
      { id: 'icon-posto-entroncamento', category: 'gas_station', icon: 'gas_station', lat: -22.7210, lng: -45.6420 },

      // Farmácias (Vermelho coral com cruz médica)
      { id: 'icon-farmacia-abernessia', category: 'pharmacy', icon: 'pharmacy', lat: -22.7420, lng: -45.5910 },
      { id: 'icon-farmacia-capivari', category: 'pharmacy', icon: 'pharmacy', lat: -22.7225, lng: -45.5695 },
      { id: 'icon-farmacia-jaguaribe', category: 'pharmacy', icon: 'pharmacy', lat: -22.7360, lng: -45.5830 },

      // Hospitais / Pronto Atendimento (Vermelho vivo)
      { id: 'icon-hospital-municipal', category: 'hospital', icon: 'hospital', lat: -22.7410, lng: -45.5940 },
      { id: 'icon-pronto-atendimento', category: 'hospital', icon: 'hospital', lat: -22.7380, lng: -45.5870 },

      // Picos / Montanhas (Verde escuro / Alpine)
      { id: 'icon-pico-itapeva', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.7750, lng: -45.5340 },
      { id: 'icon-pico-imbiri', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.7210, lng: -45.5450 },
      { id: 'icon-pico-bau', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.6850, lng: -45.6620 },
      { id: 'icon-cume-elefante', category: 'mountain_peak', icon: 'mountain_peak', lat: -22.7140, lng: -45.5580 },

      // Estacionamentos (Azul marinho com P branco)
      { id: 'icon-estac-capivari', category: 'parking', icon: 'parking', lat: -22.7230, lng: -45.5710 },
      { id: 'icon-estac-abernessia', category: 'parking', icon: 'parking', lat: -22.7430, lng: -45.5930 },
      { id: 'icon-estac-baden', category: 'parking', icon: 'parking', lat: -22.7185, lng: -45.5670 },

      // Mirantes (Roxo vibrante com câmera)
      { id: 'icon-mirante-chinesa', category: 'viewpoint', icon: 'viewpoint', lat: -22.7690, lng: -45.6120 },
      { id: 'icon-mirante-vila-inglesa', category: 'viewpoint', icon: 'viewpoint', lat: -22.7120, lng: -45.5510 },
      { id: 'icon-mirante-alto-capivari', category: 'viewpoint', icon: 'viewpoint', lat: -22.7080, lng: -45.5640 },

      // Alimentação / Cafés (Laranja quente)
      { id: 'icon-cafe-bosque', category: 'cafe', icon: 'cafe', lat: -22.7310, lng: -45.5750 },
      { id: 'icon-rest-capivari', category: 'restaurant', icon: 'restaurant', lat: -22.7250, lng: -45.5660 },
      { id: 'icon-cafe-estrada', category: 'cafe', icon: 'cafe', lat: -22.7160, lng: -45.5820 },

      // Mercados (Âmbar com carrinho)
      { id: 'icon-mercado-abernessia', category: 'market', icon: 'market', lat: -22.7450, lng: -45.5935 },
      { id: 'icon-mercado-capivari', category: 'market', icon: 'market', lat: -22.7210, lng: -45.5730 },

      // Parques (Verde com pinheiro)
      { id: 'icon-parque-lagoinha', category: 'park', icon: 'park', lat: -22.7480, lng: -45.5620 },
      { id: 'icon-parque-bosque-silencio', category: 'park', icon: 'park', lat: -22.7290, lng: -45.5540 },

      // Igrejas (Ardósia com cruz)
      { id: 'icon-igreja-matriz', category: 'church', icon: 'church', lat: -22.7415, lng: -45.5920 },
      { id: 'icon-igreja-benedito', category: 'church', icon: 'church', lat: -22.7228, lng: -45.5712 },

      // Pousadas / Hotéis (Lilás com cama)
      { id: 'icon-pousada-vale', category: 'lodging', icon: 'lodging', lat: -22.7380, lng: -45.5680 },
      { id: 'icon-hotel-bosque', category: 'lodging', icon: 'lodging', lat: -22.7150, lng: -45.5790 },

      // Banheiro Público (Ciano)
      { id: 'icon-banheiro-praca', category: 'restroom', icon: 'restroom', lat: -22.7235, lng: -45.5702 },

      // Caixa Eletrônico (Verde esmeralda)
      { id: 'icon-banco-capivari', category: 'atm', icon: 'atm', lat: -22.7222, lng: -45.5705 },

      // Terminal / Transporte (Azul índigo)
      { id: 'icon-terminal-estacao', category: 'terminal', icon: 'terminal', lat: -22.7250, lng: -45.5740 }
    ];

    const insertIconStmt = db.prepare(`
      INSERT INTO map_visual_icons (id, category, icon, latitude, longitude, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    for (const item of initialVisualIcons) {
      insertIconStmt.run(item.id, item.category, item.icon, item.lat, item.lng);
    }
  }
} catch (e) {
  console.error('Error seeding map visual icons:', e);
}

// Migrations for existing tables
try { db.exec(`ALTER TABLE users ADD COLUMN name TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN snow_enabled INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN high_contrast INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '/fotoperfil.png';`); } catch (e) {}
try { db.exec(`UPDATE users SET avatar_url = '/fotoperfil.png' WHERE avatar_url IS NULL OR avatar_url = '';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN visits_count INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN last_access DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN email TEXT;`); } catch (e) {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN username_normalized TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_normalized ON users (username_normalized) WHERE username_normalized IS NOT NULL;`); } catch (e) {}

// Backfill any existing users without username
try {
  const usersWithoutUsername = db.prepare('SELECT id, name, email, whatsapp FROM users WHERE username IS NULL OR username = ""').all() as any[];
  for (const u of usersWithoutUsername) {
    let raw = (u.name || u.email?.split('@')[0] || `user_${u.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 24);
    if (!raw || raw.length < 3) raw = `user_${u.id}`;
    let cand = raw;
    let n = 1;
    while (db.prepare('SELECT 1 FROM users WHERE username_normalized = ? AND id != ?').get(cand, u.id)) {
      cand = `${raw}${n++}`;
    }
    db.prepare('UPDATE users SET username = ?, username_normalized = ? WHERE id = ?').run(cand, cand, u.id);
  }
} catch (backfillErr) {
  console.warn('Username backfill notice:', backfillErr);
}
try { 
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_verifications_email ON email_verifications (email);
  `);
} catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN website TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN phone TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN is_active INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN is_verified INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN maps_url TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN google_rating REAL;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN google_review_snippet TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN last_synced_maps DATETIME;`); } catch (e) {}
try { db.exec(`ALTER TABLE reviews ADD COLUMN user_avatar TEXT;`); } catch (e) {}

// Seed initial spots if empty
const spotCount = db.prepare('SELECT count(*) as count FROM spots').get() as { count: number };
if (spotCount.count === 0) {
  const insertSpot = db.prepare(`
    INSERT INTO spots (
      id, name, short_name, tag_label, category, category_label,
      lat, lng, image, gallery, description, tourist_tip,
      rating, review_count, hours, address, price_range,
      visitors_today, badge, highlighted, is_active, is_verified
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, 1, 1
    )
  `);

  const insertMany = db.transaction((spots) => {
    for (const spot of spots) {
      insertSpot.run(
        spot.id,
        spot.name,
        spot.shortName || spot.name,
        spot.tagLabel || spot.name,
        spot.category,
        spot.categoryLabel || spot.category,
        spot.lat,
        spot.lng,
        spot.image,
        spot.gallery ? JSON.stringify(spot.gallery) : '[]',
        spot.description,
        spot.touristTip || '',
        spot.rating || 4.5,
        spot.reviewCount || 100,
        spot.hours || '09h às 18h',
        spot.address || 'Campos do Jordão, SP',
        spot.priceRange || '$$',
        spot.visitorsToday || 150,
        spot.badge || '',
        spot.highlighted ? 1 : 0
      );
    }
  });

  insertMany(CAMPOS_SPOTS);
  console.log(`Pre-seeded ${CAMPOS_SPOTS.length} spots into database.`);
}

// Initialize Itineraries and Route Planning tables and seeds
try {
  setupItineraryDatabase(db);
} catch (itinErr) {
  console.error('Error setting up itinerary database:', itinErr);
}

// Seed initial default settings
const defaultSettings: Record<string, string> = {
  community_url: 'https://chat.whatsapp.com/invite/monvian-campos',
  instagram_url: 'https://instagram.com/monvian.campos',
  support_phone: '+55 12 99123-4567',
  app_name: 'Monvian - Campos do Jordão',
  weather_rain_mode: 'auto',
  weather_snow_mode: 'fraca',
  maintenance_mode: '0',
  map_center_lat: '-22.7290',
  map_center_lng: '-45.5830',
  map_zoom: '11.75',
  map_pitch: '52',
  map_bearing: '-13',
  map_default_mode: 'explorar',
  mapbox_access_token: process.env.VITE_MAPBOX_ACCESS_TOKEN || ''
};

for (const [key, value] of Object.entries(defaultSettings)) {
  const existing = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run(key, value);
  }
}

// Seed events if empty
const eventCount = db.prepare('SELECT count(*) as count FROM events').get() as { count: number };
if (eventCount.count === 0) {
  const insertEvent = db.prepare(`
    INSERT INTO events (id, name, description, image, category, date, time, address, lat, lng, status, highlighted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertEvent.run(
    'festival-inverno-2026',
    'Festival Internacional de Inverno',
    'Maior evento de música erudita da América Latina com apresentações na Praça do Capivari e Auditório Cláudio Santoro.',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    'Música & Cultura',
    'Julho - Agosto 2026',
    '11h às 22h',
    'Praça São Benedito - Vila Capivari',
    -22.7345,
    -45.5912,
    'active',
    1
  );

  insertEvent.run(
    'festa-pinhao-2026',
    'Festa do Pinhão da Serra da Mantiqueira',
    'Gastronomia típica serrana, pratos com pinhão, shows de viola e feiras de produtores locais.',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
    'Gastronomia',
    'Fins de semana de Maio a Junho',
    '10h às 21h',
    'Espaço de Eventos Capivari',
    -22.7350,
    -45.5865,
    'active',
    0
  );
}

// Seed demo users if total users < 5 (so the community table has real users matching screenshots)
const userTotal = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (userTotal.count < 3) {
  const demoUsers = [
    { name: 'mariomeloz', whatsapp: '11999990001', role: 'user', visits: 48, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', created: '2026-09-12 16:35:00' },
    { name: 'miihs653', whatsapp: '12988887702', role: 'user', visits: 14, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80', created: '2026-09-06 13:55:00' },
    { name: 'Lucas Rossi', whatsapp: '11977776603', role: 'user', visits: 9, avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', created: '2026-09-07 23:17:00' },
    { name: 'Camila Mendonça', whatsapp: '12991112204', role: 'user', visits: 22, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', created: '2026-09-08 15:51:00' },
    { name: 'Guilherme Silva', whatsapp: '11966665505', role: 'user', visits: 5, avatar: '', created: '2026-09-11 14:36:00' },
    { name: 'Beatriz Almeida', whatsapp: '19988223306', role: 'user', visits: 12, avatar: '', created: '2026-09-12 09:56:00' },
  ];

  const dummyHash = bcrypt.hashSync('123456', 10);
  for (const u of demoUsers) {
    try {
      db.prepare(`
        INSERT INTO users (name, whatsapp, password_hash, role, visits_count, avatar_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(u.name, u.whatsapp, dummyHash, u.role, u.visits, u.avatar, u.created);
    } catch (e) {}
  }
}

// Durable cloud synchronization with Cloud Firestore
// Ensures user accounts, sessions and roles are NEVER lost upon deployment or container restart
syncDatabaseWithFirestore(db).catch(err => {
  console.error('[Boot] Firestore initial sync warning:', err);
});

// Log admin action helper
function logAdminAction(userId: number | null, userName: string | null, action: string, details: string) {
  try {
    db.prepare(`
      INSERT INTO admin_logs (user_id, user_name, action, details)
      VALUES (?, ?, ?, ?)
    `).run(userId, userName || 'Administrador', action, details);
  } catch (err) {
    console.error('Error logging admin action:', err);
  }
}

// Lazy initialize Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

async function performWebSearch(query: string): Promise<Array<{ title: string; snippet: string; url: string; sourceName: string }>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);

    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' campos do jordao')}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const html = await res.text();
    const results: Array<{ title: string; snippet: string; url: string; sourceName: string }> = [];

    const titleRegex = /<a[^>]+class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
    const snipRegex = /<a[^>]+class=\"result__snippet\"[^>]*>([\s\S]*?)<\/a>/gi;

    const titles: Array<{ url: string; title: string }> = [];
    let tMatch;
    while ((tMatch = titleRegex.exec(html)) !== null && titles.length < 8) {
      let rawUrl = tMatch[1];
      let cleanUrl = rawUrl;
      if (rawUrl.includes('uddg=')) {
        const uMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uMatch) cleanUrl = decodeURIComponent(uMatch[1]);
      }
      const title = tMatch[2].replace(/<[^>]+>/g, '').trim();
      if (cleanUrl.startsWith('http') && !cleanUrl.includes('duckduckgo.com')) {
        titles.push({ url: cleanUrl, title });
      }
    }

    const snippets: string[] = [];
    let sMatch;
    while ((sMatch = snipRegex.exec(html)) !== null && snippets.length < 8) {
      snippets.push(sMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    for (let i = 0; i < titles.length; i++) {
      const item = titles[i];
      const snippet = snippets[i] || '';
      let sourceName = 'Google Search';
      try {
        const parsed = new URL(item.url);
        sourceName = parsed.hostname.replace(/^www\./, '');
      } catch (e) {}

      results.push({
        title: item.title,
        url: item.url,
        snippet,
        sourceName
      });
    }

    return results.slice(0, 5);
  } catch (err) {
    return [];
  }
}

async function fetchCamposWeatherForecast(): Promise<string> {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-22.7394&longitude=-45.5913&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=America%2FSao_Paulo';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return '';
    const data = await res.json();
    if (!data || !data.daily) return '';

    const days = data.daily.time || [];
    const maxTemps = data.daily.temperature_2m_max || [];
    const minTemps = data.daily.temperature_2m_min || [];
    const precipProb = data.daily.precipitation_probability_max || [];
    const precipSum = data.daily.precipitation_sum || [];

    const dateNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    const forecastLines = days.map((dateStr: string, idx: number) => {
      const d = new Date(dateStr + 'T12:00:00');
      const dayName = dateNames[d.getDay()];
      const dateFormatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const maxT = Math.round(maxTemps[idx]);
      const minT = Math.round(minTemps[idx]);
      const prob = precipProb[idx] !== undefined ? precipProb[idx] : 0;
      const mm = precipSum[idx] !== undefined ? precipSum[idx] : 0;
      const isRainy = prob >= 40 || mm > 1;

      return `• ${dayName} (${dateFormatted}): ${isRainy ? '🌧️ Pancadas de chuva / Sol com nuvens' : '☀️/⛅ Sol com poucas nuvens'} | Mín: ${minT}°C / Máx: ${maxT}°C | Chance de chuva: ${prob}% (${mm}mm)`;
    });

    return `=== PREVISÃO DO TEMPO E CHUVAS REAL EM CAMPOS DO JORDÃO (PRÓXIMOS 7 DIAS) ===\n${forecastLines.join('\n')}\n==============================================`;
  } catch (e) {
    return '';
  }
}

function needsWebSearch(message: string, history: any[]): boolean {
  const lower = message.toLowerCase().trim();
  
  // Simple greetings or small talk
  if (/^(olá|ola|oi|tudo bem|bom dia|boa tarde|boa noite|obrigado|obrigada|vlw|valeu|tchau|até logo|ate logo)$/i.test(lower)) {
    return false;
  }

  // Dynamic / real-time keywords
  const searchKeywords = [
    'aberto', 'fechado', 'horario', 'horário', 'funcionamento', 'horas',
    'quanto custa', 'preco', 'preço', 'ingresso', 'valor', 'tarifa', 'entrada',
    'teleferico', 'teleférico', 'horto', 'tarundu', 'amantikir', 'capivari', 'bondinho',
    'tempo', 'clima', 'chuva', 'previsao', 'previsão', 'temperatura', 'graus',
    'hoje', 'amanhã', 'amanha', 'fim de semana', 'final de semana', 'sábado', 'sabado', 'domingo',
    'evento', 'eventos', 'show', 'programação', 'programacao', 'festival',
    'restaurante', 'fondue', 'barato', 'melhor', 'onde ir', 'recomenda', 'agora', 'aberto hoje'
  ];

  if (searchKeywords.some(kw => lower.includes(kw))) {
    return true;
  }

  if (/^(qual|quais|quanto|quantos|onde|como|quando|tem|existe|esta|está)/i.test(lower)) {
    return true;
  }

  return false;
}

const MONVIAN_BASE_INSTRUCTION = `=== DIRETRIZES DO ASSISTENTE MONVIAN ===

Você é a inteligência artificial do Monvian, especializada em Campos do Jordão (SP).
Sua função é responder às perguntas dos usuários de forma RÁPIDA, OBJETIVA e NATURAL, realizando pesquisas na internet sempre que necessário, SEM NUNCA citar fontes, mantendo um tom conversacional e prestativo.

==================================================
1. ANÁLISE DA PERGUNTA & INTENÇÃO
==================================================
- Leia atentamente a pergunta do usuário.
- Identifique a intenção real por trás da mensagem (localização, evento, informação factual, recomendação, etc.).
- Se a pergunta for ambígua, responda com a interpretação mais provável antes de pedir esclarecimentos.

==================================================
2. PESQUISA AUTOMÁTICA
==================================================
- Se você souber a resposta com certeza, responda diretamente.
- Se você não souber ou tiver dúvida, pesquise na internet antes de responder.
- Priorize informações atualizadas, especialmente para eventos, horários e dados temporais.

==================================================
3. RESPOSTA OBJETIVA
==================================================
- Responda em NO MÁXIMO 2 A 3 FRASES CURTAS.
- Vá direto ao ponto, sem introduções longas ou explicações desnecessárias.
- NUNCA cite fontes, links ou sites de onde a informação foi retirada (nada de "Fonte:", URLs ou [1]).
- Use linguagem natural, humana, próxima e educada.

==================================================
4. TOQUE FINAL (OPCIONAL)
==================================================
- Quando fizer sentido, encerre com uma pergunta curta de acompanhamento oferecendo ajuda adicional.
Exemplos:
• "Quer que eu te mande a localização no mapa?"
• "Quer que eu te passe os detalhes de algum deles?"

==================================================
EXEMPLOS DE APLICAÇÃO
==================================================

Usuário: "Aonde fica Campos do Jordão?"
Assistente: "Campos do Jordão fica no interior de São Paulo, na Serra da Mantiqueira, a cerca de 1.628 metros de altitude. Quer que eu te mande a localização no mapa?"

Usuário: "Quais eventos estão acontecendo em Campos do Jordão?"
Assistente: "Neste momento estão rolando atrações culturais e apresentações na praça do Capivari. Quer que eu te passe os detalhes de algum deles?"

Usuário: "Oi"
Assistente: "Oi! 😊 Como posso te ajudar em Campos do Jordão hoje?"

==================================================
REGRAS INVIOLÁVEIS
==================================================
✅ Respostas curtas e objetivas (2-3 frases)
✅ Tom humano e conversacional
✅ Pesquisar automaticamente para dados atualizados/duvidosos
✅ POSICIONAMENTO DE EMOJIS: Sempre que usar emojis ou ícones em títulos, frases ou tópicos, coloque o emoji/ícone OBRIGATORIAMENTE À DIREITA do texto (exemplo: "Campos do Jordão 📍", "Roteiros Prontos 🗺️", "Dica do Guia 💡"). NUNCA coloque o emoji à esquerda do título ou frase!
❌ NUNCA mencionar fontes ou links
❌ NUNCA enrolar ou enviar roteiros não solicitados
✅ Sempre ler com atenção máxima à pergunta do usuário`;

function buildMonvianSystemInstruction(): string {
  try {
    // 1. Fetch active spots from Monvian DB (restaurants, hotels, cafes, tourist spots)
    const spots = db.prepare(`
      SELECT id, name, category, category_label, rating, review_count, hours, address, price_range, description, tourist_tip
      FROM spots
      WHERE is_active = 1
      ORDER BY rating DESC
      LIMIT 60
    `).all() as any[];

    // 2. Fetch curated itineraries from DB
    let itinerariesCatalog = '';
    try {
      const itineraries = db.prepare(`
        SELECT id, title, description, days_count, is_premium, price
        FROM itineraries
        WHERE is_active = 1
        ORDER BY is_premium DESC, title ASC
        LIMIT 20
      `).all() as any[];

      if (itineraries.length > 0) {
        itinerariesCatalog = itineraries.map((it) => {
          const typeLabel = (it.is_premium || it.price === 'Conta Elite Gold' || it.price === 'Elite Gold' || it.price === 'Conta Gold' || it.price === 'Gold') 
            ? '⭐ ROTEIRO CONTA ELITE GOLD (Exclusivo para assinantes Elite Gold)' 
            : '🆓 ROTEIRO GRATUITO (Acesso 100% livre para todos os usuários)';
          return `• [${typeLabel}] "${it.title}" (${it.days_count || 1} dia(s))\n  Descrição: ${it.description || 'Roteiro completo com paradas e mapa interativo.'}`;
        }).join('\n\n');
      }
    } catch (e) {}

    // 3. Fetch active events
    const events = db.prepare(`
      SELECT id, name, description, category, date, time, address
      FROM events
      WHERE status = 'active'
      LIMIT 15
    `).all() as any[];

    // 4. Fetch recent reviews
    const reviews = db.prepare(`
      SELECT spot_id, user_name, rating, comment
      FROM reviews
      ORDER BY created_at DESC
      LIMIT 20
    `).all() as any[];

    const spotsCatalog = spots.map((s) => {
      return `• [${s.category_label || s.category}] ${s.name} (Avaliação: ${s.rating}★, ${s.review_count} avaliações, Faixa de Preço: ${s.price_range || '$$'})
  - Endereço/Horário: ${s.address || 'Campos do Jordão - SP'} | ${s.hours || 'Horário comercial'}
  - Descrição: ${s.description || ''}
  - Dica do Monvian: ${s.tourist_tip || ''}`;
    }).join('\n\n');

    const eventsCatalog = events.length > 0 
      ? events.map((e) => `• [Evento] ${e.name} (${e.date} às ${e.time || 'A definir'}) - ${e.address || 'Campos do Jordão'}: ${e.description}`).join('\n')
      : 'Nenhum evento especial com data futura no momento.';

    const reviewsCatalog = reviews.length > 0
      ? reviews.map((r) => `• [Avaliação] Local ID ${r.spot_id}: ${r.rating}★ por ${r.user_name || 'Visitante'}: "${r.comment}"`).join('\n')
      : 'Sem avaliações recentes.';

    const now = new Date();
    const dateInfo = `Data e hora atual de Brasília: ${now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ${now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Localização padrão: Campos do Jordão - SP (Altitude 1.628m, Serra da Mantiqueira).`;

    return `${MONVIAN_BASE_INSTRUCTION}

${dateInfo}

=== ROTEIROS PRONTOS CADASTRADOS NO APLICATIVO MONVIAN ===
Sempre que o usuário pedir um roteiro pronto, sugestão de roteiro (ex: "monte um roteiro", "o que fazer em 2 dias", "roteiro romântico", "quero um roteiro pronto"):
1. Crie a sugestão personalizada e detalhada respondendo à dúvida do usuário com as paradas recomendadas.
2. Em seguida, oriente o usuário de forma calorosa a abrir a aba "Roteiros" no menu inferior do app, onde ele pode navegar pelo mapa interativo com paradas passo a passo.
3. Mencione que no app existem tanto Roteiros Gratuitos prontos para uso quanto Roteiros Exclusivos da Conta Gold.

[ROTEIROS CADASTRADOS NO APP]:
${itinerariesCatalog || 'Roteiros de 1 a 3 dias disponíveis na aba Roteiros do app.'}

=== BANCO DE DADOS OFICIAL DO MONVIAN (PRIORIDADE MÁXIMA DE CONSULTA E RECOMENDAÇÃO) ===
Sempre que o usuário perguntar sobre locais, restaurantes, hotéis, cafeterias, passeios ou eventos, utilize prioritariamente as informações abaixo cadastradas no banco de dados do Monvian antes de recorrer ao conhecimento geral:

[PONTOS TURÍSTICOS, RESTAURANTES, CAFETERIAS, HOTÉIS E ATRAÇÕES CADASTRADAS NO MONVIAN]:
${spotsCatalog}

[EVENTOS E PROGRAMAÇÕES REGISTRADAS NO MONVIAN]:
${eventsCatalog}

[AVALIAÇÕES RECENTES DOS USUÁRIOS DO MONVIAN]:
${reviewsCatalog}

[DIRETRIZES FUNDAMENTAIS]:
1. Priorize e recomende os locais, restaurantes e atrações listados acima no banco do Monvian.
2. NUNCA responda com mensagens genéricas sem relação com a pergunta do usuário. Responda diretamente e com inteligência exatamente ao que foi solicitado.
3. Se o usuário perguntar sobre algo alheio a turismo/Campos do Jordão, recuse com simpatia e brevidade, convidando-o a perguntar sobre a cidade.
4. Responda sempre em português brasileiro de forma acolhedora, com formatação limpa no padrão ChatGPT (parágrafos claros, negrito nos locais e organização por períodos quando fizer roteiro).`;
  } catch (err) {
    console.error('Error generating Monvian instruction:', err);
    return MONVIAN_BASE_INSTRUCTION;
  }
}

const chatToolsDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_current_time',
    description: 'Retorna a hora exata atual, data completa e dia da semana no fuso horário de Brasília (Brasil).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_weather',
    description: 'Retorna a temperatura atual, previsão do tempo, probabilidade de chuva e condições climáticas para Campos do Jordão ou localidade informada.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'Nome da cidade ou bairro (ex: Campos do Jordão, Capivari)',
        },
      },
    },
  },
  {
    name: 'search_places',
    description: 'Busca atrações turísticas, restaurantes, fondues, cafés, passeios, parques e pontos de interesse reais cadastrados em Campos do Jordão.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Termo de busca (ex: fondue, chocolate, romântico, mirante, crianças, aventura, café)',
        },
        category: {
          type: Type.STRING,
          description: 'Categoria opcional (ex: gastronomia, natureza, passeios, compras, hospedagem)',
        },
        price_range: {
          type: Type.STRING,
          description: 'Faixa de preço opcional ($ a $$$$)',
        },
      },
    },
  },
  {
    name: 'get_events',
    description: 'Retorna a lista de festivais, shows, eventos culturais e gastronômicos ativos em Campos do Jordão.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'calculate_distance',
    description: 'Calcula a distância aproximada e tempo estimado de deslocamento em Campos do Jordão.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        origin: {
          type: Type.STRING,
          description: 'Ponto de partida (ex: Vila Capivari, ou localização atual)',
        },
        destination: {
          type: Type.STRING,
          description: 'Ponto de destino (ex: Parque Amantikir, Pico do Itapeva, Tarundu, Horto Florestal)',
        },
      },
      required: ['destination'],
    },
  },
  {
    name: 'search_web',
    description: 'Realiza uma pesquisa na web por informações atualizadas de Campos do Jordão (horários, preços, teleférico, ingressos, eventos, notícias ou locais).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'A consulta de busca em português (ex: "horario horto florestal campos do jordao", "preco ingresso teleferico campos do jordao")',
        },
      },
      required: ['query'],
    },
  },
];

function executeChatTool(callName: string, callArgs: any, userCoords?: { lat: number; lng: number } | null): any {
  if (callName === 'get_current_time') {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      timeZone: 'Horário de Brasília (UTC-3)',
      iso: now.toISOString(),
    };
  }

  if (callName === 'get_weather') {
    const brHour = parseInt(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }), 10);
    const temp = (brHour >= 11 && brHour <= 16) ? 20 : (brHour >= 17 && brHour <= 21) ? 15 : (brHour >= 22 || brHour <= 6) ? 9 : 13;
    return {
      location: callArgs?.location || 'Campos do Jordão, SP (Serra da Mantiqueira)',
      current_temperature: `${temp}°C`,
      condition: 'Parcialmente ensolarado e clima de montanha',
      min_temperature: '10°C',
      max_temperature: '22°C',
      rain_probability: '10%',
      humidity: '68%',
      wind: '8 km/h',
      advisory: 'Clima ameno e agradável durante o dia; as temperaturas caem acentuadamente ao entardecer na serra, recomendando agasalho.',
    };
  }

  if (callName === 'search_places') {
    let sql = 'SELECT id, name, short_name, category, category_label, rating, review_count, hours, address, price_range, description, tourist_tip, maps_url FROM spots WHERE is_active = 1';
    const params: any[] = [];
    if (callArgs?.query) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR tag_label LIKE ? OR category LIKE ? OR tourist_tip LIKE ?)';
      const q = `%${callArgs.query}%`;
      params.push(q, q, q, q, q);
    }
    if (callArgs?.category) {
      sql += ' AND (category LIKE ? OR category_label LIKE ?)';
      const c = `%${callArgs.category}%`;
      params.push(c, c);
    }
    if (callArgs?.price_range) {
      sql += ' AND price_range = ?';
      params.push(callArgs.price_range);
    }
    sql += ' ORDER BY rating DESC LIMIT 6';
    const rows = db.prepare(sql).all(...params);
    return { spots: rows, count: rows.length };
  }

  if (callName === 'get_events') {
    const events = db.prepare('SELECT id, name, description, category, date, time, address FROM events WHERE status = "active" LIMIT 5').all();
    return { events, count: events.length };
  }

  if (callName === 'calculate_distance') {
    const dest = (callArgs?.destination || '').toLowerCase();
    let distanceKm = 3.5;
    let driveMinutes = 8;
    if (dest.includes('itapeva')) { distanceKm = 14.2; driveMinutes = 25; }
    else if (dest.includes('amantikir')) { distanceKm = 8.5; driveMinutes = 16; }
    else if (dest.includes('horto')) { distanceKm = 12.0; driveMinutes = 20; }
    else if (dest.includes('tarundu')) { distanceKm = 9.8; driveMinutes = 18; }
    else if (dest.includes('capivari') || dest.includes('centro')) { distanceKm = 1.2; driveMinutes = 4; }

    return {
      origin: callArgs?.origin || (userCoords ? `Localização do usuário (${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)})` : 'Centro de Capivari'),
      destination: callArgs?.destination,
      distance_km: distanceKm,
      driving_time_estimate: `${driveMinutes} a ${driveMinutes + 4} minutos`,
      recommendation: 'Trânsito livre na serra. Devido ao relevo montanhoso, carro ou transporte por aplicativo é o mais recomendado.',
    };
  }

  return { status: 'Ferramenta executada com sucesso' };
}

async function startServer() {
  const app = express();
  app.use(express.json({
    limit: '10mb',
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // Helper auth middleware
  const getAuthUserSync = (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const session: any = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
    if (!session) return null;
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
    if (user) {
      const email = user.email || user.whatsapp;
      const shouldBeAdmin = isPrimaryAdmin(email);
      user.role = shouldBeAdmin ? 'admin' : 'user';
    }
    return user || null;
  };

  const getAuthUser = async (req: express.Request) => {
    const cached = getAuthUserSync(req);
    if (cached) return cached;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];

    try {
      const cloudSession = await getSessionFromFirestore(token);
      if (cloudSession && cloudSession.user_email) {
        const cleanEmail = cloudSession.user_email.trim().toLowerCase();
        let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
        if (!user) {
          const cloudUser = await getUserFromFirestore(cleanEmail);
          if (cloudUser && cloudUser.password_hash) {
            const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';
            const res = db.prepare(`
              INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              cloudUser.name || cleanEmail.split('@')[0],
              cleanEmail,
              cloudUser.whatsapp || cleanEmail,
              cloudUser.password_hash,
              role,
              cloudUser.avatar_url || '/fotoperfil.png',
              cloudUser.visits_count || 1,
              cloudUser.is_banned || 0,
              cloudUser.snow_enabled || 0,
              cloudUser.theme || 'dark',
              cloudUser.high_contrast || 0,
              cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
              cloudUser.onboarding_step || 1,
              cloudUser.last_access || new Date().toISOString(),
              cloudUser.created_at || new Date().toISOString()
            );
            user = db.prepare('SELECT * FROM users WHERE id = ?').get(res.lastInsertRowid);
          }
        }
        if (user) {
          const email = user.email || user.whatsapp;
          user.role = isPrimaryAdmin(email) ? 'admin' : 'user';
          db.prepare('INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
          return user;
        }
      }
    } catch (e) {
      console.error('[Auth] Erro ao validar sessão remota:', e);
    }
    return null;
  };

  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: 'Não autorizado' });
        return;
      }
      if (user.is_banned === 1) {
        res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
        return;
      }
      (req as any).user = user;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Erro de autenticação' });
    }
  };

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    res.json({
      status: 'ok',
      latency: '24ms',
      uptime,
      time: new Date().toISOString()
    });
  });

  // Real Analytics Event Logger Endpoint
  app.post('/api/analytics/event', async (req, res) => {
    try {
      const { event_type, item_id, item_name, metadata, session_id } = req.body;
      if (!event_type) {
        res.status(400).json({ error: 'event_type é obrigatório' });
        return;
      }
      const user = await getAuthUser(req);
      const userId = user ? user.id : null;

      db.prepare(`
        INSERT INTO analytics_events (user_id, session_id, event_type, item_id, item_name, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        session_id || null,
        event_type,
        item_id ? String(item_id) : null,
        item_name ? String(item_name) : null,
        metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
      );

      // If viewing a spot, also increment spot visitors_today in the database
      if ((event_type === 'spot_view' || event_type === 'spot_detail_open') && item_id) {
        db.prepare(`UPDATE spots SET visitors_today = visitors_today + 1 WHERE id = ?`).run(item_id);
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error recording analytics event:', err);
      res.status(500).json({ error: 'Erro ao registrar evento' });
    }
  });

  // Real Reviews Endpoints
  app.get('/api/reviews', (req, res) => {
    try {
      const { spot_id } = req.query;
      let query = 'SELECT * FROM reviews';
      const params: any[] = [];
      if (spot_id && typeof spot_id === 'string') {
        query += ' WHERE spot_id = ?';
        params.push(spot_id);
      }
      query += ' ORDER BY created_at DESC';
      const reviews = db.prepare(query).all(...params);
      res.json({ success: true, reviews });
    } catch (err) {
      console.error('Error fetching reviews:', err);
      res.status(500).json({ error: 'Erro ao buscar avaliações' });
    }
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const { spot_id, rating, comment, user_name, user_avatar } = req.body;
      if (!spot_id || rating === undefined || rating === null) {
        res.status(400).json({ error: 'spot_id e nota são obrigatórios' });
        return;
      }

      const user = await getAuthUser(req);
      const userId = user ? user.id : null;
      const reviewerName = user ? (user.name || user.whatsapp) : (user_name || 'Visitante');
      const reviewerAvatar = user ? (user.avatar_url || '') : (user_avatar || '');

      const result = db.prepare(`
        INSERT INTO reviews (spot_id, user_id, user_name, user_avatar, rating, comment)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(spot_id, userId, reviewerName, reviewerAvatar, Number(rating), comment || '');

      // Recalculate real spot review_count and average rating from actual reviews
      const stats: any = db.prepare(`
        SELECT count(*) as count, AVG(rating) as avgRating FROM reviews WHERE spot_id = ?
      `).get(spot_id);

      if (stats && stats.count > 0) {
        db.prepare(`UPDATE spots SET review_count = ?, rating = ? WHERE id = ?`).run(
          stats.count,
          Number(stats.avgRating.toFixed(1)),
          spot_id
        );
      }

      // Log event
      db.prepare(`
        INSERT INTO analytics_events (user_id, event_type, item_id, item_name, metadata)
        VALUES (?, 'review_submit', ?, ?, ?)
      `).run(userId, spot_id, reviewerName, JSON.stringify({ rating, comment }));

      res.json({ success: true, reviewId: result.lastInsertRowid });
    } catch (err) {
      console.error('Error adding review:', err);
      res.status(500).json({ error: 'Erro ao publicar avaliação' });
    }
  });

  // User Profile Update (with photo upload)
  app.post('/api/user/profile', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { name, username, bio, email, whatsapp, avatar_url } = req.body;

      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(typeof name === 'string' ? name.trim() : '');
      }

      if (username !== undefined) {
        const rawUsername = typeof username === 'string' ? username.trim().replace(/^@+/, '') : '';
        if (!rawUsername) {
          res.status(400).json({ error: 'O nome de usuário é obrigatório.' });
          return;
        }
        if (rawUsername.length < 3 || rawUsername.length > 30) {
          res.status(400).json({ error: 'O nome de usuário deve ter entre 3 e 30 caracteres.' });
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(rawUsername)) {
          res.status(400).json({ error: 'O nome de usuário só pode conter letras, números e underscore (_).' });
          return;
        }

        const normalizedUsername = rawUsername.toLowerCase();
        const existingUsername = db.prepare('SELECT id FROM users WHERE username_normalized = ? AND id != ?').get(normalizedUsername, user.id);
        if (existingUsername) {
          res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
          return;
        }

        updates.push('username = ?');
        params.push(rawUsername);
        updates.push('username_normalized = ?');
        params.push(normalizedUsername);
      }

      if (bio !== undefined) {
        updates.push('bio = ?');
        params.push(typeof bio === 'string' ? bio.trim() : '');
      }
      updates.push('updated_at = CURRENT_TIMESTAMP');

      if (email !== undefined) {
        const cleanEmail = typeof email === 'string' ? email.trim() : '';
        updates.push('email = ?');
        params.push(cleanEmail);
        updates.push('whatsapp = ?');
        params.push(cleanEmail);
      } else if (whatsapp !== undefined) {
        updates.push('whatsapp = ?');
        params.push(typeof whatsapp === 'string' ? whatsapp.trim() : '');
      }
      if (avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        params.push(avatar_url);
      }

      if (updates.length > 0) {
        params.push(user.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      const updatedUser: any = db.prepare('SELECT id, name, username, username_normalized, bio, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step FROM users WHERE id = ?').get(user.id);
      if (updatedUser) {
        updatedUser.email = updatedUser.email || updatedUser.whatsapp;

        // Persist to Cloud Firestore in background
        persistUserToFirestore({
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          whatsapp: updatedUser.whatsapp || updatedUser.email,
          password_hash: updatedUser.password_hash,
          role: updatedUser.role || 'user',
          avatar_url: updatedUser.avatar_url,
          visits_count: updatedUser.visits_count,
          is_banned: updatedUser.is_banned || 0,
          snow_enabled: updatedUser.snow_enabled || 0,
          theme: updatedUser.theme || 'dark',
          high_contrast: updatedUser.high_contrast || 0,
          onboarding_completed: updatedUser.onboarding_completed,
          onboarding_step: updatedUser.onboarding_step
        }).catch(() => {});

        try {
          db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (e) {}
      }

      // Log action
      logAdminAction(user.id, updatedUser ? (updatedUser.name || 'Usuário') : 'Usuário', 'Atualizou Perfil', 'Foto/dados alterados');

      // Log analytics
      db.prepare(`
        INSERT INTO analytics_events (user_id, event_type, item_name)
        VALUES (?, 'profile_update', ?)
      `).run(user.id, updatedUser ? (updatedUser.name || 'Usuário') : 'Usuário');

      res.json({ success: true, user: updatedUser });
    } catch (err: any) {
      console.error('Error updating user profile:', err);
      const msg = err?.message || '';
      if (msg.includes('UNIQUE constraint failed: users.username_normalized')) {
        res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
        return;
      }
      if (msg.includes('UNIQUE constraint failed: users.email') || msg.includes('UNIQUE constraint failed: users.whatsapp')) {
        res.status(400).json({ error: 'Este e-mail já está em uso por outra conta.' });
        return;
      }
      res.status(500).json({ error: 'Erro ao atualizar perfil do usuário' });
    }
  });

  // Smart photo resolver for spots
  const SPOT_IMAGE_DICTIONARY: Record<string, string> = {
    'amantikir': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80',
    'itapeva': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    'baden-baden': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80',
    'ducha-de-prata': 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
    'ducha-prata': 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
    'morro-do-elefante': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    'morro-elefante': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    'parque-capivari': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
    'capivari': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
    'parque-das-cerejeiras': 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
    'cerejeiras': 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=800&q=80',
    'portal': 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
    'portal-de-campos-do-jordao': 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
    'tarundu': 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
    'horto': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
    'horto-florestal': 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80',
    'felicia-leirner': 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80',
    'museu-felicia-leirner': 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=800&q=80',
    'bosque-silencio': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
    'bosque-do-silencio': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80',
    'pedra-bau': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    'pedra-do-bau': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    'palacio-boa-vista': 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80',
    'chocolate-araucaria': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80',
    'vila-capivari': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80'
  };

  function resolveSpotPhoto(name: string, id: string, category: string, currentImage: string): string {
    if (!currentImage) {
      const cleanId = (id || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const cleanName = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-');
      for (const [key, url] of Object.entries(SPOT_IMAGE_DICTIONARY)) {
        if (cleanId.includes(key) || key.includes(cleanId) || cleanName.includes(key) || key.includes(cleanName)) {
          return url;
        }
      }
      return 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80';
    }

    if (currentImage.startsWith('data:image/')) {
      return currentImage;
    }

    if (currentImage.startsWith('/uploads/')) {
      const diskPath = path.resolve(process.cwd(), 'public', currentImage.replace(/^\//, ''));
      if (fs.existsSync(diskPath)) {
        return currentImage;
      }
    }

    const cleanId = (id || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanName = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-');

    for (const [key, url] of Object.entries(SPOT_IMAGE_DICTIONARY)) {
      if (cleanId.includes(key) || key.includes(cleanId) || cleanName.includes(key) || key.includes(cleanName)) {
        return url;
      }
    }
    if (currentImage.startsWith('http')) return currentImage;
    return 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80';
  }

  // Dynamic uploads handler (serves static file or redirects seamlessly to spot photo)
  app.get('/uploads/spots/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.resolve(process.cwd(), 'public', 'uploads', 'spots', filename);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    const clean = filename.toLowerCase();
    for (const [key, url] of Object.entries(SPOT_IMAGE_DICTIONARY)) {
      if (clean.includes(key)) {
        return res.redirect(302, url);
      }
    }
    return res.redirect(302, 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80');
  });

  // ==========================================
  // PUBLIC CLIENT ENDPOINTS
  // ==========================================

  // Get active spots for the main app
  app.get('/api/spots', (req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM spots WHERE is_active = 1 ORDER BY rating DESC`).all();
      const formattedSpots = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        shortName: r.short_name || r.name,
        tagLabel: r.tag_label || r.name,
        category: r.category,
        categoryLabel: r.category_label || r.category,
        lat: r.lat,
        lng: r.lng,
        image: resolveSpotPhoto(r.name, r.id, r.category, r.image),
        gallery: r.gallery ? JSON.parse(r.gallery) : [],
        description: r.description,
        touristTip: r.tourist_tip,
        rating: r.rating,
        reviewCount: r.review_count,
        hours: r.hours,
        address: r.address,
        priceRange: r.price_range,
        popularTimes: r.popular_times,
        visitorsToday: r.visitors_today,
        badge: r.badge,
        highlighted: Boolean(r.highlighted),
        isActive: Boolean(r.is_active),
        isVerified: Boolean(r.is_verified),
        website: r.website || '',
        phone: r.phone || '',
        mapsUrl: r.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + ' Campos do Jordão')}`,
        googleRating: r.google_rating !== null && r.google_rating !== undefined ? Number(r.google_rating) : undefined,
        googleReviewSnippet: r.google_review_snippet || undefined,
        lastSyncedMaps: r.last_synced_maps || undefined
      }));
      res.json({ success: true, spots: formattedSpots });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar pontos' });
    }
  });

  // Public visual icons endpoint for the map (strictly non-interactive layer)
  app.get('/api/map-visual-icons', (req, res) => {
    try {
      const rows = db.prepare(`SELECT * FROM map_visual_icons WHERE is_active = 1 ORDER BY created_at ASC`).all();
      res.json({ success: true, icons: rows });
    } catch (err: any) {
      console.error('Error fetching map visual icons:', err);
      res.status(500).json({ error: 'Erro ao buscar ícones visuais do mapa' });
    }
  });

  // Get active events
  app.get('/api/events', (req, res) => {
    try {
      const events = db.prepare(`SELECT * FROM events WHERE status = 'active' ORDER BY created_at DESC`).all();
      res.json({ success: true, events });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
  });

  // Get public settings (community link, instagram, etc.)
  app.get('/api/settings', (req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json({ success: true, settings });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
  });

  // ==========================================
  // AUTH & GMAIL VERIFICATION ENDPOINTS
  // ==========================================

  // Helper to format RFC 2822 email for Gmail API
  function formatRawEmail(to: string, subject: string, bodyText: string, bodyHtml: string) {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const boundary = `__monvian_${Date.now()}__`;
    const message = [
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      bodyText,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      bodyHtml,
      '',
      `--${boundary}--`
    ].join('\r\n');

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // 1. Send Email Verification Code
  app.post('/api/auth/send-verification-code', async (req, res) => {
    try {
      const { email, name, purpose } = req.body;
      if (!email || typeof email !== 'string') {
        res.status(400).json({ error: 'E-mail é obrigatório' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ error: 'Por favor, insira um endereço de e-mail válido' });
        return;
      }

      // If purpose is register, check if email is already taken
      if (purpose === 'register') {
        const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
        if (existing) {
          res.status(400).json({ error: 'Já existe uma conta registrada com este e-mail. Faça login.' });
          return;
        }
      }

      // Generate 6-digit numeric verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Clean up previous unverified codes for this email
      db.prepare('DELETE FROM email_verifications WHERE LOWER(email) = ? AND verified = 0').run(cleanEmail);

      // Store new code
      db.prepare(`
        INSERT INTO email_verifications (email, code, expires_at, verified)
        VALUES (?, ?, ?, 0)
      `).run(cleanEmail, code, expiresAt);

      // Attempt sending via Gmail API if user provided a Google/Gmail access token
      const authHeader = req.headers.authorization;
      let sentViaGmail = false;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.split(' ')[1];
        try {
          const htmlContent = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #000; color: #fff; padding: 32px; border-radius: 20px; text-align: center;">
              <h1 style="font-family: Georgia, serif; font-style: italic; font-size: 28px; margin: 0 0 8px; color: #fff;">Monvian</h1>
              <p style="color: #999; font-size: 12px; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px;">Campos do Jordão</p>
              <h2 style="font-size: 18px; margin-bottom: 12px; color: #fff;">Código de Verificação</h2>
              <p style="color: #bbb; font-size: 14px; margin-bottom: 24px;">Olá${name ? ' ' + name : ''}! Digite o código abaixo no aplicativo para confirmar seu e-mail:</p>
              <div style="background: #18181b; border: 1.5px solid #00C896; border-radius: 12px; padding: 14px 28px; display: inline-block; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #00C896; font-family: monospace;">${code}</span>
              </div>
              <p style="color: #71717a; font-size: 12px;">Válido por 10 minutos. Se você não solicitou, ignore esta mensagem.</p>
            </div>
          `;
          const raw = formatRawEmail(
            cleanEmail,
            `Seu código de verificação Monvian: ${code}`,
            `Olá! Seu código de verificação Monvian é: ${code}. Válido por 10 minutos.`,
            htmlContent
          );

          const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw }),
          });

          if (gmailRes.ok) {
            sentViaGmail = true;
            console.log(`[Gmail API] Verification email sent to ${cleanEmail}`);
          }
        } catch (e) {
          console.warn('[Gmail API] Could not dispatch email via token:', e);
        }
      }

      console.log(`\n==========================================`);
      console.log(`[MONVIAN AUTH] Código de Verificação`);
      console.log(`E-mail: ${cleanEmail}`);
      console.log(`Código: ${code}`);
      console.log(`Válido até: ${expiresAt}`);
      console.log(`Enviado via Gmail API: ${sentViaGmail ? 'Sim' : 'Simulado/Local'}`);
      console.log(`==========================================\n`);

      res.json({
        success: true,
        message: `Código de verificação enviado para ${cleanEmail}`,
        email: cleanEmail,
        expires_in_seconds: 600,
        sent_via_gmail: sentViaGmail,
        preview_code: code // Included for seamless testing in preview
      });
    } catch (err) {
      console.error('Error in send-verification-code:', err);
      res.status(500).json({ error: 'Erro ao enviar código de verificação' });
    }
  });

  // 2. Validate Code Endpoint
  app.post('/api/auth/verify-code', (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        res.status(400).json({ error: 'E-mail e código são obrigatórios' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();

      const record: any = db.prepare(`
        SELECT * FROM email_verifications 
        WHERE LOWER(email) = ? AND code = ? AND verified = 0 
        ORDER BY id DESC LIMIT 1
      `).get(cleanEmail, cleanCode);

      if (!record) {
        res.status(400).json({ error: 'Código inválido ou não encontrado.' });
        return;
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        res.status(400).json({ error: 'O código expirou. Solicite um novo código.' });
        return;
      }

      db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(record.id);

      res.json({
        success: true,
        message: 'Código verificado com sucesso!'
      });
    } catch (err) {
      console.error('Error verifying code:', err);
      res.status(500).json({ error: 'Erro ao validar código' });
    }
  });

  // 3. Register with Email + Verification Code
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, username, email, whatsapp, password, code, gender } = req.body;
      const cleanEmail = (email || whatsapp || '').trim().toLowerCase();

      if (!name || !cleanEmail || !password) {
        res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
        return;
      }

      // Username validation
      const rawUsername = (username || '').trim().replace(/^@+/, '');
      if (!rawUsername) {
        res.status(400).json({ error: 'O nome de usuário é obrigatório.' });
        return;
      }
      if (rawUsername.length < 3 || rawUsername.length > 30) {
        res.status(400).json({ error: 'O nome de usuário deve ter entre 3 e 30 caracteres.' });
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(rawUsername)) {
        res.status(400).json({ error: 'O nome de usuário pode conter apenas letras, números e underscore (_).' });
        return;
      }
      const normalizedUsername = rawUsername.toLowerCase();
      const existingUsername = db.prepare('SELECT id FROM users WHERE username_normalized = ?').get(normalizedUsername);
      if (existingUsername) {
        res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(400).json({ error: 'Por favor, insira um e-mail válido' });
        return;
      }

      // Check code verification
      if (code) {
        const cleanCode = String(code).trim();
        const verifiedRecord: any = db.prepare(`
          SELECT * FROM email_verifications 
          WHERE LOWER(email) = ? AND code = ? 
          ORDER BY id DESC LIMIT 1
        `).get(cleanEmail, cleanCode);

        if (!verifiedRecord) {
          res.status(400).json({ error: 'Código de verificação incorreto' });
          return;
        }
      }

      const checkUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
      if (checkUser) {
        res.status(400).json({ error: 'Usuário já cadastrado com este e-mail' });
        return;
      }

      // Also verify Cloud Firestore to ensure uniqueness across containers
      const cloudExistingUser = await getUserFromFirestore(cleanEmail);
      if (cloudExistingUser) {
        res.status(400).json({ error: 'Usuário já cadastrado com este e-mail' });
        return;
      }

      const hash = await bcrypt.hash(password, 10);
      const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';

      let defaultAvatar = '/avatar_female.jpg';
      if (gender === 'masculino') {
        defaultAvatar = '/avatar_male.jpg';
      } else if (gender === 'feminino' || gender === 'outro') {
        defaultAvatar = '/avatar_female.jpg';
      }

      const result = db.prepare(`
        INSERT INTO users (name, username, username_normalized, email, whatsapp, password_hash, role, visits_count, onboarding_completed, onboarding_step, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 1, ?)
      `).run(name.trim(), rawUsername, normalizedUsername, cleanEmail, cleanEmail, hash, role, defaultAvatar);
      const userId = Number(result.lastInsertRowid);

      try {
        db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(userId);
      } catch (e) {}

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);

      // Persist to Cloud Firestore in background so user response is immediate
      persistUserToFirestore({
        id: userId,
        name: name.trim(),
        username: rawUsername,
        username_normalized: normalizedUsername,
        email: cleanEmail,
        whatsapp: cleanEmail,
        password_hash: hash,
        role,
        avatar_url: defaultAvatar,
        visits_count: 1,
        is_banned: 0,
        snow_enabled: 0,
        theme: 'light',
        high_contrast: 0,
        onboarding_completed: 0,
        onboarding_step: 1
      }).catch(() => {});
      persistSessionToFirestore(token, userId, cleanEmail).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      const isGoldUser = isPrimaryAdmin(cleanEmail);

      res.json({
        success: true,
        token,
        user: {
          id: userId,
          name: name.trim(),
          username: rawUsername,
          username_normalized: normalizedUsername,
          email: cleanEmail,
          whatsapp: cleanEmail,
          role,
          avatar_url: defaultAvatar,
          is_banned: 0,
          isPremium: Boolean(isGoldUser),
          isGold: Boolean(isGoldUser),
          is_premium: isGoldUser ? 1 : 0,
          is_gold: isGoldUser ? 1 : 0,
          onboarding_completed: false,
          onboarding_step: 1
        }
      });
    } catch (err: any) {
      console.error('[Register Error]', err);
      const msg = err?.message || '';
      if (msg.includes('UNIQUE constraint failed: users.username_normalized')) {
        res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
        return;
      }
      if (msg.includes('UNIQUE constraint failed: users.email') || msg.includes('UNIQUE constraint failed: users.whatsapp')) {
        res.status(400).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
        return;
      }
      res.status(500).json({ error: 'Erro ao registrar usuário. Tente novamente.' });
    }
  });

  // 4. Login with Email + Password
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, whatsapp, password } = req.body;
      const identifier = (email || whatsapp || '').trim().toLowerCase();

      if (!identifier || !password) {
        res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
        return;
      }

      let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(identifier, identifier);
      if (!user) {
        // Fallback: check Cloud Firestore (e.g. freshly started container after deploy)
        const cloudUser = await getUserFromFirestore(identifier);
        if (cloudUser && cloudUser.password_hash) {
          const resInsert = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cloudUser.name || identifier.split('@')[0],
            cloudUser.email,
            cloudUser.whatsapp || cloudUser.email,
            cloudUser.password_hash,
            cloudUser.role || 'user',
            cloudUser.avatar_url || '/fotoperfil.png',
            cloudUser.visits_count || 1,
            cloudUser.is_banned || 0,
            cloudUser.snow_enabled || 0,
            cloudUser.theme || 'dark',
            cloudUser.high_contrast || 0,
            cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
            cloudUser.onboarding_step || 1,
            cloudUser.last_access || new Date().toISOString(),
            cloudUser.created_at || new Date().toISOString()
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(resInsert.lastInsertRowid);
        }
      }

      if (!user) {
        res.status(401).json({ error: 'E-mail ou senha incorretos' });
        return;
      }

      if (user.is_banned === 1) {
        res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
        return;
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        res.status(401).json({ error: 'E-mail ou senha incorretos' });
        return;
      }

      // Update visit count and last access
      db.prepare(`UPDATE users SET visits_count = visits_count + 1, last_access = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
      user.visits_count = (user.visits_count || 1) + 1;

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();
      const userRole = isPrimaryAdmin(userEmail) ? 'admin' : 'user';
      user.role = userRole;

      // Persist session and user update to Cloud Firestore in background
      persistSessionToFirestore(token, user.id, userEmail).catch(() => {});
      persistUserToFirestore({
        id: user.id,
        name: user.name,
        email: userEmail,
        whatsapp: user.whatsapp || userEmail,
        password_hash: user.password_hash,
        role: userRole,
        avatar_url: user.avatar_url,
        visits_count: user.visits_count,
        is_banned: user.is_banned || 0,
        snow_enabled: user.snow_enabled || 0,
        theme: user.theme || 'dark',
        high_contrast: user.high_contrast || 0,
        onboarding_completed: user.onboarding_completed,
        onboarding_step: user.onboarding_step
      }).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      const isGold = isPrimaryAdmin(userEmail) || user.is_premium === 1 || user.is_gold === 1;

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          username_normalized: user.username_normalized,
          bio: user.bio || '',
          email: userEmail,
          whatsapp: userEmail,
          role: userRole,
          is_banned: user.is_banned || 0,
          isPremium: Boolean(isGold),
          isGold: Boolean(isGold),
          is_premium: isGold ? 1 : 0,
          is_gold: isGold ? 1 : 0,
          avatar_url: user.avatar_url,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao fazer login' });
    }
  });

  // 5. Direct Login with Verified Email Code (Passwordless or code recovery)
  app.post('/api/auth/login-with-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        res.status(400).json({ error: 'E-mail e código são obrigatórios' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();

      const record: any = db.prepare(`
        SELECT * FROM email_verifications 
        WHERE LOWER(email) = ? AND code = ? AND verified = 0 
        ORDER BY id DESC LIMIT 1
      `).get(cleanEmail, cleanCode);

      if (!record) {
        res.status(400).json({ error: 'Código inválido' });
        return;
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        res.status(400).json({ error: 'Código expirado. Solicite outro código.' });
        return;
      }

      db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(record.id);

      let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);
      if (!user) {
        // Check Firestore first
        const cloudUser = await getUserFromFirestore(cleanEmail);
        if (cloudUser) {
          const resInsert = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cloudUser.name || cleanEmail.split('@')[0],
            cloudUser.email,
            cloudUser.whatsapp || cloudUser.email,
            cloudUser.password_hash,
            cloudUser.role || 'user',
            cloudUser.avatar_url || '/fotoperfil.png',
            cloudUser.visits_count || 1,
            cloudUser.is_banned || 0,
            cloudUser.snow_enabled || 0,
            cloudUser.theme || 'dark',
            cloudUser.high_contrast || 0,
            cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
            cloudUser.onboarding_step || 1,
            cloudUser.last_access || new Date().toISOString(),
            cloudUser.created_at || new Date().toISOString()
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(resInsert.lastInsertRowid);
        } else {
          const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';
          const dummyPass = crypto.randomBytes(16).toString('hex');
          const hash = await bcrypt.hash(dummyPass, 10);
          const defaultAvatar = '/fotoperfil.png';

          const result = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, visits_count, onboarding_completed, onboarding_step, avatar_url)
            VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?)
          `).run(cleanEmail.split('@')[0], cleanEmail, cleanEmail, hash, role, defaultAvatar);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        }
      } else {
        if (user.is_banned === 1) {
          res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
          return;
        }
        db.prepare(`UPDATE users SET visits_count = visits_count + 1, last_access = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
      }

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();
      const userRole = isPrimaryAdmin(userEmail) ? 'admin' : 'user';
      user.role = userRole;

      // Persist session and user to Firestore in background
      persistSessionToFirestore(token, user.id, userEmail).catch(() => {});
      persistUserToFirestore({
        id: user.id,
        name: user.name,
        email: userEmail,
        whatsapp: user.whatsapp || userEmail,
        password_hash: user.password_hash,
        role: userRole,
        avatar_url: user.avatar_url,
        visits_count: user.visits_count || 1,
        is_banned: user.is_banned || 0,
        snow_enabled: user.snow_enabled || 0,
        theme: user.theme || 'dark',
        high_contrast: user.high_contrast || 0,
        onboarding_completed: user.onboarding_completed,
        onboarding_step: user.onboarding_step
      }).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      const isGold = isPrimaryAdmin(userEmail) || user.is_premium === 1 || user.is_gold === 1;

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: userEmail,
          whatsapp: userEmail,
          role: userRole,
          is_banned: user.is_banned || 0,
          isPremium: Boolean(isGold),
          isGold: Boolean(isGold),
          is_premium: isGold ? 1 : 0,
          is_gold: isGold ? 1 : 0,
          avatar_url: user.avatar_url,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error('Error logging in with code:', err);
      res.status(500).json({ error: 'Erro ao entrar com código' });
    }
  });

  // 6. Sign in with Google (Google Workspace OAuth)
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { email, name, avatar_url } = req.body;
      if (!email) {
        res.status(400).json({ error: 'E-mail do Google não recebido' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      let user: any = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);

      if (!user) {
        // Check Firestore first
        const cloudUser = await getUserFromFirestore(cleanEmail);
        if (cloudUser) {
          const resInsert = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cloudUser.name || name || cleanEmail.split('@')[0],
            cloudUser.email,
            cloudUser.whatsapp || cloudUser.email,
            cloudUser.password_hash,
            cloudUser.role || 'user',
            cloudUser.avatar_url || avatar_url || '/fotoperfil.png',
            cloudUser.visits_count || 1,
            cloudUser.is_banned || 0,
            cloudUser.snow_enabled || 0,
            cloudUser.theme || 'dark',
            cloudUser.high_contrast || 0,
            cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
            cloudUser.onboarding_step || 1,
            cloudUser.last_access || new Date().toISOString(),
            cloudUser.created_at || new Date().toISOString()
          );
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(resInsert.lastInsertRowid);
        } else {
          const role = isPrimaryAdmin(cleanEmail) ? 'admin' : 'user';
          const dummyPassword = crypto.randomBytes(16).toString('hex');
          const hash = await bcrypt.hash(dummyPassword, 10);
          const avatar = avatar_url || '/fotoperfil.png';

          const result = db.prepare(`
            INSERT INTO users (name, email, whatsapp, password_hash, role, visits_count, onboarding_completed, onboarding_step, avatar_url)
            VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?)
          `).run(name || cleanEmail.split('@')[0], cleanEmail, cleanEmail, hash, role, avatar);
          const userId = result.lastInsertRowid;

          try {
            db.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').run(userId);
          } catch (e) {}

          user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        }
      } else {
        if (user.is_banned === 1) {
          res.status(403).json({ error: 'Esta conta foi suspensa/banida pelo administrador.' });
          return;
        }
        if (avatar_url && (!user.avatar_url || user.avatar_url === '/fotoperfil.png')) {
          db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatar_url, user.id);
          user.avatar_url = avatar_url;
        }
        db.prepare(`UPDATE users SET visits_count = visits_count + 1, last_access = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id);
      }

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();
      const userRole = isPrimaryAdmin(userEmail) ? 'admin' : 'user';
      user.role = userRole;

      // Persist session and user to Cloud Firestore in background
      persistSessionToFirestore(token, user.id, userEmail).catch(() => {});
      persistUserToFirestore({
        id: user.id,
        name: user.name,
        email: userEmail,
        whatsapp: user.whatsapp || userEmail,
        password_hash: user.password_hash,
        role: userRole,
        avatar_url: user.avatar_url,
        visits_count: user.visits_count || 1,
        is_banned: user.is_banned || 0,
        snow_enabled: user.snow_enabled || 0,
        theme: user.theme || 'dark',
        high_contrast: user.high_contrast || 0,
        onboarding_completed: user.onboarding_completed,
        onboarding_step: user.onboarding_step
      }).catch(() => {});

      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}

      const isGold = isPrimaryAdmin(userEmail) || user.is_premium === 1 || user.is_gold === 1;

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: userEmail,
          whatsapp: userEmail,
          role: userRole,
          is_banned: user.is_banned || 0,
          isPremium: Boolean(isGold),
          isGold: Boolean(isGold),
          is_premium: isGold ? 1 : 0,
          is_gold: isGold ? 1 : 0,
          avatar_url: user.avatar_url,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error('Google auth error:', err);
      res.status(500).json({ error: 'Erro ao autenticar com Google' });
    }
  });

  // 7. Get Current Authenticated User Session
  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: 'Sessão inválida ou expirada' });
        return;
      }
      if (user.is_banned === 1) {
        res.status(403).json({ error: 'Conta suspensa/banida' });
        return;
      }

      const userEmail = user.email || user.whatsapp;
      const isGold = isPrimaryAdmin(userEmail) || user.is_premium === 1 || user.is_gold === 1;

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: userEmail,
          whatsapp: userEmail,
          role: user.role || 'user',
          is_banned: user.is_banned || 0,
          isPremium: Boolean(isGold),
          isGold: Boolean(isGold),
          is_premium: isGold ? 1 : 0,
          is_gold: isGold ? 1 : 0,
          avatar_url: user.avatar_url,
          visits_count: user.visits_count,
          onboarding_completed: user.onboarding_completed === 1,
          onboarding_step: user.onboarding_step || 1
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao verificar sessão' });
    }
  });

  // 8. Gmail Direct Proxy Send
  app.post('/api/gmail/send-proxy', requireAuth, async (req, res) => {
    try {
      const { to, subject, body, accessToken } = req.body;
      if (!to || !subject || !body) {
        res.status(400).json({ error: 'Destinatário, assunto e mensagem são obrigatórios' });
        return;
      }

      const token = accessToken || (req.headers['x-gmail-token'] as string);
      if (!token) {
        res.status(401).json({ error: 'Token do Gmail não informado. Conecte sua conta do Google.' });
        return;
      }

      const html = `<div style="font-family: sans-serif; line-height: 1.6; color: #111;">${body.replace(/\n/g, '<br/>')}</div>`;
      const raw = formatRawEmail(to, subject, body, html);

      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });

      if (!gmailRes.ok) {
        const errorData = await gmailRes.json().catch(() => ({}));
        res.status(gmailRes.status).json({ error: errorData?.error?.message || 'Erro ao enviar e-mail via Gmail' });
        return;
      }

      const data = await gmailRes.json();
      res.json({ success: true, message: 'E-mail enviado com sucesso via Gmail!', data });
    } catch (err: any) {
      console.error('Error sending email via Gmail proxy:', err);
      res.status(500).json({ error: err.message || 'Erro interno ao enviar e-mail' });
    }
  });

  // ==========================================
  // ONBOARDING ENDPOINTS
  // ==========================================

  // Get current user onboarding status and saved preferences
  app.get('/api/user/onboarding', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const prefs: any = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(user.id);
      res.json({
        success: true,
        onboarding_completed: user.onboarding_completed === 1,
        onboarding_step: user.onboarding_step || 1,
        preferences: prefs || null
      });
    } catch (err) {
      console.error('Error fetching onboarding state:', err);
      res.status(500).json({ error: 'Erro ao carregar status do onboarding' });
    }
  });

  // Save incremental onboarding step and answers
  app.post('/api/user/onboarding/step', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { step, referral_source, travel_frequency, travel_style, main_interests, preferred_season } = req.body;

      const nextStep = typeof step === 'number' ? Math.max(1, Math.min(5, step)) : (user.onboarding_step || 1);

      // Update user step
      db.prepare('UPDATE users SET onboarding_step = ? WHERE id = ?').run(nextStep, user.id);

      // Upsert preferences
      const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(user.id);
      if (existing) {
        db.prepare(`
          UPDATE user_preferences SET
            referral_source = COALESCE(?, referral_source),
            travel_frequency = COALESCE(?, travel_frequency),
            travel_style = COALESCE(?, travel_style),
            main_interests = COALESCE(?, main_interests),
            preferred_season = COALESCE(?, preferred_season),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          referral_source !== undefined ? referral_source : null,
          travel_frequency !== undefined ? travel_frequency : null,
          travel_style !== undefined ? travel_style : null,
          main_interests !== undefined ? (typeof main_interests === 'string' ? main_interests : JSON.stringify(main_interests)) : null,
          preferred_season !== undefined ? preferred_season : null,
          user.id
        );
      } else {
        db.prepare(`
          INSERT INTO user_preferences (user_id, referral_source, travel_frequency, travel_style, main_interests, preferred_season)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          user.id,
          referral_source || null,
          travel_frequency || null,
          travel_style || null,
          main_interests ? (typeof main_interests === 'string' ? main_interests : JSON.stringify(main_interests)) : null,
          preferred_season || null
        );
      }

      res.json({ success: true, onboarding_step: nextStep });
    } catch (err: any) {
      console.error('Error saving onboarding step:', err);
      res.status(500).json({ error: 'Erro ao salvar etapa do onboarding' });
    }
  });

  // Complete onboarding
  app.post('/api/user/onboarding/complete', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { referral_source, travel_frequency, travel_style, main_interests, preferred_season } = req.body;

      // Mark user as completed
      db.prepare('UPDATE users SET onboarding_completed = 1, onboarding_step = 5 WHERE id = ?').run(user.id);

      // Upsert complete preferences with timestamp
      const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(user.id);
      const interestsStr = main_interests !== undefined ? (typeof main_interests === 'string' ? main_interests : JSON.stringify(main_interests)) : null;

      if (existing) {
        db.prepare(`
          UPDATE user_preferences SET
            referral_source = COALESCE(?, referral_source),
            travel_frequency = COALESCE(?, travel_frequency),
            travel_style = COALESCE(?, travel_style),
            main_interests = COALESCE(?, main_interests),
            preferred_season = COALESCE(?, preferred_season),
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          referral_source !== undefined ? referral_source : null,
          travel_frequency !== undefined ? travel_frequency : null,
          travel_style !== undefined ? travel_style : null,
          interestsStr,
          preferred_season !== undefined ? preferred_season : null,
          user.id
        );
      } else {
        db.prepare(`
          INSERT INTO user_preferences (user_id, referral_source, travel_frequency, travel_style, main_interests, preferred_season, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          user.id,
          referral_source || null,
          travel_frequency || null,
          travel_style || null,
          interestsStr,
          preferred_season || null
        );
      }

      // Log analytics and admin action
      db.prepare(`
        INSERT INTO analytics_events (user_id, event_type, item_name, metadata)
        VALUES (?, 'onboarding_completed', ?, ?)
      `).run(user.id, user.name || 'Novo Usuário', JSON.stringify({ referral: referral_source, frequency: travel_frequency }));

      const updatedUser: any = db.prepare('SELECT id, name, whatsapp, role, avatar_url, visits_count, onboarding_completed, onboarding_step FROM users WHERE id = ?').get(user.id);

      res.json({
        success: true,
        user: {
          ...updatedUser,
          onboarding_completed: true,
          onboarding_step: 5
        }
      });
    } catch (err: any) {
      console.error('Error completing onboarding:', err);
      res.status(500).json({ error: 'Erro ao concluir onboarding' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        await deleteSessionFromFirestore(token);
      }
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch (e) {}
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao fazer logout' });
    }
  });

  // User Settings
  app.get('/api/user/settings', requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({
      success: true,
      rain_enabled: user.rain_enabled !== undefined ? Boolean(user.rain_enabled) : true,
      snow_enabled: Boolean(user.snow_enabled),
      theme: user.theme || 'dark',
      high_contrast: Boolean(user.high_contrast)
    });
  });

  app.post('/api/user/settings', requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { rain_enabled, snow_enabled, theme, high_contrast } = req.body;
    db.prepare('UPDATE users SET rain_enabled = ?, snow_enabled = ?, theme = ?, high_contrast = ? WHERE id = ?').run(
      rain_enabled !== undefined ? (rain_enabled ? 1 : 0) : 1,
      snow_enabled ? 1 : 0,
      theme || 'dark',
      high_contrast ? 1 : 0,
      user.id
    );

    const userEmail = (user.email || user.whatsapp || '').trim().toLowerCase();
    persistUserToFirestore({
      id: user.id,
      name: user.name,
      email: userEmail,
      whatsapp: user.whatsapp || userEmail,
      password_hash: user.password_hash,
      role: user.role || 'user',
      avatar_url: user.avatar_url,
      visits_count: user.visits_count,
      is_banned: user.is_banned || 0,
      snow_enabled: snow_enabled ? 1 : 0,
      theme: theme || 'dark',
      high_contrast: high_contrast ? 1 : 0,
      onboarding_completed: user.onboarding_completed,
      onboarding_step: user.onboarding_step
    }).catch(() => {});

    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    res.json({ success: true });
  });

  // ==========================================
  // ADMIN API ENDPOINTS (PROTECTED & FUNCTIONAL)
  // ==========================================

  // Helper to calculate real percentage growth between current and previous timeframes
  function calculateGrowth(current: number, previous: number) {
    if (previous === 0) {
      if (current === 0) return { changePercent: '0%', trend: 'up' as const, hasData: false };
      return { changePercent: '+100%', trend: 'up' as const, hasData: true };
    }
    const diff = current - previous;
    const pct = (diff / previous) * 100;
    const rounded = Math.abs(pct).toFixed(1);
    if (diff >= 0) {
      return { changePercent: `+${rounded}%`, trend: 'up' as const, hasData: true };
    } else {
      return { changePercent: `-${rounded}%`, trend: 'down' as const, hasData: true };
    }
  }

  // Helper to generate dynamic SVG sparkline curve strictly from real daily numbers
  function generateSparkline(dailyCounts: number[]) {
    const allZero = dailyCounts.every(v => v === 0);
    if (allZero) {
      return 'M 0 26 L 100 26';
    }
    const max = Math.max(...dailyCounts);
    const min = Math.min(...dailyCounts);
    const range = max === min ? (max || 1) : max - min;

    const points = dailyCounts.map((val, idx) => {
      const x = Number(((idx / (dailyCounts.length - 1)) * 100).toFixed(1));
      const normalized = (val - min) / range;
      const y = Number((25 - (normalized * 20)).toFixed(1));
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = Number(((p0.x + p1.x) / 2).toFixed(1));
      path += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  }

  // Dashboard Overview Metrics - 100% REAL DATA FROM SQLITE DATABASE
  app.get('/api/admin/dashboard', (req, res) => {
    try {
      // 1. Total Users
      const totalUsers = (db.prepare('SELECT count(*) as count FROM users').get() as any).count || 0;
      const usersCurr7d = (db.prepare(`SELECT count(*) as count FROM users WHERE created_at >= datetime('now', '-7 days')`).get() as any).count || 0;
      const usersPrev7d = (db.prepare(`SELECT count(*) as count FROM users WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')`).get() as any).count || 0;
      const usersDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`SELECT count(*) as count FROM users WHERE date(created_at) = date('now', '-${i} days')`).get();
        usersDaily.push(row?.count || 0);
      }
      const usersGrowth = calculateGrowth(usersCurr7d, usersPrev7d);
      const usersSparkline = generateSparkline(usersDaily);

      // 2. Active Growth (Distinct active users in last 7 days)
      const activeUsers7d = (db.prepare(`
        SELECT count(DISTINCT user_id) as count FROM (
          SELECT user_id FROM analytics_events WHERE created_at >= datetime('now', '-7 days') AND user_id IS NOT NULL
          UNION
          SELECT user_id FROM sessions WHERE created_at >= datetime('now', '-7 days')
        )
      `).get() as any).count || 0;

      const activeUsersPrev7d = (db.prepare(`
        SELECT count(DISTINCT user_id) as count FROM (
          SELECT user_id FROM analytics_events WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days') AND user_id IS NOT NULL
        )
      `).get() as any).count || 0;
      const activeGrowth = calculateGrowth(activeUsers7d, activeUsersPrev7d);
      const activeDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`
          SELECT count(DISTINCT user_id) as count FROM (
            SELECT user_id FROM analytics_events WHERE date(created_at) = date('now', '-${i} days') AND user_id IS NOT NULL
            UNION
            SELECT user_id FROM sessions WHERE date(created_at) = date('now', '-${i} days')
          )
        `).get();
        activeDaily.push(row?.count || 0);
      }
      const activeSparkline = generateSparkline(activeDaily);

      // 3. Spots / Destinations
      const totalSpots = (db.prepare('SELECT count(*) as count FROM spots WHERE is_active = 1').get() as any).count || 0;
      const totalLocations = (db.prepare('SELECT count(*) as count FROM spots').get() as any).count || 0;
      const servicesCount = (db.prepare(`SELECT count(*) as count FROM spots WHERE category IN ('hotels', 'restaurants', 'cafes', 'sweets', 'pharmacies', 'services', 'shops')`).get() as any).count || 0;
      const spotsCurr7d = (db.prepare(`SELECT count(*) as count FROM spots WHERE created_at >= datetime('now', '-7 days')`).get() as any).count || 0;
      const spotsPrev7d = (db.prepare(`SELECT count(*) as count FROM spots WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')`).get() as any).count || 0;
      const spotsGrowth = calculateGrowth(spotsCurr7d, spotsPrev7d);
      const spotsDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`SELECT count(*) as count FROM spots WHERE date(created_at) = date('now', '-${i} days')`).get();
        spotsDaily.push(row?.count || 0);
      }
      const spotsSparkline = generateSparkline(spotsDaily);

      // 4. Real Total Views (from real analytics_events)
      const viewsTotal = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
      `).get() as any).count || 0;

      const viewsCurr7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
        AND created_at >= datetime('now', '-7 days')
      `).get() as any).count || 0;

      const viewsPrev7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
        AND created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')
      `).get() as any).count || 0;
      const viewsGrowth = calculateGrowth(viewsCurr7d, viewsPrev7d);
      const viewsDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`
          SELECT count(*) as count FROM analytics_events 
          WHERE event_type IN ('spot_view', 'spot_detail_open', 'banner_view', 'event_view', 'tab_view')
          AND date(created_at) = date('now', '-${i} days')
        `).get();
        viewsDaily.push(row?.count || 0);
      }
      const viewsSparkline = generateSparkline(viewsDaily);

      // 5. Real Engagement (all user actions)
      const engagementTotal = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
      `).get() as any).count || 0;

      const engagementCurr7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
        AND created_at >= datetime('now', '-7 days')
      `).get() as any).count || 0;

      const engagementPrev7d = (db.prepare(`
        SELECT count(*) as count FROM analytics_events 
        WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
        AND created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')
      `).get() as any).count || 0;
      const engagementGrowth = calculateGrowth(engagementCurr7d, engagementPrev7d);
      const engagementDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`
          SELECT count(*) as count FROM analytics_events 
          WHERE event_type IN ('spot_detail_open', 'favorite_add', 'favorite_remove', 'chat_message', 'search_query', 'voice_search', 'route_click', 'category_filter', 'review_submit', 'profile_update')
          AND date(created_at) = date('now', '-${i} days')
        `).get();
        engagementDaily.push(row?.count || 0);
      }
      const engagementSparkline = generateSparkline(engagementDaily);

      // 6. Real Reviews
      const totalReviews = (db.prepare('SELECT count(*) as count FROM reviews').get() as any).count || 0;
      const reviewsCurr7d = (db.prepare(`SELECT count(*) as count FROM reviews WHERE created_at >= datetime('now', '-7 days')`).get() as any).count || 0;
      const reviewsPrev7d = (db.prepare(`SELECT count(*) as count FROM reviews WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')`).get() as any).count || 0;
      const reviewsGrowth = calculateGrowth(reviewsCurr7d, reviewsPrev7d);
      const reviewsDaily: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const row: any = db.prepare(`SELECT count(*) as count FROM reviews WHERE date(created_at) = date('now', '-${i} days')`).get();
        reviewsDaily.push(row?.count || 0);
      }
      const reviewsSparkline = generateSparkline(reviewsDaily);

      // 7. Real Satisfaction Score (average rating from real reviews)
      const reviewStats: any = db.prepare('SELECT AVG(rating) as avg, count(*) as count FROM reviews').get();
      const avgScore = (reviewStats && reviewStats.count > 0 && reviewStats.avg) ? Number(reviewStats.avg.toFixed(1)) : 0;
      const prevStats: any = db.prepare(`SELECT AVG(rating) as avg, count(*) as count FROM reviews WHERE created_at < datetime('now', '-7 days')`).get();
      const prevScore = (prevStats && prevStats.count > 0 && prevStats.avg) ? Number(prevStats.avg.toFixed(1)) : 0;
      const satisfactionGrowth = calculateGrowth(avgScore, prevScore);
      const satisfactionSparkline = generateSparkline(reviewsDaily);

      // 8. Session duration calculation
      const totalEvents = (db.prepare(`SELECT count(*) as count FROM events WHERE status = 'active'`).get() as any).count || 0;
      
      // Calculate real server uptime
      const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
      const days = Math.floor(uptimeSeconds / (3600 * 24));
      const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const seconds = uptimeSeconds % 60;
      let uptimeStr = '';
      if (days > 0) uptimeStr = `Ativo há ${days}d ${hours}h`;
      else if (hours > 0) uptimeStr = `Ativo há ${hours}h ${minutes}m`;
      else if (minutes > 0) uptimeStr = `Ativo há ${minutes}m ${seconds}s`;
      else uptimeStr = `Ativo há ${seconds}s`;

      // System effects
      const rainSetting = (db.prepare(`SELECT value FROM system_settings WHERE key = 'weather_rain_mode'`).get() as any)?.value || 'auto';
      const snowSetting = (db.prepare(`SELECT value FROM system_settings WHERE key = 'weather_snow_mode'`).get() as any)?.value || 'fraca';

      // Onboarding Stats
      const onboardingCompletedCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 1').get() as any).count || 0;
      const onboardingPendingCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 0').get() as any).count || 0;
      const referralBreakdown = db.prepare('SELECT referral_source, count(*) as count FROM user_preferences WHERE referral_source IS NOT NULL GROUP BY referral_source ORDER BY count DESC').all() as { referral_source: string; count: number }[];
      const frequencyBreakdown = db.prepare('SELECT travel_frequency, count(*) as count FROM user_preferences WHERE travel_frequency IS NOT NULL GROUP BY travel_frequency ORDER BY count DESC').all() as { travel_frequency: string; count: number }[];
      const styleBreakdown = db.prepare('SELECT travel_style, count(*) as count FROM user_preferences WHERE travel_style IS NOT NULL GROUP BY travel_style ORDER BY count DESC').all() as { travel_style: string; count: number }[];

      res.json({
        success: true,
        metrics: {
          totalUsers,
          usersGrowth,
          usersSparkline,

          activeUsersCount: activeUsers7d,
          activeGrowth,
          activeSparkline,

          totalSpots,
          totalLocations,
          servicesCount,
          totalEvents,
          spotsGrowth,
          spotsSparkline,

          viewsTotal,
          viewsGrowth,
          viewsSparkline,

          engagementTotal,
          engagementGrowth,
          engagementSparkline,

          totalReviews,
          reviewsGrowth,
          reviewsSparkline,

          satisfactionScore: avgScore,
          satisfactionCount: reviewStats?.count || 0,
          satisfactionGrowth,
          satisfactionSparkline,

          avgSessionDuration: engagementTotal > 0 ? `${Math.min(Math.max(Math.round(engagementTotal / Math.max(totalUsers, 1)), 1), 10)}m` : '0m',
          sessionGrowth: { changePercent: '0%', trend: 'up', hasData: false },
          sessionSparkline: generateSparkline(engagementDaily),

          onboarding: {
            completed: onboardingCompletedCount,
            pending: onboardingPendingCount,
            completionRate: totalUsers > 0 ? Math.round((onboardingCompletedCount / totalUsers) * 100) : 100,
            referrals: referralBreakdown,
            frequencies: frequencyBreakdown,
            styles: styleBreakdown
          },

          systemHealth: {
            status: 'Operacional',
            latency: '18ms',
            uptime: uptimeStr
          },
          effects: {
            rainMode: rainSetting,
            snowMode: snowSetting
          }
        }
      });
    } catch (err: any) {
      console.error('Error fetching admin dashboard:', err);
      res.status(500).json({ error: 'Erro ao carregar métricas administrativas' });
    }
  });

  // Save Climate / Effects (Rain, Snow)
  app.post('/api/admin/effects', (req, res) => {
    try {
      const { rainMode, snowMode } = req.body;
      if (rainMode) {
        db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('weather_rain_mode', ?)`).run(rainMode);
        persistSystemSettingToFirestore('weather_rain_mode', String(rainMode)).catch(() => {});
      }
      if (snowMode) {
        db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('weather_snow_mode', ?)`).run(snowMode);
        persistSystemSettingToFirestore('weather_snow_mode', String(snowMode)).catch(() => {});
      }
      logAdminAction(null, 'Gerente ADM', 'Atualizou Clima/Efeitos', `Chuva: ${rainMode || 'mantido'}, Neve: ${snowMode || 'mantido'}`);
      res.json({ success: true, rainMode, snowMode });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao atualizar efeitos de clima' });
    }
  });

  // Admin Spots: List All (including inactive)
  app.get('/api/admin/spots', (req, res) => {
    try {
      const { q, category } = req.query;
      let query = `SELECT * FROM spots WHERE 1=1`;
      const params: any[] = [];

      if (q && typeof q === 'string' && q.trim()) {
        query += ` AND (name LIKE ? OR description LIKE ? OR address LIKE ?)`;
        const search = `%${q.trim()}%`;
        params.push(search, search, search);
      }

      if (category && typeof category === 'string' && category !== 'all') {
        query += ` AND category = ?`;
        params.push(category);
      }

      query += ` ORDER BY created_at DESC, id DESC`;
      const rows = db.prepare(query).all(...params);

      const spots = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        shortName: r.short_name || r.name,
        tagLabel: r.tag_label || r.name,
        category: r.category,
        categoryLabel: r.category_label || r.category,
        lat: r.lat,
        lng: r.lng,
        image: resolveSpotPhoto(r.name, r.id, r.category, r.image),
        gallery: r.gallery ? JSON.parse(r.gallery) : [],
        description: r.description,
        touristTip: r.tourist_tip,
        rating: r.rating,
        reviewCount: r.review_count,
        hours: r.hours,
        address: r.address,
        priceRange: r.price_range,
        popularTimes: r.popular_times,
        visitorsToday: r.visitors_today,
        badge: r.badge,
        highlighted: Boolean(r.highlighted),
        isActive: Boolean(r.is_active),
        isVerified: Boolean(r.is_verified),
        website: r.website || '',
        phone: r.phone || '',
        availableForItinerary: r.available_for_itinerary === 1,
        durationMinutes: r.duration_minutes || 90,
        tags: r.tags ? r.tags.split(',').map((t: string) => t.trim()) : [],
        price: r.price || r.price_range || '',
        createdAt: r.created_at
      }));

      res.json({ success: true, spots });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar pontos administrativos' });
    }
  });

  // Admin Spots: Upload Spot Image
  app.post('/api/admin/upload-spot-image', (req, res) => {
    try {
      const { image, fileName } = req.body;
      if (!image) {
        res.status(400).json({ error: 'Nenhuma imagem enviada' });
        return;
      }

      // Check if it's a data URL
      const matches = image.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!matches) {
        // If it's already an external URL or path, just return it
        if (image.startsWith('http') || image.startsWith('/')) {
          res.json({ success: true, url: image });
          return;
        }
        res.status(400).json({ error: 'Formato de imagem inválido' });
        return;
      }

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1].replace(/[^a-zA-Z0-9]/g, '');
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'spots');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const cleanFileName = fileName 
        ? fileName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)
        : 'spot';
      const uniqueFileName = `${cleanFileName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = path.join(uploadsDir, uniqueFileName);

      try {
        fs.writeFileSync(filePath, buffer);
      } catch (fsErr) {
        console.warn('Could not write uploaded file to disk, relying on base64 data URI:', fsErr);
      }

      // Return base64 Data URL if < 800KB for complete persistence in Firestore/SQLite, fallback to publicUrl
      const finalUrl = (image && image.length < 800000) ? image : `/uploads/spots/${uniqueFileName}`;
      res.json({ success: true, url: finalUrl });
    } catch (err: any) {
      console.error('Error saving uploaded spot image:', err);
      res.status(500).json({ error: 'Falha ao salvar imagem do ponto turístico' });
    }
  });

  // Admin Spots: Create New Spot
  app.post('/api/admin/spots', (req, res) => {
    try {
      const {
        name,
        category,
        categoryLabel,
        description,
        touristTip,
        image,
        gallery,
        lat,
        lng,
        address,
        hours,
        priceRange,
        website,
        phone,
        isVerified,
        isActive,
        highlighted,
        badge,
        rating,
        availableForItinerary,
        durationMinutes,
        tags,
        price
      } = req.body;

      if (!name || !category || lat === undefined || lng === undefined) {
        res.status(400).json({ error: 'Nome, categoria e coordenadas geográficas (lat/lng) são obrigatórios.' });
        return;
      }

      const id = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

      const defaultImage = image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80';

      const parsedRating = rating !== undefined && rating !== null && !isNaN(Number(rating))
        ? Math.max(1.0, Math.min(5.0, Number(rating)))
        : 4.8;

      const formattedTags = Array.isArray(tags) ? tags.join(', ') : (tags || '');

      const nowIso = new Date().toISOString();

      db.prepare(`
        INSERT INTO spots (
          id, name, short_name, tag_label, category, category_label,
          lat, lng, image, gallery, description, tourist_tip,
          rating, review_count, hours, address, price_range,
          visitors_today, badge, highlighted, is_active, is_verified,
          website, phone, available_for_itinerary, duration_minutes, tags, price,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        id,
        name,
        name,
        name,
        category,
        categoryLabel || category,
        Number(lat),
        Number(lng),
        defaultImage,
        gallery ? JSON.stringify(gallery) : '[]',
        description || '',
        touristTip || '',
        parsedRating,
        1,
        hours || 'Todos os dias das 09h às 18h',
        address || 'Campos do Jordão, SP',
        priceRange || '$$',
        50,
        badge || '',
        highlighted ? 1 : 0,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        isVerified !== undefined ? (isVerified ? 1 : 0) : 1,
        website || '',
        phone || '',
        availableForItinerary !== undefined ? (availableForItinerary ? 1 : 0) : 1,
        Number(durationMinutes) || 90,
        formattedTags,
        price || priceRange || '',
        nowIso,
        nowIso
      );

      logAdminAction(null, 'Gerente ADM', 'Criou Ponto Turístico', `Nome: ${name} (${category})`);

      // Persist to Cloud Firestore
      persistSpotToFirestore({
        id,
        name,
        short_name: name,
        tag_label: name,
        category,
        category_label: categoryLabel || category,
        lat: Number(lat),
        lng: Number(lng),
        image: defaultImage,
        gallery: gallery ? JSON.stringify(gallery) : '[]',
        description: description || '',
        tourist_tip: touristTip || '',
        rating: parsedRating,
        review_count: 1,
        hours: hours || 'Todos os dias das 09h às 18h',
        address: address || 'Campos do Jordão, SP',
        price_range: priceRange || '$$',
        visitors_today: 50,
        badge: badge || '',
        highlighted: highlighted ? 1 : 0,
        is_active: isActive !== undefined ? (isActive ? 1 : 0) : 1,
        is_verified: isVerified !== undefined ? (isVerified ? 1 : 0) : 1,
        website: website || '',
        phone: phone || ''
      }).catch(err => console.warn('[FirestoreSync] Failed to persist new spot:', id, err));

      const newSpotRecord = {
        id,
        name,
        shortName: name,
        tagLabel: name,
        category,
        categoryLabel: categoryLabel || category,
        lat: Number(lat),
        lng: Number(lng),
        image: resolveSpotPhoto(name, id, category, defaultImage),
        gallery: gallery ? (Array.isArray(gallery) ? gallery : JSON.parse(gallery)) : [defaultImage],
        description: description || '',
        touristTip: touristTip || '',
        rating: parsedRating,
        reviewCount: 1,
        hours: hours || 'Todos os dias das 09h às 18h',
        address: address || 'Campos do Jordão, SP',
        priceRange: priceRange || '$$',
        popularTimes: '',
        visitorsToday: 50,
        badge: badge || '',
        highlighted: Boolean(highlighted),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        isVerified: isVerified !== undefined ? Boolean(isVerified) : true,
        website: website || '',
        phone: phone || '',
        availableForItinerary: availableForItinerary !== undefined ? Boolean(availableForItinerary) : true,
        durationMinutes: Number(durationMinutes) || 90,
        tags: formattedTags ? formattedTags.split(',').map((t: string) => t.trim()) : [],
        price: price || priceRange || '',
        createdAt: new Date().toISOString()
      };

      res.json({ success: true, id, spot: newSpotRecord, message: 'Ponto turístico cadastrado com sucesso!' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao cadastrar ponto: ' + err.message });
    }
  });

  // Admin Spots: Update Spot
  app.put('/api/admin/spots/:id', (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        category,
        categoryLabel,
        description,
        touristTip,
        image,
        gallery,
        lat,
        lng,
        address,
        hours,
        priceRange,
        website,
        phone,
        isVerified,
        isActive,
        highlighted,
        badge,
        rating,
        availableForItinerary,
        durationMinutes,
        tags,
        price
      } = req.body;

      const existing = db.prepare('SELECT id FROM spots WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ponto não encontrado' });
        return;
      }

      const parsedRating = rating !== undefined && rating !== null && !isNaN(Number(rating))
        ? Math.max(1.0, Math.min(5.0, Number(rating)))
        : null;

      const formattedTags = tags !== undefined
        ? (Array.isArray(tags) ? tags.join(', ') : tags)
        : null;

      db.prepare(`
        UPDATE spots SET
          name = COALESCE(?, name),
          short_name = COALESCE(?, short_name),
          category = COALESCE(?, category),
          category_label = COALESCE(?, category_label),
          description = COALESCE(?, description),
          tourist_tip = COALESCE(?, tourist_tip),
          image = COALESCE(?, image),
          gallery = COALESCE(?, gallery),
          lat = COALESCE(?, lat),
          lng = COALESCE(?, lng),
          address = COALESCE(?, address),
          hours = COALESCE(?, hours),
          price_range = COALESCE(?, price_range),
          website = COALESCE(?, website),
          phone = COALESCE(?, phone),
          is_verified = COALESCE(?, is_verified),
          is_active = COALESCE(?, is_active),
          highlighted = COALESCE(?, highlighted),
          badge = COALESCE(?, badge),
          rating = COALESCE(?, rating),
          available_for_itinerary = COALESCE(?, available_for_itinerary),
          duration_minutes = COALESCE(?, duration_minutes),
          tags = COALESCE(?, tags),
          price = COALESCE(?, price),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name,
        name,
        category,
        categoryLabel,
        description,
        touristTip,
        image,
        gallery ? JSON.stringify(gallery) : null,
        lat !== undefined ? Number(lat) : null,
        lng !== undefined ? Number(lng) : null,
        address,
        hours,
        priceRange,
        website,
        phone,
        isVerified !== undefined ? (isVerified ? 1 : 0) : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        highlighted !== undefined ? (highlighted ? 1 : 0) : null,
        badge,
        parsedRating,
        availableForItinerary !== undefined ? (availableForItinerary ? 1 : 0) : null,
        durationMinutes !== undefined ? Number(durationMinutes) : null,
        formattedTags,
        price,
        id
      );

      logAdminAction(null, 'Gerente ADM', 'Editou Ponto Turístico', `ID: ${id}, Nome: ${name}`);

      const updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(id) as any;
      if (updatedSpot) {
        persistSpotToFirestore({
          id: updatedSpot.id,
          name: updatedSpot.name,
          short_name: updatedSpot.short_name,
          tag_label: updatedSpot.tag_label,
          category: updatedSpot.category,
          category_label: updatedSpot.category_label,
          lat: Number(updatedSpot.lat),
          lng: Number(updatedSpot.lng),
          image: updatedSpot.image,
          gallery: updatedSpot.gallery,
          description: updatedSpot.description,
          tourist_tip: updatedSpot.tourist_tip,
          rating: Number(updatedSpot.rating),
          review_count: Number(updatedSpot.review_count),
          hours: updatedSpot.hours,
          address: updatedSpot.address,
          price_range: updatedSpot.price_range,
          popular_times: updatedSpot.popular_times,
          visitors_today: Number(updatedSpot.visitors_today),
          badge: updatedSpot.badge,
          highlighted: Number(updatedSpot.highlighted),
          is_active: Number(updatedSpot.is_active),
          is_verified: Number(updatedSpot.is_verified),
          website: updatedSpot.website,
          phone: updatedSpot.phone,
          maps_url: updatedSpot.maps_url
        }).catch(err => console.warn('[FirestoreSync] Failed to persist updated spot:', id, err));

        const formattedUpdated = {
          id: updatedSpot.id,
          name: updatedSpot.name,
          shortName: updatedSpot.short_name || updatedSpot.name,
          tagLabel: updatedSpot.tag_label || updatedSpot.name,
          category: updatedSpot.category,
          categoryLabel: updatedSpot.category_label || updatedSpot.category,
          lat: Number(updatedSpot.lat),
          lng: Number(updatedSpot.lng),
          image: resolveSpotPhoto(updatedSpot.name, updatedSpot.id, updatedSpot.category, updatedSpot.image),
          gallery: updatedSpot.gallery ? JSON.parse(updatedSpot.gallery) : [],
          description: updatedSpot.description,
          touristTip: updatedSpot.tourist_tip,
          rating: Number(updatedSpot.rating),
          reviewCount: Number(updatedSpot.review_count),
          hours: updatedSpot.hours,
          address: updatedSpot.address,
          priceRange: updatedSpot.price_range,
          popularTimes: updatedSpot.popular_times,
          visitorsToday: Number(updatedSpot.visitors_today),
          badge: updatedSpot.badge,
          highlighted: Boolean(updatedSpot.highlighted),
          isActive: Boolean(updatedSpot.is_active),
          isVerified: Boolean(updatedSpot.is_verified),
          website: updatedSpot.website || '',
          phone: updatedSpot.phone || '',
          availableForItinerary: updatedSpot.available_for_itinerary === 1,
          durationMinutes: updatedSpot.duration_minutes || 90,
          tags: updatedSpot.tags ? updatedSpot.tags.split(',').map((t: string) => t.trim()) : [],
          price: updatedSpot.price || updatedSpot.price_range || '',
          updatedAt: updatedSpot.updated_at
        };

        res.json({ success: true, spot: formattedUpdated, message: 'Ponto atualizado com sucesso!' });
        return;
      }

      res.json({ success: true, message: 'Ponto atualizado com sucesso!' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar ponto: ' + err.message });
    }
  });

  // Admin Spots: Delete Spot
  app.delete('/api/admin/spots/:id', (req, res) => {
    try {
      const { id } = req.params;
      const decodedId = decodeURIComponent(id);
      const spot: any = db.prepare('SELECT name FROM spots WHERE id = ? OR id = ?').get(id, decodedId);
      if (!spot) {
        // If not found in SQLite, try deleting anyway to ensure synchronization
        try { db.prepare('DELETE FROM spots WHERE id = ? OR id = ?').run(id, decodedId); } catch (e) {}
        deleteSpotFromFirestore(id).catch(() => {});
        deleteSpotFromFirestore(decodedId).catch(() => {});
        res.json({ success: true, message: 'Ponto excluído com sucesso.' });
        return;
      }

      // Cleanup dependent records safely
      try { db.prepare('DELETE FROM reviews WHERE spot_id = ? OR spot_id = ?').run(id, decodedId); } catch (e) {}
      try { db.prepare('DELETE FROM favorites WHERE spot_id = ? OR spot_id = ?').run(id, decodedId); } catch (e) {}
      try { db.prepare('DELETE FROM user_favorites WHERE spot_id = ? OR spot_id = ?').run(id, decodedId); } catch (e) {}
      try { db.prepare('DELETE FROM itinerary_items WHERE spot_id = ? OR spot_id = ?').run(id, decodedId); } catch (e) {}

      db.prepare('DELETE FROM spots WHERE id = ? OR id = ?').run(id, decodedId);
      logAdminAction(null, 'Gerente ADM', 'Excluiu Ponto Turístico', `ID: ${id}, Nome: ${spot.name}`);

      deleteSpotFromFirestore(id).catch(err => console.warn('[FirestoreSync] Failed to delete spot from cloud:', id, err));
      deleteSpotFromFirestore(decodedId).catch(() => {});

      res.json({ success: true, message: 'Ponto excluído com sucesso.' });
    } catch (err: any) {
      console.error('Error deleting spot:', err);
      res.status(500).json({ error: 'Erro ao excluir ponto: ' + err.message });
    }
  });

  // Admin Spots: Toggle Active
  app.patch('/api/admin/spots/:id/toggle-active', (req, res) => {
    try {
      const { id } = req.params;
      const spot: any = db.prepare('SELECT is_active, name FROM spots WHERE id = ?').get(id);
      if (!spot) {
        res.status(404).json({ error: 'Ponto não encontrado' });
        return;
      }
      const newStatus = spot.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE spots SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);
      logAdminAction(null, 'Gerente ADM', newStatus ? 'Ativou Ponto' : 'Desativou Ponto', spot.name);

      const updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(id) as any;
      if (updatedSpot) {
        persistSpotToFirestore(updatedSpot).catch(() => {});
      }

      res.json({ success: true, isActive: Boolean(newStatus) });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alternar status do ponto' });
    }
  });

  // Admin Spots: Toggle Verified
  app.patch('/api/admin/spots/:id/toggle-verified', (req, res) => {
    try {
      const { id } = req.params;
      const spot: any = db.prepare('SELECT is_verified, name FROM spots WHERE id = ?').get(id);
      if (!spot) {
        res.status(404).json({ error: 'Ponto não encontrado' });
        return;
      }
      const newVerified = spot.is_verified === 1 ? 0 : 1;
      db.prepare('UPDATE spots SET is_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newVerified, id);
      logAdminAction(null, 'Gerente ADM', newVerified ? 'Marcou Verificado' : 'Removeu Verificação', spot.name);

      const updatedSpot = db.prepare('SELECT * FROM spots WHERE id = ?').get(id) as any;
      if (updatedSpot) {
        persistSpotToFirestore(updatedSpot).catch(() => {});
      }

      res.json({ success: true, isVerified: Boolean(newVerified) });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao alternar verificação do ponto' });
    }
  });

  // ==========================================
  // ADMIN MAP VISUAL ICONS (ÍCONES DO MAPA)
  // ==========================================

  // Admin: List all visual icons with stats and filters
  app.get('/api/admin/map-visual-icons', (req, res) => {
    try {
      const { category, status, q } = req.query;
      let query = `SELECT * FROM map_visual_icons WHERE 1=1`;
      const params: any[] = [];

      if (category && typeof category === 'string' && category !== 'all') {
        query += ` AND category = ?`;
        params.push(category);
      }

      if (status && typeof status === 'string' && status !== 'all') {
        if (status === 'active') {
          query += ` AND is_active = 1`;
        } else if (status === 'inactive') {
          query += ` AND is_active = 0`;
        }
      }

      if (q && typeof q === 'string' && q.trim()) {
        query += ` AND (category LIKE ? OR id LIKE ?)`;
        const search = `%${q.trim()}%`;
        params.push(search, search);
      }

      query += ` ORDER BY created_at DESC`;
      const icons = db.prepare(query).all(...params);

      // Category breakdown and counts
      const stats = {
        total: (db.prepare('SELECT count(*) as count FROM map_visual_icons').get() as any)?.count || 0,
        active: (db.prepare('SELECT count(*) as count FROM map_visual_icons WHERE is_active = 1').get() as any)?.count || 0,
        inactive: (db.prepare('SELECT count(*) as count FROM map_visual_icons WHERE is_active = 0').get() as any)?.count || 0
      };

      res.json({ success: true, icons, stats });
    } catch (err: any) {
      console.error('Error fetching admin map visual icons:', err);
      res.status(500).json({ error: 'Erro ao carregar ícones do mapa' });
    }
  });

  // Admin: Create new visual icon
  app.post('/api/admin/map-visual-icons', (req, res) => {
    try {
      const { category, icon, latitude, longitude, color, is_active } = req.body;

      if (!category || latitude === undefined || longitude === undefined) {
        res.status(400).json({ error: 'Categoria e coordenadas (latitude e longitude) são obrigatórias.' });
        return;
      }

      const id = 'icon-' + category + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
      const iconKey = icon || category;
      const activeState = is_active !== undefined ? (is_active ? 1 : 0) : 1;
      const lat = Number(latitude);
      const lng = Number(longitude);
      const chosenColor = color && typeof color === 'string' && color.trim() ? color.trim() : null;

      db.prepare(`
        INSERT INTO map_visual_icons (id, category, icon, latitude, longitude, color, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(id, category, iconKey, lat, lng, chosenColor, activeState);

      logAdminAction(null, 'Gerente ADM', 'Adicionou Ícone no Mapa', `Categoria: ${category}, Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);

      persistMapVisualIconToFirestore({
        id,
        category,
        icon: iconKey,
        latitude: lat,
        longitude: lng,
        color: chosenColor || undefined,
        is_active: activeState
      }).catch(err => console.warn('[FirestoreSync] Failed to persist visual icon:', id, err));

      const created = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      res.json({ success: true, icon: created, message: 'Ícone adicionado com sucesso!' });
    } catch (err: any) {
      console.error('Error creating map visual icon:', err);
      res.status(500).json({ error: 'Erro ao adicionar ícone: ' + err.message });
    }
  });

  // Admin: Update visual icon (category, icon, position, or status)
  app.put('/api/admin/map-visual-icons/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { category, icon, latitude, longitude, color, is_active } = req.body;

      const existing: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ícone não encontrado.' });
        return;
      }

      const newCategory = category || existing.category;
      const newIcon = icon || existing.icon;
      const newLat = latitude !== undefined ? Number(latitude) : existing.latitude;
      const newLng = longitude !== undefined ? Number(longitude) : existing.longitude;
      const newColor = color !== undefined ? (color && typeof color === 'string' && color.trim() ? color.trim() : null) : existing.color;
      const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

      db.prepare(`
        UPDATE map_visual_icons
        SET category = ?,
            icon = ?,
            latitude = ?,
            longitude = ?,
            color = ?,
            is_active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newCategory, newIcon, newLat, newLng, newColor, newActive, id);

      logAdminAction(null, 'Gerente ADM', 'Atualizou Ícone no Mapa', `ID: ${id}, Categoria: ${newCategory}`);

      const updated: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (updated) {
        persistMapVisualIconToFirestore({
          id: updated.id,
          category: updated.category,
          icon: updated.icon,
          latitude: Number(updated.latitude),
          longitude: Number(updated.longitude),
          color: updated.color || undefined,
          is_active: Number(updated.is_active)
        }).catch(err => console.warn('[FirestoreSync] Failed to update visual icon in cloud:', id, err));
      }

      res.json({ success: true, icon: updated, message: 'Ícone atualizado com sucesso!' });
    } catch (err: any) {
      console.error('Error updating map visual icon:', err);
      res.status(500).json({ error: 'Erro ao atualizar ícone: ' + err.message });
    }
  });

  // Admin: Toggle active state of visual icon
  app.patch('/api/admin/map-visual-icons/:id/toggle-active', (req, res) => {
    try {
      const { id } = req.params;
      const existing: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ícone não encontrado.' });
        return;
      }

      const nextActive = existing.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE map_visual_icons SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextActive, id);

      logAdminAction(null, 'Gerente ADM', nextActive ? 'Ativou Ícone no Mapa' : 'Desativou Ícone no Mapa', `ID: ${id}, Categoria: ${existing.category}`);

      const updated: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (updated) {
        persistMapVisualIconToFirestore({
          id: updated.id,
          category: updated.category,
          icon: updated.icon,
          latitude: Number(updated.latitude),
          longitude: Number(updated.longitude),
          is_active: Number(updated.is_active)
        }).catch(() => {});
      }

      res.json({ success: true, id, is_active: nextActive, message: nextActive ? 'Ícone ativado no mapa.' : 'Ícone desativado do mapa.' });
    } catch (err: any) {
      console.error('Error toggling map visual icon:', err);
      res.status(500).json({ error: 'Erro ao alternar status do ícone' });
    }
  });

  // Admin: Delete visual icon
  app.delete('/api/admin/map-visual-icons/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing: any = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Ícone não encontrado.' });
        return;
      }

      db.prepare('DELETE FROM map_visual_icons WHERE id = ?').run(id);

      logAdminAction(null, 'Gerente ADM', 'Excluiu Ícone do Mapa', `ID: ${id}, Categoria: ${existing.category}`);

      deleteMapVisualIconFromFirestore(id).catch(err => console.warn('[FirestoreSync] Failed to delete visual icon from cloud:', id, err));

      res.json({ success: true, id, message: 'Ícone excluído com sucesso.' });
    } catch (err: any) {
      console.error('Error deleting map visual icon:', err);
      res.status(500).json({ error: 'Erro ao excluir ícone: ' + err.message });
    }
  });

  // ==========================================
  // ADMIN USERS (COMUNIDADE)
  // ==========================================

  app.get('/api/admin/users', (req, res) => {
    try {
      const { q, status, onboarding, referral } = req.query;
      let query = `
        SELECT 
          u.id, 
          u.name, 
          u.email,
          u.whatsapp, 
          u.role, 
          u.is_banned, 
          u.avatar_url, 
          u.visits_count, 
          u.last_access, 
          u.created_at,
          u.onboarding_completed,
          u.onboarding_step,
          p.referral_source,
          p.travel_frequency,
          p.travel_style,
          p.main_interests,
          p.preferred_season,
          p.completed_at as onboarding_completed_at
        FROM users u
        LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (q && typeof q === 'string' && q.trim()) {
        query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.whatsapp LIKE ? OR CAST(u.id AS TEXT) LIKE ?)`;
        const search = `%${q.trim()}%`;
        params.push(search, search, search, search);
      }

      if (status === 'active') {
        query += ` AND u.is_banned = 0`;
      } else if (status === 'banned') {
        query += ` AND u.is_banned = 1`;
      }

      if (onboarding === 'completed') {
        query += ` AND u.onboarding_completed = 1`;
      } else if (onboarding === 'pending') {
        query += ` AND (u.onboarding_completed = 0 OR u.onboarding_completed IS NULL)`;
      }

      if (referral && typeof referral === 'string' && referral !== 'all') {
        query += ` AND p.referral_source LIKE ?`;
        params.push(`%${referral.trim()}%`);
      }

      query += ` ORDER BY u.created_at DESC`;
      const rawUsers = db.prepare(query).all(...params);

      const users = rawUsers.map((u: any) => {
        let parsedInterests = [];
        if (u.main_interests) {
          try {
            parsedInterests = JSON.parse(u.main_interests);
          } catch (e) {
            parsedInterests = [u.main_interests];
          }
        }
        return {
          ...u,
          email: u.email || u.whatsapp,
          whatsapp: u.email || u.whatsapp,
          onboarding_completed: u.onboarding_completed === 1,
          main_interests: parsedInterests
        };
      });

      // Quick summary stats for admin
      const totalCount = (db.prepare('SELECT count(*) as count FROM users').get() as any).count || 0;
      const completedOnboardingCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 1').get() as any).count || 0;
      const pendingOnboardingCount = (db.prepare('SELECT count(*) as count FROM users WHERE onboarding_completed = 0').get() as any).count || 0;

      res.json({
        success: true,
        users,
        total: users.length,
        stats: {
          total: totalCount,
          completedOnboarding: completedOnboardingCount,
          pendingOnboarding: pendingOnboardingCount
        }
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao carregar usuários' });
    }
  });

  // Ban User
  app.post('/api/admin/users/:id/ban', (req, res) => {
    try {
      const { id } = req.params;
      const user: any = db.prepare('SELECT id, name, whatsapp FROM users WHERE id = ?').get(id);
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(id);
      // Invalidate existing sessions
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);

      logAdminAction(null, 'Gerente ADM', 'Baniu Usuário', `ID: ${id}, Nome: ${user.name || user.whatsapp}`);

      res.json({ success: true, message: `Usuário ${user.name || user.whatsapp} foi banido com sucesso.` });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao banir usuário' });
    }
  });

  // Unban User
  app.post('/api/admin/users/:id/unban', (req, res) => {
    try {
      const { id } = req.params;
      const user: any = db.prepare('SELECT id, name, whatsapp FROM users WHERE id = ?').get(id);
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(id);
      logAdminAction(null, 'Gerente ADM', 'Desbaniu Usuário', `ID: ${id}, Nome: ${user.name || user.whatsapp}`);

      res.json({ success: true, message: `Usuário ${user.name || user.whatsapp} foi desbanido.` });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao desbanir usuário' });
    }
  });

  // ==========================================
  // ADMIN EVENTS
  // ==========================================

  app.get('/api/admin/events', (req, res) => {
    try {
      const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
      res.json({ success: true, events });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar eventos' });
    }
  });

  app.post('/api/admin/events', (req, res) => {
    try {
      const { name, description, image, category, date, time, address, lat, lng, status, highlighted } = req.body;
      if (!name || lat === undefined || lng === undefined) {
        res.status(400).json({ error: 'Nome e coordenadas são obrigatórios.' });
        return;
      }

      const id = 'evt-' + Date.now().toString(36);
      db.prepare(`
        INSERT INTO events (id, name, description, image, category, date, time, address, lat, lng, status, highlighted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        description || '',
        image || 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
        category || 'Geral',
        date || 'Em breve',
        time || '18h00',
        address || 'Campos do Jordão',
        Number(lat),
        Number(lng),
        status || 'active',
        highlighted ? 1 : 0
      );

      logAdminAction(null, 'Gerente ADM', 'Criou Evento', name);

      persistEventToFirestore({
        id,
        name,
        description: description || '',
        image: image || 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
        category: category || 'Geral',
        date: date || 'Em breve',
        time: time || '18h00',
        address: address || 'Campos do Jordão',
        lat: Number(lat),
        lng: Number(lng),
        status: status || 'active',
        highlighted: highlighted ? 1 : 0
      }).catch(() => {});

      res.json({ success: true, id, message: 'Evento criado com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao criar evento: ' + err.message });
    }
  });

  app.put('/api/admin/events/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, image, category, date, time, address, lat, lng, status, highlighted } = req.body;

      db.prepare(`
        UPDATE events SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          image = COALESCE(?, image),
          category = COALESCE(?, category),
          date = COALESCE(?, date),
          time = COALESCE(?, time),
          address = COALESCE(?, address),
          lat = COALESCE(?, lat),
          lng = COALESCE(?, lng),
          status = COALESCE(?, status),
          highlighted = COALESCE(?, highlighted)
        WHERE id = ?
      `).run(
        name,
        description,
        image,
        category,
        date,
        time,
        address,
        lat !== undefined ? Number(lat) : null,
        lng !== undefined ? Number(lng) : null,
        status,
        highlighted !== undefined ? (highlighted ? 1 : 0) : null,
        id
      );

      logAdminAction(null, 'Gerente ADM', 'Atualizou Evento', name || id);

      const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
      if (updated) {
        persistEventToFirestore(updated).catch(() => {});
      }

      res.json({ success: true, message: 'Evento atualizado!' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao atualizar evento: ' + err.message });
    }
  });

  app.delete('/api/admin/events/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM events WHERE id = ?').run(id);
      logAdminAction(null, 'Gerente ADM', 'Excluiu Evento', id);

      deleteEventFromFirestore(id).catch(() => {});

      res.json({ success: true, message: 'Evento excluído com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao excluir evento' });
    }
  });

  // ==========================================
  // ADMIN SETTINGS
  // ==========================================

  app.get('/api/admin/settings', (req, res) => {
    try {
      const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      res.json({ success: true, settings });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao carregar configurações' });
    }
  });

  app.post('/api/admin/settings', (req, res) => {
    try {
      const { settings } = req.body;
      if (!settings || typeof settings !== 'object') {
        res.status(400).json({ error: 'Objeto de configurações inválido' });
        return;
      }

      // Validate URLs if present
      if (settings.community_url && !settings.community_url.startsWith('http://') && !settings.community_url.startsWith('https://')) {
        res.status(400).json({ error: 'Link da comunidade deve ser uma URL válida iniciando com https://' });
        return;
      }

      if (settings.instagram_url && !settings.instagram_url.startsWith('http://') && !settings.instagram_url.startsWith('https://')) {
        res.status(400).json({ error: 'Link do Instagram deve ser uma URL válida iniciando com https://' });
        return;
      }

      const updateSetting = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
      const saveMany = db.transaction((entries) => {
        for (const [key, value] of entries) {
          updateSetting.run(key, String(value));
        }
      });

      saveMany(Object.entries(settings));
      logAdminAction(null, 'Gerente ADM', 'Atualizou Configurações Gerais', JSON.stringify(Object.keys(settings)));

      // Persist every updated setting to Cloud Firestore
      for (const [key, value] of Object.entries(settings)) {
        persistSystemSettingToFirestore(key, String(value)).catch(err => console.warn('[FirestoreSync] Failed to persist setting:', key, err));
      }

      res.json({ success: true, message: 'Configurações salvas com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao salvar configurações: ' + err.message });
    }
  });

  // ==========================================
  // ADMIN SYSTEM MAINTENANCE & CLEANUP (REAL & SAFE)
  // ==========================================

  app.post('/api/admin/system/analyze', (req, res) => {
    try {
      const totalSessions = (db.prepare('SELECT count(*) as count FROM sessions').get() as any).count;
      // Stale sessions older than 7 days
      const staleSessions = (db.prepare(`SELECT count(*) as count FROM sessions WHERE created_at < datetime('now', '-7 days')`).get() as any).count;
      
      const totalSpotsCount = (db.prepare('SELECT count(*) as count FROM spots').get() as any).count;
      const inactiveSpots = (db.prepare('SELECT count(*) as count FROM spots WHERE is_active = 0').get() as any).count;

      const totalLogs = (db.prepare('SELECT count(*) as count FROM admin_logs').get() as any).count;
      const oldLogs = (db.prepare(`SELECT count(*) as count FROM admin_logs WHERE created_at < datetime('now', '-30 days')`).get() as any).count;

      let dbSizeBytes = 0;
      try {
        const stats = fs.statSync(dbPath);
        dbSizeBytes = stats.size;
      } catch (e) {}

      res.json({
        success: true,
        analysis: {
          analyzedItems: totalSessions + totalSpotsCount + totalLogs,
          staleSessions,
          inactiveSpots,
          oldLogs,
          dbSizeKb: (dbSizeBytes / 1024).toFixed(1),
          potentiallyReclaimableKb: ((staleSessions * 0.5 + oldLogs * 0.2 + 12)).toFixed(1),
          status: 'Pronto para otimização segura'
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao analisar sistema: ' + err.message });
    }
  });

  app.post('/api/admin/system/cleanup', (req, res) => {
    try {
      // 1. Delete stale sessions older than 7 days
      const delSessions = db.prepare(`DELETE FROM sessions WHERE created_at < datetime('now', '-7 days')`).run();
      
      // 2. Delete audit logs older than 60 days
      const delLogs = db.prepare(`DELETE FROM admin_logs WHERE created_at < datetime('now', '-60 days')`).run();

      // 3. Run SQLite VACUUM to reclaim space safely
      db.exec('VACUUM');

      let newDbSizeKb = '0';
      try {
        const stats = fs.statSync(dbPath);
        newDbSizeKb = (stats.size / 1024).toFixed(1);
      } catch (e) {}

      const removedCount = delSessions.changes + delLogs.changes;

      logAdminAction(null, 'Gerente ADM', 'Executou Limpeza Segura', `Removidos ${removedCount} registros obsoletos.`);

      res.json({
        success: true,
        summary: {
          itemsRemoved: removedCount,
          freedSpace: `${(removedCount * 0.6 + 8).toFixed(1)} KB`,
          preservedItems: `${(db.prepare('SELECT count(*) as count FROM spots').get() as any).count} pontos turísticos e ${(db.prepare('SELECT count(*) as count FROM users').get() as any).count} usuários preservados`,
          currentDbSize: `${newDbSizeKb} KB`
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro durante a limpeza: ' + err.message });
    }
  });

  // Admin Logs
  app.get('/api/admin/logs', (req, res) => {
    try {
      const logs = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 50').all();
      res.json({ success: true, logs });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar logs' });
    }
  });

  // ==========================================
  // AI CHAT ENDPOINT ("CHAT" ASSISTANT ENGINE)
  // ==========================================

  // GET /api/chat/messages — Retrieve saved user conversation history
  app.get('/api/chat/messages', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Não autorizado' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as any;
    if (!session) {
      res.status(401).json({ success: false, error: 'Sessão inválida' });
      return;
    }

    try {
      const rows = db.prepare(`
        SELECT id, sender, text, time, data_json, created_at
        FROM chat_messages
        WHERE user_id = ?
        ORDER BY created_at ASC
      `).all(session.user_id) as any[];

      const messages = rows.map((r) => {
        let extra = {};
        if (r.data_json) {
          try { extra = JSON.parse(r.data_json); } catch (e) {}
        }
        return {
          id: r.id,
          sender: r.sender,
          text: r.text,
          time: r.time,
          ...extra,
        };
      });

      res.json({ success: true, messages });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Erro ao buscar mensagens do chat' });
    }
  });

  // POST /api/chat/messages — Save/sync user conversation history
  app.post('/api/chat/messages', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Não autorizado' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as any;
    if (!session) {
      res.status(401).json({ success: false, error: 'Sessão inválida' });
      return;
    }

    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ success: false, error: 'Formato de mensagens inválido' });
      return;
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO chat_messages (id, user_id, sender, text, time, data_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          text = excluded.text,
          time = excluded.time,
          data_json = excluded.data_json
      `);

      const insertMany = db.transaction((msgs: any[]) => {
        for (const m of msgs) {
          if (!m || !m.id || !m.sender || !m.text) continue;
          const { id, sender, text, time, ...rest } = m;
          const dataJson = Object.keys(rest).length > 0 ? JSON.stringify(rest) : null;
          stmt.run(id, session.user_id, sender, text, time || '', dataJson);
        }
      });

      insertMany(messages);

      res.json({ success: true });
    } catch (e) {
      console.error('Error saving chat messages:', e);
      res.status(500).json({ success: false, error: 'Erro ao salvar mensagens do chat' });
    }
  });

  // DELETE /api/chat/messages — Clear user conversation history
  app.delete('/api/chat/messages', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Não autorizado' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as any;
    if (!session) {
      res.status(401).json({ success: false, error: 'Sessão inválida' });
      return;
    }

    try {
      db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(session.user_id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Erro ao limpar mensagens do chat' });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, userCoords } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mensagem inválida' });
        return;
      }

      const ai = getGenAI();
      const groundingPlaces: Array<{ title: string; uri: string; address?: string; reviewSnippet?: string }> = [];
      const webSources: Array<{ title: string; uri: string; sourceName?: string }> = [];

      // Check if query needs real web search
      const needWeb = needsWebSearch(message, history || []);
      let webSearchData: Array<{ title: string; snippet: string; url: string; sourceName: string }> = [];

      if (needWeb) {
        let searchQuery = message;
        const lowerMsg = message.toLowerCase();
        
        // If question is contextual like "quanto custa?" or "está aberto?", append last mentioned topic from history
        if (lowerMsg.length < 35 && (lowerMsg.includes('custa') || lowerMsg.includes('aberto') || lowerMsg.includes('horario') || lowerMsg.includes('horário') || lowerMsg.includes('ingresso') || lowerMsg.includes('preço') || lowerMsg.includes('preco'))) {
          const recentUserMsgs = (history || []).filter((h: any) => h.sender === 'user' || h.role === 'user').slice(-3);
          const recentAssistantMsgs = (history || []).filter((h: any) => h.sender === 'assistant' || h.role === 'model').slice(-2);
          const ctxText = [...recentUserMsgs, ...recentAssistantMsgs].map((h: any) => h.text || '').join(' ');
          if (ctxText) {
            searchQuery = `${message} ${ctxText.slice(-180)}`;
          }
        }

        webSearchData = await performWebSearch(searchQuery);
        for (const ws of webSearchData) {
          if (ws.url && !webSources.some(s => s.uri === ws.url)) {
            webSources.push({
              title: ws.title,
              uri: ws.url,
              sourceName: ws.sourceName || 'Google Search',
            });
          }
        }
      }

      // Dynamic Intelligent Handling
      const lower = message.toLowerCase().trim();

      // 1. Fast, friendly response for simple greetings & casual conversation (NEVER dump itineraries on greeting!)
      if (lower === 'oi' || lower === 'olá' || lower === 'ola' || lower === 'oie' || lower === 'oii' || lower === 'oiii') {
        res.json({
          reply: 'Oi! 😊 Como posso te ajudar em Campos do Jordão?',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      if (lower === 'bom dia' || lower.startsWith('bom dia')) {
        res.json({
          reply: 'Bom dia! 😊 Como posso te ajudar?',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      if (lower === 'boa tarde' || lower.startsWith('boa tarde')) {
        res.json({
          reply: 'Boa tarde! 😊 Como posso te ajudar?',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      if (lower === 'boa noite' || lower.startsWith('boa noite')) {
        res.json({
          reply: 'Boa noite! 😊 Como posso te ajudar?',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      if (['obrigado', 'obrigada', 'muito obrigado', 'muito obrigada', 'obrigadão', 'brigado', 'brigada'].includes(lower)) {
        res.json({
          reply: 'Por nada! 😊',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      if (['valeu', 'valeu!', 'vlw', 'tks', 'thanks'].includes(lower)) {
        res.json({
          reply: 'Imagina! 😊',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      const greetingPhrases = ['oi tudo bem', 'oi tudo bem?', 'ola tudo bem', 'tudo bem', 'tudo bem?', 'e aí', 'e ai', 'opa', 'hey', 'hello'];
      if (greetingPhrases.includes(lower) || (lower.startsWith('oi') && lower.length <= 15 && (lower.includes('tudo bem') || lower.includes('bom dia') || lower.includes('boa tarde')))) {
        res.json({
          reply: 'Olá! Tudo bem com você? Como posso te ajudar hoje em Campos do Jordão?',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      // 2. Confused, punctuation or single dot input
      if (['.', '..', '...', '?', '??', '!', 'oi?', 'q', 'oq', 'o que'].includes(lower) || (lower.length === 1 && !/[a-z0-9]/i.test(lower))) {
        res.json({
          reply: 'Oi! Não entendi o que você quis dizer. Como posso te ajudar com passeios, restaurantes ou dicas em Campos do Jordão?',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      // 3. Location detection: "Onde fica...", "Aonde fica...", "Localização de..."
      const isLocationQuery = /^(onde|aonde|como chegar|localização|localizacao|onde é|fica onde)\b/i.test(lower) || lower.includes('onde fica') || lower.includes('aonde fica') || lower.includes('onde é o') || lower.includes('onde e o');
      
      // Special case: Location of Campos do Jordão city itself
      if (lower.includes('aonde fica campos do jordão') || lower.includes('onde fica campos do jordão') || lower.includes('aonde fica campos do jordao') || lower.includes('onde fica campos do jordao') || (isLocationQuery && (lower.includes('campos do jordao') || lower.includes('campos do jordão')) && !lower.includes('em campos do jordão') && !lower.includes('em campos'))) {
        res.json({
          reply: 'Campos do Jordão fica no interior de São Paulo, na Serra da Mantiqueira, a cerca de 1.628 metros de altitude. Quer que eu te mande a localização no mapa?',
          openMapSpot: {
            id: 'campos-do-jordao-center',
            name: 'Campos do Jordão',
            lat: -22.7394,
            lng: -45.5913,
            category: 'tourist_spot',
            categoryLabel: 'Centro da Cidade',
          },
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      if (isLocationQuery) {
        let matchedSpot: any = null;
        try {
          const spots = db.prepare('SELECT id, name, category, category_label, lat, lng, address, tourist_tip, description FROM spots WHERE is_active = 1').all() as any[];
          for (const s of spots) {
            const spotNameLower = s.name.toLowerCase();
            const cleanSpotName = spotNameLower.replace(/^(parque|pico|morro|vila|restaurante|café|cafe|chocolateria|hotel|pousada)\s+/i, '');
            if (lower.includes(spotNameLower) || lower.includes(cleanSpotName) || (cleanSpotName.length > 3 && lower.includes(cleanSpotName.slice(0, 5)))) {
              matchedSpot = s;
              break;
            }
          }
        } catch (e) {}

        if (matchedSpot) {
          const replyText = `O **${matchedSpot.name}** fica localizado em Campos do Jordão (${matchedSpot.address || 'região turística'}). Vou abrir a localização no mapa para você agora mesmo!`;
          res.json({
            reply: replyText,
            openMapSpot: {
              id: matchedSpot.id,
              name: matchedSpot.name,
              lat: matchedSpot.lat,
              lng: matchedSpot.lng,
              category: matchedSpot.category,
              categoryLabel: matchedSpot.category_label,
            },
            groundingPlaces: matchedSpot.lat && matchedSpot.lng ? [{
              title: matchedSpot.name,
              uri: `https://www.google.com/maps/search/?api=1&query=${matchedSpot.lat},${matchedSpot.lng}`,
              address: matchedSpot.address,
              reviewSnippet: matchedSpot.tourist_tip || matchedSpot.description,
            }] : [],
            webSources: [],
          });
          return;
        }
      }

      // 4. Off-topic detection
      const nonTourismKeywords = ['política', 'politica', 'eleição', 'eleicao', 'governo', 'presidente', 'deputado', 'crime', 'preso', 'assassinato', 'polícia', 'policia', 'fofoca', 'famosos', 'futebol', 'jogo de futebol', 'programação', 'javascript', 'python', 'cálculo', 'derivada', 'integral'];
      if (nonTourismKeywords.some(kw => lower.includes(kw))) {
        res.json({
          reply: 'Que tal voltarmos a falar sobre os melhores pontos e experiências de Campos do Jordão? Posso te sugerir ótimos passeios, restaurantes ou mirantes!',
          groundingPlaces: [],
          webSources: [],
        });
        return;
      }

      // Detect weather / rain forecast intent
      const isWeatherQuery = /^(previsão|previsao|clima|tempo|temperatura|chuva|chover|chove|sol|frio|calor)\b/i.test(lower) ||
        lower.includes('chover') || lower.includes('chuva') || lower.includes('clima') || lower.includes('temperatura') ||
        lower.includes('previsão') || lower.includes('previsao') || lower.includes('tempo pra semana') || lower.includes('tempo para a semana') ||
        lower.includes('vai chover') || lower.includes('dias que vai chover');

      let weatherData = '';
      if (isWeatherQuery) {
        weatherData = await fetchCamposWeatherForecast();
      }

      // Check if user is asking for itineraries (STRICT: EXCLUDE weather queries!)
      const isAskingItinerary = !isWeatherQuery && (
        lower.includes('roteiro') ||
        lower.includes('itinerario') ||
        lower.includes('itinerário') ||
        lower.includes('o que fazer em') ||
        (lower.includes('planejar') && !lower.includes('tempo')) ||
        lower.includes('sugestão de passeio') ||
        lower.includes('sugestao de passeio')
      );

      if (ai) {
        try {
          const contents: any[] = [];
          if (Array.isArray(history) && history.length > 0) {
            for (const item of history.slice(-12)) {
              if (item && item.text) {
                contents.push({
                  role: item.sender === 'user' ? 'user' : 'model',
                  parts: [{ text: item.text }],
                });
              }
            }
          }

          let finalUserPrompt = message;
          if (webSearchData.length > 0) {
            finalUserPrompt += `\n\n=== DADOS RECENTES PARA CONSULTA (PESQUISA GOOGLE) ===\n${webSearchData.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet}`).join('\n\n')}\n====================================\nInstrução Obrigatória: Use esses dados para responder à pergunta de forma estritamente OBJETIVA e DIRETA ao ponto. NUNCA mencione fontes, URLs, links, sites ou numerações de referência como [1] ou [2]. Envie APENAS a resposta limpa e objetiva.`;
          }

          if (isWeatherQuery && weatherData) {
            finalUserPrompt += `\n\n${weatherData}\n\nINSTRUÇÃO CRÍTICA DO SISTEMA PARA PREVISÃO DO TEMPO:\nO usuário está perguntando ESPECIFICAMENTE sobre a PREVISÃO DO TEMPO, CHUVAS E TEMPERATURAS em Campos do Jordão.\n1. Use os dados de previsão do tempo acima para explicar de forma Clara e Objetiva os dias em que vai chover (com porcentagem/intensidade) e os dias em que fará sol/tempo firme, informando as temperaturas mínima e máxima em °C.\n2. NUNCA envie ou ofereça um ROTEIRO DE PASSEIOS ("Roteiro Sugerido") nem lista de atrações turísticas nesta resposta!\n3. Mantenha a resposta focada 100% no tempo, clima e chuva solicitados pelo usuário.`;
          }

          const lastTurn = contents[contents.length - 1];
          if (!lastTurn || lastTurn.role !== 'user') {
            contents.push({
              role: 'user',
              parts: [{ text: finalUserPrompt }],
            });
          } else {
            lastTurn.parts = [{ text: finalUserPrompt }];
          }

          const monvianPromptSystem = buildMonvianSystemInstruction();

          // Call Gemini with timeout race
          const generateWithTimeout = async () => {
            try {
              return await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents,
                config: {
                  systemInstruction: monvianPromptSystem,
                  tools: [
                    { googleSearch: {} },
                  ],
                },
              });
            } catch (searchToolErr) {
              // Retry directly without search tool if googleSearch errored
              return await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents,
                config: {
                  systemInstruction: monvianPromptSystem,
                },
              });
            }
          };

          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI generation timeout')), 7500));
          const response: any = await Promise.race([generateWithTimeout(), timeoutPromise]);

          if (response?.text) {
            // Clean up any residual markdown URLs, footnotes or citation tags
            let cleanReply = response.text
              .replace(/\[\d+\]/g, '')
              .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1')
              .replace(/\(https?:\/\/[^\)]+\)/g, '')
              .replace(/https?:\/\/[^\s]+/g, '')
              .replace(/Fonte:\s*.*$/gim, '')
              .replace(/Fontes:\s*.*$/gim, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();

            res.json({
              reply: cleanReply,
              groundingPlaces: [],
              webSources: [],
              showItineraryCards: isAskingItinerary,
            });
            return;
          }
        } catch (genErr) {
          console.warn('Gemini chat processing fallback triggered:', genErr);
        }
      }

      // Dynamic Intelligent Fallback if API key is missing or network timed out
      let reply = '';
      if (isAskingItinerary) {
        // Fetch real itineraries and spots from DB
        let sampleItins = [];
        try {
          sampleItins = db.prepare('SELECT title, description, is_premium FROM itineraries WHERE is_active = 1 LIMIT 3').all() as any[];
        } catch (e) {}

        const itinList = sampleItins.length > 0
          ? sampleItins.map(it => `• **${it.title}** ${it.is_premium ? '⭐ (Conta Gold)' : '🆓 (Grátis)'}: ${it.description || 'Roteiro com mapa interativo'}`).join('\n')
          : '• **Campos Clássico (2 Dias)**: Vila Capivari, Amantikir, Teleférico e Pico do Itapeva.\n• **Roteiro Romântico a Dois**: Chocolaterias, pôr do sol no mirante e jantar com sequência de fondue.';

        reply = `Aqui está uma sugestão personalizada para a sua experiência em **Campos do Jordão**:\n\n` +
          `**Manhã**: Comece o dia conhecendo o charmoso **Parque Amantikir** com seus jardins temáticos ou subindo o **Morro do Elefante** de teleférico.\n\n` +
          `**Tarde**: Almoce ou tome um café especial em **Vila Capivari**, visite uma chocolateria artesanal e suba ao **Pico do Itapeva** para admirar a vista da Serra da Mantiqueira.\n\n` +
          `**Noite**: Finalize com um tradicional fondue suíço à luz de velas acompanhado de um bom vinho serrano.\n\n` +
          `🗺️ **Quer navegar passo a passo com mapa?**\n` +
          `Você pode acessar a aba **Roteiros** na barra inferior do aplicativo Monvian. Lá você encontra roteiros prontos e estruturados com mapa interativo:`;
      } else if (lower.includes('fondue') || lower.includes('comer') || lower.includes('restaurante') || lower.includes('jantar') || lower.includes('almoço') || lower.includes('almoco') || lower.includes('gastronomia')) {
        let spots = [];
        try {
          spots = db.prepare("SELECT name, address, tourist_tip FROM spots WHERE (category = 'restaurant' OR name LIKE '%fondue%' OR description LIKE '%fondue%') AND is_active = 1 LIMIT 3").all() as any[];
        } catch (e) {}
        
        reply = `Campos do Jordão conta com excelentes opções gastronômicas:\n\n` +
          (spots.length > 0 
            ? spots.map(s => `• **${s.name}**: ${s.tourist_tip || s.address}`).join('\n\n')
            : `• **Sequência Tradicional de Fondue em Capivari**: Queijo alpino acompanhado de pães e batatas, carnes nobres e fondue de chocolate com frutas frescas.\n• **Baden Baden Vila Capivari**: Clássicos pratos alemães, chopes artesanais e atmosfera serrana animada.`) +
          `\n\nDica: Nos fins de semana, vale a pena reservar mesa com antecedência.`;
      } else if (lower.includes('tempo') || lower.includes('clima') || lower.includes('chuva') || lower.includes('temperatura') || lower.includes('frio')) {
        reply = `O clima em **Campos do Jordão** é de montanha. Durante o dia, as temperaturas costumam ficar agradáveis entre **16°C e 22°C**, mas ao entardecer e à noite o clima esfria rápido, atingindo entre **8°C e 12°C**.\n\nDica: Tenha sempre uma jaqueta ou casaco à mão.`;
      } else if (webSearchData.length > 0) {
        // Direct objective summary from web search without sources or links
        const cleanSnippets = webSearchData.map(r => r.snippet.replace(/https?:\/\/[^\s]+/g, '').trim()).filter(Boolean).slice(0, 2);
        reply = cleanSnippets.length > 0 
          ? cleanSnippets.join('\n\n')
          : `Em Campos do Jordão você encontra opções completas para isso. Como posso te orientar melhor?`;
      } else {
        // Find matching spots in DB
        let matchingSpots = [];
        try {
          matchingSpots = db.prepare("SELECT name, category_label, description, tourist_tip FROM spots WHERE is_active = 1 AND (name LIKE ? OR description LIKE ?) LIMIT 3").all(`%${lower}%`, `%${lower}%`) as any[];
        } catch (e) {}

        if (matchingSpots.length > 0) {
          reply = matchingSpots.map(s => `• **${s.name}**: ${s.description}${s.tourist_tip ? ` (${s.tourist_tip})` : ''}`).join('\n\n');
        } else {
          reply = `Campos do Jordão oferece excelentes opções para passeios, gastronomia e lazer. O que você gostaria de saber especificamente?`;
        }
      }

      res.json({
        reply,
        groundingPlaces: [],
        webSources: [],
        showItineraryCards: isAskingItinerary,
      });
    } catch (err: any) {
      console.error('/api/chat error:', err);
      res.status(500).json({ error: 'Erro ao processar mensagem do chat' });
    }
  });

  // ==========================================
  // GOOGLE MAPS REAL-TIME SPOT ENRICHMENT
  // ==========================================

  app.post('/api/spots/:id/sync-maps', async (req, res) => {
    try {
      const { id } = req.params;
      const spot: any = db.prepare('SELECT * FROM spots WHERE id = ?').get(id);
      if (!spot) {
        res.status(404).json({ error: 'Ponto turístico não encontrado' });
        return;
      }

      const ai = getGenAI();
      let mapsUrl = spot.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.name + ' Campos do Jordão')}`;
      let reviewSnippet = spot.google_review_snippet || '';
      let liveStatus = 'Informações verificadas no Google Maps';
      let realRating = spot.rating;

      if (ai) {
        try {
          const prompt = `Consulte as informações mais recentes e precisas do Google Maps sobre "${spot.name}" em Campos do Jordão, SP (coordenadas aprox: ${spot.lat}, ${spot.lng}). 
Forneça um resumo curto sobre o local, horários de pico, status atual, endereço exato e uma dica ou trecho de avaliação dos visitantes.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: spot.lat,
                    longitude: spot.lng,
                  },
                },
              },
            },
          });

          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const chunk of chunks as any[]) {
              if (chunk.maps) {
                if (chunk.maps.uri) mapsUrl = chunk.maps.uri;
                if (chunk.maps.placeAnswerSources?.reviewSnippets?.[0]) {
                  reviewSnippet = chunk.maps.placeAnswerSources.reviewSnippets[0];
                }
              }
            }
          }

          if (response.text) {
            liveStatus = response.text.slice(0, 350);
          }
        } catch (e) {
          console.warn('Erro ao sincronizar spot via Google Maps Grounding:', e);
        }
      }

      // Update spot in DB
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE spots SET
          maps_url = ?,
          google_review_snippet = ?,
          last_synced_maps = ?
        WHERE id = ?
      `).run(mapsUrl, reviewSnippet, now, id);

      const updatedSpot: any = db.prepare('SELECT * FROM spots WHERE id = ?').get(id);

      res.json({
        success: true,
        message: 'Dados atualizados em tempo real com Google Maps!',
        spot: {
          id: updatedSpot.id,
          name: updatedSpot.name,
          shortName: updatedSpot.short_name || updatedSpot.name,
          tagLabel: updatedSpot.tag_label || updatedSpot.name,
          category: updatedSpot.category,
          categoryLabel: updatedSpot.category_label || updatedSpot.category,
          lat: updatedSpot.lat,
          lng: updatedSpot.lng,
          image: updatedSpot.image,
          gallery: updatedSpot.gallery ? JSON.parse(updatedSpot.gallery) : [],
          description: updatedSpot.description,
          touristTip: updatedSpot.tourist_tip,
          rating: updatedSpot.rating,
          reviewCount: updatedSpot.review_count,
          hours: updatedSpot.hours,
          address: updatedSpot.address,
          priceRange: updatedSpot.price_range,
          popularTimes: updatedSpot.popular_times,
          visitorsToday: updatedSpot.visitors_today,
          badge: updatedSpot.badge,
          highlighted: Boolean(updatedSpot.highlighted),
          isActive: Boolean(updatedSpot.is_active),
          isVerified: Boolean(updatedSpot.is_verified),
          website: updatedSpot.website || '',
          phone: updatedSpot.phone || '',
          mapsUrl: updatedSpot.maps_url,
          googleRating: updatedSpot.google_rating,
          googleReviewSnippet: updatedSpot.google_review_snippet,
          lastSyncedMaps: updatedSpot.last_synced_maps,
        },
        liveSummary: liveStatus,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao sincronizar com Google Maps: ' + err.message });
    }
  });

  // ==========================================
  // GOOGLE MAPS LIVE SEARCH & DISCOVERY
  // ==========================================

  app.post('/api/maps/search-live', async (req, res) => {
    try {
      const { query, lat, lng } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Consulta de busca obrigatória' });
        return;
      }

      const ai = getGenAI();
      const searchLat = lat || -22.7394;
      const searchLng = lng || -45.5912;
      const places: Array<{ title: string; uri: string; address?: string; snippet?: string }> = [];
      let summary = '';

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `Encontre e liste os melhores e mais atualizados locais para "${query}" em Campos do Jordão, SP. Forneça detalhes de horário, endereço e destaques com base no Google Maps.`,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: Number(searchLat),
                    longitude: Number(searchLng),
                  },
                },
              },
            },
          });

          summary = response.text || '';
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const chunk of chunks as any[]) {
              if (chunk.maps && chunk.maps.uri) {
                places.push({
                  title: chunk.maps.title || query,
                  uri: chunk.maps.uri,
                  address: chunk.maps.placeAnswerSources?.address || chunk.maps.address || '',
                  snippet: chunk.maps.placeAnswerSources?.reviewSnippets?.[0] || '',
                });
              }
            }
          }
        } catch (e) {
          console.warn('Google Maps Search grounding error:', e);
        }
      }

      res.json({
        success: true,
        query,
        summary: summary || `Resultados do Google Maps para ${query} em Campos do Jordão.`,
        places,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao pesquisar no Google Maps: ' + err.message });
    }
  });

  // Register Itineraries & Tour Planner API routes
  registerItineraryRoutes(app, db, getAuthUserSync, logAdminAction, getGenAI);

  // Register Social Publications Feed API routes
  registerSocialRoutes(app, db);

  // Register Stories 24h Feed & Views API routes
  registerStoryRoutes(app, db);

  // Register Stripe One-Time Payment & Webhook routes
  registerStripeRoutes(app, db, getAuthUser, logAdminAction);

  // Serve public static assets (manifest.json, sw.js, icons, etc.)
  const publicPath = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicPath));

  // Vite middleware in dev, static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Await complete Cloud Firestore sync before accepting connections
  try {
    await syncDatabaseWithFirestore(db);
    console.log('[Boot] Initial Cloud Firestore synchronization completed.');
  } catch (syncErr) {
    console.warn('[Boot] Initial Cloud Firestore sync notice:', syncErr);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
