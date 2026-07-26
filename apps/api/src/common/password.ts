import type { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";

const DEFAULT_ROUNDS = 12;

/**
 * Hash a plaintext password with the configured cost.
 * Number(): ConfigService may return the raw env string; bcryptjs treats a
 * string second arg as a pre-made salt (not a cost), which throws.
 */
export function hashPassword(plain: string, config: ConfigService): Promise<string> {
  const rounds = Number(config.get("BCRYPT_SALT_ROUNDS"));
  return bcrypt.hash(plain, Number.isFinite(rounds) ? rounds : DEFAULT_ROUNDS);
}
