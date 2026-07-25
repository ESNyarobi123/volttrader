import { ConfigService } from "@nestjs/config";
import * as OTPAuth from "otpauth";
import { TwoFactorService } from "./two-factor.service";

describe("TwoFactorService", () => {
  let service: TwoFactorService;

  beforeEach(() => {
    const config = {
      get: (key: string) =>
        key === "JWT_ACCESS_SECRET" ? "test_access_secret_0123456789ab" : undefined,
    } as unknown as ConfigService;
    service = new TwoFactorService(config);
  });

  it("encrypts and decrypts secrets round-trip", () => {
    const plain = "JBSWY3DPEHPK3PXP";
    const enc = service.encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(service.decryptSecret(enc)).toBe(plain);
  });

  it("verifies a live TOTP code for a generated secret", () => {
    const { secret } = service.generateSecret();
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const code = totp.generate();
    expect(service.verify(secret, code)).toBe(true);
    expect(service.verify(secret, "000000")).toBe(false);
  });
});
