import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  CreateIntentParams,
  CreateIntentResult,
  PaymentGateway,
  WebhookStatus,
  WebhookVerification,
} from "./payment-gateway.interface";
import { FAILED_VERIFICATION, headerValue, secretsMatch } from "./webhook.utils";

function normalizeStatus(value: unknown): WebhookStatus | null {
  const s = String(value ?? "").toUpperCase();
  if (s === "PAID" || s === "SUCCESS" || s === "SUCCESSFUL") return "PAID";
  if (s === "FAILED" || s === "FAILURE" || s === "CANCELLED") return "FAILED";
  if (s === "PENDING") return "PENDING";
  return null;
}

/**
 * Development gateway. `createIntent` returns an in-app return URL that simulates
 * hosted checkout. `verifyWebhook` requires `x-volt-webhook-secret` matching
 * `PAYMENT_WEBHOOK_SECRET` — never trust an unsigned body.
 */
@Injectable()
export class MockGateway implements PaymentGateway {
  readonly id = "mock";

  constructor(private readonly config: ConfigService) {}

  async createIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const siteUrl =
      this.config.get<string>("SITE_URL") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3001";
    const base = siteUrl.replace(/\/$/, "");
    return {
      providerRef: `mock_${params.reference}`,
      checkoutUrl: `${base}/dashboard/payments/return?reference=${encodeURIComponent(params.reference)}`,
    };
  }

  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookVerification {
    const expected = this.config.get<string>("PAYMENT_WEBHOOK_SECRET") ?? "";
    const provided =
      headerValue(headers, "x-volt-webhook-secret") ?? headerValue(headers, "x-webhook-secret");
    if (!expected || !provided || !secretsMatch(expected, provided)) {
      return FAILED_VERIFICATION;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : (rawBody as Record<string, unknown>);
    } catch {
      return FAILED_VERIFICATION;
    }
    if (!parsed || typeof parsed !== "object") return FAILED_VERIFICATION;

    const paymentReference = parsed.paymentReference;
    const eventId = parsed.eventId;
    const status = normalizeStatus(parsed.status);

    if (!paymentReference || !eventId || !status) return FAILED_VERIFICATION;

    return {
      ok: true,
      eventId: String(eventId),
      providerRef: String(paymentReference),
      status,
    };
  }
}
