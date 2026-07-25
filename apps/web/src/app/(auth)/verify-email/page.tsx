"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiRequestError } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token. Open the link from your email again.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post<{ message: string }>(
          "/auth/verify-email",
          { token },
          { auth: false },
        );
        if (cancelled) return;
        setStatus("ok");
        setMessage(res.message);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          err instanceof ApiRequestError
            ? err.message
            : "Unable to verify email. The link may have expired.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-surface px-6 py-8 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.18)] sm:px-8 sm:py-9">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          Email verification
        </h1>
        <p
          className={cn(
            "mt-4 text-sm",
            status === "error" ? "text-danger" : "text-muted-foreground",
          )}
        >
          {status === "loading" ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> {message}
            </span>
          ) : (
            message
          )}
        </p>
      </div>

      {status !== "loading" ? (
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>
            Continue to sign in
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>
            Go to dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-[1.75rem] border border-border/70 bg-surface p-16 shadow-card">
          <Spinner />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
