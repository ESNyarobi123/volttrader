import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

/** Centered auth shell — card format (not split). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Soft atmospheric background (like the reference) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-volt/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-[hsl(0_0%_10%/0.22)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[hsl(142_65%_29%/0.1)] blur-3xl"
      />

      <div className="relative z-10 mb-7">
        <Logo />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">{children}</div>

      <p className="relative z-10 mt-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Mandanda Space. All rights reserved.{" "}
        <Link href="/risk-disclosure" className="underline-offset-2 hover:underline">
          Risk disclosure
        </Link>
      </p>
    </div>
  );
}
