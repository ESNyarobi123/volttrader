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

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
