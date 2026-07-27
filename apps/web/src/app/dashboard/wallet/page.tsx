"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpCircle,
  ArrowUpRight,
  Building2,
  Check,
  ClipboardList,
  Copy,
  History,
  Landmark,
  Smartphone,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";
import { type Currency, DEFAULT_CURRENCY} from "@volt/config";
import type {
  DepositMethodsView,
  LedgerEntryView,
  PaymentView,
  WalletView,
  WithdrawalView,
} from "@volt/types";
import { ApiRequestError, api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDayTime, formatMoney, toMinorUnits } from "@/lib/format";
import { formatCompact, toMajor } from "@/lib/dashboard-analytics";
import { humanize, statusVariant } from "@/lib/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SoftNotice } from "@/components/shared/soft-notice";
import { PaymentMethodCard } from "@/components/shared/payment-method-card";
import { cn } from "@/lib/utils";

const depositFormSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  channel: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"]),
  payerReference: z.string().min(3, "Enter your transaction ID or payer name").max(120),
});
type DepositFormValues = z.infer<typeof depositFormSchema>;

const onlineDepositSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
});
type OnlineDepositValues = z.infer<typeof onlineDepositSchema>;

const withdrawFormSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"]),
  destination: z.string().min(3, "Enter a destination account/number").max(120),
  totpCode: z.string().regex(/^\d{6}$/, "Enter the 6-digit authenticator code"),
});
type WithdrawFormValues = z.infer<typeof withdrawFormSchema>;

type TxFilter = "all" | "CREDIT" | "DEBIT";

