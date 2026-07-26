import { loadEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://volt:volt@localhost:5432/volt_trades?schema=public",
  JWT_ACCESS_SECRET: "dev_access_secret_change_me_0123456789abcdef",
  JWT_REFRESH_SECRET: "dev_refresh_secret_change_me_0123456789abcdef",
};

/** Production requires unique, non-placeholder values for every shared secret. */
const productionSecrets = {
  JWT_ACCESS_SECRET: "GBdgTf2s9RkQ0Xy7Lz4Nq8Wm1Vc6Jh3P",
  JWT_REFRESH_SECRET: "Yr5Kp1Zt8Nf3Bq6Ws0Xd4Lm7Cv2Jh9G",
  PAYMENT_WEBHOOK_SECRET: "Hq7Vt2Zr9Kd4Ns1Bp6Wm3Lc8Xf0Jy5T",
  S3_SECRET_ACCESS_KEY: "Tn4Xq8Kp2Vr7Zd1Bs6Wm9Lc3Jf0Hy5G",
};

describe("loadEnv", () => {
  it("forces ALLOW_MOCK_PAYMENTS off in production", () => {
    const env = loadEnv({
      ...base,
      ...productionSecrets,
      NODE_ENV: "production",
      PAYMENT_DEFAULT_GATEWAY: "flutterwave",
      FLUTTERWAVE_SECRET_KEY: "FLWSECK-live-abcdef",
      FLUTTERWAVE_WEBHOOK_HASH: "Wh3Kp8Zr1Vt6Nd2Bs9",
      ALLOW_MOCK_PAYMENTS: "true",
      FEATURE_REAL_MONEY_INVESTMENTS: "false",
    } as NodeJS.ProcessEnv);
    expect(env.ALLOW_MOCK_PAYMENTS).toBe(false);
  });

  it("rejects mock default gateway in production", () => {
    expect(() =>
      loadEnv({
        ...base,
        ...productionSecrets,
        NODE_ENV: "production",
        PAYMENT_DEFAULT_GATEWAY: "mock",
        ALLOW_MOCK_PAYMENTS: "false",
      } as NodeJS.ProcessEnv),
    ).toThrow(/mock is forbidden in production/i);
  });

  it("rejects placeholder secrets in production", () => {
    expect(() =>
      loadEnv({
        ...base,
        ...productionSecrets,
        JWT_ACCESS_SECRET: "change_me_access_secret_min_32_chars_long",
        NODE_ENV: "production",
        PAYMENT_DEFAULT_GATEWAY: "manual",
      } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects an unset webhook secret in production (default is publicly known)", () => {
    const { PAYMENT_WEBHOOK_SECRET: _omitted, ...secrets } = productionSecrets;
    expect(() =>
      loadEnv({
        ...base,
        ...secrets,
        NODE_ENV: "production",
        PAYMENT_DEFAULT_GATEWAY: "manual",
      } as NodeJS.ProcessEnv),
    ).toThrow(/PAYMENT_WEBHOOK_SECRET/);
  });

  it("rejects Flutterwave without a webhook hash in production", () => {
    expect(() =>
      loadEnv({
        ...base,
        ...productionSecrets,
        NODE_ENV: "production",
        PAYMENT_DEFAULT_GATEWAY: "flutterwave",
        FLUTTERWAVE_SECRET_KEY: "FLWSECK-live-abcdef",
      } as NodeJS.ProcessEnv),
    ).toThrow(/FLUTTERWAVE_WEBHOOK_HASH/);
  });

  it("allows mock gateway in development", () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: "development",
      PAYMENT_DEFAULT_GATEWAY: "mock",
      ALLOW_MOCK_PAYMENTS: "true",
      FEATURE_REAL_MONEY_INVESTMENTS: "true",
    } as NodeJS.ProcessEnv);
    expect(env.PAYMENT_DEFAULT_GATEWAY).toBe("mock");
    expect(env.ALLOW_MOCK_PAYMENTS).toBe(true);
    expect(env.FEATURE_REAL_MONEY_INVESTMENTS).toBe(true);
  });
});
