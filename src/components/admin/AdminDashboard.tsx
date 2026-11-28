import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Menu,
  Calendar,
  ChevronDown,
  ChevronRight,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Trophy,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  AlertCircle,
  Map as MapIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export type DashboardPeriodKey =
  | '7d'
  | '30d'
  | '90d'
  | 'this_month'
  | 'last_month'
  | 'all'
  | 'custom';

interface EvolutionPoint {
  key: string;
  label: string;
  fullLabel: string;
  revenueCents: number;
  revenueReais: number;
  feesCents: number;
  refundsCents: number;
  salesCount: number;
  approvedOrdersCount: number;
}

interface TopItineraryItem {
  rank: number;
  id: string;
  title: string;
  subtitle: string;
  coverImage: string;
  salesCount: number;
  revenueCents: number;
  revenueReais: number;
  platanosTotal: number;
}

interface FinancialDashboardPayload {
  success: boolean;
  period: {
    key: DashboardPeriodKey;
    label: string;
    startDate: string;
    endDate: string;
    bucketMode: 'day' | 'week' | 'month';
  };
  stripe: {
    configured: boolean;
    livemode: boolean;
    hasWebhookSecret: boolean;
    currency: string;
    lastSyncedAt: string | null;
  };
  revenue: {
    totalCents: number;
    grossCents: number;
    feesCents: number;
    refundsCents: number;
    netCents: number;
    availableBalanceCents: number;
    pendingBalanceCents: number;
    currency: string;
    deltaPct: number | null;
    trend: 'up' | 'down' | 'neutral';
    hasBaseline: boolean;
    sparkline: number[];
  };
  sales: {
    itinerarySalesCount: number;
    approvedPaymentsCount: number;
    deltaPct: number | null;
    trend: 'up' | 'down' | 'neutral';
    hasBaseline: boolean;
    bars: number[];
  };
  evolution: {
    series: EvolutionPoint[];
  };
  topItineraries: TopItineraryItem[];
  syncError?: string | null;
}

interface AdminDashboardProps {
  currentUser?: any;
  onOpenMobileMenu?: () => void;
  onOpenFinancialDetails?: () => void;
}

const PERIOD_OPTIONS: Array<{ key: DashboardPeriodKey; label: string }> = [
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: '90d', label: 'Últimos 90 dias' },
  { key: 'this_month', label: 'Este mês' },
  { key: 'last_month', label: 'Mês anterior' },
  { key: 'all', label: 'Todo o período' },
  { key: 'custom', label: 'Período personalizado' },
];

const EASE_IOS = [0.22, 1, 0.36, 1] as const;

const CARD_SHADOW =
  '0 14px 34px -14px rgba(22, 104, 255, 0.08), 0 4px 16px -4px rgba(15, 23, 42, 0.045)';
const PILL_SHADOW =
  '0 8px 22px -6px rgba(15, 23, 42, 0.09), 0 1px 4px rgba(15, 23, 42, 0.04)';

function formatBRLFromCents(cents: number, currency = 'brl'): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: (currency || 'brl').toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe / 100);
  } catch {
    return `R$ ${(safe / 100).toFixed(2).replace('.', ',')}`;
  }
}

function formatCompactAxis(value: number, isCurrency: boolean): string {
  if (value === 0) return '0';
  if (value >= 1000) {
    const k = value / 1000;
    const formatted = Number.isInteger(k) ? `${k}k` : `${k.toFixed(1).replace('.', ',')}k`;
    return isCurrency ? `R$${formatted}` : formatted;
  }
  return isCurrency ? `R$${Math.round(value)}` : String(Math.round(value));
}

function getAuthHeaders(currentUser?: any): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem('monvian_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const storedUserRaw = localStorage.getItem('monvian_user');
    const storedEmail = storedUserRaw ? JSON.parse(storedUserRaw)?.email : '';
    const email = currentUser?.email || storedEmail || '';
    if (email) headers['x-user-email'] = email;
  } catch {}
  return headers;
}

/**
 * Animated number counter (starts at 0 and counts smoothly to real value;
 * respects prefers-reduced-motion and never displays invented data).
 */
function useAnimatedNumber(target: number, enabled: boolean, durationMs = 680): number {
  const [display, setDisplay] = useState<number>(enabled ? 0 : target);
  const prevRef = useRef<number>(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      prevRef.current = target;
      setDisplay(target);
      return;
    }

    const from = prevRef.current;
    const delta = target - from;
    if (Math.abs(delta) < 0.001) {
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + delta * eased;
      setDisplay(next);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
        setDisplay(target);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, enabled, durationMs]);

  return display;
}

/**
 * Generates a smooth monotone-like cubic Bezier SVG path through points.
 */
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const ShimmerBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded-xl bg-[#EAF0F9] ${className}`}>
    <div
      className="absolute inset-0 -translate-x-full animate-ios-shimmer"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.72) 50%, transparent 100%)',
      }}
    />
  </div>
);

interface PeriodDropdownProps {
  period: DashboardPeriodKey;
  periodLabel: string;
  customStart: string;
  customEnd: string;
  onSelectPeriod: (next: DashboardPeriodKey) => void;
  onApplyCustom: (start: string, end: string) => void;
  compact?: boolean;
  align?: 'right' | 'left';
}

