import React, { useState, useMemo } from 'react';
import { BarChart2, CreditCard } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ADMIN_CARD_STYLE,
  ADMIN_COLORS,
  ADMIN_MOTION_EASE,
  type AdminChartRange,
} from './adminTheme';

export interface FinancialPerfPoint {
  label: string;
  fullLabel?: string;
  creditsAdded: number;
  platanosConsumed: number;
}

export interface StripeRevenuePoint {
  label: string;
  fullLabel?: string;
  revenueCents: number;
  revenueReais: number;
  paymentsCount: number;
}

const PeriodPills: React.FC<{
  value: AdminChartRange;
  onChange: (next: AdminChartRange) => void;
}> = ({ value, onChange }) => {
  const options: AdminChartRange[] = ['7d', '30d', '90d'];
  return (
    <div
      className="inline-flex items-center p-1 rounded-full bg-[#F1F5FB] border border-slate-200/70 shrink-0"
      role="group"
      aria-label="Filtro de período"
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer select-none ${
              active
                ? 'bg-[#1668FF] text-white shadow-[0_4px_12px_-2px_rgba(22,104,255,0.45)]'
                : 'text-[#475569] hover:text-[#0D1526]'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
};

function computeNiceTicks(maxValue: number): { max: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { max: 100, ticks: [100, 75, 50, 25, 0] };
  }
  const rawStep = maxValue / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceStep = magnitude;
  if (normalized <= 1) niceStep = 1 * magnitude;
  else if (normalized <= 2) niceStep = 2 * magnitude;
  else if (normalized <= 2.5) niceStep = 2.5 * magnitude;
  else if (normalized <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const niceMax = Math.max(4, Math.ceil(maxValue / niceStep) * niceStep);
  const step = niceMax / 4;
  return {
    max: niceMax,
    ticks: [
      Math.round(niceMax),
      Math.round(step * 3),
      Math.round(step * 2),
      Math.round(step),
      0,
    ],
  };
}

function buildClampedSmoothPath(
  pts: Array<{ x: number; y: number }>,
  minY: number,
  maxY: number
): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  const clampY = (val: number) => Math.max(minY, Math.min(maxY, val));
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Mini sparkline curve for the 4 financial KPI cards */
export const FinancialMiniSparkline: React.FC<{
  values: number[];
  color: string;
  gradientId: string;
}> = ({ values, color, gradientId }) => {
  const width = 92;
  const height = 34;
  const padY = 4;

  const hasNonZero = values.some((v) => v > 0);
  const maxVal = Math.max(...values, 1);

  const pts = useMemo(() => {
    const src = values.length >= 2 ? values : [0, 0, 0, 0, 0, 0, 0];
    const denom = Math.max(1, src.length - 1);
    return src.map((val, idx) => {
      const x = (idx / denom) * width;
      const y = hasNonZero
        ? padY + (height - padY * 2) * (1 - Math.max(0, val) / maxVal)
        : height - 5;
      return { x, y };
    });
  }, [values, hasNonZero, maxVal]);

  const linePath = useMemo(() => buildClampedSmoothPath(pts, padY, height - 2), [pts]);
  const areaPath = useMemo(() => {
    if (!linePath || pts.length < 2) return '';
    return `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${height} L ${pts[0].x.toFixed(2)} ${height} Z`;
  }, [linePath, pts]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-[86px] h-[34px] overflow-visible shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={hasNonZero ? '0.26' : '0.1'} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={hasNonZero ? 1 : 0.45}
      />
    </svg>
  );
};

/** Chart 1: Desempenho financeiro (Créditos adicionados azul + Plátanos consumidos verde) */
export const FinancialPerformanceChart: React.FC<{
  seriesByRange: Record<AdminChartRange, FinancialPerfPoint[]>;
  range: AdminChartRange;
  onRangeChange: (next: AdminChartRange) => void;
  loading?: boolean;
}> = ({ seriesByRange, range, onRangeChange, loading = false }) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = seriesByRange[range] || [];
  const totalVolume = useMemo(
    () => points.reduce((acc, p) => acc + (p.creditsAdded || 0) + (p.platanosConsumed || 0), 0),
    [points]
  );
  const maxVal = useMemo(
    () =>
      points.reduce(
        (m, p) => Math.max(m, Number(p.creditsAdded) || 0, Number(p.platanosConsumed) || 0),
        0
      ),
    [points]
  );
  const { max: yMax, ticks } = useMemo(() => computeNiceTicks(maxVal), [maxVal]);

  const vbWidth = 540;
  const vbHeight = 200;
  const padLeft = 40;
  const padRight = 18;
  const padTop = 14;
  const padBottom = 26;
  const plotW = vbWidth - padLeft - padRight;
  const plotH = vbHeight - padTop - padBottom;

  const { creditCoords, spentCoords } = useMemo(() => {
    if (points.length === 0) return { creditCoords: [], spentCoords: [] };
    const denom = Math.max(1, points.length - 1);
    const cCoords = points.map((p, idx) => ({
      x: padLeft + (points.length === 1 ? plotW / 2 : (idx / denom) * plotW),
      y: padTop + plotH - (Math.max(0, p.creditsAdded) / yMax) * plotH,
      ...p,
    }));
    const sCoords = points.map((p, idx) => ({
      x: padLeft + (points.length === 1 ? plotW / 2 : (idx / denom) * plotW),
      y: padTop + plotH - (Math.max(0, p.platanosConsumed) / yMax) * plotH,
      ...p,
    }));
    return { creditCoords: cCoords, spentCoords: sCoords };
  }, [points, plotW, plotH, yMax]);

  const creditLine = useMemo(
    () => buildClampedSmoothPath(creditCoords, padTop, padTop + plotH),
    [creditCoords, plotH]
  );
  const spentLine = useMemo(
    () => buildClampedSmoothPath(spentCoords, padTop, padTop + plotH),
    [spentCoords, plotH]
  );

  const creditArea = useMemo(() => {
    if (creditCoords.length < 2) return '';
    const base = padTop + plotH;
    return `${creditLine} L ${creditCoords[creditCoords.length - 1].x.toFixed(2)} ${base} L ${creditCoords[0].x.toFixed(2)} ${base} Z`;
  }, [creditLine, creditCoords, plotH]);

  const spentArea = useMemo(() => {
    if (spentCoords.length < 2) return '';
    const base = padTop + plotH;
    return `${spentLine} L ${spentCoords[spentCoords.length - 1].x.toFixed(2)} ${base} L ${spentCoords[0].x.toFixed(2)} ${base} Z`;
  }, [spentLine, spentCoords, plotH]);

  const hasData = totalVolume > 0;
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: 0.08, ease: ADMIN_MOTION_EASE }}
      className="rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full min-h-[312px]"
      style={ADMIN_CARD_STYLE}
    >
      {/* Header + Legend */}
      <div className="space-y-3 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
              <BarChart2 className="w-[18px] h-[18px] stroke-[2.2]" />
            </div>
            <h3 className="text-[16px] sm:text-[17px] font-bold tracking-tight text-[#0D1526] truncate">
              Desempenho financeiro
            </h3>
          </div>
          <PeriodPills
            value={range}
            onChange={(r) => {
              setHoveredIdx(null);
              onRangeChange(r);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12.5px] font-medium text-[#475569]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1668FF]" />
            <span>Créditos adicionados</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0FA958]" />
            <span>Plátanos consumidos</span>
          </span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative flex-1 w-full min-h-[200px] flex items-center justify-center">
        {loading ? (
          <div className="w-full h-[195px] rounded-2xl bg-[#F4F7FC] animate-pulse" />
        ) : (
          <div className="relative w-full h-full">
            <svg
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              className="w-full h-[200px] overflow-visible select-none"
              role="img"
              aria-label={`Desempenho financeiro (${range})`}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="finCreditsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1668FF" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#1668FF" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="finSpentArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0FA958" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#0FA958" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid + Y-axis */}
              {ticks.map((tickVal, idx) => {
                const y = padTop + (idx / 4) * plotH;
                return (
                  <g key={`${tickVal}-${idx}`}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={vbWidth - padRight}
                      y2={y}
                      stroke={ADMIN_COLORS.gridLine}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill="#7B8AA3"
                      fontSize="11.5"
                      fontWeight="500"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {/* Vertical reference guides */}
              {creditCoords.map((pt, idx) => (
                <line
                  key={`vg-${idx}`}
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + plotH}
                  stroke="#F1F5FB"
                  strokeWidth="1"
                />
              ))}

              {/* Dual Curves + Dots */}
              {hasData && (
                <>
                  {creditArea && <path d={creditArea} fill="url(#finCreditsArea)" />}
                  {spentArea && <path d={spentArea} fill="url(#finSpentArea)" />}
                  <path
                    d={creditLine}
                    fill="none"
                    stroke="#1668FF"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={spentLine}
                    fill="none"
                    stroke="#0FA958"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {creditCoords.map((pt, idx) => {
                    const sPt = spentCoords[idx];
                    const isHovered = hoveredIdx === idx;
                    return (
                      <g
                        key={`pts-${idx}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onClick={() => setHoveredIdx(idx)}
                      >
                        <rect
                          x={pt.x - 20}
                          y={padTop}
                          width={40}
                          height={plotH}
                          fill="transparent"
                        />
                        {isHovered && (
                          <line
                            x1={pt.x}
                            y1={padTop}
                            x2={pt.x}
                            y2={padTop + plotH}
                            stroke="#1668FF"
                            strokeOpacity="0.22"
                            strokeDasharray="3 3"
                          />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5 : 3.8}
                          fill="#1668FF"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        {sPt && (
                          <circle
                            cx={sPt.x}
                            cy={sPt.y}
                            r={isHovered ? 5 : 3.8}
                            fill="#0FA958"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                          />
                        )}
                      </g>
                    );
                  })}
                </>
              )}

              {/* X-axis labels */}
              {creditCoords.map((pt, idx) => (
                <text
                  key={`xl-${idx}`}
                  x={pt.x}
                  y={vbHeight - 4}
                  textAnchor="middle"
                  fill="#8B99B0"
                  fontSize="10.5"
                  fontWeight="500"
                >
                  {pt.label}
                </text>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hasData && hoveredPoint && (
              <div className="pointer-events-none absolute -top-1 right-2 px-3 py-1.5 rounded-xl bg-[#0D1526] text-white text-[11px] font-semibold shadow-lg flex items-center gap-3">
                <span className="text-slate-300">{hoveredPoint.fullLabel || hoveredPoint.label}</span>
                <span className="text-[#60A5FA]">+{hoveredPoint.creditsAdded} cr</span>
                <span className="text-[#34D399]">-{hoveredPoint.platanosConsumed} cons</span>
              </div>
            )}

            {/* Honest Empty State */}
            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4 pl-8">
                <div className="px-4 py-2.5 rounded-2xl bg-white/94 border border-slate-200/80 shadow-xs text-center">
                  <p className="text-xs font-semibold text-[#334155]">
                    Sem movimentações de Plátanos nos últimos {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : '90 dias'}
                  </p>
                  <p className="text-[11px] text-[#7B8AA3] mt-0.5">
                    Créditos adicionados e consumos de roteiros aparecerão automaticamente aqui.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

/** Chart 2: Receita Stripe (Barras azuis arredondadas + contagem de pagamentos) */
export const StripeRevenueChart: React.FC<{
  seriesByRange: Record<AdminChartRange, StripeRevenuePoint[]>;
  range: AdminChartRange;
  onRangeChange: (next: AdminChartRange) => void;
  loading?: boolean;
}> = ({ seriesByRange, range, onRangeChange, loading = false }) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const items = seriesByRange[range] || [];
  const totalRevenueCents = useMemo(
    () => items.reduce((acc, p) => acc + (Number(p.revenueCents) || 0), 0),
    [items]
  );
  const maxVal = useMemo(
    () => items.reduce((m, p) => Math.max(m, Number(p.revenueReais) || 0), 0),
    [items]
  );
  const { max: yMax, ticks } = useMemo(() => computeNiceTicks(maxVal), [maxVal]);

  const vbWidth = 540;
  const vbHeight = 200;
  const padLeft = 44;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const plotW = vbWidth - padLeft - padRight;
  const plotH = vbHeight - padTop - padBottom;

  const hasData = totalRevenueCents > 0;
  const hoveredItem = hoveredIdx !== null ? items[hoveredIdx] : null;

  const slotCount = Math.max(items.length, 7);
  const slotWidth = plotW / slotCount;
  const barWidth = Math.min(34, Math.max(18, slotWidth * 0.54));

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: 0.12, ease: ADMIN_MOTION_EASE }}
      className="rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full min-h-[312px]"
      style={ADMIN_CARD_STYLE}
    >
      {/* Header + Legend */}
      <div className="space-y-3 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
              <CreditCard className="w-[18px] h-[18px] stroke-[2.1]" />
            </div>
            <h3 className="text-[16px] sm:text-[17px] font-bold tracking-tight text-[#0D1526] truncate">
              Receita Stripe
            </h3>
          </div>
          <PeriodPills
            value={range}
            onChange={(r) => {
              setHoveredIdx(null);
              onRangeChange(r);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12.5px] font-medium text-[#475569]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1668FF]" />
            <span>Receita confirmada</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#93C5FD]" />
            <span>Pagamentos</span>
          </span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="relative flex-1 w-full min-h-[200px] flex items-center justify-center">
        {loading ? (
          <div className="w-full h-[195px] rounded-2xl bg-[#F4F7FC] animate-pulse" />
        ) : (
          <div className="relative w-full h-full">
            <svg
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              className="w-full h-[200px] overflow-visible select-none"
              role="img"
              aria-label={`Receita Stripe (${range})`}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="stripeBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#589BFF" />
                  <stop offset="100%" stopColor="#1D6CFF" />
                </linearGradient>
                <linearGradient id="stripeBarGradHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2A7BFF" />
                  <stop offset="100%" stopColor="#0E52D6" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid + Y-axis */}
              {ticks.map((tickVal, idx) => {
                const y = padTop + (idx / 4) * plotH;
                return (
                  <g key={`${tickVal}-${idx}`}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={vbWidth - padRight}
                      y2={y}
                      stroke={ADMIN_COLORS.gridLine}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill="#7B8AA3"
                      fontSize="11.5"
                      fontWeight="500"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {/* Bars */}
              {hasData &&
                items.map((item, idx) => {
                  const cx = padLeft + idx * slotWidth + slotWidth / 2;
                  const x = cx - barWidth / 2;
                  const val = Math.max(0, Number(item.revenueReais) || 0);
                  const barH = val > 0 ? Math.max(10, (val / yMax) * plotH) : 0;
                  const y = padTop + plotH - barH;
                  const isHovered = hoveredIdx === idx;

                  return (
                    <g
                      key={`bar-${idx}`}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onClick={() => setHoveredIdx(idx)}
                    >
                      <rect
                        x={padLeft + idx * slotWidth}
                        y={padTop}
                        width={slotWidth}
                        height={plotH}
                        fill="transparent"
                      />
                      {barH > 0 && (
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barH}
                          rx="7"
                          ry="7"
                          fill={isHovered ? 'url(#stripeBarGradHover)' : 'url(#stripeBarGrad)'}
                          opacity={hoveredIdx !== null && !isHovered ? 0.65 : 1}
                          style={{ transition: 'opacity 180ms ease' }}
                        />
                      )}
                      <text
                        x={cx}
                        y={vbHeight - 4}
                        textAnchor="middle"
                        fill={isHovered ? '#0D1526' : '#8B99B0'}
                        fontSize="10.5"
                        fontWeight={isHovered ? '700' : '500'}
                      >
                        {item.label}
                      </text>
                    </g>
                  );
                })}

              {/* X-axis labels even when empty */}
              {!hasData &&
                items.map((item, idx) => {
                  const cx = padLeft + idx * slotWidth + slotWidth / 2;
                  return (
                    <text
                      key={`empty-xl-${idx}`}
                      x={cx}
                      y={vbHeight - 4}
                      textAnchor="middle"
                      fill="#8B99B0"
                      fontSize="10.5"
                      fontWeight="500"
                    >
                      {item.label}
                    </text>
                  );
                })}
            </svg>

            {/* Hover Tooltip */}
            {hasData && hoveredItem && (
              <div className="pointer-events-none absolute -top-1 right-2 px-3 py-1.5 rounded-xl bg-[#0D1526] text-white text-[11px] font-semibold shadow-lg flex items-center gap-2.5">
                <span className="text-slate-300">{hoveredItem.fullLabel || hoveredItem.label}</span>
                <span className="font-bold text-white">
                  R$ {hoveredItem.revenueReais.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-[#93C5FD]">
                  ({hoveredItem.paymentsCount} {hoveredItem.paymentsCount === 1 ? 'pag.' : 'pags.'})
                </span>
              </div>
            )}

            {/* Honest Empty State */}
            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4 pl-8">
                <div className="px-4 py-2.5 rounded-2xl bg-white/94 border border-slate-200/80 shadow-xs text-center">
                  <p className="text-xs font-semibold text-[#334155]">
                    Sem receita Stripe confirmada nos últimos {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : '90 dias'}
                  </p>
                  <p className="text-[11px] text-[#7B8AA3] mt-0.5">
                    Pagamentos concluídos via Stripe aparecerão automaticamente aqui.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
