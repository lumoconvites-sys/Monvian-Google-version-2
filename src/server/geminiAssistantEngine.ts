import { GoogleGenAI, ThinkingLevel, Type, type FunctionDeclaration } from '@google/genai';
import {
  orderSpotsByProximity,
  selectSmartItinerarySpots,
  type AssistantBudgetTier,
  type AssistantSpotCandidate,
} from '../utils/assistantHelpers';

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

export type AssistantErrorCode =
  | 'MISSING_API_KEY'
  | 'AUTH_ERROR'
  | 'INVALID_API_KEY'
  | 'MODEL_UNAVAILABLE'
  | 'RATE_LIMIT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'TIMEOUT'
  | 'EMPTY_RESPONSE'
  | 'NETWORK_ERROR'
  | 'INVALID_REQUEST'
  | 'SERVER_ERROR';

export interface ClassifiedAssistantError {
  code: AssistantErrorCode;
  httpStatus: number;
  userMessage: string;
  retryable: boolean;
  technicalDetail: string;
}

export interface AssistantHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeminiAssistantKnowledge {
  spots: AssistantSpotCandidate[];
  itineraries: Array<{
    id: string;
    title: string;
    subtitle?: string;
    category?: string;
    duration?: string;
    stopsCount?: number;
    description?: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    date?: string;
    location?: string;
    category?: string;
    price?: string;
    description?: string;
  }>;
}

export const PRIMARY_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const SECONDARY_GEMINI_MODEL = 'gemini-4-hydrogen';

export const ASSISTANT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'askItineraryBudgetPreference',
    description:
      'Acione esta função APENAS quando o usuário pedir explicitamente para criar, montar ou planejar um roteiro (ex: "Quero criar um roteiro romântico", "Monte um roteiro para família", "Crie um roteiro gastronômico") e AINDA NÃO tiver informado se prefere uma experiência Econômica ou Premium. NÃO chame esta função em cumprimentos, perguntas comuns ou pedidos de recomendação simples.',
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
      'Acione esta função APENAS quando o usuário já escolheu entre Econômico ou Premium para um roteiro solicitado (ou já especificou orçamento e estilo ao pedir um roteiro) para selecionar os melhores pontos reais do Monvian, ordená-los por proximidade geográfica e abrir a seleção interativa diretamente no mapa.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description:
            'Título elegante para o roteiro personalizado (ex: "Roteiro Romântico Premium", "Manhã Econômica na Serra").',
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
      'Foca e destaca um ponto turístico, restaurante, café, hotel ou parque específico diretamente no mapa do Monvian quando o usuário pedir explicitamente para ver onde fica ou abrir um local específico no mapa.',
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
      'Exibe cartões interativos de locais reais do Monvian dentro da conversa quando o usuário pedir recomendações, sugestões de lugares, restaurantes, cafés, chocolaterias, mirantes ou passeios em Campos do Jordão.',
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

/**
 * Classifies Gemini SDK / HTTP errors into structured codes and accurate Portuguese user messages
 * without ever exposing API keys or internal stack traces.
 */
