import React from 'react';
import { Sparkles } from 'lucide-react';

interface GoldSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: string;
  onExplore: () => void;
}

export const GoldSuccessModal: React.FC<GoldSuccessModalProps> = ({ isOpen, theme = 'light', onExplore }) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDark ? 'bg-black/70' : 'bg-black/40'}`}>
      <div className={`border rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl ${isDark ? 'bg-[#1C1C1E] border-amber-400/30 text-white' : 'bg-white border-amber-400/40 text-zinc-900'}`}>
        <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>Monvian Gold Ativado!</h3>
        <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Acesso ilimitado liberado a todos os roteiros exclusivos de Campos do Jordão.</p>
        <button onClick={onExplore} className="w-full py-3 rounded-2xl bg-amber-400 text-zinc-950 font-black text-sm hover:bg-amber-300 transition-all cursor-pointer">
          Explorar Roteiros
        </button>
      </div>
    </div>
  );
};
export default GoldSuccessModal;
