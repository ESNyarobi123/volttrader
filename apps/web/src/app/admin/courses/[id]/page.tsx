"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Upload } from "lucide-react";
import type { StoragePresignView } from "@volt/types";
import { ApiRequestError, api, apiErrorMessage } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdminLesson {
  id: string;
  title: string;
  order: number;
  videoKey: string | null;
  content: string | null;
  durationSeconds: number;
  isPreview: boolean;
}

interface AdminQuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

interface AdminCourseContent {
  id: string;
  title: string;
  slug: string;
  lessons: AdminLesson[];
  quiz: {
    id: string;
    title: string;
    passScore: number;
    questions: AdminQuizQuestion[];
  } | null;
}

export default function AdminCourseContentPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonOrder, setLessonOrder] = useState(1);
  const [lessonContent, setLessonContent] = useState("");
  const [lessonVideoKey, setLessonVideoKey] = useState("");
  const [lessonPreview, setLessonPreview] = useState(false);

  const [quizTitle, setQuizTitle] = useState("Course quiz");
  const [passScore, setPassScore] = useState(70);
  const [questionsJson, setQuestionsJson] = useState(
    JSON.stringify(
      [
        {
          id: "q1",
          prompt: "Sample question?",
          choices: ["A", "B", "C"],
          correctIndex: 0,
        },
      ],
      null,
      2,
    ),
  );

  const detailQuery = useQuery({
    queryKey: ["admin-course", courseId],
    queryFn: () => api.get<AdminCourseContent>(`/courses/admin/${courseId}`),
    enabled: Boolean(courseId),
  });

  useEffect(() => {
    const quiz = detailQuery.data?.quiz;
    if (!quiz) return;
    setQuizTitle(quiz.title);
    setPassScore(quiz.passScore);
    setQuestionsJson(JSON.stringify(quiz.questions, null, 2));
  }, [detailQuery.data?.quiz]);

  useEffect(() => {
    const lessons = detailQuery.data?.lessons ?? [];
    if (lessons.length) setLessonOrder(lessons.length + 1);
  }, [detailQuery.data?.lessons]);

  const addLesson = useMutation({
    mutationFn: () =>
      api.post(`/courses/${courseId}/lessons`, {
        courseId,
        title: lessonTitle,
        order: lessonOrder,
        content: lessonContent || undefined,
        videoKey: lessonVideoKey || undefined,
        isPreview: lessonPreview,
      }),
    onSuccess: async () => {
      setFlash("Lesson added");
      setError(null);
      setLessonTitle("");
      setLessonContent("");
      setLessonVideoKey("");
      setLessonPreview(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-course", courseId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
    },
    onError: (err) => {
      setError(apiErrorMessage(err, "Could not add lesson"));
    },
  });

  const saveQuiz = useMutation({
    mutationFn: () => {
      let questions: AdminQuizQuestion[];
      try {
        questions = JSON.parse(questionsJson) as AdminQuizQuestion[];
      } catch {
        throw new Error("Quiz questions must be valid JSON");
      }
      return api.put(`/courses/${courseId}/quiz`, {
        title: quizTitle,
        passScore,
        questions,
      });
    },
    onSuccess: async () => {
      setFlash("Quiz saved");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-course", courseId] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not save quiz");
      if (err instanceof ApiRequestError) setError(err.message);
    },
  });

  const uploadVideo = useMutation({
    mutationFn: async (file: File) => {
      const presign = await api.post<StoragePresignView>("/storage/presign-upload", {
        purpose: "lesson_video",
        filename: file.name,
        contentType: file.type || "video/mp4",
      });
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");
      return presign.key;
    },
    onSuccess: (key) => {
      setLessonVideoKey(key);
      setFlash("Video uploaded — key filled below");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Upload failed");
    },
  });

  if (detailQuery.isLoading) return <PageSpinner />;
  if (detailQuery.error || !detailQuery.data) {
    return (
      <Alert variant="danger">
        {apiErrorMessage(detailQuery.error, "Course not found")}
      </Alert>
    );
  }

  const course = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/courses"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2 -ml-2")}
          >
            <ArrowLeft className="h-4 w-4" />
            Courses
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lessons, S3 video keys, and course quiz (certificate requires pass when a quiz exists).
          </p>
        </div>
        <Badge variant="volt">/{course.slug}</Badge>
      </div>

      {flash ? <Alert variant="volt">{flash}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lessons ({course.lessons.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {course.lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  className="rounded-xl border border-border px-3 py-2"
                >
                  <p className="font-semibold">
                    {lesson.order}. {lesson.title}
                    {lesson.isPreview ? (
                      <Badge variant="info" className="ml-2">
                        Preview
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    videoKey: {lesson.videoKey || "—"}
                  </p>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-semibold">Add lesson</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lesson-title">Title</Label>
                  <Input
                    id="lesson-title"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-order">Order</Label>
                  <Input
                    id="lesson-order"
                    type="number"
                    value={lessonOrder}
                    onChange={(e) => setLessonOrder(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={lessonPreview}
                      onChange={(e) => setLessonPreview(e.target.checked)}
                    />
                    Preview lesson
                  </label>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lesson-content">Content</Label>
                  <Textarea
                    id="lesson-content"
                    rows={3}
                    value={lessonContent}
                    onChange={(e) => setLessonContent(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="lesson-video">Video object key</Label>
                  <Input
                    id="lesson-video"
                    value={lessonVideoKey}
                    onChange={(e) => setLessonVideoKey(e.target.value)}
                    placeholder="lessons/….mp4"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploadVideo.isPending ? "Uploading…" : "Upload video to S3"}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    disabled={uploadVideo.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadVideo.mutate(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={addLesson.isPending || lessonTitle.trim().length < 3}
                  onClick={() => addLesson.mutate()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {addLesson.isPending ? "Saving…" : "Add lesson"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="quiz-title">Title</Label>
              <Input
                id="quiz-title"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass-score">Pass score %</Label>
              <Input
                id="pass-score"
                type="number"
                min={1}
                max={100}
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="questions">Questions JSON</Label>
              <Textarea
                id="questions"
                rows={16}
                className="font-mono text-xs"
                value={questionsJson}
                onChange={(e) => setQuestionsJson(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              disabled={saveQuiz.isPending}
              onClick={() => saveQuiz.mutate()}
            >
              {saveQuiz.isPending ? "Saving…" : "Save quiz"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
