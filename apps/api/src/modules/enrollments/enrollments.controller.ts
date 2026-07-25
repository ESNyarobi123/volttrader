import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { lessonProgressSchema } from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { EnrollmentsService } from "./enrollments.service";
import { CertificatesService } from "./certificates.service";

const enrollSchema = z.object({ courseId: z.string().min(1) });
type EnrollInput = z.infer<typeof enrollSchema>;
type LessonProgressInput = z.infer<typeof lessonProgressSchema>;

@Controller("enrollments")
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly certificates: CertificatesService,
  ) {}

  @Get("me")
  @Auth()
  listMine(@CurrentUser("id") userId: string) {
    return this.enrollments.listMine(userId);
  }

  @Get("certificates")
  @Auth()
  listCertificates(@CurrentUser("id") userId: string) {
    return this.certificates.listMine(userId);
  }

  @Get("certificates/:id")
  @Auth()
  getCertificate(@Param("id") id: string, @CurrentUser("id") userId: string) {
    return this.certificates.getDownload(userId, id);
  }

  @Post()
  @Auth()
  enroll(
    @Body(new ZodValidationPipe(enrollSchema)) dto: EnrollInput,
    @CurrentUser("id") userId: string,
  ) {
    return this.enrollments.enroll(userId, dto.courseId);
  }

  @Post("progress")
  @Auth()
  recordProgress(
    @Body(new ZodValidationPipe(lessonProgressSchema)) dto: LessonProgressInput,
    @CurrentUser("id") userId: string,
  ) {
    return this.enrollments.recordProgress(userId, dto);
  }
}
