import { Request, Response, Express } from 'express';
import { Database as SqliteDatabase } from 'better-sqlite3';
import { calculateHaversineDistance } from '../services/gpsNavigation.js';

export interface XpLevelInfo {
  level: number;
  title: string;
  minXp: number;
  maxXp: number; // upper bound of this level range
  nextLevelXp: number; // goal to reach next level
}

export const XP_LEVELS: XpLevelInfo[] = [
  { level: 1, title: 'Explorador', minXp: 0, maxXp: 999, nextLevelXp: 1000 },
  { level: 2, title: 'Aventureiro', minXp: 1000, maxXp: 2499, nextLevelXp: 2500 },
  { level: 3, title: 'Desbravador', minXp: 2500, maxXp: 4999, nextLevelXp: 5000 },
  { level: 4, title: 'Elite Monvian', minXp: 5000, maxXp: 9999, nextLevelXp: 10000 },
  { level: 5, title: 'Lenda Monvian', minXp: 10000, maxXp: 10000, nextLevelXp: 10000 },
];

export function computeLevelFromXp(totalXp: number): XpLevelInfo {
  const xp = Math.max(0, Number(totalXp) || 0);
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].minXp) {
      return XP_LEVELS[i];
    }
  }
  return XP_LEVELS[0];
}

function isMarioYeskIdentity(userId?: string | null, userObj?: any | null, req?: Request): boolean {
  const candidates = [
    userId,
    userObj?.id ? String(userObj.id) : '',
    userObj?.username,
    userObj?.email,
    userObj?.whatsapp,
    req?.headers?.['x-username'] as string,
    req?.headers?.['x-user-email'] as string,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase().replace(/^@+/, ''));

  return candidates.some(
    (c) =>
      c === '47' ||
      c === 'marioyesk' ||
      c === 'marioyesk@gmail.com' ||
      c === 'empresariomario@gmail.com' ||
      c === 'marioempresario@gmail.com'
  );
}

export function ensureMarioYeskMaxExplorerLevel(db: SqliteDatabase, targetUserId: string = '47') {
  try {
    const allSpots = db
      .prepare('SELECT id, name, category_label, category, lat, lng FROM spots WHERE is_active = 1')
      .all() as any[];

    const spotsCount = Math.max(allSpots.length, 30);
    const maxXp = Math.max(10000, spotsCount * 100);
    const maxLevel = XP_LEVELS[XP_LEVELS.length - 1].level;

    const marioUserIds = Array.from(
      new Set([targetUserId, '47', 'marioyesk', 'marioyesk@gmail.com', 'empresariomario@gmail.com'])
    );

    const upsertProgress = db.prepare(`
      INSERT INTO user_xp_progress (user_id, total_xp, current_level, places_discovered_count, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        total_xp = MAX(total_xp, excluded.total_xp),
        current_level = excluded.current_level,
        places_discovered_count = MAX(places_discovered_count, excluded.places_discovered_count),
        updated_at = CURRENT_TIMESTAMP
    `);

    const insertVisit = db.prepare(`
      INSERT OR IGNORE INTO user_spot_visits (
        id, user_id, spot_id, spot_name, category, xp_awarded,
        user_lat, user_lng, spot_lat, spot_lng, distance_meters
      ) VALUES (?, ?, ?, ?, ?, 100, ?, ?, ?, ?, 5.0)
    `);

    const tx = db.transaction(() => {
      for (const uid of marioUserIds) {
        upsertProgress.run(uid, maxXp, maxLevel, allSpots.length || spotsCount);
        for (const spot of allSpots) {
          const visitId = `visit_mario_${uid}_${spot.id}`;
          insertVisit.run(
            visitId,
            uid,
            spot.id,
            spot.name || 'Ponto Turístico',
            spot.category_label || spot.category || 'Atração',
            Number(spot.lat) || -22.7192,
            Number(spot.lng) || -45.5673,
            Number(spot.lat) || -22.7192,
            Number(spot.lng) || -45.5673
          );
        }
      }
    });

    tx();
  } catch (err) {
    console.warn('[XPSetup] Failed to seed @marioyesk max explorer level:', err);
  }
}

