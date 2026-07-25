import { Module } from "@nestjs/common";
import { InvestmentPlansController } from "./investment-plans.controller";
import { InvestmentPlansService } from "./investment-plans.service";

@Module({
  controllers: [InvestmentPlansController],
  providers: [InvestmentPlansService],
  exports: [InvestmentPlansService],
})
export class InvestmentPlansModule {}
