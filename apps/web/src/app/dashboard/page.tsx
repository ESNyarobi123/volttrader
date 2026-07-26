"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  PlusCircle,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type {
  CourseSummary,
  EnrollmentView,
  InvestmentView,
  LedgerEntryView,
  OpportunitySummary,
  PortfolioSummary,
} from "@volt/types";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatMoney, initials, resolveStorageUrl } from "@/lib/format";
import { humanize, statusVariant } from "@/lib/status";
import { SoftNotice } from "@/components/shared/soft-notice";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function firstName(name?: string | null) {
  if (!name) return "there";
  return name.split(" ")[0] ?? "there";
}

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const portfolioQuery = useQuery({
    queryKey: ["investments", "portfolio"],
    queryFn: () => api.get<PortfolioSummary>("/investments/portfolio"),
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", "me"],
    queryFn: () => api.get<EnrollmentView[]>("/enrollments/me"),
  });

  const investmentsQuery = useQuery({
    queryKey: ["investments", "me"],
    queryFn: () => api.get<InvestmentView[]>("/investments/me"),
  });

  const activityQuery = useQuery({
    queryKey: ["wallet", "transactions", { pageSize: 8 }],
    queryFn: () => api.get<LedgerEntryView[]>("/wallet/transactions?page=1&pageSize=8"),
  });

  const coursesCatalogQuery = useQuery({
    queryKey: ["courses", "ALL"],
    queryFn: () => api.get<CourseSummary[]>("/courses"),
  });

  const openOppsQuery = useQuery({
    queryKey: ["opportunities", "open"],
    queryFn: () => api.get<OpportunitySummary[]>("/opportunities"),
  });

  const enrollments = enrollmentsQuery.data ?? [];
  const investments = investmentsQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const portfolio = portfolioQuery.data;

  const activeInvestments = investments.filter((i) =>
    ["PENDING", "ACTIVE"].includes(i.status),
  );
  const courseCards = enrollments.slice(0, 4);
  const investCards = (activeInvestments.length ? activeInvestments : investments).slice(0, 3);
  const recommendedCourses = (coursesCatalogQuery.data ?? []).slice(0, 4);
  const recommendedOpps = (openOppsQuery.data ?? []).slice(0, 4);

  const loading =
    portfolioQuery.isLoading ||
    enrollmentsQuery.isLoading ||
    investmentsQuery.isLoading;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
      {/* ── Main column ── */}
      <div className="min-w-0 space-y-6">
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Hi, {firstName(user?.fullName)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Forex courses and investments in one place.
          </p>
        </header>

        {user && user.kycStatus !== "APPROVED" ? (
          <SoftNotice
            title="KYC needed before investing or withdrawing"
            action={
              <Link
                href="/dashboard/profile?tab=kyc"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
              >
                Verify KYC
              </Link>
            }
          >
            Complete verification when you&apos;re ready — you can still browse and learn now.
          </SoftNotice>
        ) : null}

        {/* Stats row — LMS style accent bars */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))
          ) : (
            <>
              <StatCard
                accent="volt"
                icon={Wallet}
                label="Wallet balance"
                value={portfolio ? formatMoney(portfolio.walletBalance) : "—"}
                href="/dashboard/wallet"
                linkLabel="Deposit / withdraw"
              />
              <StatCard
                accent="ink"
                icon={GraduationCap}
                label="Courses in progress"
                value={String(enrollments.filter((e) => e.status === "ACTIVE").length || enrollments.length)}
                hint={
                  enrollments[0]
                    ? `${Math.round(enrollments[0].progressPercent)}% on current`
                    : "Start learning"
                }
              />
              <StatCard
                accent="soft"
                icon={TrendingUp}
                label="Active investments"
                value={String(portfolio?.activeInvestments ?? 0)}
                hint={
                  portfolio
                    ? `${formatMoney(portfolio.totalInvested)} allocated`
                    : "None yet"
                }
              />
            </>
          )}
        </section>

        {/* My Courses / Recommended */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight">
              {courseCards.length === 0 ? "Recommended courses" : "My courses"}
            </h2>
            <Link
              href={courseCards.length === 0 ? "/dashboard/learn/explore" : "/dashboard/learn"}
              className="inline-flex items-center gap-1 text-xs font-semibold text-volt-dim hover:text-foreground"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {enrollmentsQuery.isLoading ||
          (courseCards.length === 0 && coursesCatalogQuery.isLoading) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : courseCards.length === 0 ? (
            recommendedCourses.length === 0 ? (
              <EmptyBlock
                title="No courses yet"
                body="Academy catalogue is empty."
                href="/dashboard/learn/explore"
                cta="Browse academy"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recommendedCourses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/courses/${c.slug}`}
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:p-4"
                  >
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-ink/90 text-white">
                      <BookOpen className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="volt" className="text-[10px]">
                          {humanize(c.level)}
                        </Badge>
                        {c.accessType === "FREE" ? (
                          <Badge variant="success" className="text-[10px]">
                            Free
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate font-semibold group-hover:text-volt-dim">
                        {c.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.accessType === "FREE" ? "Free" : formatMoney(c.price)} ·{" "}
                        {c.lessonsCount} lessons
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-volt-dim">
                      {c.accessType === "FREE" ? "Enroll" : "Buy"}
                      <ArrowRight className="ml-0.5 inline h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courseCards.map((e) => (
                <Link
                  key={e.id}
                  href={`/dashboard/learn/${e.course.slug}`}
                  className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:p-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-volt/10 sm:h-[4.5rem] sm:w-[4.5rem]">
                    {resolveStorageUrl(e.course.thumbnailUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveStorageUrl(e.course.thumbnailUrl)!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-volt-dim">
                        <BookOpen className="h-6 w-6" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground group-hover:text-volt-dim">
                      {e.course.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {e.course.lessonsCount} lessons · {humanize(e.course.level)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {humanize(e.status)}
                    </p>
                  </div>
                  <ProgressRing value={e.progressPercent} size={64} className="shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Investments / Recommended */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight">
              {investCards.length === 0 ? "Open opportunities" : "My investments"}
            </h2>
            <Link
              href={
                investCards.length === 0 ? "/dashboard/invest/explore" : "/dashboard/invest"
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-volt-dim hover:text-foreground"
            >
              {investCards.length === 0 ? "View all" : "Portfolio"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {investmentsQuery.isLoading ||
          (investCards.length === 0 && openOppsQuery.isLoading) ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : investCards.length === 0 ? (
            recommendedOpps.length === 0 ? (
              <EmptyBlock
                title="No opportunities open"
                body="Check back soon. Targets are not guarantees."
                href="/trading-floor"
                cta="Trading Floor"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recommendedOpps.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/trading-floor/${opp.slug}`}
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:p-4"
                  >
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink/90 text-white">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Badge variant="default" className="text-[10px]">
                        {humanize(opp.riskCategory)}
                      </Badge>
                      <p className="mt-1 truncate font-semibold group-hover:text-volt-dim">
                        {opp.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        From {formatMoney({ amount: opp.minAmount, currency: opp.currency })} ·{" "}
                        {opp.durationDays}d
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Targets are not guarantees
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-volt-dim">
                      Open
                      <ArrowRight className="ml-0.5 inline h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {investCards.map((inv) => (
                <article
                  key={inv.id}
                  className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold leading-snug text-foreground">
                      {inv.opportunity.name}
                    </p>
                    <Badge variant={statusVariant(inv.status)} className="shrink-0">
                      {humanize(inv.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Risk: {humanize(inv.opportunity.riskCategory)} ·{" "}
                    {inv.opportunity.durationDays}d
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Principal</dt>
                      <dd className="truncate font-semibold">{formatMoney(inv.principal)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Target performance</dt>
                      <dd className="truncate font-semibold">
                        {formatMoney(inv.projectedValue)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Targets are not guarantees
                  </p>
                  <Link
                    href={`/dashboard/invest/${inv.id}`}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "mt-4 w-full rounded-full shadow-volt",
                    )}
                  >
                    View
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Right rail (desktop) ── */}
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-[8.5rem] lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5 text-center shadow-card">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-volt to-[hsl(351_77%_61%)] text-lg font-bold text-volt-foreground shadow-volt">
            {initials(user?.fullName)}
          </div>
          <p className="mt-3 font-display text-lg font-bold tracking-tight">
            {user?.fullName ?? "Member"}
          </p>
          <p className="text-xs text-muted-foreground">Volt member</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs">
            <div className="rounded-xl bg-surface-2/80 px-3 py-2">
              <p className="text-muted-foreground">Courses</p>
              <p className="mt-0.5 text-base font-bold">{enrollments.length}</p>
            </div>
            <div className="rounded-xl bg-surface-2/80 px-3 py-2">
              <p className="text-muted-foreground">Investments</p>
              <p className="mt-0.5 text-base font-bold">
                {portfolio?.activeInvestments ?? 0}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/profile"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-4 w-full rounded-full",
            )}
          >
            Profile & KYC
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold tracking-tight">Activity</h2>
            <Link
              href="/dashboard/wallet"
              className="text-xs font-semibold text-volt-dim hover:text-foreground"
            >
              History
            </Link>
          </div>

          {activityQuery.isLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Deposits, course payments, and investments will show here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activity.slice(0, 6).map((tx) => {
                const d = new Date(tx.createdAt);
                const day = d.getDate().toString().padStart(2, "0");
                const mon = d.toLocaleString("en", { month: "short" }).toUpperCase();
                return (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-2/40 px-2.5 py-2"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface text-center leading-tight">
                      <span className="text-sm font-bold tabular-nums">{day}</span>
                      <span className="text-[9px] font-semibold text-muted-foreground">
                        {mon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{humanize(tx.type)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        tx.direction === "CREDIT" ? "text-success" : "text-foreground",
                      )}
                    >
                      {tx.direction === "CREDIT" ? "+" : "−"}
                      {formatMoney(tx.amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Link
            href="/dashboard/wallet"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-volt")}
          >
            <Wallet className="h-4 w-4" />
            Deposit
          </Link>
          <Link
            href="/trading-floor"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
          >
            <TrendingUp className="h-4 w-4" />
            Invest
          </Link>
        </div>
      </aside>
    </div>
  );
}

function StatCard({
  accent,
  icon: Icon,
  label,
  value,
  hint,
  href,
  linkLabel,
}: {
  accent: "volt" | "ink" | "soft";
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  linkLabel?: string;
}) {
  const bar =
    accent === "volt"
      ? "bg-volt"
      : accent === "ink"
        ? "bg-ink"
        : "bg-[hsl(351_77%_61%)]";

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold tracking-tight md:text-2xl">
            {value}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
          {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
          {href && linkLabel ? (
            <Link
              href={href}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-volt-dim hover:text-foreground"
            >
              {linkLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function EmptyBlock({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-5 shadow-card sm:p-6">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Link
        href={href}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 rounded-full")}
      >
        <PlusCircle className="h-4 w-4" />
        {cta}
      </Link>
    </div>
  );
}
