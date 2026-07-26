import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createConnection } from "node:net";
import { errorMessage, errorStack } from "../../common/errors";

export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Thin SMTP sender for Mailhog / real SMTP. Never logs message bodies that
 * contain tokens in production paths beyond a one-line status; in development
 * we also fall back to console when SMTP is unreachable. A production send
 * failure is an error the caller must handle, not a warning.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get isProduction(): boolean {
    return (this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV) === "production";
  }

  async send(params: SendMailParams): Promise<void> {
    const from = this.config.get<string>("MAIL_FROM") ?? "Volt Trades <no-reply@volttrades.local>";
    const smtpUrl = this.config.get<string>("SMTP_URL");

    if (!smtpUrl) {
      if (this.isProduction) {
        this.logger.error(`SMTP_URL is not configured; cannot send "${params.subject}"`);
        throw new ServiceUnavailableException("Email delivery is not configured");
      }
      this.logger.log(`[mail:noop] to=${params.to} subject=${params.subject}`);
      this.logger.debug(params.text);
      return;
    }

    try {
      await this.smtpSend(smtpUrl, from, params);
      this.logger.log(`Mail sent to ${params.to}: ${params.subject}`);
    } catch (err) {
      if (this.isProduction) {
        // The body carries reset/verification tokens, so it is never logged here;
        // the caller decides how to report an undelivered email.
        this.logger.error(
          `SMTP send failed for "${params.subject}": ${errorMessage(err)}`,
          errorStack(err),
        );
        throw new ServiceUnavailableException("Could not send the email. Please try again later.");
      }
      this.logger.warn(
        `SMTP send failed (${errorMessage(err)}); logging message for local recovery`,
      );
      this.logger.log(`[mail:fallback] to=${params.to} subject=${params.subject}\n${params.text}`);
    }
  }

  private smtpSend(smtpUrl: string, from: string, params: SendMailParams): Promise<void> {
    const url = new URL(smtpUrl);
    const host = url.hostname;
    const port = Number(url.port || 25);
    const fromAddr = extractEmail(from);
    const body = params.html
      ? [
          `From: ${from}`,
          `To: ${params.to}`,
          `Subject: ${params.subject}`,
          "MIME-Version: 1.0",
          'Content-Type: text/html; charset="utf-8"',
          "",
          params.html,
        ].join("\r\n")
      : [
          `From: ${from}`,
          `To: ${params.to}`,
          `Subject: ${params.subject}`,
          "Content-Type: text/plain; charset=utf-8",
          "",
          params.text,
        ].join("\r\n");

    return new Promise((resolve, reject) => {
      const socket = createConnection({ host, port }, () => {
        // wait for greeting
      });

      let buffer = "";
      let step = 0;
      const commands = [
        `EHLO volt.local`,
        `MAIL FROM:<${fromAddr}>`,
        `RCPT TO:<${params.to}>`,
        `DATA`,
        `${body}\r\n.`,
        `QUIT`,
      ];

      const writeNext = () => {
        if (step >= commands.length) return;
        socket.write(`${commands[step]}\r\n`);
        step += 1;
      };

      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => {
        buffer += chunk;
        while (buffer.includes("\r\n")) {
          const idx = buffer.indexOf("\r\n");
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const code = Number(line.slice(0, 3));
          if (!Number.isFinite(code)) continue;
          // Multiline replies end when the 4th char is a space.
          if (line.length >= 4 && line[3] === "-") continue;
          if (code >= 400) {
            socket.destroy();
            reject(new Error(line));
            return;
          }
          if (step < commands.length) writeNext();
          else {
            socket.end();
            resolve();
          }
        }
      });
      socket.on("error", reject);
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("SMTP timeout"));
      });
      socket.setTimeout(10_000);
    });
  }
}

function extractEmail(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return match ? match[1]! : value.trim();
}
