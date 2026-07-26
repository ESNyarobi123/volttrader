"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Banknote,
  Search,
  CheckCircle2,
  Clock3,
  XCircle,
  Loader2,
  ShieldCheck,
  Smartphone,
  Landmark,
  User,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  BadgeDollarSign,
  } from "lucide-react";
import {
  SUPPORTED_CURRENCIES,
  WithdrawalStatus,
  type Currency,
  type WithdrawalStatus as WithdrawalStatusType,
  DEFAULT_CURRENCY,
} from "@volt/config";
import { currencySchema } from "@volt/validation";
import type { WithdrawalView } from "@volt/types";
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
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { formatMoney, formatDate, toMinorUnits } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatChip } from "@/components/ui/stat-chip";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";

type ReviewAction = "APPROVE" | "PROCESS" | "COMPLETE" | "REJECT" | "FAIL";

type AdminWithdrawalView = WithdrawalView & {
  user?: { id?: string; fullName: string; email: string | null } | null;
  reviewerNote?: string | null;
  reference?: string;
};

interface AdminUserOption {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  kycStatus: string;
  status: string;
}

type StatusFilter = "ALL" | WithdrawalStatusType;

const createFormSchema = z.object({
  userId: z.string().min(1, "Select a user"),
  amountMajor: z.coerce.number().positive("Enter a positive amount"),
  currency: currencySchema,
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"]),
  destination: z.string().min(3).max(120),
});
type CreateFormInput = z.infer<typeof createFormSchema>;

const editFormSchema = z.object({
  method: z.enum(["MOBILE_MONEY", "BANK_TRANSFER"]),
  destination: z
    .string()
    .max(120)
    .refine((v) => !v.trim() || v.trim().length >= 3, {
      message: "Destination must be at least 3 characters",
    }),
  reviewerNote: z.string().max(1000).optional(),
});
type EditFormInput = z.infer<typeof editFormSchema>;

function availableActions(
  status: WithdrawalStatusType,
): { action: ReviewAction; label: string; variant: "primary" | "danger" | "outline" }[] {
  switch (status) {
    case "REQUESTED":
    case "UNDER_REVIEW":
      return [
        { action: "APPROVE", label: "Approve", variant: "primary" },
        { action: "REJECT", label: "Reject", variant: "danger" },
      ];
    case "APPROVED":
      return [
        { action: "PROCESS", label: "Process", variant: "primary" },
        { action: "FAIL", label: "Fail", variant: "danger" },
      ];
    case "PROCESSING":
      return [
        { action: "COMPLETE", label: "Complete", variant: "primary" },
        { action: "FAIL", label: "Fail", variant: "danger" },
      ];
    default:
      return [];
  }
}

function needsNote(action: ReviewAction) {
  return action === "REJECT" || action === "FAIL";
}

function canEdit(status: WithdrawalStatusType) {
  return status === "REQUESTED" || status === "UNDER_REVIEW";
}

function canDelete(status: WithdrawalStatusType) {
  return (
    status === "REQUESTED" ||
    status === "UNDER_REVIEW" ||
    status === "REJECTED" ||
    status === "FAILED"
  );
}

function actionBlurb(action: ReviewAction) {
  switch (action) {
    case "APPROVE":
      return "Mark this request as approved so payout can be processed.";
    case "PROCESS":
      return "Funds are being sent to the destination. Move to processing.";
    case "COMPLETE":
      return "Confirm the payout succeeded. This closes the withdrawal.";
    case "REJECT":
      return "Reject the request and reverse the held funds back to the wallet.";
    case "FAIL":
      return "Mark payout as failed and reverse the held funds back to the wallet.";
  }
}

const createDefaults: CreateFormInput = {
  userId: "",
  amountMajor: 0,
  currency: DEFAULT_CURRENCY,
  method: "MOBILE_MONEY",
  destination: "",
};