export function classifyGeminiError(err: any): ClassifiedAssistantError {
  const status = Number(err?.status || err?.code || err?.error?.code || 0);
  const rawMessage = String(err?.message || err?.error?.message || err || '').trim();
  const upper = rawMessage.toUpperCase();

  if (err?.name === 'AbortError' || upper.includes('DEADLINE_EXCEEDED') || upper.includes('TIMEOUT') || status === 504) {
    return {
      code: 'TIMEOUT',
      httpStatus: 504,
      userMessage: 'O Assistente Monvian demorou mais do que o esperado para responder. Por favor, tente novamente.',
      retryable: true,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  if (upper.includes('API_KEY_INVALID') || upper.includes('API KEY NOT VALID') || upper.includes('INVALID API KEY')) {
    return {
      code: 'INVALID_API_KEY',
      httpStatus: 401,
      userMessage: 'A chave de integração do Google Gemini está inválida ou expirada. Verifique a configuração em Settings > Secrets.',
      retryable: false,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('UNAUTHENTICATED') ||
    upper.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
  ) {
    return {
      code: 'AUTH_ERROR',
      httpStatus: status === 401 ? 401 : 403,
      userMessage: 'Falha de autenticação ao conectar com o Google Gemini. Verifique a chave de API configurada no servidor.',
      retryable: false,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  if (status === 404 || upper.includes('NOT_FOUND') || upper.includes('MODEL') && upper.includes('NOT FOUND')) {
    return {
      code: 'MODEL_UNAVAILABLE',
      httpStatus: 404,
      userMessage: 'O modelo do Google Gemini configurado não está disponível no momento. Tente novamente em instantes.',
      retryable: false,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED') || upper.includes('RATE LIMIT') || upper.includes('QUOTA')) {
    return {
      code: 'RATE_LIMIT',
      httpStatus: 429,
      userMessage: 'O limite momentâneo de requisições do Gemini foi atingido. Aguarde alguns segundos e tente novamente.',
      retryable: true,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  if (
    status === 503 ||
    status === 502 ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED')
  ) {
    return {
      code: 'UPSTREAM_UNAVAILABLE',
      httpStatus: 503,
      userMessage: 'O Google Gemini está com alta demanda neste instante. Aguarde alguns segundos e envie sua mensagem novamente.',
      retryable: true,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  if (
    upper.includes('ECONNREFUSED') ||
    upper.includes('ENOTFOUND') ||
    upper.includes('ECONNRESET') ||
    upper.includes('FETCH FAILED') ||
    upper.includes('NETWORK')
  ) {
    return {
      code: 'NETWORK_ERROR',
      httpStatus: 502,
      userMessage: 'Não foi possível estabelecer conexão com o serviço do Google Gemini. Verifique sua conexão e tente novamente.',
      retryable: true,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  if (upper.includes('EMPTY_RESPONSE')) {
    return {
      code: 'EMPTY_RESPONSE',
      httpStatus: 502,
      userMessage: 'O Assistente Monvian retornou uma resposta vazia. Por favor, tente reformular ou reenviar sua mensagem.',
      retryable: true,
      technicalDetail: rawMessage.slice(0, 400),
    };
  }

  return {
    code: 'SERVER_ERROR',
    httpStatus: 500,
    userMessage: 'Ocorreu um erro interno ao processar sua mensagem no Assistente Monvian. Tente novamente.',
    retryable: true,
    technicalDetail: rawMessage.slice(0, 400),
  };
}

/**
 * Formats Monvian's live database catalog into a compact, token-efficient RAG prompt
 * so Gemini responds faster while staying 100% grounded in real database entries.
 */
export function buildCompactMonvianKnowledgePrompt(knowledge: GeminiAssistantKnowledge): string {
  const activeSpots = knowledge.spots.filter(
    (s) => s.name && !/^(teste|teste 2|jejs|nome|parqu)$/i.test(s.name.trim())
  );
  const catalogSpots = activeSpots.length > 0 ? activeSpots : knowledge.spots;

  const spotsCatalog = catalogSpots
    .slice(0, 40)
    .map(
      (s) =>
        `• [ID:${s.id}] ${s.name} | ${s.categoryLabel || s.category} | ${s.priceRange || '$$'}${s.price ? ` (${s.price})` : ''} | ${s.rating || 4.8}★ | ${s.address || 'Campos do Jordão'}${s.highlighted ? ' | DESTAQUE' : ''}${s.description ? ` — ${s.description.slice(0, 95)}` : ''}`
    )
    .join('\n');

  const itinerariesCatalog = (knowledge.itineraries || [])
    .slice(0, 8)
    .map(
      (it) =>
        `• [Roteiro:${it.id}] ${it.title} (${it.category || 'Experiência'} · ${it.duration || 'Meio dia'})`
    )
    .join('\n');

  const eventsCatalog =
    knowledge.events && knowledge.events.length > 0
      ? knowledge.events
          .slice(0, 6)
          .map((e) => `• ${e.title} (${e.date || 'Em breve'} · ${e.location || 'Campos do Jordão'})`)
          .join('\n')
      : '';

  return [
    '=== BASE OFICIAL MONVIAN (CAMPOS DO JORDÃO) ===',
    'Use EXCLUSIVAMENTE os locais e IDs reais abaixo ao recomendar ou montar roteiros. Nunca invente locais, endereços ou IDs.',
    '',
    `LOCAIS REAIS (${catalogSpots.length}):`,
    spotsCatalog,
    itinerariesCatalog ? `\nROTEIROS OFICIAIS:\n${itinerariesCatalog}` : '',
    eventsCatalog ? `\nEVENTOS:\n${eventsCatalog}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildMonvianSystemInstruction(
  knowledge: GeminiAssistantKnowledge,
  userName?: string
): string {
  const ragBlock = buildCompactMonvianKnowledgePrompt(knowledge);
  return `Você é o Assistente Monvian, o guia turístico inteligente oficial do aplicativo Monvian em Campos do Jordão.

PERSONALIDADE E REGRAS:
- Responda sempre em português natural, elegante, educado, objetivo e conciso (1 a 3 parágrafos curtos).
- Analise cada mensagem individualmente conforme a intenção real do usuário:
  1. Cumprimentos, testes ou conversa casual (ex: "Olá", "Tudo bem?", "Testando"): responda de forma natural, simpática e contextualizada, confirmando que está pronto para ajudar em Campos do Jordão — SEM iniciar um roteiro automaticamente e SEM chamar ferramentas desnecessárias.
  2. Dúvidas turísticas ou pedidos de recomendação (ex: "O que posso fazer em Campos do Jordão?", "Onde comer bem?"): recomende locais reais da base oficial abaixo e acione a função \`recommendSpotsCards\` com os IDs reais citados.
  3. Pedido para localizar um ponto específico no mapa: acione \`focusSpotOnMap\` com o ID real do local.
  4. Pedido para criar/montar um roteiro (ex: "Quero criar um roteiro romântico"):
     - Se o usuário AINDA NÃO escolheu entre Econômico ou Premium, acione \`askItineraryBudgetPreference\` e responda exatamente com: "Perfeito! Você prefere uma experiência econômica ou premium?"
     - Se o usuário JÁ escolheu Econômico ou Premium (ou acabou de responder isso), acione \`prepareSmartItineraryOnMap\` selecionando de 3 a 5 IDs reais da base oficial adequados ao estilo e orçamento, e apresente brevemente os locais escolhidos informando que já foram destacados no mapa.
${userName ? `\nUsuário atual: ${userName}` : ''}

${ragBlock}`;
}

/**
 * Normalizes multi-turn conversation history so roles strictly alternate user -> model
 * and always start with a user turn as required by the Gemini API.
 */
export function normalizeGeminiContents(
  history: AssistantHistoryTurn[],
  latestUserMessage: string,
  pendingItineraryStyle?: string
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const turn of history) {
    const text = String(turn.content || '').trim();
    if (!text) continue;
    const role: 'user' | 'model' = turn.role === 'user' ? 'user' : 'model';
    if (contents.length === 0 && role === 'model') {
      continue;
    }
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  const trimmedLatest = latestUserMessage.trim();
  const annotatedLatest = pendingItineraryStyle
    ? `${trimmedLatest}\n[Contexto da conversa: o usuário pediu anteriormente um roteiro "${pendingItineraryStyle}" e está respondendo se prefere Econômico ou Premium.]`
    : trimmedLatest;

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: annotatedLatest }] });
  } else {
    const last = contents[contents.length - 1];
    if (last.role === 'user') {
      if (!last.parts[0].text.includes(trimmedLatest)) {
        last.parts[0].text += `\n${annotatedLatest}`;
      } else if (pendingItineraryStyle && !last.parts[0].text.includes('[Contexto da conversa:')) {
        last.parts[0].text = annotatedLatest;
      }
    } else {
      contents.push({ role: 'user', parts: [{ text: annotatedLatest }] });
    }
  }

  return contents;
}

function resolveToolActions(
  functionCalls: Array<{ name: string; args: Record<string, any> }>,
  spots: AssistantSpotCandidate[],
  userLocation?: { lat: number; lng: number } | null,
  pendingItineraryStyle?: string
): { action?: AssistantActionPayload; defaultText?: string } {
  const spotsById = new Map(spots.map((s) => [String(s.id), s]));
  let action: AssistantActionPayload | undefined;
  let defaultText: string | undefined;

  for (const fc of functionCalls) {
    if (fc.name === 'askItineraryBudgetPreference') {
      const style = String(fc.args?.style || 'personalizado').trim();
      action = {
        type: 'ASK_BUDGET_PREFERENCE',
        style,
      };
      defaultText = 'Perfeito! Você prefere uma experiência econômica ou premium?';
    } else if (fc.name === 'prepareSmartItineraryOnMap') {
      const style = String(fc.args?.style || pendingItineraryStyle || 'personalizado').trim();
      const rawTier = String(fc.args?.budgetTier || 'premium').toLowerCase();
      const budgetTier: AssistantBudgetTier =
        rawTier.includes('econ') || rawTier.includes('barat') ? 'economico' : 'premium';
      const requestedIds = Array.isArray(fc.args?.spotIds)
        ? fc.args.spotIds.map((id: any) => String(id))
        : [];

      const orderedSpots = selectSmartItinerarySpots(spots, {
        requestedSpotIds: requestedIds,
        style,
        budgetTier,
        limit: 4,
        userLocation,
      });

      const title =
        String(fc.args?.title || '').trim() ||
        `Roteiro ${style.charAt(0).toUpperCase() + style.slice(1)} ${
          budgetTier === 'economico' ? 'Econômico' : 'Premium'
        }`;
      const description =
        String(fc.args?.description || '').trim() ||
        `Roteiro inteligente ordenado por proximidade em Campos do Jordão (${orderedSpots
          .map((s) => s.name)
          .join(' → ')}).`;

      action = {
        type: 'START_ITINERARY_SELECTION',
        style,
        budgetTier,
        title,
        description,
        spotIds: orderedSpots.map((s) => s.id),
        spots: orderedSpots,
      };

      const spotList = orderedSpots.map((s, idx) => `${idx + 1}. **${s.name}**`).join('\n');
      defaultText = `Preparei o seu **${title}** organizando os pontos mais próximos entre si:\n\n${spotList}\n\nDestaquei esses locais no mapa para você explorar os detalhes, ajustar se desejar e confirmar a rota real pelas ruas.`;
    } else if (fc.name === 'focusSpotOnMap') {
      const rawId = String(fc.args?.spotId || '').trim();
      const matched =
        spotsById.get(rawId) ||
        spots.find((s) => s.name.toLowerCase().includes(rawId.toLowerCase()));
      if (matched) {
        action = {
          type: 'FOCUS_SPOT_ON_MAP',
          spotId: matched.id,
          spots: [matched],
        };
        defaultText = `Destaquei **${matched.name}** no mapa para você (${matched.address || 'Campos do Jordão'}).`;
      }
    } else if (fc.name === 'recommendSpotsCards') {
      const ids = Array.isArray(fc.args?.spotIds) ? fc.args.spotIds.map(String) : [];
      const matched = ids
        .map((id) => spotsById.get(id.trim()))
        .filter((s): s is AssistantSpotCandidate => Boolean(s));
      if (matched.length > 0) {
        const ordered = orderSpotsByProximity(matched, userLocation);
        action = {
          type: 'RECOMMENDED_SPOTS',
          spotIds: ordered.map((s) => s.id),
          spots: ordered,
        };
      }
    }
  }

  return { action, defaultText };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RunGeminiAssistantParams {
  apiKey: string;
  userMessage: string;
  history: AssistantHistoryTurn[];
  knowledge: GeminiAssistantKnowledge;
  userName?: string;
  pendingItineraryStyle?: string;
  userLocation?: { lat: number; lng: number } | null;
  signal?: AbortSignal;
  onTextDelta?: (delta: string) => void;
}

export interface RunGeminiAssistantResult {
  text: string;
  action: AssistantActionPayload | null;
  modelUsed: string;
}

/**
 * Executes a real Google Gemini streaming call with:
 * - Official @google/genai SDK exclusively
 * - Primary model gemini-4-hydrogen (with ThinkingLevel.LOW for fast conversational response)
 * - Controlled exponential backoff retry on transient 503/429/504/empty responses
 * - Secondary official Gemini model fallback (gemini-3.1-flash-lite) if primary has 503 high demand
 * - Genuine error propagation when Gemini cannot be reached (never masks failures with fake replies)
 */
export async function runGeminiAssistantTurn(
  params: RunGeminiAssistantParams
): Promise<RunGeminiAssistantResult> {
  const cleanKey = String(params.apiKey || '').trim();
  if (!cleanKey) {
    const err: ClassifiedAssistantError = {
      code: 'MISSING_API_KEY',
      httpStatus: 503,
      userMessage:
        'A chave da API do Google Gemini (GEMINI_API_KEY) não está configurada no servidor. Verifique Settings > Secrets.',
      retryable: false,
      technicalDetail: 'GEMINI_API_KEY environment variable is empty or missing.',
    };
    throw err;
  }

  const systemInstruction = buildMonvianSystemInstruction(params.knowledge, params.userName);
  const contents = normalizeGeminiContents(
    params.history,
    params.userMessage,
    params.pendingItineraryStyle
  );

  // Attempt plan:
  // 1) Primary gemini-3.1-flash-lite + tools (fast real-time conversational latency ~1-3s)
  // 2) Controlled retry on gemini-3.1-flash-lite after brief backoff on transient error
  // 3) Secondary official Gemini model gemini-4-hydrogen with ThinkingLevel.LOW + tools
  const attempts: Array<{
    model: string;
    useThinkingLow: boolean;
    backoffMs: number;
    timeoutMs: number;
  }> = [
    { model: PRIMARY_GEMINI_MODEL, useThinkingLow: false, backoffMs: 0, timeoutMs: 18000 },
    { model: PRIMARY_GEMINI_MODEL, useThinkingLow: false, backoffMs: 600, timeoutMs: 18000 },
    { model: SECONDARY_GEMINI_MODEL, useThinkingLow: true, backoffMs: 600, timeoutMs: 25000 },
  ];

  let lastClassifiedError: ClassifiedAssistantError | null = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (params.signal?.aborted) {
      throw classifyGeminiError(Object.assign(new Error('Request aborted'), { name: 'AbortError' }));
    }

    if (attempt.backoffMs > 0) {
      await sleep(attempt.backoffMs, params.signal);
    }

    let streamedText = '';
    const detectedFunctionCalls: Array<{ name: string; args: Record<string, any> }> = [];

    try {
      const ai = new GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: attempt.timeoutMs,
        },
      });

      const config: any = {
        systemInstruction,
        tools: [{ functionDeclarations: ASSISTANT_FUNCTION_DECLARATIONS }],
      };
      if (attempt.useThinkingLow) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      if (params.signal) {
        config.abortSignal = params.signal;
      }

      const streamResponse = await ai.models.generateContentStream({
        model: attempt.model,
        contents,
        config,
      });

      for await (const chunk of streamResponse) {
        if (params.signal?.aborted) {
          throw Object.assign(new Error('Request aborted'), { name: 'AbortError' });
        }

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
          streamedText += chunkText;
          params.onTextDelta?.(chunkText);
        }
      }

      const { action, defaultText } = resolveToolActions(
        detectedFunctionCalls,
        params.knowledge.spots,
        params.userLocation,
        params.pendingItineraryStyle
      );

      let finalText = streamedText.trim();

      // If Gemini invoked a function call (e.g. recommendSpotsCards or prepareSmartItineraryOnMap) without text,
      // deliver the structured summary or exact budget question
      if (!finalText && defaultText) {
        finalText = defaultText;
        params.onTextDelta?.(finalText);
      } else if (!finalText && action?.type === 'RECOMMENDED_SPOTS' && action.spots?.length) {
        const list = action.spots
          .map((s) => `• **${s.name}** (${s.categoryLabel || s.category})`)
          .join('\n');
        finalText = `Aqui estão ótimas opções em Campos do Jordão para você explorar:\n\n${list}\n\nToque em qualquer cartão abaixo para visualizar o local no mapa.`;
        params.onTextDelta?.(finalText);
      }

      if (!finalText) {
        throw new Error('EMPTY_RESPONSE: Gemini returned no text and no tool action');
      }

      return {
        text: finalText,
        action: action || null,
        modelUsed: attempt.model,
      };
    } catch (rawErr: any) {
      const classified = classifyGeminiError(rawErr);
      lastClassifiedError = classified;

      console.error(
        `[Monvian Assistant Gemini] Attempt ${i + 1}/${attempts.length} (${attempt.model}) failed [${classified.code}]:`,
        classified.technicalDetail
      );

      // If we already streamed partial text to the client, do not retry and duplicate text
      if (streamedText.trim().length > 0) {
        return {
          text: streamedText.trim(),
          action: null,
          modelUsed: attempt.model,
        };
      }

      // Non-retryable errors (auth, invalid key, abort) fail fast; allow model fallback on MODEL_UNAVAILABLE
      if (params.signal?.aborted) {
        throw classified;
      }
      if (!classified.retryable && classified.code !== 'MODEL_UNAVAILABLE') {
        throw classified;
      }
    }
  }

  throw (
    lastClassifiedError || {
      code: 'SERVER_ERROR',
      httpStatus: 500,
      userMessage: 'Não foi possível obter uma resposta do Google Gemini agora. Tente novamente em instantes.',
      retryable: true,
      technicalDetail: 'All Gemini attempts exhausted.',
    }
  );
}
