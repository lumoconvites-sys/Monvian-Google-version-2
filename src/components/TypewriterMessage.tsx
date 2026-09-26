import React, { useState, useEffect, useRef } from 'react';
import { AIMessageRenderer } from './AIMessageRenderer';
import { motion } from 'motion/react';
import { FastForward } from 'lucide-react';

interface TypewriterMessageProps {
  content: string;
  isAnimated?: boolean;
  onComplete?: () => void;
  onScrollToTop?: () => void;
}

export const TypewriterMessage: React.FC<TypewriterMessageProps> = ({
  content,
  isAnimated = false,
  onComplete,
  onScrollToTop,
}) => {
  // If animation is disabled or not requested, render static immediately
  if (!isAnimated) {
    return <AIMessageRenderer content={content} />;
  }

  const [displayedChars, setDisplayedChars] = useState<number>(() => Math.min(25, content.length));
  const [isTyping, setIsTyping] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrolledOnceRef = useRef<boolean>(false);

  // Scroll to top of message at start so user reads from the beginning
  useEffect(() => {
    if (!scrolledOnceRef.current) {
      scrolledOnceRef.current = true;
      if (onScrollToTop) {
        onScrollToTop();
      } else if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [onScrollToTop]);

  useEffect(() => {
    if (!isTyping) return;

    if (displayedChars >= content.length) {
      setIsTyping(false);
      if (onComplete) onComplete();
      return;
    }

    // Dynamic speed based on remaining content length for natural and pleasant reading
    const remaining = content.length - displayedChars;
    const step = remaining > 400 ? 5 : remaining > 200 ? 3 : remaining > 80 ? 2 : 1;
    const delay = remaining > 400 ? 12 : 18;

    const timer = setTimeout(() => {
      setDisplayedChars((prev) => {
        const next = prev + step;
        if (next >= content.length) {
          setIsTyping(false);
          if (onComplete) onComplete();
          return content.length;
        }
        return next;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [displayedChars, content, isTyping, onComplete]);

  const handleSkip = () => {
    setDisplayedChars(content.length);
    setIsTyping(false);
    if (onComplete) onComplete();
  };

  const currentContent = content.slice(0, displayedChars);

  return (
    <div ref={containerRef} className="relative select-text">
      <AIMessageRenderer content={currentContent} />

      {/* Typing Cursor & Skip Action */}
      {isTyping && (
        <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-zinc-100 dark:border-white/5">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
            <span className="inline-block w-1.5 h-3.5 bg-blue-600 rounded-xs animate-pulse" />
            <span className="text-[11px] animate-pulse text-blue-600 font-bold">Digitando...</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={handleSkip}
            className="text-[11px] font-bold text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10"
            title="Mostrar texto completo"
          >
            <FastForward className="w-3 h-3" />
            <span>Pular</span>
          </motion.button>
        </div>
      )}
    </div>
  );
};
