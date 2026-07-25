import { loadEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://volt:volt@localhost:5432/volt_trades?schema=public",
  JWT_ACCESS_SECRET: "dev_access_secret_change_me_0123456789abcdef",
  JWT_REFRESH_SECRET: "dev_refresh_secret_change_me_0123456789abcdef",
};

describe("loadEnv", () => {
  it("forces ALLOW_MOCK_PAYMENTS off in production", () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: "production",
      PAYMENT_DEFAULT_GATEWAY: "flutterwave",
      ALLOW_MOCK_PAYMENTS: "true",
      FEATURE_REAL_MONEY_INVESTMENTS: "false",
    } as NodeJS.ProcessEnv);
    expect(env.ALLOW_MOCK_PAYMENTS).toBe(false);
  });

  it("rejects mock default gateway in production", () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: "production",
        PAYMENT_DEFAULT_GATEWAY: "mock",
        ALLOW_MOCK_PAYMENTS: "false",
      } as NodeJS.ProcessEnv),
    ).toThrow(/mock is forbidden in production/i);
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
