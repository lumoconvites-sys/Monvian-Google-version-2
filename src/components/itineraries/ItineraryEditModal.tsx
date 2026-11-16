import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, X, Check, AlertTriangle, Plus, Clock } from 'lucide-react';
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
        className={`w-full max-w-md rounded-[32px] max-h-[85vh] overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.18)] border ${
          isDark
            ? 'bg-[#000000] text-white border-[#262626]'
            : '!bg-[#ffffff] bg-[#ffffff] text-zinc-900 border-zinc-200/80'
        }`}
        style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
      >
        {/* Scrollable Body with Sticky Translucent Blurred Header */}
        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col">
        {/* Header */}
        <div
          className="sticky top-0 z-20 px-6 pt-6 pb-3.5 flex items-center justify-between border-b border-zinc-200/60 dark:border-[#262626]/70 shrink-0"
          style={{
            color: isDark ? '#FFFFFF' : '#4f4f4f',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(255, 255, 255, 0.40)',
            backdropFilter: 'blur(8px) saturate(150%)',
            WebkitBackdropFilter: 'blur(8px) saturate(150%)',
          }}
        >
          <div>
            <h2
              className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#2d2d2d]'}`}
              style={{ color: isDark ? '#FFFFFF' : '#2d2d2d' }}
            >
              Editar Roteiro
            </h2>
            <p
              className={`text-xs font-bold mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#000000]'}`}
              style={{ color: isDark ? '#A1A1AA' : '#000000' }}
            >
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
        <div className="px-6 py-4 space-y-2.5">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`p-3 sm:p-3.5 rounded-[22px] flex items-center justify-between gap-3 transition-colors ${
                isDark
                  ? 'bg-[#1C1C1E] border border-white/10 hover:border-white/25'
                  : 'ios-glass-btn-white hover:bg-white/90 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative shrink-0 flex items-center justify-center">
                  <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 shadow-sm ${
                    isGoldUser
                      ? 'bg-metallic-gold text-[#1A1202] shadow-[#E5AC33]/40 border border-[#FFF4A3]/60'
                      : isDark
                      ? 'bg-white text-black shadow-white/20'
                      : 'bg-zinc-900 text-white shadow-black/10'
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
                    <Clock className={`w-3 h-3 shrink-0 ${isGoldUser ? 'text-[#F5BE38]' : 'text-zinc-400'}`} />
                    <span>{step.suggestedTime || '09:30'}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons: Round Play Button + Remove */}
              <div className="flex items-center gap-1.5 shrink-0">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => openDirectionsMap(step.spot)}
                  className="w-8 h-8 rounded-full bg-white text-zinc-900 shadow-sm flex items-center justify-center hover:bg-zinc-100 transition-all cursor-pointer"
                  title="Abrir rota no Maps"
                  aria-label="Abrir rota no Maps"
                >
                  <Play className="w-3.5 h-3.5 fill-zinc-900 text-zinc-900 ml-0.5" />
                </motion.button>

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
        </div>

        {/* Delete Confirmation or Actions */}
        <div className="px-6 pt-3.5 pb-6 border-t border-zinc-200/80 dark:border-white/10 shrink-0">
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
                    isDark
                      ? 'text-white hover:bg-white/10 border border-[#262626]'
                      : '!text-[#000000] text-[#000000] hover:bg-zinc-100 border border-zinc-200'
                  }`}
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Criar Novo
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="py-2.5 px-4 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 !bg-[#2f97ff] bg-[#2f97ff] !text-[#ffffff] text-[#ffffff] hover:opacity-95"
                  style={{ backgroundColor: '#2f97ff', color: '#ffffff' }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3] !text-[#ffffff] text-[#ffffff]" style={{ color: '#ffffff' }} />
                  <span className="!text-[#ffffff] text-[#ffffff]" style={{ color: '#ffffff' }}>Salvar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
