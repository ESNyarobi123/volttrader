import { ConfigService } from "@nestjs/config";
import { MockGateway } from "./mock.gateway";

describe("MockGateway.verifyWebhook", () => {
  const secret = "dev_webhook_signing_secret_change_me";
  let gateway: MockGateway;

  beforeEach(() => {
    const config = {
      get: (key: string) => {
        if (key === "PAYMENT_WEBHOOK_SECRET") return secret;
        if (key === "SITE_URL") return "http://localhost:3001";
        return undefined;
      },
    } as unknown as ConfigService;
    gateway = new MockGateway(config);
  });

  it("rejects missing webhook secret", () => {
    const body = JSON.stringify({
      paymentReference: "PAY-1",
      eventId: "evt-1",
      status: "PAID",
    });
    expect(gateway.verifyWebhook(body, {}).ok).toBe(false);
  });

  it("rejects wrong webhook secret", () => {
    const body = JSON.stringify({
      paymentReference: "PAY-1",
      eventId: "evt-1",
      status: "PAID",
    });
    expect(
      gateway.verifyWebhook(body, { "x-volt-webhook-secret": "wrong-secret-value!!" }).ok,
    ).toBe(false);
  });

  it("accepts signed PAID payload", () => {
    const body = JSON.stringify({
      paymentReference: "PAY-abc",
      eventId: "evt-abc",
      status: "PAID",
    });
    const result = gateway.verifyWebhook(body, { "x-volt-webhook-secret": secret });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("PAID");
    expect(result.providerRef).toBe("PAY-abc");
    expect(result.eventId).toBe("evt-abc");
  });

  it("rejects incomplete payload even with secret", () => {
    const body = JSON.stringify({ paymentReference: "PAY-1", status: "PAID" });
    expect(
      gateway.verifyWebhook(body, { "x-volt-webhook-secret": secret }).ok,
    ).toBe(false);
  });
});
