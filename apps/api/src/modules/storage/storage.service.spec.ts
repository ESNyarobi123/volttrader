import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";

describe("StorageService", () => {
  const config = {
    get: (key: string) => {
      const map: Record<string, string> = {
        S3_ENDPOINT: "http://localhost:9000",
        S3_BUCKET: "volt-trades",
        S3_PUBLIC_URL: "http://localhost:9000/volt-trades",
        S3_ACCESS_KEY_ID: "minio",
        S3_SECRET_ACCESS_KEY: "minio_dev_password",
        S3_REGION: "us-east-1",
      };
      return map[key];
    },
  } as unknown as ConfigService;

  it("rejects wrong content types for lesson video", async () => {
    const storage = new StorageService(config);
    await expect(
      storage.presignUpload({
        purpose: "lesson_video",
        filename: "notes.txt",
        contentType: "text/plain",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
