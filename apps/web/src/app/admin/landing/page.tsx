"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, Plus, Save, Trash2, Youtube } from "lucide-react";
import type { LandingPageView } from "@volt/types";
import { landingPageUpdateSchema } from "@volt/validation";
import { api, apiErrorMessage } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";

interface FormState {
  heroYoutubeUrl: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroHeadlineAccent: string;
  heroSubcopy: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  stats: Array<{ value: string; label: string }>;
  closingHeadline: string;
  closingSubcopy: string;
  closingCtaLabel: string;
  closingCtaHref: string;
}

function fromPayload(data: LandingPageView): FormState {
  return {
    heroYoutubeUrl: `https://www.youtube.com/watch?v=${data.heroYoutubeId}`,
    heroEyebrow: data.heroEyebrow,
    heroHeadline: data.heroHeadline,
    heroHeadlineAccent: data.heroHeadlineAccent ?? "",
    heroSubcopy: data.heroSubcopy,
    ctaPrimaryLabel: data.ctaPrimaryLabel,
    ctaPrimaryHref: data.ctaPrimaryHref,
    ctaSecondaryLabel: data.ctaSecondaryLabel,
    ctaSecondaryHref: data.ctaSecondaryHref,
    stats: data.stats.map((s) => ({ ...s })),
    closingHeadline: data.closingHeadline,
    closingSubcopy: data.closingSubcopy,
    closingCtaLabel: data.closingCtaLabel,
    closingCtaHref: data.closingCtaHref,
  };
}

