import type { RiskCategory } from "@volt/config";
import { humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

const RISK_THEME: Record<
  RiskCategory,
  { wash: string; badge: string; chart: string; orb: string; multiplier: string }
> = {
  LOW: {
    wash: "from-[hsl(142_65%_29%/0.3)] via-[hsl(162_40%_96%)] to-[hsl(0_0%_10%/0.12)]",
    badge: "bg-[hsl(142_65%_29%/0.14)] text-[hsl(162_45%_30%)]",
    chart: "hsl(162 55% 40%)",
    orb: "bg-[hsl(142_65%_29%/0.35)]",
    multiplier: "text-[hsl(162_45%_32%)]",
  },
  MEDIUM: {
    wash: "from-[hsl(0_0%_10%/0.32)] via-[hsl(210_40%_97%)] to-volt/15",
    badge: "bg-[hsl(351_77%_61%/0.14)] text-[hsl(213_70%_36%)]",
    chart: "hsl(213 82% 52%)",
    orb: "bg-[hsl(351_77%_61%/0.35)]",
    multiplier: "text-[hsl(213_70%_38%)]",
  },
  HIGH: {
    wash: "from-volt/35 via-[hsl(46_60%_96%)] to-[hsl(349_74%_36%/0.14)]",
    badge: "bg-volt/18 text-volt-dim",
    chart: "hsl(46 95% 42%)",
    orb: "bg-volt/40",
    multiplier: "text-volt-dim",
  },
  VERY_HIGH: {
    wash: "from-[hsl(0_70%_55%/0.2)] via-[hsl(20_50%_97%)] to-[hsl(349_74%_36%/0.16)]",
    badge: "bg-[hsl(0_70%_55%/0.12)] text-[hsl(0_65%_38%)]",
    chart: "hsl(0 70% 48%)",
    orb: "bg-[hsl(0_70%_55%/0.3)]",
    multiplier: "text-[hsl(0_65%_40%)]",
  },
};

/** Deterministic sparkline points from opportunity id + multiplier (illustrative only). */
function buildTrendPoints(seed: string, multiplier: number, count = 14): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const points: number[] = [];
  let v = 28 + (h % 18);
  const drift = 1.2 + Math.min(multiplier, 8) * 0.55;
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const noise = ((h % 1000) / 1000 - 0.45) * 10;
    v = Math.max(12, Math.min(92, v + drift + noise));
    points.push(v);
  }
  return points;
}

function toPath(points: number[], width: number, height: number) {
  const step = width / Math.max(points.length - 1, 1);
  return points
    .map((y, i) => {
      const x = i * step;
      const py = height - (y / 100) * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(" ");
}

export function OpportunityTrend({
  risk,
  multiplier,
  seed,
  className,
  compact,
}: {
  risk: RiskCategory;
  multiplier: number;
  seed: string;
  className?: string;
  compact?: boolean;
}) {
  const theme = RISK_THEME[risk];
  const points = buildTrendPoints(seed, multiplier);
  const width = 200;
  const height = compact ? 88 : 112;
  const line = toPath(points, width, height);
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const gid = `opp-fill-${seed.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "x"}`;
  const last = points[points.length - 1] ?? 50;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        theme.wash,
        compact ? "aspect-[16/9]" : "aspect-[16/10]",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.chart} stopOpacity="0.4" />
            <stop offset="100%" stopColor={theme.chart} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid hints */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1="0"
            x2={width}
            y1={height * t}
            y2={height * t}
            stroke="currentColor"
            strokeOpacity="0.06"
            className="text-foreground"
          />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke={theme.chart}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End marker */}
        <circle
          cx={width}
          cy={height - (last / 100) * (height - 8) - 4}
          r="3.5"
          fill={theme.chart}
          className="transition-transform"
        />
      </svg>

      <span
        aria-hidden
        className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl", theme.orb)}
      />

      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm",
            theme.badge,
          )}
        >
          {humanize(risk)} risk
        </span>
        <span className="rounded-md bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-foreground/65 backdrop-blur-sm">
          Illustrative trend
        </span>
      </div>

      <div className="absolute bottom-3 right-3 rounded-xl border border-background/50 bg-surface/90 px-2.5 py-1.5 shadow-sm backdrop-blur-md">
        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          Target
        </p>
        <p className={cn("font-display text-lg font-bold leading-none", theme.multiplier)}>
          ×{multiplier}
        </p>
      </div>
    </div>
  );
}

export { RISK_THEME };
