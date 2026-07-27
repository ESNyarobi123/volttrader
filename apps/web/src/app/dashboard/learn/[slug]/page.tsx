"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Lock,
  Play,
  PlayCircle,
} from "lucide-react";
import type {
  CertificateView,
  CourseDetail,
  EnrollmentView,
  LessonPlaybackView,
  QuizResultView,
  QuizView,
} from "@volt/types";
import { api, apiErrorMessage } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { SoftNotice } from "@/components/shared/soft-notice";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CoursePlayerPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const queryClient = useQueryClient();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"lesson" | "quiz">("lesson");
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizFlash, setQuizFlash] = useState<QuizResultView | null>(null);

  const courseQuery = useQuery({
    queryKey: ["course", slug],
    queryFn: () => api.get<CourseDetail>(`/courses/${slug}`),
    enabled: Boolean(slug),
  });

  const enrollmentsQuery = useQuery({
    queryKey: ["enrollments", "me"],
    queryFn: () => api.get<EnrollmentView[]>("/enrollments/me"),
  });

  const enrollment = enrollmentsQuery.data?.find((e) => e.course.slug === slug);
  const lessons = useMemo(() => courseQuery.data?.lessons ?? [], [courseQuery.data]);
  const activeLessonId = selectedLessonId ?? lessons[0]?.id ?? null;
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;
  const activeIndex = lessons.findIndex((l) => l.id === activeLessonId);
  const prevLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson =
    activeIndex >= 0 && activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null;

  const completedCount = lessons.filter((l) => l.completed).length;
  const progressPercent =
    enrollment?.progressPercent ??
    (lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0);

  const playbackQuery = useQuery({
    queryKey: ["lesson-playback", activeLessonId],
    queryFn: () => api.get<LessonPlaybackView>(`/courses/lessons/${activeLessonId}/playback`),
    enabled: Boolean(activeLessonId) && panel === "lesson" && Boolean(courseQuery.data?.enrolled),
  });

  const quizQuery = useQuery({
    queryKey: ["course-quiz", courseQuery.data?.id],
    queryFn: () => api.get<QuizView>(`/courses/${courseQuery.data!.id}/quiz`),
    enabled: Boolean(courseQuery.data?.id && courseQuery.data.enrolled && courseQuery.data.hasQuiz),
  });

  useEffect(() => {
    setAnswers({});
    setQuizFlash(null);
  }, [quizQuery.data?.id]);

  const markComplete = useMutation({
    mutationFn: (lessonId: string) =>
      api.post("/enrollments/progress", { lessonId, completed: true }),
    onSuccess: async () => {
      setMutationError(null);
      await queryClient.invalidateQueries({ queryKey: ["course", slug] });
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "me"] });
      if (nextLesson && !nextLesson.locked) {
        setSelectedLessonId(nextLesson.id);
        setPanel("lesson");
      }
    },
    onError: (err) => {
      setMutationError(apiErrorMessage(err, "Could not update progress"));
    },
  });

  const submitQuiz = useMutation({
    mutationFn: () => {
      const quiz = quizQuery.data;
      if (!quiz || !courseQuery.data) throw new Error("Quiz not loaded");
      return api.post<QuizResultView>(`/courses/${courseQuery.data.id}/quiz/submit`, {
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          choiceIndex: answers[q.id] ?? -1,
        })),
      });
    },
    onSuccess: async (result) => {
      setQuizFlash(result);
      setMutationError(null);
      await queryClient.invalidateQueries({ queryKey: ["course-quiz", courseQuery.data?.id] });
      await queryClient.invalidateQueries({ queryKey: ["course", slug] });
      await queryClient.invalidateQueries({ queryKey: ["enrollments", "me"] });
    },
    onError: (err) => {
      setMutationError(apiErrorMessage(err, "Could not submit quiz"));
    },
  });

  if (courseQuery.isLoading) return <PageSpinner />;

  if (courseQuery.error || !courseQuery.data) {
    return (
      <Alert variant="danger">
        <AlertTitle>Course unavailable</AlertTitle>
        <p className="text-sm">
          {apiErrorMessage(courseQuery.error, "Could not load this course.")}
        </p>
      </Alert>
    );
  }

  const course = courseQuery.data;
  const certificate: CertificateView | null =
    course.certificate ?? enrollment?.certificate ?? null;

  if (!course.enrolled) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h1 className="font-display text-xl font-bold">{course.title}</h1>
        <SoftNotice className="mt-4 text-left" title="You're not enrolled in this course">
          Purchase or enroll in this course to access its lessons.
        </SoftNotice>
        <Link
          href={`/courses/${course.slug}`}
          className={cn(buttonVariants({ variant: "primary" }), "mt-4")}
        >
          View course
        </Link>
      </div>
    );
  }

  const allAnswered =
    quizQuery.data?.questions.every((q) => typeof answers[q.id] === "number") ?? false;
  const lessonDone = Boolean(activeLesson?.completed);

  function selectLesson(id: string) {
    setSelectedLessonId(id);
    setPanel("lesson");
    setCurriculumOpen(false);
  }

  const curriculum = (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="shrink-0 border-b border-border px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
          Course content
        </p>
        <p className="mt-1 line-clamp-2 font-display text-sm font-bold leading-snug">
          {course.title}
        </p>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {completedCount}/{lessons.length} lessons
            </span>
            <span className="font-semibold text-foreground">{formatPercent(progressPercent)}</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="divide-y divide-border/70">
          {lessons.map((lesson, idx) => {
            const active = panel === "lesson" && lesson.id === activeLessonId;
            const duration = formatDuration(lesson.durationSeconds);
            return (
              <li key={lesson.id}>
                <button
                  type="button"
                  disabled={lesson.locked}
                  onClick={() => selectLesson(lesson.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                    active ? "bg-volt/10" : "hover:bg-surface-2/80",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                      lesson.completed
                        ? "bg-success/15 text-success"
                        : active
                          ? "bg-volt text-volt-foreground"
                          : "bg-surface-2 text-muted-foreground",
                    )}
                  >
                    {lesson.locked ? (
                      <Lock className="h-3 w-3" />
                    ) : lesson.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : active ? (
                      <Play className="h-3 w-3 fill-current" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm font-medium leading-snug",
                        active ? "text-volt-dim" : "text-foreground",
                        lesson.completed && !active && "text-muted-foreground",
                      )}
                    >
                      {idx + 1}. {lesson.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {lesson.hasVideo ? <span>Video</span> : <span>Reading</span>}
                      {duration ? <span>· {duration}</span> : null}
                      {lesson.isPreview ? (
                        <Badge variant="info" className="h-5 px-1.5 text-[10px]">
                          Preview
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {course.hasQuiz ? (
          <button
            type="button"
            onClick={() => {
              setPanel("quiz");
              setCurriculumOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-3 border-t border-border px-4 py-3.5 text-left transition-colors",
              panel === "quiz" ? "bg-volt/10" : "hover:bg-surface-2/80",
            )}
          >
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full",
                panel === "quiz"
                  ? "bg-volt text-volt-foreground"
                  : "bg-surface-2 text-muted-foreground",
              )}
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-medium",
                  panel === "quiz" ? "text-volt-dim" : "text-foreground",
                )}
              >
                Course quiz
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {quizQuery.data?.latestResult
                  ? `Latest ${quizQuery.data.latestResult.score}% · ${
                      quizQuery.data.latestResult.passed ? "passed" : "retry"
                    }`
                  : "Required for certificate"}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {certificate ? (
        <div className="shrink-0 border-t border-border bg-success/10 px-4 py-3">
          <div className="flex items-start gap-2">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-xs font-semibold">Certificate ready</p>
              <p className="text-[11px] text-muted-foreground">{certificate.certificateNumber}</p>
              {certificate.downloadUrl ? (
                <a
                  href={certificate.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[11px] font-semibold text-volt-dim hover:underline"
                >
                  Download PDF
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="-mx-3 flex min-h-[calc(100dvh-8rem)] flex-col sm:-mx-5 md:-mx-8 lg:-mx-10">
      {/* Compact study chrome */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-3 py-2.5 sm:px-5 lg:px-8">
        <Link
          href="/dashboard/learn"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Learn
        </Link>
        <span className="hidden text-border sm:inline">/</span>
        <h1 className="min-w-0 flex-1 truncate font-display text-sm font-bold tracking-tight sm:text-base">
          {course.title}
        </h1>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full lg:hidden"
          onClick={() => setCurriculumOpen((o) => !o)}
        >
          Content
        </Button>
      </div>

      {mutationError ? (
        <Alert variant="danger" className="mx-3 mt-3 sm:mx-5 lg:mx-8">
          <p className="text-sm">{mutationError}</p>
        </Alert>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Main stage */}
        <div className="flex min-w-0 flex-1 flex-col bg-[hsl(220_18%_10%)] lg:min-h-0">
          {panel === "lesson" ? (
            <>
              <div className="relative w-full bg-black">
                {playbackQuery.isLoading ? (
                  <div className="flex aspect-video w-full items-center justify-center text-sm text-white/60">
                    Loading media…
                  </div>
                ) : playbackQuery.data?.videoUrl ? (
                  <video
                    key={playbackQuery.data.videoUrl}
                    className="aspect-video w-full bg-black"
                    controls
                    playsInline
                    src={playbackQuery.data.videoUrl}
                  />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-[hsl(220_16%_14%)] to-black px-6 text-center">
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15">
                      <PlayCircle className="h-8 w-8" />
                    </span>
                    <p className="max-w-sm text-sm text-white/70">
                      {activeLesson?.hasVideo
                        ? "Video unavailable right now."
                        : "No video uploaded for this lesson yet."}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-4 bg-background px-4 py-5 sm:px-6 lg:px-8">
                {activeLesson ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                          Lesson {activeIndex + 1} of {lessons.length}
                        </p>
                        <h2 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">
                          {activeLesson.title}
                        </h2>
                      </div>
                      {lessonDone ? (
                        <Badge variant="success" className="shrink-0 gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Completed
                        </Badge>
                      ) : null}
                    </div>

                    {(playbackQuery.data?.content || activeLesson.content) && (
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-2xl border border-border bg-surface px-4 py-4 text-sm text-foreground sm:px-5">
                        {playbackQuery.data?.content || activeLesson.content}
                      </div>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={!prevLesson || prevLesson.locked}
                        onClick={() => prevLesson && selectLesson(prevLesson.id)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Previous
                      </Button>

                      {!lessonDone ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="rounded-full shadow-volt"
                          disabled={markComplete.isPending}
                          onClick={() => markComplete.mutate(activeLesson.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {markComplete.isPending ? "Saving…" : "Mark complete"}
                        </Button>
                      ) : null}

                      <Button
                        variant={lessonDone ? "primary" : "outline"}
                        size="sm"
                        className={cn("ml-auto rounded-full", lessonDone && "shadow-volt")}
                        disabled={!nextLesson || nextLesson.locked}
                        onClick={() => {
                          if (nextLesson) selectLesson(nextLesson.id);
                          else if (course.hasQuiz) setPanel("quiz");
                        }}
                      >
                        {nextLesson ? "Next lesson" : course.hasQuiz ? "Take quiz" : "Done"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col gap-5 bg-background px-4 py-5 sm:px-6 lg:px-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                  Assessment
                </p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">
                  {quizQuery.data?.title ?? "Course quiz"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pass score: {quizQuery.data?.passScore ?? "—"}%. Complete all lessons first for the
                  best chance at your certificate.
                </p>
              </div>

              {quizQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading quiz…</p>
              ) : quizQuery.error || !quizQuery.data ? (
                <Alert variant="danger">
                  <p className="text-sm">
                    {apiErrorMessage(quizQuery.error, "Quiz unavailable.")}
                  </p>
                </Alert>
              ) : (
                <div className="mx-auto w-full max-w-2xl space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Latest:{" "}
                    {quizQuery.data.latestResult
                      ? `${quizQuery.data.latestResult.score}% (${quizQuery.data.latestResult.passed ? "passed" : "not passed"})`
                      : "no attempts yet"}
                  </p>
                  {quizFlash ? (
                    <Alert variant={quizFlash.passed ? "volt" : "danger"}>
                      <p className="text-sm font-semibold">
                        Score {quizFlash.score}% — {quizFlash.passed ? "Passed" : "Not passed"}
                      </p>
                    </Alert>
                  ) : null}
                  {quizQuery.data.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-card"
                    >
                      <p className="text-sm font-semibold">
                        {idx + 1}. {q.prompt}
                      </p>
                      <div className="flex flex-col gap-2">
                        {q.choices.map((choice, choiceIndex) => (
                          <label
                            key={`${q.id}-${choiceIndex}`}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                              answers[q.id] === choiceIndex
                                ? "border-volt/50 bg-volt/10"
                                : "border-border hover:bg-surface-2",
                            )}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              checked={answers[q.id] === choiceIndex}
                              onChange={() =>
                                setAnswers((prev) => ({ ...prev, [q.id]: choiceIndex }))
                              }
                            />
                            {choice}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setPanel("lesson")}
                    >
                      Back to lessons
                    </Button>
                    <Button
                      variant="primary"
                      className="rounded-full shadow-volt"
                      disabled={!allAnswered || submitQuiz.isPending}
                      onClick={() => submitQuiz.mutate()}
                    >
                      {submitQuiz.isPending ? "Submitting…" : "Submit quiz"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop curriculum rail */}
        <aside className="hidden w-[340px] shrink-0 border-l border-border lg:flex lg:flex-col">
          {curriculum}
        </aside>

        {/* Mobile curriculum drawer */}
        {curriculumOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
              aria-label="Close curriculum"
              onClick={() => setCurriculumOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 flex w-[min(100%,22rem)] flex-col border-l border-border bg-surface shadow-lift">
              <div className="flex justify-end border-b border-border px-2 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setCurriculumOpen(false)}
                >
                  Close
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{curriculum}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
