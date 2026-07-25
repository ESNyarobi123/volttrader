"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  LifeBuoy,
  Search,
  Plus,
  Eye,
  Trash2,
  Send,
  Clock3,
  CheckCircle2,
  CircleDot,
  Ban,
  MessageSquare,
  User,
  type LucideIcon,
} from "lucide-react";
import { TicketStatus, type TicketStatus as TicketStatusType } from "@volt/config";
import { supportTicketSchema } from "@volt/validation";
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

type TicketCategory = "GENERAL" | "PAYMENTS" | "COURSES" | "INVESTMENTS" | "KYC";

interface TicketMessage {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string; role: string } | null;
}

interface AdminTicket {
  id: string;
  subject: string;
  category: string;
  status: TicketStatusType;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  user: { id: string; fullName: string; email: string | null } | null;
  messages?: TicketMessage[];
}

interface AdminUserOption {
  id: string;
  fullName: string;
  email: string | null;
}

type StatusFilter = "ALL" | TicketStatusType;
type CategoryFilter = "ALL" | TicketCategory;

const CATEGORIES: TicketCategory[] = [
  "GENERAL",
  "PAYMENTS",
  "COURSES",
  "INVESTMENTS",
  "KYC",
];

const createFormSchema = supportTicketSchema.extend({
  userId: z.string().min(1, "Select a user"),
});
type CreateFormInput = z.infer<typeof createFormSchema>;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isStaff(role?: string) {
  return role === "SUPPORT_AGENT" || role === "SUPER_ADMIN" || role === "FINANCE_ADMIN";
}

