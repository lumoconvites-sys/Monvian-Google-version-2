import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  HardDrive,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Database,
  Layers
} from 'lucide-react';

export const AdminCleanup: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);

  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/admin/system/analyze', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteCleanup = async () => {
    setShowConfirmModal(false);
    setIsCleaning(true);
    try {
      const res = await fetch('/api/admin/system/cleanup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCleanupResult(data.summary);
        setAnalysis(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-black tracking-wider uppercase mb-1">
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></span>
          CONSOLE OPERACIONAL
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          Limpeza e Manutenção do Sistema
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Otimização segura do banco de dados SQLite, limpeza de sessões expiradas e compactação VACUUM.
        </p>
      </div>

      {/* Main Action Card */}
      <div className="bg-white dark:bg-[#121418] rounded-3xl p-6 sm:p-8 border border-zinc-200/90 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-900 dark:text-white">Análise e Limpeza Segura</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              O sistema analisa referências órfãs, sessões de navegação expiradas e tabelas de log temporárias. Nenhuma informação crítica (pontos turísticos, usuários ativos ou configurações) será excluída.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || isCleaning}
            className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-black dark:hover:bg-zinc-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Analisando banco de dados...' : 'Analisar Sistema'}</span>
          </button>

          {analysis && (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isCleaning}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Executar Limpeza Segura</span>
            </button>
          )}
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="mt-4 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                Relatório da Análise
              </span>
              <span className="text-[11px] font-black text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                {analysis.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white dark:bg-[#16181d] rounded-xl border border-zinc-200/60 dark:border-zinc-800 shadow-2xs">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-black block">Itens Analisados</span>
                <span className="text-lg font-black text-zinc-800 dark:text-zinc-100">{analysis.analyzedItems}</span>
              </div>
              <div className="p-3 bg-white dark:bg-[#16181d] rounded-xl border border-zinc-200/60 dark:border-zinc-800 shadow-2xs">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-black block">Sessões Expiradas</span>
                <span className="text-lg font-black text-blue-600 dark:text-blue-400">{analysis.staleSessions}</span>
              </div>
              <div className="p-3 bg-white dark:bg-[#16181d] rounded-xl border border-zinc-200/60 dark:border-zinc-800 shadow-2xs">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-black block">Logs Antigos</span>
                <span className="text-lg font-black text-zinc-800 dark:text-zinc-100">{analysis.oldLogs}</span>
              </div>
              <div className="p-3 bg-white dark:bg-[#16181d] rounded-xl border border-zinc-200/60 dark:border-zinc-800 shadow-2xs">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-black block">Espaço Liberável</span>
                <span className="text-lg font-black text-blue-600">~{analysis.potentiallyReclaimableKb} KB</span>
              </div>
            </div>
          </div>
        )}

        {/* Cleanup Result Summary */}
        {cleanupResult && (
          <div className="mt-4 p-5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 space-y-2">
            <div className="flex items-center gap-2 font-black text-sm text-blue-600">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
              <span>Limpeza Concluída com Sucesso!</span>
            </div>
            <ul className="text-xs space-y-1 pl-7 list-disc text-blue-800 dark:text-blue-300">
              <li>{cleanupResult.itemsRemoved} registros obsoletos excluídos.</li>
              <li>Espaço em disco liberado: {cleanupResult.freedSpace}</li>
              <li>{cleanupResult.preservedItems}</li>
              <li>Tamanho atual do banco compactado: {cleanupResult.currentDbSize}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#16181d] rounded-3xl p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">Confirmar Limpeza do Sistema</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Essa operação removerá somente recursos identificados como seguros para exclusão (sessões antigas, caches temporários e execução de VACUUM). Deseja continuar?
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-black text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanup}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-black text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                Sim, Executar Limpeza
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
