"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { AuthDivider, SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Button } from "@/components/ui/button";

/** Short entry screen — social + continue with email (full form is on /register/email). */
export default function RegisterPage() {
  const [socialNote, setSocialNote] = useState<string | null>(null);

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-surface px-6 py-8 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.18)] sm:px-8 sm:py-9">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Learn Forex, manage capital, and explore opportunities
        </p>
      </div>

      <div className="mt-8">
        <SocialAuthButtons
          onUnavailable={(provider) => {
            const name =
              provider === "google" ? "Google" : provider === "apple" ? "Apple" : "Facebook";
            setSocialNote(
              `${name} sign-up is coming soon. Continue with email instead.`,
            );
          }}
        />
      </div>

      {socialNote ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-border bg-surface-2/80 px-3.5 py-3 text-center text-sm text-muted-foreground"
        >
          {socialNote}
        </div>
      ) : null}

      <AuthDivider label="Or register with email" />

      <Link href="/register/email" className="block">
        <Button type="button" size="lg" className="h-12 w-full rounded-full shadow-volt">
          <Mail className="h-4 w-4" aria-hidden />
          Continue with email
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </Link>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-volt-dim transition-colors hover:text-foreground"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
