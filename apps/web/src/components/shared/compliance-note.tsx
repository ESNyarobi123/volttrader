import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Subtle compliance footnote wherever projections/targets are shown.
 * Never use a loud warning banner for this — it cheapens the UI and
 * Volt NEVER presents guaranteed returns either way.
 */
export function ProjectionDisclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-center text-[11px] leading-relaxed text-muted-foreground md:text-left",
        className,
      )}
    >
      Projections are illustrative targets —{" "}
      <span className="font-medium text-foreground/70">not a guarantee</span> of returns.{" "}
      <Link
        href="/risk-disclosure"
        className="font-medium text-foreground/80 underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
      >
        Risk disclosure
      </Link>
    </p>
  );
}
