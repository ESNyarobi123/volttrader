import { Module } from "@nestjs/common";
import { EnrollmentsModule } from "../enrollments/enrollments.module";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { QuizzesService } from "./quizzes.service";

@Module({
  imports: [EnrollmentsModule],
  controllers: [CoursesController],
  providers: [CoursesService, QuizzesService],
  exports: [CoursesService, QuizzesService],
})
export class CoursesModule {}
