import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { errorMessage, errorStack } from "../errors";

/** Shapes every error into a consistent envelope: { error: { code, message, details? } }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === "string") {
        message = response;
        code = codeFromStatus(status);
      } else if (response && typeof response === "object") {
        const r = response as Record<string, unknown>;
        code = (r.code as string) ?? codeFromStatus(status);
        message = (r.message as string) ?? message;
        details = r.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Without this mapping every constraint violation surfaced as a 500 with a
      // raw Prisma message, so clients could not tell a conflict from an outage.
      const mapped = fromPrismaError(exception);
      status = mapped.status;
      code = mapped.code;
      message = mapped.message;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = "BAD_REQUEST";
      message = "Invalid request data";
    } else if (exception instanceof Error) {
      message = process.env.NODE_ENV === "production" ? "Something went wrong" : exception.message;
    }

    const route = `${request.method} ${request.url}`;
    if (status >= 500) {
      this.logger.error(
        `${route} -> ${status} ${code}: ${errorMessage(exception)}`,
        errorStack(exception),
      );
    } else {
      // Keeps handled rejections (validation, auth, conflicts) traceable without noise.
      this.logger.debug(`${route} -> ${status} ${code}: ${message}`);
    }

    void reply.status(status).send({
      error: { code, message, details, requestId: request.id },
    });
  }
}

function fromPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  status: number;
  code: string;
  message: string;
} {
  switch (err.code) {
    case "P2002":
      return {
        status: HttpStatus.CONFLICT,
        code: "CONFLICT",
        message: "A record with these details already exists",
      };
    case "P2025":
      return { status: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Record not found" };
    case "P2003":
      return {
        status: HttpStatus.BAD_REQUEST,
        code: "BAD_REQUEST",
        message: "Related record does not exist",
      };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: "INTERNAL_ERROR",
        message: "Something went wrong",
      };
  }
}

function codeFromStatus(status: number): string {
  const map: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE",
    429: "RATE_LIMITED",
  };
  return map[status] ?? "ERROR";
}
