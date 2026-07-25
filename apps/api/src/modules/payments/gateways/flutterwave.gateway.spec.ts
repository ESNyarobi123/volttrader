import { ConfigService } from "@nestjs/config";
import { FlutterwaveGateway } from "./flutterwave.gateway";

describe("FlutterwaveGateway.verifyWebhook", () => {
  const hash = "volt_flw_webhook_hash_test_01";
  let gateway: FlutterwaveGateway;

  beforeEach(() => {
    const config = {
      get: (key: string) => (key === "FLUTTERWAVE_WEBHOOK_HASH" ? hash : undefined),
    } as unknown as ConfigService;
    gateway = new FlutterwaveGateway(config);
  });

  it("rejects missing or wrong verif-hash", () => {
    const body = JSON.stringify({
      data: { id: 1, tx_ref: "PAY-1", status: "successful" },
    });
    expect(gateway.verifyWebhook(body, {}).ok).toBe(false);
    expect(gateway.verifyWebhook(body, { "verif-hash": "wrong" }).ok).toBe(false);
  });

  it("accepts signed successful charge", () => {
    const body = JSON.stringify({
      event: "charge.completed",
      data: { id: 99, tx_ref: "PAY-ABC", status: "successful" },
    });
    const result = gateway.verifyWebhook(body, { "verif-hash": hash });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("PAID");
    expect(result.providerRef).toBe("PAY-ABC");
    expect(result.eventId).toBe("99");
  });
});
