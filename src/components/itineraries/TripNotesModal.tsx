import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Mic, Check } from 'lucide-react';

interface TripNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripNoteText: string;
  onSave: (text: string) => void;
  theme?: 'dark' | 'light';
}

export const TripNotesModal: React.FC<TripNotesModalProps> = ({
  isOpen,
  onClose,
  tripNoteText,
  onSave,
}) => {
  const [noteContent, setNoteContent] = useState(tripNoteText);
  const [isListening, setIsListening] = useState(false);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync internal state when opened or tripNoteText changes
  useEffect(() => {
    setNoteContent(tripNoteText);
  }, [tripNoteText, isOpen]);

  // Helper to ensure text never exceeds vertical space of the paper sheet
  const checkAndFitText = (candidate: string, previous: string): string => {
    const el = textareaRef.current;
    if (!el) return candidate;

    // If deleting, always allow
    if (candidate.length < previous.length) {
      el.value = candidate;
      return candidate;
    }

    // Temporarily test candidate
    el.value = candidate;
    if (el.scrollHeight <= el.clientHeight) {
      return candidate;
    }

    // Binary search for max characters that fit within clientHeight
    let low = previous.length;
    let high = candidate.length;
    let best = previous;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const sub = candidate.slice(0, mid);
      el.value = sub;
      if (el.scrollHeight <= el.clientHeight) {
        best = sub;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    el.value = best;
    return best;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const fitted = checkAndFitText(val, noteContent);
    setNoteContent(fitted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const el = textareaRef.current;
      if (el) {
        const testCandidate = el.value + '\n';
        el.value = testCandidate;
        const overflows = el.scrollHeight > el.clientHeight;
        el.value = noteContent;
        if (overflows) {
          e.preventDefault();
        }
      }
    }
  };

  // Voice dictation handling with vertical height boundary protection
  const handleToggleDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Ditado por voz não é suportado neste navegador.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setNoteContent((prev) => {
            const combined = prev ? `${prev} ${transcript}` : transcript;
            return checkAndFitText(combined, prev);
          });
        }
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const handleSave = () => {
    onSave(noteContent);
    setIsSavedToast(true);
    setTimeout(() => {
      setIsSavedToast(false);
    }, 2200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto select-none">
      {/* 1. Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      {/* 2. Main Modal: The Parchment Sheet itself, without transparent side cards */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="relative w-full max-w-[430px] sm:max-w-md md:max-w-lg h-[86vh] max-h-[740px] min-h-[500px] z-10 flex flex-col justify-between select-none"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* VINTAGE PARCHMENT SHEET (No side glass card, pure travel diary sheet) */}
        <div
          className="relative flex-1 w-full rounded-[26px] overflow-hidden transition-all flex flex-col border border-[#CDB89E]"
          style={{
            background: 'linear-gradient(176deg, #FAF4E7 0%, #F5ECDB 40%, #EFE3CE 85%, #EADBBE 100%)',
            boxShadow:
              '0 25px 60px -10px rgba(0, 0, 0, 0.85), inset 0 0 35px rgba(180, 145, 95, 0.18), inset 0 1px 2px rgba(255, 255, 255, 0.85), inset 0 -2px 6px rgba(140, 105, 65, 0.18)',
          }}
        >
          {/* Subtle real texture layer blended softly */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 mix-blend-multiply"
            style={{
              backgroundImage: 'url(/clean_parchment.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Close Button X (Apenas o 'x' sem a bolinha/círculo em volta) */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1 text-[#3A2A1A] hover:text-[#150E07] hover:opacity-70 active:scale-90 transition-all cursor-pointer z-30"
            title="Fechar"
            aria-label="Fechar anotações"
          >
            <X className="w-5 h-5 stroke-[2.4]" />
          </button>

          {/* Top Paper Header: Strong Tree Circle Drawing + "Viagem para Campos do Jordão" + "A Suíça Brasileira" */}
          <div className="relative pt-4 sm:pt-5 pb-3 px-5 sm:px-6 text-center select-none border-b border-[#DBC9B1]/75 z-10 flex flex-col items-center">
            {/* Medallion: Araucaria Tree in Circle with Mountains and Flourish Wings (Strengthened contrast) */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-1">
              {/* Left flourish wing */}
              <svg className="w-10 sm:w-14 h-4 text-[#664F34] opacity-85 shrink-0" viewBox="0 0 70 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M70 10 C50 10, 40 4, 30 5 C20 6, 12 16, 5 12 C2 10, 5 6, 9 7 C13 8, 11 14, 6 13" />
                <path d="M55 10 C45 13, 35 15, 25 12" />
              </svg>

              {/* Center Medallion: Araucaria tree inside double circle */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-[#4A351E] p-1 bg-[#F5ECE0] shadow-xs flex items-center justify-center shrink-0 text-[#3A2A1A]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 sm:w-9 sm:h-9">
                  {/* Mountain peaks in background */}
                  <path d="M3 19L8.5 11.5L13 16.5L16.5 13L21 19H3Z" fill="rgba(110, 80, 45, 0.22)" strokeWidth="1.2" />
                  {/* Araucaria tree trunk */}
                  <path d="M12 20V6" strokeWidth="2.2" />
                  {/* Characteristic Araucaria curved tier branches */}
                  <path d="M12 7C9.5 4.5 5.5 5.5 4 8.5C6.5 8.5 8.5 7.5 12 10" />
                  <path d="M12 7C14.5 4.5 18.5 5.5 20 8.5C17.5 8.5 15.5 7.5 12 10" />
                  <path d="M12 11C9 9 6 10.5 4.5 13.5C7 13.5 9.5 12.5 12 14" />
                  <path d="M12 11C15 9 18 10.5 19.5 13.5C17 13.5 14.5 12.5 12 14" />
                  <path d="M12 14.5C10 13 7.5 14.5 6 16.5C8 16.5 10 16 12 16.5" />
                  <path d="M12 14.5C14 13 16.5 14.5 18 16.5C16 16.5 14 16 12 16.5" />
                </svg>
              </div>

              {/* Right flourish wing */}
              <svg className="w-10 sm:w-14 h-4 text-[#664F34] opacity-85 shrink-0 transform scale-x-[-1]" viewBox="0 0 70 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M70 10 C50 10, 40 4, 30 5 C20 6, 12 16, 5 12 C2 10, 5 6, 9 7 C13 8, 11 14, 6 13" />
                <path d="M55 10 C45 13, 35 15, 25 12" />
              </svg>
            </div>

            {/* Subtitle: "A Suíça Brasileira" */}
            <p
              className="text-[19px] sm:text-[21px] font-bold text-[#5E4730] mt-0.5 leading-none"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              A Suíça Brasileira
            </p>
          </div>

          {/* Writing Area */}
          <div className="relative flex-1 w-full p-4 sm:p-5 pt-3 flex flex-col overflow-hidden">
            {/* Subtle left margin guide rule */}
            <div className="absolute top-3 bottom-3 left-4 sm:left-5 w-px bg-amber-800/12 pointer-events-none" />

            <textarea
              ref={textareaRef}
              value={noteContent}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Escreva uma anotação sobre sua viagem..."
              className="w-full flex-1 bg-transparent text-[#261C14] placeholder:text-[#8C7A68] font-semibold outline-none z-10 relative pl-3 sm:pl-4 selection:bg-[#DECDB2] selection:text-[#1F1A15] border-none"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '22px',
                lineHeight: '34px',
                letterSpacing: '0.01em',
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0px, transparent 33px, rgba(165, 135, 95, 0.22) 33px, rgba(165, 135, 95, 0.22) 34px)',
                backgroundAttachment: 'local',
                paddingTop: '4px',
                overflow: 'hidden',
                resize: 'none',
              }}
            />

            {/* Voice Dictation Microphone Button (Discreet, modern, inside the sheet at bottom right) */}
            <button
              type="button"
              onClick={handleToggleDictation}
              className={`absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm z-20 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400/40'
                  : 'bg-[#E5D7C0] hover:bg-[#DBCBB1] active:scale-95 text-[#4D3F30] border border-[#CBB99E]/90'
              }`}
              title={isListening ? 'Ouvindo... toque para parar' : 'Ditar por voz'}
            >
              <Mic className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Bottom Actions Row: Status & Save Button directly underneath the sheet */}
        <div className="flex items-center justify-between px-2 pt-2.5 shrink-0">
          {/* Status Message */}
          <div className="text-xs font-semibold text-zinc-300 drop-shadow-sm">
            {isSavedToast ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 transition-all">
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Salvo com sucesso</span>
              </span>
            ) : (
              <span>Sua anotação é salva localmente</span>
            )}
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 active:scale-95 text-xs sm:text-sm font-bold tracking-tight transition-all shadow-xl cursor-pointer flex items-center gap-1.5 border border-white/90"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Salvar</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
