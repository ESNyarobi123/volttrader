import { CURRENCY_MINOR_UNITS, type Currency } from "@volt/config";
import type { LedgerEntryView, Money } from "@volt/types";
import { CHART_COLORS, MIX_PAIRS, type DonutDatum } from "@/components/charts/chart-theme";

/** Major units from Money (integer minor units). */
export function toMajor(money: Money): number {
  const minor = CURRENCY_MINOR_UNITS[money.currency as Currency] ?? 100;
  return money.amount / minor;
}

/** Compact axis label e.g. 1.2M / 45k. */
export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Last N UTC day keys, oldest → newest. */
export function lastDayKeys(n: number): string[] {
  const today = new Date();
  const midnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(midnight);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function shortLabel(isoDay: string) {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Daily credit / debit series from ledger rows (amounts in major units). */
export function buildCashflowSeries(entries: LedgerEntryView[], days = 14) {
  const keys = lastDayKeys(days);
  const credit = new Map(keys.map((k) => [k, 0]));
  const debit = new Map(keys.map((k) => [k, 0]));

  for (const e of entries) {
    const day = e.createdAt.slice(0, 10);
    if (!credit.has(day)) continue;
    const major = toMajor(e.amount);
    if (e.direction === "CREDIT") credit.set(day, (credit.get(day) ?? 0) + major);
    else debit.set(day, (debit.get(day) ?? 0) + major);
  }

  return keys.map((day) => ({
    day,
    label: shortLabel(day),
    credit: credit.get(day) ?? 0,
    debit: debit.get(day) ?? 0,
  }));
}

/** Ledger type breakdown for donut (major units). */
export function buildTypeDonut(entries: LedgerEntryView[]): DonutDatum[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const key = e.type;
    totals.set(key, (totals.get(key) ?? 0) + toMajor(e.amount));
  }
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], i) => ({
      name: name.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      value: Math.max(0, Math.round(value)),
      color: CHART_COLORS[i % CHART_COLORS.length],
      colorTo: MIX_PAIRS[i % MIX_PAIRS.length][1],
    }));
}

export function buildStatusDonut(counts: Record<string, number>): DonutDatum[] {
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({
      name: name.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
      colorTo: MIX_PAIRS[i % MIX_PAIRS.length][1],
    }));
}
