import Database from 'better-sqlite3';
import path from 'path';

function createSafeDatabase() {
  const candidates = process.env.VERCEL
    ? ['/tmp/database.sqlite', ':memory:']
    : [path.resolve(process.cwd(), 'database.sqlite'), '/tmp/database.sqlite', ':memory:'];

  for (const candidate of candidates) {
    try {
      const instance = new Database(candidate);
      if (candidate !== ':memory:') {
        instance.pragma('journal_mode = WAL');
      }
      return instance;
    } catch {
      // Try next candidate path if filesystem is read-only
    }
  }
  return new Database(':memory:');
}

export const db = createSafeDatabase();

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    whatsapp TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

try { db.exec(`ALTER TABLE users ADD COLUMN name TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN email TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN username_normalized TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN visits_count INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN is_gold INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'beta';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN gold_activated_at DATETIME;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN snow_enabled INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN rain_enabled INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light';`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN high_contrast INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN onboarding_step INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN location_permission_granted INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN motion_permission_granted INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN last_access DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN auth_id TEXT;`); } catch (e) {}

try {
  db.exec(`
    UPDATE users 
    SET username_normalized = LOWER(REPLACE(COALESCE(username, name, email, 'user'), ' ', ''))
    WHERE username_normalized IS NULL OR username_normalized = '';
  `);
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    spot_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, spot_id)
  );

  CREATE TABLE IF NOT EXISTS map_visual_icons (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    icon TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    color TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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
    popular_times TEXT,
    visitors_today INTEGER DEFAULT 0,
    badge TEXT,
    highlighted INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_verified INTEGER DEFAULT 1,
    website TEXT,
    phone TEXT,
    available_for_itinerary INTEGER DEFAULT 1,
    duration_minutes INTEGER DEFAULT 90,
    tags TEXT,
    price TEXT,
    maps_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec(`ALTER TABLE map_visual_icons ADD COLUMN icon TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE map_visual_icons ADD COLUMN color TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE map_visual_icons ADD COLUMN is_active INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE map_visual_icons ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
try { db.exec(`ALTER TABLE map_visual_icons ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}

try { db.exec(`ALTER TABLE spots ADD COLUMN popular_times TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN visitors_today INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN badge TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN highlighted INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN is_verified INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN website TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN phone TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN short_name TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN tag_label TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN category_label TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN price_range TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN price TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN available_for_itinerary INTEGER DEFAULT 1;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN duration_minutes INTEGER DEFAULT 90;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN tags TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN maps_url TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE spots ADD COLUMN is_active INTEGER DEFAULT 1;`); } catch (e) {}

// Seed default visual icons if empty
try {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM map_visual_icons').get() as { count: number };
  if (!countRow || countRow.count === 0) {
    const defaultIcons = [
      { id: 'v_gas_1', category: 'gas_station', latitude: -22.739400, longitude: -45.591300, color: '#2563EB' },
      { id: 'v_gas_2', category: 'gas_station', latitude: -22.731200, longitude: -45.586100, color: '#2563EB' },
      { id: 'v_pharmacy_1', category: 'pharmacy', latitude: -22.738000, longitude: -45.589000, color: '#E11D48' },
      { id: 'v_hospital_1', category: 'hospital', latitude: -22.735000, longitude: -45.585000, color: '#DC2626' },
      { id: 'v_parking_1', category: 'parking', latitude: -22.739000, longitude: -45.588000, color: '#0284C7' },
      { id: 'v_market_1', category: 'market', latitude: -22.741000, longitude: -45.593000, color: '#D97706' },
      { id: 'v_cafe_1', category: 'cafe', latitude: -22.737500, longitude: -45.592000, color: '#EA580C' },
      { id: 'v_restaurant_1', category: 'restaurant', latitude: -22.738800, longitude: -45.588500, color: '#F97316' },
      { id: 'v_restroom_1', category: 'restroom', latitude: -22.738200, longitude: -45.587800, color: '#0891B2' },
      { id: 'v_park_1', category: 'park', latitude: -22.737000, longitude: -45.586000, color: '#16A34A' },
      { id: 'v_viewpoint_1', category: 'viewpoint', latitude: -22.748000, longitude: -45.560000, color: '#9333EA' },
      { id: 'v_terminal_1', category: 'terminal', latitude: -22.733000, longitude: -45.596000, color: '#4F46E5' },
      { id: 'v_church_1', category: 'church', latitude: -22.739800, longitude: -45.589500, color: '#475569' },
      { id: 'v_lodging_1', category: 'lodging', latitude: -22.736000, longitude: -45.587000, color: '#7C3AED' },
      { id: 'v_atm_1', category: 'atm', latitude: -22.738500, longitude: -45.588800, color: '#059669' }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO map_visual_icons (id, category, latitude, longitude, color, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    db.transaction(() => {
      for (const item of defaultIcons) {
        insertStmt.run(item.id, item.category, item.latitude, item.longitude, item.color);
      }
    })();
  }
} catch (e) {
  console.warn('Error seeding visual icons:', e);
}

