"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Clock3,
  XCircle,
  Ban,
  RotateCcw,
  Eye,
  Copy,
  Check,
  User,
  Hash,
  ExternalLink,
  Wallet,
  GraduationCap,
  TrendingUp,
  ShoppingBag,
  Banknote,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react";
import {
  PaymentStatus,
  PaymentType,
  SUPPORTED_CURRENCIES,
  type Currency,
  type PaymentStatus as PaymentStatusType,
  type PaymentType as PaymentTypeType,
  DEFAULT_CURRENCY,
} from "@volt/config";
import { currencySchema } from "@volt/validation";
import type { Money } from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { formatDate, formatDateTime, formatMoney, toMinorUnits } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatChip } from "@/components/ui/stat-chip";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";

interface AdminPaymentView {
  id: string;
  type: PaymentTypeType;
  status: PaymentStatusType;
  amount: Money;
  gateway: string;
  reference: string;
  checkoutUrl: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  user?: { id?: string; fullName: string; email: string | null } | null;
}

interface AdminUserOption {
  id: string;
  fullName: string;
  email: string | null;
}

type StatusFilter = "ALL" | PaymentStatusType;
type TypeFilter = "ALL" | PaymentTypeType;

const CREATE_TYPES = [
  "WALLET_DEPOSIT",
  "COURSE_PURCHASE",
  "INVESTMENT_FUNDING",
  "SHOP_PURCHASE",
] as const;

const EDITABLE_STATUSES: PaymentStatusType[] = [
  "PENDING",
  "FAILED",
  "CANCELLED",
  "UNDER_REVIEW",
];

const createFormSchema = z.object({
  userId: z.string().min(1, "Select a user"),
  type: z.enum(CREATE_TYPES),
  amountMajor: z.coerce.number().positive("Enter a positive amount"),
  currency: currencySchema,
  gateway: z.string().min(1).default("mock"),
  courseId: z.string().optional(),
  opportunityId: z.string().optional(),
});
type CreateFormInput = z.infer<typeof createFormSchema>;

const editFormSchema = z.object({
  status: z.enum(["PENDING", "FAILED", "CANCELLED", "UNDER_REVIEW"]),
  gateway: z.string().min(1).max(40),
});
type EditFormInput = z.infer<typeof editFormSchema>;

function typeIcon(type: PaymentTypeType): LucideIcon {
  switch (type) {
    case "COURSE_PURCHASE":
      return GraduationCap;
    case "WALLET_DEPOSIT":
      return Wallet;
    case "INVESTMENT_FUNDING":
      return TrendingUp;
    case "WITHDRAWAL":
      return Banknote;
    case "SHOP_PURCHASE":
      return ShoppingBag;
    default:
      return CreditCard;
  }
}

function canEdit(status: PaymentStatusType) {
  return status !== "PAID" && status !== "REFUNDED";
}

function canDelete(status: PaymentStatusType) {
  return (
    status === "INITIATED" ||
    status === "PENDING" ||
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "UNDER_REVIEW"
  );
}

