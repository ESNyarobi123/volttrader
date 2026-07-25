"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle2, Lock, PlayCircle } from "lucide-react";
import type {
  CertificateView,
  CourseDetail,
  EnrollmentView,
  LessonPlaybackView,
  QuizResultView,
  QuizView,
} from "@volt/types";
import { api, ApiRequestError } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { SoftNotice } from "@/components/shared/soft-notice";
import { cn } from "@/lib/utils";

export default function CoursePlayerPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const queryClient = useQueryClient();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"lesson" | "quiz">("lesson");
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
    },
    onError: (err) => {
      setMutationError(err instanceof ApiRequestError ? err.message : "Could not update progress");
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
      setMutationError(err instanceof ApiRequestError ? err.message : "Could not submit quiz");
    },
  });

  if (courseQuery.isLoading) return <PageSpinner />;

  if (courseQuery.error || !courseQuery.data) {
    return (
      <Alert variant="danger">
        <AlertTitle>Course unavailable</AlertTitle>
        <p className="text-sm">
          {courseQuery.error instanceof ApiRequestError
            ? courseQuery.error.message
            : "Could not load this course."}
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
        <h1 className="text-xl font-bold">{course.title}</h1>
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1>
        <div className="mt-3 max-w-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall progress</span>
            <span>{formatPercent(enrollment?.progressPercent ?? 0)}</span>
          </div>
          <Progress value={enrollment?.progressPercent ?? 0} />
        </div>
        {certificate ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3">
            <Award className="h-5 w-5 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Certificate {certificate.certificateNumber}</p>
              <p className="text-xs text-muted-foreground">Course completion — not investment performance.</p>
            </div>
            {certificate.downloadUrl ? (
              <a
                href={certificate.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Download PDF
              </a>
            ) : null}
          </div>
        ) : course.hasQuiz ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Complete every lesson and pass the quiz to earn your certificate.
          </p>
        ) : null}
      </div>

      {mutationError && (
        <Alert variant="danger">
          <p className="text-sm">{mutationError}</p>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={panel === "lesson" ? "primary" : "outline"}
          onClick={() => setPanel("lesson")}
        >
          Lessons
        </Button>
        {course.hasQuiz ? (
          <Button
            size="sm"
            variant={panel === "quiz" ? "primary" : "outline"}
            onClick={() => setPanel("quiz")}
          >
            Quiz
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {panel === "lesson" ? (
          <>
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Lessons</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 p-0 pb-4">
                {lessons.map((lesson) => {
                  const active = lesson.id === activeLessonId;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      disabled={lesson.locked}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        active ? "bg-volt/10 text-volt-dim" : "text-foreground hover:bg-surface-2",
                      )}
                    >
                      {lesson.locked ? (
                        <Lock className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <span className="line-clamp-1 flex-1">
                        {lesson.order}. {lesson.title}
                      </span>
                      {lesson.isPreview && (
                        <Badge variant="info" className="shrink-0">
                          Preview
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-4 p-5">
                {activeLesson ? (
                  <>
                    <h2 className="text-lg font-semibold">{activeLesson.title}</h2>
                    {playbackQuery.isLoading ? (
                      <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-surface-2 text-sm text-muted-foreground">
                        Loading media…
                      </div>
                    ) : playbackQuery.data?.videoUrl ? (
                      <video
                        key={playbackQuery.data.videoUrl}
                        className="aspect-video w-full rounded-lg bg-black"
                        controls
                        playsInline
                        src={playbackQuery.data.videoUrl}
                      />
                    ) : (
                      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 px-4 text-center">
                        <PlayCircle className="h-10 w-10 text-muted-foreground" aria-hidden />
                        <p className="text-sm text-muted-foreground">
                          {activeLesson.hasVideo
                            ? "Video unavailable right now."
                            : "No video uploaded for this lesson yet."}
                        </p>
                      </div>
                    )}
                    {(playbackQuery.data?.content || activeLesson.content) && (
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground">
                        {playbackQuery.data?.content || activeLesson.content}
                      </div>
                    )}
                    <Button
                      variant="primary"
                      className="w-fit"
                      disabled={markComplete.isPending}
                      onClick={() => markComplete.mutate(activeLesson.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {markComplete.isPending ? "Saving…" : "Mark complete"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">This course has no lessons yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{quizQuery.data?.title ?? "Course quiz"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {quizQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading quiz…</p>
              ) : quizQuery.error || !quizQuery.data ? (
                <Alert variant="danger">
                  <p className="text-sm">
                    {quizQuery.error instanceof ApiRequestError
                      ? quizQuery.error.message
                      : "Quiz unavailable."}
                  </p>
                </Alert>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Pass score: {quizQuery.data.passScore}%. Latest:{" "}
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
                    <div key={q.id} className="space-y-2 rounded-xl border border-border p-4">
                      <p className="text-sm font-semibold">
                        {idx + 1}. {q.prompt}
                      </p>
                      <div className="flex flex-col gap-2">
                        {q.choices.map((choice, choiceIndex) => (
                          <label
                            key={`${q.id}-${choiceIndex}`}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
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
                  <Button
                    variant="primary"
                    disabled={!allAnswered || submitQuiz.isPending}
                    onClick={() => submitQuiz.mutate()}
                  >
                    {submitQuiz.isPending ? "Submitting…" : "Submit quiz"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
