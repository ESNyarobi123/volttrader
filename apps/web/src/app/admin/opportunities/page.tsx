"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Search,
  Sparkles,
  ShieldAlert,
  Rocket,
  PauseCircle,
  Lock,
  FileEdit,
  Type,
  Link2,
  AlignLeft,
  Wallet,
  CalendarDays,
  Gauge,
  Scale,
  ScrollText,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import {
  OpportunityStatus,
  RiskCategory,
  CURRENCY_MINOR_UNITS,
  SUPPORTED_CURRENCIES,
  type Currency,
  type OpportunityStatus as OpportunityStatusType,
} from "@volt/config";
import { currencySchema } from "@volt/validation";
import type { OpportunityDetail } from "@volt/types";
import { api, ApiRequestError } from "@/lib/api";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { ProjectionDisclaimer } from "@/components/shared/compliance-note";
import { formatMoney, toMinorUnits } from "@/lib/format";
import { statusVariant, riskVariant, humanize, PROJECTION_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

const opportunityFormSchema = z.object({
  name: z.string().min(3).max(160),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  summary: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  currency: currencySchema,
  minAmountMajor: z.coerce.number().positive(),
  maxAmountMajor: z.string().optional(),
  durationDays: z.coerce.number().int().positive(),
  projectionMultiplier: z.coerce.number().positive().max(1000),
  projectionLabel: z.enum(["PROJECTED_OUTCOME", "TARGET_PERFORMANCE", "HISTORICAL_PERFORMANCE"]),
  riskCategory: z.nativeEnum(RiskCategory),
  riskDisclosure: z.string().min(20, "A risk disclosure is required"),
  terms: z.string().min(20, "Terms are required"),
  status: z.nativeEnum(OpportunityStatus).optional(),
});
type OpportunityFormInput = z.infer<typeof opportunityFormSchema>;

type StatusFilter = "ALL" | OpportunityStatusType;
type RiskFilter = "ALL" | (typeof RiskCategory)[keyof typeof RiskCategory];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
}

function fromMinor(amount: number, currency: Currency) {
  const minor = CURRENCY_MINOR_UNITS[currency] ?? 100;
  return amount / minor;
}

const emptyDefaults: OpportunityFormInput = {
  name: "",
  slug: "",
  summary: "",
  description: "",
  currency: "TZS",
  minAmountMajor: 100000,
  maxAmountMajor: "",
  durationDays: 30,
  projectionMultiplier: 1.5,
  projectionLabel: "PROJECTED_OUTCOME",
  riskCategory: RiskCategory.MEDIUM,
  riskDisclosure:
    "Capital is at risk. Projected outcomes are illustrative targets only and are never guaranteed. Past performance does not predict future results.",
  terms:
    "By investing you acknowledge the risk disclosure, accept that projections are not guarantees, and agree to Volt Trades terms of use.",
  status: OpportunityStatus.DRAFT,
};