const createDefaults: CreateFormInput = {
  userId: "",
  type: "WALLET_DEPOSIT",
  amountMajor: 0,
  currency: DEFAULT_CURRENCY,
  gateway: "mock",
  courseId: "",
  opportunityId: "",
};

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [detail, setDetail] = useState<AdminPaymentView | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPaymentView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPaymentView | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => api.get<AdminPaymentView[]>("/payments?page=1&pageSize=100"),
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
    defaultValues: { status: "PENDING", gateway: "mock" },
  });

  const createWatch = createForm.watch();

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<AdminPaymentView>("/payments/admin", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      setEditorOpen(false);
      createForm.reset(createDefaults);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<AdminPaymentView>(`/payments/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      setDeleteTarget(null);
    },
  });

  const quickStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EditFormInput["status"] }) =>
      api.patch(`/payments/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
  });

  const confirmManual = useMutation({
    mutationFn: (id: string) => api.post<AdminPaymentView>(`/payments/${id}/confirm-manual`, {}),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      setDetail(updated);
    },
  });

  const payments = data ?? [];
  const users = usersData ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (!term) return true;
      const user = `${p.user?.fullName ?? ""} ${p.user?.email ?? ""}`.toLowerCase();
      return (
        user.includes(term) ||
        p.reference.toLowerCase().includes(term) ||
        p.gateway.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    });
  }, [payments, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const by = (s: PaymentStatusType) => payments.filter((p) => p.status === s).length;
    return {
      total: payments.length,
      paid: by("PAID"),
      pending: by("PENDING") + by("INITIATED") + by("UNDER_REVIEW"),
      failed: by("FAILED"),
      cancelled: by("CANCELLED") + by("REFUNDED"),
    };
  }, [payments]);

  const openCreate = () => {
    createForm.reset(createDefaults);
    setEditorOpen(true);
  };

  const openEdit = (p: AdminPaymentView) => {
    setEditing(p);
    editForm.reset({
      status: (EDITABLE_STATUSES.includes(p.status as EditFormInput["status"])
        ? p.status
        : "PENDING") as EditFormInput["status"],
      gateway: p.gateway || "mock",
    });
  };

  const onCreate = (values: CreateFormInput) => {
    const payload: Record<string, unknown> = {
      userId: values.userId,
      type: values.type,
      amount: toMinorUnits(values.amountMajor, values.currency as Currency),
      currency: values.currency,
      gateway: values.gateway || "mock",
      idempotencyKey: crypto.randomUUID(),
    };
    if (values.type === "COURSE_PURCHASE" && values.courseId?.trim()) {
      payload.courseId = values.courseId.trim();
    }
    if (values.type === "INVESTMENT_FUNDING" && values.opportunityId?.trim()) {
      payload.opportunityId = values.opportunityId.trim();
    }
    createMutation.mutate(payload);
  };

  const onEdit = (values: EditFormInput) => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      payload: { status: values.status, gateway: values.gateway },
    });
  };

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  const createError =
    createMutation.isError
      ? apiErrorMessage(createMutation.error, "Could not create payment.")
      : null;
  const editError =
    updateMutation.isError
      ? apiErrorMessage(updateMutation.error, "Could not update payment.")
      : null;

  const previewAmount = formatMoney({
    amount: toMinorUnits(
      Number(createWatch.amountMajor) || 0,
      (createWatch.currency as Currency) || DEFAULT_CURRENCY,
    ),
    currency: (createWatch.currency as Currency) || DEFAULT_CURRENCY,
  });
  const selectedUser = users.find((u) => u.id === createWatch.userId);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(142_65%_32%/0.12),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Wallet · Finance
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create intents, cancel open ones, or delete failed attempts. PAID stays webhook-only.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          New payment
        </Button>
      </div>

      <div className="rounded-2xl border border-info/30 bg-info/10 px-4 py-3 text-xs text-info sm:max-w-xl">
        Status <strong>PAID</strong> is confirmed server-side only via verified gateway webhooks —
        never from this admin form.
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatChip icon={CreditCard} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={CheckCircle2} label="Paid" value={stats.paid} tone="green" />
        <StatChip icon={Clock3} label="In flight" value={stats.pending} tone="amber" />
        <StatChip icon={XCircle} label="Failed" value={stats.failed} tone="blue" />
        <StatChip icon={Ban} label="Closed" value={stats.cancelled} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(142_65%_32%/0.08)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(142_65%_32%)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, email, reference or gateway…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {Object.values(PaymentStatus).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-48">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="ALL">All types</option>
              {Object.values(PaymentType).map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {apiErrorMessage(error, "Could not load payments.")}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={payments.length === 0 ? "No payments yet" : "No matches"}
          description={
            payments.length === 0
              ? "Create a payment intent for a user, or wait for checkout."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const TypeIcon = typeIcon(p.type);
            return (
              <article
                key={p.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(142_65%_32%)] opacity-80"
                />
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <Badge variant={statusVariant(p.status)}>{humanize(p.status)}</Badge>
                        <Badge variant="volt">{humanize(p.type)}</Badge>
                      </div>
                      <p className="text-xl font-bold tracking-tight">{formatMoney(p.amount)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.gateway}</p>
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(142_65%_32%/0.2)] text-volt-dim">
                      <TypeIcon className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {p.user?.fullName ?? "Unknown user"}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.user?.email ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2">
                    <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <p className="min-w-0 flex-1 truncate font-mono text-[11px]">{p.reference}</p>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => void copyText(p.reference, p.id)}
                      aria-label="Copy reference"
                    >
                      {copied === p.id ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                    <span>{formatDate(p.createdAt)}</span>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDetail(p)}>
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </Button>
                      {canEdit(p.status) ? (
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      ) : null}
                      {p.status === "PENDING" || p.status === "INITIATED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={quickStatus.isPending}
                          onClick={() =>
                            quickStatus.mutate({ id: p.id, status: "CANCELLED" })
                          }
                        >
                          Cancel
                        </Button>
                      ) : null}
                      {canDelete(p.status) ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditorOpen(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(142_65%_32%/0.18)] px-6 pb-5 pt-6">
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
                    Payment intent
                  </p>
                  <DialogTitle className="font-display text-2xl">Create payment</DialogTitle>
                  <DialogDescription className="mt-1">
                    Opens a gateway checkout. Funds credit only after webhook confirmation.
                  </DialogDescription>
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant="warning">Pending</Badge>
                      <Badge variant="volt">{humanize(createWatch.type || "WALLET_DEPOSIT")}</Badge>
                    </div>
                    <p className="truncate text-lg font-bold tracking-tight">
                      {selectedUser?.fullName ?? "Select a user"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Gateway: {createWatch.gateway || "mock"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Amount
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
              <FormSection icon={User} title="Payer" description="User this intent belongs to." tone="gold">
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
                title="Intent"
                description="Type, amount and gateway."
                tone="blue"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type" htmlFor="type">
                    <Select id="type" {...createForm.register("type")}>
                      {CREATE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {humanize(t)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Gateway" htmlFor="gateway">
                    <Input id="gateway" placeholder="mock" {...createForm.register("gateway")} />
                  </Field>
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
                  {createWatch.type === "COURSE_PURCHASE" ? (
                    <Field
                      className="sm:col-span-2"
                      label="Course ID"
                      htmlFor="courseId"
                      hint="Required for course purchase intents"
                    >
                      <Input id="courseId" {...createForm.register("courseId")} />
                    </Field>
                  ) : null}
                  {createWatch.type === "INVESTMENT_FUNDING" ? (
                    <Field
                      className="sm:col-span-2"
                      label="Opportunity ID"
                      htmlFor="opportunityId"
                      hint="Required for investment funding intents"
                    >
                      <Input id="opportunityId" {...createForm.register("opportunityId")} />
                    </Field>
                  ) : null}
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
                  {createMutation.isPending ? "Creating…" : "Create intent"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit */}
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
                  <DialogTitle className="font-display text-2xl">Update payment</DialogTitle>
                  <DialogDescription className="mt-1">
                    Cancel, fail or flag open intents. Cannot set PAID here.
                  </DialogDescription>
                </div>
              </div>
              {editing ? (
                <div className="relative mt-4 rounded-2xl border border-border/80 bg-surface/80 p-3">
                  <p className="font-bold">{formatMoney(editing.amount)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{editing.reference}</p>
                </div>
              ) : null}
            </div>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4 p-6">
              <Field label="Status" htmlFor="editStatus">
                <Select id="editStatus" {...editForm.register("status")}>
                  {EDITABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Gateway" htmlFor="editGateway">
                <Input id="editGateway" {...editForm.register("gateway")} />
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

      {/* Details */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setDetail(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(142_65%_32%/0.18)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <CreditCard className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="font-display text-2xl">
                    {detail ? formatMoney(detail.amount) : "Payment"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {detail?.gateway === "manual"
                      ? "Manual deposit — confirm after verifying the transfer off-platform."
                      : "Audit view — gateway payments confirm via verified webhook only."}
                  </DialogDescription>
                </div>
              </div>
              {detail ? (
                <div className="relative mt-5 flex flex-wrap gap-1.5">
                  <Badge variant={statusVariant(detail.status)}>{humanize(detail.status)}</Badge>
                  <Badge variant="volt">{humanize(detail.type)}</Badge>
                  <Badge variant="default">{detail.gateway}</Badge>
                </div>
              ) : null}
            </div>
            {detail ? (
              <div className="space-y-3 p-6">
                <DetailRow label="Payer" value={detail.user?.fullName ?? "—"} />
                <DetailRow label="Email" value={detail.user?.email ?? "—"} />
                <DetailRow label="Created" value={formatDateTime(detail.createdAt)} />
                <DetailRow
                  label="Reference"
                  value={detail.reference}
                  mono
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copyText(detail.reference, "detail-ref")}
                    >
                      {copied === "detail-ref" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy
                    </Button>
                  }
                />
                {detail.checkoutUrl ? (
                  <div className="rounded-xl border border-border/70 bg-surface-2/40 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Checkout URL
                    </p>
                    <a
                      href={detail.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 break-all text-sm text-volt-dim hover:underline"
                    >
                      {detail.checkoutUrl}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                ) : null}
                {detail.metadata && typeof detail.metadata === "object" ? (
                  <div className="space-y-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Manual deposit details
                    </p>
                    {"channel" in detail.metadata ? (
                      <DetailRow
                        label="Channel"
                        value={String(detail.metadata.channel ?? "—")}
                      />
                    ) : null}
                    {"payerReference" in detail.metadata ? (
                      <DetailRow
                        label="Payer reference"
                        value={String(detail.metadata.payerReference ?? "—")}
                        mono
                      />
                    ) : null}
                  </div>
                ) : null}
                {detail.status === "REFUNDED" ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <RotateCcw className="h-3.5 w-3.5" />
                    This payment was refunded.
                  </p>
                ) : null}
                {confirmManual.error ? (
                  <Alert variant="danger">
                    {apiErrorMessage(confirmManual.error, "Could not confirm deposit")}
                  </Alert>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  {detail.gateway === "manual" &&
                  detail.type === "WALLET_DEPOSIT" &&
                  (detail.status === "UNDER_REVIEW" || detail.status === "PENDING") ? (
                    <Button
                      variant="primary"
                      disabled={confirmManual.isPending}
                      onClick={() => confirmManual.mutate(detail.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {confirmManual.isPending ? "Confirming…" : "Confirm & credit wallet"}
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete payment?"
        description={
          <>
            Permanently remove this open/failed intent
            {deleteTarget ? (
              <>
                {" "}
                (<strong className="font-mono">{deleteTarget.reference}</strong>
              </>
            ) : null}
            . Paid payments cannot be deleted.
          </>
        }
        error={
          deleteMutation.isError
            ? apiErrorMessage(deleteMutation.error, "Could not delete payment.")
            : null
        }
        pending={deleteMutation.isPending}
        disabled={!deleteTarget}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-0.5 truncate text-sm font-medium", mono && "font-mono text-xs")}>
          {value}
        </p>
      </div>
      {action}
    </div>
  );
}
