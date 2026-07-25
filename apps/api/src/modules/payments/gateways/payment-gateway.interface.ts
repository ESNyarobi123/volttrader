import type { Currency, PaymentType } from "@prisma/client";

/**
 * Payment gateway abstraction. Concrete drivers (mock, flutterwave, pesapal,
 * stripe, …) implement this interface and are registered in the
 * {@link GatewayRegistry}. Callers only ever talk to the interface, so adding a
 * new provider never touches the wallet/payments services.
 */

export interface CreateIntentParams {
  userId: string;
  amount: bigint; // positive minor units
  currency: Currency;
  /** Our own Payment.reference — the idempotent handle for this intent. */
  reference: string;
  type: PaymentType;
  metadata?: Record<string, unknown>;
  /** Customer fields some hosted checkouts require. */
  customer?: { email?: string | null; name?: string | null; phone?: string | null };
}

export interface CreateIntentResult {
  /** The provider's identifier for the intent (stored on Payment.providerRef). */
  providerRef: string;
  /** Hosted checkout URL the client is redirected to, or null for silent flows. */
  checkoutUrl: string | null;
}

export type WebhookStatus = "PAID" | "FAILED" | "PENDING";

export interface WebhookVerification {
  /** False when the signature/payload could not be verified — never settle then. */
  ok: boolean;
  /** Provider event id — used with the gateway id to guard against replays. */
  eventId: string;
  /** Reference used to resolve the Payment (matches reference or providerRef). */
  providerRef: string;
  status: WebhookStatus;
}

export interface PaymentGateway {
  /** Stable id, e.g. "mock", "flutterwave". Matches PAYMENT_DEFAULT_GATEWAY. */
  readonly id: string;

  createIntent(params: CreateIntentParams): Promise<CreateIntentResult>;

  /**
   * Verify an incoming webhook. MUST be the ONLY place a payment is confirmed.
   * `rawBody` is the unparsed request body; `headers` carries the signature.
   */
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookVerification;
}

/** Injection token collecting every concrete gateway driver. */
export const PAYMENT_GATEWAYS = Symbol("PAYMENT_GATEWAYS");
