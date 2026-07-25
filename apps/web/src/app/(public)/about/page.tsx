import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Compass,
  GraduationCap,
  Layers,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About",
  description: "The mission, vision, and values behind Volt Trades.",
};

const PILLARS: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  tone: string;
}[] = [
  {
    icon: GraduationCap,
    title: "Academy",
    description: "Structured Forex learning from fundamentals to strategy.",
    href: "/learn",
    tone: "from-volt to-[hsl(349_74%_36%)] text-volt-foreground",
  },
  {
    icon: Wallet,
    title: "Wallet",
    description: "One balance, one immutable ledger — every move visible.",
    href: "/dashboard/wallet",
    tone: "from-[hsl(142_65%_29%)] to-[hsl(142_62%_38%)] text-white",
  },
  {
    icon: TrendingUp,
    title: "Trading Floor",
    description: "Curated opportunities with clear risk and target performance.",
    href: "/trading-floor",
    tone: "from-[hsl(351_77%_61%)] to-[hsl(349_74%_36%)] text-white",
  },
];

const STORY_BEATS: { step: string; title: string; body: string }[] = [
  {
    step: "01",
    title: "The gap we saw",
    body: "Most people were either taught to trade with no capital discipline, or given access to capital opportunities with no education. That split creates noise — and risk.",
  },
  {
    step: "02",
    title: "What we set out to build",
    body: "A single platform where learning and investing reinforce each other, governed by strict money-handling rules and a compliance-first mindset.",
  },
  {
    step: "03",
    title: "Where we are today",
    body: "A scalable ecosystem — Academy, Trading Floor, Wallet, Projects, and Community — not a single-page investment site. Clarity outside. Power inside.",
  },
];

const VALUES: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: string;
}[] = [
  {
    icon: ShieldCheck,
    title: "Transparency first",
    description:
      "Every projection is labeled clearly as a target, never a promise. Our ledger and reporting are built to be auditable.",
    tone: "from-[hsl(142_65%_29%)] to-[hsl(142_62%_38%)] text-white",
  },
  {
    icon: Users,
    title: "Education before capital",
    description:
      "We believe informed investors make better decisions. The Forex Academy exists so members understand what they're doing before they do it.",
    tone: "from-volt to-[hsl(349_74%_36%)] text-volt-foreground",
  },
  {
    icon: Sparkles,
    title: "Simple outside, powerful inside",
    description:
      "Members see three things: Learn, Invest, Manage Money. Behind that simplicity is a robust, modular platform.",
    tone: "from-[hsl(351_77%_61%)] to-[hsl(349_74%_36%)] text-white",
  },
  {
    icon: Compass,
    title: "Discipline over hype",
    description:
      "No guaranteed returns, no shortcuts. We build for the long term with clear risk disclosures at every step.",
    tone: "from-[hsl(349_74%_36%)] to-[hsl(28_90%_48%)] text-white",
  },
];

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(70%_55%_at_50%_-5%,hsl(350_73%_44%/0.18),transparent_55%),radial-gradient(45%_40%_at_95%_20%,hsl(0_0%_10%/0.12),transparent_50%)]"
      />

      {/* Hero */}
      <section className="container-page relative py-14 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-dim">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            LEARN · INVEST · BUILD
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.85rem]">
            About Volt Trades
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-lg">
            Volt Trades is a modular ecosystem for learning Forex, managing capital, and exploring
            curated investment opportunities — built for members who want clarity, not noise.
          </p>
        </div>

        {/* Ecosystem pillars */}
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Link
                key={pillar.title}
                href={pillar.href}
                className="group relative overflow-hidden rounded-[1.25rem] border border-border/80 bg-surface/90 p-5 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-volt/30 hover:shadow-lift"
              >
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br shadow-sm transition-transform duration-300 group-hover:scale-105",
                    pillar.tone,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold tracking-tight">{pillar.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground transition-colors group-hover:text-volt-dim">
                  Explore
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Mission + Vision */}
      <section className="container-page relative pb-6 md:pb-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-[1.35rem] border border-border/80 bg-gradient-to-br from-surface via-surface to-volt/10 p-6 shadow-card md:p-8">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt/80 to-volt/20"
            />
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-sm">
              <Rocket className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-volt-dim">
              Our mission
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              Clarity for everyday members
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              To make Forex education and access to curated trading opportunities available to
              everyday members, backed by transparent tooling: a real ledger, verified payments, and
              clear risk disclosures on every opportunity.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[1.35rem] border border-border/80 bg-gradient-to-br from-surface via-surface to-[hsl(0_0%_10%/0.12)] p-6 shadow-card md:p-8">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[hsl(351_77%_61%/0.8)] to-[hsl(351_77%_61%/0.15)]"
            />
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[hsl(351_77%_61%)] to-[hsl(349_74%_36%)] text-white shadow-sm">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(213_70%_40%)]">
              Our vision
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              One connected ecosystem
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              A connected ecosystem — Academy, Trading Floor, Wallet, Projects, and Community —
              where members grow their knowledge and their capital side by side, and where the
              underlying platform scales without ever compromising trust.
            </p>
          </article>
        </div>
      </section>

      {/* Our story */}
      <section className="relative border-y border-border/70 py-16 md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_0%_50%,hsl(0_0%_10%/0.08),transparent_55%)]"
        />
        <div className="container-page relative">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-dim">
                Our story
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Built to close the gap between learning and capital
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                Volt Trades started from a simple observation — and grew into a modular platform
                designed for members who want discipline over hype.
              </p>
              <Link
                href="/learn"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "mt-6 rounded-full border-foreground/12 bg-surface/80 px-6",
                )}
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Start with the Academy
              </Link>
            </div>

            <ol className="relative space-y-4">
              <div
                aria-hidden
                className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-gradient-to-b from-volt/50 via-[hsl(351_77%_61%/0.35)] to-transparent md:left-[1.6rem]"
              />
              {STORY_BEATS.map((beat) => (
                <li
                  key={beat.step}
                  className="relative flex gap-4 rounded-[1.25rem] border border-border/80 bg-surface/90 p-5 shadow-card backdrop-blur-sm md:gap-5 md:p-6"
                >
                  <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/90 to-[hsl(351_77%_61%)] font-display text-sm font-bold text-volt-foreground shadow-sm md:h-12 md:w-12">
                    {beat.step}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="font-display text-lg font-bold tracking-tight">{beat.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {beat.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* What we stand for */}
      <section className="container-page relative py-16 md:py-20">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-dim">
            Values
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
            What we stand for
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Four principles that shape every product decision — from copy on a button to how money
            moves through the ledger.
          </p>
        </header>

        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2">
          {VALUES.map((value) => {
            const Icon = value.icon;
            return (
              <article
                key={value.title}
                className="group relative overflow-hidden rounded-[1.35rem] border border-border/80 bg-surface/95 p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift md:p-7"
              >
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br shadow-sm transition-transform duration-300 group-hover:scale-105",
                    value.tone,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-14 max-w-2xl rounded-[1.35rem] border border-border/80 bg-gradient-to-br from-volt/15 via-surface to-[hsl(0_0%_10%/0.12)] px-6 py-8 text-center shadow-card md:px-10">
          <h3 className="font-display text-xl font-bold tracking-tight md:text-2xl">
            Ready to learn, invest, and build with us?
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create a free account — no upfront KYC required to get started.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "rounded-full px-7 shadow-volt",
              )}
            >
              Sign up free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/risk-disclosure"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full border-foreground/12 bg-surface/80 px-7",
              )}
            >
              Risk disclosure
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
