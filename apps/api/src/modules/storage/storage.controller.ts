import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import { ADMIN_ROLES } from "@volt/config";
import {
  storagePresignUploadSchema,
  type StoragePresignUploadInput,
} from "@volt/validation";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Auth } from "../../common/decorators/auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types";
import { StorageService } from "./storage.service";

@Controller("storage")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /** Any signed-in user may presign KYC uploads; staff may presign any purpose. */
  @Post("presign-upload")
  @Auth()
  presignUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(storagePresignUploadSchema)) dto: StoragePresignUploadInput,
  ) {
    const isStaff = (ADMIN_ROLES as string[]).includes(user.role);
    if (!isStaff && dto.purpose !== "kyc") {
      throw new ForbiddenException("Members may only upload KYC documents");
    }
    return this.storage.presignUpload(dto);
  }
}
