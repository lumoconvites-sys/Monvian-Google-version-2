import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { CAMPOS_SPOTS } from '../data/spots.ts';
import { DEFAULT_CURATED_ITINERARIES } from '../data/defaultItineraries.ts';
import {
  orderSpotsByProximity,
  selectSmartItinerarySpots,
  type AssistantBudgetTier,
  type AssistantSpotCandidate,
} from '../utils/assistantHelpers.ts';

export interface AssistantActionPayload {
  type:
    | 'ASK_BUDGET_PREFERENCE'
    | 'FOCUS_SPOT_ON_MAP'
    | 'START_ITINERARY_SELECTION'
    | 'RECOMMENDED_SPOTS';
  style?: string;
  budgetTier?: AssistantBudgetTier;
  title?: string;
  description?: string;
  spotId?: string;
  spotIds?: string[];
  spots?: AssistantSpotCandidate[];
}

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

function getCuratedItinerariesFromDb(db: any): any[] {
  try {
    const rows = db.prepare(`SELECT * FROM itineraries ORDER BY featured DESC, rating DESC LIMIT 12`).all() as any[];
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

  return DEFAULT_CURATED_ITINERARIES.slice(0, 10).map((it: any) => ({
    id: it.id,
    title: it.title,
    subtitle: it.subtitle || it.description || '',
    category: it.category || it.tag || 'Experiência',
    duration: it.duration || `${it.days?.length || 1} dia(s)`,
    stopsCount: it.stopsCount || it.days?.[0]?.steps?.length || 3,
    description: it.description,
  }));
}

function getActiveEventsFromDb(db: any): any[] {
  try {
    const rows = db.prepare(`SELECT * FROM events ORDER BY featured DESC LIMIT 8`).all() as any[];
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

function buildMonvianRagKnowledgePrompt(db: any): {
  spots: AssistantSpotCandidate[];
  knowledgeSummary: string;
} {
  const spots = getAllActiveSpotsFromDb(db);
  const itineraries = getCuratedItinerariesFromDb(db);
  const events = getActiveEventsFromDb(db);

  const spotsCatalog = spots
    .map(
      (s) =>
        `• [ID: ${s.id}] ${s.name} | Cat: ${s.categoryLabel || s.category} | Faixa: ${s.priceRange || '$$'} (${s.price || 'Consultar'}) | Nota: ${s.rating || 4.8}★ | Endereço: ${s.address || 'Campos do Jordão'} | Horário: ${s.hours || 'Diariamente'} | Coord: (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})${s.highlighted ? ' | [DESTAQUE PREMIUM MONVIAN]' : ''} | Resumo: ${(s.description || '').slice(0, 150)}${s.touristTip ? ` | Dica: ${s.touristTip.slice(0, 100)}` : ''}`
    )
    .join('\n');

  const itinerariesCatalog = itineraries
    .map(
      (it) =>
        `• [Roteiro ${it.id}] ${it.title} (${it.category || 'Experiência'} - ${it.duration || 'Meio dia'}): ${it.subtitle || it.description || ''}`
    )
    .join('\n');

  const eventsCatalog =
    events.length > 0
      ? events
          .map((e) => `• ${e.title} (${e.date || 'Em breve'} em ${e.location || 'Campos do Jordão'}): ${e.description || ''}`)
          .join('\n')
      : '• Programação cultural sazonal de Campos do Jordão disponível na aba Explorar.';

  const knowledgeSummary = `
=== BASE DE CONHECIMENTO REAL DO MONVIAN (CAMPOS DO JORDÃO) ===
Você possui acesso em tempo real aos locais reais cadastrados no banco de dados oficial do Monvian.
NUNCA invente locais, preços, endereços, coordenadas ou IDs que não existam nesta lista. Sempre utilize os IDs reais ([ID: ...]) quando acionar ferramentas do mapa ou roteiros.

LOCAIS E PONTOS TURÍSTICOS REAIS (${spots.length} locais ativos):
${spotsCatalog}

ROTEIROS OFICIAIS CADASTRADOS:
${itinerariesCatalog}

EVENTOS EM CAMPOS DO JORDÃO:
${eventsCatalog}
`.trim();

  return { spots, knowledgeSummary };
}

const ASSISTANT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'askItineraryBudgetPreference',
    description:
      'Acione esta função SEMPRE que o usuário pedir para criar, montar ou planejar um roteiro (ex: "Quero criar um roteiro romântico", "Monte um roteiro para família", "Crie um roteiro gastronômico") e AINDA NÃO tiver informado se prefere uma experiência Econômica ou Premium.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        style: {
          type: Type.STRING,
          description:
            'Estilo ou tema do roteiro desejado pelo usuário (ex: "romântico", "família", "gastronômico", "natureza e mirantes", "aventura", "fim de semana").',
        },
      },
      required: ['style'],
    },
  },
  {
    name: 'prepareSmartItineraryOnMap',
    description:
      'Acione esta função quando o usuário já escolheu entre Econômico ou Premium (ou já especificou claramente o orçamento e estilo do roteiro) para selecionar os melhores pontos reais do Monvian, ordená-los por proximidade geográfica e abrir a seleção interativa de roteiro diretamente no mapa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Título elegante para o roteiro personalizado (ex: "Roteiro Romântico Premium", "Manhã Econômica na Serra").',
        },
        description: {
          type: Type.STRING,
          description: 'Breve descrição envolvente de 1 frase explicando a lógica do roteiro.',
        },
        style: {
          type: Type.STRING,
          description: 'Tema ou estilo do roteiro (ex: "romantico", "familia", "gastronomia", "natureza").',
        },
        budgetTier: {
          type: Type.STRING,
          description: 'Nível de orçamento escolhido pelo usuário: "economico" ou "premium".',
        },
        spotIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Lista de 3 a 5 IDs reais de pontos da base do Monvian ([ID: ...]) escolhidos para compor o roteiro.',
        },
      },
      required: ['title', 'style', 'budgetTier', 'spotIds'],
    },
  },
  {
    name: 'focusSpotOnMap',
    description:
      'Foca e destaca um ponto turístico, restaurante, café, hotel ou parque específico diretamente no mapa do Monvian quando o usuário pedir para ver onde fica ou quiser explorar um local específico.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        spotId: {
          type: Type.STRING,
          description: 'ID real do ponto na base de dados do Monvian.',
        },
      },
      required: ['spotId'],
    },
  },
  {
    name: 'recommendSpotsCards',
    description:
      'Exibe cartões interativos de locais reais do Monvian dentro da conversa quando o usuário pedir recomendações, dicas de restaurantes, cafés, chocolaterias, mirantes ou passeios sem pedir para criar um roteiro completo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        spotIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Lista de 1 a 4 IDs reais de pontos recomendados do banco do Monvian.',
        },
      },
      required: ['spotIds'],
    },
  },
];

