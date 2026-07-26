"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import type { ProjectView } from "@volt/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageSpinner } from "@/components/ui/spinner";
import { api, apiErrorMessage } from "@/lib/api";
import { humanize, statusVariant } from "@/lib/status";

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => api.get<ProjectView>(`/projects/${slug}`),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="container-page py-10">
        <PageSpinner />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container-page py-10">
        <Alert variant="danger">
          {apiErrorMessage(error, "Project not found.")}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(project.status)}>{humanize(project.status)}</Badge>
        <Badge variant="default">{humanize(project.category)}</Badge>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
      <p className="mt-3 text-muted-foreground">{project.summary}</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{project.description}</p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          {project.milestones.length > 0 ? (
            <ul className="space-y-3">
              {project.milestones.map((milestone, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  {milestone.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-volt-dim" aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={milestone.done ? "" : "text-muted-foreground"}>{milestone.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No milestones published yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
