"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Lock, PlayCircle, Wallet } from "lucide-react";
import type { CourseDetail, PaymentView, WalletView } from "@volt/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

interface CourseCheckoutResponse {
  payment: PaymentView | null;
  enrolled: boolean;
  checkoutUrl: string | null;
}

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: course, isLoading, error } = useQuery({
    queryKey: ["course", slug],
    queryFn: () => api.get<CourseDetail>(`/courses/${slug}`),
    enabled: !!slug,
  });

  const walletQuery = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletView>("/wallet"),
    enabled: Boolean(user),
  });

  const checkoutMutation = useMutation({
    mutationFn: (source: "WALLET" | "PAYMENT") =>
      api.post<CourseCheckoutResponse>("/payments/course-checkout", {
        courseId: course?.id,
        source,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (res) => {
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res.enrolled) {
        router.push("/dashboard/learn");
      }
    },
  });

  const enrollFreeMutation = useMutation({
    mutationFn: () => api.post("/enrollments", { courseId: course?.id }),
    onSuccess: () => router.push("/dashboard/learn"),
  });

  if (isLoading) {
    return (
      <div className="container-page py-10">
        <PageSpinner />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container-page py-10">
        <Alert variant="danger">
          {apiErrorMessage(error, "Course not found.")}
        </Alert>
      </div>
    );
  }

  const mutationError = checkoutMutation.error ?? enrollFreeMutation.error;
  const wallet = walletQuery.data;
  const paid = course.accessType === "PAID";
  const canAffordWallet =
    !paid || (wallet ? wallet.balance.amount >= course.price.amount : false);
  const insufficient =
    mutationError instanceof ApiRequestError &&
    /insufficient wallet balance/i.test(mutationError.message);

  return (
    <div className="container-page py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="volt">{humanize(course.level)}</Badge>
            {course.accessType === "FREE" && <Badge variant="success">Free</Badge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{course.shortDescription}</p>
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <PlayCircle className="h-4 w-4" /> {course.lessonsCount} lessons
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" /> {course.durationMinutes} min total
            </span>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>What you&apos;ll learn</CardTitle>
            </CardHeader>
            <CardContent>
              {course.learningOutcomes.length > 0 ? (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {course.learningOutcomes.map((outcome, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-volt-dim" aria-hidden />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No learning outcomes listed yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Curriculum</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {course.lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {lesson.locked ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      ) : (
                        <PlayCircle className="h-4 w-4 shrink-0 text-volt-dim" aria-hidden />
                      )}
                      <span>
                        {lesson.order}. {lesson.title}
                      </span>
                      {lesson.isPreview && <Badge variant="info">Preview</Badge>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {Math.round(lesson.durationSeconds / 60)}m
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>
                {course.accessType === "FREE" ? "Free" : formatMoney(course.price)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user && paid ? (
                <div className="rounded-xl border border-border bg-surface-2/50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Wallet </span>
                  <span className="font-semibold">
                    {wallet ? formatMoney(wallet.balance) : "…"}
                  </span>
                </div>
              ) : null}

              {mutationError ? (
                <Alert variant="danger">
                  {apiErrorMessage(mutationError, "Something went wrong.")}
                </Alert>
              ) : null}

              {!user ? (
                <Link
                  href={`/login?redirect=/courses/${slug}`}
                  className={cn(buttonVariants({ variant: "primary" }), "w-full")}
                >
                  Log in to continue
                </Link>
              ) : course.enrolled ? (
                <Link
                  href={`/dashboard/learn/${course.slug}`}
                  className={cn(buttonVariants({ variant: "primary" }), "w-full")}
                >
                  Go to course
                </Link>
              ) : course.accessType === "FREE" ? (
                <Button
                  className="w-full"
                  onClick={() => enrollFreeMutation.mutate()}
                  disabled={enrollFreeMutation.isPending}
                >
                  {enrollFreeMutation.isPending ? "Enrolling…" : "Enroll free"}
                </Button>
              ) : !canAffordWallet || insufficient ? (
                <div className="space-y-2">
                  <Alert variant="warning">
                    Deposit to your wallet to buy this course with balance.
                  </Alert>
                  <Link
                    href="/dashboard/wallet"
                    className={cn(
                      buttonVariants({ variant: "primary" }),
                      "inline-flex w-full justify-center rounded-full shadow-volt",
                    )}
                  >
                    <Wallet className="h-4 w-4" />
                    Deposit to buy
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={() => checkoutMutation.mutate("PAYMENT")}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? "Processing…" : "Pay online instead"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    className="w-full rounded-full shadow-volt"
                    onClick={() => checkoutMutation.mutate("WALLET")}
                    disabled={checkoutMutation.isPending}
                  >
                    <Wallet className="h-4 w-4" />
                    {checkoutMutation.isPending ? "Processing…" : "Pay from wallet"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={() => checkoutMutation.mutate("PAYMENT")}
                    disabled={checkoutMutation.isPending}
                  >
                    Pay online
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Paid courses debit your wallet first. Deposit if balance is low.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
