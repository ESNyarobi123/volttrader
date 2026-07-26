"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  Search,
  Sparkles,
  Power,
  PowerOff,
  Percent,
  BadgeDollarSign,
  Hash,
  CalendarClock,
  Users,
  Copy,
  Check,
  } from "lucide-react";
import {
  SUPPORTED_CURRENCIES,
  type Currency,
} from "@volt/config";
import { currencySchema } from "@volt/validation";
import { ApiRequestError, api, apiErrorMessage } from "@/lib/api";
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
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { formatDate, formatMoney, fromMinorUnits, toMinorUnits } from "@/lib/format";
import { StatChip } from "@/components/ui/stat-chip";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";

interface CouponView {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  currency: Currency | null;
  maxRedemptions: number | null;
  redemptions: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

const couponFormSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, - or _"),
    discountType: z.enum(["PERCENT", "AMOUNT"]),
    percentOff: z.coerce.number().int().min(1).max(100).optional(),
    amountMajor: z.coerce.number().positive().optional(),
    currency: currencySchema.optional(),
    maxRedemptions: z.union([z.coerce.number().int().positive(), z.literal("")]).optional(),
    expiresAt: z.string().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.discountType === "PERCENT") {
      if (d.percentOff === undefined || Number.isNaN(d.percentOff)) {
        ctx.addIssue({ code: "custom", path: ["percentOff"], message: "Enter 1–100%" });
      }
    } else {
      if (d.amountMajor === undefined || Number.isNaN(d.amountMajor) || d.amountMajor <= 0) {
        ctx.addIssue({ code: "custom", path: ["amountMajor"], message: "Enter a positive amount" });
      }
      if (!d.currency) {
        ctx.addIssue({ code: "custom", path: ["currency"], message: "Currency required" });
      }
    }
  });
type CouponFormInput = z.infer<typeof couponFormSchema>;

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "EXPIRED";
type DiscountFilter = "ALL" | "PERCENT" | "AMOUNT";

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function discountLabel(c: Pick<CouponView, "percentOff" | "amountOff" | "currency">) {
  if (c.percentOff != null) return `${c.percentOff}% off`;
  if (c.amountOff != null && c.currency) {
    return formatMoney({ amount: c.amountOff, currency: c.currency });
  }
  return "—";
}

function redemptionProgress(c: CouponView) {
  if (c.maxRedemptions == null) return null;
  const pct = Math.min(100, Math.round((c.redemptions / c.maxRedemptions) * 100));
  return { pct, label: `${c.redemptions} / ${c.maxRedemptions}` };
}

