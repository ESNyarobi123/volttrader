import { ArgumentsHost, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function buildHost(): { host: ArgumentsHost; sent: { status?: number; body?: unknown } } {
  const sent: { status?: number; body?: unknown } = {};
  const reply = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    send(body: unknown) {
      sent.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ method: "POST", url: "/api/users", id: "req-1" }),
    }),
  } as unknown as ArgumentsHost;
  return { host, sent };
}

type Envelope = { error: { code: string; message: string } };

describe("AllExceptionsFilter", () => {
  it("keeps the code and status of an HttpException", () => {
    const { host, sent } = buildHost();
    new AllExceptionsFilter().catch(new ConflictException("Email already used"), host);
    expect(sent.status).toBe(409);
    expect((sent.body as Envelope).error.code).toBe("CONFLICT");
  });

  it("maps a Prisma unique violation to 409 instead of 500", () => {
    const { host, sent } = buildHost();
    new AllExceptionsFilter().catch(
      new Prisma.PrismaClientKnownRequestError("unique failed", {
        code: "P2002",
        clientVersion: "5.22.0",
      }),
      host,
    );
    expect(sent.status).toBe(409);
    expect((sent.body as Envelope).error.code).toBe("CONFLICT");
  });

  it("maps a Prisma missing record to 404", () => {
    const { host, sent } = buildHost();
    new AllExceptionsFilter().catch(
      new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "5.22.0",
      }),
      host,
    );
    expect(sent.status).toBe(404);
    expect((sent.body as Envelope).error.code).toBe("NOT_FOUND");
  });

  it("never leaks an unknown error as anything but INTERNAL_ERROR", () => {
    const { host, sent } = buildHost();
    new AllExceptionsFilter().catch({ weird: true }, host);
    expect(sent.status).toBe(500);
    expect((sent.body as Envelope).error.code).toBe("INTERNAL_ERROR");
  });
});
