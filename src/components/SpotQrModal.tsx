import React, { useState, useEffect } from 'react';
import { Spot } from '../types';
import { 
  Copy, 
  Check, 
  Share2, 
  Download, 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { playPinTapSound } from '../utils/sound';

interface SpotQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  spot: Spot | null;
}

// In-memory module cache for instant zero-latency QR loading
const qrCodeCache = new Map<string, string>();

export const SpotQrModal: React.FC<SpotQrModalProps> = ({
  isOpen,
  onClose,
  spot,
}) => {
  const [copied, setCopied] = useState(false);

  // Generate deep link for the spot
  const shareUrl = typeof window !== 'undefined' && spot
    ? `${window.location.origin}${window.location.pathname}?spot=${encodeURIComponent(spot.id)}`
    : '';

  const [qrDataUrl, setQrDataUrl] = useState<string>(() => {
    return shareUrl && qrCodeCache.has(shareUrl) ? (qrCodeCache.get(shareUrl) as string) : '';
  });

  useEffect(() => {
    if (!isOpen || !spot || !shareUrl) return;

    if (qrCodeCache.has(shareUrl)) {
      setQrDataUrl(qrCodeCache.get(shareUrl)!);
      return;
    }

    let isMounted = true;
    QRCode.toDataURL(shareUrl, {
      width: 360,
      margin: 1.5,
      color: {
        dark: '#111215',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        qrCodeCache.set(shareUrl, url);
        if (isMounted) {
          setQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, spot, shareUrl]);

  const handleCopyLink = async () => {
    try {
      playPinTapSound();
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed');
    }
  };

  const handleNativeShare = () => {
    if (!spot) return;
    playPinTapSound();
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: spot.name,
          text: `${spot.name} · Campos do Jordão`,
          url: shareUrl,
        })
        .catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !spot) return;
    playPinTapSound();
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode-${spot.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && spot && (
        <div 
          id="spot-qr-modal-overlay"
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 select-none"
        >
          {/* Backdrop: Smooth fade with tap to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Card: Smooth native Apple card entrance, no X button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 340,
              mass: 0.8,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[320px] sm:max-w-[340px] bg-white dark:bg-[#000000] text-zinc-900 dark:text-white rounded-[28px] shadow-2xl border border-zinc-200/80 dark:border-white/10 overflow-hidden flex flex-col z-10 p-5"
            style={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              willChange: 'transform, opacity',
            }}
          >
            {/* Header: Name and category without X close button */}
            <div className="pb-3 text-left">
              <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white truncate">
                {spot.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {spot.categoryLabel || spot.category}
              </p>
            </div>

            {/* Minimalist QR Frame: Fixed size to eliminate layout shift */}
            <div className="flex flex-col items-center justify-center my-1">
              <div className="w-[190px] h-[190px] p-2.5 rounded-2xl bg-white shadow-xs border border-zinc-100 flex items-center justify-center overflow-hidden">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code para ${spot.name}`}
                    className="w-full h-full object-contain block rounded-lg"
                    decoding="async"
                  />
                ) : (
                  <div className="w-6 h-6 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center mt-2.5 font-normal">
                Aponte a câmera para abrir no app
              </span>
            </div>

            {/* Minimalist Action Controls - Apple Monochrome Style */}
            <div className="space-y-2 pt-3">
              {/* Primary Action: Compartilhar */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleNativeShare}
                className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs active:opacity-90"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartilhar</span>
              </motion.button>

              {/* Secondary Actions: Copiar Link & Salvar */}
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCopyLink}
                  className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                      <span>Copiar link</span>
                    </>
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDownloadQr}
                  className="py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Salvar</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
