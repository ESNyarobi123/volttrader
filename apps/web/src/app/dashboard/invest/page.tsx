"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Copy,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type {
  DepositMethodsView,
  InvestmentPlanCatalogItem,
  InvestmentPlanMembershipView,
  InvestmentView,
  PaymentView,
  PortfolioSummary,
} from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { formatDate, formatMoney, toMinorUnits } from "@/lib/format";
import { humanize, statusVariant } from "@/lib/status";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { PaymentMethodCard } from "@/components/shared/payment-method-card";
import { InvestmentPlanCard } from "@/components/site/investment-plan-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FilterId = "all" | "ACTIVE" | "PENDING" | "SETTLED";
type PayMethod = "WALLET" | "MANUAL" | "PAYMENT";
type DialogStep = "method" | "details";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function isInsufficientBalance(message: string) {
  return /insufficient wallet balance/i.test(message);
}

function statusCopy(inv: InvestmentView): string {
  if (inv.status === "PENDING") {
    return "Waiting for payment confirmation before the earning cycle starts.";
  }
  if (inv.status === "ACTIVE") {
    const days = daysUntil(inv.maturesAt);
    if (days !== null && days > 0) {
      return `Earning cycle in progress · matures in ${days} day${days === 1 ? "" : "s"}. Withdraw after settlement.`;
    }
    if (days !== null && days <= 0) {
      return "Cycle ended · awaiting settlement. Funds become withdrawable after settlement.";
    }
    return "Earning cycle in progress. Withdraw after the plan matures and settles.";
  }
  if (inv.status === "SETTLED" || inv.status === "MATURED") {
    return "Cycle complete. Settled value is in your wallet — you can withdraw from Wallet.";
  }
  return humanize(inv.status);
}

interface InvestResponse {
  investment?: InvestmentView;
  payment?: PaymentView;
}

