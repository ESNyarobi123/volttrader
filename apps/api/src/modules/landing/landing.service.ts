import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { LandingPageView } from "@volt/types";
import type { LandingPageUpdateInput } from "@volt/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const DEFAULT_STATS: LandingPageView["stats"] = [
  { value: "Learn", label: "Forex Academy" },
  { value: "Invest", label: "Account Management" },
  { value: "Wallet", label: "Wallet balance" },
  { value: "Society", label: "Volt community" },
];

const DEFAULT_LANDING = {
  id: "default",
  heroYoutubeId: "nMzMlm-F_yA",
  heroEyebrow: "LEARN · INVEST · BUILD",
  heroHeadline: "Learn Forex. Manage capital.",
  heroHeadlineAccent: "Explore opportunities.",
  heroSubcopy:
    "Volt Trades brings education, wallet, and curated trading opportunities into one simple ecosystem — powerful inside, clear outside.",
  ctaPrimaryLabel: "Sign up free",
  ctaPrimaryHref: "/register",
  ctaSecondaryLabel: "Sign in",
  ctaSecondaryHref: "/login",
  statsJson: DEFAULT_STATS as unknown as Prisma.InputJsonValue,
  closingHeadline: "Ready to learn, invest, and build with Volt Trades?",
  closingSubcopy:
    "Create your free account in minutes — no upfront KYC required to get started.",
  closingCtaLabel: "Create your account",
  closingCtaHref: "/register",
};

@Injectable()
export class LandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPublic(): Promise<LandingPageView> {
    const row = await this.ensure();
    return this.serialize(row);
  }

  async getAdmin(): Promise<LandingPageView> {
    return this.getPublic();
  }

  async update(
    dto: LandingPageUpdateInput,
    actorId: string,
    ip?: string | null,
  ): Promise<LandingPageView> {
    await this.ensure();

    const data: Prisma.LandingPageContentUpdateInput = {
      updatedById: actorId,
    };

    if (dto.heroYoutubeUrl !== undefined) {
      data.heroYoutubeId = parseYoutubeId(dto.heroYoutubeUrl);
    }
    if (dto.heroEyebrow !== undefined) data.heroEyebrow = dto.heroEyebrow;
    if (dto.heroHeadline !== undefined) data.heroHeadline = dto.heroHeadline;
    if (dto.heroHeadlineAccent !== undefined) {
      data.heroHeadlineAccent = dto.heroHeadlineAccent;
    }
    if (dto.heroSubcopy !== undefined) data.heroSubcopy = dto.heroSubcopy;
    if (dto.ctaPrimaryLabel !== undefined) data.ctaPrimaryLabel = dto.ctaPrimaryLabel;
    if (dto.ctaPrimaryHref !== undefined) data.ctaPrimaryHref = dto.ctaPrimaryHref;
    if (dto.ctaSecondaryLabel !== undefined) data.ctaSecondaryLabel = dto.ctaSecondaryLabel;
    if (dto.ctaSecondaryHref !== undefined) data.ctaSecondaryHref = dto.ctaSecondaryHref;
    if (dto.stats !== undefined) {
      data.statsJson = dto.stats as unknown as Prisma.InputJsonValue;
    }
    if (dto.closingHeadline !== undefined) data.closingHeadline = dto.closingHeadline;
    if (dto.closingSubcopy !== undefined) data.closingSubcopy = dto.closingSubcopy;
    if (dto.closingCtaLabel !== undefined) data.closingCtaLabel = dto.closingCtaLabel;
    if (dto.closingCtaHref !== undefined) data.closingCtaHref = dto.closingCtaHref;

    const row = await this.prisma.landingPageContent.update({
      where: { id: "default" },
      data,
    });

    await this.audit.log({
      actorId,
      action: "landing.updated",
      entityType: "LandingPageContent",
      entityId: row.id,
      ip,
      metadata: dto as object,
    });

    return this.serialize(row);
  }

  private async ensure() {
    const existing = await this.prisma.landingPageContent.findUnique({
      where: { id: "default" },
    });
    if (existing) return existing;
    return this.prisma.landingPageContent.create({ data: DEFAULT_LANDING });
  }

  private serialize(row: {
    heroYoutubeId: string;
    heroEyebrow: string;
    heroHeadline: string;
    heroHeadlineAccent: string | null;
    heroSubcopy: string;
    ctaPrimaryLabel: string;
    ctaPrimaryHref: string;
    ctaSecondaryLabel: string;
    ctaSecondaryHref: string;
    statsJson: Prisma.JsonValue;
    closingHeadline: string;
    closingSubcopy: string;
    closingCtaLabel: string;
    closingCtaHref: string;
    updatedAt: Date;
  }): LandingPageView {
    return {
      heroYoutubeId: row.heroYoutubeId,
      heroEyebrow: row.heroEyebrow,
      heroHeadline: row.heroHeadline,
      heroHeadlineAccent: row.heroHeadlineAccent,
      heroSubcopy: row.heroSubcopy,
      ctaPrimaryLabel: row.ctaPrimaryLabel,
      ctaPrimaryHref: row.ctaPrimaryHref,
      ctaSecondaryLabel: row.ctaSecondaryLabel,
      ctaSecondaryHref: row.ctaSecondaryHref,
      stats: parseStats(row.statsJson),
      closingHeadline: row.closingHeadline,
      closingSubcopy: row.closingSubcopy,
      closingCtaLabel: row.closingCtaLabel,
      closingCtaHref: row.closingCtaHref,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export function parseYoutubeId(input: string): string {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
      if (/^[\w-]{11}$/.test(id)) return id;
    }
    if (url.hostname.includes("youtube.com") || url.hostname.includes("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const match = url.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
      if (match?.[2]) return match[2];
    }
  } catch {
    // fall through
  }

  throw new BadRequestException("Invalid YouTube URL or video id");
}

function parseStats(value: Prisma.JsonValue): LandingPageView["stats"] {
  if (!Array.isArray(value)) return DEFAULT_STATS;
  const stats = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.value !== "string" || typeof row.label !== "string") return null;
      return { value: row.value, label: row.label };
    })
    .filter((item): item is { value: string; label: string } => Boolean(item));
  return stats.length > 0 ? stats : DEFAULT_STATS;
}
