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
`);
