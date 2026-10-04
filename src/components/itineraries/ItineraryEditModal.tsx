import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, ArrowDown, X, Check, AlertTriangle, Plus, Clock } from 'lucide-react';
import { Itinerary, ItineraryStep, Spot } from '../../types';

interface ItineraryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: Itinerary;
  onSave: (updatedItinerary: Itinerary) => void;
  onDeleteItinerary: () => void;
  onCreateNewItinerary: () => void;
  theme?: 'dark' | 'light';
  isPremium?: boolean;
}

export const ItineraryEditModal: React.FC<ItineraryEditModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  onSave,
  onDeleteItinerary,
  onCreateNewItinerary,
  theme = 'light',
  isPremium
}) => {
  const isDark = theme === 'dark';

  const isGoldUser = isPremium !== undefined ? isPremium : Boolean(
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

  // Local editable steps of the first day (or current active day)
  const [steps, setSteps] = useState<ItineraryStep[]>(() => {
    return itinerary.days[0]?.steps || [];
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setSteps(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= steps.length - 1) return;
    setSteps(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    });
  };

  const handleRemoveStep = (id: string) => {
    if (steps.length <= 1) {
      alert('O roteiro precisa ter pelo menos 1 ponto.');
      return;
    }
    setSteps(prev => {
      const filtered = prev.filter(s => s.id !== id);
      return filtered.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    });
  };

  const handleSave = () => {
    const reindexedSteps = steps.map((s, idx) => ({ ...s, stepOrder: idx + 1 }));
    const updatedItinerary: Itinerary = {
      ...itinerary,
      days: [
        {
          ...itinerary.days[0],
          steps: reindexedSteps
        },
        ...itinerary.days.slice(1)
      ]
    };
    onSave(updatedItinerary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: 'spring', damping: 26, stiffness: 340 }}
        className={`w-full max-w-md rounded-[32px] p-6 max-h-[85vh] flex flex-col ${
          isDark
            ? 'ios-glass text-white shadow-[0_25px_70px_rgba(0,0,0,0.9)] border border-white/12'
            : 'ios-glass-white text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-white/80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200/80 dark:border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
              Editar Roteiro
            </h2>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
              Reorganize a ordem dos pontos ou remova locais.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 my-1 pr-0.5 scrollbar-none">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`p-3 sm:p-3.5 rounded-[22px] flex items-center justify-between gap-3 transition-colors ${
                isDark
                  ? 'bg-zinc-800/60 border border-white/6 hover:border-white/15'
                  : 'ios-glass-btn-white hover:bg-white/90 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative shrink-0 flex items-center justify-center">
                  <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 shadow-sm ${
                    isGoldUser
                      ? 'bg-metallic-gold text-[#1A1202] shadow-[#E5AC33]/40 border border-[#FFF4A3]/60'
                      : 'bg-blue-600 text-white shadow-blue-600/30'
                  }`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-[13px] sm:text-sm font-black truncate uppercase text-zinc-900 dark:text-white">
                      {step.spot?.name || `Ponto ${idx + 1}`}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold mt-0.5">
                    <Clock className={`w-3 h-3 shrink-0 ${isGoldUser ? 'text-[#F5BE38]' : 'text-blue-500'}`} />
                    <span>{step.suggestedTime || '09:30'}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons: Up, Down, Remove */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                    idx === 0
                      ? 'opacity-20 cursor-not-allowed'
                      : isDark
                      ? 'hover:bg-white/10 active:scale-95 text-zinc-300'
                      : 'hover:bg-zinc-200 active:scale-95 text-zinc-700'
                  }`}
                  title="Mover para cima"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.2]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx === steps.length - 1}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                    idx === steps.length - 1
                      ? 'opacity-20 cursor-not-allowed'
                      : isDark
                      ? 'hover:bg-white/10 active:scale-95 text-zinc-300'
                      : 'hover:bg-zinc-200 active:scale-95 text-zinc-700'
                  }`}
                  title="Mover para baixo"
                >
                  <ArrowDown className="w-4 h-4 stroke-[2.2]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleRemoveStep(step.id)}
                  className="px-2 py-1 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 active:scale-95 text-[11px] font-bold transition-all ml-0.5"
                  title="Remover ponto"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Delete Confirmation or Actions */}
        <div className="pt-3.5 border-t border-zinc-200/80 dark:border-white/10 shrink-0">
          {confirmDelete ? (
            <div className="p-3.5 rounded-[22px] bg-rose-500/10 border border-rose-500/20 text-rose-500 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Tem certeza que deseja apagar este roteiro?</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDeleteItinerary();
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-500 transition-colors cursor-pointer"
                >
                  Sim, apagar roteiro
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="py-2.5 px-3 rounded-xl text-rose-500 hover:bg-rose-500/10 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Apagar roteiro</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateNewItinerary();
                  }}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    isGoldUser
                      ? 'text-[#F5BE38] hover:bg-[#F5BE38]/10'
                      : 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  Criar Novo
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className={`py-2.5 px-4 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isGoldUser
                      ? 'bg-metallic-gold text-[#1A1202] shadow-[#E5AC33]/40 border border-[#FFF4A3]/60 hover:opacity-95'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
