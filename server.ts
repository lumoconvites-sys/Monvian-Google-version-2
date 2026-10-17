import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db_setup.js';
import { registerSocialRoutes, setupSocialDatabase } from './src/server/socialRoutes.js';
import { registerStoryRoutes, setupStoriesDatabase } from './src/server/storyRoutes.js';
import { registerItineraryRoutes, setupItineraryDatabase } from './src/server/itineraryRoutes.js';
import { registerStripeRoutes, setupStripeDatabase } from './src/server/stripeRoutes.js';
import { registerHostRoutes, setupHostDatabase } from './src/server/hostRoutes.js';
import { CAMPOS_SPOTS } from './src/data/spots.js';

const __dirname = path.resolve();

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Helper: Find user by token
  const getUserByToken = (token: string) => {
    try {
      const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: number } | undefined;
      if (!session) return null;
      const user = db.prepare('SELECT id, name, username, email, whatsapp, avatar_url, role, is_gold, created_at FROM users WHERE id = ?').get(session.user_id) as any;
      return user || null;
    } catch {
      return null;
    }
  };

  const getAuthUserSync = (req: Request) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return getUserByToken(token);
      }
      return null;
    } catch {
      return null;
    }
  };

  // Initialize SQLite databases & routes
  try {
    setupSocialDatabase(db);
    setupStoriesDatabase(db);
    setupItineraryDatabase(db);
    setupStripeDatabase(db);
    setupHostDatabase(db);
    registerSocialRoutes(app, db);
    registerStoryRoutes(app, db);
    registerItineraryRoutes(
      app,
      db,
      getAuthUserSync,
      (userId: any, userName: any, action: any, details: any) => console.log(`[Admin] ${userName}: ${action}`, details),
      () => null
    );
    registerStripeRoutes(
      app,
      db,
      getAuthUserSync,
      (userId: any, userName: any, action: any, details: any) => console.log(`[Admin] ${userName}: ${action}`, details)
    );
    registerHostRoutes(app, db, getAuthUserSync);
  } catch (err) {
    console.warn('Database initialization warning:', err);
  }



  // --- Auth API Endpoints ---
  app.get('/api/users/check-username', (req: Request, res: Response) => {
    try {
      const username = String(req.query.username || '').trim().toLowerCase();
      if (!username || username.length < 3) {
        return res.json({ available: false, error: 'Mínimo 3 caracteres' });
      }
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(username);
      return res.json({ available: !existing });
    } catch (err: any) {
      return res.status(500).json({ available: false, error: err.message });
    }
  });

  app.post('/api/auth/register-firebase', (req: Request, res: Response) => {
    try {
      const { name, username, email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const cleanUsername = username ? String(username).trim().toLowerCase() : cleanEmail.split('@')[0];

      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cleanEmail, cleanUsername) as any;
      if (existing) {
        return res.status(400).json({ success: false, error: 'E-mail ou nome de usuário já em uso' });
      }

      const hash = bcrypt.hashSync(String(password), 10);
      const insert = db.prepare(`
        INSERT INTO users (name, username, email, whatsapp, password_hash, role, is_gold)
        VALUES (?, ?, ?, ?, ?, 'user', 0)
      `).run(name || cleanUsername, cleanUsername, cleanEmail, cleanEmail, hash);

      const userId = insert.lastInsertRowid;
      const token = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);

      const user = {
        id: userId,
        name: name || cleanUsername,
        username: cleanUsername,
        email: cleanEmail,
        role: 'user',
        is_gold: 0,
        isGold: false,
        avatar_url: '/loogo.png'
      };

      return res.json({ success: true, token, user });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Informe seu e-mail e senha' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cleanEmail, cleanEmail) as any;

      if (!user) {
        // Auto-provision demo user if password provided
        if (password) {
          const hash = bcrypt.hashSync(String(password), 10);
          const username = cleanEmail.split('@')[0];
          const insert = db.prepare(`
            INSERT INTO users (name, username, email, whatsapp, password_hash, role, is_gold)
            VALUES (?, ?, ?, ?, ?, 'user', 0)
          `).run(username, username, cleanEmail, cleanEmail, hash);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);
        } else {
          return res.status(401).json({ success: false, error: 'Usuário não encontrado' });
        }
      } else if (password && user.password_hash) {
        const matches = bcrypt.compareSync(String(password), user.password_hash);
        if (!matches) {
          return res.status(401).json({ success: false, error: 'Senha incorreta' });
        }
      }

      const token = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const safeUser = {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        is_gold: user.is_gold || 0,
        isGold: Boolean(user.is_gold),
        avatar_url: user.avatar_url || '/loogo.png'
      };

      return res.json({ success: true, token, user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/google', (req: Request, res: Response) => {
    try {
      const { email, name, avatar_url } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'E-mail é obrigatório' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail) as any;
      let isNew = false;

      if (!user) {
        isNew = true;
        const username = cleanEmail.split('@')[0];
        const dummyHash = bcrypt.hashSync(crypto.randomUUID(), 10);
        const insert = db.prepare(`
          INSERT INTO users (name, username, email, whatsapp, password_hash, avatar_url, role, is_gold)
          VALUES (?, ?, ?, ?, ?, ?, 'user', 0)
        `).run(name || username, username, cleanEmail, cleanEmail, dummyHash, avatar_url || '/loogo.png');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);
      }

      const token = crypto.randomUUID();
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

      const safeUser = {
        id: user.id,
        name: user.name || name,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        is_gold: user.is_gold || 0,
        isGold: Boolean(user.is_gold),
        avatar_url: avatar_url || user.avatar_url || '/loogo.png'
      };

      return res.json({ success: true, token, user: safeUser, is_new: isNew });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      }
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      const token = authHeader.substring(7);
      const user = getUserByToken(token);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Sessão inválida' });
      }
      return res.json({ success: true, user });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Spots & Admin API ---
  app.get('/api/admin/spots', (_req: Request, res: Response) => {
    return res.json({ success: true, spots: CAMPOS_SPOTS });
  });

  // --- Visual Map Icons API ---
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

  app.post('/api/admin/map-visual-icons', (req: Request, res: Response) => {
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

      const created = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(iconId);
      return res.json({ success: true, icon: created, message: 'Ícone adicionado com sucesso!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/admin/map-visual-icons/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { category, latitude, longitude, color, is_active } = req.body;

      db.prepare(`
        UPDATE map_visual_icons
        SET category = ?, latitude = ?, longitude = ?, color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(String(category), Number(latitude), Number(longitude), color || null, is_active ? 1 : 0, id);

      const updated = db.prepare('SELECT * FROM map_visual_icons WHERE id = ?').get(id);
      return res.json({ success: true, icon: updated, message: 'Ícone atualizado com sucesso!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.patch('/api/admin/map-visual-icons/:id/toggle-active', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const current = db.prepare('SELECT is_active FROM map_visual_icons WHERE id = ?').get(id) as { is_active: number } | undefined;
      if (!current) {
        return res.status(404).json({ success: false, error: 'Ícone não encontrado' });
      }

      const nextActive = current.is_active === 1 ? 0 : 1;
      db.prepare('UPDATE map_visual_icons SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextActive, id);

      return res.json({
        success: true,
        is_active: nextActive,
        message: nextActive === 1 ? 'Marcador ativado no mapa' : 'Marcador ocultado do mapa'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/admin/map-visual-icons/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM map_visual_icons WHERE id = ?').run(id);
      return res.json({ success: true, message: 'Ícone removido com sucesso' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Favorites
  app.get('/api/user/favorites', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const user = getUserByToken(token);
      const userId = user ? String(user.id) : 'guest';
      const rows = db.prepare('SELECT spot_id FROM favorites WHERE user_id = ?').all(userId) as { spot_id: string }[];
      return res.json({ success: true, favorites: rows.map(r => r.spot_id) });
    } catch {
      return res.json({ success: true, favorites: [] });
    }
  });

  app.post('/api/user/favorites/toggle', (req: Request, res: Response) => {
    try {
      const { spotId } = req.body;
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
      const user = getUserByToken(token);
      const userId = user ? String(user.id) : 'guest';

      const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND spot_id = ?').get(userId, spotId);
      if (existing) {
        db.prepare('DELETE FROM favorites WHERE user_id = ? AND spot_id = ?').run(userId, spotId);
        return res.json({ success: true, isFavorite: false });
      } else {
        db.prepare('INSERT INTO favorites (user_id, spot_id) VALUES (?, ?)').run(userId, spotId);
        return res.json({ success: true, isFavorite: true });
      }
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
