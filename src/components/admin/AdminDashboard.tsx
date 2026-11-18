import React, { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Users,
  TrendingUp,
  MapPin,
  Eye,
  BarChart2,
  Star,
  Smile,
  Clock,
  CloudRain,
  Snowflake,
  RefreshCw,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import {
  ADMIN_CARD_STYLE,
  ADMIN_MOTION_EASE,
  ADMIN_SHADOWS,
  type AdminChartRange,
} from './adminTheme';
import {
  AdminCommunityActivityChart,
  AdminDestinationViewsChart,
  type ActivityPoint,
  type DestinationViewPoint,
} from './AdminCharts';

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  iconFilled?: boolean;
  label: string;
  value: string | number;
  description: string;
  barGradient: string;
  index: number;
  reducedMotion: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  icon: Icon,
  iconFilled = false,
  label,
  value,
  description,
  barGradient,
  index,
  reducedMotion,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        delay: reducedMotion ? 0 : index * 0.03,
        ease: ADMIN_MOTION_EASE,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-[24px] px-5 pt-5 pb-4 flex flex-col justify-between min-h-[146px]"
      style={{
        ...ADMIN_CARD_STYLE,
        boxShadow: hovered ? ADMIN_SHADOWS.cardHover : ADMIN_SHADOWS.card,
        transform: reducedMotion ? 'none' : hovered ? 'translateY(-2px)' : 'translateY(0px)',
        transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Top Row: Circular Blue Icon + Indicator Label */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
          <Icon
            className={`w-[19px] h-[19px] stroke-[2] ${iconFilled ? 'fill-[#1668FF] text-[#1668FF]' : ''}`}
          />
        </div>
        <span className="text-[14.5px] font-medium text-[#334155] tracking-[-0.01em] leading-snug">
          {label}
        </span>
      </div>

      {/* Main Value + Subtle Description */}
      <div className="mt-4 mb-3">
        <div className="text-[32px] sm:text-[34px] font-bold text-[#0D1526] tracking-[-0.035em] leading-none tabular-nums">
          {value}
        </div>
        <p className="text-[11.5px] font-medium text-[#7B8AA3] mt-1.5 truncate">
          {description}
        </p>
      </div>

      {/* Subtle Bottom Gradient Indicator Bar (Exact match to reference) */}
      <div
        className="w-full h-[3.5px] rounded-full"
        style={{ background: barGradient }}
      />
    </motion.div>
  );
};

export const AdminDashboard: React.FC<{ onNavigateTo: (tab: string) => void }> = ({
  onNavigateTo,
}) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  // Independent real period filters for the two analytical panels
  const [activityRange, setActivityRange] = useState<AdminChartRange>('7d');
  const [destinationRange, setDestinationRange] = useState<AdminChartRange>('7d');

  // Weather & Effects (preserved real controls)
  const [rainMode, setRainMode] = useState<'fraca' | 'moderada' | 'forte' | 'auto'>('auto');
  const [rainEnabled, setRainEnabled] = useState(true);

  const [snowMode, setSnowMode] = useState<'fraca' | 'moderada' | 'forte'>('fraca');
  const [snowEnabled, setSnowEnabled] = useState(true);

  const [savingEffects, setSavingEffects] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success && json.metrics) {
        setData(json.metrics);
        if (json.metrics.effects) {
          if (json.metrics.effects.rainMode) {
            const isOff = json.metrics.effects.rainMode === 'off';
            setRainMode(isOff ? 'auto' : json.metrics.effects.rainMode);
            setRainEnabled(!isOff);
          }
          if (json.metrics.effects.snowMode) {
            const isOff = json.metrics.effects.snowMode === 'off';
            setSnowMode(isOff ? 'fraca' : json.metrics.effects.snowMode);
            setSnowEnabled(!isOff);
          }
        }
      }
    } catch (err) {
      console.error('[AdminDashboard] Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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

  const defaultActivitySeries: Record<AdminChartRange, ActivityPoint[]> = {
    '7d': data?.communityActivity?.['7d'] || [],
    '30d': data?.communityActivity?.['30d'] || [],
    '90d': data?.communityActivity?.['90d'] || [],
  };

  const defaultDestinationViews: Record<AdminChartRange, DestinationViewPoint[]> = {
    '7d': data?.destinationViews?.['7d'] || [],
    '30d': data?.destinationViews?.['30d'] || [],
    '90d': data?.destinationViews?.['90d'] || [],
  };

  const blueBar = 'linear-gradient(90deg, #1668FF 0%, #7BB2FF 62%, #E8F1FF 100%)';
  const violetBar = 'linear-gradient(90deg, #7C3AED 0%, #B388FF 62%, #F3EBFF 100%)';
  const roseBar = 'linear-gradient(90deg, #F43F5E 0%, #FB7185 62%, #FFE4E9 100%)';
  const amberBar = 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 62%, #FEF3C7 100%)';

  const kpiCards: Array<Omit<KpiCardProps, 'index' | 'reducedMotion'>> = [
    {
      icon: Users,
      label: 'Comunidade total',
      value: data?.totalUsers !== undefined ? Number(data.totalUsers).toLocaleString('pt-BR') : '0',
      description: 'usuários cadastrados',
      barGradient: blueBar,
    },
    {
      icon: TrendingUp,
      label: 'Crescimento ativo',
      value: data?.activeUsersCount !== undefined ? Number(data.activeUsersCount).toLocaleString('pt-BR') : '0',
      description: 'ativos nos últimos 7 dias',
      barGradient: blueBar,
    },
    {
      icon: MapPin,
      label: 'Destinos',
      value: data?.totalSpots !== undefined ? Number(data.totalSpots).toLocaleString('pt-BR') : '0',
      description: 'catálogo ativo no mapa',
      barGradient: blueBar,
    },
    {
      icon: Eye,
      label: 'Visualizações totais',
      value: data?.viewsTotal !== undefined ? Number(data.viewsTotal).toLocaleString('pt-BR') : '0',
      description: 'visualizações registradas',
      barGradient: blueBar,
    },
    {
      icon: BarChart2,
      label: 'Engajamento',
      value: data?.engagementTotal !== undefined ? Number(data.engagementTotal).toLocaleString('pt-BR') : '0',
      description: 'interações reais no app',
      barGradient: violetBar,
    },
    {
      icon: Star,
      iconFilled: true,
      label: 'Avaliações',
      value: data?.totalReviews !== undefined ? Number(data.totalReviews).toLocaleString('pt-BR') : '0',
      description: 'avaliações publicadas',
      barGradient: roseBar,
    },
    {
      icon: Smile,
      label: 'Satisfação',
      value: data?.satisfactionScore ? `${data.satisfactionScore} / 5` : '0 / 5',
      description:
        data?.totalReviews > 0
          ? `média de ${data.totalReviews} avaliações`
          : 'sem avaliações registradas',
      barGradient: blueBar,
    },
    {
      icon: Clock,
      label: 'Média de sessão',
      value: data?.avgSessionDuration || '0m',
      description: 'tempo estimado de uso',
      barGradient: amberBar,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0D1526] text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-white/10">
          <CheckCircle className="w-4 h-4 text-[#4F93FF]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header (Reference composition: Blue Dot + Painel de Controle + Atualizar floating pill) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1668FF] shrink-0 shadow-[0_0_10px_rgba(22,104,255,0.45)]" />
            <h1 className="text-[28px] sm:text-[36px] lg:text-[40px] font-bold text-[#0D1526] tracking-[-0.03em] leading-[1.1]">
              Painel de Controle
            </h1>
          </div>
          <p className="text-[14.5px] sm:text-[15.5px] font-normal text-[#5B6B85] mt-1.5 sm:pl-[22px]">
            Visão geral do seu ecossistema turístico.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDashboardData}
          disabled={refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white border border-white/95 text-[#0D1526] text-[14px] font-semibold cursor-pointer select-none transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-70"
          style={{ boxShadow: ADMIN_SHADOWS.floatingPill }}
        >
          <RefreshCw
            className={`w-4 h-4 text-[#0D1526] ${refreshing ? 'animate-spin text-[#1668FF]' : ''}`}
          />
          <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
        </button>
      </div>

      {/* 8 KPI Cards Grid (4 cols × 2 rows on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {kpiCards.map((card, idx) => (
          <KpiCard
            key={card.label}
            {...card}
            index={idx}
            reducedMotion={prefersReducedMotion}
          />
        ))}
      </div>

      {/* Two Equal-Height Analytical Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <AdminCommunityActivityChart
          seriesByRange={defaultActivitySeries}
          range={activityRange}
          onRangeChange={setActivityRange}
          loading={loading}
        />
        <AdminDestinationViewsChart
          destinationsByRange={defaultDestinationViews}
          range={destinationRange}
          onRangeChange={setDestinationRange}
          loading={loading}
        />
      </div>

      {/* Preserved Real Controls: Clima & Efeitos no Mapa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-1">
        {/* Rain on Map Card */}
        <div
          className="rounded-[24px] p-6 flex flex-col justify-between"
          style={ADMIN_CARD_STYLE}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
                  <CloudRain className="w-[19px] h-[19px]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#0D1526] tracking-[-0.015em]">
                    Chuva no Mapa
                  </h3>
                  <span className="text-[11.5px] font-medium text-[#7B8AA3]">
                    Clima e efeitos em tempo real
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span
                  className={`text-xs font-semibold ${
                    rainEnabled ? 'text-[#1668FF]' : 'text-[#7B8AA3]'
                  }`}
                >
                  {rainEnabled ? 'Ligado' : 'Desligado'}
                </span>
                <button
                  type="button"
                  disabled={savingEffects}
                  onClick={() => {
                    const next = !rainEnabled;
                    setRainEnabled(next);
                    handleUpdateEffect(next ? rainMode : 'off');
                  }}
                  aria-label="Alternar efeito de chuva no mapa"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    rainEnabled ? 'bg-[#1668FF]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                      rainEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="text-[13px] text-[#5B6B85] leading-relaxed">
              Quando desligada, segue o clima real de Campos do Jordão. No modo automático, ativa apenas quando chove e o usuário está na cidade.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            {(['fraca', 'moderada', 'forte', 'auto'] as const).map((mode) => {
              const active = rainMode === mode && rainEnabled;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={savingEffects}
                  onClick={() => {
                    setRainMode(mode);
                    setRainEnabled(true);
                    handleUpdateEffect(mode);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold capitalize transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                    active
                      ? 'bg-[#1668FF] text-white shadow-[0_6px_14px_-4px_rgba(22,104,255,0.45)]'
                      : 'bg-[#F4F7FC] hover:bg-[#EBF2FF] text-[#334155]'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* Snow on Map Card */}
        <div
          className="rounded-[24px] p-6 flex flex-col justify-between"
          style={ADMIN_CARD_STYLE}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
                  <Snowflake className="w-[19px] h-[19px]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#0D1526] tracking-[-0.015em]">
                    Neve no Mapa
                  </h3>
                  <span className="text-[11.5px] font-medium text-[#7B8AA3]">
                    Efeito atmosférico na Serra
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span
                  className={`text-xs font-semibold ${
                    snowEnabled ? 'text-[#1668FF]' : 'text-[#7B8AA3]'
                  }`}
                >
                  {snowEnabled ? 'Ligado' : 'Desligado'}
                </span>
                <button
                  type="button"
                  disabled={savingEffects}
                  onClick={() => {
                    const next = !snowEnabled;
                    setSnowEnabled(next);
                    handleUpdateEffect(undefined, next ? snowMode : 'off');
                  }}
                  aria-label="Alternar efeito de neve no mapa"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    snowEnabled ? 'bg-[#1668FF]' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                      snowEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="text-[13px] text-[#5B6B85] leading-relaxed">
              Flocos de neve caindo suavemente sobre a vista 3D e o relevo da Serra da Mantiqueira.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            {(['fraca', 'moderada', 'forte'] as const).map((mode) => {
              const active = snowMode === mode && snowEnabled;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={savingEffects}
                  onClick={() => {
                    setSnowMode(mode);
                    setSnowEnabled(true);
                    handleUpdateEffect(undefined, mode);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold capitalize transition-all duration-200 cursor-pointer active:scale-[0.97] ${
                    active
                      ? 'bg-[#1668FF] text-white shadow-[0_6px_14px_-4px_rgba(22,104,255,0.45)]'
                      : 'bg-[#F4F7FC] hover:bg-[#EBF2FF] text-[#334155]'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preserved Onboarding & Audience Insights */}
      <div className="rounded-[24px] p-6" style={ADMIN_CARD_STYLE}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-[17px] font-bold text-[#0D1526] tracking-[-0.015em]">
              Origem dos Usuários & Preferências
            </h3>
            <p className="text-[12.5px] text-[#7B8AA3] mt-0.5">
              Dados reais de onboarding da comunidade Monvian.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#475569] bg-[#F4F7FC] px-3.5 py-1.5 rounded-full">
              Conclusão:{' '}
              <strong className="text-[#1668FF] font-bold">
                {data?.onboarding?.completionRate ?? 0}%
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigateTo('users')}
              className="text-xs font-semibold text-[#1668FF] hover:text-[#0F5AE6] inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Ver Usuários</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#F7F9FD] border border-slate-100">
            <span className="text-[11.5px] font-semibold text-[#64748B] block mb-3">
              Relação com Campos
            </span>
            <div className="space-y-2">
              {data?.onboarding?.referrals && data.onboarding.referrals.length > 0 ? (
                data.onboarding.referrals.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#334155] truncate pr-2">
                      {item.referral_source || 'Direto'}
                    </span>
                    <span className="font-bold text-[#0D1526] bg-white px-2.5 py-0.5 rounded-full shadow-2xs border border-slate-100">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#7B8AA3]">Nenhum dado registrado ainda</p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F7F9FD] border border-slate-100">
            <span className="text-[11.5px] font-semibold text-[#64748B] block mb-3">
              Companhia de Viagem
            </span>
            <div className="space-y-2">
              {data?.onboarding?.styles && data.onboarding.styles.length > 0 ? (
                data.onboarding.styles.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#334155] truncate pr-2">
                      {item.travel_style || 'Não informado'}
                    </span>
                    <span className="font-bold text-[#0D1526] bg-white px-2.5 py-0.5 rounded-full shadow-2xs border border-slate-100">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#7B8AA3]">Nenhum dado registrado ainda</p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F7F9FD] border border-slate-100">
            <span className="text-[11.5px] font-semibold text-[#64748B] block mb-3">
              Previsão de Visita
            </span>
            <div className="space-y-2">
              {data?.onboarding?.frequencies && data.onboarding.frequencies.length > 0 ? (
                data.onboarding.frequencies.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#334155] truncate pr-2">
                      {item.travel_frequency || 'Não informado'}
                    </span>
                    <span className="font-bold text-[#0D1526] bg-white px-2.5 py-0.5 rounded-full shadow-2xs border border-slate-100">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#7B8AA3]">Nenhum dado registrado ainda</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
