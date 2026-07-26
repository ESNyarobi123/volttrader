import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE = {
  gold: {
    shell: "border-volt/25 from-volt/10",
    bar: "from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]",
    icon: "bg-volt/20 text-volt-dim",
  },
  blue: {
    shell: "border-[hsl(var(--accent-blue)/0.25)] from-[hsl(var(--accent-blue)/0.1)]",
    bar: "from-[hsl(0_0%_10%)] via-[hsl(349_74%_36%)] to-[hsl(142_65%_32%)]",
    icon: "bg-[hsl(var(--accent-blue)/0.15)] text-[hsl(var(--accent-blue))]",
  },
  green: {
    shell: "border-success/25 from-success/10",
    bar: "from-success via-[hsl(142_65%_29%)] to-volt",
    icon: "bg-success/15 text-success",
  },
  amber: {
    shell: "border-warning/30 from-warning/10",
    bar: "from-warning via-volt to-[hsl(30_10%_28%)]",
    icon: "bg-warning/15 text-[hsl(var(--warning))]",
  },
} as const;

export type FormSectionTone = keyof typeof TONE;

/** Titled panel that groups related fields inside the admin editor dialogs. */
export function FormSection({
  icon: Icon,
  title,
  description,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: FormSectionTone;
  children: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br via-surface to-surface p-4",
        t.shell,
      )}
    >
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />
      <div className="mb-4 flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-9 w-9 place-items-center rounded-xl", t.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
