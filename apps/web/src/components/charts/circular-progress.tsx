"use client";

import { CHART_COLORS } from "@/components/charts/chart-theme";

/** Circular progress ring (0–100) for course / goal completion. */
export function CircularProgress({
  value,
  size = 88,
  stroke = 8,
  color = CHART_COLORS[0],
  trackColor = "hsl(var(--surface-2))",
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tracking-tight">{label ?? `${Math.round(pct)}%`}</span>
        {sublabel ? (
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}
