"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  Search,
  Sparkles,
  Rocket,
  FileEdit,
  CheckCircle2,
  Clock3,
  Type,
  Link2,
  AlignLeft,
  Tags,
  CircleDot,
  ListChecks,
  } from "lucide-react";
import { ProjectCategory, ProjectStatus, type ProjectStatus as ProjectStatusType } from "@volt/config";
import type { ProjectView } from "@volt/types";
import { ApiRequestError, api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { statusVariant, humanize } from "@/lib/status";
import { StatChip } from "@/components/ui/stat-chip";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { slugify } from "@/lib/format";

const projectFormSchema = z.object({
  title: z.string().min(3).max(160),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase kebab-case only"),
  category: z.nativeEnum(ProjectCategory),
  status: z.nativeEnum(ProjectStatus),
  summary: z.string().min(2).max(500),
  description: z.string().min(2).max(5000),
  milestonesText: z.string().max(4000).optional(),
  order: z.coerce.number().int().min(0).optional(),
});
type ProjectFormInput = z.infer<typeof projectFormSchema>;

type StatusFilter = "ALL" | ProjectStatusType;
type CategoryFilter = "ALL" | (typeof ProjectCategory)[keyof typeof ProjectCategory];

function parseMilestones(text?: string) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const done = /^\[x\]\s+/i.test(line);
      const title = line.replace(/^\[([ xX])\]\s+/, "").trim();
      return { title, done };
    })
    .filter((m) => m.title.length > 0);
}

function formatMilestones(milestones: { title: string; done: boolean }[]) {
  return milestones.map((m) => (m.done ? `[x] ${m.title}` : m.title)).join("\n");
}

const emptyDefaults: ProjectFormInput = {
  title: "",
  slug: "",
  category: ProjectCategory.COMMUNITY,
  status: ProjectStatus.PLANNED,
  summary: "",
  description: "",
  milestonesText: "",
  order: 0,
};

