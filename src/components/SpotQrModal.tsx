import React from 'react';
import { X } from 'lucide-react';

interface SpotQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  spot: any;
}

export const SpotQrModal: React.FC<SpotQrModalProps> = ({ isOpen, onClose, spot }) => {
  if (!isOpen || !spot) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-white mb-2">{spot.name}</h3>
        <p className="text-xs text-zinc-400 mb-4">Aponte a câmera para abrir as rotas</p>
        <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-inner">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(spot.mapsUrl || 'https://maps.google.com')}`}
            alt="QR Code"
            className="w-40 h-40"
          />
        </div>
      </div>
    </div>
  );
};
export default SpotQrModal;
