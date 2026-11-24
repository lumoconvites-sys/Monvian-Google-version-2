import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ArrowUp, Mic, MapPin, Sparkles, Navigation } from 'lucide-react';
import { VerifiedBadge } from '../ui/VerifiedBadge';
import type { Spot } from '../../types';
import {
  getAssistantStorageKey,
  type AssistantBudgetTier,
  type AssistantSpotCandidate,
} from '../../utils/assistantHelpers';
import type { AssistantActionPayload } from '../../server/assistantRoutes';

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
  isLiveVoiceTranscript?: boolean;
  action?: AssistantActionPayload | null;
  createdAt?: string;
}

const CLIENT_REQUEST_TIMEOUT_MS = 48_000;
const DUPLICATE_SUBMIT_WINDOW_MS = 1_500;

interface ClientStreamFailure {
  code: string;
  message: string;
  retryable: boolean;
}

function classifyHttpFailure(status: number, parsedBody?: any): ClientStreamFailure {
  const serverMessage =
    typeof parsedBody?.message === 'string' && parsedBody.message.trim()
      ? parsedBody.message.trim()
      : typeof parsedBody?.error === 'string' && parsedBody.error.trim()
        ? parsedBody.error.trim()
        : '';
  const serverCode = typeof parsedBody?.code === 'string' ? parsedBody.code : '';

  if (status === 401 || status === 403) {
    return {
      code: serverCode || 'AUTH_ERROR',
      message:
        serverMessage ||
        'Não foi possível autenticar a consulta ao Assistente Monvian. Verifique a configuração da API Gemini.',
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      code: serverCode || 'ENDPOINT_NOT_FOUND',
      message:
        serverMessage ||
        'O serviço do Assistente Monvian não respondeu neste endereço. Recarregue o aplicativo e tente novamente.',
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      code: serverCode || 'RATE_LIMIT',
      message:
        serverMessage ||
        'Muitas mensagens enviadas em sequência. Aguarde alguns segundos e tente novamente.',
      retryable: true,
    };
  }
  if (status === 504) {
    return {
      code: serverCode || 'TIMEOUT',
      message:
        serverMessage ||
        'A resposta do Assistente Monvian demorou mais que o esperado. Tente novamente.',
      retryable: true,
    };
  }
  if (status === 502 || status === 503) {
    return {
      code: serverCode || 'UPSTREAM_UNAVAILABLE',
      message:
        serverMessage ||
        'O Google Gemini está com alta demanda neste instante. Tente novamente em alguns segundos.',
      retryable: true,
    };
  }

  return {
    code: serverCode || `HTTP_${status}`,
    message:
      serverMessage ||
      'Não foi possível concluir sua consulta ao Assistente Monvian agora. Tente novamente.',
    retryable: Boolean(parsedBody?.retryable) || status >= 500,
  };
}

function parseSseBlock(block: string): { eventType: string; data: any } | null {
  const lines = block.split(/\r?\n/);
  let eventType = 'message';
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue; // Ignore SSE comments (e.g. : keep-alive)
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  const dataStr = dataLines.join('\n');
  try {
    return { eventType, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}

interface MonvianAssistantPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id?: string | number | null; email?: string | null; name?: string | null } | null;
  spots: Spot[];
  userLocation?: { lat: number; lng: number } | null;
  onFocusSpotOnMap: (spot: Spot) => void;
  onStartItinerarySelectionOnMap: (payload: {
    spotIds: string[];
    title: string;
    description: string;
    budgetTier: AssistantBudgetTier;
  }) => void;
  hideFloatingButton?: boolean;
}

const INITIAL_WELCOME_MESSAGE: AssistantChatMessage = {
  id: 'welcome-monvian-ai',
  role: 'assistant',
  content: 'Olá! Que experiência você gostaria de viver em Campos do Jordão?',
};

/**
 * Custom Robot Icon matching the attached iOS Monvian Assistant reference design
 * (Rounded rectangular head, two circular eyes, top antenna with sphere, subtle side ears).
 */
export const MonvianRobotIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Top antenna ball & stem */}
    <circle cx="18" cy="6.2" r="2.1" fill="currentColor" />
    <path
      d="M18 8.2V12.2"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Left & right subtle side ears */}
    <rect x="4.2" y="17.5" width="2.4" height="5.5" rx="1.2" fill="currentColor" />
    <rect x="29.4" y="17.5" width="2.4" height="5.5" rx="1.2" fill="currentColor" />
    {/* Main rounded robot head */}
    <rect
      x="7.5"
      y="12.5"
      width="21"
      height="15.5"
      rx="6.2"
      stroke="currentColor"
      strokeWidth="2.6"
    />
    {/* Two circular eyes */}
    <circle cx="14.2" cy="20.2" r="2.15" fill="currentColor" />
    <circle cx="21.8" cy="20.2" r="2.15" fill="currentColor" />
  </svg>
);