function buildSystemInstruction(knowledgeSummary: string, userName?: string): string {
  return `
Você é o **Assistente Monvian**, o guia turístico inteligente oficial do aplicativo Monvian em Campos do Jordão.

PERSONALIDADE E COMPORTAMENTO:
1. Seu nome é **Assistente Monvian**.
2. Suas respostas devem ser naturais, elegantes, educadas, diretas, objetivas e contextualizadas — no padrão de excelência Apple / ChatGPT, especializadas em Campos do Jordão.
3. NÃO responda com textos excessivamente longos. Seja claro, conciso e útil (idealmente 1 a 3 parágrafos curtos).
4. NÃO trate toda mensagem como criação de roteiro:
   - Se o usuário apenas cumprimentar ("Oi", "Tudo bem?"), responda com naturalidade e simpatia e pergunte o que ele gostaria de viver hoje em Campos do Jordão.
   - Se o usuário fizer uma dúvida turística ou pedir recomendações ("Onde comer um bom fondue?", "Qual o melhor mirante gratuito?"), responda citando exclusivamente locais reais da base do Monvian e acione \`recommendSpotsCards\` com os IDs reais desses locais para que o usuário possa tocá-los e vê-los no mapa.
   - Se o usuário pedir para localizar ou abrir um ponto específico no mapa ("Mostre o Parque Amantikir no mapa"), acione \`focusSpotOnMap\`.

REGRA OBRIGATÓRIA PARA CRIAÇÃO DE ROTEIROS (ETAPA 10):
- Quando o usuário pedir para criar ou montar um roteiro (ex: "Quero criar um roteiro romântico", "Monte um roteiro de 1 dia", "Crie um passeio em família"):
  1) Se ele AINDA NÃO especificou se prefere **Econômico** ou **Premium**, você DEVE obrigatoriamente acionar a ferramenta \`askItineraryBudgetPreference\` e responder com:
     "Perfeito! Você prefere uma experiência econômica ou premium?"
  2) Assim que o usuário escolher "Econômico" ou "Premium" (ou se ele já tiver informado isso na mensagem), você DEVE acionar a ferramenta \`prepareSmartItineraryOnMap\` escolhendo de 3 a 5 locais reais da base do Monvian que combinem com o estilo e a faixa de orçamento, e escrever uma resposta breve apresentando os locais selecionados na ordem geográfica lógica e informando que já destacou os pontos no mapa para ele revisar e confirmar a rota.

${userName ? `USUÁRIO ATUAL: ${userName}` : ''}

${knowledgeSummary}
`.trim();
}

