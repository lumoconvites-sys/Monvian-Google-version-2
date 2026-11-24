import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { CAMPOS_SPOTS } from '../data/spots.ts';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries.ts';
import type { AssistantSpotCandidate } from '../utils/assistantHelpers.ts';
import {
  PRIMARY_GEMINI_MODEL,
  classifyGeminiError,
  runGeminiAssistantTurn,
  type AssistantActionPayload,
  type AssistantHistoryTurn,
  type ClassifiedAssistantError,
  type GeminiAssistantKnowledge,
} from './geminiAssistantEngine.ts';

export type { AssistantActionPayload };

export function setupAssistantDatabase(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id TEXT PRIMARY KEY,
      user_key TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_key
      ON assistant_conversations(user_key, updated_at DESC);

    CREATE TABLE IF NOT EXISTS assistant_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_key TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_assistant_messages_conv
      ON assistant_messages(conversation_id, created_at ASC);
  `);
}

function getAllActiveSpotsFromDb(db: any): AssistantSpotCandidate[] {
  try {
    const rows = db
      .prepare(`SELECT * FROM spots WHERE COALESCE(is_active, 1) != 0`)
      .all() as any[];

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name || ''),
        category: String(r.category || 'culture'),
        categoryLabel: String(r.category_label || r.categoryLabel || r.category || ''),
        address: String(r.address || 'Campos do Jordão, SP'),
        priceRange: String(r.price_range || r.priceRange || '$$'),
        price: String(r.price || ''),
        rating: Number(r.rating) || 4.8,
        hours: String(r.hours || ''),
        description: String(r.description || ''),
        touristTip: String(r.tourist_tip || r.touristTip || ''),
        lat: Number(r.lat) || -22.7192,
        lng: Number(r.lng) || -45.5669,
        image: String(r.image || ''),
        highlighted: Boolean(r.highlighted || r.is_star),
      }));
    }
  } catch (err) {
    console.warn('[Monvian Assistant] Fallback to CAMPOS_SPOTS:', err);
  }

  return CAMPOS_SPOTS.map((s) => ({
    id: String(s.id),
    name: s.name,
    category: s.category,
    categoryLabel: s.categoryLabel,
    address: s.address,
    priceRange: s.priceRange || '$$',
    price: s.price,
    rating: s.rating,
    hours: s.hours,
    description: s.description,
    touristTip: s.touristTip,
    lat: s.lat,
    lng: s.lng,
    image: s.image,
    highlighted: Boolean(s.highlighted),
  }));
}

function getCuratedItinerariesFromDb(db: any) {
  try {
    const rows = db
      .prepare(`SELECT * FROM itineraries ORDER BY featured DESC, rating DESC LIMIT 10`)
      .all() as any[];
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id),
        title: String(r.title || ''),
        subtitle: String(r.subtitle || ''),
        category: String(r.category || ''),
        duration: String(r.duration || ''),
        stopsCount: Number(r.stopsCount) || 3,
        description: String(r.description || ''),
      }));
    }
  } catch {}

  return DEFAULT_CURATED_ITINERARIES.slice(0, 8).map((it: any) => ({
    id: String(it.id),
    title: String(it.title || ''),
    subtitle: String(it.subtitle || it.description || ''),
    category: String(it.category || it.tag || 'Experiência'),
    duration: String(it.duration || `${it.days?.length || 1} dia(s)`),
    stopsCount: Number(it.stopsCount || it.days?.[0]?.steps?.length || 3),
    description: String(it.description || ''),
  }));
}

function getActiveEventsFromDb(db: any) {
  try {
    const rows = db.prepare(`SELECT * FROM events ORDER BY featured DESC LIMIT 6`).all() as any[];
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((e) => ({
        id: String(e.id),
        title: String(e.title || ''),
        date: String(e.date || ''),
        location: String(e.location || ''),
        category: String(e.category || ''),
        price: String(e.price || ''),
        description: String(e.description || ''),
      }));
    }
  } catch {}
  return [];
}

function loadKnowledgeFromDb(db: any): GeminiAssistantKnowledge {
  return {
    spots: getAllActiveSpotsFromDb(db),
    itineraries: getCuratedItinerariesFromDb(db),
    events: getActiveEventsFromDb(db),
  };
}

function getUserScopeKey(req: Request, bodyUserKey?: string): string {
  const headerUser = String(req.headers['x-monvian-user-id'] || '').trim();
  const raw = (bodyUserKey || headerUser || 'guest_anonymous').trim();
  return raw.slice(0, 128) || 'guest_anonymous';
}

export function registerAssistantRoutes(app: Express, db: any) {
  // GET /api/assistant/health - Safe diagnostic check (never leaks keys)
  app.get('/api/assistant/health', (_req: Request, res: Response) => {
    const hasKey = Boolean(String(process.env.GEMINI_API_KEY || '').trim());
    return res.json({
      ok: hasKey,
      provider: 'google-gemini',
      model: PRIMARY_GEMINI_MODEL,
      configured: hasKey,
    });
  });

  // GET /api/assistant/history - Load isolated conversation for the current user
  app.get('/api/assistant/history', (req: Request, res: Response) => {
    try {
      const userKey = getUserScopeKey(req, String(req.query.userKey || ''));
      const conv = db
        .prepare(
          `SELECT * FROM assistant_conversations WHERE user_key = ? ORDER BY datetime(updated_at) DESC LIMIT 1`
        )
        .get(userKey) as any;

      if (!conv) {
        return res.json({
          conversationId: null,
          messages: [],
        });
      }

      const rows = db
        .prepare(
          `SELECT id, role, content, metadata_json, created_at FROM assistant_messages WHERE conversation_id = ? AND user_key = ? ORDER BY datetime(created_at) ASC, rowid ASC LIMIT 60`
        )
        .all(conv.id, userKey) as any[];

      const messages = rows.map((r) => {
        let metadata: any = undefined;
        if (r.metadata_json) {
          try {
            metadata = JSON.parse(r.metadata_json);
          } catch {}
        }
        return {
          id: String(r.id),
          role: r.role === 'user' ? 'user' : 'assistant',
          content: String(r.content || ''),
          metadata,
          createdAt: r.created_at,
        };
      });

      return res.json({
        conversationId: conv.id,
        title: conv.title,
        messages,
      });
    } catch (error) {
      console.error('[Monvian Assistant] Error fetching history:', error);
      return res.status(500).json({ error: 'Falha ao carregar histórico da conversa.' });
    }
  });

  // POST /api/assistant/reset - Start a new isolated conversation for the current user
  app.post('/api/assistant/reset', (req: Request, res: Response) => {
    try {
      const userKey = getUserScopeKey(req, req.body?.userKey);
      const newConvId = `conv_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO assistant_conversations (id, user_key, title, summary) VALUES (?, ?, ?, ?)`
      ).run(newConvId, userKey, 'Nova conversa em Campos do Jordão', '');

      return res.json({
        conversationId: newConvId,
        messages: [],
      });
    } catch (error) {
      console.error('[Monvian Assistant] Error resetting conversation:', error);
      return res.status(500).json({ error: 'Falha ao iniciar nova conversa.' });
    }
  });

  // POST /api/assistant/chat - Real Google Gemini SSE Streaming + Function Calling
  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const userMessage = String(req.body?.message || '').trim();
    if (!userMessage) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'Digite uma mensagem antes de enviar.',
        retryable: false,
      });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    let isClosed = false;
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        isClosed = true;
        abortController.abort();
      }
    });

    const sendEvent = (event: string, data: any) => {
      if (isClosed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    // Keep-alive SSE comment every 4 seconds so proxies & iOS Safari never drop the stream while Gemini thinks
    const heartbeat = setInterval(() => {
      if (!isClosed && !res.writableEnded) {
        res.write(`: keep-alive\n\n`);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }
    }, 4000);

    try {
      const userKey = getUserScopeKey(req, req.body?.userKey);
      const userName = String(req.body?.userName || '').trim() || undefined;
      const pendingStyleFromClient = String(req.body?.pendingItineraryStyle || '').trim();
      const userLocation =
        req.body?.userLocation &&
        Number.isFinite(Number(req.body.userLocation.lat)) &&
        Number.isFinite(Number(req.body.userLocation.lng))
          ? { lat: Number(req.body.userLocation.lat), lng: Number(req.body.userLocation.lng) }
          : null;

      // Ensure an isolated conversation exists for this userKey
      let conversationId = String(req.body?.conversationId || '').trim();
      if (conversationId) {
        const existing = db
          .prepare(`SELECT id FROM assistant_conversations WHERE id = ? AND user_key = ?`)
          .get(conversationId, userKey) as any;
        if (!existing) {
          conversationId = '';
        }
      }
      if (!conversationId) {
        const latest = db
          .prepare(
            `SELECT id FROM assistant_conversations WHERE user_key = ? ORDER BY datetime(updated_at) DESC LIMIT 1`
          )
          .get(userKey) as any;
        if (latest?.id) {
          conversationId = String(latest.id);
        } else {
          conversationId = `conv_${crypto.randomUUID()}`;
          db.prepare(
            `INSERT INTO assistant_conversations (id, user_key, title) VALUES (?, ?, ?)`
          ).run(conversationId, userKey, userMessage.slice(0, 60));
        }
      }

      // Load previous turns BEFORE inserting current user message so history is clean
      const recentRows = db
        .prepare(
          `SELECT role, content FROM assistant_messages WHERE conversation_id = ? AND user_key = ? ORDER BY datetime(created_at) DESC, rowid DESC LIMIT 12`
        )
        .all(conversationId, userKey) as any[];

      const history: AssistantHistoryTurn[] = recentRows.reverse().map((r) => ({
        role: r.role === 'user' ? 'user' : 'assistant',
        content: String(r.content || ''),
      }));

      // Pre-generate user message ID; persist both user & assistant messages only once Gemini succeeds
      const userMsgId = `msg_${crypto.randomUUID()}`;
      sendEvent('meta', { conversationId, userMessageId: userMsgId });

      const knowledge = loadKnowledgeFromDb(db);

      const result = await runGeminiAssistantTurn({
        apiKey: String(process.env.GEMINI_API_KEY || ''),
        userMessage,
        history,
        knowledge,
        userName,
        pendingItineraryStyle: pendingStyleFromClient || undefined,
        userLocation,
        signal: abortController.signal,
        onTextDelta: (delta) => {
          sendEvent('delta', { text: delta });
        },
      });

      if (result.action) {
        sendEvent('action', result.action);
      }

      // Persist user + assistant messages atomically in SQLite after Gemini responds
      const assistantMsgId = `msg_${crypto.randomUUID()}`;
      const metadataJson = result.action ? JSON.stringify({ action: result.action }) : null;
      db.prepare(
        `INSERT INTO assistant_messages (id, conversation_id, user_key, role, content) VALUES (?, ?, ?, 'user', ?)`
      ).run(userMsgId, conversationId, userKey, userMessage);
      db.prepare(
        `INSERT INTO assistant_messages (id, conversation_id, user_key, role, content, metadata_json) VALUES (?, ?, ?, 'assistant', ?, ?)`
      ).run(assistantMsgId, conversationId, userKey, result.text, metadataJson);
      db.prepare(
        `UPDATE assistant_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_key = ?`
      ).run(conversationId, userKey);

      sendEvent('done', {
        messageId: assistantMsgId,
        conversationId,
        content: result.text,
        action: result.action,
        model: result.modelUsed,
      });
    } catch (err: any) {
      if (isClosed) return;
      const classified: ClassifiedAssistantError =
        err && typeof err === 'object' && 'code' in err && 'userMessage' in err
          ? (err as ClassifiedAssistantError)
          : classifyGeminiError(err);

      console.error(
        `[Monvian Assistant Route Error] [${classified.code}]`,
        classified.technicalDetail
      );

      sendEvent('error', {
        code: classified.code,
        message: classified.userMessage,
        retryable: classified.retryable,
      });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        res.end();
      }
    }
  });
}