/**
 * Discrete vertical sound wave bars matching IMG_0370_fd055ff0.jpeg
 */
const SoundWaveBars: React.FC<{ isListening: boolean }> = memo(({ isListening }) => {
  const baseHeights = [
    4, 6, 3, 9, 14, 7, 11, 20, 12, 26, 17, 34, 22, 40, 25, 32, 18, 27, 14, 19, 10, 14, 7, 9, 4, 6, 3,
  ];

  return (
    <div
      className="flex items-center justify-center gap-[4.5px] h-11 px-4 select-none pointer-events-none"
      aria-label={isListening ? 'Ouvindo sua voz...' : 'Ondas sonoras de voz'}
    >
      {baseHeights.map((h, idx) => (
        <span
          key={idx}
          className={`w-[2px] rounded-full transition-all duration-200 ${
            isListening
              ? 'bg-zinc-900 dark:bg-white animate-pulse'
              : 'bg-zinc-400/55 dark:bg-white/75'
          }`}
          style={{
            height: isListening
              ? `${Math.max(4, Math.min(42, h * (0.75 + ((idx * 37) % 10) * 0.05)))}px`
              : `${h}px`,
            opacity: idx < 3 || idx > baseHeights.length - 4 ? 0.35 : idx < 6 || idx > baseHeights.length - 7 ? 0.65 : 0.95,
            animationDelay: isListening ? `${(idx % 7) * 90}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
});

SoundWaveBars.displayName = 'SoundWaveBars';

/**
 * Simple lightweight markdown bold parser for clean ChatGPT-style typography
 */
function renderFormattedText(text: string) {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n');
    return (
      <p key={pIdx} className={pIdx > 0 ? 'mt-2.5' : ''}>
        {lines.map((line, lIdx) => {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <React.Fragment key={lIdx}>
              {lIdx > 0 && <br />}
              {parts.map((part, partIdx) => {
                if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                  return (
                    <strong key={partIdx} className="font-semibold text-zinc-950 dark:text-white">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return <React.Fragment key={partIdx}>{part}</React.Fragment>;
              })}
            </React.Fragment>
          );
        })}
      </p>
    );
  });
}

interface MessageBubbleProps {
  message: AssistantChatMessage;
  onSelectBudgetTier: (tier: AssistantBudgetTier, style?: string) => void;
  onSpotClick: (spotCandidate: AssistantSpotCandidate) => void;
  onReopenItinerarySelection: (action: AssistantActionPayload) => void;
  isBusy: boolean;
}

const AssistantMessageItem: React.FC<MessageBubbleProps> = memo(
  ({ message, onSelectBudgetTier, onSpotClick, onReopenItinerarySelection, isBusy }) => {
    const isUser = message.role === 'user';
    const action = message.action;

    const showBudgetButtons =
      !isUser &&
      (action?.type === 'ASK_BUDGET_PREFERENCE' ||
        /econ[oô]mic[oa]\s+ou\s+premium/i.test(message.content));

    return (
      <div
        className={`flex flex-col ${
          isUser ? 'items-end' : 'items-start'
        } w-full transition-opacity duration-150`}
      >
        <div
          className={`relative max-w-[85%] px-4 py-3.5 text-[15.5px] leading-[1.42] tracking-[-0.01em] ${
            isUser
              ? 'bg-[#171717] text-white dark:bg-[#2A2A2E] dark:text-white rounded-[22px] rounded-br-[6px]'
              : 'bg-[#F2F2F5] text-[#111113] dark:bg-[#1E1E22] dark:text-[#F5F5F7] rounded-[22px] rounded-bl-[6px]'
          }`}
        >
          {renderFormattedText(message.content)}

          {message.isLiveVoiceTranscript && (
            <span className="inline-flex items-center gap-1.5 ml-2 text-[11px] font-medium text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              ouvindo...
            </span>
          )}

          {message.isStreaming && !message.content && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" />
            </div>
          )}
        </div>

        {/* Stage 10: Visual option buttons for Econômico vs Premium */}
        {showBudgetButtons && !message.isStreaming && (
          <div className="flex items-center gap-2.5 mt-2.5">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSelectBudgetTier('economico', action?.style)}
              className="px-4 py-2.5 rounded-2xl text-[14px] font-semibold bg-[#F2F2F5] hover:bg-zinc-200/80 text-zinc-900 dark:bg-[#222226] dark:hover:bg-[#2C2C31] dark:text-white border border-black/[0.07] dark:border-white/[0.1] active:scale-[0.97] transition-all disabled:opacity-50"
            >
              Econômico
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSelectBudgetTier('premium', action?.style)}
              className="px-4 py-2.5 rounded-2xl text-[14px] font-semibold bg-[#171717] hover:bg-black text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black border border-black/10 dark:border-white/15 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Premium
            </button>
          </div>
        )}

        {/* Interactive Spot Cards returned by RAG / Function Calling */}
        {!isUser &&
          !message.isStreaming &&
          action?.spots &&
          action.spots.length > 0 && (
            <div className="w-full max-w-[92%] mt-2.5 space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {action.spots.map((spot, idx) => (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => onSpotClick(spot)}
                    className="flex items-center gap-2.5 min-w-[215px] max-w-[240px] p-2 rounded-2xl bg-[#F7F7F9] dark:bg-[#1A1A1E] border border-black/[0.06] dark:border-white/[0.08] text-left active:scale-[0.98] transition-transform shrink-0"
                  >
                    {spot.image ? (
                      <img
                        src={spot.image}
                        alt={spot.name}
                        className="w-11 h-11 rounded-xl object-cover shrink-0 bg-zinc-200 dark:bg-zinc-800"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {action.type === 'START_ITINERARY_SELECTION' && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                        )}
                        <span className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">
                          {spot.name}
                        </span>
                        <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />
                      </div>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {spot.categoryLabel || spot.category} • {spot.priceRange || '$$'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {action.type === 'START_ITINERARY_SELECTION' && (
                <button
                  type="button"
                  onClick={() => onReopenItinerarySelection(action)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold bg-zinc-900 text-white dark:bg-white dark:text-black active:scale-[0.98] transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Ver pontos selecionados no mapa
                </button>
              )}
            </div>
          )}
      </div>
    );
  }
);

AssistantMessageItem.displayName = 'AssistantMessageItem';

export const MonvianAssistantPanel: React.FC<MonvianAssistantPanelProps> = ({
  isOpen,
  onOpenChange,
  user,
  spots,
  userLocation,
  onFocusSpotOnMap,
  onStartItinerarySelectionOnMap,
  hideFloatingButton = false,
}) => {
  const userKey = String(user?.id || user?.email || 'guest_anonymous').trim();
  const storageKey = getAssistantStorageKey({
    id: user?.id ? String(user.id) : null,
    email: user?.email || null,
  });

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingItineraryStyle, setPendingItineraryStyle] = useState<string>('');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [hasUnreadResponseWhileCollapsed, setHasUnreadResponseWhileCollapsed] = useState(false);
  const [isExpandedTall, setIsExpandedTall] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const liveVoiceMessageIdRef = useRef<string | null>(null);
  const latestVoiceTranscriptRef = useRef<string>('');
  const dragStartYRef = useRef<number | null>(null);
  const isOpenRef = useRef(isOpen);
  const messagesRef = useRef<AssistantChatMessage[]>(messages);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const isSendingRef = useRef(false);
  const lastSubmissionRef = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setHasUnreadResponseWhileCollapsed(false);
    }
  }, [isOpen]);

  // Stop voice recognition whenever panel collapses or unmounts (Stage 9 & 16 requirement)
  const stopVoiceCapture = useCallback((discardLiveBubble = false) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListeningVoice(false);

    if (discardLiveBubble && liveVoiceMessageIdRef.current) {
      const targetId = liveVoiceMessageIdRef.current;
      setMessages((prev) => prev.filter((m) => m.id !== targetId));
      liveVoiceMessageIdRef.current = null;
      latestVoiceTranscriptRef.current = '';
    }
  }, []);

  useEffect(() => {
    if (!isOpen && isListeningVoice) {
      stopVoiceCapture(true);
    }
  }, [isOpen, isListeningVoice, stopVoiceCapture]);

  useEffect(() => {
    return () => {
      stopVoiceCapture(true);
      requestSeqRef.current += 1;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isSendingRef.current = false;
    };
  }, [stopVoiceCapture]);

  // Load isolated conversation history for the current authenticated user
  useEffect(() => {
    let cancelled = false;

    // Cancel any in-flight request from a previous account immediately
    requestSeqRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isSendingRef.current = false;
    setIsStreaming(false);

    // 1. Fast restore from user-scoped localStorage
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          setConversationId(parsed.conversationId || null);
        } else {
          setMessages([INITIAL_WELCOME_MESSAGE]);
          setConversationId(null);
        }
      } else {
        setMessages([INITIAL_WELCOME_MESSAGE]);
        setConversationId(null);
      }
    } catch {
      setMessages([INITIAL_WELCOME_MESSAGE]);
      setConversationId(null);
    }

    // 2. Sync from backend SQLite isolated by userKey
    fetch(`/api/assistant/history?userKey=${encodeURIComponent(userKey)}`, {
      headers: {
        'x-monvian-user-id': userKey,
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const formatted: AssistantChatMessage[] = [
            INITIAL_WELCOME_MESSAGE,
            ...data.messages.map((m: any) => ({
              id: String(m.id),
              role: m.role === 'user' ? 'user' : 'assistant',
              content: String(m.content || ''),
              action: m.metadata?.action || null,
              createdAt: m.createdAt,
            })),
          ];
          setMessages(formatted);
          setConversationId(data.conversationId || null);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userKey, storageKey]);

  // Persist isolated conversation snapshot per user
  useEffect(() => {
    try {
      const cleanMessages = messages.filter(
        (m) => !m.isLiveVoiceTranscript && !m.isStreaming && !m.isError
      );
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          conversationId,
          messages: cleanMessages.slice(-40),
        })
      );
    } catch {}
  }, [messages, conversationId, storageKey]);

  // Smart scroll management (Stage 8)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUpRef.current = distanceFromBottom > 72;
  }, []);

  useEffect(() => {
    if (!isUserScrolledUpRef.current && isOpen) {
      scrollToBottom('smooth');
    }
  }, [messages, isOpen, scrollToBottom]);

  // Execute actions decided by Gemini on the real Monvian map
  const executeMapAction = useCallback(
    (action: AssistantActionPayload) => {
      if (action.type === 'ASK_BUDGET_PREFERENCE') {
        setPendingItineraryStyle(action.style || 'personalizado');
        return;
      }

      if (action.type === 'FOCUS_SPOT_ON_MAP' && action.spotId) {
        const targetSpot = spots.find((s) => String(s.id) === String(action.spotId));
        if (targetSpot) {
          onOpenChange(false);
          onFocusSpotOnMap(targetSpot);
        }
        return;
      }

      if (action.type === 'START_ITINERARY_SELECTION' && Array.isArray(action.spotIds) && action.spotIds.length > 0) {
        setPendingItineraryStyle('');
        // Briefly let the user see the response, then smoothly collapse the sheet and zoom the map to the selected pins
        setTimeout(() => {
          onOpenChange(false);
          onStartItinerarySelectionOnMap({
            spotIds: action.spotIds!,
            title: action.title || 'Roteiro Inteligente Monvian',
            description: action.description || 'Selecionado pelo Assistente Monvian',
            budgetTier: action.budgetTier || 'premium',
          });
        }, 650);
      }
    },
    [spots, onOpenChange, onFocusSpotOnMap, onStartItinerarySelectionOnMap]
  );

  // Send message to Gemini Backend with progressive SSE streaming, timeout, controlled retry & recovery
  const sendMessageToGemini = useCallback(
    async (rawText: string, existingUserBubbleId?: string, overrideStyle?: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || isSendingRef.current) return;

      const now = Date.now();
      if (
        lastSubmissionRef.current &&
        lastSubmissionRef.current.text === trimmed &&
        now - lastSubmissionRef.current.at < DUPLICATE_SUBMIT_WINDOW_MS
      ) {
        return;
      }

      lastSubmissionRef.current = { text: trimmed, at: now };
      isSendingRef.current = true;
      isUserScrolledUpRef.current = false;

      const currentSeq = ++requestSeqRef.current;
      const userMsgId = existingUserBubbleId || `user_${now}`;
      const assistantMsgId = `assistant_${now + 1}`;

      // Build clean compact history from existing non-error turns for stateless/serverless resilience
      const historyPayload = messagesRef.current
        .filter(
          (m) =>
            m.id !== INITIAL_WELCOME_MESSAGE.id &&
            m.id !== existingUserBubbleId &&
            !m.isStreaming &&
            !m.isError &&
            !m.isLiveVoiceTranscript &&
            m.content.trim().length > 0
        )
        .slice(-12)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      setMessages((prev) => {
        const hasExisting = existingUserBubbleId && prev.some((m) => m.id === existingUserBubbleId);
        const updatedUserList = hasExisting
          ? prev.map((m) =>
              m.id === existingUserBubbleId
                ? { ...m, content: trimmed, isLiveVoiceTranscript: false }
                : m
            )
          : [
              ...prev,
              {
                id: userMsgId,
                role: 'user' as const,
                content: trimmed,
              },
            ];

        return [
          ...updatedUserList,
          {
            id: assistantMsgId,
            role: 'assistant' as const,
            content: '',
            isStreaming: true,
          },
        ];
      });

      setInputValue('');
      setIsStreaming(true);

      const executeSingleAttempt = async (): Promise<{
        receivedAnyDelta: boolean;
      }> => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw {
            code: 'OFFLINE',
            message:
              'Você parece estar sem conexão com a internet. Verifique sua rede e tente novamente.',
            retryable: false,
          } satisfies ClientStreamFailure;
        }

        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        let timedOut = false;
        const timeoutHandle = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, CLIENT_REQUEST_TIMEOUT_MS);

        let receivedAnyDelta = false;
        let accumulatedText = '';
        let receivedAction: AssistantActionPayload | null = null;
        let receivedDoneEvent = false;
        let streamError: ClientStreamFailure | null = null;

        const handleParsedEvent = (eventType: string, parsed: any) => {
          if (requestSeqRef.current !== currentSeq) return;

          if (eventType === 'meta' && parsed?.conversationId) {
            setConversationId(parsed.conversationId);
          } else if (eventType === 'delta' && typeof parsed?.text === 'string' && parsed.text.length > 0) {
            receivedAnyDelta = true;
            accumulatedText += parsed.text;
            const currentSnapshot = accumulatedText;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: currentSnapshot, isStreaming: true, isError: false }
                  : m
              )
            );
          } else if (eventType === 'action' && parsed) {
            receivedAction = parsed as AssistantActionPayload;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, action: receivedAction } : m
              )
            );
          } else if (eventType === 'done') {
            receivedDoneEvent = true;
            if (parsed?.conversationId) {
              setConversationId(parsed.conversationId);
            }
            const finalContent = String(parsed?.content || accumulatedText || '').trim();
            const finalAction = (parsed?.action || receivedAction) as AssistantActionPayload | null;

            if (!finalContent) {
              streamError = {
                code: 'EMPTY_RESPONSE',
                message:
                  'O Assistente Monvian retornou uma resposta vazia. Tente enviar sua mensagem novamente.',
                retryable: true,
              };
              return;
            }

            accumulatedText = finalContent;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: finalContent,
                      isStreaming: false,
                      isError: false,
                      action: finalAction,
                    }
                  : m
              )
            );

            if (!isOpenRef.current) {
              setHasUnreadResponseWhileCollapsed(true);
            }

            if (finalAction) {
              executeMapAction(finalAction);
            }
          } else if (eventType === 'error') {
            streamError = {
              code: typeof parsed?.code === 'string' ? parsed.code : 'STREAM_ERROR',
              message:
                typeof parsed?.message === 'string' && parsed.message.trim()
                  ? parsed.message.trim()
                  : 'Não consegui concluir sua resposta agora. Tente novamente em instantes.',
              retryable: Boolean(parsed?.retryable),
            };
          }
        };

        try {
          const response = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream, application/json',
              'x-monvian-user-id': userKey,
            },
            signal: controller.signal,
            body: JSON.stringify({
              message: trimmed,
              conversationId,
              userKey,
              userName: user?.name || undefined,
              pendingItineraryStyle: overrideStyle || pendingItineraryStyle || undefined,
              userLocation: userLocation || undefined,
              history: historyPayload,
            }),
          });

          const contentType = (response.headers.get('content-type') || '').toLowerCase();

          if (!response.ok) {
            let parsedError: any = null;
            try {
              parsedError = await response.json();
            } catch {
              try {
                const rawErrText = await response.text();
                if (rawErrText.trim()) parsedError = { message: rawErrText.slice(0, 200) };
              } catch {}
            }
            throw classifyHttpFailure(response.status, parsedError);
          }

          // Handle direct JSON response gracefully if a proxy converted/returned JSON
          if (contentType.includes('application/json')) {
            const json = await response.json();
            if (json?.code && json?.message && !json?.content) {
              throw {
                code: String(json.code),
                message: String(json.message),
                retryable: Boolean(json.retryable),
              } satisfies ClientStreamFailure;
            }
            handleParsedEvent('done', json);
            if (streamError) throw streamError;
            return { receivedAnyDelta: true };
          }

          if (!response.body) {
            throw {
              code: 'EMPTY_STREAM',
              message:
                'Não foi possível ler a resposta do Assistente Monvian. Tente novamente.',
              retryable: true,
            } satisfies ClientStreamFailure;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (requestSeqRef.current !== currentSeq) {
              try {
                await reader.cancel();
              } catch {}
              return { receivedAnyDelta };
            }

            if (done) {
              buffer += decoder.decode();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() || '';

            for (const block of blocks) {
              const evt = parseSseBlock(block);
              if (evt) {
                handleParsedEvent(evt.eventType, evt.data);
              }
            }
          }

          // Flush any final SSE block left in buffer after EOF
          if (buffer.trim()) {
            const trailingBlocks = buffer.split(/\r?\n\r?\n/);
            for (const block of trailingBlocks) {
              const evt = parseSseBlock(block);
              if (evt) {
                handleParsedEvent(evt.eventType, evt.data);
              }
            }
          }

          if (streamError) {
            throw streamError;
          }

          // If the stream closed cleanly after sending delta chunks without an explicit done frame
          if (!receivedDoneEvent) {
            if (accumulatedText.trim()) {
              handleParsedEvent('done', {
                content: accumulatedText.trim(),
                action: receivedAction,
              });
            } else {
              throw {
                code: 'EMPTY_RESPONSE',
                message:
                  'A conexão com o Assistente Monvian foi encerrada antes de receber a resposta. Tente novamente.',
                retryable: true,
              } satisfies ClientStreamFailure;
            }
          }

          return { receivedAnyDelta };
        } catch (err: any) {
          if (requestSeqRef.current !== currentSeq) {
            return { receivedAnyDelta };
          }
          if (timedOut) {
            throw {
              code: 'TIMEOUT',
              message:
                'A resposta do Assistente Monvian demorou mais que o esperado. Tente enviar sua mensagem novamente.',
              retryable: true,
            } satisfies ClientStreamFailure;
          }
          if (err?.name === 'AbortError') {
            throw {
              code: 'ABORTED',
              message: 'A solicitação foi interrompida.',
              retryable: false,
            } satisfies ClientStreamFailure;
          }
          if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
            throw Object.assign(err, { receivedAnyDelta });
          }
          throw {
            code: 'NETWORK_ERROR',
            message:
              'Falha de conexão ao consultar o Assistente Monvian. Verifique sua internet e tente novamente.',
            retryable: true,
            receivedAnyDelta,
          };
        } finally {
          window.clearTimeout(timeoutHandle);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      };

      try {
        let lastFailure: ClientStreamFailure | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (requestSeqRef.current !== currentSeq) return;
          try {
            await executeSingleAttempt();
            lastFailure = null;
            break;
          } catch (attemptErr: any) {
            if (requestSeqRef.current !== currentSeq) return;
            const failure: ClientStreamFailure =
              attemptErr && typeof attemptErr === 'object' && 'message' in attemptErr
                ? {
                    code: String(attemptErr.code || 'CLIENT_ERROR'),
                    message: String(attemptErr.message),
                    retryable: Boolean(attemptErr.retryable),
                  }
                : {
                    code: 'CLIENT_ERROR',
                    message:
                      'Não foi possível consultar o Assistente Monvian agora. Tente novamente.',
                    retryable: false,
                  };

            lastFailure = failure;
            const alreadyStreamedText = Boolean(attemptErr?.receivedAnyDelta);

            // Controlled single retry only on transient error before any text has streamed
            if (attempt === 0 && failure.retryable && !alreadyStreamedText && failure.code !== 'ABORTED') {
              console.warn(`[Monvian Assistant] Retrying once after transient error [${failure.code}]`);
              await new Promise((resolve) => window.setTimeout(resolve, 1200));
              continue;
            }
            break;
          }
        }

        if (lastFailure && lastFailure.code !== 'ABORTED' && requestSeqRef.current === currentSeq) {
          console.error(`[Monvian Assistant Client Error] [${lastFailure.code}]`, lastFailure.message);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: lastFailure!.message,
                    isStreaming: false,
                    isError: true,
                  }
                : m
            )
          );
        }
      } finally {
        if (requestSeqRef.current === currentSeq) {
          isSendingRef.current = false;
          setIsStreaming(false);
        }
      }
    },
    [
      userKey,
      conversationId,
      user?.name,
      pendingItineraryStyle,
      userLocation,
      executeMapAction,
    ]
  );

  // Stage 9: Voice Recognition with progressive transcription directly inside a conversation bubble
  const handleToggleVoiceRecognition = useCallback(() => {
    if (isListeningVoice) {
      const finalTranscript = latestVoiceTranscriptRef.current.trim();
      const bubbleId = liveVoiceMessageIdRef.current;
      stopVoiceCapture(false);
      liveVoiceMessageIdRef.current = null;
      latestVoiceTranscriptRef.current = '';

      if (finalTranscript && bubbleId) {
        sendMessageToGemini(finalTranscript, bubbleId);
      } else if (bubbleId) {
        setMessages((prev) => prev.filter((m) => m.id !== bubbleId));
      }
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setMessages((prev) => [
        ...prev,
        {
          id: `voice_unsupported_${Date.now()}`,
          role: 'assistant',
          content:
            'O reconhecimento de voz do navegador não está disponível neste dispositivo. Você pode digitar sua ideia logo abaixo.',
        },
      ]);
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      const liveBubbleId = `voice_user_${Date.now()}`;
      liveVoiceMessageIdRef.current = liveBubbleId;
      latestVoiceTranscriptRef.current = '';

      // Create the user message bubble immediately in the conversation (NEVER inside the text input!)
      setMessages((prev) => [
        ...prev,
        {
          id: liveBubbleId,
          role: 'user',
          content: 'Ouvindo...',
          isLiveVoiceTranscript: true,
        },
      ]);

      recognition.onresult = (event: any) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i++) {
          combined += event.results[i][0].transcript;
        }
        const cleaned = combined.trim();
        latestVoiceTranscriptRef.current = cleaned;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === liveBubbleId
              ? {
                  ...m,
                  content: cleaned || 'Ouvindo...',
                  isLiveVoiceTranscript: true,
                }
              : m
          )
        );
      };

      recognition.onerror = () => {
        const captured = latestVoiceTranscriptRef.current.trim();
        stopVoiceCapture(!captured);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
        recognitionRef.current = null;
        const captured = latestVoiceTranscriptRef.current.trim();
        const bubbleId = liveVoiceMessageIdRef.current;
        liveVoiceMessageIdRef.current = null;
        latestVoiceTranscriptRef.current = '';

        if (captured && bubbleId) {
          sendMessageToGemini(captured, bubbleId);
        } else if (bubbleId) {
          setMessages((prev) => prev.filter((m) => m.id !== bubbleId));
        }
      };

      recognitionRef.current = recognition;
      setIsListeningVoice(true);
      recognition.start();
    } catch {
      stopVoiceCapture(true);
    }
  }, [isListeningVoice, stopVoiceCapture, sendMessageToGemini]);

  // Handle Econômico / Premium visual button click
  const handleSelectBudgetTier = useCallback(
    (tier: AssistantBudgetTier, styleFromAction?: string) => {
      const activeStyle = styleFromAction || pendingItineraryStyle || 'personalizado';
      const label = tier === 'economico' ? 'Econômico' : 'Premium';
      sendMessageToGemini(`Prefiro uma experiência ${label}`, undefined, activeStyle);
    },
    [pendingItineraryStyle, sendMessageToGemini]
  );

  // Handle clicking a recommended spot card inside the chat
  const handleSpotCardClick = useCallback(
    (candidate: AssistantSpotCandidate) => {
      const found = spots.find((s) => String(s.id) === String(candidate.id));
      if (found) {
        onOpenChange(false);
        onFocusSpotOnMap(found);
      }
    },
    [spots, onOpenChange, onFocusSpotOnMap]
  );

  const handleReopenItinerarySelection = useCallback(
    (action: AssistantActionPayload) => {
      if (!action.spotIds || action.spotIds.length === 0) return;
      onOpenChange(false);
      onStartItinerarySelectionOnMap({
        spotIds: action.spotIds,
        title: action.title || 'Roteiro Inteligente Monvian',
        description: action.description || 'Selecionado pelo Assistente Monvian',
        budgetTier: action.budgetTier || 'premium',
      });
    },
    [onOpenChange, onStartItinerarySelectionOnMap]
  );

  // Touch / Pointer drag gestures on top grabber handle for native iOS collapse & expand
  const handlePointerDownGrabber = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMoveGrabber = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const deltaY = e.clientY - dragStartYRef.current;
    if (deltaY > 0) {
      setDragOffsetY(Math.min(deltaY, 260));
    } else if (deltaY < -35) {
      setIsExpandedTall(true);
      setDragOffsetY(0);
    }
  };

  const handlePointerUpGrabber = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const deltaY = e.clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    setDragOffsetY(0);

    if (deltaY > 55) {
      if (isExpandedTall) {
        setIsExpandedTall(false);
      } else {
        onOpenChange(false);
      }
    } else if (deltaY < -40) {
      setIsExpandedTall(true);
    } else if (Math.abs(deltaY) < 8) {
      // Single tap on the grabber collapses smoothly
      onOpenChange(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    sendMessageToGemini(inputValue);
  };

  return (
    <>
      {/* Stage 13: Floating Circular Robot Button when Assistant is collapsed */}
      {!isOpen && !hideFloatingButton && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Abrir Assistente Monvian"
          className="fixed right-4 bottom-[104px] z-[42] w-14 h-14 rounded-full bg-white dark:bg-[#161618] text-zinc-950 dark:text-white border border-black/[0.08] dark:border-white/[0.14] shadow-[0_10px_30px_rgba(0,0,0,0.32)] flex items-center justify-center active:scale-90 transition-transform duration-200"
        >
          <span className="flex items-center justify-center animate-[monvianFloat_3.4s_ease-in-out_infinite]">
            <MonvianRobotIcon className="w-7 h-7 transition-transform duration-300" />
          </span>

          {/* Discrete status reaction when Gemini is thinking or finished a response while collapsed */}
          {isStreaming && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 dark:bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-zinc-900 dark:bg-white border-2 border-white dark:border-[#161618]" />
            </span>
          )}

          {!isStreaming && hasUnreadResponseWhileCollapsed && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1D9BF0] opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#1D9BF0] border-2 border-white dark:border-[#161618]" />
            </span>
          )}
        </button>
      )}

      {/* Stage 6, 7 & 8: Expandable iOS Bottom Sheet over the Live Map (NO "X" close button) */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-[48] flex justify-center pointer-events-none"
          style={{
            transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : 'translateY(0px)',
            transition: dragStartYRef.current !== null ? 'none' : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <section
            aria-label="Assistente Monvian"
            className={`pointer-events-auto w-full max-w-[480px] flex flex-col rounded-t-[34px] bg-white/95 dark:bg-[#111113]/95 backdrop-blur-2xl border-t border-black/[0.08] dark:border-white/[0.11] shadow-[0_-14px_44px_rgba(0,0,0,0.42)] transition-[height] duration-300 ease-out ${
              isExpandedTall ? 'h-[76dvh]' : 'h-[50dvh] min-h-[365px] max-h-[450px]'
            }`}
            style={{
              paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
            }}
          >
            {/* Top Grabber Handle — Swipe down or tap to collapse, swipe up to expand */}
            <div
              onPointerDown={handlePointerDownGrabber}
              onPointerMove={handlePointerMoveGrabber}
              onPointerUp={handlePointerUpGrabber}
              onPointerCancel={handlePointerUpGrabber}
              className="w-full pt-2.5 pb-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
              title="Arraste para baixo para recolher"
            >
              <div className="w-11 h-[5px] rounded-full bg-zinc-300 dark:bg-white/25" />
            </div>

            {/* Header matching IMG_0370_fd055ff0.jpeg (No X button, full subtitle visible) */}
            <div className="px-5 pt-1 pb-3 flex items-center gap-3.5 shrink-0">
              <div className="w-[52px] h-[52px] rounded-full bg-[#F2F2F5] dark:bg-[#1C1C20] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center text-zinc-900 dark:text-white shrink-0 shadow-inner">
                <MonvianRobotIcon className="w-7 h-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[19px] font-bold tracking-[-0.02em] text-zinc-950 dark:text-white truncate">
                    Assistente Monvian
                  </h2>
                  <VerifiedBadge className="w-[18px] h-[18px] shrink-0" />
                </div>
                <p className="text-[13.5px] text-zinc-500 dark:text-[#9A9AA1] whitespace-nowrap overflow-hidden text-ellipsis">
                  Seu guia inteligente em Campos do Jordão
                </p>
              </div>
            </div>

            {/* Conversation Area with Smart Auto-Scroll */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-5 py-1.5 space-y-3 overscroll-contain no-scrollbar"
            >
              {messages.map((msg) => (
                <AssistantMessageItem
                  key={msg.id}
                  message={msg}
                  onSelectBudgetTier={handleSelectBudgetTier}
                  onSpotClick={handleSpotCardClick}
                  onReopenItinerarySelection={handleReopenItinerarySelection}
                  isBusy={isStreaming}
                />
              ))}
            </div>

            {/* Discrete Sound Wave Bar above input (matches IMG_0370_fd055ff0.jpeg) */}
            <div className="shrink-0 pt-1 pb-1.5">
              <SoundWaveBars isListening={isListeningVoice} />
            </div>

            {/* Fixed Bottom Input Bar: Circular Mic Button + Pill Input + Upward Arrow Button */}
            <form
              onSubmit={handleFormSubmit}
              className="px-5 pt-0.5 pb-1 flex items-center gap-2.5 shrink-0"
            >
              <button
                type="button"
                onClick={handleToggleVoiceRecognition}
                aria-label={isListeningVoice ? 'Parar gravação de voz' : 'Falar por voz'}
                className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-95 shrink-0 ${
                  isListeningVoice
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white shadow-md'
                    : 'bg-[#F2F2F5] dark:bg-[#1C1C20] text-zinc-900 dark:text-white border-black/[0.08] dark:border-white/[0.1]'
                }`}
              >
                <Mic className={`w-5 h-5 ${isListeningVoice ? 'animate-pulse' : ''}`} />
              </button>

              <div className="flex-1 h-12 rounded-full bg-[#F5F5F7] dark:bg-[#17171A] border border-black/[0.08] dark:border-white/[0.1] pl-4 pr-1.5 flex items-center gap-2 focus-within:border-black/25 dark:focus-within:border-white/25 transition-colors">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Digite sua ideia..."
                  disabled={isStreaming}
                  className="flex-1 bg-transparent text-[15px] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-[#7C7C82] focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isStreaming}
                  aria-label="Enviar mensagem"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    inputValue.trim() && !isStreaming
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black active:scale-90'
                      : 'bg-zinc-300/80 text-zinc-500 dark:bg-[#343438] dark:text-white/80'
                  }`}
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.4]" />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
};