export default function DashboardInvestPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("all");
  const [selected, setSelected] = useState<InvestmentPlanCatalogItem | null>(null);
  const [step, setStep] = useState<DialogStep>("method");
  const [method, setMethod] = useState<PayMethod>("WALLET");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<"MOBILE_MONEY" | "BANK_TRANSFER">("MOBILE_MONEY");
  const [payerReference, setPayerReference] = useState("");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsDeposit, setNeedsDeposit] = useState(false);
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const portfolioQuery = useQuery({
    queryKey: ["investments", "portfolio"],
    queryFn: () => api.get<PortfolioSummary>("/investments/portfolio"),
  });

  const investmentsQuery = useQuery({
    queryKey: ["investments", "me"],
    queryFn: () => api.get<InvestmentView[]>("/investments/me"),
  });

  const catalogQuery = useQuery({
    queryKey: ["investment-plans", "me"],
    queryFn: () => api.get<InvestmentPlanMembershipView>("/investment-plans/me"),
  });

  const methodsQuery = useQuery({
    queryKey: ["payments", "deposit-methods"],
    queryFn: () => api.get<DepositMethodsView>("/payments/deposit-methods"),
    enabled: !!selected,
  });
  const methods = methodsQuery.data;

  const invest = useMutation({
    mutationFn: () => {
      if (!selected?.opportunityId) throw new Error("Plan not available");
      return api.post<InvestResponse | InvestmentView>("/investments", {
        opportunityId: selected.opportunityId,
        amount: toMinorUnits(Number(amount), selected.minAmount.currency),
        source: method,
        acceptedRisk: true as const,
        ...(method === "MANUAL"
          ? { channel, payerReference: payerReference.trim() }
          : {}),
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: async (res) => {
      const checkoutUrl = (res as InvestResponse).payment?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      if (method === "MANUAL") {
        setManualSubmitted(true);
        setFormError(null);
        return;
      }
      setSelected(null);
      setFormError(null);
      setNeedsDeposit(false);
      setAcceptedRisk(false);
      await queryClient.invalidateQueries({ queryKey: ["investments"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (err) => {
      const message = apiErrorMessage(err, "Could not invest in this plan");
      setFormError(message);
      setNeedsDeposit(isInsufficientBalance(message));
    },
  });

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  const investments = investmentsQuery.data ?? [];
  const portfolio = portfolioQuery.data;
  const plans = catalogQuery.data?.plans ?? [];

  const activeCount = investments.filter((i) => i.status === "ACTIVE").length;
  const pendingCount = investments.filter((i) => i.status === "PENDING").length;

  const filtered = useMemo(() => {
    if (filter === "all") return investments;
    if (filter === "SETTLED") {
      return investments.filter((i) => i.status === "SETTLED" || i.status === "MATURED");
    }
    return investments.filter((i) => i.status === filter);
  }, [investments, filter]);

  const activeByPlan = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of investments) {
      if (inv.status !== "ACTIVE" && inv.status !== "PENDING") continue;
      const key = inv.opportunity.name;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [investments]);

  function closeInvest() {
    setSelected(null);
    setStep("method");
    setFormError(null);
    setNeedsDeposit(false);
    setManualSubmitted(false);
    setPayerReference("");
    setAcceptedRisk(false);
  }

  function openInvest(plan: InvestmentPlanCatalogItem) {
    setSelected(plan);
    setAmount(String(plan.minAmount.amount / 100));
    setMethod("WALLET");
    setStep("method");
    setChannel("MOBILE_MONEY");
    setPayerReference("");
    setAcceptedRisk(false);
    setFormError(null);
    setNeedsDeposit(false);
    setManualSubmitted(false);
  }

  function continueToDetails() {
    setFormError(null);
    if (method === "MANUAL" && methods && !methods.manualEnabled) {
      setFormError("Manual payments are not available right now.");
      return;
    }
    if (
      method === "PAYMENT" &&
      methods &&
      !(methods.onlineEnabled && methods.online?.available)
    ) {
      setFormError("Online payment is not available right now.");
      return;
    }
    setStep("details");
  }

  function submitInvest() {
    setFormError(null);
    setNeedsDeposit(false);
    if (!selected?.opportunityId) {
      setFormError("This plan is not open for investment yet.");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setFormError("Enter a valid amount.");
      return;
    }
    if (toMinorUnits(n, selected.minAmount.currency) < selected.minAmount.amount) {
      setFormError(`Minimum is ${formatMoney(selected.minAmount)}.`);
      return;
    }
    if (!acceptedRisk) {
      setFormError("Accept the risk disclosure to continue.");
      return;
    }
    if (method === "MANUAL" && payerReference.trim().length < 3) {
      setFormError("Enter your payment reference.");
      return;
    }
    invest.mutate();
  }

  const loading = portfolioQuery.isLoading || investmentsQuery.isLoading;

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Invest</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a management plan, fund it from your wallet, then track earnings until maturity.
            You can hold more than one plan.
          </p>
        </div>
        <Link
          href="/dashboard/wallet"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-center rounded-full",
          )}
        >
          <Wallet className="h-4 w-4" />
          Wallet
        </Link>
      </header>

      {investmentsQuery.isError ? (
        <Alert variant="danger">
          {apiErrorMessage(investmentsQuery.error, "Could not load investments.")}
        </Alert>
      ) : null}

      <section className="grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <Stat
              accent="volt"
              icon={TrendingUp}
              label="Active"
              value={String(portfolio?.activeInvestments ?? activeCount)}
            />
            <Stat
              accent="ink"
              icon={CalendarDays}
              label="Allocated"
              value={portfolio ? formatMoney(portfolio.totalInvested) : "—"}
            />
            <Stat
              accent="soft"
              icon={Wallet}
              label="Wallet"
              value={portfolio ? formatMoney(portfolio.walletBalance) : "—"}
            />
          </>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Management plans</h2>
          <p className="text-xs text-muted-foreground">
            Same packages as the landing page — invest capital, wait for the cycle, then withdraw
            after settlement.
          </p>
        </div>
        {catalogQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[28rem] rounded-[1.75rem]" />
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] bg-gradient-to-b from-surface-2/90 via-surface to-surface p-3 sm:p-5 md:rounded-[2.5rem]">
            <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
              {plans.map((plan) => {
                const held = activeByPlan.get(plan.name) ?? 0;
                const available = Boolean(plan.opportunityId);
                return (
                  <InvestmentPlanCard
                    key={plan.id}
                    plan={plan}
                    cta={
                      <div className="space-y-2">
                        {held > 0 ? (
                          <p
                            className={cn(
                              "text-center text-[11px] font-semibold",
                              plan.featured ? "text-white/80" : "text-volt-dim",
                            )}
                          >
                            You have {held} active in this plan
                          </p>
                        ) : null}
                        <Button
                          size="lg"
                          className={cn(
                            "h-11 w-full rounded-full text-sm font-semibold",
                            plan.featured
                              ? "bg-white text-ink shadow-lg hover:bg-white/90"
                              : "bg-ink text-white hover:bg-ink/90",
                          )}
                          disabled={!available || invest.isPending}
                          onClick={() => openInvest(plan)}
                        >
                          {available ? "Invest in this plan" : "Coming soon"}
                        </Button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">Your investments</h2>
          {investments.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["ACTIVE", "Active"],
                  ["PENDING", "Pending"],
                  ["SETTLED", "Done"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    filter === id
                      ? "bg-volt text-volt-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {label}
                  {id === "PENDING" && pendingCount > 0 ? ` · ${pendingCount}` : ""}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {investmentsQuery.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : investments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center shadow-card">
            <TrendingUp className="mx-auto h-8 w-8 text-volt-dim" />
            <p className="mt-3 font-semibold">No investments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a plan above and invest. Deposit to your wallet first if balance is low.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing here.</p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-2 text-sm font-semibold text-volt-dim hover:underline"
            >
              Show all
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((inv) => (
              <InvestmentRow key={inv.id} investment={inv} />
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) closeInvest();
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className={cn(step === "method" && !manualSubmitted && "font-display text-2xl")}>
              {manualSubmitted
                ? "Malipo yamewasilishwa"
                : step === "method"
                  ? "Chagua Malipo"
                  : `Invest — ${selected?.name}`}
            </DialogTitle>
            <DialogDescription>
              {manualSubmitted
                ? "Finance itathibitisha hivi karibuni. Plan itakuwa ACTIVE baada ya confirm."
                : step === "method"
                  ? "Chagua jinsi unavyotaka kulipa."
                  : "Enter amount, accept risk, then confirm. Targets are not guarantees."}
            </DialogDescription>
          </DialogHeader>

          {manualSubmitted ? (
            <div className="space-y-4">
              <Alert variant="volt">
                Manual payment submitted. Your investment stays Pending until finance confirms.
              </Alert>
              <Button className="w-full rounded-full" onClick={closeInvest}>
                Done
              </Button>
            </div>
          ) : selected && step === "method" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-volt/30 bg-gradient-to-r from-volt/15 via-volt/8 to-surface px-4 py-3.5">
                <p className="font-display text-lg font-bold tracking-tight text-volt-dim sm:text-xl">
                  {selected.name} · from {formatMoney(selected.minAmount)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Projected target {formatMoney(selected.projectedTotal)} · not a guarantee
                </p>
              </div>

              <div className="space-y-2.5">
                <PaymentMethodCard
                  active={method === "WALLET"}
                  iconSrc="/icons/3d/wallet.png"
                  iconAlt="Wallet"
                  title="Wallet balance"
                  subtitle="Tumia fedha zilizo kwenye mkoba wako"
                  onClick={() => setMethod("WALLET")}
                />
                <PaymentMethodCard
                  active={method === "MANUAL"}
                  iconSrc="/icons/3d/bank.png"
                  iconAlt="Bank"
                  title="Manual payment"
                  subtitle="Lipa kwa benki au simu ya mkononi"
                  disabled={methods ? !methods.manualEnabled : false}
                  onClick={() => setMethod("MANUAL")}
                />
                <PaymentMethodCard
                  active={method === "PAYMENT"}
                  iconSrc="/icons/3d/phone-pay.png"
                  iconAlt="Phone payment"
                  title="Online payment"
                  subtitle="Lipa kwa simu / checkout online"
                  disabled={
                    methods ? !(methods.onlineEnabled && methods.online?.available) : false
                  }
                  onClick={() => setMethod("PAYMENT")}
                />
              </div>

              {methodsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Inapakia chaguo za malipo…</p>
              ) : null}

              {formError ? <Alert variant="danger">{formError}</Alert> : null}

              <Button
                className="h-12 w-full rounded-full text-base font-semibold shadow-volt"
                onClick={continueToDetails}
              >
                Endelea
              </Button>
            </div>
          ) : selected && step === "details" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invest-amount">Amount ({selected.minAmount.currency})</Label>
                <Input
                  id="invest-amount"
                  type="number"
                  min={selected.minAmount.amount / 100}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              {method === "MANUAL" && methods ? (
                !methods.mobile && !methods.bank ? (
                  <Alert variant="warning">Payment details not published yet.</Alert>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                      Pay to
                    </p>
                    {methods.mobile ? (
                      <button
                        type="button"
                        onClick={() => setChannel("MOBILE_MONEY")}
                        className={cn(
                          "w-full rounded-2xl border p-3.5 text-left transition-colors",
                          channel === "MOBILE_MONEY"
                            ? "border-volt/50 bg-volt/10 shadow-sm"
                            : "border-border bg-surface-2/40",
                        )}
                      >
                        <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
                          <Smartphone className="h-4 w-4 text-volt-dim" />
                          {methods.mobile.provider}
                        </span>
                        <InvestPayRow
                          label="Number"
                          value={methods.mobile.number}
                          copied={copied === "mm-number"}
                          onCopy={() => void copyText(methods.mobile!.number, "mm-number")}
                        />
                        {methods.mobile.accountName ? (
                          <InvestPayRow
                            label="Name"
                            value={methods.mobile.accountName}
                            copied={copied === "mm-name"}
                            onCopy={() => void copyText(methods.mobile!.accountName, "mm-name")}
                          />
                        ) : null}
                      </button>
                    ) : null}
                    {methods.bank ? (
                      <button
                        type="button"
                        onClick={() => setChannel("BANK_TRANSFER")}
                        className={cn(
                          "w-full rounded-2xl border p-3.5 text-left transition-colors",
                          channel === "BANK_TRANSFER"
                            ? "border-volt/50 bg-volt/10 shadow-sm"
                            : "border-border bg-surface-2/40",
                        )}
                      >
                        <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
                          <Building2 className="h-4 w-4 text-volt-dim" />
                          {methods.bank.bankName}
                        </span>
                        <InvestPayRow
                          label="Account"
                          value={methods.bank.accountNumber}
                          copied={copied === "bank-acc"}
                          onCopy={() => void copyText(methods.bank!.accountNumber, "bank-acc")}
                        />
                        {methods.bank.accountName ? (
                          <InvestPayRow
                            label="Name"
                            value={methods.bank.accountName}
                            copied={copied === "bank-name"}
                            onCopy={() => void copyText(methods.bank!.accountName, "bank-name")}
                          />
                        ) : null}
                      </button>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor="invest-ref">Reference</Label>
                      <Input
                        id="invest-ref"
                        placeholder={
                          channel === "BANK_TRANSFER" ? "Bank reference" : "Confirmation code"
                        }
                        className="h-11 rounded-xl"
                        value={payerReference}
                        onChange={(e) => setPayerReference(e.target.value)}
                      />
                    </div>
                  </div>
                )
              ) : null}

              {method === "PAYMENT" ? (
                <p className="text-xs text-muted-foreground">
                  You’ll be redirected to checkout to complete this investment online.
                </p>
              ) : null}

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptedRisk}
                  onChange={(e) => setAcceptedRisk(e.target.checked)}
                />
                <span>
                  I accept the risk disclosure and understand projected outcomes are not guarantees.
                </span>
              </label>

              <ProjectionDisclaimer />

              {formError ? (
                <Alert
                  variant="danger"
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{formError}</span>
                  {needsDeposit ? (
                    <Link
                      href="/dashboard/wallet"
                      className={cn(buttonVariants({ size: "sm" }), "shrink-0 rounded-full shadow-volt")}
                      onClick={closeInvest}
                    >
                      <Wallet className="h-4 w-4" />
                      Deposit to wallet
                    </Link>
                  ) : null}
                </Alert>
              ) : null}

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setStep("method")}>
                  Back
                </Button>
                <Button
                  className="flex-1 rounded-full shadow-volt"
                  disabled={invest.isPending}
                  onClick={submitInvest}
                >
                  {invest.isPending
                    ? "Processing…"
                    : method === "MANUAL"
                      ? "Submit payment"
                      : method === "PAYMENT"
                        ? "Continue to pay"
                        : "Confirm investment"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvestPayRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface/80 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-volt-dim" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Stat({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: "volt" | "ink" | "soft";
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  const bar =
    accent === "volt" ? "bg-volt" : accent === "ink" ? "bg-ink" : "bg-[hsl(351_77%_61%)]";

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
            {value}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function InvestmentRow({ investment }: { investment: InvestmentView }) {
  const days = daysUntil(investment.maturesAt);

  return (
    <Link
      href={`/dashboard/invest/${investment.id}`}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:gap-4 sm:p-4"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink/90 text-white sm:h-16 sm:w-16 sm:rounded-2xl">
        <TrendingUp className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusVariant(investment.status)} className="text-[10px]">
            {humanize(investment.status)}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {investment.opportunity.durationDays}d cycle
          </span>
        </div>
        <p className="mt-1 truncate font-semibold group-hover:text-volt-dim">
          {investment.opportunity.name} plan
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{statusCopy(investment)}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          Invested {formatMoney(investment.principal)}
          <span className="mx-1.5 text-border">→</span>
          <span className="font-medium text-foreground">
            {formatMoney(investment.projectedValue)}
          </span>
          <span className="ml-1 text-[10px]">target</span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {investment.maturesAt
            ? days !== null && days >= 0
              ? `${days}d left`
              : formatDate(investment.maturesAt)
            : "—"}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-volt-dim">
          Details
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
