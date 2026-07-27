import Image from "next/image";
import Link from "next/link";
import { BRAND_ICON_3D, BRAND_NAME, BRAND_SHORT } from "@/lib/brand";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  href?: string;
  /** Show full “Mandanda Space” (default) or short “Mandanda”. */
  short?: boolean;
  /** Light text for crimson headers. */
  onDark?: boolean;
  /** Icon-only mark. */
  markOnly?: boolean;
  size?: "sm" | "md" | "lg";
};

const ICON = {
  sm: 28,
  md: 36,
  lg: 44,
} as const;

/**
 * Mandanda Space wordmark + 3D rocket mark.
 * Prefer this over inline Zap branding.
 */
export function Logo({
  className,
  href = "/",
  short = false,
  onDark = false,
  markOnly = false,
  size = "md",
}: LogoProps) {
  const px = ICON[size];
  const label = short ? BRAND_SHORT : BRAND_NAME;

  const inner = (
    <>
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.4)] ring-1 ring-black/5",
          size === "sm" && "h-8 w-8 rounded-xl",
          size === "md" && "h-10 w-10",
          size === "lg" && "h-11 w-11",
        )}
      >
        <Image
          src={BRAND_ICON_3D}
          alt=""
          width={px}
          height={px}
          className="h-[82%] w-[82%] object-contain"
          priority
        />
      </span>
      {!markOnly ? (
        <span
          className={cn(
            "font-display font-bold tracking-tight",
            size === "sm" && "text-base",
            size === "md" && "text-lg",
            size === "lg" && "text-xl",
            onDark ? "text-white" : "text-foreground",
          )}
        >
          {short ? (
            label
          ) : (
            <>
              Mandanda{" "}
              <span className={onDark ? "font-semibold text-white/85" : "font-semibold text-volt-dim"}>
                Space
              </span>
            </>
          )}
        </span>
      ) : null}
    </>
  );

  if (!href) {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)} aria-label={BRAND_NAME}>
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5 font-bold tracking-tight", className)}
      aria-label={BRAND_NAME}
    >
      {inner}
    </Link>
  );
}

/** Compact 3D mark for tight headers (no wordmark). */
export function BrandMark({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "grid place-items-center overflow-hidden rounded-2xl bg-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.4)] ring-1 ring-white/40",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={BRAND_ICON_3D}
        alt={BRAND_NAME}
        width={size}
        height={size}
        className="h-[82%] w-[82%] object-contain"
        priority
      />
    </span>
  );
}
