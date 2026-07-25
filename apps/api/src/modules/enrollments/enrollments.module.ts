import { Module } from "@nestjs/common";
import { EnrollmentsController } from "./enrollments.controller";
import { EnrollmentsService } from "./enrollments.service";
import { CertificatesService } from "./certificates.service";

@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, CertificatesService],
  exports: [EnrollmentsService, CertificatesService],
})
export class EnrollmentsModule {}
