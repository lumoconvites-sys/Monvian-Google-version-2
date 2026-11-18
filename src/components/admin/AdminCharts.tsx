import React, { useState, useMemo } from 'react';
import { BarChart2, Eye } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { ADMIN_CARD_STYLE, ADMIN_COLORS, ADMIN_MOTION_EASE, type AdminChartRange } from './adminTheme';

export interface ActivityPoint {
  label: string;
  fullLabel?: string;
  value: number;
}

export interface DestinationViewPoint {
  id: string;
  name: string;
  shortName: string;
  value: number;
}

interface PeriodSegmentedControlProps {
  value: AdminChartRange;
  onChange: (next: AdminChartRange) => void;
}

const PeriodSegmentedControl: React.FC<PeriodSegmentedControlProps> = ({ value, onChange }) => {
  const options: AdminChartRange[] = ['7d', '30d', '90d'];

  return (
    <div
      className="inline-flex items-center p-1 rounded-full bg-[#F1F5FB] border border-slate-200/70 shrink-0"
      role="group"
      aria-label="Filtro de período"
    >
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer select-none ${
              isActive
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

/** Build smooth monotonic-safe cubic Bezier SVG path clamped inside [minY, maxY] */
function buildSmoothLinePath(
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

interface CommunityActivityChartProps {
  seriesByRange: Record<AdminChartRange, ActivityPoint[]>;
  range: AdminChartRange;
  onRangeChange: (next: AdminChartRange) => void;
  loading?: boolean;
}

export const AdminCommunityActivityChart: React.FC<CommunityActivityChartProps> = ({
  seriesByRange,
  range,
  onRangeChange,
  loading = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = seriesByRange[range] || [];
  const totalInPeriod = useMemo(
    () => points.reduce((acc, p) => acc + (Number(p.value) || 0), 0),
    [points]
  );
  const maxVal = useMemo(
    () => points.reduce((m, p) => Math.max(m, Number(p.value) || 0), 0),
    [points]
  );
  const { max: yMax, ticks } = useMemo(() => computeNiceTicks(maxVal), [maxVal]);

  // SVG layout coordinates
  const vbWidth = 540;
  const vbHeight = 205;
  const padLeft = 40;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 26;
  const plotW = vbWidth - padLeft - padRight;
  const plotH = vbHeight - padTop - padBottom;

  const coords = useMemo(() => {
    if (points.length === 0) return [];
    const denom = Math.max(1, points.length - 1);
    return points.map((pt, idx) => {
      const x = padLeft + (points.length === 1 ? plotW / 2 : (idx / denom) * plotW);
      const clampedVal = Math.max(0, Number(pt.value) || 0);
      const y = padTop + plotH - (clampedVal / yMax) * plotH;
      return { x, y, ...pt };
    });
  }, [points, plotW, plotH, yMax]);

  const linePath = useMemo(
    () => buildSmoothLinePath(coords, padTop, padTop + plotH),
    [coords, padTop, plotH]
  );
  const areaPath = useMemo(() => {
    if (coords.length < 2) return '';
    const baselineY = padTop + plotH;
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${linePath} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;
  }, [linePath, coords, plotH]);

  const hasData = totalInPeriod > 0;
  const hoveredPoint = hoveredIdx !== null ? coords[hoveredIdx] : null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: 0.08, ease: ADMIN_MOTION_EASE }}
      className="rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full min-h-[300px]"
      style={ADMIN_CARD_STYLE}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
            <BarChart2 className="w-[18px] h-[18px] stroke-[2.2]" />
          </div>
          <h3 className="text-[16px] sm:text-[17px] font-bold tracking-tight text-[#0D1526] truncate">
            Atividade da Comunidade
          </h3>
        </div>
        <PeriodSegmentedControl value={range} onChange={(r) => { setHoveredIdx(null); onRangeChange(r); }} />
      </div>

      {/* Chart Body */}
      <div className="relative flex-1 w-full min-h-[205px] flex items-center justify-center">
        {loading ? (
          <div className="w-full h-[195px] rounded-2xl bg-[#F4F7FC] animate-pulse" />
        ) : (
          <div className="relative w-full h-full">
            <svg
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              className="w-full h-[205px] overflow-visible select-none"
              role="img"
              aria-label={`Gráfico de Atividade da Comunidade (${range})`}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="monvianActivityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1668FF" stopOpacity="0.22" />
                  <stop offset="85%" stopColor="#1668FF" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#1668FF" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
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

              {/* Vertical Subtle Reference Guides */}
              {coords.map((pt, idx) => (
                <line
                  key={`v-${idx}`}
                  x1={pt.x}
                  y1={padTop}
                  x2={pt.x}
                  y2={padTop + plotH}
                  stroke="#F1F5FB"
                  strokeWidth="1"
                />
              ))}

              {/* Area + Line + Dots when real data exists */}
              {hasData && (
                <>
                  {areaPath && (
                    <path d={areaPath} fill="url(#monvianActivityFill)" />
                  )}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#1668FF"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {coords.map((pt, idx) => {
                    const isHovered = hoveredIdx === idx;
                    return (
                      <g
                        key={`pt-${idx}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onClick={() => setHoveredIdx(idx)}
                      >
                        {/* Generous invisible hit area */}
                        <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                        {isHovered && (
                          <circle cx={pt.x} cy={pt.y} r="8" fill="#1668FF" fillOpacity="0.18" />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5.2 : 4}
                          fill="#1668FF"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })}
                </>
              )}

              {/* X-Axis Labels */}
              {coords.map((pt, idx) => (
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

            {/* Interactive Hover Tooltip */}
            {hasData && hoveredPoint && (
              <div
                className="pointer-events-none absolute -top-1 right-2 px-3 py-1.5 rounded-xl bg-[#0D1526] text-white text-[11px] font-semibold shadow-lg flex items-center gap-2 transition-opacity duration-150"
              >
                <span className="w-2 h-2 rounded-full bg-[#4B8BFF]" />
                <span className="text-slate-300">{hoveredPoint.fullLabel || hoveredPoint.label}:</span>
                <span className="font-bold text-white">{hoveredPoint.value.toLocaleString('pt-BR')} interações</span>
              </div>
            )}

            {/* Honest Empty State overlay over reference grid */}
            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4 pl-8">
                <div className="px-4 py-2 rounded-2xl bg-white/92 backdrop-blur-xs border border-slate-200/80 shadow-xs text-center">
                  <p className="text-xs font-semibold text-[#334155]">
                    Sem atividades registradas nos últimos {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : '90 dias'}
                  </p>
                  <p className="text-[11px] text-[#7B8AA3] mt-0.5">
                    Novos cadastros, avaliações e interações aparecerão aqui em tempo real.
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

interface DestinationViewsChartProps {
  destinationsByRange: Record<AdminChartRange, DestinationViewPoint[]>;
  range: AdminChartRange;
  onRangeChange: (next: AdminChartRange) => void;
  loading?: boolean;
}

export const AdminDestinationViewsChart: React.FC<DestinationViewsChartProps> = ({
  destinationsByRange,
  range,
  onRangeChange,
  loading = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const items = destinationsByRange[range] || [];
  const totalViews = useMemo(
    () => items.reduce((acc, item) => acc + (Number(item.value) || 0), 0),
    [items]
  );
  const maxVal = useMemo(
    () => items.reduce((m, item) => Math.max(m, Number(item.value) || 0), 0),
    [items]
  );
  const { max: yMax, ticks } = useMemo(() => computeNiceTicks(maxVal), [maxVal]);

  const vbWidth = 540;
  const vbHeight = 205;
  const padLeft = 40;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 26;
  const plotW = vbWidth - padLeft - padRight;
  const plotH = vbHeight - padTop - padBottom;

  const hasData = items.length > 0 && totalViews > 0;
  const hoveredItem = hoveredIdx !== null ? items[hoveredIdx] : null;

  const slotCount = Math.max(items.length, 7);
  const slotWidth = plotW / slotCount;
  const barWidth = Math.min(34, Math.max(18, slotWidth * 0.56));

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: 0.12, ease: ADMIN_MOTION_EASE }}
      className="rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full min-h-[300px]"
      style={ADMIN_CARD_STYLE}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#EBF2FF] text-[#1668FF] flex items-center justify-center shrink-0">
            <Eye className="w-[18px] h-[18px] stroke-[2.2]" />
          </div>
          <h3 className="text-[16px] sm:text-[17px] font-bold tracking-tight text-[#0D1526] truncate">
            Visualizações por Destino
          </h3>
        </div>
        <PeriodSegmentedControl value={range} onChange={(r) => { setHoveredIdx(null); onRangeChange(r); }} />
      </div>

      {/* Chart Body */}
      <div className="relative flex-1 w-full min-h-[205px] flex items-center justify-center">
        {loading ? (
          <div className="w-full h-[195px] rounded-2xl bg-[#F4F7FC] animate-pulse" />
        ) : (
          <div className="relative w-full h-full">
            <svg
              viewBox={`0 0 ${vbWidth} ${vbHeight}`}
              className="w-full h-[205px] overflow-visible select-none"
              role="img"
              aria-label={`Gráfico de Visualizações por Destino (${range})`}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="monvianBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F93FF" />
                  <stop offset="100%" stopColor="#2B72FF" />
                </linearGradient>
                <linearGradient id="monvianBarGradientHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1668FF" />
                  <stop offset="100%" stopColor="#0E52D6" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
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

              {/* Bars when real data exists */}
              {hasData &&
                items.map((item, idx) => {
                  const cx = padLeft + idx * slotWidth + slotWidth / 2;
                  const x = cx - barWidth / 2;
                  const val = Math.max(0, Number(item.value) || 0);
                  const barH = Math.max(val > 0 ? 8 : 0, (val / yMax) * plotH);
                  const y = padTop + plotH - barH;
                  const isHovered = hoveredIdx === idx;
                  const labelText =
                    item.shortName.length > 9
                      ? `${item.shortName.slice(0, 8)}…`
                      : item.shortName;

                  return (
                    <g
                      key={item.id || idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onClick={() => setHoveredIdx(idx)}
                    >
                      {/* Full-height hover hit column */}
                      <rect
                        x={padLeft + idx * slotWidth}
                        y={padTop}
                        width={slotWidth}
                        height={plotH}
                        fill="transparent"
                      />
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barH}
                        rx="6"
                        ry="6"
                        fill={isHovered ? 'url(#monvianBarGradientHover)' : 'url(#monvianBarGradient)'}
                        opacity={hoveredIdx !== null && !isHovered ? 0.65 : 1}
                        style={{ transition: 'opacity 180ms ease, y 220ms ease, height 220ms ease' }}
                      />
                      <text
                        x={cx}
                        y={vbHeight - 4}
                        textAnchor="middle"
                        fill={isHovered ? '#0D1526' : '#8B99B0'}
                        fontSize="10.5"
                        fontWeight={isHovered ? '700' : '500'}
                      >
                        {labelText}
                      </text>
                    </g>
                  );
                })}
            </svg>

            {/* Interactive Hover Tooltip */}
            {hasData && hoveredItem && (
              <div className="pointer-events-none absolute -top-1 right-2 px-3 py-1.5 rounded-xl bg-[#0D1526] text-white text-[11px] font-semibold shadow-lg flex items-center gap-2 transition-opacity duration-150">
                <span className="w-2 h-2 rounded-full bg-[#4F93FF]" />
                <span className="text-slate-300 max-w-[160px] truncate">{hoveredItem.name}:</span>
                <span className="font-bold text-white">{hoveredItem.value.toLocaleString('pt-BR')}</span>
              </div>
            )}

            {/* Honest Empty State overlay over reference grid */}
            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4 pl-8">
                <div className="px-4 py-2 rounded-2xl bg-white/92 backdrop-blur-xs border border-slate-200/80 shadow-xs text-center">
                  <p className="text-xs font-semibold text-[#334155]">
                    Sem visualizações por destino nos últimos {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : '90 dias'}
                  </p>
                  <p className="text-[11px] text-[#7B8AA3] mt-0.5">
                    Visitas, favoritos e avaliações nos destinos alimentam este gráfico.
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
