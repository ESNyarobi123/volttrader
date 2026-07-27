"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Search,
  Sparkles,
  CheckCircle2,
  Clock3,
  Ban,
  Hourglass,
  Wallet,
  User,
  Target,
  CalendarClock,
  BadgeDollarSign,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import {
  InvestmentStatus,
  type Currency,
  type InvestmentStatus as InvestmentStatusType,
} from "@volt/config";
import type { InvestmentUpdateView, InvestmentView, Money } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatMoney, fromMinorUnits, toMinorUnits } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatChip } from "@/components/ui/stat-chip";

type AdminInvestmentView = InvestmentView & {
  user?: { id?: string; fullName: string; email: string | null } | null;
};

type StatusFilter = "ALL" | InvestmentStatusType;

function canSettle(status: InvestmentStatusType) {
  return status === "ACTIVE" || status === "MATURED";
}

function pnlTone(settled: Money | null, principal: Money) {
  if (!settled) return "text-muted-foreground";
  if (settled.amount > principal.amount) return "text-success";
  if (settled.amount < principal.amount) return "text-danger";
  return "text-foreground";
}

export default function AdminInvestmentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [settleTarget, setSettleTarget] = useState<AdminInvestmentView | null>(null);
  const [settledMajor, setSettledMajor] = useState("");
  const [updateTarget, setUpdateTarget] = useState<AdminInvestmentView | null>(null);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-investments"],
    // api.get unwraps the envelope's `data` key, so this is the investment array
    // (server `meta` is not available on the client).
    queryFn: () => api.get<AdminInvestmentView[]>("/investments/admin/all?page=1&pageSize=100"),
  });

  const settle = useMutation({
    mutationFn: ({ id, settledValue }: { id: string; settledValue: number }) =>
      api.patch(`/investments/${id}/settle`, { settledValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      setSettleTarget(null);
      setSettledMajor("");
    },
  });

  const postUpdate = useMutation({
    mutationFn: ({ id, title, body }: { id: string; title: string; body: string }) =>
      api.post<InvestmentUpdateView>(`/investments/${id}/updates`, { title, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-investments"] });
      setUpdateTarget(null);
      setUpdateTitle("");
      setUpdateBody("");
    },
  });

  const investments = data ?? [];
  const totalCount = investments.length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return investments.filter((i) => {
      if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
      if (!term) return true;
      const user = `${i.user?.fullName ?? ""} ${i.user?.email ?? ""}`.toLowerCase();
      const opp = i.opportunity.name.toLowerCase();
      return user.includes(term) || opp.includes(term) || i.opportunity.slug.includes(term);
    });
  }, [investments, search, statusFilter]);

  const stats = useMemo(() => {
    const by = (s: InvestmentStatusType) => investments.filter((i) => i.status === s).length;
    return {
      total: totalCount,
      active: by("ACTIVE"),
      matured: by("MATURED"),
      settled: by("SETTLED"),
      pending: by("PENDING"),
    };
  }, [investments, totalCount]);

  const openSettle = (inv: AdminInvestmentView) => {
    setSettleTarget(inv);
    setSettledMajor(
      String(fromMinorUnits(inv.projectedValue.amount, inv.projectedValue.currency as Currency)),
    );
    settle.reset();
  };

  const confirmSettle = () => {
    if (!settleTarget) return;
    const amount = Number(settledMajor);
    if (!Number.isFinite(amount) || amount < 0) return;
    settle.mutate({
      id: settleTarget.id,
      settledValue: toMinorUnits(amount, settleTarget.principal.currency as Currency),
    });
  };

  const settlePreview =
    settleTarget && Number.isFinite(Number(settledMajor)) && Number(settledMajor) >= 0
      ? formatMoney({
          amount: toMinorUnits(Number(settledMajor), settleTarget.principal.currency as Currency),
          currency: settleTarget.principal.currency as Currency,
        })
      : "—";

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(0_0%_10%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Trading Floor · Finance
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Investments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review positions across opportunities and settle matured capital.
          </p>
        </div>
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-[hsl(var(--warning))] sm:max-w-xs">
          Projected values are targets — never guarantees. Settlement credits the wallet ledger.
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatChip icon={TrendingUp} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Sparkles} label="Active" value={stats.active} tone="green" />
        <StatChip icon={Hourglass} label="Matured" value={stats.matured} tone="amber" />
        <StatChip icon={CheckCircle2} label="Settled" value={stats.settled} tone="blue" />
        <StatChip icon={Clock3} label="Pending" value={stats.pending} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(0_0%_10%/0.08)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search investor, email or opportunity…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {Object.values(InvestmentStatus).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {apiErrorMessage(error, "Could not load investments.")}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={investments.length === 0 ? "No investments yet" : "No matches"}
          description={
            investments.length === 0
              ? "Positions appear here when users invest on the Trading Floor."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((inv) => {
            const settleable = canSettle(inv.status);
            return (
              <article
                key={inv.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)] opacity-80"
                />
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <Badge variant={statusVariant(inv.status)}>{humanize(inv.status)}</Badge>
                        <Badge variant="volt">
                          ×{inv.opportunity.projectionMultiplier}
                        </Badge>
                      </div>
                      <h2 className="truncate text-lg font-bold tracking-tight">
                        {inv.opportunity.name}
                      </h2>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        /{inv.opportunity.slug}
                      </p>
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(0_0%_10%/0.2)] text-volt-dim">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {inv.user?.fullName ?? "Unknown investor"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {inv.user?.email ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <MoneyTile label="Principal" value={formatMoney(inv.principal)} icon={Wallet} />
                    <MoneyTile
                      label="Projected"
                      value={formatMoney(inv.projectedValue)}
                      icon={Target}
                      hint="Target only"
                    />
                  </div>

                  {inv.settledValue ? (
                    <div className="rounded-xl border border-success/25 bg-success/10 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Settled
                      </p>
                      <p className={cn("text-sm font-bold", pnlTone(inv.settledValue, inv.principal))}>
                        {formatMoney(inv.settledValue)}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Matures {formatDate(inv.maturesAt)}
                    </span>
                    <span>Opened {formatDate(inv.createdAt)}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUpdateTarget(inv);
                        setUpdateTitle("");
                        setUpdateBody("");
                        postUpdate.reset();
                      }}
                    >
                      <MessageSquareText className="h-3.5 w-3.5" />
                      Cycle note
                    </Button>
                    {settleable ? (
                      <Button size="sm" variant="primary" onClick={() => openSettle(inv)}>
                        <BadgeDollarSign className="h-3.5 w-3.5" />
                        Settle
                      </Button>
                    ) : inv.status === "SETTLED" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Closed
                      </span>
                    ) : inv.status === "CANCELLED" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Ban className="h-3.5 w-3.5" />
                        Cancelled
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Awaiting activation</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!settleTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSettleTarget(null);
            setSettledMajor("");
            settle.reset();
          }
        }}
      >
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => {
            setSettleTarget(null);
            setSettledMajor("");
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.18)] px-6 pb-5 pt-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-volt/35 blur-3xl"
              />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <BadgeDollarSign className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Ledger settlement
                  </p>
                  <DialogTitle className="font-display text-2xl">Settle investment</DialogTitle>
                  <DialogDescription className="mt-1">
                    Credits the investor wallet with the settled value. Use 0 for a total loss
                    (no ledger credit).
                  </DialogDescription>
                </div>
              </div>

              {settleTarget ? (
                <div className="relative mt-5 space-y-3 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={statusVariant(settleTarget.status)}>
                      {humanize(settleTarget.status)}
                    </Badge>
                    <Badge variant="volt">{settleTarget.opportunity.name}</Badge>
                  </div>
                  <p className="text-sm font-medium">
                    {settleTarget.user?.fullName ?? "Investor"}
                    {settleTarget.user?.email ? (
                      <span className="text-muted-foreground"> · {settleTarget.user.email}</span>
                    ) : null}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Principal
                      </p>
                      <p className="font-semibold">{formatMoney(settleTarget.principal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Projected (target)
                      </p>
                      <p className="font-semibold text-volt-dim">
                        {formatMoney(settleTarget.projectedValue)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="settledMajor">Settled value (major units)</Label>
                  <span className="text-[11px] text-muted-foreground">
                    {settleTarget?.principal.currency}
                  </span>
                </div>
                <div className="relative">
                  <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="settledMajor"
                    className="pl-9"
                    type="number"
                    step="0.01"
                    min={0}
                    value={settledMajor}
                    onChange={(e) => setSettledMajor(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Will credit <strong className="text-foreground">{settlePreview}</strong> to the
                  wallet ledger.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!settleTarget}
                  onClick={() =>
                    settleTarget &&
                    setSettledMajor(
                      String(
                        fromMinorUnits(
                          settleTarget.principal.amount,
                          settleTarget.principal.currency as Currency,
                        ),
                      ),
                    )
                  }
                >
                  Use principal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!settleTarget}
                  onClick={() =>
                    settleTarget &&
                    setSettledMajor(
                      String(
                        fromMinorUnits(
                          settleTarget.projectedValue.amount,
                          settleTarget.projectedValue.currency as Currency,
                        ),
                      ),
                    )
                  }
                >
                  Use projected
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSettledMajor("0")}
                >
                  Total loss (0)
                </Button>
              </div>

              {settle.isError ? (
                <Alert variant="danger">
                  {apiErrorMessage(settle.error, "Could not settle investment.")}
                </Alert>
              ) : null}

              <DialogFooter className="mt-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSettleTarget(null);
                    setSettledMajor("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    settle.isPending ||
                    !settleTarget ||
                    settledMajor.trim() === "" ||
                    Number(settledMajor) < 0
                  }
                  onClick={confirmSettle}
                  className="shadow-volt"
                >
                  {settle.isPending ? "Settling…" : "Confirm settlement"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!updateTarget}
        onOpenChange={(open) => {
          if (!open) {
            setUpdateTarget(null);
            setUpdateTitle("");
            setUpdateBody("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Post cycle note</DialogTitle>
          <DialogDescription>
            Appears on the member’s position page as an operational update — not live performance
            or guaranteed returns.
          </DialogDescription>
          {updateTarget ? (
            <p className="text-sm text-muted-foreground">
              {updateTarget.opportunity.name} · {updateTarget.user?.fullName ?? "Investor"}
            </p>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="update-title">Title</Label>
              <Input
                id="update-title"
                value={updateTitle}
                onChange={(e) => setUpdateTitle(e.target.value)}
                placeholder="Week 1 cycle note"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="update-body">Message</Label>
              <Textarea
                id="update-body"
                value={updateBody}
                onChange={(e) => setUpdateBody(e.target.value)}
                placeholder="Short operational update for the member…"
                rows={4}
                maxLength={4000}
              />
            </div>
            {postUpdate.error ? (
              <Alert variant="danger">
                {apiErrorMessage(postUpdate.error, "Could not post update")}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUpdateTarget(null);
                setUpdateTitle("");
                setUpdateBody("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                postUpdate.isPending ||
                updateTitle.trim().length < 3 ||
                updateBody.trim().length < 3 ||
                !updateTarget
              }
              onClick={() => {
                if (!updateTarget) return;
                postUpdate.mutate({
                  id: updateTarget.id,
                  title: updateTitle.trim(),
                  body: updateBody.trim(),
                });
              }}
            >
              {postUpdate.isPending ? "Posting…" : "Post to member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MoneyTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-volt-dim" />
      </div>
      <p className="mt-0.5 text-sm font-bold tracking-tight">{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