const PeriodSelectorButton: React.FC<PeriodDropdownProps> = ({
  period,
  periodLabel,
  customStart,
  customEnd,
  onSelectPeriod,
  onApplyCustom,
  compact = false,
  align = 'right',
}) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [showCustomInputs, setShowCustomInputs] = useState(period === 'custom');
  const [draftStart, setDraftStart] = useState(customStart);
  const [draftEnd, setDraftEnd] = useState(customEnd);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftStart(customStart);
    setDraftEnd(customEnd);
  }, [customStart, customEnd]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative z-30 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Período: ${periodLabel}`}
        className={`flex items-center justify-center gap-2 rounded-full bg-white text-[#1E293B] border border-[#E7EEF9] cursor-pointer select-none transition-all duration-200 active:scale-95 ${
          compact ? 'h-9 px-3.5' : 'h-12 px-4 sm:px-5'
        }`}
        style={{ boxShadow: compact ? '0 4px 14px -4px rgba(15, 23, 42, 0.08)' : PILL_SHADOW }}
      >
        <Calendar className={compact ? 'w-4 h-4 text-[#1E293B]' : 'w-[19px] h-[19px] text-[#0D1526]'} />
        {!compact && (
          <span className="hidden sm:inline text-[13.5px] font-semibold text-[#1E293B] tracking-[-0.01em]">
            {periodLabel}
          </span>
        )}
        <ChevronDown
          className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-[#475569] transition-transform duration-200 ${
            open ? 'rotate-180 text-[#1668FF]' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE_IOS }}
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2.5 w-[256px] rounded-[22px] bg-white border border-[#E5ECF8] p-2 z-50 origin-top-right`}
            style={{
              boxShadow:
                '0 22px 48px -12px rgba(15, 23, 42, 0.16), 0 4px 14px -2px rgba(15, 23, 42, 0.06)',
            }}
          >
            <div className="px-3 pt-1.5 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#94A3B8]">
              Selecionar período
            </div>
            <div className="space-y-0.5">
              {PERIOD_OPTIONS.map((opt) => {
                const isSelected = period === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (opt.key === 'custom') {
                        setShowCustomInputs(true);
                      } else {
                        setShowCustomInputs(false);
                        onSelectPeriod(opt.key);
                        setOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[14px] text-[13.5px] font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EBF3FF] text-[#1668FF]'
                        : 'text-[#1E293B] hover:bg-[#F5F8FD]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#1668FF] shrink-0" />}
                  </button>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {showCustomInputs && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: EASE_IOS }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 pt-2.5 px-2 pb-1.5 border-t border-[#EEF3FA] space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        Data inicial
                      </label>
                      <input
                        type="date"
                        value={draftStart}
                        onChange={(e) => setDraftStart(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl bg-[#F5F8FD] border border-[#E2E9F5] text-[13px] font-medium text-[#0D1526] outline-none focus:border-[#1668FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        Data final
                      </label>
                      <input
                        type="date"
                        value={draftEnd}
                        onChange={(e) => setDraftEnd(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl bg-[#F5F8FD] border border-[#E2E9F5] text-[13px] font-medium text-[#0D1526] outline-none focus:border-[#1668FF]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!draftStart || !draftEnd}
                      onClick={() => {
                        if (draftStart && draftEnd) {
                          onApplyCustom(draftStart, draftEnd);
                          setOpen(false);
                        }
                      }}
                      className="w-full h-9 rounded-xl bg-[#1668FF] hover:bg-[#1057DB] disabled:opacity-45 text-white text-[13px] font-semibold transition-colors cursor-pointer"
                    >
                      Aplicar período
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// MINI REVENUE SPARKLINE (Inside Faturamento Total Card)
// ============================================================================
const RevenueSparkline: React.FC<{
  values: number[];
  reducedMotion: boolean;
}> = ({ values, reducedMotion }) => {
  const width = 122;
  const height = 62;
  const padX = 8;
  const padTop = 10;
  const padBottom = 10;

  const safeValues = values.length >= 2 ? values : [0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...safeValues, 0);
  const minVal = Math.min(...safeValues, 0);
  const span = maxVal - minVal;

  const coords = safeValues.map((val, idx) => {
    const x = padX + (idx / Math.max(1, safeValues.length - 1)) * (width - padX * 2);
    const ratio = span > 0 ? (val - minVal) / span : 0.12;
    const y = padTop + (1 - ratio) * (height - padTop - padBottom);
    return { x, y };
  });

  const linePath = buildSmoothPath(coords);
  const lastPt = coords[coords.length - 1];
  const firstPt = coords[0];
  const areaPath =
    coords.length >= 2
      ? `${linePath} L ${lastPt.x.toFixed(2)} ${height} L ${firstPt.x.toFixed(2)} ${height} Z`
      : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-[104px] sm:w-[132px] h-[54px] sm:h-[64px] shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="monvianRevSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1668FF" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#1668FF" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {areaPath && (
        <motion.path
          d={areaPath}
          fill="url(#monvianRevSparkFill)"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, ease: EASE_IOS }}
        />
      )}
      {linePath && (
        <motion.path
          d={linePath}
          fill="none"
          stroke="#1668FF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reducedMotion ? false : { pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.72, ease: EASE_IOS }}
        />
      )}
      {lastPt && (
        <motion.g
          initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, delay: reducedMotion ? 0 : 0.45, ease: EASE_IOS }}
        >
          <circle cx={lastPt.x} cy={lastPt.y} r="7.5" fill="#1668FF" fillOpacity="0.16" />
          <circle cx={lastPt.x} cy={lastPt.y} r="4.5" fill="#FFFFFF" stroke="#1668FF" strokeWidth="2.3" />
        </motion.g>
      )}
    </svg>
  );
};

// ============================================================================
// MINI ASCENDING BAR CHART (Inside Vendas de Roteiros Card)
// ============================================================================
const SalesMiniBars: React.FC<{
  bars: number[];
  reducedMotion: boolean;
}> = ({ bars, reducedMotion }) => {
  const safeBars = bars.length > 0 ? bars.slice(-7) : [0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...safeBars, 0);

  return (
    <div
      className="flex items-end gap-[5px] sm:gap-[6px] h-[54px] sm:h-[60px] shrink-0 pt-2"
      aria-hidden="true"
    >
      {safeBars.map((val, idx) => {
        const hasAnySales = maxVal > 0;
        const heightPct = hasAnySales
          ? Math.max(16, Math.round((val / maxVal) * 100))
          : 18 + idx * 7; // subtle quiet baseline structure when 0 sales (very faint opacity)
        const opacity = hasAnySales
          ? 0.35 + (idx / Math.max(1, safeBars.length - 1)) * 0.65
          : 0.22 + idx * 0.04;

        return (
          <motion.div
            key={idx}
            initial={reducedMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{
              duration: 0.45,
              delay: reducedMotion ? 0 : idx * 0.045,
              ease: EASE_IOS,
            }}
            style={{
              height: `${heightPct}%`,
              opacity,
              transformOrigin: 'bottom center',
              background:
                'linear-gradient(180deg, #1668FF 0%, rgba(22, 104, 255, 0.32) 100%)',
            }}
            className="w-[7px] sm:w-[8.5px] rounded-full"
          />
        );
      })}
    </div>
  );
};

// ============================================================================
// MAIN INTERACTIVE EVOLUTION CHART (Evolução das Vendas)
// ============================================================================
const SalesEvolutionChart: React.FC<{
  series: EvolutionPoint[];
  currency: string;
  reducedMotion: boolean;
}> = ({ series, currency, reducedMotion }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Determine whether to plot revenue (R$) or sales count (prefer revenue when > 0, else sales count)
  const totalRevenue = useMemo(
    () => series.reduce((acc, p) => acc + p.revenueReais, 0),
    [series]
  );
  const totalSales = useMemo(
    () => series.reduce((acc, p) => acc + p.salesCount, 0),
    [series]
  );
  const plotMode: 'revenue' | 'sales' = totalRevenue > 0 || totalSales === 0 ? 'revenue' : 'sales';

  const values = useMemo(
    () => series.map((p) => (plotMode === 'revenue' ? p.revenueReais : p.salesCount)),
    [series, plotMode]
  );

  const maxRaw = Math.max(...values, 0);
  // Compute clean 3-step Y axis max (e.g. 0, 100, 200, 300)
  const yMax = useMemo(() => {
    if (maxRaw <= 0) return plotMode === 'revenue' ? 300 : 30;
    const rough = maxRaw * 1.18;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / magnitude;
    let nice = 1;
    if (normalized <= 1.2) nice = 1.2;
    else if (normalized <= 1.5) nice = 1.5;
    else if (normalized <= 2.4) nice = 2.4;
    else if (normalized <= 3) nice = 3;
    else if (normalized <= 6) nice = 6;
    else if (normalized <= 9) nice = 9;
    else nice = 12;
    return Math.ceil(nice * magnitude);
  }, [maxRaw, plotMode]);

  const yTicks = [0, Math.round(yMax / 3), Math.round((yMax * 2) / 3), yMax];

  const viewW = 600;
  const viewH = 228;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 36;
  const chartW = viewW - padLeft - padRight;
  const chartH = viewH - padTop - padBottom;

  const coords = useMemo(() => {
    if (series.length === 0) return [];
    return series.map((pt, idx) => {
      const x =
        series.length === 1
          ? padLeft + chartW / 2
          : padLeft + (idx / (series.length - 1)) * chartW;
      const val = plotMode === 'revenue' ? pt.revenueReais : pt.salesCount;
      const ratio = yMax > 0 ? Math.min(1, Math.max(0, val / yMax)) : 0;
      const y = padTop + (1 - ratio) * chartH;
      return { x, y, pt, val, idx };
    });
  }, [series, plotMode, yMax, chartW, chartH]);

  const linePath = useMemo(() => buildSmoothPath(coords), [coords]);
  const areaPath = useMemo(() => {
    if (coords.length < 2) return '';
    const baselineY = padTop + chartH;
    return `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${baselineY} L ${coords[0].x.toFixed(2)} ${baselineY} Z`;
  }, [coords, linePath, chartH]);

  // Decide which X labels to show so they never overlap
  const visibleLabelIndices = useMemo(() => {
    const n = series.length;
    if (n <= 8) return new Set(series.map((_, i) => i));
    const desired = 6;
    const set = new Set<number>([0, n - 1]);
    const step = (n - 1) / desired;
    for (let i = 1; i < desired; i++) {
      set.add(Math.round(i * step));
    }
    return set;
  }, [series]);

  const showAllDots = series.length <= 14;
  const highlightedIdx = activeIndex !== null ? activeIndex : coords.length - 1;
  const activePoint = activeIndex !== null ? coords[activeIndex] : null;

  const handlePointerInteract = (clientX: number) => {
    if (!svgRef.current || coords.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / Math.max(1, rect.width)) * viewW;
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const dist = Math.abs(coords[i].x - relX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    setActiveIndex(nearest);
  };

  return (
    <div className="relative w-full select-none">
      {/* Interactive Tooltip Banner */}
      <AnimatePresence>
        {activePoint && (
          <motion.div
            key={activePoint.pt.key}
            initial={reducedMotion ? false : { opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 2, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute -top-2 z-20 px-3 py-2 rounded-2xl bg-[#0D1526] text-white shadow-lg"
            style={{
              left: `clamp(8px, calc(${(activePoint.x / viewW) * 100}% - 74px), calc(100% - 168px))`,
              minWidth: '154px',
            }}
          >
            <p className="text-[11px] font-medium text-slate-300 leading-tight">
              {activePoint.pt.fullLabel}
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-bold tabular-nums">
                {formatBRLFromCents(activePoint.pt.revenueCents, currency)}
              </span>
              <span className="text-[11px] font-semibold text-[#7CB0FF] tabular-nums">
                {activePoint.pt.salesCount}{' '}
                {activePoint.pt.salesCount === 1 ? 'venda' : 'vendas'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-[200px] sm:h-[232px] overflow-visible touch-pan-y"
        onMouseMove={(e) => handlePointerInteract(e.clientX)}
        onMouseLeave={() => setActiveIndex(null)}
        onTouchStart={(e) => {
          if (e.touches[0]) handlePointerInteract(e.touches[0].clientX);
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) handlePointerInteract(e.touches[0].clientX);
        }}
        onTouchEnd={() => setTimeout(() => setActiveIndex(null), 1600)}
      >
        <defs>
          <linearGradient id="monvianEvolutionArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1668FF" stopOpacity="0.24" />
            <stop offset="85%" stopColor="#1668FF" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#1668FF" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines & Y axis labels */}
        {yTicks.map((tick) => {
          const y = padTop + (1 - tick / Math.max(1, yMax)) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                x2={viewW - padRight}
                y1={y}
                y2={y}
                stroke="#EDF2FA"
                strokeWidth="1.2"
              />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                fill="#7B8BA3"
                fontSize="12"
                fontWeight="500"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCompactAxis(tick, plotMode === 'revenue' && maxRaw > 0)}
              </text>
            </g>
          );
        })}

        {/* Subtle vertical guide lines at visible X ticks */}
        {coords.map((c) =>
          visibleLabelIndices.has(c.idx) ? (
            <line
              key={`vg-${c.pt.key}`}
              x1={c.x}
              x2={c.x}
              y1={padTop}
              y2={padTop + chartH}
              stroke="#F3F6FC"
              strokeWidth="1"
            />
          ) : null
        )}

        {/* Active vertical hover rule */}
        {activePoint && (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padTop}
            y2={padTop + chartH}
            stroke="#1668FF"
            strokeOpacity="0.28"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}

        {/* Shaded area under curve */}
        {areaPath && (
          <motion.path
            key={`area-${series.map((s) => s.key).join('|')}`}
            d={areaPath}
            fill="url(#monvianEvolutionArea)"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE_IOS }}
          />
        )}

        {/* Main blue line */}
        {linePath && (
          <motion.path
            key={`line-${series.map((s) => s.key).join('|')}`}
            d={linePath}
            fill="none"
            stroke="#1668FF"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0.45 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.85, ease: EASE_IOS }}
          />
        )}

        {/* Interactive circular points */}
        {coords.map((c) => {
          const isHighlighted = c.idx === highlightedIdx;
          if (!showAllDots && !isHighlighted && c.val === 0) return null;
          return (
            <g key={`pt-${c.pt.key}`}>
              {isHighlighted && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="10"
                  fill="#1668FF"
                  fillOpacity="0.14"
                />
              )}
              <motion.circle
                cx={c.x}
                cy={c.y}
                r={isHighlighted ? 5.8 : 4.2}
                fill={isHighlighted ? '#FFFFFF' : '#1668FF'}
                stroke={isHighlighted ? '#1668FF' : '#FFFFFF'}
                strokeWidth={isHighlighted ? 2.6 : 2}
                initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.25,
                  delay: reducedMotion ? 0 : Math.min(0.55, c.idx * 0.045),
                  ease: EASE_IOS,
                }}
              />
            </g>
          );
        })}

        {/* X Axis Labels */}
        {coords.map((c) =>
          visibleLabelIndices.has(c.idx) ? (
            <text
              key={`xl-${c.pt.key}`}
              x={c.x}
              y={viewH - 8}
              textAnchor="middle"
              fill={activeIndex === c.idx ? '#1668FF' : '#7B8BA3'}
              fontSize="12"
              fontWeight={activeIndex === c.idx ? '700' : '500'}
            >
              {c.pt.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
};

// ============================================================================
// RANK BADGE & ITINERARY THUMBNAIL ROW
// ============================================================================
const RANK_BADGE_COLORS: Record<number, string> = {
  1: '#F59E0B', // Gold
  2: '#94A3B8', // Silver
  3: '#C2783B', // Bronze
};

const TopItineraryRow: React.FC<{
  item: TopItineraryItem;
  currency: string;
  index: number;
  reducedMotion: boolean;
}> = ({ item, currency, index, reducedMotion }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const badgeBg = RANK_BADGE_COLORS[item.rank] || '#64748B';

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reducedMotion ? 0 : index * 0.05, ease: EASE_IOS }}
      className="flex items-center justify-between gap-3.5 py-2.5 first:pt-1 last:pb-0"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Cover Thumbnail + Rank Circle */}
        <div className="relative w-[78px] h-[54px] sm:w-[86px] sm:h-[58px] shrink-0">
          <div className="w-full h-full rounded-[14px] overflow-hidden bg-[#EAF1FB] ring-1 ring-black/[0.04]">
            {item.coverImage && !imgFailed ? (
              <img
                src={item.coverImage}
                alt={item.title}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#DCE9FF] to-[#EEF4FD] text-[#1668FF]">
                <MapIcon className="w-5 h-5" />
              </div>
            )}
          </div>
          <span
            style={{ backgroundColor: badgeBg }}
            className="absolute -top-1.5 -left-1.5 w-[23px] h-[23px] rounded-full text-white text-[12px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white tabular-nums"
          >
            {item.rank}
          </span>
        </div>

        {/* Title & Revenue Subtitle */}
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] sm:text-[15.5px] font-bold text-[#0D1526] tracking-[-0.015em] truncate leading-snug">
            {item.title}
          </h3>
          <p className="text-[13px] font-medium text-[#64748B] truncate mt-0.5 tabular-nums">
            {formatBRLFromCents(item.revenueCents, currency)}
            {item.subtitle ? ` · ${item.subtitle}` : ''}
          </p>
        </div>
      </div>

      {/* Sales Count Pill */}
      <div className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#EEF3FB] text-[#0D1526] text-[13px] font-bold tracking-[-0.01em] tabular-nums">
        {item.salesCount} {item.salesCount === 1 ? 'venda' : 'vendas'}
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN FINANCIAL ADMIN DASHBOARD
// ============================================================================
export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onOpenMobileMenu,
  onOpenFinancialDetails,
}) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [period, setPeriod] = useState<DashboardPeriodKey>('7d');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [data, setData] = useState<FinancialDashboardPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAllItinerariesOpen, setIsAllItinerariesOpen] = useState<boolean>(false);

  const periodRef = useRef(period);
  const customStartRef = useRef(customStart);
  const customEndRef = useRef(customEnd);
  periodRef.current = period;
  customStartRef.current = customStart;
  customEndRef.current = customEnd;

  const fetchDashboardMetrics = useCallback(
    async (opts?: {
      nextPeriod?: DashboardPeriodKey;
      nextStart?: string;
      nextEnd?: string;
      forceSync?: boolean;
      silent?: boolean;
    }) => {
      const targetPeriod = opts?.nextPeriod ?? periodRef.current;
      const targetStart = opts?.nextStart ?? customStartRef.current;
      const targetEnd = opts?.nextEnd ?? customEndRef.current;

      if (!opts?.silent) {
        if (!data) setLoading(true);
        else setIsRefreshing(true);
      }

      try {
        const qs = new URLSearchParams({ period: targetPeriod });
        if (targetPeriod === 'custom' && targetStart && targetEnd) {
          qs.set('startDate', targetStart);
          qs.set('endDate', targetEnd);
        }
        if (opts?.forceSync) {
          qs.set('sync', '1');
        }

        const res = await fetch(`/api/admin/dashboard/financial?${qs.toString()}`, {
          credentials: 'include',
          headers: getAuthHeaders(currentUser),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Falha ao carregar dados (${res.status})`);
        }

        const json = (await res.json()) as FinancialDashboardPayload;
        setData(json);
        setErrorMsg(null);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Não foi possível carregar os dados financeiros.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUser, data]
  );

  // Initial load with real Stripe sync
  useEffect(() => {
    fetchDashboardMetrics({ forceSync: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time Server-Sent Events (SSE) subscription for instant auto-updates on Stripe webhooks/sales
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        const token = localStorage.getItem('monvian_token') || '';
        const url = token
          ? `/api/admin/dashboard/financial/stream?token=${encodeURIComponent(token)}`
          : '/api/admin/dashboard/financial/stream';
        es = new EventSource(url, { withCredentials: true });
        es.addEventListener('financial_update', () => {
          fetchDashboardMetrics({ silent: true });
        });
        es.onerror = () => {
          es?.close();
          if (!closed && typeof document !== 'undefined' && !document.hidden) {
            reconnectTimer = setTimeout(connect, 15000);
          } else if (!closed) {
            reconnectTimer = setTimeout(connect, 30000);
          }
        };
      } catch {}
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optional Supabase Realtime subscription for multi-instance sync
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('monvian-financial-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platanos_stripe_orders' },
        () => {
          fetchDashboardMetrics({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platanos_itinerary_unlocks' },
        () => {
          fetchDashboardMetrics({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close Bottom Sheet on Escape
  useEffect(() => {
    if (!isAllItinerariesOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAllItinerariesOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isAllItinerariesOpen]);

  const handleSelectPeriod = (next: DashboardPeriodKey) => {
    setPeriod(next);
    fetchDashboardMetrics({ nextPeriod: next });
  };

  const handleApplyCustom = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPeriod('custom');
    fetchDashboardMetrics({ nextPeriod: 'custom', nextStart: start, nextEnd: end });
  };

  const animatedRevenueCents = useAnimatedNumber(
    data?.revenue.totalCents ?? 0,
    !prefersReducedMotion && !loading
  );
  const animatedGrossCents = useAnimatedNumber(
    data?.revenue.grossCents ?? 0,
    !prefersReducedMotion && !loading
  );
  const animatedFeesCents = useAnimatedNumber(
    data?.revenue.feesCents ?? 0,
    !prefersReducedMotion && !loading
  );
  const animatedRefundsCents = useAnimatedNumber(
    data?.revenue.refundsCents ?? 0,
    !prefersReducedMotion && !loading
  );
  const animatedAvailableBalanceCents = useAnimatedNumber(
    data?.revenue.availableBalanceCents ?? 0,
    !prefersReducedMotion && !loading
  );
  const animatedSalesCount = useAnimatedNumber(
    data?.sales.itinerarySalesCount ?? 0,
    !prefersReducedMotion && !loading
  );

  const currency = data?.revenue.currency || 'brl';
  const periodLabel =
    data?.period.label ||
    PERIOD_OPTIONS.find((p) => p.key === period)?.label ||
    'Últimos 7 dias';

  const topThree = useMemo(
    () => (data?.topItineraries || []).slice(0, 3),
    [data?.topItineraries]
  );

  const renderDeltaLine = (
    deltaPct: number | null | undefined,
    trend: 'up' | 'down' | 'neutral' | undefined,
    hasBaseline: boolean | undefined
  ) => {
    if (deltaPct === null || deltaPct === undefined) {
      return (
        <p className="text-[12.5px] font-medium text-[#7B8BA3] mt-1">
          Histórico completo selecionado
        </p>
      );
    }
    if (!hasBaseline && deltaPct === 0) {
      return (
        <p className="text-[12.5px] font-medium text-[#7B8BA3] mt-1">
          0% em relação ao período anterior
        </p>
      );
    }

    const isUp = trend === 'up';
    const isDown = trend === 'down';
    const sign = deltaPct > 0 ? '+' : '';
    const formattedPct = Number.isInteger(deltaPct)
      ? `${sign}${deltaPct}%`
      : `${sign}${deltaPct.toFixed(1).replace('.', ',')}%`;

    return (
      <div className="flex items-center gap-1 mt-1 text-[12.5px] leading-snug">
        {isUp && <ArrowUp className="w-3.5 h-3.5 text-[#10B981] shrink-0 stroke-[2.5]" />}
        {isDown && <ArrowDown className="w-3.5 h-3.5 text-[#EF4444] shrink-0 stroke-[2.5]" />}
        <span
          className={`font-bold tabular-nums ${
            isUp ? 'text-[#10B981]' : isDown ? 'text-[#EF4444]' : 'text-[#64748B]'
          }`}
        >
          {formattedPct}
        </span>
        <span className="font-medium text-[#64748B] truncate">
          em relação ao período anterior
        </span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[920px] mx-auto pb-8">
      {/* ===================================================================
          HEADER — Exact Reference Layout (NO Monvian logo/name, NO bottom bar)
         =================================================================== */}
      <header className="flex items-center justify-between gap-3 mb-5 pt-1">
        <div className="flex items-center gap-3.5 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Abrir menu administrativo"
              className="md:hidden w-12 h-12 rounded-full bg-white border border-[#E7EEF9] flex items-center justify-center text-[#0D1526] active:scale-95 transition-transform cursor-pointer shrink-0"
              style={{ boxShadow: PILL_SHADOW }}
            >
              <Menu className="w-[21px] h-[21px] stroke-[2]" />
            </button>
          )}
          <h1 className="text-[26px] sm:text-[29px] font-bold tracking-[-0.03em] text-[#0D1526] leading-tight truncate">
            Dashboard
          </h1>
        </div>

        <PeriodSelectorButton
          period={period}
          periodLabel={periodLabel}
          customStart={customStart}
          customEnd={customEnd}
          onSelectPeriod={handleSelectPeriod}
          onApplyCustom={handleApplyCustom}
        />
      </header>

      {/* Honest Stripe Configuration Notice (only shown if Stripe key is NOT configured) */}
      {!loading && data && !data.stripe.configured && (
        <div className="mb-4 px-4 py-3.5 rounded-[22px] bg-white border border-amber-200/80 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-[#0D1526]">
                Stripe não conectada
              </p>
              <p className="text-[12.5px] text-[#64748B] mt-0.5 leading-relaxed">
                {data.syncError ||
                  'Verifique se a chave secreta da Stripe (sk_live_... ou sk_test_...) está configurada em STRIPE_SECRET_KEY nas variáveis de ambiente da Vercel (Production e Preview) e faça um novo deploy.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardMetrics({ forceSync: true })}
            className="text-[12.5px] font-bold text-[#1668FF] hover:underline shrink-0 cursor-pointer mt-0.5"
          >
            Sincronizar
          </button>
        </div>
      )}

      {/* Honest Stripe API Sync Warning (when configured but Stripe returned an API/permission error) */}
      {!loading && data && data.stripe.configured && data.syncError && (
        <div className="mb-4 px-4 py-3.5 rounded-[22px] bg-white border border-amber-200/80 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-[#0D1526]">
                Aviso na sincronização com a Stripe
              </p>
              <p className="text-[12.5px] text-[#64748B] mt-0.5 leading-relaxed">
                {data.syncError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardMetrics({ forceSync: true })}
            className="text-[12.5px] font-bold text-[#1668FF] hover:underline shrink-0 cursor-pointer mt-0.5"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 px-4 py-3.5 rounded-[22px] bg-white border border-rose-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="text-[13px] font-medium text-rose-700 truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardMetrics({ forceSync: true })}
            className="text-[12.5px] font-bold text-[#1668FF] hover:underline shrink-0 cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ===================================================================
          CARDS STACK — Matches Reference Proportions & Visual Hierarchy
         =================================================================== */}
      <div
        className={`space-y-4 transition-opacity duration-200 ${
          isRefreshing ? 'opacity-85' : 'opacity-100'
        }`}
      >
        {/* 1. CARD DE FATURAMENTO TOTAL */}
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: EASE_IOS }}
          className="rounded-[28px] bg-white border border-[#E9F0FA] px-5 py-5 sm:px-6 sm:py-6"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-[18px] bg-[#EBF3FF] flex items-center justify-center shrink-0">
                <DollarSign className="w-7 h-7 text-[#1668FF] stroke-[2.3]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-[#64748B] leading-snug">
                  Faturamento Total
                </p>
                {loading ? (
                  <div className="mt-1.5 space-y-2">
                    <ShimmerBlock className="h-8 w-44" />
                    <ShimmerBlock className="h-3.5 w-36" />
                  </div>
                ) : (
                  <>
                    <p className="text-[26px] sm:text-[32px] font-bold tracking-[-0.035em] text-[#0D1526] leading-[1.12] mt-0.5 tabular-nums truncate">
                      {formatBRLFromCents(Math.round(animatedRevenueCents), currency)}
                    </p>
                    {renderDeltaLine(
                      data?.revenue.deltaPct,
                      data?.revenue.trend,
                      data?.revenue.hasBaseline
                    )}
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <ShimmerBlock className="w-[104px] sm:w-[132px] h-[54px] rounded-2xl shrink-0" />
            ) : (
              <RevenueSparkline
                values={data?.revenue.sparkline || []}
                reducedMotion={prefersReducedMotion}
              />
            )}
          </div>
        </motion.section>

        {/* 1.5. CARD DE RESUMO FINANCEIRO (Independent 2x2 Section) */}
        <motion.section
          id="admin-financial-summary-card"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.39, delay: prefersReducedMotion ? 0 : 0.03, ease: EASE_IOS }}
          className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#F8FBFF] via-[#FFFFFF] to-[#F4F8FF] border border-[#E8F0FC] px-5 py-5 sm:px-6 sm:py-6"
          style={{
            boxShadow: CARD_SHADOW,
            fontFamily:
              "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {/* Subtle decorative soft-blue corner curves matching reference */}
          <svg
            aria-hidden="true"
            viewBox="0 0 180 120"
            className="pointer-events-none absolute -top-2 -right-2 w-[150px] h-[100px] text-[#E6F0FF] opacity-85"
          >
            <path
              d="M20,0 L180,0 L180,105 C122,96 72,56 20,0 Z"
              fill="currentColor"
            />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 120 90"
            className="pointer-events-none absolute -bottom-2 -left-2 w-[96px] h-[72px] text-[#E8F1FF] opacity-80"
          >
            <path
              d="M0,18 C34,38 66,64 98,90 L0,90 Z"
              fill="currentColor"
            />
          </svg>

          {/* Header: Bar Chart Icon + Title & Subtitle + Right Chevron */}
          <div
            onClick={onOpenFinancialDetails}
            role={onOpenFinancialDetails ? 'button' : undefined}
            tabIndex={onOpenFinancialDetails ? 0 : undefined}
            onKeyDown={(e) => {
              if (onOpenFinancialDetails && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenFinancialDetails();
              }
            }}
            aria-label="Resumo Financeiro — Abrir detalhes financeiros"
            className={`relative z-10 flex items-center justify-between gap-3 ${
              onOpenFinancialDetails ? 'cursor-pointer group select-none' : ''
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-[44px] h-[44px] rounded-[14px] bg-[#E8F1FF] flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  className="w-[22px] h-[22px] text-[#1668FF]"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="4.5" y="12.5" width="3.4" height="6.5" rx="1.7" />
                  <rect x="10.3" y="6.5" width="3.4" height="12.5" rx="1.7" />
                  <rect x="16.1" y="9.8" width="3.4" height="9.2" rx="1.7" />
                </svg>
              </div>

              <div className="min-w-0">
                <h2 className="text-[16.5px] sm:text-[17.5px] font-semibold tracking-[-0.02em] text-[#0D1526] leading-snug truncate">
                  Resumo Financeiro
                </h2>
                <p className="text-[13px] font-medium text-[#64748B] leading-snug truncate mt-0.5">
                  Seus principais indicadores
                </p>
              </div>
            </div>

            <ChevronRight
              className={`w-[18px] h-[18px] text-[#64748B] stroke-[2.1] shrink-0 transition-transform duration-200 ${
                onOpenFinancialDetails ? 'group-hover:translate-x-0.5 group-hover:text-[#0D1526]' : ''
              }`}
            />
          </div>

          {/* 2x2 Balanced Grid with Subtle Horizontal & Vertical Hairline Dividers */}
          <div className="relative z-10 mt-5 grid grid-cols-2">
            {/* Row 1, Col 1: Faturamento bruto */}
            <div className="pr-4 pb-4 border-b border-[#EAF0FA]">
              <span className="block text-[13.5px] sm:text-[14px] font-medium text-[#64748B] tracking-[-0.01em] truncate">
                Faturamento bruto
              </span>
              {loading ? (
                <ShimmerBlock className="h-6 w-24 mt-1.5" />
              ) : (
                <span className="block text-[20px] sm:text-[22px] font-bold tracking-[-0.025em] text-[#0D1526] leading-tight tabular-nums mt-1 truncate">
                  {formatBRLFromCents(Math.round(animatedGrossCents), currency)}
                </span>
              )}
            </div>

            {/* Row 1, Col 2: Taxas Stripe */}
            <div className="pl-5 pb-4 border-b border-l border-[#EAF0FA]">
              <span className="block text-[13.5px] sm:text-[14px] font-medium text-[#64748B] tracking-[-0.01em] truncate">
                Taxas Stripe
              </span>
              {loading ? (
                <ShimmerBlock className="h-6 w-24 mt-1.5" />
              ) : (
                <span className="block text-[20px] sm:text-[22px] font-bold tracking-[-0.025em] text-[#0D1526] leading-tight tabular-nums mt-1 truncate">
                  {formatBRLFromCents(Math.round(animatedFeesCents), currency)}
                </span>
              )}
            </div>

            {/* Row 2, Col 1: Reembolsos */}
            <div className="pr-4 pt-4">
              <span className="block text-[13.5px] sm:text-[14px] font-medium text-[#64748B] tracking-[-0.01em] truncate">
                Reembolsos
              </span>
              {loading ? (
                <ShimmerBlock className="h-6 w-24 mt-1.5" />
              ) : (
                <span className="block text-[20px] sm:text-[22px] font-bold tracking-[-0.025em] text-[#0D1526] leading-tight tabular-nums mt-1 truncate">
                  {formatBRLFromCents(Math.round(animatedRefundsCents), currency)}
                </span>
              )}
            </div>

            {/* Row 2, Col 2: Saldo disponível */}
            <div className="pl-5 pt-4 border-l border-[#EAF0FA]">
              <span className="block text-[13.5px] sm:text-[14px] font-medium text-[#64748B] tracking-[-0.01em] truncate">
                Saldo disponível
              </span>
              {loading ? (
                <ShimmerBlock className="h-6 w-28 mt-1.5" />
              ) : (
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <span className="text-[20px] sm:text-[22px] font-bold tracking-[-0.025em] text-[#10B981] leading-tight tabular-nums truncate">
                    {formatBRLFromCents(Math.round(animatedAvailableBalanceCents), currency)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-[19px] h-[19px] rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0"
                  >
                    <Check className="w-[12px] h-[12px] stroke-[3]" />
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* 2. CARD DE VENDAS DE ROTEIROS */}
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : 0.06, ease: EASE_IOS }}
          className="rounded-[28px] bg-white border border-[#E9F0FA] px-5 py-5 sm:px-6 sm:py-6"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-[18px] bg-[#EBF3FF] flex items-center justify-center shrink-0">
                <ShoppingCart className="w-[26px] h-[26px] text-[#1668FF] stroke-[2.2]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-[#64748B] leading-snug">
                  Vendas de Roteiros
                </p>
                {loading ? (
                  <div className="mt-1.5 space-y-2">
                    <ShimmerBlock className="h-8 w-24" />
                    <ShimmerBlock className="h-3.5 w-36" />
                  </div>
                ) : (
                  <>
                    <p className="text-[28px] sm:text-[32px] font-bold tracking-[-0.035em] text-[#0D1526] leading-[1.12] mt-0.5 tabular-nums">
                      {Math.round(animatedSalesCount).toLocaleString('pt-BR')}
                    </p>
                    {renderDeltaLine(
                      data?.sales.deltaPct,
                      data?.sales.trend,
                      data?.sales.hasBaseline
                    )}
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <ShimmerBlock className="w-[88px] h-[52px] rounded-2xl shrink-0" />
            ) : (
              <SalesMiniBars
                bars={data?.sales.bars || []}
                reducedMotion={prefersReducedMotion}
              />
            )}
          </div>
        </motion.section>

        {/* 3. CARD DE EVOLUÇÃO DAS VENDAS */}
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: prefersReducedMotion ? 0 : 0.11, ease: EASE_IOS }}
          className="rounded-[28px] bg-white border border-[#E9F0FA] p-5 sm:p-6"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#EBF3FF] flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-[#1668FF] stroke-[2.3]" />
              </div>
              <h2 className="text-[17px] sm:text-[18.5px] font-bold tracking-[-0.02em] text-[#0D1526] truncate">
                Evolução das Vendas
              </h2>
            </div>

            <PeriodSelectorButton
              compact
              period={period}
              periodLabel={periodLabel}
              customStart={customStart}
              customEnd={customEnd}
              onSelectPeriod={handleSelectPeriod}
              onApplyCustom={handleApplyCustom}
            />
          </div>

          {loading ? (
            <ShimmerBlock className="w-full h-[200px] sm:h-[228px] rounded-2xl" />
          ) : (
            <SalesEvolutionChart
              series={data?.evolution.series || []}
              currency={currency}
              reducedMotion={prefersReducedMotion}
            />
          )}
        </motion.section>

        {/* 4. CARD DE ROTEIROS MAIS VENDIDOS */}
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, delay: prefersReducedMotion ? 0 : 0.16, ease: EASE_IOS }}
          className="rounded-[28px] bg-white border border-[#E9F0FA] p-5 sm:p-6"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#EBF3FF] flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-[#1668FF] stroke-[2.15]" />
              </div>
              <h2 className="text-[17px] sm:text-[18.5px] font-bold tracking-[-0.02em] text-[#0D1526] truncate">
                Roteiros Mais Vendidos
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setIsAllItinerariesOpen(true)}
              className="flex items-center gap-0.5 text-[14px] font-semibold text-[#1668FF] hover:text-[#0F52D6] transition-colors cursor-pointer shrink-0"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-4 h-4 stroke-[2.3]" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3.5 flex-1">
                    <ShimmerBlock className="w-[78px] h-[54px] rounded-[14px] shrink-0" />
                    <div className="space-y-2 flex-1">
                      <ShimmerBlock className="h-4 w-44" />
                      <ShimmerBlock className="h-3.5 w-28" />
                    </div>
                  </div>
                  <ShimmerBlock className="h-8 w-20 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          ) : topThree.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F2F6FC] flex items-center justify-center text-[#94A3B8] mb-3">
                <Trophy className="w-5 h-5" />
              </div>
              <p className="text-[14.5px] font-semibold text-[#0D1526]">
                Nenhuma venda de roteiro neste período
              </p>
              <p className="text-[13px] text-[#64748B] mt-1 max-w-xs mx-auto">
                Assim que novos roteiros forem vendidos, o ranking será atualizado automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F6FC]">
              {topThree.map((item, idx) => (
                <TopItineraryRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  index={idx}
                  reducedMotion={prefersReducedMotion}
                />
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* ===================================================================
          "VER TODOS" — FULL RANKING NATIVE iOS BOTTOM SHEET
         =================================================================== */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isAllItinerariesOpen && (
              <div className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                  onClick={() => setIsAllItinerariesOpen(false)}
                  className="fixed inset-0 bg-[#0D1526]/40 backdrop-blur-[6px]"
                />

                <motion.div
                  initial={prefersReducedMotion ? false : { y: '100%' }}
                  animate={{ y: 0 }}
                  exit={prefersReducedMotion ? undefined : { y: '100%' }}
                  transition={{ duration: 0.3, ease: EASE_IOS }}
                  className="relative z-10 w-full sm:max-w-[540px] max-h-[88dvh] bg-white rounded-t-[30px] sm:rounded-[30px] flex flex-col overflow-hidden"
                  style={{
                    boxShadow: '0 -16px 48px rgba(15, 23, 42, 0.18)',
                    paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
                  }}
                >
                  {/* Drag Handle */}
                  <div className="pt-3 pb-1 flex justify-center sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-slate-200" />
                  </div>

                  {/* Sheet Header */}
                  <div className="px-6 py-4 border-b border-[#F1F5FB] flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[18px] font-bold tracking-[-0.02em] text-[#0D1526]">
                        Roteiros Mais Vendidos
                      </h3>
                      <p className="text-[12.5px] font-medium text-[#64748B] mt-0.5">
                        Ranking completo · {periodLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAllItinerariesOpen(false)}
                      aria-label="Fechar ranking"
                      className="w-9 h-9 rounded-full bg-[#F2F6FC] hover:bg-[#E7EFFB] flex items-center justify-center text-[#475569] transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </div>

                  {/* Sheet Scrollable Ranking List */}
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {(data?.topItineraries || []).length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="text-[14.5px] font-semibold text-[#0D1526]">
                          Nenhuma venda registrada neste período
                        </p>
                        <p className="text-[13px] text-[#64748B] mt-1">
                          Altere o filtro de período no topo para consultar outro intervalo.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#F3F6FC]">
                        {(data?.topItineraries || []).map((item, idx) => (
                          <TopItineraryRow
                            key={item.id}
                            item={item}
                            currency={currency}
                            index={idx}
                            reducedMotion={prefersReducedMotion}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
