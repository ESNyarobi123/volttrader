import { timingSafeEqual } from "node:crypto";
import type { WebhookVerification } from "./payment-gateway.interface";

/** Rejection result returned whenever a webhook cannot be trusted. */
export const FAILED_VERIFICATION: WebhookVerification = {
  ok: false,
  eventId: "",
  providerRef: "",
  status: "FAILED",
};

/** Read a header case-insensitively, collapsing repeated headers to the first value. */
export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/** Constant-time secret comparison — never use `===` on webhook secrets. */
export function secretsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
