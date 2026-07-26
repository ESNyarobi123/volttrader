"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, CreditCard } from "lucide-react";
import type { PaymentView } from "@volt/types";
import { api, ApiRequestError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { humanize } from "@/lib/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SoftNotice } from "@/components/shared/soft-notice";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Mock / return landing for gateway checkout. Confirming a payment always goes
 * through the server webhook — this page only triggers the mock provider callback.
 */
function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? "";
  const queryClient = useQueryClient();
  const [localError, setLocalError] = useState<string | null>(null);

  const paymentsQuery = useQuery({
    queryKey: ["payments", "me"],
    queryFn: () => api.get<PaymentView[]>("/payments/me"),
  });

  const payment = useMemo(
    () => paymentsQuery.data?.find((p) => p.reference === reference) ?? null,
    [paymentsQuery.data, reference],
  );

  const confirmMutation = useMutation({
    mutationFn: async (status: "PAID" | "FAILED") => {
      if (!reference) throw new Error("Missing payment reference");
      // Authenticated dev helper — server settles via signed mock webhook path.
      await api.post("/payments/mock/simulate", { reference, status });
    },
    onSuccess: async () => {
      setLocalError(null);
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      await queryClient.invalidateQueries({ queryKey: ["investments"] });
      await paymentsQuery.refetch();
    },
    onError: (err) => {
      setLocalError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not complete mock confirmation.",
      );
    },
  });

  if (!reference) {
    return (
      <Alert variant="danger">
        Missing payment reference. Return to Wallet and start the deposit again.
      </Alert>
    );
  }

  if (paymentsQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const settled = payment?.status === "PAID" || payment?.status === "FAILED";
  const mockSimulateEnabled = process.env.NEXT_PUBLIC_ALLOW_MOCK_PAYMENTS === "true";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
          Payments
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Checkout return</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reference <span className="font-mono text-foreground">{reference}</span>
        </p>
      </div>

      <SoftNotice>
        {mockSimulateEnabled
          ? "Payment confirmation usually arrives from your bank or mobile money provider. You can also use the buttons below while testing."
          : "Your wallet updates after the payment provider confirms this checkout — usually within a few moments."}
      </SoftNotice>

      {localError ? <Alert variant="danger">{localError}</Alert> : null}

      <Card className="border-border shadow-card">
        <CardContent className="space-y-4 p-5">
          {!payment ? (
            <p className="text-sm text-muted-foreground">
              Payment not found on your account yet. If you just started checkout, wait a moment and
              refresh.
            </p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                {payment.status === "PAID" ? (
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-[hsl(152_55%_36%)]" />
                ) : payment.status === "FAILED" ? (
                  <XCircle className="mt-0.5 h-6 w-6 text-danger" />
                ) : (
                  <CreditCard className="mt-0.5 h-6 w-6 text-volt-dim" />
                )}
                <div>
                  <p className="font-semibold">{humanize(payment.type)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(payment.amount)} · {humanize(payment.status)}
                  </p>
                </div>
              </div>

              {!settled && mockSimulateEnabled ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    disabled={confirmMutation.isPending}
                    onClick={() => confirmMutation.mutate("PAID")}
                    className="flex-1"
                  >
                    {confirmMutation.isPending ? <Spinner /> : null}
                    Simulate successful pay
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={confirmMutation.isPending}
                    onClick={() => confirmMutation.mutate("FAILED")}
                    className="flex-1"
                  >
                    Simulate failure
                  </Button>
                </div>
              ) : null}
              {!settled && !mockSimulateEnabled ? (
                <p className="text-sm text-muted-foreground">
                  Waiting for the payment provider to confirm this checkout…
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/wallet" className={cn(buttonVariants({ variant: "primary" }))}>
          Wallet
        </Link>
        <Link href="/dashboard/invest" className={cn(buttonVariants({ variant: "ghost" }))}>
          Investments
        </Link>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-16">
          <Spinner />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
