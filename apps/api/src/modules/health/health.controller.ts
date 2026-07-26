import { Controller, Get, Logger } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { errorMessage, errorStack } from "../../common/errors";

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async check() {
    let db = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      db = "down";
      this.logger.error(`Health check database probe failed: ${errorMessage(err)}`, errorStack(err));
    }
    return { status: db === "ok" ? "ok" : "degraded", db, ts: new Date().toISOString() };
  }
}
