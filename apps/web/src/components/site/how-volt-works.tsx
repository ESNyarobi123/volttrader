import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  LineChart,
  Shield,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Path = {
  step: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  accent: "gold" | "teal" | "blue";
  preview: "academy" | "wallet" | "floor";
};

const PATHS: Path[] = [
  {
    step: "01",
    title: "Learn Forex",
    description:
      "A structured academy — from fundamentals to advanced strategy — taught in plain language.",
    href: "/learn",
    cta: "Browse academy",
    icon: GraduationCap,
    accent: "gold",
    preview: "academy",
  },
  {
    step: "02",
    title: "Manage capital",
    description:
      "One wallet for deposits, tracking, and withdrawals — every move visible in your history.",
    href: "/dashboard/wallet",
    cta: "Open wallet",
    icon: Wallet,
    accent: "teal",
    preview: "wallet",
  },
  {
    step: "03",
    title: "Explore opportunities",
    description:
      "Curated account-management packages with clear risk categories and projected profits — never guarantees.",
    href: "/trading-floor",
    cta: "View investments",
    icon: TrendingUp,
    accent: "blue",
    preview: "floor",
  },
];

const ACCENT = {
  gold: {
    icon: "from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-[0_12px_28px_-12px_hsl(350_73%_36%/0.55)]",
    glow: "group-hover:shadow-[0_24px_48px_-28px_hsl(350_73%_36%/0.55)]",
    bar: "from-volt/80 to-volt/20",
    chip: "bg-volt/15 text-volt-dim",
    ring: "group-hover:border-volt/40",
    number: "text-volt/25 group-hover:text-volt/40",
  },
  teal: {
    icon: "from-[hsl(142_65%_29%)] to-[hsl(142_62%_38%)] text-white shadow-[0_12px_28px_-12px_hsl(162_55%_30%/0.5)]",
    glow: "group-hover:shadow-[0_24px_48px_-28px_hsl(162_55%_35%/0.45)]",
    bar: "from-[hsl(142_65%_29%/0.8)] to-[hsl(142_65%_29%/0.15)]",
    chip: "bg-[hsl(142_65%_29%/0.12)] text-[hsl(162_45%_32%)]",
    ring: "group-hover:border-[hsl(142_65%_29%/0.4)]",
    number: "text-[hsl(142_65%_29%/0.22)] group-hover:text-[hsl(142_65%_29%/0.38)]",
  },
  blue: {
    icon: "from-[hsl(351_77%_61%)] to-[hsl(349_74%_36%)] text-white shadow-[0_12px_28px_-12px_hsl(349_74%_30%/0.5)]",
    glow: "group-hover:shadow-[0_24px_48px_-28px_hsl(350_73%_40%/0.45)]",
    bar: "from-[hsl(351_77%_61%/0.8)] to-[hsl(351_77%_61%/0.15)]",
    chip: "bg-[hsl(351_77%_61%/0.12)] text-[hsl(213_70%_38%)]",
    ring: "group-hover:border-[hsl(351_77%_61%/0.4)]",
    number: "text-[hsl(351_77%_61%/0.22)] group-hover:text-[hsl(351_77%_61%/0.38)]",
  },
} as const;