export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectView | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: () => api.get<ProjectView[]>("/projects"),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: emptyDefaults,
  });

  const titleValue = watch("title");
  const slugValue = watch("slug");
  const summaryValue = watch("summary");
  const categoryValue = watch("category");
  const statusValue = watch("status");
  const milestonesText = watch("milestonesText");

  useEffect(() => {
    if (!editorOpen || editingId || slugTouched) return;
    if (titleValue) setValue("slug", slugify(titleValue));
  }, [editorOpen, editingId, slugTouched, titleValue, setValue]);

  const openCreate = () => {
    setEditingId(null);
    setSlugTouched(false);
    reset(emptyDefaults);
    setEditorOpen(true);
  };

  const openEdit = (project: ProjectView) => {
    setEditingId(project.id);
    setSlugTouched(true);
    reset({
      title: project.title,
      slug: project.slug,
      category: project.category,
      status: project.status,
      summary: project.summary,
      description: project.description,
      milestonesText: formatMilestones(project.milestones ?? []),
      order: 0,
    });
    setEditorOpen(true);
  };

  const createProject = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<ProjectView>("/projects", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      setEditorOpen(false);
      reset(emptyDefaults);
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<ProjectView>(`/projects/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      setEditorOpen(false);
      setEditingId(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatusType }) =>
      api.patch(`/projects/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-projects"] }),
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      setDeleteTarget(null);
    },
  });

  const onSubmit = (values: ProjectFormInput) => {
    const payload = {
      title: values.title,
      slug: values.slug,
      category: values.category,
      status: values.status,
      summary: values.summary,
      description: values.description,
      milestones: parseMilestones(values.milestonesText),
      order: values.order ?? 0,
    };
    if (editingId) updateProject.mutate({ id: editingId, payload });
    else createProject.mutate(payload);
  };

  const projects = data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        p.title.toLowerCase().includes(term) ||
        p.slug.toLowerCase().includes(term) ||
        p.summary.toLowerCase().includes(term)
      );
    });
  }, [projects, search, statusFilter, categoryFilter]);

  const stats = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === "ACTIVE" || p.status === "IN_DEVELOPMENT").length,
      planned: projects.filter((p) => p.status === "PLANNED" || p.status === "COMING_SOON").length,
      completed: projects.filter((p) => p.status === "COMPLETED").length,
    }),
    [projects],
  );

  const saving = createProject.isPending || updateProject.isPending || isSubmitting;
  const formError =
    createProject.error instanceof ApiRequestError
      ? createProject.error.message
      : updateProject.error instanceof ApiRequestError
        ? updateProject.error.message
        : createProject.isError || updateProject.isError
          ? "Could not save project."
          : null;

  const previewMilestones = parseMilestones(milestonesText);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.18),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(0_0%_10%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Build the Future
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, update status and delete ecosystem roadmap projects.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          New project
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip icon={FolderKanban} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Rocket} label="Active / Building" value={stats.active} tone="green" />
        <StatChip icon={FileEdit} label="Planned" value={stats.planned} tone="blue" />
        <StatChip icon={CheckCircle2} label="Completed" value={stats.completed} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(0_0%_10%/0.08)] shadow-card">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]" />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, slug or summary…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="ALL">All statuses</option>
              {Object.values(ProjectStatus).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-44">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            >
              <option value="ALL">All categories</option>
              {Object.values(ProjectCategory).map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-60 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {apiErrorMessage(error, "Could not load projects.")}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={projects.length === 0 ? "No projects yet" : "No matches"}
          description={
            projects.length === 0
              ? "Create your first ecosystem project."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const doneCount = project.milestones.filter((m) => m.done).length;
            return (
              <article
                key={project.id}
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
                        <Badge variant={statusVariant(project.status)}>{humanize(project.status)}</Badge>
                        <Badge variant="volt">{humanize(project.category)}</Badge>
                      </div>
                      <h2 className="truncate text-lg font-bold tracking-tight">{project.title}</h2>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        /{project.slug}
                      </p>
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(0_0%_10%/0.2)] text-volt-dim">
                      <FolderKanban className="h-5 w-5" />
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">{project.summary}</p>

                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" />
                      Milestones
                    </span>
                    <span className="font-semibold">
                      {doneCount}/{project.milestones.length || 0}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(project)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {project.status !== "ACTIVE" && project.status !== "COMPLETED" ? (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: project.id, status: "ACTIVE" })}
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        Activate
                      </Button>
                    ) : null}
                    {project.status === "ACTIVE" || project.status === "IN_DEVELOPMENT" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: project.id, status: "COMPLETED" })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </Button>
                    ) : null}
                    {project.status === "PLANNED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({ id: project.id, status: "IN_DEVELOPMENT" })
                        }
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        Start build
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="danger"
                      className="ml-auto"
                      onClick={() => setDeleteTarget(project)}
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
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.18)] px-6 pb-5 pt-6">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-volt/35 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[hsl(0_0%_10%/0.28)] blur-3xl" />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  {editingId ? <Pencil className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Ecosystem roadmap
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {editingId ? "Edit project" : "Create project"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Shape what Volt Trades is building next.
                  </DialogDescription>
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant={statusVariant(statusValue || "PLANNED")}>
                        {humanize(statusValue || "PLANNED")}
                      </Badge>
                      <Badge variant="volt">{humanize(categoryValue || "COMMUNITY")}</Badge>
                    </div>
                    <p className="truncate text-lg font-bold tracking-tight">
                      {titleValue?.trim() || "Untitled project"}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /{slugValue?.trim() || "project-slug"}
                    </p>
                    <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                      {summaryValue?.trim() || "Summary preview appears here."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Milestones
                    </p>
                    <p className="text-base font-bold text-volt-dim">{previewMilestones.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="max-h-[min(62vh,560px)] space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <FormSection icon={Type} title="Basics" description="Title, URL and classification." tone="gold">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2" label="Title" htmlFor="title" error={errors.title?.message}>
                    <Input id="title" placeholder="Volt Shop" {...register("title")} />
                  </Field>
                  <Field label="Slug" htmlFor="slug" error={errors.slug?.message}>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="slug"
                        className="pl-9 font-mono text-sm"
                        placeholder="volt-shop"
                        {...register("slug")}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setValue("slug", e.target.value, { shouldValidate: true });
                        }}
                      />
                    </div>
                  </Field>
                  <Field label="Category" htmlFor="category">
                    <div className="relative">
                      <Tags className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select id="category" className="pl-9" {...register("category")}>
                        {Object.values(ProjectCategory).map((c) => (
                          <option key={c} value={c}>
                            {humanize(c)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection icon={AlignLeft} title="Story" description="Public summary and full description." tone="blue">
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
                icon={ListChecks}
                title="Roadmap"
                description="Milestones — prefix with [x] for done."
                tone="green"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status" htmlFor="status">
                    <div className="relative">
                      <CircleDot className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select id="status" className="pl-9" {...register("status")}>
                        {Object.values(ProjectStatus).map((s) => (
                          <option key={s} value={s}>
                            {humanize(s)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </Field>
                  <Field label="Display order" htmlFor="order" hint="Lower shows first">
                    <Input id="order" type="number" min={0} {...register("order")} />
                  </Field>
                  <Field
                    className="sm:col-span-2"
                    label="Milestones"
                    htmlFor="milestonesText"
                    hint="One per line · [x] = done"
                  >
                    <Textarea
                      id="milestonesText"
                      rows={4}
                      placeholder={"Research vendors\n[x] Brand guidelines\nLaunch beta waitlist"}
                      {...register("milestonesText")}
                    />
                  </Field>
                </div>
              </FormSection>

              {formError ? <Alert variant="danger">{formError}</Alert> : null}

              <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="shadow-volt">
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create project"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete project?"
        description={
          <>
            This permanently removes <strong>{deleteTarget?.title}</strong> from the roadmap.
          </>
        }
        error={
          deleteProject.isError
            ? apiErrorMessage(deleteProject.error, "Could not delete project.")
            : null
        }
        pending={deleteProject.isPending}
        disabled={!deleteTarget}
        onConfirm={() => deleteTarget && deleteProject.mutate(deleteTarget.id)}
      />
    </div>
  );
}
