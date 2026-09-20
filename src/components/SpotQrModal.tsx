import React, { useState, useEffect } from 'react';
import { Spot } from '../types';
import { 
  X, 
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

export const SpotQrModal: React.FC<SpotQrModalProps> = ({
  isOpen,
  onClose,
  spot,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  // Generate deep link for the spot
  const shareUrl = typeof window !== 'undefined' && spot
    ? `${window.location.origin}${window.location.pathname}?spot=${encodeURIComponent(spot.id)}`
    : '';

  useEffect(() => {
    if (!isOpen || !spot || !shareUrl) return;

    setIsGenerating(true);
    QRCode.toDataURL(shareUrl, {
      width: 340,
      margin: 1.5,
      color: {
        dark: '#111215',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        setQrDataUrl(url);
        setIsGenerating(false);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
        setIsGenerating(false);
      });
  }, [isOpen, spot, shareUrl]);

  if (!isOpen || !spot) return null;

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
    if (!qrDataUrl) return;
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
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Window: Apple iOS Sheet Style */}
        <motion.div
          initial={{ y: '100%', opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 360 }}
          className="relative w-full max-w-[340px] bg-white dark:bg-[#15171b] text-zinc-900 dark:text-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl border border-zinc-200/70 dark:border-white/10 overflow-hidden flex flex-col z-10 p-5"
          style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4">
            <div className="min-w-0 pr-2">
              <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white truncate">
                {spot.name}
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                {spot.categoryLabel || spot.category}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Minimalist QR Frame */}
          <div className="flex flex-col items-center justify-center my-2">
            <div className="p-3.5 rounded-2xl bg-white shadow-xs border border-zinc-100 flex items-center justify-center">
              {isGenerating ? (
                <div className="w-44 h-44 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <img
                  src={qrDataUrl}
                  alt={`QR Code para ${spot.name}`}
                  className="w-44 h-44 block rounded-lg"
                />
              )}
            </div>

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center mt-3 font-normal">
              Aponte a câmera para abrir no app
            </span>
          </div>

          {/* Minimalist Action Controls - Monochrome Apple style */}
          <div className="space-y-2 pt-3">
            {/* Primary Action: Compartilhar */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleNativeShare}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartilhar</span>
            </motion.button>

            {/* Secondary Actions: Copiar Link & Salvar Imagem */}
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
    </AnimatePresence>
  );
};