export default function AdminOpportunitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OpportunityDetail | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-opportunities"],
    queryFn: () => api.get<OpportunityDetail[]>("/opportunities/admin/all"),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OpportunityFormInput>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: emptyDefaults,
  });

  const nameValue = watch("name");
  const slugValue = watch("slug");
  const summaryValue = watch("summary");
  const currencyValue = watch("currency");
  const minAmountMajor = watch("minAmountMajor");
  const maxAmountMajor = watch("maxAmountMajor");
  const durationDays = watch("durationDays");
  const projectionMultiplier = watch("projectionMultiplier");
  const projectionLabel = watch("projectionLabel");
  const riskCategory = watch("riskCategory");
  const statusValue = watch("status");

  useEffect(() => {
    if (!editorOpen || editingId || slugTouched) return;
    if (nameValue) setValue("slug", slugify(nameValue));
  }, [editorOpen, editingId, slugTouched, nameValue, setValue]);

  const openCreate = () => {
    setEditingId(null);
    setSlugTouched(false);
    reset(emptyDefaults);
    setEditorOpen(true);
  };

  const openEdit = (item: OpportunityDetail) => {
    setEditingId(item.id);
    setSlugTouched(true);
    reset({
      name: item.name,
      slug: item.slug,
      summary: item.summary,
      description: item.description,
      currency: item.currency,
      minAmountMajor: fromMinor(item.minAmount, item.currency),
      maxAmountMajor: item.maxAmount != null ? String(fromMinor(item.maxAmount, item.currency)) : "",
      durationDays: item.durationDays,
      projectionMultiplier: item.projectionMultiplier,
      projectionLabel: item.projectionLabel,
      riskCategory: item.riskCategory,
      riskDisclosure: item.riskDisclosure,
      terms: item.terms,
      status: item.status,
    });
    setEditorOpen(true);
  };

  const createOpportunity = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<OpportunityDetail>("/opportunities", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] });
      setEditorOpen(false);
      reset(emptyDefaults);
    },
  });

  const updateOpportunity = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<OpportunityDetail>(`/opportunities/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] });
      setEditorOpen(false);
      setEditingId(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OpportunityStatusType }) =>
      api.patch(`/opportunities/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] }),
  });

  const deleteOpportunity = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/opportunities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] });
      setDeleteTarget(null);
    },
  });

  const buildPayload = (values: OpportunityFormInput) => {
    const currency = values.currency as Currency;
    return {
      name: values.name,
      slug: values.slug,
      summary: values.summary,
      description: values.description,
      currency: values.currency,
      minAmount: toMinorUnits(values.minAmountMajor, currency),
      maxAmount:
        values.maxAmountMajor && values.maxAmountMajor.trim() !== ""
          ? toMinorUnits(Number(values.maxAmountMajor), currency)
          : undefined,
      durationDays: values.durationDays,
      projectionMultiplier: values.projectionMultiplier,
      projectionLabel: values.projectionLabel,
      riskCategory: values.riskCategory,
      riskDisclosure: values.riskDisclosure,
      terms: values.terms,
      ...(editingId && values.status ? { status: values.status } : {}),
    };
  };

  const onSubmit = (values: OpportunityFormInput) => {
    const payload = buildPayload(values);
    if (editingId) updateOpportunity.mutate({ id: editingId, payload });
    else createOpportunity.mutate(payload);
  };

  const opportunities = data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (riskFilter !== "ALL" && o.riskCategory !== riskFilter) return false;
      if (!term) return true;
      return (
        o.name.toLowerCase().includes(term) ||
        o.slug.toLowerCase().includes(term) ||
        o.summary.toLowerCase().includes(term)
      );
    });
  }, [opportunities, search, statusFilter, riskFilter]);

  const stats = useMemo(
    () => ({
      total: opportunities.length,
      open: opportunities.filter((o) => o.status === "OPEN").length,
      draft: opportunities.filter((o) => o.status === "DRAFT").length,
      closed: opportunities.filter((o) => o.status === "CLOSED" || o.status === "SUSPENDED").length,
    }),
    [opportunities],
  );

  const saving = createOpportunity.isPending || updateOpportunity.isPending || isSubmitting;
  const formError =
    createOpportunity.error instanceof ApiRequestError
      ? createOpportunity.error.message
      : updateOpportunity.error instanceof ApiRequestError
        ? updateOpportunity.error.message
        : createOpportunity.isError || updateOpportunity.isError
          ? "Could not save opportunity."
          : null;

  const previewMin = formatMoney({
    amount: toMinorUnits(Number(minAmountMajor) || 0, (currencyValue as Currency) || "TZS"),
    currency: (currencyValue as Currency) || "TZS",
  });
  const previewMax =
    maxAmountMajor && String(maxAmountMajor).trim() !== ""
      ? formatMoney({
          amount: toMinorUnits(Number(maxAmountMajor) || 0, (currencyValue as Currency) || "TZS"),
          currency: (currencyValue as Currency) || "TZS",
        })
      : null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_10%_0%,hsl(350_73%_44%/0.18),transparent_60%),radial-gradient(45%_70%_at_90%_0%,hsl(0_0%_10%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Trading Floor
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Opportunities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, open, suspend, close and delete investment opportunities.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          New opportunity
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip icon={TrendingUp} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Rocket} label="Open" value={stats.open} tone="green" />
        <StatChip icon={FileEdit} label="Drafts" value={stats.draft} tone="blue" />
        <StatChip icon={Lock} label="Closed / Suspended" value={stats.closed} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(0_0%_10%/0.08)] shadow-card">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]" />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, slug or summary…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="ALL">All statuses</option>
              {Object.values(OpportunityStatus).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-44">
            <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}>
              <option value="ALL">All risk levels</option>
              {Object.values(RiskCategory).map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
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
          {error instanceof ApiRequestError ? error.message : "Could not load opportunities."}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={opportunities.length === 0 ? "No opportunities yet" : "No matches"}
          description={
            opportunities.length === 0
              ? "Create your first Trading Floor opportunity."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
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
                      <Badge variant={statusVariant(item.status)}>{humanize(item.status)}</Badge>
                      <Badge variant={riskVariant(item.riskCategory)}>{humanize(item.riskCategory)}</Badge>
                    </div>
                    <h2 className="truncate text-lg font-bold tracking-tight">{item.name}</h2>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /{item.slug}
                    </p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(0_0%_10%/0.2)] text-volt-dim">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-surface-2/50 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Projection</p>
                    <p className="font-semibold">
                      ×{item.projectionMultiplier} · {PROJECTION_LABELS[item.projectionLabel]}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-semibold">{item.durationDays} days</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Ticket size</p>
                    <p className="font-semibold">
                      {formatMoney({ amount: item.minAmount, currency: item.currency })}
                      {item.maxAmount != null
                        ? ` – ${formatMoney({ amount: item.maxAmount, currency: item.currency })}`
                        : " +"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {item.status !== "OPEN" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: item.id, status: "OPEN" })}
                    >
                      <Rocket className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: item.id, status: "SUSPENDED" })}
                    >
                      <PauseCircle className="h-3.5 w-3.5" />
                      Suspend
                    </Button>
                  )}
                  {item.status !== "CLOSED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: item.id, status: "CLOSED" })}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Close
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="danger"
                    className="ml-auto"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditorOpen(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.18)] px-6 pb-5 pt-6">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-volt/35 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[hsl(0_0%_10%/0.28)] blur-3xl" />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  {editingId ? <Pencil className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Trading Floor
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {editingId ? "Edit opportunity" : "Create opportunity"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Projections are configurable targets — never guarantees.
                  </DialogDescription>
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant={riskVariant(riskCategory || "MEDIUM")}>
                        {humanize(riskCategory || "MEDIUM")}
                      </Badge>
                      {editingId && statusValue ? (
                        <Badge variant={statusVariant(statusValue)}>{humanize(statusValue)}</Badge>
                      ) : (
                        <Badge variant="warning">Draft</Badge>
                      )}
                      <Badge variant="volt">×{projectionMultiplier || 1}</Badge>
                    </div>
                    <p className="truncate text-lg font-bold tracking-tight">
                      {nameValue?.trim() || "Untitled opportunity"}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /{slugValue?.trim() || "opportunity-slug"}
                    </p>
                    <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                      {summaryValue?.trim() || "Summary preview appears here."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ticket
                    </p>
                    <p className="text-sm font-bold text-volt-dim">
                      {previewMin}
                      {previewMax ? ` – ${previewMax}` : "+"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{durationDays || 0} days</p>
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="max-h-[min(62vh,560px)] space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <ProjectionDisclaimer />

              <FormSection icon={Type} title="Basics" description="Name, URL and risk band." tone="gold">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2" label="Name" htmlFor="name" error={errors.name?.message}>
                    <Input id="name" placeholder="Growth Pool Alpha" {...register("name")} />
                  </Field>
                  <Field label="Slug" htmlFor="slug" error={errors.slug?.message}>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="slug"
                        className="pl-9 font-mono text-sm"
                        placeholder="growth-pool-alpha"
                        {...register("slug")}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setValue("slug", e.target.value, { shouldValidate: true });
                        }}
                      />
                    </div>
                  </Field>
                  <Field label="Risk category" htmlFor="riskCategory">
                    <Select id="riskCategory" {...register("riskCategory")}>
                      {Object.values(RiskCategory).map((r) => (
                        <option key={r} value={r}>
                          {humanize(r)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </FormSection>

              <FormSection icon={AlignLeft} title="Story" description="Public summary and full copy." tone="blue">
                <div className="grid gap-4">
                  <Field label="Summary" htmlFor="summary" hint="Card one-liner" error={errors.summary?.message}>
                    <Input id="summary" {...register("summary")} />
                  </Field>
                  <Field label="Full description" htmlFor="description" error={errors.description?.message}>
                    <Textarea id="description" rows={4} {...register("description")} />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={Wallet}
                title="Capital & projection"
                description="Ticket size, duration and target multiplier."
                tone="green"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Currency" htmlFor="currency">
                    <Select id="currency" {...register("currency")}>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Duration (days)" htmlFor="durationDays" error={errors.durationDays?.message}>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="durationDays" className="pl-9" type="number" min={1} {...register("durationDays")} />
                    </div>
                  </Field>
                  <Field label="Minimum amount" htmlFor="minAmountMajor" error={errors.minAmountMajor?.message}>
                    <Input id="minAmountMajor" type="number" step="0.01" min={0} {...register("minAmountMajor")} />
                  </Field>
                  <Field label="Maximum amount (optional)" htmlFor="maxAmountMajor">
                    <Input id="maxAmountMajor" type="number" step="0.01" min={0} {...register("maxAmountMajor")} />
                  </Field>
                  <Field
                    label="Projection multiplier"
                    htmlFor="projectionMultiplier"
                    hint="e.g. 1.5 = ×1.5 target"
                    error={errors.projectionMultiplier?.message}
                  >
                    <div className="relative">
                      <Gauge className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="projectionMultiplier"
                        className="pl-9"
                        type="number"
                        step="0.01"
                        min={0}
                        {...register("projectionMultiplier")}
                      />
                    </div>
                  </Field>
                  <Field label="Projection label" htmlFor="projectionLabel">
                    <Select id="projectionLabel" {...register("projectionLabel")}>
                      {Object.entries(PROJECTION_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                    Label preview:{" "}
                    <strong className="text-foreground">
                      {PROJECTION_LABELS[projectionLabel]} ×{projectionMultiplier || 1}
                    </strong>{" "}
                    — never shown as a guaranteed return.
                  </div>
                </div>
              </FormSection>

              <FormSection
                icon={Scale}
                title="Compliance"
                description="Required risk disclosure and terms."
                tone="amber"
              >
                <div className="grid gap-4">
                  <Field
                    label="Risk disclosure"
                    htmlFor="riskDisclosure"
                    error={errors.riskDisclosure?.message}
                  >
                    <div className="relative">
                      <ShieldAlert className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea id="riskDisclosure" className="pl-9" rows={3} {...register("riskDisclosure")} />
                    </div>
                  </Field>
                  <Field label="Terms" htmlFor="terms" error={errors.terms?.message}>
                    <div className="relative">
                      <ScrollText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea id="terms" className="pl-9" rows={3} {...register("terms")} />
                    </div>
                  </Field>
                </div>
              </FormSection>

              {editingId ? (
                <FormSection
                  icon={CircleDot}
                  title="Publishing"
                  description="Control Trading Floor visibility."
                  tone="amber"
                >
                  <Field label="Status" htmlFor="status">
                    <Select id="status" {...register("status")}>
                      {Object.values(OpportunityStatus).map((s) => (
                        <option key={s} value={s}>
                          {humanize(s)}
                        </option>
                      ))}
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
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create opportunity"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent
          className="max-w-md overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-danger/30 bg-surface shadow-lift">
            <div className="border-b border-danger/20 bg-gradient-to-br from-danger/15 via-surface to-warning/10 px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger/15 text-danger">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle>Delete opportunity?</DialogTitle>
                  <DialogDescription className="mt-1">
                    This permanently removes <strong>{deleteTarget?.name}</strong>. Opportunities with
                    investments cannot be deleted — close or suspend them instead.
                  </DialogDescription>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {deleteOpportunity.isError ? (
                <Alert variant="danger">
                  {deleteOpportunity.error instanceof ApiRequestError
                    ? deleteOpportunity.error.message
                    : "Could not delete opportunity."}
                </Alert>
              ) : null}
              <DialogFooter className="mt-0">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteOpportunity.isPending || !deleteTarget}
                  onClick={() => deleteTarget && deleteOpportunity.mutate(deleteTarget.id)}
                >
                  {deleteOpportunity.isPending ? "Deleting…" : "Delete permanently"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: number;
  tone: "gold" | "green" | "blue" | "ink";
}) {
  const tones = {
    gold: "border-volt/30 from-volt/20",
    green: "border-success/30 from-success/15",
    blue: "border-[hsl(var(--accent-blue)/0.3)] from-[hsl(var(--accent-blue)/0.14)]",
    ink: "border-border from-surface-2",
  } as const;
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br via-surface to-surface p-4 shadow-card", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-volt-dim" />
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function FormSection({
  icon: Icon,
  title,
  description,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: "gold" | "blue" | "green" | "amber";
  children: ReactNode;
}) {
  const tones = {
    gold: {
      shell: "border-volt/25 from-volt/10",
      bar: "from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]",
      icon: "bg-volt/20 text-volt-dim",
    },
    blue: {
      shell: "border-[hsl(var(--accent-blue)/0.25)] from-[hsl(var(--accent-blue)/0.1)]",
      bar: "from-[hsl(0_0%_10%)] via-[hsl(349_74%_36%)] to-[hsl(142_65%_32%)]",
      icon: "bg-[hsl(var(--accent-blue)/0.15)] text-[hsl(var(--accent-blue))]",
    },
    green: {
      shell: "border-success/25 from-success/10",
      bar: "from-success via-[hsl(142_65%_29%)] to-volt",
      icon: "bg-success/15 text-success",
    },
    amber: {
      shell: "border-warning/30 from-warning/10",
      bar: "from-warning via-volt to-[hsl(30_10%_28%)]",
      icon: "bg-warning/15 text-[hsl(var(--warning))]",
    },
  } as const;
  const t = tones[tone];
  return (
    <section className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br via-surface to-surface p-4", t.shell)}>
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />
      <div className="mb-4 flex items-start gap-3">
        <span className={cn("mt-0.5 grid h-9 w-9 place-items-center rounded-xl", t.icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
