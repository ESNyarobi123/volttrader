"use client";

import { cn } from "@/lib/utils";

type Provider = "google" | "apple" | "facebook";

/** Clean circular brand marks for social auth. */
function BrandMark({ provider }: { provider: Provider }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    );
  }

  if (provider === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path
          fill="#fff"
          d="M13.5 18.5v-5.1h1.7l.3-2h-2v-1.3c0-.6.2-1 1-1h1.1V7.2c-.2 0-.9-.1-1.7-.1-1.7 0-2.9 1-2.9 2.9V11.4H9.3v2h1.7v5.1h2.5z"
        />
      </svg>
    );
  }

  // Apple
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground" fill="currentColor" aria-hidden>
      <path d="M16.7 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1 1-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.1 1.7 2.4 3 2.3 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.7c1.3 0 2.1-1.1 2.9-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.5-1-2.7-3.9zM14.5 5.5c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.9-.9 3 1 .1 2-.5 2.6-1.4z" />
    </svg>
  );
}

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
  { id: "facebook", label: "Facebook" },
];

/**
 * Social sign-in buttons (UI). OAuth providers are not wired in the API yet —
 * clicking shows a clear message so the flow stays honest.
 */
export function SocialAuthButtons({
  onUnavailable,
  className,
}: {
  onUnavailable?: (provider: Provider) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <p className="text-xs font-medium text-muted-foreground">Sign in with</p>
      <div className="flex items-center justify-center gap-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onUnavailable?.(p.id)}
            aria-label={`Continue with ${p.label}`}
            className={cn(
              "grid h-12 w-12 place-items-center rounded-full border border-border bg-surface shadow-sm",
              "transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt",
            )}
          >
            <BrandMark provider={p.id} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function AuthDivider({ label = "Or continue with email" }: { label?: string }) {
  return (
    <div className="relative my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
