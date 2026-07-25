import { Body, Controller, Post } from "@nestjs/common";
import { Role } from "@volt/config";
import {
  storagePresignUploadSchema,
  type StoragePresignUploadInput,
} from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { StorageService } from "./storage.service";

@Controller("storage")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post("presign-upload")
  @Auth(Role.CONTENT_MANAGER, Role.SUPER_ADMIN, Role.COMPLIANCE_OFFICER)
  presignUpload(
    @Body(new ZodValidationPipe(storagePresignUploadSchema)) dto: StoragePresignUploadInput,
  ) {
    return this.storage.presignUpload(dto);
  }
}
