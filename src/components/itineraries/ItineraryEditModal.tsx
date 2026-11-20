import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Play, X, Check, AlertTriangle, Trash2, Clock } from 'lucide-react';
import { Itinerary, ItineraryStep, Spot } from '../../types';

interface ItineraryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: Itinerary;
  onSave: (updatedItinerary: Itinerary) => void;
  onDeleteItinerary: () => void;
  onCreateNewItinerary: () => void;
  theme?: 'dark' | 'light';
}

export const ItineraryEditModal: React.FC<ItineraryEditModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  onSave,
  onDeleteItinerary,
  onCreateNewItinerary,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  const [steps, setSteps] = useState<ItineraryStep[]>(() => {
    return itinerary.days[0]?.steps || [];
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const openDirectionsMap = (spotTarget?: Spot | { name?: string; address?: string; lat?: number; lng?: number; mapsUrl?: string }) => {
    if (!spotTarget) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const destination = spotTarget.lat && spotTarget.lng
      ? `${spotTarget.lat},${spotTarget.lng}`
      : encodeURIComponent(spotTarget.address ? `${spotTarget.name}, ${spotTarget.address}` : `${spotTarget.name} Campos do Jordão`);

    if (isIOS) {
      window.open(`https://maps.apple.com/?daddr=${destination}&dirflg=d`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
    }
  };

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
    if (steps.length <= 1) return;
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/55 pointer-events-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: 'spring', damping: 26, stiffness: 340 }}
        className={`w-full max-w-md rounded-[32px] max-h-[85vh] overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.18)] border ${
          isDark
            ? 'bg-[#000000] text-white border-[#262626]'
            : 'bg-[#FFFFFF] text-[#000000] border-black/[0.06]'
        }`}
        style={{ backgroundColor: isDark ? '#000000' : '#FFFFFF' }}
      >
        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col">
          {/* Header */}
          <div
            className={`sticky top-0 z-20 px-6 pt-6 pb-3.5 flex items-center justify-between border-b shrink-0 ${
              isDark ? 'bg-[#000000] border-[#262626]' : 'bg-[#FFFFFF] border-black/[0.06]'
            }`}
          >
            <div>
              <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                Editar Roteiro
              </h2>
              <p className="text-xs font-medium mt-0.5 text-[#8E8E93]">
                Reorganize a ordem dos pontos ou remova locais.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 cursor-pointer ${
                isDark
                  ? 'bg-[#171717] border-white/10 text-white hover:bg-zinc-800'
                  : 'bg-[#FFFFFF] border-black/[0.06] text-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-zinc-50'
              }`}
              title="Fechar"
            >
              <X className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          {/* Steps List */}
          <div className="px-5 py-4 space-y-2.5">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`p-3 rounded-[24px] flex items-center justify-between gap-2.5 transition-colors border ${
                  isDark
                    ? 'bg-[#171717] border-white/10 hover:border-white/25'
                    : 'bg-[#FFFFFF] border-black/[0.07] shadow-[0_1px_4px_rgba(0,0,0,0.03)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 tabular-nums ${
                      isDark
                        ? 'bg-white text-black'
                        : 'bg-[#000000] text-white'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h4 className={`text-[13px] font-black truncate uppercase ${isDark ? 'text-white' : 'text-[#000000]'}`}>
                      {step.spot?.name || `Ponto ${idx + 1}`}
                    </h4>
                    <div className="flex items-center gap-1 text-[11px] text-[#8E8E93] font-medium mt-0.5 whitespace-nowrap">
                      <Clock className="w-3 h-3 shrink-0 text-[#8E8E93]" />
                      <span className="tabular-nums">{step.suggestedTime || '09:30'}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons: Up, Down, Play, Remove */}
                <div className="flex items-center gap-1 shrink-0">
                  {steps.length > 1 && (
                    <>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveUp(idx)}
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${
                          idx === 0 ? 'opacity-30 cursor-not-allowed' : 'active:scale-90 cursor-pointer'
                        } ${
                          isDark
                            ? 'bg-[#242426] border-white/10 text-white'
                            : 'bg-[#FFFFFF] border-black/[0.06] text-[#111111] shadow-[0_1px_5px_rgba(0,0,0,0.06)]'
                        }`}
                        title="Mover para cima"
                        aria-label="Mover para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5 stroke-[2]" />
                      </button>

                      <button
                        type="button"
                        disabled={idx === steps.length - 1}
                        onClick={() => handleMoveDown(idx)}
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${
                          idx === steps.length - 1 ? 'opacity-30 cursor-not-allowed' : 'active:scale-90 cursor-pointer'
                        } ${
                          isDark
                            ? 'bg-[#242426] border-white/10 text-white'
                            : 'bg-[#FFFFFF] border-black/[0.06] text-[#111111] shadow-[0_1px_5px_rgba(0,0,0,0.06)]'
                        }`}
                        title="Mover para baixo"
                        aria-label="Mover para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5 stroke-[2]" />
                      </button>
                    </>
                  )}

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => openDirectionsMap(step.spot)}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                      isDark
                        ? 'bg-[#242426] border-white/10 text-white'
                        : 'bg-[#FFFFFF] border-black/[0.05] text-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-zinc-50'
                    }`}
                    title="Abrir rota no Maps"
                    aria-label="Abrir rota no Maps"
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </motion.button>

                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(step.id)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
                        isDark
                          ? 'bg-[#242426] border-white/10 text-[#8E8E93] hover:text-red-400'
                          : 'bg-[#FFFFFF] border-black/[0.06] text-[#8E8E93] hover:text-red-500 shadow-[0_1px_5px_rgba(0,0,0,0.06)]'
                      }`}
                      title="Remover ponto"
                      aria-label="Remover ponto"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[1.9]" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delete Confirmation or Actions */}
        <div
          className={`px-6 pt-3.5 pb-6 border-t shrink-0 ${
            isDark ? 'border-white/10' : 'border-black/[0.06]'
          }`}
        >
          {confirmDelete ? (
            <div className="p-3.5 rounded-[22px] bg-red-500/10 border border-red-500/20 text-red-500 flex flex-col gap-2.5">
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
                  className="flex-1 py-2.5 rounded-full bg-red-600 text-white font-black text-xs hover:bg-red-500 transition-colors cursor-pointer"
                >
                  Sim, apagar roteiro
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
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
                className="py-2.5 px-3 rounded-full text-red-500 hover:bg-red-500/10 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Apagar</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateNewItinerary();
                  }}
                  className={`py-2.5 px-3.5 rounded-full font-bold text-xs transition-colors cursor-pointer border ${
                    isDark
                      ? 'bg-[#171717] text-white hover:bg-white/10 border-[#262626]'
                      : 'bg-[#FFFFFF] text-[#000000] hover:bg-zinc-50 border-black/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                  }`}
                >
                  Criar Novo
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className={`py-2.5 px-4 rounded-full font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isDark
                      ? 'bg-[#FFFFFF] text-[#000000] hover:bg-zinc-200'
                      : 'bg-[#000000] text-[#FFFFFF] hover:bg-[#171717] shadow-[0_4px_12px_rgba(0,0,0,0.16)]'
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
