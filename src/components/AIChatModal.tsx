import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Mic, MicOff, CheckCircle2, RotateCcw, Loader2, MapPin, ExternalLink, Sparkles } from 'lucide-react';
import { AIChatMessage, MapsGroundingPlace } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TypewriterMessage } from './TypewriterMessage';

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

const GUIDE_AVATAR_URL = '/capybara_avatar.jpg';

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  onSelectSpotByName,
  userCoords,
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      className="absolute inset-0 z-45 bg-zinc-50 dark:bg-[#111315] text-zinc-900 dark:text-white flex flex-col justify-between overflow-hidden"
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
              className="w-10 h-10 rounded-full bg-zinc-200/80 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Nova conversa"
            >
              <RotateCcw className="w-4 h-4" />
            </motion.button>
          )}
        </div>

        {/* Center: Always strictly centered avatar, Chat title and verified badge */}
        {messages.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-white/20 shadow-xs">
              <img src={GUIDE_AVATAR_URL} alt="Guia" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black tracking-tight text-zinc-900 dark:text-white">Chat</span>
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
          </motion.div>
        )}

        {/* Right placeholder to balance flex container if needed */}
        <div className="w-10" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 flex flex-col justify-center max-w-md mx-auto w-full">
        {messages.length === 0 ? (
          /* Initial Screen matching exact screenshot layout */
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="flex flex-col items-center text-center my-auto pb-4"
          >
            {/* 3D Guide Avatar Portrait */}
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 450, damping: 20 }}
              className="relative mb-3"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-white/15 shadow-2xl bg-zinc-100 dark:bg-zinc-900 mx-auto ring-4 ring-zinc-50 dark:ring-white/5">
                <img
                  src={GUIDE_AVATAR_URL}
                  alt="Capivara Guia Turística"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Chat Title with Verified Checkmark */}
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <h1 className="text-2xl sm:text-[26px] font-black text-zinc-900 dark:text-white tracking-tight">
                Chat
              </h1>
              {/* Verified Badge Circle identical to screenshot */}
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
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-black tracking-tight mb-5 sm:mb-6">
              Assistente de inteligência artificial
            </p>

            {/* The 4 Prompt Suggestion Pills from screenshot */}
            <div className="w-full flex flex-col gap-2.5">
              {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
                <motion.button
                  key={index}
                  id={`btn-suggestion-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 500, damping: 30 }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => sendMessage(suggestion)}
                  className="w-full py-3.5 px-5 rounded-full bg-white dark:bg-[#121316]/95 hover:bg-zinc-50 dark:hover:bg-[#1b1c21] border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 text-left text-sm text-zinc-700 dark:text-zinc-200 tracking-tight transition-colors shadow-sm dark:shadow-md cursor-pointer flex items-center justify-between group"
                >
                  <span>{suggestion}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
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
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-white/20 shrink-0 mt-0.5 shadow-sm">
                        <img src={GUIDE_AVATAR_URL} alt="Guia" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'max-w-[85%] bg-[#00C896] text-white font-black rounded-br-xs shadow-md'
                          : 'w-full max-w-[95%] sm:max-w-[92%] bg-white dark:bg-[#15161a] text-zinc-900 dark:text-zinc-100 border border-zinc-200/90 dark:border-white/10 rounded-tl-xs shadow-sm dark:shadow-lg'
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
                              className="mt-3 pt-3 border-t border-zinc-200/70 dark:border-white/10 space-y-2"
                            >
                              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#00C896] dark:text-[#00C896]">
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
                                    className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-white/5 hover:bg-[#00C896]/10 dark:hover:bg-[#00C896]/15 border border-zinc-200/80 dark:border-white/10 hover:border-[#00C896]/40 transition-all text-left group cursor-pointer"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-black text-zinc-900 dark:text-white group-hover:text-[#00C896] transition-colors">
                                          {place.title}
                                        </span>
                                      </div>
                                      {place.address && (
                                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                                          {place.address}
                                        </span>
                                      )}
                                      {place.reviewSnippet && (
                                        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2 mt-1 italic">
                                          "{place.reviewSnippet}"
                                        </p>
                                      )}
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#00C896] shrink-0 mt-0.5 transition-colors" />
                                  </a>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                      <div
                        className={`text-[10px] mt-2 text-right ${
                          isUser ? 'text-white/80' : 'text-zinc-400 dark:text-zinc-500'
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
                <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-200 dark:border-white/20 shrink-0 mt-0.5">
                  <img src={GUIDE_AVATAR_URL} alt="Guia" className="w-full h-full object-cover" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-[#15161a] border border-zinc-200 dark:border-white/10 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00C896]" />
                  <span>Preparando as melhores dicas de Campos do Jordão...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Input Bar identical to screenshot */}
      <div
        className="px-4 sm:px-6 pt-2 max-w-md mx-auto w-full shrink-0"
        style={{
          paddingBottom: 'calc(max(16px, calc(env(safe-area-inset-bottom, 0px) + 6px)) + 80px)',
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center bg-white dark:bg-[#131417] border border-zinc-200 dark:border-white/10 rounded-full px-4 py-2.5 shadow-xl dark:shadow-2xl focus-within:border-zinc-300 dark:focus-within:border-white/25 transition-all"
        >
          {/* Input text */}
          <input
            ref={inputRef}
            id="input-ai-chat"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte algo..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none pr-2"
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
                : 'bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-[#00C896]'
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
                ? 'text-[#00C896] hover:scale-105'
                : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
            }`}
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4 stroke-[2]" />
          </motion.button>
        </form>
      </div>
    </div>
  );
};
