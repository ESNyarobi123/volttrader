"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Star,
  Eye,
  EyeOff,
} from "lucide-react";
import { SUPPORTED_CURRENCIES, type Currency, DEFAULT_CURRENCY} from "@volt/config";
import { currencySchema } from "@volt/validation";
import type { CoursePlanView } from "@volt/types";
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

const formSchema = z.object({
  name: z.string().min(2).max(80),
  subtitle: z.string().min(2).max(160),
  amountMajor: z.coerce.number().min(0),
  currency: currencySchema,
  billingPeriod: z.enum(["month", "year", "once"]),
  featuresText: z.string().min(1, "Add at least one feature (one per line)"),
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
  amountMajor: 0,
  currency: DEFAULT_CURRENCY,
  billingPeriod: "month",
  featuresText: "",
  ctaLabel: "Get Started",
  ctaHref: "/register",
  featured: false,
  sortOrder: 0,
  published: true,
};

export default function AdminCoursePlansPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoursePlanView | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["admin-course-plans"],
    queryFn: () => api.get<CoursePlanView[]>("/course-plans/admin/all"),
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

  function openEdit(plan: CoursePlanView) {
    setEditingId(plan.id);
    setFormError(null);
    form.reset({
      name: plan.name,
      subtitle: plan.subtitle,
      amountMajor: fromMinorUnits(plan.price.amount, plan.price.currency),
      currency: plan.price.currency,
      billingPeriod: plan.billingPeriod,
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
        price: {
          amount: toMinorUnits(values.amountMajor, values.currency),
          currency: values.currency,
        },
        billingPeriod: values.billingPeriod,
        features,
        ctaLabel: values.ctaLabel,
        ctaHref: values.ctaHref,
        featured: values.featured,
        sortOrder: values.sortOrder,
        published: values.published,
      };
      if (editingId) {
        return api.patch<CoursePlanView>(`/course-plans/${editingId}`, payload);
      }
      return api.post<CoursePlanView>("/course-plans", payload);
    },
    onSuccess: async () => {
      setEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-course-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["home", "course-plans"] });
    },
    onError: (err) => {
      setFormError(apiErrorMessage(err, "Could not save plan"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/course-plans/${id}`),
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-course-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["home", "course-plans"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-volt/25 bg-gradient-to-br from-volt/15 via-surface to-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
              <GraduationCap className="h-3.5 w-3.5" />
              Forex Academy
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Forex course plans
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Create up to four (or more) pricing cards for the landing page. Published plans appear
              under “Choose the perfect Forex course plan”.
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
          title="No course plans yet"
          description="Add your first Forex course pricing plan for the landing page."
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
                <p className="font-display text-2xl font-bold">
                  {plan.price.amount <= 0 ? "Free" : formatMoney(plan.price)}
                  {plan.price.amount > 0 ? (
                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      /{plan.billingPeriod === "once" ? "once" : plan.billingPeriod}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.features.length} features · order {plan.sortOrder}
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
          <DialogTitle>{editingId ? "Edit course plan" : "New course plan"}</DialogTitle>
          <DialogDescription>
            These cards show on the public homepage. Set price to 0 for Free.
          </DialogDescription>
          <form
            className="mt-4 space-y-4"
            onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
          >
            {formError ? <Alert variant="danger">{formError}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Plan name</Label>
                <Input id="name" {...form.register("name")} placeholder="Pro" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  {...form.register("subtitle")}
                  placeholder="Best for serious traders"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountMajor">Price (major units)</Label>
                <Input
                  id="amountMajor"
                  type="number"
                  min={0}
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
                <Label htmlFor="billingPeriod">Billing</Label>
                <Select id="billingPeriod" {...form.register("billingPeriod")}>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="once">One-time</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort order</Label>
                <Input id="sortOrder" type="number" {...form.register("sortOrder")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="featuresText">Features (one per line)</Label>
                <Textarea
                  id="featuresText"
                  rows={6}
                  {...form.register("featuresText")}
                  placeholder={"All Essential benefits\nLive session recordings"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctaLabel">CTA label</Label>
                <Input id="ctaLabel" {...form.register("ctaLabel")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctaHref">CTA link</Label>
                <Input id="ctaHref" {...form.register("ctaHref")} placeholder="/register" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...form.register("featured")} className="rounded border-border" />
                Featured (highlighted card)
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
            “{deleteTarget?.name}” will be removed from the landing page immediately.
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
