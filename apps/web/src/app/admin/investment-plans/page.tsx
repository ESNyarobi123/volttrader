"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  LineChart,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Star,
  Eye,
  EyeOff,
} from "lucide-react";
import { RiskCategory, SUPPORTED_CURRENCIES, type Currency } from "@volt/config";
import { currencySchema } from "@volt/validation";
import type { InvestmentPlanView } from "@volt/types";
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
import { formatMoney, fromMinorUnits, linesFromText, toMinorUnits } from "@/lib/format";
import { cn } from "@/lib/utils";

const projectionLabels = [
  "PROJECTED_OUTCOME",
  "TARGET_PERFORMANCE",
  "HISTORICAL_PERFORMANCE",
] as const;

const formSchema = z.object({
  name: z.string().min(2).max(80),
  subtitle: z.string().min(2).max(160),
  amountMajor: z.coerce.number().positive(),
  currency: currencySchema,
  durationDays: z.coerce.number().int().positive().max(3650),
  projectionLabel: z.enum(projectionLabels),
  projectionHighlight: z.string().min(1).max(80),
  riskCategory: z.nativeEnum(RiskCategory),
  featuresText: z.string().min(1, "Add at least one gain/feature (one per line)"),
  ctaLabel: z.string().min(2).max(60),
  ctaHref: z.string().min(1).max(200),
  featured: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  published: z.boolean(),
});
type FormInput = z.infer<typeof formSchema>;

const emptyDefaults: FormInput = {
  name: "",
  subtitle: "",
  amountMajor: 100000,
  currency: "TZS",
  durationDays: 60,
  projectionLabel: "TARGET_PERFORMANCE",
  projectionHighlight: "2.0× target",
  riskCategory: "MEDIUM",
  featuresText: "",
  ctaLabel: "Explore floor",
  ctaHref: "/trading-floor",
  featured: false,
  sortOrder: 0,
  published: true,
};

