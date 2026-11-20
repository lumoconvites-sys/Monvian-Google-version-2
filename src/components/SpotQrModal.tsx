import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface SpotQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  spot: any;
}

export const SpotQrModal: React.FC<SpotQrModalProps> = ({ isOpen, onClose, spot }) => {
  const [qrFallback, setQrFallback] = useState(false);

  if (!spot) return null;

  const destination =
    spot.lat && spot.lng
      ? `${spot.lat},${spot.lng}`
      : encodeURIComponent(
          spot.address
            ? `${spot.name}, ${spot.address}, Campos do Jordão`
            : `${spot.name}, Campos do Jordão`
        );

  const qrTargetUrl =
    spot.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

  const qrImageUrl = qrFallback
    ? `https://quickchart.io/qr?size=260&margin=1&text=${encodeURIComponent(qrTargetUrl)}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(qrTargetUrl)}`;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="spot-qr-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.38)',
            willChange: 'opacity',
          }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-6 select-none cursor-pointer"
          aria-label="Fechar QR Code"
        >
          <motion.div
            key="spot-qr-card"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{ willChange: 'transform, opacity' }}
            className="flex flex-col items-center text-center cursor-default"
          >
            <div className="bg-white p-5 rounded-[30px] inline-flex items-center justify-center shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
              <img
                src={qrImageUrl}
                alt={`QR Code - ${spot.name}`}
                className="w-52 h-52 object-contain rounded-lg"
                loading="eager"
                decoding="async"
                onError={() => {
                  if (!qrFallback) setQrFallback(true);
                }}
              />
            </div>

            <h3 className="mt-5 text-[18px] sm:text-xl font-semibold text-white tracking-tight leading-snug max-w-[280px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
              {spot.name}
            </h3>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
export default SpotQrModal;
