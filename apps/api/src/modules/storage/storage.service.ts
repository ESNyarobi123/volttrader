import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { StoragePresignUploadInput } from "@volt/validation";
import type { StoragePresignView } from "@volt/types";
import { errorMessage } from "../../common/errors";

const PURPOSE_PREFIX: Record<StoragePresignUploadInput["purpose"], string> = {
  lesson_video: "lessons",
  course_thumbnail: "thumbnails",
  certificate: "certificates",
  kyc: "kyc",
};

const PURPOSE_TYPES: Record<StoragePresignUploadInput["purpose"], RegExp> = {
  lesson_video: /^video\//i,
  course_thumbnail: /^image\//i,
  certificate: /^(application\/pdf|text\/html)$/i,
  kyc: /^image\//i,
};

@Injectable()
export class StorageService {
  /** Server-side ops (may use docker hostname `minio`). */
  private readonly client: S3Client;
  /** Presign with browser-reachable endpoint so SigV4 host matches. */
  private readonly signClient: S3Client;
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly publicBase: string;
  private bucketReady: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>("S3_ENDPOINT") ?? "http://localhost:9000";
    this.bucket = this.config.get<string>("S3_BUCKET") ?? "volt-trades";
    this.publicBase = (this.config.get<string>("S3_PUBLIC_URL") ?? `${endpoint}/${this.bucket}`).replace(
      /\/$/,
      "",
    );
    let publicOrigin = "http://localhost:9000";
    try {
      publicOrigin = new URL(this.publicBase).origin;
    } catch (err) {
      this.logger.warn(
        `S3_PUBLIC_URL ("${this.publicBase}") is not a valid URL (${errorMessage(err)}); ` +
          `presigning against ${publicOrigin} instead`,
      );
    }
    const credentials = {
      accessKeyId: this.config.get<string>("S3_ACCESS_KEY_ID") ?? "minio",
      secretAccessKey: this.config.get<string>("S3_SECRET_ACCESS_KEY") ?? "minio_dev_password",
    };
    const region = this.config.get<string>("S3_REGION") ?? "us-east-1";
    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials,
    });
    this.signClient = new S3Client({
      region,
      endpoint: publicOrigin,
      forcePathStyle: true,
      credentials,
    });
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        try {
          await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch (err) {
          // Only a missing bucket is recoverable by creating it. Credential,
          // permission and connectivity failures must not be masked as "create it".
          if (!isBucketMissing(err)) throw err;
          this.logger.log(`Bucket "${this.bucket}" not found; creating it`);
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        }
      })().catch((err: unknown) => {
        this.bucketReady = null;
        this.logger.error(`Object storage is unavailable: ${errorMessage(err)}`);
        throw err;
      });
    }
    await this.bucketReady;
  }

  async presignUpload(input: StoragePresignUploadInput): Promise<StoragePresignView> {
    if (!PURPOSE_TYPES[input.purpose].test(input.contentType)) {
      throw new BadRequestException(`Unsupported content type for ${input.purpose}`);
    }
    await this.ensureBucket();
    const key = `${PURPOSE_PREFIX[input.purpose]}/${randomUUID()}-${this.sanitizeFilename(input.filename)}`;
    const expiresInSeconds = 900;
    const uploadUrl = await getSignedUrl(
      this.signClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: input.contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
    return {
      key,
      uploadUrl,
      publicUrl: `${this.publicBase}/${key}`,
      expiresInSeconds,
    };
  }

  async presignGet(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!key?.trim()) throw new BadRequestException("Object key is required");
    await this.ensureBucket();
    return getSignedUrl(
      this.signClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  publicUrlFor(key: string | null | undefined): string | null {
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key;
    return `${this.publicBase}/${key.replace(/^\//, "")}`;
  }
}

/** True only when S3 reports the bucket itself is absent (404 / NotFound). */
function isBucketMissing(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: string }).name;
  if (name === "NotFound" || name === "NoSuchBucket") return true;
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return status === 404;
}
