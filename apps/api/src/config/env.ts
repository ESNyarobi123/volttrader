import { z } from "zod";

/** Validated environment. Fails fast at boot if a required var is missing/invalid. */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),

  API_PORT: z.coerce.number().int().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  API_GLOBAL_PREFIX: z.string().default("api"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().default(900),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_TTL: z.coerce.number().int().default(1209600),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().default("minio"),
  S3_SECRET_ACCESS_KEY: z.string().default("minio_dev_password"),
  S3_BUCKET: z.string().default("volt-trades"),
  S3_PUBLIC_URL: z.string().default("http://localhost:9000/volt-trades"),

  PAYMENT_DEFAULT_GATEWAY: z.string().default("mock"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default("dev_webhook_secret"),
  DEFAULT_CURRENCY: z.string().default("USD"),
  /** Optional Flutterwave keys — when set, gateway id `flutterwave` is available. */
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
  FLUTTERWAVE_BASE_URL: z.string().url().default("https://api.flutterwave.com"),
  /**
   * Dev helper: authenticated mock checkout simulate. Always forced off when
   * NODE_ENV=production regardless of the env value.
   */
  ALLOW_MOCK_PAYMENTS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  /** Public site origin for email links + mock checkout return URLs. */
  SITE_URL: z.string().url().default("http://localhost:3001"),
  MAIL_FROM: z.string().default("Volt Trades <no-reply@volttrades.local>"),
  /** Optional — when unset, MailService logs instead of sending. */
  SMTP_URL: z.string().optional(),

  FEATURE_REAL_MONEY_INVESTMENTS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const data = parsed.data;
  // Hard stop: never allow mock settlement helpers in production.
  if (data.NODE_ENV === "production") {
    data.ALLOW_MOCK_PAYMENTS = false;
    if (data.PAYMENT_DEFAULT_GATEWAY === "mock") {
      throw new Error(
        "Invalid environment configuration:\n  - PAYMENT_DEFAULT_GATEWAY: mock is forbidden in production. Configure a real gateway.",
      );
    }
  }
  return data;
}

/** Nest ConfigModule factory. */
export const configFactory = () => loadEnv();
