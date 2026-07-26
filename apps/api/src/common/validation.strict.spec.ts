import { depositSchema, loginSchema, mockPaymentSimulateSchema } from "@volt/validation";

describe("strict DTO schemas (@volt/validation)", () => {
  it("rejects unknown fields on login", () => {
    const result = loginSchema.safeParse({
      identifier: "a@b.com",
      password: "x",
      extra: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields on deposit", () => {
    const result = depositSchema.safeParse({
      amount: 1000,
      currency: "USD",
      hackerField: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid mock simulate payload", () => {
    const result = mockPaymentSimulateSchema.safeParse({
      reference: "PAY-123",
      status: "PAID",
    });
    expect(result.success).toBe(true);
  });
});
