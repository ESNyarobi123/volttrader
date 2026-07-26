import { CURRENCY_MINOR_UNITS, type Currency } from "@volt/config";
import type { Money } from "@volt/types";

/** Format a Money value (integer minor units) into a human string, e.g. "TZS 49,000". */
export function formatMoney(money: Money): string {
  const minor = CURRENCY_MINOR_UNITS[money.currency as Currency] ?? 100;
  const major = money.amount / minor;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(major);
  return `${money.currency} ${formatted}`;
}

/** Convert a major-unit user input (e.g. "49000") to integer minor units. */
export function toMinorUnits(major: number, currency: Currency): number {
  const minor = CURRENCY_MINOR_UNITS[currency] ?? 100;
  return Math.round(major * minor);
}

/** Convert integer minor units back to major units for editable form inputs. */
export function fromMinorUnits(amount: number, currency: Currency): number {
  const minor = CURRENCY_MINOR_UNITS[currency] ?? 100;
  return amount / minor;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Date + time, e.g. "04 Mar 2025, 14:32". Pass `seconds` for audit-grade precision. */
export function formatDateTime(
  iso: string | null | undefined,
  options: { seconds?: boolean } = {},
): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.seconds ? { second: "2-digit" as const } : {}),
  });
}

/** Day + time without the year, e.g. "04 Mar, 14:32" — for recent activity lists. */
export function formatDayTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Time of day only, e.g. "14:32". */
export function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** URL-safe slug derived from a title, trimmed to `maxLength` characters. */
export function slugify(value: string, maxLength = 160): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);
}

/** Up to two uppercase initials for avatars, falling back to the brand mark. */
export function initials(name: string | null | undefined, fallback = "VT"): string {
  if (!name?.trim()) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

/** Split a textarea value into a trimmed, non-empty, capped list of lines. */
export function linesFromText(text: string, max = 20): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Resolve a stored object key (or absolute URL) to a browser-loadable URL.
 * Returns null when the key cannot be served publicly.
 */
export function resolveStorageUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl) return null;
  if (/^https?:\/\//i.test(keyOrUrl)) return keyOrUrl;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return `${base}/${keyOrUrl.replace(/^\//, "")}`;
  return null;
}