export default function AdminInvestmentPlansPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvestmentPlanView | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-investment-plans"],
    queryFn: () => api.get<InvestmentPlanView[]>("/investment-plans/admin/all"),
  });

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  const plans = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  function openCreate() {
    setEditingId(null);
    setFormError(null);
    form.reset({ ...emptyDefaults, sortOrder: plans.length });
    setEditorOpen(true);
  }

  function openEdit(plan: InvestmentPlanView) {
    setEditingId(plan.id);
    setFormError(null);
    form.reset({
      name: plan.name,
      subtitle: plan.subtitle,
      amountMajor: fromMinorUnits(plan.minAmount.amount, plan.minAmount.currency),
      currency: plan.minAmount.currency,
      durationDays: plan.durationDays,
      projectionLabel: plan.projectionLabel,
      projectionHighlight: plan.projectionHighlight,
      riskCategory: plan.riskCategory,
      featuresText: plan.features.join("\n"),
      ctaLabel: plan.ctaLabel,
      ctaHref: plan.ctaHref,
      featured: plan.featured,
      sortOrder: plan.sortOrder,
      published: plan.published,
    });
    setEditorOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormInput) => {
      const features = linesFromText(values.featuresText);
      if (features.length === 0) throw new Error("Add at least one feature");
      const payload = {
        name: values.name,
        subtitle: values.subtitle,
        minAmount: {
          amount: toMinorUnits(values.amountMajor, values.currency),
          currency: values.currency,
        },
        durationDays: values.durationDays,
        projectionLabel: values.projectionLabel,
        projectionHighlight: values.projectionHighlight,
        riskCategory: values.riskCategory,
        features,
        ctaLabel: values.ctaLabel,
        ctaHref: values.ctaHref,
        featured: values.featured,
        sortOrder: values.sortOrder,
        published: values.published,
      };
      if (editingId) {
        return api.patch<InvestmentPlanView>(`/investment-plans/${editingId}`, payload);
      }
      return api.post<InvestmentPlanView>("/investment-plans", payload);
    },
    onSuccess: async () => {
      setEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-investment-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["home", "investment-plans"] });
    },
    onError: (err) => {
      setFormError(apiErrorMessage(err, "Could not save plan"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/investment-plans/${id}`),
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-investment-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["home", "investment-plans"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-volt/25 bg-gradient-to-br from-volt/15 via-surface to-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
              <LineChart className="h-3.5 w-3.5" />
              Trading Floor
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Investment plans
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Landing-page investment tiers (features + what you gain). Use Target / Projected /
              Historical labels only — never guaranteed returns.
            </p>
          </div>
          <Button onClick={openCreate} className="shadow-volt">
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No investment plans yet"
          description="Add pricing-style investment cards for the landing page."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add plan
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "overflow-hidden",
                plan.featured && "border-volt/40 shadow-[0_12px_28px_-16px_hsl(var(--volt)/0.45)]",
              )}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold">{plan.name}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{plan.subtitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {plan.featured ? (
                      <Badge className="bg-volt/15 text-volt-dim">
                        <Star className="mr-1 h-3 w-3" />
                        Featured
                      </Badge>
                    ) : null}
                    <Badge variant={plan.published ? "success" : "warning"}>
                      {plan.published ? (
                        <>
                          <Eye className="mr-1 h-3 w-3" /> Live
                        </>
                      ) : (
                        <>
                          <EyeOff className="mr-1 h-3 w-3" /> Draft
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
                <p className="font-display text-xl font-bold">
                  From {formatMoney(plan.minAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.projectionHighlight} · {plan.durationDays}d · {plan.riskCategory}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.features.length} gains · order {plan.sortOrder}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(plan)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>{editingId ? "Edit investment plan" : "New investment plan"}</DialogTitle>
          <DialogDescription>
            Cards appear on the homepage. Projection text is a target — never a guarantee.
          </DialogDescription>
          <form
            className="mt-4 space-y-4"
            onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
          >
            {formError ? <Alert variant="danger">{formError}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Plan name</Label>
                <Input id="name" {...form.register("name")} placeholder="Velocity" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  {...form.register("subtitle")}
                  placeholder="Best for active capital managers"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountMajor">Min entry (major)</Label>
                <Input
                  id="amountMajor"
                  type="number"
                  min={1}
                  step="any"
                  {...form.register("amountMajor")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select id="currency" {...form.register("currency")}>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="durationDays">Duration (days)</Label>
                <Input id="durationDays" type="number" {...form.register("durationDays")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="riskCategory">Risk</Label>
                <Select id="riskCategory" {...form.register("riskCategory")}>
                  {Object.values(RiskCategory).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="projectionLabel">Projection label</Label>
                <Select id="projectionLabel" {...form.register("projectionLabel")}>
                  <option value="PROJECTED_OUTCOME">Projected Outcome</option>
                  <option value="TARGET_PERFORMANCE">Target Performance</option>
                  <option value="HISTORICAL_PERFORMANCE">Historical Performance</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="projectionHighlight">Highlight</Label>
                <Input
                  id="projectionHighlight"
                  {...form.register("projectionHighlight")}
                  placeholder="2.5× target"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="featuresText">What you will gain (one per line)</Label>
                <Textarea
                  id="featuresText"
                  rows={6}
                  {...form.register("featuresText")}
                  placeholder={"Ledger-tracked funding\nPortfolio status tracking"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctaLabel">CTA label</Label>
                <Input id="ctaLabel" {...form.register("ctaLabel")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctaHref">CTA link</Label>
                <Input id="ctaHref" {...form.register("ctaHref")} placeholder="/trading-floor" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort order</Label>
                <Input id="sortOrder" type="number" {...form.register("sortOrder")} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...form.register("featured")} className="rounded border-border" />
                Featured card
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...form.register("published")} className="rounded border-border" />
                Published on landing
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="shadow-volt">
                {saveMutation.isPending ? "Saving…" : editingId ? "Save changes" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogTitle>Delete plan?</DialogTitle>
          <DialogDescription>
            “{deleteTarget?.name}” will disappear from the landing page.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