const emptyDefaults: CouponFormInput = {
  code: "",
  discountType: "PERCENT",
  percentOff: 10,
  amountMajor: undefined,
  currency: "TZS",
  maxRedemptions: "",
  expiresAt: "",
  active: true,
};

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CouponView | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => api.get<CouponView[]>("/coupons"),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CouponFormInput>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: emptyDefaults,
  });

  const codeValue = watch("code");
  const discountType = watch("discountType");
  const percentOff = watch("percentOff");
  const amountMajor = watch("amountMajor");
  const currencyValue = watch("currency");
  const maxRedemptions = watch("maxRedemptions");
  const expiresAt = watch("expiresAt");
  const activeValue = watch("active");

  const previewDiscount =
    discountType === "PERCENT"
      ? `${percentOff || "—"}% off`
      : formatMoney({
          amount: toMinorUnits(Number(amountMajor) || 0, (currencyValue as Currency) || "TZS"),
          currency: (currencyValue as Currency) || "TZS",
        });

  const openCreate = () => {
    setEditingId(null);
    reset(emptyDefaults);
    setEditorOpen(true);
  };

  const openEdit = (coupon: CouponView) => {
    setEditingId(coupon.id);
    const isPercent = coupon.percentOff != null;
    reset({
      code: coupon.code,
      discountType: isPercent ? "PERCENT" : "AMOUNT",
      percentOff: coupon.percentOff ?? 10,
      amountMajor:
        coupon.amountOff != null && coupon.currency
          ? fromMinorUnits(coupon.amountOff, coupon.currency)
          : undefined,
      currency: coupon.currency ?? "TZS",
      maxRedemptions: coupon.maxRedemptions ?? "",
      expiresAt: toDatetimeLocal(coupon.expiresAt),
      active: coupon.active,
    });
    setEditorOpen(true);
  };

  const createCoupon = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<CouponView>("/coupons", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setEditorOpen(false);
      reset(emptyDefaults);
    },
  });

  const updateCoupon = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<CouponView>(`/coupons/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setEditorOpen(false);
      setEditingId(null);
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/coupons/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const deleteCoupon = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setDeleteTarget(null);
    },
  });

  const buildPayload = (values: CouponFormInput) => {
    const max =
      values.maxRedemptions === "" || values.maxRedemptions === undefined
        ? undefined
        : Number(values.maxRedemptions);
    const expires = values.expiresAt?.trim()
      ? new Date(values.expiresAt).toISOString()
      : undefined;

    const base: Record<string, unknown> = {
      code: values.code.toUpperCase(),
    };

    // Updates can clear limits with null; create omits unset optional fields.
    if (editingId) {
      base.maxRedemptions = max ?? null;
      base.expiresAt = expires ?? null;
      base.active = values.active ?? true;
    } else {
      if (max !== undefined) base.maxRedemptions = max;
      if (expires !== undefined) base.expiresAt = expires;
    }

    if (values.discountType === "PERCENT") {
      base.percentOff = Number(values.percentOff);
    } else {
      base.amountOff = toMinorUnits(Number(values.amountMajor), values.currency as Currency);
      base.currency = values.currency;
    }

    return base;
  };

  const onSubmit = (values: CouponFormInput) => {
    const payload = buildPayload(values);
    if (editingId) {
      updateCoupon.mutate({ id: editingId, payload });
    } else {
      createCoupon.mutate(payload);
    }
  };

  const copyCode = async (coupon: CouponView) => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopiedId(coupon.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* ignore */
    }
  };

  const coupons = data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return coupons.filter((c) => {
      const expired = isExpired(c.expiresAt);
      if (statusFilter === "ACTIVE" && (!c.active || expired)) return false;
      if (statusFilter === "INACTIVE" && c.active) return false;
      if (statusFilter === "EXPIRED" && !expired) return false;
      if (discountFilter === "PERCENT" && c.percentOff == null) return false;
      if (discountFilter === "AMOUNT" && c.amountOff == null) return false;
      if (!term) return true;
      return c.code.toLowerCase().includes(term);
    });
  }, [coupons, search, statusFilter, discountFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: coupons.length,
      active: coupons.filter((c) => c.active && (!c.expiresAt || new Date(c.expiresAt).getTime() >= now))
        .length,
      inactive: coupons.filter((c) => !c.active).length,
      expired: coupons.filter((c) => isExpired(c.expiresAt)).length,
    };
  }, [coupons]);

  const saving = createCoupon.isPending || updateCoupon.isPending || isSubmitting;
  const formError =
    createCoupon.error instanceof ApiRequestError
      ? createCoupon.error.message
      : updateCoupon.error instanceof ApiRequestError
        ? updateCoupon.error.message
        : createCoupon.isError || updateCoupon.isError
          ? "Could not save coupon."
          : null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(142_65%_32%/0.12),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Catalogue · Promotions
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, activate and delete discount codes for checkout.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          New coupon
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip icon={Ticket} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Power} label="Active" value={stats.active} tone="green" />
        <StatChip icon={PowerOff} label="Inactive" value={stats.inactive} tone="blue" />
        <StatChip icon={CalendarClock} label="Expired" value={stats.expired} tone="ink" />
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
              placeholder="Search by code…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
            </Select>
          </div>
          <div className="md:w-44">
            <Select
              value={discountFilter}
              onChange={(e) => setDiscountFilter(e.target.value as DiscountFilter)}
            >
              <option value="ALL">All discounts</option>
              <option value="PERCENT">Percent off</option>
              <option value="AMOUNT">Fixed amount</option>
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
          {apiErrorMessage(error, "Could not load coupons.")}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={coupons.length === 0 ? "No coupons yet" : "No matches"}
          description={
            coupons.length === 0
              ? "Create your first promo code for academy checkout."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((coupon) => {
            const expired = isExpired(coupon.expiresAt);
            const progress = redemptionProgress(coupon);
            return (
              <article
                key={coupon.id}
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
                        {expired ? (
                          <Badge variant="warning">Expired</Badge>
                        ) : coupon.active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Inactive</Badge>
                        )}
                        <Badge variant="volt">
                          {coupon.percentOff != null ? "Percent" : "Fixed"}
                        </Badge>
                      </div>
                      <h2 className="truncate font-mono text-lg font-bold tracking-tight">
                        {coupon.code}
                      </h2>
                      <p className="mt-0.5 text-sm font-semibold text-volt-dim">
                        {discountLabel(coupon)}
                      </p>
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(142_65%_32%/0.2)] text-volt-dim">
                      <Ticket className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide">Expires</p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {formatDate(coupon.expiresAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide">Uses</p>
                      <p className="mt-0.5 font-medium text-foreground">
                        {progress?.label ?? `${coupon.redemptions} · unlimited`}
                      </p>
                    </div>
                  </div>

                  {progress ? (
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-volt to-[hsl(142_65%_32%)]"
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(coupon)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void copyCode(coupon)}>
                      {copiedId === coupon.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedId === coupon.id ? "Copied" : "Copy"}
                    </Button>
                    {coupon.active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleActive.isPending}
                        onClick={() => toggleActive.mutate({ id: coupon.id, active: false })}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={toggleActive.isPending}
                        onClick={() => toggleActive.mutate({ id: coupon.id, active: true })}
                      >
                        <Power className="h-3.5 w-3.5" />
                        Activate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      className="ml-auto"
                      onClick={() => setDeleteTarget(coupon)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[hsl(142_65%_32%/0.28)] blur-3xl"
              />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  {editingId ? <Pencil className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Promotions
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {editingId ? "Edit coupon" : "Create coupon"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {editingId
                      ? "Update code, discount, limits and status."
                      : "Issue a promo code learners can apply at checkout."}
                  </DialogDescription>
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant={activeValue === false ? "default" : "success"}>
                        {activeValue === false ? "Inactive" : "Active"}
                      </Badge>
                      <Badge variant="volt">
                        {discountType === "PERCENT" ? "Percent" : "Fixed"}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-lg font-bold tracking-tight">
                      {codeValue?.trim() || "YOUR-CODE"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {expiresAt ? `Expires ${formatDate(new Date(expiresAt).toISOString())}` : "No expiry"}
                      {" · "}
                      {maxRedemptions === "" || maxRedemptions === undefined
                        ? "Unlimited uses"
                        : `${maxRedemptions} max uses`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Discount
                    </p>
                    <p className="text-base font-bold text-volt-dim">{previewDiscount}</p>
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="max-h-[min(62vh,560px)] space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <FormSection
                icon={Hash}
                title="Code"
                description="Uppercase promo code customers will type."
                tone="gold"
              >
                <Field
                  label="Coupon code"
                  htmlFor="code"
                  hint="A-Z, 0-9, - _"
                  error={errors.code?.message}
                >
                  <div className="relative">
                    <Ticket className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="code"
                      className="pl-9 font-mono uppercase"
                      placeholder="VOLT10"
                      {...register("code", {
                        onChange: (e) =>
                          setValue("code", e.target.value.toUpperCase(), { shouldValidate: true }),
                      })}
                    />
                  </div>
                </Field>
              </FormSection>

              <FormSection
                icon={Percent}
                title="Discount"
                description="Percent off or a fixed amount in minor units."
                tone="blue"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type" htmlFor="discountType">
                    <Select
                      id="discountType"
                      value={discountType}
                      onChange={(e) =>
                        setValue("discountType", e.target.value as "PERCENT" | "AMOUNT", {
                          shouldValidate: true,
                        })
                      }
                    >
                      <option value="PERCENT">Percent off</option>
                      <option value="AMOUNT">Fixed amount</option>
                    </Select>
                  </Field>

                  {discountType === "PERCENT" ? (
                    <Field
                      label="Percent off"
                      htmlFor="percentOff"
                      error={errors.percentOff?.message}
                    >
                      <div className="relative">
                        <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="percentOff"
                          className="pl-9"
                          type="number"
                          min={1}
                          max={100}
                          {...register("percentOff")}
                        />
                      </div>
                    </Field>
                  ) : (
                    <>
                      <Field
                        label="Amount"
                        htmlFor="amountMajor"
                        error={errors.amountMajor?.message}
                      >
                        <div className="relative">
                          <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="amountMajor"
                            className="pl-9"
                            type="number"
                            step="0.01"
                            min={0}
                            {...register("amountMajor")}
                          />
                        </div>
                      </Field>
                      <Field
                        className="sm:col-span-2"
                        label="Currency"
                        htmlFor="currency"
                        error={errors.currency?.message}
                      >
                        <Select id="currency" {...register("currency")}>
                          {SUPPORTED_CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </>
                  )}
                </div>
              </FormSection>

              <FormSection
                icon={Users}
                title="Limits"
                description="Optional expiry and redemption cap."
                tone="green"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Max redemptions"
                    htmlFor="maxRedemptions"
                    hint="Leave blank for unlimited"
                  >
                    <Input
                      id="maxRedemptions"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      {...register("maxRedemptions")}
                    />
                  </Field>
                  <Field label="Expires at" htmlFor="expiresAt" hint="Optional">
                    <div className="relative">
                      <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="expiresAt"
                        className="pl-9"
                        type="datetime-local"
                        {...register("expiresAt")}
                      />
                    </div>
                  </Field>
                </div>
              </FormSection>

              {editingId ? (
                <FormSection
                  icon={Power}
                  title="Status"
                  description="Inactive codes cannot be redeemed."
                  tone="amber"
                >
                  <Field label="Active" htmlFor="active">
                    <Select
                      id="active"
                      value={activeValue ? "true" : "false"}
                      onChange={(e) =>
                        setValue("active", e.target.value === "true", { shouldValidate: true })
                      }
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Select>
                  </Field>
                </FormSection>
              ) : null}

              {formError ? <Alert variant="danger">{formError}</Alert> : null}

              <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="shadow-volt">
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create coupon"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete coupon?"
        description={
          <>
            This permanently removes <strong className="font-mono">{deleteTarget?.code}</strong>.
            Past redemptions stay in payment history.
          </>
        }
        error={
          deleteCoupon.isError
            ? apiErrorMessage(deleteCoupon.error, "Could not delete coupon.")
            : null
        }
        pending={deleteCoupon.isPending}
        disabled={!deleteTarget}
        onConfirm={() => deleteTarget && deleteCoupon.mutate(deleteTarget.id)}
      />
    </div>
  );
}
