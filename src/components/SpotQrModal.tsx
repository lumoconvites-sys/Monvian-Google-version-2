import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Navigation, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpotQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  spot: any;
}

export const SpotQrModal: React.FC<SpotQrModalProps> = ({ isOpen, onClose, spot }) => {
  const [copied, setCopied] = useState(false);
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
    ? `https://quickchart.io/qr?size=240&margin=1&text=${encodeURIComponent(qrTargetUrl)}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(qrTargetUrl)}`;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(qrTargetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenRoute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const url = isIOS
      ? `https://maps.apple.com/?daddr=${destination}&dirflg=d`
      : qrTargetUrl;

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="spot-qr-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-md p-5 select-none"
        >
          <motion.div
            key="spot-qr-card"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121316] border border-white/10 rounded-[28px] p-6 max-w-[340px] w-full text-center relative shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="
                absolute top-4 right-4 w-[30px] h-[30px] rounded-full
                bg-white/10 hover:bg-white/20 border border-white/15
                text-white flex items-center justify-center
                transition-all active:scale-90 cursor-pointer
              "
              title="Fechar"
              aria-label="Fechar QR Code"
            >
              <X className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>

            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-3 text-white">
              <QrCode className="w-5 h-5 stroke-[2]" />
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight leading-snug px-4">
              {spot.name}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 mb-5">
              Aponte a câmera do celular para abrir a localização e rota no mapa
            </p>

            <div className="bg-white p-4 rounded-2xl inline-flex items-center justify-center mx-auto shadow-md border border-white/20">
              <img
                src={qrImageUrl}
                alt={`QR Code - ${spot.name}`}
                className="w-44 h-44 object-contain"
                loading="eager"
                onError={() => {
                  if (!qrFallback) setQrFallback(true);
                }}
              />
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full h-11 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400 stroke-[2.4]" />
                    <span className="text-emerald-400">Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 stroke-[2]" />
                    <span>Copiar link da rota</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenRoute}
                className="w-full h-11 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <Navigation className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Abrir no GPS</span>
              </button>
            </div>
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
