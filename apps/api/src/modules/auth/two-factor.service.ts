import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import * as OTPAuth from "otpauth";
import { BRAND } from "@volt/config";

const ALGO = "aes-256-gcm";

/**
 * TOTP helpers + encrypted secret storage. Secrets are never logged or returned
 * after enable (only during setup).
 */
@Injectable()
export class TwoFactorService {
  constructor(private readonly config: ConfigService) {}

  private encryptionKey(): Buffer {
    const material =
      this.config.get<string>("JWT_ACCESS_SECRET") ??
      this.config.get<string>("PAYMENT_WEBHOOK_SECRET") ??
      "volt-dev-2fa-key";
    return createHash("sha256").update(material).digest();
  }

  encryptSecret(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.encryptionKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
  }

  decryptSecret(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new BadRequestException("Invalid 2FA secret payload");
    }
    const decipher = createDecipheriv(ALGO, this.encryptionKey(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  }

  generateSecret(label = "member"): { secret: string; otpauthUrl: string } {
    const totp = new OTPAuth.TOTP({
      issuer: BRAND.name,
      label,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });
    return {
      secret: totp.secret.base32,
      otpauthUrl: totp.toString(),
    };
  }

  /** Window ±1 step for clock skew. */
  verify(secretBase32: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: BRAND.name,
      label: "Volt Trades",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  verifyEncrypted(encryptedSecret: string | null | undefined, code: string): boolean {
    if (!encryptedSecret) return false;
    try {
      const plain = this.decryptSecret(encryptedSecret);
      return this.verify(plain, code);
    } catch {
      return false;
    }
  }

  /** Constant-time-ish compare for equal-length codes (defense in depth). */
  codesMatch(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
