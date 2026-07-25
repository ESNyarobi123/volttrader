import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { GatewayRegistry } from "./gateways/gateway.registry";
import { MockGateway } from "./gateways/mock.gateway";
import { FlutterwaveGateway } from "./gateways/flutterwave.gateway";

/**
 * Payments. Add a new gateway by implementing PaymentGateway, providing the
 * driver here, and wiring it into the GatewayRegistry constructor — callers
 * (deposits, checkouts, webhooks) stay untouched.
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, GatewayRegistry, MockGateway, FlutterwaveGateway],
  exports: [PaymentsService, GatewayRegistry],
})
export class PaymentsModule {}
