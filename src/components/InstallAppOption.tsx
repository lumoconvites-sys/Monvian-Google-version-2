import React, { useState } from 'react';
import { Download, CheckCircle2, ChevronRight, Share2, PlusSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const InstallAppOption: React.FC = () => {
  const { isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);

  const handleInstall = async () => {
    const res = await install();
    if (res.outcome === 'ios-guide') {
      setShowIOSGuide(true);
    } else if (res.outcome === 'unavailable') {
      setShowBrowserGuide(true);
    }
  };

  return (
    <>
      {isInstalled ? (
        // Estado: Já instalado neste dispositivo
        <div className="p-4 rounded-3xl bg-white dark:bg-[#141518] border border-zinc-200 dark:border-white/10 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
              <CheckCircle2 className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="text-sm font-black text-zinc-900 dark:text-white">
                Instalar app
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Aplicativo instalado neste dispositivo
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-zinc-100 dark:bg-white/15 text-zinc-900 dark:text-white text-xs font-black shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Instalado</span>
          </div>
        </div>
      ) : (
        // Estado: Disponível para instalação
        <button
          id="btn-settings-install-app"
          type="button"
          onClick={handleInstall}
          className="w-full p-4 rounded-3xl bg-white dark:bg-[#141518] hover:bg-zinc-50 dark:hover:bg-[#1a1c21] active:scale-[0.98] border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 transition-all flex items-center justify-between shadow-sm cursor-pointer text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-105 transition-transform">
              <Download className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="text-sm font-black text-zinc-900 dark:text-white">
                Instalar app
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Acesso rápido e funcionamento otimizado
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white text-zinc-950 text-xs font-black shadow-xs shrink-0">
            <span>Instalar</span>
            <ChevronRight className="w-4 h-4 text-zinc-950" />
          </div>
        </button>
      )}

      {/* Modal Guia Elegante para iOS */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 1, scale: 1, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0 }}
              className="w-full max-w-sm rounded-[32px] bg-white dark:bg-[#000000] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md border border-zinc-200 dark:border-white/10 bg-black flex items-center justify-center">
                    <img src="/pwa-192x192.png" alt="Monvian" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
                      Instalar app
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Instale no seu iPhone ou iPad
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-[#1f2229] border border-zinc-100 dark:border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <span className="font-black text-zinc-900 dark:text-white">1.</span> Toque no botão de <strong>Compartilhar</strong> na barra do Safari.
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-[#1f2229] border border-zinc-100 dark:border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <span className="font-black text-zinc-900 dark:text-white">2.</span> Role a lista e selecione o item com o ícone <strong>(+)</strong>.
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-[#1f2229] border border-zinc-100 dark:border-white/5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <span className="font-black text-zinc-900 dark:text-white">3.</span> Toque em <strong>Adicionar</strong> no canto superior direito.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 px-4 rounded-2xl bg-white text-zinc-950 font-black text-sm shadow-md hover:bg-zinc-100 transition-colors cursor-pointer text-center"
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Guia para Navegadores Desktop/Outros caso o evento ainda não tenha disparado */}
      <AnimatePresence>
        {showBrowserGuide && !isIOS && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0 }}
              className="w-full max-w-sm rounded-[32px] bg-white dark:bg-[#000000] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center">
                    <Download className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
                      Instalar app
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No seu navegador
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Você pode instalar este aplicativo diretamente pelo menu do seu navegador (clicando no ícone de instalação na barra de endereços ou no menu de opções).
              </p>

              <button
                type="button"
                onClick={() => setShowBrowserGuide(false)}
                className="w-full py-3 px-4 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-100 font-black text-sm shadow-md transition-all cursor-pointer text-center"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
