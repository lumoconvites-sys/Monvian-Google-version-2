import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

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

try {
  db.exec(`ALTER TABLE users ADD COLUMN name TEXT;`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN email TEXT;`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
} catch (e) {}
try {
  db.exec(`ALTER TABLE users ADD COLUMN is_gold INTEGER DEFAULT 0;`);
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
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    color TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

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