function PathPreview({ kind }: { kind: Path["preview"] }) {
  if (kind === "academy") {
    return (
      <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-br from-volt/20 via-surface to-[hsl(0_0%_10%/0.12)] p-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt/30 text-volt-dim">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
            <div className="h-1.5 w-1/2 rounded-full bg-foreground/8" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-1.5 w-full rounded-full bg-foreground/8" />
          <div className="h-1.5 w-[88%] rounded-full bg-foreground/8" />
          <div className="flex gap-1.5 pt-1">
            <span className="h-5 w-14 rounded-md bg-volt/35" />
            <span className="h-5 w-10 rounded-md bg-foreground/8" />
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 rounded-full bg-volt/25 blur-xl"
        />
      </div>
    );
  }

  if (kind === "wallet") {
    return (
      <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(142_65%_29%/0.16)] via-surface to-surface-2 p-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Available
            </p>
            <p className="mt-0.5 font-display text-xl font-bold tracking-tight">
              $1,250
            </p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(142_65%_29%/0.2)] text-[hsl(162_45%_32%)]">
            <Shield className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-4 flex items-end gap-1.5">
          {[40, 65, 48, 80, 55, 72, 90].map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-[hsl(142_65%_29%/0.35)]"
              style={{ height: `${h * 0.28}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(0_0%_10%/0.16)] via-surface to-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(213_70%_38%)]">
          Account mgmt
        </span>
        <LineChart className="h-3.5 w-3.5 text-[hsl(351_77%_61%)]" />
      </div>
      <svg viewBox="0 0 160 48" className="h-12 w-full" aria-hidden>
        <defs>
          <linearGradient id="floorFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(351 77% 61%)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(351 77% 61%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 36 C20 34, 28 20, 44 22 C60 24, 68 10, 84 14 C100 18, 112 28, 128 18 C140 12, 148 16, 160 8 L160 48 L0 48 Z"
          fill="url(#floorFill)"
        />
        <path
          d="M0 36 C20 34, 28 20, 44 22 C60 24, 68 10, 84 14 C100 18, 112 28, 128 18 C140 12, 148 16, 160 8"
          fill="none"
          stroke="hsl(213 82% 48%)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex gap-2">
        <span className="rounded-md bg-[hsl(351_77%_61%/0.15)] px-2 py-0.5 text-[10px] font-semibold text-[hsl(213_70%_38%)]">
          Projected
        </span>
        <span className="rounded-md bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Risk disclosed
        </span>
      </div>
    </div>
  );
}

export function HowVoltWorks({ className }: { className?: string }) {
  return (
    <section className={cn("relative overflow-hidden py-20 md:py-28", className)}>
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,hsl(350_73%_44%/0.12),transparent_55%),radial-gradient(50%_40%_at_90%_80%,hsl(0_0%_10%/0.1),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-px w-[min(100%,56rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div className="container-page relative">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-dim">
            The Volt path
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem]">
            How Volt works for you
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
            Three clear paths — learn, manage money, and explore opportunities — without the
            clutter.
          </p>
        </header>

        {/* Journey rail + cards */}
        <div className="relative mt-14 md:mt-16">
          {/* Desktop connector through the three steps */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[8%] right-[8%] top-[2.15rem] hidden h-px bg-gradient-to-r from-volt/40 via-[hsl(142_65%_29%/0.35)] to-[hsl(351_77%_61%/0.4)] md:block"
          />

          <ol className="grid gap-5 md:grid-cols-3 md:gap-6">
            {PATHS.map((path, index) => {
              const Icon = path.icon;
              const accent = ACCENT[path.accent];

              return (
                <li key={path.step} className="relative">
                  {/* Step node on the rail */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 top-[1.85rem] z-10 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background bg-foreground/20 md:block"
                    style={{
                      background:
                        path.accent === "gold"
                          ? "hsl(350 73% 44%)"
                          : path.accent === "teal"
                            ? "hsl(142 65% 29%)"
                            : "hsl(351 77% 61%)",
                    }}
                  />

                  <Link
                    href={path.href}
                    className={cn(
                      "group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/80 bg-surface/90 p-5 shadow-card backdrop-blur-sm transition-all duration-300",
                      "hover:-translate-y-1.5 hover:bg-surface",
                      accent.glow,
                      accent.ring,
                    )}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div
                      aria-hidden
                      className={cn(
                        "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80 transition-opacity group-hover:opacity-100",
                        accent.bar,
                      )}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-105",
                          accent.icon,
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <span
                        className={cn(
                          "font-display text-4xl font-bold leading-none tracking-tight transition-colors",
                          accent.number,
                        )}
                      >
                        {path.step}
                      </span>
                    </div>

                    <div className="mt-5">
                      <PathPreview kind={path.preview} />
                    </div>

                    <div className="mt-5 flex flex-1 flex-col">
                      <span
                        className={cn(
                          "inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          accent.chip,
                        )}
                      >
                        Step {path.step}
                      </span>
                      <h3 className="mt-2 font-display text-xl font-bold tracking-tight">
                        {path.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {path.description}
                      </p>

                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors group-hover:text-volt-dim">
                        {path.cta}
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
