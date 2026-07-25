"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import {
  CHART_COLORS,
  MIX_PAIRS,
  type DonutDatum,
  type Series,
} from "@/components/charts/chart-theme";

export { CHART_COLORS, MIX_PAIRS, type DonutDatum, type Series };
export { CircularProgress } from "@/components/charts/circular-progress";

const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const gridStroke = "hsl(var(--border))";

function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>;
  label?: string;
  format?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface/95 p-3 text-xs shadow-lift backdrop-blur">
      {label && <p className="mb-1.5 font-medium text-muted-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey ?? p.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: p.color }} />
            <span className="capitalize text-muted-foreground">{p.name}:</span>
            <span className="font-semibold text-foreground">
              {format ? format(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Multi-series area/trend chart with soft gradient fills. */
export function TrendArea({
  data,
  xKey,
  series,
  height = 260,
  format,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: Series[];
  height?: number;
  format?: (v: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          {series.map((s, i) => {
            const to = s.colorTo ?? MIX_PAIRS[i % MIX_PAIRS.length][1];
            return (
              <linearGradient key={s.key} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
                <stop offset="55%" stopColor={to} stopOpacity={0.18} />
                <stop offset="100%" stopColor={to} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<ChartTooltip format={format} />} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            fill={`url(#${gid}-${i})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Grouped/stacked bar chart with vertical color mixers. */
export function BarGroup({
  data,
  xKey,
  series,
  height = 240,
  stacked = false,
  format,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: Series[];
  height?: number;
  stacked?: boolean;
  format?: (v: number) => string;
}) {
  const gid = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={4}>
        <defs>
          {series.map((s, i) => {
            const to = s.colorTo ?? MIX_PAIRS[i % MIX_PAIRS.length][1];
            return (
              <linearGradient key={s.key} id={`${gid}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={1} />
                <stop offset="100%" stopColor={to} stopOpacity={0.85} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: "hsl(var(--surface-2))" }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={`url(#${gid}-bar-${i})`}
            radius={stacked ? [0, 0, 0, 0] : [6, 6, 2, 2]}
            stackId={stacked ? "a" : undefined}
            barSize={stacked ? 22 : 16}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut chart with mixed slice gradients + centered total. */
export function Donut({
  data,
  height = 200,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const safe = data.length
    ? data
    : [{ name: "No data", value: 1, color: "hsl(var(--surface-2))", colorTo: "hsl(var(--border))" }];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <defs>
            {safe.map((d, i) => {
              const to = d.colorTo ?? MIX_PAIRS[i % MIX_PAIRS.length][1];
              return (
                <linearGradient key={i} id={`${gid}-slice-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={to} stopOpacity={0.8} />
                </linearGradient>
              );
            })}
          </defs>
          <Pie
            data={safe}
            cx="50%"
            cy="50%"
            innerRadius={height * 0.3}
            outerRadius={height * 0.45}
            paddingAngle={3}
            dataKey="value"
            stroke="hsl(var(--surface))"
            strokeWidth={3}
          >
            {safe.map((_, i) => (
              <Cell key={i} fill={`url(#${gid}-slice-${i})`} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <p className="text-xl font-bold tracking-tight">{centerValue}</p>}
          {centerLabel && (
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{centerLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
