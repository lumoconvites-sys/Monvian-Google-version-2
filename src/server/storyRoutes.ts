import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { Express, Request, Response } from 'express';
import { persistStoryToSupabase } from '../services/supabaseSync.ts';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { firestore } from '../services/firestoreSync.ts';
import { doc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';

export interface StoryEntity {
  id: string;
  user_id: string;
  user_name: string;
  user_photo: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  location?: string;
  views_count: number;
  created_at: string;
  expires_at: string;
  status: string;
  viewed_by_me?: boolean;
}

export interface StoryTrayItem {
  user_id: string;
  user_name: string;
  user_photo: string;
  stories_count: number;
  has_unviewed: boolean;
  latest_created_at: string;
  is_current_user?: boolean;
  story_ids: string[];
}

/**
 * Initial curated active stories for Campos do Jordão visitors
 * Set to expire 21-23 hours from creation
 */
const INITIAL_CAMPOS_STORIES: Array<{
  id: string;
  user_id: string;
  user_name: string;
  user_photo: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  location: string;
  time_offset_hours: number;
}> = [
  {
    id: 'story-sophia-01',
    user_id: 'u-sophia',
    user_name: 'sophiagsl._',
    user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    media_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&q=85',
    media_type: 'image',
    caption: 'Manhã linda em Campos do Jordão! 🌲☀️',
    location: 'Vila Capivari',
    time_offset_hours: 2
  },
  {
    id: 'story-sophia-02',
    user_id: 'u-sophia',
    user_name: 'sophiagsl._',
    user_photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    media_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1080&q=85',
    media_type: 'image',
    caption: 'Almoço perfeito no Capivari com fondue',
    location: 'Restaurante Ludwig',
    time_offset_hours: 1
  },
  {
    id: 'story-raiane-01',
    user_id: 'u-raiane',
    user_name: 'raianealecrim_',
    user_photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    media_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1080&q=85',
    media_type: 'image',
    caption: 'Café quente e ar puro da serra ☕❄️',
    location: 'Sans Souci Café',
    time_offset_hours: 4
  },
  {
    id: 'story-silva-01',
    user_id: 'u-silva',
    user_name: '_silvvax',
    user_photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
    media_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1080&q=85',
    media_type: 'image',
    caption: 'Visual surreal do mirante hoje cedo ⛰️',
    location: 'Pico do Itapeva',
    time_offset_hours: 5
  },
  {
    id: 'story-mariana-01',
    user_id: 'u-mariana',
    user_name: 'mariana_silva',
    user_photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    media_url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1080&q=85',
    media_type: 'image',
    caption: 'Luzes mágicas do Capivari à noite ✨',
    location: 'Vila Capivari',
    time_offset_hours: 6
  },
  {
    id: 'story-gabriel-01',
    user_id: 'u-gabriel',
    user_name: 'gabriel_serra',
    user_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    media_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=85',
    media_type: 'image',
    caption: 'Passeio imperdível no teleférico!',
    location: 'Parque Capivari',
    time_offset_hours: 8
  }
];

/**
 * Set up Stories database tables and indexes
 */
export function setupStoriesDatabase(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_photo TEXT NOT NULL,
      media_url TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'image',
      caption TEXT,
      location TEXT,
      views_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      status TEXT DEFAULT 'active'
    );

    CREATE INDEX IF NOT EXISTS idx_stories_user_active ON stories(user_id, status, expires_at);
    CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
    CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at);

    CREATE TABLE IF NOT EXISTS story_views (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(story_id, viewer_id)
    );

    CREATE INDEX IF NOT EXISTS idx_story_views_lookup ON story_views(story_id, viewer_id);
    CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);
  `);

  // Check if stories table needs initial seeding
  const countRow = db.prepare(`
    SELECT count(*) as count 
    FROM stories 
    WHERE status = 'active' AND expires_at > datetime('now')
  `).get() as { count: number };

  if (!countRow || countRow.count === 0) {
    const insertStory = db.prepare(`
      INSERT OR REPLACE INTO stories (
        id, user_id, user_name, user_photo, media_url, media_type,
        caption, location, views_count, created_at, expires_at, status
      )
      VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        datetime('now', ?),
        datetime('now', ?),
        'active'
      )
    `);

    const seedTx = db.transaction(() => {
      INITIAL_CAMPOS_STORIES.forEach((s) => {
        const createdOffset = `-${s.time_offset_hours} hours`;
        const expiresOffset = `+${24 - s.time_offset_hours} hours`;
        insertStory.run(
          s.id,
          s.user_id,
          s.user_name,
          s.user_photo,
          s.media_url,
          s.media_type,
          s.caption,
          s.location,
          Math.floor(Math.random() * 25) + 3,
          createdOffset,
          expiresOffset
        );
      });
    });

    seedTx();
    console.log(`[Stories] Seeded ${INITIAL_CAMPOS_STORIES.length} active 24h stories for Campos do Jordão.`);

    // Sync seed to Firestore in background
    INITIAL_CAMPOS_STORIES.forEach(async (s) => {
      try {
        const now = Date.now();
        const createdMs = now - (s.time_offset_hours * 3600 * 1000);
        const expiresMs = createdMs + (24 * 3600 * 1000);

        await setDoc(doc(firestore, 'stories', s.id), {
          id: s.id,
          userId: s.user_id,
          userName: s.user_name,
          userPhoto: s.user_photo,
          mediaUrl: s.media_url,
          mediaType: s.media_type,
          caption: s.caption,
          location: s.location,
          viewsCount: 12,
          createdAt: new Date(createdMs).toISOString(),
          expiresAt: new Date(expiresMs).toISOString(),
          status: 'active'
        }, { merge: true });
      } catch (err) {}
    });
  }
}

/**
 * Register Stories API routes
 */
export function registerStoryRoutes(app: Express, db: SqliteDatabase) {
  // Helper to extract user identity from Bearer token or request params
  const getUserFromReq = (req: Request): { id: string; name: string; photo: string } => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const session = db.prepare(`
          SELECT s.user_id, u.name, u.email, u.avatar_url 
          FROM sessions s 
          JOIN users u ON s.user_id = u.id 
          WHERE s.token = ?
        `).get(token) as any;

        if (session) {
          return {
            id: String(session.user_id),
            name: session.name || session.email?.split('@')[0] || 'Visitante',
            photo: session.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
          };
        }
      }
    } catch {}

    const clientId = (req.query.clientId as string) || req.body?.clientId;
    const clientName = req.body?.userName;
    const clientPhoto = req.body?.userPhoto;

    return {
      id: clientId || 'u-me',
      name: clientName || 'Você',
      photo: clientPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
    };
  };

  /**
   * GET /api/stories/tray
   * Lightweight endpoint: Returns only active user tray metadata (NO high-res media pre-downloaded)
   * Enforces strictly: expires_at > datetime('now') AND status = 'active'
   */
  app.get('/api/stories/tray', (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

      // 1. Get all active, unexpired stories grouped by user
      const rawStories = db.prepare(`
        SELECT 
          s.id,
          s.user_id,
          s.user_name,
          s.user_photo,
          s.media_type,
          s.created_at,
          s.expires_at,
          CASE WHEN v.story_id IS NOT NULL THEN 1 ELSE 0 END as viewed_by_me
        FROM stories s
        LEFT JOIN story_views v ON s.id = v.story_id AND v.viewer_id = ?
        WHERE s.status = 'active' 
          AND s.expires_at > datetime('now')
        ORDER BY s.created_at ASC
      `).all(user.id) as Array<{
        id: string;
        user_id: string;
        user_name: string;
        user_photo: string;
        media_type: string;
        created_at: string;
        expires_at: string;
        viewed_by_me: number;
      }>;

      // 2. Group stories by user_id
      const userMap = new Map<string, {
        user_id: string;
        user_name: string;
        user_photo: string;
        stories_count: number;
        has_unviewed: boolean;
        latest_created_at: string;
        is_current_user: boolean;
        story_ids: string[];
      }>();

      for (const s of rawStories) {
        const isMe = s.user_id === user.id;
        const isUnviewed = !s.viewed_by_me && !isMe;

        if (!userMap.has(s.user_id)) {
          userMap.set(s.user_id, {
            user_id: s.user_id,
            user_name: s.user_name,
            user_photo: s.user_photo,
            stories_count: 1,
            has_unviewed: isUnviewed,
            latest_created_at: s.created_at,
            is_current_user: isMe,
            story_ids: [s.id]
          });
        } else {
          const entry = userMap.get(s.user_id)!;
          entry.stories_count += 1;
          entry.story_ids.push(s.id);
          if (isUnviewed) entry.has_unviewed = true;
          if (new Date(s.created_at) > new Date(entry.latest_created_at)) {
            entry.latest_created_at = s.created_at;
          }
        }
      }

      // Check if current user has active stories
      const myStoryEntry = userMap.get(user.id) || null;

      // Filter out current user from other users list and sort:
      // Unviewed stories first, then most recently posted
      const otherUsers = Array.from(userMap.values())
        .filter((u) => u.user_id !== user.id)
        .sort((a, b) => {
          if (a.has_unviewed && !b.has_unviewed) return -1;
          if (!a.has_unviewed && b.has_unviewed) return 1;
          return new Date(b.latest_created_at).getTime() - new Date(a.latest_created_at).getTime();
        })
        .slice(0, limit);

      res.json({
        success: true,
        my_story: myStoryEntry,
        tray: otherUsers,
        total_active_users: userMap.size
      });
    } catch (err: any) {
      console.error('[Stories] Error fetching tray:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar lista de stories' });
    }
  });

  /**
   * GET /api/stories/user/:userId
   * On-demand loader: Fetches the active stories for a single user when opened
   * Strictly filters out stories where expires_at <= datetime('now')
   */
  app.get('/api/stories/user/:userId', (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = getUserFromReq(req);

      const rows = db.prepare(`
        SELECT 
          s.id,
          s.user_id,
          s.user_name,
          s.user_photo,
          s.media_url,
          s.media_type,
          s.caption,
          s.location,
          s.views_count,
          s.created_at,
          s.expires_at,
          s.status,
          CASE WHEN v.story_id IS NOT NULL THEN 1 ELSE 0 END as viewed_by_me
        FROM stories s
        LEFT JOIN story_views v ON s.id = v.story_id AND v.viewer_id = ?
        WHERE s.user_id = ? 
          AND s.status = 'active'
          AND s.expires_at > datetime('now')
        ORDER BY s.created_at ASC
      `).all(user.id, userId) as any[];

      const stories: StoryEntity[] = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        user_name: r.user_name,
        user_photo: r.user_photo,
        media_url: r.media_url,
        media_type: r.media_type as 'image' | 'video',
        caption: r.caption || '',
        location: r.location || '',
        views_count: Number(r.views_count || 0),
        created_at: r.created_at,
        expires_at: r.expires_at,
        status: r.status,
        viewed_by_me: Boolean(r.viewed_by_me)
      }));

      res.json({
        success: true,
        stories,
        user: stories[0] ? {
          id: stories[0].user_id,
          name: stories[0].user_name,
          photo: stories[0].user_photo
        } : null
      });
    } catch (err: any) {
      console.error('[Stories] Error fetching user stories:', err);
      res.status(500).json({ success: false, error: 'Erro ao carregar stories do usuário' });
    }
  });

  /**
   * POST /api/stories/upload
   * Handles cloud/server media upload for photos and videos (base64 data URL)
   */
  app.post('/api/stories/upload', (req: Request, res: Response) => {
    try {
      const { dataUrl } = req.body;
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({ success: false, error: 'Arquivo de mídia não fornecido' });
        return;
      }

      // Detect media type: image or video
      let mediaType: 'image' | 'video' = 'image';
      let extension = 'jpg';

      const match = dataUrl.match(/^data:(image|video)\/([a-zA-Z0-9.-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ success: false, error: 'Formato de mídia inválido' });
        return;
      }

      const mimeCategory = match[1];
      const mimeSubtype = match[2];
      const base64Data = match[3];

      if (mimeCategory === 'video') {
        mediaType = 'video';
        extension = mimeSubtype === 'quicktime' ? 'mov' : (mimeSubtype === 'webm' ? 'webm' : 'mp4');
      } else {
        mediaType = 'image';
        extension = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `story-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
      const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'stories');

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/stories/${filename}`;
      res.json({
        success: true,
        mediaUrl: publicUrl,
        mediaType
      });
    } catch (err: any) {
      console.error('[Stories] Error uploading media:', err);
      res.status(500).json({ success: false, error: 'Erro ao processar mídia do story' });
    }
  });

  /**
   * POST /api/stories
   * Creates a new Story record with strictly 24-hour expiration:
   * createdAt = now
   * expiresAt = createdAt + 24 hours
   */
  app.post('/api/stories', async (req: Request, res: Response) => {
    try {
      const user = getUserFromReq(req);
      const { mediaUrl, mediaType = 'image', caption = '', location = '' } = req.body;

      if (!mediaUrl || typeof mediaUrl !== 'string') {
        res.status(400).json({ success: false, error: 'URL da mídia é obrigatória' });
        return;
      }

      const storyId = 'story-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const createdAtIso = now.toISOString();
      const expiresAtIso = expires.toISOString();

      // Insert into local SQLite database
      db.prepare(`
        INSERT INTO stories (
          id, user_id, user_name, user_photo, media_url, media_type,
          caption, location, views_count, created_at, expires_at, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'active')
      `).run(
        storyId,
        user.id,
        user.name,
        user.photo,
        mediaUrl,
        mediaType,
        caption.trim(),
        location.trim(),
        createdAtIso,
        expiresAtIso
      );

      const createdStory = db.prepare('SELECT * FROM stories WHERE id = ?').get(storyId) as any;

      // Sync to Firestore in background
      try {
        await setDoc(doc(firestore, 'stories', storyId), {
          id: storyId,
          userId: user.id,
          userName: user.name,
          userPhoto: user.photo,
          mediaUrl,
          mediaType,
          caption: caption.trim(),
          location: location.trim(),
          viewsCount: 0,
          createdAt: createdAtIso,
          expiresAt: expiresAtIso,
          status: 'active'
        });
      } catch (fErr) {
        console.warn('[Stories] Firestore sync notice:', fErr);
      }

      res.json({
        success: true,
        story: {
          ...createdStory,
          media_type: createdStory.media_type as 'image' | 'video'
        }
      });
    } catch (err: any) {
      console.error('[Stories] Error creating story:', err);
      res.status(500).json({ success: false, error: 'Erro ao criar story' });
    }
  });

  /**
   * POST /api/stories/:id/view
   * Registers a single unique view for the story
   */
  app.post('/api/stories/:id/view', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = getUserFromReq(req);

      // Check if story exists and is active
      const story = db.prepare(`
        SELECT id, user_id, views_count 
        FROM stories 
        WHERE id = ? AND status = 'active' AND expires_at > datetime('now')
      `).get(id) as any;

      if (!story) {
        res.status(404).json({ success: false, error: 'Story não encontrado ou expirado' });
        return;
      }

      // Check if view already recorded
      const alreadyViewed = db.prepare(`
        SELECT id FROM story_views WHERE story_id = ? AND viewer_id = ?
      `).get(id, user.id);

      let updatedViews = story.views_count;

      if (!alreadyViewed) {
        const viewId = 'view-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
        
        db.prepare(`
          INSERT OR IGNORE INTO story_views (id, story_id, viewer_id, viewed_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(viewId, id, user.id);

        db.prepare(`
          UPDATE stories SET views_count = views_count + 1 WHERE id = ?
        `).run(id);

        updatedViews += 1;

        // Sync view to Firestore
        try {
          await updateDoc(doc(firestore, 'stories', id), {
            viewsCount: increment(1)
          });
        } catch {}
      }

      res.json({
        success: true,
        views_count: updatedViews
      });
    } catch (err: any) {
      console.error('[Stories] Error recording view:', err);
      res.status(500).json({ success: false, error: 'Erro ao registrar visualização' });
    }
  });

  /**
   * DELETE /api/stories/:id
   * Deletes a story before the 24h expiration
   */
  app.delete('/api/stories/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = getUserFromReq(req);

      const story = db.prepare('SELECT id, user_id FROM stories WHERE id = ?').get(id) as any;
      if (!story) {
        res.status(404).json({ success: false, error: 'Story não encontrado' });
        return;
      }

      // Only owner can delete (or fallback if matched)
      if (story.user_id !== user.id && user.id !== 'admin') {
        res.status(403).json({ success: false, error: 'Você só pode excluir seus próprios stories' });
        return;
      }

      db.prepare(`UPDATE stories SET status = 'deleted' WHERE id = ?`).run(id);
      db.prepare(`DELETE FROM story_views WHERE story_id = ?`).run(id);

      // Delete from Firestore
      try {
        await deleteDoc(doc(firestore, 'stories', id));
      } catch {}

      res.json({ success: true, message: 'Story excluído com sucesso' });
    } catch (err: any) {
      console.error('[Stories] Error deleting story:', err);
      res.status(500).json({ success: false, error: 'Erro ao excluir story' });
    }
  });
}
