"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Users as UsersIcon,
  Plus,
  Pencil,
  Trash2,
  Search,
  Sparkles,
  Shield,
  UserCheck,
  UserX,
  Ban,
  Mail,
  Phone,
  Globe2,
  KeyRound,
  } from "lucide-react";
import { Role, type KycStatus, type Role as RoleType } from "@volt/config";
import { passwordSchema, phoneSchema } from "@volt/validation";
import { ApiRequestError, api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete-dialog";
import { formatDate, initials } from "@/lib/format";
import { statusVariant, humanize } from "@/lib/status";
import { cn } from "@/lib/utils";
import { StatChip } from "@/components/ui/stat-chip";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";

type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

interface AdminUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  role: RoleType;
  status: UserStatus;
  emailVerified: boolean;
  kycStatus: KycStatus;
  createdAt: string;
  updatedAt?: string;
}

const USER_STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "BANNED"];

const userFormSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.union([phoneSchema, z.literal("")]).optional(),
    password: z.union([passwordSchema, z.literal("")]).optional(),
    country: z.string().max(60).optional(),
    role: z.nativeEnum(Role),
    status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
    emailVerified: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.email?.trim() && !d.phone?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Provide an email or a phone number",
      });
    }
  });
type UserFormInput = z.infer<typeof userFormSchema>;

type StatusFilter = "ALL" | UserStatus;
type RoleFilter = "ALL" | RoleType;

