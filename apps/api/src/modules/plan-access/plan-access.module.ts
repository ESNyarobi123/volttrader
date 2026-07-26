import { Global, Module } from "@nestjs/common";
import { PlanAccessService } from "./plan-access.service";

@Global()
@Module({
  providers: [PlanAccessService],
  exports: [PlanAccessService],
})
export class PlanAccessModule {}
