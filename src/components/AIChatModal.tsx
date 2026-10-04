import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, MapPin, Copy, Check } from 'lucide-react';
import { AIChatMessage, MapsGroundingPlace, WebSource } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TypewriterMessage } from './TypewriterMessage';
import { VerifiedBadge } from './ui/VerifiedBadge';
import robotAvatar from '../assets/images/ai_robot_avatar_1790114566623.jpg';

interface CopyButtonProps {
  text: string;
  isLight: boolean;
  isGold?: boolean;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, isLight, isGold = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      type="button"
      onClick={handleCopy}
      className={`mt-2 inline-flex items-center gap-1.5 p-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
        copied
          ? isGold
            ? 'bg-amber-500/15 border border-amber-400/40 shadow-[0_0_12px_rgba(245,190,56,0.25)]'
            : 'bg-[#007AFF]/12 border border-[#007AFF]/25 shadow-2xs'
          : isLight
          ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/70'
          : 'text-zinc-400 hover:text-white hover:bg-white/10'
      }`}
      title={copied ? 'Copiado!' : 'Copiar resposta'}
      aria-label="Copiar resposta"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="copied-active"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            {isGold ? (
              <>
                <span className="text-xs font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(245,190,56,0.6)]">
                  Copiado!
                </span>
                <Check className="w-4 h-4 text-[#F5BE38] stroke-[3] drop-shadow-[0_0_8px_rgba(245,190,56,0.8)]" />
              </>
            ) : (
              <>
                <span className="text-xs font-black tracking-tight text-[#007AFF] dark:text-sky-400">
                  Copiado!
                </span>
                <Check className="w-4 h-4 text-[#007AFF] dark:text-sky-400 stroke-[3]" />
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="uncopied-default"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center justify-center"
          >
            <Copy className="w-[18px] h-[18px] stroke-[2.2]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpotByName?: (spotName: string) => void;
  onOpenItineraries?: () => void;
  userCoords?: { lat: number; lng: number } | null;
  theme?: 'dark' | 'light';
}

const DEFAULT_SUGGESTIONS = [
  'Monte um roteiro romântico de 2 dias',
  'Como está o clima e a temperatura hoje?',
  'Quais os melhores fondues e cafés em Capivari?',
  'O que posso fazer com a minha família hoje?',
];

const GUIDE_AVATAR_URL = robotAvatar;

interface UserMessageBubbleProps {
  msg: AIChatMessage;
  isLight: boolean;
}

const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({ msg, isLight }) => {
  const [showReaction, setShowReaction] = useState(false);

  useEffect(() => {
    // 1 second delay for the reaction effect to appear on the balloon
    const timer = setTimeout(() => {
      setShowReaction(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative inline-block max-w-[85%] sm:max-w-[78%]">
      <div
        className={`px-5 py-3.5 rounded-[24px] rounded-br-[6px] text-[15px] sm:text-[15.5px] leading-relaxed font-bold whitespace-pre-wrap tracking-tight ${
          isLight
            ? 'bg-[#f4f4f4] text-zinc-900 shadow-2xs'
            : 'bg-[#2f2f2f] text-white shadow-2xs'
        }`}
      >
        {msg.text}
      </div>

      {/* Thumbs-up 👍🏻 reaction effect that pops in 1 second after sending */}
      <AnimatePresence>
        {showReaction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.2, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={`absolute -bottom-2 right-1 px-1.5 py-0.5 rounded-full border shadow-md flex items-center justify-center select-none z-10 ${
              isLight
                ? 'bg-white border-zinc-200 text-zinc-900 shadow-xs'
                : 'bg-[#1e1e22] border-white/20 text-white shadow-sm'
            }`}
          >
            <span className="text-xs leading-none">👍🏻</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  onSelectSpotByName,
  onOpenItineraries,
  userCoords,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const isGoldUser = Boolean(
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem('monvian_user') || '{}');
        const cleanEmail = (u.email || u.whatsapp || '').trim().toLowerCase();
        const isGoldAdmin = ['empresariomario@gmail.com', 'marioempresario@gmail.com', 'marioyesk@gmail.com'].includes(cleanEmail);
        return isGoldAdmin || Boolean(u.isGold || u.is_gold === 1 || u.isPremium || u.is_premium === 1);
      } catch {
        return false;
      }
    })()
  );
  const [messages, setMessages] = useState<AIChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('monvian_chat_user_messages') || sessionStorage.getItem('monvian_chat_session_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'pesquisando...' | 'digitando...'>('pesquisando...');
  const [isListening, setIsListening] = useState(false);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Fetch persisted chat history from server on mount & when modal opens
  useEffect(() => {
    const fetchUserChatHistory = async () => {
      const token = localStorage.getItem('monvian_token');
      if (!token) return;
      try {
        const res = await fetch('/api/chat/messages', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
          localStorage.setItem('monvian_chat_user_messages', JSON.stringify(data.messages));
        }
      } catch (e) {
        console.warn('Error fetching persisted chat history:', e);
      }
    };

    fetchUserChatHistory();
  }, [isOpen]);

  // Sync session & account messages
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('monvian_chat_user_messages', JSON.stringify(messages));
        sessionStorage.setItem('monvian_chat_session_messages', JSON.stringify(messages));

        const token = localStorage.getItem('monvian_token');
        if (token) {
          fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ messages })
          }).catch(() => {});
        }
      } else {
        localStorage.removeItem('monvian_chat_user_messages');
        sessionStorage.removeItem('monvian_chat_session_messages');
      }
    } catch {}
  }, [messages]);

  // Scroll to bottom when user sends a message or when waiting for response
  useEffect(() => {
    if (isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const scrollToMessageTop = (messageId: string) => {
    setTimeout(() => {
      const element = document.getElementById(`msg-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const sendMessage = async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query || isLoading) return;

    const userMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsLoading(true);
    setLoadingStage('pesquisando...');

    const stageTimer = setTimeout(() => {
      setLoadingStage('digitando...');
    }, 1100);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          history: newHistory,
          userCoords: userCoords ? { lat: userCoords.lat, lng: userCoords.lng } : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor');
      }

      const data = await response.json();
      const replyText = data.reply || 'Campos do Jordão tem opções maravilhosas para isso!';
      const groundingPlaces: MapsGroundingPlace[] = data.groundingPlaces || [];
      const sources: WebSource[] = data.webSources || [];
      const showItineraryCards = Boolean(data.showItineraryCards);
      const openMapSpot = data.openMapSpot || null;

      const newAssistantId = `assistant-${Date.now()}`;
      const assistantMessage: AIChatMessage = {
        id: newAssistantId,
        sender: 'assistant',
        text: replyText,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        groundingPlaces,
        sources,
        showItineraryCards,
        openMapSpot,
      };

      setAnimatingMessageId(newAssistantId);
      setMessages((prev) => [...prev, assistantMessage]);
      scrollToMessageTop(newAssistantId);

      // If location was requested, smoothly transition to the main map
      if (openMapSpot?.name && onSelectSpotByName) {
        setTimeout(() => {
          onSelectSpotByName(openMapSpot.name);
          onClose();
        }, 900);
      }
    } catch (error) {
      console.error('Erro ao consultar IA Guia:', error);

      // Graceful contextual fallback if connection fails
      let fallbackText = '';
      const lower = query.toLowerCase();
      if (lower.includes('roteiro') || lower.includes('2 dias') || lower.includes('dia') || lower.includes('o que fazer')) {
        fallbackText = `Aqui está uma sugestão especial para a sua estadia em Campos do Jordão:

**Dia 1**:
• Manhã: Conheça os jardins deslumbrantes do **Parque Amantikir** e o mirante das araucárias.
• Tarde: Passeio pela **Vila Capivari**, visita à tradicional fábrica de chocolates e subida no **Teleférico do Morro do Elefante**.
• Noite: Sequência clássica de fondue suíço e vinho em restaurante acolhedor.

**Dia 2**:
• Manhã: Visita cultural ao **Palácio Boa Vista** com café nos bosques.
• Tarde: Pôr do sol inesquecível no **Pico do Itapeva**, com vista panorâmica de toda a serra.

🗺️ **Roteiros Prontos no App**:
Acesse a aba **Roteiros** no menu inferior do aplicativo! Lá você pode abrir roteiros prontos com mapa interativo e rota GPS passo a passo, incluindo opções **Gratuitas** e roteiros exclusivos da **Conta Gold**.`;
      } else if (lower.includes('fondue') || lower.includes('café') || lower.includes('chocolate') || lower.includes('restaurante') || lower.includes('comer')) {
        fallbackText = `Campos do Jordão conta com uma gastronomia de montanha renomada:

• **Vila Capivari**: O coração gastronômico com excelentes casas de fondue tradicional, trutas grelhadas e cervejarias artesanais como a Baden Baden.
• **Chocolaterias Artesanais**: Araucária, Bruno Alves e lojas no centrinho com chocolate quente cremoso.
• **Cafés Especiais**: Sans Souci e cafés charmosos com bolos e doces finos.

💡 Dica: Aos fins de semana, faça reserva antecipada nos restaurantes de Capivari para evitar esperas.`;
      } else if (lower.includes('clima') || lower.includes('tempo') || lower.includes('temperatura') || lower.includes('frio')) {
        fallbackText = `O clima serrano em Campos do Jordão costuma ter dias ensolarados e noites bem frias:

• Durante o dia, as temperaturas costumam variar entre **16°C e 22°C**.
• Ao entardecer e à noite, a temperatura cai rapidamente para a faixa de **8°C a 12°C**.

💡 Dica: Tenha sempre agasalhos quentes e casacos corta-vento, pois o vento de altitude é gelado.`;
      } else {
        fallbackText = `Posso te ajudar com todas as informações para sua viagem a Campos do Jordão: atrações turísticas, melhores fondues, previsão do tempo, mirantes e sugestões de passeios.

Além disso, não deixe de conferir os roteiros interativos prontos (Gratuitos e Gold) na aba **Roteiros** do aplicativo!`;
      }

      const newFallbackId = `assistant-${Date.now()}`;
      const fallbackMsg: AIChatMessage = {
        id: newFallbackId,
        sender: 'assistant',
        text: fallbackText,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setAnimatingMessageId(newFallbackId);
      setMessages((prev) => [...prev, fallbackMsg]);
      scrollToMessageTop(newFallbackId);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Reconhecimento de voz não suportado pelo navegador.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          sendMessage(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleReset = async () => {
    setMessages([]);
    setInputText('');
    localStorage.removeItem('monvian_chat_user_messages');
    sessionStorage.removeItem('monvian_chat_session_messages');

    const token = localStorage.getItem('monvian_token');
    if (token) {
      try {
        await fetch('/api/chat/messages', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
    }
  };

  return (
    <div
      id="ai-chat-fullscreen-overlay"
      onClick={onClose}
      className={`fixed inset-0 z-45 flex flex-col justify-end md:justify-center md:items-end md:p-6 md:pr-10 overflow-hidden transition-colors duration-300 md:bg-black/40 md:backdrop-blur-xs select-none`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full h-full md:h-[88vh] md:max-w-xl md:rounded-[32px] md:border md:border-white/15 md:shadow-2xl overflow-hidden flex flex-col justify-between transition-colors duration-300 ${
          isLight ? 'bg-white text-black' : 'bg-[#000000] md:ios-glass text-white'
        }`}
        style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
      {/* Top Header Bar */}
      <div
        className="relative px-5 pb-2 flex items-center justify-between z-10 shrink-0 w-full"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 20px)',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* Left: Limpar Button */}
        <div className="flex items-center justify-start min-w-[70px]">
          {messages.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              id="btn-chat-reset"
              onClick={handleReset}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all cursor-pointer border shadow-2xs ${
                isLight
                  ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200/80 active:bg-zinc-300'
                  : 'bg-white/10 hover:bg-white/15 text-zinc-200 border-white/10 active:bg-white/20'
              }`}
              title="Limpar conversa"
            >
              Limpar
            </motion.button>
          )}
        </div>

        {/* Center: Increased by 60% - Avatar, Chat title and verified badge when in conversation */}
        {messages.length > 0 && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 pointer-events-none"
          >
            <div className={`w-11 h-11 rounded-full overflow-hidden border shadow-sm ${isLight ? 'border-zinc-200 bg-zinc-100 ring-2 ring-zinc-100' : 'border-white/20 bg-zinc-900 ring-2 ring-white/10'}`}>
              <img src={GUIDE_AVATAR_URL} alt="Assistente AI" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xl sm:text-[22px] font-black tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>Chat</span>
              <VerifiedBadge className="w-5.5 h-5.5" isGold={isGoldUser} />
            </div>
          </div>
        )}

        {/* Right spacing balance */}
        <div className="min-w-[70px]" />
      </div>

      {/* Main Content Area (Centered Elements) */}
      <div 
        className={`flex-1 overflow-y-auto px-5 sm:px-8 flex flex-col max-w-2xl mx-auto w-full relative z-10 no-scrollbar ${
          messages.length === 0 ? 'justify-center items-center' : 'justify-start'
        }`}
      >
        {messages.length === 0 ? (
          /* Initial Screen with perfectly centered elements */
          <div 
            className="flex flex-col items-center text-center w-full max-w-lg mx-auto my-auto py-2"
          >
            {/* 3D Guide Avatar Portrait */}
            <div className="relative mb-3">
              <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 shadow-2xl mx-auto ${
                isGoldUser
                  ? 'border-[#FFF4A3]/70 bg-[#141518] ring-4 ring-[#F5BE38]/30 shadow-[0_0_25px_rgba(245,190,56,0.35)]'
                  : isLight ? 'border-zinc-200 bg-zinc-100 ring-4 ring-zinc-100' : 'border-white/15 bg-zinc-900 ring-4 ring-white/5'
              }`}>
                <img
                  src={GUIDE_AVATAR_URL}
                  alt="Assistente de Inteligência Artificial"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Chat Title with Verified Checkmark */}
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <h1 className={`text-2xl sm:text-[26px] font-black tracking-tight ${isLight ? 'text-black' : 'text-white'}`}>
                Chat
              </h1>
              <VerifiedBadge className="w-5 h-5 sm:w-5.5 sm:h-5.5" isGold={isGoldUser} />
            </div>

            {/* Subtitle: Assistente de inteligência artificial */}
            <p className={`text-sm font-semibold tracking-tight mb-5 sm:mb-6 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Assistente de inteligência artificial
            </p>

            {/* The 4 Prompt Suggestion Cards */}
            <div className="w-full flex flex-col gap-2.5 max-w-lg">
              {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  id={`btn-suggestion-${index}`}
                  onClick={() => sendMessage(suggestion)}
                  className={`w-full py-3.5 px-5 rounded-2xl text-left text-sm font-bold tracking-tight transition-all duration-200 shadow-2xs hover:shadow-xs cursor-pointer flex items-center justify-between group active:scale-[0.99] border ${
                    isLight
                      ? 'bg-zinc-100/90 hover:bg-zinc-200/90 active:bg-zinc-200 border-zinc-200/80 text-zinc-900'
                      : 'bg-[#18191d] hover:bg-[#202227] active:bg-[#272930] border-white/10 text-zinc-100'
                  }`}
                >
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Active Conversation Feed in ChatGPT Style */
          <div ref={chatScrollContainerRef} className="py-3 space-y-5 flex-1 flex flex-col justify-start">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                const isCurrentlyTyping = animatingMessageId === msg.id;

                if (isUser) {
                  /* User message bubble: Clean ChatGPT style with bold text and 1s reaction effect */
                  return (
                    <motion.div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end w-full scroll-mt-20 pb-2"
                    >
                      <UserMessageBubble msg={msg} isLight={isLight} />
                    </motion.div>
                  );
                }

                /* Bot response: Clean left-aligned ChatGPT style (no heavy boxes) */
                return (
                  <motion.div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start w-full text-left scroll-mt-20 pt-1"
                  >
                    <div
                      className={`w-full max-w-[98%] sm:max-w-[92%] text-[15px] sm:text-[15.5px] leading-relaxed font-normal ${
                        isLight ? 'text-zinc-900' : 'text-zinc-100'
                      }`}
                    >
                      <TypewriterMessage
                        content={msg.text}
                        isAnimated={isCurrentlyTyping}
                        onComplete={() => setAnimatingMessageId(null)}
                        onScrollToTop={() => scrollToMessageTop(msg.id)}
                      />

                      {/* ChatGPT Style Copy Button */}
                      {!isCurrentlyTyping && (
                        <div className="flex items-center justify-start">
                          <CopyButton text={msg.text} isLight={isLight} isGold={isGoldUser} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 pt-1.5"
              >
                <div className={`w-8 h-8 rounded-full overflow-hidden border shrink-0 shadow-2xs ${isLight ? 'border-zinc-200 bg-zinc-100' : 'border-white/15 bg-zinc-900'}`}>
                  <img src={GUIDE_AVATAR_URL} alt="Assistente AI" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[13.5px] font-semibold tracking-tight transition-all ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {loadingStage}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-bounce" />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Input Bar (ChatGPT style) */}
      <div
        className="px-4 sm:px-8 pt-2 max-w-3xl mx-auto w-full shrink-0 relative z-10"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 84px)',
        }}
      >
        <form
          onSubmit={handleSubmit}
          className={`relative flex items-center rounded-full px-5 py-3 sm:py-3.5 transition-all shadow-2xs ${
            isLight
              ? 'bg-[#f4f4f4] border border-zinc-200/60 focus-within:border-zinc-300'
              : 'bg-[#212124] border border-white/10 focus-within:border-white/20'
          }`}
        >
          {/* Input text */}
          <input
            ref={inputRef}
            id="input-ai-chat"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte à IA..."
            className={`flex-1 bg-transparent text-[15.5px] sm:text-[16px] leading-normal focus:outline-none pr-3 font-medium ${
              isLight
                ? 'text-zinc-900 placeholder-[#707075]'
                : 'text-zinc-100 placeholder-[#9898A0]'
            }`}
          />

          {/* Microphone button / Send button */}
          {inputText.trim().length === 0 ? (
            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              id="btn-chat-mic"
              onClick={handleSpeechRecognition}
              className={`p-1.5 rounded-full flex items-center justify-center transition-colors cursor-pointer select-none ${
                isListening
                  ? 'text-red-500 animate-pulse'
                  : isLight
                  ? 'text-[#707075] hover:text-zinc-900'
                  : 'text-[#9898A0] hover:text-white'
              }`}
              title={isListening ? 'Ouvindo você...' : 'Falar por voz'}
            >
              {isListening ? (
                <MicOff className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Mic className="w-5 h-5 stroke-[2.2]" />
              )}
            </motion.button>
          ) : (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.92 }}
              type="submit"
              id="btn-chat-submit"
              disabled={isLoading}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isGoldUser
                  ? 'bg-metallic-gold text-[#1A1202] shadow-[0_2px_10px_rgba(230,172,51,0.4)] active:scale-95'
                  : isLight
                  ? 'bg-black text-white hover:bg-zinc-800 active:scale-95 shadow-xs'
                  : 'bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-xs'
              }`}
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4 stroke-[2.2]" />
            </motion.button>
          )}
        </form>
      </div>
    </div>
    </div>
  );
};
