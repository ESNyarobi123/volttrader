import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

// Money fields are BigInt in Prisma; API money DTOs use `toMoney()` (number).
// Fallback serializer for any accidental BigInt leak — prefer toMoney() paths.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this as unknown as bigint);
};

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({ trustProxy: true });
  // Disable Nest's default JSON parser so we can keep raw bytes for webhook HMAC.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: false,
    bodyParser: false,
  });

  const prefix = process.env.API_GLOBAL_PREFIX ?? "api";
  app.setGlobalPrefix(prefix);

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      const raw = Buffer.isBuffer(body) ? body.toString("utf8") : String(body ?? "");
      (req as FastifyRequest & { rawBody?: string }).rawBody = raw;
      try {
        const parsed = raw.length ? JSON.parse(raw) : {};
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    timeWindow: "1 minute",
    max: (req) => {
      const url = req.url ?? "";
      // Tighter budget for public webhook endpoints.
      if (url.includes("/payments/webhook/")) return 40;
      return 300;
    },
  });

  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  // Validation is done per-route with Zod (ZodValidationPipe) — see @volt/validation.
  // No global class-validator ValidationPipe: this project has no class-validator DTOs.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? "0.0.0.0";
  await app.listen(port, host);
  new Logger("Bootstrap").log(`Volt Trades API listening on http://${host}:${port}/${prefix}`);
}

void bootstrap();
