import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Wallet } from 'lucide-react';

interface BudgetStepProps {
  initialBudget?: string;
  onContinue: (budget: string) => void;
  onBack: () => void;
  theme?: 'dark' | 'light';
}

const BUDGET_OPTIONS = [
  { id: '0-300', label: 'R$ 0 — R$ 300', detail: 'Passeios ao ar livre e atrações gratuitas' },
  { id: '300-600', label: 'R$ 300 — R$ 600', detail: 'Equilíbrio entre parques e bistrôs' },
  { id: '600-1000', label: 'R$ 600 — R$ 1.000', detail: 'Gastronomia, ingressos e degustações' },
  { id: '1000+', label: 'R$ 1.000+', detail: 'Experiência premium sem restrições' },
  { id: 'none', label: 'Prefiro não informar', detail: 'Explorar todas as opções de Campos do Jordão' }
];

export const BudgetStep: React.FC<BudgetStepProps> = ({
  initialBudget = '300-600',
  onContinue,
  onBack,
  theme = 'light'
}) => {
  const isDark = theme === 'dark';
  const [selectedBudget, setSelectedBudget] = useState<string>(initialBudget);

  const handleContinue = () => {
    const selectedOption = BUDGET_OPTIONS.find(o => o.id === selectedBudget) || BUDGET_OPTIONS[1];
    onContinue(selectedOption.label);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md mx-auto flex flex-col items-center my-auto px-2 sm:px-4 py-2 sm:py-4"
    >
      {/* Header Titles */}
      <div className="text-center mb-4 sm:mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-snug">
          Quanto você pretende gastar?
        </h1>
        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 mt-1 sm:mt-2 font-bold">
          Isso ajuda a encontrar lugares que combinam com sua viagem.
        </p>
      </div>

      {/* Budget Options List */}
      <div className="w-full space-y-3">
        {BUDGET_OPTIONS.map((opt) => {
          const isSelected = selectedBudget === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedBudget(opt.id)}
              className={`w-full p-4 sm:p-4.5 rounded-[24px] flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer border backdrop-blur-xl ${
                isSelected
                  ? isDark
                    ? 'bg-[#141b28]/85 border-2 border-blue-500 text-white shadow-[0_4px_25px_rgba(37,99,235,0.25)]'
                    : 'bg-blue-50/90 border-2 border-blue-600 text-zinc-900 shadow-sm'
                  : isDark
                  ? 'bg-[#18181b]/80 hover:bg-[#202024]/90 border-white/10 hover:border-white/20 text-zinc-200'
                  : 'bg-white/80 hover:bg-white/95 border-black/8 text-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.03)]'
              }`}
            >
              <div className="flex items-center gap-3.5 pr-3">
                <div
                  className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
                      : isDark
                      ? 'bg-zinc-800/80 text-zinc-400'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[16px] sm:text-[17px] font-black block leading-tight tracking-tight">
                    {opt.label}
                  </span>
                  <span className="text-xs sm:text-[13px] font-bold text-zinc-400 dark:text-zinc-400 mt-1 block">
                    {opt.detail}
                  </span>
                </div>
              </div>

              {/* Radio checkmark */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30'
                    : isDark
                    ? 'border-2 border-zinc-700'
                    : 'border-2 border-zinc-300'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Button: [Continuar] */}
      <div className="w-full mt-5">
        <button
          id="btn-itinerary-budget-continue"
          type="button"
          onClick={handleContinue}
          className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-black text-base transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          Continuar
        </button>
      </div>
    </motion.div>
  );
};
