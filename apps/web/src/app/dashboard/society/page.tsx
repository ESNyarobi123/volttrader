"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ExternalLink,
  Shield,
  Users,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { humanize, statusVariant } from "@/lib/status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CommunityMembership {
  status: string;
  joinedAt?: string;
}

function statusLabel(status: string) {
  if (status === "WAITLIST") return "On waitlist";
  if (status === "ACTIVE") return "Active member";
  if (status === "SUSPENDED") return "Suspended";
  return humanize(status);
}

function statusShort(status: string) {
  if (status === "WAITLIST") return "Waitlist";
  if (status === "ACTIVE") return "Active";
  if (status === "SUSPENDED") return "Paused";
  return humanize(status);
}

function statusHint(status: string) {
  if (status === "WAITLIST") return "We’ll notify you when your seat opens.";
  if (status === "ACTIVE") return "You’re in. More access opens over time.";
  if (status === "SUSPENDED") return "Contact support if this looks wrong.";
  return "Membership recorded.";
}

function shortJoined(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function DashboardSocietyPage() {
  const queryClient = useQueryClient();
  const [joinError, setJoinError] = useState<string | null>(null);

  const membershipQuery = useQuery({
    queryKey: ["community", "me"],
    queryFn: () => api.get<CommunityMembership | null>("/community/me"),
  });

  const join = useMutation({
    mutationFn: () => api.post("/community/join", {}),
    onSuccess: async () => {
      setJoinError(null);
      await queryClient.invalidateQueries({ queryKey: ["community", "me"] });
    },
    onError: (err) => {
      setJoinError(
        err instanceof ApiRequestError ? err.message : "Could not join Volt Society",
      );
    },
  });

  const membership = membershipQuery.data ?? null;
  const loading = membershipQuery.isLoading;

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Society
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your membership.</p>
        </div>
        <Link
          href="/volt-society"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-center rounded-full sm:shrink-0",
          )}
        >
          Mission
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      {membershipQuery.isError ? (
        <Alert variant="danger">
          {membershipQuery.error instanceof ApiRequestError
            ? membershipQuery.error.message
            : "Could not load membership."}
        </Alert>
      ) : null}

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))
        ) : (
          <>
            <Stat
              accent="volt"
              icon={Users}
              label="Status"
              value={membership ? statusShort(membership.status) : "None"}
            />
            <Stat
              accent="ink"
              icon={CheckCircle2}
              label="Member"
              value={membership ? "Yes" : "No"}
            />
            <Stat
              accent="soft"
              icon={Bell}
              label="Joined"
              value={shortJoined(membership?.joinedAt)}
            />
          </>
        )}
      </section>

      {/* Focus — membership */}
      {loading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : membership ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink/90 text-white shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
                Membership
              </p>
              <Badge variant={statusVariant(membership.status)}>
                {humanize(membership.status)}
              </Badge>
            </div>
            <h2 className="mt-1 font-display text-lg font-bold tracking-tight">
              {statusLabel(membership.status)}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{statusHint(membership.status)}</p>
            {membership.joinedAt ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Since {formatDate(membership.joinedAt)}
              </p>
            ) : null}
          </div>
          <Link
            href="/volt-society"
            className={cn(
              buttonVariants({ size: "md", variant: "outline" }),
              "w-full shrink-0 rounded-full sm:w-auto",
            )}
          >
            Mission
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-2xl border border-volt/25 bg-gradient-to-br from-volt/12 via-surface to-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink/90 text-white shadow-sm">
            <Users className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-volt-dim">
              Join
            </p>
            <h2 className="mt-1 font-display text-lg font-bold tracking-tight">
              Volt Society waitlist
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Request a seat. Admin activates members.
            </p>
          </div>
          <Button
            size="md"
            className="w-full shrink-0 rounded-full shadow-volt sm:w-auto"
            onClick={() => join.mutate()}
            disabled={join.isPending}
          >
            {join.isPending ? "Joining…" : "Join waitlist"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      )}

      {joinError ? <Alert variant="danger">{joinError}</Alert> : null}

      {/* How it works — honest v1, not chat/posts */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">How it works</h2>
        <div className="grid gap-3">
          <StepRow
            step="1"
            title="Join waitlist"
            detail="One tap — membership recorded."
            done={Boolean(membership)}
          />
          <StepRow
            step="2"
            title="Admin review"
            detail="Status moves to Active when ready."
            done={membership?.status === "ACTIVE"}
          />
          <StepRow
            step="3"
            title="Access opens"
            detail="Sessions & updates when Society expands."
            done={false}
          />
        </div>
      </section>

      {/* Compact values strip */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">Values</h2>
          <Link
            href="/volt-society"
            className="inline-flex items-center gap-1 text-xs font-semibold text-volt-dim hover:text-foreground"
          >
            More
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["Members first", Users],
              ["Shared growth", CheckCircle2],
              ["Open access", Shield],
            ] as const
          ).map(([label, Icon]) => (
            <div
              key={label}
              className="flex w-[180px] shrink-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  accent,
  icon: Icon,
  label,
  value,
}: {
  accent: "volt" | "ink" | "soft";
  icon: typeof Users;
  label: string;
  value: string;
}) {
  const bar =
    accent === "volt" ? "bg-volt" : accent === "ink" ? "bg-ink" : "bg-[hsl(351_77%_61%)]";

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-3 shadow-card sm:p-4">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
            {value}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-volt/12 text-volt-dim">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function StepRow({
  step,
  title,
  detail,
  done,
}: {
  step: string;
  title: string;
  detail: string;
  done: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card sm:gap-4 sm:p-4">
      <span
        className={cn(
          "grid h-14 w-14 shrink-0 place-items-center rounded-xl font-display text-sm font-bold sm:h-16 sm:w-16 sm:rounded-2xl",
          done ? "bg-success/15 text-success" : "bg-ink/90 text-white",
        )}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : step}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {done ? (
        <Badge variant="success" className="shrink-0 text-[10px]">
          Done
        </Badge>
      ) : null}
    </div>
  );
}