const emptyDefaults: UserFormInput = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  country: "",
  role: Role.USER,
  status: "ACTIVE",
  emailVerified: true,
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users"],
    // api.get unwraps envelope `data` → user array
    queryFn: () => api.get<AdminUser[]>("/users?page=1&pageSize=100"),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormInput>({
    resolver: zodResolver(userFormSchema),
    defaultValues: emptyDefaults,
  });

  const fullNameValue = watch("fullName");
  const emailValue = watch("email");
  const phoneValue = watch("phone");
  const roleValue = watch("role");
  const statusValue = watch("status");

  const openCreate = () => {
    setEditingId(null);
    reset(emptyDefaults);
    setEditorOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingId(user.id);
    reset({
      fullName: user.fullName,
      email: user.email ?? "",
      phone: user.phone ?? "",
      password: "",
      country: user.country ?? "",
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
    });
    setEditorOpen(true);
  };

  const createUser = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<AdminUser>("/users", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditorOpen(false);
      reset(emptyDefaults);
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch<AdminUser>(`/users/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditorOpen(false);
      setEditingId(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: boolean }>(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteTarget(null);
    },
  });

  const onSubmit = (values: UserFormInput) => {
    const email = values.email?.trim() || undefined;
    const phone = values.phone?.trim() || undefined;
    const country = values.country?.trim() || undefined;
    const password = values.password?.trim() || undefined;

    if (editingId) {
      const payload: Record<string, unknown> = {
        fullName: values.fullName,
        email: email ?? null,
        phone: phone ?? null,
        country: country ?? null,
        role: values.role,
        status: values.status,
        emailVerified: values.emailVerified ?? false,
      };
      if (password) payload.password = password;
      updateUser.mutate({ id: editingId, payload });
    } else {
      if (!password) return;
      createUser.mutate({
        fullName: values.fullName,
        email,
        phone,
        password,
        country,
        role: values.role,
        status: values.status,
        emailVerified: values.emailVerified ?? Boolean(email),
      });
    }
  };

  const users = data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!term) return true;
      return (
        u.fullName.toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.phone ?? "").toLowerCase().includes(term) ||
        (u.country ?? "").toLowerCase().includes(term)
      );
    });
  }, [users, search, statusFilter, roleFilter]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "ACTIVE").length,
      suspended: users.filter((u) => u.status === "SUSPENDED").length,
      banned: users.filter((u) => u.status === "BANNED").length,
      staff: users.filter((u) => u.role !== "USER").length,
    }),
    [users],
  );

  const saving = createUser.isPending || updateUser.isPending || isSubmitting;
  const formError =
    createUser.error instanceof ApiRequestError
      ? createUser.error.message
      : updateUser.error instanceof ApiRequestError
        ? updateUser.error.message
        : createUser.isError || updateUser.isError
          ? "Could not save user."
          : !editingId && !(watch("password") || "").trim()
            ? null
            : null;

  // Extra client check message for create without password
  const passwordRequiredError =
    !editingId && errors.password?.message
      ? errors.password.message
      : !editingId && !(watch("password") || "").trim() && Object.keys(errors).length === 0
        ? undefined
        : errors.password?.message;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-40 rounded-[2rem] bg-[radial-gradient(55%_80%_at_8%_0%,hsl(350_73%_44%/0.2),transparent_60%),radial-gradient(45%_70%_at_92%_0%,hsl(0_0%_10%/0.14),transparent_55%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
            Access · RBAC
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, suspend and delete accounts. Roles control admin access.
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-volt">
          <Plus className="h-4 w-4" />
          New user
        </Button>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatChip icon={UsersIcon} label="Total" value={stats.total} tone="gold" />
        <StatChip icon={UserCheck} label="Active" value={stats.active} tone="green" />
        <StatChip icon={UserX} label="Suspended" value={stats.suspended} tone="amber" />
        <StatChip icon={Ban} label="Banned" value={stats.banned} tone="ink" />
        <StatChip icon={Shield} label="Staff" value={stats.staff} tone="blue" />
      </div>

      <Card className="relative overflow-hidden border-volt/20 bg-gradient-to-br from-volt/10 via-surface to-[hsl(0_0%_10%/0.08)] shadow-card">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)]"
        />
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="relative flex items-center gap-2 rounded-xl border border-border bg-surface/90 px-3">
            <Search className="h-4 w-4 text-volt-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone or country…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="md:w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All statuses</option>
              {USER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:w-48">
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            >
              <option value="ALL">All roles</option>
              {Object.values(Role).map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
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
          {apiErrorMessage(error, "Could not load users.")}
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={users.length === 0 ? "No users yet" : "No matches"}
          description={
            users.length === 0
              ? "Create the first account or wait for registrations."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((user) => (
            <article
              key={user.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-2 shadow-card transition-shadow hover:shadow-lift"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-volt via-[hsl(349_74%_36%)] to-[hsl(0_0%_10%)] opacity-80"
              />
              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-volt/30 to-[hsl(0_0%_10%/0.25)] text-sm font-bold text-volt-dim">
                      {initials(user.fullName) || "?"}
                    </span>
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap gap-1.5">
                        <Badge variant={statusVariant(user.status)}>{humanize(user.status)}</Badge>
                        <Badge variant="volt">{humanize(user.role)}</Badge>
                      </div>
                      <h2 className="truncate text-lg font-bold tracking-tight">{user.fullName}</h2>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email ?? user.phone ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MetaTile
                    label="KYC"
                    value={humanize(user.kycStatus)}
                    tone={user.kycStatus === "APPROVED" ? "green" : "ink"}
                  />
                  <MetaTile
                    label="Joined"
                    value={formatDate(user.createdAt)}
                    tone="ink"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(user)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {user.status === "ACTIVE" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: user.id, status: "SUSPENDED" })}
                    >
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ id: user.id, status: "ACTIVE" })}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    className="ml-auto"
                    onClick={() => setDeleteTarget(user)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none"
          onClose={() => setEditorOpen(false)}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-volt/25 via-surface to-[hsl(0_0%_10%/0.18)] px-6 pb-5 pt-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-volt/35 blur-3xl"
              />
              <div className="relative flex items-start gap-3 pr-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-volt to-[hsl(349_74%_36%)] text-volt-foreground shadow-volt">
                  {editingId ? <Pencil className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-volt-dim">
                    Account
                  </p>
                  <DialogTitle className="font-display text-2xl">
                    {editingId ? "Edit user" : "Create user"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {editingId
                      ? "Update profile, role, status or reset password."
                      : "Provision a customer or staff account with an initial password."}
                  </DialogDescription>
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-border/80 bg-surface/80 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant={statusVariant(statusValue || "ACTIVE")}>
                        {humanize(statusValue || "ACTIVE")}
                      </Badge>
                      <Badge variant="volt">{humanize(roleValue || "USER")}</Badge>
                    </div>
                    <p className="truncate text-lg font-bold tracking-tight">
                      {fullNameValue?.trim() || "New user"}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {emailValue?.trim() || phoneValue?.trim() || "email or phone"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="max-h-[min(62vh,560px)] space-y-4 overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <FormSection
                icon={UsersIcon}
                title="Profile"
                description="Identity and contact details."
                tone="gold"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    className="sm:col-span-2"
                    label="Full name"
                    htmlFor="fullName"
                    error={errors.fullName?.message}
                  >
                    <Input id="fullName" placeholder="Amina Mwangi" {...register("fullName")} />
                  </Field>
                  <Field label="Email" htmlFor="email" error={errors.email?.message}>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        className="pl-9"
                        type="email"
                        placeholder="amina@example.com"
                        {...register("email")}
                      />
                    </div>
                  </Field>
                  <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        className="pl-9"
                        placeholder="+2557…"
                        {...register("phone")}
                      />
                    </div>
                  </Field>
                  <Field label="Country" htmlFor="country" className="sm:col-span-2">
                    <div className="relative">
                      <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="country"
                        className="pl-9"
                        placeholder="Tanzania"
                        {...register("country")}
                      />
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={Shield}
                title="Access"
                description="Role and account status (RBAC)."
                tone="blue"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Role" htmlFor="role">
                    <Select id="role" {...register("role")}>
                      {Object.values(Role).map((r) => (
                        <option key={r} value={r}>
                          {humanize(r)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Status" htmlFor="status">
                    <Select id="status" {...register("status")}>
                      {USER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {humanize(s)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Email verified" htmlFor="emailVerified" className="sm:col-span-2">
                    <Select
                      id="emailVerified"
                      value={watch("emailVerified") ? "true" : "false"}
                      onChange={(e) =>
                        setValue("emailVerified", e.target.value === "true", {
                          shouldValidate: true,
                        })
                      }
                    >
                      <option value="true">Verified</option>
                      <option value="false">Not verified</option>
                    </Select>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                icon={KeyRound}
                title="Password"
                description={
                  editingId
                    ? "Leave blank to keep the current password."
                    : "Initial password — user can reset later."
                }
                tone="green"
              >
                <Field
                  label={editingId ? "New password (optional)" : "Password"}
                  htmlFor="password"
                  hint="8+ chars, upper, lower, number"
                  error={
                    editingId
                      ? errors.password?.message
                      : passwordRequiredError ||
                        (!editingId && !watch("password")
                          ? undefined
                          : errors.password?.message)
                  }
                >
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={editingId ? "Leave blank to keep" : "Admin@12345"}
                    {...register("password", {
                      validate: (v) => {
                        if (editingId) {
                          if (!v) return true;
                          const r = passwordSchema.safeParse(v);
                          return r.success || r.error.issues[0]?.message;
                        }
                        if (!v) return "Password is required";
                        const r = passwordSchema.safeParse(v);
                        return r.success || r.error.issues[0]?.message;
                      },
                    })}
                  />
                </Field>
              </FormSection>

              {formError ? <Alert variant="danger">{formError}</Alert> : null}

              <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur">
                <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="shadow-volt">
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create user"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete user?"
        description={
          <>
            Permanently remove <strong>{deleteTarget?.fullName}</strong>. Blocked if they have
            ledger, payments, investments or enrollments — use Suspend/Ban instead.
          </>
        }
        error={
          deleteUser.isError ? apiErrorMessage(deleteUser.error, "Could not delete user.") : null
        }
        pending={deleteUser.isPending}
        disabled={!deleteTarget}
        onConfirm={() => deleteTarget && deleteUser.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function MetaTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "ink";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2",
        tone === "green"
          ? "border-success/25 bg-success/10"
          : "border-border/70 bg-surface-2/50",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
