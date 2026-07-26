import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { CoursePlansController } from "./course-plans.controller";
import { CoursePlansService } from "./course-plans.service";

@Module({
  imports: [PaymentsModule],
  controllers: [CoursePlansController],
  providers: [CoursePlansService],
  exports: [CoursePlansService],
})
export class CoursePlansModule {}
