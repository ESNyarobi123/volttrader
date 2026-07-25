"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock } from "lucide-react";
import { passwordSchema } from "@volt/validation";
import { api, ApiRequestError } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  password: passwordSchema,
  confirm: z.string().min(1, "Confirm your password"),
}).refine((v) => v.password === v.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});
type FormValues = z.infer<typeof formSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      setServerError("Missing reset token. Open the link from your email again.");
      return;
    }
    setServerError(null);
    setIsSubmitting(true);
    try {
      await api.post(
        "/auth/reset-password",
        { token, password: values.password },
        { auth: false },
      );
      router.replace("/login?reset=1");
    } catch (err) {
      setServerError(
        err instanceof ApiRequestError
          ? err.message
          : "Unable to reset password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-surface px-6 py-8 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.18)] sm:px-8 sm:py-9">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          Set a new password
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose a strong password for your Volt Trades account.
        </p>
      </div>

      <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger"
          >
            {serverError}
          </div>
        ) : null}

        {!token ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger"
          >
            This page needs a valid reset token from your email link.
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="font-semibold">
            New password
          </Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="h-12 rounded-xl border-border/80 bg-background pl-10"
              {...register("password")}
            />
          </div>
          {errors.password ? (
            <p className="text-sm text-danger">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm" className="font-semibold">
            Confirm password
          </Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="h-12 rounded-xl border-border/80 bg-background"
            {...register("confirm")}
          />
          {errors.confirm ? (
            <p className="text-sm text-danger">{errors.confirm.message}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || !token}
          className={cn("mt-1 h-12 w-full rounded-full text-base shadow-volt")}
        >
          {isSubmitting ? <Spinner /> : null}
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>

      <div className="mt-7 text-center">
        <Link
          href="/login"
          className="text-sm font-semibold text-[hsl(213_70%_42%)] underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-[1.75rem] border border-border/70 bg-surface p-16 shadow-card">
          <Spinner />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
