"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rocket, Sparkles } from "lucide-react";
import type { ProjectStatus } from "@volt/config";
import type { ProjectView } from "@volt/types";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type StatusFilter = ProjectStatus | "ALL";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Live" },
  { value: "IN_DEVELOPMENT", label: "In progress" },
  { value: "COMING_SOON", label: "Coming soon" },
  { value: "PLANNED", label: "Planned" },
  { value: "COMPLETED", label: "Completed" },
];

export default function ProjectsPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<ProjectView[]>("/projects"),
  });

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (status === "ALL") return items;
    return items.filter((p) => p.status === status);
  }, [data, status]);

  const stats = useMemo(() => {
    const items = data ?? [];
    return {
      total: items.length,
      live: items.filter((p) => p.status === "ACTIVE").length,
      building: items.filter((p) => p.status === "IN_DEVELOPMENT").length,
      soon: items.filter((p) => p.status === "COMING_SOON" || p.status === "PLANNED").length,
    };
  }, [data]);

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(70%_55%_at_20%_0%,hsl(350_73%_44%/0.14),transparent_55%),radial-gradient(50%_40%_at_90%_15%,hsl(262_45%_60%/0.1),transparent_50%)]"
      />

      <div className="container-page relative py-12 md:py-16">
        <header className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-dim">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Build the future
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-[2.75rem]">
            Projects &amp; Roadmap
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            The ventures and initiatives Mandanda Space is building beyond the trading floor — see
            what&apos;s live, in progress, and coming next.
          </p>
        </header>

        <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Projects", value: isLoading ? "—" : String(stats.total) },
            { label: "Live", value: isLoading ? "—" : String(stats.live) },
            { label: "Building", value: isLoading ? "—" : String(stats.building) },
            { label: "Upcoming", value: isLoading ? "—" : String(stats.soon) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/80 bg-surface/80 px-3 py-3 shadow-sm backdrop-blur-sm"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-bold tracking-tight">{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = status === item.value;
            return (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={active ? "primary" : "outline"}
                onClick={() => setStatus(item.value)}
                className={cn(
                  "rounded-full px-4",
                  !active && "border-foreground/10 bg-surface/80",
                )}
              >
                {item.label}
              </Button>
            );
          })}
        </div>

        {error ? (
          <Alert variant="danger" className="mt-8">
            {apiErrorMessage(error, "Failed to load projects.")}
          </Alert>
        ) : null}

        <div className="mt-8 md:mt-10">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[26rem] w-full rounded-[1.35rem]" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Rocket}
              title={data?.length ? "No projects in this filter" : "No projects published yet"}
              description={
                data?.length
                  ? "Try another status filter to see more of the roadmap."
                  : "Mandanda Space is building — check back soon for updates on our roadmap."
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
