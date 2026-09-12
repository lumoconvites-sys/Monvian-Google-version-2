import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Mic, MicOff, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import { AIChatMessage } from '../types';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpotByName?: (spotName: string) => void;
}

const DEFAULT_SUGGESTIONS = [
  'Monte um roteiro romântico de 2 dias',
  'Quais os melhores cafés em Capivari?',
  'Sugira passeios para família com crianças',
  'Onde jantar bem por até R$ 150 por pessoa?',
];

const GUIDE_AVATAR_URL = '/guide_avatar.jpg';

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor');
      }

      const data = await response.json();
      const replyText = data.reply || 'Campos do Jordão tem opções maravilhosas para isso!';

      const assistantMessage: AIChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao consultar IA Guia:', error);

      // Graceful instant fallback
      let fallbackText = 'Campos do Jordão conta com opções encantadoras para você! ';
      if (query.toLowerCase().includes('romântico')) {
        fallbackText = 'Para um momento romântico a dois, recomendo um passeio no pôr do sol no Pico do Itapeva com vista das montanhas, seguido por uma sequência de fondue artesanal à luz de velas na charmosa Vila Capivari!';
      } else if (query.toLowerCase().includes('café')) {
        fallbackText = 'Em Capivari, não deixe de provar o chocolate quente cremoso da Chocolate Araucária e as tortas artesanais do Café Sans Souci!';
      } else if (query.toLowerCase().includes('família') || query.toLowerCase().includes('criança')) {
        fallbackText = 'Para famílias com crianças, o Tarundu é a melhor escolha com mais de 25 atrações ao ar livre, além do Parque da Lagoinha e do teleférico do Morro do Elefante!';
      } else {
        fallbackText = 'Adorei sua dúvida! Para explorar o melhor de Campos do Jordão, recomendo mesclar a agitação gastronômica da Vila Capivari com a natureza deslumbrante do Amantikir e do Horto Florestal.';
      }

      const fallbackMsg: AIChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
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
      className="fixed inset-0 z-45 bg-black text-white flex flex-col justify-between overflow-hidden animate-in fade-in duration-300"
      style={{
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Header Bar */}
      <div className="relative pt-6 sm:pt-8 px-6 pb-2 flex items-center justify-between z-10 shrink-0">
        <div className="w-10">
          {messages.length > 0 && (
            <button
              id="btn-chat-reset"
              onClick={handleReset}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
              title="Nova conversa"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Center: When in active chat, show mini avatar and Chat title */}
        {messages.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
              <img src={GUIDE_AVATAR_URL} alt="Guia" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white">Chat</span>
              <CheckCircle2 className="w-4 h-4 text-[#00ff88] fill-[#00ff88]/20" />
            </div>
          </div>
        )}

        {/* Top Right: Close (X) button identical to screenshot */}
        <button
          id="btn-close-ai-chat"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
          title="Fechar chat"
        >
          <X className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 flex flex-col justify-center max-w-md mx-auto w-full">
        {messages.length === 0 ? (
          /* Initial Screen matching exact screenshot layout */
          <div className="flex flex-col items-center text-center animate-in fade-in duration-300 my-auto pb-4">
            {/* 3D Guide Avatar Portrait */}
            <div className="relative mb-3">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-white/15 shadow-2xl bg-zinc-900 mx-auto ring-4 ring-white/5">
                <img
                  src={GUIDE_AVATAR_URL}
                  alt="Sua guia em Campos do Jordão"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Chat Title with Verified Checkmark */}
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <h1 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight">
                Chat
              </h1>
              {/* Verified Badge Circle identical to screenshot */}
              <div className="w-5 h-5 rounded-full bg-[#00ff88] flex items-center justify-center text-black">
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

            {/* Subtitle: Sua guia em Campos do Jordão */}
            <p className="text-zinc-400 text-sm font-normal tracking-tight mb-8 sm:mb-10">
              Sua guia em Campos do Jordão
            </p>

            {/* The 4 Prompt Suggestion Pills from screenshot */}
            <div className="w-full flex flex-col gap-2.5">
              {DEFAULT_SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={index}
                  id={`btn-suggestion-${index}`}
                  onClick={() => sendMessage(suggestion)}
                  className="w-full py-3.5 px-5 rounded-full bg-[#121316]/95 hover:bg-[#1b1c21] active:scale-[0.98] border border-white/10 hover:border-white/20 text-left text-sm text-zinc-200 tracking-tight transition-all shadow-md cursor-pointer flex items-center justify-between group"
                >
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Active Conversation Feed */
          <div className="py-4 space-y-4 flex-1 flex flex-col justify-start">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 shrink-0 mt-0.5">
                      <img src={GUIDE_AVATAR_URL} alt="Guia" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div
                    className={`max-w-[84%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#00ff88] text-black font-medium rounded-br-xs shadow-md'
                        : 'bg-[#15161a] text-zinc-100 border border-white/10 rounded-tl-xs shadow-lg'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    <div
                      className={`text-[10px] mt-1 text-right ${
                        isUser ? 'text-black/60' : 'text-zinc-500'
                      }`}
                    >
                      {msg.time}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2.5 animate-in fade-in">
                <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 shrink-0 mt-0.5">
                  <img src={GUIDE_AVATAR_URL} alt="Guia" className="w-full h-full object-cover" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[#15161a] border border-white/10 text-xs text-zinc-400 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00ff88]" />
                  <span>Preparando as melhores dicas de Campos do Jordão...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Input Bar identical to screenshot */}
      <div className="px-4 sm:px-6 pb-24 sm:pb-28 pt-2 max-w-md mx-auto w-full shrink-0">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center bg-[#131417] border border-white/10 rounded-full px-4 py-2.5 shadow-2xl focus-within:border-white/25 transition-all"
        >
          {/* Input text */}
          <input
            ref={inputRef}
            id="input-ai-chat"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte algo..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none pr-2"
          />

          {/* Microphone button identical to screenshot (green microphone) */}
          <button
            type="button"
            id="btn-chat-mic"
            onClick={handleSpeechRecognition}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer mr-1 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-white/5 hover:bg-white/10 text-[#00ff88]'
            }`}
            title={isListening ? 'Ouvindo você...' : 'Falar por voz'}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <Mic className="w-4 h-4 stroke-[2.2]" />
            )}
          </button>

          {/* Send arrow button identical to screenshot */}
          <button
            type="submit"
            id="btn-chat-submit"
            disabled={!inputText.trim() || isLoading}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              inputText.trim() && !isLoading
                ? 'text-[#00ff88] hover:scale-105 active:scale-95'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4 stroke-[2]" />
          </button>
        </form>
      </div>
    </div>
  );
};
