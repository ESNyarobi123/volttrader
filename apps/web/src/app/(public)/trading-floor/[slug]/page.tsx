"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, TrendingUp } from "lucide-react";
import type { InvestmentView, OpportunityDetail, PaymentView } from "@volt/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { ApiRequestError, api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, toMinorUnits } from "@/lib/format";
import { PROJECTION_LABELS, humanize, riskVariant } from "@/lib/status";

interface InvestResponse {
  investment?: InvestmentView;
  payment?: PaymentView;
  id?: string;
}

export default function OpportunityDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: opportunity, isLoading, error } = useQuery({
    queryKey: ["opportunity", slug],
    queryFn: () => api.get<OpportunityDetail>(`/opportunities/${slug}`),
    enabled: !!slug,
  });

  const [amount, setAmount] = useState<string>("");
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
    () => (opportunity ? formatMoney({ amount: opportunity.minAmount, currency: opportunity.currency }) : ""),
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
      <div className="container-page py-10">
        <PageSpinner />
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="container-page py-10">
        <Alert variant="danger">
          {apiErrorMessage(error, "Opportunity not found.")}
        </Alert>
      </div>
    );
  }

  const handleInvest = () => {
    setValidationError(null);

    if (!user) {
      router.push(`/login?redirect=/trading-floor/${slug}`);
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
    <div className="container-page py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={riskVariant(opportunity.riskCategory)}>{humanize(opportunity.riskCategory)} risk</Badge>
            <Badge variant="default">{humanize(opportunity.status)}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{opportunity.name}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{opportunity.summary}</p>

          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-4 w-4" /> {opportunity.durationDays} days duration
            </span>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-surface-2/50 p-4">
            <p className="text-xs text-muted-foreground">{PROJECTION_LABELS[opportunity.projectionLabel]}</p>
            <p className="inline-flex items-center gap-1 text-2xl font-semibold text-volt-dim">
              <TrendingUp className="h-5 w-5" />×{opportunity.projectionMultiplier} target
            </p>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>About this opportunity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{opportunity.description}</p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Risk disclosure</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{opportunity.riskDisclosure}</p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{opportunity.terms}</p>
            </CardContent>
          </Card>

          <ProjectionDisclaimer className="mt-6" />
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invest</CardTitle>
              <p className="text-xs text-muted-foreground">
                From {minAmountMoney}
                {maxAmountMoney ? ` up to ${maxAmountMoney}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {(validationError || investMutation.error) && (
                <Alert variant="danger">
                  <p>
                    {validationError ??
                      (apiErrorMessage(investMutation.error, "Something went wrong."))}
                  </p>
                  {kycRequired && (
                    <Link href="/dashboard/profile" className="mt-1 inline-block underline">
                      Complete KYC verification
                    </Link>
                  )}
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({opportunity.currency})</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Pay with</Label>
                <Select id="source" value={source} onChange={(e) => setSource(e.target.value as "WALLET" | "PAYMENT")}>
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
                  <a href="/risk-disclosure" className="underline hover:text-foreground">
                    risk disclosure
                  </a>{" "}
                  and terms above.
                </span>
              </label>

              <Button
                className="w-full"
                onClick={handleInvest}
                disabled={!acceptedRisk || investMutation.isPending}
              >
                {investMutation.isPending ? "Submitting…" : "Invest now"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
