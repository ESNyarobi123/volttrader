"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Search,
  BookOpen,
  Sparkles,
  Archive,
  Rocket,
  FileEdit,
  Clock3,
  Type,
  Link2,
  Layers3,
  AlignLeft,
  ListChecks,
  Wallet,
  BadgeDollarSign,
  ToggleLeft,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import {
  CourseLevel,
  CourseStatus,
  CURRENCY_MINOR_UNITS,
  SUPPORTED_CURRENCIES,
  type Currency,
  type CourseStatus as CourseStatusType,
} from "@volt/config";
import { currencySchema } from "@volt/validation";
import type { CourseSummary } from "@volt/types";
import { api, ApiRequestError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatMoney, toMinorUnits } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

const courseFormSchema = z.object({
  title: z.string().min(3).max(160),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  level: z.nativeEnum(CourseLevel),
  shortDescription: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  learningOutcomesText: z.string().max(2000).optional(),
  priceMajor: z.coerce.number().nonnegative(),
  currency: currencySchema,
  accessType: z.enum(["FREE", "PAID"]),
  durationMinutes: z.coerce.number().int().nonnegative(),
  status: z.nativeEnum(CourseStatus).optional(),
});
type CourseFormInput = z.infer<typeof courseFormSchema>;

interface AdminCourseDetail {
  id: string;
  slug: string;
  title: string;
  level: string;
  shortDescription: string;
  description: string;
  learningOutcomes: string[];
  price: { amount: number; currency: Currency };
  accessType: "FREE" | "PAID";
  durationMinutes: number;
  status: CourseStatusType;
}

type StatusFilter = "ALL" | CourseStatusType;
type LevelFilter = "ALL" | (typeof CourseLevel)[keyof typeof CourseLevel];

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

const emptyDefaults: CourseFormInput = {
  title: "",
  slug: "",
  level: CourseLevel.BEGINNER,
  shortDescription: "",
  description: "",
  learningOutcomesText: "",
  priceMajor: 0,
  currency: "TZS",
  accessType: "PAID",
  durationMinutes: 60,
  status: CourseStatus.DRAFT,
};

