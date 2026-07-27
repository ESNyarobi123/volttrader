"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, Eye, EyeOff, Lock } from "lucide-react";
import { ADMIN_ROLES } from "@volt/config";
import { loginSchema, type LoginInput } from "@volt/validation";
import { useAuth } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import { AuthDivider, SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [socialNote, setSocialNote] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/admin");
  }, [router]);

  const resetOk = searchParams.get("reset") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    setSocialNote(null);
    setIsSubmitting(true);
    try {
      const user = await login(values);
      const requested = searchParams.get("redirect");
      const home = ADMIN_ROLES.includes(user.role) ? "/admin" : "/dashboard";
      router.replace(requested || home);
    } catch (err) {
      setServerError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to log in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-surface px-6 py-8 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.18)] sm:px-8 sm:py-9">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          Welcome back!
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to your Mandanda Space account
        </p>
      </div>

      <div className="mt-7">
        <SocialAuthButtons
          onUnavailable={(provider) => {
            const name =
              provider === "google" ? "Google" : provider === "apple" ? "Apple" : "Facebook";
            setServerError(null);
            setSocialNote(
              `${name} sign-in is coming soon. Use email or phone below for now.`,
            );
          }}
        />
      </div>

      <AuthDivider />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-sm text-danger"
          >
            {serverError}
          </div>
        ) : null}

        {socialNote ? (
          <div
            role="status"
            className="rounded-xl border border-border bg-surface-2/80 px-3.5 py-3 text-sm text-muted-foreground"
          >
            {socialNote}
          </div>
        ) : null}

        {resetOk && !serverError ? (
          <div
            role="status"
            className="rounded-xl border border-border bg-surface-2/80 px-3.5 py-3 text-sm text-muted-foreground"
          >
            Password updated. Sign in with your new password.
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password" className="font-semibold">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[hsl(213_70%_42%)] underline-offset-2 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-12 rounded-xl border-border/80 bg-background pl-10 pr-11"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          {errors.password ? (
            <p className="text-sm text-danger">{errors.password.message}</p>
          ) : null}
        </div>

        <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-border text-volt-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
          />
          Remember me
        </label>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className={cn("mt-1 h-12 w-full rounded-full text-base shadow-volt")}
        >
          {isSubmitting ? <Spinner /> : null}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-7 text-center">
        <p className="text-sm text-muted-foreground">Don&apos;t have an account?</p>
        <Link
          href="/register"
          className="mt-1 inline-block text-sm font-semibold text-[hsl(213_70%_42%)] underline-offset-2 hover:underline"
        >
          Create one
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-[1.75rem] border border-border/70 bg-surface p-16 shadow-card">
          <Spinner />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
