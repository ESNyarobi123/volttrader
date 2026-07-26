import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  gold: "border-volt/30 from-volt/20",
  green: "border-success/30 from-success/15",
  blue: "border-[hsl(var(--accent-blue)/0.3)] from-[hsl(var(--accent-blue)/0.14)]",
  ink: "border-border from-surface-2",
  amber: "border-warning/30 from-warning/15",
} as const;

export type StatChipTone = keyof typeof TONE;

/** Compact metric tile used across the admin list pages. */
export function StatChip({
  icon: Icon,
  label,
  value,
  tone,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: StatChipTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br via-surface to-surface p-4 shadow-card",
        TONE[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-volt-dim" />
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