export default function AdminCoursesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseSummary | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () => api.get<CourseSummary[]>("/courses/admin/all"),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormInput>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: emptyDefaults,
  });

  const titleValue = watch("title");
  const slugValue = watch("slug");
  const accessType = watch("accessType");
  const priceMajor = watch("priceMajor");
  const currencyValue = watch("currency");
  const levelValue = watch("level");
  const statusValue = watch("status");
  const shortDescriptionValue = watch("shortDescription");

  const previewPrice = formatMoney({
    amount: toMinorUnits(Number(priceMajor) || 0, (currencyValue as Currency) || "TZS"),
    currency: (currencyValue as Currency) || "TZS",
  });

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

  const openEdit = async (course: CourseSummary) => {
    setEditingId(course.id);
    setSlugTouched(true);
    setEditorOpen(true);
    try {
      const detail = await api.get<AdminCourseDetail>(`/courses/admin/${course.id}`);
      reset({
        title: detail.title,
        slug: detail.slug,
        level: detail.level as CourseFormInput["level"],
        shortDescription: detail.shortDescription,
        description: detail.description,
        learningOutcomesText: detail.learningOutcomes.join("\n"),
        priceMajor: fromMinor(detail.price.amount, detail.price.currency),
        currency: detail.price.currency,
        accessType: detail.accessType,
        durationMinutes: detail.durationMinutes,
        status: detail.status,
      });
    } catch {
      reset({
        ...emptyDefaults,
        title: course.title,
        slug: course.slug,
        level: course.level as CourseFormInput["level"],
        shortDescription: course.shortDescription,
        priceMajor: fromMinor(course.price.amount, course.price.currency as Currency),
        currency: course.price.currency as Currency,
        accessType: course.accessType,
        durationMinutes: course.durationMinutes,
        status: course.status,
      });
    }
  };

  const createCourse = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<CourseSummary>("/courses", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setEditorOpen(false);
      reset(emptyDefaults);
    },
  });

  const updateCourse = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<CourseSummary>(`/courses/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setEditorOpen(false);
      setEditingId(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CourseStatusType }) =>
      api.patch(`/courses/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-courses"] }),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setDeleteTarget(null);
    },
  });

  const onSubmit = (values: CourseFormInput) => {
    const learningOutcomes = (values.learningOutcomesText ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const payload = {
      title: values.title,
      slug: values.slug,
      level: values.level,
      shortDescription: values.shortDescription,
      description: values.description,
      learningOutcomes,
      price: {
        amount: toMinorUnits(values.priceMajor, values.currency as Currency),
        currency: values.currency,
      },
      accessType: values.accessType,
      durationMinutes: values.durationMinutes,
      ...(editingId && values.status ? { status: values.status } : {}),
    };

    if (editingId) {
      updateCourse.mutate({ id: editingId, payload });
    } else {
      createCourse.mutate(payload);
    }
  };

  const courses = data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (levelFilter !== "ALL" && c.level !== levelFilter) return false;
      if (!term) return true;
      return (
        c.title.toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term) ||
        c.shortDescription.toLowerCase().includes(term)
      );
    });
  }, [courses, search, statusFilter, levelFilter]);

  const stats = useMemo(
    () => ({
      total: courses.length,
      published: courses.filter((c) => c.status === "PUBLISHED").length,
      draft: courses.filter((c) => c.status === "DRAFT").length,
      archived: courses.filter((c) => c.status === "ARCHIVED").length,
    }),
    [courses],
  );

  const saving = createCourse.isPending || updateCourse.isPending || isSubmitting;
  const formError =
    createCourse.error instanceof ApiRequestError
      ? createCourse.error.message
      : updateCourse.error instanceof ApiRequestError
        ? updateCourse.error.message
        : createCourse.isError || updateCourse.isError
          ? "Could not save course."
          : null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(0_0%_10%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Forex Academy
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, publish, archive and delete academy courses.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          New course
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip icon={BookOpen} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Rocket} label="Published" value={stats.published} tone="green" />
        <StatChip icon={FileEdit} label="Drafts" value={stats.draft} tone="blue" />
        <StatChip icon={Archive} label="Archived" value={stats.archived} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(0_0%_10%/0.08)] shadow-card">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]" />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, slug or description…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {Object.values(CourseStatus).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-44">
            <Select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            >
              <option value="ALL">All levels</option>
              {Object.values(CourseLevel).map((l) => (
                <option key={l} value={l}>
                  {humanize(l)}
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
          {error instanceof ApiRequestError ? error.message : "Could not load courses."}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={courses.length === 0 ? "No courses yet" : "No matches"}
          description={
            courses.length === 0
              ? "Create your first Forex Academy course."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <article
              key={course.id}
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
                      <Badge variant={statusVariant(course.status)}>{humanize(course.status)}</Badge>
                      <Badge variant="volt">{humanize(course.level)}</Badge>
                      <Badge variant="default">{course.accessType}</Badge>
                    </div>
                    <h2 className="truncate text-lg font-bold tracking-tight">{course.title}</h2>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /{course.slug}
                    </p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(0_0%_10%/0.2)] text-volt-dim">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">{course.shortDescription}</p>

                <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-sm">
                  <span className="font-semibold">{formatMoney(course.price)}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {course.durationMinutes}m · {course.lessonsCount} lessons
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void openEdit(course)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Link
                    href={`/admin/courses/${course.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Lessons & quiz
                  </Link>
                  {course.status !== "PUBLISHED" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: course.id, status: "PUBLISHED" })}
                    >
                      <Rocket className="h-3.5 w-3.5" />
                      Publish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: course.id, status: "DRAFT" })}
                    >
                      Unpublish
                    </Button>
                  )}
                  {course.status !== "ARCHIVED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: course.id, status: "ARCHIVED" })}
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteTarget(course)}
                    className="ml-auto"
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

      {/* Create / Edit dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditorOpen(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            {/* Hero */}
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.18)] px-6 pb-5 pt-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-volt/35 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[hsl(0_0%_10%/0.28)] blur-3xl"
              />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  {editingId ? <Pencil className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Forex Academy
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {editingId ? "Edit course" : "Create course"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {editingId
                      ? "Polish catalogue details, pricing and publish status."
                      : "Craft a premium course card — learners will see this on the academy."}
                  </DialogDescription>
                </div>
              </div>

              {/* Live preview strip */}
              <div className="relative mt-5 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant="volt">{humanize(levelValue || "BEGINNER")}</Badge>
                      <Badge variant="default">{accessType}</Badge>
                      {editingId && statusValue ? (
                        <Badge variant={statusVariant(statusValue)}>{humanize(statusValue)}</Badge>
                      ) : (
                        <Badge variant="warning">Draft</Badge>
                      )}
                    </div>
                    <p className="truncate text-lg font-bold tracking-tight">
                      {titleValue?.trim() || "Untitled course"}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /{slugValue?.trim() || "course-slug"}
                    </p>
                    <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                      {shortDescriptionValue?.trim() || "Short description preview appears here."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-volt/30 bg-volt/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Price
                    </p>
                    <p className="text-base font-bold text-volt-dim">
                      {accessType === "FREE" ? "Free" : previewPrice}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="max-h-[min(62vh,560px)] space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FormSection
                icon={Type}
                title="Basics"
                description="Name, URL slug and difficulty level."
                tone="gold"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    className="sm:col-span-2"
                    label="Course title"
                    htmlFor="title"
                    hint="Shown on cards and course detail"
                    error={errors.title?.message}
                  >
                    <Input id="title" placeholder="Price Action Mastery" {...register("title")} />
                  </Field>

                  <Field label="Slug" htmlFor="slug" hint="URL path" error={errors.slug?.message}>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="slug"
                        className="pl-9 font-mono text-sm"
                        placeholder="price-action-mastery"
                        {...register("slug")}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setValue("slug", e.target.value, { shouldValidate: true });
                        }}
                      />
                    </div>
                  </Field>

                  <Field label="Level" htmlFor="level">
                    <div className="relative">
                      <Layers3 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select id="level" className="pl-9" {...register("level")}>
                        {Object.values(CourseLevel).map((l) => (
                          <option key={l} value={l}>
                            {humanize(l)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={AlignLeft}
                title="Content"
                description="What learners see before enrolling."
                tone="blue"
              >
                <div className="grid gap-4">
                  <Field
                    label="Short description"
                    htmlFor="shortDescription"
                    hint="One-liner for catalogue cards"
                    error={errors.shortDescription?.message}
                  >
                    <Input
                      id="shortDescription"
                      placeholder="Master candlesticks, structure and risk in one focused path."
                      {...register("shortDescription")}
                    />
                  </Field>

                  <Field
                    label="Full description"
                    htmlFor="description"
                    error={errors.description?.message}
                  >
                    <Textarea
                      id="description"
                      rows={4}
                      placeholder="Tell the story of this course — who it's for, what they'll practice, and how it connects to real trading."
                      {...register("description")}
                    />
                  </Field>

                  <Field
                    label="Learning outcomes"
                    htmlFor="learningOutcomesText"
                    hint="One outcome per line"
                  >
                    <div className="relative">
                      <ListChecks className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        id="learningOutcomesText"
                        className="pl-9"
                        rows={3}
                        placeholder={"Read candlestick structure\nManage risk per trade\nBuild a weekly review habit"}
                        {...register("learningOutcomesText")}
                      />
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={Wallet}
                title="Access & pricing"
                description="Free or paid, duration and currency."
                tone="green"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Access type" htmlFor="accessType">
                    <div className="relative">
                      <ToggleLeft className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Select id="accessType" className="pl-9" {...register("accessType")}>
                        <option value="PAID">Paid</option>
                        <option value="FREE">Free</option>
                      </Select>
                    </div>
                  </Field>

                  <Field label="Duration (minutes)" htmlFor="durationMinutes">
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="durationMinutes"
                        className="pl-9"
                        type="number"
                        min={0}
                        {...register("durationMinutes")}
                      />
                    </div>
                  </Field>

                  <Field
                    label={`Price${accessType === "FREE" ? " (optional)" : ""}`}
                    htmlFor="priceMajor"
                    error={errors.priceMajor?.message}
                  >
                    <div className="relative">
                      <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="priceMajor"
                        className="pl-9"
                        type="number"
                        step="0.01"
                        min={0}
                        {...register("priceMajor")}
                      />
                    </div>
                  </Field>

                  <Field label="Currency" htmlFor="currency">
                    <Select id="currency" {...register("currency")}>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </FormSection>

              {editingId ? (
                <FormSection
                  icon={CircleDot}
                  title="Publishing"
                  description="Control visibility on the public academy."
                  tone="amber"
                >
                  <Field label="Status" htmlFor="status">
                    <Select id="status" {...register("status")}>
                      {Object.values(CourseStatus).map((s) => (
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
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create course"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md overflow-hidden border-0 bg-transparent p-0 shadow-none" onClose={() => setDeleteTarget(null)}>
          <div className="overflow-hidden rounded-2xl border border-danger/30 bg-surface shadow-lift">
            <div className="border-b border-danger/20 bg-gradient-to-br from-danger/15 via-surface to-warning/10 px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger/15 text-danger">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle>Delete course?</DialogTitle>
                  <DialogDescription className="mt-1">
                    This permanently removes <strong>{deleteTarget?.title}</strong> and its lessons.
                    Courses with enrollments cannot be deleted — archive them instead.
                  </DialogDescription>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {deleteCourse.isError ? (
                <Alert variant="danger">
                  {deleteCourse.error instanceof ApiRequestError
                    ? deleteCourse.error.message
                    : "Could not delete course."}
                </Alert>
              ) : null}
              <DialogFooter className="mt-0">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteCourse.isPending || !deleteTarget}
                  onClick={() => deleteTarget && deleteCourse.mutate(deleteTarget.id)}
                >
                  {deleteCourse.isPending ? "Deleting…" : "Delete permanently"}
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
  icon: typeof BookOpen;
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
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br via-surface to-surface p-4 shadow-card",
        tones[tone],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
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
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br via-surface to-surface p-4",
        t.shell,
      )}
    >
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
