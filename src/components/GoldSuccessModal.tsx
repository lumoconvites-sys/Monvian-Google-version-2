import React from 'react';
import { Sparkles } from 'lucide-react';

interface GoldSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: string;
  onExplore: () => void;
}

export const GoldSuccessModal: React.FC<GoldSuccessModalProps> = ({ isOpen, onClose, onExplore }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-950 border border-amber-400/30 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
        <Sparkles className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-xl font-black text-white">Monvian Gold Ativado!</h3>
        <p className="text-xs text-zinc-400">Acesso ilimitado liberado a todos os roteiros exclusivos de Campos do Jordão.</p>
        <button onClick={onExplore} className="w-full py-3 rounded-2xl bg-amber-400 text-zinc-950 font-black text-sm hover:bg-amber-300 transition-all cursor-pointer">
          Explorar Roteiros
        </button>
      </div>
    </div>
  );
};
export default GoldSuccessModal;