function getUserScopeKey(req: Request, bodyUserKey?: string): string {
  const headerUser = String(req.headers['x-monvian-user-id'] || '').trim();
  const raw = (bodyUserKey || headerUser || 'guest_anonymous').trim();
  return raw.slice(0, 128) || 'guest_anonymous';
}

export function registerAssistantRoutes(app: Express, db: any) {
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

  // POST /api/assistant/chat - Progressive SSE Streaming + Gemini Function Calling
  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    try {
      const userMessage = String(req.body?.message || '').trim();
      if (!userMessage) {
        sendEvent('error', { message: 'Mensagem vazia.' });
        return res.end();
      }

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

      // Persist user message
      const userMsgId = `msg_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO assistant_messages (id, conversation_id, user_key, role, content) VALUES (?, ?, ?, 'user', ?)`
      ).run(userMsgId, conversationId, userKey, userMessage);
      db.prepare(
        `UPDATE assistant_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_key = ?`
      ).run(conversationId, userKey);

      sendEvent('meta', { conversationId, userMessageId: userMsgId });

      const { spots, knowledgeSummary } = buildMonvianRagKnowledgePrompt(db);
      const spotsById = new Map(spots.map((s) => [String(s.id), s]));

      const msgNorm = userMessage
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const hasBudgetTierInMsg =
        /\b(economic[oa]|barat[oa]|gratuit[oa]|acessivel)\b/.test(msgNorm)
          ? ('economico' as AssistantBudgetTier)
          : /\b(premium|luxo|sofisticad[oa]|exclusiv[oa]|alto padrao)\b/.test(msgNorm)
            ? ('premium' as AssistantBudgetTier)
            : null;

      const isAskingToCreateItinerary =
        /\b(roteiro|planej|montar|monte|criar|crie|itinerario|passeio de \d|dia em campos)\b/.test(
          msgNorm
        );

      const inferStyleFromText = (norm: string) =>
        norm.includes('romant') || norm.includes('casal')
          ? 'romântico'
          : norm.includes('famil') || norm.includes('crianc')
            ? 'família'
            : norm.includes('gastronom') || norm.includes('restaurante') || norm.includes('fondue')
              ? 'gastronômico'
              : norm.includes('nature') || norm.includes('aventur') || norm.includes('mirante')
                ? 'natureza e mirantes'
                : 'personalizado';

      let fullText = '';
      const detectedFunctionCalls: Array<{ name: string; args: Record<string, any> }> = [];

      // Fast-path Stage 10 Step 1: User asks to create an itinerary without specifying Econômico vs Premium
      if (isAskingToCreateItinerary && !hasBudgetTierInMsg) {
        const inferredStyle = inferStyleFromText(msgNorm);
        detectedFunctionCalls.push({
          name: 'askItineraryBudgetPreference',
          args: { style: inferredStyle },
        });
        const promptText = 'Perfeito! Você prefere uma experiência econômica ou premium?';
        fullText = promptText;
        sendEvent('delta', { text: promptText });
      } else if ((pendingStyleFromClient && hasBudgetTierInMsg) || (isAskingToCreateItinerary && hasBudgetTierInMsg)) {
        // Fast-path Stage 10 Step 2: User selected Econômico or Premium -> select real ordered spots & trigger map selection
        const activeStyle = pendingStyleFromClient || inferStyleFromText(msgNorm);
        detectedFunctionCalls.push({
          name: 'prepareSmartItineraryOnMap',
          args: {
            style: activeStyle,
            budgetTier: hasBudgetTierInMsg,
            spotIds: [],
          },
        });
      } else {
        // Load last 12 turns from database for conversation context
        const recentRows = db
          .prepare(
            `SELECT role, content, metadata_json FROM assistant_messages WHERE conversation_id = ? AND user_key = ? ORDER BY datetime(created_at) DESC, rowid DESC LIMIT 12`
          )
          .all(conversationId, userKey) as any[];
        const orderedHistory = recentRows.reverse();

        const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
        if (apiKey) {
          try {
            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
            });

            const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
            for (let i = 0; i < orderedHistory.length; i++) {
              const item = orderedHistory[i];
              const role = item.role === 'user' ? 'user' : 'model';
              const text = String(item.content || '').trim();
              if (!text) continue;

              if (contents.length > 0 && contents[contents.length - 1].role === role) {
                contents[contents.length - 1].parts[0].text += `\n${text}`;
              } else {
                contents.push({ role, parts: [{ text }] });
              }
            }

            if (contents.length === 0 || contents[0].role !== 'user') {
              contents.unshift({ role: 'user', parts: [{ text: userMessage }] });
            }

            const systemInstruction = buildSystemInstruction(knowledgeSummary, userName);

            const runGeminiStream = async () => {
              const streamResponse = await ai.models.generateContentStream({
                model: 'gemini-4-hydrogen',
                contents,
                config: {
                  systemInstruction,
                  tools: [{ functionDeclarations: ASSISTANT_FUNCTION_DECLARATIONS }],
                },
              });

              for await (const chunk of streamResponse) {
                if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                  for (const fc of chunk.functionCalls) {
                    if (fc.name) {
                      detectedFunctionCalls.push({
                        name: fc.name,
                        args: (fc.args as Record<string, any>) || {},
                      });
                    }
                  }
                }

                const chunkText = chunk.text || '';
                if (chunkText) {
                  fullText += chunkText;
                  sendEvent('delta', { text: chunkText });
                }
              }
            };

            await Promise.race([
              runGeminiStream(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Gemini stream timeout')), 6500)
              ),
            ]);
          } catch (geminiErr) {
            console.warn(
              '[Monvian Assistant] Gemini stream timeout or fallback engaged:',
              (geminiErr as any)?.message || geminiErr
            );
          }
        }
      }

      if (detectedFunctionCalls.length === 0) {
        // Check if the user mentioned or asked about specific spots or categories in the RAG database
        const mentionedSpot = spots.find((s) => {
          const sNorm = s.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return sNorm.length > 3 && msgNorm.includes(sNorm);
        });

        if (mentionedSpot && /\b(mapa|onde fica|mostrar|mostre|ver|localiza|ir para)\b/.test(msgNorm)) {
          detectedFunctionCalls.push({
            name: 'focusSpotOnMap',
            args: { spotId: mentionedSpot.id },
          });
        } else if (
          /\b(dica|recomend|suger|sugest|onde comer|restaurante|cafe|chocolate|parque|mirante|hotel|pousada|fazer|visitar|conhecer|melhor|lugares)\b/.test(
            msgNorm
          )
        ) {
          const recommended = selectSmartItinerarySpots(spots, {
            style: msgNorm,
            budgetTier: hasBudgetTierInMsg || 'premium',
            limit: 3,
            userLocation,
          });
          detectedFunctionCalls.push({
            name: 'recommendSpotsCards',
            args: { spotIds: recommended.map((s) => s.id) },
          });
          if (!fullText.trim()) {
            const summaryList = recommended
              .map(
                (s) =>
                  `• **${s.name}** (${s.categoryLabel || s.category}) — ${(s.description || '').slice(0, 110)}`
              )
              .join('\n');
            const text = `Selecionei excelentes opções em Campos do Jordão cadastradas no Monvian:\n\n${summaryList}\n\nVocê pode tocar em qualquer cartão abaixo para visualizar o local diretamente no mapa.`;
            fullText = text;
            sendEvent('delta', { text });
          }
        }
      }

      let actionPayload: AssistantActionPayload | undefined;

      // Process any function calls decided by Gemini or verified by the intent layer
      for (const fc of detectedFunctionCalls) {
        if (fc.name === 'askItineraryBudgetPreference') {
          const style = String(fc.args.style || 'personalizado').trim();
          actionPayload = {
            type: 'ASK_BUDGET_PREFERENCE',
            style,
          };
          if (!fullText.trim()) {
            const promptText = 'Perfeito! Você prefere uma experiência econômica ou premium?';
            fullText = promptText;
            sendEvent('delta', { text: promptText });
          }
        } else if (fc.name === 'prepareSmartItineraryOnMap') {
          const style = String(fc.args.style || pendingStyleFromClient || 'personalizado').trim();
          const rawTier = String(fc.args.budgetTier || hasBudgetTierInMsg || 'premium').toLowerCase();
          const budgetTier: AssistantBudgetTier =
            rawTier.includes('econ') || rawTier.includes('barat') ? 'economico' : 'premium';
          const requestedIds = Array.isArray(fc.args.spotIds)
            ? fc.args.spotIds.map((id: any) => String(id))
            : [];

          const orderedSpots = selectSmartItinerarySpots(spots, {
            requestedSpotIds: requestedIds,
            style,
            budgetTier,
            limit: 4,
            userLocation,
          });

          const finalSpotIds = orderedSpots.map((s) => s.id);
          const title =
            String(fc.args.title || '').trim() ||
            `Roteiro ${style.charAt(0).toUpperCase() + style.slice(1)} ${budgetTier === 'economico' ? 'Econômico' : 'Premium'}`;
          const description =
            String(fc.args.description || '').trim() ||
            `Sequência inteligente ordenada por proximidade em Campos do Jordão (${orderedSpots.map((s) => s.name).join(' → ')}).`;

          actionPayload = {
            type: 'START_ITINERARY_SELECTION',
            style,
            budgetTier,
            title,
            description,
            spotIds: finalSpotIds,
            spots: orderedSpots,
          };

          if (!fullText.trim()) {
            const spotNames = orderedSpots.map((s, idx) => `${idx + 1}. **${s.name}**`).join('\n');
            const generatedMsg = `Preparei o seu **${title}** organizando os locais mais próximos entre si para otimizar seu deslocamento:\n\n${spotNames}\n\nDestaquei os pontos no mapa para você explorar os detalhes, ajustar se desejar e confirmar a rota real pelas ruas.`;
            fullText = generatedMsg;
            sendEvent('delta', { text: generatedMsg });
          }
        } else if (fc.name === 'focusSpotOnMap') {
          const rawId = String(fc.args.spotId || '').trim();
          const matchedSpot =
            spotsById.get(rawId) ||
            spots.find((s) => s.name.toLowerCase().includes(rawId.toLowerCase()));
          if (matchedSpot) {
            actionPayload = {
              type: 'FOCUS_SPOT_ON_MAP',
              spotId: matchedSpot.id,
              spots: [matchedSpot],
            };
            if (!fullText.trim()) {
              const msg = `Aqui está **${matchedSpot.name}** no mapa (${matchedSpot.address || 'Campos do Jordão'}).`;
              fullText = msg;
              sendEvent('delta', { text: msg });
            }
          }
        } else if (fc.name === 'recommendSpotsCards') {
          const ids = Array.isArray(fc.args.spotIds) ? fc.args.spotIds.map(String) : [];
          const matched = ids
            .map((id) => spotsById.get(id.trim()))
            .filter((s): s is AssistantSpotCandidate => Boolean(s));
          if (matched.length > 0) {
            const ordered = orderSpotsByProximity(matched, userLocation);
            actionPayload = {
              type: 'RECOMMENDED_SPOTS',
              spotIds: ordered.map((s) => s.id),
              spots: ordered,
            };
          }
        }
      }

      if (!fullText.trim()) {
        const fallbackText =
          'Olá! Sou o **Assistente Monvian**, seu guia inteligente em Campos do Jordão. Posso recomendar restaurantes, mirantes, passeios ou montar um roteiro personalizado diretamente no mapa. O que você gostaria de viver hoje?';
        fullText = fallbackText;
        sendEvent('delta', { text: fallbackText });
      }

      if (actionPayload) {
        sendEvent('action', actionPayload);
      }

      // Persist assistant response and metadata in SQLite
      const assistantMsgId = `msg_${crypto.randomUUID()}`;
      const metadataJson = actionPayload ? JSON.stringify({ action: actionPayload }) : null;
      db.prepare(
        `INSERT INTO assistant_messages (id, conversation_id, user_key, role, content, metadata_json) VALUES (?, ?, ?, 'assistant', ?, ?)`
      ).run(assistantMsgId, conversationId, userKey, fullText.trim(), metadataJson);
      db.prepare(
        `UPDATE assistant_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_key = ?`
      ).run(conversationId, userKey);

      sendEvent('done', {
        messageId: assistantMsgId,
        conversationId,
        content: fullText.trim(),
        action: actionPayload || null,
      });
      return res.end();
    } catch (error: any) {
      console.error('[Monvian Assistant Gemini Error]', error);
      sendEvent('error', {
        message:
          'Não foi possível processar sua solicitação no momento. Por favor, tente novamente em instantes.',
      });
      return res.end();
    }
  });
}
