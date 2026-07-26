"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Search,
  Clock3,
  CheckCircle2,
  XCircle,
  Info,
  Eye,
  User,
  FileText,
  ImageIcon,
  IdCard,
  type LucideIcon,
} from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { reportRecoveredError } from "@/lib/errors";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";

type KycDocType = "NATIONAL_ID" | "PASSPORT" | "DRIVER_LICENSE";
type KycReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
type ReviewDecision = "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";

interface AdminKycSubmission {
  id: string;
  documentType: KycDocType;
  documentNumber: string;
  status: KycReviewStatus;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  frontImageKey: string;
  backImageKey: string | null;
  selfieKey: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  selfieUrl: string | null;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    kycStatus: string;
    country: string | null;
  } | null;
}

type StatusFilter = "ALL" | KycReviewStatus;

function docLabel(type: KycDocType) {
  return humanize(type);
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function decisionBlurb(decision: ReviewDecision) {
  switch (decision) {
    case "APPROVED":
      return "Unlocks investment and withdrawal flows for this user.";
    case "REJECTED":
      return "Blocks KYC-gated actions. Share a clear reason for the applicant.";
    case "NEEDS_MORE_INFO":
      return "Keeps the case open and asks the user to resubmit clearer documents.";
  }
}

export default function AdminKycPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [detail, setDetail] = useState<AdminKycSubmission | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    submission: AdminKycSubmission;
    decision: ReviewDecision;
  } | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-kyc"],
    // api.get unwraps envelope `data` → submissions array
    queryFn: () => api.get<AdminKycSubmission[]>("/kyc?page=1&pageSize=100"),
  });

  const review = useMutation({
    mutationFn: ({
      id,
      status,
      reviewerNote: note,
    }: {
      id: string;
      status: ReviewDecision;
      reviewerNote?: string;
    }) => api.patch(`/kyc/${id}/review`, { status, reviewerNote: note }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-kyc"] });
      setReviewTarget(null);
      setReviewerNote("");
      if (detail && updated && typeof updated === "object" && "id" in updated) {
        setDetail(updated as AdminKycSubmission);
      }
    },
  });

  const openDetail = async (id: string) => {
    try {
      const full = await api.get<AdminKycSubmission>(`/kyc/${id}`);
      setDetail(full);
    } catch (err) {
      reportRecoveredError("Could not load the full KYC submission", err);
      const fallback = (data ?? []).find((s) => s.id === id) ?? null;
      setDetail(fallback);
    }
  };

  const openReview = (submission: AdminKycSubmission, decision: ReviewDecision) => {
    setReviewTarget({ submission, decision });
    setReviewerNote(submission.reviewerNote ?? "");
    review.reset();
  };

  const confirmReview = () => {
    if (!reviewTarget) return;
    if (
      (reviewTarget.decision === "REJECTED" || reviewTarget.decision === "NEEDS_MORE_INFO") &&
      !reviewerNote.trim()
    ) {
      return;
    }
    review.mutate({
      id: reviewTarget.submission.id,
      status: reviewTarget.decision,
      reviewerNote: reviewerNote.trim() || undefined,
    });
  };

  const submissions = data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!term) return true;
      const user = `${s.user?.fullName ?? ""} ${s.user?.email ?? ""} ${s.user?.phone ?? ""}`.toLowerCase();
      return (
        user.includes(term) ||
        s.documentNumber.toLowerCase().includes(term) ||
        s.documentType.toLowerCase().includes(term)
      );
    });
  }, [submissions, search, statusFilter]);

  const stats = useMemo(() => {
    const by = (st: KycReviewStatus) => submissions.filter((s) => s.status === st).length;
    return {
      total: submissions.length,
      pending: by("PENDING"),
      approved: by("APPROVED"),
      rejected: by("REJECTED"),
      needsInfo: by("NEEDS_MORE_INFO"),
    };
  }, [submissions]);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(0_0%_10%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Compliance · Identity
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">KYC review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspect documents, then approve, request more info, or reject — before invest/withdraw.
          </p>
        </div>
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-[hsl(var(--warning))] sm:max-w-xs">
          KYC is required at investment and withdrawal — not at signup.
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatChip icon={ShieldCheck} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Clock3} label="Pending" value={stats.pending} tone="amber" />
        <StatChip icon={CheckCircle2} label="Approved" value={stats.approved} tone="green" />
        <StatChip icon={Info} label="Needs info" value={stats.needsInfo} tone="blue" />
        <StatChip icon={XCircle} label="Rejected" value={stats.rejected} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(0_0%_10%/0.08)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone or document number…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="NEEDS_MORE_INFO">Needs more info</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {error instanceof ApiRequestError ? error.message : "Could not load KYC submissions."}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={submissions.length === 0 ? "No KYC submissions yet" : "No matches"}
          description={
            submissions.length === 0
              ? "Identity checks appear here when users submit documents."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <article
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)] opacity-80"
              />
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant={statusVariant(s.status)}>{humanize(s.status)}</Badge>
                      <Badge variant="volt">{docLabel(s.documentType)}</Badge>
                    </div>
                    <h2 className="truncate text-lg font-bold tracking-tight">
                      {s.user?.fullName ?? "Unknown user"}
                    </h2>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.user?.email ?? s.user?.phone ?? "—"}
                    </p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(0_0%_10%/0.2)] text-volt-dim">
                    <IdCard className="h-5 w-5" />
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Document #
                    </p>
                    <p className="mt-0.5 truncate font-mono font-medium">{s.documentNumber}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Submitted
                    </p>
                    <p className="mt-0.5 font-medium">{formatDate(s.createdAt)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void openDetail(s.id)}>
                    <Eye className="h-3.5 w-3.5" />
                    View details
                  </Button>
                  {s.status === "PENDING" || s.status === "NEEDS_MORE_INFO" ? (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={review.isPending}
                        onClick={() => openReview(s, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={review.isPending}
                        onClick={() => openReview(s, "NEEDS_MORE_INFO")}
                      >
                        Needs info
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={review.isPending}
                        onClick={() => openReview(s, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setDetail(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.18)] px-6 pb-5 pt-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-volt/35 blur-3xl"
              />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Identity case
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {detail?.user?.fullName ?? "KYC details"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Review document images and applicant details before deciding.
                  </DialogDescription>
                </div>
              </div>
              {detail ? (
                <div className="relative mt-5 flex flex-wrap gap-1.5">
                  <Badge variant={statusVariant(detail.status)}>{humanize(detail.status)}</Badge>
                  <Badge variant="volt">{docLabel(detail.documentType)}</Badge>
                  {detail.user?.country ? (
                    <Badge variant="default">{detail.user.country}</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>

            {detail ? (
              <div className="max-h-[min(65vh,620px)] space-y-5 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <section className="grid gap-3 sm:grid-cols-2">
                  <InfoTile
                    icon={User}
                    label="Applicant"
                    value={detail.user?.fullName ?? "—"}
                    hint={detail.user?.email ?? detail.user?.phone ?? undefined}
                  />
                  <InfoTile
                    icon={FileText}
                    label="Document number"
                    value={detail.documentNumber}
                    mono
                  />
                  <InfoTile icon={Clock3} label="Submitted" value={formatDateTime(detail.createdAt)} />
                  <InfoTile
                    icon={CheckCircle2}
                    label="Reviewed"
                    value={formatDateTime(detail.reviewedAt)}
                  />
                </section>

                {detail.reviewerNote ? (
                  <Alert variant="info">
                    <strong className="font-semibold">Reviewer note:</strong> {detail.reviewerNote}
                  </Alert>
                ) : null}

                <section>
                  <h3 className="mb-3 text-sm font-bold tracking-tight">Document images</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DocThumb
                      label="Front"
                      src={detail.frontImageUrl}
                      storageKey={detail.frontImageKey}
                      onOpen={() =>
                        detail.frontImageUrl &&
                        setLightbox({ src: detail.frontImageUrl, label: "Front of document" })
                      }
                    />
                    <DocThumb
                      label="Back"
                      src={detail.backImageUrl}
                      storageKey={detail.backImageKey}
                      onOpen={() =>
                        detail.backImageUrl &&
                        setLightbox({ src: detail.backImageUrl, label: "Back of document" })
                      }
                    />
                    <DocThumb
                      label="Selfie"
                      src={detail.selfieUrl}
                      storageKey={detail.selfieKey}
                      onOpen={() =>
                        detail.selfieUrl &&
                        setLightbox({ src: detail.selfieUrl, label: "Selfie" })
                      }
                    />
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                  {detail.status === "PENDING" || detail.status === "NEEDS_MORE_INFO" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        disabled={review.isPending}
                        onClick={() => openReview(detail, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        disabled={review.isPending}
                        onClick={() => openReview(detail, "NEEDS_MORE_INFO")}
                      >
                        Needs info
                      </Button>
                      <Button
                        variant="danger"
                        disabled={review.isPending}
                        onClick={() => openReview(detail, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog
        open={!!reviewTarget}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTarget(null);
            setReviewerNote("");
            review.reset();
          }
        }}
      >
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => {
            setReviewTarget(null);
            setReviewerNote("");
          }}
        >
          <div
            className={cn(
              "overflow-hidden rounded-2xl border bg-surface shadow-lift",
              reviewTarget?.decision === "REJECTED" ? "border-danger/30" : "border-border",
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden border-b px-6 pb-5 pt-6",
                reviewTarget?.decision === "REJECTED"
                  ? "border-danger/20 bg-gradient-to-br from-danger/15 via-surface to-warning/10"
                  : reviewTarget?.decision === "APPROVED"
                    ? "border-border bg-gradient-to-br from-success/15 via-surface to-volt/10"
                    : "border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.15)]",
              )}
            >
              <div className="relative flex items-start gap-3 pr-8">
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl text-volt-foreground shadow-volt",
                    reviewTarget?.decision === "REJECTED"
                      ? "bg-danger/90"
                      : "bg-gradient-to-br from-volt to-[hsl(349_74%_36%)]",
                  )}
                >
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Compliance decision
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {reviewTarget ? humanize(reviewTarget.decision) : "Review"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {reviewTarget ? decisionBlurb(reviewTarget.decision) : null}
                  </DialogDescription>
                </div>
              </div>
              {reviewTarget ? (
                <div className="relative mt-4 rounded-2xl border border-border/80 bg-surface/80 p-3">
                  <p className="font-semibold">{reviewTarget.submission.user?.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {docLabel(reviewTarget.submission.documentType)} ·{" "}
                    <span className="font-mono">{reviewTarget.submission.documentNumber}</span>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-1.5">
                <Label htmlFor="reviewerNote">
                  {reviewTarget?.decision === "APPROVED"
                    ? "Note (optional)"
                    : "Note (required)"}
                </Label>
                <Textarea
                  id="reviewerNote"
                  rows={3}
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  placeholder={
                    reviewTarget?.decision === "APPROVED"
                      ? "Optional internal note…"
                      : "Explain what is missing or why this was rejected…"
                  }
                />
              </div>

              {review.isError ? (
                <Alert variant="danger">
                  {review.error instanceof ApiRequestError
                    ? review.error.message
                    : "Could not submit review."}
                </Alert>
              ) : null}

              <DialogFooter className="mt-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewTarget(null);
                    setReviewerNote("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant={reviewTarget?.decision === "REJECTED" ? "danger" : "primary"}
                  disabled={
                    review.isPending ||
                    !reviewTarget ||
                    ((reviewTarget.decision === "REJECTED" ||
                      reviewTarget.decision === "NEEDS_MORE_INFO") &&
                      !reviewerNote.trim())
                  }
                  onClick={confirmReview}
                  className={
                    reviewTarget?.decision === "APPROVED" ? "shadow-volt" : undefined
                  }
                >
                  {review.isPending
                    ? "Saving…"
                    : reviewTarget
                      ? `Confirm ${humanize(reviewTarget.decision)}`
                      : "Confirm"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent
          className="max-w-4xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setLightbox(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <DialogTitle className="text-base">{lightbox?.label}</DialogTitle>
              <Button size="sm" variant="outline" onClick={() => setLightbox(null)}>
                Close
              </Button>
            </div>
            <div className="bg-surface-2/40 p-4">
              {lightbox ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightbox.src}
                  alt={lightbox.label}
                  className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocThumb({
  label,
  src,
  storageKey,
  onOpen,
}: {
  label: string;
  src: string | null;
  storageKey: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!src}
      onClick={onOpen}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/80 bg-surface-2/40 text-left transition",
        src ? "hover:border-volt/40 hover:shadow-card" : "cursor-default opacity-80",
      )}
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-surface to-surface-2">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center gap-2 p-3 text-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              {storageKey ? "Image not reachable" : "Not provided"}
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-border/70 px-3 py-2">
        <p className="text-xs font-semibold">{label}</p>
        {storageKey ? (
          <p className="truncate font-mono text-[10px] text-muted-foreground">{storageKey}</p>
        ) : null}
      </div>
    </button>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  hint,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface-2/40 px-3 py-3">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-sm font-semibold", mono && "font-mono text-xs")}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "gold" | "green" | "blue" | "ink" | "amber";
}) {
  const tones = {
    gold: "border-volt/30 from-volt/20",
    green: "border-success/30 from-success/15",
    blue: "border-[hsl(var(--accent-blue)/0.3)] from-[hsl(var(--accent-blue)/0.14)]",
    ink: "border-border from-surface-2",
    amber: "border-warning/30 from-warning/15",
  } as const;
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br via-surface to-surface p-4 shadow-card",
        tones[tone],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-volt-dim" />
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
