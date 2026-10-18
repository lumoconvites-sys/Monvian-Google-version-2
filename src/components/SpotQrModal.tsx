import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

interface SpotQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  spot: any;
}

export const SpotQrModal: React.FC<SpotQrModalProps> = ({ isOpen, onClose, spot }) => {
  if (!isOpen || !spot) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-white mb-2">{spot.name}</h3>
        <p className="text-xs text-zinc-400 mb-4">Aponte a câmera para abrir as rotas</p>
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
          className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-inner"
        >
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(spot.mapsUrl || 'https://maps.google.com')}`}
            alt="QR Code"
            className="w-40 h-40"
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
export default SpotQrModal;
