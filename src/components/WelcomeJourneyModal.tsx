import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface WelcomeJourneyModalProps {
  isOpen: boolean;
  onFinish: () => void;
  durationMs?: number;
}

/**
 * Monvian — Experiência de Boas-Vindas no Primeiro Acesso
 *
 * Exibido exclusivamente uma única vez quando um novo usuário conclui seu cadastro
 * e entra no aplicativo pela primeira vez.
 *
 * Características rigorosamente fiéis ao design system do iOS / Apple:
 * - Card branco puro com cantos amplamente arredondados (rounded-[38px])
 * - Fotografia superior de Campos do Jordão com fade gradual para o branco
 * - Tipografia SF Pro Display Bold + Regular
 * - Animação suave estilo Apple (700ms, scale 0.96 -> 1.0, fade-in vertical)
 * - Fechamento automático suave após ~3.8s ou ao tocar em qualquer ponto da tela
 * - Design minimalista sem botões intrusivos ou ícones de fechar
 */
export const WelcomeJourneyModal: React.FC<WelcomeJourneyModalProps> = ({
  isOpen,
  onFinish,
  durationMs = 3800,
}) => {
  const [isDismissing, setIsDismissing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDismiss = useCallback(() => {
    if (isDismissing) return;
    setIsDismissing(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Permite que a animação de saída de 450ms conclua antes de chamar onFinish
    setTimeout(() => {
      onFinish();
    }, 450);
  }, [isDismissing, onFinish]);

  useEffect(() => {
    if (!isOpen) {
      setIsDismissing(false);
      return;
    }

    // Auto-avanço elegante após o tempo determinado
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, durationMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, durationMs, handleDismiss]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {!isDismissing && (
        <motion.div
          key="monvian-welcome-journey-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[250] flex items-center justify-center p-5 bg-black/45 backdrop-blur-md select-none cursor-pointer"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          aria-modal="true"
          role="dialog"
          aria-label="Boas-vindas à sua jornada"
        >
          {/* Card Principal */}
          <motion.div
            key="monvian-welcome-journey-card"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1.0, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={(e) => {
              // Toque no próprio card também fecha suavemente
              e.stopPropagation();
              handleDismiss();
            }}
            className="relative w-[86%] max-w-[348px] sm:max-w-[368px] bg-white rounded-[38px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.22),0_12px_28px_-8px_rgba(0,0,0,0.12)] border border-black/[0.04] transition-transform active:scale-[0.99] duration-200"
          >
            {/* Fotografia Superior com Fade Gradual */}
            <div className="relative w-full h-[220px] sm:h-[240px] overflow-hidden bg-[#f3f4f6]">
              <img
                src="/assets/welcome_campos_photo.png"
                alt="Campos do Jordão"
                className="w-full h-full object-cover object-center select-none pointer-events-none"
                draggable={false}
              />
              {/* Fade gradual da fotografia para o fundo branco na base do card */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 42%, rgba(255,255,255,0.7) 78%, rgba(255,255,255,1) 100%)',
                }}
              />
            </div>

            {/* Conteúdo Textual com Tipografia SF Pro */}
            <div className="px-7 pt-2 pb-8 sm:px-8 sm:pt-3 sm:pb-9 bg-white">
              <h1 className="text-[28px] sm:text-[31px] font-bold text-black tracking-[-0.03em] leading-[1.12] text-left">
                Boas-vindas
                <br />
                à sua jornada
              </h1>

              <p className="mt-3 text-[15px] sm:text-[16px] text-[#555b66] font-normal leading-[1.38] tracking-[-0.01em] text-left">
                Descubra Campos do Jordão no seu ritmo.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
