"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, TrendingUp } from "lucide-react";
import type { InvestmentView, OpportunityDetail, PaymentView } from "@volt/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { ApiRequestError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, toMinorUnits } from "@/lib/format";
import { PROJECTION_LABELS, humanize, riskVariant } from "@/lib/status";
import { cn } from "@/lib/utils";

interface InvestResponse {
  investment?: InvestmentView;
  payment?: PaymentView;
  id?: string;
}

export default function DashboardOpportunityDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: opportunity, isLoading, error } = useQuery({
    queryKey: ["opportunity", slug],
    queryFn: () => api.get<OpportunityDetail>(`/opportunities/${slug}`),
    enabled: !!slug,
  });

  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<"WALLET" | "PAYMENT">("WALLET");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const investMutation = useMutation({
    mutationFn: () =>
      api.post<InvestResponse | InvestmentView>("/investments", {
        opportunityId: opportunity!.id,
        amount: toMinorUnits(Number(amount), opportunity!.currency),
        source,
        acceptedRisk: true,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (res) => {
      const checkoutUrl = (res as InvestResponse).payment?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      router.push("/dashboard/invest");
    },
  });

  const minAmountMoney = useMemo(
    () =>
      opportunity
        ? formatMoney({ amount: opportunity.minAmount, currency: opportunity.currency })
        : "",
    [opportunity],
  );
  const maxAmountMoney = useMemo(
    () =>
      opportunity?.maxAmount
        ? formatMoney({ amount: opportunity.maxAmount, currency: opportunity.currency })
        : null,
    [opportunity],
  );

  if (isLoading) {
    return (
      <div className="py-10">
        <PageSpinner />
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <Alert variant="danger">
        {error instanceof ApiRequestError ? error.message : "Opportunity not found."}
      </Alert>
    );
  }

  const handleInvest = () => {
    setValidationError(null);

    if (!user) {
      router.push(`/login?redirect=/dashboard/invest/explore/${slug}`);
      return;
    }

    const majorAmount = Number(amount);
    if (!amount || Number.isNaN(majorAmount) || majorAmount <= 0) {
      setValidationError("Enter a valid investment amount.");
      return;
    }
    const minorAmount = toMinorUnits(majorAmount, opportunity.currency);
    if (minorAmount < opportunity.minAmount) {
      setValidationError(`Minimum investment is ${minAmountMoney}.`);
      return;
    }
    if (opportunity.maxAmount && minorAmount > opportunity.maxAmount) {
      setValidationError(`Maximum investment is ${maxAmountMoney}.`);
      return;
    }
    if (!acceptedRisk) {
      setValidationError("You must accept the risk disclosure to invest.");
      return;
    }

    investMutation.mutate();
  };

  const kycRequired =
    investMutation.error instanceof ApiRequestError &&
    /kyc/i.test(investMutation.error.message);

  return (
    <div className="relative space-y-6">
      <Link
        href="/dashboard/invest/explore"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 w-fit")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to floor
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={riskVariant(opportunity.riskCategory)}>
                {humanize(opportunity.riskCategory)} risk
              </Badge>
              <Badge variant="default">{humanize(opportunity.status)}</Badge>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{opportunity.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{opportunity.summary}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {opportunity.durationDays} days duration
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-br from-volt/10 via-surface to-surface-2 p-4">
            <p className="text-xs text-muted-foreground">
              {PROJECTION_LABELS[opportunity.projectionLabel]}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 font-display text-2xl font-bold text-volt-dim">
              <TrendingUp className="h-5 w-5" />×{opportunity.projectionMultiplier} target
            </p>
          </div>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="text-lg font-bold tracking-tight">About this opportunity</h2>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
              {opportunity.description}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="text-lg font-bold tracking-tight">Risk disclosure</h2>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
              {opportunity.riskDisclosure}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <h2 className="text-lg font-bold tracking-tight">Terms</h2>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
              {opportunity.terms}
            </p>
          </section>

          <ProjectionDisclaimer className="text-xs" />
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-20 space-y-4 rounded-2xl border border-border bg-gradient-to-b from-surface via-surface to-surface-2 p-5 shadow-card">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Invest</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                From {minAmountMoney}
                {maxAmountMoney ? ` up to ${maxAmountMoney}` : ""}
              </p>
            </div>

            {validationError || investMutation.error ? (
              <Alert variant="danger">
                <p>
                  {validationError ??
                    (investMutation.error instanceof ApiRequestError
                      ? investMutation.error.message
                      : "Something went wrong.")}
                </p>
                {kycRequired ? (
                  <Link
                    href="/dashboard/profile?tab=kyc"
                    className="mt-1 inline-block font-semibold underline"
                  >
                    Complete KYC verification
                  </Link>
                ) : null}
              </Alert>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount ({opportunity.currency})</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="1"
                placeholder="e.g. 50000"
                className="h-12 rounded-xl font-display text-lg font-bold"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="source">Pay with</Label>
              <Select
                id="source"
                className="h-11 rounded-xl"
                value={source}
                onChange={(e) => setSource(e.target.value as "WALLET" | "PAYMENT")}
              >
                <option value="WALLET">Wallet balance</option>
                <option value="PAYMENT">Direct payment</option>
              </Select>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border bg-surface-2 accent-volt"
                checked={acceptedRisk}
                onChange={(e) => setAcceptedRisk(e.target.checked)}
              />
              <span>
                I have read and accept the{" "}
                <Link href="/risk-disclosure" className="underline hover:text-foreground">
                  risk disclosure
                </Link>{" "}
                and terms above.
              </span>
            </label>

            <Button
              variant="primary"
              className="w-full rounded-full shadow-volt"
              onClick={handleInvest}
              disabled={!acceptedRisk || investMutation.isPending}
            >
              {investMutation.isPending ? "Submitting…" : "Invest now"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
