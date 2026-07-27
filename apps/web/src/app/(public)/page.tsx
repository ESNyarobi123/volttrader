"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import type { CoursePlanView, InvestmentPlanView, LandingPageView } from "@volt/types";
import { Button } from "@/components/ui/button";
import { ForexCoursePlans } from "@/components/site/forex-course-plans";
import { HeroVideo } from "@/components/site/hero-video";
import { InvestmentPlans } from "@/components/site/investment-plans";
import { VoltPath } from "@/components/site/volt-path";
import { api } from "@/lib/api";

const FALLBACK: LandingPageView = {
  heroYoutubeId: "nMzMlm-F_yA",
  heroEyebrow: "LEARN · INVEST · BUILD",
  heroHeadline: "Learn Forex. Manage capital.",
  heroHeadlineAccent: "Explore opportunities.",
  heroSubcopy:
    "Mandanda Space brings education, wallet, and curated trading opportunities into one simple ecosystem — powerful inside, clear outside.",
  ctaPrimaryLabel: "Sign up free",
  ctaPrimaryHref: "/register",
  ctaSecondaryLabel: "Sign in",
  ctaSecondaryHref: "/login",
  stats: [
    { value: "Learn", label: "Forex Academy" },
    { value: "Invest", label: "Account Management" },
    { value: "Wallet", label: "Wallet balance" },
    { value: "Society", label: "Volt community" },
  ],
  closingHeadline: "Ready to learn, invest, and build with Mandanda Space?",
  closingSubcopy:
    "Create your free account in minutes — no upfront KYC required to get started.",
  closingCtaLabel: "Create your account",
  closingCtaHref: "/register",
  updatedAt: new Date(0).toISOString(),
};

export default function HomePage() {
  const landingQuery = useQuery({
    queryKey: ["landing"],
    queryFn: () => api.get<LandingPageView>("/landing"),
    staleTime: 60_000,
  });

  const coursePlansQuery = useQuery({
    queryKey: ["home", "course-plans"],
    queryFn: () => api.get<CoursePlanView[]>("/course-plans"),
  });

  const investmentPlansQuery = useQuery({
    queryKey: ["home", "investment-plans"],
    queryFn: () => api.get<InvestmentPlanView[]>("/investment-plans"),
  });

  const landing = landingQuery.data ?? FALLBACK;
  const stats = landing.stats.length > 0 ? landing.stats : FALLBACK.stats;

  return (
    <div className="min-w-0 overflow-x-hidden">
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 hero-gradient" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-volt/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-[hsl(0_0%_10%/0.12)] blur-3xl"
        />

        <div className="container-page relative grid min-w-0 items-start gap-8 pb-10 pt-10 sm:gap-10 sm:pb-12 sm:pt-12 md:pb-14 md:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-16 lg:pt-16">
          <div className="flex min-w-0 w-full max-w-full flex-col items-stretch text-left sm:items-start">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-volt-dim">
              {landing.heroEyebrow}
            </p>
            <h1 className="w-full max-w-xl break-words font-display text-[1.85rem] font-bold leading-[1.12] tracking-tight sm:text-4xl md:text-5xl lg:text-[3.35rem]">
              {landing.heroHeadline}{" "}
              {landing.heroHeadlineAccent ? (
                <span className="text-volt-dim">{landing.heroHeadlineAccent}</span>
              ) : null}
            </h1>
            <p className="mt-5 w-full max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              {landing.heroSubcopy}
            </p>

            <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-stretch sm:gap-3">
              <Link href={landing.ctaPrimaryHref} className="min-w-0">
                <Button
                  size="lg"
                  className="h-11 w-full rounded-full px-3 text-sm shadow-volt sm:h-12 sm:px-8 sm:text-base"
                >
                  {landing.ctaPrimaryLabel}
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </Button>
              </Link>
              <Link href={landing.ctaSecondaryHref} className="min-w-0">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 w-full rounded-full border-foreground/15 bg-background/80 px-3 text-sm sm:h-12 sm:px-8 sm:text-base"
                >
                  {landing.ctaSecondaryLabel}
                </Button>
              </Link>
            </div>

            <div
              className="relative mt-6 w-full max-w-full overflow-hidden sm:mt-8 sm:max-w-xl"
              aria-label="Highlights"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent sm:w-10"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent sm:w-10"
              />
              <div className="volt-marquee flex w-max max-w-none">
                {[0, 1].map((copy) => (
                  <ul key={copy} className="flex shrink-0 items-stretch gap-3 pr-3">
                    {stats.map((stat) => (
                      <li
                        key={`${copy}-${stat.value}-${stat.label}`}
                        className="flex w-[7.75rem] shrink-0 flex-col justify-center rounded-2xl border border-border/70 bg-background/70 px-3.5 py-3 shadow-sm backdrop-blur-sm sm:w-[8.5rem] sm:px-4"
                      >
                        <span className="font-display text-base font-bold tracking-tight sm:text-lg">
                          {stat.value}
                        </span>
                        <span className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                          {stat.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          </div>

          <div className="relative min-w-0 w-full max-w-full">
            <HeroVideo youtubeId={landing.heroYoutubeId} />
          </div>
        </div>
      </section>

      <ForexCoursePlans
        plans={coursePlansQuery.data ?? []}
        isLoading={coursePlansQuery.isLoading}
      />

      <InvestmentPlans
        plans={investmentPlansQuery.data ?? []}
        isLoading={investmentPlansQuery.isLoading}
      />

      <VoltPath />

      <section className="border-t border-border bg-gradient-to-br from-volt via-volt-hover to-ink py-16 text-white">
        <div className="container-page flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-xl font-display text-2xl font-bold tracking-tight md:text-3xl">
            {landing.closingHeadline}
          </h2>
          <p className="max-w-md text-sm text-white/75">{landing.closingSubcopy}</p>
          <Link href={landing.closingCtaHref}>
            <Button
              size="lg"
              className="rounded-full bg-white text-ink shadow-lg hover:bg-white/90"
            >
              {landing.closingCtaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