export default function AdminLandingPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "landing"],
    queryFn: () => api.get<LandingPageView>("/landing/admin"),
  });

  useEffect(() => {
    if (query.data) setForm(fromPayload(query.data));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (payload: FormState) => {
      const body = {
        heroYoutubeUrl: payload.heroYoutubeUrl.trim(),
        heroEyebrow: payload.heroEyebrow.trim(),
        heroHeadline: payload.heroHeadline.trim(),
        heroHeadlineAccent: payload.heroHeadlineAccent.trim() || null,
        heroSubcopy: payload.heroSubcopy.trim(),
        ctaPrimaryLabel: payload.ctaPrimaryLabel.trim(),
        ctaPrimaryHref: payload.ctaPrimaryHref.trim(),
        ctaSecondaryLabel: payload.ctaSecondaryLabel.trim(),
        ctaSecondaryHref: payload.ctaSecondaryHref.trim(),
        stats: payload.stats
          .map((s) => ({ value: s.value.trim(), label: s.label.trim() }))
          .filter((s) => s.value && s.label),
        closingHeadline: payload.closingHeadline.trim(),
        closingSubcopy: payload.closingSubcopy.trim(),
        closingCtaLabel: payload.closingCtaLabel.trim(),
        closingCtaHref: payload.closingCtaHref.trim(),
      };
      const parsed = landingPageUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid form");
      }
      return api.patch<LandingPageView>("/landing/admin", parsed.data);
    },
    onSuccess: async (data) => {
      setFormError(null);
      setForm(fromPayload(data));
      setSavedFlash(true);
      await queryClient.invalidateQueries({ queryKey: ["admin", "landing"] });
      await queryClient.invalidateQueries({ queryKey: ["landing"] });
      window.setTimeout(() => setSavedFlash(false), 2200);
    },
    onError: (err) => {
      setFormError(apiErrorMessage(err, err instanceof Error ? err.message : "Could not save"));
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Catalogue
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Landing page</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Update hero copy, intro video, highlight chips, and the closing CTA shown on the public
            home page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {query.data ? (
            <Badge>Updated {formatDate(query.data.updatedAt)}</Badge>
          ) : null}
          <Button
            variant="primary"
            disabled={!form || save.isPending}
            onClick={() => form && save.mutate(form)}
          >
            <Save className="h-4 w-4" aria-hidden />
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {formError ? <Alert variant="danger">{formError}</Alert> : null}
      {savedFlash ? <Alert variant="volt">Landing page saved.</Alert> : null}

      {query.isLoading || !form ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt/12 text-volt-dim">
                  <Youtube className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">Hero video</p>
                  <p className="text-xs text-muted-foreground">YouTube URL or video id</p>
                </div>
              </div>
              <Field label="YouTube link" htmlFor="heroYoutubeUrl">
                <Input
                  id="heroYoutubeUrl"
                  value={form.heroYoutubeUrl}
                  onChange={(e) => update("heroYoutubeUrl", e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Video autoplays muted (browser rule), then visitors tap “Tap for sound” for audio.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt/12 text-volt-dim">
                  <LayoutTemplate className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">Hero copy</p>
                  <p className="text-xs text-muted-foreground">Headline + supporting text</p>
                </div>
              </div>
              <Field label="Eyebrow" htmlFor="heroEyebrow">
                <Input
                  id="heroEyebrow"
                  value={form.heroEyebrow}
                  onChange={(e) => update("heroEyebrow", e.target.value)}
                />
              </Field>
              <Field label="Headline" htmlFor="heroHeadline">
                <Input
                  id="heroHeadline"
                  value={form.heroHeadline}
                  onChange={(e) => update("heroHeadline", e.target.value)}
                />
              </Field>
              <Field label="Headline accent" htmlFor="heroHeadlineAccent" hint="Optional crimson span">
                <Input
                  id="heroHeadlineAccent"
                  value={form.heroHeadlineAccent}
                  onChange={(e) => update("heroHeadlineAccent", e.target.value)}
                />
              </Field>
              <Field label="Subcopy" htmlFor="heroSubcopy">
                <Textarea
                  id="heroSubcopy"
                  rows={4}
                  value={form.heroSubcopy}
                  onChange={(e) => update("heroSubcopy", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <p className="font-semibold">Hero CTAs</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Primary label" htmlFor="ctaPrimaryLabel">
                  <Input
                    id="ctaPrimaryLabel"
                    value={form.ctaPrimaryLabel}
                    onChange={(e) => update("ctaPrimaryLabel", e.target.value)}
                  />
                </Field>
                <Field label="Primary link" htmlFor="ctaPrimaryHref">
                  <Input
                    id="ctaPrimaryHref"
                    value={form.ctaPrimaryHref}
                    onChange={(e) => update("ctaPrimaryHref", e.target.value)}
                  />
                </Field>
                <Field label="Secondary label" htmlFor="ctaSecondaryLabel">
                  <Input
                    id="ctaSecondaryLabel"
                    value={form.ctaSecondaryLabel}
                    onChange={(e) => update("ctaSecondaryLabel", e.target.value)}
                  />
                </Field>
                <Field label="Secondary link" htmlFor="ctaSecondaryHref">
                  <Input
                    id="ctaSecondaryHref"
                    value={form.ctaSecondaryHref}
                    onChange={(e) => update("ctaSecondaryHref", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Highlight chips</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={form.stats.length >= 8}
                  onClick={() =>
                    update("stats", [...form.stats, { value: "New", label: "Label" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {form.stats.map((stat, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <Field label="Value" htmlFor={`stat-v-${index}`}>
                      <Input
                        id={`stat-v-${index}`}
                        value={stat.value}
                        onChange={(e) => {
                          const next = [...form.stats];
                          next[index] = { ...stat, value: e.target.value };
                          update("stats", next);
                        }}
                      />
                    </Field>
                    <Field label="Label" htmlFor={`stat-l-${index}`}>
                      <Input
                        id={`stat-l-${index}`}
                        value={stat.label}
                        onChange={(e) => {
                          const next = [...form.stats];
                          next[index] = { ...stat, label: e.target.value };
                          update("stats", next);
                        }}
                      />
                    </Field>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="mb-0.5"
                      disabled={form.stats.length <= 1}
                      onClick={() => update("stats", form.stats.filter((_, i) => i !== index))}
                      aria-label="Remove chip"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="space-y-4 p-5">
              <p className="font-semibold">Closing CTA</p>
              <Field label="Headline" htmlFor="closingHeadline">
                <Input
                  id="closingHeadline"
                  value={form.closingHeadline}
                  onChange={(e) => update("closingHeadline", e.target.value)}
                />
              </Field>
              <Field label="Subcopy" htmlFor="closingSubcopy">
                <Textarea
                  id="closingSubcopy"
                  rows={3}
                  value={form.closingSubcopy}
                  onChange={(e) => update("closingSubcopy", e.target.value)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Button label" htmlFor="closingCtaLabel">
                  <Input
                    id="closingCtaLabel"
                    value={form.closingCtaLabel}
                    onChange={(e) => update("closingCtaLabel", e.target.value)}
                  />
                </Field>
                <Field label="Button link" htmlFor="closingCtaHref">
                  <Input
                    id="closingCtaHref"
                    value={form.closingCtaHref}
                    onChange={(e) => update("closingCtaHref", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