export default function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminWithdrawalView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminWithdrawalView | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    withdrawal: AdminWithdrawalView;
    action: ReviewAction;
  } | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: () => api.get<AdminWithdrawalView[]>("/withdrawals?page=1&pageSize=100"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-users-options"],
    queryFn: () => api.get<AdminUserOption[]>("/users?page=1&pageSize=100"),
  });

  const createForm = useForm<CreateFormInput>({
    resolver: zodResolver(createFormSchema),
    defaultValues: createDefaults,
  });

  const editForm = useForm<EditFormInput>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { method: "MOBILE_MONEY", destination: "", reviewerNote: "" },
  });

  const createWatch = createForm.watch();

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<AdminWithdrawalView>("/withdrawals/admin", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setEditorOpen(false);
      createForm.reset(createDefaults);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<AdminWithdrawalView>(`/withdrawals/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/withdrawals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setDeleteTarget(null);
    },
  });

  const review = useMutation({
    mutationFn: ({
      id,
      action,
      reviewerNote: note,
    }: {
      id: string;
      action: ReviewAction;
      reviewerNote?: string;
    }) => api.patch(`/withdrawals/${id}/review`, { action, reviewerNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setReviewTarget(null);
      setReviewerNote("");
    },
  });

  const openCreate = () => {
    setEditing(null);
    createForm.reset(createDefaults);
    setEditorOpen(true);
  };

  const openEdit = (w: AdminWithdrawalView) => {
    setEditorOpen(false);
    setEditing(w);
    editForm.reset({
      method: w.method,
      destination: "",
      reviewerNote: w.reviewerNote ?? "",
    });
  };

  const onCreate = (values: CreateFormInput) => {
    createMutation.mutate({
      userId: values.userId,
      amount: toMinorUnits(values.amountMajor, values.currency as Currency),
      currency: values.currency,
      method: values.method,
      destination: values.destination,
      skipKycCheck: true,
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const onEdit = (values: EditFormInput) => {
    if (!editing) return;
    const payload: Record<string, unknown> = {
      method: values.method,
      reviewerNote: values.reviewerNote?.trim() || null,
    };
    if (values.destination.trim()) payload.destination = values.destination.trim();
    updateMutation.mutate({ id: editing.id, payload });
  };

  const openReview = (withdrawal: AdminWithdrawalView, action: ReviewAction) => {
    setReviewTarget({ withdrawal, action });
    setReviewerNote("");
    review.reset();
  };

  const confirmReview = () => {
    if (!reviewTarget) return;
    if (needsNote(reviewTarget.action) && !reviewerNote.trim()) return;
    review.mutate({
      id: reviewTarget.withdrawal.id,
      action: reviewTarget.action,
      reviewerNote: reviewerNote.trim() || undefined,
    });
  };

  const withdrawals = data ?? [];
  const users = usersData ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (statusFilter !== "ALL" && w.status !== statusFilter) return false;
      if (!term) return true;
      const user = `${w.user?.fullName ?? ""} ${w.user?.email ?? ""}`.toLowerCase();
      return (
        user.includes(term) ||
        w.destinationMasked.toLowerCase().includes(term) ||
        w.method.toLowerCase().includes(term) ||
        (w.reference ?? "").toLowerCase().includes(term) ||
        w.id.toLowerCase().includes(term)
      );
    });
  }, [withdrawals, search, statusFilter]);

  const stats = useMemo(() => {
    const by = (s: WithdrawalStatusType) => withdrawals.filter((w) => w.status === s).length;
    return {
      total: withdrawals.length,
      queue: by("REQUESTED") + by("UNDER_REVIEW"),
      approved: by("APPROVED"),
      processing: by("PROCESSING"),
      completed: by("COMPLETED"),
      closed: by("REJECTED") + by("FAILED"),
    };
  }, [withdrawals]);

  const createError =
    createMutation.isError
      ? apiErrorMessage(createMutation.error, "Could not create withdrawal.")
      : null;

  const editError =
    updateMutation.isError
      ? apiErrorMessage(updateMutation.error, "Could not update withdrawal.")
      : null;

  const previewAmount = formatMoney({
    amount: toMinorUnits(Number(createWatch.amountMajor) || 0, (createWatch.currency as Currency) || DEFAULT_CURRENCY),
    currency: (createWatch.currency as Currency) || DEFAULT_CURRENCY,
  });

  const selectedUser = users.find((u) => u.id === createWatch.userId);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(0_72%_51%/0.08),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Wallet · Finance
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Withdrawals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create payout requests, edit open ones, review status, or delete safely.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          New withdrawal
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatChip icon={Banknote} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Clock3} label="Queue" value={stats.queue} tone="amber" />
        <StatChip icon={ShieldCheck} label="Approved" value={stats.approved} tone="blue" />
        <StatChip icon={Loader2} label="Processing" value={stats.processing} tone="ink" />
        <StatChip icon={CheckCircle2} label="Completed" value={stats.completed} tone="green" />
        <StatChip icon={XCircle} label="Closed" value={stats.closed} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(0_72%_51%/0.06)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_72%_51%/0.7)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, destination or reference…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {Object.values(WithdrawalStatus).map((s) => (
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
          {apiErrorMessage(error, "Could not load withdrawals.")}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title={withdrawals.length === 0 ? "No withdrawals yet" : "No matches"}
          description={
            withdrawals.length === 0
              ? "Create a payout request for a user, or wait for user requests."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((w) => {
            const actions = availableActions(w.status);
            const MethodIcon = w.method === "MOBILE_MONEY" ? Smartphone : Landmark;
            return (
              <article
                key={w.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_72%_51%/0.65)] opacity-80"
                />
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <Badge variant={statusVariant(w.status)}>{humanize(w.status)}</Badge>
                        <Badge variant="volt">{humanize(w.method)}</Badge>
                      </div>
                      <p className="text-xl font-bold tracking-tight">{formatMoney(w.amount)}</p>
                      {w.reference ? (
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {w.reference}
                        </p>
                      ) : null}
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(0_72%_51%/0.12)] text-volt-dim">
                      <MethodIcon className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {w.user?.fullName ?? "Unknown user"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {w.user?.email ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <p className="truncate font-mono text-sm">{w.destinationMasked}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                    <span>Requested {formatDate(w.createdAt)}</span>
                    <span>
                      {w.processedAt ? `Processed ${formatDate(w.processedAt)}` : "Open"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canEdit(w.status) ? (
                      <Button size="sm" variant="secondary" onClick={() => openEdit(w)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : null}
                    {actions.map((a) => (
                      <Button
                        key={a.action}
                        size="sm"
                        variant={a.variant}
                        disabled={review.isPending}
                        onClick={() => openReview(w, a.action)}
                      >
                        {a.label}
                      </Button>
                    ))}
                    {canDelete(w.status) ? (
                      <Button
                        size="sm"
                        variant="danger"
                        className="ml-auto"
                        onClick={() => setDeleteTarget(w)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    ) : actions.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Closed
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditorOpen(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_72%_51%/0.12)] px-6 pb-5 pt-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-volt/35 blur-3xl"
              />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Ledger hold
                  </p>
                  <DialogTitle className="font-display text-2xl">Create withdrawal</DialogTitle>
                  <DialogDescription className="mt-1">
                    Debits the user wallet immediately and queues the payout for review.
                  </DialogDescription>
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge variant="warning">Requested</Badge>
                    <p className="mt-2 truncate text-lg font-bold tracking-tight">
                      {selectedUser?.fullName ?? "Select a user"}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {createWatch.destination?.trim() || "Destination preview"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Hold
                    </p>
                    <p className="text-base font-bold text-volt-dim">{previewAmount}</p>
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={createForm.handleSubmit(onCreate)}
              className="max-h-[min(62vh,560px)] space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <FormSection icon={User} title="User" description="Who receives this payout." tone="gold">
                <Field
                  label="User"
                  htmlFor="userId"
                  error={createForm.formState.errors.userId?.message}
                >
                  <Select id="userId" {...createForm.register("userId")}>
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                        {u.email ? ` · ${u.email}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FormSection>

              <FormSection
                icon={BadgeDollarSign}
                title="Amount & destination"
                description="Amount is locked after create (ledger hold)."
                tone="blue"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Amount"
                    htmlFor="amountMajor"
                    error={createForm.formState.errors.amountMajor?.message}
                  >
                    <Input
                      id="amountMajor"
                      type="number"
                      step="0.01"
                      min={0}
                      {...createForm.register("amountMajor")}
                    />
                  </Field>
                  <Field label="Currency" htmlFor="currency">
                    <Select id="currency" {...createForm.register("currency")}>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Method" htmlFor="method">
                    <Select id="method" {...createForm.register("method")}>
                      <option value="MOBILE_MONEY">Mobile money</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                    </Select>
                  </Field>
                  <Field
                    label="Destination"
                    htmlFor="destination"
                    hint="Phone or account — stored masked"
                    error={createForm.formState.errors.destination?.message}
                  >
                    <Input
                      id="destination"
                      placeholder="+2557… or account number"
                      {...createForm.register("destination")}
                    />
                  </Field>
                </div>
              </FormSection>

              {createError ? <Alert variant="danger">{createError}</Alert> : null}

              <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="shadow-volt"
                >
                  {createMutation.isPending ? "Creating…" : "Create & hold funds"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditing(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.15)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <Pencil className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="font-display text-2xl">Edit withdrawal</DialogTitle>
                  <DialogDescription className="mt-1">
                    Amount stays locked. Update method, destination or note.
                  </DialogDescription>
                </div>
              </div>
              {editing ? (
                <div className="relative mt-4 rounded-2xl border border-border/80 bg-surface/80 p-3">
                  <p className="font-bold">{formatMoney(editing.amount)}</p>
                  <p className="text-sm text-muted-foreground">
                    Current destination:{" "}
                    <span className="font-mono">{editing.destinationMasked}</span>
                  </p>
                </div>
              ) : null}
            </div>

            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4 p-6">
              <Field label="Method" htmlFor="editMethod">
                <Select id="editMethod" {...editForm.register("method")}>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </Select>
              </Field>
              <Field
                label="New destination"
                htmlFor="editDestination"
                hint="Leave blank to keep current masked value"
                error={editForm.formState.errors.destination?.message}
              >
                <Input
                  id="editDestination"
                  placeholder="New phone or account"
                  {...editForm.register("destination")}
                />
              </Field>
              <Field label="Internal note" htmlFor="editNote">
                <Textarea id="editNote" rows={2} {...editForm.register("reviewerNote")} />
              </Field>
              {editError ? <Alert variant="danger">{editError}</Alert> : null}
              <DialogFooter className="mt-0">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="shadow-volt">
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog
        open={!!reviewTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTarget(null);
            setReviewerNote("");
            review.reset();
          }
        }}
      >
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => {
            setReviewTarget(null);
            setReviewerNote("");
          }}
        >
          <div
            className={cn(
              "overflow-hidden rounded-2xl border bg-surface shadow-lift",
              reviewTarget && needsNote(reviewTarget.action)
                ? "border-danger/30"
                : "border-border",
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden border-b px-6 pb-5 pt-6",
                reviewTarget && needsNote(reviewTarget.action)
                  ? "border-danger/20 bg-gradient-to-br from-danger/15 via-surface to-warning/10"
                  : "border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.15)]",
              )}
            >
              <div className="relative flex items-start gap-3 pr-8">
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl text-volt-foreground shadow-volt",
                    reviewTarget && needsNote(reviewTarget.action)
                      ? "bg-danger/90"
                      : "bg-gradient-to-br from-volt to-[hsl(349_74%_36%)]",
                  )}
                >
                  <Banknote className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Withdrawal review
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {reviewTarget ? humanize(reviewTarget.action) : "Review"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {reviewTarget ? actionBlurb(reviewTarget.action) : null}
                  </DialogDescription>
                </div>
              </div>

              {reviewTarget ? (
                <div className="relative mt-5 space-y-2 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={statusVariant(reviewTarget.withdrawal.status)}>
                      {humanize(reviewTarget.withdrawal.status)}
                    </Badge>
                    <Badge variant="volt">{humanize(reviewTarget.withdrawal.method)}</Badge>
                  </div>
                  <p className="text-lg font-bold">
                    {formatMoney(reviewTarget.withdrawal.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewTarget.withdrawal.user?.fullName ?? "User"}
                    {reviewTarget.withdrawal.user?.email
                      ? ` · ${reviewTarget.withdrawal.user.email}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 p-6">
              {reviewTarget && needsNote(reviewTarget.action) ? (
                <div className="space-y-1.5">
                  <Label htmlFor="reviewerNote">Reason (required)</Label>
                  <Textarea
                    id="reviewerNote"
                    rows={3}
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    placeholder="Explain why this withdrawal is being rejected or failed…"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="reviewerNoteOptional">Note (optional)</Label>
                  <Input
                    id="reviewerNoteOptional"
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    placeholder="Internal note for the audit log"
                  />
                </div>
              )}

              {review.isError ? (
                <Alert variant="danger">
                  {apiErrorMessage(review.error, "Could not update withdrawal.")}
                </Alert>
              ) : null}

              <DialogFooter className="mt-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewTarget(null);
                    setReviewerNote("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant={
                    reviewTarget && needsNote(reviewTarget.action) ? "danger" : "primary"
                  }
                  disabled={
                    review.isPending ||
                    !reviewTarget ||
                    (needsNote(reviewTarget.action) && !reviewerNote.trim())
                  }
                  onClick={confirmReview}
                  className={
                    reviewTarget && !needsNote(reviewTarget.action) ? "shadow-volt" : undefined
                  }
                >
                  {review.isPending
                    ? "Updating…"
                    : reviewTarget
                      ? `Confirm ${humanize(reviewTarget.action)}`
                      : "Confirm"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete withdrawal?"
        description={
          <>
            {deleteTarget && canEdit(deleteTarget.status)
              ? "This reverses the ledger hold and permanently removes the request."
              : "This permanently removes the closed withdrawal record."}{" "}
            {deleteTarget ? (
              <>
                <strong>{formatMoney(deleteTarget.amount)}</strong> ·{" "}
                {deleteTarget.user?.fullName ?? "user"}
              </>
            ) : null}
          </>
        }
        error={
          deleteMutation.isError
            ? apiErrorMessage(deleteMutation.error, "Could not delete withdrawal.")
            : null
        }
        pending={deleteMutation.isPending}
        disabled={!deleteTarget}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
