import type { Currency } from "@prisma/client";

/**
 * Money helpers. Amounts are integer minor units (BigInt in DB, number over the wire).
 * NEVER do arithmetic on floats for money.
 */
export interface Money {
  amount: number;
  currency: Currency;
}

/** Convert a BigInt minor-unit amount + currency into the wire shape. */
export function toMoney(amount: bigint, currency: Currency): Money {
  return { amount: Number(amount), currency };
}

/** Compute a projected value from a principal and a decimal multiplier (as string/number). */
export function applyMultiplier(principalMinor: bigint, multiplier: number): bigint {
  // multiplier has up to 4 decimals; scale to avoid float drift.
  const scaled = Math.round(multiplier * 10_000);
  return (principalMinor * BigInt(scaled)) / 10_000n;
}

export function assertPositive(amount: number, label = "amount"): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive integer in minor units`);
  }
}