export default function DashboardWalletPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activePanel, setActivePanel] = useState<"deposit" | "withdraw" | null>(null);
  const [kycRequired, setKycRequired] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [depositSubmitted, setDepositSubmitted] = useState(false);
  const [depositMode, setDepositMode] = useState<"manual" | "online">("manual");
  const [depositStep, setDepositStep] = useState<"method" | "details">("method");

  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletView>("/wallet"),
  });

  const depositMethodsQuery = useQuery({
    queryKey: ["payments", "deposit-methods"],
    queryFn: () => api.get<DepositMethodsView>("/payments/deposit-methods"),
    enabled: activePanel === "deposit",
  });

  const transactionsQuery = useQuery({
    queryKey: ["wallet", "transactions"],
    queryFn: () => api.get<LedgerEntryView[]>("/wallet/transactions?page=1&pageSize=100"),
  });

  const withdrawalsQuery = useQuery({
    queryKey: ["withdrawals", "me"],
    queryFn: () => api.get<WithdrawalView[]>("/withdrawals/me"),
  });

  const transactions = transactionsQuery.data ?? [];
  const withdrawals = withdrawalsQuery.data ?? [];
  const openWithdrawals = withdrawals.filter(
    (w) => !["COMPLETED", "REJECTED", "CANCELLED"].includes(w.status),
  );
  const methods = depositMethodsQuery.data;
  const currency = (walletQuery.data?.currency ?? methods?.currency ?? DEFAULT_CURRENCY) as Currency;

  const depositForm = useForm<DepositFormValues>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: { amount: 0, channel: "MOBILE_MONEY", payerReference: "" },
  });

  const onlineDepositForm = useForm<OnlineDepositValues>({
    resolver: zodResolver(onlineDepositSchema),
    defaultValues: { amount: 0 },
  });

  const withdrawForm = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawFormSchema),
    defaultValues: { amount: 0, method: "MOBILE_MONEY", destination: "", totpCode: "" },
  });

  const depositChannel = depositForm.watch("channel");
  const withdrawMethod = withdrawForm.watch("method");

  useEffect(() => {
    if (!methods) return;
    if (depositMode === "manual" && !methods.manualEnabled && methods.onlineEnabled) {
      setDepositMode("online");
    } else if (depositMode === "online" && !methods.onlineEnabled && methods.manualEnabled) {
      setDepositMode("manual");
    }
    if (depositChannel === "MOBILE_MONEY" && !methods.mobile && methods.bank) {
      depositForm.setValue("channel", "BANK_TRANSFER");
    } else if (depositChannel === "BANK_TRANSFER" && !methods.bank && methods.mobile) {
      depositForm.setValue("channel", "MOBILE_MONEY");
    }
  }, [methods, depositChannel, depositForm, depositMode]);

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  const depositMutation = useMutation({
    mutationFn: (values: DepositFormValues) =>
      api.post<PaymentView>("/payments/deposit/manual", {
        amount: toMinorUnits(values.amount, currency),
        currency,
        channel: values.channel,
        payerReference: values.payerReference.trim(),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      setDepositSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      depositForm.reset({ amount: 0, channel: "MOBILE_MONEY", payerReference: "" });
    },
  });

  const onlineDepositMutation = useMutation({
    mutationFn: (values: OnlineDepositValues) =>
      api.post<PaymentView>("/payments/deposit", {
        amount: toMinorUnits(values.amount, currency),
        currency,
        gateway: methods?.online?.gateway,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (payment) => {
      if (payment.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setActivePanel(null);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (values: WithdrawFormValues) =>
      api.post<WithdrawalView>("/withdrawals", {
        amount: toMinorUnits(values.amount, currency),
        currency,
        method: values.method,
        destination: values.destination,
        totpCode: values.totpCode,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => {
      setKycRequired(false);
      setTwoFactorRequired(false);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["withdrawals", "me"] });
      withdrawForm.reset({ amount: 0, method: "MOBILE_MONEY", destination: "", totpCode: "" });
      setActivePanel(null);
    },
    onError: (err) => {
      if (!(err instanceof ApiRequestError) || err.status !== 403) return;
      if (/two-factor|2fa|authenticator/i.test(err.message)) {
        setTwoFactorRequired(true);
        setKycRequired(false);
        return;
      }
      setKycRequired(true);
    },
  });

  const credits = useMemo(
    () =>
      transactions
        .filter((t) => t.direction === "CREDIT")
        .reduce((s, t) => s + toMajor(t.amount), 0),
    [transactions],
  );
  const debits = useMemo(
    () =>
      transactions
        .filter((t) => t.direction === "DEBIT")
        .reduce((s, t) => s + toMajor(t.amount), 0),
    [transactions],
  );

  const filteredTx = useMemo(() => {
    if (txFilter === "all") return transactions;
    return transactions.filter((t) => t.direction === txFilter);
  }, [transactions, txFilter]);

  const loading = walletQuery.isLoading || transactionsQuery.isLoading;

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">Wallet</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your money.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="justify-center rounded-full"
            onClick={() => setActivePanel("withdraw")}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Withdraw
          </Button>
          <Button
            size="sm"
            className="justify-center rounded-full shadow-volt"
            onClick={() => {
              setDepositSubmitted(false);
              setDepositStep("method");
              setActivePanel("deposit");
            }}
          >
            <ArrowDownCircle className="h-4 w-4" />
            Deposit
          </Button>
        </div>
      </header>

      {walletQuery.isError ? (
        <Alert variant="danger">
          {apiErrorMessage(walletQuery.error, "Could not load wallet.")}
        </Alert>
      ) : null}

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))
        ) : (
          <>
            <Stat
              accent="volt"
              icon={ArrowDownLeft}
              label="In"
              value={formatCompact(credits)}
            />
            <Stat
              accent="ink"
              icon={ArrowUpRight}
              label="Out"
              value={formatCompact(debits)}
            />
            <Stat
              accent="soft"
              icon={Landmark}
              label="Open"
              value={String(openWithdrawals.length)}
            />
          </>
        )}
      </section>

      {/* Balance focus */}
      {loading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : (
        <section className="flex flex-col gap-4 rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink/90 text-white shadow-sm">
            <WalletIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
              Available
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {walletQuery.data ? formatMoney(walletQuery.data.balance) : "—"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <MetricChip label="Entries" value={String(transactions.length)} />
              {openWithdrawals.length > 0 ? (
                <MetricChip label="Pending out" value={String(openWithdrawals.length)} />
              ) : null}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:shrink-0">
            <Button
              variant="outline"
              size="md"
              className="rounded-full"
              onClick={() => setActivePanel("withdraw")}
            >
              Withdraw
            </Button>
            <Button
              size="md"
              className="rounded-full shadow-volt"
              onClick={() => {
                setDepositSubmitted(false);
                setDepositStep("method");
                setActivePanel("deposit");
              }}
            >
              Deposit
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {kycRequired ? (
        <SoftNotice
          icon={Landmark}
          title="KYC required"
          action={
            <Link
              href="/dashboard/profile?tab=kyc"
              className="text-sm font-semibold text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
            >
              Open KYC
            </Link>
          }
        >
          Verify identity before withdrawing.
        </SoftNotice>
      ) : null}

      {/* Activity */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">Activity</h2>
          {transactions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["CREDIT", "In"],
                  ["DEBIT", "Out"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTxFilter(id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    txFilter === id
                      ? "bg-volt text-volt-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {transactionsQuery.isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center shadow-card">
            <History className="mx-auto h-8 w-8 text-volt-dim" />
            <p className="mt-3 font-semibold">No activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Deposit to get started.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => {
                setDepositSubmitted(false);
                setDepositStep("method");
                setActivePanel("deposit");
              }}
            >
              Deposit
            </Button>
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing here.</p>
            <button
              type="button"
              onClick={() => setTxFilter("all")}
              className="mt-2 text-sm font-semibold text-volt-dim hover:underline"
            >
              Show all
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTx.map((tx) => (
              <TxRow key={tx.id} entry={tx} />
            ))}
          </div>
        )}
      </section>

      {/* Open withdrawals strip */}
      {openWithdrawals.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold tracking-tight">Withdrawals</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {openWithdrawals.map((w) => (
              <div
                key={w.id}
                className="w-[220px] shrink-0 rounded-2xl border border-border bg-surface p-3 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
                    <Landmark className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <Badge variant={statusVariant(w.status)} className="text-[10px]">
                      {humanize(w.status)}
                    </Badge>
                    <p className="mt-1 truncate text-sm font-semibold">{formatMoney(w.amount)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {humanize(w.method)} · {formatDayTime(w.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Quick link */}
      <section>
        <Link
          href="/dashboard/invest"
          className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:border-volt/35 hover:shadow-lift sm:p-4"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink/90 text-white">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold group-hover:text-volt-dim">Invest</p>
            <p className="text-xs text-muted-foreground">Open your portfolio</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-volt-dim transition group-hover:translate-x-0.5" />
        </Link>
      </section>

      {/* Deposit dialog */}
      <Dialog
        open={activePanel === "deposit"}
        onOpenChange={(open) => {
          if (!open) {
            setActivePanel(null);
            setDepositSubmitted(false);
            setDepositStep("method");
          }
        }}
      >
        <DialogContent
          className="max-w-2xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => {
            setActivePanel(null);
            setDepositSubmitted(false);
            setDepositStep("method");
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-surface px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <ArrowDownCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="font-display text-2xl">
                    {depositSubmitted
                      ? "Submitted"
                      : depositStep === "method"
                        ? "Chagua Malipo"
                        : depositMode === "online"
                          ? "Online deposit"
                          : "Manual deposit"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {depositSubmitted
                      ? "Finance will confirm your transfer."
                      : depositStep === "method"
                        ? "Chagua jinsi unavyotaka kuweka fedha."
                        : "Enter amount and complete the deposit."}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="max-h-[min(70vh,640px)] space-y-4 overflow-y-auto p-5 sm:p-6">
              {depositSubmitted ? (
                <div className="space-y-4 rounded-2xl border border-success/30 bg-success/10 p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/20 text-success">
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold">Submitted</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your wallet updates after our team confirms the transfer.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDepositSubmitted(false);
                      setDepositStep("method");
                      setActivePanel(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              ) : depositMethodsQuery.isLoading ? (
                <Skeleton className="h-56 w-full rounded-2xl" />
              ) : depositMethodsQuery.isError || !methods ? (
                <Alert variant="danger">
                  {apiErrorMessage(depositMethodsQuery.error, "Deposit channels unavailable.")}
                </Alert>
              ) : !methods.manualEnabled && !methods.onlineEnabled ? (
                <Alert variant="warning">Deposits are temporarily closed.</Alert>
              ) : depositStep === "method" ? (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {methods.manualEnabled ? (
                      <PaymentMethodCard
                        active={depositMode === "manual"}
                        iconSrc="/icons/3d/bank.png"
                        iconAlt="Bank"
                        title="Manual payment"
                        subtitle="Lipa kwa benki au simu ya mkononi"
                        onClick={() => setDepositMode("manual")}
                      />
                    ) : null}
                    {methods.onlineEnabled ? (
                      <PaymentMethodCard
                        active={depositMode === "online"}
                        iconSrc="/icons/3d/phone-pay.png"
                        iconAlt="Online"
                        title="Online payment"
                        subtitle="Lipa kwa simu / checkout online"
                        disabled={!methods.online?.available}
                        onClick={() => setDepositMode("online")}
                      />
                    ) : null}
                  </div>
                  <Button
                    className="h-12 w-full rounded-full text-base font-semibold shadow-volt"
                    onClick={() => {
                      if (depositMode === "manual" && !methods.manualEnabled) return;
                      if (
                        depositMode === "online" &&
                        !(methods.onlineEnabled && methods.online?.available)
                      ) {
                        return;
                      }
                      setDepositStep("details");
                    }}
                  >
                    Endelea
                  </Button>
                </div>
              ) : (
                <>
                  {depositMode === "online" && methods.onlineEnabled ? (
                    <form
                      className="space-y-4 rounded-2xl border border-border bg-surface-2/40 p-4"
                      onSubmit={onlineDepositForm.handleSubmit((values) =>
                        onlineDepositMutation.mutate(values),
                      )}
                    >
                      <p className="text-sm text-muted-foreground">
                        {methods.online?.label ?? "Gateway"}
                      </p>
                      {!methods.online?.available ? (
                        <Alert variant="warning">
                          Online gateway not configured. Use Transfer.
                        </Alert>
                      ) : null}
                      <div className="space-y-1.5">
                        <Label htmlFor="online-deposit-amount">Amount ({currency})</Label>
                        <Input
                          id="online-deposit-amount"
                          type="number"
                          step="1"
                          min="0"
                          placeholder="50000"
                          className="h-14 rounded-2xl font-display text-2xl font-bold tracking-tight"
                          {...onlineDepositForm.register("amount")}
                        />
                        {onlineDepositForm.formState.errors.amount ? (
                          <p className="text-xs text-danger">
                            {onlineDepositForm.formState.errors.amount.message}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Min {formatMoney(methods.minDeposit)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          variant="primary"
                          className="h-11 flex-1 rounded-full shadow-volt"
                          disabled={
                            onlineDepositMutation.isPending || !methods.online?.available
                          }
                        >
                          {onlineDepositMutation.isPending ? "Starting…" : "Continue to pay"}
                        </Button>
                      </div>
                      {onlineDepositMutation.error ? (
                        <Alert variant="danger">
                          {apiErrorMessage(onlineDepositMutation.error, "Could not start deposit")}
                        </Alert>
                      ) : null}
                    </form>
                  ) : null}

                  {depositMode === "manual" && methods.manualEnabled ? (
                    !methods.mobile && !methods.bank ? (
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
                                onClick={() => depositForm.setValue("channel", "MOBILE_MONEY")}
                                className={cn(
                                  "w-full rounded-2xl border p-3.5 text-left transition-colors",
                                  depositChannel === "MOBILE_MONEY"
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
                                    onCopy={() =>
                                      void copyText(methods.mobile!.accountName, "mm-name")
                                    }
                                  />
                                ) : null}
                              </button>
                            ) : null}
                            {methods.bank ? (
                              <button
                                type="button"
                                onClick={() => depositForm.setValue("channel", "BANK_TRANSFER")}
                                className={cn(
                                  "w-full rounded-2xl border p-3.5 text-left transition-colors",
                                  depositChannel === "BANK_TRANSFER"
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
                                  onCopy={() =>
                                    void copyText(methods.bank!.accountNumber, "bank-acc")
                                  }
                                />
                                {methods.bank.accountName ? (
                                  <PayRow
                                    label="Name"
                                    value={methods.bank.accountName}
                                    copied={copied === "bank-name"}
                                    onCopy={() =>
                                      void copyText(methods.bank!.accountName, "bank-name")
                                    }
                                  />
                                ) : null}
                              </button>
                            ) : null}
                          </div>
                          {methods.instructions ? (
                            <p className="rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2.5 text-xs text-muted-foreground">
                              {methods.instructions}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            Min {formatMoney(methods.minDeposit)}
                          </p>
                        </div>

                        <form
                          className="space-y-4 rounded-2xl border border-border bg-surface-2/40 p-4"
                          onSubmit={depositForm.handleSubmit((values) =>
                            depositMutation.mutate(values),
                          )}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                            Confirm
                          </p>
                          <div className="space-y-1.5">
                            <Label htmlFor="deposit-amount">Amount ({currency})</Label>
                            <Input
                              id="deposit-amount"
                              type="number"
                              step="1"
                              min="0"
                              placeholder="50000"
                              className="h-14 rounded-2xl font-display text-2xl font-bold tracking-tight"
                              {...depositForm.register("amount")}
                            />
                            {depositForm.formState.errors.amount ? (
                              <p className="text-xs text-danger">
                                {depositForm.formState.errors.amount.message}
                              </p>
                            ) : null}
                          </div>
                          <input type="hidden" {...depositForm.register("channel")} />
                          <div className="space-y-1.5">
                            <Label htmlFor="deposit-ref">Reference</Label>
                            <Input
                              id="deposit-ref"
                              placeholder={
                                depositChannel === "BANK_TRANSFER"
                                  ? "Bank reference"
                                  : "Confirmation code"
                              }
                              className="h-11 rounded-xl"
                              {...depositForm.register("payerReference")}
                            />
                            {depositForm.formState.errors.payerReference ? (
                              <p className="text-xs text-danger">
                                {depositForm.formState.errors.payerReference.message}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="submit"
                            variant="primary"
                            className="h-11 w-full rounded-full shadow-volt"
                            disabled={
                              depositMutation.isPending ||
                              (depositChannel === "MOBILE_MONEY" && !methods.mobile) ||
                              (depositChannel === "BANK_TRANSFER" && !methods.bank)
                            }
                          >
                            {depositMutation.isPending ? "Submitting…" : "Submit"}
                          </Button>
                          {depositMutation.error ? (
                            <Alert variant="danger">
                              {apiErrorMessage(depositMutation.error, "Could not submit deposit")}
                            </Alert>
                          ) : null}
                        </form>
                      </div>
                    )
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setDepositStep("method")}
                  >
                    Back
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw dialog */}
      <Dialog
        open={activePanel === "withdraw"}
        onOpenChange={(open) => {
          if (!open) setActivePanel(null);
        }}
      >
        <DialogContent
          className="max-w-md overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setActivePanel(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-ink/10 via-surface to-volt/15 px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[hsl(351_77%_61%)] to-volt text-volt-foreground shadow-volt">
                  <ArrowUpCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="font-display text-2xl">Withdraw</DialogTitle>
                  <DialogDescription className="mt-1">
                    Held until finance reviews.
                  </DialogDescription>
                </div>
              </div>
            </div>

            <form
              className="space-y-5 p-5 sm:p-6"
              onSubmit={withdrawForm.handleSubmit((values) => withdrawMutation.mutate(values))}
            >
              <div className="rounded-2xl border border-border/70 bg-surface-2/40 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Available </span>
                <span className="font-semibold">
                  {walletQuery.data ? formatMoney(walletQuery.data.balance) : "—"}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="withdraw-amount">Amount ({currency})</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="10000"
                  className="h-14 rounded-2xl font-display text-2xl font-bold tracking-tight"
                  {...withdrawForm.register("amount")}
                />
                {withdrawForm.formState.errors.amount ? (
                  <p className="text-xs text-danger">
                    {withdrawForm.formState.errors.amount.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["MOBILE_MONEY", "Mobile", Smartphone],
                      ["BANK_TRANSFER", "Bank", Building2],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => withdrawForm.setValue("method", id)}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors",
                        withdrawMethod === id
                          ? "border-volt/50 bg-volt/10"
                          : "border-border bg-surface",
                      )}
                    >
                      <Icon className="h-4 w-4 text-volt-dim" />
                      {label}
                    </button>
                  ))}
                </div>
                <input type="hidden" {...withdrawForm.register("method")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="withdraw-destination">
                  {withdrawMethod === "BANK_TRANSFER" ? "Account number" : "Mobile number"}
                </Label>
                <Input
                  id="withdraw-destination"
                  placeholder={
                    withdrawMethod === "BANK_TRANSFER" ? "e.g. 0150123456789" : "e.g. 0712 345 678"
                  }
                  className="h-11 rounded-xl"
                  {...withdrawForm.register("destination")}
                />
                {withdrawForm.formState.errors.destination ? (
                  <p className="text-xs text-danger">
                    {withdrawForm.formState.errors.destination.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="withdraw-totp">Authenticator</Label>
                <Input
                  id="withdraw-totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  maxLength={6}
                  className="h-11 rounded-xl font-mono tracking-[0.2em]"
                  {...withdrawForm.register("totpCode")}
                />
                {withdrawForm.formState.errors.totpCode ? (
                  <p className="text-xs text-danger">
                    {withdrawForm.formState.errors.totpCode.message}
                  </p>
                ) : null}
                {!user?.twoFactorEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    2FA required.{" "}
                    <Link
                      href="/dashboard/profile?tab=security"
                      className="font-semibold underline"
                      onClick={() => setActivePanel(null)}
                    >
                      Enable
                    </Link>
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="h-11 w-full rounded-full shadow-volt"
                disabled={withdrawMutation.isPending || !user?.twoFactorEnabled}
              >
                {withdrawMutation.isPending ? "Submitting…" : "Request"}
              </Button>

              {twoFactorRequired ? (
                <Alert variant="warning">
                  Enable 2FA first.{" "}
                  <Link
                    href="/dashboard/profile?tab=security"
                    className="font-semibold underline"
                    onClick={() => setActivePanel(null)}
                  >
                    Security
                  </Link>
                </Alert>
              ) : null}
              {kycRequired ? (
                <Alert variant="warning">
                  KYC required.{" "}
                  <Link
                    href="/dashboard/profile?tab=kyc"
                    className="font-semibold underline"
                    onClick={() => setActivePanel(null)}
                  >
                    Open KYC
                  </Link>
                </Alert>
              ) : null}
              {withdrawMutation.error && !kycRequired && !twoFactorRequired ? (
                <Alert variant="danger">
                  {apiErrorMessage(withdrawMutation.error, "Could not submit withdrawal")}
                </Alert>
              ) : null}
            </form>
          </div>
        </DialogContent>
      </Dialog>
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
  icon: typeof WalletIcon;
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

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface/80 px-3 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TxRow({ entry }: { entry: LedgerEntryView }) {
  const credit = entry.direction === "CREDIT";

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card sm:gap-4 sm:p-4">
      <span
        className={cn(
          "grid h-14 w-14 shrink-0 place-items-center rounded-xl sm:h-16 sm:w-16 sm:rounded-2xl",
          credit ? "bg-success/15 text-success" : "bg-danger/10 text-danger",
        )}
      >
        {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{humanize(entry.type)}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDayTime(entry.createdAt)}
          {entry.reference ? ` · ${entry.reference}` : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-bold tabular-nums", credit ? "text-success" : "text-danger")}>
          {credit ? "+" : "−"}
          {formatMoney(entry.amount)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          bal {formatMoney(entry.balanceAfter)}
        </p>
      </div>
    </div>
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
    <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-background/60 px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-mono text-sm font-semibold">{value}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
