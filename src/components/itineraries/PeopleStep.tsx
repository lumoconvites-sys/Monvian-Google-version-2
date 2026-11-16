import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, Users, Baby } from 'lucide-react';

interface PeopleStepProps {
  initialAdults?: number;
  initialChildren?: number;
  initialCount?: number;
  onContinue: (adults: number, children: number, total: number) => void;
  onBack: () => void;
  theme?: 'dark' | 'light';
}

export const PeopleStep: React.FC<PeopleStepProps> = ({
  initialAdults = 2,
  initialChildren = 0,
  initialCount,
  onContinue,
  onBack,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  
  // Calculate initial state
  const defaultAdults = initialCount !== undefined ? Math.max(1, initialCount) : initialAdults;
  const [adultsCount, setAdultsCount] = useState<number>(defaultAdults);
  const [childrenCount, setChildrenCount] = useState<number>(initialChildren);

  const totalPeople = adultsCount + childrenCount;

  const handleDecreaseAdults = () => {
    if (adultsCount > 1) {
      setAdultsCount((prev) => prev - 1);
    }
  };

  const handleIncreaseAdults = () => {
    if (adultsCount < 16) {
      setAdultsCount((prev) => prev + 1);
    }
  };

  const handleDecreaseChildren = () => {
    if (childrenCount > 0) {
      setChildrenCount((prev) => prev - 1);
    }
  };

  const handleIncreaseChildren = () => {
    if (childrenCount < 12) {
      setChildrenCount((prev) => prev + 1);
    }
  };

  const handleContinue = () => {
    onContinue(adultsCount, childrenCount, totalPeople);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md mx-auto flex flex-col items-center my-auto px-2 sm:px-4 py-2"
    >
      {/* Title */}
      <div className="text-center mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-snug">
          Quantas pessoas vão?
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          Ajuste o número de viajantes para esta viagem.
        </p>
      </div>

      <div className="w-full space-y-3.5">
        {/* Card 1: Adultos */}
        <div
          className={`w-full p-5 sm:p-6 rounded-[26px] flex flex-col items-center justify-center transition-all duration-200 ${
            isDark
              ? 'bg-[#1C1C1E] backdrop-blur-2xl border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.5)]'
              : 'bg-white/95 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isDark ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-900'
              }`}>
                <Users className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-400">
                  Adultos
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-500 font-medium">
                  A partir de 13 anos
                </span>
              </div>
            </div>

            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              {adultsCount === 1 ? '1 adulto' : `${adultsCount} adultos`}
            </span>
          </div>

          {/* Stepper Adults */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 w-full py-1">
            <button
              type="button"
              onClick={handleDecreaseAdults}
              disabled={adultsCount <= 1}
              className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center transition-all ${
                adultsCount <= 1
                  ? 'opacity-25 cursor-not-allowed border border-transparent bg-zinc-800/40 text-zinc-600'
                  : isDark
                  ? 'bg-[#27272a] hover:bg-[#323236] text-white border border-white/10 active:scale-95 cursor-pointer shadow-md'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-black/5 active:scale-95 cursor-pointer shadow-sm'
              }`}
              title="Diminuir adultos"
            >
              <Minus className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="min-w-[70px] text-center">
              <span className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tabular-nums tracking-tight">
                {adultsCount}
              </span>
            </div>

            <button
              type="button"
              onClick={handleIncreaseAdults}
              disabled={adultsCount >= 16}
              className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center transition-all ${
                adultsCount >= 16
                  ? 'opacity-25 cursor-not-allowed border border-transparent bg-zinc-800/40 text-zinc-600'
                  : isDark
                  ? 'bg-[#27272a] hover:bg-[#323236] text-white border border-white/10 active:scale-95 cursor-pointer shadow-md'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-black/5 active:scale-95 cursor-pointer shadow-sm'
              }`}
              title="Aumentar adultos"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Card 2: Crianças */}
        <div
          className={`w-full p-5 sm:p-6 rounded-[26px] flex flex-col items-center justify-center transition-all duration-200 ${
            isDark
              ? 'bg-[#1C1C1E] backdrop-blur-2xl border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.5)]'
              : 'bg-white/95 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(0,0,0,0.06)]'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Baby className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-400">
                  Crianças
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-500 font-medium">
                  Até 12 anos
                </span>
              </div>
            </div>

            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              {childrenCount === 0
                ? 'Nenhuma criança'
                : childrenCount === 1
                ? '1 criança'
                : `${childrenCount} crianças`}
            </span>
          </div>

          {/* Stepper Children */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 w-full py-1">
            <button
              type="button"
              onClick={handleDecreaseChildren}
              disabled={childrenCount <= 0}
              className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center transition-all ${
                childrenCount <= 0
                  ? 'opacity-25 cursor-not-allowed border border-transparent bg-zinc-800/40 text-zinc-600'
                  : isDark
                  ? 'bg-[#27272a] hover:bg-[#323236] text-white border border-white/10 active:scale-95 cursor-pointer shadow-md'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-black/5 active:scale-95 cursor-pointer shadow-sm'
              }`}
              title="Diminuir crianças"
            >
              <Minus className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="min-w-[70px] text-center">
              <span className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tabular-nums tracking-tight">
                {childrenCount}
              </span>
            </div>

            <button
              type="button"
              onClick={handleIncreaseChildren}
              disabled={childrenCount >= 12}
              className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center transition-all ${
                childrenCount >= 12
                  ? 'opacity-25 cursor-not-allowed border border-transparent bg-zinc-800/40 text-zinc-600'
                  : isDark
                  ? 'bg-[#27272a] hover:bg-[#323236] text-white border border-white/10 active:scale-95 cursor-pointer shadow-md'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-black/5 active:scale-95 cursor-pointer shadow-sm'
              }`}
              title="Aumentar crianças"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Dynamic Summary */}
        <div className="text-center pt-1">
          <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            Total:{' '}
            <strong className="text-zinc-800 dark:text-zinc-200">
              {totalPeople} {totalPeople === 1 ? 'viajante' : 'viajantes'}
            </strong>{' '}
            ({adultsCount} {adultsCount === 1 ? 'adulto' : 'adultos'}
            {childrenCount > 0 ? `, ${childrenCount} ${childrenCount === 1 ? 'criança' : 'crianças'}` : ''})
          </span>
        </div>
      </div>

      {/* Button: [Continuar] */}
      <div className="w-full mt-6">
        <button
          id="btn-itinerary-people-continue"
          type="button"
          onClick={handleContinue}
          className="w-full py-4 px-6 rounded-full expo-liquid-glass-btn text-black dark:text-white border border-black/5 active:scale-95 font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-zinc-50"
        >
          Continuar
        </button>
      </div>
    </motion.div>
  );
};
