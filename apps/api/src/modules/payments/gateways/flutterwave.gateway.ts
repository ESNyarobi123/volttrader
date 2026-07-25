import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import { CURRENCY_MINOR_UNITS, type Currency } from "@volt/config";
import type {
  CreateIntentParams,
  CreateIntentResult,
  PaymentGateway,
  WebhookStatus,
  WebhookVerification,
} from "./payment-gateway.interface";

const FAILED: WebhookVerification = { ok: false, eventId: "", providerRef: "", status: "FAILED" };

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

function mapStatus(value: unknown): WebhookStatus | null {
  const s = String(value ?? "").toLowerCase();
  if (s === "successful" || s === "success" || s === "paid") return "PAID";
  if (s === "failed" || s === "cancelled" || s === "canceled" || s === "error") return "FAILED";
  if (s === "pending") return "PENDING";
  return null;
}

/**
 * Flutterwave hosted checkout. Configured only when FLUTTERWAVE_SECRET_KEY is set.
 * Secrets never leave env — admin only toggles whether online deposits are offered.
 */
@Injectable()
export class FlutterwaveGateway implements PaymentGateway {
  readonly id = "flutterwave";
  private readonly logger = new Logger(FlutterwaveGateway.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const key = this.config.get<string>("FLUTTERWAVE_SECRET_KEY")?.trim();
    return Boolean(key);
  }

  async createIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const secret = this.config.get<string>("FLUTTERWAVE_SECRET_KEY")?.trim();
    if (!secret) {
      throw new BadRequestException(
        "Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY (and webhook hash) in the server environment.",
      );
    }

    const email = params.customer?.email?.trim();
    if (!email) {
      throw new BadRequestException("A verified email is required for online checkout");
    }

    const minor = CURRENCY_MINOR_UNITS[params.currency as Currency] ?? 100;
    const major = Number(params.amount) / minor;
    if (!Number.isFinite(major) || major <= 0) {
      throw new BadRequestException("Invalid payment amount");
    }

    const siteUrl = (this.config.get<string>("SITE_URL") ?? "http://localhost:3001").replace(
      /\/$/,
      "",
    );
    const base =
      this.config.get<string>("FLUTTERWAVE_BASE_URL")?.replace(/\/$/, "") ??
      "https://api.flutterwave.com";

    const body = {
      tx_ref: params.reference,
      amount: major,
      currency: params.currency,
      redirect_url: `${siteUrl}/dashboard/payments/return?reference=${encodeURIComponent(params.reference)}`,
      customer: {
        email,
        name: params.customer?.name?.trim() || "Volt Member",
        phonenumber: params.customer?.phone?.trim() || undefined,
      },
      customizations: {
        title: "Volt Trades",
        description: `Wallet deposit ${params.reference}`,
      },
      meta: {
        userId: params.userId,
        type: params.type,
      },
    };

    const res = await fetch(`${base}/v3/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as {
      status?: string;
      message?: string;
      data?: { link?: string; id?: string | number };
    } | null;

    if (!res.ok || json?.status !== "success" || !json.data?.link) {
      this.logger.warn(`Flutterwave createIntent failed: ${json?.message ?? res.status}`);
      throw new BadRequestException(
        json?.message ?? "Could not start Flutterwave checkout. Check gateway credentials.",
      );
    }

    return {
      providerRef: String(json.data.id ?? params.reference),
      checkoutUrl: json.data.link,
    };
  }

  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookVerification {
    const expected = this.config.get<string>("FLUTTERWAVE_WEBHOOK_HASH")?.trim() ?? "";
    const provided = headerValue(headers, "verif-hash");
    if (!expected || !provided || !secretsMatch(expected, provided)) {
      return FAILED;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return FAILED;
    }

    const data = (parsed.data ?? parsed) as Record<string, unknown>;
    const txRef = data.tx_ref ?? data.txRef ?? parsed.tx_ref;
    const eventId = data.id ?? data.flw_ref ?? parsed.id ?? txRef;
    const status = mapStatus(data.status);

    if (!txRef || !eventId || !status) return FAILED;

    return {
      ok: true,
      eventId: String(eventId),
      providerRef: String(txRef),
      status,
    };
  }
}
