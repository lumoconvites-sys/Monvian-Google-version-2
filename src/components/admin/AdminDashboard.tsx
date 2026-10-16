import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  MapPin,
  Eye,
  Activity,
  Star,
  Clock,
  CloudRain,
  Snowflake,
  RefreshCw,
  CheckCircle,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Zap
} from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext: string;
  changePercent: string;
  trend: 'up' | 'down';
  sparklinePath: string;
  strokeColor: string;
  fillColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  changePercent,
  trend,
  sparklinePath,
  strokeColor,
  fillColor,
}) => {
  const displayChange = changePercent.startsWith('+') || changePercent.startsWith('-')
    ? changePercent
    : (trend === 'up' && changePercent !== '0%' ? `+${changePercent}` : changePercent);

  return (
    <div className="bg-white dark:bg-[#16181d] p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-black tracking-wider text-zinc-500 dark:text-zinc-400 uppercase block mb-1">
            {label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              {value}
            </span>
            <span
              className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                displayChange.startsWith('+')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : displayChange.startsWith('-')
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              {displayChange}
            </span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-black">{subtext}</p>
        </div>
      </div>

      {/* Sparkline chart SVG */}
      <div className="w-full h-10 mt-3 pt-1">
        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 30">
          <path
            d={sparklinePath || 'M 0 26 L 100 26'}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<{ onNavigateTo: (tab: string) => void }> = ({ onNavigateTo }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  // Weather & Effects
  const [rainMode, setRainMode] = useState<'fraca' | 'moderada' | 'forte' | 'auto'>('auto');
  const [rainEnabled, setRainEnabled] = useState(true);

  const [snowMode, setSnowMode] = useState<'fraca' | 'moderada' | 'forte'>('fraca');
  const [snowEnabled, setSnowEnabled] = useState(true);

  const [savingEffects, setSavingEffects] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.metrics);
        if (json.metrics.effects) {
          if (json.metrics.effects.rainMode) {
            setRainMode(json.metrics.effects.rainMode);
          }
          if (json.metrics.effects.snowMode) {
            setSnowMode(json.metrics.effects.snowMode);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUpdateEffect = async (newRainMode?: string, newSnowMode?: string) => {
    setSavingEffects(true);
    try {
      const res = await fetch('/api/admin/effects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rainMode: newRainMode !== undefined ? newRainMode : rainMode,
          snowMode: newSnowMode !== undefined ? newSnowMode : snowMode,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setToastMsg('Configurações de clima atualizadas!');
        setTimeout(() => setToastMsg(''), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingEffects(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white text-xs font-black px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-zinc-700">
          <CheckCircle className="w-4 h-4 text-blue-500" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-black tracking-wider uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            CONSOLE OPERACIONAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Painel de Controle
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Uma visão de alto nível do seu ecossistema turístico e controle de dados em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#16181d] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200 text-xs font-black rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            <span>{refreshing ? 'Sincronizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </div>

      {/* 8 Metric Cards Grid (Matching reference with 100% real database metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="COMUNIDADE TOTAL"
          value={data?.totalUsers !== undefined ? data.totalUsers.toLocaleString('pt-BR') : '0'}
          subtext="usuários cadastrados"
          changePercent={data?.usersGrowth?.changePercent || '0%'}
          trend={data?.usersGrowth?.trend || 'up'}
          sparklinePath={data?.usersSparkline || 'M 0 26 L 100 26'}
          strokeColor="#2563eb"
          fillColor="#2563eb"
        />

        <MetricCard
          label="CRESCIMENTO ATIVO"
          value={data?.activeUsersCount !== undefined ? data.activeUsersCount.toLocaleString('pt-BR') : '0'}
          subtext="usuários ativos (últimos 7 dias)"
          changePercent={data?.activeGrowth?.changePercent || '0%'}
          trend={data?.activeGrowth?.trend || 'up'}
          sparklinePath={data?.activeSparkline || 'M 0 26 L 100 26'}
          strokeColor="#2563eb"
          fillColor="#2563eb"
        />

        <MetricCard
          label="DESTINOS"
          value={data?.totalSpots !== undefined ? data.totalSpots.toLocaleString('pt-BR') : '0'}
          subtext="catálogo ativo no mapa"
          changePercent={data?.spotsGrowth?.changePercent || '0%'}
          trend={data?.spotsGrowth?.trend || 'up'}
          sparklinePath={data?.spotsSparkline || 'M 0 26 L 100 26'}
          strokeColor="#2563eb"
          fillColor="#2563eb"
        />

        <MetricCard
          label="VISUALIZAÇÕES TOTAIS"
          value={data?.viewsTotal !== undefined ? data.viewsTotal.toLocaleString('pt-BR') : '0'}
          subtext="visualizações reais registradas"
          changePercent={data?.viewsGrowth?.changePercent || '0%'}
          trend={data?.viewsGrowth?.trend || 'up'}
          sparklinePath={data?.viewsSparkline || 'M 0 26 L 100 26'}
          strokeColor="#6366f1"
          fillColor="#6366f1"
        />

        <MetricCard
          label="ENGAJAMENTO"
          value={data?.engagementTotal !== undefined ? data.engagementTotal.toLocaleString('pt-BR') : '0'}
          subtext="interações reais no app"
          changePercent={data?.engagementGrowth?.changePercent || '0%'}
          trend={data?.engagementGrowth?.trend || 'up'}
          sparklinePath={data?.engagementSparkline || 'M 0 26 L 100 26'}
          strokeColor="#8b5cf6"
          fillColor="#8b5cf6"
        />

        <MetricCard
          label="AVALIAÇÕES"
          value={data?.totalReviews !== undefined ? data.totalReviews.toLocaleString('pt-BR') : '0'}
          subtext="avaliações publicadas"
          changePercent={data?.reviewsGrowth?.changePercent || '0%'}
          trend={data?.reviewsGrowth?.trend || 'up'}
          sparklinePath={data?.reviewsSparkline || 'M 0 26 L 100 26'}
          strokeColor="#ec4899"
          fillColor="#ec4899"
        />

        <MetricCard
          label="SATISFAÇÃO"
          value={data?.satisfactionScore ? `${data.satisfactionScore} / 5` : '0 / 5'}
          subtext={data?.totalReviews > 0 ? `média de ${data.totalReviews} avaliações` : 'sem avaliações registradas'}
          changePercent={data?.satisfactionGrowth?.changePercent || '0%'}
          trend={data?.satisfactionGrowth?.trend || 'up'}
          sparklinePath={data?.satisfactionSparkline || 'M 0 26 L 100 26'}
          strokeColor="#2563eb"
          fillColor="#2563eb"
        />

        <MetricCard
          label="MÉDIA DE SESSÃO"
          value={data?.avgSessionDuration || '0m'}
          subtext="tempo estimado de uso"
          changePercent={data?.sessionGrowth?.changePercent || '0%'}
          trend={data?.sessionGrowth?.trend || 'up'}
          sparklinePath={data?.sessionSparkline || 'M 0 26 L 100 26'}
          strokeColor="#f59e0b"
          fillColor="#f59e0b"
        />
      </div>

      {/* Weather & Climate Effects Section (Exact match with reference screenshots) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Rain on Map Card */}
        <div className="bg-white dark:bg-[#16181d] p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                CLIMA E EFEITOS
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black ${rainEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  {rainEnabled ? 'Ligado' : 'Desligado'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !rainEnabled;
                    setRainEnabled(next);
                    handleUpdateEffect(next ? rainMode : 'off');
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    rainEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      rainEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <CloudRain className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-white">Chuva no Mapa</h3>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Quando desligada, segue o clima real de Campos do Jordão. No modo automático, só ativa se estiver chovendo E o usuário estiver em Campos do Jordão.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto">
            {(['fraca', 'moderada', 'forte', 'auto'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setRainMode(mode);
                  setRainEnabled(true);
                  handleUpdateEffect(mode);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                  rainMode === mode && rainEnabled
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Snow on Map Card */}
        <div className="bg-white dark:bg-[#16181d] p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                CLIMA E EFEITOS
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black ${snowEnabled ? 'text-sky-600 dark:text-sky-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                  {snowEnabled ? 'Ligado' : 'Desligado'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !snowEnabled;
                    setSnowEnabled(next);
                    handleUpdateEffect(undefined, next ? snowMode : 'off');
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    snowEnabled ? 'bg-sky-500' : 'bg-zinc-200 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      snowEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Snowflake className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-white">Neve no Mapa</h3>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Flocos de neve caindo suavemente do topo da tela sobre a vista 3D e o relevo da Serra da Mantiqueira.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto">
            {(['fraca', 'moderada', 'forte'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setSnowMode(mode);
                  setSnowEnabled(true);
                  handleUpdateEffect(undefined, mode);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                  snowMode === mode && snowEnabled
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding & Referral Insights Section */}
      <div className="bg-white dark:bg-[#16181d] p-6 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <span className="text-[11px] font-black tracking-wider text-blue-600 dark:text-blue-400 uppercase block mb-0.5">
              AQUISIÇÃO & ONBOARDING
            </span>
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">
              Origem dos Usuários & Preferências
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
              Taxa de Conclusão: <strong className="text-blue-600 dark:text-blue-400">{data?.onboarding?.completionRate || 100}%</strong>
            </span>
            <button
              onClick={() => onNavigateTo('users')}
              className="text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Lista Detalhada</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Referral Channels */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-3">
              Canais de Descoberta (Origem)
            </span>
            <div className="space-y-2">
              {data?.onboarding?.referrals && data.onboarding.referrals.length > 0 ? (
                data.onboarding.referrals.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-black text-zinc-700 dark:text-zinc-300">{item.referral_source || 'Direto'}</span>
                    <span className="font-black text-zinc-900 dark:text-white bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Nenhum dado registrado ainda</p>
              )}
            </div>
          </div>

          {/* Travel Styles */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-3">
              Estilos de Viagem
            </span>
            <div className="space-y-2">
              {data?.onboarding?.styles && data.onboarding.styles.length > 0 ? (
                data.onboarding.styles.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-black text-zinc-700 dark:text-zinc-300">{item.travel_style || 'Não informado'}</span>
                    <span className="font-black text-zinc-900 dark:text-white bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Nenhum dado registrado ainda</p>
              )}
            </div>
          </div>

          {/* Travel Frequencies */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-3">
              Frequência de Visitas
            </span>
            <div className="space-y-2">
              {data?.onboarding?.frequencies && data.onboarding.frequencies.length > 0 ? (
                data.onboarding.frequencies.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-black text-zinc-700 dark:text-zinc-300">{item.travel_frequency || 'Não informado'}</span>
                    <span className="font-black text-zinc-900 dark:text-white bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Nenhum dado registrado ainda</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Action Grid */}
      <div className="pt-2">
        <h3 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
          Acesso Rápido aos Módulos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigateTo('spots')}
            className="p-4 bg-white dark:bg-[#16181d] hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left transition-all group cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-black text-zinc-900 dark:text-white">Pontos Turísticos</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{data?.totalSpots !== undefined ? data.totalSpots : 0} locais ativos</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => onNavigateTo('users')}
            className="p-4 bg-white dark:bg-[#16181d] hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left transition-all group cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-black text-zinc-900 dark:text-white">Usuários & Membros</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Gestão de comunidade</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => onNavigateTo('cleanup')}
            className="p-4 bg-white dark:bg-[#16181d] hover:bg-purple-50/50 dark:hover:bg-purple-950/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left transition-all group cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-black text-zinc-900 dark:text-white">Limpeza do Sistema</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Otimização SQLite</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => onNavigateTo('settings')}
            className="p-4 bg-white dark:bg-[#16181d] hover:bg-amber-50/50 dark:hover:bg-amber-950/20 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left transition-all group cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-sm font-black text-zinc-900 dark:text-white">Configurações Gerais</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Links, redes e suporte</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
};
