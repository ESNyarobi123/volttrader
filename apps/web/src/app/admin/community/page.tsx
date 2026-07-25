"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Sparkles,
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Clock3,
  CheckCircle2,
  Ban,
  Users,
  MessageSquareQuote,
  type LucideIcon,
} from "lucide-react";
import {
  MembershipStatus,
  type MembershipStatus as MembershipStatusType,
} from "@volt/config";
import { api, ApiRequestError } from "@/lib/api";
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

interface CommunityMemberView {
  id: string;
  status: MembershipStatusType;
  motivation: string | null;
  joinedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
}

interface AdminUserOption {
  id: string;
  fullName: string;
  email: string | null;
}

type StatusFilter = "ALL" | MembershipStatusType;

const createFormSchema = z.object({
  userId: z.string().min(1, "Select a user"),
  status: z.nativeEnum(MembershipStatus),
  motivation: z.string().max(500).optional(),
});
type CreateFormInput = z.infer<typeof createFormSchema>;

const editFormSchema = z.object({
  status: z.nativeEnum(MembershipStatus),
  motivation: z.string().max(500).optional(),
});
type EditFormInput = z.infer<typeof editFormSchema>;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AdminCommunityPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityMemberView | null>(null);
  const [detail, setDetail] = useState<CommunityMemberView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityMemberView | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-community"],
    queryFn: () => api.get<CommunityMemberView[]>("/community?page=1&pageSize=100"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-users-options"],
    queryFn: () => api.get<AdminUserOption[]>("/users?page=1&pageSize=100"),
  });

  const createForm = useForm<CreateFormInput>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { userId: "", status: "WAITLIST", motivation: "" },
  });

  const editForm = useForm<EditFormInput>({
    resolver: zodResolver(editFormSchema),
    defaultValues: { status: "WAITLIST", motivation: "" },
  });

  const createWatch = createForm.watch();

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<CommunityMemberView>("/community/admin", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-community"] });
      setEditorOpen(false);
      createForm.reset({ userId: "", status: "WAITLIST", motivation: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<CommunityMemberView>(`/community/${id}`, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-community"] });
      setEditing(null);
      if (detail?.id === updated.id) setDetail(updated);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MembershipStatusType }) =>
      api.patch(`/community/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-community"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/community/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-community"] });
      setDeleteTarget(null);
      setDetail(null);
    },
  });

  const members = data ?? [];
  const users = usersData ?? [];
  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user?.id).filter(Boolean)), [members]);
  const availableUsers = users.filter((u) => !memberUserIds.has(u.id));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
      if (!term) return true;
      const user = `${m.user?.fullName ?? ""} ${m.user?.email ?? ""} ${m.user?.phone ?? ""}`.toLowerCase();
      return user.includes(term) || (m.motivation ?? "").toLowerCase().includes(term);
    });
  }, [members, search, statusFilter]);

  const stats = useMemo(() => {
    const by = (s: MembershipStatusType) => members.filter((m) => m.status === s).length;
    return {
      total: members.length,
      waitlist: by("WAITLIST"),
      active: by("ACTIVE"),
      suspended: by("SUSPENDED"),
    };
  }, [members]);

  const openCreate = () => {
    createForm.reset({ userId: "", status: "WAITLIST", motivation: "" });
    setEditorOpen(true);
  };

  const openEdit = (m: CommunityMemberView) => {
    setEditing(m);
    editForm.reset({
      status: m.status,
      motivation: m.motivation ?? "",
    });
  };

  const openDetail = async (id: string) => {
    try {
      const full = await api.get<CommunityMemberView>(`/community/${id}`);
      setDetail(full);
    } catch {
      setDetail(members.find((m) => m.id === id) ?? null);
    }
  };

  const onCreate = (values: CreateFormInput) => {
    createMutation.mutate({
      userId: values.userId,
      status: values.status,
      motivation: values.motivation?.trim() || undefined,
    });
  };

  const onEdit = (values: EditFormInput) => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      payload: {
        status: values.status,
        motivation: values.motivation?.trim() || null,
      },
    });
  };

  const selectedUser = availableUsers.find((u) => u.id === createWatch.userId);
  const createError =
    createMutation.error instanceof ApiRequestError
      ? createMutation.error.message
      : createMutation.isError
        ? "Could not add member."
        : null;
  const editError =
    updateMutation.error instanceof ApiRequestError
      ? updateMutation.error.message
      : updateMutation.isError
        ? "Could not update member."
        : null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(280_55%_48%/0.1),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            People · Volt Society
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage waitlist, activate members, and review motivations.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          Add member
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip icon={Users} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={Clock3} label="Waitlist" value={stats.waitlist} tone="amber" />
        <StatChip icon={CheckCircle2} label="Active" value={stats.active} tone="green" />
        <StatChip icon={Ban} label="Suspended" value={stats.suspended} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(280_55%_48%/0.06)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(280_55%_52%)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone or motivation…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {Object.values(MembershipStatus).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {error instanceof ApiRequestError ? error.message : "Could not load community members."}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={members.length === 0 ? "No members yet" : "No matches"}
          description={
            members.length === 0
              ? "Add someone to Volt Society, or wait for join requests."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <article
              key={m.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(280_55%_52%)] opacity-80"
              />
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/30 to-[hsl(280_55%_48%/0.2)] text-sm font-bold text-volt-dim">
                      {initials(m.user?.fullName ?? "?") || "?"}
                    </span>
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        <Badge variant={statusVariant(m.status)}>{humanize(m.status)}</Badge>
                      </div>
                      <h2 className="truncate text-lg font-bold tracking-tight">
                        {m.user?.fullName ?? "Unknown"}
                      </h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.user?.email ?? m.user?.phone ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {m.motivation ? (
                  <p className="line-clamp-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2 text-sm text-muted-foreground">
                    “{m.motivation}”
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No motivation shared.</p>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  <span>Joined {formatDate(m.joinedAt)}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void openDetail(m.id)}>
                    <Eye className="h-3.5 w-3.5" />
                    Details
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {m.status !== "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: m.id, status: "ACTIVE" })}
                    >
                      Activate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: m.id, status: "SUSPENDED" })}
                    >
                      Suspend
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    className="ml-auto"
                    onClick={() => setDeleteTarget(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditorOpen(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(280_55%_48%/0.12)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="font-display text-2xl">Add member</DialogTitle>
                  <DialogDescription className="mt-1">
                    Add an existing user to Volt Society waitlist or as active.
                  </DialogDescription>
                </div>
              </div>
              <div className="relative mt-4 rounded-2xl border border-border/80 bg-surface/80 p-3">
                <p className="font-semibold">{selectedUser?.fullName ?? "Select a user"}</p>
                <p className="text-sm text-muted-foreground">
                  {humanize(createWatch.status || "WAITLIST")}
                </p>
              </div>
            </div>
            <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4 p-6">
              <Field
                label="User"
                htmlFor="userId"
                error={createForm.formState.errors.userId?.message}
              >
                <Select id="userId" {...createForm.register("userId")}>
                  <option value="">Select user…</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                      {u.email ? ` · ${u.email}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" htmlFor="status">
                <Select id="status" {...createForm.register("status")}>
                  {Object.values(MembershipStatus).map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Motivation (optional)" htmlFor="motivation">
                <Textarea id="motivation" rows={3} {...createForm.register("motivation")} />
              </Field>
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every listed user is already a community member.
                </p>
              ) : null}
              {createError ? <Alert variant="danger">{createError}</Alert> : null}
              <DialogFooter className="mt-0">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || availableUsers.length === 0}
                  className="shadow-volt"
                >
                  {createMutation.isPending ? "Adding…" : "Add member"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditing(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.15)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <Pencil className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="font-display text-2xl">Edit member</DialogTitle>
                  <DialogDescription className="mt-1">
                    Update membership status or motivation note.
                  </DialogDescription>
                </div>
              </div>
              {editing ? (
                <div className="relative mt-4 rounded-2xl border border-border/80 bg-surface/80 p-3">
                  <p className="font-semibold">{editing.user?.fullName}</p>
                  <p className="text-sm text-muted-foreground">{editing.user?.email ?? "—"}</p>
                </div>
              ) : null}
            </div>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4 p-6">
              <Field label="Status" htmlFor="editStatus">
                <Select id="editStatus" {...editForm.register("status")}>
                  {Object.values(MembershipStatus).map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Motivation" htmlFor="editMotivation">
                <Textarea id="editMotivation" rows={3} {...editForm.register("motivation")} />
              </Field>
              {editError ? <Alert variant="danger">{editError}</Alert> : null}
              <DialogFooter className="mt-0">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="shadow-volt">
                  {updateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setDetail(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(280_55%_48%/0.12)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="font-display text-2xl">
                    {detail?.user?.fullName ?? "Member"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Volt Society membership details.
                  </DialogDescription>
                </div>
              </div>
              {detail ? (
                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  <Badge variant={statusVariant(detail.status)}>{humanize(detail.status)}</Badge>
                </div>
              ) : null}
            </div>
            {detail ? (
              <div className="space-y-3 p-6">
                <DetailRow label="Email" value={detail.user?.email ?? "—"} />
                <DetailRow label="Phone" value={detail.user?.phone ?? "—"} />
                <DetailRow label="Joined" value={formatDateTime(detail.joinedAt)} />
                <div className="rounded-xl border border-border/70 bg-surface-2/40 px-3 py-3">
                  <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      Motivation
                    </span>
                  </div>
                  <p className="text-sm">
                    {detail.motivation?.trim() || "No motivation shared."}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      openEdit(detail);
                      setDetail(null);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent
          className="max-w-md overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-danger/30 bg-surface shadow-lift">
            <div className="border-b border-danger/20 bg-gradient-to-br from-danger/15 via-surface to-warning/10 px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger/15 text-danger">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle>Remove member?</DialogTitle>
                  <DialogDescription className="mt-1">
                    Remove{" "}
                    <strong>{deleteTarget?.user?.fullName ?? "this member"}</strong> from Volt
                    Society. They can join again later.
                  </DialogDescription>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {deleteMutation.isError ? (
                <Alert variant="danger">
                  {deleteMutation.error instanceof ApiRequestError
                    ? deleteMutation.error.message
                    : "Could not remove member."}
                </Alert>
              ) : null}
              <DialogFooter className="mt-0">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteMutation.isPending || !deleteTarget}
                  onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                >
                  {deleteMutation.isPending ? "Removing…" : "Remove member"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
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

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
