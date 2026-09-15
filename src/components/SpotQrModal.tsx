import React, { useState, useEffect } from 'react';
import { Spot } from '../types';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  Share2, 
  Download, 
  Star, 
  MapPin,
  Sparkles
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
      width: 380,
      margin: 2,
      color: {
        dark: '#0e1014',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
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
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed');
    }
  };

  const handleNativeShare = () => {
    playPinTapSound();
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({
          title: `${spot.name} · Campos do Jordão`,
          text: `Confira ${spot.name} no Monvian:`,
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
    link.download = `qrcode-${spot.id}-monvian.png`;
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
          className="fixed inset-0 bg-black/70 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="relative w-full max-w-sm bg-white dark:bg-[#121316] text-zinc-900 dark:text-white rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-white/10 overflow-hidden flex flex-col z-10"
          style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          {/* Header */}
          <div className="p-5 pb-3 flex items-center justify-between border-b border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#00C896]/15 text-[#00C896] flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">
                  Compartilhar Local
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  QR Code exclusivo para o Monvian
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/15 flex items-center justify-center text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 flex flex-col items-center">
            {/* Spot Mini Card */}
            <div className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10">
              <img
                src={spot.image}
                alt={spot.name}
                className="w-11 h-11 rounded-xl object-cover shrink-0 border border-black/5 dark:border-white/10"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate">
                    {spot.name}
                  </h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#00C896]/15 text-[#00C896] shrink-0">
                    {spot.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-[#F2B900] text-[#F2B900]" />
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">{spot.rating}</span>
                  </span>
                  <span>•</span>
                  <span className="truncate flex items-center gap-0.5">
                    <MapPin className="w-3 h-3 text-zinc-400" />
                    Campos do Jordão
                  </span>
                </div>
              </div>
            </div>

            {/* QR Code Presentation Frame */}
            <div className="relative p-4 rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-zinc-200/80 flex flex-col items-center justify-center group">
              {isGenerating ? (
                <div className="w-52 h-52 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-[#00C896] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={qrDataUrl}
                    alt={`QR Code para ${spot.name}`}
                    className="w-52 h-52 rounded-lg block"
                  />
                  {/* Subtle brand watermark dot in center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-md flex items-center justify-center border border-zinc-200/60">
                      <div className="w-full h-full rounded-lg bg-[#00C896] flex items-center justify-center text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2 text-[10px] uppercase font-black tracking-widest text-zinc-400">
                Monvian · Escaneie com a câmera
              </div>
            </div>

            {/* Helper Text */}
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 px-4 leading-relaxed">
              Ao apontar a câmera do smartphone para este código, o Monvian abrirá os detalhes de <span className="font-bold text-zinc-800 dark:text-zinc-200">{spot.name}</span> instantaneamente.
            </p>

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-2 pt-1">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleCopyLink}
                className="py-2.5 px-3 rounded-xl bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-900 dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00C896]" />
                    <span className="text-[#00C896]">Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleDownloadQr}
                className="py-2.5 px-3 rounded-xl bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-900 dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Salvar Imagem</span>
              </motion.button>
            </div>

            {/* Primary Full-width Share Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleNativeShare}
              className="w-full py-3 rounded-2xl bg-[#00C896] hover:bg-[#00b084] text-white text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-white" />
              <span>Compartilhar com outros usuários</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