export default function AdminSupportPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [detail, setDetail] = useState<AdminTicket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTicket | null>(null);
  const [reply, setReply] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-support"],
    queryFn: () => api.get<AdminTicket[]>("/support/tickets?page=1&pageSize=100"),
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-users-options"],
    queryFn: () => api.get<AdminUserOption[]>("/users?page=1&pageSize=100"),
  });

  const createForm = useForm<CreateFormInput>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      userId: "",
      subject: "",
      category: "GENERAL",
      message: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<AdminTicket>("/support/tickets/admin", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      setEditorOpen(false);
      createForm.reset({ userId: "", subject: "", category: "GENERAL", message: "" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatusType }) =>
      api.patch<AdminTicket>(`/support/tickets/${id}`, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      if (detail?.id === updated.id) {
        setDetail((prev) => (prev ? { ...prev, status: updated.status } : prev));
      }
    },
  });

  const sendReply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.post<TicketMessage>(`/support/tickets/${id}/messages`, { body }),
    onSuccess: async (_msg, vars) => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      const fresh = await api.get<AdminTicket>(`/support/tickets/${vars.id}`);
      setDetail(fresh);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.del<{ id: string; deleted: boolean }>(`/support/tickets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      setDeleteTarget(null);
      setDetail(null);
    },
  });

  const tickets = data ?? [];
  const users = usersData ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;
      if (!term) return true;
      const user = `${t.user?.fullName ?? ""} ${t.user?.email ?? ""}`.toLowerCase();
      return user.includes(term) || t.subject.toLowerCase().includes(term);
    });
  }, [tickets, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    const by = (s: TicketStatusType) => tickets.filter((t) => t.status === s).length;
    return {
      total: tickets.length,
      open: by("OPEN"),
      pending: by("PENDING"),
      resolved: by("RESOLVED"),
      closed: by("CLOSED"),
    };
  }, [tickets]);

  const openDetail = async (id: string) => {
    try {
      const full = await api.get<AdminTicket>(`/support/tickets/${id}`);
      setDetail(full);
      setReply("");
    } catch {
      setDetail(tickets.find((t) => t.id === id) ?? null);
    }
  };

  const onCreate = (values: CreateFormInput) => {
    createMutation.mutate({
      userId: values.userId,
      subject: values.subject,
      category: values.category,
      message: values.message,
    });
  };

  const createError =
    createMutation.error instanceof ApiRequestError
      ? createMutation.error.message
      : createMutation.isError
        ? "Could not create ticket."
        : null;

  const replyError =
    sendReply.error instanceof ApiRequestError
      ? sendReply.error.message
      : sendReply.isError
        ? "Could not send reply."
        : null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(349_74%_36%/0.12),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            People · Helpdesk
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Triage tickets, reply in-thread, and close resolved cases.
          </p>
        </div>
        <Button
          onClick={() => {
            createForm.reset({
              userId: "",
              subject: "",
              category: "GENERAL",
              message: "",
            });
            setEditorOpen(true);
          }}
          className="shadow-volt"
        >
          <Plus className="h-4 w-4" />
          New ticket
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatChip icon={LifeBuoy} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={CircleDot} label="Open" value={stats.open} tone="amber" />
        <StatChip icon={Clock3} label="Pending" value={stats.pending} tone="blue" />
        <StatChip icon={CheckCircle2} label="Resolved" value={stats.resolved} tone="green" />
        <StatChip icon={Ban} label="Closed" value={stats.closed} tone="ink" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(349_74%_36%/0.08)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject, name or email…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-40">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {Object.values(TicketStatus).map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-44">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            >
              <option value="ALL">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="danger">
          {error instanceof ApiRequestError ? error.message : "Could not load tickets."}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={tickets.length === 0 ? "No tickets yet" : "No matches"}
          description={
            tickets.length === 0
              ? "Support tickets appear here when users ask for help."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <article
              key={t.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(349_74%_36%)] opacity-80"
              />
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant={statusVariant(t.status)}>{humanize(t.status)}</Badge>
                      <Badge variant="volt">{humanize(t.category)}</Badge>
                    </div>
                    <h2 className="line-clamp-2 text-lg font-bold tracking-tight">{t.subject}</h2>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/25 to-[hsl(349_74%_36%/0.2)] text-volt-dim">
                    <MessageSquare className="h-5 w-5" />
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-2/40 px-3 py-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.user?.fullName ?? "Unknown"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.user?.email ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  <span>{t.messageCount} message{t.messageCount === 1 ? "" : "s"}</span>
                  <span>Updated {formatDate(t.updatedAt)}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void openDetail(t.id)}>
                    <Eye className="h-3.5 w-3.5" />
                    Open thread
                  </Button>
                  {t.status !== "RESOLVED" && t.status !== "CLOSED" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: t.id, status: "RESOLVED" })}
                    >
                      Resolve
                    </Button>
                  ) : t.status === "RESOLVED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: t.id, status: "CLOSED" })}
                    >
                      Close
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="danger"
                    className="ml-auto"
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create ticket */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditorOpen(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(349_74%_36%/0.15)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <Plus className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="font-display text-2xl">New ticket</DialogTitle>
                  <DialogDescription className="mt-1">
                    Open a support case on behalf of a user.
                  </DialogDescription>
                </div>
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
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                      {u.email ? ` · ${u.email}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Subject"
                htmlFor="subject"
                error={createForm.formState.errors.subject?.message}
              >
                <Input id="subject" {...createForm.register("subject")} />
              </Field>
              <Field label="Category" htmlFor="category">
                <Select id="category" {...createForm.register("category")}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {humanize(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Message"
                htmlFor="message"
                error={createForm.formState.errors.message?.message}
              >
                <Textarea id="message" rows={4} {...createForm.register("message")} />
              </Field>
              {createError ? <Alert variant="danger">{createError}</Alert> : null}
              <DialogFooter className="mt-0">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="shadow-volt"
                >
                  {createMutation.isPending ? "Creating…" : "Create ticket"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thread detail */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent
          className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setDetail(null)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(349_74%_36%/0.15)] px-6 pb-5 pt-6">
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Support thread
                  </p>
                  <DialogTitle className="font-display text-2xl line-clamp-2">
                    {detail?.subject ?? "Ticket"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {detail?.user?.fullName ?? "User"}
                    {detail?.user?.email ? ` · ${detail.user.email}` : ""}
                  </DialogDescription>
                </div>
              </div>
              {detail ? (
                <div className="relative mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(detail.status)}>{humanize(detail.status)}</Badge>
                  <Badge variant="volt">{humanize(detail.category)}</Badge>
                  <Select
                    value={detail.status}
                    className="ml-auto h-9 w-40 text-xs"
                    disabled={updateStatus.isPending}
                    onChange={(e) =>
                      updateStatus.mutate({
                        id: detail.id,
                        status: e.target.value as TicketStatusType,
                      })
                    }
                  >
                    {Object.values(TicketStatus).map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>

            {detail ? (
              <div className="flex max-h-[min(68vh,640px)] flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {(detail.messages ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    detail.messages?.map((m) => {
                      const staff = isStaff(m.author?.role);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "rounded-2xl border px-4 py-3",
                            staff
                              ? "ml-6 border-volt/25 bg-volt/10"
                              : "mr-6 border-border/70 bg-surface-2/50",
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">
                              {m.author?.fullName ?? "Unknown"}
                              {staff ? (
                                <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-volt-dim">
                                  Support
                                </span>
                              ) : null}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTime(m.createdAt)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                {detail.status !== "CLOSED" ? (
                  <div className="space-y-3 border-t border-border bg-surface/95 p-4 backdrop-blur">
                    <Textarea
                      rows={3}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Write a reply to the member…"
                    />
                    {replyError ? <Alert variant="danger">{replyError}</Alert> : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button variant="outline" onClick={() => setDetail(null)}>
                        Close panel
                      </Button>
                      <Button
                        disabled={sendReply.isPending || !reply.trim()}
                        onClick={() =>
                          sendReply.mutate({ id: detail.id, body: reply.trim() })
                        }
                        className="shadow-volt"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendReply.isPending ? "Sending…" : "Send reply"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-border p-4">
                    <Alert variant="info">This ticket is closed. Re-open it to reply.</Alert>
                    <div className="mt-3 flex justify-end">
                      <Button variant="outline" onClick={() => setDetail(null)}>
                        Close panel
                      </Button>
                    </div>
                  </div>
                )}
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
                  <DialogTitle>Delete ticket?</DialogTitle>
                  <DialogDescription className="mt-1">
                    Permanently remove{" "}
                    <strong>{deleteTarget?.subject ?? "this ticket"}</strong> and all messages.
                  </DialogDescription>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {deleteMutation.isError ? (
                <Alert variant="danger">
                  {deleteMutation.error instanceof ApiRequestError
                    ? deleteMutation.error.message
                    : "Could not delete ticket."}
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
                  {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
