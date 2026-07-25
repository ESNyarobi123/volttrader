import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  gold: {
    card: "border-volt/35 bg-gradient-to-br from-volt/25 via-surface to-surface shadow-[0_10px_30px_-18px_hsl(var(--volt)/0.55)]",
    icon: "bg-volt/25 text-volt-dim",
    value: "text-foreground",
  },
  blue: {
    card: "border-[hsl(var(--accent-blue)/0.35)] bg-gradient-to-br from-[hsl(var(--accent-blue)/0.18)] via-surface to-surface shadow-[0_10px_30px_-18px_hsl(var(--accent-blue)/0.45)]",
    icon: "bg-[hsl(var(--accent-blue)/0.2)] text-[hsl(var(--accent-blue))]",
    value: "text-foreground",
  },
  green: {
    card: "border-success/30 bg-gradient-to-br from-success/15 via-surface to-surface shadow-[0_10px_30px_-18px_hsl(var(--success)/0.4)]",
    icon: "bg-success/15 text-success",
    value: "text-foreground",
  },
  amber: {
    card: "border-warning/35 bg-gradient-to-br from-warning/18 via-surface to-surface shadow-[0_10px_30px_-18px_hsl(var(--warning)/0.4)]",
    icon: "bg-warning/20 text-[hsl(var(--warning))]",
    value: "text-foreground",
  },
  rose: {
    card: "border-danger/30 bg-gradient-to-br from-danger/12 via-surface to-surface shadow-[0_10px_30px_-18px_hsl(var(--danger)/0.35)]",
    icon: "bg-danger/15 text-danger",
    value: "text-foreground",
  },
  ink: {
    card: "border-border bg-gradient-to-br from-surface-2 via-surface to-surface",
    icon: "bg-surface-2 text-muted-foreground",
    value: "text-foreground",
  },
} as const;

export type StatTone = keyof typeof TONE;

export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  tone = "ink",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: StatTone;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("stat-tile relative overflow-hidden flex flex-col gap-2", t.card, className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/40 blur-2xl"
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-xl", t.icon)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <span className={cn("relative text-2xl font-bold tracking-tight", t.value)}>{value}</span>
      {hint ? <span className="relative text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
