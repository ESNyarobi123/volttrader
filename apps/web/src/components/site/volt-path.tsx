import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  LineChart,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    title: "Create your account",
    body: "Sign up in minutes — name, email, password. No heavy KYC until you invest or withdraw.",
    href: "/register",
    cta: "Sign up free",
    icon: UserPlus,
    tone: "crimson" as const,
  },
  {
    n: "02",
    title: "Fund your wallet",
    body: "Deposit via enabled channels. Your balance is always ledger-true — every credit and debit is append-only.",
    href: "/dashboard/wallet",
    cta: "Open wallet",
    icon: Wallet,
    tone: "ink" as const,
  },
  {
    n: "03",
    title: "Invest on the floor",
    body: "Pick a curated opportunity, accept Terms & Risk, then fund. Targets are projections — never guarantees.",
    href: "/trading-floor",
    cta: "Open Trading Floor",
    icon: LineChart,
    tone: "crimson" as const,
  },
];

const TONE = {
  crimson: {
    badge: "bg-volt text-volt-foreground shadow-volt",
    icon: "bg-gradient-to-br from-volt to-volt-hover text-white shadow-[0_14px_28px_-14px_hsl(var(--volt)/0.65)]",
    ring: "border-volt/25 hover:border-volt/45",
    glow: "from-volt/20 via-transparent to-transparent",
  },
  ink: {
    badge: "bg-ink text-white shadow-lift",
    icon: "bg-gradient-to-br from-ink to-[hsl(0_0%_18%)] text-white shadow-[0_14px_28px_-14px_hsl(0_0%_10%/0.45)]",
    ring: "border-foreground/10 hover:border-foreground/25",
    glow: "from-ink/10 via-transparent to-transparent",
  },
};

export function VoltPath({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border pb-14 pt-6 md:pb-16 md:pt-8",
        className,
      )}
    >
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,hsl(var(--volt)/0.1),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-ink/5 blur-3xl"
      />

      <div className="container-page relative">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
            How it works
            <ShieldCheck className="h-3.5 w-3.5 text-accent-mint" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Three clear steps. One ecosystem.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Learn, fund, and allocate — with ledger honesty and risk disclosure built into the path.
          </p>
        </div>

        {/* Connected steps */}
        <div className="relative mt-10 md:mt-12">
          {/* Desktop connector line */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-[2.75rem] hidden h-px bg-gradient-to-r from-volt/40 via-ink/25 to-volt/40 md:block"
          />

          <ol className="grid gap-4 md:grid-cols-3 md:gap-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const tone = TONE[step.tone];
              return (
                <li key={step.n} className="group relative">
                  <article
                    className={cn(
                      "relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border bg-surface p-5 shadow-card transition-all duration-300 sm:p-6",
                      "hover:-translate-y-1 hover:shadow-lift",
                      tone.ring,
                    )}
                  >
                    <div
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-b opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                        tone.glow,
                      )}
                    />

                    <div className="relative flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "grid h-14 w-14 place-items-center rounded-2xl",
                          tone.icon,
                        )}
                      >
                        <Icon className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="font-display text-4xl font-bold tracking-tight text-foreground/8 transition-colors group-hover:text-foreground/14">
                        {step.n}
                      </span>
                    </div>

                    <h3 className="relative mt-5 font-display text-xl font-bold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="relative mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>

                    <Link
                      href={step.href}
                      className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-volt-dim transition-colors hover:text-foreground"
                    >
                      {step.cta}
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>

                    {/* Mobile connector to next */}
                    {i < STEPS.length - 1 ? (
                      <div
                        aria-hidden
                        className="absolute -bottom-2 left-1/2 h-4 w-px -translate-x-1/2 bg-gradient-to-b from-border to-transparent md:hidden"
                      />
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Bottom action strip */}
        <div className="mt-8 flex flex-col items-stretch justify-between gap-4 rounded-[1.5rem] border border-border/80 bg-gradient-to-r from-surface via-surface to-volt/8 p-4 sm:flex-row sm:items-center sm:p-5 md:mt-10">
          <div className="flex items-start gap-3 sm:items-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt/15 text-volt-dim">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Prefer to learn first?
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Browse academy plans above, then come back when you&apos;re ready to allocate.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link href="/trading-floor">
              <Button className="h-11 w-full rounded-full px-6 shadow-volt sm:w-auto">
                Open Trading Floor
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="/register">
              <Button
                variant="outline"
                className="h-11 w-full rounded-full border-foreground/15 px-6 sm:w-auto"
              >
                Create account
              </Button>
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Trading and investing carry risk. Labels use Projected Outcome / Target Performance /
          Historical Performance — not guaranteed returns.
        </p>
      </div>
    </section>
  );
}
