import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Mic, MicOff, CheckCircle2, RotateCcw, Loader2, MapPin, ExternalLink } from 'lucide-react';
import { AIChatMessage, MapsGroundingPlace } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TypewriterMessage } from './TypewriterMessage';
import robotAvatar from '../assets/images/ai_robot_avatar_1790114566623.jpg';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpotByName?: (spotName: string) => void;
  userCoords?: { lat: number; lng: number } | null;
}

const DEFAULT_SUGGESTIONS = [
  'Monte um roteiro romântico de 2 dias',
  'Como está o clima e a temperatura hoje?',
  'Quais os melhores fondues e cafés em Capivari?',
  'O que posso fazer com a minha família hoje?',
];

const GUIDE_AVATAR_URL = robotAvatar;

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  onSelectSpotByName,
  userCoords,
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('monvian_chat_session_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync session messages
  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem('monvian_chat_session_messages', JSON.stringify(messages));
      } else {
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

      const newAssistantId = `assistant-${Date.now()}`;
      const assistantMessage: AIChatMessage = {
        id: newAssistantId,
        sender: 'assistant',
        text: replyText,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        groundingPlaces,
      };

      setAnimatingMessageId(newAssistantId);
      setMessages((prev) => [...prev, assistantMessage]);
      scrollToMessageTop(newAssistantId);
    } catch (error) {
      console.error('Erro ao consultar IA Guia:', error);

      // Graceful instant fallback with clean structure
      let fallbackText = '';
      if (query.toLowerCase().includes('romântico') || query.toLowerCase().includes('casal') || query.toLowerCase().includes('2 dias')) {
        fallbackText = `🌹 Roteiro Romântico Perfeito
2 dias inesquecíveis em Campos do Jordão

📅 DIA 1

☀️ Manhã
Passeio a dois no Parque Amantikir, caminhando pelos jardins floridos e desvendando o labirinto verde.

🌅 Tarde
Pôr do sol no Pico do Itapeva, com vista panorâmica da Serra da Mantiqueira e chocolate quente artesanal.

🌙 Noite
Jantar à luz de velas com sequência clássica de fondue e vinho em ambiente acolhedor na Vila Capivari.

📅 DIA 2

☀️ Manhã
Visita cultural ao Palácio Boa Vista, admirando obras de arte modernistas e um café nos jardins do bosque.

🌅 Tarde
Passeio charmoso pelo centro de Capivari, compras de chocolates artesanais e subida ao Morro do Elefante.

💡 Dica: Chegue ao Pico do Itapeva por volta das 16h30 para aproveitar a luz dourada antes do anoitecer.`;
      } else if (query.toLowerCase().includes('café') || query.toLowerCase().includes('chocolate')) {
        fallbackText = `☕ Melhores Cafés & Chocolaterias de Capivari
Experiências gastronômicas imperdíveis

1. Chocolate Araucária: O chocolate mais tradicional da serra, com visita à fábrica de vidro e chocolate quente cremoso.
2. Sans Souci Café: Confeitaria em estilo provençal com bolos franceses artesanais e louças charmosas.
3. Café do Palácio: Mesinhas sob a sombra dos pinheiros com tortas alemãs e cafés especiais.
4. Bruno Alves Chocolatier: Chocolates finos belgas, bombons recheados e waffles quentinhos com morango.

💡 Dica: Experimente o chocolate quente com raspas de canela e marshmallow tostado no fogo!`;
      } else if (query.toLowerCase().includes('família') || query.toLowerCase().includes('criança')) {
        fallbackText = `👨‍👩‍👧‍👦 Passeios para Família & Crianças
Aventuras e diversão na serra

1. Parque Tarundu: Mais de 25 atrações ao ar livre como patinação no gelo, tirolesa, passeio a cavalo e arborismo.
2. Parque da Lagoinha: Lago com patos, trilhas planas para carrinhos de bebê e casinhas de esquilo entre araucárias.
3. Teleférico do Morro do Elefante: Cabines panorâmicas fechadas e trenó alpino com muita emoção.
4. Horto Florestal: Piqueniques sob os bosques e trilha suave das quatro pontes.

💡 Dica: Leve uma muda de agasalho extra para as crianças, pois a temperatura cai rápido no fim da tarde.`;
      } else {
        fallbackText = `✨ Olá! Sou o Chat, seu assistente de inteligência artificial.

Estou pronto para te ajudar com qualquer assunto, dúvidas gerais, dicas do dia a dia e informações de viagem em Campos do Jordão (passeios, fondues, cafés, clima e roteiros personalizados).

Como posso te ajudar agora?`;
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

  const handleReset = () => {
    setMessages([]);
    setInputText('');
  };

  return (
    <div
      id="ai-chat-fullscreen-overlay"
      className="absolute inset-0 z-45 text-white flex flex-col justify-between overflow-hidden bg-[#000000]"
      style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Header Bar */}
      <div
        className="relative px-6 pb-2 flex items-center justify-between z-10 shrink-0 w-full"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 14px), 24px)',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
        }}
      >
        {/* Left: Reset Button */}
        <div className="w-10 flex items-center justify-start">
          {messages.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              id="btn-chat-reset"
              onClick={handleReset}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 text-zinc-200 flex items-center justify-center transition-colors cursor-pointer border border-white/10"
              title="Nova conversa"
            >
              <RotateCcw className="w-4 h-4" />
            </motion.button>
          )}
        </div>

        {/* Center: Always strictly centered avatar, Chat title and verified badge */}
        {messages.length > 0 && (
          <div 
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shadow-xs">
              <img src={GUIDE_AVATAR_URL} alt="Assistente AI" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black tracking-tight text-white">Chat</span>
              <div className="w-4.5 h-4.5 rounded-full bg-[#007AFF] flex items-center justify-center text-white shrink-0">
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Right placeholder to balance flex container if needed */}
        <div className="w-10" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 flex flex-col justify-center max-w-3xl mx-auto w-full relative z-10">
        {messages.length === 0 ? (
          /* Initial Screen matching exact screenshot layout */
          <div 
            className="flex flex-col items-center text-center my-auto pb-4 w-full"
          >
            {/* 3D Guide Avatar Portrait */}
            <div className="relative mb-3">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-white/15 shadow-2xl bg-zinc-900 mx-auto ring-4 ring-white/5">
                <img
                  src={GUIDE_AVATAR_URL}
                  alt="Assistente de Inteligência Artificial"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Chat Title with Verified Checkmark */}
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <h1 className="text-2xl sm:text-[26px] font-black text-white tracking-tight">
                Chat
              </h1>
              {/* Verified Badge Circle */}
              <div className="w-5 h-5 rounded-full bg-[#007AFF] flex items-center justify-center text-white">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            {/* Subtitle: Assistente de inteligência artificial */}
            <p className="text-zinc-400 text-sm font-bold tracking-tight mb-5 sm:mb-6">
              Assistente de inteligência artificial
            </p>

            {/* The 4 Prompt Suggestion Pills with Responsive Grid on Desktop */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  id={`btn-suggestion-${index}`}
                  onClick={() => sendMessage(suggestion)}
                  className="w-full py-3.5 px-5 rounded-2xl sm:rounded-full bg-[#141518] hover:bg-[#1c1d22] active:bg-[#23262c] border border-white/10 text-left text-sm text-zinc-100 font-bold tracking-tight transition-all duration-200 shadow-xs hover:shadow-sm cursor-pointer flex items-center justify-between group active:scale-[0.98]"
                >
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Active Conversation Feed */
          <div ref={chatScrollContainerRef} className="py-4 space-y-4 flex-1 flex flex-col justify-start">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                const isCurrentlyTyping = animatingMessageId === msg.id;

                return (
                  <motion.div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`flex items-start gap-2.5 scroll-mt-20 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0 mt-0.5 shadow-sm">
                        <img src={GUIDE_AVATAR_URL} alt="Guia" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'max-w-[85%] sm:max-w-[75%] bg-[#007AFF] text-white font-black rounded-br-xs shadow-md'
                          : 'w-full max-w-[95%] sm:max-w-[85%] bg-[#141518] text-zinc-100 border border-white/10 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      ) : (
                        <div>
                          <TypewriterMessage
                            content={msg.text}
                            isAnimated={isCurrentlyTyping}
                            onComplete={() => setAnimatingMessageId(null)}
                            onScrollToTop={() => scrollToMessageTop(msg.id)}
                          />
                          {msg.groundingPlaces && msg.groundingPlaces.length > 0 && !isCurrentlyTyping && (
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3 pt-3 border-t border-white/10 space-y-2"
                            >
                              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#007AFF]">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>Locais verificados no Google Maps</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {msg.groundingPlaces.map((place, pIdx) => (
                                  <a
                                    key={pIdx}
                                    href={place.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-zinc-900/80 hover:bg-[#007AFF]/15 border border-white/10 hover:border-[#007AFF]/40 transition-all text-left group cursor-pointer"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-black text-white group-hover:text-[#007AFF] transition-colors">
                                          {place.title}
                                        </span>
                                      </div>
                                      {place.address && (
                                        <span className="text-[11px] text-zinc-400 block truncate mt-0.5">
                                          {place.address}
                                        </span>
                                      )}
                                      {place.reviewSnippet && (
                                        <p className="text-[11px] text-zinc-300 line-clamp-2 mt-1 italic">
                                          "{place.reviewSnippet}"
                                        </p>
                                      )}
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#007AFF] shrink-0 mt-0.5 transition-colors" />
                                  </a>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                      <div
                        className={`text-[10px] mt-2 text-right ${
                          isUser ? 'text-white/80' : 'text-zinc-400'
                        }`}
                      >
                        {msg.time}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 shrink-0 mt-0.5">
                  <img src={GUIDE_AVATAR_URL} alt="Assistente AI" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[#141518] border border-white/10 text-xs text-zinc-300 flex items-center gap-2 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007AFF]" />
                  <span>Preparando as melhores dicas de Campos do Jordão...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Input Bar */}
      <div
        className="px-4 sm:px-8 pt-2 max-w-3xl mx-auto w-full shrink-0 relative z-10"
        style={{
          paddingBottom: 'calc(max(16px, calc(env(safe-area-inset-bottom, 0px) + 6px)) + 80px)',
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center bg-[#141518]/95 backdrop-blur-xl border border-white/12 rounded-full px-4 py-2.5 shadow-2xl focus-within:border-[#007AFF]/50 transition-all"
        >
          {/* Input text */}
          <input
            ref={inputRef}
            id="input-ai-chat"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte algo..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none pr-2 font-medium"
          />

          {/* Microphone button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            id="btn-chat-mic"
            onClick={handleSpeechRecognition}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer mr-1 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-white/5 hover:bg-white/10 text-zinc-300'
            }`}
            title={isListening ? 'Ouvindo você...' : 'Falar por voz'}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <Mic className="w-4 h-4 stroke-[2.2]" />
            )}
          </motion.button>

          {/* Send arrow button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="submit"
            id="btn-chat-submit"
            disabled={!inputText.trim() || isLoading}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              inputText.trim() && !isLoading
                ? 'bg-[#007AFF] text-white hover:bg-blue-600 active:scale-95 shadow-sm'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4 stroke-[2.2]" />
          </motion.button>
        </form>
      </div>
    </div>
  );
};
