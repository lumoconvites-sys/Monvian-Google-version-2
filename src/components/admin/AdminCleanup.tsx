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
        <div className="flex items-center gap-2 text-blue-600 text-xs font-black tracking-wider uppercase mb-1">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          CONSOLE OPERACIONAL
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
          Limpeza e Manutenção do Sistema
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
          Otimização segura do banco de dados SQLite, limpeza de sessões expiradas e compactação VACUUM.
        </p>
      </div>

      {/* Main Action Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/90 shadow-xs space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-900">Análise e Limpeza Segura</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              O sistema analisa referências órfãs, sessões de navegação expiradas e tabelas de log temporárias. Nenhuma informação crítica (pontos turísticos, usuários ativos ou configurações) será excluída.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || isCleaning}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
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
          <div className="mt-4 p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">
                Relatório da Análise
              </span>
              <span className="text-[11px] font-black text-[#00C896] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {analysis.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-2xs">
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Itens Analisados</span>
                <span className="text-lg font-black text-zinc-800">{analysis.analyzedItems}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-2xs">
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Sessões Expiradas</span>
                <span className="text-lg font-black text-blue-600">{analysis.staleSessions}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-2xs">
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Logs Antigos</span>
                <span className="text-lg font-black text-zinc-800">{analysis.oldLogs}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-2xs">
                <span className="text-[10px] text-zinc-400 uppercase font-black block">Espaço Liberável</span>
                <span className="text-lg font-black text-[#00C896]">~{analysis.potentiallyReclaimableKb} KB</span>
              </div>
            </div>
          </div>
        )}

        {/* Cleanup Result Summary */}
        {cleanupResult && (
          <div className="mt-4 p-5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 space-y-2">
            <div className="flex items-center gap-2 font-black text-sm text-[#00C896]">
              <CheckCircle2 className="w-5 h-5 text-[#00C896]" />
              <span>Limpeza Concluída com Sucesso!</span>
            </div>
            <ul className="text-xs space-y-1 pl-7 list-disc text-blue-800">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-zinc-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-zinc-900">Confirmar Limpeza do Sistema</h3>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Essa operação removerá somente recursos identificados como seguros para exclusão (sessões antigas, caches temporários e execução de VACUUM). Deseja continuar?
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
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
