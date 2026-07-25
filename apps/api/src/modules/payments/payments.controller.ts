import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { PaymentStatus, PaymentType, UserRole } from "@prisma/client";
import { Role } from "@volt/config";
import {
  adminCreatePaymentSchema,
  adminUpdatePaymentSchema,
  courseCheckoutSchema,
  depositSchema,
  manualDepositSchema,
  mockPaymentSimulateSchema,
  type AdminCreatePaymentInput,
  type AdminUpdatePaymentInput,
  type CourseCheckoutInput,
  type DepositInput,
  type ManualDepositInput,
  type MockPaymentSimulateInput,
} from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PaymentsService } from "./payments.service";

const FINANCE_ROLES = [Role.FINANCE_ADMIN, Role.SUPER_ADMIN] as const;

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Admin-published mobile money / bank details for manual deposits. */
  @Get("deposit-methods")
  @Auth()
  depositMethods() {
    return this.payments.getDepositMethods();
  }

  /** Start a wallet deposit — returns a checkout URL. */
  @Post("deposit")
  @Auth()
  deposit(
    @Body(new ZodValidationPipe(depositSchema)) dto: DepositInput,
    @CurrentUser("id") userId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.createDeposit(userId, dto, req.ip);
  }

  /** Report a completed bank/MM transfer — credits after finance confirmation. */
  @Post("deposit/manual")
  @Auth()
  manualDeposit(
    @Body(new ZodValidationPipe(manualDepositSchema)) dto: ManualDepositInput,
    @CurrentUser("id") userId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.createManualDeposit(userId, dto, req.ip);
  }

  /** Finance confirms a manual deposit and credits the ledger. */
  @Post(":id/confirm-manual")
  @Auth(...FINANCE_ROLES)
  confirmManual(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.confirmManualDeposit(id, actorId, req.ip);
  }

  /** Buy a course (from wallet balance or a fresh payment intent). */
  @Post("course-checkout")
  @Auth()
  courseCheckout(
    @Body(new ZodValidationPipe(courseCheckoutSchema)) dto: CourseCheckoutInput,
    @CurrentUser("id") userId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.createCourseCheckout(userId, dto, req.ip);
  }

  /** Admin — create a payment intent for a user (still confirmed via webhook). */
  @Post("admin")
  @Auth(...FINANCE_ROLES)
  adminCreate(
    @Body(new ZodValidationPipe(adminCreatePaymentSchema)) dto: AdminCreatePaymentInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.adminCreate(actorId, dto, req.ip);
  }

  /**
   * Dev-only mock checkout helper (auth required). Settles via signed webhook path.
   * Disabled when ALLOW_MOCK_PAYMENTS is false (always in production).
   */
  @Post("mock/simulate")
  @Auth()
  simulateMock(
    @Body(new ZodValidationPipe(mockPaymentSimulateSchema)) dto: MockPaymentSimulateInput,
    @CurrentUser("id") userId: string,
    @CurrentUser("role") role: UserRole,
  ) {
    return this.payments.simulateMockPayment(userId, role, dto);
  }

  /**
   * Provider callback. Public, but the gateway driver verifies the signature —
   * the frontend can NEVER confirm a payment. Idempotent by (gateway, eventId).
   */
  @Post("webhook/:gateway")
  @Public()
  @HttpCode(200)
  webhook(@Param("gateway") gateway: string, @Req() req: FastifyRequest & { rawBody?: string }) {
    // Prefer exact request bytes (HMAC-safe). Fallback only if parser did not attach rawBody.
    const rawBody =
      typeof req.rawBody === "string" && req.rawBody.length > 0
        ? req.rawBody
        : JSON.stringify(req.body ?? {});
    return this.payments.handleWebhook(gateway, rawBody, req.headers);
  }

  /** The signed-in user's payments. */
  @Get("me")
  @Auth()
  mine(@CurrentUser("id") userId: string) {
    return this.payments.listMine(userId);
  }

  /** Admin — all payments, filterable by status/type. */
  @Get()
  @Auth(...FINANCE_ROLES)
  listAll(
    @Query("status") status?: PaymentStatus,
    @Query("type") type?: PaymentType,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return this.payments.listAll({ status, type }, pageNum, size);
  }

  @Get(":id")
  @Auth()
  getOne(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
    @CurrentUser("role") role: UserRole,
  ) {
    return this.payments.getById(id, userId, role);
  }

  @Patch(":id")
  @Auth(...FINANCE_ROLES)
  adminUpdate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminUpdatePaymentSchema)) dto: AdminUpdatePaymentInput,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.adminUpdate(id, actorId, dto, req.ip);
  }

  @Delete(":id")
  @Auth(...FINANCE_ROLES)
  adminDelete(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.adminDelete(id, actorId, req.ip);
  }
}
