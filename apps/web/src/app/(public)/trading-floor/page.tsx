"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck,
  LineChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { OpportunitySummary } from "@volt/types";
import { OpportunityCard } from "@/components/trading/opportunity-card";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ApiRequestError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

const STEPS: {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: "blue" | "gold" | "teal" | "amber";
}[] = [
  {
    step: "01",
    icon: LineChart,
    title: "Browse opportunities",
    description:
      "Review vetted trading opportunities with clear risk categories and target performance.",
    tone: "blue",
  },
  {
    step: "02",
    icon: ShieldCheck,
    title: "Read the risk disclosure",
    description:
      "Every opportunity carries a full risk disclosure and terms — read them before investing.",
    tone: "gold",
  },
  {
    step: "03",
    icon: Wallet,
    title: "Fund your investment",
    description:
      "Invest from your wallet balance or pay directly through a supported gateway.",
    tone: "teal",
  },
  {
    step: "04",
    icon: ClipboardCheck,
    title: "Track performance",
    description:
      "Monitor your investments and projected value from your dashboard portfolio.",
    tone: "amber",
  },
];

const TONE = {
  blue: {
    icon: "from-[hsl(351_77%_61%)] to-[hsl(349_74%_36%)] text-white",
    bar: "from-[hsl(351_77%_61%/0.7)] to-[hsl(351_77%_61%/0.15)]",
    node: "bg-[hsl(351_77%_61%)]",
  },
  gold: {
    icon: "from-volt to-[hsl(349_74%_36%)] text-volt-foreground",
    bar: "from-volt/70 to-volt/15",
    node: "bg-volt",
  },
  teal: {
    icon: "from-[hsl(142_65%_29%)] to-[hsl(142_62%_38%)] text-white",
    bar: "from-[hsl(142_65%_29%/0.7)] to-[hsl(142_65%_29%/0.15)]",
    node: "bg-[hsl(142_65%_29%)]",
  },
  amber: {
    icon: "from-[hsl(349_74%_36%)] to-[hsl(28_90%_48%)] text-white",
    bar: "from-[hsl(349_74%_36%/0.7)] to-[hsl(349_74%_36%/0.15)]",
    node: "bg-[hsl(349_74%_36%)]",
  },
} as const;

export default function TradingFloorPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["opportunities"],
    queryFn: () => api.get<OpportunitySummary[]>("/opportunities"),
  });

  const stats = useMemo(() => {
    const items = data ?? [];
    const risks = new Set(items.map((o) => o.riskCategory)).size;
    const avgDays =
      items.length === 0
        ? 0
        : Math.round(items.reduce((s, o) => s + o.durationDays, 0) / items.length);
    return { open: items.length, risks, avgDays };
  }, [data]);

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(70%_55%_at_85%_0%,hsl(0_0%_10%/0.16),transparent_55%),radial-gradient(50%_40%_at_10%_25%,hsl(142_65%_29%/0.1),transparent_50%)]"
      />

      <div className="container-page relative py-12 md:py-16">
        {/* Hero */}
        <header className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(213_70%_40%)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Trading Floor
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem]">
            Investment Opportunities
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            The Volt Trading Floor — a curated set of investment opportunities managed by our team,
            open to members ready to put capital to work.
          </p>
        </header>

        <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3">
          {[
            { label: "Open now", value: isLoading ? "—" : String(stats.open), icon: TrendingUp },
            { label: "Risk bands", value: isLoading ? "—" : String(stats.risks), icon: ShieldCheck },
            { label: "Avg. duration", value: isLoading ? "—" : `${stats.avgDays}d`, icon: ClipboardCheck },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/80 bg-surface/80 px-3 py-3 shadow-sm backdrop-blur-sm"
            >
              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <item.icon className="h-3 w-3" aria-hidden />
                {item.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-bold tracking-tight">{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* How it works — journey steps */}
        <section className="relative mt-12 md:mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                How it works
              </p>
              <h2 className="mt-1 font-display text-xl font-bold tracking-tight md:text-2xl">
                Four clear steps to the floor
              </h2>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute left-[6%] right-[6%] top-[2.1rem] hidden h-px bg-gradient-to-r from-[hsl(351_77%_61%/0.45)] via-volt/40 to-[hsl(349_74%_36%/0.45)] lg:block"
            />

            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => {
                const tone = TONE[item.tone];
                const Icon = item.icon;
                return (
                  <li key={item.step} className="relative">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-1/2 top-[1.85rem] z-10 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-background lg:block",
                        tone.node,
                      )}
                    />
                    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-border/80 bg-surface/90 p-5 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                      <div
                        aria-hidden
                        className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tone.bar)}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={cn(
                            "grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br shadow-sm transition-transform duration-300 group-hover:scale-105",
                            tone.icon,
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="font-display text-3xl font-bold leading-none tracking-tight text-foreground/10 transition-colors group-hover:text-foreground/20">
                          {item.step}
                        </span>
                      </div>
                      <h3 className="mt-4 font-display text-base font-bold tracking-tight">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Catalogue */}
        <section className="mt-14 md:mt-16">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Open opportunities
            </p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight md:text-2xl">
              Curated for members
            </h2>
          </div>

          {error ? (
            <Alert variant="danger" className="mb-6">
              {error instanceof ApiRequestError ? error.message : "Failed to load opportunities."}
            </Alert>
          ) : null}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[26rem] w-full rounded-[1.35rem]" />
              ))}
            </div>
          ) : data && data.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={LineChart}
              title="No opportunities open right now"
              description="Check back soon — new opportunities are published regularly."
            />
          )}

          {data && data.length > 0 ? (
            <ProjectionDisclaimer className="mx-auto mt-10 max-w-2xl text-center" />
          ) : null}
        </section>
      </div>
    </div>
  );
}
