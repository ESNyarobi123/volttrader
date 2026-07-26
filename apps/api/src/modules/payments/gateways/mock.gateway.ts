import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type {
  CreateIntentParams,
  CreateIntentResult,
  PaymentGateway,
  WebhookStatus,
  WebhookVerification,
} from "./payment-gateway.interface";
import { errorMessage } from "../../../common/errors";

const FAILED: WebhookVerification = { ok: false, eventId: "", providerRef: "", status: "FAILED" };

function normalizeStatus(value: unknown): WebhookStatus | null {
  const s = String(value ?? "").toUpperCase();
  if (s === "PAID" || s === "SUCCESS" || s === "SUCCESSFUL") return "PAID";
  if (s === "FAILED" || s === "FAILURE" || s === "CANCELLED") return "FAILED";
  if (s === "PENDING") return "PENDING";
  return null;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function secretsMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Development gateway. `createIntent` returns an in-app return URL that simulates
 * hosted checkout. `verifyWebhook` requires `x-volt-webhook-secret` matching
 * `PAYMENT_WEBHOOK_SECRET` — never trust an unsigned body.
 */
@Injectable()
export class MockGateway implements PaymentGateway {
  readonly id = "mock";
  private readonly logger = new Logger(MockGateway.name);

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
    if (!expected) {
      this.logger.error("Rejected mock webhook: PAYMENT_WEBHOOK_SECRET is not configured");
      return FAILED;
    }
    if (!provided || !secretsMatch(expected, provided)) {
      this.logger.warn("Rejected mock webhook: missing or mismatched webhook secret header");
      return FAILED;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : (rawBody as Record<string, unknown>);
    } catch (err) {
      this.logger.warn(`Rejected mock webhook: body is not valid JSON (${errorMessage(err)})`);
      return FAILED;
    }
    if (!parsed || typeof parsed !== "object") {
      this.logger.warn("Rejected mock webhook: body is not a JSON object");
      return FAILED;
    }

    const paymentReference = parsed.paymentReference;
    const eventId = parsed.eventId;
    const status = normalizeStatus(parsed.status);

    if (!paymentReference || !eventId || !status) {
      this.logger.warn(
        `Rejected mock webhook: unusable payload (paymentReference=${String(paymentReference)}, ` +
          `eventId=${String(eventId)}, status=${String(parsed.status)})`,
      );
      return FAILED;
    }

    return {
      ok: true,
      eventId: String(eventId),
      providerRef: String(paymentReference),
      status,
    };
  }
}