export function setupXpDatabase(db: SqliteDatabase) {
  // Ensure tables for user exploration progression exist in SQLite
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_xp_progress (
      user_id TEXT PRIMARY KEY,
      total_xp INTEGER NOT NULL DEFAULT 0,
      current_level INTEGER NOT NULL DEFAULT 1,
      places_discovered_count INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_spot_visits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      spot_id TEXT NOT NULL,
      spot_name TEXT NOT NULL,
      category TEXT,
      xp_awarded INTEGER NOT NULL DEFAULT 100,
      user_lat REAL,
      user_lng REAL,
      spot_lat REAL,
      spot_lng REAL,
      distance_meters REAL,
      visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, spot_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_spot_visits_user ON user_spot_visits(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_spot_visits_spot ON user_spot_visits(spot_id);
    CREATE INDEX IF NOT EXISTS idx_user_xp_progress_total ON user_xp_progress(total_xp DESC);
  `);

  ensureMarioYeskMaxExplorerLevel(db, '47');
}

export function registerXpRoutes(
  app: Express,
  db: SqliteDatabase,
  resolveUser: (req: Request) => Promise<any | null>
) {
  setupXpDatabase(db);

  /**
   * Helper: Resolve effective user identifier
   * Prefers authenticated user id/email, falls back to x-username / x-user-email or client session id
   */
  const getEffectiveUserId = async (req: Request): Promise<{ userId: string; userObj: any | null } | null> => {
    try {
      const authUser = await resolveUser(req);
      if (authUser && (authUser.id || authUser.email)) {
        return { userId: String(authUser.id || authUser.email), userObj: authUser };
      }
    } catch {}

    const headerUsername = String(req.headers['x-username'] || '').trim().toLowerCase().replace(/^@+/, '');
    const headerEmail = String(req.headers['x-user-email'] || '').trim().toLowerCase();
    if (
      headerUsername === 'marioyesk' ||
      ['marioyesk@gmail.com', 'empresariomario@gmail.com', 'marioempresario@gmail.com'].includes(headerEmail)
    ) {
      return {
        userId: '47',
        userObj: {
          id: 47,
          username: 'marioyesk',
          email: headerEmail || 'marioyesk@gmail.com',
        },
      };
    }

    const clientSessionHeader = (req.headers['x-session-id'] as string) || (req.headers['x-client-session'] as string);
    if (clientSessionHeader && clientSessionHeader.trim().length > 3) {
      return { userId: `guest_${clientSessionHeader.trim()}`, userObj: null };
    }

    return null;
  };

  /**
   * GET /api/xp/profile
   * Returns current XP, level info, places discovered, and recent history
   */
  app.get('/api/xp/profile', async (req: Request, res: Response) => {
    try {
      const userIdent = await getEffectiveUserId(req);
      if (!userIdent) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão ausente' });
      }

      const { userId, userObj } = userIdent;
      const isMario = isMarioYeskIdentity(userId, userObj, req);

      if (isMario) {
        ensureMarioYeskMaxExplorerLevel(db, userId);
      }

      // 1. Fetch or create progress row
      let progress = db
        .prepare('SELECT * FROM user_xp_progress WHERE user_id = ?')
        .get(userId) as any;

      if (!progress) {
        db.prepare(`
          INSERT INTO user_xp_progress (user_id, total_xp, current_level, places_discovered_count)
          VALUES (?, 0, 1, 0)
        `).run(userId);

        progress = {
          user_id: userId,
          total_xp: 0,
          current_level: 1,
          places_discovered_count: 0,
        };
      }

      const levelInfo = computeLevelFromXp(progress.total_xp);
      const isMaxLevel = levelInfo.level >= XP_LEVELS[XP_LEVELS.length - 1].level;

      // 2. Fetch history of discovered spots
      const history = db
        .prepare(`
          SELECT id, spot_id, spot_name, category, xp_awarded, visited_at, distance_meters
          FROM user_spot_visits
          WHERE user_id = ?
          ORDER BY visited_at DESC
          LIMIT 200
        `)
        .all(userId) as any[];

      // 3. Set of visited spot IDs for instant frontend lookups
      const visitedSpotIds = history.map((h) => h.spot_id);

      // Level progress metrics
      const currentLevelMin = levelInfo.minXp;
      const currentLevelGoal = isMaxLevel ? Math.max(levelInfo.nextLevelXp, progress.total_xp) : levelInfo.nextLevelXp;
      const xpInCurrentLevel = Math.max(0, progress.total_xp - currentLevelMin);
      const xpNeededForNext = isMaxLevel ? 0 : Math.max(0, currentLevelGoal - progress.total_xp);
      const levelSpan = Math.max(1, currentLevelGoal - currentLevelMin);
      const levelProgressRatio = isMaxLevel ? 1 : Math.min(1, Math.max(0, xpInCurrentLevel / levelSpan));

      res.json({
        success: true,
        userId,
        totalXp: progress.total_xp,
        currentLevel: levelInfo.level,
        levelTitle: levelInfo.title,
        nextLevelXp: currentLevelGoal,
        xpRemaining: xpNeededForNext,
        levelProgressRatio,
        placesDiscoveredCount: Math.max(progress.places_discovered_count, visitedSpotIds.length),
        visitedSpotIds,
        history,
      });
    } catch (err: any) {
      console.error('[XPRoutes] Error fetching XP profile:', err);
      res.status(500).json({ error: 'Erro ao obter dados de XP: ' + err.message });
    }
  });

  /**
   * POST /api/xp/validate-visit
   * Validates GPS proximity to a spot and awards +100 XP securely
   */
  app.post('/api/xp/validate-visit', async (req: Request, res: Response) => {
    try {
      const userIdent = await getEffectiveUserId(req);
      if (!userIdent) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão ausente' });
      }

      const { userId } = userIdent;
      const { spotId, lat, lng } = req.body || {};

      if (!spotId) {
        return res.status(400).json({ error: 'ID do estabelecimento/ponto é obrigatório' });
      }

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({ error: 'Coordenadas GPS do usuário são obrigatórias' });
      }

      // Check if user already claimed this spot (prevents duplicate rewards)
      const existingVisit = db
        .prepare('SELECT id, spot_id, spot_name, visited_at FROM user_spot_visits WHERE user_id = ? AND spot_id = ?')
        .get(userId, spotId) as any;

      if (existingVisit) {
        return res.json({
          success: false,
          alreadyDiscovered: true,
          message: 'Você já descobriu este local anteriormente!',
          spotId,
          visitedAt: existingVisit.visited_at,
        });
      }

      // Look up target spot coordinates from database
      const spotRow = db
        .prepare('SELECT id, name, category_label, category, lat, lng FROM spots WHERE id = ?')
        .get(spotId) as any;

      if (!spotRow) {
        return res.status(404).json({ error: 'Ponto turístico ou estabelecimento não encontrado no sistema' });
      }

      const spotLat = Number(spotRow.lat);
      const spotLng = Number(spotRow.lng);

      if (isNaN(spotLat) || isNaN(spotLng)) {
        return res.status(500).json({ error: 'Coordenadas inválidas cadastradas para este estabelecimento' });
      }

      // Compute precise Haversine distance in meters
      const distanceMeters = calculateHaversineDistance(lng, lat, spotLng, spotLat);
      const isScreenTouch = Boolean(req.body?.screenTouch);

      // Proximity threshold: allow validation when user icon touches spot icon on map or within 450m
      const MAX_PROXIMITY_METERS = isScreenTouch ? 2500 : 450;

      if (distanceMeters > MAX_PROXIMITY_METERS) {
        return res.status(400).json({
          success: false,
          tooFar: true,
          message: `Você está a ${Math.round(distanceMeters)}m do local. Aproxime-se para validar sua visita!`,
          distanceMeters: Math.round(distanceMeters * 10) / 10,
          requiredDistanceMeters: 150,
        });
      }

      // Award exactly 100 XP atomically
      const XP_PER_DISCOVERY = 100;
      const visitId = `visit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const insertVisit = db.prepare(`
        INSERT INTO user_spot_visits (
          id, user_id, spot_id, spot_name, category, xp_awarded,
          user_lat, user_lng, spot_lat, spot_lng, distance_meters
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateProgress = db.prepare(`
        INSERT INTO user_xp_progress (user_id, total_xp, current_level, places_discovered_count, updated_at)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          total_xp = total_xp + ?,
          places_discovered_count = places_discovered_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `);

      const getUpdatedProgress = db.prepare(`
        SELECT total_xp, places_discovered_count FROM user_xp_progress WHERE user_id = ?
      `);

      // Run transactional insert + update
      const transaction = db.transaction(() => {
        insertVisit.run(
          visitId,
          userId,
          spotRow.id,
          spotRow.name || 'Ponto Turístico',
          spotRow.category_label || spotRow.category || 'Atração',
          XP_PER_DISCOVERY,
          lat,
          lng,
          spotLat,
          spotLng,
          Math.round(distanceMeters * 10) / 10
        );

        updateProgress.run(
          userId,
          XP_PER_DISCOVERY,
          1,
          XP_PER_DISCOVERY
        );

        const currentProg = getUpdatedProgress.get(userId) as any;
        const totalXp = currentProg?.total_xp || XP_PER_DISCOVERY;
        const newLevel = computeLevelFromXp(totalXp).level;

        db.prepare('UPDATE user_xp_progress SET current_level = ? WHERE user_id = ?').run(newLevel, userId);

        return {
          totalXp,
          placesDiscoveredCount: currentProg?.places_discovered_count || 1,
          levelInfo: computeLevelFromXp(totalXp),
        };
      });

      const result = transaction();

      res.json({
        success: true,
        xpAwarded: XP_PER_DISCOVERY,
        spotId: spotRow.id,
        spotName: spotRow.name,
        distanceMeters: Math.round(distanceMeters * 10) / 10,
        totalXp: result.totalXp,
        currentLevel: result.levelInfo.level,
        levelTitle: result.levelInfo.title,
        nextLevelXp: result.levelInfo.nextLevelXp,
        placesDiscoveredCount: result.placesDiscoveredCount,
        message: `Lugar descoberto! +${XP_PER_DISCOVERY} XP`,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.json({
          success: false,
          alreadyDiscovered: true,
          message: 'Você já descobriu este local anteriormente!',
        });
      }
      console.error('[XPRoutes] Error validating visit:', err);
      res.status(500).json({ error: 'Erro ao validar visita: ' + err.message });
    }
  });

  /**
   * GET /api/xp/leaderboard (Ready for future rankings)
   */
  app.get('/api/xp/leaderboard', (_req: Request, res: Response) => {
    try {
      const topExplorers = db.prepare(`
        SELECT 
          p.user_id,
          p.total_xp,
          p.current_level,
          p.places_discovered_count,
          u.name as user_name,
          u.username as user_username,
          u.avatar_url as user_avatar
        FROM user_xp_progress p
        LEFT JOIN users u ON (CAST(u.id AS TEXT) = p.user_id OR u.email = p.user_id)
        ORDER BY p.total_xp DESC
        LIMIT 50
      `).all() as any[];

      res.json({
        success: true,
        leaderboard: topExplorers.map((row, idx) => ({
          rank: idx + 1,
          userId: row.user_id,
          name: row.user_name || 'Explorador Monvian',
          username: row.user_username || 'explorador',
          avatarUrl: row.user_avatar || null,
          totalXp: row.total_xp,
          level: row.current_level,
          levelTitle: computeLevelFromXp(row.total_xp).title,
          placesDiscoveredCount: row.places_discovered_count,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao carregar ranking: ' + err.message });
    }
  });
}
