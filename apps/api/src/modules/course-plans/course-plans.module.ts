import { Module } from "@nestjs/common";
import { CoursePlansController } from "./course-plans.controller";
import { CoursePlansService } from "./course-plans.service";

@Module({
  controllers: [CoursePlansController],
  providers: [CoursePlansService],
  exports: [CoursePlansService],
})
export class CoursePlansModule {}
