import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  PartyPopper,
  Rocket,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ProjectCategory, ProjectStatus } from "@volt/config";
import type { ProjectView } from "@volt/types";
import { humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

const STATUS_THEME: Record<
  ProjectStatus,
  { badge: string; bar: string; label: string }
> = {
  ACTIVE: {
    badge: "bg-[hsl(142_65%_29%/0.14)] text-[hsl(162_45%_30%)]",
    bar: "from-[hsl(142_65%_29%/0.8)] to-[hsl(142_65%_29%/0.15)]",
    label: "Live",
  },
  IN_DEVELOPMENT: {
    badge: "bg-[hsl(351_77%_61%/0.14)] text-[hsl(213_70%_36%)]",
    bar: "from-[hsl(351_77%_61%/0.8)] to-[hsl(351_77%_61%/0.15)]",
    label: "In progress",
  },
  COMING_SOON: {
    badge: "bg-volt/18 text-volt-dim",
    bar: "from-volt/75 to-volt/15",
    label: "Coming soon",
  },
  PLANNED: {
    badge: "bg-foreground/5 text-muted-foreground",
    bar: "from-foreground/25 to-foreground/5",
    label: "Planned",
  },
  COMPLETED: {
    badge: "bg-[hsl(262_40%_55%/0.12)] text-[hsl(262_35%_40%)]",
    bar: "from-[hsl(262_40%_55%/0.7)] to-[hsl(262_40%_55%/0.12)]",
    label: "Completed",
  },
};

const CATEGORY: Record<
  ProjectCategory,
  { icon: LucideIcon; wash: string; accent: string }
> = {
  SHOP: {
    icon: ShoppingBag,
    wash: "from-volt/35 via-surface to-[hsl(349_74%_36%/0.12)]",
    accent: "text-volt-dim bg-volt/15",
  },
  COMMUNITY: {
    icon: Users,
    wash: "from-[hsl(0_0%_10%/0.3)] via-surface to-[hsl(262_40%_70%/0.12)]",
    accent: "text-[hsl(213_70%_36%)] bg-[hsl(351_77%_61%/0.12)]",
  },
  TECHNOLOGY: {
    icon: Rocket,
    wash: "from-[hsl(349_74%_36%/0.28)] via-surface to-[hsl(0_0%_10%/0.14)]",
    accent: "text-[hsl(198_60%_32%)] bg-[hsl(349_74%_36%/0.12)]",
  },
  EDUCATION: {
    icon: GraduationCap,
    wash: "from-[hsl(142_65%_29%/0.28)] via-surface to-volt/12",
    accent: "text-[hsl(162_45%_30%)] bg-[hsl(142_65%_29%/0.12)]",
  },
  EVENTS: {
    icon: PartyPopper,
    wash: "from-[hsl(349_74%_36%/0.28)] via-surface to-[hsl(0_60%_55%/0.1)]",
    accent: "text-[hsl(38_80%_32%)] bg-[hsl(349_74%_36%/0.14)]",
  },
  FUTURE_VENTURES: {
    icon: Sparkles,
    wash: "from-[hsl(262_45%_60%/0.22)] via-surface to-[hsl(0_0%_10%/0.12)]",
    accent: "text-[hsl(262_35%_40%)] bg-[hsl(262_40%_55%/0.12)]",
  },
};

function resolveCover(coverUrl: string | null): string | null {
  if (!coverUrl) return null;
  if (/^https?:\/\//i.test(coverUrl)) return coverUrl;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return `${base}/${coverUrl.replace(/^\//, "")}`;
  return null;
}

function ProjectArt({ project }: { project: ProjectView }) {
  const cat = CATEGORY[project.category];
  const Icon = cat.icon;
  const cover = resolveCover(project.coverUrl);
  const status = STATUS_THEME[project.status];

  return (
    <div className={cn("relative aspect-[16/10] overflow-hidden bg-gradient-to-br", cat.wash)}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <>
          <svg
            viewBox="0 0 200 120"
            className="absolute inset-0 h-full w-full opacity-40"
            aria-hidden
          >
            <circle cx="160" cy="28" r="36" className="fill-foreground/5" />
            <circle cx="40" cy="90" r="28" className="fill-foreground/5" />
            <path
              d="M20 90 C50 70, 70 95, 100 75 C130 55, 150 80, 180 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-foreground/15"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span
              className={cn(
                "grid h-14 w-14 place-items-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110",
                cat.accent,
              )}
            >
              <Icon className="h-6 w-6" aria-hidden />
            </span>
          </div>
        </>
      )}

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent"
      />

      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm",
            status.badge,
          )}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}

export function ProjectCard({
  project,
  className,
}: {
  project: ProjectView;
  className?: string;
}) {
  const status = STATUS_THEME[project.status];
  const milestones = project.milestones ?? [];
  const done = milestones.filter((m) => m.done).length;
  const total = milestones.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border/80 bg-surface/95 shadow-card transition-all duration-300",
        "hover:-translate-y-1.5 hover:border-volt/35 hover:shadow-[0_24px_48px_-28px_hsl(350_73%_36%/0.35)]",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn("h-1 bg-gradient-to-r opacity-90", status.bar)}
      />

      <ProjectArt project={project} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {humanize(project.category)}
          </span>
          {total > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <CalendarRange className="h-3 w-3" aria-hidden />
              {done}/{total} milestones
            </span>
          ) : null}
        </div>

        <h3 className="mt-2.5 font-display text-lg font-bold leading-snug tracking-tight transition-colors group-hover:text-volt-dim">
          <span className="line-clamp-2">{project.title}</span>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {project.summary}
        </p>

        {total > 0 ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-volt-dim" aria-hidden />
                Roadmap progress
              </span>
              <span className="font-semibold tabular-nums text-foreground/70">{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-volt to-[hsl(351_77%_61%)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3.5">
          <span className="text-[11px] text-muted-foreground">{status.label}</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground transition-colors group-hover:text-volt-dim">
            View project
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  );
}
