import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InvestmentsController } from "./investments.controller";
import { InvestmentsService } from "./investments.service";

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
