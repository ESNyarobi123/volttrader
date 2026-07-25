"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@volt/validation";
import { api, ApiRequestError } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setServerError(null);
    setDoneMessage(null);
    setIsSubmitting(true);
    try {
      const res = await api.post<{ message: string }>(
        "/auth/forgot-password",
        values,
        { auth: false },
      );
      setDoneMessage(res.message);
    } catch (err) {
      setServerError(
        err instanceof ApiRequestError
          ? err.message
          : "Unable to send reset instructions. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-surface px-6 py-8 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.18)] sm:px-8 sm:py-9">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          Forgot password
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your email or phone and we&apos;ll send reset instructions if an account exists.
        </p>
      </div>

      {doneMessage ? (
        <div
          role="status"
          className="mt-7 rounded-xl border border-border bg-surface-2/80 px-3.5 py-3 text-sm text-muted-foreground"
        >
          {doneMessage}
        </div>
      ) : (
        <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError ? (
            <div
              role="alert"
              className="rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger"
            >
              {serverError}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identifier" className="font-semibold">
              Email or phone
            </Label>
            <div className="relative">
              <AtSign
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="you@example.com"
                className="h-12 rounded-xl border-border/80 bg-background pl-10"
                {...register("identifier")}
              />
            </div>
            {errors.identifier ? (
              <p className="text-sm text-danger">{errors.identifier.message}</p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className={cn("mt-1 h-12 w-full rounded-full text-base shadow-volt")}
          >
            {isSubmitting ? <Spinner /> : null}
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

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
