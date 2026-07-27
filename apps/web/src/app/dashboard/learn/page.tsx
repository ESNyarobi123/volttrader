"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  ChevronUp,
  Copy,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import type {
  CoursePlanMembershipView,
  CoursePlanView,
  DepositMethodsView,
} from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { humanize } from "@/lib/status";
import { PaymentMethodCard } from "@/components/shared/payment-method-card";
import { ForexCoursePlanCard } from "@/components/site/forex-course-plan-card";
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

type PayMethod = "WALLET" | "MANUAL" | "PAYMENT";
type DialogStep = "method" | "details";

function isInsufficientBalance(message: string) {
  return /insufficient wallet balance/i.test(message);
}

interface SubscribeResponse {
  plan?: CoursePlanView;
  payment?: { id: string; status: string } | null;
  checkoutUrl?: string | null;
  enrolledCourseCount?: number;
}

export default function DashboardLearnPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [needsDeposit, setNeedsDeposit] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selected, setSelected] = useState<CoursePlanView | null>(null);
  const [step, setStep] = useState<DialogStep>("method");
  const [method, setMethod] = useState<PayMethod>("WALLET");
  const [channel, setChannel] = useState<"MOBILE_MONEY" | "BANK_TRANSFER">("MOBILE_MONEY");
  const [payerReference, setPayerReference] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [manualSubmitted, setManualSubmitted] = useState(false);

  const membershipQuery = useQuery({
    queryKey: ["course-plans", "me"],
    queryFn: () => api.get<CoursePlanMembershipView>("/course-plans/me"),
  });

  const methodsQuery = useQuery({
    queryKey: ["payments", "deposit-methods"],
    queryFn: () => api.get<DepositMethodsView>("/payments/deposit-methods"),
    enabled: !!selected,
  });

  const methods = methodsQuery.data;

  const subscribe = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<SubscribeResponse>("/course-plans/subscribe", payload),
    onSuccess: async (res) => {
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (method === "MANUAL") {
        setManualSubmitted(true);
        setFormError(null);
        return;
      }
      setSelected(null);
      setUpgradeOpen(false);
      setActionError(null);
      setNeedsDeposit(false);
      await queryClient.invalidateQueries({ queryKey: ["course-plans", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "me"] });
    },
    onError: (err) => {
      const message = apiErrorMessage(err, "Could not subscribe");
      setFormError(message);
      setNeedsDeposit(isInsufficientBalance(message));
      setActionError(message);
    },
  });

  const data = membershipQuery.data;
  const unlocked = useMemo(
    () => (data?.courses ?? []).filter((c) => !c.locked),
    [data?.courses],
  );
  const lockedCount = useMemo(
    () => (data?.courses ?? []).filter((c) => c.locked).length,
    [data?.courses],
  );
  const upgradePlans = useMemo(() => {
    if (!data?.plan) return data?.plans ?? [];
    return data.plans.filter((p) => p.sortOrder > data.plan!.sortOrder);
  }, [data]);

  function openSubscribe(plan: CoursePlanView) {
    setSelected(plan);
    setStep("method");
    setMethod("WALLET");
    setPayerReference("");
    setPhone("");
    setFormError(null);
    setNeedsDeposit(false);
    setManualSubmitted(false);
    setChannel("MOBILE_MONEY");
  }

  function closeSubscribe() {
    setSelected(null);
    setManualSubmitted(false);
    setFormError(null);
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  function continueToDetails() {
    setFormError(null);
    if (method === "MANUAL" && methods && !methods.manualEnabled) {
      setFormError("Manual payment is not available.");
      return;
    }
    if (method === "PAYMENT" && methods && !(methods.onlineEnabled && methods.online?.available)) {
      setFormError("Online payment is not available.");
      return;
    }
    if (method === "MANUAL" && methods) {
      if (methods.mobile) setChannel("MOBILE_MONEY");
      else if (methods.bank) setChannel("BANK_TRANSFER");
    }
    setStep("details");
  }

  function submitPay() {
    if (!selected) return;
    setFormError(null);
    setNeedsDeposit(false);

    if (method === "WALLET") {
      subscribe.mutate({
        coursePlanId: selected.id,
        source: "WALLET",
        idempotencyKey: crypto.randomUUID(),
      });
      return;
    }

    if (method === "MANUAL") {
      if (payerReference.trim().length < 3) {
        setFormError("Enter your payment reference.");
        return;
      }
      subscribe.mutate({
        coursePlanId: selected.id,
        source: "MANUAL",
        channel,
        payerReference: payerReference.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      return;
    }

    if (phone.trim().length < 9) {
      setFormError("Enter the phone number for payment.");
      return;
    }
    subscribe.mutate({
      coursePlanId: selected.id,
      source: "PAYMENT",
      phone: phone.trim(),
      idempotencyKey: crypto.randomUUID(),
    });
  }

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Learn</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.plan
              ? "Your Forex courses for this plan."
              : "Choose a Forex plan for lifetime course access."}
          </p>
        </div>

        {data?.plan ? (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-3 py-1.5 text-left transition hover:bg-volt/15"
          >
            <Badge variant="volt">{data.plan.name}</Badge>
            <span className="text-xs font-semibold text-volt-dim">
              {upgradePlans.length > 0 ? "Upgrade plan" : "Your plan"}
            </span>
            {upgradePlans.length > 0 ? (
              <ChevronUp className="h-3.5 w-3.5 text-volt-dim" aria-hidden />
            ) : null}
          </button>
        ) : null}
      </header>

      {membershipQuery.isError ? (
        <Alert variant="danger">
          {apiErrorMessage(membershipQuery.error, "Could not load Learn.")}
        </Alert>
      ) : null}

      {actionError && !selected ? (
        <Alert
          variant="danger"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{actionError}</span>
          {needsDeposit ? (
            <Link
              href="/dashboard/wallet"
              className={cn(buttonVariants({ size: "sm" }), "shrink-0 rounded-full shadow-volt")}
            >
              <Wallet className="h-4 w-4" />
              Deposit to wallet
            </Link>
          ) : null}
        </Alert>
      ) : null}

      {membershipQuery.isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : !data.plan ? (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Forex plans</h2>
              <p className="text-xs text-muted-foreground">
                Pay once for lifetime access to courses in your tier.
              </p>
            </div>
            <div className="rounded-[2rem] bg-surface-2/80 p-3 sm:p-5 md:rounded-[2.5rem]">
              <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
                {data.plans.map((plan) => (
                  <SubscribePlanCard
                    key={plan.id}
                    plan={plan}
                    busy={subscribe.isPending}
                    onSelect={() => openSubscribe(plan)}
                  />
                ))}
              </div>
            </div>
          </section>
          <div className="rounded-2xl border border-volt/20 bg-volt/5 px-4 py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-volt-dim" />
            <p className="mt-3 font-display text-lg font-bold tracking-tight">
              Choose a Forex plan to unlock courses
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Subscribe with wallet, manual transfer, or online payment.
            </p>
          </div>
        </>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold tracking-tight">Your courses</h2>
            {unlocked.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No courses published for your plan yet. Check back soon.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {unlocked.map((course) => (
                  <Link
                    key={course.id}
                    href={`/dashboard/learn/${course.slug}`}
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 sm:p-4"
                  >
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold group-hover:text-volt-dim">
                        {course.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {humanize(course.level)} · {course.lessonsCount} lessons
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {lockedCount > 0 && upgradePlans.length > 0 ? (
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-volt/25 bg-gradient-to-r from-volt/10 via-surface to-surface px-4 py-4 text-left shadow-card transition hover:border-volt/40"
            >
              <div>
                <p className="font-semibold tracking-tight">Want more courses?</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {lockedCount} more courses unlock when you upgrade.
                </p>
              </div>
              <span
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "shrink-0 rounded-full shadow-volt pointer-events-none",
                )}
              >
                Upgrade
              </span>
            </button>
          ) : null}
        </>
      )}

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Upgrade Forex plan</DialogTitle>
            <DialogDescription>Higher plans unlock more courses — lifetime access.</DialogDescription>
          </DialogHeader>
          {upgradePlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">You already have the top plan.</p>
          ) : (
            <div className="grid max-h-[70vh] gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {upgradePlans.map((plan) => (
                <SubscribePlanCard
                  key={plan.id}
                  plan={plan}
                  busy={subscribe.isPending}
                  onSelect={() => {
                    setUpgradeOpen(false);
                    openSubscribe(plan);
                  }}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) closeSubscribe();
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto",
            step === "details" && method === "MANUAL" ? "max-w-2xl" : "max-w-md",
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn(step === "method" && "font-display text-2xl")}>
              {manualSubmitted
                ? "Malipo yamewasilishwa"
                : step === "method"
                  ? "Chagua Malipo"
                  : `Subscribe — ${selected?.name}`}
            </DialogTitle>
            <DialogDescription>
              {manualSubmitted
                ? "Finance itathibitisha hivi karibuni."
                : step === "method"
                  ? "Chagua jinsi unavyotaka kulipa."
                  : method === "WALLET"
                    ? "Lipa kutoka salio la wallet."
                    : method === "MANUAL"
                      ? "Hamisha, kisha wasilisha reference."
                      : "Weka namba ya simu kwa malipo online."}
            </DialogDescription>
          </DialogHeader>

          {selected && manualSubmitted ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-volt/20 bg-volt/5 px-4 py-6 text-center">
                <Check className="mx-auto h-8 w-8 text-volt-dim" />
                <p className="mt-3 font-semibold">Under review</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tutafungua {selected.name} baada ya finance kuthibitisha.
                </p>
              </div>
              <Button className="w-full rounded-full" onClick={closeSubscribe}>
                Done
              </Button>
            </div>
          ) : selected && step === "method" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-volt/30 bg-gradient-to-r from-volt/15 via-volt/8 to-surface px-4 py-3.5">
                <p className="font-display text-lg font-bold tracking-tight text-volt-dim sm:text-xl">
                  {formatMoney(selected.price)} — Malipo ya Maisha
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
          ) : selected && step === "details" && method === "WALLET" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-volt/20 bg-volt/5 px-3 py-2.5 text-sm">
                <p className="font-semibold">{formatMoney(selected.price)} from wallet</p>
              </div>
              {formError ? (
                <Alert
                  variant="danger"
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{formError}</span>
                  {needsDeposit ? (
                    <Link
                      href="/dashboard/wallet"
                      className={cn(buttonVariants({ size: "sm" }), "rounded-full shadow-volt")}
                      onClick={closeSubscribe}
                    >
                      Deposit
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
                  disabled={subscribe.isPending}
                  onClick={submitPay}
                >
                  {subscribe.isPending ? "Processing…" : "Confirm"}
                </Button>
              </div>
            </div>
          ) : selected && step === "details" && method === "MANUAL" && methods ? (
            <div className="space-y-4">
              {!methods.mobile && !methods.bank ? (
                <Alert variant="warning">Payment details not published yet.</Alert>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                      Pay to
                    </p>
                    <div className="space-y-2">
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
                          <PayRow
                            label="Number"
                            value={methods.mobile.number}
                            copied={copied === "mm-number"}
                            onCopy={() => void copyText(methods.mobile!.number, "mm-number")}
                          />
                          {methods.mobile.accountName ? (
                            <PayRow
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
                          <PayRow
                            label="Account"
                            value={methods.bank.accountNumber}
                            copied={copied === "bank-acc"}
                            onCopy={() => void copyText(methods.bank!.accountNumber, "bank-acc")}
                          />
                          {methods.bank.accountName ? (
                            <PayRow
                              label="Name"
                              value={methods.bank.accountName}
                              copied={copied === "bank-name"}
                              onCopy={() => void copyText(methods.bank!.accountName, "bank-name")}
                            />
                          ) : null}
                        </button>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send exactly {formatMoney(selected.price)}.
                    </p>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-border bg-surface-2/40 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                      Confirm
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-ref">Reference</Label>
                      <Input
                        id="plan-ref"
                        placeholder={
                          channel === "BANK_TRANSFER" ? "Bank reference" : "Confirmation code"
                        }
                        className="h-11 rounded-xl"
                        value={payerReference}
                        onChange={(e) => setPayerReference(e.target.value)}
                      />
                    </div>
                    {formError ? <Alert variant="danger">{formError}</Alert> : null}
                    <Button
                      className="h-11 w-full rounded-full shadow-volt"
                      disabled={subscribe.isPending}
                      onClick={submitPay}
                    >
                      {subscribe.isPending ? "Submitting…" : "Submit payment"}
                    </Button>
                  </div>
                </div>
              )}
              <Button variant="outline" className="rounded-full" onClick={() => setStep("method")}>
                Back
              </Button>
            </div>
          ) : selected && step === "details" && method === "PAYMENT" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-volt/20 bg-volt/5 px-3 py-2.5 text-sm">
                <p className="font-semibold">{formatMoney(selected.price)} online</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-phone">Phone number</Label>
                <Input
                  id="pay-phone"
                  type="tel"
                  placeholder="+2557…"
                  className="h-11 rounded-xl"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used for mobile money / checkout. You’ll be redirected or receive a prompt.
                </p>
              </div>
              {formError ? <Alert variant="danger">{formError}</Alert> : null}
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setStep("method")}>
                  Back
                </Button>
                <Button
                  className="flex-1 rounded-full shadow-volt"
                  disabled={subscribe.isPending}
                  onClick={submitPay}
                >
                  {subscribe.isPending ? "Starting…" : "Continue to pay"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubscribePlanCard({
  plan,
  busy,
  onSelect,
}: {
  plan: CoursePlanView;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <ForexCoursePlanCard
      plan={plan}
      cta={
        <Button
          size="lg"
          className={cn(
            "h-11 w-full rounded-full text-sm font-semibold",
            plan.featured
              ? "bg-ink text-white shadow-lg hover:bg-ink/90"
              : "bg-surface-2 text-foreground hover:bg-volt hover:text-volt-foreground",
          )}
          disabled={busy}
          onClick={onSelect}
        >
          Subscribe
        </Button>
      }
    />
  );
}

function PayRow({
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
