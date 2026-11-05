import React, { useState, useEffect, useMemo } from 'react';
import { X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Itinerary } from '../../types';
import { DEFAULT_CURATED_ITINERARIES } from '../../data/defaultItineraries';
import { fetchItinerariesFromSupabase } from '../../services/supabaseItineraries';
import { triggerHapticFeedback } from '../../utils/haptics';

export const INVESTMENT_OPTIONS = [
  'R$ 300',
  'R$ 400',
  'R$ 500',
  'R$ 600',
  'R$ 700',
  'R$ 800',
  'R$ 900',
  'R$ 1.000',
  'R$ 1.100',
  'R$ 1.200',
  'R$ 1.300',
  'R$ 1.400',
  'R$ 1.500',
  'Prefiro não informar',
];

interface PostSignupOnboardingFlowProps {
  onComplete: (selectedItineraries: Itinerary[], chosenInvestment: string) => void;
}

export const PostSignupOnboardingFlow: React.FC<PostSignupOnboardingFlowProps> = ({
  onComplete,
}) => {
  const [step, setStep] = useState<'itineraries' | 'investment'>('itineraries');
  const [selectedItineraryIds, setSelectedItineraryIds] = useState<string[]>([]);
  const [isExitingInvestment, setIsExitingInvestment] = useState<boolean>(false);
  const [availableItineraries, setAvailableItineraries] = useState<Itinerary[]>(() => {
    try {
      const cached =
        localStorage.getItem('monvian_cached_itineraries') ||
        localStorage.getItem('monvian_itineraries_cache');
      if (cached) {
        const parsed: Itinerary[] = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, Itinerary>();
          for (const item of parsed) {
            if (item.isActive !== false) map.set(item.id, item);
          }
          for (const def of DEFAULT_CURATED_ITINERARIES) {
            if (def.isActive !== false && !map.has(def.id)) map.set(def.id, def);
          }
          return Array.from(map.values());
        }
      }
    } catch {}
    return DEFAULT_CURATED_ITINERARIES;
  });

  useEffect(() => {
    let mounted = true;
    fetchItinerariesFromSupabase()
      .then((fetched) => {
        if (!mounted || !Array.isArray(fetched) || fetched.length === 0) return;
        const map = new Map<string, Itinerary>();
        for (const item of fetched) {
          if (item.isActive !== false) map.set(item.id, item);
        }
        for (const def of DEFAULT_CURATED_ITINERARIES) {
          if (def.isActive !== false && !map.has(def.id)) map.set(def.id, def);
        }
        setAvailableItineraries(Array.from(map.values()));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleItinerary = (itinId: string) => {
    triggerHapticFeedback(12);
    setSelectedItineraryIds((prev) => {
      if (prev.includes(itinId)) {
        return prev.filter((id) => id !== itinId);
      }
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, itinId];
    });
  };

  const handleSelectInvestment = (option: string) => {
    triggerHapticFeedback(15);
    setIsExitingInvestment(true);

    try {
      localStorage.setItem('monvian_trip_budget', option);
    } catch {}

    const selectedItins = availableItineraries.filter((itin) =>
      selectedItineraryIds.includes(itin.id)
    );
    const finalItins = selectedItins.length > 0 ? selectedItins : [availableItineraries[0]];

    window.setTimeout(() => {
      onComplete(finalItins, option);
    }, 520);
  };

  return (
    <div
      id="post-signup-onboarding-container"
      className="fixed inset-0 z-50 w-full h-full bg-[#FFFFFF] text-[#111111] overflow-hidden select-none"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif",
        backgroundColor: '#FFFFFF',
      }}
    >
      <AnimatePresence mode="wait">
        {step === 'itineraries' ? (
          <motion.div
            key="onboarding-step-itineraries"
            initial={{ opacity: 0, filter: 'blur(8px)', y: 8 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            exit={{ opacity: 0, filter: 'blur(8px)', y: -8 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full overflow-y-auto overscroll-y-contain relative"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
          >
            <div
              className="w-full max-w-2xl mx-auto px-6"
              style={{
                paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 32px), 48px)',
                paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 96px), 112px)',
              }}
            >
              {/* Título centralizado no topo */}
              <motion.h1
                initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center text-[24px] sm:text-[28px] font-bold tracking-[-0.025em] text-[#111111] leading-tight mb-8"
              >
                Selecione o melhor roteiro
              </motion.h1>

              {/* Lista dos roteiros disponíveis */}
              <div className="flex flex-col gap-7">
                {availableItineraries.map((itin, idx) => {
                  const isSelected = selectedItineraryIds.includes(itin.id);

                  return (
                    <motion.div
                      key={itin.id}
                      onClick={() => handleToggleItinerary(itin.id)}
                      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{
                        duration: 0.55,
                        ease: [0.22, 1, 0.36, 1],
                        delay: Math.min(idx * 0.05, 0.35),
                      }}
                      whileTap={{ scale: 0.985 }}
                      className="group flex flex-col cursor-pointer select-none"
                    >
                      <div
                        className={`relative w-full h-[204px] sm:h-[228px] rounded-[34px] overflow-hidden bg-zinc-100 transition-all duration-300 ${
                          isSelected
                            ? 'ring-2 ring-black/70 shadow-md'
                            : 'border border-black/[0.06]'
                        }`}
                      >
                        <img
                          src={itin.coverImage}
                          alt={itin.title}
                          width={800}
                          height={456}
                          draggable={false}
                          loading={idx < 3 ? 'eager' : 'lazy'}
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
                          }}
                          className={`w-full h-full object-cover transition-transform duration-500 ease-out pointer-events-none select-none ${
                            isSelected ? 'scale-[1.015]' : 'group-hover:scale-[1.02]'
                          }`}
                        />

                        {/* Símbolo de deleção branco, minimalista e discreto sobre a imagem */}
                        {isSelected && (
                          <div
                            className="absolute top-3.5 right-3.5 w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-sm active:scale-90 transition-transform"
                            title="Desmarcar roteiro"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleItinerary(itin.id);
                            }}
                          >
                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4] text-white" />
                          </div>
                        )}
                      </div>

                      <div className="pt-3 px-1 flex items-center justify-between gap-3">
                        <h2 className="text-[16px] sm:text-[17px] font-semibold tracking-[-0.015em] text-[#111111] leading-snug truncate flex-1">
                          {itin.title}
                        </h2>
                        <div
                          className="flex items-center gap-1 shrink-0 text-[#111111]"
                          title={`${((5000 + (Math.abs((itin.id || itin.title).split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1) * 31, 0)) % 8001)) / 1000).toFixed(1).replace('.0', '')} mil visualizações`}
                        >
                          <Play className="w-3 h-3 fill-black text-black" />
                          <span className="text-[12px] font-semibold tracking-tight text-[#111111]">
                            {`${((5000 + (Math.abs((itin.id || itin.title).split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1) * 31, 0)) % 8001)) / 1000).toFixed(1).replace('.0', '')} mil`}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Botão "Continuar" - exibido apenas ao atingir o mínimo de 5 roteiros selecionados */}
            <AnimatePresence>
              {selectedItineraryIds.length >= 5 && (
                <motion.div
                  initial={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed bottom-0 inset-x-0 p-5 pb-[max(20px,calc(env(safe-area-inset-bottom,0px)+16px))] bg-gradient-to-t from-white via-white/95 to-transparent z-30 flex justify-center pointer-events-none"
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback(15);
                      setStep('investment');
                    }}
                    className="pointer-events-auto w-full max-w-sm h-14 rounded-full expo-liquid-glass-btn text-black font-bold text-[16px] tracking-tight shadow-lg flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                  >
                    <span>Continuar</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* 2. Tela de investimento */
          <motion.div
            key="onboarding-step-investment"
            initial={{ opacity: 0, filter: 'blur(8px)', y: 8 }}
            animate={
              isExitingInvestment
                ? { opacity: 0, scale: 0.94, filter: 'blur(16px)', y: -22 }
                : { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 }
            }
            exit={{ opacity: 0, scale: 0.94, filter: 'blur(16px)', y: -22 }}
            transition={{
              duration: isExitingInvestment ? 0.52 : 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="w-full h-full overflow-y-auto overscroll-y-contain relative"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
          >
            <div
              className="w-full max-w-md mx-auto px-6"
              style={{
                paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 36px), 52px)',
                paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 36px), 48px)',
              }}
            >
              {/* Pergunta centralizada */}
              <motion.h1
                initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="text-center text-[24px] sm:text-[28px] font-bold tracking-[-0.025em] text-[#111111] leading-tight mb-8"
              >
                Qual investimento para essa viagem?
              </motion.h1>

              {/* Opções de investimento: R$ 300 a R$ 1.500 (intervalos de R$ 100) + Prefiro não informar */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {INVESTMENT_OPTIONS.slice(0, 13).map((opt, idx) => (
                  <motion.button
                    key={opt}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSelectInvestment(opt)}
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.08 + idx * 0.025,
                    }}
                    className="w-full h-13 sm:h-14 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-black/[0.08] text-[#111111] font-semibold text-[15px] sm:text-[16px] flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  >
                    {opt}
                  </motion.button>
                ))}

                {/* Opção "Prefiro não informar" em largura total */}
                <motion.button
                  key="prefiro-nao-informar"
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelectInvestment('Prefiro não informar')}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.42,
                  }}
                  className="col-span-2 w-full h-13 sm:h-14 rounded-2xl bg-zinc-100/70 hover:bg-zinc-100 border border-black/[0.06] text-zinc-600 font-medium text-[14.5px] sm:text-[15px] flex items-center justify-center transition-all cursor-pointer mt-1"
                >
                  Prefiro não informar
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
